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
import crypto from 'node:crypto';
import process from 'node:process';

const REPO =
  process.env.SILICON_ALTAR_REPO ||
  readEnvLocal('SILICON_ALTAR_REPO') ||
  '/Users/taylorcolin/Desktop/Silicon_Altar_LIVE';

const OUT = path.join(process.cwd(), 'lib', 'corpus.generated.json');

/**
 * The second artifact: the corpus as the model sees it.
 *
 * corpus.generated.json is title-level and drives Locate. It deliberately
 * carries no bodies, because Locate never needs them.
 *
 * The answering layer does. An answer built from titles alone reads like a
 * database report, which is the failure mode the whole design is trying to
 * avoid. So this emits the full text: bodies, thread links, thread
 * memberships, plus the corpus's own scope note and framework spine, which
 * tell the model what this corpus is FOR. Without those two fields the model
 * cannot tell a genuine gap from a deliberate scoping decision.
 */
const PROMPT_OUT = path.join(process.cwd(), 'lib', 'corpus.prompt.txt');

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

/* 210 of the 690 entries carry an empty `body`. That is not missing data: W1,
 * W2 and W5 put the detail in the dossier and let the title carry the claim,
 * while W0, W3, W4 and W6 put it in the body. Every one of the 690 has a
 * dossier behind its event_id.
 *
 * Until now this script read dossiers.json only to set the hasDossier flag, so
 * those 210 reached the answering call as a bare title line - 30% of the
 * corpus, and 66% of W5. This map exists to close that. */
const dossierByEventId = new Map(
  dossiers.map((d) => [d.event_id ?? d.eventId, d]).filter(([k]) => k)
);

/* sources.json has never reached anything the app runs. It carries the one field
 * that records whether a claim's evidence has actually been opened: `link_status`,
 * hand-maintained, 443 live_verified against 138 citation_only (identified, text
 * not read). So the corpus knows things nothing downstream can see, among them
 * that 60 tier A entries rest entirely on sources nobody has opened.
 *
 * Two consumers, deliberately kept apart:
 *   - the answering prompt gets a compact `sources:` line (see serializeEntry)
 *   - `npm run records -- --sources` reads the sidecar written below
 *
 * The sidecar is NOT folded into lib/corpus.generated.json, on purpose. That file
 * is imported by client components and ships to the browser; a source index would
 * add roughly 130 KB there to serve a reader-facing feature that was considered
 * and dropped, because citations already lead to the dossier and the dossier
 * renders sources properly. A CLI can afford the weight; the browser should not
 * pay for it. */
const sourcesRaw = JSON.parse(fs.readFileSync(path.join(REPO, 'sources.json'), 'utf8'));
const sourceList = Array.isArray(sourcesRaw) ? sourcesRaw : sourcesRaw.sources;
const sourceById = new Map(sourceList.map((s) => [s.id, s]));
const SIDECAR = path.join(process.cwd(), 'lib', 'sources.generated.json');

/* A short hash of the exact text a claim was made against.
 *
 * When a record proposes a correction to an entry and the operator returns to
 * it three months later, this is what tells them whether the entry still says
 * what the correction was arguing with. Without it a stale fix gets applied to
 * text that has already moved on, silently. */
function contentHash(e) {
  return crypto
    .createHash('sha256')
    .update(`${e.title}\n${e.body ?? ''}`, 'utf8')
    .digest('hex')
    .slice(0, 16);
}

