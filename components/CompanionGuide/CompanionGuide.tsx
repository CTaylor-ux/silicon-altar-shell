'use client';

/**
 * CompanionGuide — orientation modal over a dimmed window.
 *
 * Content-agnostic: everything rendered comes from a WindowGuide object in
 * lib/window-content.ts. This component knows nothing about any particular
 * window, so guide copy can be replaced wholesale without touching wiring.
 *
 * Shown once per window per session, then re-openable from the top rail. The
 * "seen" state lives in session state, so travelling back to a window you have
 * already entered does not re-interrupt you.
 */

import { useEffect, useRef } from 'react';
import type { WindowGuide } from '@/lib/window-content';
import styles from './CompanionGuide.module.css';

type Props = {
  guide: WindowGuide;
  windowLabel: string;
  yearRange: string;
  open: boolean;
  onDismiss: () => void;
};

export default function CompanionGuide({
  guide,
  windowLabel,
  yearRange,
  open,
  onDismiss,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef<HTMLButtonElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    dismissRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      // Esc closes the guide and must NOT fall through to the shell's
      // Esc-returns-to-selector binding.
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onDismiss();
        return;
      }
      // Arrow keys travel between windows; while the guide is up they must not.
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || !focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    // Capture phase so this wins over the page-level key handler.
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      restoreTo.current?.focus?.();
    };
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div className={styles.scrim} onClick={onDismiss}>
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sa-guide-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <span className={`${styles.kicker} mono`}>
            Companion guide · {windowLabel}
          </span>
          {guide.placeholder && (
            <span className={`${styles.placeholder} mono`} title="Copy not yet finalised">
              Placeholder copy
            </span>
          )}
        </div>

        <h2 id="sa-guide-title" className={styles.title}>
          {guide.title}
        </h2>
        <p className={`${styles.range} mono`}>{yearRange}</p>

        <div className={styles.rule} />

        <section className={styles.section}>
          <h3 className={`${styles.label} mono`}>Why this matters</h3>
          <p className={styles.body}>{guide.whyThisMatters}</p>
        </section>

        <section className={styles.section}>
          <h3 className={`${styles.label} mono`}>Watch for this</h3>
          <p className={styles.watch}>{guide.watchForThis}</p>
        </section>

        <div className={styles.foot}>
          <button ref={dismissRef} className={`${styles.dismiss} mono`} onClick={onDismiss}>
            {guide.dismissLabel}
            <span className={styles.arrow} aria-hidden>
              →
            </span>
          </button>
          <span className={`${styles.hint} mono`}>Esc · reopen from Guide in the top rail</span>
        </div>
      </div>
    </div>
  );
}
