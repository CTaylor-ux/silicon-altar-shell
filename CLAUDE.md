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
