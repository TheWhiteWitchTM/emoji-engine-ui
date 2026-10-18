import type { Painter } from './painter.js';
import type { CellPointer, KeyEvent } from './surface.js';
import { View } from './view.js';
/** One row in a menu. `separator` draws a line. `items` opens a submenu. */
export interface MenuEntry {
    /** `&File` marks F. `&&` is a literal ampersand. */
    label?: string;
    /** Shown on the right, and matched while the menu is closed. `F3`, `Alt-X`. */
    shortcut?: string;
    disabled?: boolean;
    separator?: boolean;
    action?: () => void;
    items?: MenuEntry[];
}
/** A key hint on the status line. */
export interface StatusHint {
    /** `F1`, `Alt-X`, `Esc`, `Ctrl-S`. Hyphen and plus are the same. */
    key: string;
    label: string;
    action?: () => void;
    /** Still runs while a dialog is open. */
    global?: boolean;
    disabled?: boolean;
}
/**
 * The top bar. Alt+letter or a click opens a menu. F10 lands on the bar.
 * Arrow keys move. Enter runs the row. Esc closes.
 */
export declare class MenuBar extends View {
    entries: MenuEntry[];
    /** Highlighted title, or -1 when the bar is idle. */
    top: number;
    open: boolean;
    /** Row inside the open menu, or -1. */
    item: number;
    /** Row inside the submenu, or -1 when the submenu is closed. */
    sub: number;
    locked: boolean;
    private holding;
    private titles;
    private popup;
    private subpopup;
    constructor(entries?: MenuEntry[]);
    paint(g: Painter): void;
    /** F10. Highlights the first title and does not open it yet. */
    focusBar(): void;
    /** Alt+letter on a title. Returns true when a menu opens. */
    openHot(letter: string): boolean;
    close(): void;
    key(event: KeyEvent): boolean;
    /** A click. True when the bar or an open menu consumed it. */
    pointer(event: CellPointer): boolean;
    /** Move the highlight while a menu is open. True when it changed. */
    hover(col: number, row: number): boolean;
    private openAt;
    private openSub;
    private switchTop;
    private currentItems;
    private moveItem;
    private setEdge;
    private activateCurrent;
    private activateLetter;
    private run;
    private hitPopup;
    private rowAt;
    private holdFocus;
    private releaseFocus;
    private layout;
    private paintPopup;
}
/** The bottom line of key hints. A click runs the hint under the pointer. */
export declare class StatusLine extends View {
    hints: StatusHint[];
    private spans;
    constructor(hints?: StatusHint[]);
    paint(g: Painter): void;
    /**
     * Run the hint that matches `event`.
     * While a dialog is open, only `global` hints run.
     */
    activate(event: KeyEvent, modal: boolean): boolean;
    pointer(event: CellPointer, modal: boolean): boolean;
}
/** Walk titles and rows. The first matching shortcut with an action runs. */
export declare function runMenuShortcut(entries: MenuEntry[], event: KeyEvent): boolean;
