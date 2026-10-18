import type { KeyEvent } from './surface.js';
/** One screen cell per grapheme, so an emoji in a label stays one column. */
export declare function graphemes(text: string): string[];
export declare function graphemeLength(text: string): number;
export declare function clamp(value: number, min: number, max: number): number;
export interface ParsedLabel {
    text: string;
    /** Index of the hotkey grapheme, or -1. */
    hot: number;
    /** Lowercase hotkey grapheme, or null. */
    hotChar: string | null;
}
/**
 * `&File` marks F. `E&xit` marks x. `&&` is a literal ampersand.
 * The marker is not drawn.
 */
export declare function parseLabel(input: string): ParsedLabel;
/** Clip to `max` cells. A clipped string ends with an ellipsis when there is room. */
export declare function clipText(text: string, max: number): string;
/** Wrap on spaces and on newlines. A word longer than `width` is split. */
export declare function wrapText(text: string, width: number): string[];
/**
 * Match a shortcut such as `F3`, `Alt-X`, `Alt+X`, `Ctrl-S`, or `Shift-F1`.
 * The hyphen and the plus sign are the same separator.
 */
export declare function matchShortcut(shortcut: string, event: KeyEvent): boolean;
export declare function sameLetter(letter: string, hot: string | null): boolean;
