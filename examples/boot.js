/**
 * Browser entry for examples/play.html.
 * The engine script and browser/emoji-engine-ui.js are loaded first.
 */
import { mountDesk } from './desk.js';

const which = new URLSearchParams(location.search).get('engine') === '3d' ? '3d' : '2d';
const engineApi = which === '3d' ? globalThis.EmojiEngine3D : globalThis.EmojiEngine;
const ui = globalThis.EmojiEngineUI;

if (!engineApi?.Terminal || !engineApi?.Utilities || !ui?.Application) {
  const note = document.createElement('p');
  note.textContent = 'Missing a script build. From each project, run npm run build. Serve the parent of the three folders.';
  document.body.appendChild(note);
} else {
  const { Terminal, Utilities } = engineApi;
  const term = new Terminal({
    cols: 80,
    rows: 25,
    cellWidth: 12,
    cellHeight: 20,
    showCursor: false,
  });
  const chrome = Utilities.wrap(term, { title: which === '3d' ? 'Heath Desk · 3D' : 'Heath Desk' });
  document.body.appendChild(chrome.wrap);
  const desk = mountDesk(ui, term, {
    onTheme(name) {
      if (chrome.headerMiddle) chrome.headerMiddle.textContent = name;
      if (chrome.footer) {
        chrome.footer.textContent = `${name} · F10 menu · Tab and arrows · Enter accepts · Space presses · Alt-X quits`;
      }
    },
  });
  desk.app.run();
  document.body.dataset.ee = 'desk';
}
