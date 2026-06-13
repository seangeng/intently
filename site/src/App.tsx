import { useEffect, useRef, useState } from "react";
import { proximityScore, trajectoryScore, updateVelocity, type Velocity } from "intently";

const LINKS = [
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
  { label: "Blog", href: "/blog" },
  { label: "Changelog", href: "/changelog" },
  { label: "Customers", href: "/customers" },
  { label: "Careers", href: "/careers" },
];

type Tier = "prefetch" | "prerender";
interface LogEntry { url: string; tier: Tier; t: number }

const srSupported =
  typeof HTMLScriptElement !== "undefined" &&
  typeof HTMLScriptElement.supports === "function" &&
  HTMLScriptElement.supports("speculationrules");

function LiveDemo() {
  const zoneRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [conf, setConf] = useState<number[]>(() => LINKS.map(() => 0));
  const [state, setState] = useState<("idle" | Tier)[]>(() => LINKS.map(() => "idle"));
  const [log, setLog] = useState<LogEntry[]>([]);

  const pointer = useRef<{ x: number; y: number } | null>(null);
  const vel = useRef<Velocity>({ x: 0, y: 0 });
  const prev = useRef<{ x: number; y: number; t: number } | null>(null);
  const armed = useRef<number[]>(LINKS.map(() => 0));
  const fired = useRef<Set<number>>(new Set());

  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => {
      const p = pointer.current;
      if (p) {
        const nextConf: number[] = [];
        const nextState: ("idle" | Tier)[] = [];
        for (let i = 0; i < LINKS.length; i++) {
          const el = cardRefs.current[i];
          if (!el) { nextConf.push(0); nextState.push("idle"); continue; }
          const r = el.getBoundingClientRect();
          const c = Math.max(
            proximityScore(p.x, p.y, r, 90),
            trajectoryScore(p.x, p.y, vel.current, r),
          );
          nextConf.push(c);

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
          nextState.push(s);

          // log once per card per approach (reset when it goes idle)
          if (s !== "idle" && !fired.current.has(i)) {
            fired.current.add(i);
            setLog((L) => [{ url: LINKS[i].href, tier: s as Tier, t }, ...L].slice(0, 8));
          } else if (s === "prerender" && fired.current.has(i)) {
            // upgrade prefetch → prerender in the log
            setLog((L) =>
              L[0]?.url === LINKS[i].href && L[0]?.tier === "prefetch"
                ? [{ url: LINKS[i].href, tier: "prerender", t }, ...L.slice(1)]
                : L,
            );
          }
          if (s === "idle") fired.current.delete(i);
        }
        setConf(nextConf);
        setState(nextState);
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
    setConf(LINKS.map(() => 0));
    setState(LINKS.map(() => "idle"));
  }

  return (
    <div className="demo">
      <div className="demo-stage" ref={zoneRef} onPointerMove={onMove} onPointerLeave={onLeave}>
        <div className="demo-nav">
          {LINKS.map((l, i) => (
            <a
              key={l.href}
              ref={(el) => { cardRefs.current[i] = el; }}
              href={l.href}
              onClick={(e) => e.preventDefault()}
              className={`demo-link ${state[i]}`}
              style={{ ["--c" as string]: conf[i].toFixed(3) }}
            >
              <span>{l.label}</span>
              {state[i] !== "idle" && <em className={`tag ${state[i]}`}>{state[i]}</em>}
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

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code">
      <button
        className="copy"
        onClick={() => {
          navigator.clipboard?.writeText(children);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? "copied" : "copy"}
      </button>
      <pre><code>{children}</code></pre>
    </div>
  );
}

export function App() {
  return (
    <main>
      <header className="hero">
        <div className="badge">~3.5KB · zero-config · MIT</div>
        <h1>intently</h1>
        <p className="tag-line">
          Intent-aware prefetching. It watches where your cursor is <em>headed</em> —
          not just what's on screen or what you've hovered — and loads the next page
          a beat before you click.
        </p>
        <div className="cta">
          <code className="install">npm i intently</code>
          <a className="btn" href="https://github.com/seangeng/intently">GitHub</a>
          <a className="btn" href="https://www.npmjs.com/package/intently">npm</a>
        </div>
      </header>

      <section>
        <LiveDemo />
      </section>

      <section className="how">
        <h2>How it works</h2>
        <div className="steps">
          <div>
            <span className="n">1</span>
            <h3>Predict</h3>
            <p>
              Per <code>pointermove</code>, a smoothed velocity plus each link's
              geometry give two scores — proximity (distance to its nearest edge)
              and trajectory (are you aimed at it?). The higher is the confidence
              it's your next click.
            </p>
          </div>
          <div>
            <span className="n">2</span>
            <h3>Tier by confidence</h3>
            <p>
              Crossing the intent bar prefetches. Sustained high confidence
              upgrades to a <em>prerender</em> — the next page built in a hidden
              tab, so the click is instant. Prerender stays rare and high-bar.
            </p>
          </div>
          <div>
            <span className="n">3</span>
            <h3>Load, best backend first</h3>
            <p>
              The native Speculation Rules API where available (real prefetch and
              prerender), falling back to <code>&lt;link rel=prefetch&gt;</code> and
              then a low-priority <code>fetch</code>. Offscreen links cost nothing.
            </p>
          </div>
        </div>
      </section>

      <section className="install-section">
        <h2>Drop it in</h2>
        <Code>{`import { intently } from "intently";

intently(); // binds every eligible <a>, prefetches what you're heading toward`}</Code>
        <p className="muted">React:</p>
        <Code>{`import { useIntently } from "intently/react";

function App() {
  useIntently();
  return <Routes />;
}`}</Code>
        <p className="muted">Tune it:</p>
        <Code>{`intently({
  ignores: [/\\/logout/, "?add-to-cart"], // never touch side-effect links
  prerenderThreshold: 0.85,               // false to disable prerender
  proximityRadius: 80,
  onPredict: ({ url, confidence }) => {}, // wire a visual affordance
});`}</Code>
      </section>

      <section>
        <h2>Versus the others</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th></th><th>signal</th><th>zero-config</th><th>prerender</th></tr>
            </thead>
            <tbody>
              <tr><td>quicklink</td><td>viewport + idle</td><td>yes</td><td>via SR</td></tr>
              <tr><td>instant.page</td><td>hover (65ms)</td><td>yes</td><td>no</td></tr>
              <tr><td>ForesightJS</td><td>trajectory</td><td>register elements</td><td>no</td></tr>
              <tr className="me"><td>intently</td><td>trajectory + proximity</td><td>yes</td><td>yes (tiered)</td></tr>
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Trajectory prediction is well-trodden — ForesightJS does it well, and
          there's cursor-extrapolation patent prior art going back years.
          intently's bet is prediction + the right modern loader + nothing to
          configure, in one drop-in.
        </p>
      </section>

      <footer>
        <p>
          By <a href="https://seangeng.com">Sean Geng</a> · the{" "}
          <a href="https://seangeng.com/writing/prefetching-on-intent">writeup</a> ·{" "}
          <a href="https://github.com/seangeng/intently">GitHub</a> ·{" "}
          <a href="https://www.npmjs.com/package/intently">npm</a> · MIT
        </p>
        <p className="muted small">
          Credits: ForesightJS, instant.page, quicklink, the Speculation Rules
          API, and my own input-anticipation work.
        </p>
      </footer>
    </main>
  );
}
