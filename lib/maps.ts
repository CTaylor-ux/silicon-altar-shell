/**
 * The map layer, as the map panel reads it.
 *
 * Built by scripts/prepare-maps.mjs from the audit repo's historical_maps.json,
 * places.json and flows.json (Thread 35). Visibility is decided there, once:
 * `memberVisible` is what a member may see; the operator view sees everything and
 * reads the flags, gaps and candidates. Helpers here only select and order.
 */
import raw from './maps.generated.json';
import corpus from './corpus.generated.json';
import type { Target } from './retrieval';

export type Region =
  | 'atlantic' | 'iberia-islands' | 'west-africa' | 'caribbean' | 'gulf-newspain'
  | 'na-coast' | 'brazil' | 'low-countries' | 'england';

export interface PeriodMap {
  id: string; title: string; maker: string | null; date: number; date_note: string;
  holder: string; shelfmark: string | null; catalog_url: string | null; iiif_manifest: string | null;
  covers: Region[]; rights: string | null; display: string; status: 'verified' | 'candidate';
  notes: string; memberVisible: boolean; memberLinkable: boolean;
}
export interface Place {
  id: string; name: string; kind: string; lat: number; lon: number;
  precision: 'point' | 'approximate' | 'region-label'; within: string | null;
  names: { name: string; use: string; attested_in: unknown; note?: string }[]; needs: string[]; note: string;
}
export interface PlaceLink {
  entry_id: string; event_id: string | null; window: number | null; place_id: string;
  role: string; quote: string; flags: string[]; memberVisible: boolean;
}
export interface Flow {
  id: string; event_id: string; entry_ids: string[]; from: string; to: string; intended_to: string | null;
  kind: 'documented' | 'corridor' | 'schematic' | 'intended'; path: 'direct' | 'to-region' | 'track';
  direction: boolean; quotes: { entry: string; quote: string }[]; note: string; window: number | null;
  memberVisible: boolean;
}
export interface ThreadStop {
  event_id: string; window: number; year_label: string; entry_id: string;
  hasPlaces: boolean; noPlaceReason: string | null;
}
interface MapData {
  available: boolean; appUse: { commercial: boolean } | null;
  maps: PeriodMap[]; places: Place[]; links: PlaceLink[]; flows: Flow[];
  gaps: { entry_id: string | null; place_id: string; note: string }[];
  noPlace: Record<string, string>;
  byEvent: Record<string, { window: number; links: number[]; flows: number[] }>;
  byPlace: Record<string, number[]>;
  threads: Record<string, ThreadStop[]>;
}

const data = raw as unknown as MapData;
export const mapLayerAvailable = Boolean(data.available);
const placeById = new Map((data.places ?? []).map((p) => [p.id, p]));

export function place(id: string): Place | undefined {
  return placeById.get(id);
}

/** Everything the row view draws for one event. */
export function eventLayer(eventId: string, operator = false) {
  const idx = data.byEvent?.[eventId];
  if (!idx) return null;
  const links = idx.links.map((i) => data.links[i]).filter((l) => operator || l.memberVisible);
  const flows = idx.flows.map((i) => data.flows[i]).filter((f) => operator || f.memberVisible);
  const ids = new Set<string>([...links.map((l) => l.place_id), ...flows.flatMap((f) => [f.from, f.to, f.intended_to ?? ''])]);
  ids.delete('');
  return { links, flows, places: [...ids].map((id) => placeById.get(id)!).filter(Boolean) };
}

/** Everything the place view lists, split the way the reader needs it. */
export function placeRecord(placeId: string, operator = false) {
  const p = placeById.get(placeId);
  if (!p) return null;
  const inside = new Set([placeId, ...(data.places ?? []).filter((x) => x.within === placeId).map((x) => x.id)]);
  const links = [...inside].flatMap((id) => (data.byPlace?.[id] ?? []).map((i) => data.links[i]))
    .filter((l) => operator || l.memberVisible);
  return {
    place: p,
    parts: [...inside].filter((id) => id !== placeId).map((id) => placeById.get(id)!),
    at: links.filter((l) => l.role !== 'mentioned' && l.role !== 'intended-destination'),
    mentions: links.filter((l) => l.role === 'mentioned' || l.role === 'intended-destination'),
    gaps: operator ? data.gaps.filter((g) => inside.has(g.place_id)) : [],
  };
}

export function threadStops(token: string): ThreadStop[] {
  return data.threads?.[token] ?? [];
}

/* Coarse boxes that tie a place to the catalogue's regions. They decide which period
 * maps are candidates for a row; they are not boundaries and are never drawn. */
