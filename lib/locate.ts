/**
 * locate.ts — deterministic temporal lookup over the corpus.
 *
 * No model. No retrieval. No network. Same input, same output, always.
 *
 * Answers: "something happened around 1120 — where does that land, and what
 * was running around it across the lanes?"
 */

import corpus from './corpus.generated.json';
import { LANES, laneLabel } from './windows';

export type NormalizedYear = {
  start: number | null;
  end: number | null;
  approximate: boolean;
  era: 'ce' | 'deep';
  display: string;
};

export type CorpusEntry = {
  id: string;
  eventId: string | null;
  window: number;
  lane: string;
  tier: 'A' | 'B' | 'C' | 'D' | 'E';
  title: string;
  milestone: boolean;
  hasDossier: boolean;
  /** The entry states its claim in the title and carries no body, because W1,
   *  W2 and W5 put the detail in the dossier instead. 210 of the 690. Locate
   *  never reads it; the record layer reports what share of citations reach
   *  them, which is how the dossier-line change gets measured. */
  titleOnly: boolean;
  /** Short hash of title + body as of the last prepare-corpus run. Locate never
   *  reads it; the record layer pins corrections against it, so a fix written
   *  in August is not silently applied to text that moved in October. */
  contentHash: string;
  year: NormalizedYear;
};

export type LocateQuery = {
  year: number;
  windowIds?: number[];
  laneKeys?: string[];
  spanYears?: number;
  neighbors?: number;
};

export type LocateHit = CorpusEntry & {
  /** Signed distance from the queried year. Negative = before. */
  offsetYears: number;
  /** True when the hit is inside spanYears rather than pulled in as a neighbour. */
  inSpan: boolean;
};

export type LocateResult = {
  query: Required<Omit<LocateQuery, 'windowIds' | 'laneKeys'>> &
    Pick<LocateQuery, 'windowIds' | 'laneKeys'>;
  total: number;
  windows: {
    windowId: number;
    name: string;
    yearRange: string;
    hits: LocateHit[];
  }[];
  laneSpread: { lane: string; label: string; count: number }[];
  span: { earliest: number; latest: number } | null;
};

const ENTRIES = corpus.entries as CorpusEntry[];
const WINDOW_META = corpus.windows as {
  id: number;
  name: string;
  yearRange: string;
}[];

const LANE_ORDER = new Map(LANES.map((l, i) => [l.key, i]));

/** "Immediately before, during, and immediately after" — not half a century.
 *  At 25 a dense window like W5 (~2.5 entries/year) returned 102 rows. */
export const DEFAULT_SPAN = 10;
export const DEFAULT_NEIGHBORS = 8;

/** Entries whose normalized year sits within a range, inclusive. */
function distance(entry: CorpusEntry, year: number): number {
  const { start, end } = entry.year;
  if (start === null) return Number.POSITIVE_INFINITY;
  // A range entry ("711 to 1248") is at distance 0 anywhere inside it.
  if (end !== null && year >= start && year <= end) return 0;
  if (end !== null) return year < start ? start - year : end - year;
  return start - year;
}

export function locate(query: LocateQuery): LocateResult {
  const span = query.spanYears ?? DEFAULT_SPAN;
  const neighbors = query.neighbors ?? DEFAULT_NEIGHBORS;
  const { year, windowIds, laneKeys } = query;

  const candidates = ENTRIES.filter(
    (e) =>
      e.year.start !== null &&
      (!windowIds?.length || windowIds.includes(e.window)) &&
      (!laneKeys?.length || laneKeys.includes(e.lane))
  );

  // Union of two sets, deduped BY ENTRY ID.
  //
  // Deduping by object or tuple identity instead silently double-counts: an
  // early prototype reported 29 hits for 1120 where the true answer is 16.
  const picked = new Map<string, { entry: CorpusEntry; inSpan: boolean }>();

  for (const e of candidates) {
    if (Math.abs(distance(e, year)) <= span) picked.set(e.id, { entry: e, inSpan: true });
  }

  const before = candidates
    .filter((e) => distance(e, year) < 0)
    .sort((a, b) => distance(b, year) - distance(a, year))
    .slice(0, neighbors);
  const after = candidates
    .filter((e) => distance(e, year) >= 0)
    .sort((a, b) => distance(a, year) - distance(b, year))
    .slice(0, neighbors);

  for (const e of [...before, ...after]) {
    if (!picked.has(e.id)) picked.set(e.id, { entry: e, inSpan: false });
  }

  const hits: LocateHit[] = [...picked.values()]
    .map(({ entry, inSpan }) => ({ ...entry, offsetYears: distance(entry, year), inSpan }))
    .sort(
      (a, b) =>
        (a.year.start ?? 0) - (b.year.start ?? 0) ||
        a.window - b.window ||
        (LANE_ORDER.get(a.lane) ?? 99) - (LANE_ORDER.get(b.lane) ?? 99)
    );

  const byWindow = new Map<number, LocateHit[]>();
  for (const h of hits) {
    if (!byWindow.has(h.window)) byWindow.set(h.window, []);
    byWindow.get(h.window)!.push(h);
  }

  const laneCounts = new Map<string, number>();
  for (const h of hits) laneCounts.set(h.lane, (laneCounts.get(h.lane) ?? 0) + 1);

  const starts = hits.map((h) => h.year.start!).filter((n) => Number.isFinite(n));

  return {
    query: { year, spanYears: span, neighbors, windowIds, laneKeys },
    total: hits.length,
    windows: [...byWindow.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([windowId, ws]) => {
        const meta = WINDOW_META.find((w) => w.id === windowId);
        return {
          windowId,
          name: meta?.name ?? `Window ${windowId}`,
          yearRange: meta?.yearRange ?? '',
          hits: ws,
        };
      }),
    laneSpread: [...laneCounts.entries()]
      .sort(
        (a, b) => b[1] - a[1] || (LANE_ORDER.get(a[0]) ?? 99) - (LANE_ORDER.get(b[0]) ?? 99)
      )
      .map(([lane, count]) => ({ lane, label: laneLabel(lane), count })),
    span: starts.length ? { earliest: Math.min(...starts), latest: Math.max(...starts) } : null,
  };
}

/** Parse a free-text year box: "1120", "~1120", "1120 CE", "300 Ma". */
export function parseYearInput(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  let m = s.match(/^~?\s*([\d.]+)\s*Ma\b/i);
  if (m) return -Math.round(parseFloat(m[1]) * 1_000_000);
  m = s.match(/^~?\s*([\d.]+)\s*K\s*BP\b/i);
  if (m) return Math.round(1950 - parseFloat(m[1]) * 1000);
  m = s.match(/^~?\s*(-?\d{1,4})\b/);
  if (m) return Number(m[1]);
  return null;
}
