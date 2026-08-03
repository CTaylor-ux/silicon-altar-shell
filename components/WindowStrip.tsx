'use client';

/**
 * WindowStrip — the seven Windows as one horizontal run.
 *
 * Mounts current ± 1 (max three frames live). Route-per-window would remount
 * on every prev/next, re-parsing 230–385 KB and dropping scroll — the opposite
 * of "one continuous timeline". Keeping the neighbours mounted makes prev/next
 * instant, and translateX gives the movement a direction the user can feel.
 *
 * Windows outside the ±1 band unmount, but their scroll position survives in
 * session state and is restored on remount.
 */

import WindowFrame from './WindowFrame';
import { WINDOW_COUNT } from '@/lib/windows';
import styles from './WindowStrip.module.css';

type Props = {
  current: number;
  targetEntryId?: string | null;
  targetNonce?: number;
  scroll: Record<number, { x: number; y: number }>;
  onScroll: (windowId: number, pos: { x: number; y: number }) => void;
  onNav: (key: 'ArrowLeft' | 'ArrowRight') => void;
  onTargetMiss?: (entryId: string) => void;
};

export default function WindowStrip({
  current,
  targetEntryId,
  targetNonce,
  scroll,
  onScroll,
  onNav,
  onTargetMiss,
}: Props) {
  const mounted = [current - 1, current, current + 1].filter(
    (i) => i >= 0 && i < WINDOW_COUNT
  );

  return (
    <div className={styles.strip}>
      {mounted.map((id) => (
        <WindowFrame
          key={id}
          windowId={id}
          offset={id - current}
          active={id === current}
          targetEntryId={id === current ? targetEntryId : null}
          targetNonce={targetNonce}
          initialScroll={scroll[id]}
          onScroll={onScroll}
          onNav={onNav}
          onTargetMiss={onTargetMiss}
        />
      ))}
    </div>
  );
}
