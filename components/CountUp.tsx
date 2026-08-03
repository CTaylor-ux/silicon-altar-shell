'use client';

/**
 * CountUp — subtle ease-out tick from 0 to the real figure on load.
 *
 * Timer-driven rather than rAF: the same reason the in-window scroll ease is.
 * rAF has already been observed not to fire in one embedding context here, and
 * a stat that silently stays at 0 is worse than one that never animated.
 *
 * Honours prefers-reduced-motion by rendering the final value immediately.
 */

import { useEffect, useRef, useState } from 'react';

type Props = { value: number; duration?: number; delay?: number };

export default function CountUp({ value, duration = 950, delay = 0 }: Props) {
  const [n, setN] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      done.current = true;
      setN(value);
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    const start = Date.now() + delay;
    // easeOutCubic — fast out of the gate, settles rather than stops.
    const ease = (p: number) => 1 - Math.pow(1 - p, 3);

    const tick = () => {
      const elapsed = Date.now() - start;
      if (elapsed < 0) {
        timer = setTimeout(tick, 16);
        return;
      }
      const p = Math.min(1, elapsed / duration);
      setN(Math.round(ease(p) * value));
      if (p < 1) timer = setTimeout(tick, 16);
      else done.current = true;
    };
    tick();

    return () => clearTimeout(timer);
  }, [value, duration, delay]);

  // tabular-nums in the figure style keeps the width from jittering mid-count.
  return <>{n}</>;
}
