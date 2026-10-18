"use strict";
var EmojiEngineUI = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod3) => __copyProps(__defProp({}, "__esModule", { value: true }), mod3);

  // dist/index.js
  var index_exports = {};
  __export(index_exports, {
    Application: () => Application,
    Button: () => Button,
    CheckBox: () => CheckBox,
    Desktop: () => Desktop,
    Dialog: () => Dialog,
    Group: () => Group,
    InputLine: () => InputLine,
    Label: () => Label,
    ListBox: () => ListBox,
    MenuBar: () => MenuBar,
    ProgressBar: () => ProgressBar,
    RadioGroup: () => RadioGroup,
    ScrollBar: () => ScrollBar,
    StaticText: () => StaticText,
    StatusLine: () => StatusLine,
    View: () => View,
    Window: () => Window,
    borland: () => borland,
    confirm: () => confirm,
    copyTheme: () => copyTheme,
    linux: () => linux,
    messageBox: () => messageBox,
    theme: () => theme
  });

  // dist/text.js
  var segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(void 0, { granularity: "grapheme" }) : null;
  function graphemes(text) {
    if (!text)
      return [];
    if (segmenter) {
      const out = [];
      for (const part of segmenter.segment(text))
        out.push(part.segment);
      return out;
    }
    return Array.from(text);
  }
  function graphemeLength(text) {
    return graphemes(text).length;
  }
  function clamp(value, min, max) {
    if (max < min)
      return min;
    return Math.min(max, Math.max(min, value));
  }
  function parseLabel(input) {
    const source = graphemes(input);
    const text = [];
    let hot = -1;
    for (let i = 0; i < source.length; i += 1) {
      if (source[i] !== "&") {
        text.push(source[i]);
        continue;
      }
      const next = source[i + 1];
      if (next == null)
        break;
      i += 1;
      if (next === "&") {
        text.push("&");
        continue;
      }
      if (hot < 0)
        hot = text.length;
      text.push(next);
    }
    const joined = text.join("");
    const hotChar = hot >= 0 ? (text[hot] ?? "").toLowerCase() : null;
    return { text: joined, hot, hotChar: hotChar || null };
  }
  function clipText(text, max) {
    const parts = graphemes(text);
    if (parts.length <= max)
      return parts.join("");
    if (max <= 0)
      return "";
    if (max === 1)
      return "…";
    return parts.slice(0, max - 1).join("") + "…";
  }
  function wrapText(text, width) {
    const limit = Math.max(1, width);
    const lines = [];
    for (const raw of text.split("\n")) {
      if (raw.length === 0) {
        lines.push("");
        continue;
      }
      let line = [];
      let count = 0;
      const words = raw.split(" ");
      for (let w = 0; w < words.length; w += 1) {
        const word = graphemes(words[w]);
        if (word.length > limit) {
          if (count > 0) {
            lines.push(line.join(""));
            line = [];
            count = 0;
          }
          for (let i = 0; i < word.length; i += limit)
            lines.push(word.slice(i, i + limit).join(""));
          continue;
        }
        const extra = count === 0 ? word.length : word.length + 1;
        if (count > 0 && count + extra > limit) {
          lines.push(line.join(""));
          line = word.slice();
          count = word.length;
        } else {
          if (count > 0) {
            line.push(" ");
            count += 1;
          }
          line.push(...word);
          count += word.length;
        }
      }
      lines.push(line.join(""));
    }
    return lines;
  }
  function matchShortcut(shortcut, event) {
    const parts = shortcut.trim().toLowerCase().replace(/-/g, "+").split("+").map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0 || event.meta)
      return false;
    let alt = false;
    let ctrl = false;
    let shift = false;
    let key = "";
    for (const part of parts) {
      if (part === "alt")
        alt = true;
      else if (part === "ctrl" || part === "control")
        ctrl = true;
      else if (part === "shift")
        shift = true;
      else if (part === "meta" || part === "cmd" || part === "command")
        return false;
      else
        key = part;
    }
    if (!key)
      return false;
    if (!!event.alt !== alt || !!event.ctrl !== ctrl || !!event.shift !== shift)
      return false;
    const got = event.key.toLowerCase();
    if (got === key)
      return true;
    if (key === "esc" && got === "escape")
      return true;
    if (key === "escape" && got === "esc")
      return true;
    if ((key === "return" || key === "enter") && got === "enter")
      return true;
    if (key === "space" && got === " ")
      return true;
    if (key === "del" && got === "delete")
      return true;
    if (key === "pgup" && got === "pageup")
      return true;
    if (key === "pgdn" && got === "pagedown")
      return true;
    return false;
  }
  function sameLetter(letter, hot) {
    return !!hot && letter.toLowerCase() === hot.toLowerCase();
  }

  // dist/painter.js
  var SINGLE = {
    h: "─",
    v: "│",
    tl: "┌",
    tr: "┐",
    bl: "└",
    br: "┘"
  };
  var DOUBLE = {
    h: "═",
    v: "║",
    tl: "╔",
    tr: "╗",
    bl: "╚",
    br: "╝"
  };
  var Painter = class {
    surface;
    theme;
    clip = null;
    constructor(surface, theme2) {
      this.surface = surface;
      this.theme = theme2;
    }
    put(x, y, ch, ink2) {
      const col = Math.floor(x);
      const row = Math.floor(y);
      if (col < 0 || row < 0 || col >= this.surface.cols || row >= this.surface.rows)
        return;
      const box = this.clip;
      if (box && (col < box.x || row < box.y || col >= box.x + box.w || row >= box.y + box.h))
        return;
      const glyph = graphemes(ch)[0] ?? " ";
      this.surface.set(col, row, { ch: glyph, fg: ink2.fg, bg: ink2.bg, bright: false });
    }
    fill(x, y, w, h, ch, ink2) {
      if (w <= 0 || h <= 0)
        return;
      for (let row = 0; row < h; row += 1) {
        for (let col = 0; col < w; col += 1)
          this.put(x + col, y + row, ch, ink2);
      }
    }
    /** Write graphemes from the left. Stops at `max` cells. */
    text(x, y, value, ink2, max = 1e3) {
      const parts = graphemes(value);
      const count = Math.min(parts.length, Math.max(0, max));
      for (let i = 0; i < count; i += 1)
        this.put(x + i, y, parts[i], ink2);
    }
    /** Like `text`, but the `&` hotkey uses `hot`. */
    label(x, y, parsed, ink2, hot, max = 1e3) {
      const parts = graphemes(parsed.text);
      const count = Math.min(parts.length, Math.max(0, max));
      for (let i = 0; i < count; i += 1) {
        this.put(x + i, y, parts[i], i === parsed.hot ? hot : ink2);
      }
    }
    withClip(rect, body) {
      const prev = this.clip;
      this.clip = prev ? intersection(prev, rect) : rect;
      body();
      this.clip = prev;
    }
  };
  function intersection(a, b) {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.w, b.x + b.w);
    const bottom = Math.min(a.y + a.h, b.y + b.h);
    return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
  }
  function drawShadow(g, rect, glyph, ink2) {
    const { x, y, w, h } = rect;
    if (w <= 0 || h <= 0)
      return;
    for (let row = y + 1; row <= y + h; row += 1)
      g.put(x + w, row, glyph, ink2);
    for (let col = x + 1; col < x + w; col += 1)
      g.put(col, y + h, glyph, ink2);
  }
  function drawFrame(g, rect, options) {
    const { x, y, w, h } = rect;
    if (w < 2 || h < 2)
      return;
    const { glyphs, ink: ink2 } = options;
    for (let col = 0; col < w; col += 1) {
      g.put(x + col, y, glyphs.h, ink2);
      g.put(x + col, y + h - 1, glyphs.h, ink2);
    }
    for (let row = 0; row < h; row += 1) {
      g.put(x, y + row, glyphs.v, ink2);
      g.put(x + w - 1, y + row, glyphs.v, ink2);
    }
    g.put(x, y, glyphs.tl, ink2);
    g.put(x + w - 1, y, glyphs.tr, ink2);
    g.put(x, y + h - 1, glyphs.bl, ink2);
    g.put(x + w - 1, y + h - 1, glyphs.br, ink2);
    if (options.body && w > 2 && h > 2) {
      g.fill(x + 1, y + 1, w - 2, h - 2, " ", options.body);
    }
    if (options.close)
      g.put(x + 1, y, options.close, ink2);
    if (options.zoom && w > 3)
      g.put(x + w - 2, y, options.zoom, ink2);
    const title = options.title ? clipText(options.title, Math.max(0, w - 6)) : "";
    if (!title)
      return;
    const parts = graphemes(title);
    const min = x + (options.close ? 3 : 2);
    const maxStart = x + w - (options.zoom ? 3 : 2) - parts.length;
    let start = x + Math.floor((w - parts.length) / 2);
    if (start < min)
      start = min;
    if (start > maxStart)
      start = Math.max(min, maxStart);
    for (let i = 0; i < parts.length; i += 1) {
      const col = start + i;
      if (col <= x || col >= x + w - 1)
        continue;
      if (options.close && col === x + 1)
        continue;
      if (options.zoom && col === x + w - 2)
        continue;
      g.put(col, y, parts[i], options.titleInk);
    }
  }

  // dist/view.js
  var View = class {
    x;
    y;
    w;
    h;
    disabled;
    visible;
    /** Tab stops here when the view is visible and enabled. */
    focusable = false;
    /** Enter from a label, or a dialog default, prefers this view. */
    isDefault = false;
    hasFocus = false;
    parent = null;
    host = null;
    /** Empty bag for the caller, the same idea as a sprite's `data`. */
    data = {};
    constructor(options = {}) {
      this.x = options.x ?? 0;
      this.y = options.y ?? 0;
      this.w = options.w ?? 1;
      this.h = options.h ?? 1;
      this.disabled = options.disabled ?? false;
      this.visible = options.visible ?? true;
    }
    /** Screen cell of the top-left corner. */
    abs() {
      let x = this.x;
      let y = this.y;
      let parent = this.parent;
      while (parent) {
        x += parent.x;
        y += parent.y;
        parent = parent.parent;
      }
      return { x, y, w: this.w, h: this.h };
    }
    contains(col, row) {
      const rect = this.abs();
      return col >= rect.x && row >= rect.y && col < rect.x + rect.w && row < rect.y + rect.h;
    }
    paint(_g) {
    }
    /** Return true when the key is consumed. */
    key(_event) {
      return false;
    }
    /** Return true when the pointer is consumed. */
    mouse(_event) {
      return false;
    }
    /** Alt+letter. Return true when this view acts on `letter`. */
    hot(_letter) {
      return false;
    }
    /** A label's hotkey landed here. Buttons press. Boxes toggle. Fields do nothing. */
    invoke() {
    }
    /** The desk moved the keyboard cursor here. */
    focus() {
    }
    /** The keyboard cursor left. */
    blur() {
    }
  };
  var Group = class _Group extends View {
    children = [];
    add(view) {
      if (view.parent === this) {
        this.raise(view);
        return this;
      }
      if (view.parent)
        view.parent.remove(view);
      view.parent = this;
      this.children.push(view);
      if (view instanceof _Group)
        view.setHost(this.host);
      else
        view.host = this.host;
      this.host?.adopted(view);
      return this;
    }
    remove(view) {
      const index = this.children.indexOf(view);
      if (index < 0)
        return;
      this.children.splice(index, 1);
      view.parent = null;
      const host = this.host;
      if (view instanceof _Group)
        view.setHost(null);
      else
        view.host = null;
      host?.detached(view);
    }
    raise(view) {
      const index = this.children.indexOf(view);
      if (index < 0 || index === this.children.length - 1)
        return;
      this.children.splice(index, 1);
      this.children.push(view);
    }
    setHost(host) {
      this.host = host;
      for (const child of this.children) {
        if (child instanceof _Group)
          child.setHost(host);
        else
          child.host = host;
      }
    }
    /** Focusable descendants in paint order. A disabled or hidden branch is skipped. */
    focusables() {
      const out = [];
      const walk = (view) => {
        if (!view.visible || view.disabled)
          return;
        if (view.focusable)
          out.push(view);
        if (view instanceof _Group) {
          for (const child of view.children)
            walk(child);
        }
      };
      for (const child of this.children)
        walk(child);
      return out;
    }
    /** The first focusable descendant. Enter still presses the default button. */
    preferredFocus() {
      return this.focusables()[0] ?? null;
    }
    paint(g) {
      for (const child of this.children) {
        if (child.visible)
          child.paint(g);
      }
    }
  };
  var Desktop = class extends Group {
    paint(g) {
      const rect = this.abs();
      g.fill(rect.x, rect.y, rect.w, rect.h, g.theme.desktopGlyph, g.theme.desktop);
      const room = { x: rect.x, y: rect.y, w: rect.w + 1, h: rect.h + 1 };
      g.withClip(room, () => {
        for (const child of this.children) {
          if (child.visible)
            child.paint(g);
        }
      });
    }
  };

  // dist/menu.js
  var MenuBar = class extends View {
    entries;
    /** Highlighted title, or -1 when the bar is idle. */
    top = -1;
    open = false;
    /** Row inside the open menu, or -1. */
    item = -1;
    /** Row inside the submenu, or -1 when the submenu is closed. */
    sub = -1;
    locked = false;
    holding = false;
    titles = [];
    popup = null;
    subpopup = null;
    constructor(entries = []) {
      super({ x: 0, y: 0, w: 1, h: 1 });
      this.entries = entries;
    }
    paint(g) {
      if (!this.visible || this.h < 1)
        return;
      this.layout();
      const theme2 = g.theme;
      const bar = this.locked ? theme2.menuLocked : theme2.menuBar;
      const hot = this.locked ? theme2.menuLockedHot : theme2.menuHot;
      g.fill(this.x, this.y, this.w, 1, " ", bar);
      for (const title of this.titles) {
        const active = !this.locked && title.index === this.top;
        const ink2 = active ? theme2.menuActive : bar;
        const hotInk = active ? theme2.menuActiveHot : hot;
        g.fill(title.x, this.y, title.w, 1, " ", ink2);
        g.label(title.x + 1, this.y, title.parsed, ink2, hotInk, Math.max(0, title.w - 2));
      }
      if (this.locked || !this.open)
        return;
      if (this.popup)
        this.paintPopup(g, this.popup, this.item);
      if (this.subpopup && this.sub >= 0)
        this.paintPopup(g, this.subpopup, this.sub);
    }
    /** F10. Highlights the first title and does not open it yet. */
    focusBar() {
      if (this.locked || this.entries.length === 0)
        return;
      this.holdFocus();
      if (this.top < 0)
        this.top = 0;
      this.open = false;
      this.item = -1;
      this.sub = -1;
    }
    /** Alt+letter on a title. Returns true when a menu opens. */
    openHot(letter) {
      if (this.locked)
        return false;
      const index = this.entries.findIndex((entry) => sameLetter(letter, parseLabel(entry.label ?? "").hotChar));
      if (index < 0)
        return false;
      this.openAt(index, true);
      return true;
    }
    close() {
      const was = this.holding;
      this.top = -1;
      this.open = false;
      this.item = -1;
      this.sub = -1;
      this.popup = null;
      this.subpopup = null;
      if (was)
        this.releaseFocus();
    }
    key(event) {
      if (this.locked || this.top < 0)
        return false;
      if (event.key === "Escape" || event.key === "F10") {
        this.close();
        return true;
      }
      if (!this.open) {
        if (event.key === "ArrowLeft") {
          this.top = (this.top - 1 + this.entries.length) % this.entries.length;
          return true;
        }
        if (event.key === "ArrowRight") {
          this.top = (this.top + 1) % this.entries.length;
          return true;
        }
        if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
          this.openAt(this.top, true);
          return true;
        }
        if (event.alt && event.key.length === 1 && this.openHot(event.key))
          return true;
        return true;
      }
      const items = this.currentItems();
      if (event.key === "ArrowLeft") {
        if (this.sub >= 0)
          this.sub = -1;
        else
          this.switchTop(-1);
        return true;
      }
      if (event.key === "ArrowRight") {
        if (this.item >= 0 && items[this.item]?.items?.length && this.sub < 0)
          this.openSub();
        else
          this.switchTop(1);
        return true;
      }
      if (event.key === "ArrowDown") {
        this.moveItem(1);
        return true;
      }
      if (event.key === "ArrowUp") {
        this.moveItem(-1);
        return true;
      }
      if (event.key === "Home") {
        this.setEdge(1);
        return true;
      }
      if (event.key === "End") {
        this.setEdge(-1);
        return true;
      }
      if (event.key === "Enter" || event.key === " ") {
        this.activateCurrent();
        return true;
      }
      if (event.alt && event.key.length === 1 && this.openHot(event.key))
        return true;
      if (event.key.length === 1 && !event.alt && !event.ctrl && !event.meta) {
        this.activateLetter(event.key);
        return true;
      }
      return true;
    }
    /** A click. True when the bar or an open menu consumed it. */
    pointer(event) {
      if (!this.visible || this.locked || event.kind !== "down" || event.button !== 0)
        return false;
      this.layout();
      const title = this.titles.find((slot) => event.col >= slot.x && event.col < slot.x + slot.w && event.row === this.y);
      if (title) {
        if (this.open && this.top === title.index)
          this.close();
        else
          this.openAt(title.index, true);
        return true;
      }
      if (this.open && this.hitPopup(event.col, event.row))
        return true;
      if (this.open || this.top >= 0) {
        this.close();
        return true;
      }
      return false;
    }
    /** Move the highlight while a menu is open. True when it changed. */
    hover(col, row) {
      if (!this.open || this.locked)
        return false;
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
    openAt(index, runBare = false) {
      if (index < 0 || index >= this.entries.length)
        return;
      const entry = this.entries[index];
      const items = entry.items ?? [];
      if (items.length === 0) {
        if (runBare && entry.action && !entry.disabled)
          this.run(entry);
        return;
      }
      this.holdFocus();
      this.top = index;
      this.open = true;
      this.item = firstEnabled(items);
      this.sub = -1;
      this.layout();
    }
    openSub() {
      const items = this.currentItems();
      const entry = items[this.item];
      if (!entry?.items?.length)
        return;
      this.sub = firstEnabled(entry.items);
    }
    switchTop(dir) {
      if (this.entries.length === 0)
        return;
      this.top = (this.top + dir + this.entries.length) % this.entries.length;
      const items = this.entries[this.top].items ?? [];
      this.open = items.length > 0;
      this.item = firstEnabled(items);
      this.sub = -1;
    }
    currentItems() {
      if (this.top < 0)
        return [];
      return this.entries[this.top].items ?? [];
    }
    moveItem(dir) {
      if (this.sub >= 0) {
        const items = this.currentItems()[this.item]?.items ?? [];
        const next2 = step(items, this.sub, dir);
        if (next2 >= 0)
          this.sub = next2;
        return;
      }
      const next = step(this.currentItems(), this.item, dir);
      if (next >= 0) {
        this.item = next;
        this.sub = -1;
      }
    }
    setEdge(dir) {
      const items = this.sub >= 0 ? this.currentItems()[this.item]?.items ?? [] : this.currentItems();
      const next = firstFrom(items, dir);
      if (next < 0)
        return;
      if (this.sub >= 0)
        this.sub = next;
      else
        this.item = next;
    }
    activateCurrent() {
      if (this.sub >= 0) {
        const entry2 = this.currentItems()[this.item]?.items?.[this.sub];
        if (entry2)
          this.run(entry2);
        return;
      }
      const entry = this.currentItems()[this.item];
      if (!entry || entry.separator || entry.disabled)
        return;
      if (entry.items?.length) {
        this.openSub();
        return;
      }
      this.run(entry);
    }
    activateLetter(letter) {
      const pool = this.sub >= 0 ? this.currentItems()[this.item]?.items ?? [] : this.currentItems();
      const index = pool.findIndex((entry) => !entry.separator && !entry.disabled && sameLetter(letter, parseLabel(entry.label ?? "").hotChar));
      if (index < 0)
        return;
      if (this.sub >= 0)
        this.sub = index;
      else
        this.item = index;
      this.activateCurrent();
    }
    run(entry) {
      if (entry.disabled || entry.separator)
        return;
      if (entry.items?.length && !entry.action) {
        this.openSub();
        return;
      }
      this.close();
      this.host?.beep(660, 20);
      entry.action?.();
    }
    hitPopup(col, row) {
      if (this.subpopup && this.sub >= 0 && inside(col, row, this.subpopup)) {
        const hit = this.rowAt(this.subpopup, row);
        if (hit < 0)
          return true;
        this.sub = hit;
        const entry = this.subpopup.items[hit].entry;
        if (!entry.separator && !entry.disabled)
          this.run(entry);
        return true;
      }
      if (this.popup && inside(col, row, this.popup)) {
        const hit = this.rowAt(this.popup, row);
        if (hit < 0)
          return true;
        const entry = this.popup.items[hit].entry;
        if (entry.separator || entry.disabled)
          return true;
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
    rowAt(popup, row) {
      const index = row - (popup.y + 1);
      if (index < 0 || index >= popup.items.length)
        return -1;
      return index;
    }
    holdFocus() {
      if (this.holding)
        return;
      this.holding = true;
      this.host?.saveFocus();
    }
    releaseFocus() {
      if (!this.holding)
        return;
      this.holding = false;
      this.host?.restoreFocus();
    }
    layout() {
      const y = this.y;
      let x = this.x;
      this.titles = [];
      for (let index = 0; index < this.entries.length; index += 1) {
        const parsed = parseLabel(this.entries[index].label ?? "");
        const width = graphemeLength(parsed.text) + 2;
        if (x + width > this.x + this.w)
          break;
        this.titles.push({ index, x, w: width, parsed });
        x += width;
      }
      this.popup = null;
      this.subpopup = null;
      if (!this.open || this.top < 0)
        return;
      const title = this.titles.find((slot) => slot.index === this.top);
      const items = this.entries[this.top].items ?? [];
      if (!title)
        return;
      this.popup = placePopup(items, title.x, y + 1, this.host?.cols ?? this.w, this.host?.rows ?? 24);
      if (this.item < 0 || !this.popup)
        return;
      const entry = items[this.item];
      if (!entry?.items?.length || this.sub < 0)
        return;
      const row = this.popup.y + 1 + this.item;
      let subX = this.popup.x + this.popup.w;
      const measured = measure(entry.items);
      if (subX + measured.w > (this.host?.cols ?? subX + measured.w))
        subX = this.popup.x - measured.w;
      this.subpopup = placePopup(entry.items, subX, row - 1, this.host?.cols ?? this.w, this.host?.rows ?? 24);
    }
    paintPopup(g, popup, selected) {
      const theme2 = g.theme;
      const rect = { x: popup.x, y: popup.y, w: popup.w, h: popup.h };
      drawFrame(g, rect, { glyphs: SINGLE, ink: theme2.menu, titleInk: theme2.menu, body: theme2.menu });
      drawShadow(g, rect, theme2.shadowGlyph, theme2.windowShadow);
      popup.items.forEach((slot, index) => {
        const row = popup.y + 1 + index;
        const on = index === selected;
        if (slot.entry.separator) {
          g.put(popup.x, row, "├", theme2.menuDisabled);
          g.put(popup.x + popup.w - 1, row, "┤", theme2.menuDisabled);
          for (let col = 1; col < popup.w - 1; col += 1) {
            g.put(popup.x + col, row, SINGLE.h, theme2.menuDisabled);
          }
          return;
        }
        const ink2 = slot.entry.disabled ? theme2.menuDisabled : on ? theme2.menuSelect : theme2.menu;
        const hot = slot.entry.disabled ? theme2.menuDisabled : on ? theme2.menuSelectHot : theme2.menuHot;
        const shortcutInk = slot.entry.disabled ? theme2.menuDisabled : on ? theme2.menuShortcutSelect : theme2.menuShortcut;
        const parts = graphemes(slot.shortcut);
        const labelRoom = Math.max(0, popup.w - 4 - (parts.length > 0 ? parts.length + 1 : 0));
        g.fill(popup.x + 1, row, popup.w - 2, 1, " ", ink2);
        g.label(popup.x + 2, row, slot.parsed, ink2, hot, labelRoom);
        if (parts.length > 0) {
          const shortcutInkHere = slot.entry.items?.length ? ink2 : shortcutInk;
          g.text(popup.x + popup.w - 2 - parts.length, row, slot.shortcut, shortcutInkHere, parts.length);
        }
      });
    }
  };
  var StatusLine = class extends View {
    hints;
    spans = [];
    constructor(hints = []) {
      super({ x: 0, y: 0, w: 1, h: 1 });
      this.hints = hints;
    }
    paint(g) {
      if (!this.visible || this.h < 1)
        return;
      const theme2 = g.theme;
      const locked = !!this.host?.menuLocked;
      g.fill(this.x, this.y, this.w, 1, " ", theme2.status);
      this.spans = [];
      let x = this.x + 1;
      for (const hint of this.hints) {
        const dim = hint.disabled || locked && !hint.global;
        const ink2 = dim ? theme2.statusDisabled : theme2.status;
        const hot = dim ? theme2.statusDisabled : theme2.statusHot;
        const key = graphemes(hint.key);
        const label = graphemes(hint.label);
        const width = key.length + label.length + 3;
        if (x + width >= this.x + this.w)
          break;
        const start = x;
        g.put(x, this.y, " ", ink2);
        x += 1;
        for (const ch of key) {
          g.put(x, this.y, ch, hot);
          x += 1;
        }
        g.put(x, this.y, " ", ink2);
        x += 1;
        for (const ch of label) {
          g.put(x, this.y, ch, ink2);
          x += 1;
        }
        g.put(x, this.y, " ", ink2);
        x += 1;
        this.spans.push({ hint, x: start, w: x - start });
      }
    }
    /**
     * Run the hint that matches `event`.
     * While a dialog is open, only `global` hints run.
     */
    activate(event, modal) {
      for (const hint of this.hints) {
        if (hint.disabled || !hint.action)
          continue;
        if (modal && !hint.global)
          continue;
        if (!matchShortcut(hint.key, event))
          continue;
        this.host?.beep(660, 20);
        hint.action();
        return true;
      }
      return false;
    }
    pointer(event, modal) {
      if (!this.visible || event.kind !== "down" || event.button !== 0 || event.row !== this.y)
        return false;
      const span = this.spans.find((item) => event.col >= item.x && event.col < item.x + item.w);
      if (!span || span.hint.disabled || !span.hint.action)
        return false;
      if (modal && !span.hint.global)
        return false;
      this.host?.beep(660, 20);
      span.hint.action();
      return true;
    }
  };
  function runMenuShortcut(entries, event) {
    for (const entry of entries) {
      if (entry.separator)
        continue;
      if (entry.items && runMenuShortcut(entry.items, event))
        return true;
      if (entry.disabled || !entry.action || !entry.shortcut)
        continue;
      if (!matchShortcut(entry.shortcut, event))
        continue;
      entry.action();
      return true;
    }
    return false;
  }
  function firstEnabled(items) {
    return items.findIndex((entry) => !entry.separator && !entry.disabled);
  }
  function firstFrom(items, dir) {
    if (dir > 0)
      return firstEnabled(items);
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (!items[i].separator && !items[i].disabled)
        return i;
    }
    return -1;
  }
  function step(items, from, dir) {
    if (items.length === 0)
      return -1;
    let index = from < 0 ? dir > 0 ? -1 : 0 : from;
    for (let n = 0; n < items.length; n += 1) {
      index = mod(index + dir, items.length);
      if (!items[index].separator && !items[index].disabled)
        return index;
    }
    return -1;
  }
  function mod(value, length) {
    return (value % length + length) % length;
  }
  function measure(items) {
    let inner = 8;
    const slots = items.map((entry, index) => {
      const parsed = parseLabel(entry.label ?? "");
      const shortcut = entry.items?.length ? "►" : entry.shortcut ?? "";
      const width = graphemeLength(parsed.text) + graphemeLength(shortcut) + (shortcut ? 4 : 2);
      if (width > inner)
        inner = width;
      return { index, entry, parsed, shortcut };
    });
    return { w: inner + 2, h: Math.max(2, items.length + 2), slots };
  }
  function placePopup(items, x, y, cols, rows) {
    const measured = measure(items);
    let left = x;
    let top = y;
    if (left + measured.w > cols)
      left = Math.max(0, cols - measured.w);
    if (left < 0)
      left = 0;
    if (top + measured.h > rows)
      top = Math.max(0, rows - measured.h);
    if (top < 0)
      top = 0;
    return { x: left, y: top, w: measured.w, h: measured.h, items: measured.slots };
  }
  function inside(col, row, rect) {
    return col >= rect.x && row >= rect.y && col < rect.x + rect.w && row < rect.y + rect.h;
  }

  // dist/theme.js
  function ink(fg, bg) {
    return { fg, bg };
  }
  var borland = {
    name: "borland",
    frame: "double",
    desktopGlyph: "░",
    shadowGlyph: "▒",
    closeGlyph: "■",
    zoomGlyph: "▲",
    unzoomGlyph: "▼",
    buttonLeft: "[",
    buttonRight: "]",
    checkOn: "X",
    checkOff: " ",
    radioOn: "•",
    radioOff: " ",
    scrollUp: "▲",
    scrollDown: "▼",
    scrollLeft: "◄",
    scrollRight: "►",
    thumb: "█",
    track: "▒",
    progressOn: "█",
    progressOff: "░",
    password: "•",
    desktop: ink(6, 4),
    menuBar: ink(0, 6),
    menuHot: ink(1, 6),
    menuActive: ink(0, 2),
    menuActiveHot: ink(11, 2),
    menu: ink(0, 6),
    menuSelect: ink(0, 2),
    menuSelectHot: ink(11, 2),
    menuDisabled: ink(8, 6),
    menuShortcut: ink(0, 6),
    menuShortcutSelect: ink(0, 2),
    menuLocked: ink(8, 6),
    menuLockedHot: ink(8, 6),
    status: ink(0, 6),
    statusHot: ink(1, 6),
    statusDisabled: ink(8, 6),
    window: ink(15, 4),
    windowTitle: ink(11, 4),
    windowInactive: ink(6, 4),
    windowTitleInactive: ink(7, 4),
    windowBody: ink(15, 4),
    windowShadow: ink(0, 0),
    button: ink(0, 6),
    buttonHot: ink(1, 6),
    buttonFocus: ink(15, 2),
    buttonFocusHot: ink(11, 2),
    buttonDefault: ink(11, 6),
    buttonDisabled: ink(8, 6),
    input: ink(11, 4),
    inputCaret: ink(4, 11),
    label: ink(15, 4),
    labelHot: ink(11, 4),
    labelDisabled: ink(8, 4),
    check: ink(15, 4),
    checkHot: ink(11, 4),
    checkFocus: ink(11, 4),
    checkFocusHot: ink(15, 4),
    list: ink(15, 4),
    listSelect: ink(0, 6),
    listFocus: ink(0, 2),
    scroll: ink(6, 4),
    scrollThumb: ink(15, 4),
    progress: ink(6, 4),
    progressFill: ink(14, 4),
    progressText: ink(11, 4),
    progressTextOn: ink(0, 14)
  };
  var linux = {
    name: "linux",
    frame: "single",
    desktopGlyph: " ",
    shadowGlyph: "░",
    closeGlyph: "×",
    zoomGlyph: "▲",
    unzoomGlyph: "▼",
    buttonLeft: "<",
    buttonRight: ">",
    checkOn: "X",
    checkOff: " ",
    radioOn: "*",
    radioOff: " ",
    scrollUp: "▲",
    scrollDown: "▼",
    scrollLeft: "◄",
    scrollRight: "►",
    thumb: "█",
    track: "░",
    progressOn: " ",
    progressOff: " ",
    password: "*",
    desktop: ink(4, 4),
    menuBar: ink(0, 7),
    menuHot: ink(1, 7),
    menuActive: ink(15, 4),
    menuActiveHot: ink(11, 4),
    menu: ink(15, 4),
    menuSelect: ink(0, 7),
    menuSelectHot: ink(1, 7),
    menuDisabled: ink(8, 4),
    menuShortcut: ink(14, 4),
    menuShortcutSelect: ink(4, 7),
    menuLocked: ink(8, 4),
    menuLockedHot: ink(8, 4),
    status: ink(0, 7),
    statusHot: ink(1, 7),
    statusDisabled: ink(8, 7),
    window: ink(15, 4),
    windowTitle: ink(14, 4),
    windowInactive: ink(7, 4),
    windowTitleInactive: ink(15, 4),
    windowBody: ink(15, 4),
    windowShadow: ink(0, 0),
    button: ink(15, 4),
    buttonHot: ink(11, 4),
    buttonFocus: ink(0, 7),
    buttonFocusHot: ink(1, 7),
    buttonDefault: ink(11, 4),
    buttonDisabled: ink(8, 4),
    input: ink(15, 0),
    inputCaret: ink(0, 15),
    label: ink(15, 4),
    labelHot: ink(11, 4),
    labelDisabled: ink(8, 4),
    check: ink(15, 4),
    checkHot: ink(11, 4),
    checkFocus: ink(14, 4),
    checkFocusHot: ink(11, 4),
    list: ink(15, 4),
    listSelect: ink(0, 7),
    listFocus: ink(0, 6),
    scroll: ink(14, 4),
    scrollThumb: ink(15, 4),
    progress: ink(15, 4),
    progressFill: ink(15, 1),
    progressText: ink(15, 4),
    progressTextOn: ink(15, 1)
  };
  function theme(name) {
    if (name === "linux")
      return copyTheme(linux);
    if (name === "borland")
      return copyTheme(borland);
    throw new Error(`Unknown theme "${name}"`);
  }
  function copyTheme(source) {
    const copy = { ...source };
    const record = copy;
    for (const key of Object.keys(record)) {
      const value = record[key];
      if (value && typeof value === "object")
        record[key] = { ...value };
    }
    return copy;
  }

  // dist/widgets.js
  var Label = class extends View {
    text;
    target;
    constructor(options = {}) {
      const text = options.text ?? "";
      super({
        ...options,
        w: options.w ?? Math.max(1, graphemeLength(parseLabel(text).text)),
        h: options.h ?? 1
      });
      this.text = text;
      this.target = options.target ?? null;
    }
    setText(text) {
      this.text = text;
    }
    paint(g) {
      const theme2 = g.theme;
      const rect = this.abs();
      const ink2 = this.disabled ? theme2.labelDisabled : theme2.label;
      const hot = this.disabled ? theme2.labelDisabled : theme2.labelHot;
      g.label(rect.x, rect.y, parseLabel(this.text), ink2, hot, this.w);
    }
    hot(letter) {
      if (!this.target || this.target.disabled || !this.target.visible)
        return false;
      if (!sameLetter(letter, parseLabel(this.text).hotChar))
        return false;
      if (this.target.focusable)
        this.host?.focus(this.target);
      this.target.invoke();
      return true;
    }
  };
  var StaticText = class extends View {
    text;
    constructor(options = {}) {
      super({ ...options, w: options.w ?? 8, h: options.h ?? 1 });
      this.text = options.text ?? "";
    }
    setText(text) {
      this.text = text;
    }
    paint(g) {
      const rect = this.abs();
      const lines = wrapText(this.text, Math.max(1, this.w)).slice(0, Math.max(0, this.h));
      const ink2 = g.theme.windowBody;
      for (let row = 0; row < lines.length; row += 1) {
        g.text(rect.x, rect.y + row, lines[row], ink2, this.w);
      }
    }
  };
  var Button = class extends View {
    text;
    /** Set when `result` was passed, including an explicit null. */
    closes;
    result;
    onPress;
    armed = false;
    constructor(options = {}) {
      const text = options.text ?? "Ok";
      const span = graphemeLength(parseLabel(text).text) + 4;
      super({
        ...options,
        w: options.w ?? Math.max(4, span),
        h: 1
      });
      this.text = text;
      this.isDefault = options.isDefault ?? false;
      this.closes = Object.prototype.hasOwnProperty.call(options, "result");
      this.result = options.result ?? null;
      this.onPress = options.onPress ?? null;
      this.focusable = true;
    }
    paint(g) {
      const theme2 = g.theme;
      const rect = this.abs();
      let ink2 = theme2.button;
      let hot = theme2.buttonHot;
      if (this.disabled) {
        ink2 = theme2.buttonDisabled;
        hot = theme2.buttonDisabled;
      } else if (this.hasFocus) {
        ink2 = theme2.buttonFocus;
        hot = theme2.buttonFocusHot;
      } else if (this.isDefault) {
        ink2 = theme2.buttonDefault;
        hot = theme2.buttonHot;
      }
      g.put(rect.x, rect.y, theme2.buttonLeft, ink2);
      g.put(rect.x + this.w - 1, rect.y, theme2.buttonRight, ink2);
      for (let col = 1; col < this.w - 1; col += 1)
        g.put(rect.x + col, rect.y, " ", ink2);
      const parsed = parseLabel(this.text);
      const room = this.w - 4;
      if (room > 0)
        g.label(rect.x + 2, rect.y, parsed, ink2, hot, room);
    }
    key(event) {
      if (event.key === " ") {
        this.activate();
        return true;
      }
      return false;
    }
    hot(letter) {
      if (!sameLetter(letter, parseLabel(this.text).hotChar))
        return false;
      this.activate();
      return true;
    }
    invoke() {
      this.activate();
    }
    mouse(event) {
      if (this.disabled || event.button !== 0 || event.kind !== "down")
        return false;
      this.host?.focus(this);
      this.armed = true;
      this.host?.capture({
        move: (next) => {
          this.armed = this.contains(next.col, next.row);
        },
        up: (next) => {
          const fire = this.armed && this.contains(next.col, next.row);
          this.armed = false;
          if (fire)
            this.activate();
        }
      });
      return true;
    }
    activate() {
      if (this.disabled || !this.visible)
        return;
      this.onPress?.();
      this.host?.beep(660, 28);
      if (this.closes)
        this.host?.endModal(this, this.result);
    }
  };
  var CheckBox = class extends View {
    text;
    checked;
    onChange;
    constructor(options = {}) {
      const text = options.text ?? "";
      const span = graphemeLength(parseLabel(text).text) + 4;
      super({
        ...options,
        w: options.w ?? Math.max(3, span),
        h: 1
      });
      this.text = text;
      this.checked = options.checked ?? false;
      this.onChange = options.onChange ?? null;
      this.focusable = true;
    }
    paint(g) {
      const theme2 = g.theme;
      const rect = this.abs();
      const ink2 = this.disabled ? theme2.labelDisabled : this.hasFocus ? theme2.checkFocus : theme2.check;
      const hot = this.disabled ? theme2.labelDisabled : this.hasFocus ? theme2.checkFocusHot : theme2.checkHot;
      const mark = this.checked ? theme2.checkOn : theme2.checkOff;
      g.put(rect.x, rect.y, "[", ink2);
      g.put(rect.x + 1, rect.y, mark, ink2);
      g.put(rect.x + 2, rect.y, "]", ink2);
      if (this.w > 3)
        g.put(rect.x + 3, rect.y, " ", ink2);
      g.label(rect.x + 4, rect.y, parseLabel(this.text), ink2, hot, Math.max(0, this.w - 4));
    }
    key(event) {
      if (event.key === " ") {
        this.toggle();
        return true;
      }
      return false;
    }
    hot(letter) {
      if (!sameLetter(letter, parseLabel(this.text).hotChar))
        return false;
      this.host?.focus(this);
      this.toggle();
      return true;
    }
    invoke() {
      this.toggle();
    }
    mouse(event) {
      if (this.disabled || event.kind !== "down" || event.button !== 0)
        return false;
      this.host?.focus(this);
      this.toggle();
      return true;
    }
    toggle() {
      if (this.disabled)
        return;
      this.checked = !this.checked;
      this.onChange?.(this.checked);
      this.host?.beep(880, 16);
    }
    setChecked(checked) {
      this.checked = checked;
    }
  };
  var RadioGroup = class extends View {
    items;
    selected;
    onChange;
    constructor(options = {}) {
      const items = (options.items ?? []).slice();
      const width = options.w ?? Math.max(4, ...items.map((item) => graphemeLength(parseLabel(item).text) + 4), 4);
      super({
        ...options,
        w: width,
        h: options.h ?? Math.max(1, items.length)
      });
      this.items = items;
      this.selected = items.length === 0 ? -1 : clamp(options.selected ?? 0, 0, items.length - 1);
      this.onChange = options.onChange ?? null;
      this.focusable = true;
    }
    paint(g) {
      const theme2 = g.theme;
      const rect = this.abs();
      const rows = Math.min(this.items.length, this.h);
      for (let row = 0; row < rows; row += 1) {
        const on = row === this.selected;
        const ink2 = this.disabled ? theme2.labelDisabled : on && this.hasFocus ? theme2.checkFocus : theme2.check;
        const hot = this.disabled ? theme2.labelDisabled : theme2.checkHot;
        const mark = on ? theme2.radioOn : theme2.radioOff;
        g.put(rect.x, rect.y + row, "(", ink2);
        g.put(rect.x + 1, rect.y + row, mark, ink2);
        g.put(rect.x + 2, rect.y + row, ")", ink2);
        if (this.w > 3)
          g.put(rect.x + 3, rect.y + row, " ", ink2);
        g.label(rect.x + 4, rect.y + row, parseLabel(this.items[row]), ink2, hot, Math.max(0, this.w - 4));
      }
    }
    key(event) {
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        this.move(1);
        return true;
      }
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        this.move(-1);
        return true;
      }
      if (event.key === "Home") {
        this.select(0);
        return true;
      }
      if (event.key === "End") {
        this.select(this.items.length - 1);
        return true;
      }
      if (event.key.length === 1 && !event.alt && !event.ctrl && !event.meta) {
        return this.hot(event.key);
      }
      return false;
    }
    hot(letter) {
      const index = this.items.findIndex((item) => sameLetter(letter, parseLabel(item).hotChar));
      if (index < 0)
        return false;
      this.host?.focus(this);
      this.select(index);
      return true;
    }
    mouse(event) {
      if (this.disabled || event.kind !== "down" || event.button !== 0)
        return false;
      const index = event.row - this.abs().y;
      if (index < 0 || index >= this.items.length)
        return false;
      this.host?.focus(this);
      this.select(index);
      return true;
    }
    select(index) {
      if (this.items.length === 0 || this.disabled)
        return;
      const next = clamp(index, 0, this.items.length - 1);
      if (next === this.selected)
        return;
      this.selected = next;
      this.onChange?.(next, this.items[next]);
      this.host?.beep(880, 16);
    }
    move(dir) {
      if (this.items.length === 0)
        return;
      const base = this.selected < 0 ? 0 : this.selected;
      const next = (base + dir + this.items.length) % this.items.length;
      this.select(next);
    }
  };
  var InputLine = class extends View {
    value = "";
    max;
    password;
    caret = 0;
    onChange;
    origin = 0;
    constructor(options = {}) {
      super({ ...options, w: options.w ?? 12, h: 1 });
      this.max = Math.max(1, options.max ?? 240);
      this.password = options.password ?? false;
      this.onChange = options.onChange ?? null;
      this.focusable = true;
      this.setValue(options.value ?? "", false);
    }
    setValue(value, emit = true) {
      const parts = graphemes(value).slice(0, this.max);
      const next = parts.join("");
      this.caret = Math.min(this.caret, parts.length);
      if (next === this.value)
        return;
      this.value = next;
      if (emit)
        this.onChange?.(this.value);
    }
    paint(g) {
      const theme2 = g.theme;
      const rect = this.abs();
      const parts = this.shown();
      this.fit(parts.length);
      g.fill(rect.x, rect.y, this.w, 1, " ", theme2.input);
      for (let col = 0; col < this.w; col += 1) {
        const index = this.origin + col;
        const glyph = index < parts.length ? parts[index] : " ";
        const caret = this.hasFocus && (this.host?.caretOn ?? true) && index === this.caret;
        g.put(rect.x + col, rect.y, glyph, caret ? theme2.inputCaret : theme2.input);
      }
    }
    key(event) {
      const parts = graphemes(this.value);
      if (event.ctrl && !event.alt && !event.meta && event.key.toLowerCase() === "a") {
        this.caret = 0;
        return true;
      }
      if (event.ctrl && !event.alt && !event.meta && event.key.toLowerCase() === "e") {
        this.caret = parts.length;
        return true;
      }
      if (event.key === "ArrowLeft") {
        this.caret = Math.max(0, this.caret - 1);
        return true;
      }
      if (event.key === "ArrowRight") {
        this.caret = Math.min(parts.length, this.caret + 1);
        return true;
      }
      if (event.key === "Home") {
        this.caret = 0;
        return true;
      }
      if (event.key === "End") {
        this.caret = parts.length;
        return true;
      }
      if (event.key === "Backspace") {
        if (this.caret > 0) {
          parts.splice(this.caret - 1, 1);
          this.caret -= 1;
          this.commit(parts);
        }
        return true;
      }
      if (event.key === "Delete") {
        if (this.caret < parts.length) {
          parts.splice(this.caret, 1);
          this.commit(parts);
        }
        return true;
      }
      if (event.key.length === 1 && !event.ctrl && !event.alt && !event.meta) {
        if (parts.length >= this.max)
          return true;
        parts.splice(this.caret, 0, event.key);
        this.caret += 1;
        this.commit(parts);
        return true;
      }
      return false;
    }
    mouse(event) {
      if (this.disabled || event.kind !== "down" || event.button !== 0)
        return false;
      this.host?.focus(this);
      const parts = graphemes(this.value);
      let index = this.origin + (event.col - this.abs().x);
      if (index < 0)
        index = 0;
      if (index > parts.length)
        index = parts.length;
      this.caret = index;
      return true;
    }
    shown() {
      const parts = graphemes(this.value);
      if (!this.password)
        return parts;
      return parts.map(() => this.host?.theme.password ?? "•");
    }
    fit(length) {
      if (this.caret < this.origin)
        this.origin = this.caret;
      if (this.caret >= this.origin + this.w)
        this.origin = this.caret - this.w + 1;
      const maxOrigin = Math.max(0, length - this.w + 1);
      if (this.origin > maxOrigin)
        this.origin = maxOrigin;
      if (this.origin < 0)
        this.origin = 0;
    }
    commit(parts) {
      this.value = parts.join("");
      this.onChange?.(this.value);
    }
  };
  var ScrollBar = class extends View {
    orientation;
    min;
    max;
    value;
    page;
    onChange;
    constructor(options = {}) {
      const orientation = options.orientation ?? "vertical";
      super({
        ...options,
        w: options.w ?? (orientation === "vertical" ? 1 : 8),
        h: options.h ?? (orientation === "vertical" ? 8 : 1)
      });
      this.orientation = orientation;
      this.min = options.min ?? 0;
      this.max = options.max ?? 0;
      this.value = options.value ?? 0;
      this.page = Math.max(1, options.page ?? 1);
      this.onChange = options.onChange ?? null;
      this.value = clamp(this.value, this.min, Math.max(this.min, this.max));
    }
    setValue(value, emit = true) {
      const next = clamp(Math.round(value), this.min, Math.max(this.min, this.max));
      if (next === this.value)
        return;
      this.value = next;
      if (emit)
        this.onChange?.(this.value);
    }
    paint(g) {
      const theme2 = g.theme;
      const rect = this.abs();
      const vertical = this.orientation === "vertical";
      const length = vertical ? rect.h : rect.w;
      const track = Math.max(0, length - 2);
      const putAt = (index, ch, ink2) => {
        if (vertical)
          g.put(rect.x, rect.y + index, ch, ink2);
        else
          g.put(rect.x + index, rect.y, ch, ink2);
      };
      if (length >= 1)
        putAt(0, vertical ? theme2.scrollUp : theme2.scrollLeft, theme2.scroll);
      if (length >= 2)
        putAt(length - 1, vertical ? theme2.scrollDown : theme2.scrollRight, theme2.scroll);
      for (let i = 0; i < track; i += 1)
        putAt(1 + i, theme2.track, theme2.scroll);
      if (track > 0)
        putAt(1 + this.thumbIndex(track), theme2.thumb, theme2.scrollThumb);
    }
    key(event) {
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        this.setValue(this.value - 1);
        return true;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        this.setValue(this.value + 1);
        return true;
      }
      if (event.key === "PageUp") {
        this.setValue(this.value - this.page);
        return true;
      }
      if (event.key === "PageDown") {
        this.setValue(this.value + this.page);
        return true;
      }
      if (event.key === "Home") {
        this.setValue(this.min);
        return true;
      }
      if (event.key === "End") {
        this.setValue(this.max);
        return true;
      }
      return false;
    }
    mouse(event) {
      if (this.disabled || event.button !== 0)
        return false;
      if (event.kind === "wheel") {
        this.setValue(this.value + Math.sign(event.delta));
        return true;
      }
      if (event.kind !== "down")
        return false;
      const local = this.localIndex(event);
      const length = this.orientation === "vertical" ? this.h : this.w;
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
    dragThumb(event, track) {
      const origin = this.localIndex(event);
      const originValue = this.value;
      this.host?.capture({
        move: (next) => {
          if (track <= 1 || this.max <= this.min)
            return;
          const delta = this.localIndex(next) - origin;
          const span = this.max - this.min;
          const value = originValue + Math.round(delta * span / (track - 1));
          this.setValue(value);
        },
        up: () => {
        }
      });
    }
    localIndex(event) {
      const rect = this.abs();
      return this.orientation === "vertical" ? event.row - rect.y : event.col - rect.x;
    }
    thumbIndex(track) {
      if (track <= 1 || this.max <= this.min)
        return 0;
      const t = (this.value - this.min) / (this.max - this.min);
      return clamp(Math.round(t * (track - 1)), 0, track - 1);
    }
  };
  var ListBox = class extends Group {
    items = [];
    selected = -1;
    scroll = 0;
    onChange;
    onAccept;
    bar;
    lastClick = 0;
    lastIndex = -1;
    constructor(options = {}) {
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
    setItems(items, selected = this.selected) {
      this.items = items.slice();
      if (this.items.length === 0)
        this.selected = -1;
      else
        this.selected = clamp(selected, 0, this.items.length - 1);
      this.reveal();
    }
    select(index, emit = true) {
      if (this.items.length === 0) {
        this.selected = -1;
        this.reveal();
        return;
      }
      const next = clamp(index, 0, this.items.length - 1);
      const changed = next !== this.selected;
      this.selected = next;
      this.reveal();
      if (changed && emit)
        this.onChange?.(next, this.items[next]);
    }
    paint(g) {
      const theme2 = g.theme;
      const rect = this.abs();
      drawFrame(g, rect, { glyphs: SINGLE, ink: theme2.list, titleInk: theme2.list, body: theme2.list });
      const page = this.page();
      const width = Math.max(0, this.w - 3);
      for (let row = 0; row < page; row += 1) {
        const index = this.scroll + row;
        const on = index === this.selected && index >= 0 && index < this.items.length;
        const ink2 = on ? this.hasFocus ? theme2.listFocus : theme2.listSelect : theme2.list;
        const text = index >= 0 && index < this.items.length ? this.items[index] : "";
        g.fill(rect.x + 1, rect.y + 1 + row, width, 1, " ", ink2);
        g.text(rect.x + 1, rect.y + 1 + row, text, ink2, width);
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
    key(event) {
      if (this.items.length === 0)
        return false;
      if (event.key === "ArrowUp") {
        this.select(this.selected - 1);
        return true;
      }
      if (event.key === "ArrowDown") {
        this.select(this.selected + 1);
        return true;
      }
      if (event.key === "PageUp") {
        this.select(this.selected - this.page());
        return true;
      }
      if (event.key === "PageDown") {
        this.select(this.selected + this.page());
        return true;
      }
      if (event.key === "Home") {
        this.select(0);
        return true;
      }
      if (event.key === "End") {
        this.select(this.items.length - 1);
        return true;
      }
      if (event.key === "Enter") {
        if (this.selected >= 0)
          this.onAccept?.(this.selected, this.items[this.selected]);
        return true;
      }
      return false;
    }
    mouse(event) {
      if (this.disabled)
        return false;
      if (event.kind === "wheel") {
        const dir = Math.sign(event.delta);
        if (dir !== 0)
          this.setScroll(this.scroll + dir);
        return true;
      }
      if (event.kind !== "down" || event.button !== 0)
        return false;
      const rect = this.abs();
      const localX = event.col - rect.x;
      const localY = event.row - rect.y;
      if (localX === this.w - 2)
        return this.bar.mouse(event);
      if (localX <= 0 || localX >= this.w - 1 || localY <= 0 || localY >= this.h - 1)
        return false;
      const index = this.scroll + (localY - 1);
      if (index < 0 || index >= this.items.length)
        return false;
      this.host?.focus(this);
      const now = Date.now();
      const again = index === this.lastIndex && now - this.lastClick < 400;
      this.lastClick = now;
      this.lastIndex = index;
      this.select(index);
      if (again)
        this.onAccept?.(index, this.items[index]);
      return true;
    }
    page() {
      return Math.max(1, this.h - 2);
    }
    maxScroll() {
      return Math.max(0, this.items.length - this.page());
    }
    setScroll(value) {
      this.scroll = clamp(value, 0, this.maxScroll());
    }
    reveal() {
      const page = this.page();
      if (this.selected < 0) {
        this.scroll = 0;
        return;
      }
      if (this.selected < this.scroll)
        this.scroll = this.selected;
      if (this.selected >= this.scroll + page)
        this.scroll = this.selected - page + 1;
      this.scroll = clamp(this.scroll, 0, this.maxScroll());
    }
  };
  var ProgressBar = class extends View {
    value;
    max;
    showPercent;
    constructor(options = {}) {
      super({ ...options, w: options.w ?? 16, h: 1 });
      this.max = options.max ?? 100;
      this.value = options.value ?? 0;
      this.showPercent = options.showPercent ?? true;
    }
    paint(g) {
      const theme2 = g.theme;
      const rect = this.abs();
      const max = this.max <= 0 ? 1 : this.max;
      const amount = clamp(this.value, 0, max);
      const filled = Math.round(amount / max * this.w);
      for (let col = 0; col < this.w; col += 1) {
        const on = col < filled;
        g.put(rect.x + col, rect.y, on ? theme2.progressOn : theme2.progressOff, on ? theme2.progressFill : theme2.progress);
      }
      if (!this.showPercent || this.w < 4)
        return;
      const label = `${Math.round(amount / max * 100)}%`;
      const parts = graphemes(label);
      const start = Math.floor((this.w - parts.length) / 2);
      for (let i = 0; i < parts.length; i += 1) {
        const col = start + i;
        const on = col < filled;
        g.put(rect.x + col, rect.y, parts[i], on ? theme2.progressTextOn : theme2.progressText);
      }
    }
  };

  // dist/window.js
  var Window = class extends Group {
    title;
    closeable;
    zoomable;
    movable;
    resizable;
    center;
    onClose;
    zoomed = false;
    saved = null;
    constructor(options = {}) {
      super({
        ...options,
        w: options.w ?? 24,
        h: options.h ?? 8
      });
      this.title = options.title ?? "";
      this.closeable = options.closeable ?? true;
      this.zoomable = options.zoomable ?? true;
      this.movable = options.movable ?? true;
      this.resizable = options.resizable ?? false;
      this.center = options.center ?? false;
      this.onClose = options.onClose ?? null;
    }
    /** True when this window is the modal dialog, or the front window. */
    isActive() {
      return this.host?.activeView() === this;
    }
    paint(g) {
      if (!this.visible)
        return;
      const rect = this.abs();
      const active = this.isActive();
      const theme2 = g.theme;
      const glyphs = active && theme2.frame === "double" ? DOUBLE : SINGLE;
      const ink2 = active ? theme2.window : theme2.windowInactive;
      const titleInk = active ? theme2.windowTitle : theme2.windowTitleInactive;
      drawFrame(g, rect, {
        glyphs,
        ink: ink2,
        titleInk,
        title: this.title,
        close: this.closeable ? theme2.closeGlyph : null,
        zoom: this.zoomable ? this.zoomed ? theme2.unzoomGlyph : theme2.zoomGlyph : null,
        body: theme2.windowBody
      });
      drawShadow(g, rect, theme2.shadowGlyph, theme2.windowShadow);
      const interior = { x: rect.x + 1, y: rect.y + 1, w: Math.max(0, rect.w - 2), h: Math.max(0, rect.h - 2) };
      g.withClip(interior, () => {
        for (const child of this.children) {
          if (child.visible)
            child.paint(g);
        }
      });
    }
    mouse(event) {
      if (!this.visible || this.disabled || event.kind !== "down" || event.button !== 0)
        return false;
      const rect = this.abs();
      const localX = event.col - rect.x;
      const localY = event.row - rect.y;
      if (this.closeable && localY === 0 && localX === 1) {
        this.requestClose();
        return true;
      }
      if (this.zoomable && localY === 0 && localX === this.w - 2) {
        this.toggleZoom();
        return true;
      }
      if (this.resizable && localX === this.w - 1 && localY === this.h - 1) {
        this.startResize(event);
        return true;
      }
      if (this.movable && localY === 0 && localX > 0 && localX < this.w - 1) {
        this.startMove(event);
        return true;
      }
      return false;
    }
    /** Hide a window. A dialog cancels instead. */
    close() {
      this.requestClose();
    }
    requestClose() {
      this.visible = false;
      this.onClose?.();
      this.host?.detached(this);
    }
    toggleZoom() {
      const area = this.host?.workArea() ?? { x: 0, y: 0, w: this.w, h: this.h };
      if (this.zoomed && this.saved) {
        this.x = this.saved.x;
        this.y = this.saved.y;
        this.w = this.saved.w;
        this.h = this.saved.h;
        this.zoomed = false;
        this.saved = null;
        return;
      }
      this.saved = { x: this.x, y: this.y, w: this.w, h: this.h };
      this.x = 0;
      this.y = 0;
      this.w = area.w;
      this.h = area.h;
      this.zoomed = true;
    }
    /** Keep the frame inside the desktop and at least large enough for a title. */
    clamp() {
      const area = this.host?.workArea();
      if (!area)
        return;
      this.w = clamp(this.w, Math.min(8, area.w), area.w);
      this.h = clamp(this.h, Math.min(4, area.h), area.h);
      this.x = clamp(this.x, 0, Math.max(0, area.w - this.w));
      this.y = clamp(this.y, 0, Math.max(0, area.h - this.h));
    }
    startMove(event) {
      const originX = this.x;
      const originY = this.y;
      const col = event.col;
      const row = event.row;
      this.zoomed = false;
      this.saved = null;
      this.host?.capture({
        move: (next) => {
          this.x = originX + (next.col - col);
          this.y = originY + (next.row - row);
          this.clamp();
        },
        up: () => {
        }
      });
    }
    startResize(event) {
      const originW = this.w;
      const originH = this.h;
      const col = event.col;
      const row = event.row;
      this.zoomed = false;
      this.saved = null;
      this.host?.capture({
        move: (next) => {
          this.w = originW + (next.col - col);
          this.h = originH + (next.row - row);
          this.clamp();
        },
        up: () => {
        }
      });
    }
  };
  var Dialog = class extends Window {
    onResult;
    constructor(options = {}) {
      super({
        ...options,
        zoomable: options.zoomable ?? false,
        resizable: options.resizable ?? false,
        closeable: options.closeable ?? true,
        movable: options.movable ?? true
      });
      this.onResult = options.onResult ?? null;
    }
    /** End the dialog. `null` cancels. */
    close(result = null) {
      this.onResult?.(result);
      this.host?.endModal(this, result);
    }
    requestClose() {
      this.close(null);
    }
  };

  // dist/app.js
  var Application = class {
    surface;
    desktop = new Desktop();
    menu;
    status;
    theme;
    sound;
    focused = null;
    /** Lit caret phase. `run` blinks it. A headless `draw` leaves it on. */
    caretOn = true;
    menuWanted;
    statusWanted;
    beepFn;
    onQuit;
    modals = [];
    active = null;
    grabbed = null;
    held = null;
    holdingFocus = false;
    audio = null;
    painting = false;
    again = false;
    dirty = true;
    quitting = false;
    looping = false;
    mounted = false;
    frame = 0;
    listening = false;
    constructor(surface, options = {}) {
      if (!surface || typeof surface.set !== "function" || typeof surface.get !== "function" || typeof surface.beginFrame !== "function" || typeof surface.endFrame !== "function" || !Number.isFinite(surface.cols) || !Number.isFinite(surface.rows)) {
        throw new Error("Application surface must be a terminal (set, get, beginFrame, endFrame, cols, rows)");
      }
      this.surface = surface;
      this.theme = typeof options.theme === "string" ? theme(options.theme) : options.theme ? copyTheme(options.theme) : theme("borland");
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
    get cols() {
      return this.surface.cols;
    }
    get rows() {
      return this.surface.rows;
    }
    get menuLocked() {
      return this.modals.length > 0;
    }
    /** Desktop size in window coordinates. The menu and the status line sit outside it. */
    workArea() {
      this.layout();
      return { x: 0, y: 0, w: this.desktop.w, h: this.desktop.h };
    }
    activeView() {
      return this.topModal() ?? this.active;
    }
    setTheme(next) {
      this.theme = typeof next === "string" ? theme(next) : copyTheme(next);
      this.draw();
    }
    /** Paint now. Safe to call again from a handler; the second pass runs after the first. */
    draw() {
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
        if (this.status.visible)
          this.status.paint(g);
        if (this.menu.visible)
          this.menu.paint(g);
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
    requestDraw() {
      this.dirty = true;
    }
    /**
     * Handle one key. A string is the key with no modifiers, the same text as `KeyboardEvent.key`.
     * Returns true when the desk used the key.
     */
    press(input) {
      if (this.quitting)
        return false;
      const event = normalizeKey(input);
      if (event.repeat && (event.key === "Enter" || event.key === " " || event.key === "Escape" || event.key === "F10" || event.alt)) {
        return false;
      }
      this.layout();
      const modal = this.topModal();
      if (this.runStatus(event, !!modal))
        return true;
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
      if (!modal && event.key === "F10" && !event.alt && !event.ctrl) {
        this.menu.focusBar();
        this.draw();
        return true;
      }
      if (!modal && event.key === "F6" && !event.alt && !event.ctrl) {
        this.cycleWindow(event.shift ? -1 : 1);
        this.draw();
        return true;
      }
      if (!modal && this.runMenuCommand(event))
        return true;
      if (event.key === "Tab") {
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
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        this.cycle(-1);
        this.draw();
        return true;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        this.cycle(1);
        this.draw();
        return true;
      }
      if (event.key === "Enter" && scope) {
        const button = scope.focusables().find((view) => view.isDefault && view instanceof Button);
        const chosen = button instanceof Button ? button : this.focused instanceof Button ? this.focused : null;
        if (chosen) {
          chosen.activate();
          this.draw();
          return true;
        }
      }
      if (event.key === "Escape" && modal) {
        modal.close(null);
        return true;
      }
      return false;
    }
    /** Handle one pointer event in cell coordinates. */
    pointer(event) {
      if (this.quitting)
        return false;
      if (event.kind === "move") {
        if (this.grabbed) {
          this.grabbed.move(event);
          this.draw();
          return true;
        }
        if (this.menu.open && !this.menuLocked) {
          if (this.menu.hover(event.col, event.row))
            this.draw();
          return true;
        }
        return false;
      }
      if (event.kind === "up") {
        if (!this.grabbed)
          return false;
        const capture = this.grabbed;
        this.grabbed = null;
        capture.up(event);
        this.draw();
        return true;
      }
      if (event.kind === "wheel") {
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
      if (event.kind !== "down")
        return false;
      const modal = !!this.topModal();
      if (!modal && this.menu.pointer(event)) {
        this.draw();
        return true;
      }
      if (this.status.pointer(event, modal)) {
        if (!modal)
          this.menu.close();
        this.draw();
        return true;
      }
      const target = this.pick(event.col, event.row);
      if (!target)
        return false;
      const win = owningWindow(target);
      if (modal && win !== this.topModal())
        return true;
      if (win && !modal)
        this.activateWindow(win);
      if (!target.disabled && target.focusable)
        this.focus(target);
      else if (!target.disabled) {
        const near = this.nearestFocusable(target);
        if (near)
          this.focus(near);
        else if (target instanceof Window) {
          const next = target.preferredFocus();
          if (next)
            this.focus(next);
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
    modal(dialog) {
      return new Promise((resolve) => {
        if (this.quitting || this.modals.some((frame2) => frame2.dialog === dialog)) {
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
        const frame = { dialog, resolve, focus: this.focused, active: this.active };
        this.modals.push(frame);
        this.desktop.add(dialog);
        this.focus(dialog.preferredFocus());
        this.draw();
      });
    }
    /** Listen for keys and the pointer. A missing `window` does nothing. */
    mount() {
      if (this.mounted)
        return;
      this.mounted = true;
      const win = globalThis.window;
      if (!win || typeof win.addEventListener !== "function")
        return;
      win.addEventListener("keydown", this.onKeyDown);
      win.addEventListener("pointermove", this.onPointerMove);
      win.addEventListener("pointerup", this.onPointerUp);
      const element = this.canvasElement();
      if (element && typeof element.addEventListener === "function") {
        element.addEventListener("pointerdown", this.onPointerDown);
        element.addEventListener("wheel", this.onWheel, { passive: false });
      }
      this.listening = true;
    }
    /** Remove the listeners and stop the frame loop. The last picture stays. */
    destroy() {
      this.stop();
      if (!this.listening)
        return;
      const win = globalThis.window;
      if (win && typeof win.removeEventListener === "function") {
        win.removeEventListener("keydown", this.onKeyDown);
        win.removeEventListener("pointermove", this.onPointerMove);
        win.removeEventListener("pointerup", this.onPointerUp);
      }
      const element = this.canvasElement();
      if (element && typeof element.removeEventListener === "function") {
        element.removeEventListener("pointerdown", this.onPointerDown);
        element.removeEventListener("wheel", this.onWheel);
      }
      this.listening = false;
      this.mounted = false;
    }
    /** Mount, paint, and blink the field caret. */
    run() {
      this.mount();
      this.draw();
      if (this.looping)
        return;
      const raf = globalThis.requestAnimationFrame;
      if (typeof raf !== "function")
        return;
      this.looping = true;
      const tick = (now) => {
        if (!this.looping)
          return;
        const on = Math.floor(now / 500) % 2 === 0;
        if (on !== this.caretOn && this.focused instanceof InputLine)
          this.dirty = true;
        this.caretOn = on;
        if (this.dirty && !this.quitting)
          this.draw();
        this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick);
    }
    /** Stop the blink loop. Listeners stay until `destroy`. */
    stop() {
      this.looping = false;
      const cancel = globalThis.cancelAnimationFrame;
      if (this.frame && typeof cancel === "function")
        cancel(this.frame);
      this.frame = 0;
    }
    /** Ignore later input, close dialogs, and call `onQuit`. */
    quit() {
      if (this.quitting)
        return;
      this.quitting = true;
      this.menu.close();
      while (this.modals.length > 0)
        this.finishModal(this.modals.length - 1, null);
      this.stop();
      this.onQuit?.();
    }
    beep(freq = 440, duration = 40) {
      if (!this.sound)
        return;
      if (this.beepFn) {
        this.beepFn(freq, duration);
        return;
      }
      const AudioCtor = globalThis.AudioContext;
      if (typeof AudioCtor !== "function")
        return;
      try {
        const audio = this.audio ?? new AudioCtor();
        this.audio = audio;
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = "square";
        osc.frequency.value = freq;
        gain.gain.value = 0.04;
        osc.connect(gain);
        gain.connect(audio.destination);
        const now = audio.currentTime;
        osc.start(now);
        osc.stop(now + Math.max(0.01, duration / 1e3));
      } catch {
      }
    }
    focus(view) {
      if (this.focused === view)
        return;
      if (this.focused) {
        this.focused.hasFocus = false;
        this.focused.blur();
      }
      this.focused = view;
      if (!view)
        return;
      view.hasFocus = true;
      view.focus();
      const win = owningWindow(view);
      if (win && win.parent === this.desktop && !this.topModal())
        this.activateWindow(win);
    }
    endModal(origin, result) {
      let dialog = null;
      let current = origin;
      while (current) {
        if (current instanceof Dialog)
          dialog = current;
        current = current.parent;
      }
      if (!dialog)
        return;
      const index = this.modals.findIndex((frame) => frame.dialog === dialog);
      if (index < 0) {
        dialog.visible = false;
        return;
      }
      while (this.modals.length - 1 > index)
        this.finishModal(this.modals.length - 1, null);
      if (this.modals[index])
        this.finishModal(index, result);
    }
    capture(capture) {
      this.grabbed = capture;
    }
    adopted(view) {
      if (view instanceof Window && view.parent === this.desktop)
        this.active = view;
    }
    detached(view) {
      if (this.focused && (this.focused === view || nested(this.focused, view))) {
        this.focused.hasFocus = false;
        this.focused.blur();
        this.focused = null;
      }
      if (this.active && (this.active === view || nested(this.active, view)))
        this.active = this.topWindow();
    }
    saveFocus() {
      if (this.holdingFocus)
        return;
      this.holdingFocus = true;
      this.held = this.focused;
      if (this.focused) {
        this.focused.hasFocus = false;
        this.focused.blur();
        this.focused = null;
      }
    }
    restoreFocus() {
      if (!this.holdingFocus)
        return;
      this.holdingFocus = false;
      const view = this.held;
      this.held = null;
      if (view && this.inTree(view) && view.visible && !view.disabled)
        this.focus(view);
    }
    prepareSurface() {
      this.surface.cursorLit = false;
      if (typeof this.surface.colorStyle === "function")
        this.surface.colorStyle("ansi");
      if (typeof this.surface.background === "function")
        this.surface.background(4);
    }
    layout() {
      const cols = Math.max(0, Math.floor(this.surface.cols));
      const rows = Math.max(0, Math.floor(this.surface.rows));
      let showMenu = this.menuWanted && rows >= 1;
      let showStatus = this.statusWanted && rows >= 1;
      if (showMenu && showStatus && rows < 2)
        showStatus = false;
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
    runStatus(event, modal) {
      const hint = this.status.hints.find((item) => item.action && !item.disabled && (!modal || item.global) && matchShortcut(item.key, event));
      if (!hint || !hint.action)
        return false;
      if (!modal)
        this.menu.close();
      this.beep(660, 20);
      hint.action();
      this.draw();
      return true;
    }
    runMenuCommand(event) {
      const matched = runMenuShortcut(this.menu.entries, event);
      if (!matched)
        return false;
      this.beep(660, 20);
      this.draw();
      return true;
    }
    dispatchHot(letter) {
      const scope = this.scope();
      if (!scope)
        return false;
      return walkHot(scope, letter);
    }
    scope() {
      return this.topModal() ?? this.active;
    }
    cycle(dir) {
      const scope = this.scope();
      if (!scope)
        return;
      const list = scope.focusables();
      if (list.length === 0)
        return;
      const index = this.focused ? list.indexOf(this.focused) : -1;
      const next = index < 0 ? dir > 0 ? 0 : list.length - 1 : mod2(index + dir, list.length);
      this.focus(list[next]);
    }
    cycleWindow(dir) {
      const windows = this.desktop.children.filter((child) => child instanceof Window && child.visible);
      if (windows.length === 0)
        return;
      const index = this.active ? windows.indexOf(this.active) : -1;
      const next = windows[mod2((index < 0 ? 0 : index) + dir, windows.length)];
      this.activateWindow(next);
      this.focus(next.preferredFocus());
    }
    activateWindow(win) {
      this.desktop.raise(win);
      this.active = win;
    }
    topModal() {
      for (let i = this.modals.length - 1; i >= 0; i -= 1) {
        const dialog = this.modals[i].dialog;
        if (dialog.visible)
          return dialog;
      }
      return null;
    }
    topWindow() {
      const kids = this.desktop.children;
      for (let i = kids.length - 1; i >= 0; i -= 1) {
        const child = kids[i];
        if (child instanceof Window && child.visible)
          return child;
      }
      return null;
    }
    finishModal(index, result) {
      const frame = this.modals[index];
      if (!frame)
        return;
      this.modals.splice(index, 1);
      if (frame.dialog.parent === this.desktop)
        this.desktop.remove(frame.dialog);
      const active = frame.active && frame.active.visible && frame.active.parent === this.desktop ? frame.active : this.topWindow();
      this.active = active;
      const saved = frame.focus;
      if (saved && this.inTree(saved) && saved.visible && !saved.disabled)
        this.focus(saved);
      else if (saved)
        this.focus(active ? active.preferredFocus() : null);
      else
        this.focus(null);
      this.draw();
      frame.resolve(result);
    }
    pick(col, row) {
      const modal = this.topModal();
      if (modal) {
        if (!modal.visible || !modal.contains(col, row))
          return null;
        return hitWindow(modal, col, row);
      }
      const kids = this.desktop.children;
      for (let i = kids.length - 1; i >= 0; i -= 1) {
        const child = kids[i];
        const found = child instanceof Window ? hitWindow(child, col, row) : hitDeep(child, col, row);
        if (found)
          return found;
      }
      return null;
    }
    nearestFocusable(view) {
      let current = view.parent;
      while (current) {
        if (current.focusable && !current.disabled && current.visible)
          return current;
        current = current.parent;
      }
      return null;
    }
    inTree(view) {
      let current = view;
      while (current.parent)
        current = current.parent;
      return current === this.desktop;
    }
    canvasElement() {
      const surface = this.surface;
      const element = surface.canvas?.element ?? surface.element ?? null;
      return element;
    }
    cellAt(event) {
      const element = this.canvasElement();
      if (!element || typeof element.getBoundingClientRect !== "function")
        return null;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0)
        return null;
      const col = Math.floor((event.clientX - rect.left) / rect.width * this.surface.cols);
      const row = Math.floor((event.clientY - rect.top) / rect.height * this.surface.rows);
      return { col, row };
    }
    onKeyDown = (event) => {
      const target = event.target;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable)
        return;
      if (claimsKey(event))
        event.preventDefault();
      this.press({
        key: event.key,
        alt: event.altKey,
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        meta: event.metaKey,
        repeat: event.repeat
      });
    };
    onPointerDown = (event) => {
      const pointer = event;
      if (pointer.button !== 0)
        return;
      const cell = this.cellAt(pointer);
      if (!cell)
        return;
      pointer.preventDefault();
      this.pointer({ col: cell.col, row: cell.row, kind: "down", button: 0, delta: 0 });
    };
    onPointerMove = (event) => {
      if (!this.grabbed && !(this.menu.open && !this.menuLocked))
        return;
      const pointer = event;
      const cell = this.cellAt(pointer);
      if (!cell)
        return;
      this.pointer({ col: cell.col, row: cell.row, kind: "move", button: pointer.button, delta: 0 });
    };
    onPointerUp = (event) => {
      if (!this.grabbed)
        return;
      const pointer = event;
      const cell = this.cellAt(pointer) ?? { col: -1, row: -1 };
      this.pointer({ col: cell.col, row: cell.row, kind: "up", button: pointer.button, delta: 0 });
    };
    onWheel = (event) => {
      const wheel = event;
      const cell = this.cellAt(wheel);
      if (!cell)
        return;
      wheel.preventDefault();
      this.pointer({ col: cell.col, row: cell.row, kind: "wheel", button: 0, delta: wheel.deltaY });
    };
  };
  function normalizeKey(input) {
    if (typeof input === "string") {
      return { key: input, alt: false, ctrl: false, shift: false, meta: false, repeat: false };
    }
    return {
      key: input.key,
      alt: !!input.alt,
      ctrl: !!input.ctrl,
      shift: !!input.shift,
      meta: !!input.meta,
      repeat: !!input.repeat
    };
  }
  function claimsKey(event) {
    if (event.altKey || event.key === "Tab" || event.key === "Escape" || event.key === " ")
      return true;
    if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End")
      return true;
    if (event.key === "PageUp" || event.key === "PageDown")
      return true;
    if (event.key === "F1" || event.key === "F6" || event.key === "F10")
      return true;
    return false;
  }
  function mod2(value, length) {
    if (length <= 0)
      return 0;
    return (value % length + length) % length;
  }
  function nested(view, root) {
    let current = view;
    while (current) {
      if (current === root)
        return true;
      current = current.parent;
    }
    return false;
  }
  function owningWindow(view) {
    let current = view;
    while (current) {
      if (current instanceof Window)
        return current;
      current = current.parent;
    }
    return null;
  }
  function walkHot(view, letter) {
    if (!view.visible || view.disabled)
      return false;
    if (view.hot(letter))
      return true;
    if (view instanceof Group) {
      for (const child of view.children) {
        if (walkHot(child, letter))
          return true;
      }
    }
    return false;
  }
  function hitWindow(win, col, row) {
    if (!win.visible || win.disabled || !win.contains(col, row))
      return null;
    const rect = win.abs();
    const onFrame = col === rect.x || row === rect.y || col === rect.x + rect.w - 1 || row === rect.y + rect.h - 1;
    if (onFrame)
      return win;
    for (let i = win.children.length - 1; i >= 0; i -= 1) {
      const found = hitDeep(win.children[i], col, row);
      if (found)
        return found;
    }
    return win;
  }
  function hitDeep(view, col, row) {
    if (!view.visible || !view.contains(col, row))
      return null;
    if (view instanceof Window)
      return hitWindow(view, col, row);
    if (view instanceof Group) {
      for (let i = view.children.length - 1; i >= 0; i -= 1) {
        const found = hitDeep(view.children[i], col, row);
        if (found)
          return found;
      }
    }
    return view;
  }

  // dist/dialog.js
  function messageBox(app, message, options = {}) {
    const specs = (options.buttons ?? ["&Ok"]).map((button) => {
      if (typeof button === "string")
        return { label: button, result: void 0, isDefault: false };
      return { label: button.label, result: button.result, isDefault: !!button.isDefault };
    });
    if (!specs.some((spec) => spec.isDefault) && specs.length > 0)
      specs[0].isDefault = true;
    const area = app.workArea();
    const maxInner = Math.max(8, Math.min(52, Math.max(8, area.w - 4)));
    const title = options.title ?? "Message";
    const buttons = specs.map((spec) => new Button({
      text: spec.label,
      isDefault: spec.isDefault,
      result: spec.result !== void 0 ? spec.result : parseLabel(spec.label).text
    }));
    const gap = 2;
    const buttonsW = buttons.reduce((sum, button) => sum + button.w, 0) + gap * Math.max(0, buttons.length - 1);
    const lines = wrapText(message, maxInner);
    const textW = lines.reduce((wide, line) => Math.max(wide, graphemeLength(line)), 0);
    const inner = Math.max(textW, buttonsW, graphemeLength(title) + 2, 12);
    const w = Math.max(8, Math.min(area.w || inner + 2, inner + 2));
    const textWidth = Math.max(1, w - 4);
    const wrapped = wrapText(message, textWidth);
    const textH = Math.max(1, Math.min(wrapped.length, Math.max(1, (area.h || 8) - 4)));
    const h = Math.max(5, Math.min(area.h || textH + 4, textH + 4));
    const dialog = new Dialog({
      w,
      h,
      title,
      center: true,
      closeable: true,
      movable: true
    });
    dialog.add(new StaticText({ x: 2, y: 1, w: textWidth, h: Math.max(1, h - 4), text: wrapped.join("\n") }));
    let x = 1 + Math.max(0, Math.floor((w - 2 - buttonsW) / 2));
    const y = h - 2;
    for (const button of buttons) {
      button.x = x;
      button.y = y;
      dialog.add(button);
      x += button.w + gap;
    }
    return app.modal(dialog);
  }
  function confirm(app, message, title = "Confirm") {
    return messageBox(app, message, {
      title,
      buttons: [
        { label: "&Yes", result: "yes", isDefault: true },
        { label: "&No", result: "no" }
      ]
    }).then((result) => result === "yes");
  }
  return __toCommonJS(index_exports);
})();
globalThis.EmojiEngineUI = EmojiEngineUI;
