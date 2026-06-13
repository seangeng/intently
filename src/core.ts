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
  armedFrames: number; // consecutive frames above the prerender bar
  emitted: number; // last confidence sent to onPredict (dedupe)
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

const ARM_FRAMES = 8; // ~130ms at 60fps — sustained, not wall-clock (survives idle)

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/**
 * Start intent-aware prefetching. Zero-config: `intently()` binds every
 * eligible same-origin link and prefetches the one the cursor is heading
 * toward. Returns a handle to control or tear it down.
 */
export function intently(options: IntentlyOptions = {}): IntentlyHandle {
  const opts = { ...DEFAULTS, ...options };
  const root: ParentNode = opts.root ?? (typeof document !== "undefined" ? document : (null as never));
  const loader = createLoader(opts.limit);

  const signals = new Set<Signal>(opts.signals ?? ["trajectory", "proximity", "hover", "touch"]);
  const useTrajectory = signals.has("trajectory");
  const useProximity = signals.has("proximity");
  const useHover = signals.has("hover");
  const usePress = opts.eagerOnPress; // pointerdown / touchstart — covers touch + mouse
  const useViewport = signals.has("viewport") || opts.viewportPrefetch;

  // No-op safely in non-DOM environments (SSR) or when we shouldn't run.
  if (
    typeof window === "undefined" ||
    !root ||
    loader.tier === "none" ||
    !shouldRun(opts.respectSaveData)
  ) {
    return { prefetch() {}, prerender() {}, destroy() {}, loaded: new Set() };
  }

  const eligible = makeEligible(opts);
  const candidates = new Map<HTMLAnchorElement, Candidate>();
  const visible = new Set<HTMLAnchorElement>();
  const rectCache = new Map<HTMLAnchorElement, DOMRect>();
  const loadedView = new Set<string>();
  let rectsDirty = false;
  let destroyed = false;

  const pointer = { x: 0, y: 0 };
  const vel: Velocity = { x: 0, y: 0 };
  let prevSample: { x: number; y: number; t: number } | null = null;
  let lastMove = 0;
  let raf = 0;

  // Prerender *runs* the page, so only ever prerender links that look free of
  // side effects: no query string, not nofollow/external, not a new tab.
  function prerenderSafe(el: HTMLAnchorElement, urlStr: string): boolean {
    try {
      if (new URL(urlStr).search) return false;
    } catch {
      return false;
    }
    const rel = (el.getAttribute("rel") || "").toLowerCase();
    if (/\b(nofollow|external)\b/.test(rel)) return false;
    const target = el.getAttribute("target");
    if (target && target !== "_self") return false;
    return true;
  }

  function load(el: HTMLAnchorElement, url: string, confidence: number, wantPrerender: boolean) {
    if (destroyed) return;
    let strategy: "prefetch" | "prerender" = "prefetch";
    if (
      wantPrerender &&
      opts.prerenderThreshold !== false &&
      confidence >= opts.prerenderThreshold &&
      prerenderSafe(el, url)
    ) {
      strategy = "prerender";
    }
    const used = loader.load(url, strategy);
    if (used) {
      loadedView.add(url);
      opts.onLoad?.(url, used);
    }
  }

  function emit(el: HTMLAnchorElement, c: Candidate, confidence: number, signal: Signal) {
    if (!opts.onPredict) return;
    if (Math.abs(c.emitted - confidence) < 0.02) return; // only on meaningful change
    c.emitted = confidence;
    opts.onPredict({ el, url: c.url, confidence, signal });
  }

  // ---- candidate discovery -------------------------------------------------

  function consider(el: HTMLAnchorElement): Candidate | null {
    const url = eligible(el);
    const existing = candidates.get(el);
    if (!url) {
      if (existing) drop(el);
      return null;
    }
    if (existing) {
      existing.url = url; // href changed in place (SPA routers) — keep it fresh
      return existing;
    }
    const c: Candidate = { url, armedFrames: 0, emitted: -1 };
    candidates.set(el, c);
    io.observe(el);
    return c;
  }

  function drop(el: HTMLAnchorElement) {
    if (candidates.delete(el)) {
      io.unobserve(el);
      visible.delete(el);
      rectCache.delete(el);
    }
  }

  function scan() {
    root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach(consider);
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as HTMLAnchorElement;
        if (e.isIntersecting) {
          visible.add(el);
          rectCache.set(el, e.boundingClientRect as DOMRect); // fresh at callback time
          if (useViewport) {
            const c = candidates.get(el);
            if (c) idle(() => load(el, c.url, 0, false));
          }
        } else {
          visible.delete(el);
          rectCache.delete(el);
        }
      }
    },
    { rootMargin: "0px" },
  );

  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "attributes") {
        if (m.target instanceof HTMLAnchorElement) consider(m.target);
        continue;
      }
      m.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return;
        if ((n as Element).matches?.("a[href]")) consider(n as HTMLAnchorElement);
        n.querySelectorAll?.<HTMLAnchorElement>("a[href]").forEach(consider);
      });
      m.removedNodes.forEach((n) => {
        if (!(n instanceof Element)) return;
        if ((n as Element).matches?.("a[href]")) drop(n as HTMLAnchorElement);
        n.querySelectorAll?.("a[href]").forEach((el) => drop(el as HTMLAnchorElement));
      });
    }
  });

  // ---- the scoring loop (cached rects — no per-frame layout reads) ----------

  function refreshRects() {
    for (const el of visible) rectCache.set(el, el.getBoundingClientRect());
    rectsDirty = false;
  }

  function kick() {
    if (!raf && !destroyed && (useProximity || useTrajectory)) raf = requestAnimationFrame(tick);
  }

  function tick(t: number) {
    if (destroyed) { raf = 0; return; }
    if (document.hidden || t - lastMove > 500) { raf = 0; return; }
    if (rectsDirty) refreshRects();
    for (const el of visible) {
      const c = candidates.get(el);
      if (!c || loadedView.has(c.url)) continue;
      const r = rectCache.get(el);
      if (!r) continue;
      const prox = useProximity ? proximityScore(pointer.x, pointer.y, r, opts.proximityRadius) : 0;
      const traj = useTrajectory ? trajectoryScore(pointer.x, pointer.y, vel, r) : 0;
      const confidence = Math.max(prox, traj);
      const signal: Signal = traj >= prox ? "trajectory" : "proximity";

      if (confidence < 0.05) {
        c.armedFrames = 0;
        emit(el, c, 0, signal);
        continue;
      }

      let wantPrerender = false;
      if (opts.prerenderThreshold !== false && confidence >= opts.prerenderThreshold) {
        c.armedFrames++;
        if (c.armedFrames >= ARM_FRAMES) wantPrerender = true;
      } else {
        c.armedFrames = 0;
      }

      if (confidence >= opts.intentThreshold || wantPrerender) {
        load(el, c.url, confidence, wantPrerender);
      }
      emit(el, c, confidence, signal);
    }
    raf = requestAnimationFrame(tick);
  }

  // ---- event wiring --------------------------------------------------------

  function onMove(e: PointerEvent) {
    updateVelocity(vel, prevSample, e.clientX, e.clientY, e.timeStamp);
    prevSample = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    lastMove = now();
    kick();
  }

  let hovered: HTMLAnchorElement | null = null;
  let hoverTimer = 0;
  function onOver(e: PointerEvent) {
    const a = (e.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || a === hovered) return;
    hovered = a;
    clearTimeout(hoverTimer);
    const c = consider(a);
    if (!c || loadedView.has(c.url)) return;
    hoverTimer = window.setTimeout(() => {
      if (hovered === a) load(a, c.url, 1, true);
    }, opts.hoverDelay);
  }
  function onOut(e: PointerEvent) {
    // pointerout fires when crossing onto a child of the link — ignore those.
    if (hovered && e.relatedTarget instanceof Node && hovered.contains(e.relatedTarget)) return;
    hovered = null;
    clearTimeout(hoverTimer);
  }

  function onPress(e: Event) {
    const a = (e.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a) return;
    const c = consider(a);
    if (c && !loadedView.has(c.url)) load(a, c.url, 1, false);
  }

  function onScroll() {
    rectsDirty = true;
  }
  function onVisibility() {
    if (!document.hidden) {
      lastMove = now();
      kick();
    }
  }

  function idle(fn: () => void) {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const guarded = () => { if (!destroyed) fn(); };
    if (ric) ric(guarded);
    else setTimeout(guarded, 1);
  }

  // ---- boot ----------------------------------------------------------------

  scan();
  // documentElement, not body — body may be null if intently() runs in <head>.
  mo.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href"],
  });
  window.addEventListener("pointermove", onMove, { passive: true });
  if (useHover) {
    window.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerout", onOut, { passive: true });
  }
  if (usePress) {
    window.addEventListener("pointerdown", onPress, { passive: true });
    window.addEventListener("touchstart", onPress, { passive: true });
  }
  window.addEventListener("scroll", onScroll, { passive: true, capture: true });
  window.addEventListener("resize", onScroll, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

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
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(hoverTimer);
      io.disconnect();
      mo.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerout", onOut);
      window.removeEventListener("pointerdown", onPress);
      window.removeEventListener("touchstart", onPress);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      loader.destroy();
      candidates.clear();
      visible.clear();
      rectCache.clear();
    },
    loaded: loadedView,
  };
}
