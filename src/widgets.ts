import { Painter } from './painter.js';
import { SINGLE, drawFrame } from './painter.js';
import type { CellPointer, KeyEvent } from './surface.js';
import type { Ink } from './theme.js';
import { clamp, graphemeLength, graphemes, parseLabel, sameLetter, wrapText } from './text.js';
import { Group, View } from './view.js';
import type { ViewOptions } from './view.js';

export interface LabelOptions extends ViewOptions {
  text?: string;
  /** Alt+letter focuses this view and calls `invoke`. */
  target?: View | null;
}

/** One line of text. `&` marks the letter that focuses `target`. */
export class Label extends View {
  text: string;
  target: View | null;

  constructor(options: LabelOptions = {}) {
    const text = options.text ?? '';
    super({
      ...options,
      w: options.w ?? Math.max(1, graphemeLength(parseLabel(text).text)),
      h: options.h ?? 1,
    });
    this.text = text;
    this.target = options.target ?? null;
  }

  setText(text: string): void {
    this.text = text;
  }

  paint(g: Painter): void {
    const theme = g.theme;
    const rect = this.abs();
    const ink = this.disabled ? theme.labelDisabled : theme.label;
    const hot = this.disabled ? theme.labelDisabled : theme.labelHot;
    g.label(rect.x, rect.y, parseLabel(this.text), ink, hot, this.w);
  }

  hot(letter: string): boolean {
    if (!this.target || this.target.disabled || !this.target.visible) return false;
    if (!sameLetter(letter, parseLabel(this.text).hotChar)) return false;
    if (this.target.focusable) this.host?.focus(this.target);
    this.target.invoke();
    return true;
  }
}

export interface StaticTextOptions extends ViewOptions {
  text?: string;
}

/** Wrapped text inside `w` and `h`. Newlines break early. */
export class StaticText extends View {
  text: string;

  constructor(options: StaticTextOptions = {}) {
    super({ ...options, w: options.w ?? 8, h: options.h ?? 1 });
    this.text = options.text ?? '';
  }

  setText(text: string): void {
    this.text = text;
  }

  paint(g: Painter): void {
    const rect = this.abs();
    const lines = wrapText(this.text, Math.max(1, this.w)).slice(0, Math.max(0, this.h));
    const ink = g.theme.windowBody;
    for (let row = 0; row < lines.length; row += 1) {
      g.text(rect.x, rect.y + row, lines[row], ink, this.w);
    }
  }
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
export class Button extends View {
  text: string;
  /** Set when `result` was passed, including an explicit null. */
  readonly closes: boolean;
  readonly result: string | null;
  onPress: (() => void) | null;
  private armed = false;

  constructor(options: ButtonOptions = {}) {
    const text = options.text ?? 'Ok';
    const span = graphemeLength(parseLabel(text).text) + 4;
    super({
      ...options,
      w: options.w ?? Math.max(4, span),
      h: 1,
    });
    this.text = text;
    this.isDefault = options.isDefault ?? false;
    this.closes = Object.prototype.hasOwnProperty.call(options, 'result');
    this.result = options.result ?? null;
    this.onPress = options.onPress ?? null;
    this.focusable = true;
  }

  paint(g: Painter): void {
    const theme = g.theme;
    const rect = this.abs();
    let ink = theme.button;
    let hot = theme.buttonHot;
    if (this.disabled) {
      ink = theme.buttonDisabled;
      hot = theme.buttonDisabled;
    } else if (this.hasFocus) {
      ink = theme.buttonFocus;
      hot = theme.buttonFocusHot;
    } else if (this.isDefault) {
      ink = theme.buttonDefault;
      hot = theme.buttonHot;
    }
    g.put(rect.x, rect.y, theme.buttonLeft, ink);
    g.put(rect.x + this.w - 1, rect.y, theme.buttonRight, ink);
    for (let col = 1; col < this.w - 1; col += 1) g.put(rect.x + col, rect.y, ' ', ink);
    const parsed = parseLabel(this.text);
    const room = this.w - 4;
    if (room > 0) g.label(rect.x + 2, rect.y, parsed, ink, hot, room);
  }

  key(event: KeyEvent): boolean {
    // Enter belongs to the dialog's default button. Space presses this one.
    if (event.key === ' ') {
      this.activate();
      return true;
    }
    return false;
  }

