/**
 * retrieval.ts — THE SWAP POINT.
 *
 * Everything downstream (query bar states, stepper, cross-frame scroll, pulse)
 * consumes QueryResult and never learns what produced it. Replacing the stub
 * with a real backend is a change to this file only.
 *
 * FUTURE: swap stubQuery() for a POST to /api/query, which will hold the
 * Gemini Embedding 2 credentials server-side and return the same shape. The
 * PRD's Layer 4 secondary/tertiary functions (external verification, research
 * ingestion) become additional fields on QueryResult, not a different contract.
 */

import { STUB_INDEX } from './stub-index';
import corpus from './corpus.generated.json';
import type { CorpusEntry, LocateHit } from './locate';

const BY_ID = new Map((corpus.entries as CorpusEntry[]).map((e) => [e.id, e]));

/** Cited entries become the target rail, so every answer is steppable into the
 *  windows. The rail already existed for the stub; this just feeds it real
 *  citations instead of hand-written ones. */
function toTarget(id: string): Target | null {
  const e = BY_ID.get(id);
  if (!e) return null;
  return {
    entryId: e.id,
    windowId: e.window,
    year: e.year.display,
    lane: e.lane,
    tier: e.tier,
    title: e.title,
  };
}

/** A single addressable location in the corpus. entryId matches the
 *  data-entry-id injected by scripts/prepare-windows.mjs. */
export type Target = {
  entryId: string;
  windowId: number;
  year: string;
  lane: string;
  /** A-E is the corpus's declared vocabulary (STREAMS_LEGEND tier-legend).
   *  Only A/B/C have instances today; D and E are valid and unused. */
  tier: 'A' | 'B' | 'C' | 'D' | 'E';
  title: string;
};

export type QueryResult = {
  answer: string;
  targets: Target[];
  /** Present when the corpus holds a reading the sources do not themselves
   *  assert. Surfaced verbatim so the shell never blurs sourced fact and
   *  corpus interpretation — the distinction the audit exists to protect. */
  scopeNote?: string;

  /** What the model knows that this corpus does not carry.
   *
   *  A separate field rather than a labelled span inside `answer`, because the
   *  separation has to be structural. Badges interleaved through prose stop
   *  being read within a week of familiarity; a physically distinct region
   *  does not. This is the difference between honest provenance and
   *  decorative provenance. */
  outside?: string | null;

  /** "What else the corpus carries around then." Deterministic: the years come
   *  from the entries the answer actually cited, and the rows come from the
   *  same locate() that powers the Locate panel. No model judgment. */
  nearby?: { year: number; hits: LocateHit[] }[];

  /** Citations the model produced that do not resolve to a real entry. These
   *  were removed from the prose. Non-empty means the guard did work, and the
   *  reader is told rather than quietly served a cleaned-up answer. */
  strippedIds?: string[];

  usage?: {
    cacheRead: number;
    cacheWrite: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  };
};

export type QueryStatus = 'idle' | 'thinking' | 'answered' | 'empty' | 'error';

export class RetrievalError extends Error {}

const DELAY_MS = 620;

/**
 * The swap is done: this now calls the real answering layer.
 *
 * `history` carries prior turns so the exchange is genuinely multi-turn — a
 * reader can push back on an answer, which is the whole point of calling it a
 * discussion tool rather than a lookup.
 */
export async function query(
  q: string,
  signal?: AbortSignal,
  history: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<QueryResult> {
  const text = q.trim();
  if (!text) throw new RetrievalError('Empty query');

  // Stubbed failure path, kept so the error state stays exercisable without
  // spending a call.
  if (/^fail\b/i.test(text)) {
    await new Promise((r) => setTimeout(r, DELAY_MS));
    throw new RetrievalError('Retrieval backend unreachable');
  }

  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question: text, history }),
    signal,
  });

  const data = await res.json().catch(() => ({}) as Record<string, unknown>);

  if (!res.ok) {
    throw new RetrievalError(
      typeof data.error === 'string' ? data.error : `Answering layer returned ${res.status}`
    );
  }

  const citedIds: string[] = Array.isArray(data.citedIds) ? data.citedIds : [];

  return {
    answer: String(data.answer ?? ''),
    targets: citedIds.map(toTarget).filter((t): t is Target => t !== null),
    outside: typeof data.outside === 'string' ? data.outside : null,
    nearby: Array.isArray(data.nearby) ? (data.nearby as QueryResult['nearby']) : [],
    strippedIds: Array.isArray(data.strippedIds) ? data.strippedIds : [],
    usage: data.usage as QueryResult['usage'],
  };
}

/** Naive token overlap. Deliberately dumb — its only job is to make the
 *  interaction feel real enough to evaluate the linkage, not to be good. */
function stubQuery(text: string): QueryResult {
  const terms: string[] = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  let best: (typeof STUB_INDEX)[number] | null = null;
  let bestScore = 0;

  for (const row of STUB_INDEX) {
    const score = row.match.reduce(
      (acc, kw) => acc + (terms.includes(kw) ? 1 : 0),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }

  if (!best || bestScore < 1) {
    return { answer: '', targets: [] };
  }

  return { answer: best.answer, targets: best.targets, scopeNote: best.scopeNote };
}
