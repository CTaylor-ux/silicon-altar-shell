/**
 * /api/session — redeem an invite, or find out who you are.
 *
 * The one route reachable without a session, because it is how you get one.
 * Runs on Node rather than Edge: it reads the invite list from disk, which is
 * exactly why middleware does not.
 *
 * POST   { token }  -> sets the signed cookie
 * GET               -> { person } or { person: null }
 * DELETE            -> clears the cookie
 */

import { NextResponse } from 'next/server';
import { redeem } from '@/lib/invites';
import { SESSION_COOKIE, signSession, verifySession } from '@/lib/identity';

export const runtime = 'nodejs';

const COOKIE_TTL_DAYS = 30;

/* Redemption is the one place a secret is guessed rather than presented, so it
   is the one place worth throttling by origin. Tokens are 32 random bytes and
   are not realistically guessable; this exists so that trying anyway is slow and
   visible in the log rather than free. */
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, number[]>();

function throttled(origin: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(origin) ?? []).filter((t) => now - t < ATTEMPT_WINDOW_MS);
  recent.push(now);
  attempts.set(origin, recent);
  return recent.length > MAX_ATTEMPTS;
}

function callerOrigin(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0] : '').trim() || req.headers.get('x-real-ip') || 'local';
}

function secretOrError(): { secret: string } | { error: NextResponse } {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    return {
      error: NextResponse.json(
        {
          error:
            'SESSION_SECRET is not set. Add it to .env.local: SESSION_SECRET=$(openssl rand -hex 32)',
        },
        { status: 503 }
      ),
    };
  }
  return { secret };
}

export async function POST(req: Request) {
  const got = secretOrError();
  if ('error' in got) return got.error;

  const origin = callerOrigin(req);
  if (throttled(origin)) {
    console.warn(`[session] throttling redemption attempts from ${origin}`);
    return NextResponse.json(
      { error: 'Too many attempts. Wait ten minutes.' },
      { status: 429 }
    );
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const token = (body.token ?? '').trim();
  if (!token) return NextResponse.json({ error: 'No invite code given.' }, { status: 400 });

  const result = redeem(token);
  if (!result.ok) {
    /* One message for every failure. Distinguishing "unknown" from "expired"
       tells a guesser which half of the space they are in. The reason is
       logged for the operator, not returned. */
    console.warn(`[session] redemption failed (${result.reason}) from ${origin}`);
    const hint =
      result.reason === 'no-list'
        ? 'No invite list is installed on this server.'
        : 'That invite code is not valid.';
    return NextResponse.json({ error: hint }, { status: 401 });
  }

  const cookie = await signSession(result.person, got.secret, COOKIE_TTL_DAYS);
  const res = NextResponse.json({ person: result.person });
  res.cookies.set(SESSION_COOKIE, cookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_TTL_DAYS * 86400,
  });
  console.log(`[session] ${result.person.id} (${result.person.role}) signed in`);
  return res;
}

export async function GET(req: Request) {
  const got = secretOrError();
  if ('error' in got) return got.error;

  const raw = req.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

  const person = await verifySession(raw, got.secret);
  return NextResponse.json({
    person: person ? { id: person.id, name: person.name, role: person.role } : null,
  });
}

export async function DELETE() {
  const res = NextResponse.json({ person: null });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
