import type { Application } from './app.js';
import { graphemeLength, parseLabel, wrapText } from './text.js';
import { Button, StaticText } from './widgets.js';
import { Dialog } from './window.js';

/** A button in `messageBox`. A string is the label, and the result is that label without `&`. */
export type MessageButton =
  | string
  | {
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
export function messageBox(
  app: Application,
  message: string,
  options: MessageOptions = {},
): Promise<string | null> {
  const specs = (options.buttons ?? ['&Ok']).map((button) => {
    if (typeof button === 'string') return { label: button, result: undefined as string | null | undefined, isDefault: false };
    return { label: button.label, result: button.result, isDefault: !!button.isDefault };
  });
  if (!specs.some((spec) => spec.isDefault) && specs.length > 0) specs[0].isDefault = true;

  const area = app.workArea();
  const maxInner = Math.max(8, Math.min(52, Math.max(8, area.w - 4)));
  const title = options.title ?? 'Message';
  const buttons = specs.map(
    (spec) =>
      new Button({
        text: spec.label,
        isDefault: spec.isDefault,
        result: spec.result !== undefined ? spec.result : parseLabel(spec.label).text,
      }),
  );
  const gap = 2;
  const buttonsW = buttons.reduce((sum, button) => sum + button.w, 0) + gap * Math.max(0, buttons.length - 1);
  const lines = wrapText(message, maxInner);
  const textW = lines.reduce((wide, line) => Math.max(wide, graphemeLength(line)), 0);
  const inner = Math.max(textW, buttonsW, graphemeLength(title) + 2, 12);
  const w = Math.max(8, Math.min(area.w || inner + 2, inner + 2));
  const textWidth = Math.max(1, w - 4);
  const wrapped = wrapText(message, textWidth);
  const textH = Math.max(1, Math.min(wrapped.length, Math.max(1, (area.h || 8) - 4)));
  const h = Math.max(5, Math.min(area.h || textH + 4, textH + 4));
  const dialog = new Dialog({
    w,
    h,
    title,
    center: true,
    closeable: true,
    movable: true,
  });
  dialog.add(new StaticText({ x: 2, y: 1, w: textWidth, h: Math.max(1, h - 4), text: wrapped.join('\n') }));
  let x = 1 + Math.max(0, Math.floor((w - 2 - buttonsW) / 2));
  const y = h - 2;
  for (const button of buttons) {
    button.x = x;
    button.y = y;
    dialog.add(button);
    x += button.w + gap;
  }
  return app.modal(dialog);
}

/** Yes and No. Esc and the close box are a No. */
export function confirm(app: Application, message: string, title = 'Confirm'): Promise<boolean> {
  return messageBox(app, message, {
    title,
    buttons: [
      { label: '&Yes', result: 'yes', isDefault: true },
      { label: '&No', result: 'no' },
    ],
  }).then((result) => result === 'yes');
}
