import type { CellSurface } from './surface.js';
import type { Rect } from './surface.js';
import type { Ink, Theme } from './theme.js';
import { clipText, graphemes } from './text.js';
import type { ParsedLabel } from './text.js';

export interface FrameGlyphs {
  h: string;
  v: string;
  tl: string;
  tr: string;
  bl: string;
  br: string;
}

export const SINGLE: FrameGlyphs = {
  h: '─',
  v: '│',
  tl: '┌',
  tr: '┐',
  bl: '└',
  br: '┘',
};

export const DOUBLE: FrameGlyphs = {
  h: '═',
  v: '║',
  tl: '╔',
  tr: '╗',
  bl: '╚',
  br: '╝',
};

/** Writes one cell at a time through `set`, clipped to the open rectangle and the grid. */
export class Painter {
  private clip: Rect | null = null;

  constructor(
    readonly surface: CellSurface,
    readonly theme: Theme,
  ) {}

  put(x: number, y: number, ch: string, ink: Ink): void {
    const col = Math.floor(x);
    const row = Math.floor(y);
    if (col < 0 || row < 0 || col >= this.surface.cols || row >= this.surface.rows) return;
    const box = this.clip;
    if (box && (col < box.x || row < box.y || col >= box.x + box.w || row >= box.y + box.h)) return;
    const glyph = graphemes(ch)[0] ?? ' ';
    this.surface.set(col, row, { ch: glyph, fg: ink.fg, bg: ink.bg, bright: false });
  }

  fill(x: number, y: number, w: number, h: number, ch: string, ink: Ink): void {
    if (w <= 0 || h <= 0) return;
    for (let row = 0; row < h; row += 1) {
      for (let col = 0; col < w; col += 1) this.put(x + col, y + row, ch, ink);
    }
  }

  /** Write graphemes from the left. Stops at `max` cells. */
  text(x: number, y: number, value: string, ink: Ink, max = 1000): void {
    const parts = graphemes(value);
    const count = Math.min(parts.length, Math.max(0, max));
    for (let i = 0; i < count; i += 1) this.put(x + i, y, parts[i], ink);
  }

  /** Like `text`, but the `&` hotkey uses `hot`. */
  label(x: number, y: number, parsed: ParsedLabel, ink: Ink, hot: Ink, max = 1000): void {
    const parts = graphemes(parsed.text);
    const count = Math.min(parts.length, Math.max(0, max));
    for (let i = 0; i < count; i += 1) {
      this.put(x + i, y, parts[i], i === parsed.hot ? hot : ink);
    }
  }

  withClip(rect: Rect, body: () => void): void {
    const prev = this.clip;
    this.clip = prev ? intersection(prev, rect) : rect;
    body();
    this.clip = prev;
  }
}

export function intersection(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
}

/** One-cell drop shadow to the right and along the bottom, outside `rect`. */
export function drawShadow(g: Painter, rect: Rect, glyph: string, ink: Ink): void {
  const { x, y, w, h } = rect;
  if (w <= 0 || h <= 0) return;
  for (let row = y + 1; row <= y + h; row += 1) g.put(x + w, row, glyph, ink);
  for (let col = x + 1; col < x + w; col += 1) g.put(col, y + h, glyph, ink);
}

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
export function drawFrame(g: Painter, rect: Rect, options: FrameOptions): void {
  const { x, y, w, h } = rect;
  if (w < 2 || h < 2) return;
  const { glyphs, ink } = options;
  for (let col = 0; col < w; col += 1) {
    g.put(x + col, y, glyphs.h, ink);
    g.put(x + col, y + h - 1, glyphs.h, ink);
  }
  for (let row = 0; row < h; row += 1) {
    g.put(x, y + row, glyphs.v, ink);
    g.put(x + w - 1, y + row, glyphs.v, ink);
  }
  g.put(x, y, glyphs.tl, ink);
  g.put(x + w - 1, y, glyphs.tr, ink);
  g.put(x, y + h - 1, glyphs.bl, ink);
  g.put(x + w - 1, y + h - 1, glyphs.br, ink);

  if (options.body && w > 2 && h > 2) {
    g.fill(x + 1, y + 1, w - 2, h - 2, ' ', options.body);
  }

  if (options.close) g.put(x + 1, y, options.close, ink);
  if (options.zoom && w > 3) g.put(x + w - 2, y, options.zoom, ink);

  const title = options.title ? clipText(options.title, Math.max(0, w - 6)) : '';
  if (!title) return;
  const parts = graphemes(title);
  const min = x + (options.close ? 3 : 2);
  const maxStart = x + w - (options.zoom ? 3 : 2) - parts.length;
  let start = x + Math.floor((w - parts.length) / 2);
  if (start < min) start = min;
  if (start > maxStart) start = Math.max(min, maxStart);
  for (let i = 0; i < parts.length; i += 1) {
    const col = start + i;
    if (col <= x || col >= x + w - 1) continue;
    if (options.close && col === x + 1) continue;
    if (options.zoom && col === x + w - 2) continue;
    g.put(col, y, parts[i], options.titleInk);
  }
}
