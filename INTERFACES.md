# Public interfaces

These are the contracts for emoji-engine-ui. The classes in `src/` implement them, and `src/index.ts` exports the classes plus the supporting types below. `npm run build` writes that same module to `dist/index.js`, with declarations in `dist/index.d.ts`.

The shapes are ordinary TypeScript interfaces, so plain JavaScript can call the same methods. The library never imports an engine. A terminal is passed in.

## The cell surface

Anything with this shape can host the desk. Both engine terminals already have it.

```ts
interface CellSurface {
  readonly cols: number;
  readonly rows: number;
  cursorLit: boolean;
  set(col: number, row: number, value: CellInk | string): void;
  get(col: number, row: number): CellInk;
  beginFrame(): void;
  endFrame(): void;
  canvas?: { element?: EventTarget | null };
  element?: EventTarget | null;
  colorStyle?: (style: string) => void;          // emoji-engine-2d
  background?: (color: string | number | null) => void;
}

interface CellInk {
  ch: string;
  fg?: number | null;     // ANSI 0–15
  bg?: number | null;
  bright?: boolean;       // the desk always writes false
}
```

Indexes follow the classic ANSI palette both engines paint:

| Index | Color | Index | Color |
| --- | --- | --- | --- |
| 0 | black | 8 | bright black |
| 1 | red | 9 | bright red |
| 2 | green | 10 | bright green |
| 3 | brown | 11 | yellow |
| 4 | blue | 12 | bright blue |
| 5 | magenta | 13 | bright magenta |
| 6 | cyan | 14 | bright cyan |
| 7 | gray | 15 | white |

`colorStyle('ansi')` is selected when the method exists, so a C64 palette does not renumber these indexes. `bright` stays false. Bright colors are the indexes 8–15 themselves.

`write` parses ECMA-48 and is not part of this contract. Do not point the desk at a surface whose `set` parses control sequences.

## Keys and the pointer

```ts
interface KeyEvent {
  key: string;          // KeyboardEvent.key: 'ArrowUp', 'Enter', 'a', 'F10'
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  repeat?: boolean;
}

interface CellPointer {
  col: number;
  row: number;          // may fall outside the grid during a drag
  kind: 'down' | 'up' | 'move' | 'wheel';
  button: number;       // the desk acts on 0
  delta: number;        // wheel; positive scrolls down
}
```

`Application.press` accepts a `KeyEvent` or a string. A string is the key with no modifiers. `pointer` takes cell coordinates. `run` listens on `window` for keys and on the canvas element for the pointer, and it ignores keydown while the target is an `INPUT`, `TEXTAREA`, `SELECT`, or `contentEditable` element.

## Themes

```ts
type ThemeName = 'borland' | 'linux';

interface Ink { fg: number; bg: number }

interface Theme {
  name: string;
  frame: 'double' | 'single';
  desktopGlyph: string;
  closeGlyph: string;
  buttonLeft: string;
  buttonRight: string;
  // remaining glyphs and inks: see src/theme.ts
  desktop: Ink;
  menuBar: Ink;
  window: Ink;
  windowTitle: Ink;
  button: Ink;
  input: Ink;
  progressFill: Ink;
}
```

`borland` and `linux` are the built-in themes. `theme(name)` returns a copy and throws on an unknown name. `copyTheme` copies the ink objects so a running desk does not share them with the constants. `Application.setTheme` accepts a name or a theme object.

`borland` uses a cyan-on-blue `░` desktop, a black-on-cyan menu, red hotkeys, a green selection, yellow titles, double frames, `[ Ok ]`, and `■`. `linux` uses a solid blue desktop, a gray bar, single frames, `< Ok >`, `×`, and a red gauge. An inactive window is single-line on both.

## Application

```ts
interface AppOptions {
  theme?: ThemeName | Theme;     // default 'borland'
  menu?: MenuEntry[];             // omit to hide the bar
  status?: StatusHint[];          // omit to hide the line
  sound?: boolean;                // default true
  beep?: (freq: number, duration: number) => void;
  onQuit?: () => void;
}

class Application {
  readonly surface: CellSurface;
  readonly desktop: Desktop;
  readonly menu: MenuBar;
  readonly status: StatusLine;
  theme: Theme;
  sound: boolean;
  focused: View | null;
  caretOn: boolean;
  readonly cols: number;
  readonly rows: number;
  readonly menuLocked: boolean;

  constructor(surface: CellSurface, options?: AppOptions);
  workArea(): Rect;                         // desktop size, under the menu and above the status
  activeView(): View | null;                // the dialog, or the front window
  setTheme(next: ThemeName | Theme): void;
  draw(): void;
  requestDraw(): void;
  press(input: KeyEvent | string): boolean;
  pointer(event: CellPointer): boolean;
  modal(dialog: Dialog): Promise<string | null>;
  mount(): void;
  destroy(): void;
  run(): void;
  stop(): void;
  quit(): void;
  beep(freq?: number, duration?: number): void;
  focus(view: View | null): void;
}
```

