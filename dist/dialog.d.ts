import type { Application } from './app.js';
/** A button in `messageBox`. A string is the label, and the result is that label without `&`. */
export type MessageButton = string | {
    label: string;
    /** Closes the box with this value. Omit it to use the label text. */
    result?: string | null;
    isDefault?: boolean;
};
export interface MessageOptions {
    title?: string;
    /** Default is a single Ok button. The first button is the default unless one sets `isDefault`. */
    buttons?: MessageButton[];
}
/**
 * A modal message. The promise resolves to the pressed button's result.
 * Esc and the close box resolve null.
 */
export declare function messageBox(app: Application, message: string, options?: MessageOptions): Promise<string | null>;
/** Yes and No. Esc and the close box are a No. */
export declare function confirm(app: Application, message: string, title?: string): Promise<boolean>;
