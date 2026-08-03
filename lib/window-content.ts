/**
 * window-content.ts — the swappable content layer.
 *
 * Both the companion-guide modal and the audio cue read from here. Neither
 * component knows anything about a specific window; replacing the copy below
 * changes the product without touching any wiring.
 *
 * ── IMPORTANT ────────────────────────────────────────────────────────────────
 * The guide copy currently in this file is PLACEHOLDER, and every entry is
 * flagged `placeholder: true` so the UI can say so out loud.
 *
 * It deliberately makes NO historical claims. It describes the instrument — how
 * to read a window, what a tier means, what a dossier badge does — using facts
 * drawn from windows.json (name, year range, entry and dossier counts) and the
 * project's own stated source discipline. That is the one kind of orientation
 * copy that can be written before the real companion guides land without
 * risking an assertion the corpus would have to retract.
 *
 * When the real companion-guide copy arrives: replace `whyThisMatters` and
 * `watchForThis` per window and drop the `placeholder` flag. Nothing else moves.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { WINDOWS, LANES } from './windows';

export type WindowGuide = {
  /** Modal heading. Defaults to the window name. */
  title: string;
  /** Lead paragraph — why this window matters. */
  whyThisMatters: string;
  /** Single sharpening line — the thing to keep an eye on while reading. */
  watchForThis: string;
  /** Dismiss button label. */
  dismissLabel: string;
  /** Renders a visible "placeholder copy" marker. Remove with the real copy. */
  placeholder?: boolean;
};

export type WindowAudio = {
  /** Served from public/audio/. Missing files degrade to an unavailable state. */
  src: string;
  /** Framing cue shown beside the control. */
  cue: string;
  /** Optional label shown until real metadata duration loads. */
  durationLabel?: string;
};

export type WindowContent = {
  guide: WindowGuide;
  /** null disables the audio strip for that window entirely. */
  audio: WindowAudio | null;
};

const DEFAULT_CUE = 'Listen first · why this window matters';

/** Placeholder guide, generated per window from real corpus metadata. */
function placeholderGuide(id: number): WindowGuide {
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
      `was happening simultaneously — and the seams between the lanes are the argument.`,
    watchForThis:
      `Tier records the standing of a claim, not the quality of the source behind it — a primary ` +
      `document attached to an interpretive reading does not make the reading less interpretive. ` +
      `${dossiers} rows here carry a DOSSIER badge; those open the evidence and the reasoning ` +
      `underneath the claim.`,
    dismissLabel: 'Enter the window',
    placeholder: true,
  };
}

/**
 * Per-window content. Audio src points at files that do not exist yet; the
 * control renders an explicit unavailable state rather than a dead button until
 * they are dropped into public/audio/.
 */
export const WINDOW_CONTENT: Record<number, WindowContent> = Object.fromEntries(
  WINDOWS.map((w) => [
    w.id,
    {
      guide: placeholderGuide(w.id),
      audio: {
        src: `/audio/window-${w.id}.m4a`,
        cue: DEFAULT_CUE,
      },
    } satisfies WindowContent,
  ])
);

export const getWindowContent = (id: number): WindowContent | null =>
  WINDOW_CONTENT[id] ?? null;
