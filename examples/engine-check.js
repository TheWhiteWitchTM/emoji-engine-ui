/**
 * Paint a small Borland menu on one real engine terminal.
 * Run: node examples/engine-check.js 2d
 *      node examples/engine-check.js 3d
 * Shims install before the engine module loads. The process exits so a frame loop cannot linger.
 */
const which = process.argv[2];
if (which !== '2d' && which !== '3d') {
  console.error('usage: node examples/engine-check.js 2d|3d');
  process.exit(1);
}

const engineRoot = new URL(`../../emoji-engine-${which}/`, import.meta.url);
const { installHostShims } = await import(new URL('examples/dom-shim.js', engineRoot));
installHostShims();
const { Terminal } = await import(new URL('dist/index.js', engineRoot));
const { Application } = await import('../dist/index.js');

const term = new Terminal({
  cols: 70,
  rows: 22,
  cellWidth: 8,
  cellHeight: 12,
  showCursor: false,
});
const app = new Application(term, {
  theme: 'borland',
  menu: [
    {
      label: '&File',
      items: [
        { label: '&New', action() {} },
        { label: 'E&xit', shortcut: 'Alt-X', action() { app.quit(); } },
      ],
    },
  ],
  status: [{ key: 'Alt-X', label: 'Exit', global: true, action() { app.quit(); } }],
});
app.draw();

const file = term.get(1, 0);
if (file.ch !== 'F' || file.bg !== 6) fail(`menu cell ${file.ch} bg ${file.bg}`);
const desk = term.get(0, 1);
if (desk.ch !== '░' || desk.fg !== 6 || desk.bg !== 4) fail(`desk cell ${desk.ch} fg ${desk.fg} bg ${desk.bg}`);

app.press({ key: 'f', alt: true });
if (!screen().includes('New')) fail('Alt+f did not show New');

console.log(`${which} ok`);
app.stop();
process.exit(0);

function screen() {
  const lines = [];
  for (let row = 0; row < term.rows; row += 1) {
    let text = '';
    for (let col = 0; col < term.cols; col += 1) text += term.get(col, row).ch || ' ';
    lines.push(text);
  }
  return lines.join('\n');
}

function fail(message) {
  console.error(message);
  console.error(screen());
  process.exit(1);
}
