import type { Painter } from './painter.js';
import type { CellPointer } from './surface.js';
import { Group } from './view.js';
import type { ViewOptions } from './view.js';
export interface WindowOptions extends ViewOptions {
    title?: string;
    /** `■` or `×` on the top edge. Default true. */
    closeable?: boolean;
    /** Fill the desktop, or restore. Default true for windows, false for dialogs. */
    zoomable?: boolean;
    /** Drag the top edge. Default true. */
    movable?: boolean;
    /** Drag the bottom-right corner. Default false. */
    resizable?: boolean;
    /** `modal` recenters the dialog in the desktop each time it opens. */
    center?: boolean;
    onClose?: () => void;
}
/**
 * A framed window on the desktop.
 * Children are placed in window coordinates. Column 0 and row 0 are the frame,
 * so the first interior cell is `(1, 1)`.
 */
export declare class Window extends Group {
    title: string;
    closeable: boolean;
    zoomable: boolean;
    movable: boolean;
    resizable: boolean;
    center: boolean;
    onClose: (() => void) | null;
    private zoomed;
    private saved;
    constructor(options?: WindowOptions);
    /** True when this window is the modal dialog, or the front window. */
    isActive(): boolean;
    paint(g: Painter): void;
    mouse(event: CellPointer): boolean;
    /** Hide a window. A dialog cancels instead. */
    close(): void;
    requestClose(): void;
    toggleZoom(): void;
    /** Keep the frame inside the desktop and at least large enough for a title. */
    clamp(): void;
    private startMove;
    private startResize;
}
export interface DialogOptions extends WindowOptions {
    onResult?: (result: string | null) => void;
}
/**
 * A modal window. `close` ends it with a result.
 * Pass it to `Application.modal`. Esc and the close box cancel with null.
 */
export declare class Dialog extends Window {
    onResult: ((result: string | null) => void) | null;
    constructor(options?: DialogOptions);
    /** End the dialog. `null` cancels. */
    close(result?: string | null): void;
    requestClose(): void;
}
