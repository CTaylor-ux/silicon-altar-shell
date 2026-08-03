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
import type { Target } from '@/lib/retrieval';
import { SUGGESTED_QUERIES } from '@/lib/stub-index';
import { laneLabel, laneVar, getWindow } from '@/lib/windows';
import styles from './QueryBar.module.css';

type Props = {
  latest: Exchange | null;
  targetIndex: number;
  onSubmit: (q: string) => void;
  onStep: (index: number) => void;
  onGoToTarget: (t: Target) => void;
  onRetry: () => void;
};

export default function QueryBar({
  latest,
  targetIndex,
  onSubmit,
  onStep,
  onGoToTarget,
  onRetry,
}: Props) {
  const [value, setValue] = useState('');
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

  return (
    <section className={styles.bar} aria-label="Query the corpus">
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
            answer={latest.result.answer}
            scopeNote={latest.result.scopeNote}
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
  answer,
  scopeNote,
}: {
  question: string;
  answer: string;
  scopeNote?: string;
}) {
  return (
    <div className={styles.block}>
      <QuestionLine text={question} />
      <p className={styles.answer}>{answer}</p>
      {scopeNote && (
        <p className={styles.scope}>
          <span className={`${styles.scopeTag} mono`}>Scope</span>
          {scopeNote}
        </p>
      )}
    </div>
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
