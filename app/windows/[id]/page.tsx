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
import GlossaryPopover, { type Anchor } from '@/components/GlossaryPopover/GlossaryPopover';
import LocatePanel from '@/components/LocatePanel/LocatePanel';
import type { LocateHit } from '@/lib/locate';
import { useSession } from '@/lib/session';
import { query, RetrievalError, type Target } from '@/lib/retrieval';
import { clampWindowId, getWindow, WINDOW_COUNT } from '@/lib/windows';
import { getWindowContent } from '@/lib/window-content';
import styles from './window.module.css';

/** Must track --topbar-h / --audiobar-h in styles/tokens.css. */
const TOPBAR_H = 44;
const AUDIOBAR_H = 34;

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

  /** Legend starts collapsed (item D); in-place help replaces it. */
  const [legendOpen, setLegendOpen] = useState(false);

  /** Active glossary token + where it sits inside the frame. */
  const [gloss, setGloss] = useState<{ token: string; anchor: Anchor } | null>(null);

  const [locateOpen, setLocateOpen] = useState(false);

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

  const onGlossary = useCallback(
    (token: string, rect: Anchor) => setGloss({ token, anchor: rect }),
    []
  );
  // A definition is about one token in one place; moving invalidates it.
  useEffect(() => setGloss(null), [current]);

  /** Move the view to a target, crossing windows when the answer does. */
  const goToTarget = useCallback(
    (t: Target) => {
      if (t.windowId !== current) dispatch({ type: 'SET_WINDOW', id: t.windowId });
      nonce.current += 1;
      setPendingTarget({ entryId: t.entryId, nonce: nonce.current });
    },
    [current, dispatch]
  );

  /** A LocateHit and a Target are the same row seen by two features. One
   *  mapping, used by both the Locate panel and the answer's situating band. */
  const goToHit = useCallback(
    (hit: LocateHit) => {
      goToTarget({
        entryId: hit.id,
        windowId: hit.window,
        year: hit.year.display,
        lane: hit.lane,
        tier: hit.tier,
        title: hit.title,
      });
    },
    [goToTarget]
  );

  const runQuery = useCallback(
    async (q: string) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      dispatch({ type: 'ASK', id, question: q });

      try {
        /* Prior turns, so the exchange is genuinely multi-turn: a reader can
           push back on an answer rather than only re-query. Capped in the
           route; capped again here so a long session cannot quietly inflate
           the uncached portion of every request. */
        const turns = state.history
          .filter((h) => h.status === 'answered' && h.result)
          .slice(-4)
          .flatMap((h) => [
            { role: 'user' as const, content: h.question },
            { role: 'assistant' as const, content: h.result!.answer },
          ]);

        const result = await query(q, controller.signal, turns);
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
    [dispatch, goToTarget, state.history]
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
      if (guideOpen || locateOpen) return;
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
  }, [go, current, backToSelector, guideOpen, locateOpen]);

  if (!state.hydrated) return <div className={styles.boot} />;

  return (
    <main className={styles.view}>
      <PositionIndicator
        current={current}
        onGo={go}
        onBackToSelector={backToSelector}
        onOpenGuide={openGuide}
        legendOpen={legendOpen}
        onToggleLegend={() => setLegendOpen((v) => !v)}
        onOpenLocate={() => setLocateOpen(true)}
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
        legendOpen={legendOpen}
        onGlossary={onGlossary}
      />

      {/* Frame's top edge = position rail + audio strip. The frame reports
          token rects in its own viewport space; this is the offset. */}
      <GlossaryPopover
        token={gloss?.token ?? null}
        anchor={gloss?.anchor ?? null}
        frameOffsetTop={TOPBAR_H + AUDIOBAR_H}
        onClose={() => setGloss(null)}
      />

      <QueryBar
        history={state.history}
        latest={latest}
        targetIndex={state.targetIndex}
        onSubmit={runQuery}
        onStep={step}
        onGoToTarget={goToTarget}
        onGoToEntry={goToHit}
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

      <LocatePanel
        open={locateOpen}
        onClose={() => setLocateOpen(false)}
        onGoToEntry={(hit: LocateHit) => {
          setLocateOpen(false);
          goToHit(hit);
        }}
      />

      {/* FUTURE: PRD §2.1 Layer 3 (invite-only source repository) and §4.3
          researcher tier gate the dossier overlay from here. Not in scope. */}
    </main>
  );
}
