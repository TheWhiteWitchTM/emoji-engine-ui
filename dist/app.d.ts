import { MenuBar, StatusLine } from './menu.js';
import type { MenuEntry, StatusHint } from './menu.js';
import type { CellPointer, CellSurface, KeyEvent, Rect } from './surface.js';
import type { Theme, ThemeName } from './theme.js';
import { Desktop, View } from './view.js';
import type { PointerCapture, UIHost } from './view.js';
import { Dialog } from './window.js';
export interface AppOptions {
    /** `borland` or `linux`, or a theme object. Default `borland`. */
    theme?: ThemeName | Theme;
    /** Omit to hide the menu bar. An empty array still draws the bar. */
    menu?: MenuEntry[];
    /** Omit to hide the status line. */
    status?: StatusHint[];
    /** Button and menu clicks beep when true. Default true. */
    sound?: boolean;
    /** Replaces the built-in square wave. */
    beep?: (freq: number, duration: number) => void;
    /** Called from `quit`. */
    onQuit?: () => void;
}
/**
 * The desk. It paints into a terminal from either engine and never imports those packages.
 * Pass a `Terminal`. Call `run` in the browser, or `draw` and `press` under test.
 */
export declare class Application implements UIHost {
    readonly surface: CellSurface;
    readonly desktop: Desktop;
    readonly menu: MenuBar;
    readonly status: StatusLine;
    theme: Theme;
    sound: boolean;
    focused: View | null;
    /** Lit caret phase. `run` blinks it. A headless `draw` leaves it on. */
    caretOn: boolean;
    private readonly menuWanted;
    private readonly statusWanted;
    private readonly beepFn;
    private readonly onQuit;
    private readonly modals;
    private active;
    private grabbed;
    private held;
    private holdingFocus;
    private audio;
    private painting;
    private again;
    private dirty;
    private quitting;
    private looping;
    private mounted;
    private frame;
    private listening;
    constructor(surface: CellSurface, options?: AppOptions);
    get cols(): number;
    get rows(): number;
    get menuLocked(): boolean;
    /** Desktop size in window coordinates. The menu and the status line sit outside it. */
    workArea(): Rect;
    activeView(): View | null;
    setTheme(next: ThemeName | Theme): void;
    /** Paint now. Safe to call again from a handler; the second pass runs after the first. */
    draw(): void;
    /** `run` paints this on the next frame. Call `draw` when the loop is not running. */
    requestDraw(): void;
    /**
     * Handle one key. A string is the key with no modifiers, the same text as `KeyboardEvent.key`.
     * Returns true when the desk used the key.
     */
    press(input: KeyEvent | string): boolean;
    /** Handle one pointer event in cell coordinates. */
    pointer(event: CellPointer): boolean;
    /**
     * Show `dialog` and return its result. Esc and the close box resolve null.
     * The promise resolves on the turn that closes the dialog.
     */
    modal(dialog: Dialog): Promise<string | null>;
    /** Listen for keys and the pointer. A missing `window` does nothing. */
    mount(): void;
    /** Remove the listeners and stop the frame loop. The last picture stays. */
    destroy(): void;
    /** Mount, paint, and blink the field caret. */
    run(): void;
    /** Stop the blink loop. Listeners stay until `destroy`. */
    stop(): void;
    /** Ignore later input, close dialogs, and call `onQuit`. */
    quit(): void;
    beep(freq?: number, duration?: number): void;
    focus(view: View | null): void;
    endModal(origin: View, result: string | null): void;
    capture(capture: PointerCapture | null): void;
    adopted(view: View): void;
    detached(view: View): void;
    saveFocus(): void;
    restoreFocus(): void;
    private prepareSurface;
    private layout;
    private runStatus;
    private runMenuCommand;
    private dispatchHot;
    private scope;
    private cycle;
    private cycleWindow;
    private activateWindow;
    private topModal;
    private topWindow;
    private finishModal;
    private pick;
    private nearestFocusable;
    private inTree;
    private canvasElement;
    private cellAt;
    private onKeyDown;
    private onPointerDown;
    private onPointerMove;
    private onPointerUp;
    private onWheel;
}
