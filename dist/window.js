import { DOUBLE, SINGLE, drawFrame, drawShadow } from './painter.js';
import { clamp } from './text.js';
import { Group } from './view.js';
/**
 * A framed window on the desktop.
 * Children are placed in window coordinates. Column 0 and row 0 are the frame,
 * so the first interior cell is `(1, 1)`.
 */
export class Window extends Group {
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
            h: options.h ?? 8,
        });
        this.title = options.title ?? '';
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
        const theme = g.theme;
        const glyphs = active && theme.frame === 'double' ? DOUBLE : SINGLE;
        const ink = active ? theme.window : theme.windowInactive;
        const titleInk = active ? theme.windowTitle : theme.windowTitleInactive;
        drawFrame(g, rect, {
            glyphs,
            ink,
            titleInk,
            title: this.title,
            close: this.closeable ? theme.closeGlyph : null,
            zoom: this.zoomable ? (this.zoomed ? theme.unzoomGlyph : theme.zoomGlyph) : null,
            body: theme.windowBody,
        });
        drawShadow(g, rect, theme.shadowGlyph, theme.windowShadow);
        const interior = { x: rect.x + 1, y: rect.y + 1, w: Math.max(0, rect.w - 2), h: Math.max(0, rect.h - 2) };
        g.withClip(interior, () => {
            for (const child of this.children) {
                if (child.visible)
                    child.paint(g);
            }
        });
    }
    mouse(event) {
        if (!this.visible || this.disabled || event.kind !== 'down' || event.button !== 0)
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
            up: () => { },
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
            up: () => { },
        });
    }
}
/**
 * A modal window. `close` ends it with a result.
 * Pass it to `Application.modal`. Esc and the close box cancel with null.
 */
export class Dialog extends Window {
    onResult;
    constructor(options = {}) {
        super({
            ...options,
            zoomable: options.zoomable ?? false,
            resizable: options.resizable ?? false,
            closeable: options.closeable ?? true,
            movable: options.movable ?? true,
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
}
//# sourceMappingURL=window.js.map