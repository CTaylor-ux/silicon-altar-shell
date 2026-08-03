'use client';

/**
 * LocatePanel — "something happened around 1120, where does that land?"
 *
 * Deterministic lookup. No model, no key, nothing that can be wrong about a
 * fact it invented, because it invents nothing.
 *
 * It opens from the top rail rather than from the query bar. The two are
 * different jobs (a lookup vs a conversation), and keeping them apart means
 * the query bar does not have to be rebuilt when the conversational layer
 * lands.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseYearInput, type LocateResult, type LocateHit } from '@/lib/locate';
import { laneVar } from '@/lib/windows';
import styles from './LocatePanel.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Jump the window view to this entry. Closes the panel. */
  onGoToEntry: (hit: LocateHit) => void;
};

const EXAMPLES = ['1120', '1492', '1652', '1718', '1863', '1933'];

export default function LocatePanel({ open, onClose, onGoToEntry }: Props) {
  const [raw, setRaw] = useState('');
  const [result, setResult] = useState<LocateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  const run = useCallback(async (yearText: string) => {
    const year = parseYearInput(yearText);
    if (year === null) {
      setError('Enter a year, for example 1120.');
      setResult(null);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/locate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ year }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setResult((await res.json()) as LocateResult);
    } catch {
      setError('Lookup failed. This runs locally, so a retry usually clears it.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.scrim} onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Locate a year in the sequence"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <span className={`${styles.kicker} mono`}>Locate a year in the sequence</span>

          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              run(raw);
            }}
          >
            <input
              ref={inputRef}
              className={styles.input}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="1120"
              aria-label="Year"
              autoComplete="off"
              spellCheck={false}
            />
            <button className={`${styles.go} mono`} type="submit" disabled={!raw.trim()}>
              Locate
            </button>
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </form>

          <p className={styles.hint}>
            {error ??
              'Shows what the corpus carries around that year, across every lane, in the windows it falls in.'}
          </p>

          <div className={styles.examples}>
            {EXAMPLES.map((y) => (
              <button
                key={y}
                className={styles.example}
                onClick={() => {
                  setRaw(y);
                  run(y);
                }}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.body}>
          {loading && <p className={`${styles.loading} mono`}>Looking up…</p>}

          {!loading && result && result.total === 0 && (
            <p className={styles.empty}>Nothing in the corpus sits near that year.</p>
          )}

          {!loading && result && result.total > 0 && (
            <>
              <div className={styles.summary}>
                <span className={styles.count}>
                  {result.total} {result.total === 1 ? 'entry' : 'entries'}
                </span>
                {result.span && (
                  <span className={styles.spanNote}>
                    {result.span.earliest} to {result.span.latest}
                  </span>
                )}
                <span className={styles.laneSpread}>
                  {result.laneSpread.slice(0, 8).map((l) => (
                    <span key={l.lane} className={styles.laneChip}>
                      <span
                        className={styles.laneDot}
                        style={{ background: laneVar(l.lane) }}
                        aria-hidden
                      />
                      {l.label} {l.count}
                    </span>
                  ))}
                </span>
              </div>

              {result.windows.map((w) => (
                <section key={w.windowId} className={styles.windowGroup}>
                  <div className={styles.windowHead}>
                    <span className={styles.windowName}>{w.name}</span>
                    <span className={`${styles.windowMeta} mono`}>
                      Window {w.windowId} · {w.yearRange} · {w.hits.length}
                    </span>
                  </div>

                  {w.hits.map((h) => (
                    <button
                      key={h.id}
                      className={`${styles.hit} ${h.inSpan ? '' : styles.outOfSpan}`}
                      onClick={() => onGoToEntry(h)}
                      title={h.inSpan ? 'Jump to this row' : 'Nearby. Jump to this row'}
                    >
                      <span className={styles.hitYear}>{h.year.display}</span>
                      <span className={styles.hitOffset}>
                        {h.offsetYears === 0
                          ? '·'
                          : h.offsetYears > 0
                            ? `+${h.offsetYears}`
                            : h.offsetYears}
                      </span>
                      <span
                        className={styles.hitLane}
                        style={{ color: laneVar(h.lane) }}
                      >
                        <span
                          className={styles.laneDot}
                          style={{ background: laneVar(h.lane) }}
                          aria-hidden
                        />
                        {h.lane}
                      </span>
                      <span className={`${styles.hitTier} ${styles[`tier${h.tier}`]}`}>
                        {h.tier}
                      </span>
                      <span className={styles.hitTitle}>
                        {h.milestone && (
                          <span className={styles.milestoneMark} aria-hidden>
                            ◆
                          </span>
                        )}
                        {h.title}
                        {h.hasDossier && (
                          <span className={styles.dossierMark}>DOSSIER</span>
                        )}
                      </span>
                    </button>
                  ))}
                </section>
              ))}
            </>
          )}
        </div>

        <div className={`${styles.foot} mono`}>
          <span>Deterministic lookup · no model, nothing generated</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
