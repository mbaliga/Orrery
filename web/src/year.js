/* year: twelve months around a circle, today at the top, and your work in the middle as a graph you can turn.
   Each month is a small calendar page: the days of the week run clockwise and its weeks run inward. A day's mark is
   its commits: the radium core is yours and the cyan around it is the agents', by area. What is dated sits on its
   day: a fixed deadline is a diamond, a planned date a ring, something to send a square, and violet is what waits
   on you. Inside the ring, the publishing sprint and each month's total. In the middle, every project with what it
   is made of, who made it and where it runs, pulled together by what is built with what. Point at a project and the
   weeks it moved light up around the year; point at a day and that week's projects light up in the middle. */
(function () {
  'use strict';
  var T = window.T, G = T.G, S = T.S, E = T.E, SEED = T.SEED, el = T.el;
  var DAY = 864e5, TAU = Math.PI * 2;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var INK = [236, 232, 228], RAD = [199, 239, 158], CYAN = [53, 224, 255], VIO = [142, 123, 255], VIOH = [165, 147, 255];
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rgba(c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + clamp(a, 0, 1).toFixed(3) + ')'; }
  function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function rng(seed) { var x = Math.floor(seed * 2147483646) + 1; return function () { x = x * 16807 % 2147483647; return (x - 1) / 2147483646; }; }
  function dkey(d) { return d.getFullYear() + '-' + T.pad(d.getMonth() + 1) + '-' + T.pad(d.getDate()); }
  function fromKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function mondayOf(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return dkey(x); }
  var WD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  var Y = { open: false, W: 0, H: 0, dpr: 1, rem: 16, cx: 0, cy: 0, R0: 0, R1: 0, rowH: 0, gap: 0.011, rot: 0, months: [],
    hover: null, pin: null, lit: null, cache: null, cacheKey: '', raf: 0, last: 0, today: '',
    yaw: 0.4, pitch: -0.32, spin: true, over: false, drag: null, nodes: [], links: [], byId: {}, gR: 0, gmode: T.store.get('yearMode', '3d'), mini: null };   // mini: null = by itself when part of the graph is out of view
  var GE = null;   // the graph engine, from the shared kit
  var host, cv, g, cardEl, keyEl, legendEl, rangeEl, sprintEl, runEl, leftEl, sideEl, lay = 'side';

  // ---------------------------------------------------------------- the record, by day
  var daily = {}, maxDay = 1;
  G.days.forEach(function (r) { var you = r[1], ag = r[2] + r[3] + r[4]; daily[r[0]] = { you: you, ag: ag }; maxDay = Math.max(maxDay, you + ag); });
  var recFrom = G.days[0][0], recTo = G.days[G.days.length - 1][0];
  // what is dated, by day: the schedule ahead, and what already shipped
  var RANK = { hard: 4, plan: 3, send: 2, done: 1 };
  var dated = {};
  function addDated(k, it) { (dated[k] = dated[k] || []).push(it); }
  SEED.schedule.forEach(function (s) { addDated(dkey(new Date(s.at)), { kind: s.hard ? 'hard' : s.minor ? 'send' : 'plan', s: s, title: s.title, ps: [s.p] }); });
  (SEED.tasks || []).forEach(function (t) { if (t.status === 'done' && t.at && t.real) addDated(t.at.slice(0, 10), { kind: 'done', s: t, title: t.title, ps: [t.p].concat(t.also || []) }); });
  Object.keys(dated).forEach(function (k) { dated[k].sort(function (a, b) { return RANK[b.kind] - RANK[a.kind]; }); });
  // the publishing pulse: posts on set days through the sprint
  var pulse = {};
  (function () {
    var pu = SEED.pulse; if (!pu) return;
    for (var d = fromKey(pu.from), end = fromKey(pu.to); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      var k = dkey(d);
      if (pu.days.indexOf(d.getDay()) >= 0 && pu.off.indexOf(k) < 0) pulse[k] = true;
    }
  })();
  // each project's weeks, Monday by Monday
  function weeksOf(pid) { var p = T.P.get(pid); return p && p.weeks ? Object.keys(p.weeks).filter(function (w) { var c = p.weeks[w]; return Object.keys(c).some(function (k) { return c[k] > 0; }); }) : []; }
  function weekTotal(pid, w) { var p = T.P.get(pid), c = p && p.weeks && p.weeks[w]; if (!c) return 0; var n = 0; Object.keys(c).forEach(function (k) { n += c[k]; }); return n; }
  function gatesOpen(s) { try { return T.openGates(s.id).length; } catch (e) { return 0; } }

  // ---------------------------------------------------------------- the months, laid around the circle
  function months(now) {
    var start = new Date(now.getFullYear(), now.getMonth() - 5, 1), out = [], total = 0;
    for (var i = 0; i < 12; i++) {
      var m0 = new Date(start.getFullYear(), start.getMonth() + i, 1), m1 = new Date(start.getFullYear(), start.getMonth() + i + 1, 1);
      var days = Math.round((m1 - m0) / DAY), lead = (m0.getDay() + 6) % 7;
      out.push({ y: m0.getFullYear(), m: m0.getMonth(), d0: m0, days: days, lead: lead, rows: Math.ceil((lead + days) / 7) });
      total += days;
    }
    var a = 0;
    out.forEach(function (m) { m.a0 = a; m.span = m.days / total * TAU; a += m.span; m.colW = (m.span - Y.gap) / 7; });
    return out;
  }
  function cellAng(m, d) { var i = m.lead + d - 1; return Y.rot + m.a0 + Y.gap / 2 + (i % 7 + 0.5) * m.colW; }
  function cellRad(m, d) { var i = m.lead + d - 1; return Y.R1 - (Math.floor(i / 7) + 0.5) * Y.rowH; }
  // inside the ring, time runs evenly through each month, for the sprint and the totals
  function linAng(d) {
    for (var i = 0; i < Y.months.length; i++) {
      var m = Y.months[i];
      if (d.getFullYear() === m.y && d.getMonth() === m.m) return Y.rot + m.a0 + Y.gap / 2 + ((d.getDate() - 1) + d.getHours() / 24) / m.days * (m.span - Y.gap);
    }
    return null;
  }
  function monthOf(d) { for (var i = 0; i < Y.months.length; i++) { var m = Y.months[i]; if (d.getFullYear() === m.y && d.getMonth() === m.m) return m; } return null; }

  // ---------------------------------------------------------------- the graph in the middle
  function buildGraph() {
    var N = [], byId = {}, L = [], seen = {};
    function node(id) {
      if (byId[id]) return byId[id];
      var e = E.get(id); if (!e) return null;
      var n = { id: id, e: e, band: e.band, deg: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, i: N.length };
      N.push(n); byId[id] = n; return n;
    }
    G.projects.forEach(function (p) { node('p:' + p.id); });
    T.links.forEach(function (l) {
      var a = node(l.a), b = node(l.b), k = l.a + '|' + l.b;
      if (!a || !b || seen[k]) return;
      seen[k] = 1; a.deg++; b.deg++;
      L.push({ a: a, b: b, band: l.band });
    });
    // notes sit beside what they are about, by the links the compiler made
    (T.notes || []).forEach(function (q) {
      var ls = (q.links || []).filter(function (id) { return E.has(id) && byId[id]; });
      if (!ls.length) return;
      var n = { id: 'q:' + q.id, e: { name: q.text.length > 44 ? q.text.slice(0, 43) + '\u2026' : q.text, band: 'q' }, q: q, band: 'q', deg: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, i: N.length };
      N.push(n); byId[n.id] = n;
      ls.forEach(function (id) { var b = byId[id]; n.deg++; b.deg++; L.push({ a: n, b: b, band: 'q' }); });
    });
    var maxC = 1;
    N.forEach(function (n) { if (n.band === 'p') maxC = Math.max(maxC, n.e.p.commits || 0); });
    N.forEach(function (n) {
      if (n.band === 'p') {
        var p = n.e.p, you = 0, ag = 0;
        Object.keys(p.weeks || {}).forEach(function (w) { var c = p.weeks[w]; you += c.person || 0; ag += (c.claude || 0) + (c.codex || 0) + (c.named || 0); });
        var share = you + ag ? you / (you + ag) : 0.5;
        n.size = 0.5 + 1.5 * Math.sqrt((p.commits || 0) / maxC);
        n.col = p.src === 'notes' ? INK : share >= 0.5 ? mix(INK, RAD, 0.3 + 0.6 * (share - 0.5) * 2) : mix(INK, CYAN, 0.25 + 0.6 * (0.5 - share) * 2);
        n.notes = p.src === 'notes';
      } else if (n.band === 'q') { n.size = 0.5; n.col = INK; }
      else {
        n.size = 0.32 + 0.16 * Math.sqrt(n.deg);
        var tn = T.tint ? T.tint(n.e) : null;
        n.col = n.band === 'a' ? (n.e.kind === 'person' ? RAD : CYAN) : (tn && tn !== '236,232,228' ? tn.split(',').map(Number) : INK);
      }
    });
    // the shared engine lays it out, projects it and owns the interactions; the drawing stays here
    if (GE) GE.destroy();
    GE = ASOC.Graph.create({
      nodes: N.map(function (n) { n.group = n.band === 'p' ? n.e.p.cluster : null; return n; }),
      links: L.map(function (l) { return { a: l.a.id, b: l.b.id, band: l.band, hub: l.band === 'a' || l.band === 'n' || l.band === 'h' ? 0.1 : l.band === 'l' ? 0.4 : l.band === 'q' ? 1.6 : 1 }; }),
      mode: Y.gmode,
      options: { hull: true, snap: true, history: true, forceDrag: true, fixSize: true, minZoom: 0.5, maxZoom: 3.2,
        within: function (x, y) { var dx = x - Y.cx, dy = y - Y.cy; return Math.sqrt(dx * dx + dy * dy) < Y.R0 - Y.rem * 0.6; },
        bounds: function () { var r = Y.gR * 0.92; return { x: Y.cx - r, y: Y.cy - r, w: r * 2, h: r * 2 }; }, keep: 0.4 },
      on: {
        hover: function (id) { var h = id ? { kind: 'node', id: id } : null; if (!same(h, Y.hover)) { Y.hover = h; if (h && T.sfx) T.sfx('hover'); setLit(); } Y.over = !!id; kick(); },
        select: function (ids) { Y.pin = ids.length === 1 ? { kind: 'node', id: ids[0] } : null; Y.sel = ids; if (ids.length && T.sfx) T.sfx('select'); setLit(); kick(); },
        focus: function (id) { Y.spin = false; if (T.sfx) T.sfx('open'); },
        change: function (kind) { if (kind === 'collapse' || kind === 'expand' || kind === 'mode') { Y.spin = false; paintLegend(); } kick(); },
        tooltip: function (id, x, y) { if (id && id.indexOf('q:') !== 0 && E.get(id) && x != null) T.tip.show(T.describeNode(id), x, y); else T.tip.hide(); },
        context: function (id, x, y) { contextMenu(id, x, y); },
        link: function (a, b) { noteLink(a, b); },
        rename: function (id) { var n = Y.byId[id]; if (n && n.q) T.noteTools(n.q, null); }
      },
      onFrame: function () { kick(); }
    });
    GE.state.yaw = Y.yaw; GE.state.pitch = Y.pitch;
    GE.layout(420);
    if (Y.gmode === '2d') { GE.state.mode = '3d'; GE.setMode('2d', true); GE.state.morph = null; }
    GE.attach(cv);
    paintTools(); paintLegend();
    Y.nodes = GE.state.nodes; Y.links = GE.state.links; Y.byId = GE.state.byId;
  }
  function project(n) { /* the engine projects every node each frame */ void n; }
  // a note dragged onto something with shift ties the two (CreateEdge)
  function noteLink(a, b) {
    var qa = a.indexOf('q:') === 0 ? Y.byId[a] : null, qb = b.indexOf('q:') === 0 ? Y.byId[b] : null;
    var q = qa ? qa.q : qb ? qb.q : null, target = qa ? b : qb ? a : null;
    if (!q || !target || !E.has(target)) { T.toast('Drag a note onto a project, a module or a platform to tie them.'); return; }
    if ((q.links || []).indexOf(target) < 0) { q.links = (q.links || []).concat([target]); q.why = q.why || {}; q.why[target] = 'you'; T.saveNotes(); T.toast('Tied the note to ' + E.get(target).name + '.'); if (T.sfx) T.sfx('done'); }
  }
  // right-click: what you can do to a node
  function contextMenu(id, x, y) {
    var n = id && Y.byId[id];
    T.openPop({ getBoundingClientRect: function () { return { left: x, right: x, top: y, bottom: y, width: 0, height: 0 }; } }, function (pop) {
      function act(label, fn) { pop.appendChild(el('button', { class: 'hud-l', style: { display: 'block', margin: '.3rem 0' }, on: { click: function () { T.closePop(); fn(); } } }, label)); }
      if (n) {
        pop.appendChild(el('b', { style: { display: 'block', 'margin-bottom': '.4rem' } }, n.e ? n.e.name : id));
        if (E.has(id)) act(S.lens === id ? 'Clear the lens' : 'Make it the lens', function () { T.setLens(id); });
        act('Focus', function () { GE.focus(id); });
        act(n.pinned ? 'Unpin' : 'Pin where it is', function () { GE.pin(id); kick(); });
        if (n.group) act(GE.isCollapsed(n.group) ? 'Expand ' + T.clusterName[n.group] : 'Collapse ' + T.clusterName[n.group], function () { if (GE.isCollapsed(n.group)) GE.expand(n.group); else GE.collapse(n.group); });
        if (n.isGroup) act('Expand', function () { GE.expand(n.group); });
      } else {
        act('Fit everything', function () { GE.fit(); });
        act('Reset the view', function () { GE.reset(); });
        act(Y.gmode === '3d' ? 'Flat (2D)' : 'Depth (3D)', function () { setGraphMode(Y.gmode === '3d' ? '2d' : '3d'); });
        act(Y.mini === true ? 'Minimap: hide' : Y.mini === false ? 'Minimap: by itself when you are lost' : 'Minimap: keep it shown', cycleMini);
        act(GE.options.fisheye ? 'Fisheye off' : 'Fisheye', function () { GE.set('fisheye', !GE.options.fisheye); });
        act(GE.options.edgeLens ? 'Edge lens off' : 'Edge lens', function () { GE.set('edgeLens', !GE.options.edgeLens); });
        act(GE.options.grid ? 'Grid off' : 'Grid (2D)', function () { GE.set('grid', !GE.options.grid); });
        if (GE.canUndo()) act('Undo', function () { GE.undo(); kick(); });
        if (GE.canRedo()) act('Redo', function () { GE.redo(); kick(); });
      }
    });
  }
  function setGraphMode(mode) {
    Y.gmode = mode; T.store.set('yearMode', mode);
    if (GE) GE.setMode(mode);
    Y.spin = mode === '3d';
    paintTools();
    if (T.sfx) T.sfx('select');
    kick();
  }
  T.yearGraphMode = setGraphMode;
  // the toolbar under the title: what the graph can do, in words
  function paintTools() {
    var tb = T.$('#yearTools'); if (!tb || !GE) return;
    T.clear(tb);
    function btn(label, on, fn, title) { tb.appendChild(el('button', { class: 'hud-l' + (on ? ' on' : ''), 'aria-pressed': on == null ? null : String(!!on), title: title || null, on: { click: function () { fn(); paintTools(); kick(); } } }, label)); }
    btn(Y.gmode === '3d' ? '3D' : '2D', Y.gmode === '3d', function () { setGraphMode(Y.gmode === '3d' ? '2d' : '3d'); }, 'Depth or flat (V)');
    btn('fit', null, function () { GE.fit(); }, 'Fit everything (0)');
    btn('reset', null, function () { GE.reset(); Y.spin = Y.gmode === '3d'; }, 'Back to the first view (R)');
    btn('map', Y.mini == null ? showMini() : Y.mini, cycleMini, Y.mini == null ? 'Minimap: appears by itself when part of the graph is out of view (M cycles: keep, hide, by itself)' : Y.mini ? 'Minimap: kept shown (M)' : 'Minimap: hidden (M)');
    btn('magnify', GE.options.fisheye, function () { GE.set('fisheye', !GE.options.fisheye); }, 'Fisheye under the pointer');
    btn('edge lens', GE.options.edgeLens, function () { GE.set('edgeLens', !GE.options.edgeLens); }, 'Only the links near the pointer');
    btn('bundle', GE.options.bundle, function () { GE.set('bundle', !GE.options.bundle); }, 'Bend links between groups together');
    btn('bubbles', Y.bubbles !== false, function () { Y.bubbles = Y.bubbles === false; }, 'Outline each group (flat)');
    btn('grid', GE.options.grid, function () { GE.set('grid', !GE.options.grid); }, 'A grid behind the plane (flat)');
    btn('undo', null, function () { GE.undo(); }, 'Undo (⌘Z)');
    btn('redo', null, function () { GE.redo(); }, 'Redo (⇧⌘Z)');
  }
  // the legend: the groups, with their counts; a click folds or unfolds one
  function paintLegend() {
    if (!legendEl || !GE) return;
    T.clear(legendEl);
    GE.legend().forEach(function (gl) {
      legendEl.appendChild(el('button', { class: 'chip' + (gl.collapsed ? ' off' : ''), 'aria-pressed': String(!gl.collapsed), title: gl.collapsed ? 'Unfold' : 'Fold into one node',
        on: { click: function () { if (gl.collapsed) GE.expand(gl.group); else GE.collapse(gl.group); paintLegend(); kick(); },
          pointerenter: function () { Y.hover = { kind: 'node', id: 'c:' + gl.group }; setLit(); kick(); }, pointerleave: function () { if (Y.hover && Y.hover.id === 'c:' + gl.group) { Y.hover = null; setLit(); kick(); } } } },
        (T.clusterName[gl.group] || gl.group) + ' ', el('span', { class: 'n' }, String(gl.n))));
    });
  }

  // ---------------------------------------------------------------- what is lit
  function litFor(h) {
    if (!h) return null;
    var nodes = new Set(), weeks = new Set(), days = new Set();
    function addProject(pid) {
      nodes.add('p:' + pid);
      weeksOf(pid).forEach(function (w) { weeks.add(w); });
      Object.keys(dated).forEach(function (k) { if (dated[k].some(function (it) { return it.ps.indexOf(pid) >= 0; })) days.add(k); });
    }
    if (h.kind === 'node') {
      if (h.id.indexOf('q:') === 0) {
        var qn = Y.byId[h.id]; if (!qn) return null;
        nodes.add(h.id);
        (qn.q.links || []).forEach(function (id) { if (E.has(id)) { nodes.add(id); if (id.indexOf('p:') === 0) addProject(id.slice(2)); } });
        return { nodes: nodes, weeks: weeks, days: days, from: h };
      }
      var e = E.get(h.id);
      if (!e) return null;
      nodes.add(h.id);
      if (e.band === 'p') { addProject(e.p.id); T.neighbours(h.id).forEach(function (id) { nodes.add(id); }); }
      else if (e.band === 'c') G.projects.forEach(function (p) { if (p.cluster === e.key) addProject(p.id); });
      else T.neighbours(h.id).forEach(function (id) { if (id.indexOf('p:') === 0) addProject(id.slice(2)); });
      (T.notes || []).forEach(function (q) { if ((q.links || []).indexOf(h.id) >= 0 && Y.byId['q:' + q.id]) nodes.add('q:' + q.id); });
      return { nodes: nodes, weeks: weeks, days: days, from: h };
    }
    if (h.kind === 'day') {
      var w = mondayOf(fromKey(h.k));
      weeks.add(w); days.add(h.k);
      G.projects.forEach(function (p) { if (weekTotal(p.id, w) > 0) nodes.add('p:' + p.id); });
      (dated[h.k] || []).forEach(function (it) { it.ps.forEach(function (pid) { nodes.add('p:' + pid); }); });
      return { nodes: nodes, weeks: weeks, days: days, from: h };
    }
    return null;
  }
  function setLit() {
    var h = Y.pin || Y.hover;
    if (!h && S.lens && E.get(S.lens)) h = { kind: 'node', id: S.lens, lens: true };
    Y.lit = litFor(h);
    paintCard(h);
    var d = Y.pin || Y.hover;
    if (runEl) T.$$('.rw-r', runEl).forEach(function (r) { r.classList.toggle('on', !!d && d.kind === 'day' && d.k === r.getAttribute('data-k')); });
  }

  // ---------------------------------------------------------------- drawing: the calendar, kept as an image
  function diamond(x, y, r, col, fill) {
    g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath();
    if (fill) { g.fillStyle = col; g.fill(); } else { g.strokeStyle = col; g.lineWidth = 1.2; g.stroke(); }
  }
  function drawCalendar(c) {
    var rem = Y.rem, now = new Date(), todayK = dkey(now), lit = Y.lit, R1 = Y.R1, R0 = Y.R0;
    c.setTransform(Y.dpr, 0, 0, Y.dpr, 0, 0);
    c.clearRect(0, 0, Y.W, Y.H);
    var gsave = g; g = c;
    var small = Y.rowH < 15, tiny = Y.rowH < 11;
    Y.months.forEach(function (m) {
      var cur = m.y === now.getFullYear() && m.m === now.getMonth(), mid = Y.rot + m.a0 + m.span / 2;
      // the month's name outside, written along the circle and turned to read upright
      var lr = R1 + rem * (small ? 0.85 : 1.5), lx = Y.cx + Math.cos(mid) * lr, ly = Y.cy + Math.sin(mid) * lr, up = Math.sin(mid) > 0.05;
      c.save(); c.translate(lx, ly); c.rotate(up ? mid - Math.PI / 2 : mid + Math.PI / 2);
      c.font = '500 ' + Math.round(rem * (small ? 0.56 : 0.66)) + 'px ' + T.SANS; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = rgba(INK, cur ? 0.95 : 0.5);
      var name = (small ? T.MON[m.m] : T.MONL[m.m]).toUpperCase() + (m.m === 0 || m === Y.months[0] ? ' ' + m.y : '');
      c.fillText(name.split('').join(String.fromCharCode(8202)), 0, 0);
      c.restore();
      // the days of the week over this month's page, for the month you are in
      if (cur && !small) {
        c.font = '400 ' + Math.round(rem * 0.44) + 'px ' + T.MONO; c.fillStyle = rgba(INK, 0.42); c.textAlign = 'center'; c.textBaseline = 'middle';
        for (var w = 0; w < 7; w++) {
          var a = Y.rot + m.a0 + Y.gap / 2 + (w + 0.5) * m.colW, rr = R1 + rem * 0.85;
          c.fillText(WD[w], Y.cx + Math.cos(a) * rr, Y.cy + Math.sin(a) * rr);
        }
      }
      for (var d = 1; d <= m.days; d++) {
        var dt = new Date(m.y, m.m, d), k = dkey(dt), a2 = cellAng(m, d), r = cellRad(m, d);
        var x = Y.cx + Math.cos(a2) * r, y = Y.cy + Math.sin(a2) * r;
        var cw = m.colW * r, maxR = Math.max(1.5, Math.min(Y.rowH, cw) * 0.47);
        var on = !lit || lit.weeks.has(mondayOf(dt)) || lit.days.has(k), dim = on ? 1 : 0.2;
        var rec = daily[k], future = k > todayK;
        if (rec && rec.you + rec.ag > 0) {
          // the day as a cell: the agents' commits are the membrane, yours the nucleus
          var tot = rec.you + rec.ag, rt = Math.max(1.3, maxR * Math.sqrt(tot / maxDay)), ry = rec.you ? Math.max(0.9, maxR * Math.sqrt(rec.you / maxDay)) : 0;
          if (rt < 2.2) { c.fillStyle = rgba(rec.ag ? CYAN : RAD, 0.8 * dim); c.beginPath(); c.arc(x, y, rt, 0, TAU); c.fill(); }
          else if (!rec.ag) T.cell(c, x, y, rt, 'd' + k, { fill: rgba(RAD, 0.95 * dim), wob: 0.13 });
          else T.cell(c, x, y, rt, 'd' + k, { fill: rgba(CYAN, 0.72 * dim), wob: 0.13, nucleus: ry ? { r: Math.min(ry, rt * 0.82) / rt, fill: rgba(RAD, 0.95 * dim) } : null });
        } else if (rec) {
          c.fillStyle = rgba(INK, 0.26 * dim); c.beginPath(); c.arc(x, y, 1, 0, TAU); c.fill();
        } else if (!future) {
          c.strokeStyle = rgba(INK, (on && lit ? 0.5 : 0.2) * (on ? 1 : 0.6)); c.lineWidth = 1; c.beginPath(); c.arc(x, y, Math.max(1.4, maxR * 0.16), 0, TAU); c.stroke();
        } else {
          c.fillStyle = rgba(INK, (pulse[k] ? 0.42 : 0.17) * dim); c.beginPath(); c.arc(x, y, pulse[k] ? 1.25 : 0.95, 0, TAU); c.fill();
        }
        var its = dated[k];
        if (its) {
          var top = its[0], mk = Math.max(3.2, maxR * 0.62), vio = its.some(function (it) { return it.kind !== 'done' && gatesOpen(it.s) > 0; });
          var col = vio ? VIOH : INK, al = (top.kind === 'done' ? 0.62 : 0.95) * dim;
          if (top.kind === 'hard') { diamond(x, y, mk * 1.08, Y.field, true); diamond(x, y, mk * 1.08, rgba(col, al), !!top.s.committed); }
          else if (top.kind === 'plan') { c.fillStyle = Y.field; c.beginPath(); c.arc(x, y, mk * 0.8, 0, TAU); c.fill(); c.strokeStyle = rgba(col, al); c.lineWidth = 1.2; c.stroke(); }
          else if (top.kind === 'send') { var q = mk * 0.68; c.fillStyle = Y.field; c.fillRect(x - q, y - q, q * 2, q * 2); c.strokeStyle = rgba(col, al * 0.8); c.lineWidth = 1; c.strokeRect(x - q, y - q, q * 2, q * 2); }
          else { var rr2 = (rec && rec.you + rec.ag > 0 ? Math.max(1.3, maxR * Math.sqrt((rec.you + rec.ag) / maxDay)) : 1.5) + 2.6; c.strokeStyle = rgba(INK, al); c.lineWidth = 1; c.beginPath(); c.arc(x, y, rr2, 0, TAU); c.stroke(); }
          if (its.length > 1 && !small) { c.font = '400 ' + Math.round(rem * 0.4) + 'px ' + T.MONO; c.fillStyle = rgba(INK, 0.6 * dim); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('+' + (its.length - 1), x + mk * 1.1, y - mk * 0.9); }
        }
        if (k === todayK) { var hl = c.createRadialGradient(x, y, 0, x, y, maxR * 1.9 + 4); hl.addColorStop(0, rgba(INK, 0.3)); hl.addColorStop(1, rgba(INK, 0)); c.fillStyle = hl; c.beginPath(); c.arc(x, y, maxR * 1.9 + 4, 0, TAU); c.fill(); }
        var pin = Y.pin && Y.pin.kind === 'day' && Y.pin.k === k, hov = Y.hover && Y.hover.kind === 'day' && Y.hover.k === k;
        if (pin || hov) { c.strokeStyle = rgba(INK, pin ? 0.85 : 0.5); c.lineWidth = 1; c.beginPath(); c.arc(x, y, maxR + 2.5, 0, TAU); c.stroke(); }
      }
      // the month's total, just inside the ring
      var tr = R0 - rem * (small ? 1.05 : 1.3), tx = Y.cx + Math.cos(mid) * tr, ty = Y.cy + Math.sin(mid) * tr;
      var sum = 0, recDays = 0, ahead = 0;
      for (var d2 = 1; d2 <= m.days; d2++) {
        var k2 = dkey(new Date(m.y, m.m, d2)), r2 = daily[k2];
        if (r2) { sum += r2.you + r2.ag; recDays++; }
        if (k2 > todayK && dated[k2]) ahead += dated[k2].filter(function (it) { return it.kind !== 'done'; }).length;
      }
      var txt = recDays ? T.int(sum) : ahead ? T.plural(ahead, 'date') : '';
      if (txt && !tiny) {
        c.save(); c.translate(tx, ty); c.rotate(Math.sin(mid) > 0.05 ? mid - Math.PI / 2 : mid + Math.PI / 2);
        c.font = '400 ' + Math.round(rem * (small ? 0.46 : 0.52)) + 'px ' + T.MONO; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = rgba(INK, recDays ? 0.55 : 0.4); c.fillText(txt, 0, 0);
        c.restore();
      }
    });
    // the publishing sprint, as a line inside the ring; each post on it a dot
    var sp = SEED.sprint, rs = R0 - rem * (small ? 0.42 : 0.55);
    if (sp) {
      var a0 = linAng(fromKey(sp.from)), a1 = linAng(new Date(fromKey(sp.to).getTime() + DAY - 1));
      if (a0 != null && a1 != null) {
        if (a1 < a0) a1 += TAU;
        c.strokeStyle = rgba(INK, 0.3); c.lineWidth = 1.4; c.lineCap = 'round'; c.beginPath(); c.arc(Y.cx, Y.cy, rs, a0, a1); c.stroke(); c.lineCap = 'butt';
        Object.keys(pulse).forEach(function (k) {
          var a = linAng(new Date(fromKey(k).getTime() + DAY / 3)); if (a == null) return;
          c.fillStyle = rgba(INK, k > todayK ? 0.62 : 0.3); c.beginPath(); c.arc(Y.cx + Math.cos(a) * rs, Y.cy + Math.sin(a) * rs, 1.3, 0, TAU); c.fill();
        });
      }
    }
    // today: a mark outside the ring, at the top
    var tm = monthOf(now);
    if (tm) {
      var at = cellAng(tm, now.getDate()), r3 = R1 + rem * 0.08, s3 = rem * (small ? 0.2 : 0.24);
      c.fillStyle = rgba(INK, 0.95); c.beginPath();
      c.moveTo(Y.cx + Math.cos(at) * r3, Y.cy + Math.sin(at) * r3);
      c.lineTo(Y.cx + Math.cos(at) * (r3 + s3 * 1.6) + Math.cos(at + Math.PI / 2) * s3, Y.cy + Math.sin(at) * (r3 + s3 * 1.6) + Math.sin(at + Math.PI / 2) * s3);
      c.lineTo(Y.cx + Math.cos(at) * (r3 + s3 * 1.6) - Math.cos(at + Math.PI / 2) * s3, Y.cy + Math.sin(at) * (r3 + s3 * 1.6) - Math.sin(at + Math.PI / 2) * s3);
      c.closePath(); c.fill();
    }
    g = gsave;
  }

  // ---------------------------------------------------------------- drawing: the graph, every frame it moves
  function star4(x, y, r, col) {
    g.fillStyle = col; g.beginPath();
    for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? r * 0.3 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }
  function drawGraph() {
    var lit = Y.lit, ln = lit ? lit.nodes : null, rem = Y.rem, unit = Math.max(2.2, Y.gR * 0.016);
    if (!GE) return;
    GE.size(Y.W, Y.H, Y.cx, Y.cy, Y.gR);
    GE.project();
    var moving = GE.state.moving, sel = new Set(GE.selected()), flat2 = Y.gmode === '2d', pulse = GE.pulse();
    // the graph never leaves its ground: everything inside the ring is clipped to it
    g.save(); g.beginPath(); g.arc(Y.cx, Y.cy, Y.R0 - rem * 0.5, 0, TAU); g.clip();
    // flat: each group outlined as a soft bubble, so the groups read as combos
    if (flat2 && Y.bubbles !== false) G.clusters.forEach(function (c) {
      var ids = GE.groupMembers(c[0]); if (ids.length < 2) return;
      var hot = lit && lit.from && lit.from.id === 'c:' + c[0];
      GE.drawBubble(g, ids, rgba(INK, hot ? 0.07 : 0.03), rgba(INK, hot ? 0.4 : 0.12), rem * 1.1);
    });
    // links first, faint; the lit ones brighter
    g.lineWidth = 1;
    GE.visibleLinks().forEach(function (l) {
      if (moving && !(ln && ln.has(l.a.id) && ln.has(l.b.id)) && Math.random() > 0.5) return;   // a cheaper frame while the view moves
      var on = ln && ln.has(l.a.id) && ln.has(l.b.id), fog = 0.35 + 0.65 * clamp((1 - (l.a.sz + l.b.sz) / 2) / 2, 0, 1);
      var a = ln ? (on ? 0.42 : 0.025) : 0.075;
      if (a * fog < 0.012) return;
      g.strokeStyle = rgba(l.band === 'a' ? (l.b.col || INK) : INK, a * fog);
      var cp = GE.linkPath(l);
      g.beginPath(); g.moveTo(l.a.sx, l.a.sy); if (cp) g.quadraticCurveTo(cp[0], cp[1], l.b.sx, l.b.sy); else g.lineTo(l.b.sx, l.b.sy); g.stroke();
    });
    var order = Y.nodes.filter(function (n) { return !n.hidden; }).sort(function (a, b) { return b.sz - a.sz; });
    order.forEach(function (n) {
      // nodes keep their size under zoom (grow only a little), so zooming spreads the graph rather than swelling it
      var fog = 0.3 + 0.7 * clamp((1 - n.sz) / 2, 0, 1), on = !ln || ln.has(n.id), a = (on ? 1 : 0.16) * fog, r = n.size * unit * n.sk / Math.pow(GE.state.zoom, 0.7);
      if (n.isGroup) {
        // a folded group: a cell the size of its members, named
        T.cell(g, n.sx, n.sy, Math.max(6, r * 1.6), n.id, { fill: rgba(INK, 0.12 * a), stroke: rgba(INK, 0.7 * a), wob: 0.1, n: 9 });
        n.e = n.e || { name: T.clusterName[n.group] || n.group, band: 'c' };
        n.hitR = Math.max(8, r * 1.8);
        return;
      }
      if (sel.has(n.id)) { g.strokeStyle = rgba(VIOH, 0.55 + 0.45 * pulse); g.lineWidth = 1.2; g.beginPath(); g.arc(n.sx, n.sy, Math.max(5, r * 1.5) + pulse * 2, 0, TAU); g.stroke(); g.lineWidth = 1; }
      if (n.pinned) { g.fillStyle = rgba(INK, 0.6); g.fillRect(n.sx - 1, n.sy - Math.max(5, r * 1.5) - 4, 2, 3); }
      if (n.band === 'p') {
        if (n.notes) { g.strokeStyle = rgba(n.col, 0.75 * a); g.lineWidth = 1; g.beginPath(); g.arc(n.sx, n.sy, Math.max(1.8, r * 0.7), 0, TAU); g.stroke(); }
        else {
          var gl = g.createRadialGradient(n.sx, n.sy, 0, n.sx, n.sy, r * 2.4);
          gl.addColorStop(0, rgba(n.col, 0.95 * a)); gl.addColorStop(0.32, rgba(n.col, 0.5 * a)); gl.addColorStop(1, rgba(n.col, 0));
          g.fillStyle = gl; g.beginPath(); g.arc(n.sx, n.sy, r * 2.4, 0, TAU); g.fill();
        }
      } else if (n.band === 's') star4(n.sx, n.sy, Math.max(2.4, r * 1.25), rgba(INK, 0.85 * a));
      else if (n.band === 'q') { g.strokeStyle = rgba(INK, 0.7 * a); g.lineWidth = 1; g.beginPath(); g.arc(n.sx, n.sy, Math.max(2, r * 0.9), 0, TAU); g.stroke(); g.fillStyle = rgba(INK, 0.5 * a); g.beginPath(); g.arc(n.sx, n.sy, 0.9, 0, TAU); g.fill(); }
      else if (T.brandOf && T.brandOf(n.e) && ASOC.brands.draw(g, n.e.name, n.sx, n.sy, Math.max(7, r * 2.6), rgba(n.col, 0.9 * a))) { /* the brand's own mark */ }
      else if (n.band === 'f' && T.drawGlyph) T.drawGlyph(g, n.e.icon, n.sx, n.sy, Math.max(7, r * 2.6), rgba(n.col, 0.8 * a));
      else { g.fillStyle = rgba(n.col, (n.band === 'a' ? 0.9 : n.col !== INK ? 0.85 : 0.55) * a); g.beginPath(); g.arc(n.sx, n.sy, Math.max(1, r * 0.55), 0, TAU); g.fill(); }
      n.hitR = Math.max(6, r * 1.6);
    });
    // names: what is lit, what you point at, and otherwise the largest projects
    var placed = [], fs = Math.round(clamp(Y.gR * 0.04, rem * 0.5, rem * 0.72));
    g.font = '400 ' + fs + 'px ' + T.SANS; g.textBaseline = 'middle';
    var fromP = !!(lit && lit.from && lit.from.kind === 'node' && String(lit.from.id).indexOf('p:') === 0);
    if (moving) { drawExtras(); g.restore(); drawHint(); return; }
    GE.labelBoxes = {};
    var want = order.slice().reverse().filter(function (n) {
      if (n.isGroup || sel.has(n.id)) return true;
      if (Y.hover && Y.hover.kind === 'node' && Y.hover.id === n.id) return true;
      if (flat2 && !ln) return true;   // flat, everything that fits gets its name
      if (ln) return ln.has(n.id) && (n.band === 'p' || n.band === 'q' || fromP || n.id === lit.from.id);
      return n.band === 'p' && n.size > 1.15;
    });
    want.sort(function (a, b) {
      var ha = Y.hover && Y.hover.id === a.id ? 1 : 0, hb = Y.hover && Y.hover.id === b.id ? 1 : 0;
      return hb - ha || (b.band === 'p') - (a.band === 'p') || b.size - a.size;
    });
    want.forEach(function (n) {
      var t = n.e.name;
      g.font = (n.band === 'p' ? '400 ' + fs : '400 ' + Math.round(fs * 0.86)) + 'px ' + T.SANS;
      var zk = n.sk / Math.pow(GE.state.zoom, 0.7), w = g.measureText(t).width, x = n.sx + (n.band === 'f' ? Math.max(7, n.size * unit * zk * 2.6) * 0.6 : n.size * unit * zk) + 4, y = n.sy;
      var box = [x - 2, y - fs * 0.7, x + w + 2, y + fs * 0.7];
      if (placed.some(function (q) { return box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1]; })) return;
      placed.push(box); GE.labelBoxes[n.id] = box;
      var fog = 0.4 + 0.6 * clamp((1 - n.sz) / 2, 0, 1), hot = Y.hover && Y.hover.id === n.id;
      g.fillStyle = rgba(INK, (hot ? 1 : ln ? (n.band === 'p' ? 0.85 : 0.6) : 0.5) * fog); g.textAlign = 'left'; g.fillText(t, x, y);
    });
    drawExtras();
    g.restore();
    drawHint();
  }
  // the engine's overlays (brush, lasso, hull, snap guides, lenses) and, when asked, the minimap in the ring's lower part
  function cycleMini() { Y.mini = Y.mini == null ? true : Y.mini ? false : null; paintTools(); kick(); }
  // the minimap shows itself when any of the graph has left the ground, or past a zoom where you may not know where you are
  function showMini() { if (Y.mini != null) return Y.mini; var v = GE.viewInfo(); return v.inside < 0.9 || v.zoom >= 1.6; }
  function drawExtras() {
    GE.drawOverlays(g, INK);
    if (showMini()) GE.drawMinimap(g, Y.cx - Y.rem * 4, Y.cy + Y.gR - Y.rem * 3.4, Y.rem * 8, Y.rem * 4.2, { ink: INK });
  }
  function drawHint() {
    if (Y.gmode === '2d' || !Y.spin) {
      // a small legend of what the keys do, only while the graph is being worked
      g.font = '400 ' + Math.round(Y.rem * 0.42) + 'px ' + T.MONO; g.fillStyle = rgba(INK, 0.3); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillText((Y.gmode === '2d' ? 'drag pans' : 'drag turns') + ' · wheel zooms · shift-drag brushes · alt-drag lassos · double-click focuses · right-click for more', Y.cx, Y.cy + Y.R0 - Y.rem * 0.9);
    }
  }

  // ---------------------------------------------------------------- frame
  function frame(now) {
    Y.raf = 0;
    if (!Y.open) return;
    var dt = Math.min(0.1, (now - (Y.last || now)) / 1000); Y.last = now;
    var turning = Y.gmode === '3d' && Y.spin && !Y.over && !Y.drag && !(GE && GE.state.drag) && !reduce && T.canopy && T.canopy.drift;
    if (turning && GE) GE.state.yaw += dt * TAU / 150;
    var animating = GE && GE.step(now);
    if (GE) {
      var want = clamp((GE.state.zoom - 1) / 1.6, 0, 1);
      if (Math.abs(want - (Y.expand || 0)) > 0.02) { Y.expand = want; size(); clearTimeout(Y.replanT); Y.replanT = setTimeout(paintPlan, 260); }
    }
    var key = Y.W + 'x' + Y.H + '|' + Y.today + '|' + (Y.lit ? (Y.lit.from.kind + ':' + (Y.lit.from.id || Y.lit.from.k)) : '') + '|' + (Y.pin ? Y.pin.k || Y.pin.id : '') + '|' + (Y.hover && Y.hover.kind === 'day' ? Y.hover.k : '') + '|' + Y.field;
    if (key !== Y.cacheKey) { drawCalendar(Y.cache.getContext('2d')); Y.cacheKey = key; }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(Y.cache, 0, 0);
    g.setTransform(Y.dpr, 0, 0, Y.dpr, 0, 0);
    drawGraph();
    if (turning || Y.drag || animating || (GE && GE.state.drag)) Y.raf = requestAnimationFrame(frame);
  }
  function kick() { if (!Y.raf && Y.open) Y.raf = requestAnimationFrame(frame); }

  // ---------------------------------------------------------------- size
  function size() {
    var W = window.innerWidth, H = window.innerHeight, rem = Y.rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (W * H * dpr * dpr > 9e6) dpr = Math.max(1, Math.sqrt(9e6 / (W * H)));
    Y.W = W; Y.H = H; Y.dpr = dpr;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    Y.cache.width = cv.width; Y.cache.height = cv.height;
    var head = rem * 3.4, label = rem * (W < 760 ? 1.2 : 1.8), R1, lay;
    var full = (H - head - rem * 1.2) / 2 - label, side = (W - 2 * (full + label)) / 2;
    lay = side >= rem * 26 ? 'side' : W > H * 1.15 ? 'foot' : 'under';
    // zooming the graph asks for room: the ring moves outward into the sides and its band thins (Y.expand 0..1)
    var ex = Y.expand || 0;
    if (lay === 'side' && ex > 0) full += Math.min(side - rem * 26, side * 0.45) * ex;
    host.setAttribute('data-lay', lay);
    // the three days stand side by side when the past side is wide enough for them
    host.setAttribute('data-cols', lay === 'side' && (W - 2 * (full + label)) / 2 >= rem * 58 ? '3' : '1');
    // under the ring, the ring gives way to what is written there
    var fh = lay === 'side' ? 0 : Math.min(T.$('#yearF').offsetHeight, H * (lay === 'foot' ? 0.4 : 0.55));
    if (lay === 'side') R1 = full;
    else if (lay === 'foot') R1 = Math.min(W / 2 - label - rem, (H - head - fh - rem * 1.8) / 2 - label);
    else R1 = Math.min(W / 2 - label - 8, (H - head - fh - rem * 1.4) / 2 - label);
    Y.cx = W / 2; Y.cy = head + label + Math.max(80, R1);
    Y.R1 = Math.max(80, R1);
    host.style.setProperty('--ring-l', Math.round(Y.cx - Y.R1 - label) + 'px');
    host.style.setProperty('--ring-r', Math.round(Y.cx + Y.R1 + label) + 'px');
    host.style.setProperty('--foot-top', Math.round(Y.cy + Y.R1 + label + rem * 0.4) + 'px');
    var base0 = Y.R1 < 220 ? 0.6 : 0.64;
    Y.R0 = Y.R1 * (base0 + (0.9 - base0) * ex);
    Y.rowH = (Y.R1 - Y.R0) / 6;
    Y.gR = Y.R0 - rem * (Y.rowH < 15 ? 1.9 : 2.5);
    Y.field = T.fieldA ? T.fieldA(1) : '#000';
    Y.months = months(new Date());
    var now = new Date(), tm = monthOf(now);
    Y.rot = 0;
    if (tm) Y.rot = -Math.PI / 2 - (cellAng(tm, now.getDate()));
    Y.today = dkey(now);
    var first = Y.months[0], last = Y.months[11], nm = W < 760 ? T.MON : T.MONL;
    rangeEl.textContent = nm[first.m] + ' ' + first.y + ' to ' + nm[last.m] + ' ' + last.y + (W < 760 ? '' : ', today at the top');
    Y.cacheKey = '';
  }

  // ---------------------------------------------------------------- the card under the year
  function paintCard(h) {
    T.clear(cardEl);
    var k = '', t = '', s = '', vio = false;
    if (!h) {
      k = 'The year';
      t = '';
      s = 'Point at a project in the middle to see the weeks it moved, or at a day to see that week’s projects.';
    } else if (h.kind === 'day') {
      var d = fromKey(h.k), rec = daily[h.k], its = dated[h.k] || [], todayK = dkey(new Date());
      k = T.DAY[d.getDay()] + (h.k === todayK ? ', today' : '');
      t = d.getDate() + ' ' + T.MONL[d.getMonth()] + ' ' + d.getFullYear();
      var bits = [];
      if (rec) bits.push(rec.you + rec.ag ? T.plural(rec.you + rec.ag, 'commit') + ': ' + rec.you + ' yours, ' + rec.ag + ' by agents' : 'no commits');
      else if (h.k < recFrom) bits.push('before the daily record, which starts ' + T.dm(fromKey(recFrom)));
      else if (h.k <= todayK) bits.push('not in the scan yet, which ends ' + T.dm(fromKey(recTo)));
      if (pulse[h.k]) bits.push('a post goes out');
      its.forEach(function (it) {
        var gk = it.kind !== 'done' ? gatesOpen(it.s) : 0;
        if (gk) vio = true;
        bits.push((it.kind === 'hard' ? 'Deadline: ' : it.kind === 'plan' ? 'Planned: ' : it.kind === 'send' ? 'To send: ' : 'Shipped: ') + it.title + (gk ? ' (' + T.plural(gk, 'gate') + ' wait on you)' : ''));
      });
      var lit = Y.lit, ps = lit ? Array.from(lit.nodes).filter(function (id) { return id.indexOf('p:') === 0; }).map(function (id) { return E.get(id).name; }) : [];
      if (ps.length) bits.push('That week: ' + T.list(ps, 6));
      s = bits.join('\n');
    } else if (h.id.indexOf('q:') === 0) {
      var qn = Y.byId[h.id], q = qn && qn.q;
      if (!q) return;
      k = 'Note' + (q.pin ? ', pinned' : '');
      t = q.text;
      var lk = T.noteLinks ? T.noteLinks(q) : [];
      s = (q.at ? 'Written ' + T.dm(q.at) + (q.hour != null ? ' around ' + T.pad(q.hour) + ':00' : '') : '') + (lk.length ? '\nLinked to ' + T.list(lk.map(function (l) { return l.band === 'h' ? 'the ' + l.name + ' stretch' : l.name; }), 5) + '.' : '');
      if (q.ctx && q.ctx.energy) s += '\nYou were ' + T.energyWord(q.ctx.energy) + ', ' + T.moodWord(q.ctx.mood) + '.';
    } else {
      var e = E.get(h.id), dsc = T.describe(h.id);
      k = (h.lens ? 'Lens, ' : '') + (e.band === 'p' ? 'Project' : dsc.kind.split(',')[0]);
      t = e.name;
      if (e.band === 'p') {
        var ws = weeksOf(e.p.id), best = null, bn = 0;
        ws.forEach(function (w) { var n = weekTotal(e.p.id, w); if (n > bn) { bn = n; best = w; } });
        s = e.p.src === 'scan' ? T.int(e.p.commits) + ' commits since May, in ' + T.plural(ws.length, 'week') + (best ? '. Busiest: the week of ' + T.dm(fromKey(best)) + ', ' + bn + '.' : '.') : 'From notes, not scanned yet.';
        var up = Object.keys(dated).filter(function (dk) { return dk >= dkey(new Date()) && dated[dk].some(function (it) { return it.ps.indexOf(e.p.id) >= 0 && it.kind !== 'done'; }); }).sort();
        if (up.length) s += '\nNext dated: ' + dated[up[0]].filter(function (it) { return it.ps.indexOf(e.p.id) >= 0; })[0].title + ', ' + T.dm(fromKey(up[0])) + '.';
      } else s = dsc.sub + '. Their weeks are lit around the year.';
    }
    cardEl.appendChild(el('span', { class: 'yf-k' + (vio ? ' vio' : '') }, k));
    if (t) cardEl.appendChild(el('span', { class: 'yf-t' }, t));
    s.split('\n').forEach(function (line) { if (line) cardEl.appendChild(el('span', { class: 'yf-s' }, line)); });
  }
  function mark(kind, vio) {
    var c = vio ? 'rgb(165,147,255)' : 'rgba(236,232,228,.9)';
    if (kind === 'hard') return '<path d="M0-5.5L5.5 0 0 5.5-5.5 0z" fill="' + c + '"/>';
    if (kind === 'plan') return '<circle r="4.4" fill="none" stroke="' + c + '" stroke-width="1.3"/>';
    return '<rect x="-4" y="-4" width="8" height="8" fill="none" stroke="' + c + '"/>';
  }
  // the plan on both sides: the next three days on the left, the runways to what is dated on the right
  var runHead, runHost;
  function paintPlan() {
    if (!T.renderSprint || !T.renderRunways) return;
    var compact = lay !== 'side';
    T.renderSprint(sprintEl, { compact: compact, list: lay === 'foot' });   // under the ring on a laptop there is no height for a clock face
    if (!runHead) {
      runHead = el('div', { class: 'yf-run-h' }, el('span', { class: 'yf-ah', style: { margin: 0 } }, 'Runways'));
      runHost = el('div', { class: 'rw-host' });
      runEl.appendChild(runHead); runEl.appendChild(runHost);
      var chips = el('span', { class: 'yf-run-g' }); runHead.appendChild(chips); T.renderGanttGroups(chips);
    } else T.renderGanttGroups(T.$('.yf-run-g', runHead));
    var h = lay === 'side' ? Math.max(200, runEl.clientHeight - runHead.offsetHeight - keyEl.offsetHeight - Y.rem * 2.2) : null;
    T.renderRunways(runHost, { compact: compact, rows: lay === 'side' ? 60 : lay === 'foot' ? 9 : 12, height: h,
      onDay: function (k) { Y.hover = k ? { kind: 'day', k: k } : null; setLit(); kick(); } });
  }
  function paintKey() {
    function svg(inner) { return el('span', { html: '<svg viewBox="-8 -8 16 16" aria-hidden="true">' + inner + '</svg>' }); }
    T.clear(keyEl);
    [[T.cellMark('key', { r: 6.5, fill: 'rgba(53,224,255,.72)', nucleus: 'rgb(199,239,158)' }), 'a day’s commits: the agents’ the membrane, yours the nucleus'],
     ['<circle r="2.2" fill="none" stroke="rgba(236,232,228,.5)"/>', 'before the daily record'],
     ['<path d="M0-6L6 0 0 6-6 0z" fill="rgba(236,232,228,.95)"/>', 'fixed deadline'],
     ['<circle r="4.8" fill="none" stroke="rgba(236,232,228,.9)" stroke-width="1.3"/>', 'planned'],
     ['<rect x="-4.2" y="-4.2" width="8.4" height="8.4" fill="none" stroke="rgba(236,232,228,.75)"/>', 'to send'],
     ['<path d="M0-6L6 0 0 6-6 0z" fill="rgb(165,147,255)"/>', 'waits on you'],
     ['<path d="M-7 3A9 9 0 0 1 7 3" fill="none" stroke="rgba(236,232,228,.45)" stroke-width="1.4"/><circle cx="0" cy="-1.2" r="1.4" fill="rgba(236,232,228,.7)"/>', 'publishing sprint, a dot a post'],
     ['<rect x="-7" y="-3" width="14" height="6" rx="1.5" fill="rgba(236,232,228,.78)"/>', 'a slot of your work on the runway'],
     ['<rect x="-7" y="-3" width="14" height="6" rx="1.5" fill="rgba(53,224,255,.6)"/>', 'briefing or reviewing an agent'],
     ['<rect x="-7" y="-3" width="14" height="6" rx="1.5" fill="rgba(165,147,255,.15)" stroke="rgb(165,147,255)" stroke-dasharray="2 2"/>', 'past the date at this capacity']
    ].forEach(function (k) { var s = svg(k[0]); s.appendChild(document.createTextNode(k[1])); keyEl.appendChild(s); });
  }

  // ---------------------------------------------------------------- pointing
  function local(ev) { return [ev.clientX, ev.clientY]; }
  function hitAt(x, y) {
    var dx = x - Y.cx, dy = y - Y.cy, r = Math.sqrt(dx * dx + dy * dy);
    if (r < Y.R0 - Y.rem * 0.6) return { kind: 'centre' };   // the engine's ground
    if (r > Y.R1 + 2 || r < Y.R0 - 2) return null;
    var a = Math.atan2(dy, dx) - Y.rot;
    a = ((a % TAU) + TAU) % TAU;
    for (var i = 0; i < Y.months.length; i++) {
      var m = Y.months[i];
      if (a >= m.a0 && a < m.a0 + m.span) {
        var col = Math.floor((a - m.a0 - Y.gap / 2) / m.colW), row = Math.floor((Y.R1 - r) / Y.rowH);
        if (col < 0 || col > 6 || row < 0 || row > 5) return null;
        var d = row * 7 + col - m.lead + 1;
        if (d < 1 || d > m.days) return null;
        return { kind: 'day', k: dkey(new Date(m.y, m.m, d)) };
      }
    }
    return null;
  }
  function same(a, b) { return (!a && !b) || (a && b && a.kind === b.kind && a.k === b.k && a.id === b.id); }
  // the ring's own pointer: days. Inside the ring the engine has the pointer.
  function onMove(ev) {
    var p = local(ev), h = hitAt(p[0], p[1]);
    if (h && h.kind === 'centre') { Y.over = true; if (Y.hover && Y.hover.kind === 'day') { Y.hover = null; setLit(); } kick(); return; }
    Y.over = false;
    if (!(GE && GE.state.drag)) cv.style.cursor = h ? 'pointer' : 'default';
    if (!same(h, Y.hover) && !(Y.hover && Y.hover.kind === 'node' && !h)) { Y.hover = h; if (h && T.sfx) T.sfx('hover'); setLit(); kick(); }
    else if (!h && Y.hover && Y.hover.kind === 'node' && !(GE && GE.state.hover)) { Y.hover = null; setLit(); kick(); }
    else if (!Y.raf) kick();
  }
  function onDown(ev) {
    var p = local(ev), h = hitAt(p[0], p[1]);
    if (h && h.kind === 'centre') { Y.spin = false; return; }
    Y.drag = { x: p[0], y: p[1], moved: false, h: h, ring: true };
  }
  function onUp(ev) {
    var d = Y.drag; Y.drag = null;
    if (!d) return;
    var h = d.h && d.h.kind === 'day' ? d.h : null;
    if (!h) return;
    Y.pin = !same(h, Y.pin) ? h : null;
    if (ev.pointerType !== 'mouse') Y.hover = null;
    if (T.sfx) T.sfx(Y.pin ? 'select' : 'back');
    setLit(); kick();
  }
  function onLeave() { if (Y.drag) return; Y.over = false; if (Y.hover) { Y.hover = null; setLit(); } kick(); }
  function step(days) {
    var base = Y.pin && Y.pin.kind === 'day' ? fromKey(Y.pin.k) : new Date();
    var d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
    if (!monthOf(d)) return;
    Y.pin = { kind: 'day', k: dkey(d) }; if (T.sfx) T.sfx('move'); setLit(); kick();
  }
  function onKey(ev) {
    if (!Y.open || (T.askOpen && T.askOpen()) || (T.settingsOpen && T.settingsOpen())) return;
    var k = ev.key;
    if ((ev.metaKey || ev.ctrlKey) && (k === 'z' || k === 'Z') && GE) { ev.preventDefault(); GE.key(ev); return; }
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (k === 'Escape') { ev.preventDefault(); ev.stopPropagation(); if (GE && GE.selected().length) { GE.select([]); return; } if (Y.pin) { Y.pin = null; setLit(); kick(); } else close(); return; }
    if (k === 'y' || k === 'Y') { ev.preventDefault(); ev.stopPropagation(); close(); return; }
    if (k === 'v' || k === 'V') { ev.preventDefault(); setGraphMode(Y.gmode === '3d' ? '2d' : '3d'); return; }
    if (k === 'm' || k === 'M') { ev.preventDefault(); cycleMini(); return; }
    // the graph's own keys when it holds the selection, or for zoom and fit
    if (GE && (GE.selected().length || /^[+=\-_0rR]$/.test(k)) && GE.key(ev)) { ev.preventDefault(); return; }
    if (k === 'ArrowRight') { ev.preventDefault(); step(1); } else if (k === 'ArrowLeft') { ev.preventDefault(); step(-1); }
    else if (k === 'ArrowDown') { ev.preventDefault(); step(7); } else if (k === 'ArrowUp') { ev.preventDefault(); step(-7); }
  }

  // ---------------------------------------------------------------- open and close
  function open() {
    if (Y.open) return;
    if (T.isLeanBack && T.isLeanBack()) T.leanIn();
    if (T.closeAsk) T.closeAsk();
    if (!Y.nodes.length) buildGraph();
    Y.open = true; host.hidden = false;
    if (T.sfx) T.sfx('open');
    document.documentElement.classList.add('yearing');
    Y.hover = null; Y.pin = null; Y.spin = Y.gmode === '3d';
    paintTools(); paintLegend();
    paintKey(); setLit(); size(); paintPlan(); var l0 = lay; size(); if (lay !== l0) paintPlan();
    requestAnimationFrame(function () { host.classList.add('on'); });
    Y.last = 0; kick();
    T.$('#yearBtn').setAttribute('aria-pressed', 'true');
  }
  function close() {
    if (!Y.open) return;
    Y.open = false; host.classList.remove('on');
    if (T.sfx) T.sfx('close');
    document.documentElement.classList.remove('yearing');
    T.$('#yearBtn').setAttribute('aria-pressed', 'false');
    setTimeout(function () { if (!Y.open) host.hidden = true; }, reduce ? 0 : 420);
  }
  T.openYear = open;
  T.closeYear = close;
  T.yearOpen = function () { return Y.open; };
  T.yearProbe = function () { return { Y: Y, GE: GE, hitAt: hitAt, cellAng: cellAng, cellRad: cellRad, monthOf: monthOf, dkey: dkey }; };   // for tests

  T.initYear = function () {
    host = T.$('#year'); cv = T.$('#cvYear'); g = cv.getContext('2d'); cardEl = el('div', { class: 'yf-card', 'aria-live': 'polite' }); keyEl = el('div', { class: 'yf-key' });
    sprintEl = el('div', { class: 'yf-sprint' }); runEl = el('div', { class: 'yf-run' }); legendEl = el('div', { class: 'yf-legend' });
    leftEl = el('div', { class: 'yf-l' }, cardEl, sprintEl); sideEl = el('div', { class: 'yf-r' }, runEl, legendEl, keyEl);
    rangeEl = T.$('#yearR');
    T.$('#yearF').appendChild(leftEl); T.$('#yearF').appendChild(sideEl);
    T.on('plan', function () { if (Y.open) { paintPlan(); kick(); } });
    T.on('notes', function () { Y.nodes = []; if (Y.open) { buildGraph(); setLit(); kick(); } });
    T.on('look', function () { Y.nodes = []; if (Y.open) { buildGraph(); setLit(); kick(); } });
    Y.cache = document.createElement('canvas');
    T.$('#yearX').addEventListener('click', close);

    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', function () { Y.drag = null; });
    cv.addEventListener('pointerleave', onLeave);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', function () { if (Y.open) { var l0 = lay; size(); if (lay !== l0) { paintPlan(); size(); } else paintPlan(); kick(); } });
    T.on('field', function () { if (Y.open) { Y.field = T.fieldA(1); Y.cacheKey = ''; kick(); } });
    T.on('lens', function () { if (Y.open) { setLit(); kick(); } });
    if ((location.hash || '') === '#year') setTimeout(open, 60);
  };
})();
