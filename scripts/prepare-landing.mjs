#!/usr/bin/env node
/**
 * prepare-landing.mjs — data for the public landing page (app/page.tsx).
 *
 * Read-only against the audit repo, like the other prepare scripts. Writes
 * lib/landing.generated.json: the seven windows with one rights-clear period map
 * each (from the app's own map data), live totals from the corpus, the Johnson v.
 * Casor dossier as it stands, and the three Johnson rows the page's story uses.
 * Every figure on the landing page comes from here, so the page cannot drift
 * from the corpus.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function readEnvLocal(key) {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    const m = raw.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return m ? m[1].trim() : undefined;
  } catch { return undefined; }
}
const REPO = process.env.SILICON_ALTAR_REPO || readEnvLocal('SILICON_ALTAR_REPO');
if (!REPO || !fs.existsSync(REPO)) { console.error('SILICON_ALTAR_REPO not found'); process.exit(1); }
const J = (f) => JSON.parse(fs.readFileSync(path.join(REPO, f), 'utf8'));

const windows = J('windows.json').windows;
const entries = J('entries.json').entries;
const sources = J('sources.json').sources;
const dossiers = J('dossiers.json').dossiers;
const maps = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'lib', 'maps.generated.json'), 'utf8')).maps;
const mapById = new Map(maps.map((m) => [m.id, m]));

// One period map per window, chosen for being public domain or free to use and
// shown to members (Thread 37). Hot-linked from the holder at a modest size.
const WINDOW_MAP = {
  W0: 'map-portolan-mediterranean-1335', W1: 'map-waldseemuller-1507', W2: 'map-smith-virginia-1624',
  W3: 'map-kitchin-british-dominions-1763', W4: 'map-lewis-louisiana-1805',
  W5: 'map-glo-united-states-territories-1871', W6: 'map-bia-land-areas-federally-recognized-tribes-2025',
};
const mapCard = (id) => {
  const m = mapById.get(id);
  if (!m || !m.memberVisible || !m.image?.iiif_image) return null;
  // A small local copy (public/landing/maps/<id>.jpg, all public domain or free
  // to use) is preferred, so the page never waits on a holder's image server.
  const local = path.join(process.cwd(), 'public', 'landing', 'maps', `${id}.jpg`);
  return { id, title: m.title, maker: m.maker, date: m.date, holder: m.holder, catalog: m.catalog_url,
    img: fs.existsSync(local) ? `/landing/maps/${id}.jpg` : `${m.image.iiif_image}/full/900,/0/default.jpg` };
};

const sourceById = new Map(sources.map((s) => [s.id, s]));
const usedSources = new Set(entries.flatMap((e) => e.source_ids || []));
const read = sources.filter((s) => s.link_status === 'live_verified').length;

const casor = dossiers.find((d) => d.id === 'dossier-johnson-v-casor-1655');
const row = (id) => entries.find((e) => e.id === id);

const out = {
  generatedAt: new Date().toISOString(),
  totals: {
    windows: windows.length,
    entries: entries.length,
    events: new Set(entries.map((e) => e.event_id)).size,
    dossiers: dossiers.length,
    sources: sources.length,
    sourcesRead: read,
    sourcesCited: usedSources.size,
  },
  windows: windows.map((w) => ({
    id: w.id, n: Number(String(w.id).replace(/\D/g, '')), name: w.name, range: w.year_range,
    entries: entries.filter((e) => `W${e.window}` === w.id).length, map: mapCard(WINDOW_MAP[w.id]),
  })),
  casor: casor && {
    title: casor.title,
    badges: casor.badges.map((b) => b.text),
    sources: casor.sources_ordered.map((s) => {
      const r = sourceById.get(s.source_id) || {};
      return { tier: s.tier, title: r.title, status: r.link_status };
    }),
    hypotheses: casor.hypotheses.map((h) => ({ label: h.label, text: h.text ?? '', verdict: h.verdict, why: h.eliminated_by || h.held_because || '' })),
  },
  johnsonRows: ['E-W2-011-02', 'E-W2-043-01', 'E-W2-022-01'].map((id) => {
    const e = row(id);
    return e ? { id, year: String(e.year_label).replace(/\D/g, '').slice(0, 4), title: e.title } : null;
  }),
};
fs.writeFileSync(path.join(process.cwd(), 'lib', 'landing.generated.json'), JSON.stringify(out, null, 1));
console.log(`landing: ${out.windows.length} windows (${out.windows.filter((w) => w.map).length} with maps), ` +
  `${out.totals.entries} entries, ${out.totals.sources} sources (${out.totals.sourcesRead} read)`);
console.log('  Audit repo untouched (read-only).');
