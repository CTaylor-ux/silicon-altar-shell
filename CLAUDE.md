# Silicon Altar reader app. THIS IS THE CANONICAL COPY.

Abandoned, never write there: `~/Desktop/silicon-altar-shell`,
`~/silicon-altar-shell-run`. Both now carry their own CLAUDE.md saying so.

**Read `docs/GOVERNANCE_LOOP_START_HERE.md` before touching anything.**
THREAD_30_START_HERE.md (in `~/dev/Silicon_Altar_LIVE`) calls it the best
document in the project.

- Corpus is read through `.env.local` (`SILICON_ALTAR_REPO`), which must point at
  `~/dev/Silicon_Altar_LIVE`. Check it before trusting what the app serves.
- `.env.local` holds a live Anthropic API key and is the only copy. Never print,
  commit or copy it.
- The prepare scripts are read-only against the audit repo and say so on startup.
- `npm run dev` serves on :3210.
- **Merge to main and any push are GATED. Stop and ask.**

## After the audit corpus changes (added Thread 33)

The app serves a copy of the corpus built at the last prepare run, not the corpus
itself. In Thread 33 it served 19 September output through four corpus merges.
After any corpus merge:

1. On a branch: `npm run prepare-windows && npm run prepare-corpus`.
2. Verify only what should have moved did: compare `public/windows/*.html`
   checksums and the entry blocks of `lib/corpus.prompt.txt` against before.
3. `npm run build:check` (never `npm run build` while a server is running).
4. Commit the tracked `lib/corpus.prompt.txt` and `lib/windows.generated.json`;
   `public/windows/` and `lib/corpus.generated.json` are gitignored by design.
5. **Restart the dev server.** `/api/ask` reads the prompt once per process and
   holds it, so a server that answered a question before the rebuild keeps
   serving the old prompt until it restarts.

The windows sit behind the invite gate, so a look inside the running app needs
the operator; never enter an invite code. Worked examples:
`docs/APP_PROPAGATION_2026-09-20.md`, `docs/APP_REBUILD_UTAH_2026-09-21.md`.

When a saved finding is acted on in the corpus, write it back:
`npm run records -- --set ID STATUS "reason" --repin --backlog SB-ID`. App record
ids and audit backlog ids are numbered separately and collide; state the link.

## The operator dictates

When a request does not parse, read it phonetically and say how you read it
before acting ("fill the right branch" meant "build the write-back").
