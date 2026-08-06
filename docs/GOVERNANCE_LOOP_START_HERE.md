# START HERE

Read this first in a new thread. It is written to be read cold.

Last updated 2026-08-06, after the first corpus promotions (see §5b) and the
dossier-line change. Both repos are on `main` and pushed as of the audit repo's
1713 batch; nothing is uncommitted.

---

## 0. What this is, in one paragraph

Seven Window HTML timelines are generated from a governed JSON corpus of 700
entries. A Next.js shell wraps them without modifying them. The shell has two
query affordances: **Locate** (deterministic year lookup, no model) and **Ask**
(all 700 entries in context, prose out, citations validated server-side). Every
exchange is recorded to `records/queries.jsonl`; a triage pass flags the
minority containing something installable. **The first promotions landed
2026-08-06 — and none of them came from a recorded query. Read §5b before
trusting the loop's shape.**

---

## 1. Where things are

| What | Path |
|---|---|
| Shell app — all app work happens here | `~/dev/silicon-altar-shell` |
| Audit repo — **READ-ONLY from the app** | `~/dev/Silicon_Altar_LIVE` |
| PRD family (P0, C1, C2, C3) | `<audit>/Silicon Altar Platform PRD Family/` |
| Query ledger (1 hand-written record) | `<audit>/query_ledger.json` |
| Query layer spec | `docs/RAG_SPEC.md` — §1–2 built, §3 superseded by this file |

Both repos are private, on GitHub under CTaylor-ux. The shell is a **sibling**
of the audit repo, never nested.

**Both moved off `~/Desktop` on 2026-08-06 and must not move back.** The Desktop
is iCloud-synced, and when the disk filled, macOS silently evicted local copies
of project files, leaving stubs it then could not re-download. `git` began
failing intermittently with "not a git repository" on a repo whose `.git` was
demonstrably intact seconds later, and `.env.local` — the only copy of the API
key, not in git — became permanently unreadable. `~/dev` is not iCloud-managed.
The Desktop copies still exist and are damaged; ignore them.

`.env.local` holds `SILICON_ALTAR_REPO` and `ANTHROPIC_API_KEY`. Gitignored.

Git identity is pinned per-repo to CTaylor-ux (`user.name`, `user.email`,
`credential.username`). The machine's global identity is a different account —
do not "fix" it.

---

## 2. What is built

**Derived artifacts.** `scripts/prepare-windows.mjs` injects `data-entry-id`
plus a postMessage bridge into the generated HTML. `scripts/prepare-corpus.mjs`
emits `lib/corpus.generated.json` (title-level, drives Locate, carries a
per-entry `contentHash` and `titleOnly`) and `lib/corpus.prompt.txt` (bodies,
links, threads, scope note, framework spine, and per-entry source state — **~218k tokens**, the cached
prefix, byte-stable across runs so the cache survives).

**217 entries carry no body, and that is a convention, not a defect.** W1, W2
and W5 put the detail in the dossier and let the title carry the claim; W0, W3,
W4 and W6 put it in `body`. All 700 have a dossier behind their `event_id` —
verified, no exceptions. Until 2026-08-05 the prompt shipped only a `hasDossier`
boolean, so those 217 reached the model as a bare title: 31% of the corpus, 66%
of W5. `prepare-corpus.mjs` now emits two dossier lines for them — the framework
element (`streams.explanation`) and the weight/warrant badges. An assertion
fails the build if any entry would ship as a bare title. Never report an empty
`body` as missing content without checking dossier coverage first.

**Query layer.** `lib/locate.ts` + `/api/locate` (no model, no key).
`lib/ask.ts` — the contract, section parser, citation validator, situating.
`/api/ask` — Opus 5 through the official SDK. `components/QueryBar/`.

**Record layer.** `lib/record.ts` (append-only JSONL, triage, quality markers),
`/api/recover` (rebuild records from browser sessionStorage), `/api/warm`,
`scripts/records.mjs` (`npm run records` with `--show`, `--set`, `--demand`,
`--quality`, `--stale`, `--sources` for the demand-ranked reading list, and
`--quality --since <id>` to read one batch on its own),
`npm run keepwarm`.

