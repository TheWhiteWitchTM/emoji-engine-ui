import type { CellSurface } from './surface.js';
import type { Rect } from './surface.js';
import type { Ink, Theme } from './theme.js';
import type { ParsedLabel } from './text.js';
export interface FrameGlyphs {
    h: string;
    v: string;
    tl: string;
    tr: string;
    bl: string;
    br: string;
}
export declare const SINGLE: FrameGlyphs;
export declare const DOUBLE: FrameGlyphs;
/** Writes one cell at a time through `set`, clipped to the open rectangle and the grid. */
export declare class Painter {
    readonly surface: CellSurface;
    readonly theme: Theme;
    private clip;
    constructor(surface: CellSurface, theme: Theme);
    put(x: number, y: number, ch: string, ink: Ink): void;
    fill(x: number, y: number, w: number, h: number, ch: string, ink: Ink): void;
    /** Write graphemes from the left. Stops at `max` cells. */
    text(x: number, y: number, value: string, ink: Ink, max?: number): void;
    /** Like `text`, but the `&` hotkey uses `hot`. */
    label(x: number, y: number, parsed: ParsedLabel, ink: Ink, hot: Ink, max?: number): void;
    withClip(rect: Rect, body: () => void): void;
}
export declare function intersection(a: Rect, b: Rect): Rect;
/** One-cell drop shadow to the right and along the bottom, outside `rect`. */
export declare function drawShadow(g: Painter, rect: Rect, glyph: string, ink: Ink): void;
export interface FrameOptions {
    glyphs: FrameGlyphs;
    ink: Ink;
    titleInk: Ink;
    title?: string;
    /** Drawn in the top edge, just after the left corner. Null hides it. */
    close?: string | null;
    /** Drawn in the top edge, just before the right corner. Null hides it. */
    zoom?: string | null;
    /** Fills the interior when set. */
    body?: Ink | null;
}
/** Box with an optional title sitting in the top edge. */
export declare function drawFrame(g: Painter, rect: Rect, options: FrameOptions): void;
