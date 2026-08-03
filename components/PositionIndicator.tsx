'use client';

/**
 * PositionIndicator — the top rail: back-to-selector, prev/next, and a
 * persistent sense of where you are in the run of seven.
 *
 * Neutral ramp only. No lane hue, no --sig: those belong to the timeline and
 * to answer->evidence pointing respectively.
 */

import { WINDOWS, WINDOW_COUNT, getWindow } from '@/lib/windows';
import styles from './PositionIndicator.module.css';

type Props = {
  current: number;
  onGo: (id: number) => void;
  onBackToSelector: () => void;
  onOpenGuide: () => void;
  legendOpen: boolean;
  onToggleLegend: () => void;
};

export default function PositionIndicator({
  current,
  onGo,
  onBackToSelector,
  onOpenGuide,
  legendOpen,
  onToggleLegend,
}: Props) {
  const w = getWindow(current);
  const atStart = current === 0;
  const atEnd = current === WINDOW_COUNT - 1;

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <button className={styles.back} onClick={onBackToSelector} title="All windows (Esc)">
          <span className={styles.backGlyph} aria-hidden>
            ⊞
          </span>
          <span className="mono">All Windows</span>
        </button>

        {/* Persistent re-entry to the companion guide — the modal is an
            orientation aid, not a one-time gate. */}
        <button
          className={styles.guide}
          onClick={onOpenGuide}
          title="Companion guide for this window"
        >
          <span className={styles.guideGlyph} aria-hidden>
            ◈
          </span>
          <span className="mono">Guide</span>
        </button>

        {/* Legend is collapsed by default now that every token in the grid
            explains itself in place. */}
        <button
          className={`${styles.guide} ${legendOpen ? styles.guideOn : ''}`}
          onClick={onToggleLegend}
          aria-pressed={legendOpen}
          title="Show or hide the top-of-window legend"
        >
          <span className={styles.guideGlyph} aria-hidden>
            ☰
          </span>
          <span className="mono">Legend</span>
        </button>
      </div>

      <div className={styles.center}>
        <button
          className={styles.arrow}
          onClick={() => onGo(current - 1)}
          disabled={atStart}
          title="Previous window (←)"
          aria-label="Previous window"
        >
          ‹
        </button>

        <div className={styles.identity}>
          {/* Windows are numbered 0–6 but there are seven of them, and the
              documents label themselves "AUDIT WINDOW 3/7". Match that. */}
          <span className={`${styles.position} mono`}>
            Window {current} of {WINDOW_COUNT}
          </span>
          <span className={styles.name}>{w?.name}</span>
          <span className={`${styles.range} mono`}>{w?.yearRange}</span>
        </div>

        <button
          className={styles.arrow}
          onClick={() => onGo(current + 1)}
          disabled={atEnd}
          title="Next window (→)"
          aria-label="Next window"
        >
          ›
        </button>
      </div>

      {/* Slim persistent run-of-seven. Reads as position, not as navigation
          chrome — though every tick is clickable. */}
      <nav className={styles.ticks} aria-label="Window position">
        {WINDOWS.map((win) => (
          <button
            key={win.id}
            className={`${styles.tick} ${win.id === current ? styles.tickOn : ''}`}
            onClick={() => onGo(win.id)}
            title={`Window ${win.id} · ${win.name}`}
            aria-current={win.id === current ? 'true' : undefined}
            aria-label={`Window ${win.id}, ${win.name}`}
          />
        ))}
      </nav>
    </header>
  );
}
