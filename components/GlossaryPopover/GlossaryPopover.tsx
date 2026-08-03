'use client';

/**
 * GlossaryPopover — in-place help for definitional tokens.
 *
 * ONE static definition per token, read from lib/glossary.json and identical
 * everywhere the token appears. No per-window or context-specific content: the
 * whole point is that a tier badge means the same thing in Window 0 as it does
 * in Window 6, and that a reader learns it once.
 *
 * The token lives inside the iframe, so the frame reports its bounding rect in
 * FRAME viewport coordinates and the shell adds the frame's own offset. The
 * popover renders in the shell so it can never be clipped by the frame and can
 * use the shell's own type and surface tokens.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import glossaryRaw from '@/lib/glossary.json';
import styles from './GlossaryPopover.module.css';

export type GlossaryEntry = {
  label: string;
  kind: string;
  definition: string;
  note?: string;
  pending?: boolean;
};

const GLOSSARY = glossaryRaw as unknown as Record<string, GlossaryEntry>;

export const lookup = (token: string): GlossaryEntry | null => {
  const e = GLOSSARY[token];
  return e && typeof e === 'object' && 'label' in e ? e : null;
};

export type Anchor = { top: number; left: number; width: number; height: number };

type Props = {
  token: string | null;
  anchor: Anchor | null;
  /** Distance from the viewport top to the frame's top edge. */
  frameOffsetTop: number;
  onClose: () => void;
};

const W = 300;
const GAP = 9;

export default function GlossaryPopover({ token, anchor, frameOffsetTop, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const entry = token ? lookup(token) : null;

  useLayoutEffect(() => {
    if (!anchor || !entry) return setPos(null);

    const h = ref.current?.offsetHeight ?? 140;
    const absTop = anchor.top + frameOffsetTop;

    // Prefer below the token; flip above when it would run off the bottom.
    let top = absTop + anchor.height + GAP;
    if (top + h > window.innerHeight - 8) {
      const above = absTop - h - GAP;
      top = above > 8 ? above : Math.max(8, window.innerHeight - h - 8);
    }

    // Centre on the token, then clamp to the viewport.
    let left = anchor.left + anchor.width / 2 - W / 2;
    left = Math.max(10, Math.min(left, window.innerWidth - W - 10));

    setPos({ top, left });
  }, [anchor, entry, frameOffsetTop]);

  useEffect(() => {
    if (!entry) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onDown);
    };
  }, [entry, onClose]);

  if (!entry) return null;

  return (
    <div
      ref={ref}
      className={styles.pop}
      role="dialog"
      aria-label={`Definition: ${entry.label}`}
      style={{ width: W, top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
    >
      <div className={styles.head}>
        <span className={styles.token}>{entry.label}</span>
        <span className={`${styles.kind} mono`}>{entry.kind}</span>
        <button className={styles.close} onClick={onClose} aria-label="Close definition">
          ×
        </button>
      </div>

      {entry.pending || !entry.definition ? (
        <p className={styles.pending}>
          Definition pending. This lane postdates the legend copy the rest of the
          glossary is drawn from.
        </p>
      ) : (
        <p className={styles.def}>{entry.definition}</p>
      )}

      {entry.note && <p className={styles.note}>{entry.note}</p>}
    </div>
  );
}
