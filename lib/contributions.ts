/**
 * contributions.ts — the researcher's own view of the record store.
 *
 * THERE ARE NOT TWO BACKENDS. One store, two projections. The operator view is
 * `npm run records` and may stay a CLI through beta; this is the other
 * projection, filtered to one author and read-only on status. Nothing here
 * writes.
 *
 * WHY THIS AND SESSION PERSISTENCE ARE THE SAME BUILD. Conversation history
 * lives in sessionStorage today and dies with the browser tab. Once records
 * carry an author, "what did I ask yesterday" and "what happened to it" are one
 * query against one store: the record already holds the question
 * (`trigger_context`), the answer (`raw_content`), the rows touched
 * (`cited_entry_ids`) and the entry it bears on (`triage.target_entry`).
 * Fixing the history separately would have built a second store for the same
 * facts.
 *
 * WHAT A RESEARCHER IS NOT SHOWN, and these are operator rulings rather than
 * design preferences:
 *
 *   - The disposition vocabulary (`kind`, `route`, `corpus_touch`, and
 *     query_ledger's seven). It is internal editorial taxonomy, and showing it
 *     invites people to lobby for a category.
 *   - `analyzed` and `proposed`, which collapse into one "in review". The
 *     distinction is the operator's workflow, not a fact about their
 *     contribution.
 *   - Cost. Governance section 3: captured, never rendered. A price beside a
 *     claim invites the reader to value evidence by what it cost to produce.
 *
 * WHAT THEY ARE SHOWN, prominently: the rejection reason. The CLI already
 * refuses to write `rejected` without one, and for a hand-picked group each
 * decline is how the standard gets taught without anyone writing a manual.
 */

import { readRecords, type QueryRecord, type RecordStatus } from './record';

/** Reader-facing. Deliberately not RecordStatus: that is the operator's
 *  vocabulary and this is the reader's. */
export type ReaderStatus = 'received' | 'in-review' | 'installed' | 'declined' | 'deferred';

const READER_STATUS: Record<RecordStatus, ReaderStatus> = {
  captured: 'received',
  analyzed: 'in-review',
  proposed: 'in-review',
  /* `approved` means the operator has said yes but the work has not landed in
     the corpus yet. It reads as "in review" rather than as a promise, because
     the thing a researcher is waiting to see is the row, and the gap between
     approval and installation is done by hand outside the app. */
  approved: 'in-review',
  installed: 'installed',
  rejected: 'declined',
  deferred: 'deferred',
};

/** The transitions worth telling someone about on their way back in. */
const CONSEQUENTIAL: ReaderStatus[] = ['installed', 'declined', 'deferred'];

export type ContributionEvent = {
  at: string;
  status: ReaderStatus;
  reason: string | null;
};

export type Contribution = {
  id: string;
  askedAt: string;
  question: string;
  answer: string;
  /** Rows the answer stood on, so "what happened to it" can link to them. */
  citedEntryIds: string[];
  /** The entry this bears on, when it bears on one. */
  targetEntry: string | null;
  /** What the reader themselves pasted. Unverified by definition. */
  broughtUrl: string | null;
  broughtPassage: string | null;
  status: ReaderStatus;
  /** Prominent when declined. The operator's own words. */
  reason: string | null;
  decidedAt: string | null;
  history: ContributionEvent[];
};

function nonEmpty(s: string | null | undefined): string | null {
  const t = (s ?? '').trim();
  return t.length ? t : null;
}

/**
 * Status changes APPEND rather than overwrite, so every record already carries
 * its own decision history and the timeline needs no reconstruction. Lines for
 * one id are in file order; the last is current.
 */
export function contributionsFor(personId: string): Contribution[] {
  const byId = new Map<string, QueryRecord[]>();
  for (const r of readRecords()) {
    if (r.surfaced_by !== personId) continue;
    const list = byId.get(r.id);
    if (list) list.push(r);
    else byId.set(r.id, [r]);
  }

  const out: Contribution[] = [];

  for (const [id, lines] of byId) {
    const first = lines[0];
    const last = lines[lines.length - 1];

    const history: ContributionEvent[] = lines.map((l) => ({
      /* The first line has no decision timestamp, because nobody decided
         anything: it is the moment the question was asked. */
      at: l.operator_decision_at ?? l.captured_at,
      status: READER_STATUS[l.status] ?? 'received',
      reason: nonEmpty(l.operator_decision),
    }));

    out.push({
      id,
      askedAt: first.captured_at,
      question: first.trigger_context,
      answer: first.raw_content,
      citedEntryIds: first.cited_entry_ids ?? [],
      targetEntry: nonEmpty(first.triage?.target_entry),
      broughtUrl: nonEmpty(first.triage?.reader_source_url),
      broughtPassage: nonEmpty(first.triage?.reader_source_passage),
      status: READER_STATUS[last.status] ?? 'received',
      reason: nonEmpty(last.operator_decision),
      decidedAt: last.operator_decision_at ?? null,
      history,
    });
  }

  // Newest first: the thing you just asked is the thing you came back for.
  return out.sort((a, b) => b.askedAt.localeCompare(a.askedAt));
}

/**
 * What changed since a given moment. Nearly free, because status changes append:
 * this is a timestamp filter over a timeline that already exists, not a diff
 * reconstructed by comparing two snapshots.
 *
 * Only consequential transitions count. Someone coming back after a week does
 * not need to be told their question moved from `analyzed` to `proposed`.
 */
export function changedSince(
  contributions: Contribution[],
  since: string | null
): Contribution[] {
  if (!since) return [];
  return contributions.filter((c) =>
    c.history.some(
      (e) => e.at > since && CONSEQUENTIAL.includes(e.status) && e.at !== c.askedAt
    )
  );
}
