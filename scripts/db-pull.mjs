#!/usr/bin/env node
/**
 * db-pull.mjs: copy what the live app has collected down to this machine, so the
 * governance loop (npm run records, and the audit repo's C14q check) can read it.
 * Read-only against the database.
 *
 *   node --env-file=.env.production.local scripts/db-pull.mjs
 *
 * Writes records/live/queries.jsonl and records/live/invite-requests.jsonl, whole,
 * each run. It never touches records/queries.jsonl, the local store.
 */
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error('\n  DATABASE_URL is not set. Nothing done.\n');
  process.exit(1);
}
const sql = neon(url);
const dir = path.join(process.cwd(), 'records', 'live');
fs.mkdirSync(dir, { recursive: true });

const recs = await sql`select body from sa_records order by seq`;
fs.writeFileSync(path.join(dir, 'queries.jsonl'), recs.map((r) => JSON.stringify(r.body)).join('\n') + (recs.length ? '\n' : ''), { mode: 0o600 });
const reqs = await sql`select body from sa_invite_requests order by seq`;
fs.writeFileSync(path.join(dir, 'invite-requests.jsonl'), reqs.map((r) => JSON.stringify(r.body)).join('\n') + (reqs.length ? '\n' : ''), { mode: 0o600 });
console.log(`\n  Pulled ${recs.length} record line(s) and ${reqs.length} invitation request(s) into records/live/.\n`);
