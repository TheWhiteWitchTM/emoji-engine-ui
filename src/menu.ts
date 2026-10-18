import { SINGLE, drawFrame, drawShadow } from './painter.js';
import type { Painter } from './painter.js';
import type { CellPointer, KeyEvent, Rect } from './surface.js';
import { graphemeLength, graphemes, matchShortcut, parseLabel, sameLetter } from './text.js';
import type { ParsedLabel } from './text.js';
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

interface TitleSlot {
  index: number;
  x: number;
  w: number;
  parsed: ParsedLabel;
}

interface ItemSlot {
  index: number;
  entry: MenuEntry;
  parsed: ParsedLabel;
  shortcut: string;
}

interface PopupGeom {
  x: number;
  y: number;
  w: number;
  h: number;
  items: ItemSlot[];
}

/**
 * The top bar. Alt+letter or a click opens a menu. F10 lands on the bar.
 * Arrow keys move. Enter runs the row. Esc closes.
 */
export class MenuBar extends View {
  entries: MenuEntry[];
  /** Highlighted title, or -1 when the bar is idle. */
  top = -1;
  open = false;
  /** Row inside the open menu, or -1. */
  item = -1;
  /** Row inside the submenu, or -1 when the submenu is closed. */
  sub = -1;
  locked = false;

  private holding = false;
  private titles: TitleSlot[] = [];
  private popup: PopupGeom | null = null;
  private subpopup: PopupGeom | null = null;

  constructor(entries: MenuEntry[] = []) {
    super({ x: 0, y: 0, w: 1, h: 1 });
    this.entries = entries;
  }

  paint(g: Painter): void {
    if (!this.visible || this.h < 1) return;
    this.layout();
    const theme = g.theme;
    const bar = this.locked ? theme.menuLocked : theme.menuBar;
    const hot = this.locked ? theme.menuLockedHot : theme.menuHot;
    g.fill(this.x, this.y, this.w, 1, ' ', bar);
    for (const title of this.titles) {
      const active = !this.locked && title.index === this.top;
      const ink = active ? theme.menuActive : bar;
      const hotInk = active ? theme.menuActiveHot : hot;
      g.fill(title.x, this.y, title.w, 1, ' ', ink);
      g.label(title.x + 1, this.y, title.parsed, ink, hotInk, Math.max(0, title.w - 2));
    }
    if (this.locked || !this.open) return;
    if (this.popup) this.paintPopup(g, this.popup, this.item);
    if (this.subpopup && this.sub >= 0) this.paintPopup(g, this.subpopup, this.sub);
  }

  /** F10. Highlights the first title and does not open it yet. */
  focusBar(): void {
    if (this.locked || this.entries.length === 0) return;
    this.holdFocus();
    if (this.top < 0) this.top = 0;
    this.open = false;
    this.item = -1;
    this.sub = -1;
  }

  /** Alt+letter on a title. Returns true when a menu opens. */
  openHot(letter: string): boolean {
    if (this.locked) return false;
    const index = this.entries.findIndex((entry) => sameLetter(letter, parseLabel(entry.label ?? '').hotChar));
    if (index < 0) return false;
    this.openAt(index, true);
    return true;
  }

  close(): void {
    const was = this.holding;
    this.top = -1;
    this.open = false;
    this.item = -1;
    this.sub = -1;
    this.popup = null;
    this.subpopup = null;
    if (was) this.releaseFocus();
  }

