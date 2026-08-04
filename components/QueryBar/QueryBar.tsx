'use client';

/**
 * QueryBar — docked, persistent, fixed height.
 *
 * Fixed height is the point: the exchange area is reserved, so submitting
 * never reflows the timeline above it. The Windows are wide and dense; a panel
 * that grew and shrank under them would shift the reader's frame of reference
 * at exactly the moment they are trying to follow a pointer into the evidence.
 *
 * The answer NEVER stands alone. Every answered state renders a target
 * breadcrumb, and the answer text is deliberately shorter than the entry it
 * points at — the panel is an index, not a substitute for the row.
 */

import { useEffect, useRef, useState } from 'react';
import type { Exchange } from '@/lib/session';
import type { Target, QueryResult } from '@/lib/retrieval';
import type { LocateHit } from '@/lib/locate';
import { SUGGESTED_QUERIES } from '@/lib/stub-index';
import { laneLabel, laneVar, getWindow } from '@/lib/windows';
import styles from './QueryBar.module.css';

type Props = {
  latest: Exchange | null;
  targetIndex: number;
  onSubmit: (q: string) => void;
  onStep: (index: number) => void;
  onGoToTarget: (t: Target) => void;
  onGoToEntry: (h: LocateHit) => void;
  onRetry: () => void;
};

