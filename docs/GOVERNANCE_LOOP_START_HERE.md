# Governance Loop — START HERE

**Read this first in a new thread.** It is the handoff for wiring the query
layer into the C1/C2/C3 governance pipeline.

Date of handoff: 2026-08-03

**Work on `main`.** Everything described below is merged there: Locate, the
answering layer, and this document. The `answering-layer`, `locate-affordance`
and `guide-and-glossary` branches are fully contained in `main` and are safe to
delete.

Commit hashes changed on 2026-08-03 after the eight most recent commits were
re-authored from a client GitHub account to CTaylor-ux. The pre-rewrite state
is retained in `refs/original/` and is not pushed. Any hash referenced in an
older document will not resolve.

---

## 0. The one-paragraph version

Seven Window HTML timelines are generated from a governed JSON corpus of 690
entries. A Next.js shell wraps them without modifying them. That shell now has
two query affordances: a deterministic year lookup (**Locate**, no model) and a
model-backed answering layer (**Ask**, all 690 entries in context, prose out,
citations validated server-side). Both work. Neither persists anything. The next
job is to capture what they produce so it can be routed back into the corpus
under the approval discipline the PRD family already specifies.

---

## 1. Where things are

| What | Path |
|---|---|
| Shell app (all work happens here) | `~/Desktop/silicon-altar-shell` |
| Audit repo (**READ-ONLY**, never write) | `~/Desktop/Silicon_Altar_LIVE` |
| PRD family | `~/Desktop/Silicon_Altar_LIVE/Silicon Altar Platform PRD Family/` |
| Query ledger (1 hand-written record) | `~/Desktop/Silicon_Altar_LIVE/query_ledger.json` |
| Query layer spec | `docs/RAG_SPEC.md` (§1–2 BUILT, §3 superseded — see §6 below) |

The shell is a **sibling** of the audit repo, not nested. `corpus_integrity_check.py`
check C9 hard-fails on stray root `*.html`, so nesting breaks the audit.

`.env.local` holds `SILICON_ALTAR_REPO` and `ANTHROPIC_API_KEY`. Gitignored.

---

## 2. What is built and verified

### Derived artifacts (build step, audit repo untouched)

- `scripts/prepare-windows.mjs` — injects `data-entry-id` into the generated
  window HTML plus a `postMessage` bridge. Matching key is `(window, lane, title)`,
  unique across all 690. **Verified:** `corpus_integrity_check.py` reports all
  hard checks pass; C9 byte-compares regenerated HTML.
- `scripts/prepare-corpus.mjs` — emits two files:
  - `lib/corpus.generated.json` — title-level, drives Locate. 690/690 normalize.
  - `lib/corpus.prompt.txt` — full text with bodies, links, thread memberships,
    plus the corpus's `scope_note` and `framework_spine`. **~149k tokens.**
    Output is byte-stable across runs (sorted by id) — this is what keeps the
    prompt cache valid. Do not reorder it.

### Query layer

- `lib/locate.ts` + `app/api/locate/route.ts` — deterministic, no model, no key.
- `lib/ask.ts` — the model contract, section parser, citation validator, situating.
- `app/api/ask/route.ts` — Claude Opus 5, direct `fetch`, key server-side.
- `components/QueryBar/` — prose rendering, live citations, outside region,
  situating band, scrollback, drag-resize.

### Verified behaviour

- Seven windows: 77 / 85 / 97 / 69 / 72 / 188 / 102 = 690. Glossary bound in
  every one, member class set, no provenance leaks.
- Citation guard: fabricated ids are stripped from the prose and surfaced to the
  reader. Tested with synthetic ids in both the answer and outside sections.
- Cache: first call writes ~149k tokens (~$0.98), subsequent reads cost ~$0.09.
  `cache_read_input_tokens` confirmed non-zero on the second call.
- Across four live queries, **every** cited id resolved. Zero fabrications.

---

## 3. Decisions already made — do not re-litigate

**No forced JSON schema on the answering call.** The original spec decomposed
every sentence into a claim record. Building it showed the cost: a model writing
into `claims[]` writes short, flat, clause-like prose, which is the exact
quality the layer exists to produce. Provenance now comes from inline
`[entry-id]` citations validated server-side, plus coarse section markers.
**Validate the references, not the structure.**

