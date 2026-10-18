# Architecture

emoji-engine-ui is one desk. It paints into a cell surface and does not import emoji-engine-2d or emoji-engine-3d. Application code is what joins a terminal to the desk.

```text
application
  ├─ Utilities.wrap        page chrome, owned by the engine
  ├─ Terminal              cell buffer, owned by the engine
  └─ Application ─ uses ─▶ Terminal.set / get / beginFrame / endFrame
        ├─ MenuBar
        ├─ Desktop
        │    └─ Window / Dialog
        │         └─ Button, InputLine, ListBox, …
        └─ StatusLine
```

| Piece | Owns | Leaves alone |
| --- | --- | --- |
| Application | Layout, focus, modals, keys, the pointer, the frame | How a cell becomes pixels |
| MenuBar, StatusLine | The top and bottom rows | Windows underneath |
| Window, Dialog | The frame, drag, zoom, resize, the result of a dialog | The desktop's pattern |
| Widgets | One control's cells and keys | Other controls |
| Theme | ANSI indexes and one-cell glyphs | The widget tree |

The engines stay unaware of the desk. A terminal is accepted by shape: `cols`, `rows`, `cursorLit`, `set`, `get`, `beginFrame`, `endFrame`. `colorStyle` and `background` are called once when they exist. `write` and `color` are not used.

## A frame

`draw` hides the hardware caret, calls `beginFrame`, and paints in this order:

1. The desktop pattern, across the whole grid
2. Windows, clipped to the desktop plus one cell so a shadow can spill
3. The status line
4. The menu bar, and any open popup last

The menu and the status line are painted after the windows, so a window dragged upward cannot cover them. `endFrame` lets the terminal flush once. `draw` from inside a handler waits until the outer paint finishes, then runs again.

`run` mounts listeners and blinks an input caret every 500 ms. A headless `draw` leaves the caret lit. `stop` ends the blink. `destroy` also removes the listeners.

## Coordinates

The menu is screen row 0 when it was requested. The status line is the last row. The desktop fills what remains, and window positions are inside that rectangle. `(0, 0)` on a window is the corner of its frame. Children start at `(1, 1)`.

```text
 screen (0,0) menu ─────────────────────────────────────────
 desktop (0,0) ┌─■─ Heath ──────────────▲─┐
               │  child (1,1) is here     │▒
               └───────────────────────── ┘▒
               ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
 screen last row  F1 Help   F10 Menu   Alt-X Exit
```

A hit on the frame belongs to the window, even when a child sits on the same cell. The close glyph is local `(1, 0)`. Zoom is `(w - 2, 0)`. The resize corner is `(w - 1, h - 1)`. Shadow cells are one column to the right and one row below.

The pointer converts `clientX` and `clientY` through the canvas rectangle and `cols` / `rows`. It does not read the private cell size. Keys are read from `window`, because `Terminal.onKey` drops Alt, Ctrl, and Shift.

## Input

`press` walks one fixed order. A modal blocks the menu, window cycling, and ordinary shortcuts. A status hint marked `global` still runs.

1. Status hints. During a dialog, only `global` ones
2. An open menu
3. Alt plus a letter on a menu title
4. F10 focuses the menu bar. F6 and Shift-F6 cycle windows
5. A menu shortcut such as `Alt-X`, while the menu is closed
6. Tab cycles focus. Alt plus a letter invokes a hotkey in the active window
7. The focused control
8. Arrow keys cycle focus when the control did not take them
9. Enter presses the default button, or the focused button when no default is set
10. Esc cancels the top dialog with null

Space presses a focused button or toggles a checkbox. An input line keeps Space as a character. A list keeps Enter and reports `onAccept` instead of pressing the default button. Repeat Enter, Space, Esc, F10, and Alt are ignored.

The mouse arms a button on pointer down and fires it on pointer up when the pointer is still inside. A click outside an open menu closes the menu and is not delivered to the window under it. A click outside a dialog is not delivered to the desk behind it.

## Themes

`borland` is the Turbo Vision desk: cyan on blue `░`, a cyan menu, red hotkeys, a green selection, yellow titles, double frames on the active window, `[ Ok ]`, and a `■` close box. `linux` is the console desk: a solid blue field, a gray bar, single frames, `< Ok >`, a `×` close box, and a red gauge.

An inactive window uses a single frame on both themes. `setTheme` replaces the inks and glyphs and redraws. The widget tree stays.

## Source map

```text
src/surface.ts    CellSurface, KeyEvent, CellPointer
src/theme.ts      borland, linux
src/text.ts       labels, wrapping, shortcuts
src/painter.ts    frames, shadows, clipped set()
src/view.ts       View, Group, Desktop
src/widgets.ts    buttons, fields, lists, gauges
src/window.ts     Window, Dialog
src/menu.ts       MenuBar, StatusLine
src/app.ts        Application
src/dialog.ts     messageBox, confirm
src/index.ts      public exports
```
