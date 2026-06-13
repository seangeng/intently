import { makeEligible, shouldRun } from "./eligibility";
import { createLoader } from "./loader";
import {
  proximityScore,
  trajectoryScore,
  updateVelocity,
  type Velocity,
} from "./predict";
import type { IntentlyHandle, IntentlyOptions, Signal } from "./types";

interface Candidate {
  url: string;
  armedSince: number; // when confidence first crossed the prerender bar (0 = not armed)
}

const DEFAULTS = {
  intentThreshold: 0.5,
  prerenderThreshold: 0.85 as number | false,
  proximityRadius: 80,
  hoverDelay: 65,
  eagerOnPress: true,
  viewportPrefetch: false,
  limit: Infinity,
  respectSaveData: true,
};

/**
 * Start intent-aware prefetching. Zero-config: `intently()` binds every
 * eligible same-origin link and prefetches the one the cursor is heading
 * toward. Returns a handle to control or tear it down.
 */
export function intently(options: IntentlyOptions = {}): IntentlyHandle {
  const opts = { ...DEFAULTS, ...options };
  const root: ParentNode = opts.root ?? (typeof document !== "undefined" ? document : (null as never));
  const loader = createLoader(opts.limit);

  const signals = new Set<Signal>(
    opts.signals ?? ["trajectory", "proximity", "hover", "touch"],
  );
  const useTrajectory = signals.has("trajectory");
  const useProximity = signals.has("proximity");
  const useHover = signals.has("hover");
  const useTouch = signals.has("touch") && opts.eagerOnPress;
  const useViewport = signals.has("viewport") || opts.viewportPrefetch;

  // No-op safely in non-DOM environments (SSR).
  if (typeof window === "undefined" || !root || loader.tier === "none" || !shouldRun(opts.respectSaveData)) {
    return { prefetch() {}, prerender() {}, destroy() {}, loaded: new Set() };
  }

  const eligible = makeEligible(opts);
  const candidates = new Map<HTMLAnchorElement, Candidate>();
  const visible = new Set<HTMLAnchorElement>();
  const loadedView = new Set<string>();

  const pointer = { x: 0, y: 0 };
  const vel: Velocity = { x: 0, y: 0 };
  let prevSample: { x: number; y: number; t: number } | null = null;
  let lastMove = 0;
  let raf = 0;

  function fire(el: HTMLAnchorElement, url: string, confidence: number, signal: Signal, prerender: boolean) {
    let strategy: "prefetch" | "prerender" = "prefetch";
    if (prerender && opts.prerenderThreshold !== false && confidence >= opts.prerenderThreshold) {
      strategy = "prerender";
    }
    const used = loader.load(url, strategy);
    if (used) {
      loadedView.add(url);
      opts.onLoad?.(url, used);
    }
    opts.onPredict?.({ el, url, confidence, signal });
  }

  // ---- candidate discovery -------------------------------------------------

  function consider(el: HTMLAnchorElement) {
    if (candidates.has(el)) return;
    const url = eligible(el);
    if (!url) return;
    candidates.set(el, { url, armedSince: 0 });
    io.observe(el);
  }

  function scan() {
    const links = root.querySelectorAll<HTMLAnchorElement>("a[href]");
    links.forEach(consider);
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as HTMLAnchorElement;
        if (e.isIntersecting) {
          visible.add(el);
          if (useViewport) {
            const c = candidates.get(el);
            if (c) requestIdle(() => fire(el, c.url, 0, "viewport", false));
          }
        } else {
          visible.delete(el);
        }
      }
    },
    { rootMargin: "0px" },
  );

  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return;
        if (n.matches?.("a[href]")) consider(n as HTMLAnchorElement);
        n.querySelectorAll?.<HTMLAnchorElement>("a[href]").forEach(consider);
      });
      m.removedNodes.forEach((n) => {
        if (!(n instanceof Element)) return;
        const drop = (el: Element) => {
          const a = el as HTMLAnchorElement;
          if (candidates.delete(a)) {
            io.unobserve(a);
            visible.delete(a);
          }
        };
        if (n.matches?.("a[href]")) drop(n);
        n.querySelectorAll?.("a[href]").forEach(drop);
      });
    }
  });

  // ---- the scoring loop ----------------------------------------------------

  function tick(now: number) {
    if (document.hidden || now - lastMove > 500) {
      raf = 0; // go idle until the next move
      return;
    }
    for (const el of visible) {
      const c = candidates.get(el);
      if (!c || loadedView.has(c.url)) continue;
      const r = el.getBoundingClientRect();
      const prox = useProximity ? proximityScore(pointer.x, pointer.y, r, opts.proximityRadius) : 0;
      const traj = useTrajectory ? trajectoryScore(pointer.x, pointer.y, vel, r) : 0;
      const confidence = Math.max(prox, traj);
      if (confidence < 0.05) {
        c.armedSince = 0;
        continue;
      }
      const signal: Signal = traj >= prox ? "trajectory" : "proximity";

      // Prerender wants sustained high confidence, not a flicker.
      let prerender = false;
      if (opts.prerenderThreshold !== false && confidence >= opts.prerenderThreshold) {
        if (!c.armedSince) c.armedSince = now;
        else if (now - c.armedSince > 120) prerender = true;
      } else {
        c.armedSince = 0;
      }

      if (confidence >= opts.intentThreshold || prerender) {
        fire(el, c.url, confidence, signal, prerender);
      } else if (opts.onPredict) {
        opts.onPredict({ el, url: c.url, confidence, signal });
      }
    }
    raf = requestAnimationFrame(tick);
  }

  // ---- event wiring --------------------------------------------------------

  function onMove(e: PointerEvent) {
    const t = e.timeStamp;
    updateVelocity(vel, prevSample, e.clientX, e.clientY, t);
    prevSample = { x: e.clientX, y: e.clientY, t };
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    lastMove = typeof performance !== "undefined" ? performance.now() : t;
    if (!raf && (useProximity || useTrajectory)) raf = requestAnimationFrame(tick);
  }

  let hovered: HTMLAnchorElement | null = null;
  let hoverTimer = 0;
  function onOver(e: PointerEvent) {
    if (!useHover) return;
    const a = (e.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || a === hovered) return;
    hovered = a;
    clearTimeout(hoverTimer);
    const c = candidates.get(a);
    if (!c || loadedView.has(c.url)) return;
    hoverTimer = window.setTimeout(() => {
      if (hovered === a) fire(a, c.url, 1, "hover", true);
    }, opts.hoverDelay);
  }
  function onOut() {
    hovered = null;
    clearTimeout(hoverTimer);
  }

  function onPress(e: Event) {
    if (!useTouch) return;
    const a = (e.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a) return;
    const c = candidates.get(a);
    if (c && !loadedView.has(c.url)) fire(a, c.url, 1, "touch", false);
  }

  function requestIdle(fn: () => void) {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (ric) ric(fn);
    else setTimeout(fn, 1);
  }

  // ---- boot ----------------------------------------------------------------

  scan();
  mo.observe(root === document ? document.body : (root as Node), { childList: true, subtree: true });
  window.addEventListener("pointermove", onMove, { passive: true });
  if (useHover) window.addEventListener("pointerover", onOver, { passive: true });
  window.addEventListener("pointerout", onOut, { passive: true });
  if (useTouch) {
    window.addEventListener("pointerdown", onPress, { passive: true });
    window.addEventListener("touchstart", onPress, { passive: true });
  }

  return {
    prefetch: (url) => {
      const used = loader.load(url, "prefetch");
      if (used) loadedView.add(url);
    },
    prerender: (url) => {
      const used = loader.load(url, "prerender");
      if (used) loadedView.add(url);
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(hoverTimer);
      io.disconnect();
      mo.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerout", onOut);
      window.removeEventListener("pointerdown", onPress);
      window.removeEventListener("touchstart", onPress);
      loader.destroy();
      candidates.clear();
      visible.clear();
    },
    loaded: loadedView,
  };
}