const BOXES: [Region, number, number, number, number][] = [
  ['caribbean', 9, 27, -90, -59], ['gulf-newspain', 15, 31, -98, -80], ['na-coast', 25, 50, -82, -60],
  ['west-africa', -20, 20, -20, 16], ['iberia-islands', 13, 44, -32, 0], ['brazil', -35, 5, -55, -34],
  ['low-countries', 50.5, 54, 2.5, 7.5], ['england', 49.8, 56, -6, 2],
];
export function regionsOf(p: Place): Region[] {
  const r = BOXES.filter(([, s, n, w, e]) => p.lat >= s && p.lat <= n && p.lon >= w && p.lon <= e).map(([k]) => k);
  if (p.lon >= -100 && p.lon <= 20 && p.lat >= -40 && p.lat <= 65) r.push('atlantic');
  return r;
}

/* A city, fort or harbour plan shows one place, not a region, so it ranks after
 * regional and basin-wide maps. Judged from the catalogued title until the
 * catalogue carries a scale field of its own. */
const LOCAL = /\b(plan|planta|plano|plattegrond|perspectiva|afbeelding|castrum|kasteel|fort|civitas|stadt|ciudad|town|harbour|rade|baai|ba[ií]a|barra|ichnography)\b|fortifica/i;
export function isLocalPlan(m: PeriodMap): boolean {
  return LOCAL.test(m.title);
}

/** Nearest period maps for a year and a set of places: regional first, then basin-wide, nearest date first. */
export function nearestPeriodMaps(year: number, placeIds: string[], operator = false, limit = 3): PeriodMap[] {
  const want = new Set(placeIds.flatMap((id) => (placeById.get(id) ? regionsOf(placeById.get(id)!) : [])));
  if (!want.size) return [];
  return (data.maps ?? [])
    .filter((m) => (operator || m.memberVisible) && m.covers.some((c) => want.has(c)))
    .map((m) => ({ m, local: isLocalPlan(m), regional: m.covers.some((c) => c !== 'atlantic' && want.has(c)), d: Math.abs(m.date - year) }))
    .sort((a, b) => Number(a.local) - Number(b.local) || Number(b.regional) - Number(a.regional) || a.d - b.d)
    .slice(0, limit)
    .map((x) => x.m);
}

// ---------------------------------------------------------------------------
// Connecting the map layer to the app's rows (Thread 35)
// ---------------------------------------------------------------------------

type CorpusRow = {
  id: string; eventId: string | null; window: number; lane: string; tier: string; title: string;
  year: { start: number | null; display: string };
};
const rows = (corpus as unknown as { entries: CorpusRow[] }).entries;
const rowById = new Map(rows.map((r) => [r.id, r]));
const firstRowOfEvent = new Map<string, CorpusRow>();
for (const r of rows) if (r.eventId && !firstRowOfEvent.has(r.eventId)) firstRowOfEvent.set(r.eventId, r);

export function eventOfEntry(entryId: string): string | null {
  return rowById.get(entryId)?.eventId ?? null;
}

/** One entry id per row that has map data a viewer may see, for the MAP marks. */
export function mapEntryIdsForWindow(windowId: number, operator = false): string[] {
  const out: string[] = [];
  for (const [ev, idx] of Object.entries(data.byEvent ?? {})) {
    if (idx.window !== windowId) continue;
    const layer = eventLayer(ev, operator);
    if (!layer || (!layer.links.length && !layer.flows.length)) continue;
    const r = firstRowOfEvent.get(ev);
    if (r) out.push(r.id);
  }
  return out;
}

/** A jump target for any row, in the shape Locate and Ask already use. */
export function targetForEntry(entryId: string): Target | null {
  const r = rowById.get(entryId);
  if (!r) return null;
  return { entryId: r.id, windowId: r.window, year: r.year.display, lane: r.lane,
           tier: r.tier as Target['tier'], title: r.title };
}
export function targetForEvent(eventId: string): Target | null {
  const r = firstRowOfEvent.get(eventId);
  return r ? targetForEntry(r.id) : null;
}
export function eventTitle(eventId: string): string {
  return firstRowOfEvent.get(eventId)?.title ?? eventId;
}
export function eventYear(eventId: string): { start: number | null; display: string } {
  return firstRowOfEvent.get(eventId)?.year ?? { start: null, display: '' };
}
export function entryRow(entryId: string) {
  return rowById.get(entryId) ?? null;
}

/** Threads this event belongs to, with its position in each. */
export function threadsForEvent(eventId: string): { token: string; index: number; total: number }[] {
  return Object.entries(data.threads ?? {})
    .map(([token, stops]) => ({ token, index: stops.findIndex((s) => s.event_id === eventId), total: stops.length }))
    .filter((t) => t.index >= 0);
}

/** A place has a record worth opening when more than one row names it or its parts. */
export function placeHasRecord(placeId: string): boolean {
  const rec = placeRecord(placeId, true);
  return !!rec && rec.at.length + rec.mentions.length > 1;
}
export function topLevelPlace(placeId: string): string {
  let p = placeById.get(placeId);
  while (p?.within && placeById.get(p.within)) p = placeById.get(p.within);
  return p?.id ?? placeId;
}
export const allMaps = (): PeriodMap[] => data.maps ?? [];
