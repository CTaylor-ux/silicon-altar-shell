/**
 * The map layer, as the map panel reads it.
 *
 * Built by scripts/prepare-maps.mjs from the audit repo's historical_maps.json,
 * places.json and flows.json (Thread 35). Visibility is decided there, once:
 * `memberVisible` is what a member may see; the operator view sees everything and
 * reads the flags, gaps and candidates. Helpers here only select and order.
 */
import raw from './maps.generated.json';

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

/** Nearest period maps for a year and a set of places: regional first, then basin-wide, nearest date first. */
export function nearestPeriodMaps(year: number, placeIds: string[], operator = false, limit = 3): PeriodMap[] {
  const want = new Set(placeIds.flatMap((id) => (placeById.get(id) ? regionsOf(placeById.get(id)!) : [])));
  if (!want.size) return [];
  return (data.maps ?? [])
    .filter((m) => (operator || m.memberVisible) && m.covers.some((c) => want.has(c)))
    .map((m) => ({ m, regional: m.covers.some((c) => c !== 'atlantic' && want.has(c)), d: Math.abs(m.date - year) }))
    .sort((a, b) => Number(b.regional) - Number(a.regional) || a.d - b.d)
    .slice(0, limit)
    .map((x) => x.m);
}
