/**
 * POST /api/request — ask for an invitation (Thread 37, the public landing page).
 *
 * The one write a visitor without a code can make. It appends a line to
 * records/invite-requests.jsonl, which is gitignored because it holds names and
 * email addresses; the operator reads it and mints a code with `npm run invite`.
 * Nothing is sent anywhere: no email, no third party, no model call.
 *
 * Guarded the cheap ways: field lengths, a hidden field that only bots fill, a
 * per-address limit held in memory, and a cap on the file's size.
 */

import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { hasDb, sql } from '@/lib/db';

export const runtime = 'nodejs';

const DIR = process.env.RECORDS_DIR || path.join(process.cwd(), 'records');
const FILE = path.join(DIR, 'invite-requests.jsonl');
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ROLES = ['heir', 'researcher', 'educator', 'other'];
const recent = new Map<string, number[]>();

function clean(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'That did not arrive in one piece. Try again.' }, { status: 400 });
  }

  /* The hidden field. A person never sees it; a form-filling bot fills it. Answer
     as if it worked, so the bot learns nothing. */
  if (clean(body.website, 200)) return NextResponse.json({ ok: true });

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const role = ROLES.includes(String(body.role)) ? String(body.role) : 'other';
  const note = clean(body.note, 1500);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A name and a working email address, please.' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const now = Date.now();
  const mine = (recent.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (mine.length >= 5) {
    return NextResponse.json({ error: 'Several requests have come from here already. Try again later.' }, { status: 429 });
  }
  recent.set(ip, [...mine, now]);

  const entry = { at: new Date(now).toISOString(), name, email, role, note };
  /* Serverless hosts keep no disk between requests, so there the request goes to
     Postgres (lib/db.ts). The row cap plays the part of the file-size cap. */
  if (hasDb()) {
    const [{ n }] = (await sql()`select count(*)::int as n from sa_invite_requests`) as { n: number }[];
    if (n >= 5000) {
      return NextResponse.json({ error: 'Requests are closed for the moment.' }, { status: 503 });
    }
    await sql()`insert into sa_invite_requests (at, body) values (${entry.at}, ${JSON.stringify(entry)}::jsonb)`;
    return NextResponse.json({ ok: true });
  }
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  if (fs.existsSync(FILE) && fs.statSync(FILE).size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'Requests are closed for the moment.' }, { status: 503 });
  }
  fs.appendFileSync(FILE, JSON.stringify(entry) + '\n', { mode: 0o600 });
  return NextResponse.json({ ok: true });
}
