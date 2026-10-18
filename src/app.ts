import { MenuBar, StatusLine, runMenuShortcut } from './menu.js';
import type { MenuEntry, StatusHint } from './menu.js';
import { Painter } from './painter.js';
import type { CellPointer, CellSurface, KeyEvent, Rect } from './surface.js';
import { copyTheme, theme } from './theme.js';
import type { Theme, ThemeName } from './theme.js';
import { matchShortcut } from './text.js';
import { Desktop, Group, View } from './view.js';
import type { PointerCapture, UIHost } from './view.js';
import { Button, InputLine } from './widgets.js';
import { Dialog, Window } from './window.js';

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

interface ModalFrame {
  dialog: Dialog;
  resolve: (result: string | null) => void;
  focus: View | null;
  active: Window | null;
}

/**
 * The desk. It paints into a terminal from either engine and never imports those packages.
 * Pass a `Terminal`. Call `run` in the browser, or `draw` and `press` under test.
 */
export class Application implements UIHost {
  readonly surface: CellSurface;
  readonly desktop = new Desktop();
  readonly menu: MenuBar;
  readonly status: StatusLine;
  theme: Theme;
  sound: boolean;
  focused: View | null = null;
  /** Lit caret phase. `run` blinks it. A headless `draw` leaves it on. */
  caretOn = true;

  private readonly menuWanted: boolean;
  private readonly statusWanted: boolean;
  private readonly beepFn: ((freq: number, duration: number) => void) | null;
  private readonly onQuit: (() => void) | null;
  private readonly modals: ModalFrame[] = [];
  private active: Window | null = null;
  private grabbed: PointerCapture | null = null;
  private held: View | null = null;
  private holdingFocus = false;
  private audio: AudioContext | null = null;
  private painting = false;
  private again = false;
  private dirty = true;
  private quitting = false;
  private looping = false;
  private mounted = false;
  private frame = 0;
  private listening = false;

  constructor(surface: CellSurface, options: AppOptions = {}) {
    if (
      !surface ||
      typeof surface.set !== 'function' ||
      typeof surface.get !== 'function' ||
      typeof surface.beginFrame !== 'function' ||
      typeof surface.endFrame !== 'function' ||
      !Number.isFinite(surface.cols) ||
      !Number.isFinite(surface.rows)
    ) {
      throw new Error('Application surface must be a terminal (set, get, beginFrame, endFrame, cols, rows)');
    }
    this.surface = surface;
    this.theme =
      typeof options.theme === 'string'
        ? theme(options.theme)
        : options.theme
          ? copyTheme(options.theme)
          : theme('borland');
    this.sound = options.sound !== false;
    this.beepFn = options.beep ?? null;
    this.onQuit = options.onQuit ?? null;
    this.menuWanted = options.menu != null;
    this.statusWanted = options.status != null;
    this.menu = new MenuBar(options.menu ?? []);
    this.status = new StatusLine(options.status ?? []);
    this.desktop.setHost(this);
    this.menu.host = this;
    this.status.host = this;
    this.prepareSurface();
  }

  get cols(): number {
    return this.surface.cols;
  }

  get rows(): number {
    return this.surface.rows;
  }

  get menuLocked(): boolean {
    return this.modals.length > 0;
  }

  /** Desktop size in window coordinates. The menu and the status line sit outside it. */
  workArea(): Rect {
    this.layout();
    return { x: 0, y: 0, w: this.desktop.w, h: this.desktop.h };
  }

  activeView(): View | null {
    return this.topModal() ?? this.active;
  }

  setTheme(next: ThemeName | Theme): void {
    this.theme = typeof next === 'string' ? theme(next) : copyTheme(next);
    this.draw();
  }

