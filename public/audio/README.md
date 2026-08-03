# Audio

Two independent narration sets, one per window each, in two namespaces that
must never collide. Drop files straight into this directory. No code change, no
rebuild, no server restart.

## Guide narration (the companion-guide modal)

Narrates the guide copy. The control lives **inside** the companion-guide modal,
labelled "Narrate this guide".

```
public/audio/guide-narration-w0.mp3     The Template
public/audio/guide-narration-w1.mp3     Launch Codes
public/audio/guide-narration-w2.mp3     The Corporate Grid
public/audio/guide-narration-w3.mp3     Colonial Consolidation
public/audio/guide-narration-w4.mp3     The Transfer
public/audio/guide-narration-w5.mp3     75-Year Operation
public/audio/guide-narration-w6.mp3     Digital Migration
```

## Intro-block narration (the slim top strip)

A separate track that narrates the window's own intro block. The control is the
slim strip under the top rail, labelled "Listen first · why this window
matters". Not yet recorded.

```
public/audio/intro-narration-w0.mp3  ...  intro-narration-w6.mp3
```

## Spec

- **Format: MP3.** ElevenLabs exports MP3 natively, so no conversion step, and
  every browser decodes it. 128 kbps mono is ample for speech; 44.1 kHz or
  22.05 kHz both work.
- **Filenames are exact and lowercase.** `guide-narration-w3.mp3`, not
  `Guide-Narration-W3.mp3` and not `guide-narration-3.mp3`.
- **Window numbering is 0 to 6**, matching the window ids, so Window 0 is
  `w0`. There is no `w7`.

## How activation works

Each control probes its own file on mount. Metadata loads, the control becomes
an active play button showing real duration. The file 404s, the control renders
"audio not yet available" instead of a dead button.

This is driven by **file presence, not by a flag**, so windows activate
independently: dropping in `guide-narration-w3.mp3` activates Window 3's guide
control and changes nothing else. Verified in both directions, including that
removing a file returns that control to the unavailable state.

The two namespaces are wired to different objects (`audio.guide` and
`audio.intro` in `lib/guides.json`), so a guide file can never activate an intro
control or vice versa.

## Changing any of this

Paths live in `lib/guides.json` under each window's `audio` key. To disable a
control for a window entirely, set that track to `null`.

Unlike `public/windows/`, this directory is **not** gitignored: these are source
assets, not derived files.
