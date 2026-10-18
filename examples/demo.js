/**
 * Contract check for the built public API, then both engine terminals.
 * Run: npm run demo
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as api from '../dist/index.js';
import { mountDesk } from './desk.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const names = [
  'Application', 'Window', 'Dialog', 'Button', 'CheckBox', 'RadioGroup', 'InputLine',
  'ListBox', 'Label', 'StaticText', 'ProgressBar', 'ScrollBar', 'MenuBar', 'StatusLine',
  'Desktop', 'View', 'Group', 'messageBox', 'confirm', 'borland', 'linux', 'theme',
];

let app = null;

checkBundle('emoji-engine-ui.js');
checkBundle('emoji-engine-ui.min.js');
await checkDesk();
checkEngines();
console.log('demo ok');

function checkBundle(file) {
  const code = readFileSync(path.join(root, 'browser', file), 'utf8');
  const sandbox = {};
  vm.createContext(sandbox);
  try {
    vm.runInContext(code, sandbox, { filename: file });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`${file} did not run: ${message}`);
  }
  const exported = sandbox.EmojiEngineUI;
  const found = exported ? Object.keys(exported).join(',') : 'missing';
  for (const name of names) {
    const value = exported?.[name];
    const ok = name === 'borland' || name === 'linux' ? value && typeof value === 'object' : typeof value === 'function';
    if (!ok) fail(`${file} missing ${name} (${found})`);
  }
}

async function checkDesk() {
  let threw = false;
  try {
    api.theme('vga');
  } catch {
    threw = true;
  }
  if (!threw) fail('unknown theme must throw');

  const surface = memorySurface(78, 24);
  const desk = mountDesk(api, surface, { beep() {} });
  app = desk.app;

  expect(surface.depth, 0, 'frame depth');
  expect(surface.outside, 0, 'set outside a frame');
  expect(surface.cursorLit, false, 'caret hidden');
  expect(cell(1, 0).ch, 'F', 'menu hotkey');
  expect(cell(1, 0).bg, 6, 'menu background');
  expect(cell(1, 0).fg, 1, 'menu hotkey color');
  expect(cell(0, 1).ch, '░', 'desktop glyph');
  expect(cell(0, 1).fg, 6, 'desktop fg');
  expect(cell(0, 1).bg, 4, 'desktop bg');
  assertOpaque();

  const noteAt = desk.note.abs();
  const heathAt = desk.heath.abs();
  expect(cell(noteAt.x, noteAt.y).ch, '╔', 'active double corner');
  expect(cell(heathAt.x, heathAt.y).ch, '┌', 'inactive single corner');
  expect(cell(heathAt.x + desk.heath.w, heathAt.y + 1).ch, '▒', 'shadow');
  if (!screen().includes('Heath') || !screen().includes('Note')) fail('window titles missing');

  app.press({ key: 'f', alt: true });
  if (!screen().includes('New')) fail('Alt+f did not show New');
  expect(desk.bag.made, 0, 'opening File does not run New');
  expect(app.menu.item, 0, 'first enabled row');
  app.press('Escape');
  expect(app.menu.open, false, 'Esc closes the menu');
  expect(cell(1, 0).ch, 'F', 'menu restored');

  expect(desk.note.isActive(), true, 'note starts active');
  app.press({ key: 'F6' });
  expect(desk.heath.isActive(), true, 'F6 cycles to Heath');
  expect(cell(desk.heath.abs().x, desk.heath.abs().y).ch, '╔', 'Heath becomes double');
  app.press({ key: 'F6', shift: true });
  expect(desk.note.isActive(), true, 'Shift-F6 cycles back');

  app.press({ key: 'f', alt: true });
  app.press('ArrowDown');
  expect(app.menu.item, 2, 'disabled Save is skipped');
  app.press('Enter');
  expect(app.menu.sub >= 0, true, 'Enter opens the submenu');
  app.press('Enter');
  expect(desk.bag.opened, 'heath', 'submenu Enter runs Heath');
  expect(app.menu.open, false, 'submenu action closes the menu');

  const noteX = desk.note.x;
  app.press({ key: 'f', alt: true });
  app.pointer({ col: desk.note.abs().x + 4, row: desk.note.abs().y, kind: 'down', button: 0, delta: 0 });
  expect(app.menu.open, false, 'click outside closes the menu');
  expect(desk.note.x, noteX, 'that click does not drag');

  desk.setTheme('linux');
  expect(cell(0, 1).ch, ' ', 'linux desk');
  expect(cell(0, 1).bg, 4, 'linux desk color');
  expect(cell(1, 0).bg, 7, 'linux menu');
  expect(cell(desk.ring.abs().x, desk.ring.abs().y).ch, '<', 'linux button');
  desk.setTheme('borland');
  expect(cell(0, 1).ch, '░', 'borland desk returns');
  expect(cell(desk.ring.abs().x, desk.ring.abs().y).ch, '[', 'borland button');
  expect(surface.outside, 0, 'theme switch stays inside a frame');

  const pending = desk.openSettings();
  expect(app.focused, desk.name, 'settings focuses the name');
  const caret = desk.name.abs();
  expect(cell(caret.x, caret.y).fg, 4, 'caret fg');
  expect(cell(caret.x, caret.y).bg, 11, 'caret bg');
  for (const key of ['M', 'i', 'r', 'a']) app.press(key);
  expect(desk.name.value, 'Mira', 'typed name');
  app.press('Tab');
  expect(app.focused, desk.sound, 'tab reaches sound');
  app.press(' ');
  expect(desk.sound.checked, false, 'space clears sound');
  expect(app.sound, false, 'sound follows the box');
  app.press('Tab');
  expect(app.focused, desk.pace, 'tab reaches pace');
  app.press('ArrowDown');
  expect(desk.pace.selected, 1, 'radio moves to Run');
  app.press('Tab');
  expect(app.focused, desk.companions, 'tab reaches the list');
  app.press('ArrowDown');
  expect(desk.companions.selected, 1, 'list moves to Hunter');
  app.press('Tab');
  app.press(' ');
  expect(await pending, 'ok', 'Ok result');
  expect(desk.name.value, 'Mira', 'name kept');
  expect(desk.settings.parent, null, 'dialog left the desktop');
  if (screen().includes('Mira')) fail('closed dialog still painted');

  const message = api.messageBox(app, 'Hello hare', { title: 'Note' });
  app.press('Enter');
  expect(await message, 'Ok', 'Enter presses Ok');

  const answer = api.confirm(app, 'Leave?');
  app.press('Tab');
  app.press(' ');
  expect(await answer, false, 'Space presses No');

  const cancelled = api.messageBox(app, 'Stay');
  app.press('Escape');
  expect(await cancelled, null, 'Esc cancels');

  const first = app.modal(desk.settings);
  const second = app.modal(desk.settings);
  expect(await second, null, 'a dialog already open resolves null');
  app.press('Escape');
  expect(await first, null, 'Esc closes the first dialog');

  const ringAt = desk.ring.abs();
  const before = desk.rings.count;
  app.pointer({ col: ringAt.x + 2, row: ringAt.y, kind: 'down', button: 0, delta: 0 });
  app.pointer({ col: 0, row: 0, kind: 'up', button: 0, delta: 0 });
  expect(desk.rings.count, before, 'mouseup outside does not press');
  app.pointer({ col: ringAt.x + 2, row: ringAt.y, kind: 'down', button: 0, delta: 0 });
  app.pointer({ col: ringAt.x + 2, row: ringAt.y, kind: 'up', button: 0, delta: 0 });
  expect(desk.rings.count, before + 1, 'click rings');

  const waiting = api.messageBox(app, 'Wait');
  app.pointer({ col: ringAt.x + 2, row: ringAt.y, kind: 'down', button: 0, delta: 0 });
  app.pointer({ col: ringAt.x + 2, row: ringAt.y, kind: 'up', button: 0, delta: 0 });
  expect(desk.rings.count, before + 1, 'a dialog eats the click');
  app.press('Escape');
  await waiting;

  const originX = desk.heath.x;
  const originY = desk.heath.y;
  const title = desk.heath.abs();
  app.pointer({ col: title.x + 4, row: title.y, kind: 'down', button: 0, delta: 0 });
  app.pointer({ col: title.x + 8, row: title.y + 2, kind: 'move', button: 0, delta: 0 });
  app.pointer({ col: title.x + 8, row: title.y + 2, kind: 'up', button: 0, delta: 0 });
  expect(desk.heath.x, originX + 4, 'drag x');
  expect(desk.heath.y, originY + 2, 'drag y');

  const grown = desk.heath.abs();
  const width = desk.heath.w;
  const height = desk.heath.h;
  app.pointer({ col: grown.x + width - 1, row: grown.y + height - 1, kind: 'down', button: 0, delta: 0 });
  app.pointer({ col: grown.x + width - 1 + 3, row: grown.y + height - 1 + 1, kind: 'move', button: 0, delta: 0 });
  app.pointer({ col: grown.x + width - 1 + 3, row: grown.y + height - 1 + 1, kind: 'up', button: 0, delta: 0 });
  expect(desk.heath.w, width + 3, 'resize width');
  expect(desk.heath.h, height + 1, 'resize height');

  const saved = { x: desk.note.x, y: desk.note.y, w: desk.note.w, h: desk.note.h };
  const zoomAt = desk.note.abs();
  app.pointer({ col: zoomAt.x + desk.note.w - 2, row: zoomAt.y, kind: 'down', button: 0, delta: 0 });
  const area = app.workArea();
  expect(desk.note.x, 0, 'zoom x');
  expect(desk.note.y, 0, 'zoom y');
  expect(desk.note.w, area.w, 'zoom width');
  expect(desk.note.h, area.h, 'zoom height');
  const unzoom = desk.note.abs();
  app.pointer({ col: unzoom.x + desk.note.w - 2, row: unzoom.y, kind: 'down', button: 0, delta: 0 });
  expect(desk.note.x, saved.x, 'unzoom x');
  expect(desk.note.y, saved.y, 'unzoom y');
  expect(desk.note.w, saved.w, 'unzoom width');
  expect(desk.note.h, saved.h, 'unzoom height');

  const parked = desk.note.y;
  desk.note.y = -3;
  app.draw();
  expect(cell(1, 0).ch, 'F', 'menu survives a high window');
  expect(cell(1, 0).bg, 6, 'menu color survives');
  desk.note.y = parked;
  app.draw();

  const closeAt = desk.heath.abs();
  app.pointer({ col: closeAt.x + 1, row: closeAt.y, kind: 'down', button: 0, delta: 0 });
  expect(desk.heath.visible, false, 'close box hides Heath');
  app.press({ key: 'F3', alt: true });
  expect(desk.note.visible, false, 'Alt-F3 closes the active window');

  desk.openProgress();
  expect(app.focused, desk.step, 'progress focuses Step');
  app.press(' ');
  expect(desk.bar.value, 25, 'step fills the gauge');
  if (!screen().includes('25%')) fail('gauge percent missing');
  app.press('Tab');
  expect(app.focused, desk.hour, 'tab reaches the scrollbar');
  app.press('ArrowRight');
  expect(desk.hour.value, 7, 'scrollbar moves');
  desk.journey.close();
  expect(desk.journey.visible, false, 'journey hides');

  app.press({ key: 'f', alt: true });
  app.press('Enter');
  expect(desk.bag.made, 1, 'New runs');
  expect(desk.heath.visible, true, 'New shows Heath');
  if (!screen().includes('new morning')) fail('New did not rewrite the heath');

  const kept = cell(1, 0).ch;
  app.quit();
  expect(cell(1, 0).ch, kept, 'quit keeps the last picture');
  expect(app.press('a'), false, 'quit ignores keys');
  expect(surface.depth, 0, 'frames stayed balanced');
  expect(surface.outside, 0, 'no set outside a frame');
}

function checkEngines() {
  for (const which of ['2d', '3d']) {
    const run = spawnSync(process.execPath, ['examples/engine-check.js', which], {
      cwd: root,
      encoding: 'utf8',
    });
    if (run.status !== 0) {
      fail(`${which} engine check failed\n${run.stdout ?? ''}\n${run.stderr ?? ''}`);
    }
    if (!String(run.stdout).includes(`${which} ok`)) {
      fail(`${which} engine check was silent\n${run.stdout ?? ''}`);
    }
  }
}

function memorySurface(cols, rows) {
  const cells = Array.from({ length: rows }, () => (
    Array.from({ length: cols }, () => ({ ch: ' ', fg: null, bg: null, bright: false }))
  ));
  let depth = 0;
  let outside = 0;
  return {
    cols,
    rows,
    cursorLit: true,
    beginFrame() {
      depth += 1;
    },
    endFrame() {
      if (depth <= 0) throw new Error('endFrame without beginFrame');
      depth -= 1;
    },
    set(col, row, value) {
      if (depth <= 0) outside += 1;
      if (row < 0 || col < 0 || row >= rows || col >= cols) return;
      if (typeof value === 'string') {
        cells[row][col] = { ch: value, fg: null, bg: null, bright: false };
        return;
      }
      cells[row][col] = {
        ch: value.ch,
        fg: value.fg ?? null,
        bg: value.bg ?? null,
        bright: !!value.bright,
      };
    },
    get(col, row) {
      if (col < 0 || row < 0 || col >= cols || row >= rows) return { ch: ' ' };
      return { ...cells[row][col] };
    },
    write() {
      throw new Error('write is not used');
    },
    color() {
      throw new Error('color is not used');
    },
    get depth() {
      return depth;
    },
    get outside() {
      return outside;
    },
  };
}

function assertOpaque() {
  for (let row = 0; row < app.rows; row += 1) {
    for (let col = 0; col < app.cols; col += 1) {
      const item = app.surface.get(col, row);
      if (typeof item.bg !== 'number' || typeof item.fg !== 'number') {
        fail(`bare cell ${col},${row} ${JSON.stringify(item)}`);
      }
      if (item.bright) fail(`bright cell ${col},${row}`);
    }
  }
}

function cell(col, row) {
  return app.surface.get(col, row);
}

function screen() {
  const lines = [];
  for (let row = 0; row < app.rows; row += 1) {
    let text = '';
    for (let col = 0; col < app.cols; col += 1) text += app.surface.get(col, row).ch || ' ';
    lines.push(text);
  }
  return lines.join('\n');
}

function expect(actual, wanted, label) {
  if (actual !== wanted) fail(`${label}: ${JSON.stringify(actual)} !== ${JSON.stringify(wanted)}`);
}

function fail(message) {
  console.error(message);
  if (app) {
    const lines = screen().split('\n');
    for (let row = 0; row < lines.length; row += 1) console.error(String(row).padStart(2, ' '), lines[row]);
  }
  process.exit(1);
}
