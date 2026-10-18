/**
 * The heath desk used by the demo and by examples/play.html.
 * `api` is the emoji-engine-ui module. The surface is a terminal from either engine.
 */
export function mountDesk(api, surface, hooks = {}) {
  const menu = [];
  const status = [];
  const app = new api.Application(surface, {
    theme: hooks.theme ?? 'borland',
    menu,
    status,
    sound: hooks.sound !== false,
    beep: hooks.beep,
    onQuit: hooks.onQuit,
  });

  const rings = { count: 0 };
  const bag = { made: 0, opened: '' };

  const heath = new api.Window({
    title: 'Heath',
    x: 2,
    y: 1,
    w: 32,
    h: 11,
    resizable: true,
  });
  const tally = new api.StaticText({
    x: 2,
    y: 2,
    w: 28,
    h: 1,
    text: 'The heath is quiet.',
  });
  const ring = new api.Button({
    x: 2,
    y: 4,
    text: '&Ring',
    onPress: () => {
      rings.count += 1;
      tally.setText(rings.count === 1 ? 'One ring on the heath.' : `${rings.count} rings on the heath.`);
    },
  });
  heath.add(tally);
  heath.add(new api.StaticText({ x: 2, y: 6, w: 28, h: 1, text: 'A hunter waits on the path.' }));
  heath.add(ring);

  const note = new api.Window({ title: 'Note', x: 38, y: 3, w: 30, h: 10 });
  note.add(new api.StaticText({
    x: 2,
    y: 2,
    w: 26,
    h: 6,
    text: 'F10 opens the menu.\nAlt and a letter jumps.\nTab moves. Enter accepts.\nSpace presses a button.',
  }));

  const bar = new api.ProgressBar({ x: 2, y: 3, w: 32, value: 0, max: 100 });
  const step = new api.Button({
    x: 2,
    y: 5,
    text: '&Step',
    onPress: () => {
      bar.value = Math.min(bar.max, bar.value + 25);
    },
  });
  const hour = new api.ScrollBar({
    x: 2,
    y: 7,
    w: 32,
    h: 1,
    orientation: 'horizontal',
    min: 0,
    max: 23,
    value: 6,
  });
  hour.focusable = true;
  const journey = new api.Window({ title: 'Journey', x: 8, y: 12, w: 40, h: 9 });
  journey.add(new api.StaticText({ x: 2, y: 1, w: 20, h: 1, text: 'The road ahead' }));
  journey.add(bar);
  journey.add(step);
  journey.add(hour);

  const settings = new api.Dialog({
    title: 'Settings',
    x: 8,
    y: 1,
    w: 48,
    h: 18,
    center: true,
  });
  const name = new api.InputLine({ x: 14, y: 2, w: 28, value: '' });
  const sound = new api.CheckBox({
    x: 2,
    y: 4,
    text: '&Sound',
    checked: app.sound,
    onChange: (checked) => {
      app.sound = checked;
    },
  });
  const pace = new api.RadioGroup({
    x: 2,
    y: 6,
    items: ['&Walk', '&Run', '&Fly'],
    selected: 0,
  });
  const companions = new api.ListBox({
    x: 18,
    y: 6,
    w: 26,
    h: 8,
    items: ['Witch', 'Hunter', 'Cat', 'Hare', 'Crow', 'Toad'],
    selected: 0,
  });
  settings.add(new api.Label({ x: 2, y: 2, text: '&Name', target: name }));
  settings.add(name);
  settings.add(sound);
  settings.add(new api.Label({ x: 2, y: 5, text: '&Pace', target: pace }));
  settings.add(pace);
  settings.add(new api.Label({ x: 18, y: 5, text: '&Companions', target: companions }));
  settings.add(companions);
  settings.add(new api.Button({ x: 12, y: 16, text: '&Ok', isDefault: true, result: 'ok' }));
  settings.add(new api.Button({ x: 22, y: 16, text: '&Cancel', result: null }));

  const borlandEntry = { label: '✓ &Borland', action: () => setTheme('borland') };
  const linuxEntry = { label: '  &Linux', action: () => setTheme('linux') };

  function setTheme(next) {
    app.setTheme(next);
    borlandEntry.label = next === 'borland' ? '✓ &Borland' : '  &Borland';
    linuxEntry.label = next === 'linux' ? '✓ &Linux' : '  &Linux';
    hooks.onTheme?.(next);
    app.draw();
  }

  function showHeath() {
    heath.visible = true;
    if (heath.parent !== app.desktop) app.desktop.add(heath);
    else app.desktop.raise(heath);
    app.focus(ring);
    app.draw();
  }

  function fresh() {
    bag.made += 1;
    rings.count = 0;
    tally.setText('A new morning on the heath.');
    showHeath();
  }

  menu.push(
    {
      label: '&File',
      items: [
        { label: '&New', action: fresh },
        { label: '&Save', disabled: true },
        {
          label: '&Open',
          items: [
            { label: '&Heath', action: () => { bag.opened = 'heath'; showHeath(); } },
            {
              label: '&Note',
              action: () => {
                bag.opened = 'note';
                note.visible = true;
                if (note.parent !== app.desktop) app.desktop.add(note);
                else app.desktop.raise(note);
                app.draw();
              },
            },
          ],
        },
        { separator: true },
        { label: 'E&xit', shortcut: 'Alt-X', action: () => app.quit() },
      ],
    },
    { label: '&View', items: [borlandEntry, linuxEntry] },
    {
      label: '&Window',
      items: [
        { label: '&Settings', action: () => { void app.modal(settings); } },
        { label: '&Progress', action: () => openProgress() },
        {
          label: '&Message',
          action: () => { void api.messageBox(app, 'The hare crossed the path.', { title: 'Heath' }); },
        },
        {
          label: '&Confirm',
          action: () => { void api.confirm(app, 'Leave the heath?'); },
        },
        { separator: true },
        { label: '&Close', shortcut: 'Alt-F3', action: () => closeActive() },
      ],
    },
    {
      label: '&Help',
      items: [
        {
          label: '&Keys',
          action: () => {
            void api.messageBox(app, [
              'F10 opens the menu. Alt and a letter opens one too.',
              'Tab moves. Arrows stay inside a list, a radio group, or a field.',
              'Enter presses the default button. Space presses the cursor.',
              'F6 cycles windows. Esc cancels a dialog.',
            ].join(' '), { title: 'Keys' });
          },
        },
        {
          label: '&About',
          action: () => {
            void api.messageBox(app, 'emoji-engine-ui. One desk for both engines, Borland and Linux.', { title: 'About' });
          },
        },
      ],
    },
  );

  status.push(
    {
      key: 'F1',
      label: 'Help',
      global: true,
      action: () => { void api.messageBox(app, 'F10 menu. Alt-X quits. Esc cancels.', { title: 'Help' }); },
    },
    { key: 'F10', label: 'Menu' },
    { key: 'Alt-X', label: 'Exit', global: true, action: () => app.quit() },
  );

  function openProgress() {
    journey.visible = true;
    if (journey.parent !== app.desktop) app.desktop.add(journey);
    else app.desktop.raise(journey);
    app.focus(step);
    app.draw();
  }

  function closeActive() {
    const view = app.activeView();
    if (view && view.parent === app.desktop && typeof view.close === 'function') view.close();
    app.draw();
  }

  app.desktop.add(heath);
  app.desktop.add(note);
  setTheme(app.theme.name);

  return {
    app,
    heath,
    note,
    journey,
    ring,
    rings,
    tally,
    bar,
    step,
    hour,
    settings,
    name,
    sound,
    pace,
    companions,
    bag,
    setTheme,
    openSettings: () => app.modal(settings),
    openProgress,
    closeActive,
  };
}
