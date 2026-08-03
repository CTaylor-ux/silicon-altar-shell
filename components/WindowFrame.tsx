'use client';

/**
 * WindowFrame — one Window document, in an iframe.
 *
 * The iframe is deliberate, not incidental. The requirement is that the
 * Windows look EXACTLY as the generator emitted them; the documents carry a
 * global <style> block with body-level selectors. An iframe makes CSS bleed
 * structurally impossible in both directions.
 *
 * The cost is that scroll/highlight has to cross a frame boundary, which is
 * paid with the postMessage bridge injected by scripts/prepare-windows.mjs.
 * That boundary is also an asset: it is the same interface a remotely-hosted
 * or differently-generated window would present.
 */

import { useCallback, useEffect, useRef } from 'react';
import { windowSrc } from '@/lib/windows';
import styles from './WindowFrame.module.css';

export type FrameMessage =
  | { type: 'SA_READY'; rows: number }
  | { type: 'SA_SCROLL'; x: number; y: number }
  | { type: 'SA_TARGET_HIT'; entryId: string }
  | { type: 'SA_TARGET_MISS'; entryId: string }
  | { type: 'SA_NAV'; key: 'ArrowLeft' | 'ArrowRight' };

type Props = {
  windowId: number;
  /** -1 | 0 | 1 — position relative to the open window. */
  offset: number;
  active: boolean;
  targetEntryId?: string | null;
  /** Bumped to re-fire the same target (e.g. stepping 1/2 -> 2/2 -> 1/2). */
  targetNonce?: number;
  initialScroll?: { x: number; y: number };
  onScroll?: (windowId: number, pos: { x: number; y: number }) => void;
  onNav?: (key: 'ArrowLeft' | 'ArrowRight') => void;
  onTargetMiss?: (entryId: string) => void;
};

export default function WindowFrame({
  windowId,
  offset,
  active,
  targetEntryId,
  targetNonce = 0,
  initialScroll,
  onScroll,
  onNav,
  onTargetMiss,
}: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const restored = useRef(false);
  /** entryId the frame has acknowledged for the in-flight request. Posting is
   *  retried until this matches, because a SA_READY that lands before this
   *  component's listener is attached would otherwise strand the target. */
  const acked = useRef<string | null>(null);

  const post = useCallback((msg: Record<string, unknown>) => {
    ref.current?.contentWindow?.postMessage({ source: 'sa-shell', ...msg }, '*');
  }, []);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const d = ev.data as (FrameMessage & { source?: string; windowId?: number }) | undefined;
      if (!d || d.source !== 'sa-window' || d.windowId !== windowId) return;

      switch (d.type) {
        case 'SA_READY':
          ready.current = true;
          if (initialScroll && !restored.current) {
            restored.current = true;
            post({ type: 'SA_RESTORE_SCROLL', ...initialScroll });
          }
          break;
        case 'SA_SCROLL':
          onScroll?.(windowId, { x: d.x, y: d.y });
          break;
        case 'SA_NAV':
          onNav?.(d.key);
          break;
        case 'SA_TARGET_HIT':
          acked.current = d.entryId;
          break;
        case 'SA_TARGET_MISS':
          acked.current = d.entryId;
          onTargetMiss?.(d.entryId);
          break;
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [windowId, initialScroll, onScroll, onNav, onTargetMiss, post]);

  // Fire the target, retrying until the frame acknowledges it. Gating on a
  // SA_READY flag alone is racy: a neighbour frame that finished parsing before
  // this listener attached would never be posted to, and the target would be
  // silently dropped. Retrying until ack is race-free in both directions.
  useEffect(() => {
    if (!active || !targetEntryId) return;
    acked.current = null;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const send = () => {
      if (acked.current === targetEntryId) return;
      post({ type: 'SA_SCROLL_TO', entryId: targetEntryId });
      if (tries++ < 40) timer = setTimeout(send, 120);
    };
    send();
    return () => clearTimeout(timer);
  }, [active, targetEntryId, targetNonce, post]);

  return (
    <div
      className={styles.slot}
      style={{ transform: `translateX(${offset * 100}%)` }}
      aria-hidden={!active}
      inert={!active}
    >
      <iframe
        ref={ref}
        className={styles.frame}
        src={windowSrc(windowId)}
        title={`Window ${windowId}`}
        loading={active ? 'eager' : 'lazy'}
      />
    </div>
  );
}
