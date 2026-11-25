import { useEffect, useRef } from 'react';

/** Calls onDone once after ms. The callback is held in a ref so parent re-renders never restart the timer. */
export function useAutoDone(ms: number, onDone: () => void) {
  const ref = useRef(onDone);
  ref.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => ref.current(), ms);
    return () => clearTimeout(t);
  }, [ms]);
}
