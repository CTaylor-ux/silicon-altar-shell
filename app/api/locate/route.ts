/**
 * POST /api/locate
 *
 * Deterministic. No model call, no API key, no external network. Runs the same
 * pure function the client could run, but keeps the 188 KB corpus out of the
 * browser bundle.
 */

import { NextResponse } from 'next/server';
import { locate, type LocateQuery } from '@/lib/locate';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }

  const q = body as Partial<LocateQuery>;

  if (typeof q.year !== 'number' || !Number.isFinite(q.year)) {
    return NextResponse.json({ error: 'year must be a finite number' }, { status: 400 });
  }

  const result = locate({
    year: Math.round(q.year),
    windowIds: Array.isArray(q.windowIds) ? q.windowIds.filter((n) => typeof n === 'number') : undefined,
    laneKeys: Array.isArray(q.laneKeys) ? q.laneKeys.filter((s) => typeof s === 'string') : undefined,
    spanYears:
      typeof q.spanYears === 'number' && q.spanYears >= 0 ? Math.round(q.spanYears) : undefined,
    neighbors:
      typeof q.neighbors === 'number' && q.neighbors >= 0 ? Math.round(q.neighbors) : undefined,
  });

  return NextResponse.json(result);
}
