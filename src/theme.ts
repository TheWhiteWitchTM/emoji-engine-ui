/** Foreground and background as classic ANSI indexes, 0 through 15. */
export interface Ink {
  fg: number;
  bg: number;
}

/**
 * Colors and one-cell glyphs for a desk.
 * Indexes are the ANSI palette both engines paint: 4 is blue, 6 is cyan, 1 is red.
 * Button brackets, marks, and arrows are one grapheme each.
 */
export interface Theme {
  name: string;
  /** Active windows use a double frame on `double` and a single frame on `single`. */
  frame: 'double' | 'single';
  desktopGlyph: string;
  shadowGlyph: string;
  closeGlyph: string;
  zoomGlyph: string;
  unzoomGlyph: string;
  buttonLeft: string;
  buttonRight: string;
  checkOn: string;
  checkOff: string;
  radioOn: string;
  radioOff: string;
  scrollUp: string;
  scrollDown: string;
  scrollLeft: string;
  scrollRight: string;
  thumb: string;
  track: string;
  progressOn: string;
  progressOff: string;
  password: string;

  desktop: Ink;
  menuBar: Ink;
  menuHot: Ink;
  menuActive: Ink;
  menuActiveHot: Ink;
  menu: Ink;
  menuSelect: Ink;
  menuSelectHot: Ink;
  menuDisabled: Ink;
  menuShortcut: Ink;
  menuShortcutSelect: Ink;
  menuLocked: Ink;
  menuLockedHot: Ink;
  status: Ink;
  statusHot: Ink;
  statusDisabled: Ink;
  window: Ink;
  windowTitle: Ink;
  windowInactive: Ink;
  windowTitleInactive: Ink;
  windowBody: Ink;
  windowShadow: Ink;
  button: Ink;
  buttonHot: Ink;
  buttonFocus: Ink;
  buttonFocusHot: Ink;
  buttonDefault: Ink;
  buttonDisabled: Ink;
  input: Ink;
  inputCaret: Ink;
  label: Ink;
  labelHot: Ink;
  labelDisabled: Ink;
  check: Ink;
  checkHot: Ink;
  checkFocus: Ink;
  checkFocusHot: Ink;
  list: Ink;
  listSelect: Ink;
  listFocus: Ink;
  scroll: Ink;
  scrollThumb: Ink;
  progress: Ink;
  progressFill: Ink;
  progressText: Ink;
  progressTextOn: Ink;
}

export type ThemeName = 'borland' | 'linux';

function ink(fg: number, bg: number): Ink {
  return { fg, bg };
}

/**
 * Turbo Vision blue desk.
 * Cyan menu and status, red hotkeys, green selection, yellow titles, double frames.
 */
export const borland: Theme = {
  name: 'borland',
  frame: 'double',
  desktopGlyph: '░',
  shadowGlyph: '▒',
  closeGlyph: '■',
  zoomGlyph: '▲',
  unzoomGlyph: '▼',
  buttonLeft: '[',
  buttonRight: ']',
  checkOn: 'X',
  checkOff: ' ',
  radioOn: '•',
  radioOff: ' ',
  scrollUp: '▲',
  scrollDown: '▼',
  scrollLeft: '◄',
  scrollRight: '►',
  thumb: '█',
  track: '▒',
  progressOn: '█',
  progressOff: '░',
  password: '•',

  desktop: ink(6, 4),
  menuBar: ink(0, 6),
  menuHot: ink(1, 6),
  menuActive: ink(0, 2),
  menuActiveHot: ink(11, 2),
  menu: ink(0, 6),
  menuSelect: ink(0, 2),
  menuSelectHot: ink(11, 2),
  menuDisabled: ink(8, 6),
  menuShortcut: ink(0, 6),
  menuShortcutSelect: ink(0, 2),
  menuLocked: ink(8, 6),
  menuLockedHot: ink(8, 6),
  status: ink(0, 6),
  statusHot: ink(1, 6),
  statusDisabled: ink(8, 6),
  window: ink(15, 4),
  windowTitle: ink(11, 4),
  windowInactive: ink(6, 4),
  windowTitleInactive: ink(7, 4),
  windowBody: ink(15, 4),
  windowShadow: ink(0, 0),
  button: ink(0, 6),
  buttonHot: ink(1, 6),
  buttonFocus: ink(15, 2),
  buttonFocusHot: ink(11, 2),
  buttonDefault: ink(11, 6),
  buttonDisabled: ink(8, 6),
  input: ink(11, 4),
  inputCaret: ink(4, 11),
  label: ink(15, 4),
  labelHot: ink(11, 4),
  labelDisabled: ink(8, 4),
  check: ink(15, 4),
  checkHot: ink(11, 4),
  checkFocus: ink(11, 4),
  checkFocusHot: ink(15, 4),
  list: ink(15, 4),
  listSelect: ink(0, 6),
  listFocus: ink(0, 2),
  scroll: ink(6, 4),
  scrollThumb: ink(15, 4),
  progress: ink(6, 4),
  progressFill: ink(14, 4),
  progressText: ink(11, 4),
  progressTextOn: ink(0, 14),
};

