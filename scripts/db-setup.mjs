#!/usr/bin/env node
/**
 * db-setup.mjs: create the three tables lib/db.ts expects. Safe to run twice.
 *
 *   DATABASE_URL=... node scripts/db-setup.mjs
 *   node --env-file=.env.production.local scripts/db-setup.mjs
 *
 * One row per record, the record kept whole as JSON. sa_records is append-only
 * like records/queries.jsonl: a status change is a new row with the same id.
 */
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error('\n  DATABASE_URL is not set. Nothing done.\n');
  process.exit(1);
}
const sql = neon(url);

await sql`create table if not exists sa_records (
  seq bigserial primary key,
  id text not null,
  captured_at timestamptz not null,
  body jsonb not null
)`;
await sql`create index if not exists sa_records_id on sa_records (id)`;
await sql`create table if not exists sa_invites (
  id text primary key,
  body jsonb not null,
  created_at timestamptz not null default now()
)`;
await sql`create table if not exists sa_invite_requests (
  seq bigserial primary key,
  at timestamptz not null,
  body jsonb not null
)`;

const [r] = await sql`select
  (select count(*)::int from sa_records) as records,
  (select count(*)::int from sa_invites) as invites,
  (select count(*)::int from sa_invite_requests) as requests`;
console.log(`\n  Tables ready. records ${r.records}, invites ${r.invites}, invitation requests ${r.requests}.\n`);
