# intently

**Intent-aware prefetching.** Most prefetchers load every link in the viewport, or wait for a hover. intently watches where the cursor is actually *heading* — proximity and trajectory, the same prediction that powers a focus ring that warms as you approach — and prefetches (or **prerenders**, via the native Speculation Rules API) the link a beat before you click. Zero-config, ~4KB, framework-agnostic.

[**intentlyjs.com**](https://intentlyjs.com) · [npm](https://www.npmjs.com/package/intently) · [GitHub](https://github.com/seangeng/intently) · [the writeup](https://seangeng.com/writing/prefetching-on-intent)

```bash
npm i intently
```

## Quick start

One call binds every eligible same-origin link on the page:

```js
import { intently } from "intently";

intently();
```

That's it. Move toward a link and intently prefetches its destination during the
~200ms between intent and click, so the navigation feels instant. React:

```tsx
import { useIntently } from "intently/react";

function App() {
  useIntently();        // once, near the root
  return <Routes />;
}
```

## Why another prefetcher

There are good ones, and intently borrows the best of each:

- [**quicklink**](https://github.com/GoogleChromeLabs/quicklink) prefetches links
  *in the viewport* when the browser is idle. Great coverage, but it can't tell
  the one link you want from the fifty you don't.
- [**instant.page**](https://instant.page) prefetches on *hover* (a 65ms dwell).
  Precise, but hover is late — the decision is already made by the time you've
  parked the cursor.
- [**ForesightJS**](https://github.com/spaansba/ForesightJS) predicts intent from
  mouse *trajectory* — the right signal — but you register elements yourself and
  wire up the prefetch.

intently combines them: **zero-config auto-binding** (drop it in, every `<a>` is
covered) + **trajectory + proximity prediction** (the link you're aimed at, not
the one you happen to be near) + a **tiered loader that uses the Speculation
Rules API** for real prefetch *and* prerender, degrading to `<link rel=prefetch>`
and then `fetch` where that isn't supported.

The trajectory idea is old — there are
[patents on cursor extrapolation](https://patents.google.com/patent/US8566696)
going back years, and ForesightJS does it well today. intently's bet is that
*prediction + the right modern loader + nothing to configure* is the combination
worth shipping.

## How it works

Three things, kept small:

**1. Predict.** On every `pointermove`, intently keeps a smoothed velocity. For
each on-screen link it computes two scores — *proximity* (distance to the link's
nearest edge, on a squared falloff) and *trajectory* (the dot product of your
heading with the direction to the link, gated by a forward cone). The higher of
the two is the confidence that this link is your next click. (This is the same
math as the [input-anticipation](https://seangeng.com/writing/interfaces-that-anticipate-input)
focus ring — here it drives a fetch instead of a glow.)

**2. Tier by confidence.** Crossing `intentThreshold` (default `0.5`) prefetches.
Sustained high confidence past `prerenderThreshold` (default `0.85`) upgrades to
a *prerender* — the next page is fully built in a hidden tab, so the click is
instant, not just fast. Prerender is expensive, so it stays rare and high-bar.

**3. Load with the best available backend.**

| Tier | Used when | Does |
|------|-----------|------|
| Speculation Rules API | Chromium | real `prefetch` **and** `prerender`, cross-document, browser-prioritized |
| `<link rel="prefetch">` | most browsers | prefetch only |
| `fetch()` low priority | last resort | warms the HTTP cache |

Only in-viewport links are scored (via `IntersectionObserver`), the scoring loop
sleeps when the pointer is still, and every URL loads once. Offscreen links cost
nothing.

## Options

```js
intently({
  origins: [location.hostname],   // hostnames allowed; or a (url, el) => boolean
  ignores: [/\/logout/, "?add-to-cart"], // never touch these (strings or RegExps)
  signals: ["trajectory", "proximity", "hover", "touch"], // which to use
  intentThreshold: 0.5,           // confidence (0–1) to prefetch
  prerenderThreshold: 0.85,       // confidence to prerender; false to disable
  proximityRadius: 80,            // px — how far a link "notices" the cursor
  hoverDelay: 65,                 // ms dwell before hover counts (instant.page's number)
  eagerOnPress: true,             // prefetch immediately on pointerdown / touchstart
  viewportPrefetch: false,        // also idle-prefetch in-view links (quicklink-style)
  limit: Infinity,                // cap total loads
  respectSaveData: true,          // skip on Save-Data / 2g
  onPredict: ({ el, url, confidence, signal }) => {}, // wire a visual affordance
  onLoad: (url, strategy) => {},  // "prefetch" | "prerender"
});
```

`intently()` returns a handle:

```js
const i = intently();
i.prefetch("/pricing");   // force it
i.prerender("/checkout"); // force it (falls back to prefetch where unsupported)
i.loaded;                 // ReadonlySet<string> of URLs loaded this session
i.destroy();              // remove every listener/observer
```

### Exposed prediction helpers

The prediction math is exported if you want to build your own affordance (a ring
that warms as confidence rises, say):

```js
import { distanceToRect, falloff, proximityScore, trajectoryScore } from "intently";
```

## Safety & taste

- **It only guesses same-origin links** by default, and never touches anything in
  `ignores`. Put sign-out, "add to cart", language switches, and any link with
  side effects there — especially before enabling prerender, which *runs* the
  page.
- **It respects the user.** Save-Data and 2g connections turn it off. A still
  cursor predicts nothing.
- **It degrades.** No Speculation Rules → `<link rel=prefetch>` → `fetch`. SSR /
  no-DOM → a no-op handle.
- **Prefetch is a hint, not a navigation.** The real click always works whether
  or not the guess landed.

## When it helps (and when it doesn't)

Biggest wins are **multi-page apps** and **hard navigations** — content sites,
docs, e-commerce, blogs — where the next page is a real document fetch. For SPAs
with a client router (React Router, Next.js), those frameworks already prefetch
route data; intently still helps for outbound and non-router links, and its
prediction layer is reusable.

## Credits

Trajectory prediction by way of [ForesightJS](https://github.com/spaansba/ForesightJS)
and a long line of [cursor-extrapolation prior art](https://patents.google.com/patent/US8566696);
zero-config ergonomics from [instant.page](https://instant.page); viewport idle
prefetch from [quicklink](https://github.com/GoogleChromeLabs/quicklink); the
prediction math from my own [input-anticipation](https://seangeng.com/writing/interfaces-that-anticipate-input)
work. Built on the [Speculation Rules API](https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API).

By [Sean Geng](https://seangeng.com). MIT.