**Verified.** Seven windows at 77/85/97/79/72/188/102 = 700, glossary bound in
each, no provenance leaks. Across 61 recorded queries: **zero
fabricated citations.** Cache reads confirmed non-zero. Status changes append rather than
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

**No vector search for answering.** 700 entries fit in one call. Vectors are
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

**The 16% framework-vocabulary figure was a fourth marker failure, and this
file spent a revision treating it as the system's one real weakness.** Read
literally, the marker asks whether an answer says that Software, Hardware and
the Managerial Class are the audit's constructs rather than the historical
record. Scanning the same 31 answers for that attribution *however phrased*
finds it at **65%**, not 16%. The answers were writing "the corpus calls this a
jurisdictional instrument" and "the corpus's framework line calls it a bilateral
treaty" while the regex waited for "the audit's own vocabulary." The behaviour
was largely there; the number was measuring its own phrasing.

The honest statement is that framework-vocabulary flagging is **unmeasured**.
Do not quote 16%, and do not build against it until something counts the
behaviour rather than one wording of it.

Secondary and softer: the outside region is used 55% of the time and is missing
precisely where it would help most — geology, current events. Thread-naming
drops on meta-questions (about the corpus's method rather than its content),
which is probably correct behaviour rather than a regression.

---

## 4b. The second batch — the dossier lines (2026-08-05)

20 records, ~$4.73, run against §2's dossier-line change and read with
`--quality --since sb-20260805-025`.

**The result: the 210 title-only entries went from unusable to used.** Within
W1/W2/W5 — controlling for the fact that the batch was deliberately aimed at the
material the change touched — title-only entries took **14.6% of citations
before and 39.8% after**, against a 56.8% share of the entries available there.
Corpus-wide the share went 4.5% → 32.7%. This is the load-bearing number
because it counts resolved entry ids, not prose: it cannot fail the way the
markers have four times now.

**The unplanned result is better than the planned one.** The weight and warrant
badges let answers report the corpus's own thinness. Asked how well-evidenced
Reconstruction violence is, `sb-20260805-033` opens "Honestly? Thin, and the
corpus says so itself" and walks the buckets individually — Meridian one of five
sourced, Opelousas two of three unsourced, Eutaw two of three, Clinton two of
three — each pinned to an entry id. `sb-20260805-028` reports Tulsa as present
"as an event and essentially nothing more." Before the change the model could
not tell a sourced W5 entry from an unsourced one; both arrived as a bare title.
**This is the audit reporting its own holes, and it is a research instrument in
its own right — not a side effect of a citation fix.**

**What did not move:** framework vocabulary. Marker 16% → 25%, same-phrasing
scan 65% → 80%; both within noise at n=31 and n=20. The change was justified
partly as the structural fix §4 called for, and it is not one, because §4's
premise did not hold.

**Read sceptically.** One batch, n=20, questions written by the same agent that
wrote the change and aimed at the material it touched. The arithmetic corrects
for the aim; the experimental design does not. The outside-region drop to 25% is
that design, not a regression — it fires on questions with an outside hook and
this batch was corpus-internal.

---

## 5. Verified corpus defects — highest-value work, operator's to apply

Surfaced by queries, then **independently verified against `entries.json`**
rather than taken on the model's word.

1. **~~All 31 dangling `thread_links` are in W3~~ — 9 repaired 2026-08-05,
   22 remain.** See audit commit `88825cc` and `t24_w3_thread_link_repair.py`.
   The root cause was one mistake: W3 is also the only window that ever wrote
   entry-id-style link targets (71 of them) against a corpus-wide `event_id`
   convention (1523 of 1594 resolved links), because its authors guessed
   `wN-year-lane` strings instead of naming the event. Repairs point at
   `event_id`s. Reading the citing prose overturned three id-shape matches —
   `w4-1823-legal` is Johnson v M'Intosh in the *financial* lane, not the legal
   one. Of the remaining 22: three are held decisions, not rot
   (`plecker-racial-integrity-1924` and `w5-1924-population` are two of three
   reserved slugs for one node whose canonicalization is open per
   `sb-20260724-047`, with the T-NOUN-TO-ADJECTIVE charter deliberately not
   auto-applied per `sb-20260726-087`/`-106`; `w5-1868-population` has no
   warrant in the citing prose). The other 19 point at entries that were never
   written, 8 of them at the missing 1713 Utrecht/Asiento anchor that the
   framework spine runs Track A through. **That part is authoring, not repair.**

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

## 5b. The first promotions happened, and not through the app (2026-08-06)

**Everything §6 was waiting for got done in one session, by conversation.** The
1713 Asiento authored from the primary, Article XXXIX and Article XLII read and
entered, two links of the pre-1713 chain built, four backlog records opened or
closed, T-ASIENTO made continuous 1518 to 1750. Audit commits `8b743af` through
`t25f`.

**None of it came from a recorded query.** 51 records, zero promotions. One
conversation, seven.

The difference is not the interface and it is not the model. It is tools. The
answering layer can read the corpus and say *this is missing*. It cannot open the
source, check the claim against `entries.json`, and write the entry. Every one of
today's promotions required leaving the corpus: fetching a 1713 contract scan,
finding the text truncated at Article XXVII, having the operator read Article XLII
by eye, and discovering that **both** external accounts of the crown's profit share
were wrong.

That reframes item 3 below. The extraction pass assumes records contain findings
that need packaging. They do not. A record can only ever contain *the corpus
noticing its own absence*, because that is all the answering layer can see. The
resolution step — go and read something — has no representation in the loop at all.

**What to do with that is genuinely open.** It might mean giving the answering
layer retrieval tools. It might mean the record layer's job is narrower than
assumed: surface absences well, and expect a human-plus-tools pass to resolve them.
It might mean the query loop is a *detection* instrument and was mis-scoped as a
*promotion* instrument. Do not resolve this by building; resolve it by watching
which one produces corpus changes over the next month.

**The measurement to keep:** promotions per session, split by whether the session
had tools. Today: recorded queries 0, tool-session 7.

---

## 5c. NEXT BUILD — sources into the prompt ("B"), specced 2026-08-06

**The gap.** `src-` appears **zero times** in `corpus.prompt.txt`. `serializeEntry`
emits head, title, body-or-dossier-lines, `links:` and `threads:`, and nothing
else. `sources.json` — 584 records carrying tier, `link_status`, url,
`verified_date` — has never reached the answering call. The model has never known
which sources back an entry, or that sources exist.

**Why that matters more than it sounds.** `link_status` is not reader telemetry.
It is a hand-maintained record of whether anyone on this project has OPENED a
source: 443 `live_verified`, 138 `citation_only` (identified, text not read).
The corpus therefore already knows things the answering layer cannot see:

- **60 tier A entries have zero opened sources.** W0 40, W3 14, W1 6.
- **15 entries carry no `source_ids` at all.**
- W0 is at 42% of sourced entries having an opened source; W6 is at 100%.

Ask "how well evidenced is this?" today and the model answers from a tier letter.

### The build, three edits and one deploy

1. `prepare-corpus.mjs` reads `sources.json` beside `dossiers.json` and emits one
   line per entry:
   `sources: [A live_verified] src-assiento-contract-1713 https://archive.org/details/cihm_28677`
2. One line in `CONTRACT` forbidding URLs in prose. Links belong in the dossier.
   **Must ship in the same change** or it costs a second cache write.
3. Regenerate, deploy, one write.

**Measured cost, not estimated.** 685 of 700 entries gain the line. **+41k tokens**
(177k to 218k, against a 1M ceiling). Cold write $1.77 to $2.18. Read per query
$0.088 to $0.109. A 20-question sitting goes $3.53 to $4.36.

### Build alongside: `npm run records -- --sources`

Chain `cited_entry_ids` to `source_ids` and rank by demand. Zero API cost, purely
local. Measured across the 51 records: answers implicated **328 distinct sources**,
**82 of them never opened**, and **281 of 933 source-citations (30%) point at
unopened material**. Top of the queue is `src-corporate-caselaw-layer-1602-1713`,
reached **27 times**, tier C, an internal project document. The audit citing
itself, unverified, more than any external source.

Useful with or without B, and it is what turns "which should I check?" into a
ranked list.

### How to measure B, and how not to

There is **no clean counter** here, unlike 4b's title-only citation share. What
changes is how the model reasons about evidence, not which entries it cites.

**Do not build a marker.** Four have now misled, including the 16% that §4 treated
as the system's main weakness for a whole revision.

Measure by reading. Ten targeted evidence-quality questions, ~$4: how well
evidenced is the Moroccan recognition claim (`w3-1777-certification`, tier A, both
sources `citation_only`); where is the corpus weakest; what should I read first;
which entries have no sources. Right now those are unanswerable, so any correct
answer is signal.

### RESULT (2026-08-06). Shipped as `096fa0e`, ten questions read.

**It works, and the cost model was pessimistic.** $3.02 for ten questions, of which
$1.45 was the cache write. The real 1h-TTL write rate is about **1.3x input, not
the 2x assumed above** — every write figure in this file is therefore high.

Ten of ten answers reason about source state. Zero pasted a url, so the CONTRACT
rule held. Zero fabricated citations; the record is 61 for 61.

**What it can now do.** Asked for a claim worth verifying, `sb-20260806-009` chose
the Bubble Act at `w3-1720-financial`, on the grounds that it is tier A, argues
against the standard historical account, and rests on "a Wikipedia page on the
statute plus an internal timeline file at tier C, with no monograph and no primary
text read." Verified exactly right. It picked the target BECAUSE it could see the
sourcing was weak relative to the claim. That was structurally impossible the day
before. `sb-20260806-007` found `w3-1711-financial` (SSC incorporation, tier C, no
sources at all) and sorted sourceless entries into declared versus undeclared
absence.

**Where the prediction was wrong, and the answer was better.** §5c expected "which
window is weakest" to return W0 at 42% opened sources. It returned **W5**, reading
the dossier badges rather than a derived statistic, then went further than the
metric could: W5's tier C sources are Chronicling America SEARCH QUERIES rather
than documents ("what a hit-count establishes is coverage volume, not framing"),
and four entries record their own source cutting against their claim
(`E-W5-010-02` "IS UNTESTED HERE", `E-W5-019-04`, `E-W5-005-02`, `E-W5-038-03`
"CONTRADICTS"). All four quotes verified verbatim. Not a wrong answer; a
methodological critique nobody had asked for.

**A FIFTH marker failure, committed while writing the section that warns about
them.** The scan for source-state language counted 8 of 10. Reading them, it was
10 of 10: two answers reasoned about evidence in wording the regex did not
anticipate. Same failure as §4's 16%. The rule stands and apparently needs
restating every time: **read the answers**.

### Decided and NOT being built

- **Source links rendered in answers: withdrawn.** Citations are already clickable
  (`QueryBar.tsx:444` -> `onGoToTarget`) and lead to the window, the dossier, and
  the sources with their tiers and notes. Raw links in the answer would compete
  with that path, look more clickable, and land readers on a scan with no context.
  The answer already has something better. This also avoids growing the client
  bundle from 226 KB to 385 KB.
- **Fetching in `/api/ask` ("C"): deferred.** Needs the `corpus_touch` route
  (§7) built first, and a guard for source claims that does not exist. The
  citation validator checks `[entry-id]` and nothing else. Today's Assiento OCR
  truncated at Article XXVII of 42; the app would have read two thirds of a
  document and sounded certain.
- **Batch verification: later, and offline.** Not in the answering path. Only
  **16 of the 82** demanded-unopened sources have a URL; 58 of the bibliography's
  unopened records are academic monographs. Automation triages, it does not clear
  the queue.
- **Reader contributions: decided, not built.** Anything reader-supplied goes to
  the candidate queue, never into the answering context. §3's staged-content rule
  should be widened from "past records" to "nothing user-supplied" before someone
  reads the narrow wording as permission.

---

## 6. The build queue, revised after the batch

**Phase 2 was next. It no longer is.** The triage summaries proved actionable
enough to sort and rank 25 findings without opening a single full answer. The
bottleneck is not record structure — it is that nothing has been promoted yet.
Building the extraction pass before one manual promotion is building on a
guess.

1. ~~**Apply the verified defects by hand** (§5).~~ **1713 is done** (§5 item 1,
   §5b). Authored from the primary, five lanes, dossier with four hypotheses, all
   eight inbound links resolved. What remains of §5: `E-W6-029-04` and the
   `w3-1778-financial` Rothschild assertion, both still untouched.
2. ~~**One contract fix** — framework vocabulary.~~ **Withdrawn.** §4's 16%
   was a marker artifact; there is no measured weakness here to fix. If the
   behaviour is worth pursuing, the first move is a counter that measures it,
   not another contract edit. Every `CONTRACT` edit costs a cache write, so
   nothing should be spent against a number that does not hold.

   **Replaced by §5c: sources into the prompt.** Fully specced, costed and
   sequenced there, including what is deliberately not being built. Start with
   `--sources`, which costs nothing and is useful on its own.
3. **Phase 2, the extraction pass** — record → SCHEMA v2.2 install package.
   **Read §5b before starting this.** The premise, that records hold findings
   needing packaging, did not survive the first real promotions. Records hold
   *absences*. Whatever gets built here has to account for the resolution step,
   which currently happens entirely outside the loop.
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

**Cost.** ~$0.19 per query on a warm cache, ~$1.45 to write it cold at 218k, up
from $0.09/$1.50 since the prefix grew. TTL is 1 hour (the API maximum)
and a read refreshes it, so steady questioning keeps it alive for free.
`npm run keepwarm` touches it every 50 minutes across breaks — worth it over an
hour's gap, pointless during active use.

The model is Opus 5 at **$5/$25 per Mtok**, cache read 0.1x. The 1h-TTL write was
assumed to be 2x and MEASURED at about 1.3x on 2026-08-06 ($1.45 for a 218k
prefix), so any write figure derived from the 2x assumption is high.
Those rates reproduce the recorded `estimatedCostUsd` to the cent; use them
rather than re-deriving. **The context window is 1M, not 200k** — an earlier
sizing pass assumed 200k, concluded the dossier layer could not fit in one call,
and inferred that answering needed retrieval. It does not. §3 stands: the whole
dossier layer would fit at ~690k if it were ever wanted.

**Every edit to `CONTRACT` in `lib/ask.ts` invalidates the cache** and costs a
$1.74 write on the next call. Batch contract changes; never edit mid-batch.

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
node scripts/prepare-corpus.mjs   # 700/700, byte-stable
npm run records                   # the backlog
npm run records -- --quality      # marker spread — read sceptically, see §4
npm run records -- --quality --since sb-20260805-025   # one batch, unblended
npm run records -- --stale        # corrections whose target text has moved
```

`--quality` also prints what share of citations reached a title-only entry.
That line is the most trustworthy number the record layer produces — it counts
resolved entry ids rather than matching prose, so it does not share the failure
mode that has now caught the markers four times. Baselines: 4.5% before the
dossier lines, 32.7% after.

**`--since` matters more than it looks.** Without it a new batch is averaged
into every record that came before, and a change that worked is invisible. Ids
are UTC-date-stamped and sort chronologically, so the first id of a batch is a
valid boundary.

`--stale` becomes meaningful the moment §5 item 2 is applied: fixing an entry
changes its `contentHash`, and every record written against the old wording
surfaces. Item 1's repair already moved nine W3 entries — those hashes changed
on 2026-08-05.

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
Checking all 700 against rules extracted from their own prose needs no new
infrastructure and has never been attempted.

**`--demand` shows most entries have never been cited.** Meaningless at 31
records, worth watching at 300. It will not distinguish dead weight from
undiscoverable, which are different problems with different fixes.