  hot(letter: string): boolean {
    if (!sameLetter(letter, parseLabel(this.text).hotChar)) return false;
    this.activate();
    return true;
  }

  invoke(): void {
    this.activate();
  }

  mouse(event: CellPointer): boolean {
    if (this.disabled || event.button !== 0 || event.kind !== 'down') return false;
    this.host?.focus(this);
    this.armed = true;
    this.host?.capture({
      move: (next) => {
        this.armed = this.contains(next.col, next.row);
      },
      up: (next) => {
        const fire = this.armed && this.contains(next.col, next.row);
        this.armed = false;
        if (fire) this.activate();
      },
    });
    return true;
  }

  activate(): void {
    if (this.disabled || !this.visible) return;
    this.onPress?.();
    this.host?.beep(660, 28);
    if (this.closes) this.host?.endModal(this, this.result);
  }
}

export interface CheckBoxOptions extends ViewOptions {
  text?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

/** `[X] Sound` or `[ ] Sound`. Space, a click, and the hotkey toggle it. Enter stays with the dialog default. */
export class CheckBox extends View {
  text: string;
  checked: boolean;
  onChange: ((checked: boolean) => void) | null;

  constructor(options: CheckBoxOptions = {}) {
    const text = options.text ?? '';
    const span = graphemeLength(parseLabel(text).text) + 4;
    super({
      ...options,
      w: options.w ?? Math.max(3, span),
      h: 1,
    });
    this.text = text;
    this.checked = options.checked ?? false;
    this.onChange = options.onChange ?? null;
    this.focusable = true;
  }

  paint(g: Painter): void {
    const theme = g.theme;
    const rect = this.abs();
    const ink = this.disabled ? theme.labelDisabled : this.hasFocus ? theme.checkFocus : theme.check;
    const hot = this.disabled ? theme.labelDisabled : this.hasFocus ? theme.checkFocusHot : theme.checkHot;
    const mark = this.checked ? theme.checkOn : theme.checkOff;
    g.put(rect.x, rect.y, '[', ink);
    g.put(rect.x + 1, rect.y, mark, ink);
    g.put(rect.x + 2, rect.y, ']', ink);
    if (this.w > 3) g.put(rect.x + 3, rect.y, ' ', ink);
    g.label(rect.x + 4, rect.y, parseLabel(this.text), ink, hot, Math.max(0, this.w - 4));
  }

  key(event: KeyEvent): boolean {
    if (event.key === ' ') {
      this.toggle();
      return true;
    }
    return false;
  }

  hot(letter: string): boolean {
    if (!sameLetter(letter, parseLabel(this.text).hotChar)) return false;
    this.host?.focus(this);
    this.toggle();
    return true;
  }

  invoke(): void {
    this.toggle();
  }

  mouse(event: CellPointer): boolean {
    if (this.disabled || event.kind !== 'down' || event.button !== 0) return false;
    this.host?.focus(this);
    this.toggle();
    return true;
  }

  toggle(): void {
    if (this.disabled) return;
    this.checked = !this.checked;
    this.onChange?.(this.checked);
    this.host?.beep(880, 16);
  }

  setChecked(checked: boolean): void {
    this.checked = checked;
  }
}

export interface RadioGroupOptions extends ViewOptions {
  /** One entry per row. `&` marks a letter that selects that entry. */
  items?: string[];
  selected?: number;
  onChange?: (index: number, item: string) => void;
}

/** `(•) Walk` stacked down the group. Arrows move. The group is one tab stop. */
export class RadioGroup extends View {
  items: string[];
  selected: number;
  onChange: ((index: number, item: string) => void) | null;

  constructor(options: RadioGroupOptions = {}) {
    const items = (options.items ?? []).slice();
    const width = options.w ?? Math.max(4, ...items.map((item) => graphemeLength(parseLabel(item).text) + 4), 4);
    super({
      ...options,
      w: width,
      h: options.h ?? Math.max(1, items.length),
    });
    this.items = items;
    this.selected = items.length === 0 ? -1 : clamp(options.selected ?? 0, 0, items.length - 1);
    this.onChange = options.onChange ?? null;
    this.focusable = true;
  }

