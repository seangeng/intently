import { Code } from "../shared";
import { LiveDemo, Race, Stats } from "../demos";

export function Landing() {
  return (
    <>
      <header className="hero">
        <div className="badge">~4KB · zero-config · MIT</div>
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

      <section>
        <h2>See the difference</h2>
        <p className="muted">
          The payoff is the ~200ms between when you <em>decide</em> to click and when
          you actually do. intently spends it loading. Run the race:
        </p>
        <Race />
      </section>

      <section className="how">
        <h2>How it works</h2>
        <div className="steps">
          <div>
            <span className="n">1</span>
            <h3>Predict</h3>
            <p>
              Per <code>pointermove</code>, a smoothed velocity plus each link's
              geometry give two scores — proximity and trajectory. The higher is the
              confidence it's your next click.
            </p>
          </div>
          <div>
            <span className="n">2</span>
            <h3>Tier by confidence</h3>
            <p>
              Crossing the intent bar prefetches. Sustained high confidence upgrades
              to a <em>prerender</em> — the next page built in a hidden tab, so the
              click is instant.
            </p>
          </div>
          <div>
            <span className="n">3</span>
            <h3>Load, best backend first</h3>
            <p>
              The native Speculation Rules API where available, falling back to{" "}
              <code>&lt;link rel=prefetch&gt;</code> then a low-priority{" "}
              <code>fetch</code>. Offscreen links cost nothing.
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
        <p className="muted">
          Full options in the <a href="/docs">docs</a>.
        </p>
      </section>

      <Stats />

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
          Trajectory prediction is well-trodden — ForesightJS does it well, and there's
          cursor-extrapolation patent prior art going back years. intently's bet is
          prediction + the right modern loader + nothing to configure, in one drop-in.
        </p>
      </section>

      <section className="dogfood">
        <h2>This whole site runs on it</h2>
        <p className="muted">
          Every page here is a real document, and intently is live. Head to the{" "}
          <a href="/lab">lab</a> or the <a href="/docs">docs</a> — aim, don't rush —
          and watch the badge in the corner: pages you were heading toward arrive
          prerendered, instantly.
        </p>
        <div className="cta">
          <a className="btn primary" href="/lab">Open the lab →</a>
          <a className="btn" href="/docs">Read the docs</a>
        </div>
      </section>
    </>
  );
}