`modal` adds the dialog, focuses its first focusable control, and resolves when the dialog ends. Pass `center: true` on the dialog to recenter it each time it opens. Esc and the close box resolve `null`. A button whose options included `result` resolves that value, including an explicit `null`.

Enter activates the control with `isDefault`, when that control is a button. Otherwise it activates the focused button. A focused list consumes Enter first. Space activates the focused button and does not jump to the default.

`quit` sets a flag, resolves every open dialog with `null`, stops the frame loop, calls `onQuit`, and does not clear the grid. Later `press` and `pointer` calls return false.

## Views

```ts
interface Rect { x: number; y: number; w: number; h: number }

interface ViewOptions {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  disabled?: boolean;
  visible?: boolean;
}

class View {
  x: number; y: number; w: number; h: number;
  disabled: boolean;
  visible: boolean;
  focusable: boolean;
  isDefault: boolean;
  hasFocus: boolean;
  parent: Group | null;
  data: Record<string, unknown>;
  abs(): Rect;
  contains(col: number, row: number): boolean;
}

class Group extends View {
  readonly children: View[];
  add(view: View): this;
  remove(view: View): void;
  raise(view: View): void;
  focusables(): View[];
  preferredFocus(): View | null;    // the first focusable descendant
}

class Desktop extends Group {}
```

`x` and `y` are the column and row inside the parent. Screen position is the sum of the parents. `Group.add` of a view that already has a parent removes it first. Adding a view that is already a child raises it.

## Windows

```ts
interface WindowOptions extends ViewOptions {
  title?: string;
  closeable?: boolean;     // default true
  zoomable?: boolean;      // default true; dialogs default false
  movable?: boolean;       // default true
  resizable?: boolean;     // default false; dialogs default false
  center?: boolean;        // modal() recenters when true
  onClose?: () => void;
}

class Window extends Group {
  title: string;
  isActive(): boolean;
  close(): void;
  requestClose(): void;
  toggleZoom(): void;
  clamp(): void;
}

interface DialogOptions extends WindowOptions {
  onResult?: (result: string | null) => void;
}

class Dialog extends Window {
  close(result?: string | null): void;    // ends modal(); default null
}
```

Children are placed in window coordinates, frame included:

```text
(0,0) corner   (1,0) close   title   (w-2,0) zoom   (w-1,0) corner
(0,1)          (1,1) first interior cell
(0,h-1)        (w-1,h-1) resize grip
```

`toggleZoom` saves the rectangle and fills `workArea`, or restores it. A move or a resize clears the saved zoom. `clamp` keeps at least an 8 by 4 frame inside the desktop when the desktop is large enough.

`Window.close` hides the window. `Dialog.close` does not hide first. It ends the modal with the result. The dialog is removed from the desktop when the promise resolves.

## Menus and status

```ts
interface MenuEntry {
  label?: string;           // '&File' marks F. '&&' is literal
  shortcut?: string;        // 'F3', 'Alt-X', 'Alt+F3'
  disabled?: boolean;
  separator?: boolean;
  action?: () => void;
  items?: MenuEntry[];      // a submenu, or the menu under a title
}

interface StatusHint {
  key: string;
  label: string;
  action?: () => void;
  global?: boolean;         // still runs while a dialog is open
  disabled?: boolean;
}

class MenuBar extends View {
  entries: MenuEntry[];
  top: number;              // highlighted title, or -1
  open: boolean;
  item: number;
  sub: number;
  locked: boolean;
  focusBar(): void;
  openHot(letter: string): boolean;
  close(): void;
}

class StatusLine extends View {
  hints: StatusHint[];
}
```

