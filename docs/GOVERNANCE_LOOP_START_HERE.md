# START HERE

Read this first in a new thread. It is written to be read cold.

Last updated 2026-08-05, after the first real test batch (31 recorded queries).
All work is on `main` and pushed. Nothing is uncommitted.

---

## 0. What this is, in one paragraph

Seven Window HTML timelines are generated from a governed JSON corpus of 690
entries. A Next.js shell wraps them without modifying them. The shell has two
query affordances: **Locate** (deterministic year lookup, no model) and **Ask**
(all 690 entries in context, prose out, citations validated server-side). Every
exchange is recorded to `records/queries.jsonl`; a triage pass flags the
minority containing something installable. **Nothing has yet been promoted into
the corpus.** That is the next step and it is the operator's.

---

## 1. Where things are

| What | Path |
|---|---|
| Shell app — all app work happens here | `~/Desktop/silicon-altar-shell` |
| Audit repo — **READ-ONLY from the app** | `~/Desktop/Silicon_Altar_LIVE` |
| PRD family (P0, C1, C2, C3) | `<audit>/Silicon Altar Platform PRD Family/` |
| Query ledger (1 hand-written record) | `<audit>/query_ledger.json` |
| Query layer spec | `docs/RAG_SPEC.md` — §1–2 built, §3 superseded by this file |

Both repos are private, on GitHub under CTaylor-ux. The shell is a **sibling**
of the audit repo, never nested.

`.env.local` holds `SILICON_ALTAR_REPO` and `ANTHROPIC_API_KEY`. Gitignored.

Git identity is pinned per-repo to CTaylor-ux (`user.name`, `user.email`,
`credential.username`). The machine's global identity is a different account —
do not "fix" it.

---

## 2. What is built

**Derived artifacts.** `scripts/prepare-windows.mjs` injects `data-entry-id`
plus a postMessage bridge into the generated HTML. `scripts/prepare-corpus.mjs`
emits `lib/corpus.generated.json` (title-level, drives Locate, carries a
per-entry `contentHash`) and `lib/corpus.prompt.txt` (bodies, links, threads,
scope note, framework spine — **~150k tokens**, the cached prefix, byte-stable
across runs so the cache survives).

**Query layer.** `lib/locate.ts` + `/api/locate` (no model, no key).
`lib/ask.ts` — the contract, section parser, citation validator, situating.
`/api/ask` — Opus 5 through the official SDK. `components/QueryBar/`.

**Record layer.** `lib/record.ts` (append-only JSONL, triage, quality markers),
`/api/recover` (rebuild records from browser sessionStorage), `/api/warm`,
`scripts/records.mjs` (`npm run records` with `--show`, `--set`, `--demand`,
`--quality`, `--stale`), `npm run keepwarm`.

**Verified.** Seven windows at 77/85/97/69/72/188/102 = 690, glossary bound in
each, no provenance leaks. Across 31 recorded queries: **402 citations, zero
fabricated.** Cache reads confirmed non-zero. Status changes append rather than
rewrite.

---

## 3. Decisions — do not relitigate

**No forced JSON schema on the answering call.** Decomposing prose into claim
records flattens the prose, which is the one thing this layer exists to
protect. Provenance is inline `[entry-id]` citations validated server-side plus
coarse section markers. *Validate the references, not the structure.*

**Structured output IS right for triage.** Opposite call, different job:
classification is exactly what a schema is for.

**Structural separation, not badges.** "What the corpus says" and "what I know
that it doesn't" are physically separate regions. Labels inside prose decay
into wallpaper within a week; layout does not.

**No vector search for answering.** 690 entries fit in one call. Vectors are
needed for C1 dedup and corpus-touch detection — a different job.

**Posture goes AFTER the cached corpus block**, so operator and member share
one warm prefix rather than forking it and paying the write twice.

**Staged content must never be an input to answering.** Past records do not
feed future answers. Without this rule the model eventually cites its own prior
output as though it were corpus.

**No `requestAnimationFrame`** — it does not fire in this rendering context.
CSS keyframes on `::placeholder` do not run either; animate a real element.

**Cost is captured, never rendered.** A price beside a claim invites the reader
to value evidence by what it cost to produce.

---

## 4. The first real test batch — what it showed

31 records, 25 installable, ~$11.51 spent. **The most important result is that
the measurement proved less reliable than the thing it measured.**

