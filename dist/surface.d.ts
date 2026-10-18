/**
 * The cell buffer both engines already implement.
 * The UI paints with `set` and never calls `write`, so a sequence cannot move the cursor.
 * `colorStyle` and `border` exist only on emoji-engine-2d and are not required.
 */
export interface CellSurface {
    readonly cols: number;
    readonly rows: number;
    /** The desk hides the hardware caret and draws its own. */
    cursorLit: boolean;
    set(col: number, row: number, value: CellInk | string): void;
    get(col: number, row: number): CellInk;
    beginFrame(): void;
    endFrame(): void;
    /** Present when the surface is an engine terminal. Mouse hits land on `canvas.element`. */
    canvas?: {
        element?: EventTarget | null;
    };
    /** A raw canvas, if the caller passed one instead of a terminal. */
    element?: EventTarget | null;
    /** Optional. Called once with `'ansi'` when the terminal has a palette switch. */
    colorStyle?: (style: string) => void;
    /** Optional. Called once with ANSI blue so unpainted cells match the desk. */
    background?: (color: string | number | null) => void;
}
/** What `set` stores. Indexes are ANSI 0–15. `bright` stays false so 0–7 do not shift. */
export interface CellInk {
    ch: string;
    fg?: number | null;
    bg?: number | null;
    bright?: boolean;
}
/** A key, with the modifiers `Terminal.onKey` does not forward. */
export interface KeyEvent {
    /** `KeyboardEvent.key`, such as `ArrowUp`, `Enter`, `a`, or `F10`. */
    key: string;
    alt?: boolean;
    ctrl?: boolean;
    shift?: boolean;
    meta?: boolean;
    repeat?: boolean;
}
/** A pointer in cell coordinates. `col` and `row` may fall outside the grid during a drag. */
export interface CellPointer {
    col: number;
    row: number;
    kind: 'down' | 'up' | 'move' | 'wheel';
    /** DOM button. The desk acts on 0. */
    button: number;
    /** Wheel delta. Positive scrolls down. */
    delta: number;
}
export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}
