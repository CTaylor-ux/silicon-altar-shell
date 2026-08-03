/**
 * window-content.ts — resolves per-window guide copy and audio.
 *
 * SOURCE OF TRUTH IS lib/guides.json. This module only merges it with a
 * generated fallback so a window can never render a blank modal.
 *
 * Resolution is PER FIELD, not per window: a record that fills in
 * `whyThisMatters` but leaves `watchForThis` empty gets the real copy for one
 * and the fallback for the other. Any window still using a fallback for either
 * visible field is flagged `placeholder: true`, which renders a visible
 * "Placeholder copy" chip in the modal.
 *
 * The fallback text makes NO historical claims — it describes how to read a
 * window, using figures pulled from windows.json. That is the only orientation
 * copy that can be generated without risking an assertion the corpus would
 * have to retract.
 */

import { WINDOWS, LANES } from './windows';
import guidesRaw from './guides.json';

export type WindowGuide = {
  title: string;
  whyThisMatters: string;
  watchForThis: string;
  /** Complete companion-guide copy, split into paragraphs. Empty = no expander. */
  fullGuide: string[];
  dismissLabel: string;
  /** True when any visible field fell back to generated copy. */
  placeholder?: boolean;
};

export type AudioTrack = {
  src: string;
  /** Framing cue. Also used as the control's accessible purpose label. */
  cue: string;
  durationLabel?: string;
};

export type WindowContent = {
  guide: WindowGuide;
  /** Narration of the window's own intro block — the top strip. */
  introAudio: AudioTrack | null;
  /** Narration of the guide copy — lives inside the modal. */
  guideAudio: AudioTrack | null;
};

type GuideRecord = {
  title?: string;
  whyThisMatters?: string;
  watchForThis?: string;
  fullGuide?: string;
  dismissLabel?: string;
  audio?: {
    intro?: AudioTrack | null;
    guide?: AudioTrack | null;
  };
};

const guides = guidesRaw as unknown as Record<string, GuideRecord>;

const filled = (s?: string) => typeof s === 'string' && s.trim().length > 0;

/** Generated fallback, per window, from real corpus metadata. */
function fallbackGuide(id: number) {
  const w = WINDOWS.find((x) => x.id === id);
  const name = w?.name ?? `Window ${id}`;
  const range = w?.yearRange ?? '';
  const entries = w?.entries ?? 0;
  const dossiers = w?.dossiers ?? 0;

  return {
    title: name,
    whyThisMatters:
      `This window covers ${range}, in ${entries} entries across ${LANES.length} parallel lanes. ` +
      `Read it across before you read it down: the lanes are laid out to be compared within a ` +
      `year, not consumed one column at a time. What the window is built to show you is what ` +
      `was happening simultaneously, and the seams between the lanes are the argument.`,
    watchForThis:
      `Tier records the standing of a claim, not the quality of the source behind it: a primary ` +
      `document attached to an interpretive reading does not make the reading less interpretive. ` +
      `${dossiers} rows here carry a DOSSIER badge; those open the evidence and the reasoning ` +
      `underneath the claim.`,
    dismissLabel: 'Enter the window',
  };
}

function resolveGuide(id: number): WindowGuide {
  const rec = guides[String(id)] ?? {};
  const fb = fallbackGuide(id);

  // Only the two always-visible fields decide the placeholder flag. A missing
  // fullGuide simply means no expander, which is not a content gap.
  const usedFallback = !filled(rec.whyThisMatters) || !filled(rec.watchForThis);

  return {
    title: filled(rec.title) ? rec.title!.trim() : fb.title,
    whyThisMatters: filled(rec.whyThisMatters) ? rec.whyThisMatters!.trim() : fb.whyThisMatters,
    watchForThis: filled(rec.watchForThis) ? rec.watchForThis!.trim() : fb.watchForThis,
    fullGuide: filled(rec.fullGuide)
      ? rec
          .fullGuide!.trim()
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean)
      : [],
    dismissLabel: filled(rec.dismissLabel) ? rec.dismissLabel!.trim() : fb.dismissLabel,
    placeholder: usedFallback,
  };
}

export const WINDOW_CONTENT: Record<number, WindowContent> = Object.fromEntries(
  WINDOWS.map((w) => {
    const rec = guides[String(w.id)] ?? {};
    return [
      w.id,
      {
        guide: resolveGuide(w.id),
        introAudio: rec.audio?.intro ?? null,
        guideAudio: rec.audio?.guide ?? null,
      } satisfies WindowContent,
    ];
  })
);

export const getWindowContent = (id: number): WindowContent | null =>
  WINDOW_CONTENT[id] ?? null;
