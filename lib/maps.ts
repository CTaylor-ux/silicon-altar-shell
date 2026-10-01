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

/** A catalogue region id; the list and the boxes come from historical_maps.json. */
export type Region = string;

export interface PeriodMap {
  id: string; title: string; maker: string | null; date: number; date_note: string;
  holder: string; shelfmark: string | null; catalog_url: string | null; iiif_manifest: string | null;
  covers: Region[]; rights: string | null; display: string; status: 'verified' | 'candidate';
  notes: string; memberVisible: boolean; memberLinkable: boolean;
  /** The attribution the holder's terms require, shown with the image; absent where none is required. */
  credit?: string;
  /** Set only where the holder itself says the map was made by an Indigenous artist; basis quotes it. */
  indigenous_made?: boolean; indigenous_made_basis?: string;
  /** 'local' (a town, an estate) ranks after 'regional'; absent on older records, where the title decides. */
  scale?: 'regional' | 'local';
  /** For a later copy: the year of the geography it reproduces (al-Idrisi's 1154 map in a 1553 copy). */
  depicts_date?: number;
  /** Rows whose own words name this map (Thread 36): shown on those rows whatever its date. */
  named_in?: { entry_id: string; quote: string }[];
  /** The map's own sheet, from the holder: a IIIF image service, or (holders with no
   *  IIIF) a full-size image at its public address. null until one is recorded. */
  image?: {
    iiif_image?: string; static_url?: string; sheet: number; sheets: number; sheet_label: string | null;
    width: number | null; height: number | null; why_this_sheet: string | null; checked: string;
  } | null;
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
  /** The stop's own row (the supporting one where there is one); in W5 an event is a whole year. */
  title?: string;
  /** thread_support.json: the row's own words for this membership, or null where it is the
   *  corpus's reading, not yet stated in the row. Optional so an older build still reads. */
  support?: 'stated' | 'implied' | null; quote?: string | null; note?: string | null;
}
interface MapData {
  available: boolean; appUse: { commercial: boolean } | null;
  regionBoxes?: Record<string, [number, number, number, number]> | null;
  maps: PeriodMap[]; places: Place[]; links: PlaceLink[]; flows: Flow[];
  gaps: { entry_id: string | null; place_id: string; note: string }[];
  noPlace: Record<string, string>;
  byEvent: Record<string, { window: number; links: number[]; flows: number[] }>;
  byPlace: Record<string, number[]>;
  threads: Record<string, ThreadStop[]>;
  threadInfo?: Record<string, ThreadInfo>;
  /** By event: the maps a row of the event names, with the row and its words. Optional, so an older build still reads. */
  namedMaps?: Record<string, { map: string; entry_id: string; quote: string }[]>;
}
export interface ThreadInfo {
  title: string | null; description: string | null; status: 'draft' | 'approved' | null;
  from: string | null; to: string | null; stops: number;
}

const data = raw as unknown as MapData;
export const mapLayerAvailable = Boolean(data.available);
const placeById = new Map((data.places ?? []).map((p) => [p.id, p]));
const mapById = new Map((data.maps ?? []).map((m) => [m.id, m]));

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
  const at = links.filter((l) => l.role !== 'mentioned' && l.role !== 'intended-destination');
  // A row that happens here is listed once, under "at", even if another of its
  // entries also mentions the place.
  const atEvents = new Set(at.map((l) => l.event_id));
  return {
    place: p,
    parts: [...inside].filter((id) => id !== placeId).map((id) => placeById.get(id)!),
    at,
    mentions: links.filter((l) => (l.role === 'mentioned' || l.role === 'intended-destination') && !atEvents.has(l.event_id)),
    gaps: operator ? data.gaps.filter((g) => inside.has(g.place_id)) : [],
  };
}

/** A thread's reader-facing title (threads.json), or its code where none is recorded. */
export function threadTitle(token: string): string {
  return data.threadInfo?.[token]?.title ?? token;
}
export function threadInfo(token: string): ThreadInfo | null {
  return data.threadInfo?.[token] ?? null;
}

export function threadStops(token: string): ThreadStop[] {
  return data.threads?.[token] ?? [];
}

/* Coarse boxes that tie a place to the catalogue's regions, [south, north, west, east].
 * They decide which period maps are candidates for a row; they are not boundaries and
 * are never drawn. Read from historical_maps.json (region_boxes); the copy below is the
 * original nine, used only if an older corpus has none. */
