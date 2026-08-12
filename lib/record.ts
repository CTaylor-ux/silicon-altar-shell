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

/* Overridable so the deployed container can point this at a mounted volume.
   In the image, cwd is /app and a redeploy replaces it — writing records there
   would discard every record on each deploy, which is the one failure this
   layer is built to prevent. Locally, unset, it is just ./records. */
const RECORDS_DIR = process.env.RECORDS_DIR || path.join(process.cwd(), 'records');
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
  /* SOURCES ARRIVE INSIDE THE QUESTION, by taught convention: an invited
   * researcher is told to paste the url and the passage into what they ask.
   * That text was already captured verbatim in `trigger_context`, so nothing
   * was being lost, but it was unstructured and therefore unsearchable and
   * un-rankable. These two fields are the structure.
   *
   * Empty string when the reader brought nothing, which is most of the time.
   * Reader-supplied material is UNVERIFIED and never becomes corpus; the
   * CONTRACT says so to the answering layer, and these fields exist so the
   * operator can find the ones worth opening. */
  reader_source_url: string;
  reader_source_passage: string;
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
  /* The optional adjective group is load-bearing. Without it this missed "this
   * audit's own ANALYTICAL vocabulary" — the marker read false while the answer
   * did exactly what it was measuring for.
   *
   * IT WAS WRITTEN \\w+\\s+ AND WAS THEREFORE INERT FROM THE DAY IT WAS ADDED.
   * Inside a regex LITERAL, \\w matches a literal backslash followed by "w",
   * not a word character, so the group could never match an adjective and the
   * exact case this comment describes kept failing. Corrected to \w+\s+
   * 2026-08-12 (Thread 30), found on the live record sb-20260812-001, whose
   * answer said "is this audit's own analytical frame" and was scored false.
   *
   * MEASURED, SO NOBODY OVERSTATES IT: the repair moves 10 of 65 records to 12.
   * It does NOT explain the standing gap between this marker (~15%) and reading
   * the answers by hand (~65-80%). That gap is the one governance sections 4 and
   * 5c describe, and it is not a bug — the regex only ever matches phrasings
   * somebody imagined. Read the answers. */
  frameworkVocab:
    /(the corpus'?s?|this audit'?s?|the framework'?s?) own (\w+\s+)?(vocabulary|term|construct|frame|language)|not (a )?terms? (from|used in|you will find in) the scholarship|register note|(vocabulary|terms?) (is|are) the (corpus|audit|framework)'?s?/i,
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
    reader_source_url: { type: 'string' },
    reader_source_passage: { type: 'string' },
  },
  required: [
    'installable',
    'kind',
    'route',
    'target_entry',
    'summary',
    'note',
    'reader_source_url',
    'reader_source_passage',
  ],
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

reader_source_url: if the QUESTION contains a url the reader pasted, put it
here exactly as they wrote it. Empty string otherwise. Do not invent one, do
not resolve a citation into a url, and do not copy a url out of the answer —
only a url the reader themselves supplied.

reader_source_passage: if the QUESTION contains a quoted passage or an extract
the reader pasted, put it here verbatim. Empty string otherwise. Verbatim
matters: this is the text the operator will check against the real document, so
a paraphrase makes it useless. If they pasted a long extract, keep the part
carrying the claim.

A reader who brings a source is doing the thing this tool exists for, so mark
these carefully. Note that what they bring is UNVERIFIED: nobody has opened it.
Capturing it is not endorsing it, and installable should still be judged on
whether there is something to act on.

When installable is false, still fill kind and route with your best reading;
they are ignored downstream.`;

/* Haiku, not Opus, and this was the operator's call rather than mine.
 *
 * The project default is Opus 5 and downgrading for cost is not a decision to
 * make quietly. The operator raised cost directly after the first seven real
 * queries, which settles it. Triage is extraction and classification over an
 * answer that has already been written — the reasoning happened upstream.
 *
 * ~$0.028/query on Opus 5 against ~$0.0055 here. Change the string back and
 * update TRIAGE_IN/OUT_PER_MTOK in app/api/ask/route.ts to 5 and 25 to revert. */
const TRIAGE_MODEL = 'claude-haiku-4-5';

/** Haiku 4.5 returns a 400 for `effort`; the Opus and Sonnet lines accept it. */
const SUPPORTS_EFFORT = !TRIAGE_MODEL.includes('haiku');

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
    /* effort is NOT universally supported — Haiku 4.5 rejects it with a 400,
       and this cost twenty records to learn. Only send it on models that take
       it, so swapping TRIAGE_MODEL never silently breaks capture again. */
    output_config: {
      ...(SUPPORTS_EFFORT ? { effort: 'low' } : {}),
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

  /* Ordinarily a non-installable exchange keeps no triage block, which is right:
     most exchanges report what the corpus already says and staging them all
     would make the backlog unreadable inside a week.

     BUT NOT WHEN THE READER BROUGHT A SOURCE. A researcher who pastes a url and
     a passage has done the thing this tool exists for, and the answer being
     "the corpus already carries this" is a judgement about the corpus, not
     about their contribution. Dropping the block there would lose the structured
     capture and leave them looking at a contribution view that never mentions
     what they brought. The verbatim text would survive in trigger_context, which
     is exactly the unsearchable state this schema change exists to fix. */
  const broughtSomething = !!(parsed.reader_source_url || parsed.reader_source_passage);
  if (!parsed.installable && !broughtSomething) return { triage: null, usage };

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
