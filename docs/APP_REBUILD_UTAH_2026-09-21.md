# App rebuild for the Utah entry correction

2026-09-21. Branch `thread33-utah-app-rebuild`, off `main` at `626a790`.

The audit corpus merged `thread33-utah-entry` at `28d8021` (pushed): E-W6-016-01, the "Utah Memorial", is *Dyett v.
Turner* (Utah Supreme Court, 1968), a court opinion rather than a 1967 legislative memorial. Five W6 rows and two
dossiers changed. This rebuild puts that in front of readers.

## What was run

`npm run prepare-windows`, `npm run prepare-corpus`, `npm run build:check`, then a dev-server restart. The audit
repo was on `main`, clean, level with origin, before the prepare scripts read it.

## Verified

- **Windows.** Only `window-6.html` changed. The other six are byte-identical to the 20 September build
  (checksums recorded in `APP_PROPAGATION_2026-09-20.md`). In Window 6: "Utah Memorial" 0 hits, the new title present.
- **Ask prompt.** Against the prompt from before this rebuild, exactly five entry blocks changed, and they are the
  five the corpus change touched: E-W6-012-02, -016-01, -016-02, -030-01, -030-03. The only preamble change is the
  source count, 851 -> 853 opened (the two *Dyett* opinions).
- **Audit trails** 7 -> 6. E-W6-016-01 now carries sources, so by design it no longer gets one; its body carries the
  finding. E-W6-016-02 keeps its trail, which now includes the resolution.
- **Locate** returns both Utah entries under 1968 with their new titles.
- **Bridge.** `data-entry-id` resolves for all five changed rows.
- **Build.** `build:check` 13/13.
- **Restart.** `/api/ask` holds the prompt in memory once per process, and the running server predated this change.
  Restarted; the new process logged `853 sources opened, 139 citation_only; 6 unsourced entries carry an audit trail`
  with no errors, and its startup rebuild is byte-identical to the verified one. `/enter` returns 200; `/` and
  `/windows/6` still redirect to the invite gate.

## Not done

Merge and push of this branch: gated. `main` also carries one unpushed commit, the beta records through 2026-09-21.
