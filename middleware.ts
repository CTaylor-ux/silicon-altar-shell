/**
 * middleware.ts — the access gate.
 *
 * There was none. `/api/ask` holds the key server-side, so a leaked URL was an
 * uncapped tap on the operator's account: an unauthenticated POST reached the
 * route's own input validation, which means a well-formed question from anyone
 * — including a crawler — reached Opus 5 and spent real money.
 *
 * This runs on the Edge runtime, so it verifies the signed cookie and nothing
 * else. No filesystem, no invite list, no record read. Redeeming an invite is a
 * Node route (`/api/session`); everything after that is pure signature checking,
 * which is what makes a gate on every request affordable.
 *
 * FAILS CLOSED. Without SESSION_SECRET nothing is servable, including to the
 * operator. That is deliberate: a gate that degrades to open when misconfigured
 * is not a gate, and the failure mode this protects against is silent.
 *
 * The windows themselves are gated too. They are static assets under
 * public/windows, but they are also the corpus, and the corpus is the thing
 * being kept private.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession, H_ID, H_NAME, H_ROLE } from '@/lib/identity';

/** Reachable without a session, because they are how you get one. */
const OPEN_PATHS = ['/enter', '/api/session'];

function isOpen(pathname: string): boolean {
  return OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  /* Strip the identity headers off every inbound request before doing anything
     else. They are set below, from the verified cookie, and only from it. If a
     client could present them it would be trivially able to spend as anyone. */
  const headers = new Headers(req.headers);
  headers.delete(H_ID);
  headers.delete(H_NAME);
  headers.delete(H_ROLE);

  if (isOpen(pathname)) {
    return NextResponse.next({ request: { headers } });
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    const msg =
      'SESSION_SECRET is not set, so the access gate cannot verify anyone and is refusing every request. ' +
      'Add it to .env.local: SESSION_SECRET=$(openssl rand -hex 32)';
    return pathname.startsWith('/api/')
      ? NextResponse.json({ error: msg }, { status: 503 })
      : new NextResponse(msg, { status: 503, headers: { 'content-type': 'text/plain' } });
  }

  const person = await verifySession(req.cookies.get(SESSION_COOKIE)?.value, secret);

  if (person) {
    headers.set(H_ID, person.id);
    headers.set(H_NAME, person.name);
    headers.set(H_ROLE, person.role);
    return NextResponse.next({ request: { headers } });
  }

  /* An API caller gets a status it can act on; a browser gets sent somewhere
     useful, carrying where it was headed so redemption can return it there. */
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Not signed in. Redeem your invite at /enter.' },
      { status: 401 }
    );
  }

  const url = req.nextUrl.clone();
  url.pathname = '/enter';
  url.search = '';
  if (pathname !== '/') url.searchParams.set('from', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  /* Everything except Next's own build output and the favicon. public/windows
     is deliberately NOT excluded — see the header comment. */
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