  paint(g: Painter): void {
    const theme = g.theme;
    const rect = this.abs();
    const rows = Math.min(this.items.length, this.h);
    for (let row = 0; row < rows; row += 1) {
      const on = row === this.selected;
      const ink = this.disabled ? theme.labelDisabled : on && this.hasFocus ? theme.checkFocus : theme.check;
      const hot = this.disabled ? theme.labelDisabled : theme.checkHot;
      const mark = on ? theme.radioOn : theme.radioOff;
      g.put(rect.x, rect.y + row, '(', ink);
      g.put(rect.x + 1, rect.y + row, mark, ink);
      g.put(rect.x + 2, rect.y + row, ')', ink);
      if (this.w > 3) g.put(rect.x + 3, rect.y + row, ' ', ink);
      g.label(rect.x + 4, rect.y + row, parseLabel(this.items[row]), ink, hot, Math.max(0, this.w - 4));
    }
  }

  key(event: KeyEvent): boolean {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      this.move(1);
      return true;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      this.move(-1);
      return true;
    }
    if (event.key === 'Home') {
      this.select(0);
      return true;
    }
    if (event.key === 'End') {
      this.select(this.items.length - 1);
      return true;
    }
    if (event.key.length === 1 && !event.alt && !event.ctrl && !event.meta) {
      return this.hot(event.key);
    }
    return false;
  }

  hot(letter: string): boolean {
    const index = this.items.findIndex((item) => sameLetter(letter, parseLabel(item).hotChar));
    if (index < 0) return false;
    this.host?.focus(this);
    this.select(index);
    return true;
  }

  mouse(event: CellPointer): boolean {
    if (this.disabled || event.kind !== 'down' || event.button !== 0) return false;
    const index = event.row - this.abs().y;
    if (index < 0 || index >= this.items.length) return false;
    this.host?.focus(this);
    this.select(index);
    return true;
  }

  select(index: number): void {
    if (this.items.length === 0 || this.disabled) return;
    const next = clamp(index, 0, this.items.length - 1);
    if (next === this.selected) return;
    this.selected = next;
    this.onChange?.(next, this.items[next]);
    this.host?.beep(880, 16);
  }

  private move(dir: number): void {
    if (this.items.length === 0) return;
    const base = this.selected < 0 ? 0 : this.selected;
    const next = (base + dir + this.items.length) % this.items.length;
    this.select(next);
  }
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
export class InputLine extends View {
  value = '';
  max: number;
  password: boolean;
  caret = 0;
  onChange: ((value: string) => void) | null;
  private origin = 0;

  constructor(options: InputLineOptions = {}) {
    super({ ...options, w: options.w ?? 12, h: 1 });
    this.max = Math.max(1, options.max ?? 240);
    this.password = options.password ?? false;
    this.onChange = options.onChange ?? null;
    this.focusable = true;
    this.setValue(options.value ?? '', false);
  }

  setValue(value: string, emit = true): void {
    const parts = graphemes(value).slice(0, this.max);
    const next = parts.join('');
    this.caret = Math.min(this.caret, parts.length);
    if (next === this.value) return;
    this.value = next;
    if (emit) this.onChange?.(this.value);
  }

  paint(g: Painter): void {
    const theme = g.theme;
    const rect = this.abs();
    const parts = this.shown();
    this.fit(parts.length);
    g.fill(rect.x, rect.y, this.w, 1, ' ', theme.input);
    for (let col = 0; col < this.w; col += 1) {
      const index = this.origin + col;
      const glyph = index < parts.length ? parts[index] : ' ';
      const caret = this.hasFocus && (this.host?.caretOn ?? true) && index === this.caret;
      g.put(rect.x + col, rect.y, glyph, caret ? theme.inputCaret : theme.input);
    }
  }