**Structural separation, not badges.** "What the corpus says" and "what I know
that it doesn't" are physically separate regions. Badges inside prose stop being
read within a week of familiarity; layout does not.

**No vector search for answering.** 690 entries fit in one call. Retrieval would
add a step that can miss in exchange for nothing. Vectors are still needed for
C1 dedup and corpus-touch detection — a different job. See §5.

**Posture goes AFTER the cached corpus block.** If operator and member get
different system blocks and the system block stays first, the prefix forks and
you pay two cache writes. Both postures must share one warm prefix.

**No `requestAnimationFrame`.** It does not fire reliably in this rendering
context, inside the iframes or in the parent. Use timers or effects.

**Cost is captured but not rendered.** A price attached to a claim invites the
reader to value evidence by what it cost. Data rides on `QueryResult.usage` and
the server log.

---

## 4. The disposition vocabulary is out of sync — fix this first

`query_ledger.json` defines seven dispositions, all of which assume incoming
material is **additive**: `corpus-complete`, `enrich-connection`,
`enrich-dossier`, `enrich-construct`, `new-entry`, `companion-material`,
`decline`.

There is no slot for *this challenges an entry you already have*.

**But the PRD family already has it, in two places:**

- C2 `candidate.kind ∈ content | design_amendment | framework_amendment | **correction** | question`
- C2 `candidate.route ∈ novel | staged_merge | **corpus_touch**`
- P0 flow: `~ corpus node ........ ALWAYS flag to operator (edit-against-corpus)`
- C3 gives `corpus_touch` the highest-scrutiny path: "changing published content
  is never bundled into a routine yes."

**Do not invent a new name.** Sync `query_ledger.json` to the PRD vocabulary.

Worked example from 2026-08-03 (use as the first record):
a reader challenged `E-W0-010-01`'s claim that "star fort" is a 16th-century
European form. The system conceded the entry dates a form by its European name,
which the corpus condemns everywhere else (`E-W0-014-03`, `E-W0-002-05`,
`E-W0-039-02`), while holding that the HELD-NULL survives because the electrical
claims fail independently. That is `kind='correction'`, `route='corpus_touch'`.

---

## 5. What has to be built, in order

### Phase 1 — Triage + record ✅ BUILT 2026-08-04

`lib/record.ts` + `scripts/records.mjs`. Every exchange appends to
`records/queries.jsonl`; a triage call (Opus 5, effort low, forced JSON schema)
flags the minority that are installable. Field names are C2's `candidate`
columns verbatim, so the Neon move is a COPY.

Review with `npm run records`: bare for the open queue, `--show <id>` for one in
full with its decision history, `--set <id> <status> [reason]` for the C2
lifecycle, `--demand` for which entries answers lean on, `--stale` for
corrections whose target text has moved.

`prepare-corpus.mjs` now emits a per-entry `contentHash`; a correction pins the
hash of the text it argued with, which is what `--stale` compares.

Structured output IS correct here — the opposite of the answering layer's call.
Forcing a schema onto prose degrades prose; forcing one onto a classification is
what a classification is.

Triage runs on `claude-opus-5` per the project default. `claude-haiku-4-5` is a
one-line change in `TRIAGE_MODEL` and roughly a quarter of the cost —
the operator's decision, not one to make silently.

**Verified:** a correction query staged `correction/corpus_touch` against
`E-W0-010-01`; a plain date lookup logged as demand only. Status changes append
rather than rewrite. Rejecting without a reason is refused. Stale detection
proven by perturbing the derived corpus.

### Phase 2 — Extraction pass

Converts a triaged exchange into a SCHEMA v2.2-shaped candidate
(entry-shaped, source-shaped, dossier-shaped).

**Make this a SECOND model call.** Do not add it to the answering call — that
reintroduces the forced-schema problem from §3. It runs only on the minority of
exchanges that survive triage, so it is cheap, and it can use a smaller model
since it is extraction rather than reasoning.

### Phase 3 — Postgres

