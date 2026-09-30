'use client';

/**
 * MapPanel — the map layer's one panel (Thread 35).
 *
 * Opened from a row's MAP mark. It never replaces the window: it sits over the
 * right of the grid (a bottom sheet on phones), and closing it leaves the reader
 * where they were. Three views, reached from context rather than a mode switch:
 *
 *   row     the row's places and movements, in the row's own words
 *   thread  a chain the corpus records (T-ASIENTO first), stop by stop across
 *           windows; the window behind moves to each stop
 *   place   everything that happened at one place, under the names it carried
 *
 * A trail at the top records the path, with Back. Nothing here interprets: the
 * text is the rows' own wording, and the rows and dossiers carry the reading.
 * Operator view adds what members must not see: unsourced or flagged links,
 * candidate maps, gaps.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import MapCanvas, { type CanvasLine, type CanvasPoint } from './MapCanvas';
import MapViewer from './MapViewer';
import {
  CLOSE_YEARS, closestPeriodMaps, shownYear, entryRow, eventLayer, eventTitle, eventWindow, eventYear, hasShownImage, imageUrl, periodMapSeries, place, placeHasRecord, placeRecord,
  threadInfo, threadStops, threadTitle, threadsForEvent, type ThreadStop, topLevelPlace, type Place, type PlaceLink, type PeriodMap,
} from '@/lib/maps';
import { laneVar } from '@/lib/windows';
import type { Target } from '@/lib/retrieval';
import styles from './MapPanel.module.css';

export type MapView =
  | { kind: 'row'; eventId: string; entryId: string }
  | { kind: 'thread'; token: string; index: number }
  | { kind: 'place'; placeId: string };

/** Opens one period map large, over the panel body. */
const OpenMap = createContext<(m: PeriodMap) => void>(() => {});

const ROLE: Record<string, string> = {
  'taken-from': 'taken from', 'sold-at': 'sold at', 'financed-from': 'financed from', departed: 'departed',
  'intended-destination': 'bound for', 'captors-home-port': "captors' home port", 'captured-off': 'captured off',
  arrived: 'arrived at', chamber: 'company chamber', entrepot: 'entrepot', attacked: 'attacked', taken: 'taken',
  mentioned: 'mentioned', destination: 'destination', 'held-at': 'held at', at: 'at', 'contracted-at': 'contracted at',
  'ordered-by': 'ordered by', 'merchant-of': 'merchant of', 'based-at': 'based at', 'signed-at': 'signed at', toward: 'toward',
};

export function viewLabel(v: MapView): string {
  if (v.kind === 'row') return `${eventYear(v.eventId).display} row`;
  if (v.kind === 'thread') return `${threadTitle(v.token)}, stop ${v.index + 1}`;
  return place(v.placeId)?.name ?? v.placeId;
}

type Props = {
  trail: MapView[];
  operator: boolean;
  onPush: (v: MapView) => void;
  onReplace: (v: MapView) => void;
  onTrailTo: (index: number) => void;
  onBack: () => void;
  onClose: () => void;
  onJump: (t: Target) => void;
  targetForEvent: (eventId: string) => Target | null;
  /** Desktop width in px, owned by the page; undefined on phones (bottom sheet). */
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  /** The reader dragged or nudged the left edge. */
  onResize?: (px: number) => void;
};

