#!/usr/bin/env node
/**
 * records.mjs — read and triage the query record.
 *
 *   npm run records                  every installable record still open
 *   npm run records -- --all         every record, installable or not
 *   npm run records -- --show ID     one record in full
 *   npm run records -- --demand      which entries answers actually lean on
 *   npm run records -- --stale       corrections whose target text has moved
 *   npm run records -- --set ID STATUS [reason]
 *
 * STATUS is C2's lifecycle: captured, analyzed, proposed, approved, installed,
 * rejected, deferred. Setting one appends a new line rather than rewriting the
 * old one — the file stays append-only, and the decision history survives.
 *
 * This reads and writes records/queries.jsonl only. It never touches the audit
 * repo. Acting on a record still means making the change there by hand, the
 * way every one of the 325 commits was made; what this gives you is the
 * finding, in full, months after the conversation is gone.
 */

import fs from 'node:fs';
import path from 'node:path';

const FILE = path.join(process.cwd(), 'records', 'queries.jsonl');
const CORPUS = path.join(process.cwd(), 'lib', 'corpus.generated.json');

const STATUSES = [
  'captured',
  'analyzed',
  'proposed',
  'approved',
  'installed',
  'rejected',
  'deferred',
];

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const warn = (s) => `\x1b[33m${s}\x1b[0m`;

