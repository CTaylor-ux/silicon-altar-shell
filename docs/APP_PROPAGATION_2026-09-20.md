# Propagating the Thread 33 claim-check corrections into the app

2026-09-20. Branch `thread33-app-propagation`. **Nothing merged, nothing pushed, nothing deployed.**

## Why this was needed

The audit corpus was corrected across Threads 32 and 33 (W6, W0/W2, W1, W3, W4, W5 claim checks) and those
corrections are merged and pushed on the audit repo's `main`, at `6e59adf`. The app's derived artifacts were last
built on **19 September at 01:15**, which is before the W1, W3, W4 and W5 merges. Until this run, a reader of the
app was being shown pre-correction text: "Artificial person" on the Fourteenth Amendment row, the London
Convention concluded "IN A FOURTH CAPITAL", the 1893 pamphlet titled under Douglass alone, 2,300 buildings at
Baltimore, 28,150 at San Francisco, and the rest.

## What was run

Read first: `CLAUDE.md`, `docs/GOVERNANCE_LOOP_START_HERE.md` §§0-4, `docs/DEPLOY.md` §§1-2, `Dockerfile`.

`.env.local` was confirmed to point at the canonical corpus (`SILICON_ALTAR_REPO=/Users/taylorcolin/dev/Silicon_Altar_LIVE`)
before anything was run. The key itself was not printed or copied.

```
npm run prepare-windows     # 793/793 rows addressable across 7 windows
npm run prepare-corpus      # 793/793 entries normalized (791 CE, 2 deep time)
npm run build:check         # full next build into .next-verify, 13/13 static pages
```

Both prepare scripts reported "Audit repo untouched (read-only)", and that was verified independently: the audit
repo's working tree was clean before and after (`git status` shows only the untracked `.claude/`).

## Before and after

| file | before (19 Sep 01:15) | after (20 Sep 15:57) |
|---|---|---|
| `public/windows/window-0.html` | 276,697 B | 287,603 B |
| `public/windows/window-1.html` | 272,881 B | 296,211 B |
| `public/windows/window-2.html` | 345,374 B | 346,021 B |
| `public/windows/window-3.html` | 272,508 B | 334,638 B |
| `public/windows/window-4.html` | 332,815 B | 385,075 B |
| `public/windows/window-5.html` | 647,190 B | 682,728 B |
| `public/windows/window-6.html` | 318,566 B | 324,108 B |
| `lib/corpus.generated.json` | 270,206 B | 270,691 B |
| `lib/corpus.prompt.txt` | 583,572 B | 665,391 B |
| `lib/windows.generated.json` | 2,910 B | 2,910 B (content identical) |

The prompt file grew 583 KB -> 650 KB (~274k tokens). That is the corrections plus the new source records and
`tier_basis` notes from the claim checks. **It changes the cached prefix, so the first Ask call after deploy will
pay a cache write.** That is expected and is not a fault.

## Verification

All three layers a reader can reach were checked, not just the HTML.

**1. Window HTML (what a reader sees).** Ten corrected strings present, seven stale strings absent:

```
present: "Wells, Douglass, Penn and Barnett" 2, "the phrase used in presenting it names" 1,
         "THE CAPITAL OF ONE OF THE THREE" 1, "A STATUTE OF 1804" 1, "28,188 buildings" 2,
         "About 1,500 buildings" 1, "nearly 400 patents" 2, "five months after the fighting ended" 2,
         "standing twelve years" 2, "Siku Quanshu" 3
absent:  "Artificial person", "A FOURTH CAPITAL", "2,300 buildings", "28,150",
         "only counter-narrative at the fair", "standing fourteen years"
```

Every count was cross-checked against the corpus's own `Window5_75-YearOperation_GENERATED.html` and matches
exactly, so the injection step is not dropping or duplicating content.

The two surviving hits for `NOT A STATUTE` were opened and read. Both are correction notes that quote the old
wording on purpose: a source note ("Corrects \"NOT A STATUTE\"") and a dossier revision note. They are in the
corpus for the same reason and are correct.

**2. `lib/corpus.generated.json` (Locate).** Corrected titles resolve by entry id, e.g. `E-W5-032-04` now returns
the Wells/Douglass/Penn/Barnett title and `E-W5-123-01` returns "standing twelve years".

**3. `lib/corpus.prompt.txt` (Ask).** Corrected text present, stale text at zero hits, so the model is no longer
being handed claims the corpus has retracted.

**4. The postMessage bridge.** `data-entry-id` is present for the corrected rows, including both members of each
lane pair (`E-W5-085-01` and `-02`), so entry-level linking still resolves after the title changes.

**5. Build.** `npm run build:check` compiled all 13 routes into `.next-verify` (gitignored) with the new data. The
bare-title assertion in `prepare-corpus.mjs` did not fire.

## What I did not do, and why

- **No visual check inside the running app.** `npm run dev` on :3210 serves, but `/windows/window-5.html` redirects
  to `/enter`: the windows are behind the invite gate. Entering an invite code would be authenticating as a member,
  which is not mine to do. The artifacts it would serve were verified directly instead. **A logged-in look at
  Window 5 is the one check still owed, and it needs you.**
- **No deploy.** Per `docs/DEPLOY.md` §2 the sequence is prepare locally, `docker build`, then ship. The prepare half
  is done. The build-and-ship half is an outward action and is gated.
- **No merge, no push.** Gated.

## State of the repo when this was written

- Branch `thread33-app-propagation`, one commit, off `main` at `3397632`.
- Tracked and changed: `lib/corpus.prompt.txt`, `lib/windows.generated.json`.
- `public/windows/` and `lib/corpus.generated.json` are **gitignored by design** (`.gitignore:11,12`) and are rebuilt
  by the prepare steps on the host before any container build. They changed on disk and are correct; they are not
  part of the commit. This is the property `DEPLOY.md` §2 exists to protect.
- The two tracked files already carried uncommitted edits when I arrived, from an earlier prepare run by someone
  else (`lib/windows.generated.json` W5 entries 260 -> 261). My run regenerated both deterministically and
  superseded those edits; `windows.generated.json` came out byte-identical to what was already on disk.

## Still open

- **21 saved findings argue with text that has since changed** (`npm run records -- --stale`; the corpus check
  reports the same class as C14q). By window: W3 7, W5 6, W1 3, W6 2, W0 1, W2 1, W4 1. Some are now moot because
  this thread made the correction the finding asked for. Example: `sb-20260812-002` says E-W4-011-01 misstates the
  direction of the $20 million at Mortefontaine, and the W4 claim check corrected exactly that. **Each needs
  re-reading against the current wording before it is installed or dismissed.** Nothing here should be swept.
- Branch `thread33-a00-record-correction` (commit `9028a40`, the correction note appended to `sb-20260804-001`) is
  still unmerged.
- The 88 first-pass HOLDS rows in the audit corpus are single-checked, not re-verified. Recorded in the audit repo.
