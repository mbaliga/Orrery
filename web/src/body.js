/* body: training as it was, not as a watch sums it, and what it leaves behind.
   A session is a kind and its segments: a fencing class is warm-up, footwork, drills and some bouts, and only the
   bouts are fencing. The segments are what Crocodyl and the watch companion will write; here you log them by hand.
   The body map keeps where you are sore, by region and degree; the planner takes a recovery slot off a hard day
   and puts short breaks into today, matched to the sore regions. Sitting is counted from the last thing that moved
   you. All of it stays in this browser (local/ in the build, never pushed unless you say so). Mobility ideas here
   are general, not medical advice. */
(function () {
  'use strict';
  var T = window.T, S = T.S, SEED = T.SEED, el = T.el, sv = T.sv;
  var INK = '236,232,228';
  function rgba(c, a) { return 'rgba(' + c + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')'; }
  function iso(d) { return new Date(d).toISOString(); }

  // ---------------------------------------------------------------- kinds of session and their usual shape
  var SPORTS = T.SPORTS = {
    fencing: { label: 'Fencing class', segs: [['warmup', 15], ['footwork', 15], ['drills', 35], ['bouts', 20]], load: ['thigh-r', 'thigh-l', 'calf-r', 'hip', 'lower-back', 'forearm-r', 'shoulder-r'] },
    archery: { label: 'Archery', segs: [['warmup', 10], ['form', 20], ['ends', 50]], load: ['shoulder-l', 'shoulder-r', 'upper-back', 'forearm-r'] },
    running: { label: 'Run', segs: [['warmup', 8], ['steady', 25], ['intervals', 10], ['cooldown', 7]], load: ['calf-l', 'calf-r', 'knee-l', 'knee-r', 'thigh-l', 'thigh-r'] },
    gym: { label: 'Gym', segs: [['warmup', 10], ['sets', 40], ['core', 10]], load: ['chest', 'upper-back', 'glutes'] },
    walk: { label: 'Walk', segs: [['steady', 30]], load: [] },
    mobility: { label: 'Mobility', segs: [['flow', 20]], load: [] }
  };
  var HARD = T.HARD_SEGS = ['drills', 'bouts', 'intervals', 'sets', 'ends', 'footwork'];
  var SEG_A = { warmup: 0.3, cooldown: 0.3, flow: 0.4, steady: 0.5, core: 0.5, form: 0.55, footwork: 0.6, drills: 0.7, ends: 0.7, sets: 0.8, intervals: 0.9, bouts: 0.95 };
  T.segAlpha = function (k) { return SEG_A[k] || 0.5; };

  // ---------------------------------------------------------------- sessions
  var SAMPLE = [{ id: 'ss-sample', kind: 'fencing', label: 'Fencing class', at: (function () { var d = new Date(); d.setDate(d.getDate() - 2); d.setHours(18, 30, 0, 0); return d.toISOString(); })(), min: 85,
    segs: [{ k: 'warmup', min: 15 }, { k: 'footwork', min: 15 }, { k: 'drills', min: 35 }, { k: 'bouts', min: 20 }], load: SPORTS.fencing.load, sample: true }];
  T.sessions = T.store.get('sessions', null) || SAMPLE;
  function saveSessions() { T.store.set('sessions', T.sessions); T.emit('activity'); }
  function hard(s) { var n = 0; (s.segs || []).forEach(function (g) { if (HARD.indexOf(g.k) >= 0) n += g.min; }); return n; }
  T.sessionsOn = function (k) {
    return T.sessions.filter(function (s) { return T.planDay(s.at) === k; }).map(function (s) { s.hard = hard(s); return s; });
  };
  T.logSession = function (o) {
    var sp = SPORTS[o.kind] || {}, s = { id: 'ss-' + Date.now(), kind: o.kind, label: o.label || sp.label || o.kind, at: o.at || iso(Date.now()), segs: o.segs || (sp.segs || []).map(function (g) { return { k: g[0], min: g[1] }; }), load: o.load || sp.load || [] };
    s.min = s.segs.reduce(function (n, g) { return n + (+g.min || 0); }, 0);
    T.sessions = T.sessions.filter(function (x) { return !x.sample; });
    T.sessions.push(s);
    T.sessions.sort(function (a, b) { return a.at < b.at ? -1 : 1; });
    if (T.sessions.length > 300) T.sessions = T.sessions.slice(-300);
    moved = s.at > (moved || '') ? new Date(new Date(s.at).getTime() + s.min * 6e4).toISOString() : moved;
    T.store.set('moved', moved);
    saveSessions();
    return s;
  };
  T.deleteSession = function (id) { T.sessions = T.sessions.filter(function (s) { return s.id !== id; }); saveSessions(); };
  // minutes of each segment kind by hour of the day, across all sessions, for the clock
  T.segmentsByHour = function () {
    var out = {};
    T.sessions.forEach(function (s) {
      var t = new Date(s.at).getTime();
      (s.segs || []).forEach(function (g) {
        var left = +g.min || 0, arr = out[g.k] = out[g.k] || new Array(24).fill(0);
        while (left > 0) {
          var d = new Date(t), h = d.getHours(), toNext = 60 - d.getMinutes(), take = Math.min(left, toNext);
          arr[h] += take; left -= take; t += take * 6e4;
        }
      });
    });
    return out;
  };

  // ---------------------------------------------------------------- the body map
  // regions, each with a view (front or back), a place on a 100 by 230 figure, and a name; sides are yours, so
  // "right" is your right
  var REGIONS = T.REGIONS = [
    ['neck', 'Neck', 'f', 43, 28, 14, 10], ['shoulder-r', 'Right shoulder', 'f', 18, 38, 16, 12], ['shoulder-l', 'Left shoulder', 'f', 66, 38, 16, 12],
    ['chest', 'Chest', 'f', 36, 40, 28, 24], ['abdomen', 'Abdomen', 'f', 38, 66, 24, 24], ['hip', 'Hips', 'f', 34, 92, 32, 14],
    ['arm-r', 'Right upper arm', 'f', 14, 52, 12, 26], ['arm-l', 'Left upper arm', 'f', 74, 52, 12, 26],
    ['forearm-r', 'Right forearm', 'f', 10, 80, 12, 26], ['forearm-l', 'Left forearm', 'f', 78, 80, 12, 26],
    ['wrist-r', 'Right wrist and hand', 'f', 8, 108, 12, 16], ['wrist-l', 'Left wrist and hand', 'f', 80, 108, 12, 16],
    ['thigh-r', 'Right thigh', 'f', 34, 108, 14, 40], ['thigh-l', 'Left thigh', 'f', 52, 108, 14, 40],
    ['knee-r', 'Right knee', 'f', 34, 150, 14, 12], ['knee-l', 'Left knee', 'f', 52, 150, 14, 12],
    ['shin-r', 'Right shin', 'f', 34, 164, 14, 38], ['shin-l', 'Left shin', 'f', 52, 164, 14, 38],
    ['foot-r', 'Right foot and ankle', 'f', 32, 204, 16, 12], ['foot-l', 'Left foot and ankle', 'f', 52, 204, 16, 12],
    ['upper-back', 'Upper back', 'b', 36, 40, 28, 26], ['lower-back', 'Lower back', 'b', 38, 68, 24, 22], ['glutes', 'Glutes', 'b', 34, 92, 32, 16],
    ['hamstring-r', 'Right hamstring', 'b', 52, 110, 14, 38], ['hamstring-l', 'Left hamstring', 'b', 34, 110, 14, 38],
    ['calf-r', 'Right calf', 'b', 52, 162, 14, 40], ['calf-l', 'Left calf', 'b', 34, 162, 14, 40]
  ];
  var byRegion = {}; REGIONS.forEach(function (r) { byRegion[r[0]] = { id: r[0], name: r[1], view: r[2], x: r[3], y: r[4], w: r[5], h: r[6] }; });
  T.regionName = function (id) { return byRegion[id] ? byRegion[id].name : id; };
  var LEVEL = ['', 'mild', 'sore', 'sharp'];
  T.body = T.store.get('body', {});          // region id -> { lvl, at }
  T.setSore = function (id, lvl) {
    if (!lvl) delete T.body[id]; else T.body[id] = { lvl: lvl, at: iso(Date.now()) };
    T.store.set('body', T.body); T.emit('body');
  };
  T.soreList = function () {
    return Object.keys(T.body).map(function (id) { return { id: id, name: T.regionName(id), lvl: T.body[id].lvl, word: LEVEL[T.body[id].lvl], at: T.body[id].at }; })
      .sort(function (a, b) { return b.lvl - a.lvl || a.name.localeCompare(b.name); });
  };

  // ---------------------------------------------------------------- sitting, and the breaks that answer it
  var moved = T.store.get('moved', null);
  T.moved = function () { moved = iso(Date.now()); T.store.set('moved', moved); T.emit('body'); };
  // minutes since anything moved you, counted only inside your working window
  T.sitting = function () {
    var lastSession = null;
    T.sessions.forEach(function (s) { var end = new Date(new Date(s.at).getTime() + (s.min || 0) * 6e4).toISOString(); if (!lastSession || end > lastSession) lastSession = end; });
    var last = [moved, lastSession].filter(Boolean).sort().pop();
    if (!last) return null;
    var mins = Math.round((Date.now() - new Date(last).getTime()) / 6e4);
    // older than a day: the record simply has nothing for today
    if (mins > 24 * 60) return { since: last, mins: mins, long: false, stale: true };
    return { since: last, mins: mins, long: mins >= 90 };
  };
  var EX = {
    neck: ['Chin tucks, ten slow', 'Look over each shoulder, hold five breaths'], shoulder: ['Wall slides, two minutes', 'Arm circles, both ways, slow'],
    chest: ['Doorway stretch, thirty seconds a side'], 'upper-back': ['Thoracic extension over the chair back, ten', 'Cat and cow, ten'],
    'lower-back': ['Hip hinges, ten slow', 'A five-minute walk'], abdomen: ['A five-minute walk'], hip: ['Ninety-ninety switches, two minutes', 'Couch stretch, forty-five seconds a side'],
    glutes: ['Glute bridges, twelve', 'Figure-four stretch, a minute a side'], arm: ['Shake out, then slow curls with no weight, ten'], forearm: ['Wrist flexor and extensor stretch, thirty seconds each', 'Open and close the hands, twenty'],
    wrist: ['Wrist circles, both ways', 'Prayer stretch, thirty seconds'], thigh: ['Quad stretch, forty-five seconds a side', 'Walk the stairs once'], hamstring: ['Hinge stretch, a minute a side'],
    knee: ['Quarter squats, slow, ten', 'Walk on flat ground, five minutes'], shin: ['Heel walks, a minute'], calf: ['Calf raises on a step, fifteen', 'Wall calf stretch, thirty seconds a side'], foot: ['Ankle circles, toe spreads, a minute']
  };
  function exFor(id, i) { var k = id.replace(/-[lr]$/, ''), list = EX[k] || EX.abdomen; return list[(i || 0) % list.length]; }
  T.breaksToday = function () {
    var out = [], sore = T.soreList(), sit = T.sitting();
    sore.slice(0, 3).forEach(function (r, i) { out.push({ title: exFor(r.id, i), why: r.name.toLowerCase() + ', ' + r.word, when: 'between slots', region: r.id }); });
    if (sit && sit.long) out.unshift({ title: 'Stand and walk five minutes', why: 'sitting ' + (sit.mins >= 60 ? Math.floor(sit.mins / 60) + 'h ' + (sit.mins % 60) + 'm' : sit.mins + 'm'), when: 'now', region: null });
    else if (!sore.length) out.push({ title: 'Move for five minutes each slot', why: sit && !sit.stale ? 'nothing sore; keep it that way' : 'no movement logged today', when: 'between slots', region: null });
    return out;
  };

  // ---------------------------------------------------------------- the sheet
  var host, figEl, listEl, formEl, clockEl, sitEl;
  function figure(view) {
    var w = 100, h = 230, root = sv('svg', { class: 'bm', viewBox: '0 0 ' + w + ' ' + h, role: 'group', 'aria-label': view === 'f' ? 'Front of the body' : 'Back of the body' });
    // the outline: head, trunk, limbs, as plain shapes
    root.appendChild(sv('circle', { cx: 50, cy: 15, r: 11, class: 'bm-o' }));
    root.appendChild(sv('path', { class: 'bm-o', d: 'M34 40 Q50 34 66 40 L68 92 Q50 100 32 92 Z' }));
    root.appendChild(sv('path', { class: 'bm-o', d: 'M34 42 L18 40 Q10 60 8 108 L8 124 L20 124 L22 110 Q26 84 30 60 Z' }));
    root.appendChild(sv('path', { class: 'bm-o', d: 'M66 42 L82 40 Q90 60 92 108 L92 124 L80 124 L78 110 Q74 84 70 60 Z' }));
    root.appendChild(sv('path', { class: 'bm-o', d: 'M34 100 L48 100 L48 216 L32 216 Q30 160 34 100 Z' }));
    root.appendChild(sv('path', { class: 'bm-o', d: 'M52 100 L66 100 Q70 160 68 216 L52 216 Z' }));
    REGIONS.filter(function (r) { return r[2] === view; }).forEach(function (r) {
      var id = r[0], b = T.body[id], lvl = b ? b.lvl : 0;
      var rect = sv('rect', { x: r[3], y: r[4], width: r[5], height: r[6], rx: 4, class: 'bm-r l' + lvl, tabindex: 0, role: 'button',
        'aria-label': r[1] + (lvl ? ', ' + LEVEL[lvl] : ''), 'aria-pressed': String(!!lvl) });
      rect.appendChild(sv('title', null, r[1] + (lvl ? ': ' + LEVEL[lvl] + ', since ' + T.dm(b.at) : ': tap to mark')));
      function cycle() { if (T.sfx) T.sfx(lvl === 3 ? 'back' : 'tick'); T.setSore(id, (lvl + 1) % 4); }
      rect.addEventListener('click', cycle);
      rect.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); cycle(); } });
      root.appendChild(rect);
    });
    root.appendChild(sv('text', { x: 50, y: 228, class: 'bm-t', 'text-anchor': 'middle' }, view === 'f' ? 'front' : 'back'));
    return root;
  }
  function paintFigures() {
    T.clear(figEl);
    figEl.appendChild(figure('f')); figEl.appendChild(figure('b'));
    var sore = T.soreList(), chips = el('div', { class: 'bm-c' });
    if (!sore.length) chips.appendChild(el('span', { class: 'row-s' }, 'Nothing marked.'));
    sore.forEach(function (r) {
      chips.appendChild(el('button', { class: 'chip l' + r.lvl, title: 'since ' + T.dm(r.at) + '; tap to clear', on: { click: function () { T.setSore(r.id, 0); } } }, r.name + ' · ' + r.word));
    });
    figEl.appendChild(chips);
  }
  function segBar(s) {
    var bar = el('span', { class: 'ss-bar', title: s.segs.map(function (g) { return g.k + ' ' + g.min + ' min'; }).join(', ') });
    s.segs.forEach(function (g) { bar.appendChild(el('i', { style: { flex: String(g.min), opacity: String(T.segAlpha(g.k)) }, title: g.k + ' ' + g.min + ' min' })); });
    return bar;
  }
  function paintSessions() {
    T.clear(listEl);
    listEl.appendChild(el('p', { class: 'mod-t' }, 'Sessions'));
    var recent = T.sessions.slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; }).slice(0, 8);
    if (!recent.length) listEl.appendChild(el('p', { class: 'row-s' }, 'None logged.'));
    recent.forEach(function (s) {
      var hd = hard(s), row = el('div', { class: 'ss' },
        el('span', { class: 'ss-h' }, el('b', null, s.label), el('span', { class: 'row-s' }, T.dayTime(s.at) + ', ' + s.min + ' min' + (s.sample ? ', a sample' : ''))),
        segBar(s),
        el('span', { class: 'ss-s' }, s.segs.map(function (g) { return g.k + ' ' + g.min; }).join(' · ') + (hd ? ' · ' + Math.round(hd / s.min * 100) + '% hard' : '')));
      if (s.load && s.load.length) row.appendChild(el('span', { class: 'row-s' }, 'Loads ' + s.load.map(T.regionName).map(function (n) { return n.toLowerCase(); }).join(', ')));
      row.appendChild(el('button', { class: 'hud-l warn ss-x', on: { click: function () { T.deleteSession(s.id); } } }, 'remove'));
      listEl.appendChild(row);
    });
  }
  function paintForm() {
    T.clear(formEl);
    formEl.appendChild(el('p', { class: 'mod-t' }, 'Log a session'));
    var kind = el('select', { class: 'in', 'aria-label': 'Kind of session' });
    Object.keys(SPORTS).forEach(function (k) { kind.appendChild(el('option', { value: k }, SPORTS[k].label)); });
    var segs = el('div', { class: 'ss-f' });
    function fill() {
      T.clear(segs);
      (SPORTS[kind.value].segs).forEach(function (g) {
        segs.appendChild(el('label', { class: 'ss-fl' }, el('span', null, g[0]), el('input', { class: 'in', type: 'number', min: '0', max: '300', value: String(g[1]), 'data-k': g[0], 'aria-label': g[0] + ' minutes' })));
      });
    }
    kind.addEventListener('change', fill); fill();
    var when = el('input', { class: 'in', type: 'datetime-local', 'aria-label': 'When', value: (function () { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); })() });
    var save = el('button', { class: 'hud-l on', on: { click: function () {
      var sg = T.$$('input[data-k]', segs).map(function (i) { return { k: i.getAttribute('data-k'), min: +i.value || 0 }; }).filter(function (g) { return g.min > 0; });
      if (!sg.length) { T.toast('Give at least one segment some minutes.'); return; }
      var s = T.logSession({ kind: kind.value, segs: sg, at: when.value ? new Date(when.value).toISOString() : null });
      T.toast('Logged ' + s.label + ', ' + s.min + ' min. The plan takes a recovery slot off that day.');
    } } }, 'Save');
    formEl.appendChild(el('div', { class: 'ss-row' }, kind, when));
    formEl.appendChild(segs);
    formEl.appendChild(save);
  }
  function paintSitting() {
    T.clear(sitEl);
    var sit = T.sitting();
    sitEl.appendChild(el('p', { class: 'mod-t' }, 'Sitting'));
    sitEl.appendChild(el('p', { class: 'row-s', style: { 'white-space': 'normal' } }, !sit ? 'Nothing has moved you yet, by this record.' : sit.stale ? 'No movement logged today; the last was ' + T.ago(sit.since) + ' ago.' : ('Last moved ' + T.ago(sit.since) + ' ago' + (sit.long ? '; time to stand.' : '.'))));
    sitEl.appendChild(el('button', { class: 'hud-l', on: { click: function () { T.moved(); T.toast('Noted. Sitting starts again from now.'); } } }, 'I moved'));
    var br = T.breaksToday();
    if (br.length) {
      sitEl.appendChild(el('p', { class: 'mod-t', style: { 'margin-top': '.9rem' } }, 'Breaks today'));
      br.forEach(function (b) { sitEl.appendChild(el('p', { class: 'row-s', style: { 'white-space': 'normal' } }, b.title + ' — ' + b.why)); });
    }
    sitEl.appendChild(el('p', { class: 'row-s', style: { 'margin-top': '.9rem', color: 'var(--ink-3)', 'white-space': 'normal' } }, 'General mobility ideas, not medical advice. Stop with pain.'));
  }
  function paintClock() {
    var cv = clockEl, rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    var W = cv.clientWidth || 240, Hh = W + rem * 2.4, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr);
    var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
    var by = T.segmentsByHour(), keys = Object.keys(by).sort(function (a, b) { return T.segAlpha(a) - T.segAlpha(b); });
    var series = keys.map(function (k) { return { vals: by[k], col: INK, a: T.segAlpha(k), name: k }; });
    T.drawRose(g, W / 2, W / 2, W / 2 - rem * 0.4, series, { rem: rem, caption: 'Training by hour', sub: series.length ? 'lighter is easier, bouts darkest' : 'no sessions yet' });
  }
  function paintAll() { if (!host || host.hidden) return; paintFigures(); paintSessions(); paintSitting(); paintClock(); }

  T.renderBody = function () { paintAll(); };
  T.bodyOpen = function () { return !!host && !host.hidden; };
  T.openBody = function (region) {
    if (!host) return;
    if (T.closeAsk) T.closeAsk();
    host.hidden = false; document.documentElement.classList.add('bodying');
    if (T.sfx) T.sfx('open');
    paintAll();
    if (region) { var r = T.$('.bm-r[aria-label^="' + T.regionName(region) + '"]', host); if (r) r.focus(); }
  };
  T.closeBody = function () { if (!host || host.hidden) return; host.hidden = true; document.documentElement.classList.remove('bodying'); if (T.sfx) T.sfx('close'); };
  T.initBody = function () {
    host = T.$('#m-body'); if (!host) return;
    figEl = T.$('#bodyFig'); listEl = T.$('#bodyList'); formEl = T.$('#bodyForm'); clockEl = T.$('#cvBody'); sitEl = T.$('#bodySit');
    paintForm();
    T.on('body', paintAll); T.on('activity', paintAll);
    T.$('#bodyX').addEventListener('click', T.closeBody);
    window.addEventListener('resize', function () { if (!host.hidden) paintClock(); });
    if ((location.hash || '') === '#body') setTimeout(T.openBody, 60);
  };
})();
