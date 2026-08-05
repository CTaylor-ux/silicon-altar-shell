/**
 * POST /api/recover — rebuild records the capture step dropped.
 *
 * Written after a bug lost about twenty of them: triage threw a 400 (the
 * effort parameter, unsupported on Haiku), and because the triage call and the
 * record append sat in one try block, the throw skipped the append too. The
 * reader saw perfectly good answers the whole time; nothing was written down.
 *
 * The app keeps every exchange in sessionStorage, so the answers survive in
 * the browser tab. This takes that history, re-runs triage over each one, and
 * writes proper records — same shape, same triage, honest timestamps.
 *
 * Deliberately idempotent on the question text: re-running it will not
 * duplicate a record that already exists.
 *
 * Kept rather than deleted after use. A capture path that can drop records
 * needs a way back, and the next bug will not be this one.
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { appendRecord, measure, readRecords, triage } from '@/lib/record';

export const runtime = 'nodejs';
export const maxDuration = 300;

const TRIAGE_IN_PER_MTOK = 1;
const TRIAGE_OUT_PER_MTOK = 5;

type Incoming = {
  question: string;
  answer: string;
  outside?: string | null;
  citedIds?: string[];
  strippedIds?: string[];
  usage?: Record<string, number>;
};

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: 'No ANTHROPIC_API_KEY.' }, { status: 503 });

  let body: { exchanges?: Incoming[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const incoming = (body.exchanges ?? []).filter((e) => e?.question && e?.answer);
  if (!incoming.length) return NextResponse.json({ error: 'No exchanges supplied.' }, { status: 400 });

  // Don't duplicate what survived. Match on question text — the answers are
  // identical re-runs of the same prompt, so the question is the stable key.
  const already = new Set(readRecords().map((r) => r.trigger_context.trim()));
  const todo = incoming.filter((e) => !already.has(e.question.trim()));

  const client = new Anthropic({ apiKey: key });
  const written: string[] = [];
  const failed: string[] = [];

  for (const e of todo) {
    const citedIds = e.citedIds ?? [];
    const strippedIds = e.strippedIds ?? [];
    const usage: Record<string, number> = { ...(e.usage ?? {}) };

    let triageBlock = null;
    try {
      const t = await triage(client, e.question, e.answer, e.outside ?? null, citedIds);
      triageBlock = t.triage;
      const tu = t.usage ?? {};
      const cost =
        ((tu.input_tokens ?? 0) * TRIAGE_IN_PER_MTOK) / 1_000_000 +
        ((tu.output_tokens ?? 0) * TRIAGE_OUT_PER_MTOK) / 1_000_000;
      usage.triageCostUsd = Number(cost.toFixed(4));
    } catch (err) {
      // Same rule as the live path: a triage failure must never cost the record.
      console.error('[recover] triage failed for one exchange:', (err as Error).message);
    }

    try {
      const rec = appendRecord({
        surface: 'B',
        surfaced_by: 'operator',
        trigger_context: e.question,
        raw_content: e.answer,
        outside: e.outside ?? null,
        cited_entry_ids: citedIds,
        stripped_ids: strippedIds,
        usage,
        quality: measure(
          e.answer,
          e.outside ?? null,
          citedIds,
          strippedIds,
          usage.outputTokens ?? 0
        ),
        triage: triageBlock,
        status: 'captured',
        operator_decision: null,
        operator_decision_at: null,
      });
      written.push(rec.id);
    } catch (err) {
      failed.push(e.question.slice(0, 60));
      console.error('[recover] append failed:', (err as Error).message);
    }
  }

  console.log(
    `[recover] ${written.length} written, ${incoming.length - todo.length} already present, ${failed.length} failed`
  );

  return NextResponse.json({
    received: incoming.length,
    alreadyPresent: incoming.length - todo.length,
    written: written.length,
    ids: written,
    failed,
  });
}
