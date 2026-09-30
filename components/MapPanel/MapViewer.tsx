'use client';

/**
 * MapViewer — one period map, large, inside the map panel (Thread 35).
 *
 * The image is the map's own sheet from the holder's IIIF image service, as
 * historical_maps.json records it; it is fetched from the holder when opened and
 * never copied. Drag pans; + / − / Fit, Ctrl/Cmd-scroll or a pinch zoom. The
 * credit (maker, holder, shelfmark) stays in view, with the link to the holder.
 * Escape and Close return to the card, not out of the panel.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { imageUrl, type PeriodMap } from '@/lib/maps';
import styles from './MapPanel.module.css';

export default function MapViewer({ m, onClose }: { m: PeriodMap; onClose: () => void }) {
  const [t, setT] = useState({ k: 1, x: 0, y: 0 });
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  // Escape closes the viewer only. Captured before the page's own handler, which
  // would otherwise close the whole panel.
  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const zoomAt = useCallback((f: number, cx?: number, cy?: number) => {
    setT((p) => {
      const k = Math.min(8, Math.max(1, p.k * f));
      if (k === 1) return { k: 1, x: 0, y: 0 };
      const r = stage.current?.getBoundingClientRect();
      const px = cx ?? (r ? r.width / 2 : 0), py = cy ?? (r ? r.height / 2 : 0);
      return { k, x: px - ((px - p.x) * k) / p.k, y: py - ((py - p.y) * k) / p.k };
    });
  }, []);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.25 : 1 / 1.25, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const img = m.image!;
  return (
    <div className={styles.viewer} role="dialog" aria-label={`Period map: ${m.title}`}>
      <div className={styles.viewerHead}>
        <div className={styles.viewerTitle}>
          <span className={styles.mapTitle}>{m.title}, {m.date}</span>
          <span className={styles.mapMeta}>
            {m.maker ?? 'Maker not recorded'} · {m.holder}{m.shelfmark ? ` · ${m.shelfmark}` : ''}
            {img.sheets > 1 ? ` · sheet ${img.sheet} of ${img.sheets}` : ''}
          </span>
          {m.indigenous_made && <span className={styles.madeBy}>Made by an Indigenous artist, as the holder records it: {m.indigenous_made_basis}</span>}
          {m.credit && <span className={styles.mapMeta}>Image: {m.credit}</span>}
        </div>
        <button ref={closeBtn} type="button" className={styles.btn} onClick={onClose}>Close map</button>
      </div>
      <div
        ref={stage}
        className={styles.viewerStage}
        onPointerDown={(e) => {
          if (t.k === 1) return;
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) setT((p) => ({ ...p, x: d.tx + e.clientX - d.x, y: d.ty + e.clientY - d.y }));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onDoubleClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); zoomAt(2, e.clientX - r.left, e.clientY - r.top); }}
        style={{ cursor: t.k > 1 ? 'grab' : 'zoom-in' }}
      >
        {failed ? (
          <p className={styles.fine}>The holder&rsquo;s image server did not answer. The map is still at the link below.</p>
        ) : (
          <>
            {!loaded && <p className={styles.viewerLoading}>Loading from {m.holder.split(',')[0]}…</p>}
            {/* eslint-disable-next-line @next/next/no-img-element -- served by the holder's IIIF server, not ours */}
            <img
              src={imageUrl(m, 2400)}
              alt={`${m.title}, ${m.date}, as held by ${m.holder}`}
              referrerPolicy="no-referrer"
              draggable={false}
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              className={styles.viewerImg}
              style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})`, opacity: loaded ? 1 : 0 }}
            />
          </>
        )}
        <div className={styles.zoom}>
          <button type="button" onClick={() => zoomAt(1.6)} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => zoomAt(1 / 1.6)} aria-label="Zoom out">−</button>
          <button type="button" onClick={() => setT({ k: 1, x: 0, y: 0 })} title="Fit the whole sheet">Fit</button>
        </div>
      </div>
      <div className={styles.viewerFoot}>
        <span className={styles.mapMeta}>Double-click or Ctrl/⌘-scroll to zoom · drag to move · Esc to close</span>
        {m.catalog_url && (
          <a className={styles.linkBtn} href={m.catalog_url} target="_blank" rel="noopener noreferrer">
            Full record at {m.holder.split(',')[0]} ↗
          </a>
        )}
      </div>
    </div>
  );
}
