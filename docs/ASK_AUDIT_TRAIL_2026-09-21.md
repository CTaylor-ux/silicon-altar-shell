# The Ask layer now sees the audit's failed searches

2026-09-21. Branch `thread33-ask-audit-flags`. Not merged, not pushed.

## The problem, in one case

Asked whether the Fourteenth Amendment was ever ratified (`sb-20260920-001`), the Ask layer leaned on
E-W6-016-01: *"Utah State Legislature passes a formal memorial (joint resolution) to Congress challenging the
legality of the 14th Amendment's ratification."* It correctly reported the entry as tier C with no sources. Then
it said it could not resolve from the corpus whether the Utah object was legislative or judicial.

It could have. The same entry carries a `source_gap_note` recording that the whole 1967 Congressional Record
index was read (17,031,268 characters): Utah is not among the nine states listed under resolutions proposing
amendments, the only Fourteenth Amendment item is a report by Leander Perez of Louisiana, and the one indexed Utah
memorial that year is about the Colorado River. `prepare-corpus.mjs` never shipped `source_gap_note`, so the model
got the claim at full force and none of the search that tests it.

It was not a one-off. E-W6-016-01 is cited in four of the beta's seventy recorded exchanges: `sb-20260804-006`,
`sb-20260805-002`, `sb-20260806-007`, `sb-20260920-001`.

## What changed

Two things in `scripts/prepare-corpus.mjs`, both in the prompt only. Nothing else the app emits changed.

**1. An `audit trail:` line on entries that have no source at all.** Seven entries get it:

```
E-W0-010-01        Star Fort / Mound grid operational on silicon substrate
E-W4-008-01        Taxonomy enters vernacular
E-W5-059-01        Prentiss
E-W6-015-02        "Civil Rights" narrative dominance
E-W6-016-01        Utah Memorial - 14th Amendment ratification formally challenged
E-W6-016-02        Utah Memorial invisible to national press
w3-1711-financial  South Sea Company chartered and government debt convert...
```

One preamble paragraph tells the model what the line is, and to say what the trail found before repeating the
entry's claim.

**2. The source counts are computed, not hardcoded.** The preamble told the model "443 sources are opened and
138 are not". The corpus now holds **851 opened and 139 not**, after the Thread 33 claim checks. The model was
being told the corpus was roughly half as well-sourced as it is.

## Why seven, and not the forty-eight I first reported

My first count was 48: entries whose gap note matched a search-failure phrase ("NOT FOUND", "NOTHING ATTACHED",
"could not", ...). I reported that number before reading them. Reading them showed the regex was wrong:

- **7 were false positives.** Tier A and B entries whose note contains a boilerplate sentence about a *different*
  entry: *"Four checked at random proved live: E-W0-029-01's only source is an article that could not be located"*.
  A wording-driven flag would have stamped "not found" on seven good entries.
- **About 30 were stale.** "NOTHING ATTACHED" was true of one sourcing batch; a later batch attached a source.
- **A handful were real.**

The corpus's own `needs` field was no better as a driver: 97 of the 123 entries still tagged `needs: source`
already carry a live-verified source.

So the gate is **structural**: the line ships only when the entry has **no `source_ids` at all** and a gap note
exists. With no source attached there is no later success for the note to be stale against. This is written into
the code comment so the next change does not reach for the note's wording again.

## Verification

- `node --check`, then `npm run prepare-corpus`: 793/793 entries, `851 sources opened, 139 citation_only; 7
  unsourced entries carry an audit trail`.
- **Diff of the prompt against `main`:** exactly 7 entry blocks changed, and they are the 7 above. For each one,
  deleting the `audit trail:` line reproduces the old block **byte for byte**. The only other change is the preamble.
- Size: 665,391 -> 679,314 bytes (+13,923). ~274k -> ~279k tokens. It changes the cached prefix, so the first
  Ask call after this pays one cache write.
- `npm run build:check`: compiled, 13/13 static pages.
- **Dev server restarted.** `/api/ask` reads the prompt once per process and holds it (`app/api/ask/route.ts:37`).
  A server that answered a question before the rebuild keeps serving the old prompt until it restarts. The new
  process logged the audit-trail count on startup, with no errors.

## Not done, and why

- **No before/after Ask run by me.** `/api/ask` is behind the invite gate, and calling the model any other way
  means reading the API key out of `.env.local`. Neither is mine to do. The test is to re-ask the same question
  in the app and compare with `sb-20260920-001`. What to look for: the answer should say that the 1967
  Congressional Record was searched and the memorial is not in it, before it describes the memorial's argument.
- **The corpus is not changed.** Every fix here is in how the app reads the corpus. The corpus-side problems it
  exposed are recorded below for the audit repo.

## For the audit repo, not fixed here

- **97 stale `needs: source` tokens** on entries that now carry a live-verified source. `needs` is meant to say
  what an entry still lacks; for these it no longer does.
- **E-W6-016-01** has waited on the author since Thread 22 (year and session law unconfirmed, frozen fields).
  *Dyett v. Turner*, 439 P.2d 266 (Utah 1968), a judicial opinion rather than a legislative memorial, is the lead.
- **Gap notes that describe other entries.** The boilerplate "Four checked at random" sentence sits on at least
  seven entries it is not about. Harmless to a reader of the dossier; misleading to anything that reads notes
  mechanically.
