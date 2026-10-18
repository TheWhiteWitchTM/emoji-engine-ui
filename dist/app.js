import { MenuBar, StatusLine, runMenuShortcut } from './menu.js';
import { Painter } from './painter.js';
import { copyTheme, theme } from './theme.js';
import { matchShortcut } from './text.js';
import { Desktop, Group } from './view.js';
import { Button, InputLine } from './widgets.js';
import { Dialog, Window } from './window.js';
/**
 * The desk. It paints into a terminal from either engine and never imports those packages.
 * Pass a `Terminal`. Call `run` in the browser, or `draw` and `press` under test.
 */
export class Application {
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
        if (!surface ||
            typeof surface.set !== 'function' ||
            typeof surface.get !== 'function' ||
            typeof surface.beginFrame !== 'function' ||
            typeof surface.endFrame !== 'function' ||
            !Number.isFinite(surface.cols) ||
            !Number.isFinite(surface.rows)) {
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
        this.theme = typeof next === 'string' ? theme(next) : copyTheme(next);
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
        }
        finally {
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
        if (event.repeat &&
            (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape' || event.key === 'F10' || event.alt)) {
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
        if (!modal && this.runMenuCommand(event))
            return true;
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
    pointer(event) {
        if (this.quitting)
            return false;
        if (event.kind === 'move') {
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
        if (event.kind === 'up') {
            if (!this.grabbed)
                return false;
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
        if (event.kind !== 'down')
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
        if (!win || typeof win.addEventListener !== 'function')
            return;
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
    destroy() {
        this.stop();
        if (!this.listening)
            return;
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
    run() {
        this.mount();
        this.draw();
        if (this.looping)
            return;
        const raf = globalThis.requestAnimationFrame;
        if (typeof raf !== 'function')
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
        if (this.frame && typeof cancel === 'function')
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
        if (typeof AudioCtor !== 'function')
            return;
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
        }
        catch {
            // No audio on this host.
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
        if (typeof this.surface.colorStyle === 'function')
            this.surface.colorStyle('ansi');
        if (typeof this.surface.background === 'function')
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
        const next = index < 0 ? (dir > 0 ? 0 : list.length - 1) : mod(index + dir, list.length);
        this.focus(list[next]);
    }
    cycleWindow(dir) {
        const windows = this.desktop.children.filter((child) => child instanceof Window && child.visible);
        if (windows.length === 0)
            return;
        const index = this.active ? windows.indexOf(this.active) : -1;
        const next = windows[mod((index < 0 ? 0 : index) + dir, windows.length)];
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
        if (!element || typeof element.getBoundingClientRect !== 'function')
            return null;
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0)
            return null;
        const col = Math.floor(((event.clientX - rect.left) / rect.width) * this.surface.cols);
        const row = Math.floor(((event.clientY - rect.top) / rect.height) * this.surface.rows);
        return { col, row };
    }
    onKeyDown = (event) => {
        const target = event.target;
        const tag = target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable)
            return;
        if (claimsKey(event))
            event.preventDefault();
        this.press({
            key: event.key,
            alt: event.altKey,
            ctrl: event.ctrlKey,
            shift: event.shiftKey,
            meta: event.metaKey,
            repeat: event.repeat,
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
        this.pointer({ col: cell.col, row: cell.row, kind: 'down', button: 0, delta: 0 });
    };
    onPointerMove = (event) => {
        if (!this.grabbed && !(this.menu.open && !this.menuLocked))
            return;
        const pointer = event;
        const cell = this.cellAt(pointer);
        if (!cell)
            return;
        this.pointer({ col: cell.col, row: cell.row, kind: 'move', button: pointer.button, delta: 0 });
    };
    onPointerUp = (event) => {
        if (!this.grabbed)
            return;
        const pointer = event;
        const cell = this.cellAt(pointer) ?? { col: -1, row: -1 };
        this.pointer({ col: cell.col, row: cell.row, kind: 'up', button: pointer.button, delta: 0 });
    };
    onWheel = (event) => {
        const wheel = event;
        const cell = this.cellAt(wheel);
        if (!cell)
            return;
        wheel.preventDefault();
        this.pointer({ col: cell.col, row: cell.row, kind: 'wheel', button: 0, delta: wheel.deltaY });
    };
}
function normalizeKey(input) {
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
function claimsKey(event) {
    if (event.altKey || event.key === 'Tab' || event.key === 'Escape' || event.key === ' ')
        return true;
    if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End')
        return true;
    if (event.key === 'PageUp' || event.key === 'PageDown')
        return true;
    if (event.key === 'F1' || event.key === 'F6' || event.key === 'F10')
        return true;
    return false;
}
function mod(value, length) {
    if (length <= 0)
        return 0;
    return ((value % length) + length) % length;
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
//# sourceMappingURL=app.js.map