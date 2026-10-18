# Changes

emoji-engine-ui is alpha, at package version 0.1.0. Entries here describe behavior a caller can observe. Until a release candidate, a later version may change any of this again. See the status note in [README.md](README.md).

## Unreleased

### Desk

The first public surface. Pass a terminal from emoji-engine-2d or emoji-engine-3d to `Application`. The package does not depend on either engine.

- `new Application(surface, options)` requires `set`, `get`, `beginFrame`, `endFrame`, and finite `cols` and `rows`. The constructor does not paint. `draw` paints. `run` also listens and blinks the input caret.
- `options.theme` is `'borland'` (the default), `'linux'`, or a theme object. `setTheme` switches at runtime. `theme(name)` throws on an unknown name.
- `options.menu` and `options.status` add those bars. Omit either one and that row is not drawn. An empty menu array still draws the bar.
- `options.sound` defaults to true. `options.beep` replaces the square wave. A missing `AudioContext` is ignored.
- Cells are written with `set({ ch, fg, bg, bright: false })`. Indexes are ANSI 0–15. `write` and `color` are not called. When `colorStyle` exists it is set to `'ansi'`. When `background` exists it is set to blue, index 4.
- `&` marks a hotkey. `&&` is a literal ampersand. Shortcuts accept `Alt-X`, `Alt+X`, `F3`, `Ctrl-S`, `Shift-F6`, and the aliases `Esc`, `Enter`, and `Space`.
- Enter presses the default button in the active window or dialog. Space presses the focused button. A checkbox toggles on Space. A list consumes Enter. An input line does not.
- Esc and the close box resolve `modal` with null. A second `modal` of a dialog that is already open resolves null and leaves the first one up. `quit` resolves open dialogs with null, stops the blink, and leaves the last picture.
- F10 focuses the menu. F6 and Shift-F6 cycle visible windows. Alt plus a letter opens a menu, or invokes a control hotkey when no menu has that letter. Global status hints run during a dialog. Repeat of Enter, Space, Esc, F10, and Alt is ignored.
- Window children include the frame. The first interior cell is `(1, 1)`. The active Borland window uses a double frame. Every other window uses a single frame. Drag, zoom, and resize clamp to the desktop, at least 8 by 4 when the desktop is that large.
- `messageBox` and `confirm` build a centered dialog. The promise resolves to the button result. `confirm` is true only for Yes.

`examples/demo.js` checks this contract on an in-memory surface and on both engine terminals.
