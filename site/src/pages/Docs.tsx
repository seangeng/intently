import { Code } from "../shared";

const TOC = [
  ["install", "Install"],
  ["quick-start", "Quick start"],
  ["how-it-works", "How it works"],
  ["options", "Options"],
  ["the-loader", "The loader"],
  ["the-handle", "The handle"],
  ["safety", "Safety & taste"],
  ["react", "React"],
  ["when", "When it helps"],
];

export function Docs() {
  return (
    <div className="docs-layout">
      <aside className="toc">
        <div className="toc-title">Docs</div>
        <nav>
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`}>{label}</a>
          ))}
        </nav>
      </aside>

      <article className="prose">
        <h1>Documentation</h1>
        <p>
          intently predicts which link you're heading toward — from cursor proximity
          and trajectory — and prefetches it, or prerenders it via the Speculation
          Rules API, a beat before you click. It's zero-config, ~4KB, and
          framework-agnostic. This page is the whole API.
        </p>

        <h2 id="install">Install</h2>
        <Code lang="bash">{`npm i intently`}</Code>
        <p>No dependencies. There's an optional React entry at <code>intently/react</code>.</p>

        <h2 id="quick-start">Quick start</h2>
        <p>One call binds every eligible same-origin link on the page:</p>
        <Code>{`import { intently } from "intently";

intently();`}</Code>
        <p>
          That's it. Move toward a link and intently prefetches its destination
          during the intent window, so the navigation feels instant.
        </p>

        <h2 id="how-it-works">How it works</h2>
        <p>Three small parts:</p>
        <p>
          <b>Predict.</b> On each <code>pointermove</code> intently keeps a smoothed
          velocity. For every on-screen link it computes <em>proximity</em> (distance
          to the link's nearest edge, on a squared falloff) and <em>trajectory</em>
          (the dot product of your heading with the direction to the link, gated by a
          forward cone). The higher of the two is the confidence it's your next click.
        </p>
        <p>
          <b>Tier by confidence.</b> Crossing <code>intentThreshold</code> (default{" "}
          <code>0.5</code>) prefetches. Sustained confidence past{" "}
          <code>prerenderThreshold</code> (default <code>0.85</code>) upgrades to a
          prerender. Only in-viewport links are scored; the loop sleeps when the
          cursor is still; every URL loads once.
        </p>
        <p>
          <b>Load.</b> The best available backend, degrading silently — see{" "}
          <a href="#the-loader">the loader</a>.
        </p>

        <h2 id="options">Options</h2>
        <p>Everything is optional; the defaults are sensible.</p>
        <Code>{`intently({
  origins: [location.hostname],          // hostnames allowed; or (url, el) => boolean
  ignores: [/\\/logout/, "?add-to-cart"], // never touch these (strings or RegExps)
  signals: ["trajectory", "proximity", "hover", "touch"],
  intentThreshold: 0.5,                   // confidence (0–1) to prefetch
  prerenderThreshold: 0.85,              // confidence to prerender; false to disable
  proximityRadius: 80,                    // px — how far a link "notices" the cursor
  hoverDelay: 65,                         // ms dwell before hover counts
  eagerOnPress: true,                     // prefetch on pointerdown / touchstart
  viewportPrefetch: false,                // also idle-prefetch in-view links
  limit: Infinity,                        // cap total loads
  respectSaveData: true,                  // skip on Save-Data / 2g
  root: document,                         // where to look for links
  onPredict: ({ el, url, confidence, signal }) => {}, // wire a visual affordance
  onLoad: (url, strategy) => {},          // "prefetch" | "prerender"
});`}</Code>

        <h2 id="the-loader">The loader</h2>
        <p>intently picks the strongest backend the browser offers and degrades:</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tier</th><th>Used when</th><th>Does</th></tr></thead>
            <tbody>
              <tr><td>Speculation Rules</td><td>Chromium</td><td>real prefetch <b>and</b> prerender, browser-prioritized</td></tr>
              <tr><td>&lt;link rel=prefetch&gt;</td><td>most browsers</td><td>prefetch only</td></tr>
              <tr><td>fetch() low-priority</td><td>last resort</td><td>warms the HTTP cache</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          A prerender is a live page, so intently caps active prerenders to a small
          budget and never tears one down to make room for a prefetch.
        </p>

        <h2 id="the-handle">The handle</h2>
        <p><code>intently()</code> returns a handle:</p>
        <Code>{`const i = intently();
i.prefetch("/pricing");   // force it
i.prerender("/checkout"); // force it (falls back to prefetch where unsupported)
i.loaded;                 // ReadonlySet<string> of URLs loaded this session
i.destroy();              // remove every listener and observer`}</Code>
        <p>The prediction math is also exported, if you want to build your own affordance:</p>
        <Code>{`import { distanceToRect, falloff, proximityScore, trajectoryScore } from "intently";`}</Code>

        <h2 id="safety">Safety &amp; taste</h2>
        <ul>
          <li>It only guesses <b>same-origin</b> links by default, and never touches anything in <code>ignores</code>.</li>
          <li>Prefetch is bytes; <b>prerender runs the page</b>. intently only prerenders side-effect-free links (no query string, not <code>nofollow</code>/<code>external</code>, not a new tab) — still, put sign-out, add-to-cart, and language switches in <code>ignores</code>.</li>
          <li>It respects the user: Save-Data and 2g turn it off; a still cursor predicts nothing.</li>
          <li>The real click always works whether or not the guess landed — prefetch is a hint, not a navigation.</li>
        </ul>

        <h2 id="react">React</h2>
        <Code>{`import { useIntently } from "intently/react";

function App() {
  useIntently();            // once, near the root
  return <Routes />;
}`}</Code>
        <p>
          Options are read once on mount. To change them, give the host component a{" "}
          <code>key</code> so it remounts.
        </p>

        <h2 id="when">When it helps</h2>
        <p>
          Biggest wins are multi-page apps and hard navigations — content sites, docs,
          commerce, blogs — where a click is a real document fetch. (This site is one:
          every page is a real document and intently is live.) For SPAs with a client
          router, the framework already prefetches route data; intently still helps for
          outbound and non-router links, and its prediction layer is reusable.
        </p>
      </article>
    </div>
  );
}
