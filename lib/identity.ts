/**
 * identity.ts — who is asking.
 *
 * WHY THIS EXISTS AND WHY IT IS NOT A SHARED PASSWORD
 * ---------------------------------------------------
 * The beta is a hand-picked group of researchers who will bring sources and
 * expect to see what became of them. Every record written today says
 * `surfaced_by: operator`. Attribution cannot be retrofitted onto records that
 * are already written, so identity has to exist BEFORE the first invited
 * researcher asks the first question — not when the contribution view is built.
 * A shared password would satisfy the access gate and none of that.
 *
 * Per-person quota needs the same field, which is why rate limiting and the
 * gate landed in one change rather than two.
 *
 * EDGE-SAFE ON PURPOSE. This module is imported by middleware.ts, which runs on
 * the Edge runtime: no `node:fs`, no `node:crypto`. Everything here is Web
 * Crypto and works in both runtimes. The invite list — which does need the
 * filesystem — lives in lib/invites.ts and is only ever read from a Node route.
 *
 * The cookie is a signed assertion, not a session lookup. There is no server
 * session table to keep, which is what lets middleware verify a request without
 * touching disk.
 */

export type PersonRole = 'operator' | 'researcher';

export type Person = {
  /** Stable, short, and the value written to `surfaced_by`. Never reuse one. */
  id: string;
  name: string;
  role: PersonRole;
};

export type SessionPayload = Person & { iat: number; exp: number };

export const SESSION_COOKIE = 'sa_session';

/** Headers middleware sets from the verified cookie. Routes read these and
 *  never re-derive identity. Always stripped from the inbound request first —
 *  see middleware.ts — so a client cannot present them. */
export const H_ID = 'x-sa-person-id';
export const H_NAME = 'x-sa-person-name';
export const H_ROLE = 'x-sa-person-role';

const VERSION = 'v1';
const DEFAULT_TTL_DAYS = 30;

/* ------------------------------------------------------------------ base64url */

function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------------------------------------------------------------------- hmac */

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/** `v1.<payload>.<sig>` — self-contained, verifiable without I/O. */
export async function signSession(
  person: Person,
  secret: string,
  ttlDays: number = DEFAULT_TTL_DAYS
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    id: person.id,
    name: person.name,
    role: person.role,
    iat: now,
    exp: now + ttlDays * 86400,
  };
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(body))
  );
  return `${VERSION}.${body}.${b64urlEncode(sig)}`;
}

/**
 * Returns the person, or null for anything that is not a currently-valid
 * signature. Never throws: a malformed cookie is an anonymous request, not a
 * 500. Every rejection path returns the same null so a caller cannot learn
 * which part failed.
 */
export async function verifySession(
  token: string | undefined | null,
  secret: string
): Promise<SessionPayload | null> {
  if (!token || !secret) return null;

  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== VERSION) return null;
  const [, body, sig] = parts;

  let ok = false;
  try {
    ok = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      b64urlDecode(sig),
      new TextEncoder().encode(body)
    );
  } catch {
    return null;
  }
  if (!ok) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as SessionPayload;
  } catch {
    return null;
  }

  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null;
  if (!payload.id || !payload.name) return null;
  if (payload.role !== 'operator' && payload.role !== 'researcher') return null;

  return payload;
}

/** Read the identity middleware attached to this request. */
export function personFromHeaders(h: Headers): Person | null {
  const id = h.get(H_ID);
  const name = h.get(H_NAME);
  const role = h.get(H_ROLE);
  if (!id || !name) return null;
  if (role !== 'operator' && role !== 'researcher') return null;
  return { id, name, role };
}
