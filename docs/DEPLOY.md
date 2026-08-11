# Deploying the shell

Written 2026-08-11, Thread 30, alongside the access gate and the rate limiter.
Read `GOVERNANCE_LOOP_START_HERE.md` first; this file assumes it.

---

## 1. Not Vercel, and the reason is not preference

`lib/record.ts` appends to `records/queries.jsonl` at runtime. It is the **only**
runtime write in the app, and it is the thing the beta exists to produce —
`/api/ask` wraps the append in its own try block with the comment *"only a lost
record is a loss"*, and `/api/recover` exists solely to rebuild records from a
browser tab when the append fails.

A serverless target gives every invocation a fresh, ephemeral filesystem. Every
record would be written and then discarded, silently, with the reader still
getting a perfectly good answer — which is precisely the failure mode that cost
twenty records once already and took a while to notice.

So the target is **a host with a persistent volume**. `fly.toml` is a worked
example; Railway, Render, or a VPS running the container are all equivalent. The
requirement is a disk, not a vendor.

Postgres would also solve it and is **explicitly deferred** by the operator's own
sequencing. Do not reach for it here.

---

## 2. The build runs in two places, deliberately

`npm run build` normally runs `prepare-windows` and `prepare-corpus` first, and
both read the audit repo through `SILICON_ALTAR_REPO`. The audit repo is a
separate private repository and does not belong in a container build context.

So:

```bash
cd ~/dev/silicon-altar-shell
npm run prepare-windows && npm run prepare-corpus   # needs the audit repo
docker build -t silicon-altar .                     # compiles what they produced
```

The Dockerfile **fails loudly** if `public/windows/` or `lib/corpus.generated.json`
are missing rather than shipping a shell with no windows in it.

This is a property worth keeping: the deployed corpus is byte-for-byte the corpus
the operator just ran `verify_regeneration.py` against, not whatever the audit
repo happened to contain when a build server pulled it.

---

## 3. Secrets

Never in the image; `.dockerignore` excludes all three.

| | what it is | if missing |
|---|---|---|
| `ANTHROPIC_API_KEY` | the answering layer | `/api/ask` returns 503; Locate still works |
| `SESSION_SECRET` | signs the session cookie | **everything** returns 503 — the gate fails closed |
| `invites.json` | the invite list, on the volume | nobody can sign in |

```bash
fly secrets set ANTHROPIC_API_KEY=...
fly secrets set SESSION_SECRET=$(openssl rand -hex 32)
```

Rotating `SESSION_SECRET` invalidates every live session immediately. That is the
lever to pull if a token leaks and you cannot wait for `--revoke` to matter.

---

## 4. Where records live once there are two copies

**DECIDED 2026-08-11 (Thread 30): option A below.** Production is the only
writer; the operator pulls the file down, commits it, runs the CLI locally, and
pushes it back. Git stays the durable store. The sync belongs in the thread-close
habit, next to `npm run records -- --set <id> installed`.

The reasoning is kept below because the alternatives are live if the beta grows.

Today there is one record store and it is tracked in git. `npm run records --set`
edits the local file; git is the durable store, exactly as the governance doc
says.

Deploy, and there are two: the volume the beta writes to, and the git-tracked file
the operator's CLI reads. Item 1b's design rests on **one store, two projections**
— an operator view and a researcher view over the same records. Two physical
copies breaks that premise by a route the handoff did not anticipate.

Three ways out:

**A. Pull down and commit — CHOSEN.**
Production is the only writer. Periodically:

```bash
fly ssh sftp get /data/records/queries.jsonl records/queries.jsonl
git add records/queries.jsonl && git commit -m 'beta records through <date>'
```

Then run the CLI locally and push the file back up when statuses change. Keeps
git as the durable store. Costs a manual step, and statuses set locally are
invisible to researchers until the file goes back up — which for a beta whose
disposition changes are *already* manual is a small addition.

**B. Run the CLI against production.** `fly ssh console -C "npm run records --
--set ..."`. One physical store, no sync. But the CLI is not in the runtime image
and git stops being the durable store.

**C. Commit from the container on each append.** Preserves both properties and is
much heavier than this beta warrants.

**Recommendation: A**, with the sync folded into the existing thread-close habit
— the same place the handoff already proposes putting
`npm run records -- --set <id> installed`. Both are the same discipline: the loop
is closed by hand, and the fix is a habit rather than a build.

---

## 5. The caps, and what they cost

Set in `lib/quota.ts`, overridable by env. Derived from the records themselves,
not a counter, so they survive restart and cannot drift from what was logged.

| env | default | worth roughly |
|---|---|---|
| `BETA_DAILY_PER_PERSON` | 25 | ~$4.75/person/day warm |
| `BETA_DAILY_GLOBAL` | 60 | ~$11.40/day warm, plus a cold write per sitting |
| `BETA_MIN_SECONDS_BETWEEN` | 5 | stops a runaway client |

Basis: ~$0.19 per query warm, ~$1.45 to write the cache cold, ~$21 spent across
all 64 recorded queries to date. Raise them once the beta shows what a real
sitting looks like — these are a first guess against a measured unit cost, not a
budget.

`min_machines_running = 1` is load-bearing. A second machine keeps its own
in-process burst counter and its own view of the record file, so it would quietly
double the effective cap.

---

## 6. Invites

```bash
npm run invite -- --name "Their Name"        # mints; prints the code once
npm run invite -- --list                     # who is invited (no codes)
npm run invite -- --revoke <id>              # removes
```

`id` is permanent: it is written into `surfaced_by` on every record that person
creates, and records are append-only. Reusing an id for a different human
silently reassigns their contribution history.

The operator's id is `operator`, matching the 64 pre-beta records so that history
stays theirs.

Revoking stops future sign-ins but does not kill a live cookie — rotate
`SESSION_SECRET` for that. Revoking never touches their records.
