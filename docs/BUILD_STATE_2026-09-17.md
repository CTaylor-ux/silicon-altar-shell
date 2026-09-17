# BUILD STATE, 2026-09-17

Measured against `thread30-beta-gate` at `9d133fd`, ten commits ahead of
`origin/main`. Every line below was read from code or from `git log`, not from a
handoff. Section 5 says how to re-check any of it.

**This supersedes Item 1 and Item 1b in `THREAD_30_START_HERE.md`, and section 6
item 6 of `GOVERNANCE_LOOP_START_HERE.md`.** Both predate these ten commits and
both understate what is built. Nothing else in either document is affected.

---

## 1. Thread 30's four items, as they actually stand

| item | state | evidence |
|---|---|---|
| **1** three beta blockers | **DONE** | `914e9cd` "Item 1: the three beta blockers, with identity underneath all three" |
| 1, rate limiting | built and wired | `checkQuota(person.id)` called at `app/api/ask/route.ts:62`, returns 429 with `Retry-After` |
| 1, access gate | built and live | `middleware.ts` gates everything but `/enter` and `/api/session`, fails closed without `SESSION_SECRET` |
| 1, deployment | built | three-stage `Dockerfile`, `.dockerignore`, `docs/DEPLOY.md`. No `vercel.json` and no CI, which is a hosting choice rather than missing work |
| **1b** contribution loop | **DONE and exercised** | `9cf4e72` builds it; `d4fe07b` "the 1b loop run end to end, on the canonical corpus, for the first time" |
| **2** W6's 31 defects | awaiting author rulings | `docket/w6_verification_thread29/w6_verdicts.json` present in the audit repo. The blocker is the frozen-field gate, not research |
| **3** W0 to W4 verification | **not started** | 410 boxes. This is the real remaining work |
| **4** cosmetic | partly done | the "12 lanes" label is already fixed, 0 hits for `'12 lanes'`. The `validate_l4` counter lines are now written, see section 4 |

---

## 2. The per-person author field is built. It is not called `author`.

Thread 30 item 1b says records must carry a per-person author and that
attribution cannot be retrofitted, so identity has to exist before the first
invited researcher asks the first question. **It does.**

`scripts/invite.mjs` mints invite codes with stable permanent ids and states the
design in its own header: the id "is written into `surfaced_by` on every record
that person creates", with an explicit warning never to reuse one for a different
human because that silently reassigns their history. `app/api/ask/route.ts:198`
sets `surfaced_by: person.id`. `invites.json` holds two, `operator` and
`test-researcher`, and two records already carry the researcher id.

`lib/quota.ts` then derives per-person caps by counting a person's own records
rather than keeping a counter, on the stated grounds that a parallel counter is
one more thing that can drift from the log. Defaults are 25 per person per day
and 60 globally, both env-tunable, worth roughly $4.75 and $11.40 a day against
the measured ~$0.19 warm and ~$1.45 cold-write costs.

**The documented blind spot, worth carrying:** `/api/ask` deliberately swallows a
record append failure so a lost record never costs a reader their answer, which
means a person whose appends were all failing would not accrue quota.
`BURST_SECONDS` is in-process and does not read the log, which is what caps a
runaway client when the record layer is broken.

---

## 3. The researcher view is built

`lib/contributions.ts`, `app/contributions/page.tsx`, `app/api/contributions/route.ts`.
It exports `contributionsFor(personId)` and `changedSince(...)`, which is the
since-you-were-last-here view, and carries a reader-facing `ReaderStatus`
vocabulary deliberately separate from the operator's `RecordStatus`.

It already encodes the operator rulings rather than leaving them open: the
disposition vocabulary is not shown because showing it invites lobbying for a
category; `analyzed` and `proposed` collapse into one "in review" because the
distinction is operator workflow and not a fact about the contribution; cost is
captured and never rendered per governance section 3; and the rejection reason is
shown prominently because for a hand-picked group each decline is how the
standard gets taught without anyone writing a manual.

**Also: the PRD vocabulary is already implemented here.** `lib/record.ts` exports
`RecordKind`, `RecordRoute` as `'novel' | 'staged_merge' | 'corpus_touch'`, and
`RecordStatus`. Those are C2's `kind`, `route` and `status` columns verbatim. So
governance section 7, "sync the ledger to the PRD", is smaller than it reads: the
model exists in the shell, and the gap is only that the audit repo's
`query_ledger.json` still carries the older single-axis seven. `lib/record.ts` is
the reference for that mapping.

---

## 4. What actually remains

1. **Item 3, 410 unverified boxes.** 290 of 700 verified. Both windows anyone has
   read came back majority-problematic. W2 first per the plan, because 43 of its
   96 sources are encyclopedia entries with five rated tier A, so a W2 pass
   answers a corpus-wide question: do the tier ratings mean anything.
2. **Item 2's author rulings.** Research is done, the frozen-field gate is not an
   engineering problem.
3. **`vercel.json` or CI**, only if the hosting choice is Vercel rather than the
   container that `docs/DEPLOY.md` and the Dockerfile already describe. Read that
   doc before assuming anything is missing.
4. **Governance section 7**, sized down as above. Not urgent: it is a prerequisite
   to Postgres, which Thread 30 defers explicitly.

Item 4's counter check is done, in the audit repo at `dd13cab` on
`thread-31-counter-check`: `validate_l4` now blocks on per-window
`entries_count`, `events_count` and `dossiers_count` disagreeing with the data,
and on any event lacking a dossier. `total_dossiers` warns rather than blocks,
because it is already drifted on main at 328 against 330 held and is fixed by
`d6873cd` on `thread30-reset-war-corrections`.

---

## 5. How to re-check any of this

```bash
cd ~/dev/silicon-altar-shell

# what the ten commits actually did, which is the fastest orientation available
git log --oneline --reverse origin/main..HEAD

# every module's purpose, from its own header
for f in lib/*.ts; do sed -n '1,6p' "$f" | grep -oE '^ \* [a-z-]+\.ts — .*'; done

# is the quota wired, or merely written
grep -n 'checkQuota\|surfaced_by' app/api/ask/route.ts

# does the gate fail closed
grep -n 'SESSION_SECRET' middleware.ts

# who has been minted
python3 -c "import json;print([(i['id'],i['role']) for i in json.load(open('invites.json'))])"
```

---

## 6. Why this document exists

Four claims were made against these ten commits during the 2026-09-16 session,
all wrong, all from reading documents or grepping strings instead of opening
code:

1. "No `middleware.ts` exists." It exists and enforces.
2. "`author` appears in zero files." A literal string grep. The concept is built
   as `surfaced_by` plus invites plus quota.
3. "The researcher view does not exist." It does, with the operator rulings
   already encoded.
4. "Governance section 7 is a remodel, not a sync." The model is already
   implemented in `lib/record.ts`.

The fastest orientation in this repository is `git log --oneline origin/main..HEAD`
followed by reading the module headers. That is about two minutes of work and it
would have prevented all four. Handoffs describe intent at the time of writing;
the commits describe what happened since.