  key(event: KeyEvent): boolean {
    const parts = graphemes(this.value);
    if (event.ctrl && !event.alt && !event.meta && event.key.toLowerCase() === 'a') {
      this.caret = 0;
      return true;
    }
    if (event.ctrl && !event.alt && !event.meta && event.key.toLowerCase() === 'e') {
      this.caret = parts.length;
      return true;
    }
    if (event.key === 'ArrowLeft') {
      this.caret = Math.max(0, this.caret - 1);
      return true;
    }
    if (event.key === 'ArrowRight') {
      this.caret = Math.min(parts.length, this.caret + 1);
      return true;
    }
    if (event.key === 'Home') {
      this.caret = 0;
      return true;
    }
    if (event.key === 'End') {
      this.caret = parts.length;
      return true;
    }
    if (event.key === 'Backspace') {
      if (this.caret > 0) {
        parts.splice(this.caret - 1, 1);
        this.caret -= 1;
        this.commit(parts);
      }
      return true;
    }
    if (event.key === 'Delete') {
      if (this.caret < parts.length) {
        parts.splice(this.caret, 1);
        this.commit(parts);
      }
      return true;
    }
    if (event.key.length === 1 && !event.ctrl && !event.alt && !event.meta) {
      if (parts.length >= this.max) return true;
      parts.splice(this.caret, 0, event.key);
      this.caret += 1;
      this.commit(parts);
      return true;
    }
    return false;
  }

  mouse(event: CellPointer): boolean {
    if (this.disabled || event.kind !== 'down' || event.button !== 0) return false;
    this.host?.focus(this);
    const parts = graphemes(this.value);
    let index = this.origin + (event.col - this.abs().x);
    if (index < 0) index = 0;
    if (index > parts.length) index = parts.length;
    this.caret = index;
    return true;
  }

  private shown(): string[] {
    const parts = graphemes(this.value);
    if (!this.password) return parts;
    return parts.map(() => this.host?.theme.password ?? '•');
  }

  private fit(length: number): void {
    if (this.caret < this.origin) this.origin = this.caret;
    if (this.caret >= this.origin + this.w) this.origin = this.caret - this.w + 1;
    const maxOrigin = Math.max(0, length - this.w + 1);
    if (this.origin > maxOrigin) this.origin = maxOrigin;
    if (this.origin < 0) this.origin = 0;
  }

  private commit(parts: string[]): void {
    this.value = parts.join('');
    this.onChange?.(this.value);
  }
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
export class ScrollBar extends View {
  orientation: 'vertical' | 'horizontal';
  min: number;
  max: number;
  value: number;
  page: number;
  onChange: ((value: number) => void) | null;

  constructor(options: ScrollBarOptions = {}) {
    const orientation = options.orientation ?? 'vertical';
    super({
      ...options,
      w: options.w ?? (orientation === 'vertical' ? 1 : 8),
      h: options.h ?? (orientation === 'vertical' ? 8 : 1),
    });
    this.orientation = orientation;
    this.min = options.min ?? 0;
    this.max = options.max ?? 0;
    this.value = options.value ?? 0;
    this.page = Math.max(1, options.page ?? 1);
    this.onChange = options.onChange ?? null;
    this.value = clamp(this.value, this.min, Math.max(this.min, this.max));
  }

  setValue(value: number, emit = true): void {
    const next = clamp(Math.round(value), this.min, Math.max(this.min, this.max));
    if (next === this.value) return;
    this.value = next;
    if (emit) this.onChange?.(this.value);
  }

  paint(g: Painter): void {
    const theme = g.theme;
    const rect = this.abs();
    const vertical = this.orientation === 'vertical';
    const length = vertical ? rect.h : rect.w;
    const track = Math.max(0, length - 2);
    const putAt = (index: number, ch: string, ink: Ink): void => {
      if (vertical) g.put(rect.x, rect.y + index, ch, ink);
      else g.put(rect.x + index, rect.y, ch, ink);
    };
    if (length >= 1) putAt(0, vertical ? theme.scrollUp : theme.scrollLeft, theme.scroll);
    if (length >= 2) putAt(length - 1, vertical ? theme.scrollDown : theme.scrollRight, theme.scroll);
    for (let i = 0; i < track; i += 1) putAt(1 + i, theme.track, theme.scroll);
    if (track > 0) putAt(1 + this.thumbIndex(track), theme.thumb, theme.scrollThumb);
  }

  key(event: KeyEvent): boolean {
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      this.setValue(this.value - 1);
      return true;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      this.setValue(this.value + 1);
      return true;
    }
    if (event.key === 'PageUp') {
      this.setValue(this.value - this.page);
      return true;
    }
    if (event.key === 'PageDown') {
      this.setValue(this.value + this.page);
      return true;
    }
    if (event.key === 'Home') {
      this.setValue(this.min);
      return true;
    }
    if (event.key === 'End') {
      this.setValue(this.max);
      return true;
    }
    return false;
  }

