/**
 * POST /api/ask — the answering layer.
 *
 * Holds the key server-side. The browser never sees it.
 *
 * Not streamed in this pass. A fifteen-second wait behind the query bar's
 * existing thinking state is acceptable, and streaming adds client complexity
 * that tests nothing about whether the design is right.
 *
 * Every exchange is recorded to records/queries.jsonl on the way out. A
 * triage pass flags the minority that contain something installable. Neither
 * step is allowed to cost the reader their answer — see the catch below.
 */

import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { CONTRACT, parseAndValidate, situate } from '@/lib/ask';
import { appendRecord, triage } from '@/lib/record';

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
  const client = new Anthropic({ apiKey: key });

  let data;
  try {
    data = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        { type: 'text', text: CONTRACT },
        { type: 'text', text: corpusText(), cache_control: { type: 'ephemeral' } },
      ],
      messages: [...history, { role: 'user' as const, content: question }],
      // No temperature/top_p/top_k: Opus 5 rejects sampling params with a 400.
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message ?? 'The answering layer failed.', status: err.status },
      { status: err.status && err.status < 500 ? err.status : 502 }
    );
  }

  const raw = data.content
    .filter((b) => b.type === 'text')
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('\n')
    .trim();

  const parsed = parseAndValidate(raw);
  const nearby = situate(parsed);

  const u = (data.usage ?? {}) as unknown as Record<string, number>;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;

  const cost =
    (cacheWrite * 1.25 * 5) / 1_000_000 +
    (cacheRead * 0.1 * 5) / 1_000_000 +
    ((u.input_tokens ?? 0) * 5) / 1_000_000 +
    ((u.output_tokens ?? 0) * 25) / 1_000_000;

  const usage = {
    cacheRead,
    cacheWrite,
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    estimatedCostUsd: Number(cost.toFixed(4)),
  };

  /* Triage, then record.
   *
   * Wrapped so neither can cost the reader an answer they already paid for. A
   * failure here loses a log line; a thrown exception would lose the response.
   * The console line is deliberate: this is the operator's only live signal
   * that the capture step is working. */
  try {
    const t = await triage(client, question, parsed.answer, parsed.outside, parsed.citedIds);
    const rec = appendRecord({
      // No auth yet, so every exchange is the operator. When posture lands,
      // this is where surface 'A' (researcher) starts appearing.
      surface: 'B',
      surfaced_by: 'operator',
      trigger_context: question,
      raw_content: parsed.answer,
      outside: parsed.outside,
      cited_entry_ids: parsed.citedIds,
      stripped_ids: parsed.strippedIds,
      usage,
      triage: t.triage,
      status: 'captured',
      operator_decision: null,
      operator_decision_at: null,
    });
    console.log(
      `[record] ${rec.id} ` +
        (t.triage
          ? `INSTALLABLE ${t.triage.kind}/${t.triage.route}` +
            (t.triage.target_entry ? ` -> ${t.triage.target_entry}` : '')
          : 'logged, nothing installable')
    );
  } catch (e) {
    console.error('[record] capture failed:', (e as Error).message);
  }

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
    usage,
  });
}