const FALLBACK_BOXES: Record<string, [number, number, number, number]> = {
  caribbean: [9, 27, -90, -59], 'gulf-newspain': [15, 31, -98, -80], 'na-coast': [25, 50, -82, -60],
  'west-africa': [-20, 20, -20, 16], 'iberia-islands': [13, 44, -32, 0], brazil: [-35, 5, -55, -34],
  'low-countries': [50.5, 54, 2.5, 7.5], england: [49.8, 56, -6, 2], atlantic: [-40, 65, -100, 20],
};
const BOXES = Object.entries(data.regionBoxes ?? FALLBACK_BOXES);
export function regionsOf(p: Place): Region[] {
  return BOXES.filter(([, [s, n, w, e]]) => p.lat >= s && p.lat <= n && p.lon >= w && p.lon <= e).map(([k]) => k);
}

/* A city, fort or harbour plan shows one place, not a region, so it ranks after
 * regional and basin-wide maps. The catalogue's scale field decides where a record
 * has one (batch 3 onward); older records are judged from the catalogued title. */
const LOCAL = /\b(plan|planta|plano|plattegrond|perspectiva|afbeelding|castrum|kasteel|fort|civitas|stadt|ciudad|town|harbour|rade|baai|ba[ií]a|barra|ichnography)\b|fortifica/i;
export function isLocalPlan(m: PeriodMap): boolean {
  if (m.scale) return m.scale === 'local';
  return LOCAL.test(m.title);
}

/* How close in time a map must be to count as "closest to this moment". Tighter as
 * the windows get denser: a map 40 years off can show a different country after
 * 1650. A map outside the cutoff is not hidden; it goes into the "drawn over time"
 * series with its distance stated. Author ruling, Thread 35 (2026-09-29): the
 * earlier map is still context, and the contrast shows the lines being redrawn.
 * Starting values, to be tuned once W3 to W6 are catalogued. */
/* W0 is 100 (author, 2026-09-30): medieval maps are rare, and a map within a century is as
 * close as the record allows for the 1100s to 1400s; every card states its distance. */
export const CLOSE_YEARS: Record<number, number> = { 0: 100, 1: 25, 2: 15, 3: 10, 4: 5, 5: 5, 6: 5 };
const closeYears = (windowId: number | null) => CLOSE_YEARS[windowId ?? 1] ?? 5;
/** The year a map shows: for a later copy, the year of the work it copies. Closeness and
 *  order are measured by it, so a 1553 copy of a 1154 map sits with the 12th century. */
export const shownYear = (m: PeriodMap): number => m.depicts_date ?? m.date;

/* A plan of one city, tagged with city regions only (Thread 35's city regions), can match no
 * place but that city. Thread 36 (author, 2026-10-01): where the row is AT that city, the plan
 * stands level with a regional map; where the row only mentions the city, it ranks after them
 * as before. Measured first: without this, 43 catalogued plans were shown by no row and no place. */
const ownPlan = (m: PeriodMap) => m.covers.length > 0 && m.covers.every((c) => c.startsWith('city-'));

/** The places a row is at or moves between: its links other than mentions, and its flows' ends. */
export function atPlaceIds(eventId: string, operator = false): string[] {
  const layer = eventLayer(eventId, operator);
  if (!layer) return [];
  return [...new Set([
    ...layer.links.filter((l) => l.role !== 'mentioned' && l.role !== 'intended-destination').map((l) => l.place_id),
    ...layer.flows.flatMap((f) => [f.from, f.to]),
  ])];
}

function mapsFor(placeIds: string[], operator: boolean) {
  const want = new Set(placeIds.flatMap((id) => (placeById.get(id) ? regionsOf(placeById.get(id)!) : [])));
  if (!want.size) return [];
  return (data.maps ?? [])
    .filter((m) => (operator || m.memberVisible) && m.covers.some((c) => want.has(c)))
    .map((m) => ({ m, local: isLocalPlan(m), regional: m.covers.some((c) => c !== 'atlantic' && want.has(c)) }));
}

/** Maps within the window's cutoff of the year, nearest in time first. A regional
 *  map beats a basin-wide one only when they are about equally close (5 years);
 *  a city or fort plan ranks after both at the same distance, unless it is a plan of
 *  a city the row is at (atIds), which stands level with a regional map. */
export function closestPeriodMaps(year: number, windowId: number | null, placeIds: string[], operator = false, limit = 3, atIds: string[] = []): PeriodMap[] {
  const cut = closeYears(windowId);
  const atRegions = new Set(atIds.flatMap((id) => (placeById.get(id) ? regionsOf(placeById.get(id)!) : [])));
  const late = (x: { m: PeriodMap; local: boolean }) => (x.local && !(ownPlan(x.m) && x.m.covers.some((c) => atRegions.has(c))) ? 8 : 0);
  return mapsFor(placeIds, operator)
    .map((x) => ({ ...x, d: Math.abs(shownYear(x.m) - year) }))
    .filter((x) => x.d <= cut)
    .sort((a, b) => (a.d + (a.regional ? 0 : 5) + late(a)) - (b.d + (b.regional ? 0 : 5) + late(b)) || shownYear(a.m) - shownYear(b.m))
    .slice(0, limit)
    .map((x) => x.m);
}

