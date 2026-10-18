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
/**
 * Turbo Vision blue desk.
 * Cyan menu and status, red hotkeys, green selection, yellow titles, double frames.
 */
export declare const borland: Theme;
/**
 * Linux `dialog` and a console menu bar.
 * Solid blue desk, gray bar, single frames, `< OK >` buttons, a red gauge.
 */
export declare const linux: Theme;
/** `borland` or `linux`. An unknown name throws. */
export declare function theme(name: ThemeName): Theme;
/** Copy so a running desk does not share ink objects with the constants. */
export declare function copyTheme(source: Theme): Theme;
