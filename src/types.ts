/** Which loading strategy was used for a URL. */
export type Strategy = "prefetch" | "prerender";

/** The prediction signals intently can act on. */
export type Signal = "trajectory" | "proximity" | "hover" | "touch" | "viewport";

/** Emitted whenever a link's confidence updates (use it to drive UI affordances). */
export interface PredictInfo {
  /** The anchor element. */
  el: HTMLAnchorElement;
  /** Its resolved, absolute URL. */
  url: string;
  /** 0–1 confidence that this is the user's next navigation. */
  confidence: number;
  /** The signal that produced this confidence. */
  signal: Signal;
}

export interface IntentlyOptions {
  /**
   * Which hostnames are eligible to prefetch. Default: the current hostname
   * only. Pass an array of hostnames, or a predicate for full control.
   */
  origins?: string[] | ((url: URL, el: HTMLAnchorElement) => boolean);
  /**
   * URLs to never touch. Strings are substring matches; RegExps test the full
   * href; a function gets the URL + element. Sign-out, add-to-cart, language
   * switches, and anything with side effects belong here.
   */
  ignores?: Array<RegExp | string> | ((url: URL, el: HTMLAnchorElement) => boolean);
  /** Signals to use. Default: all of trajectory, proximity, hover, touch. */
  signals?: Signal[];
  /** Confidence (0–1) at which to prefetch. Default 0.5. */
  intentThreshold?: number;
  /**
   * Confidence (0–1) at which to upgrade to a prerender, or `false` to never
   * prerender. Prerender is expensive — keep this high. Default 0.85.
   */
  prerenderThreshold?: number | false;
  /** Proximity falloff radius in px (how far a link "notices" the cursor). Default 80. */
  proximityRadius?: number;
  /** Dwell time in ms over a link before hover counts as intent. Default 65. */
  hoverDelay?: number;
  /** Prefetch immediately on pointerdown / touchstart. Default true. */
  eagerOnPress?: boolean;
  /**
   * Also prefetch in-viewport links when the browser is idle (quicklink-style),
   * at low priority. Off by default — the intent model is the point.
   */
  viewportPrefetch?: boolean;
  /** Max number of URLs to load in a session. Default Infinity. */
  limit?: number;
  /** Where to look for links. Default `document`. */
  root?: ParentNode;
  /** Respect Save-Data / 2g / reduced-data. Default true. */
  respectSaveData?: boolean;
  /** Called on every confidence update — wire it to a visual "warming" affordance. */
  onPredict?: (info: PredictInfo) => void;
  /** Called once per URL when it's actually loaded. */
  onLoad?: (url: string, strategy: Strategy) => void;
}

export interface IntentlyHandle {
  /** Force a prefetch now. */
  prefetch(url: string): void;
  /** Force a prerender now (falls back to prefetch where unsupported). */
  prerender(url: string): void;
  /** Stop listening and release all observers/listeners. */
  destroy(): void;
  /** URLs loaded so far this session. */
  readonly loaded: ReadonlySet<string>;
}
