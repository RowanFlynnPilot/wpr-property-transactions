import { useEffect, useRef, useState } from "react";

// Animate a number from its previous value to `target` on change — the little
// "premium dashboard" tick-up. Respects prefers-reduced-motion.
export function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(target ?? 0);
  const fromRef = useRef(target ?? 0);

  useEffect(() => {
    if (target == null) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    let raf;
    let start;
    const ease = (p) => 1 - Math.pow(1 - p, 3); // easeOutCubic
    const tick = (t) => {
      start ??= t;
      const p = Math.min(1, (t - start) / duration);
      setValue(from + (target - from) * ease(p));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