  /** Paint now. Safe to call again from a handler; the second pass runs after the first. */
  draw(): void {
    if (this.painting) {
      this.again = true;
      return;
    }
    this.painting = true;
    try {
      this.layout();
      this.surface.cursorLit = false;
      this.surface.beginFrame();
      const g = new Painter(this.surface, this.theme);
      g.fill(0, 0, this.surface.cols, this.surface.rows, this.theme.desktopGlyph, this.theme.desktop);
      this.desktop.paint(g);
      if (this.status.visible) this.status.paint(g);
      if (this.menu.visible) this.menu.paint(g);
      this.surface.endFrame();
      this.dirty = false;
    } finally {
      this.painting = false;
    }
    if (this.again) {
      this.again = false;
      this.draw();
    }
  }

  /** `run` paints this on the next frame. Call `draw` when the loop is not running. */
  requestDraw(): void {
    this.dirty = true;
  }

  /**
   * Handle one key. A string is the key with no modifiers, the same text as `KeyboardEvent.key`.
   * Returns true when the desk used the key.
   */
  press(input: KeyEvent | string): boolean {
    if (this.quitting) return false;
    const event = normalizeKey(input);
    if (
      event.repeat &&
      (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape' || event.key === 'F10' || event.alt)
    ) {
      return false;
    }
    this.layout();
    const modal = this.topModal();

    if (this.runStatus(event, !!modal)) return true;

    if (!modal && this.menu.top >= 0) {
      this.menu.key(event);
      this.draw();
      return true;
    }

    if (!modal && event.alt && !event.ctrl && !event.meta && event.key.length === 1) {
      if (this.menu.openHot(event.key)) {
        this.draw();
        return true;
      }
    }

    if (!modal && event.key === 'F10' && !event.alt && !event.ctrl) {
      this.menu.focusBar();
      this.draw();
      return true;
    }

    if (!modal && event.key === 'F6' && !event.alt && !event.ctrl) {
      this.cycleWindow(event.shift ? -1 : 1);
      this.draw();
      return true;
    }

    if (!modal && this.runMenuCommand(event)) return true;

    if (event.key === 'Tab') {
      this.cycle(event.shift ? -1 : 1);
      this.draw();
      return true;
    }

    if (event.alt && !event.ctrl && !event.meta && event.key.length === 1) {
      if (this.dispatchHot(event.key)) {
        this.draw();
        return true;
      }
    }

    const scope = this.scope();
    if (this.focused && scope && nested(this.focused, scope) && this.focused.key(event)) {
      this.draw();
      return true;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      this.cycle(-1);
      this.draw();
      return true;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      this.cycle(1);
      this.draw();
      return true;
    }

    if (event.key === 'Enter' && scope) {
      const button = scope.focusables().find((view) => view.isDefault && view instanceof Button);
      const chosen = button instanceof Button ? button : this.focused instanceof Button ? this.focused : null;
      if (chosen) {
        chosen.activate();
        this.draw();
        return true;
      }
    }

    if (event.key === 'Escape' && modal) {
      modal.close(null);
      return true;
    }

    return false;
  }

  /** Handle one pointer event in cell coordinates. */
  pointer(event: CellPointer): boolean {
    if (this.quitting) return false;
    if (event.kind === 'move') {
      if (this.grabbed) {
        this.grabbed.move(event);
        this.draw();
        return true;
      }
      if (this.menu.open && !this.menuLocked) {
        if (this.menu.hover(event.col, event.row)) this.draw();
        return true;
      }
      return false;
    }
    if (event.kind === 'up') {
      if (!this.grabbed) return false;
      const capture = this.grabbed;
      this.grabbed = null;
      capture.up(event);
      this.draw();
      return true;
    }
    if (event.kind === 'wheel') {
      let view = this.pick(event.col, event.row);
      while (view) {
        if (view.mouse(event)) {
          this.draw();
          return true;
        }
        view = view.parent;
      }
      return false;
    }
    if (event.kind !== 'down') return false;
    const modal = !!this.topModal();
    if (!modal && this.menu.pointer(event)) {
      this.draw();
      return true;
    }
    if (this.status.pointer(event, modal)) {
      if (!modal) this.menu.close();
      this.draw();
      return true;
    }
    const target = this.pick(event.col, event.row);
    if (!target) return false;
    const win = owningWindow(target);
    if (modal && win !== this.topModal()) return true;
    if (win && !modal) this.activateWindow(win);
    if (!target.disabled && target.focusable) this.focus(target);
    else if (!target.disabled) {
      const near = this.nearestFocusable(target);
      if (near) this.focus(near);
      else if (target instanceof Window) {
        const next = target.preferredFocus();
        if (next) this.focus(next);
      }
    }
    target.mouse(event);
    this.draw();
    return true;
  }

  /**
   * Show `dialog` and return its result. Esc and the close box resolve null.
   * The promise resolves on the turn that closes the dialog.
   */
  modal(dialog: Dialog): Promise<string | null> {
    return new Promise((resolve) => {
      if (this.quitting || this.modals.some((frame) => frame.dialog === dialog)) {
        resolve(null);
        return;
      }
      this.menu.close();
      this.layout();
      if (dialog.center) {
        const area = this.workArea();
        dialog.w = Math.min(Math.max(1, dialog.w), Math.max(1, area.w));
        dialog.h = Math.min(Math.max(1, dialog.h), Math.max(1, area.h));
        dialog.x = Math.max(0, Math.floor((area.w - dialog.w) / 2));
        dialog.y = Math.max(0, Math.floor((area.h - dialog.h) / 2));
      }
      const frame: ModalFrame = { dialog, resolve, focus: this.focused, active: this.active };
      this.modals.push(frame);
      this.desktop.add(dialog);
      this.focus(dialog.preferredFocus());
      this.draw();
    });
  }

  /** Listen for keys and the pointer. A missing `window` does nothing. */
  mount(): void {
    if (this.mounted) return;
    this.mounted = true;
    const win = globalThis.window;
    if (!win || typeof win.addEventListener !== 'function') return;
    win.addEventListener('keydown', this.onKeyDown);
    win.addEventListener('pointermove', this.onPointerMove);
    win.addEventListener('pointerup', this.onPointerUp);
    const element = this.canvasElement();
    if (element && typeof element.addEventListener === 'function') {
      element.addEventListener('pointerdown', this.onPointerDown);
      element.addEventListener('wheel', this.onWheel, { passive: false });
    }
    this.listening = true;
  }

  /** Remove the listeners and stop the frame loop. The last picture stays. */
  destroy(): void {
    this.stop();
    if (!this.listening) return;
    const win = globalThis.window;
    if (win && typeof win.removeEventListener === 'function') {
      win.removeEventListener('keydown', this.onKeyDown);
      win.removeEventListener('pointermove', this.onPointerMove);
      win.removeEventListener('pointerup', this.onPointerUp);
    }
    const element = this.canvasElement();
    if (element && typeof element.removeEventListener === 'function') {
      element.removeEventListener('pointerdown', this.onPointerDown);
      element.removeEventListener('wheel', this.onWheel);
    }
    this.listening = false;
    this.mounted = false;
  }

  /** Mount, paint, and blink the field caret. */
  run(): void {
    this.mount();
    this.draw();
    if (this.looping) return;
    const raf = globalThis.requestAnimationFrame;
    if (typeof raf !== 'function') return;
    this.looping = true;
    const tick = (now: number): void => {
      if (!this.looping) return;
      const on = Math.floor(now / 500) % 2 === 0;
      if (on !== this.caretOn && this.focused instanceof InputLine) this.dirty = true;
      this.caretOn = on;
      if (this.dirty && !this.quitting) this.draw();
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  /** Stop the blink loop. Listeners stay until `destroy`. */
  stop(): void {
    this.looping = false;
    const cancel = globalThis.cancelAnimationFrame;
    if (this.frame && typeof cancel === 'function') cancel(this.frame);
    this.frame = 0;
  }

  /** Ignore later input, close dialogs, and call `onQuit`. */
  quit(): void {
    if (this.quitting) return;
    this.quitting = true;
    this.menu.close();
    while (this.modals.length > 0) this.finishModal(this.modals.length - 1, null);
    this.stop();
    this.onQuit?.();
  }

  beep(freq = 440, duration = 40): void {
    if (!this.sound) return;
    if (this.beepFn) {
      this.beepFn(freq, duration);
      return;
    }
    const AudioCtor = globalThis.AudioContext;
    if (typeof AudioCtor !== 'function') return;
    try {
      const audio = this.audio ?? new AudioCtor();
      this.audio = audio;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.value = 0.04;
      osc.connect(gain);
      gain.connect(audio.destination);
      const now = audio.currentTime;
      osc.start(now);
      osc.stop(now + Math.max(0.01, duration / 1000));
    } catch {
      // No audio on this host.
    }
  }

  focus(view: View | null): void {
    if (this.focused === view) return;
    if (this.focused) {
      this.focused.hasFocus = false;
      this.focused.blur();
    }
    this.focused = view;
    if (!view) return;
    view.hasFocus = true;
    view.focus();
    const win = owningWindow(view);
    if (win && win.parent === this.desktop && !this.topModal()) this.activateWindow(win);
  }

  endModal(origin: View, result: string | null): void {
    let dialog: Dialog | null = null;
    let current: View | null = origin;
    while (current) {
      if (current instanceof Dialog) dialog = current;
      current = current.parent;
    }
    if (!dialog) return;
    const index = this.modals.findIndex((frame) => frame.dialog === dialog);
    if (index < 0) {
      dialog.visible = false;
      return;
    }
    while (this.modals.length - 1 > index) this.finishModal(this.modals.length - 1, null);
    if (this.modals[index]) this.finishModal(index, result);
  }

  capture(capture: PointerCapture | null): void {
    this.grabbed = capture;
  }

  adopted(view: View): void {
    if (view instanceof Window && view.parent === this.desktop) this.active = view;
  }

  detached(view: View): void {
    if (this.focused && (this.focused === view || nested(this.focused, view))) {
      this.focused.hasFocus = false;
      this.focused.blur();
      this.focused = null;
    }
    if (this.active && (this.active === view || nested(this.active, view))) this.active = this.topWindow();
  }

  saveFocus(): void {
    if (this.holdingFocus) return;
    this.holdingFocus = true;
    this.held = this.focused;
    if (this.focused) {
      this.focused.hasFocus = false;
      this.focused.blur();
      this.focused = null;
    }
  }

  restoreFocus(): void {
    if (!this.holdingFocus) return;
    this.holdingFocus = false;
    const view = this.held;
    this.held = null;
    if (view && this.inTree(view) && view.visible && !view.disabled) this.focus(view);
  }

  private prepareSurface(): void {
    this.surface.cursorLit = false;
    if (typeof this.surface.colorStyle === 'function') this.surface.colorStyle('ansi');
    if (typeof this.surface.background === 'function') this.surface.background(4);
  }

  private layout(): void {
    const cols = Math.max(0, Math.floor(this.surface.cols));
    const rows = Math.max(0, Math.floor(this.surface.rows));
    let showMenu = this.menuWanted && rows >= 1;
    let showStatus = this.statusWanted && rows >= 1;
    if (showMenu && showStatus && rows < 2) showStatus = false;
    const menuH = showMenu ? 1 : 0;
    const statusH = showStatus ? 1 : 0;
    this.menu.visible = showMenu;
    this.menu.x = 0;
    this.menu.y = 0;
    this.menu.w = cols;
    this.menu.h = 1;
    this.menu.locked = this.modals.length > 0;
    this.status.visible = showStatus;
    this.status.x = 0;
    this.status.y = Math.max(0, rows - 1);
    this.status.w = cols;
    this.status.h = 1;
    this.desktop.x = 0;
    this.desktop.y = menuH;
    this.desktop.w = cols;
    this.desktop.h = Math.max(0, rows - menuH - statusH);
  }

  private runStatus(event: KeyEvent, modal: boolean): boolean {
    const hint = this.status.hints.find(
      (item) => item.action && !item.disabled && (!modal || item.global) && matchShortcut(item.key, event),
    );
    if (!hint || !hint.action) return false;
    if (!modal) this.menu.close();
    this.beep(660, 20);
    hint.action();
    this.draw();
    return true;
  }

  private runMenuCommand(event: KeyEvent): boolean {
    const matched = runMenuShortcut(this.menu.entries, event);
    if (!matched) return false;
    this.beep(660, 20);
    this.draw();
    return true;
  }

  private dispatchHot(letter: string): boolean {
    const scope = this.scope();
    if (!scope) return false;
    return walkHot(scope, letter);
  }

  private scope(): Group | null {
    return this.topModal() ?? this.active;
  }

  private cycle(dir: number): void {
    const scope = this.scope();
    if (!scope) return;
    const list = scope.focusables();
    if (list.length === 0) return;
    const index = this.focused ? list.indexOf(this.focused) : -1;
    const next = index < 0 ? (dir > 0 ? 0 : list.length - 1) : mod(index + dir, list.length);
    this.focus(list[next]);
  }

  private cycleWindow(dir: number): void {
    const windows = this.desktop.children.filter((child): child is Window => child instanceof Window && child.visible);
    if (windows.length === 0) return;
    const index = this.active ? windows.indexOf(this.active) : -1;
    const next = windows[mod((index < 0 ? 0 : index) + dir, windows.length)];
    this.activateWindow(next);
    this.focus(next.preferredFocus());
  }

  private activateWindow(win: Window): void {
    this.desktop.raise(win);
    this.active = win;
  }

  private topModal(): Dialog | null {
    for (let i = this.modals.length - 1; i >= 0; i -= 1) {
      const dialog = this.modals[i].dialog;
      if (dialog.visible) return dialog;
    }
    return null;
  }

  private topWindow(): Window | null {
    const kids = this.desktop.children;
    for (let i = kids.length - 1; i >= 0; i -= 1) {
      const child = kids[i];
      if (child instanceof Window && child.visible) return child;
    }
    return null;
  }

  private finishModal(index: number, result: string | null): void {
    const frame = this.modals[index];
    if (!frame) return;
    this.modals.splice(index, 1);
    if (frame.dialog.parent === this.desktop) this.desktop.remove(frame.dialog);
    const active =
      frame.active && frame.active.visible && frame.active.parent === this.desktop ? frame.active : this.topWindow();
    this.active = active;
    const saved = frame.focus;
    if (saved && this.inTree(saved) && saved.visible && !saved.disabled) this.focus(saved);
    else if (saved) this.focus(active ? active.preferredFocus() : null);
    else this.focus(null);
    this.draw();
    frame.resolve(result);
  }

  private pick(col: number, row: number): View | null {
    const modal = this.topModal();
    if (modal) {
      if (!modal.visible || !modal.contains(col, row)) return null;
      return hitWindow(modal, col, row);
    }
    const kids = this.desktop.children;
    for (let i = kids.length - 1; i >= 0; i -= 1) {
      const child = kids[i];
      const found = child instanceof Window ? hitWindow(child, col, row) : hitDeep(child, col, row);
      if (found) return found;
    }
    return null;
  }

  private nearestFocusable(view: View): View | null {
    let current: View | null = view.parent;
    while (current) {
      if (current.focusable && !current.disabled && current.visible) return current;
      current = current.parent;
    }
    return null;
  }

  private inTree(view: View): boolean {
    let current: View | null = view;
    while (current.parent) current = current.parent;
    return current === this.desktop;
  }

  private canvasElement(): (EventTarget & { getBoundingClientRect?: () => DOMRect }) | null {
    const surface = this.surface;
    const element = surface.canvas?.element ?? surface.element ?? null;
    return element;
  }

  private cellAt(event: { clientX: number; clientY: number }): { col: number; row: number } | null {
    const element = this.canvasElement();
    if (!element || typeof element.getBoundingClientRect !== 'function') return null;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const col = Math.floor(((event.clientX - rect.left) / rect.width) * this.surface.cols);
    const row = Math.floor(((event.clientY - rect.top) / rect.height) * this.surface.rows);
    return { col, row };
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
    if (claimsKey(event)) event.preventDefault();
    this.press({
      key: event.key,
      alt: event.altKey,
      ctrl: event.ctrlKey,
      shift: event.shiftKey,
      meta: event.metaKey,
      repeat: event.repeat,
    });
  };

  private onPointerDown = (event: Event): void => {
    const pointer = event as PointerEvent;
    if (pointer.button !== 0) return;
    const cell = this.cellAt(pointer);
    if (!cell) return;
    pointer.preventDefault();
    this.pointer({ col: cell.col, row: cell.row, kind: 'down', button: 0, delta: 0 });
  };

  private onPointerMove = (event: Event): void => {
    if (!this.grabbed && !(this.menu.open && !this.menuLocked)) return;
    const pointer = event as PointerEvent;
    const cell = this.cellAt(pointer);
    if (!cell) return;
    this.pointer({ col: cell.col, row: cell.row, kind: 'move', button: pointer.button, delta: 0 });
  };

  private onPointerUp = (event: Event): void => {
    if (!this.grabbed) return;
    const pointer = event as PointerEvent;
    const cell = this.cellAt(pointer) ?? { col: -1, row: -1 };
    this.pointer({ col: cell.col, row: cell.row, kind: 'up', button: pointer.button, delta: 0 });
  };

  private onWheel = (event: Event): void => {
    const wheel = event as WheelEvent;
    const cell = this.cellAt(wheel);
    if (!cell) return;
    wheel.preventDefault();
    this.pointer({ col: cell.col, row: cell.row, kind: 'wheel', button: 0, delta: wheel.deltaY });
  };
}

function normalizeKey(input: KeyEvent | string): KeyEvent {
  if (typeof input === 'string') {
    return { key: input, alt: false, ctrl: false, shift: false, meta: false, repeat: false };
  }
  return {
    key: input.key,
    alt: !!input.alt,
    ctrl: !!input.ctrl,
    shift: !!input.shift,
    meta: !!input.meta,
    repeat: !!input.repeat,
  };
}

function claimsKey(event: KeyboardEvent): boolean {
  if (event.altKey || event.key === 'Tab' || event.key === 'Escape' || event.key === ' ') return true;
  if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') return true;
  if (event.key === 'PageUp' || event.key === 'PageDown') return true;
  if (event.key === 'F1' || event.key === 'F6' || event.key === 'F10') return true;
  return false;
}

function mod(value: number, length: number): number {
  if (length <= 0) return 0;
  return ((value % length) + length) % length;
}

function nested(view: View, root: View): boolean {
  let current: View | null = view;
  while (current) {
    if (current === root) return true;
    current = current.parent;
  }
  return false;
}

function owningWindow(view: View): Window | null {
  let current: View | null = view;
  while (current) {
    if (current instanceof Window) return current;
    current = current.parent;
  }
  return null;
}

function walkHot(view: View, letter: string): boolean {
  if (!view.visible || view.disabled) return false;
  if (view.hot(letter)) return true;
  if (view instanceof Group) {
    for (const child of view.children) {
      if (walkHot(child, letter)) return true;
    }
  }
  return false;
}

function hitWindow(win: Window, col: number, row: number): View | null {
  if (!win.visible || win.disabled || !win.contains(col, row)) return null;
  const rect = win.abs();
  const onFrame = col === rect.x || row === rect.y || col === rect.x + rect.w - 1 || row === rect.y + rect.h - 1;
  if (onFrame) return win;
  for (let i = win.children.length - 1; i >= 0; i -= 1) {
    const found = hitDeep(win.children[i], col, row);
    if (found) return found;
  }
  return win;
}

function hitDeep(view: View, col: number, row: number): View | null {
  if (!view.visible || !view.contains(col, row)) return null;
  if (view instanceof Window) return hitWindow(view, col, row);
  if (view instanceof Group) {
    for (let i = view.children.length - 1; i >= 0; i -= 1) {
      const found = hitDeep(view.children[i], col, row);
      if (found) return found;
    }
  }
  return view;
}