  key(event: KeyEvent): boolean {
    if (this.locked || this.top < 0) return false;
    if (event.key === 'Escape' || event.key === 'F10') {
      this.close();
      return true;
    }
    if (!this.open) {
      if (event.key === 'ArrowLeft') {
        this.top = (this.top - 1 + this.entries.length) % this.entries.length;
        return true;
      }
      if (event.key === 'ArrowRight') {
        this.top = (this.top + 1) % this.entries.length;
        return true;
      }
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        this.openAt(this.top, true);
        return true;
      }
      if (event.alt && event.key.length === 1 && this.openHot(event.key)) return true;
      return true;
    }
    const items = this.currentItems();
    if (event.key === 'ArrowLeft') {
      if (this.sub >= 0) this.sub = -1;
      else this.switchTop(-1);
      return true;
    }
    if (event.key === 'ArrowRight') {
      if (this.item >= 0 && items[this.item]?.items?.length && this.sub < 0) this.openSub();
      else this.switchTop(1);
      return true;
    }
    if (event.key === 'ArrowDown') {
      this.moveItem(1);
      return true;
    }
    if (event.key === 'ArrowUp') {
      this.moveItem(-1);
      return true;
    }
    if (event.key === 'Home') {
      this.setEdge(1);
      return true;
    }
    if (event.key === 'End') {
      this.setEdge(-1);
      return true;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      this.activateCurrent();
      return true;
    }
    if (event.alt && event.key.length === 1 && this.openHot(event.key)) return true;
    if (event.key.length === 1 && !event.alt && !event.ctrl && !event.meta) {
      this.activateLetter(event.key);
      return true;
    }
    return true;
  }

  /** A click. True when the bar or an open menu consumed it. */
  pointer(event: CellPointer): boolean {
    if (!this.visible || this.locked || event.kind !== 'down' || event.button !== 0) return false;
    this.layout();
    const title = this.titles.find((slot) => event.col >= slot.x && event.col < slot.x + slot.w && event.row === this.y);
    if (title) {
      if (this.open && this.top === title.index) this.close();
      else this.openAt(title.index, true);
      return true;
    }
    if (this.open && this.hitPopup(event.col, event.row)) return true;
    if (this.open || this.top >= 0) {
      this.close();
      return true;
    }
    return false;
  }

  /** Move the highlight while a menu is open. True when it changed. */
  hover(col: number, row: number): boolean {
    if (!this.open || this.locked) return false;
    this.layout();
    const before = `${this.top}:${this.item}:${this.sub}`;
    const title = this.titles.find((slot) => col >= slot.x && col < slot.x + slot.w && row === this.y);
    if (title && title.index !== this.top) {
      this.openAt(title.index);
    } else if (this.subpopup && this.sub >= 0 && inside(col, row, this.subpopup)) {
      const hit = this.rowAt(this.subpopup, row);
      if (hit >= 0 && !this.subpopup.items[hit].entry.separator && !this.subpopup.items[hit].entry.disabled) {
        this.sub = hit;
      }
    } else if (this.popup && inside(col, row, this.popup)) {
      const hit = this.rowAt(this.popup, row);
      if (hit >= 0 && hit !== this.item) {
        const entry = this.popup.items[hit].entry;
        if (!entry.separator && !entry.disabled) {
          this.item = hit;
          this.sub = entry.items?.length ? firstEnabled(entry.items) : -1;
        }
      }
    }
    this.layout();
    return before !== `${this.top}:${this.item}:${this.sub}`;
  }

  private openAt(index: number, runBare = false): void {
    if (index < 0 || index >= this.entries.length) return;
    const entry = this.entries[index];
    const items = entry.items ?? [];
    if (items.length === 0) {
      if (runBare && entry.action && !entry.disabled) this.run(entry);
      return;
    }
    this.holdFocus();
    this.top = index;
    this.open = true;
    this.item = firstEnabled(items);
    this.sub = -1;
    this.layout();
  }

  private openSub(): void {
    const items = this.currentItems();
    const entry = items[this.item];
    if (!entry?.items?.length) return;
    this.sub = firstEnabled(entry.items);
  }

  private switchTop(dir: number): void {
    if (this.entries.length === 0) return;
    this.top = (this.top + dir + this.entries.length) % this.entries.length;
    const items = this.entries[this.top].items ?? [];
    this.open = items.length > 0;
    this.item = firstEnabled(items);
    this.sub = -1;
  }

  private currentItems(): MenuEntry[] {
    if (this.top < 0) return [];
    return this.entries[this.top].items ?? [];
  }

  private moveItem(dir: number): void {
    if (this.sub >= 0) {
      const items = this.currentItems()[this.item]?.items ?? [];
      const next = step(items, this.sub, dir);
      if (next >= 0) this.sub = next;
      return;
    }
    const next = step(this.currentItems(), this.item, dir);
    if (next >= 0) {
      this.item = next;
      this.sub = -1;
    }
  }

  private setEdge(dir: number): void {
    const items = this.sub >= 0 ? (this.currentItems()[this.item]?.items ?? []) : this.currentItems();
    const next = firstFrom(items, dir);
    if (next < 0) return;
    if (this.sub >= 0) this.sub = next;
    else this.item = next;
  }

  private activateCurrent(): void {
    if (this.sub >= 0) {
      const entry = this.currentItems()[this.item]?.items?.[this.sub];
      if (entry) this.run(entry);
      return;
    }
    const entry = this.currentItems()[this.item];
    if (!entry || entry.separator || entry.disabled) return;
    if (entry.items?.length) {
      this.openSub();
      return;
    }
    this.run(entry);
  }

  private activateLetter(letter: string): void {
    const pool = this.sub >= 0 ? (this.currentItems()[this.item]?.items ?? []) : this.currentItems();
    const index = pool.findIndex(
      (entry) => !entry.separator && !entry.disabled && sameLetter(letter, parseLabel(entry.label ?? '').hotChar),
    );
    if (index < 0) return;
    if (this.sub >= 0) this.sub = index;
    else this.item = index;
    this.activateCurrent();
  }

  private run(entry: MenuEntry): void {
    if (entry.disabled || entry.separator) return;
    if (entry.items?.length && !entry.action) {
      this.openSub();
      return;
    }
    this.close();
    this.host?.beep(660, 20);
    entry.action?.();
  }

  private hitPopup(col: number, row: number): boolean {
    if (this.subpopup && this.sub >= 0 && inside(col, row, this.subpopup)) {
      const hit = this.rowAt(this.subpopup, row);
      if (hit < 0) return true;
      this.sub = hit;
      const entry = this.subpopup.items[hit].entry;
      if (!entry.separator && !entry.disabled) this.run(entry);
      return true;
    }
    if (this.popup && inside(col, row, this.popup)) {
      const hit = this.rowAt(this.popup, row);
      if (hit < 0) return true;
      const entry = this.popup.items[hit].entry;
      if (entry.separator || entry.disabled) return true;
      this.item = hit;
      if (entry.items?.length) {
        this.openSub();
        return true;
      }
      this.run(entry);
      return true;
    }
    return false;
  }

  private rowAt(popup: PopupGeom, row: number): number {
    const index = row - (popup.y + 1);
    if (index < 0 || index >= popup.items.length) return -1;
    return index;
  }

  private holdFocus(): void {
    if (this.holding) return;
    this.holding = true;
    this.host?.saveFocus();
  }

  private releaseFocus(): void {
    if (!this.holding) return;
    this.holding = false;
    this.host?.restoreFocus();
  }

  private layout(): void {
    const y = this.y;
    let x = this.x;
    this.titles = [];
    for (let index = 0; index < this.entries.length; index += 1) {
      const parsed = parseLabel(this.entries[index].label ?? '');
      const width = graphemeLength(parsed.text) + 2;
      if (x + width > this.x + this.w) break;
      this.titles.push({ index, x, w: width, parsed });
      x += width;
    }
    this.popup = null;
    this.subpopup = null;
    if (!this.open || this.top < 0) return;
    const title = this.titles.find((slot) => slot.index === this.top);
    const items = this.entries[this.top].items ?? [];
    if (!title) return;
    this.popup = placePopup(items, title.x, y + 1, this.host?.cols ?? this.w, this.host?.rows ?? 24);
    if (this.item < 0 || !this.popup) return;
    const entry = items[this.item];
    if (!entry?.items?.length || this.sub < 0) return;
    const row = this.popup.y + 1 + this.item;
    let subX = this.popup.x + this.popup.w;
    const measured = measure(entry.items);
    if (subX + measured.w > (this.host?.cols ?? subX + measured.w)) subX = this.popup.x - measured.w;
    this.subpopup = placePopup(entry.items, subX, row - 1, this.host?.cols ?? this.w, this.host?.rows ?? 24);
  }

  private paintPopup(g: Painter, popup: PopupGeom, selected: number): void {
    const theme = g.theme;
    const rect: Rect = { x: popup.x, y: popup.y, w: popup.w, h: popup.h };
    drawFrame(g, rect, { glyphs: SINGLE, ink: theme.menu, titleInk: theme.menu, body: theme.menu });
    drawShadow(g, rect, theme.shadowGlyph, theme.windowShadow);
    popup.items.forEach((slot, index) => {
      const row = popup.y + 1 + index;
      const on = index === selected;
      if (slot.entry.separator) {
        g.put(popup.x, row, '├', theme.menuDisabled);
        g.put(popup.x + popup.w - 1, row, '┤', theme.menuDisabled);
        for (let col = 1; col < popup.w - 1; col += 1) {
          g.put(popup.x + col, row, SINGLE.h, theme.menuDisabled);
        }
        return;
      }
      const ink = slot.entry.disabled ? theme.menuDisabled : on ? theme.menuSelect : theme.menu;
      const hot = slot.entry.disabled ? theme.menuDisabled : on ? theme.menuSelectHot : theme.menuHot;
      const shortcutInk = slot.entry.disabled ? theme.menuDisabled : on ? theme.menuShortcutSelect : theme.menuShortcut;
      const parts = graphemes(slot.shortcut);
      const labelRoom = Math.max(0, popup.w - 4 - (parts.length > 0 ? parts.length + 1 : 0));
      g.fill(popup.x + 1, row, popup.w - 2, 1, ' ', ink);
      g.label(popup.x + 2, row, slot.parsed, ink, hot, labelRoom);
      if (parts.length > 0) {
        const shortcutInkHere = slot.entry.items?.length ? ink : shortcutInk;
        g.text(popup.x + popup.w - 2 - parts.length, row, slot.shortcut, shortcutInkHere, parts.length);
      }
    });
  }
}