export default function QueryBar({
  latest,
  targetIndex,
  onSubmit,
  onStep,
  onGoToTarget,
  onGoToEntry,
  onRetry,
}: Props) {
  const [value, setValue] = useState('');
  /* The bar is 222px, which was right when answers were two stub sentences.
     A real answer is prose plus an outside region plus a situating band, and
     reading that through a 130px slot would make the design look worse than it
     is. Expanding is opt-in so the default still refuses to become a reader. */
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" focuses the query bar from anywhere in the shell.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) return;
      if (e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    onSubmit(q);
    setValue('');
  };

  const targets = latest?.result?.targets ?? [];
  const active = targets[targetIndex];

  const hasBody =
    latest?.status === 'answered' &&
    !!latest.result &&
    ((latest.result.outside?.length ?? 0) > 0 ||
      (latest.result.nearby?.length ?? 0) > 0 ||
      latest.result.answer.length > 260);

  return (
    <section
      className={`${styles.bar} ${expanded ? styles.barExpanded : ''}`}
      aria-label="Query the corpus"
    >
      {hasBody && (
        <button
          className={`${styles.expand} mono`}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Collapse ▾' : 'Expand ▴'}
        </button>
      )}

      <div className={styles.exchange}>
        {!latest && <IdleState onPick={(q) => onSubmit(q)} />}

        {latest?.status === 'thinking' && <ThinkingState question={latest.question} />}

        {latest?.status === 'error' && (
          <ErrorState question={latest.question} message={latest.error} onRetry={onRetry} />
        )}

        {latest?.status === 'empty' && <EmptyState question={latest.question} />}

        {latest?.status === 'answered' && latest.result && (
          <AnsweredState
            question={latest.question}
            result={latest.result}
            onGoToTarget={onGoToTarget}
            onGoToEntry={onGoToEntry}
          />
        )}
      </div>

      {latest?.status === 'answered' && active && (
        <TargetRail
          targets={targets}
          index={targetIndex}
          onStep={onStep}
          onGo={() => onGoToTarget(active)}
        />
      )}

      <form className={styles.inputRow} onSubmit={submit}>
        <span className={`${styles.prompt} mono`} aria-hidden>
          ?
        </span>
        <input
          ref={inputRef}
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask the corpus…  ( / to focus )"
          aria-label="Ask the corpus"
          autoComplete="off"
          spellCheck={false}
        />
        <button className={`${styles.submit} mono`} type="submit" disabled={!value.trim()}>
          Ask ↵
        </button>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ states */

function IdleState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className={styles.idle}>
      <p className={styles.idleLead}>
        Ask a question. The answer points at the row that carries it.
      </p>
      <ul className={styles.suggestions}>
        {SUGGESTED_QUERIES.map((q) => (
          <li key={q}>
            <button className={styles.suggestion} onClick={() => onPick(q)}>
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ThinkingState({ question }: { question: string }) {
  return (
    <div className={styles.block}>
      <QuestionLine text={question} />
      <div className={styles.thinking}>
        <span className={styles.pip} />
        <span className={styles.pip} />
        <span className={styles.pip} />
        <span className={`${styles.thinkingLabel} mono`}>Retrieving</span>
      </div>
    </div>
  );
}

function AnsweredState({
  question,
  result,
  onGoToTarget,
  onGoToEntry,
}: {
  question: string;
  result: QueryResult;
  onGoToTarget: (t: Target) => void;
  onGoToEntry: (h: LocateHit) => void;
}) {
  const byId = new Map(result.targets.map((t) => [t.entryId, t]));

  return (
    <div className={styles.block}>
      <QuestionLine text={question} />

      <Prose text={result.answer} onCite={(id) => {
        const t = byId.get(id);
        if (t) onGoToTarget(t);
      }} />

      {result.scopeNote && (
        <p className={styles.scope}>
          <span className={`${styles.scopeTag} mono`}>Scope</span>
          {result.scopeNote}
        </p>
      )}

      {/* Physically separate region, not a badge inside the prose. A reader
          should be able to see they have crossed out of the corpus without
          reading a single label. */}
      {result.outside && (
        <div className={styles.outside}>
          <span className={`${styles.outsideTag} mono`}>Not in the corpus</span>
          <Prose text={result.outside} plain />
        </div>
      )}

      {!!result.nearby?.length && (
        <div className={styles.nearby}>
          {result.nearby.map((g) => (
            <div key={g.year} className={styles.nearbyGroup}>
              <span className={`${styles.nearbyYear} mono`}>
                Also around {g.year}
              </span>
              <div className={styles.nearbyRows}>
                {g.hits.map((h) => (
                  <button
                    key={h.id}
                    className={styles.nearbyRow}
                    onClick={() => onGoToEntry(h)}
                    title="Jump to this row"
                  >
                    <span className={`${styles.nearbyRowYear} mono`}>{h.year.display}</span>
                    <span
                      className={styles.laneDot}
                      style={{ background: laneVar(h.lane) }}
                      aria-hidden
                    />
                    <span className={styles.nearbyRowTitle}>{h.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!!result.strippedIds?.length && (
        <p className={styles.stripped}>
          <span className={`${styles.strippedTag} mono`}>Guard</span>
          {result.strippedIds.length} citation
          {result.strippedIds.length === 1 ? '' : 's'} pointed at entries that do not exist and
          {result.strippedIds.length === 1 ? ' was' : ' were'} removed: {result.strippedIds.join(', ')}
        </p>
      )}

      {result.usage && (
        <p className={`${styles.usage} mono`}>
          {result.usage.cacheWrite
            ? `cache write ${result.usage.cacheWrite.toLocaleString()}`
            : `cache read ${result.usage.cacheRead.toLocaleString()}`}
          {' · '}
          {result.usage.outputTokens.toLocaleString()} out
          {' · '}~${result.usage.estimatedCostUsd.toFixed(3)}
        </p>
      )}
    </div>
  );
}

/**
 * Renders prose, turning validated [entry-id] citations into clickable
 * superscripts. The ids were already checked server-side, so anything that
 * survives to here resolves.
 */
function Prose({
  text,
  onCite,
  plain = false,
}: {
  text: string;
  onCite?: (id: string) => void;
  plain?: boolean;
}) {
  const paras = text.split(/\n{2,}/).filter((p) => p.trim());

  return (
    <>
      {paras.map((para, pi) => {
        const parts = para.split(/(\[[A-Za-z0-9][A-Za-z0-9._-]{2,}\])/g);
        return (
          <p key={pi} className={plain ? styles.outsideText : styles.answer}>
            {parts.map((part, i) => {
              const m = part.match(/^\[([A-Za-z0-9][A-Za-z0-9._-]{2,})\]$/);
              if (!m) return <span key={i}>{part}</span>;
              const id = m[1];
              return onCite ? (
                <button
                  key={i}
                  className={`${styles.cite} mono`}
                  onClick={() => onCite(id)}
                  title={id}
                >
                  {id}
                </button>
              ) : (
                <span key={i} className={`${styles.cite} mono`}>
                  {id}
                </span>
              );
            })}
          </p>
        );
      })}
    </>
  );
}

function EmptyState({ question }: { question: string }) {
  return (
    <div className={styles.block}>
      <QuestionLine text={question} />
      <p className={styles.empty}>
        No entry in the corpus answers that. Nothing has been inferred to fill the gap,
        try naming a year, an instrument, or a place.
      </p>
    </div>
  );
}

function ErrorState({
  question,
  message,
  onRetry,
}: {
  question: string;
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className={styles.block}>
      <QuestionLine text={question} />
      <p className={styles.error}>
        <span className={styles.errorRule} aria-hidden />
        <span>
          Retrieval failed{message ? `: ${message}` : ''}. The corpus was not consulted;
          this is not a "no result".
        </span>
        <button className={`${styles.retry} mono`} onClick={onRetry}>
          Retry
        </button>
      </p>
    </div>
  );
}

function QuestionLine({ text }: { text: string }) {
  return (
    <p className={styles.question}>
      <span className={`${styles.qTag} mono`}>Q</span>
      {text}
    </p>
  );
}

/* -------------------------------------------------------------- target rail */

function TargetRail({
  targets,
  index,
  onStep,
  onGo,
}: {
  targets: Target[];
  index: number;
  onStep: (i: number) => void;
  onGo: () => void;
}) {
  const t = targets[index];
  const w = getWindow(t.windowId);

  return (
    <div className={styles.rail}>
      <button className={styles.railTarget} onClick={onGo} title="Jump to this row">
        <span className={styles.laneDot} style={{ background: laneVar(t.lane) }} aria-hidden />
        <span className={`${styles.railMeta} mono`}>
          W{t.windowId} · {t.year} · {laneLabel(t.lane)}
        </span>
        <span className={`${styles.tier} ${styles[`tier${t.tier}`]} mono`}>{t.tier}</span>
        <span className={styles.railTitle}>{t.title}</span>
      </button>

      <div className={styles.stepper}>
        <span className={`${styles.count} mono`}>
          {index + 1} / {targets.length}
        </span>
        <button
          className={styles.stepBtn}
          onClick={() => onStep(index - 1)}
          disabled={index === 0}
          aria-label="Previous result"
        >
          ‹
        </button>
        <button
          className={styles.stepBtn}
          onClick={() => onStep(index + 1)}
          disabled={index >= targets.length - 1}
          aria-label="Next result"
        >
          ›
        </button>
      </div>

      <span className={`${styles.railWindow} mono`}>{w?.name}</span>
    </div>
  );
}
