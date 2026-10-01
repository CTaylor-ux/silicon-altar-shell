#!/usr/bin/env node
/**
 * prepare-maps.mjs
 *
 * Reads the map layer out of the Silicon Altar audit repo and writes
 * lib/maps.generated.json for the map panel:
 *
 *   historical_maps.json   period maps verified at their holders
 *   places.json            places named by rows, each link carrying the row's own wording
 *   flows.json             directed movements named by rows
 *   entries.json           to place every event in its window, and to build thread order
 *   threads.json           reader-facing title and description per thread (optional; codes shown if absent)
 *
 * WHY THIS EXISTS (Thread 35, 2026-09-29)
 * ---------------------------------------
 * The author asked that the map work be positioned to go live in the app. The
 * corpus holds the data; this step carries it into the app on every dev start and
 * build, beside prepare-windows and prepare-corpus, so the panel reads one file.
 *
 * WHAT IT DECIDES, SO THE UI DOES NOT HAVE TO
 * -------------------------------------------
 * `memberVisible` on each map, layer and link. Members see only verified maps whose
 * rights allow display (show, show-no-derivatives, and show-if-noncommercial while
 * historical_maps.json says the app is non-commercial). Candidates, unsourced layers,
 * gaps and flags are kept for the operator view and marked so.
 *
 * FAILS LOUDLY on a link or flow that names an entry the corpus does not have: that
 * is a corpus inconsistency, not something to paper over. If the corpus predates the
 * map layer (no places.json), it writes an empty, clearly marked file instead of
 * failing, so an older corpus still builds.
 *
 * The audit repo is opened read-only. Nothing is ever written back to it.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/* Same rule as prepare-corpus: no default path, because a stale Desktop copy once
 * built silently. See docket/DESKTOP_DETOUR_2026-08-16.md in the audit repo. */
const REPO = process.env.SILICON_ALTAR_REPO || readEnvLocal('SILICON_ALTAR_REPO');
const OUT = path.join(process.cwd(), 'lib', 'maps.generated.json');

