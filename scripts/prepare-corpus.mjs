#!/usr/bin/env node
/**
 * prepare-corpus.mjs
 *
 * Reads entries.json and windows.json out of the Silicon Altar audit repo and
 * writes lib/corpus.generated.json: the same 690 entries plus a DERIVED
 * normalized year on each.
 *
 * WHY THIS EXISTS
 * ---------------
 * `year_sort` is not a year in every window:
 *
 *   W0   1..42     ordinal row index
 *   W1   1..33     ordinal row index
 *   W2   1600..1705   real years
 *   W3   1652..1787   real years
 *   W4   1788..1854   real years
 *   W5   1846..1929   real years
 *   W6   1921..2026.5 real years
 *
 * So "find entries near 1120" against year_sort returns nothing in W0 and W1 —
 * exactly the windows a medieval date lands in. The readable date lives in
 * `year_label`, in eight different shapes. This script parses all of them.
 *
 * The audit repo is opened read-only. Nothing is ever written back to it.
 * The derived year is never written to the corpus; it exists only here.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPO =
  process.env.SILICON_ALTAR_REPO ||
  readEnvLocal('SILICON_ALTAR_REPO') ||
  '/Users/taylorcolin/Desktop/Silicon_Altar_LIVE';

const OUT = path.join(process.cwd(), 'lib', 'corpus.generated.json');

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
  console.error(`\n  prepare-corpus FAILED\n  ${msg}\n`);
  process.exit(1);
}

if (!fs.existsSync(REPO)) {
  die(`Audit repo not found at: ${REPO}\n  Set SILICON_ALTAR_REPO in .env.local`);
}

// ---------------------------------------------------------------------------
// Year normalization
//
// Rule order matters: the deep-time and range forms must be tried before the
// bare-digits rule, or "338K BP" would parse as the year 338.
// ---------------------------------------------------------------------------
const MONTHS =
  'january|february|march|april|may|june|july|august|september|october|november|december';

export function normalizeYear(label) {
  const raw = String(label ?? '');
  const trimmed = raw.trim();
  const approximate = /^[~c.]/i.test(trimmed);
  const s = trimmed.replace(/^[~]\s*/, '').trim();

  const out = (start, end, era) => ({
    start,
    end,
    approximate,
    era,
    display: raw, // never altered
  });

  // "~300 Ma" — megaannum, i.e. millions of years before present
  let m = s.match(/^([\d.]+)\s*Ma\b/i);
  if (m) return out(-Math.round(parseFloat(m[1]) * 1_000_000), null, 'deep');

  // "338K BP" — thousands of years before present (BP datum is 1950)
  m = s.match(/^([\d.]+)\s*K\s*BP\b/i);
  if (m) return out(Math.round(1950 - parseFloat(m[1]) * 1000), null, 'deep');

  // "12000 BP"
  m = s.match(/^([\d.]+)\s*BP\b/i);
  if (m) return out(Math.round(1950 - parseFloat(m[1])), null, 'deep');

  // "711 to 1248" / "711-1248"
  m = s.match(/^(\d{3,4})\s*(?:to|-|–)\s*(\d{3,4})\b/i);
  if (m) return out(Number(m[1]), Number(m[2]), 'ce');

  // "May 1717 (Royal Assent)" — month then year
  m = s.match(new RegExp(`^(?:${MONTHS})\\s+(\\d{3,4})`, 'i'));
  if (m) return out(Number(m[1]), null, 'ce');

  // "1652", "1290b", "1492a", "1600b", "2026.5"
  //
  // The trailing [a-z]? is load-bearing: a bare \b(\d{3,4})\b does NOT match
  // "1290b", because 0 and b are both word characters so there is no boundary
  // between them. That single omission is what makes a naive parser report
  // 630/690 instead of 690/690.
  m = s.match(/\b(\d{3,4})[a-z]?\b/i);
  if (m) return out(Number(m[1]), null, 'ce');

  return out(null, null, 'ce');
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
const entriesRaw = JSON.parse(fs.readFileSync(path.join(REPO, 'entries.json'), 'utf8'));
const entries = Array.isArray(entriesRaw) ? entriesRaw : entriesRaw.entries;

const windowsRaw = JSON.parse(fs.readFileSync(path.join(REPO, 'windows.json'), 'utf8'));
const windowsList = Array.isArray(windowsRaw) ? windowsRaw : windowsRaw.windows;

const dossiersRaw = JSON.parse(fs.readFileSync(path.join(REPO, 'dossiers.json'), 'utf8'));
const dossiers = Array.isArray(dossiersRaw) ? dossiersRaw : dossiersRaw.dossiers;
const dossierEventIds = new Set(
  dossiers.map((d) => d.event_id ?? d.eventId).filter(Boolean)
);

const rows = entries.map((e) => ({
  id: e.id,
  eventId: e.event_id ?? null,
  window: e.window,
  lane: e.lane,
  tier: e.tier,
  title: e.title,
  milestone: !!e.milestone,
  hasDossier: dossierEventIds.has(e.event_id),
  year: normalizeYear(e.year_label),
}));

// --- assertions: fail loudly rather than emit a half-usable corpus ----------
const unparsed = rows.filter((r) => r.year.start === null);
if (unparsed.length) {
  console.error(`\n  ${unparsed.length} entries did not yield a year:`);
  unparsed.slice(0, 10).forEach((r) => console.error(`    ${r.id}  "${r.year.display}"`));
  die('Every entry must normalize. Add a parse rule rather than shipping a gap.');
}

const byId = new Map(entries.map((e) => [e.id, e]));
const collisions = rows.filter(
  (r) => (r.window === 0 || r.window === 1) && r.year.start === byId.get(r.id).year_sort
);
if (collisions.length) {
  die(
    `${collisions.length} W0/W1 entries normalized to their own year_sort, which is ` +
      `an ordinal there. The parser is reading the wrong field.`
  );
}

const displayMismatch = rows.filter(
  (r) => r.year.display !== String(byId.get(r.id).year_label ?? '')
);
if (displayMismatch.length) die(`${displayMismatch.length} entries had year_label altered.`);

const windows = windowsList.map((w) => ({
  id: Number(String(w.id).replace(/\D/g, '')),
  name: w.name,
  yearRange: w.year_range,
  entries: w.entries_count,
  dossiers: w.dossiers_count,
}));

fs.writeFileSync(
  OUT,
  JSON.stringify({ generatedFrom: 'entries.json + windows.json', windows, entries: rows }, null, 0) +
    '\n',
  'utf8'
);

// --- report ----------------------------------------------------------------
const ce = rows.filter((r) => r.year.era === 'ce').length;
const deep = rows.length - ce;
const approx = rows.filter((r) => r.year.approximate).length;
const ranges = rows.filter((r) => r.year.end !== null).length;

console.log(`  ${rows.length}/${rows.length} entries normalized  (${ce} CE, ${deep} deep time)`);
console.log(`  ${approx} approximate, ${ranges} ranges, 0 W0/W1 ordinal collisions`);
console.log(`  ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB -> lib/corpus.generated.json`);
console.log('  Audit repo untouched (read-only).\n');