/**
 * Linux `dialog` and a console menu bar.
 * Solid blue desk, gray bar, single frames, `< OK >` buttons, a red gauge.
 */
export const linux: Theme = {
  name: 'linux',
  frame: 'single',
  desktopGlyph: ' ',
  shadowGlyph: '░',
  closeGlyph: '×',
  zoomGlyph: '▲',
  unzoomGlyph: '▼',
  buttonLeft: '<',
  buttonRight: '>',
  checkOn: 'X',
  checkOff: ' ',
  radioOn: '*',
  radioOff: ' ',
  scrollUp: '▲',
  scrollDown: '▼',
  scrollLeft: '◄',
  scrollRight: '►',
  thumb: '█',
  track: '░',
  progressOn: ' ',
  progressOff: ' ',
  password: '*',

  desktop: ink(4, 4),
  menuBar: ink(0, 7),
  menuHot: ink(1, 7),
  menuActive: ink(15, 4),
  menuActiveHot: ink(11, 4),
  menu: ink(15, 4),
  menuSelect: ink(0, 7),
  menuSelectHot: ink(1, 7),
  menuDisabled: ink(8, 4),
  menuShortcut: ink(14, 4),
  menuShortcutSelect: ink(4, 7),
  menuLocked: ink(8, 4),
  menuLockedHot: ink(8, 4),
  status: ink(0, 7),
  statusHot: ink(1, 7),
  statusDisabled: ink(8, 7),
  window: ink(15, 4),
  windowTitle: ink(14, 4),
  windowInactive: ink(7, 4),
  windowTitleInactive: ink(15, 4),
  windowBody: ink(15, 4),
  windowShadow: ink(0, 0),
  button: ink(15, 4),
  buttonHot: ink(11, 4),
  buttonFocus: ink(0, 7),
  buttonFocusHot: ink(1, 7),
  buttonDefault: ink(11, 4),
  buttonDisabled: ink(8, 4),
  input: ink(15, 0),
  inputCaret: ink(0, 15),
  label: ink(15, 4),
  labelHot: ink(11, 4),
  labelDisabled: ink(8, 4),
  check: ink(15, 4),
  checkHot: ink(11, 4),
  checkFocus: ink(14, 4),
  checkFocusHot: ink(11, 4),
  list: ink(15, 4),
  listSelect: ink(0, 7),
  listFocus: ink(0, 6),
  scroll: ink(14, 4),
  scrollThumb: ink(15, 4),
  progress: ink(15, 4),
  progressFill: ink(15, 1),
  progressText: ink(15, 4),
  progressTextOn: ink(15, 1),
};

/** `borland` or `linux`. An unknown name throws. */
export function theme(name: ThemeName): Theme {
  if (name === 'linux') return copyTheme(linux);
  if (name === 'borland') return copyTheme(borland);
  throw new Error(`Unknown theme "${name}"`);
}

/** Copy so a running desk does not share ink objects with the constants. */
export function copyTheme(source: Theme): Theme {
  const copy = { ...source };
  const record = copy as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (value && typeof value === 'object') record[key] = { ...(value as Ink) };
  }
  return copy;
}
