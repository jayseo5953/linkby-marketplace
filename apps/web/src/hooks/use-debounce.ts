import { useEffect, useRef } from 'react';

// Runs the action once calls have stopped for `delayMs`.
export function useDebounce<A extends unknown[]>(action: (...args: A) => void, delayMs: number) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (...args: A) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => action(...args), delayMs);
  };
}