  mouse(event: CellPointer): boolean {
    if (this.disabled || event.button !== 0) return false;
    if (event.kind === 'wheel') {
      this.setValue(this.value + Math.sign(event.delta));
      return true;
    }
    if (event.kind !== 'down') return false;
    const local = this.localIndex(event);
    const length = this.orientation === 'vertical' ? this.h : this.w;
    const track = Math.max(0, length - 2);
    if (local <= 0) {
      this.setValue(this.value - 1);
      return true;
    }
    if (local >= length - 1) {
      this.setValue(this.value + 1);
      return true;
    }
    const thumb = this.thumbIndex(track);
    const trackPos = local - 1;
    if (trackPos === thumb) {
      this.dragThumb(event, track);
      return true;
    }
    this.setValue(this.value + (trackPos < thumb ? -this.page : this.page));
    return true;
  }

  private dragThumb(event: CellPointer, track: number): void {
    const origin = this.localIndex(event);
    const originValue = this.value;
    this.host?.capture({
      move: (next) => {
        if (track <= 1 || this.max <= this.min) return;
        const delta = this.localIndex(next) - origin;
        const span = this.max - this.min;
        const value = originValue + Math.round((delta * span) / (track - 1));
        this.setValue(value);
      },
      up: () => {},
    });
  }

  private localIndex(event: CellPointer): number {
    const rect = this.abs();
    return this.orientation === 'vertical' ? event.row - rect.y : event.col - rect.x;
  }

  private thumbIndex(track: number): number {
    if (track <= 1 || this.max <= this.min) return 0;
    const t = (this.value - this.min) / (this.max - this.min);
    return clamp(Math.round(t * (track - 1)), 0, track - 1);
  }
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
export class ListBox extends Group {
  items: string[] = [];
  selected = -1;
  scroll = 0;
  onChange: ((index: number, item: string) => void) | null;
  onAccept: ((index: number, item: string) => void) | null;
  readonly bar: ScrollBar;
  private lastClick = 0;
  private lastIndex = -1;

  constructor(options: ListBoxOptions = {}) {
    super({ ...options, w: options.w ?? 16, h: options.h ?? 6 });
    this.onChange = options.onChange ?? null;
    this.onAccept = options.onAccept ?? null;
    this.focusable = true;
    this.bar = new ScrollBar({ x: Math.max(0, this.w - 2), y: 1, w: 1, h: Math.max(1, this.h - 2) });
    this.bar.onChange = (value) => {
      this.scroll = value;
    };
    this.add(this.bar);
    this.setItems(options.items ?? [], options.selected ?? 0);
  }

  setItems(items: string[], selected = this.selected): void {
    this.items = items.slice();
    if (this.items.length === 0) this.selected = -1;
    else this.selected = clamp(selected, 0, this.items.length - 1);
    this.reveal();
  }

  select(index: number, emit = true): void {
    if (this.items.length === 0) {
      this.selected = -1;
      this.reveal();
      return;
    }
    const next = clamp(index, 0, this.items.length - 1);
    const changed = next !== this.selected;
    this.selected = next;
    this.reveal();
    if (changed && emit) this.onChange?.(next, this.items[next]);
  }

  paint(g: Painter): void {
    const theme = g.theme;
    const rect = this.abs();
    drawFrame(g, rect, { glyphs: SINGLE, ink: theme.list, titleInk: theme.list, body: theme.list });
    const page = this.page();
    const width = Math.max(0, this.w - 3);
    for (let row = 0; row < page; row += 1) {
      const index = this.scroll + row;
      const on = index === this.selected && index >= 0 && index < this.items.length;
      const ink = on ? (this.hasFocus ? theme.listFocus : theme.listSelect) : theme.list;
      const text = index >= 0 && index < this.items.length ? this.items[index] : '';
      g.fill(rect.x + 1, rect.y + 1 + row, width, 1, ' ', ink);
      g.text(rect.x + 1, rect.y + 1 + row, text, ink, width);
    }
    this.bar.x = this.w - 2;
    this.bar.y = 1;
    this.bar.w = 1;
    this.bar.h = Math.max(1, this.h - 2);
    this.bar.min = 0;
    this.bar.max = this.maxScroll();
    this.bar.page = page;
    this.bar.setValue(this.scroll, false);
    this.bar.paint(g);
  }

