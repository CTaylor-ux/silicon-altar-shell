# Silicon Altar — Query Layer Spec v1

**Status:** proposed, not built. **Scope:** Locate + Converse. **Branch:** to be created.

This specifies the two affordances that make the query layer real: a deterministic
**Locate** lookup, and a multi-turn **Converse** surface with per-claim provenance.
It is written to be built, tested, and then revised.

---

## 0. Design commitments

Four rules inherited from `Silicon Altar Platform PRD Family/` and
`query_ledger.json`. They constrain everything below.

1. **Mapping is not integration.** A query produces a staged record, never a
   corpus change. Nothing in this spec writes to `entries.json`, `sources.json`,
   `dossiers.json`, or `windows.json`.
2. **The operator is the only bridge.** Readers can cause a record to be written.
   They can never cause a corpus change.
3. **Not a defect log.** The ledger's own framing: *"A record is not a list of
   things the corpus lacks. It is a record of the corpus doing work."* Corpus
   contribution is recorded as **credit**, with entry ids.
4. **Classify, don't quarantine.** *"Material that is not in the corpus is NOT
   contamination. It is candidate enrichment with a known verification status."*

A fifth rule is this spec's own, and it is the one that makes the rest safe:

5. **Three registers stay visually separate at all times** — what the corpus
   says (tiered, sourced), what the model or the reader brought (unverified),
   and what connects them (inference). Collapsing them produces a system that
   sounds authoritative while laundering unsourced material into the evidence base.

---

## 1. Prerequisite: normalized year

**Blocking.** `year_sort` is not a year in every window:

| windows | `year_sort` range | meaning |
|---|---|---|
| W0, W1 | 1–42, 1–33 | **ordinal row index** |
| W2–W6 | 1600–2026 | real years |

The human-readable date is in `year_label`, in these forms: `1652`, `~1100`,
`1290b`, `1492a/b/c`, `711 to 1248`, `~300 Ma`, `338K BP`, `May 1717 (...)`.
A naive four-digit regex gets 630 of 690 — it fails on the letter-suffixed and
deep-time forms. **The rules in §1.2 parse all 690** (prototyped and verified).

### 1.1 Derived field

Computed at build time into `lib/corpus.generated.json`. **Never written to the
audit repo.**

```ts
type NormalizedYear = {
  start: number | null;      // CE year, negative for BCE / deep time
  end: number | null;        // set only for ranges ("711 to 1248")
  approximate: boolean;      // leading "~"
  era: 'ce' | 'deep';        // 'deep' for Ma / BP scales
  display: string;           // the ORIGINAL year_label, never altered
};
```

### 1.2 Parse rules, in order

1. Strip a leading `~` → `approximate = true`.
2. Match `(\d+)\s*Ma` → `start = -(n * 1_000_000)`, `era = 'deep'`.
3. Match `(\d+)K?\s*BP` → `start = 1950 - n` (× 1000 if `K`), `era = 'deep'`.
4. Match `(\d{3,4})\s*to\s*(\d{3,4})` → `start`, `end`.
5. Match a leading `\d{3,4}` with an optional trailing letter (`1290b`, `1492a`)
   → `start`, ignore the suffix.
6. Match a month name followed by a year → `start`.
7. Otherwise `start = null`. The entry is excluded from Locate, never from Converse.

### 1.3 Acceptance — verified against the real corpus

| assertion | prototyped result |
|---|---|
| All 690 parse without throwing | ✅ |
| Non-null `start` | ✅ **690 / 690 (100%)** |
| No W0/W1 entry where `start == year_sort` | ✅ 0 collisions |
| `display` byte-identical to `year_label` | ✅ all 690 |

Rule 5's regex must be word-bounded with an optional trailing letter
(`\b(\d{3,4})[a-z]?\b`). A bare `\b(\d{3,4})\b` fails on `1290b` because `0`
and `b` are both word characters, so no boundary exists between them.

---

## 2. Affordance: Locate

**No model. No retrieval. No API key. Zero hallucination surface.**

Answers: *"something happened around 1120 — where does that land, and what was
happening around it across the lanes?"*

### 2.1 Interface