const rows = entries.map((e) => ({
  id: e.id,
  eventId: e.event_id ?? null,
  window: e.window,
  lane: e.lane,
  tier: e.tier,
  title: e.title,
  milestone: !!e.milestone,
  hasDossier: dossierEventIds.has(e.event_id),
  titleOnly: !(e.body ?? '').trim(),
  contentHash: contentHash(e),
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

/* Every source_ids reference must resolve, or the demand report silently
 * undercounts and the prompt line points at nothing. */
const danglingSourceRefs = entries.flatMap((e) =>
  (e.source_ids ?? []).filter((sid) => !sourceById.has(sid)).map((sid) => `${e.id} -> ${sid}`)
);
if (danglingSourceRefs.length) {
  console.error(`\n  ${danglingSourceRefs.length} entries reference a source that does not exist:`);
  danglingSourceRefs.slice(0, 10).forEach((s) => console.error(`    ${s}`));
  die('Fix sources.json or the entry rather than shipping a broken reference.');
}

fs.writeFileSync(
  SIDECAR,
  JSON.stringify({
    generatedFrom: 'entries.json + sources.json',
    /* entry id -> its source ids, so the demand report can chain
     * cited_entry_ids through to evidence without re-reading the audit repo. */
    entrySources: Object.fromEntries(
      entries.filter((e) => e.source_ids?.length).map((e) => [e.id, e.source_ids])
    ),
    sources: Object.fromEntries(
      sourceList.map((s) => [
        s.id,
        {
          tier: s.tier ?? null,
          linkStatus: s.link_status ?? null,
          url: s.url || null,
          title: s.title ?? '',
          type: s.type ?? null,
          verifiedDate: s.verified_date ?? null,
        },
      ])
    ),
  }),
  'utf8'
);

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

// ---------------------------------------------------------------------------
// The prompt serialization
//
// Stable ordering, because this block is the cached prefix. Any reordering
// between runs invalidates the cache and costs a full write (~$0.92) on the
// next call. Sorted by id so the output is byte-identical across runs when the
// corpus has not changed.
// ---------------------------------------------------------------------------
/* Entries whose detail lives in the dossier get two lines from it in place of
 * the body they do not have.
 *
 * `framework` is the reason this is worth the tokens. It names the construct
 * the entry belongs to - "FW-017 Discovery Doctrine spine" - which is the
 * audit's own vocabulary sitting inside a tier A entry. Answers flagged that
 * vocabulary as the audit's construct rather than as historical fact only 16%
 * of the time, and the instruction-based fix for it worked only on the question
 * it was tuned against. It could not have worked: the label was never in the
 * context to begin with.
 *
 * `assessment` carries the dossier's weight and warrant badges - how strong the
 * evidence is and whether the question is settled or open.
 *
 * The tier badge is dropped: the head line already carries the entry's own
 * tier, and two tier statements that could disagree is worse than one.
 *
 * Deliberately NOT included: hypotheses (the held/eliminated record) and the
 * correlation layer. The hypotheses alone run ~131k tokens across all 690,
 * close to the size of this entire prompt. They do not fit in a single call at
 * any scope and need retrieval, not a bigger prefix. */
function dossierLines(e) {
  const d = dossierByEventId.get(e.event_id);
  if (!d) return [];
  const out = [];

  const framework = d.streams?.explanation?.trim();
  if (framework) out.push(`framework: ${framework}`);

  const badges = (d.badges ?? [])
    .filter((b) => b.class !== 'tier')
    .map((b) => String(b.text ?? '').trim())
    .filter(Boolean)
    .join(' | ');
  if (badges) out.push(`assessment: ${badges}`);

  return out;
}

function serializeEntry(e) {
  const head = [
    `[${e.id}]`,
    `W${e.window}`,
    e.year_label,
    e.lane,
    `T${e.tier}`,
    e.milestone ? 'MILESTONE' : null,
  ]
    .filter(Boolean)
    .join(' ');

  const body = (e.body ?? '').trim();
  const lines = [head, e.title];
  if (body) lines.push(body);
  else lines.push(...dossierLines(e));

  /* What the claim rests on, and whether anyone has opened it.
   *
   * `live_verified` means someone doing the audit work read that source and
   * recorded what it says. `citation_only` means it was identified and never
   * opened: the entry's tier reflects the author's judgement of the source, not
   * a reading of it. 443 against 138 corpus-wide, and 60 tier A entries rest
   * entirely on the second kind.
   *
   * Without this line an answer can only see the entry's tier, so "how well
   * evidenced is this?" gets answered from a letter. The url is included so an
   * answer can point a reader at the document; the contract forbids pasting it
   * into prose, because links belong in the dossier where they render with the
   * source's note and tier beside them. */
  const srcs = (e.source_ids ?? [])
    .map((sid) => {
      const s = sourceById.get(sid);
      if (!s) return null;
      const state = `${s.tier ?? '?'} ${s.link_status ?? 'unknown'}`;
      return `[${state}] ${sid}${s.url ? ` ${s.url}` : ''}`;
    })
    .filter(Boolean);
  if (srcs.length) lines.push(`sources: ${srcs.join('; ')}`);

  if (e.thread_links?.length) lines.push(`links: ${e.thread_links.join(', ')}`);
  if (e.thread_memberships?.length) lines.push(`threads: ${e.thread_memberships.join(', ')}`);
  return lines.filter(Boolean).join('\n');
}

/* No entry may reach the model as a bare title. Before this check existed, 210
 * of them did. */
const titleOnly = entries.filter((e) => !(e.body ?? '').trim());
const stillBare = titleOnly.filter((e) => dossierLines(e).length === 0);
if (stillBare.length) {
  console.error(`\n  ${stillBare.length} entries have no body and no dossier text:`);
  stillBare.slice(0, 10).forEach((e) => console.error(`    ${e.id}  ${e.title}`));
  die('A bare title is not an entry. Fix the dossier rather than shipping it.');
}

const promptBody = [...entries]
  .sort((a, b) => String(a.id).localeCompare(String(b.id)))
  .map(serializeEntry)
  .join('\n\n');

const promptText = [
  'THE SILICON ALTAR CORPUS',
  '',
  `Entries: ${entries.length}. Windows: ${windowsList.length}.`,
  '',
  'The corpus states its own scope and spine. Both are load-bearing: they are',
  'how you tell a genuine gap from something deliberately out of scope.',
  '',
  `SCOPE NOTE: ${entriesRaw.scope_note ?? '(none declared)'}`,
  '',
  `FRAMEWORK SPINE: ${entriesRaw.framework_spine ?? '(none declared)'}`,
  '',
  'WINDOWS:',
  ...windowsList.map(
    (w) => `  Window ${String(w.id).replace(/\D/g, '')}: ${w.name} (${w.year_range}) - ${w.entries_count} entries`
  ),
  '',
  'Each entry below: [id] window year lane tier [MILESTONE], then title, then',
  'body, then its curated links to other entries and its thread memberships.',
  'Tier A is strongest evidence, E weakest. The links are hand-made by the',
  'operator and are not inferences.',
  '',
  'Some entries state their claim in the title and carry no body, because their',
  'detail lives in a dossier. Those show two dossier lines instead:',
  '',
  '  framework:   the audit construct this entry belongs to. THIS IS THE',
  "               AUDIT'S OWN ANALYTICAL VOCABULARY, NOT THE HISTORICAL",
  '               RECORD. Where an answer rests on a term named here, say',
  "               whose term it is - it is the audit's reading of the",
  '               evidence, not a fact the sources assert.',
  '  assessment:  how strong the dossier holds the evidence to be, and whether',
  '               the question is settled (Warrant: Closed) or still open',
  '               (Warrant: Open). An open warrant is a live question, and an',
  '               answer resting on one should say so.',
  '',
  'A missing body is not a gap in the record. It is where that window put the',
  'detail. Do not report those entries as thin or unsourced.',
  '',
  'Most entries also carry a sources line, in the form',
  '[TIER STATUS] source-id url. STATUS is the one that matters:',
  '',
  '  live_verified   someone doing this audit OPENED that source and recorded',
  '                  what it says.',
  '  citation_only   the source was identified and NEVER OPENED. The entry tier',
  '                  reflects a judgement about the source, not a reading of it.',
  '',
  'These are not the same evidential situation and should not be described as',
  'though they were. An entry at tier A whose sources are all citation_only is',
  'a confident claim resting on unread evidence, and when asked how well',
  'something is evidenced, say so. 443 sources are opened and 138 are not.',
  'Absence of a sources line means the entry carries no source at all.',
  '',
  '---',
  '',
  promptBody,
  '',
].join('\n');

fs.writeFileSync(PROMPT_OUT, promptText, 'utf8');

// --- report ----------------------------------------------------------------
const ce = rows.filter((r) => r.year.era === 'ce').length;
const deep = rows.length - ce;
const approx = rows.filter((r) => r.year.approximate).length;
const ranges = rows.filter((r) => r.year.end !== null).length;

console.log(`  ${rows.length}/${rows.length} entries normalized  (${ce} CE, ${deep} deep time)`);
console.log(`  ${approx} approximate, ${ranges} ranges, 0 W0/W1 ordinal collisions`);
console.log(`  ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB -> lib/corpus.generated.json`);

const promptKb = fs.statSync(PROMPT_OUT).size / 1024;
console.log(
  /* 2.428 bytes/token is MEASURED, not assumed: 364,946 bytes of this file
   * reported 150,308 cache-read tokens in record sb-20260805-024. The 3.6 this
   * replaced under-reported the prefix by a third. */
  `  ${promptKb.toFixed(0)} KB -> lib/corpus.prompt.txt  (~${Math.round(
    promptText.length / 2.428 / 1000
  )}k tokens, the cached prefix)`
);
console.log('  Audit repo untouched (read-only).\n');
