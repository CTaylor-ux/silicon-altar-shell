'use client';

/**
 * MapCanvas — the drawn map inside the map panel (Thread 35).
 *
 * Natural Earth 1:50m coastlines (public domain) under the row's places and
 * movements. Opens fitted to what it shows; drag pans, the buttons and
 * Ctrl/Cmd-scroll or a trackpad pinch zoom. Plain scrolling is left to the panel.
 *
 * Every line is one of the corpus's kinds: documented, corridor, schematic,
 * intended, or a mention (dotted grey, "mentioned, not movement"). Movements
 * carry an arrowhead; mentions and places do not.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoGraticule, geoInterpolate, geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Place } from '@/lib/maps';
import styles from './MapPanel.module.css';

export type CanvasLine = {
  id: string;
  from: Place;
  to: Place;
  kind: 'documented' | 'corridor' | 'schematic' | 'intended' | 'mentioned';
  color: string;
  dim?: boolean;
  title: string;
};
export type CanvasPoint = { place: Place; color: string; dim?: boolean; hollow?: boolean; number?: number; current?: boolean };

const W = 900;
const H = 560;

let landPromise: Promise<unknown> | null = null;
function loadLand() {
  landPromise ??= fetch('/maps/land-50m.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`coastlines ${r.status}`))))
    .then((topo: { objects: { land: unknown } }) => feature(topo, topo.objects.land));
  return landPromise;
}

const ll = (p: Place): [number, number] => [p.lon, p.lat];

export default function MapCanvas({
  points,
  lines,
  fitTo,
  label,
}: {
  points: CanvasPoint[];
  lines: CanvasLine[];
  /** Places the view should open on; defaults to every point shown. */
  fitTo?: Place[];
  label: string;
}) {
  const [land, setLand] = useState<unknown>(null);
  const [landError, setLandError] = useState(false);
  const [t, setT] = useState({ k: 1, x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  useEffect(() => {
    let live = true;
    loadLand().then((f) => live && setLand(f)).catch(() => live && setLandError(true));
    return () => {
      live = false;
    };
  }, []);

  /* The base projection is fitted to what this view is about, with a floor on
   * the area so a single place opens with its surroundings, not as a dot. */
  const fitKey = (fitTo ?? points.map((p) => p.place)).map((p) => p.id).join('|');
  const base = useMemo(() => {
    const fit = fitTo ?? points.map((p) => p.place);
    const proj = geoNaturalEarth1().rotate([40, 0]);
    if (!fit.length) {
      proj.fitExtent([[6, 6], [W - 6, H - 6]], { type: 'MultiPoint', coordinates: [[-100, 60], [16, 60], [-100, -12], [16, -12]] });
    } else {
      const lons = fit.map((p) => p.lon);
      const lats = fit.map((p) => p.lat);
      let [w, e, s, n] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
      const minW = 22, minH = 14;
      if (e - w < minW) { const c = (e + w) / 2; w = c - minW / 2; e = c + minW / 2; }
      if (n - s < minH) { const c = (n + s) / 2; s = c - minH / 2; n = c + minH / 2; }
      proj.fitExtent([[40, 30], [W - 40, H - 30]], { type: 'MultiPoint', coordinates: [[w, s], [e, s], [w, n], [e, n]] });
    }
    return { s: proj.scale(), tr: proj.translate() };
    // fitKey stands in for the places' identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  useEffect(() => setT({ k: 1, x: 0, y: 0 }), [fitKey]);

  const proj = useMemo(
    () => geoNaturalEarth1().rotate([40, 0]).scale(base.s * t.k).translate([base.tr[0] * t.k + t.x, base.tr[1] * t.k + t.y]),
    [base, t]
  );
  const path = useMemo(() => geoPath(proj), [proj]);
  const grat = useMemo(() => path(geoGraticule().step([10, 10])()), [path]);
  const landD = useMemo(() => (land ? path(land) : null), [path, land]);

  const zoomAt = useCallback((factor: number, cx = W / 2, cy = H / 2) => {
    setT((o) => {
      const k = Math.max(0.6, Math.min(12, o.k * factor));
      const r = k / o.k;
      return { k, x: cx - (cx - o.x) * r, y: cy - (cy - o.y) * r };
    });
  }, []);

  const toSvg = (e: { clientX: number; clientY: number }) => {
    const b = svgRef.current!.getBoundingClientRect();
    return [((e.clientX - b.left) / b.width) * W, ((e.clientY - b.top) / b.height) * H] as const;
  };

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return; // plain scroll belongs to the panel
      e.preventDefault();
      const [cx, cy] = toSvg(e);
      zoomAt(Math.exp(-e.deltaY * 0.004), cx, cy);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const arrow = (a: Place, b: Place) => {
    const it = geoInterpolate(ll(a), ll(b));
    const p1 = proj(it(0.5));
    const p2 = proj(it(0.53));
    const pa = proj(ll(a));
    const pb = proj(ll(b));
    if (!p1 || !p2 || !pa || !pb || Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) < 26) return null;
    return { x: p1[0], y: p1[1], deg: (Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180) / Math.PI };
  };

  const dash = (k: CanvasLine['kind']) =>
    k === 'schematic' ? '2 5' : k === 'intended' ? '7 5' : k === 'mentioned' ? '1 4' : undefined;

  return (
    <div className={styles.canvas}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        className={styles.svg}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          const [x, y] = toSvg(e);
          drag.current = { x, y, tx: t.x, ty: t.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const [x, y] = toSvg(e);
          const d = drag.current;
          setT((o) => ({ ...o, x: d.tx + x - d.x, y: d.ty + y - d.y }));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <rect width={W} height={H} fill="var(--map-sea)" />
        {grat && <path d={grat} fill="none" stroke="var(--map-grat)" strokeWidth={0.7} />}
        {landD && <path d={landD} fill="var(--map-land)" stroke="var(--map-land-edge)" strokeWidth={0.6} />}
        {lines.map((l) => {
          const d = path({ type: 'LineString', coordinates: [ll(l.from), ll(l.to)] });
          if (!d) return null;
          const a = l.kind === 'mentioned' ? null : arrow(l.from, l.to);
          const color = l.kind === 'mentioned' ? 'var(--dim)' : l.color;
          return (
            <g key={l.id} opacity={l.dim ? 0.28 : 1}>
              <title>{l.title}</title>
              <path d={d} fill="none" stroke={color} strokeWidth={l.kind === 'corridor' ? 5 : l.kind === 'mentioned' ? 1.3 : 2}
                strokeOpacity={l.kind === 'corridor' ? 0.45 : 0.95} strokeDasharray={dash(l.kind)} strokeLinecap="round" />
              {a && <path d="M-5,-4.5L6,0L-5,4.5Z" fill={color} transform={`translate(${a.x},${a.y}) rotate(${a.deg})`} />}
            </g>
          );
        })}
        {points.map((pt) => {
          const q = proj(ll(pt.place));
          if (!q) return null;
          const region = pt.place.precision === 'region-label';
          const hollow = pt.hollow || pt.place.precision !== 'point';
          const right = q[0] > W - 170;
          return (
            <g key={pt.place.id} opacity={pt.dim ? 0.35 : 1}>
              <title>{pt.place.precision === 'point' ? pt.place.name : `${pt.place.name} (${pt.place.precision})`}</title>
              {!region && (
                <circle cx={q[0]} cy={q[1]} r={3.8} fill={hollow ? 'var(--map-sea)' : 'var(--bright)'}
                  stroke="var(--bright)" strokeWidth={hollow ? 1.4 : 0} />
              )}
              {!pt.dim && (
                <text x={region ? q[0] : right ? q[0] - 7 : q[0] + 7} y={q[1] + 3.5}
                  textAnchor={region ? 'middle' : right ? 'end' : 'start'} className={region ? styles.regionLabel : styles.placeLabel}>
                  {pt.place.name}
                </text>
              )}
              {pt.number !== undefined && (
                <g>
                  <circle cx={q[0] + 11} cy={q[1] - 11} r={8} fill={pt.current ? 'var(--bright)' : 'var(--panel2)'} stroke={pt.current ? 'var(--bright)' : 'var(--bdr2)'} />
                  <text x={q[0] + 11} y={q[1] - 7.5} textAnchor="middle" className={styles.stopNum} fill={pt.current ? 'var(--bg)' : 'var(--dim)'}>
                    {pt.number}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <div className={styles.zoom}>
        <button type="button" onClick={() => zoomAt(1.6)} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => zoomAt(1 / 1.6)} aria-label="Zoom out">−</button>
        <button type="button" onClick={() => setT({ k: 1, x: 0, y: 0 })} title="Fit to this view">Fit</button>
      </div>
      <div className={styles.hint}>
        {landError ? 'Coastlines did not load.' : 'Drag to move · pinch or Ctrl/⌘-scroll to zoom'}
      </div>
    </div>
  );
}
