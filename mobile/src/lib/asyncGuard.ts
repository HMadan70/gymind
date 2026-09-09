// src/lib/asyncGuard.ts
//
// Duplicate-submission guards for one-shot actions (save, submit, delete,
// upload) - NOT debouncing. The distinction that matters here: a `disabled`
// prop only takes effect on the *next render*, so two touch events
// dispatched in the same JS tick (a fast enough double-tap, or two fingers)
// can both call the handler before React ever commits that render. Both
// hooks below block the second call with a `useRef` instead, which mutates
// synchronously the instant the first call starts - there is no window
// where a second call can slip through before the guard is "on". `pending`
// (state) is only for driving the visual disabled/label - the ref is what
// actually stops the network call.
import { useCallback, useRef, useState } from "react";

/** Guards a single action - login, submit, save-this-one-thing. */
export function useAsyncGuard() {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);

  const run = useCallback(async (fn: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      await fn();
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, []);

  return { pending, run };
}

/**
 * Guards a set of independent actions keyed by id - deleting/favouriting
 * one row in a list must not be blocked by another row's in-flight request,
 * so this tracks in-flight keys individually rather than one shared flag.
 */
export function useAsyncGuardMap<K>() {
  const inFlight = useRef<Set<K>>(new Set());
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<K>>(new Set());

  const run = useCallback(async (key: K, fn: () => Promise<void>) => {
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setPendingKeys(new Set(inFlight.current));
    try {
      await fn();
    } finally {
      inFlight.current.delete(key);
      setPendingKeys(new Set(inFlight.current));
    }
  }, []);

  const isPending = useCallback((key: K) => pendingKeys.has(key), [pendingKeys]);

  return { run, isPending };
}