Alt plus a letter opens the matching title. A title with no items runs its action on Alt, Enter, or a click. Hovering that title does not run it. Arrow keys move. Enter or Space runs the highlighted row, or opens its submenu. Esc and a second F10 close the whole menu. Disabled rows and separators are skipped.

A shortcut runs only while the menu is closed and no dialog is open. The status line is consulted first, so a global `Alt-X` there wins over a menu item with the same shortcut.

## Widgets

```ts
class Button extends View {
  text: string;
  readonly closes: boolean;     // true when options had an own `result`
  readonly result: string | null;
  activate(): void;
}
interface ButtonOptions extends ViewOptions {
  text?: string;
  isDefault?: boolean;
  result?: string | null;
  onPress?: () => void;
}

class CheckBox extends View {
  text: string;
  checked: boolean;
  toggle(): void;
  setChecked(checked: boolean): void;
}

class RadioGroup extends View {
  items: string[];
  selected: number;
  select(index: number): void;
}

class InputLine extends View {
  value: string;
  caret: number;
  max: number;
  password: boolean;
  setValue(value: string, emit?: boolean): void;
}

class ListBox extends Group {
  items: string[];
  selected: number;
  scroll: number;
  readonly bar: ScrollBar;
  setItems(items: string[], selected?: number): void;
  select(index: number, emit?: boolean): void;
}

class ScrollBar extends View {
  orientation: 'vertical' | 'horizontal';
  min: number; max: number; value: number; page: number;
  setValue(value: number, emit?: boolean): void;
}

class ProgressBar extends View {
  value: number;
  max: number;
  showPercent: boolean;
}

class Label extends View {
  text: string;
  target: View | null;
  setText(text: string): void;
}

class StaticText extends View {
  text: string;
  setText(text: string): void;
}
```

Labels use `&` the same way menus do. A `Label` hotkey focuses `target` and calls `invoke`. Buttons press. Checkboxes toggle. Fields do nothing.

A button is `[ text ]` or `< text >`, four cells wider than the label. It arms on pointer down and runs on pointer up inside the button. `CheckBox` paints `[X]` or `[ ]`. `RadioGroup` paints one row per item, `(•)` or `(*)`, and is a single tab stop. Arrows wrap. A letter selects the item with that hotkey.

`InputLine` is one row. Left, Right, Home, End, Backspace, and Delete edit. Ctrl-A and Ctrl-E jump to the ends. A click places the caret. The focused caret is a reversed cell. `password` draws the theme's password glyph. The default `max` is 240 graphemes. Enter is not inserted.

`ListBox` draws its own single frame and a vertical scrollbar on the inner right column. Up and Down move the highlight. PageUp, PageDown, Home, and End move by a page or to an end. Enter and a second click within 400 ms call `onAccept`. The wheel scrolls.

`ScrollBar` is not a tab stop until `focusable` is set. The thumb, the arrows, and the track page all change `value`. `ProgressBar` fills from 0 to `max` and, when it is at least four cells wide, centers a percentage.

`StaticText` wraps on spaces and on newlines, and clips to its rectangle.

## Dialog helpers

```ts
type MessageButton =
  | string
  | { label: string; result?: string | null; isDefault?: boolean };

interface MessageOptions {
  title?: string;
  buttons?: MessageButton[];     // default ['&Ok']
}

function messageBox(app: Application, message: string, options?: MessageOptions): Promise<string | null>;
function confirm(app: Application, message: string, title?: string): Promise<boolean>;
```

A string button resolves to its label with `&` removed. The first button is the default unless one sets `isDefault`. The box is centered, movable, and closeable. `confirm` asks Yes and No and resolves true only when the result is `'yes'`. Esc, the close box, and No resolve false.

## Minimal scene

```js
import { Terminal, Utilities } from 'emoji-engine-2d';
import { Application, Button, Window } from 'emoji-engine-ui';

const term = new Terminal({ cols: 80, rows: 25, showCursor: false });
document.body.appendChild(Utilities.wrap(term, { title: 'Heath' }).wrap);

const app = new Application(term, { theme: 'borland' });
const heath = new Window({ title: 'Heath', x: 2, y: 1, w: 28, h: 8 });
heath.add(new Button({ x: 2, y: 2, text: '&Ok', onPress: () => app.beep() }));
app.desktop.add(heath);
app.run();
```

Replace the import of `Terminal` and `Utilities` with emoji-engine-3d and the same desk paints there. `examples/desk.js` is the larger heath used by `examples/play.html`.