```ts
type LocateQuery = {
  year: number;
  windowIds?: number[];       // default: all
  laneKeys?: string[];        // default: all 14
  spanYears?: number;         // default 25
  neighbors?: number;         // default 8 each side
};

type LocateHit = {
  entryId: string;
  windowId: number;
  lane: string;               // data key; label via LANES
  tier: 'A' | 'B' | 'C' | 'D' | 'E';
  title: string;
  year: NormalizedYear;
  hasDossier: boolean;
  offsetYears: number | null; // signed distance from the queried year
};

type LocateResult = {
  query: LocateQuery;
  windows: { windowId: number; name: string; yearRange: string; hits: LocateHit[] }[];
  laneSpread: { lane: string; label: string; count: number }[];
  unparseableExcluded: number;
};
```

### 2.2 Selection

Union of two sets, deduped, sorted by `year.start` then lane index:

- every entry within `±spanYears`, and
- the nearest `neighbors` entries on each side.

The union guarantees a non-empty result in sparse regions. W0 spans deep time to
1452 across 77 entries, so a fixed window alone returns nothing for most inputs.

### 2.3 Rendering

Grouped by window, then by year, with lanes across — the same reading order the
windows themselves teach. `laneSpread` drives a small "what was running" summary.
Each hit is a target: clicking scrolls and highlights the row through the existing
`postMessage` bridge, unchanged.

### 2.4 Acceptance

- `year: 1120` returns ≥ 1 hit, all in W0, including the ~1100 Templar cluster
  and the 1139 papal grant.
- `year: 1700` returns hits from **both** W2 and W3 (their ranges overlap).
- `year: 1652, laneKeys: ['legal']` returns `w3-1652-legal`.
- No query returns zero hits for any year between 1000 and 2029.
- Response is computed without a network call and is byte-identical across runs.

---

## 3. Affordance: Converse

Multi-turn. The reader may paste anything they've read.

### 3.1 Model configuration

| setting | value | why |
|---|---|---|
| model | `claude-opus-5` | 1M context; $5/$25 per MTok |
| thinking | omit (adaptive is the default on Opus 5) | |
| effort | `output_config.effort: 'high'` | default; sweep `medium` and `xhigh` in testing |
| max_tokens | 8000, streamed | thinking + text share the cap |
| sampling | **none** | `temperature`/`top_p`/`top_k` return 400 on Opus 5 |

### 3.2 Context assembly, in render order

Order matters: caching is a prefix match, so stable content must physically
precede volatile content.

1. **System block** — the contract in §3.4. Frozen. No dates, no ids, no
   interpolation.
2. **Corpus block** — all 690 entries, compact serialization, `cache_control`
   breakpoint here. **~67,000 tokens.**
3. **Dossier block** — only for entries cited earlier in this conversation.
   Retrieved on demand; dossiers total ~268k tokens and cannot be sent wholesale.
4. **Conversation history.**
5. **The reader's turn**, with any pasted material wrapped in a delimiter and
   labelled untrusted.

Nothing after step 2 may be interpolated into steps 1 or 2.

### 3.3 Caching

Claude Opus 5's minimum cacheable prefix is **512 tokens**, so the corpus block
qualifies comfortably.

- Breakpoint on the last corpus block. `{"type": "ephemeral"}`, 5-minute TTL.
- **Pre-warm at server start** with `max_tokens: 0` and the same system + corpus
  prefix. Returns immediately, writes the cache, bills zero output tokens.
- Re-warm on an interval only if traffic has gaps longer than the TTL. If
  requests arrive more often than every 5 minutes they keep it warm themselves.
- Consider `ttl: "1h"` only for bursty traffic — the write cost doubles (2× vs
  1.25×), so it needs ≥ 3 reads to pay off.

**Cost per query, warm cache:**

| component | tokens | multiplier | cost |
|---|---|---|---|
| corpus, cache read | 67,000 | 0.1× | $0.034 |
| turn input | ~1,000 | 1× | $0.005 |
| output | ~800 | — | $0.020 |
| | | **total** | **≈ $0.06** |

First write is 67,000 × 1.25 × $5/1M ≈ **$0.42**, once per cache lifetime.

**Verify caching works:** assert `usage.cache_read_input_tokens > 0` on the second
and later requests. If it is zero across identical prefixes, something volatile
leaked into the prefix.

### 3.4 The model contract (system block)

Stated here as requirements; the prompt is written against them.

1. Anything asserted as corpus fact **must** cite entry ids present in the corpus
   block. No entry id, no corpus claim.
2. General knowledge is permitted and labelled `model`.
3. Pasted reader material is an **unverified outside claim**, never evidence. It
   is labelled `user`.
