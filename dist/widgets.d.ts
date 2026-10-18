import { Painter } from './painter.js';
import type { CellPointer, KeyEvent } from './surface.js';
import { Group, View } from './view.js';
import type { ViewOptions } from './view.js';
export interface LabelOptions extends ViewOptions {
    text?: string;
    /** Alt+letter focuses this view and calls `invoke`. */
    target?: View | null;
}
/** One line of text. `&` marks the letter that focuses `target`. */
export declare class Label extends View {
    text: string;
    target: View | null;
    constructor(options?: LabelOptions);
    setText(text: string): void;
    paint(g: Painter): void;
    hot(letter: string): boolean;
}
export interface StaticTextOptions extends ViewOptions {
    text?: string;
}
/** Wrapped text inside `w` and `h`. Newlines break early. */
export declare class StaticText extends View {
    text: string;
    constructor(options?: StaticTextOptions);
    setText(text: string): void;
    paint(g: Painter): void;
}
export interface ButtonOptions extends ViewOptions {
    /** `&Ok` draws Ok and arms Alt+O. */
    text?: string;
    /** Yellow (or the theme's default) while this is the dialog default and not focused. */
    isDefault?: boolean;
    /**
     * When this property is present, a press closes the enclosing dialog with that result.
     * `null` cancels.
     */
    result?: string | null;
    onPress?: () => void;
}
/** A one-row button. `[ Ok ]` on the Borland theme, `< Ok >` on the Linux theme. */
export declare class Button extends View {
    text: string;
    /** Set when `result` was passed, including an explicit null. */
    readonly closes: boolean;
    readonly result: string | null;
    onPress: (() => void) | null;
    private armed;
    constructor(options?: ButtonOptions);
    paint(g: Painter): void;
    key(event: KeyEvent): boolean;
    hot(letter: string): boolean;
    invoke(): void;
    mouse(event: CellPointer): boolean;
    activate(): void;
}
export interface CheckBoxOptions extends ViewOptions {
    text?: string;
    checked?: boolean;
    onChange?: (checked: boolean) => void;
}
/** `[X] Sound` or `[ ] Sound`. Space, a click, and the hotkey toggle it. Enter stays with the dialog default. */
export declare class CheckBox extends View {
    text: string;
    checked: boolean;
    onChange: ((checked: boolean) => void) | null;
    constructor(options?: CheckBoxOptions);
    paint(g: Painter): void;
    key(event: KeyEvent): boolean;
    hot(letter: string): boolean;
    invoke(): void;
    mouse(event: CellPointer): boolean;
    toggle(): void;
    setChecked(checked: boolean): void;
}
export interface RadioGroupOptions extends ViewOptions {
    /** One entry per row. `&` marks a letter that selects that entry. */
    items?: string[];
    selected?: number;
    onChange?: (index: number, item: string) => void;
}
/** `(•) Walk` stacked down the group. Arrows move. The group is one tab stop. */
export declare class RadioGroup extends View {
    items: string[];
    selected: number;
    onChange: ((index: number, item: string) => void) | null;
    constructor(options?: RadioGroupOptions);
    paint(g: Painter): void;
    key(event: KeyEvent): boolean;
    hot(letter: string): boolean;
    mouse(event: CellPointer): boolean;
    select(index: number): void;
    private move;
}
export interface InputLineOptions extends ViewOptions {
    value?: string;
    /** Maximum graphemes. Default 240. */
    max?: number;
    password?: boolean;
    onChange?: (value: string) => void;
}
/**
 * A single field. The caret is a reversed cell.
 * Left, Right, Home, End, Backspace, and Delete edit. Ctrl-A and Ctrl-E jump.
 */
export declare class InputLine extends View {
    value: string;
    max: number;
    password: boolean;
    caret: number;
    onChange: ((value: string) => void) | null;
    private origin;
    constructor(options?: InputLineOptions);
    setValue(value: string, emit?: boolean): void;
    paint(g: Painter): void;
    key(event: KeyEvent): boolean;
    mouse(event: CellPointer): boolean;
    private shown;
    private fit;
    private commit;
}
export interface ScrollBarOptions extends ViewOptions {
    orientation?: 'vertical' | 'horizontal';
    min?: number;
    max?: number;
    value?: number;
    /** Page step when the track is clicked. Default 1. */
    page?: number;
    onChange?: (value: number) => void;
}
/** `▲ ▒ █ ▒ ▼` or the horizontal form. The thumb tracks `value` from `min` to `max`. */
export declare class ScrollBar extends View {
    orientation: 'vertical' | 'horizontal';
    min: number;
    max: number;
    value: number;
    page: number;
    onChange: ((value: number) => void) | null;
    constructor(options?: ScrollBarOptions);
    setValue(value: number, emit?: boolean): void;
    paint(g: Painter): void;
    key(event: KeyEvent): boolean;
    mouse(event: CellPointer): boolean;
    private dragThumb;
    private localIndex;
    private thumbIndex;
}
export interface ListBoxOptions extends ViewOptions {
    items?: string[];
    selected?: number;
    /** Fires when the highlight moves. */
    onChange?: (index: number, item: string) => void;
    /** Enter or a double click. */
    onAccept?: (index: number, item: string) => void;
}
/**
 * A framed list with a scrollbar on the inner right column.
 * Up and Down move the highlight. PageUp, PageDown, Home, and End scroll it.
 */
export declare class ListBox extends Group {
    items: string[];
    selected: number;
    scroll: number;
    onChange: ((index: number, item: string) => void) | null;
    onAccept: ((index: number, item: string) => void) | null;
    readonly bar: ScrollBar;
    private lastClick;
    private lastIndex;
    constructor(options?: ListBoxOptions);
    setItems(items: string[], selected?: number): void;
    select(index: number, emit?: boolean): void;
    paint(g: Painter): void;
    key(event: KeyEvent): boolean;
    mouse(event: CellPointer): boolean;
    private page;
    private maxScroll;
    private setScroll;
    private reveal;
}
export interface ProgressBarOptions extends ViewOptions {
    value?: number;
    max?: number;
    /** Draw a percentage in the middle when the bar is at least four cells. Default true. */
    showPercent?: boolean;
}
/** A one-row gauge. `value` runs from 0 to `max`. */
export declare class ProgressBar extends View {
    value: number;
    max: number;
    showPercent: boolean;
    constructor(options?: ProgressBarOptions);
    paint(g: Painter): void;
}
