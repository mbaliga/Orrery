/* map: everything you have, in one graph, read by its marks.
   Notes, tasks, projects, dates, commits, shared modules, Claude Code sessions, the files they kept returning to, and
   an Obsidian vault if one is open — one graph, laid out by what is tied to what (a wikilink, the compiler's link, a
   tie on the desk, a task's project, a session's project). The point of it is the marks. Each facet of the data is
   given one property of the mark, and you can change which: kind → shape, project → hue, age → brightness, weight →
   size, source → edge, status → fill, how connected → rings, mood when written → how it breathes. Hue is never alone:
   a project is also its name in the legend and on hover. Lenses are saved mappings ("by project", "by age", "by
   source"). Type in the search field and the graph lights what the index finds and what is tied to it. */
(function () {
  'use strict';
  var T = window.T, el = T.el, host, cv, g, GE = null, M = { open: false, raf: 0, nodes: [], W: 0, H: 0, dpr: 1, hover: null, sel: null, lit: null, q: '' };
  var TAU = Math.PI * 2, PAL = ['142,123,255', '53,224,255', '199,239,158', '255,196,120', '255,140,170', '170,190,255', '120,230,190', '230,170,255', '255,230,140'], INK = '236,232,228';
  var FACETS = [['kind', 'Kind'], ['project', 'Project'], ['age', 'Age'], ['weight', 'Weight'], ['source', 'Source'], ['status', 'Status'], ['links', 'How tied'], ['mood', 'Mood when written']];
  var CHANNELS = [['shape', 'shape'], ['hue', 'hue'], ['brightness', 'brightness'], ['size', 'size'], ['edge', 'edge'], ['fill', 'fill'], ['rings', 'rings'], ['motion', 'breath'], ['none', 'nothing']];
  var DEF = { kind: 'shape', project: 'hue', age: 'brightness', weight: 'size', source: 'edge', status: 'fill', links: 'rings', mood: 'motion' };
  var PRESETS = [['Default', DEF], ['By project', { kind: 'shape', project: 'hue', age: 'none', weight: 'size', source: 'none', status: 'none', links: 'none', mood: 'none' }], ['By kind', { kind: 'hue', project: 'none', age: 'brightness', weight: 'size', source: 'edge', status: 'none', links: 'none', mood: 'none' }],
    ['By age', { kind: 'shape', project: 'none', age: 'hue', weight: 'size', source: 'none', status: 'fill', links: 'none', mood: 'none' }], ['By source', { kind: 'shape', project: 'none', age: 'brightness', weight: 'size', source: 'hue', status: 'none', links: 'rings', mood: 'none' }]];
  var CFG = T.store.get('mapcfg', { map: Object.assign({}, DEF), lenses: [] });
  var SHAPE = { Note: 'circle', Vault: 'circle', Task: 'square', Project: 'star', Session: 'diamond', File: 'tri', Module: 'hex', Commit: 'dot', Date: 'bar' };
  function rgba(c, a) { return 'rgba(' + c + ',' + a.toFixed(3) + ')'; }
  function hash(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function chan(f) { return CFG.map[f] || 'none'; }
  function daysAgo(at) { if (!at) return 90; var d = (Date.now() - new Date(at).getTime()) / 864e5; return isFinite(d) ? Math.max(0, d) : 90; }

  // ---------------------------------------------------------------- the data
  function build() {
    var docs = T.indexDocs ? T.indexDocs() : [], nodes = [], byId = {}, links = [], pid = {};
    (T.G.projects || []).forEach(function (p) { pid[p.name.toLowerCase()] = p.id; });
    var caps = { Task: 120, Commit: 80, Date: 24, Module: 40, Project: 80 }, seen = {};
    docs.forEach(function (d) {
      if (caps[d.kind] != null) { seen[d.kind] = (seen[d.kind] || 0) + 1; if (seen[d.kind] > caps[d.kind]) return; }
      if (d.kind === 'Task' && d.done) return;
      var n = { id: d.id, kind: d.kind, name: (d.title || d.text || '').slice(0, 70), text: d.text, at: d.at, p: d.p || null, w: d.w || 1, src: d.src || 'own', done: !!d.done, mood: d.mood || null, group: d.p && T.P.has(d.p) ? T.E.has('p:' + d.p) && T.E.get('p:' + d.p).p.cluster : null, size: 1 };
      nodes.push(n); byId[n.id] = n;
    });
    function ln(a, b, band) { if (byId[a] && byId[b] && a !== b) links.push({ a: a, b: b, band: band || '', hub: 1 }); }
    nodes.forEach(function (n) {
      if (n.kind === 'Task' || n.kind === 'Commit' || n.kind === 'Date' || n.kind === 'Module') if (n.p) ln(n.id, 'p:' + n.p);
      if (n.kind === 'Session') { var q = pid[String(n.name.split(' — ')[0]).toLowerCase()]; if (q) { n.p = q; ln(n.id, 'p:' + q); } }
      if (n.kind === 'File') { var sid = n.id.replace(/^f:/, ''); Object.keys(byId).forEach(function (k) { if (k.indexOf('u:') === 0 && sid.indexOf(k.slice(2)) === 0) ln(n.id, k); }); }
    });
    (T.notes || []).forEach(function (q) {
      (q.links || []).forEach(function (id) { if (!/^h:|^seg:/.test(id)) ln(q.id, id, 'l'); });
      (q.refs || []).forEach(function (id) { ln(q.id, id, 'r'); });
      if (q.bd) (q.bd.tie || []).forEach(function (id) { ln(q.id, id, 't'); });
    });
    nodes.forEach(function (n) { n.deg = 0; });
    links.forEach(function (l) { byId[l.a].deg++; byId[l.b].deg++; });
    M.nodes = nodes; M.links = links; M.by = byId;
    nodes.forEach(function (n) { n.size = n.kind === 'Project' ? 1.6 : 1; });
    return { nodes: nodes.map(function (n) { return { id: n.id, group: n.group, size: n.size }; }), links: links };
  }
  function mount() {
    var data = build(); if (GE) GE.destroy();
    GE = ASOC.Graph.create({ nodes: data.nodes, links: data.links, mode: '2d',
      options: { hull: false, snap: true, history: true, forceDrag: true, fixSize: true, minZoom: 0.4, maxZoom: 4, keep: 0.35 },
      on: { hover: function (id) { M.hover = id; tip(id); kick(); }, select: function (ids) { M.sel = ids.length === 1 ? ids[0] : null; lit(); card(); kick(); }, change: function () { kick(); }, context: function () {} },
      onFrame: kick });
    GE.layout(360); GE.attach(cv); sizeUp();
    M.eng = GE.state.byId;
  }
  // ---------------------------------------------------------------- reading a node by its marks
  function marks(n) {
    var m = { shape: SHAPE[n.kind] || 'circle', hue: INK, br: 0.85, size: 1, edge: 'solid', fill: 1, rings: 0, motion: 0, hueDone: false }, cfg = CFG.map;
    function val(f) {
      switch (f) {
        case 'kind': return KIND_IDX[n.kind] != null ? KIND_IDX[n.kind] : 0;
        case 'project': return n.p ? hash(n.p) : -1;
        case 'age': return Math.min(1, daysAgo(n.at) / 90);
        case 'weight': return Math.min(1, Math.log(1 + n.w) / Math.log(40));
        case 'source': return n.src === 'own' ? 0 : n.src === 'model' ? 1 : 2;
        case 'status': return n.done ? 1 : 0;
        case 'links': return Math.min(3, n.deg);
        case 'mood': return n.mood == null ? -1 : n.mood;
      } return 0;
    }
    FACETS.forEach(function (f) {
      var c = cfg[f[0]], v = val(f[0]); if (!c || c === 'none') return;
      if (c === 'shape') m.shape = ['circle', 'square', 'tri', 'diamond', 'hex', 'star', 'dot'][Math.abs(f[0] === 'kind' ? v : Math.round(v * 6)) % 7];
      else if (c === 'hue') { m.hue = v < 0 ? INK : f[0] === 'age' ? PAL[Math.min(PAL.length - 1, Math.floor(v * PAL.length))] : f[0] === 'source' ? PAL[[2, 0, 3][v]] : PAL[Math.abs(v) % PAL.length]; }
      else if (c === 'brightness') m.br = f[0] === 'age' ? 0.95 - 0.7 * v : 0.35 + 0.6 * v;
      else if (c === 'size') m.size = 0.7 + 1.5 * v;
      else if (c === 'edge') m.edge = ['solid', 'dashed', 'double'][Math.round(v)] || 'solid';
      else if (c === 'fill') m.fill = f[0] === 'status' ? (v ? 1 : 0) : v;
      else if (c === 'rings') m.rings = Math.round(v);
      else if (c === 'motion') m.motion = v < 0 ? 0 : 0.5 + v;
    });
    return m;
  }
  var KIND_IDX = { Note: 0, Vault: 0, Task: 1, Project: 2, Session: 3, File: 4, Module: 5, Commit: 6, Date: 6 };
  function shapePath(c, s, x, y, r) {
    c.beginPath();
    if (s === 'circle') c.arc(x, y, r, 0, TAU);
    else if (s === 'square') c.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
    else if (s === 'tri') { c.moveTo(x, y - r * 1.1); c.lineTo(x + r, y + r * 0.8); c.lineTo(x - r, y + r * 0.8); c.closePath(); }
    else if (s === 'diamond') { c.moveTo(x, y - r * 1.15); c.lineTo(x + r, y); c.lineTo(x, y + r * 1.15); c.lineTo(x - r, y); c.closePath(); }
    else if (s === 'hex') { for (var i = 0; i < 6; i++) { var a = i * TAU / 6; c.lineTo(x + Math.cos(a) * r * 1.05, y + Math.sin(a) * r * 1.05); } c.closePath(); }
    else if (s === 'star') { for (var j = 0; j < 8; j++) { var b = j * Math.PI / 4 - Math.PI / 2, rr = j % 2 ? r * 0.38 : r * 1.25; c.lineTo(x + Math.cos(b) * rr, y + Math.sin(b) * rr); } c.closePath(); }
    else c.arc(x, y, r * 0.55, 0, TAU);
  }
  function draw(t) {
    if (!GE) return; g.setTransform(M.dpr, 0, 0, M.dpr, 0, 0); g.clearRect(0, 0, M.W, M.H);
    GE.size(M.W, M.H, M.cx, M.cy, M.R); GE.project();
    var breath = 0.5 + 0.5 * Math.sin(t / 1600), unit = Math.max(3.2, M.R * 0.012), ln = M.lit, sel = M.sel;
    g.lineWidth = 1;
    GE.visibleLinks().forEach(function (l) {
      var on = ln && ln.has(l.a.id) && ln.has(l.b.id), a = ln ? (on ? 0.5 : 0.03) : 0.1;
      g.strokeStyle = l.band === 't' ? rgba('255,196,120', a * 1.8) : l.band === 'r' ? rgba('142,123,255', a * 1.8) : rgba(INK, a);
      g.setLineDash(l.band === 't' ? [2, 4] : []); g.beginPath(); g.moveTo(l.a.sx, l.a.sy); g.lineTo(l.b.sx, l.b.sy); g.stroke();
    }); g.setLineDash([]);
    var order = GE.state.nodes.slice().sort(function (a, b) { return b.sz - a.sz; });
    order.forEach(function (e) {
      var n = M.by[e.id]; if (!n || e.hidden) return; var m = marks(n), dim = ln && !ln.has(n.id), a = (dim ? 0.12 : 1) * m.br, r = unit * m.size * (e.sk || 1) / Math.pow(GE.state.zoom, 0.6), x = e.sx, y = e.sy;
      if (m.motion) r *= 1 + 0.12 * m.motion * Math.sin(t / (900 / m.motion));
      e.hitR = Math.max(7, r * 1.6);
      if (sel === n.id || M.hover === n.id) { g.strokeStyle = rgba('142,123,255', 0.5 + 0.5 * breath); shapePath(g, 'circle', x, y, r * 1.9 + 2); g.stroke(); }
      for (var k = 1; k <= m.rings; k++) { g.strokeStyle = rgba(m.hue, a * 0.35); shapePath(g, 'circle', x, y, r * (1.5 + k * 0.55)); g.stroke(); }
      var grd = g.createRadialGradient(x, y, 0, x, y, r * 2.6); grd.addColorStop(0, rgba(m.hue, a * 0.28)); grd.addColorStop(1, rgba(m.hue, 0)); g.fillStyle = grd; g.beginPath(); g.arc(x, y, r * 2.6, 0, TAU); g.fill();
      shapePath(g, m.shape, x, y, r);
      if (m.fill > 0.02) { g.fillStyle = rgba(m.hue, a * (0.25 + 0.7 * m.fill)); g.fill(); }
      g.strokeStyle = rgba(m.hue, a); g.lineWidth = m.edge === 'double' ? 1.6 : 1.1; g.setLineDash(m.edge === 'dashed' ? [3, 2.5] : []); g.stroke();
      if (m.edge === 'double') { shapePath(g, m.shape, x, y, r * 1.28); g.lineWidth = 0.8; g.stroke(); } g.setLineDash([]); g.lineWidth = 1;
    });
    // names: what you point at, what is selected, the projects, and whatever is lit
    g.font = '400 ' + Math.round(Math.max(10, M.R * 0.016)) + 'px ' + T.SANS; g.textBaseline = 'middle'; var placed = [];
    order.slice().reverse().forEach(function (e) {
      var n = M.by[e.id]; if (!n) return; var hot = M.hover === n.id || sel === n.id, want = hot || (n.kind === 'Project' && !ln && n.w > 1) || (ln && ln.has(n.id) && (n.kind === 'Note' || n.kind === 'Project' || n.kind === 'Session') );
      if (!want) return; var txt = n.name, w = g.measureText(txt).width, x = e.sx + 10, yy = e.sy, box = [x - 2, yy - 8, x + w + 2, yy + 8];
      if (!hot && placed.some(function (q) { return box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1]; })) return; placed.push(box);
      g.fillStyle = rgba(INK, hot ? 1 : 0.7); g.textAlign = 'left'; g.fillText(txt, x, yy);
    });
    GE.drawOverlays(g, INK);
    if (GE.viewInfo().inside < 0.9 || GE.state.zoom >= 1.6) GE.drawMinimap(g, M.W - 190, M.H - 130, 170, 110, { ink: INK });
    if (GE.state.moving || M.hover) M.raf = requestAnimationFrame(draw); else M.raf = 0;
  }
  function kick() { if (!M.raf && M.open) M.raf = requestAnimationFrame(draw); }
  function sizeUp() {
    var W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1), side = W > 900 ? 330 : 0;
    M.dpr = dpr; M.W = W; M.H = H; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    M.cx = (W - side) / 2; M.cy = H / 2 + 20; M.R = Math.min(W - side, H) * 0.46; if (GE) { GE.options.bounds = function () { return { x: 0, y: 40, w: W - side, h: H - 40 }; }; GE.size(W, H, M.cx, M.cy, M.R); }
    kick();
  }
  // ---------------------------------------------------------------- lit set from the search field and the selection
  function lit() {
    var set = new Set();
    if (M.q.length > 1) { T.search(M.q, 25).forEach(function (h) { set.add(h.id); }); }
    else if (M.sel) set.add(M.sel);
    if (set.size) { var seed = Array.from(set); GE.state.links.forEach(function (l) { if (seed.indexOf(l.a.id) >= 0) set.add(l.b.id); if (seed.indexOf(l.b.id) >= 0) set.add(l.a.id); }); }
    M.lit = set.size ? set : null; kick();
  }
  function tip(id) { var n = id && M.by[id]; if (!n) { T.tip.hide(); return; } var e = GE.state.byId[id]; T.tip.show(n.kind + ' · ' + n.name + (n.at ? ' · ' + n.at : ''), e.sx, e.sy); }
  // ---------------------------------------------------------------- the panel
  function card() {
    var c = T.$('#mapCard'); T.clear(c); var n = M.sel && M.by[M.sel]; if (!n) { c.appendChild(el('p', { class: 'cap' }, 'Point at a mark for its name. Click one to see what it is tied to; type above to light everything the index finds.')); return; }
    c.appendChild(el('b', { class: 'mp-h' }, n.kind + (n.at ? ' · ' + n.at : ''))); c.appendChild(el('p', { class: 'mp-t' }, n.text || n.name));
    var tied = GE.state.links.filter(function (l) { return l.a.id === n.id || l.b.id === n.id; }).map(function (l) { var o = M.by[l.a.id === n.id ? l.b.id : l.a.id]; return o && (o.kind + ': ' + o.name.slice(0, 40)); }).filter(Boolean).slice(0, 8);
    if (tied.length) c.appendChild(el('p', { class: 'cap' }, 'Tied to ' + tied.join(' · ')));
  }
  function panel() {
    var p = T.$('#mapPanel'); T.clear(p);
    p.appendChild(el('b', { class: 'mp-h' }, 'Reading the marks'));
    FACETS.forEach(function (f) {
      var sel = el('select', { 'aria-label': f[1] + ' is shown by', on: { change: function (ev) { var v = ev.target.value; Object.keys(CFG.map).forEach(function (k) { if (k !== f[0] && v !== 'none' && CFG.map[k] === v) CFG.map[k] = CFG.map[f[0]]; }); CFG.map[f[0]] = v; save(); panel(); kick(); } } });
      CHANNELS.forEach(function (c) { var o = el('option', { value: c[0] }, c[1]); if (CFG.map[f[0]] === c[0]) o.selected = true; sel.appendChild(o); });
      p.appendChild(el('label', { class: 'mp-r' }, el('span', null, f[1]), sel));
    });
    var pr = el('div', { class: 'mp-ch' });
    PRESETS.concat(CFG.lenses.map(function (l) { return [l.name, l.map]; })).forEach(function (l) { pr.appendChild(el('button', { class: 'chip', type: 'button', on: { click: function () { CFG.map = Object.assign({}, l[1]); save(); panel(); kick(); } } }, l[0])); });
    p.appendChild(el('b', { class: 'mp-h' }, 'Lenses')); p.appendChild(pr);
    var nm = el('input', { type: 'text', class: 'mp-in', placeholder: 'name this arrangement', maxlength: 24, 'aria-label': 'Lens name' });
    p.appendChild(el('div', { class: 'mp-ch' }, nm, el('button', { class: 'chip', type: 'button', on: { click: function () { var v = nm.value.trim(); if (!v) return; CFG.lenses = CFG.lenses.filter(function (l) { return l.name !== v; }).concat([{ name: v, map: Object.assign({}, CFG.map) }]); save(); panel(); } } }, 'Save lens')));
    // legend: kinds as shapes, projects as names
    var kinds = {}; M.nodes.forEach(function (n) { kinds[n.kind] = (kinds[n.kind] || 0) + 1; });
    var GL = { circle: '●', square: '■', tri: '▲', diamond: '◆', hex: '⬢', star: '✦', dot: '•', bar: '▬' };
    p.appendChild(el('b', { class: 'mp-h' }, 'In this map')); p.appendChild(el('p', { class: 'cap' }, Object.keys(kinds).map(function (k) { return (chan('kind') === 'shape' ? GL[marks({ kind: k, deg: 0, w: 1 }).shape] + ' ' : '') + k + ' ' + kinds[k]; }).join(' · ')));
    if (chan('project') === 'hue') { var ps = {}; M.nodes.forEach(function (n) { if (n.p) ps[n.p] = (ps[n.p] || 0) + 1; }); var top = Object.keys(ps).sort(function (a, b) { return ps[b] - ps[a]; }).slice(0, 9);
      p.appendChild(el('div', { class: 'mp-lg' }, top.map(function (id) { return el('span', null, el('i', { style: { background: 'rgb(' + PAL[hash(id) % PAL.length] + ')' } }), T.projectName(id)); }))); }
  }
  function save() { T.store.set('mapcfg', CFG); }
  T.mapOpen = function () { return M.open; };
  T.openMap = function () {
    if (M.open) return; if (T.isLeanBack && T.isLeanBack()) T.leanIn(); if (T.closeAsk) T.closeAsk();
    M.open = true; host.hidden = false; document.documentElement.classList.add('yearing'); if (T.reindex) T.reindex();
    mount(); panel(); card(); requestAnimationFrame(function () { host.classList.add('on'); }); T.$('#mapBtn').setAttribute('aria-pressed', 'true'); kick();
  };
  T.closeMap = function () { if (!M.open) return; M.open = false; host.classList.remove('on'); document.documentElement.classList.remove('yearing'); T.$('#mapBtn').setAttribute('aria-pressed', 'false'); T.tip.hide(); setTimeout(function () { if (!M.open) host.hidden = true; }, 420); };
  T.mapProbe = function () { return { M: M, GE: GE, marks: marks, nodes: M.nodes, cfg: CFG }; };
  T.initMap = function () {
    host = T.$('#map'); cv = T.$('#cvMap'); g = cv.getContext('2d');
    T.$('#mapBtn').addEventListener('click', function () { M.open ? T.closeMap() : T.openMap(); }); T.$('#mapX').addEventListener('click', T.closeMap);
    T.$('#mapQ').addEventListener('input', function (ev) { M.q = ev.target.value.trim(); lit(); });
    window.addEventListener('resize', function () { if (M.open) sizeUp(); });
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return; var t = e.target, tag = (t.tagName || '').toLowerCase();
      if (M.open && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (tag === 'input') t.blur(); else T.closeMap(); return; }
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return; if (T.askOpen && T.askOpen()) return; if (T.settingsOpen && T.settingsOpen()) return;
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); M.open ? T.closeMap() : T.openMap(); }
    }, true);
  };
})();
