import type { IntentlyOptions } from "./types";

/**
 * Should intently run at all right now? Honors Save-Data and slow/metered
 * connections so we never spend a careful user's bytes guessing.
 */
export function shouldRun(respectSaveData: boolean): boolean {
  if (typeof navigator === "undefined") return false;
  if (!respectSaveData) return true;
  const c = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!c) return true;
  if (c.saveData) return false;
  if (typeof c.effectiveType === "string" && /(^|-)2g$/.test(c.effectiveType)) return false;
  return true;
}

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Build the per-link eligibility test. Returns the resolved URL for links worth
 * considering, or `null` for ones we must leave alone (cross-origin, current
 * page, downloads, anything the caller ignored).
 */
export function makeEligible(opts: IntentlyOptions) {
  const here = typeof location !== "undefined" ? location : null;

  const originOk = (url: URL, el: HTMLAnchorElement) => {
    if (typeof opts.origins === "function") return opts.origins(url, el);
    const allow = opts.origins ?? (here ? [here.hostname] : []);
    return allow.includes(url.hostname);
  };

  const ignored = (url: URL, el: HTMLAnchorElement) => {
    const ig = opts.ignores;
    if (!ig) return false;
    if (typeof ig === "function") return ig(url, el);
    return ig.some((rule) =>
      typeof rule === "string" ? url.href.includes(rule) : rule.test(url.href),
    );
  };

  return (el: HTMLAnchorElement): string | null => {
    const href = el.href;
    if (!href) return null;

    let url: URL;
    try {
      url = new URL(href, here?.href);
    } catch {
      return null;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (el.hasAttribute("download")) return null;
    // Same document (ignoring the hash) — nothing to fetch.
    if (here && url.href.replace(/#.*$/, "") === here.href.replace(/#.*$/, "")) return null;
    if (!originOk(url, el)) return null;
    if (ignored(url, el)) return null;

    return url.href;
  };
}
