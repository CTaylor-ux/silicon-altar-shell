'use client';

/**
 * Window view — the orchestrator.
 *
 * The route param seeds the open window ONCE. After that, movement is driven
 * from session state and the URL is synced with history.replaceState, so
 * prev/next never re-enters the Next router and never remounts the strip.
 * That is what makes left/right feel like travelling one timeline rather than
 * loading seven documents.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import WindowStrip from '@/components/WindowStrip';
import PositionIndicator from '@/components/PositionIndicator';
import QueryBar from '@/components/QueryBar/QueryBar';
import CompanionGuide from '@/components/CompanionGuide/CompanionGuide';
import AudioCue from '@/components/AudioCue/AudioCue';
import { useSession } from '@/lib/session';
import { query, RetrievalError, type Target } from '@/lib/retrieval';
import { clampWindowId, getWindow, WINDOW_COUNT } from '@/lib/windows';
import { getWindowContent } from '@/lib/window-content';
import styles from './window.module.css';

export default function WindowViewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { state, dispatch, latest } = useSession();

  const [pendingTarget, setPendingTarget] = useState<{ entryId: string; nonce: number } | null>(
    null
  );
  const nonce = useRef(0);
  const seeded = useRef(false);
  const abort = useRef<AbortController | null>(null);

  /** null = closed. Set to a window id when the guide should be showing. */
  const [guideFor, setGuideFor] = useState<number | null>(null);

  /** Operator view (?operator=1) reveals build-provenance chrome inside the
   *  window that members must never see. Read from location rather than
   *  useSearchParams to avoid forcing a Suspense boundary on this route. */
  const [operator, setOperator] = useState(false);
  useEffect(() => {
    setOperator(new URLSearchParams(window.location.search).get('operator') === '1');
  }, []);

  const current = state.currentWindow;
  const content = getWindowContent(current);
  const meta = getWindow(current);
  const guideOpen = guideFor === current;

  // Seed from the URL exactly once, after session hydration so a restored
  // session is not clobbered by a stale param.
  useEffect(() => {
    if (seeded.current || !state.hydrated) return;
    seeded.current = true;
    const fromUrl = clampWindowId(Number(params?.id ?? 0));
    if (!Number.isNaN(fromUrl)) dispatch({ type: 'SET_WINDOW', id: fromUrl });
  }, [params, dispatch, state.hydrated]);

  // Keep the URL honest without routing.
  useEffect(() => {
    if (!seeded.current) return;
    const next = `/windows/${current}`;
    if (window.location.pathname !== next) {
      window.history.replaceState(null, '', next);
    }
  }, [current]);

  const go = useCallback(
    (id: number) => {
      const next = clampWindowId(id);
      if (next === current) return;
      setPendingTarget(null);
      dispatch({ type: 'SET_WINDOW', id: next });
    },
    [current, dispatch]
  );

  const backToSelector = useCallback(() => router.push('/windows'), [router]);

  // Open the guide the first time a window is entered this session. Returning
  // to a window you have already been through does not interrupt again; the
  // Guide button in the top rail is always there if you want it back.
  useEffect(() => {
    if (!state.hydrated || !seeded.current) return;
    if (state.guideSeen[current]) return;
    setGuideFor(current);
  }, [current, state.hydrated, state.guideSeen]);

  const dismissGuide = useCallback(() => {
    dispatch({ type: 'MARK_GUIDE_SEEN', id: current });
    setGuideFor(null);
  }, [current, dispatch]);

  const openGuide = useCallback(() => setGuideFor(current), [current]);

  /** Move the view to a target, crossing windows when the answer does. */
  const goToTarget = useCallback(
    (t: Target) => {
      if (t.windowId !== current) dispatch({ type: 'SET_WINDOW', id: t.windowId });
      nonce.current += 1;
      setPendingTarget({ entryId: t.entryId, nonce: nonce.current });
    },
    [current, dispatch]
  );

  const runQuery = useCallback(
    async (q: string) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      dispatch({ type: 'ASK', id, question: q });

      try {
        const result = await query(q, controller.signal);
        dispatch({ type: 'ANSWER', id, result });
        // The answer points at the evidence — so move there without being asked.
        if (result.targets.length) goToTarget(result.targets[0]);
      } catch (err) {
        if (err instanceof RetrievalError && err.message === 'aborted') return;
        dispatch({
          type: 'FAIL',
          id,
          error: err instanceof Error ? err.message : 'Unknown failure',
        });
      }
    },
    [dispatch, goToTarget]
  );

  const step = useCallback(
    (index: number) => {
      const targets = latest?.result?.targets ?? [];
      if (index < 0 || index >= targets.length) return;
      dispatch({ type: 'SET_TARGET_INDEX', index });
      goToTarget(targets[index]);
    },
    [latest, dispatch, goToTarget]
  );

  const retry = useCallback(() => {
    if (latest) runQuery(latest.question);
  }, [latest, runQuery]);

  const onScroll = useCallback(
    (windowId: number, pos: { x: number; y: number }) =>
      dispatch({ type: 'SET_SCROLL', id: windowId, pos }),
    [dispatch]
  );

  const onNav = useCallback(
    (key: 'ArrowLeft' | 'ArrowRight') => go(current + (key === 'ArrowRight' ? 1 : -1)),
    [go, current]
  );

  // Keyboard: arrows travel the sequence, Esc returns to the selector.
  // Arrow presses inside the iframe arrive via the bridge (onNav).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // While the guide is up it owns the keyboard. It also stops propagation
      // in the capture phase; this is the second line of defence so a future
      // refactor cannot accidentally let Esc skip past it to the selector.
      if (guideOpen) return;
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA)$/.test(el.tagName)) {
        if (e.key === 'Escape') (el as HTMLInputElement).blur();
        return;
      }
      if (e.key === 'ArrowLeft') go(current - 1);
      else if (e.key === 'ArrowRight') go(current + 1);
      else if (e.key === 'Escape') backToSelector();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, current, backToSelector, guideOpen]);

  if (!state.hydrated) return <div className={styles.boot} />;

  return (
    <main className={styles.view}>
      <PositionIndicator
        current={current}
        onGo={go}
        onBackToSelector={backToSelector}
        onOpenGuide={openGuide}
      />

      {/* Sits directly beneath the top rail, so it is adjacent to the window's
          own intro prose on open without the shell touching the document. */}
      <AudioCue
        audio={content?.introAudio ?? null}
        windowId={current}
        purpose="window intro narration"
      />

      <WindowStrip
        current={current}
        targetEntryId={pendingTarget?.entryId ?? null}
        targetNonce={pendingTarget?.nonce}
        scroll={state.scroll}
        onScroll={onScroll}
        onNav={onNav}
        operator={operator}
      />

      <QueryBar
        latest={latest}
        targetIndex={state.targetIndex}
        onSubmit={runQuery}
        onStep={step}
        onGoToTarget={goToTarget}
        onRetry={retry}
      />

      {content && (
        <CompanionGuide
          guide={content.guide}
          guideAudio={content.guideAudio}
          windowId={current}
          windowLabel={`Window ${current} of ${WINDOW_COUNT}`}
          yearRange={meta?.yearRange ?? ''}
          open={guideOpen}
          onDismiss={dismissGuide}
        />
      )}

      {/* FUTURE: PRD §2.1 Layer 3 (invite-only source repository) and §4.3
          researcher tier gate the dossier overlay from here. Not in scope. */}
    </main>
  );
}
