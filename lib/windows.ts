import generated from './windows.generated.json';

export type WindowMeta = {
  id: number;
  name: string;
  yearRange: string;
  entries: number;
  dossiers: number;
  rows: number;
};

export type Lane = { key: string; label: string; cls: string; thead: string };

export const WINDOWS: WindowMeta[] = generated.windows;
export const LANES: Lane[] = generated.lanes;

export const WINDOW_COUNT = WINDOWS.length;

export const laneLabel = (key: string) =>
  LANES.find((l) => l.key === key)?.label ?? key;

/** Lane hue custom-property name, for the one place chrome is allowed to
 *  echo a lane: the target breadcrumb dot in the query bar. */
export const laneVar = (key: string) =>
  `var(--${LANES.find((l) => l.key === key)?.cls ?? 'dim'})`;

export const getWindow = (id: number) => WINDOWS.find((w) => w.id === id);

export const clampWindowId = (id: number) =>
  Math.max(0, Math.min(WINDOW_COUNT - 1, id));

/** `operator` reveals build-provenance chrome that members never see. */
export const windowSrc = (id: number, operator = false) =>
  `/windows/window-${id}.html${operator ? '?operator=1' : ''}`;