/** The bottom line of key hints. A click runs the hint under the pointer. */
export class StatusLine extends View {
  hints: StatusHint[];
  private spans: { hint: StatusHint; x: number; w: number }[] = [];

  constructor(hints: StatusHint[] = []) {
    super({ x: 0, y: 0, w: 1, h: 1 });
    this.hints = hints;
  }

  paint(g: Painter): void {
    if (!this.visible || this.h < 1) return;
    const theme = g.theme;
    const locked = !!this.host?.menuLocked;
    g.fill(this.x, this.y, this.w, 1, ' ', theme.status);
    this.spans = [];
    let x = this.x + 1;
    for (const hint of this.hints) {
      const dim = hint.disabled || (locked && !hint.global);
      const ink = dim ? theme.statusDisabled : theme.status;
      const hot = dim ? theme.statusDisabled : theme.statusHot;
      const key = graphemes(hint.key);
      const label = graphemes(hint.label);
      const width = key.length + label.length + 3;
      if (x + width >= this.x + this.w) break;
      const start = x;
      g.put(x, this.y, ' ', ink);
      x += 1;
      for (const ch of key) {
        g.put(x, this.y, ch, hot);
        x += 1;
      }
      g.put(x, this.y, ' ', ink);
      x += 1;
      for (const ch of label) {
        g.put(x, this.y, ch, ink);
        x += 1;
      }
      g.put(x, this.y, ' ', ink);
      x += 1;
      this.spans.push({ hint, x: start, w: x - start });
    }
  }

