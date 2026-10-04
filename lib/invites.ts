/**
 * invites.ts — the invite list. NODE ONLY; never import this from middleware.
 *
 * One file, one line per invited researcher, read from disk on each redemption.
 * Redemption happens once per person per month, so there is nothing to cache and
 * a stale cache would be worse than the read.
 *
 * WHY A FILE AND NOT A TABLE. Postgres is explicitly deferred by the operator's
 * own sequencing, and a hand-picked beta is a list of maybe a dozen people. The
 * shape here is deliberately the shape of a `person` row, so that when C2's
 * store does land this is a COPY rather than a redesign — the same discipline
 * lib/record.ts follows with C2's candidate columns.
 *
 * invites.json is gitignored. It holds bearer tokens: anyone with one is that
 * person, until the token is removed from the file. `npm run invite` mints them.
 */

import fs from 'node:fs';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import type { Person, PersonRole } from './identity';
import { hasDb, sql, type Row } from './db';

export type Invite = Person & {
  /** Bearer secret. 32 random bytes, hex. */
  token: string;
  /** Free text for the operator: who this is, why they were invited. */
  note?: string;
  /** ISO date; a token past this is dead. Omit for no expiry. */
  expires?: string;
};

/* Overridable because the container never bakes the invite list into the image.
   In production this points at the mounted volume — the same volume the record
   store lives on — so invites survive a redeploy. Locally it is just cwd. */
const INVITES_FILE =
  process.env.INVITES_FILE || path.join(process.cwd(), 'invites.json');

export function invitesPath(): string {
  return INVITES_FILE;
}

function valid(list: Invite[]): Invite[] {
  return list.filter(
    (i) =>
      i &&
      typeof i.token === 'string' &&
      typeof i.id === 'string' &&
      typeof i.name === 'string' &&
      (i.role === 'operator' || i.role === 'researcher')
  );
}

/** With DATABASE_URL set the list is the sa_invites table (lib/db.ts);
 *  otherwise it is invites.json, as before. */
export async function readInvites(): Promise<Invite[]> {
  if (hasDb()) {
    const rows = (await sql()`select body from sa_invites`) as Row[];
    return valid(rows.map((r) => r.body as Invite));
  }
  let raw: string;
  try {
    raw = fs.readFileSync(INVITES_FILE, 'utf8');
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`invites.json is not valid JSON (${INVITES_FILE})`);
  }
  const list = Array.isArray(parsed)
    ? parsed
    : ((parsed as { invites?: unknown }).invites ?? []);
  if (!Array.isArray(list)) return [];

  return valid(list as Invite[]);
}

/** Constant-time over equal-length strings; length inequality is not secret. */
function tokenMatches(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export type RedeemResult =
  | { ok: true; person: Person }
  | { ok: false; reason: 'unknown' | 'expired' | 'no-list' };

export async function redeem(token: string): Promise<RedeemResult> {
  const invites = await readInvites();
  if (invites.length === 0) return { ok: false, reason: 'no-list' };

  const hit = invites.find((i) => tokenMatches(i.token, token));
  if (!hit) return { ok: false, reason: 'unknown' };

  if (hit.expires && Date.parse(hit.expires) <= Date.now()) {
    return { ok: false, reason: 'expired' };
  }

  const role: PersonRole = hit.role;
  return { ok: true, person: { id: hit.id, name: hit.name, role } };
}
