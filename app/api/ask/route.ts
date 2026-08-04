/**
 * POST /api/ask — the answering layer.
 *
 * Holds the key server-side. The browser never sees it.
 *
 * Not streamed in this pass. A fifteen-second wait behind the query bar's
 * existing thinking state is acceptable, and streaming adds client complexity
 * that tests nothing about whether the design is right.
 *
 * Uses fetch directly rather than the SDK: the request is simple, and keeping
 * it inspectable matters more here than the SDK's retry handling.
 */

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { CONTRACT, parseAndValidate, situate } from '@/lib/ask';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MODEL = 'claude-opus-5';
const MAX_TOKENS = 8000;

/** Read once per server process. 356 KB off disk on every request would be
 *  wasteful, and the file only changes when prepare-corpus.mjs re-runs. */
let CORPUS: string | null = null;
function corpusText(): string {
  if (CORPUS === null) {
    CORPUS = fs.readFileSync(path.join(process.cwd(), 'lib', 'corpus.prompt.txt'), 'utf8');
  }
  return CORPUS;
}

type Turn = { role: 'user' | 'assistant'; content: string };

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error:
          'No ANTHROPIC_API_KEY in .env.local. The answering layer needs one; Locate does not and still works.',
      },
      { status: 503 }
    );
  }

  let body: { question?: string; history?: Turn[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const question = (body.question ?? '').trim();
  if (!question) return NextResponse.json({ error: 'Empty question.' }, { status: 400 });

  const history = (body.history ?? []).slice(-8);

  /* Prefix order is load-bearing. Caching is a prefix match, so the contract
     and the corpus must physically precede anything volatile. The breakpoint
     goes on the corpus block: it is the expensive part and it never changes
     between requests. When posture (operator vs member) lands it belongs AFTER
     this breakpoint, in the message body, so both postures share one warm
     cache instead of forking it and paying the write twice. */
  const payload = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      { type: 'text', text: CONTRACT },
      {
        type: 'text',
        text: corpusText(),
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: [...history, { role: 'user' as const, content: question }],
    // No temperature/top_p/top_k: Opus 5 rejects sampling params with a 400.
  };

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not reach the API: ${(e as Error).message}` },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      { error: `API returned ${res.status}`, detail: detail.slice(0, 600) },
      { status: 502 }
    );
  }

  const data = (await res.json()) as {
    content: { type: string; text?: string }[];
    usage?: Record<string, number>;
  };

  const raw = data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n')
    .trim();

  const parsed = parseAndValidate(raw);
  const nearby = situate(parsed);

  const u = data.usage ?? {};
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;

  // Cost is worth seeing while testing rather than discovering on a bill.
  const cost =
    (cacheWrite * 1.25 * 5) / 1_000_000 +
    (cacheRead * 0.1 * 5) / 1_000_000 +
    ((u.input_tokens ?? 0) * 5) / 1_000_000 +
    ((u.output_tokens ?? 0) * 25) / 1_000_000;

  console.log(
    `[ask] cache ${cacheWrite ? `WRITE ${cacheWrite}` : `read ${cacheRead}`}` +
      ` | in ${u.input_tokens ?? 0} out ${u.output_tokens ?? 0}` +
      ` | ~$${cost.toFixed(3)}` +
      (parsed.strippedIds.length ? ` | STRIPPED ${parsed.strippedIds.join(', ')}` : '')
  );

  return NextResponse.json({
    answer: parsed.answer,
    outside: parsed.outside,
    citedIds: parsed.citedIds,
    strippedIds: parsed.strippedIds,
    nearby,
    usage: {
      cacheRead,
      cacheWrite,
      inputTokens: u.input_tokens ?? 0,
      outputTokens: u.output_tokens ?? 0,
      estimatedCostUsd: Number(cost.toFixed(4)),
    },
  });
}
