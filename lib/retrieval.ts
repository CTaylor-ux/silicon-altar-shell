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
};

export type QueryStatus = 'idle' | 'thinking' | 'answered' | 'empty' | 'error';

export class RetrievalError extends Error {}

const DELAY_MS = 620;

/**
 * FUTURE: replace body with `fetch('/api/query', ...)`. Signature is final.
 */
export async function query(q: string, signal?: AbortSignal): Promise<QueryResult> {
  const text = q.trim();
  if (!text) throw new RetrievalError('Empty query');

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, DELAY_MS);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new RetrievalError('aborted'));
    });
  });

  // Stubbed failure path, so the error state is exercisable in the mockup.
  if (/^fail\b/i.test(text)) {
    throw new RetrievalError('Retrieval backend unreachable');
  }

  return stubQuery(text);
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