export default function MapPanel(props: Props) {
  const { trail, operator, onBack, onClose, onTrailTo, width, minWidth = 380, maxWidth = 900, onResize } = props;
  const drag = useRef<{ x: number; w: number } | null>(null);
  const view = trail[trail.length - 1];
  /* Whenever the view changes (a new stop, place or row), bring the map back
   * into sight: a stop chosen from the bottom of the list otherwise changes a
   * map the reader has scrolled past. */
  const bodyRef = useRef<HTMLDivElement>(null);
  const viewKey = view ? JSON.stringify(view) : '';
  const [viewing, setViewing] = useState<PeriodMap | null>(null);
  useEffect(() => setViewing(null), [viewKey]);
  useEffect(() => {
    // Where the map is pinned (see .mapSticky) it is already in view, and
    // jumping the list back to the top would lose the reader's place in it.
    if (window.matchMedia('(min-height: 760px)').matches) return;
    bodyRef.current?.scrollTo({ top: 0 });
  }, [viewKey]);
  if (!view) return null;

  return (
    <aside className={styles.panel} aria-label="Map panel" data-map-panel="" style={width ? { width } : undefined}>
      {width !== undefined && onResize && (
        /* Left-edge handle, the query bar's pattern turned on its side: drag to
           widen or narrow, arrow keys when focused, double-click to toggle. The
           page clamps, so the window behind always keeps a usable strip. */
        <div
          className={styles.resize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the map panel"
          aria-valuenow={Math.round(width)}
          aria-valuemin={minWidth}
          aria-valuemax={Math.round(maxWidth)}
          tabIndex={0}
          title="Drag to resize · double-click to toggle · ← → when focused"
          onPointerDown={(e) => {
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, w: width };
          }}
          onPointerMove={(e) => {
            if (drag.current) onResize(drag.current.w + (drag.current.x - e.clientX));
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onDoubleClick={() => onResize(width >= maxWidth - 4 ? 560 : maxWidth)}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 80 : 24;
            if (e.key === 'ArrowLeft') { e.preventDefault(); onResize(width + step); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); onResize(width - step); }
          }}
        >
          <span className={styles.resizeGrip} aria-hidden />
        </div>
      )}
      <header className={styles.head}>
        <nav className={styles.trail} aria-label="Map trail">
          {trail.map((v, i) =>
            i === trail.length - 1 ? (
              <span key={i} className={styles.trailCur}>{viewLabel(v)}</span>
            ) : (
              <span key={i}>
                <button type="button" onClick={() => onTrailTo(i)}>{viewLabel(v)}</button>
                <span className={styles.sep} aria-hidden>›</span>
              </span>
            )
          )}
        </nav>
        <div className={styles.headBtns}>
          <button type="button" className={styles.btn} onClick={onBack} disabled={trail.length < 2}>← Back</button>
          <button type="button" className={styles.btn} onClick={onClose}>Close</button>
        </div>
      </header>
      <OpenMap.Provider value={setViewing}>
        <div className={styles.body} ref={bodyRef}>
          {view.kind === 'row' && <RowView {...props} view={view} />}
          {view.kind === 'thread' && <ThreadView {...props} view={view} />}
          {view.kind === 'place' && <PlaceView {...props} view={view} />}
          {operator && <p className={styles.opNote}>Operator view: flagged links, candidate maps and gaps are shown.</p>}
        </div>
      </OpenMap.Provider>
      {viewing && <MapViewer key={viewing.id} m={viewing} onClose={() => setViewing(null)} />}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------
function Legend() {
  return (
    <div className={styles.legend}>
      <span><svg width="26" height="10"><line x1="0" y1="5" x2="26" y2="5" stroke="var(--txt)" strokeWidth="2" /><path d="M9,1L17,5L9,9Z" fill="var(--txt)" /></svg>documented; arrow = direction</span>
      <span><svg width="26" height="10"><line x1="0" y1="5" x2="26" y2="5" stroke="var(--gold)" strokeWidth="5" strokeOpacity=".45" strokeLinecap="round" /></svg>corridor</span>
      <span><svg width="26" height="10"><line x1="0" y1="5" x2="26" y2="5" stroke="var(--txt)" strokeWidth="1.8" strokeDasharray="7 5" /></svg>intended, not made</span>
      <span><svg width="26" height="10"><line x1="0" y1="5" x2="26" y2="5" stroke="var(--dim)" strokeWidth="1.3" strokeDasharray="1 4" strokeLinecap="round" /></svg>mentioned, not movement</span>
      <span><svg width="12" height="12"><circle cx="6" cy="6" r="4" fill="none" stroke="var(--bright)" strokeWidth="1.4" /></svg>approximate or region</span>
    </div>
  );
}

function Quote({ l, onJump, targetForEvent }: { l: PlaceLink } & Pick<Props, 'onJump' | 'targetForEvent'>) {
  const row = entryRow(l.entry_id);
  const p = place(l.place_id);
  return (
    <li className={styles.quoteRow}>
      <span className={styles.lane} style={{ color: row ? laneVar(row.lane) : undefined }}>{ROLE[l.role] ?? l.role}</span>
      <span className={styles.placeName}>{p?.name}</span>
      <q className={styles.q}>{l.quote}</q>
      <button type="button" className={styles.linkBtn}
        onClick={() => { const t = row ? { entryId: row.id, windowId: row.window, year: row.year.display, lane: row.lane, tier: row.tier as Target['tier'], title: row.title } : targetForEvent(l.event_id ?? ''); if (t) onJump(t); }}>
        {l.entry_id}
      </button>
      {l.flags.length > 0 && <span className={styles.flag}>{l.flags.map((f) => f.split(':')[0]).join('; ')}</span>}
    </li>
  );
}

/* Period maps come in two groups (author ruling, Thread 35): the maps closest to
 * the row's moment, within the window's cutoff; and how the place was drawn over
 * time, earlier and later, each with its distance from the row stated. An old map
 * is still context, and the contrast shows the lines being redrawn. Every card
 * names its maker: a map is its maker's view, not the ground truth. */
function MapCard({ m, year }: { m: PeriodMap; year: number | null }) {
  let rel = '';
  if (year !== null) {
    const d = Math.round(shownYear(m) - year);
    const n = Math.abs(d), yrs = n === 1 ? 'year' : 'years';
    rel = d === 0 ? 'drawn the same year' : d > 0 ? `drawn ${n} ${yrs} later` : `drawn ${n} ${yrs} earlier`;
  }
  const meta = [rel, m.date_note].filter(Boolean).join(' · ');
  const open = useContext(OpenMap);
  const [thumbFailed, setThumbFailed] = useState(false);
  const showImg = hasShownImage(m) && !thumbFailed;
  return (
    <li className={styles.mapCard}>
      {showImg && (
        <button type="button" className={styles.thumbBtn} onClick={() => open(m)} aria-label={`View ${m.title} large`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- served by the holder's IIIF server, not ours */}
          <img src={imageUrl(m, 480)} alt="" loading="lazy" referrerPolicy="no-referrer" draggable={false}
            className={styles.thumb} onError={() => setThumbFailed(true)} />
          <span className={styles.thumbHint}>View larger</span>
        </button>
      )}
      <span className={styles.mapTitle}>{m.title}, {m.date}</span>
      {m.depicts_date && m.depicts_date !== m.date && (
        <span className={styles.mapMeta}>A {m.date} copy of a work of {m.depicts_date}</span>
      )}
      <span className={styles.mapMeta}>{m.maker ?? 'Maker not recorded'} · {m.holder}{m.shelfmark ? ` · ${m.shelfmark}` : ''}</span>
      {m.indigenous_made && <span className={styles.madeBy}>Made by an Indigenous artist, as the holder records it: {m.indigenous_made_basis}</span>}
      {meta && <span className={styles.mapMeta}>{meta}</span>}
      {showImg && m.credit && <span className={styles.mapMeta}>Image: {m.credit}</span>}
      {m.status === 'candidate' && <span className={styles.flag}>candidate: not verified at the holder</span>}
      {!m.memberVisible && m.status === 'verified' && <span className={styles.mapMeta}>Rights allow a link only.</span>}
      {m.memberVisible && !m.image && <span className={styles.mapMeta}>Image not yet recorded; see it at the holder.</span>}
      {m.catalog_url && (
        <a className={styles.linkBtn} href={m.catalog_url} target="_blank" rel="noopener noreferrer">
          Open at {m.holder.split(',')[0]} ↗
        </a>
      )}
    </li>
  );
}

function ClosestMaps({ year, windowId, placeIds, operator }: { year: number | null; windowId: number | null; placeIds: string[]; operator: boolean }) {
  const maps = year === null ? [] : closestPeriodMaps(year, windowId, placeIds, operator, 3);
  const cut = CLOSE_YEARS[windowId ?? 1] ?? 5;
  return (
    <section className={styles.sec}>
      <h3>Closest to this moment</h3>
      {maps.length ? (
        <ul className={styles.maps}>{maps.map((m) => <MapCard key={m.id} m={m} year={year} />)}</ul>
      ) : (
        <p className={styles.fine}>No verified period map within {cut} years of this date yet.</p>
      )}
    </section>
  );
}

function MapSeries({ maps, year, heading, note, initial = 6 }: { maps: PeriodMap[]; year: number | null; heading: string; note: string; initial?: number }) {
  const [all, setAll] = useState(false);
  if (!maps.length) return null;
  const shown = all ? maps : maps.slice(0, initial);
  return (
    <section className={styles.sec}>
      <h3>{heading} · {maps.length}</h3>
      <p className={styles.fine}>{note}</p>
      <ul className={styles.maps}>{shown.map((m) => <MapCard key={m.id} m={m} year={year} />)}</ul>
      {maps.length > shown.length && (
        <button type="button" className={styles.goBtn} onClick={() => setAll(true)}>Show all {maps.length} →</button>
      )}
    </section>
  );
}

function layerDrawing(eventId: string, operator: boolean, dim = false) {
  const layer = eventLayer(eventId, operator);
  const points: CanvasPoint[] = [];
  const lines: CanvasLine[] = [];
  if (!layer) return { points, lines, places: [] as Place[] };
  const color = (entryId: string) => { const r = entryRow(entryId); return r ? laneVar(r.lane) : 'var(--txt)'; };
  const byPlace = new Map<string, string>();
  for (const l of layer.links) if (!byPlace.has(l.place_id)) byPlace.set(l.place_id, color(l.entry_id));
  for (const p of layer.places) points.push({ place: p, color: byPlace.get(p.id) ?? 'var(--txt)', dim });
  for (const f of layer.flows) {
    const a = place(f.from), b = place(f.to);
    if (a && b) lines.push({ id: f.id, from: a, to: b, kind: f.kind, color: color(f.entry_ids[0]), dim, title: f.note || f.id });
    const c = f.intended_to ? place(f.intended_to) : undefined;
    if (a && c && c.id !== f.to) lines.push({ id: `${f.id}-intended`, from: b ?? a, to: c, kind: 'intended', color: color(f.entry_ids[0]), dim, title: 'Intended destination, not reached' });
  }
  return { points, lines, places: layer.places };
}

// ---------------------------------------------------------------------------
// Row view
// ---------------------------------------------------------------------------
function RowView({ view, operator, onPush, onJump, targetForEvent }: Props & { view: Extract<MapView, { kind: 'row' }> }) {
  const layer = eventLayer(view.eventId, operator);
  const drawing = useMemo(() => layerDrawing(view.eventId, operator), [view.eventId, operator]);
  const yr = eventYear(view.eventId);
  const threads = threadsForEvent(view.eventId);
  const records = [...new Set((layer?.links ?? []).map((l) => topLevelPlace(l.place_id)))].filter(placeHasRecord);
  const win = entryRow(view.entryId)?.window ?? eventWindow(view.eventId);
  const placeIds = drawing.places.map((p) => p.id);
  const closest = yr.start === null ? [] : closestPeriodMaps(yr.start, win, placeIds, operator, 3);
  const series = yr.start === null ? [] : periodMapSeries(placeIds, operator, { year: yr.start, exclude: closest.map((m) => m.id) });
  return (
    <>
      <div className={styles.titleBlock}>
        <span className={styles.kind}>Map · row</span>
        <h2 className={styles.h2}>{eventTitle(view.eventId)}</h2>
        <span className={styles.fine}>{yr.display}. The row stays highlighted; Close returns you to it.</span>
      </div>
      <div className={styles.mapSticky}>
        <MapCanvas points={drawing.points} lines={drawing.lines} label={`Map for ${eventTitle(view.eventId)}`} />
        <Legend />
      </div>
      <section className={styles.sec}>
        <h3>In the row&rsquo;s own words</h3>
        <ul className={styles.quotes}>
          {(layer?.links ?? []).map((l, i) => <Quote key={i} l={l} onJump={onJump} targetForEvent={targetForEvent} />)}
        </ul>
        {(layer?.flows ?? []).map((f) => f.note && <p key={f.id} className={styles.fine}>{f.kind}: {f.note}</p>)}
      </section>
      {(threads.length > 0 || records.length > 0) && (
        <section className={styles.sec}>
          <h3>Go further</h3>
          <div className={styles.go}>
            {threads.map((t) => (
              <div key={t.token} className={styles.follow}>
                <button type="button" className={styles.goBtn}
                  onClick={() => onPush({ kind: 'thread', token: t.token, index: t.index })}>
                  Follow {threadTitle(t.token)}, stop {t.index + 1} of {t.total} →
                </button>
                <ThreadSupport stop={t.stop} />
              </div>
            ))}
            {records.map((p) => (
              <button key={p} type="button" className={styles.goBtn} onClick={() => onPush({ kind: 'place', placeId: p })}>
                Everything {place(p)?.kind === 'region' || place(p)?.kind === 'colony' ? 'in' : 'at'} {place(p)?.name} →
              </button>
            ))}
          </div>
        </section>
      )}
      <ClosestMaps year={yr.start} windowId={win} placeIds={placeIds} operator={operator} />
      <MapSeries key={view.eventId} maps={series} year={yr.start} heading="Drawn over time"
        note="Earlier and later maps of these places, each as its maker drew it. Set against this row's date, they show the lines being drawn and redrawn." />
    </>
  );
}

/* Why this row is on the thread, in its own words (thread_support.json), or a plain statement
 * that the membership is the corpus's reading. Author ruling, Thread 35: label, do not hide. */
function ThreadSupport({ stop }: { stop?: ThreadStop }) {
  if (!stop || stop.support === undefined) return null;
  if (!stop.support) return <p className={styles.support}>The corpus&rsquo;s reading; not yet stated in this row.</p>;
  return (
    <p className={styles.support}>
      {stop.support === 'stated' ? 'In the row\u2019s own words: ' : 'The row says: '}&ldquo;{stop.quote}&rdquo;
      {stop.support === 'implied' && stop.note ? <span className={styles.why}> {stop.note}</span> : null}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Thread view
// ---------------------------------------------------------------------------
function ThreadView({ view, operator, onReplace, onPush, onJump, targetForEvent }: Props & { view: Extract<MapView, { kind: 'thread' }> }) {
  const stops = threadStops(view.token);
  const stop = stops[view.index];
  const info = threadInfo(view.token);
  const go = (i: number) => {
    onReplace({ kind: 'thread', token: view.token, index: i });
    const t = targetForEvent(stops[i].event_id);
    if (t) onJump(t);
  };
  const drawing = useMemo(() => {
    // One point per place across the whole thread. A place carries the numbers
    // of every stop anchored there, and is drawn at full strength if the
    // current stop touches it.
    const byPlace = new Map<string, CanvasPoint>();
    const lines: CanvasLine[] = [];
    stops.forEach((s, i) => {
      if (!s.hasPlaces) return;
      const cur = i === view.index;
      const d = layerDrawing(s.event_id, operator, !cur);
      d.lines.forEach((l) => lines.push({ ...l, id: `${i}-${l.id}` }));
      d.points.forEach((p, j) => {
        const have = byPlace.get(p.place.id) ?? { ...p, numbers: [], dim: true };
        if (j === 0) have.numbers!.push(i + 1);
        if (cur) { have.dim = false; have.color = p.color; }
        byPlace.set(p.place.id, have);
      });
    });
    const points = [...byPlace.values()].map((p) => ({ ...p, current: view.index + 1 }));
    return { points, lines };
  }, [stops, view.index, operator]);
  const fitTo = stop?.hasPlaces ? eventLayer(stop.event_id, operator)?.places : undefined;
  const stopRecords = stop?.hasPlaces
    ? [...new Set((eventLayer(stop.event_id, operator)?.links ?? []).map((l) => topLevelPlace(l.place_id)))].filter(placeHasRecord)
    : [];
  if (!stop) return <p className={styles.fine}>This thread has no stops.</p>;
  return (
    <>
      <div className={styles.titleBlock}>
        <span className={styles.kind}>Thread · {threadTitle(view.token)} · stop {view.index + 1} of {stops.length}</span>
        {info?.description && (
          <p className={styles.threadAbout}>
            {info.description}
            {info.from && info.to && <span className={styles.threadSpan}> {info.from} → {info.to} · {info.stops} stops</span>}
            {operator && <span className={styles.threadSpan}> · {view.token}{info.status ? ` · ${info.status}` : ''}</span>}
          </p>
        )}
        <h2 className={styles.h2}>{stop.title ?? eventTitle(stop.event_id)}</h2>
        <span className={styles.fine}>W{stop.window} · {stop.year_label}. The window behind moves to each stop. Numbers mark order, not a route.</span>
        <ThreadSupport stop={stop} />
        <div className={styles.go}>
          <button type="button" className={styles.btn} disabled={view.index === 0} onClick={() => go(view.index - 1)}>← Prev stop</button>
          <button type="button" className={styles.btn} disabled={view.index === stops.length - 1} onClick={() => go(view.index + 1)}>Next stop →</button>
          {stop.hasPlaces && (
            <button type="button" className={styles.btn} onClick={() => onPush({ kind: 'row', eventId: stop.event_id, entryId: stop.entry_id })}>This row&rsquo;s map</button>
          )}
        </div>
      </div>
      <div className={styles.mapSticky}>
        <MapCanvas points={drawing.points} lines={drawing.lines} fitTo={fitTo && fitTo.length ? fitTo : undefined}
          label={`Map for ${threadTitle(view.token)}, stop ${view.index + 1}`} />
        <Legend />
      </div>
      {stop.hasPlaces && (
        <ClosestMaps year={eventYear(stop.event_id).start} windowId={stop.window}
          placeIds={(fitTo ?? []).map((p) => p.id)} operator={operator} />
      )}
      {stopRecords.length > 0 && (
        <section className={styles.sec}>
          <h3>Drawn over time</h3>
          <div className={styles.go}>
            {stopRecords.map((p) => (
              <button key={p} type="button" className={styles.goBtn} onClick={() => onPush({ kind: 'place', placeId: p })}>
                How {place(p)?.name} was drawn over time →
              </button>
            ))}
          </div>
        </section>
      )}
      {!stop.hasPlaces && (
        <section className={styles.sec}>
          <h3>No map at this stop</h3>
          <p className={styles.fine}>{stop.noPlaceReason ? `The row: ${stop.noPlaceReason}.` : 'No place is recorded for this row yet.'} It stays in the thread.</p>
        </section>
      )}
      <section className={styles.sec}>
        <h3>All {stops.length} stops</h3>
        <ol className={styles.stops}>
          {stops.map((s, i) => (
            <li key={s.event_id}>
              <button type="button" className={`${styles.stopBtn} ${s.hasPlaces ? '' : styles.stopOff} ${i === view.index ? styles.stopCur : ''}`}
                aria-current={i === view.index ? 'step' : undefined} onClick={() => go(i)}>
                <span className={styles.stopYr}>{s.year_label}</span>
                <span className={styles.stopW}>W{s.window}</span>
                <span>
                  {s.title ?? eventTitle(s.event_id)}
                  {s.support === null && <em className={styles.why}> · the corpus&rsquo;s reading</em>}
                  {!s.hasPlaces && s.noPlaceReason ? <em className={styles.why}> · {s.noPlaceReason}</em> : null}
                  {i === view.index && <span className={styles.nowTag}>current</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Place view
// ---------------------------------------------------------------------------
function PlaceView({ view, operator, onPush, onJump, targetForEvent }: Props & { view: Extract<MapView, { kind: 'place' }> }) {
  const rec = placeRecord(view.placeId, operator);
  const drawing = useMemo(() => {
    const points: CanvasPoint[] = [];
    const lines: CanvasLine[] = [];
    if (!rec) return { points, lines, fit: [] as Place[] };
    points.push({ place: rec.place, color: 'var(--bright)' });
    rec.parts.forEach((p) => points.push({ place: p, color: 'var(--bright)', hollow: true }));
    // A mention is drawn from where the mentioning row happened, dotted: a reference, not a movement.
    rec.mentions.forEach((m, i) => {
      const origin = eventLayer(m.event_id ?? '', operator)?.links.find((l) => l.entry_id === m.entry_id && l.role !== 'mentioned' && l.place_id !== m.place_id);
      const from = origin ? place(origin.place_id) : undefined;
      const to = place(m.place_id);
      if (from && to) {
        if (!points.some((p) => p.place.id === from.id)) points.push({ place: from, color: 'var(--dim)', hollow: true });
        lines.push({ id: `m${i}`, from, to, kind: 'mentioned', color: 'var(--dim)', title: `${m.entry_id}: "${m.quote}"` });
      }
    });
    return { points, lines, fit: [rec.place, ...rec.parts] };
  }, [rec, operator]);
  if (!rec) return <p className={styles.fine}>No record for this place.</p>;
  const group = (links: PlaceLink[]) => {
    const byEvent = new Map<string, PlaceLink>();
    for (const l of links) if (l.event_id && !byEvent.has(l.event_id)) byEvent.set(l.event_id, l);
    return [...byEvent.values()].sort((a, b) => (a.window ?? 0) - (b.window ?? 0) || (eventYear(a.event_id!).start ?? 0) - (eventYear(b.event_id!).start ?? 0));
  };
  const Item = ({ l }: { l: PlaceLink }) => (
    <li>
      <button type="button" className={styles.stopBtn}
        onClick={() => { const t = targetForEvent(l.event_id!); if (t) onJump(t); if (eventLayer(l.event_id!, operator)) onPush({ kind: 'row', eventId: l.event_id!, entryId: l.entry_id }); }}>
        <span className={styles.stopYr}>{eventYear(l.event_id!).display}</span>
        <span className={styles.stopW}>W{l.window}</span>
        <span>{eventTitle(l.event_id!)} <q className={styles.q}>{l.quote}</q></span>
      </button>
    </li>
  );
  return (
    <>
      <div className={styles.titleBlock}>
        <span className={styles.kind}>Place</span>
        <h2 className={styles.h2}>{rec.place.name}</h2>
        <span className={styles.fine}>Every row that names this place, across windows. Choosing one moves the window there.</span>
      </div>
      <div className={styles.mapSticky}>
        <MapCanvas points={drawing.points} lines={drawing.lines} fitTo={drawing.fit} label={`Map of ${rec.place.name}`} />
        <Legend />
      </div>
      {rec.place.names.length > 0 && (
        <section className={styles.sec}>
          <h3>Names by period</h3>
          <dl className={styles.names}>
            {rec.place.names.map((n) => (
              <div key={n.name}><dt>{n.name}</dt><dd>{n.use}{n.note ? ` ${n.note}` : ''}</dd></div>
            ))}
          </dl>
        </section>
      )}
      <section className={styles.sec}>
        <h3>At this place · {group(rec.at).length}</h3>
        <ol className={styles.stops}>{group(rec.at).map((l) => <Item key={l.event_id} l={l} />)}</ol>
      </section>
      {rec.mentions.length > 0 && (
        <section className={styles.sec}>
          <h3>Mentions this place · {group(rec.mentions).length}</h3>
          <ol className={styles.stops}>{group(rec.mentions).map((l) => <Item key={l.event_id} l={l} />)}</ol>
        </section>
      )}
      {operator && rec.gaps.length > 0 && (
        <section className={styles.sec}>
          <h3 className={styles.flag}>Gaps · operator view</h3>
          <ul className={styles.quotes}>{rec.gaps.map((g, i) => <li key={i} className={styles.fine}>{g.entry_id ? `${g.entry_id}: ` : ''}{g.note}</li>)}</ul>
        </section>
      )}
      <MapSeries key={rec.place.id} maps={periodMapSeries([rec.place.id], operator)} year={null} heading="How this place was drawn over time" initial={8}
        note="Every catalogued map of this place, oldest first, each as its maker drew it. Read beside the names above: the lines and the names were redrawn together." />
    </>
  );
}
