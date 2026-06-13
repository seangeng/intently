import { useEffect, useRef, useState } from "react";
import { proximityScore, trajectoryScore, updateVelocity, type Velocity } from "intently";

/* ================================================================== */
/* 1. Live prediction demo — cursor → confidence → prefetch/prerender  */
/* ================================================================== */

const LINKS = [
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
  { label: "Blog", href: "/blog" },
  { label: "Changelog", href: "/changelog" },
  { label: "Customers", href: "/customers" },
  { label: "Careers", href: "/careers" },
];

type Tier = "prefetch" | "prerender";
interface LogEntry { url: string; tier: Tier }

const srSupported =
  typeof HTMLScriptElement !== "undefined" &&
  typeof HTMLScriptElement.supports === "function" &&
  HTMLScriptElement.supports("speculationrules");

export function LiveDemo() {
  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [tiers, setTiers] = useState<("idle" | Tier)[]>(() => LINKS.map(() => "idle"));
  const [log, setLog] = useState<LogEntry[]>([]);

  const pointer = useRef<{ x: number; y: number } | null>(null);
  const vel = useRef<Velocity>({ x: 0, y: 0 });
  const prev = useRef<{ x: number; y: number; t: number } | null>(null);
  const armed = useRef<number[]>(LINKS.map(() => 0));
  const fired = useRef<Set<number>>(new Set());
  const rects = useRef<(DOMRect | null)[]>([]);
  const tierRef = useRef<("idle" | Tier)[]>(LINKS.map(() => "idle"));

  function measure() {
    rects.current = cardRefs.current.map((el) => el?.getBoundingClientRect() ?? null);
  }
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, []);

  function paint(el: HTMLAnchorElement, c: number, tier: "idle" | Tier) {
    const rgb = tier === "prerender" ? "34,197,94" : "59,130,246";
    el.style.setProperty("--c", c.toFixed(3));
    el.style.background = `linear-gradient(0deg, rgba(${rgb},${c * 0.16}), rgba(${rgb},${c * 0.16})), var(--card)`;
    el.style.boxShadow = c > 0.04 ? `0 0 ${(c * 26).toFixed(1)}px rgba(${rgb},${c * 0.5})` : "none";
    el.style.transform = `translateY(${(-c * 3).toFixed(2)}px)`;
    el.style.borderColor = tier === "idle" ? "var(--border)" : `rgb(${rgb})`;
    el.style.color = tier === "idle" ? "#d6d6d6" : "#fff";
  }

  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      const p = pointer.current;
      if (p) {
        const next = tierRef.current.slice();
        let changed = false;
        for (let i = 0; i < LINKS.length; i++) {
          const el = cardRefs.current[i];
          const r = rects.current[i];
          if (!el || !r) continue;
          const c = Math.max(
            proximityScore(p.x, p.y, r, 90),
            trajectoryScore(p.x, p.y, vel.current, r),
          );
          let s: "idle" | Tier = "idle";
          if (c >= 0.85) {
            if (!armed.current[i]) armed.current[i] = t;
            else if (t - armed.current[i] > 120) s = "prerender";
            else s = "prefetch";
          } else if (c >= 0.5) {
            armed.current[i] = 0;
            s = "prefetch";
          } else {
            armed.current[i] = 0;
          }
          paint(el, c, s);
          if (s !== next[i]) { next[i] = s; changed = true; }
          if (s !== "idle" && !fired.current.has(i)) {
            fired.current.add(i);
            setLog((L) => [{ url: LINKS[i].href, tier: s as Tier }, ...L].slice(0, 8));
          } else if (s === "prerender" && fired.current.has(i)) {
            setLog((L) =>
              L[0]?.url === LINKS[i].href && L[0]?.tier === "prefetch"
                ? [{ url: LINKS[i].href, tier: "prerender" }, ...L.slice(1)]
                : L,
            );
          }
          if (s === "idle") fired.current.delete(i);
        }
        if (changed) { tierRef.current = next; setTiers(next); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function onMove(e: React.PointerEvent) {
    updateVelocity(vel.current, prev.current, e.clientX, e.clientY, e.timeStamp);
    prev.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    pointer.current = { x: e.clientX, y: e.clientY };
  }
  function onLeave() {
    pointer.current = null;
    prev.current = null;
    vel.current = { x: 0, y: 0 };
    armed.current = LINKS.map(() => 0);
    fired.current.clear();
    cardRefs.current.forEach((el) => el && paint(el, 0, "idle"));
    tierRef.current = LINKS.map(() => "idle");
    setTiers(LINKS.map(() => "idle"));
  }

  return (
    <div className="demo">
      <div className="demo-stage" onPointerMove={onMove} onPointerLeave={onLeave}>
        <div className="demo-nav">
          {LINKS.map((l, i) => (
            <a
              key={l.href}
              ref={(el) => { cardRefs.current[i] = el; }}
              href={l.href}
              onClick={(e) => e.preventDefault()}
              className={`demo-link ${tiers[i]}`}
            >
              <span>{l.label}</span>
              {tiers[i] !== "idle" && <em className={`tag ${tiers[i]}`}>{tiers[i]}</em>}
            </a>
          ))}
        </div>
        <p className="demo-hint">move toward a link — watch it warm, prefetch, then prerender</p>
      </div>
      <aside className="demo-log">
        <div className="demo-log-head">
          <span>loader</span>
          <code>{srSupported ? "Speculation Rules" : "link rel=prefetch"}</code>
        </div>
        {log.length === 0 ? (
          <p className="muted">No loads yet. Aim at a link.</p>
        ) : (
          <ul>
            {log.map((e, i) => (
              <li key={i}>
                <em className={`tag ${e.tier}`}>{e.tier}</em>
                <code>{e.url}</code>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

/* ================================================================== */
/* 2. Speed race — the click-to-paint gap, made visible                */
/* ================================================================== */

const LATENCY = 700; // simulated server latency, ms

export function Race() {
  const [left, setLeft] = useState<{ phase: "idle" | "loading" | "done"; ms: number }>({ phase: "idle", ms: 0 });
  const [right, setRight] = useState<{ phase: "idle" | "loading" | "done"; ms: number }>({ phase: "idle", ms: 0 });
  const timers = useRef<number[]>([]);

  function run() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLeft({ phase: "loading", ms: 0 });
    setRight({ phase: "loading", ms: 0 });
    // Right was prefetched — paints next frame.
    timers.current.push(window.setTimeout(() => setRight({ phase: "done", ms: 0 }), 60));
    // Left waits for the network.
    const start = performance.now();
    timers.current.push(
      window.setTimeout(() => setLeft({ phase: "done", ms: Math.round(performance.now() - start) }), LATENCY),
    );
  }
  function reset() {
    timers.current.forEach(clearTimeout);
    setLeft({ phase: "idle", ms: 0 });
    setRight({ phase: "idle", ms: 0 });
  }
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const Panel = ({ title, sub, state, tone }: {
    title: string; sub: string; state: { phase: string; ms: number }; tone: string;
  }) => (
    <div className={`race-panel ${tone}`}>
      <div className="race-bar"><span className="dot r" /><span className="dot y" /><span className="dot g" /><code>/pricing</code></div>
      <div className="race-view">
        {state.phase === "idle" && <span className="muted small">click “navigate” →</span>}
        {state.phase === "loading" && <span className="race-spin" />}
        {state.phase === "done" && (
          <div className="race-page">
            <div className="rp-h" /><div className="rp-l" /><div className="rp-l short" /><div className="rp-l" />
            <span className="race-ms">{state.ms === 0 ? "instant" : `${state.ms}ms`}</span>
          </div>
        )}
      </div>
      <div className="race-foot"><b>{title}</b><em>{sub}</em></div>
    </div>
  );

  return (
    <div className="race">
      <div className="race-grid">
        <Panel title="Without prefetch" sub="waits for the server" state={left} tone="base" />
        <Panel title="With intently" sub="already prefetched on intent" state={right} tone="prerender" />
      </div>
      <div className="race-controls">
        <button className="btn primary" onClick={run}>navigate ↵</button>
        <button className="btn" onClick={reset}>reset</button>
        <span className="muted small">Simulated {LATENCY}ms latency, to make the gap visible.</span>
      </div>
    </div>
  );
}

/* ================================================================== */
/* 3. The numbers — perceived-load model + real bundle sizes           */
/* ================================================================== */

function Bar({ label, ms, width, tone, sub, instant }: {
  label: string; ms: number; width: string; tone: string; sub: string; instant?: boolean;
}) {
  return (
    <div className="bar-row">
      <div className="bar-head"><span>{label}</span><b>{instant ? "≈ instant" : `${ms}ms`}</b></div>
      <div className="bar-track"><i className={`bar-fill ${tone}`} style={{ width }} /></div>
      <span className="bar-sub">{sub}</span>
    </div>
  );
}

const SIZES = [
  { name: "instant.page", kb: 1.3 },
  { name: "quicklink", kb: 2.4 },
  { name: "intently", kb: 4.0, me: true },
  { name: "ForesightJS", kb: 5.5 },
];

export function Stats() {
  const [load, setLoad] = useState(800);
  const [lead, setLead] = useState(250);
  const prefetch = Math.max(0, load - lead);
  const max = Math.max(load, 1);
  const pct = (ms: number) => `${Math.max(2, (ms / max) * 100)}%`;
  const maxKb = Math.max(...SIZES.map((s) => s.kb));

  return (
    <section className="stats" id="numbers">
      <h2>The numbers</h2>
      <p className="muted">
        No fabricated benchmarks — real savings depend on your page and your
        users. This is the mechanism with <em>your</em> inputs, plus real bundle sizes.
      </p>

      <div className="model">
        <div className="model-controls">
          <label>
            page load time <b>{load}ms</b>
            <input type="range" min={200} max={2000} step={50} value={load} onChange={(e) => setLoad(+e.target.value)} />
          </label>
          <label>
            intent lead time <b>{lead}ms</b>
            <input type="range" min={50} max={500} step={25} value={lead} onChange={(e) => setLead(+e.target.value)} />
          </label>
        </div>
        <div className="bars">
          <Bar label="No prefetch" ms={load} width={pct(load)} tone="base" sub="click → wait for the whole load" />
          <Bar label="intently · prefetch" ms={prefetch} width={pct(prefetch)} tone="prefetch" sub={`load starts ${lead}ms early, on intent`} />
          <Bar label="intently · prerender" ms={0} width="2%" tone="prerender" sub="page already built — instant swap" instant />
        </div>
        <p className="muted small">
          Perceived wait <em>after</em> the click. Prefetch removes up to the lead
          window; prerender removes the load entirely. Lead time varies —
          instant.page measures ~300ms on hover; trajectory fires earlier.
        </p>
      </div>

      <div className="sizes">
        <h3>Bundle size</h3>
        {SIZES.map((s) => (
          <div key={s.name} className={`size-row ${s.me ? "me" : ""}`}>
            <span className="size-name">{s.name}</span>
            <span className="size-bar"><i style={{ width: `${(s.kb / maxKb) * 100}%` }} /></span>
            <span className="size-kb">{s.kb} KB</span>
          </div>
        ))}
        <p className="muted small">
          gzip, via bundlephobia (Jun 2026). intently costs a little more than the
          hover/viewport tools because it also predicts trajectory and drives
          prerender tiers — still tiny, and lighter than ForesightJS.
        </p>
      </div>
    </section>
  );
}
