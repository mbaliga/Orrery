/* app: layout mode, views, the lens picker, keys, the clock, and care for the OLED panel. Settings live in settings.js. */
(function () {
  'use strict';
  var T = window.T, S = T.S, E = T.E, el = T.el;
  var app = T.$('#app');
  var VIEWS = [['canopy', 'Canopy'], ['dial', 'Dial'], ['resume', 'Resume'], ['today', 'Today'], ['board', 'Board'], ['crew', 'Crew'], ['time', 'Time'], ['chains', 'Chains'], ['releases', 'Releases']];
  var SHEETS = { chains: ['#m-deps', '#chainsBtn'], releases: ['#m-rel', '#relBtn'], resume: ['#m-resume', '#resumeBtn'] };
  var LAYERS = [['n', 'Kinds of work'], ['a', 'Agents'], ['h', 'When'], ['f', 'Platforms'], ['l', 'Languages'], ['t', 'Libraries'], ['s', 'Shared']];
  function known(v) { return VIEWS.some(function (x) { return x[0] === v; }); }
  function shown(node) { return !!node && node.getClientRects().length > 0; }
  T.shown = shown;

  // ---- layout mode: the ultrawide is a cockpit with everything at once; everything else gets one view at a time
  // the whole interface scales with one number, the type with another; both yours, both quick (keys and Settings)
  var UI = T.ui = { scale: T.store.get('uiScale', 1), text: T.store.get('textScale', 1) };
  T.setUiScale = function (v) { UI.scale = Math.max(0.6, Math.min(1.8, Math.round(v * 20) / 20)); T.store.set('uiScale', UI.scale); setMode(); measureTop(); renderSized(); T.emit('scale'); if (T.sfx) T.sfx('tick'); };
  T.setTextScale = function (v) { UI.text = Math.max(0.75, Math.min(1.5, Math.round(v * 20) / 20)); T.store.set('textScale', UI.text); document.documentElement.style.setProperty('--tx', String(UI.text)); measureTop(); renderSized(); T.emit('scale'); if (T.sfx) T.sfx('tick'); };
  function setMode() {
    var w = window.innerWidth, h = window.innerHeight;
    // the panorama holds from the full G9 down to a window still wide enough for both wings beside the chord
    var mode = ((w / h >= 2.5 && w >= 1900) || (w >= 2300 && w / h >= 1.85)) ? 'pano' : (w >= 760 ? 'split' : 'stack');
    var root = document.documentElement;
    root.style.setProperty('--tx', String(UI.text));
    if (mode === 'pano') {
      // the wings take what the chord does not need: the ring is sized by height, so a narrower panorama gives the wings more
      var ring = Math.min(h * 1.05, w * 0.4), wing = Math.max(0.25, Math.min(0.34, (w - ring) / 2 / w));
      root.style.setProperty('--wing', (wing * 100).toFixed(1) + 'vw');
      root.style.fontSize = (Math.max(11, Math.min(w / 274, h / 77)) * UI.scale).toFixed(2) + 'px';
      document.body.style.overflow = 'hidden';
    } else {
      root.style.fontSize = UI.scale === 1 ? '' : (16 * UI.scale).toFixed(2) + 'px';
      document.body.style.overflow = '';
      app.style.transform = '';
      app.classList.remove('idle');
    }
    var changed = mode !== S.mode;
    S.mode = mode;
    app.setAttribute('data-mode', mode);
    if (changed) T.emit('mode', mode);
    return changed;
  }
  // on tablet and phone the canopy fills the screen under the top strip
  function measureTop() {
    if (S.mode === 'pano') { app.style.removeProperty('--top-h'); return; }
    // the header's bottom edge, which already sits below a phone's safe-area inset
    app.style.setProperty('--top-h', Math.round(T.$('#top').getBoundingClientRect().bottom) + 'px');
  }
  function setView(v, quiet) {
    if (!known(v)) v = 'canopy';
    if (S.mode === 'pano' && SHEETS[v]) { openSheet(v, true); return; }
    if (S.view !== v && T.sfx && !quiet) T.sfx('select');
    S.view = v;
    app.setAttribute('data-view', v);
    T.$$('#tabs button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === v)); });
    T.$$('#dock button').forEach(function (b) { b.setAttribute('aria-current', String(b.getAttribute('data-v') === v)); });
    T.store.set('view', v);
    T.emit('view', v);
    if (!quiet) { window.scrollTo(0, 0); measureTop(); renderSized(); }
  }
  T.setView = setView;

  function renderSized() {
    T.canopySize(); if (T.beamResize) T.beamResize(); T.renderToday(); T.renderBoard(); T.renderDeps(); T.renderHorizon(); T.renderHud();
    T.renderAgents(); T.renderVitals(); T.renderSignal(); T.renderDial(); T.renderReleases(); T.renderResume(); if (T.renderCamera) T.renderCamera();
  }
  function renderAll() {
    T.renderToday(); T.renderNotes(); T.renderBoard(); T.renderDeps(); T.renderHorizon(); T.renderHud();
    T.renderAgents(); T.renderVitals(); T.renderSignal(); T.renderFocus(); T.renderReleases(); T.renderResume();
  }

  // ---- the sheets: chains, releases and resume lie over the canopy on the ultrawide, and are views elsewhere
  function openSheet(name, open) {
    if (S.mode !== 'pano') { setView(name); return; }
    var d = T.$(SHEETS[name][0]);
    if (open == null) open = d.getAttribute('data-open') !== '1';
    Object.keys(SHEETS).forEach(function (k) { if (k !== name) { T.$(SHEETS[k][0]).setAttribute('data-open', '0'); T.$(SHEETS[k][1]).setAttribute('aria-pressed', 'false'); } });
    d.setAttribute('data-open', open ? '1' : '0');
    T.$(SHEETS[name][1]).setAttribute('aria-pressed', String(open));
    if (T.sfx) T.sfx(open ? 'open' : 'close');
    if (open) { if (name === 'chains') T.renderDeps(); if (name === 'releases') T.renderReleases(); if (name === 'resume') T.renderResume(); }
  }
  function sheetOpen() { return Object.keys(SHEETS).filter(function (k) { return T.$(SHEETS[k][0]).getAttribute('data-open') === '1'; })[0] || null; }
  function openChains(open) { openSheet('chains', open); }
  T.openChains = openChains;
  T.openSheet = openSheet;

  // ---- controls along the top
  function buildControls() {
    var tabs = T.$('#tabs'), dock = T.$('#dock'), ly = T.$('#layers');
    VIEWS.forEach(function (v) {
      tabs.appendChild(el('button', { data: { v: v[0] }, 'aria-pressed': 'false', on: { click: function () { setView(v[0]); } } }, v[1]));
      dock.appendChild(el('button', { data: { v: v[0] }, on: { click: function () { setView(v[0]); } } }, v[1]));
    });
    LAYERS.forEach(function (o) {
      ly.appendChild(el('button', { 'aria-pressed': String(!!S.layers[o[0]]), title: 'Show ' + o[1].toLowerCase() + ' on the chord', on: { click: function (ev) {
        S.layers[o[0]] = !S.layers[o[0]];
        ev.currentTarget.setAttribute('aria-pressed', String(S.layers[o[0]]));
        var le = S.lens && E.get(S.lens);
        if (le && le.band === o[0] && !S.layers[o[0]]) T.setLens(null);
        T.store.set('layers', S.layers);
        T.canopyLayout();
      } } }, o[1]));
    });
  }

  // ---- lens readout and picker
  function paintLens() {
    var e = S.lens && E.get(S.lens), btn = T.$('#lensBtn');
    T.$('#lensV').textContent = e ? e.name : 'All work';
    btn.setAttribute('data-on', e ? '1' : '0');
    T.$('#lensX').hidden = !e;
  }
  function openPicker() {
    T.openPop(T.$('#lensBtn'), function (pop) {
      var input = el('input', { type: 'text', placeholder: 'Find a project, library, agent', 'aria-label': 'Find a lens', id: 'lensFind' });
      pop.appendChild(input);
      var body = el('div');
      pop.appendChild(body);
      function draw(q) {
        T.clear(body);
        q = (q || '').toLowerCase();
        var groups = [['Groups', 'c'], ['Projects', 'p'], ['Agents', 'a'], ['Platforms', 'f'], ['Kinds of work', 'n'], ['Languages', 'l'], ['Libraries and tools', 't'], ['Shared', 's']];
        groups.forEach(function (g) {
          var seg = el('div', { class: 'seg' }), n = 0;
          E.forEach(function (e) {
            if (e.band !== g[1] || (q && e.name.toLowerCase().indexOf(q) < 0)) return;
            n++;
            seg.appendChild(el('button', { class: 'chip', 'aria-pressed': String(S.lens === e.id), on: { click: function () { T.closePop(); T.setLens(e.id); } } }, e.name));
          });
          if (n) { body.appendChild(el('span', { class: 'mod-t' }, g[0])); body.appendChild(seg); }
        });
        if (!body.children.length) body.appendChild(el('p', { class: 'empty' }, 'Nothing matches.'));
      }
      draw('');
      input.addEventListener('input', function () { draw(input.value); });
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { var first = body.querySelector('.chip'); if (first) first.click(); }
        if (ev.key === 'Escape') T.closePop();
      });
      if (S.mode !== 'stack') setTimeout(function () { input.focus(); }, 30);
    });
  }
  T.openLensPicker = openPicker;

  // ---- flat or in depth: the same canopy, face on by default
  function setDepth(on) {
    T.canopySet('depth', on);
    paintDepth();
  }
  function paintDepth() { T.$('#depthBtn').setAttribute('aria-pressed', String(T.canopyDepth())); }
  T.setDepth = setDepth;

  // ---- the OLED panel: nothing bright sits still, and the instruments rest when you do
  var SHIFT = [[0, 0], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], shiftI = 0;
  function pixelShift(reset) {
    if (reset === true || S.mode !== 'pano' || !T.canopy.drift) { shiftI = 0; app.style.transform = ''; return; }
    shiftI = (shiftI + 1) % SHIFT.length;
    app.style.transform = 'translate(' + SHIFT[shiftI][0] * 2 + 'px,' + SHIFT[shiftI][1] * 2 + 'px)';
  }
  T.pixelShift = pixelShift;
  var idleT = 0, lastWake = 0;
  // stepping away from the ultrawide: it leans back into the sky, or only dims, as you chose in Settings
  function wake() {
    var now = Date.now();
    if (app.classList.contains('idle')) app.classList.remove('idle');
    if (T.leanBackAuto && T.leanBackAuto()) T.leanIn(true);
    if (now - lastWake < 1000) return;
    lastWake = now;
    clearTimeout(idleT);
    idleT = setTimeout(function () {
      if (S.mode !== 'pano' || (T.settingsOpen && T.settingsOpen())) return;
      if (T.store.get('away', 'sky') === 'sky' && !T.isLeanBack() && !T.askOpen()) { if (T.yearOpen && T.yearOpen()) T.closeYear(); T.leanBack(true); }
      else app.classList.add('idle');
    }, 5 * 60 * 1000);
  }

  // ---- clock: one timer drives every countdown on the page
  function tickClock() {
    var d = new Date();
    T.$('#clock').textContent = T.DAY[d.getDay()].slice(0, 3) + ' ' + T.dm(d) + '  ' + T.hm(d);
    T.$('#dayT').textContent = T.hm(d) + ' your time';
    T.$$('.cd[data-at]').forEach(function (e) { if (shown(e)) T.tick(e); });
  }

  function newNoteCentre() {
    if (S.mode !== 'pano' && S.view !== 'canopy') setView('canopy');
    var r = T.$('#canopy').getBoundingClientRect();
    T.newNoteAtScreen(r.width / 2, r.height * 0.4, true);
  }

  // ---- wiring
  function init() {
    var sl = T.store.get('layers', null);
    if (sl) Object.keys(S.layers).forEach(function (k) { if (k in sl) S.layers[k] = !!sl[k]; });
    setMode();
    buildControls();
    T.initBoard();
    T.initNotes();
    var hash = (location.hash || '').replace('#', ''), saved = T.store.get('view', 'canopy');
    setView(known(hash) ? hash : known(saved) ? saved : 'canopy', true);
    measureTop();
    T.initLook();
    T.initCanopy();
    T.initAsk();
    T.initSky();
    T.initYear();
    if (T.initDial) T.initDial();
    if (T.initWidgets) T.initWidgets();
    T.initBody();
    T.initSettings();
    // the explanations that wait behind an info mark
    T.$$('.info-at[data-info]').forEach(function (at) { at.parentNode.replaceChild(T.info(at.getAttribute('data-info'), at.getAttribute('data-label')), at); });
    renderAll();
    paintLens();
    // a phone opens on the sky the first time; after that, wherever you left it
    if (!known(hash) && T.store.get('lean', S.mode === 'stack' ? 'back' : 'in') === 'back') T.leanBack(false);
    tickClock();
    setInterval(tickClock, 1000);
    setInterval(function () { T.renderToday(); T.renderHorizon(); T.renderHud(); T.renderDial(); T.renderAgents(); T.canopyRedraw(); }, 5 * 60 * 1000);
    setInterval(pixelShift, 3 * 60 * 1000);

    T.on('lens', function () { if (T.sfx) T.sfx(S.lens ? 'select' : 'back'); paintLens(); T.renderToday(); T.renderBoard(); T.renderDeps(); T.renderHorizon(); T.renderHud(); T.renderAgents(); T.renderVitals(); T.renderNotes(); });
    T.on('tasks', function () { T.renderBoard(); T.renderToday(); T.renderDeps(); T.renderHorizon(); T.renderHud(); T.renderAgents(); });
    T.on('checkin', function () { if (T.sfx) T.sfx('tick'); });
    T.on('activity', function () { if (T.sfx) T.sfx('done'); });

    T.$('#lensBtn').addEventListener('click', openPicker);
    T.$('#lensX').addEventListener('click', function () { T.setLens(null); });
    T.$('#chainsBtn').addEventListener('click', function () { openChains(); });
    T.$('#relBtn').addEventListener('click', function () { openSheet('releases'); });
    T.$('#resumeBtn').addEventListener('click', function () { openSheet('resume'); });
    T.$('#relX').addEventListener('click', function () { openSheet('releases', false); });
    T.$('#resumeX').addEventListener('click', function () { openSheet('resume', false); });
    T.$('#depthBtn').addEventListener('click', function () { setDepth(!T.canopyDepth()); });
    paintDepth();
    T.$('#depsX').addEventListener('click', function () { openChains(false); });
    T.$('#fab').addEventListener('click', function () { T.openAsk(''); });
    T.$('#askBtn').addEventListener('click', function () { T.openAsk(''); });
    T.$('#leanBtn').addEventListener('click', function () { T.leanBack(false); });
    T.$('#setBtn').addEventListener('click', function () { T.openSettings(); });
    T.$('#yearBtn').addEventListener('click', function () { if (T.yearOpen()) T.closeYear(); else T.openYear(); });
    T.$('#bpClose').addEventListener('click', function () { T.$('#blueprint').hidden = true; });
    T.$('#blueprint').addEventListener('click', function (ev) { if (ev.target.id === 'blueprint') ev.currentTarget.hidden = true; });
    T.$('#fsBtn').addEventListener('click', function () {
      var d = document, r = d.documentElement;
      try {
        if (d.fullscreenElement) d.exitFullscreen();
        else if (r.requestFullscreen) r.requestFullscreen().catch(function () { T.toast('Full screen is not available here. Open the page in its own tab.'); });
        else T.toast('Full screen is not available here.');
      } catch (e) { T.toast('Full screen is not available here.'); }
    });
    document.addEventListener('keydown', function (ev) {
      var tag = (ev.target.tagName || '').toLowerCase();
      // ask, from anywhere
      if (T.settingsOpen()) return;
      if ((ev.metaKey || ev.ctrlKey) && !ev.altKey && (ev.key === 'k' || ev.key === 'K')) { if (T.isVisitor()) return; ev.preventDefault(); if (T.askOpen()) T.closeAsk(); else T.openAsk(''); return; }
      if (T.bodyOpen && T.bodyOpen()) { if (ev.key === 'Escape' || ev.key === 'b' || ev.key === 'B') { ev.preventDefault(); T.closeBody(); } return; }
      if (T.askOpen() || T.yearOpen()) return;
      // leaning back: start typing to ask; Escape or Enter leans in
      if (T.isLeanBack()) {
        if (T.leanBackAuto()) { T.leanIn(true); return; }
        if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
        if (T.isVisitor()) { if (ev.key === 'Escape') { ev.preventDefault(); T.leanIn(); } return; }   // a visitor has nothing to ask
        if (ev.key === 'Escape' || ev.key === 'Enter') { ev.preventDefault(); T.leanIn(); return; }
        if (ev.key === ' ') { ev.preventDefault(); T.openAsk(''); return; }
        if (ev.key.length === 1) { ev.preventDefault(); T.openAsk(ev.key); }
        return;
      }
      if (ev.key === 'Escape') {
        if (!T.$('#blueprint').hidden) { T.$('#blueprint').hidden = true; return; }
        if (T.closeNoteUi()) return;
        T.closePop();
        if (tag === 'input') { ev.target.blur(); return; }
        if (S.mode === 'pano' && sheetOpen()) { openSheet(sheetOpen(), false); return; }
        if (S.lens) T.setLens(null);
        return;
      }
      if (tag === 'input' || tag === 'textarea' || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      if (k === '/') { ev.preventDefault(); T.openAsk(''); }
      else if (k === 'l') { T.leanBack(false); }
      else if (k === 'n') { ev.preventDefault(); newNoteCentre(); }
      else if (k === 'f') { T.toggleFocus(); }
      else if (k === 'c') { openChains(); }
      else if (k === 'p') { openSheet('releases'); }
      else if (k === 'r') { openSheet('resume'); }
      else if (k === 'h') { T.canopyHome(); }
      else if (k === 'd') { setDepth(!T.canopyDepth()); T.toast(T.canopyDepth() ? 'Depth: the orrery and the flight path. D again for flat.' : 'Flat: the chord, face on.'); }
      else if (k === 'y') { T.openYear(); }
      else if (k === 'b') { T.openBody(); }
      else if (k === '=' || k === '+') { T.setUiScale(UI.scale + 0.05); T.toast('Scale ' + Math.round(UI.scale * 100) + '%'); }
      else if (k === '-' || k === '_') { T.setUiScale(UI.scale - 0.05); T.toast('Scale ' + Math.round(UI.scale * 100) + '%'); }
      else if (k === '0' && ev.shiftKey) { T.setUiScale(1); T.setTextScale(1); T.toast('Scale and text back to 100%'); }
      else if (k === ',') { ev.preventDefault(); T.openSettings(); }
    });
    ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (e) { window.addEventListener(e, wake, { passive: true }); });
    wake();

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { setMode(); measureTop(); renderSized(); }, 140);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measureTop(); T.canopySize(); T.renderDeps(); T.renderBoard(); });
  }
  init();
})();
