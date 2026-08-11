/**
 * GET /api/contributions — what I asked, and what became of it.
 *
 * Read-only, and read-only on purpose: a researcher can see status but cannot
 * set it. Status is the operator's, through `npm run records -- --set`.
 *
 * `?since=<iso>` adds the changed-since-you-were-last-here list. The client
 * supplies its own last-seen mark; there is no server-side per-person cursor,
 * because that would be new state for something a timestamp already answers.
 *
 * No model call, no key, no cost. This is a file read.
 */

import { NextResponse } from 'next/server';
import { personFromHeaders } from '@/lib/identity';
import { contributionsFor, changedSince } from '@/lib/contributions';
import { limits, usageToday } from '@/lib/quota';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const person = personFromHeaders(req.headers);
  if (!person) {
    return NextResponse.json(
      { error: 'Not signed in. Redeem your invite at /enter.' },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const sinceRaw = url.searchParams.get('since');
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? sinceRaw : null;

  const contributions = contributionsFor(person.id);
  const { perPersonPerDay } = limits();
  const usage = usageToday(person.id);

  return NextResponse.json({
    person,
    contributions,
    changed: changedSince(contributions, since),
    /* Their own remaining allowance, so hitting the cap is never a surprise.
       Not a cost figure: governance section 3 keeps money off the page. */
    today: {
      asked: usage.mine,
      limit: perPersonPerDay,
      remaining: perPersonPerDay > 0 ? Math.max(0, perPersonPerDay - usage.mine) : null,
    },
  });
}
