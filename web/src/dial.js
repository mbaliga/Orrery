/* dial: the phone's camera. Two rings share one centre on the canvas. The near ring (bottom in portrait, right in
   landscape) is the lens: turn it and what you are looking at changes — all work, a project, a group, an agent, a
   module. The far ring (top, or left) is how close: now, today, three days, the month, the year. What the two rings
   frame is drawn between them. Turn a ring by dragging along it, tap a stop to go there, or roll a wheel; a tick
   sounds at each stop. The watch companion has the same two controls on its bezel. */
(function () {
  'use strict';
  var T = window.T, S = T.S, E = T.E, G = T.G, el = T.el;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  var LEVELS = [['now', 'Now', 'What is in front of you this slot, and what comes after it'], ['today', 'Today', 'The day as planned, slot by slot'], ['days', '3 days', 'The rolling three-day sprint'],
    ['month', 'Month', 'The runways to what is dated in the next four months'], ['year', 'Year', 'The last fourteen weeks of commits and everything dated ahead']];
  var D = { host: null, cv: null, g: null, body: null, W: 0, H: 0, rem: 16, cx: 0, cy: 0, R: 0, items: [], rot: 0, lrot: 1, drag: null, raf: 0, dpr: 1, on: false, land: false,
    lvl: T.store.get('dialLevel', 'today'), anim: null };

  function items() {
    var out = [{ id: null, name: 'All work', col: null }], seen = {};
    function add(id) { if (seen[id]) return; var e = E.get(id); if (!e) return; seen[id] = 1; var c = T.tint ? T.tint(e) : null; out.push({ id: id, name: e.name, e: e, col: c ? (/^(#|rgb|hsl)/.test(c) ? c : 'rgb(' + c + ')') : null }); }
    var order = (G.clusters || []).map(function (c) { return c[0]; });
    order.forEach(function (ck) {
      add('c:' + ck);
      G.projects.filter(function (p) { return p.cluster === ck; }).forEach(function (p) { add('p:' + p.id); });
    });
    G.projects.forEach(function (p) { add('p:' + p.id); });
    E.forEach(function (e, id) { if (e.band === 'a') add(id); });
    E.forEach(function (e, id) { if (e.band === 's') add(id); });
    return out;
  }
  function indexOf(id) { for (var i = 0; i < D.items.length; i++) if (D.items[i].id === id) return i; return 0; }
  function levelIndex() { for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i][0] === D.lvl) return i; return 1; }

  // ---------------------------------------------------------------- geometry: one centre, two rings
  function size() {
    if (!D.host) return;
    var r = D.host.getBoundingClientRect();
    D.W = Math.max(1, Math.round(r.width)); D.H = Math.max(1, Math.round(r.height));
    D.on = D.W > 2 && D.H > 2;
    D.rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    D.dpr = Math.min(2, window.devicePixelRatio || 1);
    D.cv.width = Math.round(D.W * D.dpr); D.cv.height = Math.round(D.H * D.dpr);
    D.land = D.W > D.H * 1.1;
    D.cx = D.W / 2; D.cy = D.H / 2;
    // the rings stand just inside the long edges; their centre is the canvas's own
    D.R = (D.land ? D.W / 2 : D.H / 2) - D.rem * 1.1;
    var across = (D.land ? D.H / 2 : D.W / 2) - D.rem * 0.6;
    D.span = Math.asin(Math.min(1, across / D.R));          // half the visible arc, in radians
    D.base = D.land ? 0 : Math.PI / 2;                       // where the lens ring's stop sits: right, or bottom
    D.lbase = D.land ? Math.PI : -Math.PI / 2;               // the level ring's stop: left, or top
    D.pitch = (D.rem * 7.2) / D.R;                           // one lens stop to the next
    D.lpitch = (D.span * 1.7) / (LEVELS.length - 1);         // the levels fill most of the far ring
    // the body between the rings
    var pad = D.rem * 4.2;
    if (D.land) { D.body.style.left = pad + 'px'; D.body.style.right = pad + 'px'; D.body.style.top = D.rem * 0.6 + 'px'; D.body.style.bottom = D.rem * 0.6 + 'px'; }
    else { D.body.style.top = pad + 'px'; D.body.style.bottom = pad + 'px'; D.body.style.left = D.rem * 0.9 + 'px'; D.body.style.right = D.rem * 0.9 + 'px'; }
    kick();
  }
  function angOf(x, y) { return Math.atan2(y - D.cy, x - D.cx); }
  function adiff(a, b) { var d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

  // ---------------------------------------------------------------- drawing
  function kick() { if (!D.raf) D.raf = requestAnimationFrame(frame); }
  function frame(now) {
    D.raf = 0;
    if (!D.on || S.view !== 'dial') return;
    var busy = false;
    if (D.anim) { busy = !D.anim(now); if (!busy) D.anim = null; }
    draw();
    if (busy) kick();
  }
  function ink(a) { return 'rgba(' + (T.INK_RGB || '236,232,228') + ',' + a + ')'; }
  function draw() {
    var g = D.g, rem = D.rem;
    g.setTransform(D.dpr, 0, 0, D.dpr, 0, 0);
    g.clearRect(0, 0, D.W, D.H);
    ring(g, D.base, D.span, D.R, D.items, D.rot, D.pitch, true);
    ring(g, D.lbase, D.span, D.R, LEVELS.map(function (l) { return { id: l[0], name: l[1] }; }), D.lrot, D.lpitch, false);
    void rem;
  }
  // a ring: a hairline arc, its stops set along the inside as marks on a lens barrel, the one at the base upright and lit
  function ring(g, base, span, R, list, rot, pitch, lens) {
    var rem = D.rem;
    g.strokeStyle = ink(0.16); g.lineWidth = 1;
    g.beginPath(); g.arc(D.cx, D.cy, R, base - span, base + span); g.stroke();
    // the pointer at the base: a short radial mark just outside the ring
    g.strokeStyle = lens ? ink(0.7) : 'rgba(168,160,255,.85)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(D.cx + Math.cos(base) * (R + rem * 0.2), D.cy + Math.sin(base) * (R + rem * 0.2)); g.lineTo(D.cx + Math.cos(base) * (R + rem * 0.75), D.cy + Math.sin(base) * (R + rem * 0.75)); g.stroke();
    var fs = lens ? rem * 0.86 : rem * 0.72;
    g.font = (lens ? '400 ' : '500 ') + fs + 'px ' + (getComputedStyle(document.documentElement).getPropertyValue('--sans') || 'system-ui, sans-serif');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (var i = 0; i < list.length; i++) {
      var d = (i - rot) * pitch, a = base + d;   // unwrapped: a long barrel, never a wheel that comes round again
      if (Math.abs(d) > span + pitch) continue;
      var near = clamp(1 - Math.abs(d) / span, 0, 1), sel = Math.abs(i - rot) < 0.5, it = list[i];
      var tx = D.cx + Math.cos(a) * (R - rem * 1.05), ty = D.cy + Math.sin(a) * (R - rem * 1.05);
      // the tick on the ring
      g.strokeStyle = ink(0.12 + 0.3 * near); g.lineWidth = 1;
      g.beginPath(); g.moveTo(D.cx + Math.cos(a) * (R - rem * 0.28), D.cy + Math.sin(a) * (R - rem * 0.28)); g.lineTo(D.cx + Math.cos(a) * R, D.cy + Math.sin(a) * R); g.stroke();
      g.save(); g.translate(tx, ty);
      // text set along the ring, reading the right way up at the base
      g.rotate(a - base - (D.land ? Math.PI / 2 : 0));
      // far from the stop a name would only crowd its neighbours: the ring shows ticks there, names near the base
      if (lens && near < 0.35 && !sel) { g.restore(); continue; }
      var col = sel ? (lens ? (it.col || ink(1)) : 'rgba(168,160,255,1)') : ink(lens ? 0.2 + 0.55 * (near - 0.35) / 0.65 : 0.3 + 0.4 * near);
      g.fillStyle = col;
      var name = it.name.length > 13 ? it.name.slice(0, 12) + '…' : it.name;
      g.fillText(name, 0, 0);
      if (lens && it.id && it.col) { var w = g.measureText(name).width; T.cell(g, -w / 2 - rem * 0.55, 0, rem * 0.22, it.id, { fill: it.col, alpha: sel ? 1 : 0.3 + 0.5 * near }); }
      g.restore();
    }
  }

  // ---------------------------------------------------------------- turning
  function whichRing(x, y) {
    var r = Math.hypot(x - D.cx, y - D.cy); if (r < D.R - D.rem * 2.6) return null;
    var a = angOf(x, y);
    return Math.abs(adiff(a, D.base)) < Math.abs(adiff(a, D.lbase)) ? 'lens' : 'level';
  }
  function settle(ring) {
    var isL = ring === 'lens', n = isL ? D.items.length : LEVELS.length, cur = isL ? D.rot : D.lrot;
    var to = clamp(Math.round(cur), 0, n - 1), from = cur, t0 = performance.now();
    D.anim = function (now) { var t = clamp((now - t0) / 220, 0, 1), e = 1 - Math.pow(1 - t, 3); var v = from + (to - from) * e; if (isL) D.rot = v; else D.lrot = v; return t >= 1; };
    kick();
    if (isL) { var it = D.items[to]; if ((S.lens || null) !== it.id) { T.setLens(it.id); } }
    else { var lv = LEVELS[to][0]; if (lv !== D.lvl) { D.lvl = lv; T.store.set('dialLevel', lv); if (T.sfx) T.sfx('select'); renderBody(); } }
  }
  function onDown(ev) {
    var p = local(ev), ring = whichRing(p[0], p[1]); if (!ring) return;
    ev.preventDefault();
    D.anim = null;
    D.drag = { ring: ring, a0: angOf(p[0], p[1]), rot0: ring === 'lens' ? D.rot : D.lrot, last: Math.round(ring === 'lens' ? D.rot : D.lrot), moved: false, t: Date.now() };
    D.cv.setPointerCapture && D.cv.setPointerCapture(ev.pointerId);
  }
  function onMove(ev) {
    var d = D.drag; if (!d) return;
    var p = local(ev), a = angOf(p[0], p[1]), da = adiff(a, d.a0);
    // the stops follow the finger round the ring, both ways: pulling the far side of a bottom ring still turns it
    var pitch = d.ring === 'lens' ? D.pitch : D.lpitch, n = d.ring === 'lens' ? D.items.length : LEVELS.length;
    var v = d.rot0 - da / pitch; if (Math.abs(da) > 0.02) d.moved = true;
    v = v < 0 ? v * 0.35 : v > n - 1 ? (n - 1) + (v - (n - 1)) * 0.35 : v;   // soft ends
    if (d.ring === 'lens') D.rot = v; else D.lrot = v;
    var at = Math.round(clamp(v, 0, n - 1)); if (at !== d.last) { d.last = at; if (T.sfx) T.sfx('tick'); }
    kick();
  }
  function onUp(ev) {
    var d = D.drag; if (!d) return; D.drag = null;
    if (!d.moved) {   // a tap: go to the stop under the finger
      var p = local(ev), a = angOf(p[0], p[1]), isL = d.ring === 'lens', base = isL ? D.base : D.lbase, pitch = isL ? D.pitch : D.lpitch;
      var i = Math.round((isL ? D.rot : D.lrot) + adiff(a, base) / pitch);
      if (isL) D.rot = clamp(i, 0, D.items.length - 1) + 0.01; else D.lrot = clamp(i, 0, LEVELS.length - 1) + 0.01;
    }
    settle(d.ring);
  }
  function onWheel(ev) {
    var p = local(ev), ring = whichRing(p[0], p[1]) || 'lens';
    ev.preventDefault();
    var dv = (ev.deltaMode === 1 ? ev.deltaY * 33 : ev.deltaY) / 80, n = ring === 'lens' ? D.items.length : LEVELS.length;
    if (ring === 'lens') D.rot = clamp(D.rot + dv, 0, n - 1); else D.lrot = clamp(D.lrot + dv, 0, n - 1);
    clearTimeout(D.wt); D.wt = setTimeout(function () { settle(ring); }, 140);
    kick();
  }
  function local(ev) { var r = D.cv.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }

  // ---------------------------------------------------------------- what the rings frame
  function inLens(pid) { return T.inLens(pid); }
  function row(it, part, i) {
    var r = el('li', { class: 'pd-i k-' + it.kind, role: 'button', tabindex: '0', on: { click: function (ev) { if (it.t) T.openTask(it.id, ev.currentTarget); else if (it.sched) T.openTask(it.sched.id, ev.currentTarget); } } });
    r.appendChild(el('span', { class: 'mk', html: T.planMark(it.kind, it.id) }));
    var sub = [T.projectName(it.p)];
    if (part && part.slots !== it.size) sub.push(part.slots + ' of ' + it.size + ' slots'); else if (it.size > 1) sub.push(it.size + ' slots');
    if (it.due) sub.push('by ' + T.dm(new Date(it.due)));
    r.appendChild(el('span', { class: 'pd-b' }, el('span', { class: 'pd-t' }, (it.kind === 'brief' ? 'Brief: ' : it.kind === 'review' ? 'Review: ' : '') + it.title), el('span', { class: 'pd-s2' }, sub.join(' · '))));
    void i;
    return r;
  }
  function dayList(host, i, limit) {
    var plan = T.plan(), d = plan.days[i], list = el('ol', { class: 'pd-l' }), n = 0;
    (T.dayExtras(d.k, i) || []).filter(function (x) { return x.kind === 'fixed' || x.kind === 'session'; }).forEach(function (x) {
      if (limit && n >= limit) return; n++;
      list.appendChild(el('li', { class: 'pd-i k-fixed' }, el('span', { class: 'mk', html: T.planMark('fixed', x.title || 'fixed') }), el('span', { class: 'pd-b' }, el('span', { class: 'pd-t' }, x.title), el('span', { class: 'pd-s2' }, x.sub || (x.at ? T.pad(x.at.getHours()) + ':' + T.pad(x.at.getMinutes()) : '')))));
    });
    d.items.forEach(function (part) { if (!inLens(part.it.p) || (limit && n >= limit)) return; n++; list.appendChild(row(part.it, part, i)); });
    if (!n) list.appendChild(el('li', { class: 'pd-e' }, 'Nothing planned here' + (S.lens ? ' for this lens' : '') + '.'));
    host.appendChild(list);
    return n;
  }
  function head(host, k, t, s) {
    host.appendChild(el('header', { class: 'dl-h' }, el('span', { class: 'dl-k' }, k), el('h2', { class: 'dl-t' }, t), s ? el('p', { class: 'dl-s' }, s) : null));
  }
  function renderBody() {
    var host = D.body; if (!host) return;
    T.clear(host);
    var d = T.describe(S.lens), lv = D.lvl, plan = T.plan();
    head(host, LEVELS[levelIndex()][1] + (S.lens ? ' · lens' : ''), d.title, d.sub);
    if (lv === 'now') {
      var day = plan.days[0], now = new Date(), cur = null, next = [];
      day.items.forEach(function (part) { if (!inLens(part.it.p)) return; if (!cur) cur = part; else if (next.length < 3) next.push(part); });
      var card = el('section', { class: 'dl-now' });
      if (cur) {
        card.appendChild(el('span', { class: 'dl-k' }, 'In front of you'));
        card.appendChild(el('p', { class: 'dl-big', on: { click: function (ev) { if (cur.it.t) T.openTask(cur.it.id, ev.currentTarget); } } }, cur.it.title));
        card.appendChild(el('p', { class: 'dl-s' }, T.projectName(cur.it.p) + ' · ' + cur.slots + (cur.slots === 1 ? ' slot' : ' slots') + (cur.it.due ? ' · by ' + T.dm(new Date(cur.it.due)) : '')));
      } else card.appendChild(el('p', { class: 'dl-s' }, 'Nothing planned for this slot' + (S.lens ? ' in this lens' : '') + '. ' + T.pad(now.getHours()) + ':' + T.pad(now.getMinutes()) + '.'));
      host.appendChild(card);
      if (next.length) { host.appendChild(el('span', { class: 'dl-k' }, 'Then')); var ol = el('ol', { class: 'pd-l' }); next.forEach(function (p) { ol.appendChild(row(p.it, p, 0)); }); host.appendChild(ol); }
      if (T.renderCheckin) T.renderCheckin(host, true);
    } else if (lv === 'today') {
      var d0 = plan.days[0];
      host.appendChild(el('p', { class: 'dl-s' }, d0.used + ' of ' + d0.cap + ' slots planned' + (d0.notes.length ? ' · ' + d0.notes.join('; ') : '')));
      dayList(host, 0);
    } else if (lv === 'days') {
      for (var i = 0; i < 3; i++) {
        var dd = plan.days[i], date = new Date(dd.k + 'T12:00:00');
        host.appendChild(el('span', { class: 'dl-k' }, (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : 'Day after') + ' · ' + T.DAY[date.getDay()].slice(0, 3) + ' ' + T.dm(date) + ' · ' + dd.used + '/' + dd.cap));
        dayList(host, i, 6);
      }
    } else if (lv === 'month') {
      var wrap = el('div', { class: 'dl-gantt' });
      host.appendChild(wrap);
      T.renderRunways(wrap, { rows: 14, height: D.rem * 18, only: T.lensProjects() });
    } else if (lv === 'year') {
      // the last fourteen weeks of commits, for the lens: one cell a week
      var weeks = {}, set = T.lensProjects();
      G.projects.forEach(function (p) { if (set && !set.has(p.id)) return; Object.keys(p.weeks || {}).forEach(function (w) { var v = p.weeks[w], n = typeof v === 'number' ? v : Object.keys(v || {}).reduce(function (a, k) { return a + (v[k] || 0); }, 0); weeks[w] = (weeks[w] || 0) + n; }); });
      var keys = Object.keys(weeks).sort().slice(-14), max = 1; keys.forEach(function (k) { max = Math.max(max, weeks[k]); });
      var strip = el('div', { class: 'dl-weeks', 'aria-label': 'Commits a week, the last fourteen weeks' });
      keys.forEach(function (k) { var v = weeks[k]; strip.appendChild(el('span', { class: 'dl-wk', title: k + ': ' + v + ' commits', html: '<svg viewBox="-7 -7 14 14" aria-hidden="true">' + T.cellMark(k, { fill: v ? 'rgba(214,244,186,' + (0.25 + 0.75 * v / max) + ')' : 'rgba(236,232,228,.12)' }) + '</svg>' })); });
      host.appendChild(el('span', { class: 'dl-k' }, 'Fourteen weeks of commits')); host.appendChild(strip);
      host.appendChild(el('span', { class: 'dl-k' }, 'Dated, ahead'));
      var ol = el('ol', { class: 'pd-l' }), n = 0;
      plan.runways.forEach(function (r) {
        var pid = r.s.p || (r.items[0] && r.items[0].p); if (set && pid && !set.has(pid)) return; if (n >= 12) return; n++;
        ol.appendChild(el('li', { class: 'pd-i k-' + (r.s.hard ? 'hard' : 'plan'), role: 'button', tabindex: '0', on: { click: function (ev) { T.openTask(r.id, ev.currentTarget); } } },
          el('span', { class: 'mk', html: T.planMark(r.s.hard ? 'hard' : 'plan', r.id) }),
          el('span', { class: 'pd-b' }, el('span', { class: 'pd-t' }, r.s.title), el('span', { class: 'pd-s2' }, T.dm(r.at) + (r.slots ? ' · ' + r.slots + ' slots' : '') + (r.late ? ' · ' + r.late + 'd late' : '')))));
      });
      if (!n) ol.appendChild(el('li', { class: 'pd-e' }, 'Nothing dated ahead' + (S.lens ? ' in this lens' : '') + '.'));
      host.appendChild(ol);
    }
    host.appendChild(el('p', { class: 'dl-hint' }, T.info ? T.info('Two rings, one centre. The near ring is the lens: turn it to look at all work, a project, a group, an agent or a module. The far ring is how close: now, today, three days, the month, the year. Drag along a ring, tap a stop, or roll a wheel. The watch companion has the same two rings on its bezel.', 'About the dial') : null, el('span', { class: 'dl-ht' }, LEVELS[levelIndex()][2])));
  }
  T.dialProbe = function () { return D; };
  T.renderCamera = function () { if (!D.host) return; if (S.view !== 'dial') return; size(); renderBody(); };

  // ---------------------------------------------------------------- init
  T.initDial = function () {
    D.host = T.$('#m-dial'); if (!D.host) return;
    D.cv = T.$('#cvDial'); D.g = D.cv.getContext('2d'); D.body = T.$('#dialBody');
    D.items = items();
    D.rot = indexOf(S.lens); D.lrot = levelIndex();
    D.cv.addEventListener('pointerdown', onDown); D.cv.addEventListener('pointermove', onMove); D.cv.addEventListener('pointerup', onUp); D.cv.addEventListener('pointercancel', onUp);
    D.cv.addEventListener('wheel', onWheel, { passive: false });
    T.on('lens', function () { if (!D.drag && !D.anim) D.rot = indexOf(S.lens); if (S.view === 'dial') { renderBody(); kick(); } });
    ['tasks', 'plan', 'routine', 'checkin', 'notes'].forEach(function (ev) { T.on(ev, function () { if (S.view === 'dial') renderBody(); }); });
    window.addEventListener('resize', function () { if (S.view === 'dial') size(); });
    T.on('view', function () { if (S.view === 'dial') { size(); renderBody(); } });
  };
})();
