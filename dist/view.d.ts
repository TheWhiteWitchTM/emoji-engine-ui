import type { Painter } from './painter.js';
import type { CellPointer, KeyEvent, Rect } from './surface.js';
import type { Theme } from './theme.js';
/** Mouse drag owned by the view that saw the button go down. */
export interface PointerCapture {
    move(event: CellPointer): void;
    up(event: CellPointer): void;
}
/**
 * The desk, seen by a view. Widgets do not import Application.
 * `workArea` is the desktop in window coordinates: the menu and status sit outside it.
 */
export interface UIHost {
    readonly theme: Theme;
    readonly focused: View | null;
    readonly cols: number;
    readonly rows: number;
    /** False while `run` is not blinking, so a headless draw keeps the caret lit. */
    readonly caretOn: boolean;
    /** True while a modal dialog holds the menu. */
    readonly menuLocked: boolean;
    beep(freq?: number, duration?: number): void;
    focus(view: View | null): void;
    endModal(origin: View, result: string | null): void;
    capture(capture: PointerCapture | null): void;
    workArea(): Rect;
    activeView(): View | null;
    adopted(view: View): void;
    detached(view: View): void;
    saveFocus(): void;
    restoreFocus(): void;
}
export interface ViewOptions {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    disabled?: boolean;
    visible?: boolean;
}
/**
 * A rectangle on the desk. `x` and `y` are columns and rows inside the parent.
 * A window's children count the frame, so the first interior cell is `(1, 1)`.
 */
export declare class View {
    x: number;
    y: number;
    w: number;
    h: number;
    disabled: boolean;
    visible: boolean;
    /** Tab stops here when the view is visible and enabled. */
    focusable: boolean;
    /** Enter from a label, or a dialog default, prefers this view. */
    isDefault: boolean;
    hasFocus: boolean;
    parent: Group | null;
    host: UIHost | null;
    /** Empty bag for the caller, the same idea as a sprite's `data`. */
    data: Record<string, unknown>;
    constructor(options?: ViewOptions);
    /** Screen cell of the top-left corner. */
    abs(): Rect;
    contains(col: number, row: number): boolean;
    paint(_g: Painter): void;
    /** Return true when the key is consumed. */
    key(_event: KeyEvent): boolean;
    /** Return true when the pointer is consumed. */
    mouse(_event: CellPointer): boolean;
    /** Alt+letter. Return true when this view acts on `letter`. */
    hot(_letter: string): boolean;
    /** A label's hotkey landed here. Buttons press. Boxes toggle. Fields do nothing. */
    invoke(): void;
    /** The desk moved the keyboard cursor here. */
    focus(): void;
    /** The keyboard cursor left. */
    blur(): void;
}
/** A view that owns other views. Tab order is child order. */
export declare class Group extends View {
    readonly children: View[];
    add(view: View): this;
    remove(view: View): void;
    raise(view: View): void;
    setHost(host: UIHost | null): void;
    /** Focusable descendants in paint order. A disabled or hidden branch is skipped. */
    focusables(): View[];
    /** The first focusable descendant. Enter still presses the default button. */
    preferredFocus(): View | null;
    paint(g: Painter): void;
}
/** The patterned field under the windows. The application sizes it. */
export declare class Desktop extends Group {
    paint(g: Painter): void;
}