C2's DDL is already written; this step is mechanical. Add:
- `pgvector` + an embedding model (none wired today — this is the real blocker
  for C1 routing)
- `corpus_node_vector` mirror. C2 specifies the L1 generator refreshes it after
  every install. **The generator does not do this today.** That hook is missing.

### Phase 4 — C1 routing, then C3 approval surface

Three-route classification by cosine distance. Then package assembly,
`install_contract`, the approval wall, reciprocal cross-window writes, atomic
install, byte-identical assertion on `assert_unchanged` windows.

---

## 6. Two rules to write into the schema before it holds data

**Staged content must never be an input to answering.** `candidate.raw_content`
is model-generated prose sitting beside the corpus. Without this rule the model
eventually cites its own prior output as though it were corpus. C2 already
applies the instinct in the other direction — `corpus_node_vector` is "never the
source of truth" — but nothing currently forbids the reverse flow.

**A `corpus_touch` candidate must pin the entry text it was written against.**
C3 re-validates for drift at install time, which covers most cases, but a
correction targets a specific wording and you will want to know which.

---

## 7. Known open items

**Contract**
- The `LENGTH` instruction does not work. Output rose from 4,051 to 5,017 tokens
  after it was added. Use a token cap instead of asking.
- Inconsistent inference flagging. It marks small inferences carefully and lets
  large reframings pass unmarked. Observed twice.
- Does not know where the reader is standing. "What's the mechanism here?" has
  no referent. Fix: pass current window as ambient context, **after** the cached
  block. Does not require a cache re-write.

**Corpus findings surfaced by queries, not yet acted on**
- `asiento-1713` — 7 inbound links, no entry. Most-linked dangling target.
  21 dangling targets total, 31 of 1,625 links (~1%).
- `E-W0-010-01` — the naming-argument correction described in §4.
- Treaty of Utrecht 1713 — body-only, no entry, while the framework spine is
  built on Track A being the Asiento.
- 26 of 36 well-known instruments inside the corpus's own themes are absent
  entirely. Clusters: Reconstruction enforcement, Chinese exclusion (Page/Geary),
  Indian law post-allotment, New Deal labour exclusions.

**Not built, deliberately**
Streaming, operator/member posture split, on-demand dossier fetch, auth,
deployment, rate limiting. (The ledger write is now built — see Phase 1.)

**Security note:** there is no rate limit. Not a problem on localhost. The day
this is deployed without auth, it is an open tap on the API key at ~$0.09/query.

---

## 8. Verification commands

```bash
cd ~/Desktop/silicon-altar-shell

npx tsc --noEmit                  # must be clean
node scripts/prepare-corpus.mjs   # 690/690, byte-stable output
node scripts/prepare-windows.mjs  # then run the audit repo's integrity check
```

Never run `npm run build` while `npm run dev` is running. Both write `.next` and
killing a build mid-write corrupts it (`TypeError: e[o] is not a function`).
Recovery is `rm -rf .next` and restart.

Batch test queries within five minutes of each other. Outside that window the
cache expires and every query costs ~$0.98 instead of ~$0.09.

---

## 9. Stress tests worth re-running after any contract change

These probe the failure that matters — fluency papering over thin evidence.

1. `Tell me about the mound network as a distributed capacitor array and the star fort geometry on the silicon substrate at Cahokia.`
   `E-W0-010-01`'s **title asserts and its body retracts.** Tests whether the
   body is being read. Passed 2026-08-03.
2. `How old is the A00 lineage and what does that establish?`
   `E-W0-013-01` title says 338,000; body carries Elhaik's 208,300 and Krahn at
   ~200,000. Tests whether the dispute survives. Not yet run.
3. `Did Africans reach the Americas before Columbus? What does the corpus say about Abu Bakr II?`
   The name in the question is itself a 19th-century mistranslation per
   `E-W0-008-01`. Tests whether general-knowledge pull overrides corpus
   restraint. Not yet run.
4. `Walk me through how the Software was installed on the American Levant.`
   Uses the corpus's own framework vocabulary as if it were standard
   terminology. Tests whether tier A *interpretive* content gets flagged as the
   audit's construct. **Highest stakes — not yet run.**