  /**
   * Run the hint that matches `event`.
   * While a dialog is open, only `global` hints run.
   */
  activate(event: KeyEvent, modal: boolean): boolean {
    for (const hint of this.hints) {
      if (hint.disabled || !hint.action) continue;
      if (modal && !hint.global) continue;
      if (!matchShortcut(hint.key, event)) continue;
      this.host?.beep(660, 20);
      hint.action();
      return true;
    }
    return false;
  }

  pointer(event: CellPointer, modal: boolean): boolean {
    if (!this.visible || event.kind !== 'down' || event.button !== 0 || event.row !== this.y) return false;
    const span = this.spans.find((item) => event.col >= item.x && event.col < item.x + item.w);
    if (!span || span.hint.disabled || !span.hint.action) return false;
    if (modal && !span.hint.global) return false;
    this.host?.beep(660, 20);
    span.hint.action();
    return true;
  }
}

/** Walk titles and rows. The first matching shortcut with an action runs. */
export function runMenuShortcut(entries: MenuEntry[], event: KeyEvent): boolean {
  for (const entry of entries) {
    if (entry.separator) continue;
    if (entry.items && runMenuShortcut(entry.items, event)) return true;
    if (entry.disabled || !entry.action || !entry.shortcut) continue;
    if (!matchShortcut(entry.shortcut, event)) continue;
    entry.action();
    return true;
  }
  return false;
}

function firstEnabled(items: MenuEntry[]): number {
  return items.findIndex((entry) => !entry.separator && !entry.disabled);
}

function firstFrom(items: MenuEntry[], dir: number): number {
  if (dir > 0) return firstEnabled(items);
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (!items[i].separator && !items[i].disabled) return i;
  }
  return -1;
}

function step(items: MenuEntry[], from: number, dir: number): number {
  if (items.length === 0) return -1;
  let index = from < 0 ? (dir > 0 ? -1 : 0) : from;
  for (let n = 0; n < items.length; n += 1) {
    index = mod(index + dir, items.length);
    if (!items[index].separator && !items[index].disabled) return index;
  }
  return -1;
}

function mod(value: number, length: number): number {
  return ((value % length) + length) % length;
}

function measure(items: MenuEntry[]): { w: number; h: number; slots: ItemSlot[] } {
  let inner = 8;
  const slots: ItemSlot[] = items.map((entry, index) => {
    const parsed = parseLabel(entry.label ?? '');
    const shortcut = entry.items?.length ? '►' : (entry.shortcut ?? '');
    const width = graphemeLength(parsed.text) + graphemeLength(shortcut) + (shortcut ? 4 : 2);
    if (width > inner) inner = width;
    return { index, entry, parsed, shortcut };
  });
  return { w: inner + 2, h: Math.max(2, items.length + 2), slots };
}

function placePopup(items: MenuEntry[], x: number, y: number, cols: number, rows: number): PopupGeom {
  const measured = measure(items);
  let left = x;
  let top = y;
  if (left + measured.w > cols) left = Math.max(0, cols - measured.w);
  if (left < 0) left = 0;
  if (top + measured.h > rows) top = Math.max(0, rows - measured.h);
  if (top < 0) top = 0;
  return { x: left, y: top, w: measured.w, h: measured.h, items: measured.slots };
}

function inside(col: number, row: number, rect: Rect): boolean {
  return col >= rect.x && row >= rect.y && col < rect.x + rect.w && row < rect.y + rect.h;
}