/** How the place was drawn over time, oldest first. The long view uses regional
 *  maps of the place (not city plans of somewhere else, not the whole basin unless
 *  nothing regional exists). With a year (the row page), a short series around it:
 *  the earliest and latest regional maps, and the nearest maps before and after the
 *  year of any scope, so a basin-wide map a decade off is not dropped for one a
 *  century off. Maps already shown as closest are left out. Without a year (the
 *  place page), the whole regional series, and with it the plans of that very city
 *  (Thread 36): on a place's own page a plan of the place is not 'somewhere else'. */
export function periodMapSeries(placeIds: string[], operator = false, around?: { year: number; exclude: string[] }): PeriodMap[] {
  const byDate = (a: PeriodMap, b: PeriodMap) => shownYear(a) - shownYear(b) || a.id.localeCompare(b.id);
  const all = mapsFor(placeIds, operator).filter((x) => !x.local || (!around && ownPlan(x.m)));
  const regional = all.filter((x) => x.regional);
  const pool = (regional.length ? regional : all).map((x) => x.m).sort(byDate);
  if (!around) return pool;
  const keep = (m: PeriodMap) => !around.exclude.includes(m.id);
  const longView = pool.filter(keep);
  const anyScope = all.map((x) => x.m).filter(keep).sort(byDate);
  const before = anyScope.filter((m) => shownYear(m) < around.year);
  const after = anyScope.filter((m) => shownYear(m) >= around.year);
  const pick = [longView[0], before[before.length - 1], after[0], longView[longView.length - 1]].filter(Boolean) as PeriodMap[];
  return [...new Map(pick.map((m) => [m.id, m])).values()].sort(byDate);
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

/** The maps a row of this event names in its own words (named_in), each with that row and
 *  its sentence. Shown on the row whatever the map's date: the row is about the map. */
export function namedMapsForEvent(eventId: string, operator = false): { m: PeriodMap; says: { entry_id: string; quote: string }[] }[] {
  const byMap = new Map<string, { entry_id: string; quote: string }[]>();
  for (const n of data.namedMaps?.[eventId] ?? []) byMap.set(n.map, [...(byMap.get(n.map) ?? []), { entry_id: n.entry_id, quote: n.quote }]);
  return [...byMap].map(([id, says]) => ({ m: mapById.get(id)!, says }))
    .filter((x) => x.m && (operator || x.m.memberVisible))
    .sort((a, b) => shownYear(a.m) - shownYear(b.m) || a.m.id.localeCompare(b.m.id));
}
/** Why an event has no place on the map, in the corpus's words (places.json no_place). */
export function noPlaceReason(eventId: string): string | null {
  return data.noPlace?.[eventId] ?? null;
}

/** One entry id per row that has map data a viewer may see, for the MAP marks: rows with
 *  places or movements, and rows that name a catalogued map. */
export function mapEntryIdsForWindow(windowId: number, operator = false): string[] {
  const out: string[] = [];
  const events = new Set([...Object.keys(data.byEvent ?? {}), ...Object.keys(data.namedMaps ?? {})]);
  for (const ev of events) {
    const r = firstRowOfEvent.get(ev);
    if (!r || r.window !== windowId) continue;
    const layer = eventLayer(ev, operator);
    if (!(layer && (layer.links.length || layer.flows.length)) && !namedMapsForEvent(ev, operator).length) continue;
    out.push(r.id);
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
export function eventWindow(eventId: string): number | null {
  return firstRowOfEvent.get(eventId)?.window ?? null;
}
export function eventYear(eventId: string): { start: number | null; display: string } {
  return firstRowOfEvent.get(eventId)?.year ?? { start: null, display: '' };
}
export function entryRow(entryId: string) {
  return rowById.get(entryId) ?? null;
}

/** Threads this event belongs to, with its position in each. */
export function threadsForEvent(eventId: string): { token: string; index: number; total: number; stop: ThreadStop }[] {
  return Object.entries(data.threads ?? {})
    .map(([token, stops]) => {
      const index = stops.findIndex((s) => s.event_id === eventId);
      return { token, index, total: stops.length, stop: stops[index] };
    })
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
/** A map's image is shown only where its rights allow display (memberVisible);
 *  a link-only map keeps its link even in the operator view. */
export function hasShownImage(m: PeriodMap): boolean {
  return Boolean(m.image && m.memberVisible);
}
/** The whole sheet from the holder: through the IIIF Image API fitted inside px by
 *  px, or the holder's own full-size image where it has no IIIF (the browser scales it). */
export function imageUrl(m: PeriodMap, px: number): string {
  const img = m.image!;
  return img.iiif_image ? `${img.iiif_image}/full/!${px},${px}/0/default.jpg` : img.static_url!;
}
export const allMaps = (): PeriodMap[] => data.maps ?? [];
