import { useEffect, useRef } from "react";

/** Returns a ref whose element receives focus on mount and whenever `dep` changes. */
export function useFocusOnChange<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [dep]);
  return ref;
}
