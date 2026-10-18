import type { KeyEvent } from './surface.js';

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/** One screen cell per grapheme, so an emoji in a label stays one column. */
export function graphemes(text: string): string[] {
  if (!text) return [];
  if (segmenter) {
    const out: string[] = [];
    for (const part of segmenter.segment(text)) out.push(part.segment);
    return out;
  }
  return Array.from(text);
}

export function graphemeLength(text: string): number {
  return graphemes(text).length;
}

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

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
export function parseLabel(input: string): ParsedLabel {
  const source = graphemes(input);
  const text: string[] = [];
  let hot = -1;
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] !== '&') {
      text.push(source[i]);
      continue;
    }
    const next = source[i + 1];
    if (next == null) break;
    i += 1;
    if (next === '&') {
      text.push('&');
      continue;
    }
    if (hot < 0) hot = text.length;
    text.push(next);
  }
  const joined = text.join('');
  const hotChar = hot >= 0 ? (text[hot] ?? '').toLowerCase() : null;
  return { text: joined, hot, hotChar: hotChar || null };
}

/** Clip to `max` cells. A clipped string ends with an ellipsis when there is room. */
export function clipText(text: string, max: number): string {
  const parts = graphemes(text);
  if (parts.length <= max) return parts.join('');
  if (max <= 0) return '';
  if (max === 1) return '…';
  return parts.slice(0, max - 1).join('') + '…';
}

/** Wrap on spaces and on newlines. A word longer than `width` is split. */
export function wrapText(text: string, width: number): string[] {
  const limit = Math.max(1, width);
  const lines: string[] = [];
  for (const raw of text.split('\n')) {
    if (raw.length === 0) {
      lines.push('');
      continue;
    }
    let line: string[] = [];
    let count = 0;
    const words = raw.split(' ');
    for (let w = 0; w < words.length; w += 1) {
      const word = graphemes(words[w]);
      if (word.length > limit) {
        if (count > 0) {
          lines.push(line.join(''));
          line = [];
          count = 0;
        }
        for (let i = 0; i < word.length; i += limit) lines.push(word.slice(i, i + limit).join(''));
        continue;
      }
      const extra = count === 0 ? word.length : word.length + 1;
      if (count > 0 && count + extra > limit) {
        lines.push(line.join(''));
        line = word.slice();
        count = word.length;
      } else {
        if (count > 0) {
          line.push(' ');
          count += 1;
        }
        line.push(...word);
        count += word.length;
      }
    }
    lines.push(line.join(''));
  }
  return lines;
}

/**
 * Match a shortcut such as `F3`, `Alt-X`, `Alt+X`, `Ctrl-S`, or `Shift-F1`.
 * The hyphen and the plus sign are the same separator.
 */
export function matchShortcut(shortcut: string, event: KeyEvent): boolean {
  const parts = shortcut
    .trim()
    .toLowerCase()
    .replace(/-/g, '+')
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0 || event.meta) return false;
  let alt = false;
  let ctrl = false;
  let shift = false;
  let key = '';
  for (const part of parts) {
    if (part === 'alt') alt = true;
    else if (part === 'ctrl' || part === 'control') ctrl = true;
    else if (part === 'shift') shift = true;
    else if (part === 'meta' || part === 'cmd' || part === 'command') return false;
    else key = part;
  }
  if (!key) return false;
  if (!!event.alt !== alt || !!event.ctrl !== ctrl || !!event.shift !== shift) return false;
  const got = event.key.toLowerCase();
  if (got === key) return true;
  if (key === 'esc' && got === 'escape') return true;
  if (key === 'escape' && got === 'esc') return true;
  if ((key === 'return' || key === 'enter') && got === 'enter') return true;
  if (key === 'space' && got === ' ') return true;
  if (key === 'del' && got === 'delete') return true;
  if (key === 'pgup' && got === 'pageup') return true;
  if (key === 'pgdn' && got === 'pagedown') return true;
  return false;
}

export function sameLetter(letter: string, hot: string | null): boolean {
  return !!hot && letter.toLowerCase() === hot.toLowerCase();
}
