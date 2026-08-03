# The Silicon Altar — MVP shell

A clickable visual mockup of the front-end shell that wraps the seven Window
timelines. **No backend, no model calls, no keys.** Retrieval is a stub behind a
final interface.

## Run

```bash
npm install
cp .env.local.example .env.local   # point SILICON_ALTAR_REPO at the audit repo
npm run dev                        # http://localhost:3210
```

`npm run dev` runs `prepare-windows` first, so the windows are always rebuilt
from the current state of the audit repo.

## What is in scope

1. **Intro** (`app/page.tsx`) — the door. Figures read from the corpus, not typed.
2. **Selector** (`app/windows/page.tsx`) — seven windows, chronological, on a spine.
3. **Window view** (`app/windows/[id]/page.tsx`) — prev/next, keyboard, position indicator.
4. **Query bar** (`components/QueryBar/`) — fixed-height panel, five states, stub-backed.

Deliberately **not** built (each marked `// FUTURE:` at the relevant seam):
authentication, the gated contribution model, editorial approval, source
submission, and any live RAG or model wiring.

## The audit repo is read-only

`scripts/prepare-windows.mjs` opens `$SILICON_ALTAR_REPO` for reading and never
writes to it. Verified: after a full build, `git status` in the audit repo shows
only pre-existing untracked items and `corpus_integrity_check.py` still reports
`all hard checks pass` (C9 compares regenerated HTML byte-for-byte).

## The one change the Windows needed

The generated documents carry **3 `id` attributes** (all dossier-overlay chrome)
and one `data-dossier` attribute — which is a *dossier grouping key*, not a row
key. It is reused across lanes: W5 has 188 rows sharing 64 keys. So **no event
was individually addressable**, and answer→location targeting was impossible.

`prepare-windows.mjs` injects `data-entry-id` on every `.ev`, matched on
`(window, lane, title)` — verified unique across all 690 entries. All 690 rows
resolve; the script refuses to emit a partially addressable window.

**Promotion path** — one line in `silicon_altar_generator.py:541`:

```python
f'<div class="ev"{dataattr}>'
f'<div class="ev" data-entry-id="{e["id"]}"{dataattr}>'
```

Once promoted, this script drops to injecting the postMessage bridge only.

## Swapping guide copy and audio

Both live in **`lib/window-content.ts`**, keyed by window id. Neither component
knows anything about a specific window, so replacing content changes the product
without touching wiring.

```ts
WINDOW_CONTENT[3] = {
  guide: { title, whyThisMatters, watchForThis, dismissLabel, placeholder? },
  audio: { src, cue, durationLabel? },   // null disables the strip for that window
}
```

- **Guide copy is currently PLACEHOLDER** and every entry is flagged
  `placeholder: true`, which renders a visible "Placeholder copy" chip in the
  modal. The placeholder text makes no historical claims — it describes how to
  read a window, using facts pulled from `windows.json`. Replace the two prose
  fields and drop the flag; nothing else moves.
- **Audio files go in `public/audio/`** as `window-0.m4a` … `window-6.m4a`. See
  the README there. A missing file renders an explicit "audio not yet available"
  state rather than a dead button.

The guide opens once per window per session (tracked as `guideSeen` in session
state) and is always re-openable from **Guide** in the top rail.

## Architecture notes

**Windows are iframed.** They carry a global `<style>` with body-level
selectors; an iframe makes CSS bleed structurally impossible in both
directions, which is what "preserve the look exactly" requires. The cost is a
frame boundary, paid with a postMessage bridge — which is also the interface a
remotely-hosted window would present.

**Navigation is a windowed strip**, current ± 1 mounted (max three frames).
Route-per-window would remount on every prev/next, re-parsing 230–385 KB and
dropping scroll. Windows outside the band unmount; their scroll position
survives in session state.

**The shell inherits the Windows' palette** rather than defining one
(`styles/tokens.css`). Chrome uses the neutral ramp only — the fourteen lane
hues are semantic and borrowing one steals meaning. `--sig` is reserved for
answer→evidence pointing, which is why the target rail and row pulse read as
native to the timeline.

Two accessibility corrections the shell does not inherit: `--faintxt` (3.23:1)
and `--crimson` (4.28:1) fail WCAG AA for body text. The Windows use them
decoratively, which is fine; the shell never uses them for anything a user must
read.

**Scroll targeting avoids three things** that all silently no-op in some
contexts: `scrollIntoView` (the row is inside a nested horizontal scroller),
`behavior: 'smooth'`, and `requestAnimationFrame` — rAF was verified *not to
fire* inside these iframes in at least one embedding context, which stranded
the scroll entirely. The ease is timer-driven and recomputes its destination
each frame, so a still-laying-out window (W5 is 385 KB) is tracked rather than
missed.

## Swapping in the real backend

`lib/retrieval.ts` is the only file that changes:

```ts
export async function query(q: string, signal?: AbortSignal): Promise<QueryResult>
```

Replace the stub body with a call to a route handler holding the credentials
server-side. `QueryResult { answer, targets[], scopeNote? }` is final —
everything downstream consumes it and never learns what produced it.
`lib/stub-index.ts` is deleted at that point.
