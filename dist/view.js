/**
 * A rectangle on the desk. `x` and `y` are columns and rows inside the parent.
 * A window's children count the frame, so the first interior cell is `(1, 1)`.
 */
export class View {
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
    paint(_g) { }
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
    invoke() { }
    /** The desk moved the keyboard cursor here. */
    focus() { }
    /** The keyboard cursor left. */
    blur() { }
}
/** A view that owns other views. Tab order is child order. */
export class Group extends View {
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
        if (view instanceof Group)
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
        if (view instanceof Group)
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
            if (child instanceof Group)
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
            if (view instanceof Group) {
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
}
/** The patterned field under the windows. The application sizes it. */
export class Desktop extends Group {
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
}
//# sourceMappingURL=view.js.map