  key(event: KeyEvent): boolean {
    if (this.items.length === 0) return false;
    if (event.key === 'ArrowUp') {
      this.select(this.selected - 1);
      return true;
    }
    if (event.key === 'ArrowDown') {
      this.select(this.selected + 1);
      return true;
    }
    if (event.key === 'PageUp') {
      this.select(this.selected - this.page());
      return true;
    }
    if (event.key === 'PageDown') {
      this.select(this.selected + this.page());
      return true;
    }
    if (event.key === 'Home') {
      this.select(0);
      return true;
    }
    if (event.key === 'End') {
      this.select(this.items.length - 1);
      return true;
    }
    if (event.key === 'Enter') {
      if (this.selected >= 0) this.onAccept?.(this.selected, this.items[this.selected]);
      return true;
    }
    return false;
  }

  mouse(event: CellPointer): boolean {
    if (this.disabled) return false;
    if (event.kind === 'wheel') {
      const dir = Math.sign(event.delta);
      if (dir !== 0) this.setScroll(this.scroll + dir);
      return true;
    }
    if (event.kind !== 'down' || event.button !== 0) return false;
    const rect = this.abs();
    const localX = event.col - rect.x;
    const localY = event.row - rect.y;
    if (localX === this.w - 2) return this.bar.mouse(event);
    if (localX <= 0 || localX >= this.w - 1 || localY <= 0 || localY >= this.h - 1) return false;
    const index = this.scroll + (localY - 1);
    if (index < 0 || index >= this.items.length) return false;
    this.host?.focus(this);
    const now = Date.now();
    const again = index === this.lastIndex && now - this.lastClick < 400;
    this.lastClick = now;
    this.lastIndex = index;
    this.select(index);
    if (again) this.onAccept?.(index, this.items[index]);
    return true;
  }

  private page(): number {
    return Math.max(1, this.h - 2);
  }

  private maxScroll(): number {
    return Math.max(0, this.items.length - this.page());
  }

  private setScroll(value: number): void {
    this.scroll = clamp(value, 0, this.maxScroll());
  }

  private reveal(): void {
    const page = this.page();
    if (this.selected < 0) {
      this.scroll = 0;
      return;
    }
    if (this.selected < this.scroll) this.scroll = this.selected;
    if (this.selected >= this.scroll + page) this.scroll = this.selected - page + 1;
    this.scroll = clamp(this.scroll, 0, this.maxScroll());
  }
}

export interface ProgressBarOptions extends ViewOptions {
  value?: number;
  max?: number;
  /** Draw a percentage in the middle when the bar is at least four cells. Default true. */
  showPercent?: boolean;
}

/** A one-row gauge. `value` runs from 0 to `max`. */
export class ProgressBar extends View {
  value: number;
  max: number;
  showPercent: boolean;

  constructor(options: ProgressBarOptions = {}) {
    super({ ...options, w: options.w ?? 16, h: 1 });
    this.max = options.max ?? 100;
    this.value = options.value ?? 0;
    this.showPercent = options.showPercent ?? true;
  }

  paint(g: Painter): void {
    const theme = g.theme;
    const rect = this.abs();
    const max = this.max <= 0 ? 1 : this.max;
    const amount = clamp(this.value, 0, max);
    const filled = Math.round((amount / max) * this.w);
    for (let col = 0; col < this.w; col += 1) {
      const on = col < filled;
      g.put(rect.x + col, rect.y, on ? theme.progressOn : theme.progressOff, on ? theme.progressFill : theme.progress);
    }
    if (!this.showPercent || this.w < 4) return;
    const label = `${Math.round((amount / max) * 100)}%`;
    const parts = graphemes(label);
    const start = Math.floor((this.w - parts.length) / 2);
    for (let i = 0; i < parts.length; i += 1) {
      const col = start + i;
      const on = col < filled;
      g.put(rect.x + col, rect.y, parts[i], on ? theme.progressTextOn : theme.progressText);
    }
  }
}

