/**
 * record.ts — Phase 1 of the governance loop.
 *
 * Every exchange is written to an append-only JSONL file. A minority of them
 * also carry a triage block saying what is installable and how.
 *
 * TWO THINGS, DELIBERATELY SEPARATE
 * ---------------------------------
 * LOG every exchange, including the ones that change nothing. query_ledger's
 * own rule: a corpus-complete answer is logged too, as evidence of coverage and
 * demand. That log is how you learn which entries are load-bearing and which
 * are never cited by anything.
 *
 * STAGE only what is actually installable — a correction, a new fact, a
 * correlation. If every exchange staged a candidate the backlog would be
 * unreadable inside a week, and an unreadable backlog is the same as no
 * backlog.
 *
 * SHAPE
 * -----
 * Field names are C2's `candidate` columns verbatim (`kind`, `route`,
 * `status`, `surfaced_by`, `surface`, `operator_decision`), so the eventual
 * move to Neon is a COPY rather than a redesign. Do not rename them for
 * tidiness.
 *
 * The disposition vocabulary is the PRD family's, not a new one. `kind` and
 * `route` come from C2; `corpus_touch` is P0's "edit-against-corpus" route,
 * which C3 gives its highest-scrutiny path. query_ledger.json's seven
 * dispositions are all additive and have no slot for a challenge to an
 * existing entry — that gap is a sync issue, not a missing concept.
 *
 * NOTHING HERE TOUCHES THE CORPUS. This writes beside the app. The audit repo
 * only ever receives an approved install, through C3, by the operator.
 */

import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import corpus from './corpus.generated.json';
import type { CorpusEntry } from './locate';

const RECORDS_DIR = path.join(process.cwd(), 'records');
const RECORDS_FILE = path.join(RECORDS_DIR, 'queries.jsonl');

const BY_ID = new Map((corpus.entries as CorpusEntry[]).map((e) => [e.id, e]));

/** C2 candidate.kind */
export type RecordKind =
  | 'content'
  | 'design_amendment'
  | 'framework_amendment'
  | 'correction'
  | 'question';

/** C2 candidate.route. `corpus_touch` is P0's edit-against-corpus. */
export type RecordRoute = 'novel' | 'staged_merge' | 'corpus_touch';

/** C2 status lifecycle, enforced as a DB constraint once this reaches Postgres. */
export type RecordStatus =
  | 'captured'
  | 'analyzed'
  | 'proposed'
  | 'approved'
  | 'installed'
  | 'rejected'
  | 'deferred';

export type Triage = {
  installable: boolean;
  kind: RecordKind;
  route: RecordRoute;
  /** Entry this targets, '' when it targets nothing in particular. */
  target_entry: string;
  /** The entry's text as it stood when this was written. Empty when no target.
   *  Revisit a correction in November and a mismatch says the entry moved. */
  target_text_hash: string;
  summary: string;
  note: string;
};

/* Cheap, deterministic markers computed at capture time — no model call, no
 * cost. Each is a proxy, not a measurement: "namesThread" says the answer
 * mentioned a thread, not that it used the graph well.
 *
 * Their value is drift. One answer that skips the outside region is nothing;
 * ten in a row is a contract problem, and without this you only notice by
 * reading everything by hand. Every fix made to the contract so far came from
 * exactly that hand-reading, which is the argument for automating it.
 *
 * The obvious hazard: a marker that becomes a target gets satisfied rather
 * than met. Tell the model to mark its inference AND count how often it says
 * "my inference" and it will say it more without inferring better. Read these
 * as a prompt to go and look, never as a score. */
export type QualityMarkers = {
  citations: number;
  stripped: number;
  usedOutside: boolean;
  namesThread: boolean;
  /** First person, not "the corpus reads" — the distinction the contract
   *  makes, because only the first tells a reader where the model started
   *  arguing. */
  marksOwnInference: boolean;
  /** Tier language, HELD-NULL, held-not-asserted: is the evidence gradient
   *  surviving into the prose or staying invisible behind a citation? */
  carriesGradient: boolean;
  /** Says the framework vocabulary is the corpus's construct rather than
   *  standard terminology. */
  flagsFrameworkVocab: boolean;
  outputTokens: number;
};