4. When the corpus does not cover something, say so plainly rather than
   substituting general knowledge silently.
5. A correlation between two corpus entries must name its **inferential step**
   and enter at tier C, interpretive.
6. `documentsOpened` is always `0` unless a verification tool actually ran. The
   ledger's rule: *"A model answering from parametric recall opens zero documents,
   and fluent recall is indistinguishable from verified fact."*

### 3.5 Response schema

Forced with `output_config.format` (`json_schema`). Every object requires
`additionalProperties: false`; no recursion; no numeric or length constraints.

```ts
type ClaimBasis = 'corpus' | 'model' | 'user';

type Claim = {
  text: string;
  basis: ClaimBasis;
  entryIds: string[];         // non-empty iff basis === 'corpus'
  tier: 'A'|'B'|'C'|'D'|'E'|'none';
  status: 'corpus-sourced' | 'unverified-parametric' | 'unverified-user' | 'disputed';
  note: string;               // '' when nothing to add
};

type Correlation = {
  statement: string;
  entryIds: string[];
  endpointsAllInCorpus: boolean;
  requiresNewFacts: boolean;
  inferentialStep: string;    // required, non-empty
  estimatedTier: 'C' | 'D';
  disposition: Disposition;
};

type Disposition =
  | 'corpus-complete' | 'enrich-connection' | 'enrich-dossier'
  | 'enrich-construct' | 'new-entry' | 'companion-material' | 'decline';

type Gap = { question: string; whatIsMissing: string; disposition: Disposition };

type AskResult = {
  answer: string;             // prose; every assertion also appears in claims[]
  claims: Claim[];
  correlations: Correlation[];
  targets: Target[];          // existing shape — drives scroll + highlight
  gaps: Gap[];
  answerBasis: {
    documentsOpened: number;
    corpusEntriesCited: number;
    remainderSource: string;
    honestyNote: string;
  };
};
```

`Disposition` is the ledger's `disposition_vocabulary` verbatim — not a parallel
vocabulary.

### 3.6 Gap surfacing

When `gaps` is non-empty the UI says so plainly and the record is written with
that gap. Per the ledger's framing this is **not** a defect log: a
`corpus-complete` answer is logged too, as evidence of coverage and demand.

Reader-facing, this is a feature rather than an apology. It makes the stated
position — improvable, not infallible — visible instead of asserted.

---

## 4. API surface

Two route handlers. Both hold the key server-side.

```
POST /api/locate   LocateQuery  -> LocateResult          no model call
POST /api/ask      AskRequest   -> AskResult (streamed)   Claude Opus 5
```

```ts
type AskRequest = {
  conversationId: string;
  question: string;
  pasted?: { text: string; source: string };  // "where did you get it"
  windowId?: number;                          // soft scoping hint only
};
```

Streaming is required — `max_tokens` above ~16k risks SDK HTTP timeouts, and the
UI needs progressive output anyway. Use `.stream()` with `.finalMessage()`.

`lib/retrieval.ts` keeps its exported signature. Only its body changes, from the
stub to a `fetch('/api/ask')`. Everything downstream — target rail, stepper,
scroll, pulse — is untouched.

---

## 5. Ledger write

One `ql-` record per exchange, appended to a **shell-side** store, never to the
audit repo's `query_ledger.json`.

Fields mirror `ql-20260727-001` exactly: `id`, `opened`, `status`, `provenance`
(`origin`, `asker`, `trigger_text`, `channel`, `signal_type`), `question`,
`corpus_contribution`, `beyond_corpus`, `correlations_surfaced`, `reader_value`,
`answer_basis`, `claims`, `if_when_how`, `author_decision`, `author_decision_date`.

Two additions, both from the earlier design conversation:

- **`corpus_commit`** — the audit repo HEAD at answer time. Without it the ledger
  silently rots and you cannot tell which records are still live.
- **`canonical_question_id` + `count`** — cluster near-duplicate questions so
  prioritization reflects what readers actually ask, not what was noticed.

`author_decision` starts `null`. Nothing is auto-promoted.

---

## 6. UI changes

The shell's query bar is currently a fixed 222px single-shot panel. Converse
needs conversation.

**Three heights, user-toggled:** collapsed (input only, ~56px), default (222px,
last exchange, current behavior), expanded (50vh, full thread). The window strip's
`inset` already derives from `--querybar-h`, so it reflows correctly.