The quality markers were wrong three times in one day. They scored a
disciplined short answer as the batch's weakest when it was among its best.
They made three correctly-adapted repeat answers look like inconsistency — the
model had noticed the repeat and deliberately varied ("that's the third time on
the same question, and I don't think a third walkthrough serves you"). And they
returned a false negative on the exact behaviour they were built to detect,
because a regex demanded two words be adjacent.

**Do not respond by building better markers.** They are free, they run at
capture time, and their job is to say *go and look* — which they did. Trust
them less; read the answers. `npm run records -- --show <id>` prints one whole.

**The one real system weakness found:** framework-vocabulary flagging sits at
**16%**. Software, Hardware, the Managerial Class are the audit's own
constructs sitting inside tier A entries, and answers usually do not say so. An
instruction-based fix worked only on the question it was tuned against. Try
something structural.

Secondary and softer: the outside region is used 55% of the time and is missing
precisely where it would help most — geology, current events. Thread-naming
drops on meta-questions (about the corpus's method rather than its content),
which is probably correct behaviour rather than a regression.

---

## 5. Verified corpus defects — highest-value work, operator's to apply

Surfaced by queries, then **independently verified against `entries.json`**
rather than taken on the model's word.

1. **All 31 dangling `thread_links` are in W3. Zero in any other window.**
   21 distinct missing targets; `asiento-1713` alone has seven inbound. The
   repair pass that fixed the other windows never ran on W3 — probably because
   W3 uses hand-written event slugs while the rest use entry IDs.

2. **`E-W6-029-04` ("The Silicon Altar") is tier C with an empty `source_ids`.**
   It carries the project's title claim and packs five distinct assertions into
   five sentences. Two independent queries landed on it. Record
   `sb-20260805-021` separates its legs by soundness — start there.

3. **Tiers D and E are declared and never used.** A 288, B 319, C 83. This is
   why HELD-NULL has to operate as a separate mechanism.

4. **`w3-1778-financial` asserts an "1815 Rothschild franchise transfer"** with
   no entry behind it. Only two entries mention Rothschild; neither is 1815.

Standing from an earlier sweep: Treaty of Utrecht 1713 is referenced in bodies
with no entry of its own, while the framework spine is built on Track A being
the Asiento. 26 of 36 well-known instruments inside the corpus's own themes are
absent entirely.

---

## 6. The build queue, revised after the batch

**Phase 2 was next. It no longer is.** The triage summaries proved actionable
enough to sort and rank 25 findings without opening a single full answer. The
bottleneck is not record structure — it is that nothing has been promoted yet.
Building the extraction pass before one manual promotion is building on a
guess.

1. **Apply the verified defects by hand** (§5). No new machinery; the
   dangling-link repair is mechanical.
2. **One contract fix** — framework vocabulary, structurally rather than with
   more prose.
3. **Phase 2, the extraction pass** — record → SCHEMA v2.2 install package,
   informed by having done (1).
4. **Postgres.** C2's DDL is already written. Add pgvector, embeddings, and a
   generator hook to refresh `corpus_node_vector` — that mirror does not exist.
5. **C3 approval wall** — package assembly, install contract, reciprocal
   cross-window writes, atomic install, byte-identical assertion.
6. **Auth, posture split, deployment, rate limiting.** Only when a second
   person touches it. **There is no rate limit today**; a public URL would be an
   open tap on the API key.

---

## 7. The disposition vocabulary is out of sync — fix before Postgres

`query_ledger.json` defines seven dispositions, all additive. None covers *this
challenges an entry you already have* — which is **24 of the 25** staged
candidates.

The PRD family already has it, twice: C2's `candidate.kind` includes
`correction`, `candidate.route` includes `corpus_touch`, and P0's flow reads
`~ corpus node → ALWAYS flag to operator (edit-against-corpus)`. C3 gives
`corpus_touch` its highest-scrutiny path. **Do not invent a new name** — sync
the ledger to the PRD.

---

## 8. Operational notes

**Cost.** ~$0.09 per query on a warm cache, ~$1.50 to write it cold. TTL is 1
hour (the API maximum) and a read refreshes it, so steady questioning keeps it
alive for free. `npm run keepwarm` touches it every 50 minutes (~$0.08) across
breaks — worth it over an hour's gap, pointless during active use.

**Every edit to `CONTRACT` in `lib/ask.ts` invalidates the cache** and costs a
$1.50 write on the next call. Batch contract changes; never edit mid-batch.

Triage runs on `claude-haiku-4-5`. **Haiku rejects the `effort` parameter** —
`SUPPORTS_EFFORT` in `lib/record.ts` guards it. Sending it silently cost 24
records before it was caught, because the triage call and the record append had
been wrapped in one try block. They are two blocks now; a triage failure can no
longer take the record with it.

**Never run `npm run build` while `npm run dev` is running.** Both write
`.next`; killing one mid-write corrupts it. Recovery is `rm -rf .next`.

**Records survive in the browser.** The app persists exchanges to
sessionStorage, so `/api/recover` can rebuild them from the tab. Idempotent on
question text.

---

## 9. Verification commands

```bash
cd ~/Desktop/silicon-altar-shell
npx tsc --noEmit                  # must be clean
node scripts/prepare-corpus.mjs   # 690/690, byte-stable
npm run records                   # the backlog
npm run records -- --quality      # marker spread — read sceptically, see §4
npm run records -- --stale        # corrections whose target text has moved
```

`--stale` becomes meaningful the moment §5 item 1 or 2 is applied: fixing an
entry changes its `contentHash`, and every record written against the old
wording surfaces.

---

## 10. Standing observations, not tasks

**Five independent answers made the same objection** — that the framework
absorbs its counterexamples and infers design backwards from outcome
(`sb-20260805-010`, `-012`, `-014`, `-018`, `-024`). One finding reached five
ways by a system reading only the corpus's own entries. Not a defect report and
not the agent's to adjudicate.

**The method audit has never been run.** The corpus states its own
methodological rules inside its entries — that a European label does not
establish European origin, among others — and at least one entry violates them.
Checking all 690 against rules extracted from their own prose needs no new
infrastructure and has never been attempted.

**`--demand` shows most entries have never been cited.** Meaningless at 31
records, worth watching at 300. It will not distinguish dead weight from
undiscoverable, which are different problems with different fixes.
