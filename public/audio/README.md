# Per-window audio

Drop the seven narration files here, named exactly:

```
window-0.m4a   The Template
window-1.m4a   Launch Codes
window-2.m4a   The Corporate Grid
window-3.m4a   Colonial Consolidation
window-4.m4a   The Transfer
window-5.m4a   75-Year Operation
window-6.m4a   Digital Migration
```

Any browser-playable format works — change the extension in
`lib/window-content.ts` (`audio.src`) to match. `.m4a` and `.mp3` are the safe
choices; `.wav` will play but is large enough to hurt first load.

Until a file exists the control renders an explicit **"audio not yet available"**
state rather than a dead play button, so a missing file is visible rather than
silent.

To disable audio for a window entirely, set its `audio` to `null` in
`lib/window-content.ts`.

Unlike `public/windows/`, this directory is **not** gitignored — these are
source assets, not derived files.
