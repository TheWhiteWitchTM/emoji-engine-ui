# emoji-engine-ui

**Alpha.** This is alpha-level code. Public interfaces and behavior can change between versions, and a change can break callers. Use it at your own risk.

A release candidate is the point where the public interfaces freeze. Until then, treat [INTERFACES.md](INTERFACES.md) as a description of the code you have, and read [CHANGES.md](CHANGES.md) before you upgrade.

A desk of Borland Turbo Vision and Linux `dialog` widgets for the sibling packages emoji-engine-2d and emoji-engine-3d. Menus, windows, dialogs, and the usual controls. The keyboard cursor and the mouse both work.

The library does not import either engine. You pass a terminal. Both terminals already speak `set`, `get`, `beginFrame`, and `endFrame`, so one desk paints on either one. `write` is never called, because it would parse ECMA-48 sequences instead of storing a glyph.

## Features

- Two themes, `borland` and `linux`, switched at runtime
- Menu bar with submenus, a status line, and Alt-letter hotkeys
- Windows you can drag, zoom, resize, and close, plus modal dialogs
- Buttons, checkboxes, radio groups, input lines, lists, scrollbars, progress bars, and static text
- Keyboard cursor and mouse, including a dragged thumb and a dragged title
- `messageBox` and `confirm` as promises
- Plain JavaScript in `dist/` for an `import`, and script-tag builds in `browser/`

Colors are ANSI indexes 0 through 15. `bright` is always false, so indexes 0–7 do not shift. On emoji-engine-2d the desk calls `colorStyle('ansi')` when that method exists. Leave the terminal on that palette.

`Utilities.wrap` in either engine is the page chrome around the canvas. This library is the cells inside it.

## Install and run the demo

```bash
npm install
npm run demo
```

`npm install` compiles `src/` into `dist/` and writes the script-tag builds to `browser/`. `npm run build` does that again after you change the TypeScript. The demo imports the built files with Node, so it does not need tsx. It drives a heath desk on an in-memory cell buffer, then paints the same menu through each engine's real terminal:

```text
demo ok
```

Under Node the engine check installs that engine's DOM stand-in (`examples/dom-shim.js` in the sibling project). Browsers already have `document` and `requestAnimationFrame`.

The same desk is in `examples/play.html`. Serve the directory that contains all three projects, so the page can reach both engine builds:

```bash
python3 -m http.server 8765
```

Open `http://localhost:8765/emoji-engine-ui/examples/play.html`. Add `?engine=3d` for the 3D terminal. Run `npm run build` here, and in the engine you load, first. F10 opens the menu. Alt-X quits.

## Use the API

After `npm install`, import the built module. From this repository that path is `./dist/index.js`. A project that depends on this package imports `emoji-engine-ui` instead.

```js
import { Terminal, Utilities } from '../emoji-engine-2d/dist/index.js';
import { Application, Button, Window } from './dist/index.js';

const term = new Terminal({ cols: 80, rows: 25, showCursor: false });
const chrome = Utilities.wrap(term, { title: 'Heath' });
document.body.appendChild(chrome.wrap);

const app = new Application(term, {
  theme: 'borland',
  menu: [
    { label: '&File', items: [
      { label: 'E&xit', shortcut: 'Alt-X', action: () => app.quit() },
    ] },
  ],
  status: [
    { key: 'Alt-X', label: 'Exit', global: true, action: () => app.quit() },
  ],
});

const heath = new Window({ title: 'Heath', x: 4, y: 2, w: 32, h: 10 });
heath.add(new Button({ x: 2, y: 2, text: '&Ring', onPress: () => app.beep(660, 40) }));
app.desktop.add(heath);
app.run();
```

emoji-engine-3d is the same call with that package's `Terminal` and `Utilities`. `theme: 'linux'` selects the console look. `app.setTheme('borland')` switches back.

A page can load the constructors from the script build. `EmojiEngineUI` is the global. `browser/emoji-engine-ui.min.js` is the same script, minified. Load the engine script first.

```html
<script src="./browser/emoji-engine-2d.js"></script>
<script src="./browser/emoji-engine-ui.js"></script>
<script>
  const { Terminal, Utilities } = EmojiEngine;
  const { Application, Window, Button } = EmojiEngineUI;
</script>
```

`&` in a label marks a hotkey. `&&` is a literal ampersand. `&File` opens on Alt+F. A shortcut such as `Alt-X` or `F3` runs while the menu is closed. Enter presses the dialog's default button. Space presses the button or box under the cursor. Esc cancels a dialog with null.

`dist/index.js` exports the desk, the widgets, both themes, `messageBox`, and `confirm`. TypeScript declarations are in `dist/index.d.ts`.

## Docs

- [CHANGES.md](CHANGES.md) — behavior a caller can observe, including breaks while this stays alpha
- [ARCHITECTURE.md](ARCHITECTURE.md) — the desk and how a frame runs
- [INTERFACES.md](INTERFACES.md) — the contracts the source implements

## License

MIT. See [LICENSE](LICENSE).