export type QueryRecord = {
  id: string;
  captured_at: string;
  surface: 'A' | 'B';
  surfaced_by: string;
  trigger_context: string;
  raw_content: string;
  outside: string | null;
  cited_entry_ids: string[];
  stripped_ids: string[];
  usage: Record<string, number> | null;
  quality: QualityMarkers | null;
  triage: Triage | null;
  status: RecordStatus;
  operator_decision: string | null;
  operator_decision_at: string | null;
};

/* ------------------------------------------------------------------ quality */

const RX = {
  thread: /T-[A-Z][A-Z-]{3,}/,
  ownInference:
    /\b(I am|I'm) (putting|drawing|reading|connecting|inferring)|\bmy (own )?(inference|reading|observation|note)\b|that (connection|link|pairing) is mine|not the corpus'?s? (own )?(claim|reading|inference)/i,
  gradient:
    /\btier[- ][ABCDE]\b|HELD[- ]NULL|held, not asserted|interpretive (overlay|layer|reading)|the audit'?s? (own )?(reading|overlay|inference)|the corpus'?s? (own )?inference|disputed/i,
  /* The \\w+\\s* is load-bearing. Written without it, this missed "this audit's
   * own ANALYTICAL vocabulary" — the marker read false while the answer did
   * exactly what it was measuring for. A proxy that only matches the phrasing
   * you imagined is worse than no proxy, because it reports a regression that
   * is not there. */
  frameworkVocab:
    /(the corpus'?s?|this audit'?s?|the framework'?s?) own (\\w+\\s+)?(vocabulary|term|construct|frame|language)|not (a )?terms? (from|used in|you will find in) the scholarship|register note|(vocabulary|terms?) (is|are) the (corpus|audit|framework)'?s?/i,
};

export function measure(
  answer: string,
  outside: string | null,
  citedIds: string[],
  strippedIds: string[],
  outputTokens: number
): QualityMarkers {
  const both = `${answer}\n${outside ?? ''}`;
  return {
    citations: citedIds.length,
    stripped: strippedIds.length,
    usedOutside: !!outside && outside.trim().length > 0,
    namesThread: RX.thread.test(both),
    marksOwnInference: RX.ownInference.test(both),
    carriesGradient: RX.gradient.test(both),
    flagsFrameworkVocab: RX.frameworkVocab.test(both),
    outputTokens,
  };
}

/* -------------------------------------------------------------------- write */

function ensureDir() {
  if (!fs.existsSync(RECORDS_DIR)) fs.mkdirSync(RECORDS_DIR, { recursive: true });
}

export function readRecords(): QueryRecord[] {
  try {
    return fs
      .readFileSync(RECORDS_FILE, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as QueryRecord);
  } catch {
    return [];
  }
}

/** sb-YYYYMMDD-nnn, the Protocol v2 backlog id shape C2 mirrors. */
function nextId(now: Date): string {
  const day = now.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `sb-${day}-`;
  const n = readRecords().filter((r) => r.id.startsWith(prefix)).length + 1;
  return `${prefix}${String(n).padStart(3, '0')}`;
}

/** Append-only. Never rewrites, so a crash mid-write costs one line, not the file. */
export function appendRecord(r: Omit<QueryRecord, 'id' | 'captured_at'>): QueryRecord {
  ensureDir();
  const now = new Date();
  const full: QueryRecord = { id: nextId(now), captured_at: now.toISOString(), ...r };
  fs.appendFileSync(RECORDS_FILE, JSON.stringify(full) + '\n', 'utf8');
  return full;
}

/* ------------------------------------------------------------------- triage */

/* Structured output, and here it IS the right call — the opposite of the
 * answering layer. Forcing a schema onto prose degrades the prose; forcing one
 * onto a classification is exactly what a classification is. Different job,
 * different tool. */
const TRIAGE_SCHEMA = {
  type: 'object',
  properties: {
    installable: { type: 'boolean' },
    kind: {
      type: 'string',
      enum: ['content', 'design_amendment', 'framework_amendment', 'correction', 'question'],
    },
    route: { type: 'string', enum: ['novel', 'staged_merge', 'corpus_touch'] },
    target_entry: { type: 'string' },
    summary: { type: 'string' },
    note: { type: 'string' },
  },
  required: ['installable', 'kind', 'route', 'target_entry', 'summary', 'note'],
  additionalProperties: false,
} as const;

const TRIAGE_PROMPT = `You are triaging one exchange from a forensic-research corpus tool.

Decide whether it contains anything the operator could ACT ON, and classify it.

installable = true only when the exchange contains something that could change
the corpus. Examples that qualify:
  - a correction to an existing entry's claim, sourcing, or reasoning
  - a fact, instrument, or event the corpus does not carry
  - a correlation between entries the corpus does not already draw
  - a structural observation about the corpus's method or coverage

installable = false for everything else, which is most exchanges. An answer
that simply reports what the corpus already says is NOT installable, however
good the answer is. Do not stretch to find something. A backlog of weak
candidates is worse than a small one.

kind:
  correction          - challenges or amends something the corpus already says
  content             - new factual material
  framework_amendment - concerns the corpus's own method or constructs
  design_amendment    - concerns how the corpus is structured or rendered
  question            - a live question worth recording, nothing installable yet

route:
  corpus_touch  - touches an entry that already exists (highest scrutiny)
  novel         - entirely new material
  staged_merge  - likely duplicates something already staged

target_entry: the entry id this is about, exactly as written in the answer
(for example E-W0-010-01 or w3-1717-legal). Empty string if it targets no
single entry.

summary: one or two sentences the operator can act on months from now, with no
memory of this conversation. State what the finding IS, not that a finding
exists.

note: anything else worth keeping — a diagnosis of how a problem arose, a lead
to chase. Empty string if there is nothing.

When installable is false, still fill kind and route with your best reading;
they are ignored downstream.`;

/** Opus 5, per the project default. Effort is low because this is extraction,
 *  not reasoning. Swapping to `claude-haiku-4-5` here is a one-line change and
 *  roughly a quarter of the cost — the operator's call, not mine. */
const TRIAGE_MODEL = 'claude-opus-5';

export async function triage(
  client: Anthropic,
  question: string,
  answer: string,
  outside: string | null,
  citedIds: string[]
): Promise<{ triage: Triage | null; usage: Record<string, number> }> {
  /* Typed as the non-streaming param shape so `create` resolves to the
   * Message overload. Casting the whole object instead widens the return type
   * to the streaming union and every field read below fails to compile. */
  const params: Anthropic.Messages.MessageCreateParamsNonStreaming = {
    model: TRIAGE_MODEL,
    max_tokens: 2000,
    system: TRIAGE_PROMPT,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: TRIAGE_SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content:
          `QUESTION\n${question}\n\n` +
          `ANSWER\n${answer}\n\n` +
          (outside ? `OUTSIDE THE CORPUS\n${outside}\n\n` : '') +
          `ENTRIES CITED\n${citedIds.join(', ') || '(none)'}`,
      },
    ],
  } as Anthropic.Messages.MessageCreateParamsNonStreaming;

  const res = await client.messages.create(params);

  const usage = (res.usage ?? {}) as unknown as Record<string, number>;
  const text = res.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') return { triage: null, usage };

  let parsed: Triage;
  try {
    parsed = JSON.parse(text.text) as Triage;
  } catch {
    // A malformed triage must never cost the reader their answer, and must
    // never silently drop the log line either. Record without a triage block.
    return { triage: null, usage };
  }

  if (!parsed.installable) return { triage: null, usage };

  // Pin the target's text only if the target actually resolves. An id the
  // model invented gets cleared rather than stored as a dangling pointer.
  const target = parsed.target_entry ? BY_ID.get(parsed.target_entry) : undefined;
  return {
    triage: {
      ...parsed,
      target_entry: target ? parsed.target_entry : '',
      target_text_hash: target?.contentHash ?? '',
    },
    usage,
  };
}
