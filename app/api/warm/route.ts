/**
 * POST /api/warm — refresh the corpus cache without asking anything.
 *
 * One hour is the longest cache the API offers and there is no setting to
 * extend it. A read refreshes the clock, though, so touching the same prefix
 * every 50 minutes holds one entry open indefinitely.
 *
 * `max_tokens: 0` runs prefill, refreshes the cache, returns an empty response
 * immediately and bills no output tokens. About $0.08 against $1.50 to rebuild
 * from cold, so it pays for itself across any break longer than about an hour.
 *
 * This lives in the app rather than in the script that calls it so the warmed
 * prefix is byte-identical to the real one by construction — same CONTRACT
 * import, same corpus file, same breakpoint. A separate copy of the prompt in
 * a script would drift within a day and warm a cache no question ever reads.
 */

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { CONTRACT } from '@/lib/ask';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MODEL = 'claude-opus-5';

let CORPUS: string | null = null;
function corpusText(): string {
  if (CORPUS === null) {
    CORPUS = fs.readFileSync(path.join(process.cwd(), 'lib', 'corpus.prompt.txt'), 'utf8');
  }
  return CORPUS;
}

export async function POST() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: 'No ANTHROPIC_API_KEY.' }, { status: 503 });

  try {
    const res = await new Anthropic({ apiKey: key }).messages.create({
      model: MODEL,
      max_tokens: 0,
      system: [
        { type: 'text', text: CONTRACT },
        {
          type: 'text',
          text: corpusText(),
          // Breakpoint on the last block shared with a real request. On the
          // placeholder turn instead it would key the cache to text no real
          // question contains, and warm nothing that matters.
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      messages: [{ role: 'user', content: 'warm' }],
    });

    const u = (res.usage ?? {}) as unknown as Record<string, number>;
    const read = u.cache_read_input_tokens ?? 0;
    const write = u.cache_creation_input_tokens ?? 0;
    return NextResponse.json({
      read,
      write,
      costUsd: Number(((write * 2 * 5) / 1_000_000 + (read * 0.1 * 5) / 1_000_000).toFixed(4)),
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json({ error: err.message ?? 'warm failed' }, { status: err.status ?? 502 });
  }
}
