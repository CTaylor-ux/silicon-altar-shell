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

/** Floor: the input row and the target rail must never be draggable out of
 *  reach. You should not be able to put this thing in a state where you cannot
 *  type into it. */
const MIN_H = 132;
const DEFAULT_H = 222;
const H_KEY = 'silicon-altar-querybar-h';
const maxH = () => Math.round(window.innerHeight * 0.85);

type Props = {
  /** Every exchange this session, oldest first. The bar used to render only
   *  the most recent one, which was fine while each query stood alone. It
   *  stopped being fine the moment the exchange went multi-turn: prior turns
   *  are sent to the model as context, so the model could see the
   *  conversation and the reader could not. */
  history: Exchange[];
  latest: Exchange | null;
  targetIndex: number;
  onSubmit: (q: string) => void;
  onStep: (index: number) => void;
  onGoToTarget: (t: Target) => void;
  onGoToEntry: (h: LocateHit) => void;
  onRetry: () => void;
};

export default function QueryBar({
  history,
  latest,
  targetIndex,
  onSubmit,
  onStep,
  onGoToTarget,
  onGoToEntry,
  onRetry,
}: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  /* The bar was a fixed 222px, which was right when answers were two stub
     sentences. A real answer is prose plus an outside region plus a situating
     band, and reading that through a 130px slot makes the design look worse
     than it is.
     
     Height drives the --querybar-h custom property rather than a local style,
     because WindowStrip is already inset by that same variable. Set it once
     and the timeline above reflows to match for free. */
  const scrollRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>(DEFAULT_H);
  const dragging = useRef(false);
  /* Synchronous mirror of `height`. State alone is not enough: every call in a
     burst closes over the same stale value, so 24 arrow presses moved the bar
     one step instead of twenty-four. Key repeat would stutter identically. */
  const heightRef = useRef(DEFAULT_H);

  useEffect(() => {
    document.documentElement.style.setProperty('--querybar-h', `${height}px`);
  }, [height]);

  // Restore the reader's chosen height, and hand the variable back on unmount
  // so views without a query bar are not left with a stale inset.
  useEffect(() => {
    const saved = Number(sessionStorage.getItem(H_KEY));
    if (saved >= MIN_H) {
      const restored = Math.min(saved, maxH());
      heightRef.current = restored;
      setHeight(restored);
    }
    return () => {
      document.documentElement.style.removeProperty('--querybar-h');
    };
  }, []);

  const applyHeight = (px: number) => {
    const clamped = Math.max(MIN_H, Math.min(px, maxH()));
    heightRef.current = clamped;
    setHeight(clamped);
    try {
      sessionStorage.setItem(H_KEY, String(clamped));
    } catch {
      // Non-fatal: remembering the height is a nicety.
    }
  };

  /** Relative moves read the ref, not the render's closure, so bursts compose. */
  const nudge = (delta: number) => applyHeight(heightRef.current + delta);

  const onHandleDown = (e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    // Capture is an optimisation, not a requirement: the move/up listeners are
    // on window either way. Uncaught, a throw here would abort the handler
    // before those listeners were attached and the drag would die silently.
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* proceed without capture */
    }

    const move = (ev: PointerEvent) => {
      if (!dragging.current) return;
      // Dragging up grows the bar, so height is distance from the bottom.
      applyHeight(window.innerHeight - ev.clientY);
    };
    const up = () => {
      dragging.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /** Keyboard equivalent, so the handle is not mouse-only. */
  const onHandleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); nudge(40); }
    if (e.key === 'ArrowDown') { e.preventDefault(); nudge(-40); }
  };

  const expanded = height > DEFAULT_H + 40;

  /* Pin to the newest exchange. Scrollback is only useful if arriving at it
     puts you at the live end; landing at the top of a long history would mean
     scrolling down to find the answer you just asked for. */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [latest?.id, latest?.status, height]);

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
    <section className={styles.bar} aria-label="Query the corpus">
      {/* Drag to resize. Sits on the top edge, full width, so it is findable
          without being decorative. */}
      <div
        className={styles.handle}
        onPointerDown={onHandleDown}
        onKeyDown={onHandleKey}
        onDoubleClick={() => applyHeight(expanded ? DEFAULT_H : Math.round(maxH() * 0.72))}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize the query panel"
        aria-valuenow={height}
        aria-valuemin={MIN_H}
        tabIndex={0}
        title="Drag to resize · double-click to toggle · ↑↓ when focused"
      >
        <span className={styles.handleGrip} aria-hidden />
      </div>

      {hasBody && (
        <button
          className={`${styles.expand} mono`}
          onClick={() => applyHeight(expanded ? DEFAULT_H : Math.round(maxH() * 0.72))}
          aria-expanded={expanded}
        >
          {expanded ? 'Collapse ▾' : 'Expand ▴'}
        </button>
      )}

      <div className={styles.exchange} ref={scrollRef}>
        {!latest && <IdleState onPick={(q) => onSubmit(q)} />}

        {/* Earlier turns, condensed. Full rendering for every exchange would
            turn the panel into a wall; the citations stay live so an older
            answer is still a way into the windows. */}
        {history.slice(0, -1).map((ex) => (
          <PastExchange key={ex.id} exchange={ex} onGoToTarget={onGoToTarget} />
        ))}

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

/** An earlier turn: question, answer, citations. No situating band, no usage
 *  line, no outside region — those belong to the turn you are working on. */
function PastExchange({
  exchange,
  onGoToTarget,
}: {
  exchange: Exchange;
  onGoToTarget: (t: Target) => void;
}) {
  const [open, setOpen] = useState(false);
  if (exchange.status !== 'answered' || !exchange.result) return null;

  const byId = new Map(exchange.result.targets.map((t) => [t.entryId, t]));
  const full = exchange.result.answer;
  const isLong = full.length > 320;
  const shown = open || !isLong ? full : full.slice(0, 320).replace(/\s+\S*$/, '') + '…';

  return (
    <div className={styles.past}>
      <QuestionLine text={exchange.question} />
      <Prose
        text={shown}
        onCite={(id) => {
          const t = byId.get(id);
          if (t) onGoToTarget(t);
        }}
      />
      {isLong && (
        <button className={`${styles.pastMore} mono`} onClick={() => setOpen((v) => !v)}>
          {open ? 'Show less' : 'Show full answer'}
        </button>
      )}
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

      {/* Usage and cost are deliberately NOT rendered. They were a testing
          instrument and they did their job: they are how the five-minute cache
          window got diagnosed. But they are operator telemetry, not part of an
          answer, and a number attached to a claim invites the reader to price
          the evidence.

          The data is still captured. It rides on QueryResult.usage, the route
          logs it to the server console, and it belongs on the ledger record so
          "what did this month cost" stays answerable from the data rather than
          from the reading surface. */}
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