**New elements:**

- Basis chips per claim: `CORPUS · w3-1652-legal · A` / `MODEL · unverified` /
  `YOURS · unverified`. Corpus chips are clickable targets.
- A correlations block, visually distinct from the answer, showing the
  inferential step and disposition.
- A gap notice when `gaps` is non-empty.
- A paste affordance: excerpt + "where's this from".
- A **Locate** entry point, separate from the ask box.

`--sig` stays reserved for answer→evidence pointing. Basis chips use the neutral
ramp. Nothing readable uses `--faintxt` (3.23:1) or small `--crimson` (4.28:1).

---

## 7. Failure modes

| failure | behavior |
|---|---|
| Missing API key | `/api/ask` returns 503; UI shows the existing error state; Locate keeps working |
| Model returns unparseable JSON | Forced schema makes this unlikely; on failure surface the error state, never a partial answer rendered as complete |
| `stop_reason: "refusal"` | Check **before** reading content. Surface plainly. Optionally opt into `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) |
| `stop_reason: "max_tokens"` | Answer truncated. Show it as truncated; do not present as complete |
| Claim cites an unknown entry id | Drop the target, keep the claim, downgrade basis to `model`, log it. A fabricated id must never render as a corpus citation |
| Cache never reads | Assert on `cache_read_input_tokens`; fail loudly in dev |
| Rate limit / 5xx | SDK retries twice by default; surface the error state after |

---

## 8. Test plan

**Locate** — deterministic, so assert exact output.

1. `1120` → 16 hits, W0 only. ✅ prototyped
2. `1700` → 64 hits, W2 + W3. ✅ prototyped
3. `1652` + `lane: legal` → 16 hits, includes `w3-1652-legal`. ✅ prototyped
4. Every year 1000–2029 non-empty. ✅ prototyped
5. Same query twice → byte-identical; hit ids unique (dedupe by entry id, not by
   tuple identity — an early prototype double-counted by deduping the wrong thing).

**Converse** — fixture questions with expected shapes, not expected prose.

6. *"What does the corpus say about the 1652 Rhode Island statute?"* → all claims
   `basis: corpus`, `documentsOpened: 0`, targets include `w3-1652-legal`.
7. *"Why did Cortés go to Mexico?"* → mixed basis; at least one `gap`; no corpus
   claim cites cabildo or quinto real (**neither exists** — 0 entries each).
8. Paste a paragraph + ask for correlation → ≥ 1 `user`-basis claim; any
   correlation has a non-empty `inferentialStep`.
9. *"Who won the 1998 World Cup?"* → `decline` or `gaps`, no fabricated corpus claim.
10. Fabricated-id guard: force a bad entry id, assert it is dropped and logged.
11. Cache: second request has `cache_read_input_tokens > 0`.
12. Ledger: every exchange writes exactly one record with `author_decision: null`
    and a populated `corpus_commit`.

**Regression** — the existing seven-window checks must stay green: row counts
77/85/97/69/72/188/102, placeholder chips clear, glossary tokens bound, no
provenance leaks, `corpus_integrity_check.py` all hard checks pass.

---

## 9. Not in scope

Deliberately excluded, each with the reason:

- **Vector search / embeddings.** All 690 entries fit in one call at ~67k tokens.
  Retrieval would add a step that can miss, in exchange for nothing.
- **Neon / pgvector.** Earns its place in C2 staging and correlation, not in
  serving answers.
- **The C1 correlation engine.** Designed for a firehose from a community that
  does not exist yet. P0 names the immediate win as capturing Surface B, which is
  the operator, today.
- **Archive API verification.** Phase 3. Invoked per claim, not ambient.
- **Multimodal indexing.** PRD §5.1.1 covers audio/video/images. None are indexed.
- **Auth, gating, contribution, editorial approval.** PRD Layers 2–3 and §4 tiers.

---

## 10. Build order

1. Normalized year + `prepare-corpus.mjs` → `lib/corpus.generated.json`. No key.
2. Locate: route handler, panel, target wiring. No key.
3. Converse: `/api/ask`, prompt, forced schema, streaming. **Needs an Anthropic key.**
4. Per-claim rendering, correlations block, gap notice, paste affordance.
5. Ledger write + operator review view.

Steps 1–2 ship a genuinely useful tool with no API dependency at all, and are
worth having in hand before step 3 is judged.