function readEnvLocal(key) {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    const m = raw.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

function die(msg) {
  console.error(`\n  prepare-maps FAILED\n  ${msg}\n`);
  process.exit(1);
}

if (!REPO) die('SILICON_ALTAR_REPO is not set, and there is no default. Add it to .env.local.');
if (!fs.existsSync(REPO)) die(`Audit repo not found at: ${REPO}`);

const read = (f) => JSON.parse(fs.readFileSync(path.join(REPO, f), 'utf8'));
const have = (f) => fs.existsSync(path.join(REPO, f));

if (!have('places.json') || !have('flows.json') || !have('historical_maps.json')) {
  fs.writeFileSync(
    OUT,
    JSON.stringify({ available: false, reason: 'corpus has no map layer yet', generatedAt: null }) + '\n'
  );
  console.warn('  prepare-maps: corpus has no map layer (places.json, flows.json, historical_maps.json); wrote an empty file.\n');
  process.exit(0);
}

const H = read('historical_maps.json');
const P = read('places.json');
const F = read('flows.json');
const E = read('entries.json').entries;

const entryById = new Map(E.map((e) => [e.id, e]));
const commercial = Boolean(H.app_use && H.app_use.commercial);
const SHOWABLE = new Set(['show', 'show-no-derivatives', ...(commercial ? [] : ['show-if-noncommercial'])]);

// ---------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------
const maps = H.maps.map((m) => ({
  ...m,
  memberVisible: m.status === 'verified' && SHOWABLE.has(m.display),
  memberLinkable: m.status === 'verified',
}));

// ---------------------------------------------------------------------------
// Places, links, flows: every entry reference must resolve
// ---------------------------------------------------------------------------
const placeIds = new Set(P.places.map((p) => p.id));
const missing = [];
const links = P.links.map((l) => {
  const e = entryById.get(l.entry_id);
  if (!e) missing.push(`link -> ${l.entry_id}`);
  if (!placeIds.has(l.place_id)) missing.push(`link place ${l.place_id}`);
  return {
    ...l,
    event_id: e ? e.event_id : null,
    window: e ? e.window : null,
    memberVisible: l.flags.length === 0 || l.flags.every((f) => f.startsWith('open-finding')),
  };
});
const flows = F.flows.map((f) => {
  for (const id of f.entry_ids) if (!entryById.has(id)) missing.push(`flow ${f.id} -> ${id}`);
  for (const k of ['from', 'to', 'intended_to']) if (f[k] && !placeIds.has(f[k])) missing.push(`flow ${f.id} ${k} ${f[k]}`);
  const e = entryById.get(f.entry_ids[0]);
  return { ...f, window: e ? e.window : null, memberVisible: true };
});
if (missing.length) die(`The map layer names things the corpus does not have:\n    ${missing.join('\n    ')}`);

// ---------------------------------------------------------------------------
// Indexes the panel reads directly
// ---------------------------------------------------------------------------
const byEvent = {};
const touch = (ev, win) => (byEvent[ev] ??= { window: win, links: [], flows: [] });
links.forEach((l, i) => touch(l.event_id, l.window).links.push(i));
flows.forEach((f, i) => touch(f.event_id, f.window).flows.push(i));

/* Maps a row names in its own words (historical_maps.json named_in, Thread 36), by event.
 * Kept apart from byEvent: an event here may have no place at all (the 1934 redlining rows),
 * and byEvent is what says a thread stop has places. */
const namedMaps = {};
for (const m of H.maps) for (const n of m.named_in ?? []) {
  const e = entryById.get(n.entry_id);
  if (!e) die(`Map ${m.id} is named in ${n.entry_id}, which the corpus does not have.`);
  (namedMaps[e.event_id] ??= []).push({ map: m.id, entry_id: n.entry_id, quote: n.quote });
}

const byPlace = {};
links.forEach((l, i) => (byPlace[l.place_id] ??= []).push(i));

/* Thread order, from the corpus's own memberships. A stop is one event; its year is
 * the entry's year_label as the window shows it, and order follows the window then
 * year_sort, which is how the reader moves through the strip.
 *
 * Support (thread_support.json, Thread 35 thread-tag audit): where one of the event's rows
 * supports the membership in its own words, the stop carries those words and that row
 * (stated before implied); otherwise support is null and the panel says the membership is
 * the corpus's reading. The stop's title is its own row's, not the event's: in W5 an event
 * is a whole year's row, named after one of its lanes. Optional, so an older corpus builds. */
const SUP = new Map();
if (have('thread_support.json')) for (const r of read('thread_support.json').supports) SUP.set(`${r.entry_id}|${r.token}`, r);
const rank = (r) => (r?.support === 'stated' ? 2 : r?.support === 'implied' ? 1 : 0);
const threads = {};
const stopAt = new Map();
for (const e of [...E].sort((a, b) => a.window - b.window || a.year_sort - b.year_sort)) {
  for (const t of e.thread_memberships ?? []) {
    const key = `${t}|${e.event_id}`;
    const sup = SUP.get(`${e.id}|${t}`) ?? null;
    const have_ = stopAt.get(key);
    if (have_) {
      if (rank(sup) > rank(have_.sup)) Object.assign(have_.stop, { entry_id: e.id, title: e.title, support: sup.support, quote: sup.quote, note: sup.note ?? null }), (have_.sup = sup);
      continue;
    }
    const stop = {
      event_id: e.event_id,
      window: e.window,
      year_label: e.year_label ?? String(e.year_sort),
      entry_id: e.id,
      title: e.title,
      hasPlaces: Boolean(byEvent[e.event_id]),
      noPlaceReason: (P.no_place ?? {})[e.event_id] ?? null,
      // No thread_support.json: no support fields at all, so the panel shows no label.
      ...(SUP.size ? { support: sup?.support ?? null, quote: sup?.quote ?? null, note: sup?.note ?? null } : {}),
    };
    stopAt.set(key, { stop, sup });
    (threads[t] ??= []).push(stop);
  }
}

/* Thread titles (threads.json, Thread 35). Optional so an older corpus still builds; the
 * panel falls back to the code. The span is computed here from the stops, so it cannot
 * drift from the memberships the way a typed range can. */
const threadInfo = {};
const TH = have('threads.json') ? read('threads.json').threads : [];
for (const t of TH) threadInfo[t.token] = { title: t.title, description: t.description, status: t.status };
for (const [tok, stops] of Object.entries(threads)) {
  const i = (threadInfo[tok] ??= { title: null, description: null, status: null });
  i.from = stops[0]?.year_label ?? null;
  i.to = stops[stops.length - 1]?.year_label ?? null;
  i.stops = stops.length;
}
const untitled = Object.keys(threads).filter((t) => !threadInfo[t].title);

const out = {
  available: true,
  generatedFrom: 'historical_maps.json + places.json + flows.json + entries.json',
  generatedAt: new Date().toISOString(),
  appUse: H.app_use ?? null,
  /* Region boxes from the corpus (region fix, Thread 35); null on an older corpus, and
   * lib/maps.ts then falls back to its own copy of the original nine. */
  regionBoxes: H.region_boxes ?? null,
  roles: P.roles,
  maps,
  places: P.places,
  links,
  gaps: P.gaps,
  noPlace: P.no_place ?? {},
  flows,
  byEvent,
  byPlace,
  threads,
  threadInfo,
  namedMaps,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 0) + '\n');

/* Coastlines for the panel: Natural Earth 1:50m land (public domain), from the
 * world-atlas package pinned in package.json. Copied into public/maps/, which is
 * gitignored like public/windows/ and served behind the same invite gate. */
const LAND_SRC = path.join(process.cwd(), 'node_modules', 'world-atlas', 'land-50m.json');
const LAND_DIR = path.join(process.cwd(), 'public', 'maps');
if (!fs.existsSync(LAND_SRC)) die(`Coastline data missing at ${LAND_SRC}. Run npm install.`);
fs.mkdirSync(LAND_DIR, { recursive: true });
fs.copyFileSync(LAND_SRC, path.join(LAND_DIR, 'land-50m.json'));

const shown = maps.filter((m) => m.memberVisible).length;
console.log(`  ${maps.length} period maps (${shown} member-visible, commercial=${commercial})`);
console.log(`  ${Object.keys(namedMaps).length} events name a catalogued map in a row's own words`);
console.log(`  ${P.places.length} places, ${links.length} links, ${flows.length} flows, ${Object.keys(byEvent).length} events with map data`);
const allStops = Object.values(threads).flat();
console.log(`  ${allStops.length} thread stops, ${allStops.filter((x) => x.support).length} supported in the row's own words (thread_support.json${SUP.size ? '' : ' absent'})`);
console.log(`  ${Object.keys(threads).length} threads indexed, ${Object.keys(threads).length - untitled.length} titled${untitled.length ? ` (untitled: ${untitled.join(', ')})` : ''}`);
console.log(`  ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB -> lib/maps.generated.json`);
console.log(`  ${(fs.statSync(path.join(LAND_DIR, 'land-50m.json')).size / 1024).toFixed(0)} KB -> public/maps/land-50m.json (Natural Earth, public domain)`);
console.log('  Audit repo untouched (read-only).\n');
