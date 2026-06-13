import type { Strategy } from "./types";

/**
 * The loading backend, in tiers:
 *   1. Speculation Rules API  — real prefetch *and* prerender, cross-document,
 *      with the browser managing priority. Chromium today.
 *   2. <link rel="prefetch">  — prefetch only, broad support.
 *   3. fetch(low priority)    — last resort; warms the HTTP cache.
 *
 * We pick the best available tier and degrade silently. prerender always
 * degrades to prefetch where prerender isn't available.
 */

const speculationRulesSupported =
  typeof HTMLScriptElement !== "undefined" &&
  typeof HTMLScriptElement.supports === "function" &&
  HTMLScriptElement.supports("speculationrules");

const linkPrefetchSupported = (() => {
  if (typeof document === "undefined") return false;
  try {
    const l = document.createElement("link");
    return l.relList && l.relList.supports && l.relList.supports("prefetch");
  } catch {
    return false;
  }
})();

export interface Loader {
  load(url: string, strategy: Strategy): Strategy | null;
  readonly tier: "speculationrules" | "link" | "fetch" | "none";
  destroy(): void;
}

export function createLoader(limit: number): Loader {
  const loaded = new Map<string, Strategy>();
  const nodes: HTMLElement[] = [];
  let count = 0;

  const tier: Loader["tier"] = speculationRulesSupported
    ? "speculationrules"
    : linkPrefetchSupported
      ? "link"
      : typeof fetch === "function"
        ? "fetch"
        : "none";

  function addSpeculationRule(url: string, strategy: Strategy) {
    // One script per rule — appending new speculationrules scripts is the
    // spec-supported way to add rules dynamically. eagerness is "immediate"
    // because *our predictor* already decided the timing.
    const script = document.createElement("script");
    script.type = "speculationrules";
    script.textContent = JSON.stringify({
      [strategy]: [{ source: "list", urls: [url], eagerness: "immediate" }],
    });
    document.head.appendChild(script);
    nodes.push(script);
  }

  function addPrefetchLink(url: string) {
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = url;
    link.as = "document";
    document.head.appendChild(link);
    nodes.push(link);
  }

  return {
    tier,
    load(url, strategy) {
      if (tier === "none") return null;
      const prior = loaded.get(url);
      // Already done at an equal-or-stronger tier? Skip. (prerender ⊇ prefetch.)
      if (prior === "prerender" || (prior === "prefetch" && strategy === "prefetch")) {
        return null;
      }
      if (prior === undefined && count >= limit) return null;
      if (prior === undefined) count++;

      const effective: Strategy =
        strategy === "prerender" && tier !== "speculationrules" ? "prefetch" : strategy;

      if (tier === "speculationrules") {
        addSpeculationRule(url, effective);
      } else if (tier === "link") {
        if (prior === undefined) addPrefetchLink(url); // link tier can't prerender
      } else {
        if (prior === undefined) {
          // credentials:'omit' keeps it cacheable + avoids leaking auth on warm-up
          fetch(url, { credentials: "omit", mode: "no-cors" }).catch(() => {});
        }
      }

      loaded.set(url, effective);
      return effective;
    },
    destroy() {
      for (const n of nodes) n.remove();
      nodes.length = 0;
      loaded.clear();
      count = 0;
    },
  };
}
