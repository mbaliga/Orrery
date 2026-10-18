/* settings: one place for everything you can change, moved through like a console menu.
   Arrows or a controller's pad move between rows, left and right change a value, Enter or A acts, Escape or B goes
   back, Q and E or the bumpers change section. A mouse and touch work as you would expect. */
(function () {
  'use strict';
  var T = window.T, S = T.S, el = T.el;
  var X = { open: false, tab: 0, focus: 0, rows: [], ret: null, pad: { raf: 0, held: {}, next: {}, on: false } };
  var box, tabsEl, listEl, sideEl, bodyEl, hiEl, padHint;

  function C() { return T.canopy; }
  function store(k, d) { return T.store.get(k, d); }
  function modelStatus() { return typeof self.LanguageModel === 'undefined' ? 'Not in this browser' : 'Present in this browser'; }

  var TABS = [
    { id: 'display', name: 'Display', rows: function () {
      return [
        { id: 'view', label: 'View', kind: 'choice', options: [['flat', 'Flat'], ['depth', 'Depth']],
          get: function () { return T.canopyDepth() ? 'depth' : 'flat'; }, set: function (v) { T.setDepth(v === 'depth'); },
          about: 'Flat draws the chord face on, with the time strip under it on the ultrawide. Depth is the orrery and the flight path in three dimensions, drawn for your curve. D switches between them anywhere.' },
        { id: 'field', label: 'Background', kind: 'swatch',
          get: function () { return T.fieldHex(); }, set: function (v) { var c = T.setField(v); if (c) T.toast('Kept darker, so the writing stays readable.'); },
          about: function () {
            var f = T.FIELDS.filter(function (x) { return x[0] === T.fieldHex(); })[0];
            return (f ? f[1] + '. ' + f[2] : 'Your own colour.') + ' Any colour you pick is kept dark enough for the light writing to read; a light theme is a separate design.';
          } },
        { id: 'beam', label: 'Sunbeam', kind: 'toggle', get: function () { return T.beamOn(); }, set: function (v) { T.setBeam(v); },
          about: function () {
            var i = T.beamInfo(), t = i.sun;
            var c = T.ceiling();
            return 'Light through leaves, across the whole page, that follows the sky: the sun by day, from the left in the morning and the right in the evening; the moon by night, cool and as bright as it is full; on a moonless night only the stars, which come up a little. Cloud, when the weather is on, takes the shafts apart. The pattern of shafts and shadows is set by the day. Right now: ' + (c.kind === 'sun' ? 'the sun is up' : c.kind === 'moon' ? 'the moon is out, ' + Math.round(c.moon.illum * 100) + '% lit' : c.kind === 'overcast' ? 'overcast' : 'a starlit sky') + (c.sun.fromClock ? ', placed by the clock; set a place under Weather to place it by the sky' : '') + '. Each mote of dust in it is a commit from the last seven days of the scan, ' + T.int(i.count) + (i.count > i.shown ? ', the newest ' + T.int(i.shown) + ' drawn' : '') + ', radium for yours and cyan for an agent’s. ' +
              (t == null ? '' : ' It comes from the ' + (t < 0.4 ? 'left' : t > 0.6 ? 'right' : 'top') + '.') + ' Kept faint on the OLED panel, an aesthetic touch that never competes with the writing; it costs about a millisecond a frame.';
          } },
        { id: 'wx', label: 'Weather', kind: 'toggle', get: function () { return T.weather().on; }, set: function (v) { T.setWeather(v); },
          about: function () { var w = T.weather(); return 'A glyph and the temperature beside the clock, and the ceiling follows it: cloud takes the light apart, an overcast sky leaves an even glow. Asked of open-meteo.com every half hour with your place’s coordinates only — no key, no account, nothing else sent. A watched object: it is the one thing on this page that talks to a server, and it is off until you turn it on.' + (w.on && !w.place ? ' Set a place below.' : '') + (w.last ? ' Last asked ' + T.ago(w.last.at) + ' ago.' : ''); } },
        { id: 'wxPlace', label: 'Place', kind: 'text', placeholder: 'A town or city', get: function () { return T.weather().place; }, set: function (v) { T.setWeatherPlace(v); },
          about: 'A town or city. It is looked up once through open-meteo’s geocoder and only the coordinates are kept, which also place the sun and the moon by the real sky instead of by the clock.' },
        { id: 'beamMove', label: 'Light moves', kind: 'toggle', get: function () { return T.store.get('beamMove', true); }, set: function (v) { T.store.set('beamMove', !!v); },
          about: 'Four layers of shafts, each on its own tempo: they sway, brighten and thin, a gap opens here as one closes there, as foliage moves in a breeze. Off, the light holds still and only turns with the sun. Honours a reduced-motion setting either way.' },
        { id: 'beamBreathe', label: 'Light breathes', kind: 'toggle', get: function () { return T.store.get('beamBreathe', false); }, set: function (v) { T.setBreathe(v); },
          about: 'Every glow on the page — the light, the stars, the halos in the sky, the marks that glow in the wings — swells and fades together at a resting breath, six to the minute: something to breathe with when the room is still. Calm computing, not a notification.' },
        { id: 'beamGain', label: 'Sunbeam strength', kind: 'range', min: 25, max: 400, step: 25, unit: '%', get: function () { return Math.round((T.store.get('beamGain', 1) || 1) * 100); }, set: function (v) { T.setBeamGain(v / 100); },
          about: 'How bright the light is. The default is kept faint for an OLED panel; raise it on a bright room’s monitor.' },
        { id: 'torch', label: 'Torch', kind: 'toggle', get: function () { return T.torchOn(); }, set: function (v) { T.setTorch(v); },
          about: 'A soft light around the pointer. Names the chord had no room for appear inside it, so you can sweep it across to read everything. Only with a mouse.' },
        { id: 'colour', label: 'Colour', kind: 'choice', options: [['brands', 'Brands'], ['bands', 'By kind'], ['mono', 'Ink only']],
          get: function () { return T.look.colour; }, set: function (v) { T.setColourScheme(v); },
          about: 'Brands: a language, library or platform wears its own colour, so Python, Kotlin or React read at a glance. By kind: one hue for each band of the chord. Ink only: the monochrome field. Projects and agents keep their colours in every scheme.' },
        { id: 'logos', label: 'Brand marks', kind: 'toggle', get: function () { return T.look.logos; }, set: function (v) { T.setLogos(v); },
          about: 'The marks of languages, libraries and platforms beside their names, drawn from the simple-icons set (CC0 paths; each mark belongs to its owner). They are here to identify, never as ornament; off hides them everywhere.' },
        { id: 'scale', label: 'Interface scale', kind: 'range', min: 60, max: 180, step: 5, unit: '%', get: function () { return Math.round(T.ui.scale * 100); }, set: function (v) { T.setUiScale(v / 100); },
          about: 'Everything grows or shrinks together: type, marks, spacing, the chord. On the ultrawide the base size already follows the panel; this multiplies it. Keys: + and − anywhere, shift-0 resets.' },
        { id: 'text', label: 'Text size', kind: 'range', min: 75, max: 150, step: 5, unit: '%', get: function () { return Math.round(T.ui.text * 100); }, set: function (v) { T.setTextScale(v / 100); },
          about: 'Only the words, without moving the layout: labels, captions, the rows. Use it when the marks are right but the type is small.' },
        { id: 'sfx', label: 'Sounds', kind: 'toggle', get: function () { return T.sfxOn(); }, set: function (v) { T.setSfx(v); },
          about: 'Short tones made on this device as you move through menus, choose, open and finish things: a blip for a move, two notes up for a choice, a short rising figure when something is done. Nothing is loaded; a few oscillators make them.' },
        { id: 'sfxVol', label: 'Sound level', kind: 'range', min: 0, max: 100, step: 5, unit: '%', get: function () { return T.sfxVol(); }, set: function (v) { T.setSfxVol(v); },
          about: 'How loud the interface tones are. The focus sounds have their own volume in the Focus module.' },
        { id: 'motion', label: 'Motion', kind: 'choice', options: [['on', 'Sway'], ['off', 'Still']],
          get: function () { return C().drift ? 'on' : 'off'; }, set: function (v) { T.canopySet('drift', v === 'on'); if (T.pixelShift) T.pixelShift(true); },
          about: 'Sway turns the chord about two degrees over four minutes and shifts the view a pixel or two every few minutes, so nothing bright sits still on an OLED panel. Still keeps everything in place.' },
        { id: 'curve', label: 'Curve, in Depth', kind: 'choice', options: [['auto', 'Auto'], ['1000', '1000R'], ['1800', '1800R'], ['flat', 'Flat']],
          get: function () { return C().curve; }, set: function (v) { T.canopySet('curve', v); },
          about: 'Depth traces every ray from your eye to where it meets a curved panel. Your G9 is 1800R; Auto uses 1800R on an ultrawide and plain perspective elsewhere.' },
        { id: 'eye', label: 'Your eyes to the screen', kind: 'range', min: 500, max: 2000, step: 50, unit: ' mm',
          get: function () { return Math.round((C().eye || 0.8) * 1000); }, set: function (v) { T.canopySet('eye', v / 1000); },
          about: 'How far you sit from the panel, for Depth on a curve. 800 mm is where most people sit from a 49-inch screen.' }
      ];
    } },
    { id: 'lean', name: 'Lean back', rows: function () {
      return [
        { id: 'away', label: 'When you step away', kind: 'choice', options: [['sky', 'Lean back'], ['dim', 'Dim']],
          get: function () { return store('away', 'sky'); }, set: function (v) { T.store.set('away', v); },
          about: 'On the ultrawide, after five minutes without you, the cockpit becomes the sky, or the instruments just dim. Any touch of the mouse or a key brings it back.' },
        { id: 'leanNow', label: 'Lean back now', kind: 'action', run: function () { close(); T.leanBack(false); },
          about: 'The sky: every project a constellation through the modules it uses, and one thing at a time rising to the surface. L does the same.' }
      ];
    } },
    { id: 'rhythm', name: 'Rhythm', rows: function () {
      var R = T.routine, WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], rows = [];
      rows.push({ id: 'slot', label: 'One slot', kind: 'range', min: 25, max: 90, step: 5, unit: ' min', get: function () { return R.slotMin; }, set: function (v) { T.setRoutine({ slotMin: v }); },
        about: 'A slot is one block of attention; the plan counts days in slots, not hours.' });
      rows.push({ id: 'start', label: 'The day starts', kind: 'range', min: 0, max: 12, step: 1, unit: ':00', get: function () { return R.dayStart; }, set: function (v) { T.setRoutine({ dayStart: v }); },
        about: 'Work before this hour belongs to the day before. The record put your quietest hours before ' + T.pad(T.routineDefault('dayStart')) + ':00, so that is the default.' });
      WD.forEach(function (d, i) {
        rows.push({ id: 'cap' + i, label: d, kind: 'range', min: 0, max: 6, step: 0.5, unit: ' slots', get: function () { return R.cap[i]; },
          set: function (v) { var c = R.cap.slice(); c[i] = v; T.setRoutine({ cap: c }); },
          about: i === 0 ? (R.capSource === 'commits' ? 'Read from your own commits by weekday since May: three slots on your two heaviest days, one on the lightest, two elsewhere. Move any slider to overrule it.' : 'Set by you. "Back to the record" below restores what your commits say.') : null });
      });
      rows.push({ id: 'vel', label: 'Planned against done', kind: 'info', value: function () { return T.velocity().basis; },
        about: 'Each day the plan writes down how many slots it laid out; each task you finish adds its size. After three such days the plan scales itself to the ratio, between a half and one and a quarter.' });
      rows.push({ id: 'rreset', label: 'Back to the record', kind: 'action', run: function () { T.resetRoutine(); paint(); T.toast('Routine read from your commits again.'); },
        about: 'Drops your changes and reads the slots, the day start and the window from the commit record again.' });
      return rows;
    } },
    { id: 'body', name: 'Body', rows: function () {
      return [
        { id: 'bopen', label: 'Open Body', kind: 'action', run: function () { close(); if (T.openBody) T.openBody(); },
          about: 'Sessions as their segments, the body map, sitting, and the breaks that answer it. B does the same.' },
        { id: 'bsore', label: 'Clear every sore region', kind: 'action', run: function () { Object.keys(T.body).forEach(function (k) { delete T.body[k]; }); T.store.set('body', T.body); T.emit('body'); T.toast('Cleared.'); },
          about: 'Each region clears on its own after you tap it round to nothing; this clears them all at once.' },
        { id: 'bsample', label: 'Remove the sample session', kind: 'action', run: function () { T.sessions = T.sessions.filter(function (x) { return !x.sample; }); T.store.set('sessions', T.sessions); T.emit('activity'); T.toast('Removed. Log your own in Body.'); },
          about: 'One fencing class is shown as a sample until you log a session of your own.' },
        { id: 'bwhere', label: 'Where it is kept', kind: 'info', value: 'This device only',
          about: 'Check-ins, sessions and the body map never leave this browser. In the build they live in the workspace\u2019s local/ folder, ignored by git, and sync only if you turn that on, encrypted to your own key. Mobility ideas are general, not medical advice.' }
      ];
    } },
    { id: 'connect', name: 'Connectors', rows: function () {
      return [
        { id: 'github', label: 'GitHub', kind: 'connector', status: 'A scan, no token',
          about: 'The board, issues and pull requests, read and written with one fine-grained token that you hold. This page reads a scan of 27 repos, taken on 6 October.' },
        { id: 'gitea', label: 'Gitea or Forgejo', kind: 'connector', status: 'Not set up',
          about: 'Your own git server on one of the laptops: the art direction boards, and anything that should stay off GitHub. A read-only token is enough.' },
        { id: 'asom', label: 'ASOM', kind: 'connector', status: 'In the build',
          about: 'Your on-device model router, at 127.0.0.1:11435. Ask sends it what it cannot answer from your data. Nothing leaves the device.' },
        { id: 'chromeai', label: 'Browser model', kind: 'connector', status: modelStatus(),
          about: 'Chrome’s built-in model, which Ask uses when ASOM is not running. On the desktop it needs 22 GB free and a GPU with more than 4 GB, or 16 GB of memory.' },
        { id: 'mw75', label: 'MW75 Neuro', kind: 'connector', status: 'Sample data',
          about: 'The headset bridge runs on the phone and streams to Baseline on your network. Until it is connected, the signal and the after-block numbers are samples.' },
        { id: 'ntfy', label: 'Reminders', kind: 'connector', status: 'In the build',
          about: 'Each rung of the nudge ladder sent to your phone with ntfy, from your own server, with nothing open.' },
        { id: 'cal', label: 'Calendar', kind: 'connector', status: 'In the build',
          about: 'Dates from a calendar feed join the strip and the year.' },
        { id: 'play', label: 'Play Console', kind: 'connector', status: function () { return T.CONNECTORS.play.on ? 'Connected' : 'Not connected'; },
          about: 'Fills the Google Play steps in Releases: tracks and their release status, the listing’s fields and images, per app. ' + T.CONNECTORS.play.how },
        { id: 'asc', label: 'App Store Connect', kind: 'connector', status: function () { return T.CONNECTORS.asc.on ? 'Connected' : 'Not connected'; },
          about: 'Fills the App Store steps in Releases: each version’s state, builds and TestFlight. ' + T.CONNECTORS.asc.how },
        { id: 'gitlab', label: 'F-Droid', kind: 'connector', status: function () { return T.CONNECTORS.gitlab.on ? 'Connected' : 'Not connected'; },
          about: T.CONNECTORS.gitlab.how },
        { id: 'ghrel', label: 'GitHub releases and fonts', kind: 'connector', status: function () { return T.CONNECTORS.github.on ? 'Connected' : 'Not connected'; },
          about: T.CONNECTORS.github.how }
      ];
    } },
    { id: 'ask', name: 'Ask', rows: function () {
      return [
        { id: 'voice', label: 'Voice', kind: 'toggle', get: function () { return store('voice', true); }, set: function (v) { T.store.set('voice', v); T.emit('voice', v); },
          about: 'The microphone in Ask, where the browser allows one. The words are turned into text by the device’s own speech recognition.' },
        { id: 'keep', label: 'Keep what Ask cannot place', kind: 'toggle', get: function () { return store('askKeep', true); }, set: function (v) { T.store.set('askKeep', v); },
          about: 'Anything you type that matches nothing is offered as a note, so a passing thought is never lost.' },
        { id: 'model', label: 'On-device model', kind: 'info', value: modelStatus(),
          about: 'Questions Ask cannot answer from your data go to ASOM, or to the browser’s own model. Nothing goes to a server.' }
      ];
    } },
    { id: 'brand', name: 'Make it yours', rows: function () {
      return [
        { id: 'bname', label: 'Name', kind: 'text', placeholder: 'Orrery', get: function () { return T.brand.name || ''; }, set: function (v) { T.setBrand({ name: v }); },
          about: 'Your name where Orrery’s is: in the corner, the window title, Ask and the notes on how it is wired.' },
        { id: 'blogo', label: 'Logo', kind: 'file', accept: 'image/svg+xml,image/png,image/webp,image/jpeg', get: function () { return T.brand.logo; },
          set: function (v) { T.setBrand({ logo: v }); },
          about: 'An SVG or a PNG, square, up to 300 KB. It sits where the orrery mark is, at the size of the name beside it. It is kept on this device.' },
        { id: 'breset', label: 'Back to Orrery', kind: 'action', run: function () { T.setBrand({ name: '', logo: '' }); paint(); T.toast('Back to Orrery.'); },
          about: 'Clears your name and logo.' },
        { id: 'friends', label: 'Friends of asoc', kind: 'info', value: 'In the release',
          about: 'In the public release, keeping your own name and logo is a thank-you for joining Friends of asoc, by a donation or a yearly membership. The key arrives by email and is checked on this device. Anyone who forks the code can rename it anyway; the membership is support, not a lock.' }
      ];
    } },
    { id: 'data', name: 'Data', rows: function () {
      return [
        { id: 'visitor', label: 'What a visitor sees', kind: 'action', run: function () { close(); if (T.visitorView) T.visitorView(true); },
          about: 'The free view, for anyone who opens it without paying: your apps as one constellation, each joined to the others through the modules they share, and each opening its own page. It is read-only, needs no sign-in and counts nothing, so it shows no commits, tasks, notes or dates. An app appears once its repo is public or it is live; the rest stay out until you announce them.' },
        { id: 'export', label: 'Export your notes', kind: 'action', run: exportNotes, about: 'Your notes as a JSON file, with their places, shelves, ties and the links the compiler made.' },
        { id: 'exportr', label: 'Export check-ins, sessions and the body map', kind: 'action', run: function () {
            var blob = new Blob([JSON.stringify({ checkins: T.checkins, sessions: T.sessions, body: T.body, routine: T.routine }, null, 2)], { type: 'application/json' }), a = el('a', { href: URL.createObjectURL(blob), download: 'rhythm.json' });
            document.body.appendChild(a); a.click(); a.remove();
          }, about: 'Everything the rhythm knows about you, as one JSON file. Nothing of it is sent anywhere.' },
        { id: 'where', label: 'What is kept where', kind: 'info', value: 'This device',
          about: 'Notes, the board’s moves and every setting here are kept in this browser. In the build, tasks live in GitHub, and nothing else leaves your devices.' },
        { id: 'reset', label: 'Reset the board and notes', kind: 'action', danger: true, run: function () {
          if (X.confirm !== 'reset') { X.confirm = 'reset'; paintSide(); T.toast('Press again to reset the board and notes on this device.'); return; }
          X.confirm = null; T.resetLocal(); T.toast('Reset. Reload the page to see the sample board and notes again.');
        }, about: 'Puts the sample board and notes back on this device. Press twice.' }
      ];
    } },
    { id: 'about', name: 'About', rows: function () {
      return [
        { id: 'wiring', label: 'How it is wired', kind: 'action', run: function () { close(); T.$('#blueprint').hidden = false; T.$('#bpClose').focus(); },
          about: 'The design notes: what each part shows, how data moves, the product, the build order and the decisions that are yours.' },
        { id: 'keys', label: 'Keys', kind: 'info', value: '⌘K  /  L  Y  V  B  R  P  D  N  C  F  H  ,  + −',
          about: 'Ask with ⌘K or /. L leans back, Y opens the year, R opens Resume, P opens Releases, D switches Depth, N makes a note, C opens the chains, F starts a focus block, H goes home, and the comma key opens these settings.' },
        { id: 'pad', label: 'Controller', kind: 'info', value: function () { return X.pad.on ? 'Connected' : 'None'; },
          about: 'With a controller, Start opens these settings, the pad moves, A acts, B goes back and the bumpers change section.' }
      ];
    } }
  ];

  // ---------------------------------------------------------------- drawing the menu
  function val(r) { var v = r.get ? r.get() : r.value; return typeof v === 'function' ? v() : v; }
  function about(r) { return typeof r.about === 'function' ? r.about() : r.about || ''; }
  function optName(r, v) { var o = (r.options || []).filter(function (x) { return x[0] === v; })[0]; return o ? o[1] : v; }
  function paintTabs() {
    T.clear(tabsEl);
    TABS.forEach(function (t, i) {
      tabsEl.appendChild(el('button', { class: 'x-tab', role: 'tab', 'aria-selected': String(i === X.tab), on: { click: function () { go(i); } } }, t.name));
    });
    // where the sections scroll sideways, keep the one you are in on screen
    var cur = tabsEl.children[X.tab];
    if (cur && tabsEl.scrollWidth > tabsEl.clientWidth) {
      var l = cur.offsetLeft - tabsEl.offsetLeft, r = l + cur.offsetWidth;
      if (l < tabsEl.scrollLeft) tabsEl.scrollLeft = Math.max(0, l - 16);
      else if (r > tabsEl.scrollLeft + tabsEl.clientWidth) tabsEl.scrollLeft = r - tabsEl.clientWidth + 16;
    }
  }
  function valueNode(r, i) {
    var v = val(r);
    if (r.kind === 'choice') return el('span', { class: 'x-v x-choice' }, el('i', { class: 'x-ar', 'aria-hidden': 'true' }, '‹'), el('b', null, optName(r, v)), el('i', { class: 'x-ar', 'aria-hidden': 'true' }, '›'));
    if (r.kind === 'toggle') return el('span', { class: 'x-v x-toggle', 'data-on': v ? '1' : '0' }, el('b', null, v ? 'On' : 'Off'), el('i', { class: 'x-sw', 'aria-hidden': 'true' }));
    if (r.kind === 'range') {
      var k = (v - r.min) / (r.max - r.min);
      return el('span', { class: 'x-v x-range' }, el('span', { class: 'x-bar' }, el('i', { style: { width: (k * 100).toFixed(1) + '%' } })), el('b', null, v + (r.unit || '')));
    }
    if (r.kind === 'swatch') {
      var wrap = el('span', { class: 'x-v x-sws' });
      T.FIELDS.forEach(function (f) {
        wrap.appendChild(el('button', { class: 'x-sw-c', title: f[1], 'aria-label': f[1], 'aria-pressed': String(f[0] === v), style: { background: f[0] },
          on: { click: function (ev) { ev.stopPropagation(); X.focus = i; r.set(f[0]); paint(); } } }));
      });
      var custom = !T.FIELDS.some(function (f) { return f[0] === v; });
      var pick = el('input', { type: 'color', value: v, 'aria-label': 'Your own colour', class: 'x-pick', on: { input: function (ev) { r.set(ev.target.value); paintSide(); }, change: function () { paint(); } } });
      wrap.appendChild(el('label', { class: 'x-sw-c x-sw-own', title: 'Your own', 'aria-pressed': String(custom), style: custom ? { background: v } : null }, pick, custom ? null : el('span', null, '+')));
      return wrap;
    }
    if (r.kind === 'text') {
      var inp = el('input', { type: 'text', class: 'x-text', value: v || '', placeholder: r.placeholder || '', maxlength: 40, 'aria-label': r.label,
        on: { input: function (ev) { r.set(ev.target.value); paintSide(); }, focus: function () { X.focus = i; mark(); }, keydown: function (ev) { if (ev.key === 'Enter' || ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); ev.target.blur(); } } } });
      return el('span', { class: 'x-v' }, inp);
    }
    if (r.kind === 'file') {
      var f = el('input', { type: 'file', accept: r.accept, class: 'x-file', 'aria-label': r.label, on: { change: function (ev) { readFile(ev.target.files[0], r); } } });
      return el('span', { class: 'x-v x-filev' }, v ? el('img', { src: v, alt: '' }) : null, el('b', null, v ? 'Replace' : 'Choose'), f);
    }
    if (r.kind === 'connector') return el('span', { class: 'x-v x-status', 'data-live': r.live ? '1' : '0' }, el('b', null, typeof r.status === 'function' ? r.status() : r.status));
    if (r.kind === 'action') return el('span', { class: 'x-v x-go' + (r.danger ? ' warn' : '') }, el('b', null, r.danger && X.confirm === 'reset' ? 'Press again' : ''), el('i', { 'aria-hidden': 'true' }, '›'));
    return el('span', { class: 'x-v' }, el('b', null, v || ''));
  }
  function paint() {
    X.rows = TABS[X.tab].rows();
    X.focus = clamp(X.focus, 0, X.rows.length - 1);
    T.clear(listEl);
    listEl.appendChild(hiEl);
    X.rows.forEach(function (r, i) {
      var row = el('div', { class: 'x-row' + (r.kind === 'info' ? ' info' : ''), role: 'option', 'data-i': i, style: { 'animation-delay': (i * 28) + 'ms' },
        on: {
          pointerenter: function (ev) { if (ev.pointerType === 'mouse') { X.focus = i; mark(); } },
          click: function (ev) { X.focus = i; mark(); if (ev.target.closest('input,button.x-sw-c,label.x-sw-own')) return; act(1, true); }
        } },
        el('span', { class: 'x-l' }, r.label), valueNode(r, i));
      listEl.appendChild(row);
    });
    paintTabs();
    mark();
  }
  var lastFocus = -1;
  function mark() {
    var rows = T.$$('.x-row', listEl), cur = rows[X.focus];
    if (X.focus !== lastFocus) { if (lastFocus >= 0 && T.sfx) T.sfx('move'); lastFocus = X.focus; }
    rows.forEach(function (r, i) { r.classList.toggle('on', i === X.focus); r.setAttribute('aria-selected', String(i === X.focus)); });
    // on a phone the notes on a setting open under it; elsewhere they sit beside the list
    var narrow = window.innerWidth < 760;
    if (narrow && cur) { if (cur.nextSibling !== sideEl) listEl.insertBefore(sideEl, cur.nextSibling); sideEl.classList.add('inline'); }
    else if (!narrow && sideEl.parentNode !== bodyEl) { bodyEl.appendChild(sideEl); sideEl.classList.remove('inline'); }
    if (cur) {
      hiEl.style.transform = 'translateY(' + cur.offsetTop + 'px)';
      hiEl.style.height = cur.offsetHeight + 'px';
      hiEl.style.opacity = '1';
      if (cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
    }
    paintSide();
  }
  function paintSide() {
    var r = X.rows[X.focus];
    T.clear(sideEl);
    if (!r) return;
    sideEl.appendChild(el('p', { class: 'x-sk' }, TABS[X.tab].name));
    sideEl.appendChild(el('h3', { class: 'x-sh' }, r.label));
    sideEl.appendChild(el('p', { class: 'x-sa' }, about(r)));
    if (r.id === 'field') {
      var d = T.describe(null);
      sideEl.appendChild(el('div', { class: 'x-prev x-prev-field' }, el('span', { class: 'x-prev-ink' }, d.title), el('span', { class: 'x-prev-sub' }, d.sub),
        el('span', { class: 'x-prev-dots' }, el('span', null, el('i', { style: { background: 'var(--native)' } }), 'you'), el('span', null, el('i', { style: { 'box-shadow': 'inset 0 0 0 2px var(--cloud)' } }), 'agents'),
          el('span', null, el('i', { style: { background: 'var(--violet)' } }), 'needs you'))));
    }
    if (TABS[X.tab].id === 'brand') {
      var pv = el('div', { class: 'x-prev x-prev-brand' });
      pv.appendChild(T.brand.logo ? el('img', { src: T.brand.logo, alt: '' }) : el('span', { class: 'x-prev-mark', html: T.$('#top .brand svg') ? T.$('#top .brand svg').outerHTML : '' }));
      pv.appendChild(el('span', { class: 'x-prev-wm' }, T.brandName()));
      sideEl.appendChild(pv);
    }
  }

  // ---------------------------------------------------------------- acting
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function go(i) { X.tab = (i + TABS.length) % TABS.length; X.focus = 0; X.confirm = null; lastFocus = -1; if (T.sfx) T.sfx('select'); paint(); }
  function move(d) { X.focus = clamp(X.focus + d, 0, X.rows.length - 1); mark(); }
  function act(d, enter) {
    var r = X.rows[X.focus];
    if (!r) return;
    if (T.sfx && r.kind !== 'info') T.sfx('tick');
    if (r.kind === 'choice') {
      var o = r.options, i = o.map(function (x) { return x[0]; }).indexOf(val(r));
      r.set(o[(i + d + o.length) % o.length][0]); paint(); return;
    }
    if (r.kind === 'toggle') { if (enter || (d > 0) !== !!val(r)) r.set(!val(r)); paint(); return; }
    if (r.kind === 'range') { if (enter) return; r.set(clamp(val(r) + d * r.step, r.min, r.max)); paint(); return; }
    if (r.kind === 'swatch') {
      if (enter) { var own = T.$('.x-row.on .x-pick', listEl); if (own) own.click(); return; }
      var ids = T.FIELDS.map(function (f) { return f[0]; }), k = ids.indexOf(val(r));
      r.set(ids[((k < 0 ? 0 : k) + d + ids.length) % ids.length]); paint(); return;
    }
    if (!enter) return;
    if (r.kind === 'text') { var inp = T.$('.x-row.on .x-text', listEl); if (inp) inp.focus(); return; }
    if (r.kind === 'file') { var f = T.$('.x-row.on .x-file', listEl); if (f) f.click(); return; }
    if (r.kind === 'action' && r.run) { r.run(); if (X.open) paint(); return; }
    if (r.kind === 'connector') { T.toast(r.label + ': ' + (typeof r.status === 'function' ? r.status() : r.status) + '. Connecting happens in the build; this page reads a scan.'); return; }
  }
  function readFile(file, r) {
    if (!file) return;
    if (file.size > 300 * 1024) { T.toast('That file is over 300 KB. A smaller SVG or PNG keeps the page quick.'); return; }
    var fr = new FileReader();
    fr.onload = function () { r.set(String(fr.result)); paint(); T.toast('Your logo is in place.'); };
    fr.readAsDataURL(file);
  }
  function exportNotes() {
    var blob = new Blob([JSON.stringify(T.notes, null, 2)], { type: 'application/json' }), a = el('a', { href: URL.createObjectURL(blob), download: 'notes.json' });
    document.body.appendChild(a); a.click(); a.remove();
    T.toast('Notes exported.');
  }

  // ---------------------------------------------------------------- open and close
  function open(tabId) {
    if (T.closeAsk) T.closeAsk();
    if (T.closePop) T.closePop();
    if (T.closeNoteUi) T.closeNoteUi();
    X.ret = document.activeElement;
    X.open = true; box.hidden = false;
    document.documentElement.classList.add('setting');
    if (tabId) { var i = TABS.map(function (t) { return t.id; }).indexOf(tabId); if (i >= 0) { X.tab = i; X.focus = 0; } }
    paint();
    requestAnimationFrame(function () { box.classList.add('in'); mark(); });
    setTimeout(function () { var t = T.$('.x-tab[aria-selected="true"]', tabsEl); if (t) t.focus({ preventScroll: true }); }, 30);
  }
  function close() {
    if (!X.open) return;
    X.open = false; box.classList.remove('in'); box.hidden = true; X.confirm = null;
    document.documentElement.classList.remove('setting');
    if (X.ret && X.ret.focus) try { X.ret.focus({ preventScroll: true }); } catch (e) { /* gone */ }
  }
  T.openSettings = open;
  T.closeSettings = close;
  T.settingsOpen = function () { return X.open; };

  function onKey(ev) {
    if (!X.open) return;
    var tag = (ev.target.tagName || '').toLowerCase(), typing = tag === 'input' && ev.target.type === 'text';
    if (typing && ev.key !== 'Escape' && ev.key !== 'Tab') { ev.stopPropagation(); return; }
    var k = ev.key;
    if (k === 'Escape') { ev.preventDefault(); ev.stopPropagation(); if (typing) ev.target.blur(); else close(); return; }
    if (k === 'ArrowDown' || (k === 'Tab' && !ev.shiftKey)) { ev.preventDefault(); move(1); return; }
    if (k === 'ArrowUp' || (k === 'Tab' && ev.shiftKey)) { ev.preventDefault(); move(-1); return; }
    if (k === 'ArrowRight') { ev.preventDefault(); act(1); return; }
    if (k === 'ArrowLeft') { ev.preventDefault(); act(-1); return; }
    if (k === 'Enter' || k === ' ') { ev.preventDefault(); act(1, true); return; }
    if (k === 'q' || k === 'Q' || k === '[' || k === 'PageUp') { ev.preventDefault(); go(X.tab - 1); return; }
    if (k === 'e' || k === 'E' || k === ']' || k === 'PageDown') { ev.preventDefault(); go(X.tab + 1); return; }
    ev.stopPropagation();
  }

  // ---------------------------------------------------------------- a controller
  var MAP = { 0: 'a', 1: 'b', 4: 'lb', 5: 'rb', 9: 'start', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
  function poll(now) {
    X.pad.raf = requestAnimationFrame(poll);
    var pads = navigator.getGamepads ? navigator.getGamepads() : [], p = null;
    for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { p = pads[i]; break; }
    if (!p) return;
    var press = {};
    Object.keys(MAP).forEach(function (b) { if (p.buttons[b] && p.buttons[b].pressed) press[MAP[b]] = true; });
    var ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    if (ay < -0.55) press.up = true; if (ay > 0.55) press.down = true; if (ax < -0.55) press.left = true; if (ax > 0.55) press.right = true;
    Object.keys(press).concat(Object.keys(X.pad.held)).forEach(function (k) {
      var on = !!press[k], was = X.pad.held[k];
      if (on && !was) { X.pad.held[k] = now; X.pad.next[k] = now + 320; fire(k); }
      else if (on && was && /up|down|left|right/.test(k) && now > X.pad.next[k]) { X.pad.next[k] = now + 110; fire(k); }
      else if (!on && was) delete X.pad.held[k];
    });
  }
  function fire(k) {
    if (k === 'start') { if (X.open) close(); else open(); return; }
    if (!X.open) return;
    if (k === 'up') move(-1); else if (k === 'down') move(1); else if (k === 'left') act(-1); else if (k === 'right') act(1);
    else if (k === 'a') act(1, true); else if (k === 'b') close(); else if (k === 'lb') go(X.tab - 1); else if (k === 'rb') go(X.tab + 1);
  }

  T.initSettings = function () {
    box = T.$('#settings'); tabsEl = T.$('#xTabs'); listEl = T.$('#xList'); sideEl = T.$('#xSide'); padHint = T.$('#xPad'); bodyEl = T.$('.x-body', box);
    hiEl = el('div', { class: 'x-hi', 'aria-hidden': 'true' });
    T.$('#xClose').addEventListener('click', close);
    box.addEventListener('pointerdown', function (ev) { if (ev.target === box) close(); });
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('gamepadconnected', function () {
      X.pad.on = true; box.classList.add('pad');
      if (!X.pad.raf) X.pad.raf = requestAnimationFrame(poll);
      T.toast('Controller connected. Start opens the settings.');
    });
    window.addEventListener('gamepaddisconnected', function () { X.pad.on = false; box.classList.remove('pad'); });
    window.addEventListener('resize', function () { if (X.open) mark(); });
  };
})();
