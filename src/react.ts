import { useEffect, useRef } from "react";
import { intently } from "./core";
import type { IntentlyHandle, IntentlyOptions } from "./types";

/**
 * Run intently for the lifetime of a component. Drop `useIntently()` once near
 * the root of your app and every eligible link gets intent-aware prefetching.
 *
 * ```tsx
 * import { useIntently } from "intently/react";
 *
 * function App() {
 *   useIntently();
 *   return <Routes />;
 * }
 * ```
 *
 * The options are read once on mount. Returns a ref to the live handle if you
 * need to call `.prefetch(url)` / `.prerender(url)` imperatively.
 */
export function useIntently(options: IntentlyOptions = {}): { current: IntentlyHandle | null } {
  const handle = useRef<IntentlyHandle | null>(null);

  useEffect(() => {
    // Options are captured once on mount — intently is a global, page-lifetime
    // listener, so changing options means tearing down and remounting (give the
    // component a `key`). This is deliberate, not a stale-closure oversight.
    const h = intently(options);
    handle.current = h;
    return () => {
      h.destroy();
      handle.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return handle;
}

export { intently } from "./core";
export type { IntentlyOptions, IntentlyHandle, PredictInfo, Signal, Strategy } from "./types";