function load() {
  try {
    return fs
      .readFileSync(FILE, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

/** Last line wins: a status change appends, so the newest entry for an id is
 *  the current state and everything before it is the audit trail. */
function current(records) {
  const byId = new Map();
  for (const r of records) byId.set(r.id, r);
  return [...byId.values()];
}

function entryIndex() {
  try {
    const c = JSON.parse(fs.readFileSync(CORPUS, 'utf8'));
    return new Map(c.entries.map((e) => [e.id, e]));
  } catch {
    return new Map();
  }
}

function line(r) {
  const t = r.triage;
  const head = `${bold(r.id)}  ${dim(r.captured_at.slice(0, 16).replace('T', ' '))}  ${r.status}`;
  const q = r.trigger_context.replace(/\s+/g, ' ').slice(0, 96);
  if (!t) return `${head}\n  ${dim(q)}\n`;
  const target = t.target_entry ? ` -> ${t.target_entry}` : '';
  return `${head}  ${bold(`${t.kind}/${t.route}`)}${target}\n  ${dim(q)}\n  ${t.summary}\n`;
}

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valAfter = (f) => (args.indexOf(f) >= 0 ? args[args.indexOf(f) + 1] : undefined);

const all = load();
const recs = current(all);

if (recs.length === 0) {
  console.log('\n  No records yet. Ask something in the app and it lands here.\n');
  process.exit(0);
}

/* ------------------------------------------------------------------ --set */
if (has('--set')) {
  const i = args.indexOf('--set');
  const [id, status, ...reason] = args.slice(i + 1);
  if (!id || !STATUSES.includes(status)) {
    console.error(`\n  usage: --set <id> <${STATUSES.join('|')}> [reason]\n`);
    process.exit(1);
  }
  const rec = recs.find((r) => r.id === id);
  if (!rec) {
    console.error(`\n  No record ${id}.\n`);
    process.exit(1);
  }
  if (status === 'rejected' && reason.length === 0) {
    // query_ledger's own rule: decline records the reason, so the same claim
    // is not silently re-proposed later.
    console.error('\n  rejected needs a reason: --set <id> rejected "why"\n');
    process.exit(1);
  }
  const next = {
    ...rec,
    status,
    operator_decision: reason.join(' ') || null,
    operator_decision_at: new Date().toISOString(),
  };
  fs.appendFileSync(FILE, JSON.stringify(next) + '\n', 'utf8');
  console.log(`\n  ${id} -> ${status}${reason.length ? `  (${reason.join(' ')})` : ''}\n`);
  process.exit(0);
}

/* ----------------------------------------------------------------- --show */
if (has('--show')) {
  const id = valAfter('--show');
  const rec = recs.find((r) => r.id === id);
  if (!rec) {
    console.error(`\n  No record ${id}.\n`);
    process.exit(1);
  }
  const history = all.filter((r) => r.id === id);
  console.log(`\n${bold(rec.id)}  ${rec.captured_at}  ${rec.status}\n`);
  console.log(`${bold('QUESTION')}\n${rec.trigger_context}\n`);
  console.log(`${bold('ANSWER')}\n${rec.raw_content}\n`);
  if (rec.outside) console.log(`${bold('NOT IN THE CORPUS')}\n${rec.outside}\n`);
  console.log(`${bold('CITED')} ${rec.cited_entry_ids.join(', ') || '(none)'}`);
  if (rec.stripped_ids.length) console.log(warn(`${bold('STRIPPED')} ${rec.stripped_ids.join(', ')}`));
  if (rec.triage) {
    console.log(`\n${bold('TRIAGE')}`);
    for (const [k, v] of Object.entries(rec.triage)) if (v !== '') console.log(`  ${k}: ${v}`);
  }
  if (history.length > 1) {
    console.log(`\n${bold('DECISIONS')}`);
    for (const h of history.slice(1))
      console.log(`  ${h.operator_decision_at?.slice(0, 16)}  ${h.status}  ${h.operator_decision ?? ''}`);
  }
  console.log();
  process.exit(0);
}

/* --------------------------------------------------------------- --demand */
if (has('--demand')) {
  const counts = new Map();
  for (const r of recs) for (const id of r.cited_entry_ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  const idx = entryIndex();
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`\n  ${bold('Entries answers lean on')}   ${recs.length} records, ${counts.size} distinct entries cited\n`);
  for (const [id, n] of ranked.slice(0, 25)) {
    const e = idx.get(id);
    console.log(`  ${String(n).padStart(3)}  ${id.padEnd(20)} ${(e?.title ?? '(unknown)').slice(0, 60)}`);
  }
  if (idx.size) {
    const never = idx.size - counts.size;
    console.log(dim(`\n  ${never} of ${idx.size} entries have never been cited by any answer.`));
    console.log(dim('  Not necessarily dead weight — could be undiscoverable instead. Different fix.\n'));
  }
  process.exit(0);
}

/* ---------------------------------------------------------------- --stale */
if (has('--stale')) {
  const idx = entryIndex();
  const pinned = recs.filter((r) => r.triage?.target_text_hash);
  const stale = pinned.filter((r) => idx.get(r.triage.target_entry)?.contentHash !== r.triage.target_text_hash);
  console.log(`\n  ${bold('Corrections whose target has changed')}   ${stale.length} of ${pinned.length} pinned\n`);
  if (!stale.length) console.log(dim('  None. Every pinned target still reads as it did when the record was written.\n'));
  for (const r of stale) {
    console.log(warn(`  ${r.id}  ${r.triage.target_entry}`));
    console.log(`    written against ${r.triage.target_text_hash}, now ${idx.get(r.triage.target_entry)?.contentHash ?? '(entry gone)'}`);
    console.log(dim(`    ${r.triage.summary}\n`));
  }
  process.exit(0);
}

/* ---------------------------------------------------------------- default */
const showAll = has('--all');
const open = recs.filter(
  (r) => (showAll || r.triage) && !['rejected', 'installed'].includes(r.status)
);

const installable = recs.filter((r) => r.triage).length;
console.log(
  `\n  ${bold(`${recs.length} records`)}  ${installable} installable  ` +
    dim(`${recs.length - installable} logged as demand only`) +
    (showAll ? '' : dim('   (--all to include the rest)')) +
    '\n'
);
for (const r of open) console.log(line(r));
if (!open.length) console.log(dim('  Nothing open.\n'));
console.log(dim(`  --show <id> for one in full  ·  --set <id> <status> [reason]  ·  --demand  ·  --stale\n`));
