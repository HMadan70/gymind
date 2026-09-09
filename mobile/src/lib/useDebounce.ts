// src/lib/useDebounce.ts
//
// Shared debouncing for as-you-type inputs that call the API (food/exercise
// search). Delays reacting to `value` until it stops changing for `delayMs`,
// so typing "chick" fires one request instead of five.
import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
