/* lean back: the sky, drawn from what your work is made of. Nothing in it is decoration.
   A star is a module: one of your shared modules (a four-point star) or a library (a dot), sized by how many projects
   use it, and shared by every one of them. A project is a glowing star of its own, brighter for more commits in the
   last four weeks and tinted radium where you made them, cyan where agents did; a hollow ring is a project that lives
   in notes and has not been scanned. A project's constellation is the shortest set of lines that joins it to every
   module it uses or provides, so projects that share modules share stars, and the busiest modules are where the
   lines gather. Where things sit comes from what is built together: modules used by the same projects drift
   together, and projects in one group sit near each other. Each grain of dust is a commit from the last sixteen weeks.
   One thing that matters rises at a time and lights its constellation. Nothing blinks; nothing is red. */
(function () {
  'use strict';
  var T = window.T, G = T.G, S = T.S, SEED = T.SEED, E = T.E, el = T.el;
  var DAY = 864e5, TAU = Math.PI * 2;
  var INK = [236, 232, 228], RAD = [199, 239, 158], CYAN = [53, 224, 255], VIO = [165, 147, 255];
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var K = { on: false, auto: false, visitor: false, W: 0, H: 0, dpr: 1, rem: 16, nodes: [], edges: [], projects: [], byId: {}, dust: null, t0: 0, raf: 0, last: 0,
    q: [], qi: -1, shown: null, shownAt: 0, timer: 0, born: 0, hover: null, sel: null, bar: 0, aspect: 0 };
  var host, cv, g, card, timeEl, dateEl, hint, keyEl, visEl;
  // the free view shows an app once its repo is public or it is live; the rest wait until you announce them
  function visible(p) { return p.vis === 'public' || p.state === 'shipping' || (p.platforms || []).indexOf('play') >= 0; }
  function pageOf(p) {
    var pg = (SEED.pages || {})[p.id];
    if (pg) return pg;
    return p.vis === 'public' && p.src === 'scan' && SEED.repoOwner ? 'https://github.com/' + SEED.repoOwner + '/' + p.repo : null;
  }
  var HOLD = 11000, FADE = 1400;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rng(seed) { var x = Math.floor(seed * 2147483646) + 1; return function () { x = x * 16807 % 2147483647; return (x - 1) / 2147483646; }; }
  function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function rgba(c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + clamp(a, 0, 1).toFixed(3) + ')'; }

  // ---------------------------------------------------------------- the model: modules are stars, projects are constellations
  function build() {
    var N = [], byKey = {}, edges = [], end = new Date(G.scanned_at).getTime(), since = new Date(end - 28 * DAY).toISOString().slice(0, 10);
    function node(key, o) { if (!byKey[key]) { o.key = key; o.users = []; o.mods = []; o.i = N.length; N.push(o); byKey[key] = o; } return byKey[key]; }
    function link(pn, m, provides) {
      if (m.users.indexOf(pn) >= 0) return;
      m.users.push(pn); pn.mods.push(m); edges.push([pn, m, provides ? 1.3 : 1]);
      if (provides) m.home = pn;
    }
    var maxRecent = 1;
    G.projects.forEach(function (p) { maxRecent = Math.max(maxRecent, T.recentCommits(p.id)); });
    G.projects.forEach(function (p) {
      if (K.visitor && !visible(p)) return;
      // who made the commits: the last four weeks if there were any, else all sixteen
      var you = 0, ag = 0, you16 = 0, ag16 = 0;
      Object.keys(p.weeks || {}).forEach(function (w) {
        var c = p.weeks[w], a = (c.claude || 0) + (c.codex || 0) + (c.named || 0);
        you16 += c.person || 0; ag16 += a;
        if (w >= since) { you += c.person || 0; ag += a; }
      });
      if (you + ag === 0) { you = you16; ag = ag16; }
      var share = you + ag ? you / (you + ag) : 0.5, recent = T.recentCommits(p.id);
      // a visitor sees the apps and how they are made, not how much anyone worked on them
      if (K.visitor) node('p:' + p.id, { kind: 'p', id: p.id, name: p.name, p: p, cluster: p.cluster, recent: 0, act: 0.45, notes: false, you: 0.5, tint: INK, url: pageOf(p) });
      else node('p:' + p.id, { kind: 'p', id: p.id, name: p.name, p: p, cluster: p.cluster, recent: recent, act: Math.sqrt(recent / maxRecent),
        notes: p.src === 'notes', you: share,
        tint: share >= 0.5 ? mix(INK, RAD, 0.15 + 0.55 * (share - 0.5) * 2) : mix(INK, CYAN, 0.12 + 0.5 * (0.5 - share) * 2) });
    });
    G.shared.forEach(function (s) { node('s:' + s.id, { kind: 's', id: s.id, name: s.name }); });
    G.projects.forEach(function (p) {
      var pn = byKey['p:' + p.id];
      if (!pn) return;
      (p.shared || []).forEach(function (s) { if (byKey['s:' + s]) link(pn, byKey['s:' + s]); });
      (p.tech || []).forEach(function (t) { link(pn, node('t:' + t, { kind: 't', id: t, name: t })); });
    });
    // a shared module also belongs to the project it lives in
    G.shared.forEach(function (s) { var m = byKey['s:' + s.id], h = byKey['p:' + s.home]; if (m && h) link(h, m, true); });
    // a module none of the shown apps uses has no place in this sky
    if (K.visitor) { N = N.filter(function (x) { return x.kind === 'p' || x.users.length; }); N.forEach(function (x, i) { x.i = i; }); }
    var r = rng(0.2323), lastAt = {};
    (G.recent || []).forEach(function (c) { var t = new Date(c.t).getTime(); if (!lastAt[c.p] || t > lastAt[c.p]) lastAt[c.p] = t; });
    N.forEach(function (x) { x.ph = r() * TAU; x.n = x.kind === 'p' ? 0 : x.users.length; if (x.kind === 'p') x.lastAt = lastAt[x.id] || 0; });
    K.nodes = N; K.edges = edges; K.byKey = byKey;
    K.projects = N.filter(function (x) { return x.kind === 'p'; });
    K.byId = {};
    K.projects.forEach(function (x) { K.byId[x.id] = x; });
  }

  // where things sit: a force layout over what is built together, run in the shape of the screen, the same every time
  function layout(A) {
    var N = K.nodes, n = N.length, r = rng(0.5151), order = G.clusters.map(function (c) { return c[0]; });
    var ps = K.projects.slice().sort(function (a, b) { return order.indexOf(a.cluster) - order.indexOf(b.cluster) || a.id.localeCompare(b.id); });
    // projects start around an ellipse in their groups, as they sit on the chord; modules start among their users
    ps.forEach(function (x, i) { var a = i / ps.length * TAU; x.x = Math.cos(a) * A * 0.75; x.y = Math.sin(a) * 0.75; });
    N.forEach(function (x) {
      if (x.kind === 'p') return;
      var sx = 0, sy = 0;
      x.users.forEach(function (u) { sx += u.x; sy += u.y; });
      x.x = sx / x.users.length + (r() - 0.5) * 0.12; x.y = sy / x.users.length + (r() - 0.5) * 0.12;
    });
    var ties = K.edges.slice();
    ps.forEach(function (a, i) { ps.forEach(function (b, j) { if (j > i && a.cluster === b.cluster) ties.push([a, b, 0.1]); }); });
    // a module only one project uses pushes others less, so it settles beside that project
    var push = N.map(function (x) { return x.kind !== 'p' && x.users.length < 2 ? 0.35 : 1; });
    var k = Math.sqrt(4 * A / n) * 0.62, k2 = k * k, fx = new Float64Array(n), fy = new Float64Array(n), STEPS = 520;
    for (var it = 0; it < STEPS; it++) {
      var temp = 0.12 * Math.pow(1 - it / STEPS, 1.6) + 0.0015;
      fx.fill(0); fy.fill(0);
      for (var i = 0; i < n; i++) {
        var a = N[i];
        for (var j = i + 1; j < n; j++) {
          var b = N[j], ex = a.x - b.x, ey = a.y - b.y, d2 = ex * ex + ey * ey + 1e-4, f = k2 / d2 * push[i] * push[j];
          fx[i] += ex * f; fy[i] += ey * f; fx[j] -= ex * f; fy[j] -= ey * f;
        }
      }
      for (var e = 0; e < ties.length; e++) {
        var t = ties[e], p = t[0], q = t[1], dx = p.x - q.x, dy = p.y - q.y, d = Math.sqrt(dx * dx + dy * dy) + 1e-6, fa = d / k * t[2];
        fx[p.i] -= dx * fa; fy[p.i] -= dy * fa; fx[q.i] += dx * fa; fy[q.i] += dy * fa;
      }
      for (i = 0; i < n; i++) {
        // a gentle pull to the middle, shaped like the screen, and a soft edge instead of a wall
        fx[i] -= N[i].x * 0.16 / A; fy[i] -= N[i].y * 0.16;
        var ox = Math.abs(N[i].x) - A * 0.9, oy = Math.abs(N[i].y) - 0.9;
        if (ox > 0) fx[i] -= Math.sign(N[i].x) * ox * 2; if (oy > 0) fy[i] -= Math.sign(N[i].y) * oy * 2;
        var m = Math.sqrt(fx[i] * fx[i] + fy[i] * fy[i]) + 1e-9, sc = Math.min(m, temp) / m;
        N[i].x += fx[i] * sc; N[i].y += fy[i] * sc;
      }
    }
  }

  // fit the layout to the glass, then draw each constellation as the shortest tree from the project through its modules
  function place() {
    K.wide = K.W >= 900 && K.W > K.H;
    var top = K.rem * (K.visitor ? (K.W < 760 ? 7.4 : 5.6) : 3.2), bot = K.H - Math.max(K.bar, K.rem * 5.5) - K.rem * (K.wide ? 4.2 : 8.6), x0 = K.rem * 2.6, x1 = K.W - K.rem * 2.6;
    var w = x1 - x0, h = Math.max(120, bot - top), A = w / h;
    if (Math.abs(A - K.aspect) > 0.02) { layout(A); K.aspect = A; }
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    K.nodes.forEach(function (x) { minX = Math.min(minX, x.x); maxX = Math.max(maxX, x.x); minY = Math.min(minY, x.y); maxY = Math.max(maxY, x.y); });
    var sc = Math.min(w / Math.max(1e-6, maxX - minX), h / Math.max(1e-6, maxY - minY));
    var sx = Math.min(w / Math.max(1e-6, maxX - minX), sc * 1.5), sy = sc;
    var ox = x0 + (w - (maxX - minX) * sx) / 2, oy = top + (h - (maxY - minY) * sy) / 2;
    K.nodes.forEach(function (x) { x.X = ox + (x.x - minX) * sx; x.Y = oy + (x.y - minY) * sy; });
    K.projects.forEach(function (p) {
      var set = [p].concat(p.mods), inTree = [true], best = [], from = [], tree = [];
      for (var i = 1; i < set.length; i++) { inTree.push(false); best.push(1e18); from.push(0); }
      best.unshift(0); from.unshift(-1);
      for (var i2 = 1; i2 < set.length; i2++) best[i2] = Math.hypot(set[i2].X - p.X, set[i2].Y - p.Y);
      for (var added = 1; added < set.length; added++) {
        var bi = -1, bd = 1e18;
        for (var j = 1; j < set.length; j++) if (!inTree[j] && best[j] < bd) { bd = best[j]; bi = j; }
        inTree[bi] = true; tree.push([set[from[bi]], set[bi], added]);
        for (var k2 = 1; k2 < set.length; k2++) if (!inTree[k2]) {
          var dd = Math.hypot(set[k2].X - set[bi].X, set[k2].Y - set[bi].Y);
          if (dd < best[k2]) { best[k2] = dd; from[k2] = bi; }
        }
      }
      p.tree = tree;
    });
    placeLabels();
  }

  // names: projects first, the busiest first, then your modules; none covers another
  function placeLabels() {
    var taken = [], f1 = Math.round(K.rem * (K.wide ? 0.62 : 0.56)), f2 = Math.round(K.rem * (K.wide ? 0.58 : 0.54));
    g.font = '500 ' + f1 + 'px "Archivo", ui-sans-serif, system-ui, sans-serif';
    function fits(b) { return !taken.some(function (t) { return b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1]; }); }
    function put(x, txt, size, font) {
      g.font = font;
      var w = g.measureText(txt).width, rr = x.kind === 'p' ? x.R + 4 : x.R + 3;
      var tries = [[x.X - w / 2, x.Y + rr + 2], [x.X + rr + 4, x.Y - size / 2], [x.X - w - rr - 4, x.Y - size / 2], [x.X - w / 2, x.Y - rr - size - 3],
        [x.X + rr + 2, x.Y + rr], [x.X - w - rr - 2, x.Y + rr], [x.X + rr + 2, x.Y - rr - size], [x.X - w - rr - 2, x.Y - rr - size]];
      for (var i = 0; i < tries.length; i++) {
        var b = [tries[i][0] - 2, tries[i][1] - 1, tries[i][0] + w + 2, tries[i][1] + size + 2];
        if (b[0] < 4 || b[2] > K.W - 4 || b[1] < 4 || b[3] > K.H - K.bar) continue;
        if (fits(b)) { taken.push(b); return { x: tries[i][0], y: tries[i][1], w: w, box: b }; }
      }
      return null;
    }
    // the stars themselves are not to be covered, nor the place where things rise to the surface
    K.nodes.forEach(function (x) { x.R = radius(x); taken.push([x.X - x.R - 1, x.Y - x.R - 1, x.X + x.R + 1, x.Y + x.R + 1]); });
    if (K.wide) taken.push([K.W / 2 - K.rem * 15, K.H - K.bar - K.rem * 3.2, K.W / 2 + K.rem * 15, K.H]);
    K.nodes.forEach(function (x) { x.text = x.kind === 'p' ? x.name.toUpperCase().split('').join(' ') : x.name; x.label = null; });
    var cap = K.wide ? 99 : 14, mono = '400 ' + f2 + 'px "JetBrains Mono", ui-monospace, monospace';
    K.projects.slice().sort(function (a, b) { return b.recent - a.recent || b.mods.length - a.mods.length; }).forEach(function (p, i) {
      if (i >= cap && !p.recent) return;
      p.label = put(p, p.text, f1, '500 ' + f1 + 'px "Archivo", ui-sans-serif, system-ui, sans-serif');
    });
    // your modules, then the libraries that three or more projects lean on
    K.nodes.filter(function (x) { return x.kind === 's'; }).sort(function (a, b) { return b.n - a.n; }).forEach(function (m) {
      if (K.wide || m.n > 2) m.label = put(m, m.text, f2, mono);
    });
    if (K.wide) K.nodes.filter(function (x) { return x.kind === 't' && x.n >= 3; }).sort(function (a, b) { return b.n - a.n; }).forEach(function (m) { m.label = put(m, m.text, f2, mono); });
    K.f1 = f1; K.f2 = f2; K.taken = taken; K.put = put; K.litKey = null;
  }
  function radius(x) {
    var dot = K.rem / (S.mode === 'pano' ? 13 : 16);
    if (x.kind === 'p') return x.notes ? 2.4 * dot : (1.5 + 2.6 * x.act) * dot;
    if (x.kind === 's') return (1.3 + 1.05 * Math.sqrt(x.n)) * dot;
    return (0.75 + 0.5 * Math.sqrt(x.n)) * dot;
  }

  // one faint grain for each commit in sixteen weeks, laid once
  function dust() {
    if (K.visitor) { K.dust = null; return; }   // the grains are commits, which a visitor does not see
    var d = document.createElement('canvas');
    d.width = Math.round(K.W * K.dpr); d.height = Math.round(K.H * K.dpr);
    var x = d.getContext('2d'), r = rng(0.1717), today = Date.now();
    x.setTransform(K.dpr, 0, 0, K.dpr, 0, 0);
    G.days.forEach(function (row) {
      var age = (today - new Date(row[0] + 'T12:00:00').getTime()) / DAY;
      [[1, RAD], [2, CYAN], [3, CYAN], [4, CYAN]].forEach(function (k) {
        for (var j = 0; j < row[k[0]]; j++) {
          var a = (0.04 + 0.16 * Math.exp(-age / 12)) * (0.6 + r() * 0.4);
          x.fillStyle = rgba(mix(INK, k[1], 0.35), a);
          x.fillRect(r() * K.W, r() * (K.H - K.bar * 0.6), 1, 1);
        }
      });
    });
    K.dust = d;
  }

  // ---------------------------------------------------------------- what rises to the surface
  function byAt(a, b) { return new Date(a.at) - new Date(b.at); }
  function when(at) {
    var d = new Date(at), t0 = new Date(); t0.setHours(0, 0, 0, 0);
    var days = Math.round((new Date(d).setHours(0, 0, 0, 0) - t0.getTime()) / DAY);
    return (days === 0 ? 'today' : days === 1 ? 'tomorrow' : T.DAY[d.getDay()].slice(0, 3) + ' ' + T.dm(d)) + ', ' + T.hm(d);
  }
  function appItem(x) {
    var p = x.p, plats = (p.platforms || []).map(function (f) { var e = E.get('f:' + f); return e ? e.name : f; });
    var mods = x.mods.filter(function (m) { return m.kind === 's'; }), peers = {};
    x.mods.forEach(function (m) { m.users.forEach(function (u) { if (u !== x) peers[u.id] = 1; }); });
    var np = Object.keys(peers).length;
    return { key: 'v' + x.id, k: T.clusterName[p.cluster] || 'App', title: x.name, p: x.id, url: x.url,
      sub: (plats.length ? plats.join(', ') : 'In the works') + '. ' + (mods.length ? T.plural(mods.length, 'shared module') + ', ' : '') + (np ? 'parts in common with ' + T.plural(np, 'other app') + '.' : 'nothing in common yet.') };
  }
  function moduleItem(m) {
    return { key: 'm' + m.key, k: m.kind === 's' ? 'Shared module' : 'Library', title: m.name, mod: m.key,
      sub: 'in ' + T.list(m.users.map(function (u) { return u.name; }), 5) };
  }
  function queue() {
    // a visitor is walked through the apps, the most connected first
    if (K.visitor) return K.projects.slice().sort(function (a, b) { return b.mods.length - a.mods.length || a.name.localeCompare(b.name); }).map(appItem);
    var now = Date.now(), q = [], seen = {};
    function add(x) { var k = x && (x.open || x.key); if (x && !seen[k]) { seen[k] = 1; q.push(x); } }
    // due within two days
    SEED.schedule.filter(function (s) { var t = new Date(s.at).getTime(); return t > now && t - now < 2.2 * DAY; }).sort(byAt).forEach(function (s) {
      add({ key: 'd' + s.id, k: s.lane === 'publish' ? 'Goes out' : 'Due', title: s.title, sub: when(s.at) + ', ' + T.leftShort(s.at), p: s.p, violet: true, open: s.id });
    });
    // the next reminder
    var nz = T.nextNudge();
    if (nz && nz.when.getTime() - now < 3 * DAY) add({ key: 'n' + nz.item.id, k: 'Reminder', title: nz.item.title, sub: when(nz.when) + ', ' + nz.label, p: nz.item.p, violet: true, open: nz.item.id });
    // what waits on you
    var gs = T.tasks.filter(function (t) { return t.kind === 'gate' && t.status !== 'done' && t.owner === 'you'; });
    gs.forEach(function (x) { x._f = T.frees(x.id); });
    gs.sort(function (a, b) { return b._f - a._f; }).slice(0, 2).forEach(function (x) {
      add({ key: 'g' + x.id, k: 'Waits on you', title: x.title, sub: T.projectName(x.p) + (x._f ? ', frees ' + x._f : '') + (x.stalled ? ', waiting ' + x.stalled : ''), p: x.p, violet: true, open: x.id });
    });
    // what moved since yesterday
    var since = new Date(G.digest_since), fresh = G.moves.filter(function (m) { return new Date(m.last) >= since; });
    if (fresh.length) {
      var c = 0, per = {};
      fresh.forEach(function (m) { c += m.n; m.ps.forEach(function (p) { per[p] = (per[p] || 0) + 1; }); });
      var busiest = Object.keys(per).sort(function (a, b) { return T.recentCommits(b) - T.recentCommits(a); })[0];
      fresh.sort(function (a, b) { return b.n - a.n; });
      add({ key: 'moved', k: 'Moved', title: T.plural(c, 'commit') + ' since yesterday', sub: fresh[0].title + ', ' + T.ago(fresh[0].last), p: busiest || fresh[0].ps[0], lens: 'a:' + fresh[0].agent });
    }
    // the nearest fixed deadline
    var hard = SEED.schedule.filter(function (s) { return s.hard && s.committed && new Date(s.at).getTime() > now; }).sort(byAt)[0];
    if (hard) {
      var ready = hard.send ? hard.send.filter(function (y) { return y[1] && T.isDone(y[1]); }).length : 0;
      add({ key: 'h' + hard.id, k: 'Deadline', title: hard.title, sub: T.leftShort(hard.at) + ', ' + T.dm(hard.at) + (hard.send ? ', ' + ready + ' of ' + hard.send.length + ' ready' : ''), p: hard.p, violet: true, open: hard.id });
    }
    // the module the most projects lean on: what a fix there would reach
    var hub = K.nodes.filter(function (x) { return x.kind === 's'; }).sort(function (a, b) { return b.n - a.n; })[0];
    if (hub) {
      var users = hub.users.filter(function (u) { return u !== hub.home; });
      add({ key: 'hub', k: 'Most shared', title: hub.name, sub: 'used by ' + T.plural(users.length, 'project') + (hub.home ? ', lives in ' + hub.home.name : ''), mod: hub.key, lens: hub.key });
    }
    // the busiest project of the month, as a quiet good thing
    var top = K.projects.slice().sort(function (a, b) { return b.recent - a.recent; })[0];
    if (top && top.recent) add({ key: 'busy', k: 'Busiest this month', title: top.name, sub: T.plural(top.recent, 'commit') + ' in four weeks', p: top.id, lens: 'p:' + top.id });
    return q;
  }
  function next() {
    if (!K.on) return;
    if (!K.q.length || K.qi >= K.q.length - 1) { K.q = queue(); K.qi = -1; }
    K.qi++;
    show(K.q[K.qi] || null);
    clearTimeout(K.timer);
    K.timer = setTimeout(next, HOLD);
  }
  function show(it) {
    K.shown = it; K.shownAt = performance.now();
    if (!it) { card.hidden = true; return; }
    card.classList.remove('in');
    T.clear(card);
    card.appendChild(el('span', { class: 'sk-k' }, it.k));
    card.appendChild(el('span', { class: 'sk-t' }, it.title));
    card.appendChild(el('span', { class: 'sk-s' }, it.sub));
    if (K.visitor && it.url) card.appendChild(el('span', { class: 'sk-u' }, it.url.replace(/^https:\/\//, '') + ' ↗'));
    card.hidden = false;
    card.classList.toggle('calm', !it.violet);
    card.setAttribute('aria-label', it.k + ': ' + it.title + ', ' + it.sub);
    // always in the same place, the surface: in the bar between the clock and Ask on a wide screen, just above it on a phone
    var bar = T.$('#skyBar').getBoundingClientRect(), cw = card.offsetWidth, chh = card.offsetHeight, x, y;
    if (K.wide) { x = (K.W - cw) / 2; y = bar.bottom - chh - K.rem * 1.15; }
    else { x = Math.max(K.rem * 1.6, parseFloat(getComputedStyle(T.$('#skyBar')).paddingLeft) || 0); y = bar.top - chh - K.rem * 0.6; }
    card.style.left = Math.round(x) + 'px'; card.style.top = Math.round(y) + 'px';
    card.classList.toggle('wide', K.wide);
    K.cardAt = [K.wide ? x + cw / 2 : x + K.rem * 0.4, y - K.rem * 0.5];
    requestAnimationFrame(function () { card.classList.add('in'); });
  }
  function rise(now) {
    // how far the current item's light has come up, and gone down again before the next
    if (!K.shown) return 0;
    var t = now - K.shownAt;
    if (reduce) return 1;
    return clamp(t / FADE, 0, 1) * clamp((HOLD - t) / FADE, 0, 1);
  }

  // ---------------------------------------------------------------- drawing
  function size() {
    K.W = window.innerWidth; K.H = window.innerHeight;
    K.dpr = Math.min(2, window.devicePixelRatio || 1);
    if (K.W * K.H * K.dpr * K.dpr > 9e6) K.dpr = Math.max(1, Math.sqrt(9e6 / (K.W * K.H)));
    K.rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    cv.width = Math.round(K.W * K.dpr); cv.height = Math.round(K.H * K.dpr);
    var bar = T.$('#skyBar');
    K.bar = bar ? bar.offsetHeight : K.rem * 5;
    host.setAttribute('data-mode', S.mode);
    g.setTransform(K.dpr, 0, 0, K.dpr, 0, 0);
    place(); dust();
    if (K.shown) show(K.shown);
  }
  function frame(now) {
    if (!K.on) return;
    K.raf = requestAnimationFrame(frame);
    if (document.hidden || now - K.last < (reduce ? 900 : 33)) return;
    K.last = now;
    draw(now);
  }
  // what is lit right now: the item that rose, a project or module under the pointer, or one tapped on glass
  function litSet(now) {
    var it = K.shown, L0 = rise(now), f = K.hover || K.sel, lit = {}, any = 0, violet = false;
    function light(p, v) { lit[p.key] = Math.max(lit[p.key] || 0, v); any = Math.max(any, v); }
    if (it && L0 > 0) {
      if (it.p && K.byId[it.p]) { light(K.byId[it.p], L0); violet = !!it.violet; }
      if (it.mod && K.byKey[it.mod]) K.byKey[it.mod].users.forEach(function (u) { light(u, L0); });
    }
    if (f) { violet = false; if (f.kind === 'p') light(f, 1); else f.users.forEach(function (u) { light(u, 1); }); }
    return { lit: lit, any: any, violet: violet, focus: f || (it && it.mod && K.byKey[it.mod]) || null };
  }
  function star4(x, y, r) {
    g.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? r * 0.36 : r;
      if (i) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
  }
  function draw(now) {
    var t = (now - K.t0) / 1000, grow = reduce ? 1 : clamp((now - K.born) / 2400, 0, 1);
    g.setTransform(K.dpr, 0, 0, K.dpr, 0, 0);
    g.clearRect(0, 0, K.W, K.H);
    // the whole sky drifts a few pixels over minutes: nothing on the panel stays put
    var dx = reduce ? 0 : Math.sin(t * TAU / 300) * 3, dy = reduce ? 0 : Math.cos(t * TAU / 420) * 2;
    if (K.dust) g.drawImage(K.dust, dx * 0.5, dy * 0.5, K.W, K.H);
    g.translate(dx, dy);
    var LS = litSet(now), lit = LS.lit, dim = 1 - 0.5 * LS.any, lw = Math.max(0.8, K.rem / 18);
    var litMods = {};
    // the constellations: each project's lines, bright with its recent work, tinted by who did it
    K.projects.forEach(function (p) {
      var L = lit[p.key] || 0, col = L && LS.violet ? mix(p.tint, VIO, L) : p.tint;
      var a = p.notes ? 0.07 : 0.06 + 0.3 * p.act;
      a = L ? a + (0.72 - a) * L : a * dim;
      g.strokeStyle = rgba(col, a); g.lineWidth = lw * (1 + 0.5 * L);
      g.setLineDash(p.notes ? [2, 4] : []);
      g.beginPath();
      p.tree.forEach(function (e) {
        var k = clamp(grow * 1.5 - e[2] * 0.05, 0, 1);
        if (k <= 0) return;
        g.moveTo(e[0].X, e[0].Y); g.lineTo(e[0].X + (e[1].X - e[0].X) * k, e[0].Y + (e[1].Y - e[0].Y) * k);
        if (L) litMods[e[1].key] = Math.max(litMods[e[1].key] || 0, L);
      });
      g.stroke();
    });
    g.setLineDash([]);
    if (LS.focus && LS.focus.kind !== 'p') litMods[LS.focus.key] = 1;
    // the modules: yours as four-point stars, libraries as dots, both sized by how many projects use them
    K.nodes.forEach(function (x) {
      if (x.kind === 'p') return;
      var L = litMods[x.key] || 0;
      var base = x.kind === 's' ? 0.9 : 0.5, a = (L ? base + (1 - base) * L : base * (0.55 + 0.45 * dim)) * clamp(grow * 2, 0, 1);
      g.fillStyle = rgba(L && LS.violet ? mix(INK, VIO, L * 0.6) : INK, a);
      if (x.kind === 's') {
        star4(x.X, x.Y, x.R * 1.7); g.fill();
        g.beginPath(); g.arc(x.X, x.Y, x.R * 0.55, 0, TAU); g.fill();
      } else { g.beginPath(); g.arc(x.X, x.Y, x.R, 0, TAU); g.fill(); }
    });
    // the projects: glowing with their last four weeks; a ring when they live in notes
    K.projects.forEach(function (p) {
      var L = lit[p.key] || 0, col = L && LS.violet ? mix(p.tint, VIO, L) : p.tint, gr = clamp(grow * 2, 0, 1);
      if (p.notes) {
        g.strokeStyle = rgba(INK, (0.32 + 0.5 * L) * gr); g.lineWidth = 1;
        g.beginPath(); g.arc(p.X, p.Y, p.R, 0, TAU); g.stroke();
        return;
      }
      if (p.recent) {
        var live = Date.now() - p.lastAt < 3 * 36e5, br = reduce || !live ? 1 : 0.8 + 0.2 * Math.sin(t * TAU / 5 + p.ph), rr = p.R * (2.6 + 1.4 * L) * br;
        var hg = g.createRadialGradient(p.X, p.Y, 0, p.X, p.Y, rr);
        hg.addColorStop(0, rgba(col, (0.24 + 0.3 * p.act + 0.2 * L) * gr * (T.breath ? T.breath(now) : 1))); hg.addColorStop(1, rgba(col, 0));
        g.fillStyle = hg; g.beginPath(); g.arc(p.X, p.Y, rr, 0, TAU); g.fill();
      }
      g.fillStyle = rgba(col, (p.recent ? 0.62 + 0.38 * p.act : 0.42) * (L ? 1 : 0.7 + 0.3 * dim) * gr);
      g.beginPath(); g.arc(p.X, p.Y, p.R, 0, TAU); g.fill();
    });
    // names: the ones placed for good, then the lit ones around them
    var gl = clamp((grow - 0.4) / 0.6, 0, 1);
    litLabels(lit, litMods, LS.focus);
    g.textBaseline = 'top'; g.textAlign = 'left';
    K.projects.forEach(function (p) {
      var L = lit[p.key] || 0;
      var lb = p.label || (L ? p.lit : null);
      if (!lb) return;
      var a = L ? 0.55 + 0.4 * L : (p.notes ? 0.2 : 0.24 + 0.46 * p.act) * (0.5 + 0.5 * dim);
      g.font = '500 ' + K.f1 + 'px "Archivo", ui-sans-serif, system-ui, sans-serif';
      g.fillStyle = rgba(L && LS.violet ? VIO : INK, a * gl);
      g.fillText(p.text, lb.x, lb.y);
    });
    K.nodes.forEach(function (x) {
      if (x.kind === 'p') return;
      var L = litMods[x.key] || 0;
      var lb = x.label || (L || LS.focus === x ? x.lit : null);
      if (!lb) return;
      var a = L ? 0.5 + 0.4 * L : 0.36 * (0.5 + 0.5 * dim);
      g.font = '400 ' + K.f2 + 'px "JetBrains Mono", ui-monospace, monospace';
      g.fillStyle = rgba(INK, a * gl);
      g.fillText(x.text, lb.x, lb.y);
      if (LS.focus === x) { g.fillStyle = rgba(INK, 0.62 * gl); g.fillText(counted(x).trim(), lb.x, lb.y + K.f2 * 1.3); }
    });
    // a thread from what rose to the surface up to its project
    var it = K.shown, L0 = rise(now), tgt = it && (it.p && K.byId[it.p] || it.mod && K.byKey[it.mod]);
    if (tgt && K.cardAt && L0 > 0.02) {
      var ex = K.cardAt[0] - dx, ey = K.cardAt[1] - dy, ang = Math.atan2(ey - tgt.Y, ex - tgt.X);
      var sx = tgt.X + Math.cos(ang) * (tgt.R + K.rem * 0.6), sy = tgt.Y + Math.sin(ang) * (tgt.R + K.rem * 0.6);
      var lg = g.createLinearGradient(sx, sy, ex, ey), vc = it.violet ? VIO : INK;
      lg.addColorStop(0, rgba(vc, 0.42 * L0)); lg.addColorStop(0.55, rgba(vc, 0.08 * L0)); lg.addColorStop(1, rgba(vc, 0));
      g.strokeStyle = lg; g.lineWidth = lw; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
    }
  }
  // lit names that had no settled place: placed once each time what is lit changes, around everything already named
  function litLabels(lit, litMods, focus) {
    var key = Object.keys(lit).sort().join(',') + '|' + Object.keys(litMods).sort().join(',') + '|' + (focus ? focus.key : '');
    if (key === K.litKey) return;
    K.litKey = key;
    var saved = K.taken.length, sans = '500 ' + K.f1 + 'px "Archivo", ui-sans-serif, system-ui, sans-serif', mono = '400 ' + K.f2 + 'px "JetBrains Mono", ui-monospace, monospace';
    K.nodes.forEach(function (x) { x.lit = null; });
    var want = [];
    if (focus && !focus.label) want.push(focus);
    K.projects.forEach(function (p) { if (lit[p.key] && !p.label) want.push(p); });
    K.nodes.forEach(function (x) { if (x.kind !== 'p' && litMods[x.key] && !x.label && x !== focus) want.push(x); });
    want.sort(function (a, b) { return (a === focus ? -1 : 0) - (b === focus ? -1 : 0) || (a.kind === 'p' ? 0 : a.kind === 's' ? 1 : 2) - (b.kind === 'p' ? 0 : b.kind === 's' ? 1 : 2) || b.n - a.n; });
    want.forEach(function (x) { x.lit = K.put(x, x.text, x.kind === 'p' ? K.f1 : K.f2, x.kind === 'p' ? sans : mono); });
    K.taken.length = saved;
  }
  function counted(x) {
    var home = x.home, used = x.users.filter(function (u) { return u !== home; }).length;
    return '  used by ' + used + (home ? ', lives in ' + home.name : '');
  }
  function tick() {
    if (!K.on) return;
    var d = new Date();
    timeEl.textContent = T.hm(d);
    dateEl.textContent = T.DAY[d.getDay()].slice(0, 3) + ' ' + d.getDate() + ' ' + T.MONL[d.getMonth()];
  }

  // ---------------------------------------------------------------- touching the sky
  function hitAt(x, y) {
    var best = null, bd = 1e9;
    K.nodes.forEach(function (n) {
      var d = Math.hypot(x - n.X, y - n.Y) - n.R;
      if (d < K.rem * 0.9 && d < bd) { bd = d; best = n; }
    });
    if (best) return best;
    K.projects.forEach(function (p) { var b = p.label && p.label.box; if (b && x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) best = p; });
    return best;
  }
  function lensFor(n) {
    if (n.kind === 'p') return 'p:' + n.id;
    var key = n.key;
    if (E.get(key)) return key;
    var u = n.users.slice().sort(function (a, b) { return b.recent - a.recent; })[0];
    return u ? 'p:' + u.id : null;
  }
  function leanInOn(n) {
    T.leanIn();
    var id = lensFor(n);
    if (!id) return;
    if (S.mode !== 'pano' && S.view !== 'canopy') T.setView('canopy');
    T.setLens(id);
    if (n.kind === 't' && !E.get(n.key)) T.toast(n.name + ' is used by ' + T.list(n.users.map(function (u) { return u.name; }), 4) + '.');
  }

  T.leanBack = function (auto) {
    if (K.on) return;
    if (T.closeAsk) T.closeAsk();
    if (T.closePop) T.closePop();
    if (T.closeNoteUi) T.closeNoteUi();
    K.on = true; K.auto = !!auto; K.born = performance.now(); K.t0 = K.t0 || K.born; K.sel = null; K.hover = null;
    S.lean = 'back';
    host.hidden = false;
    document.documentElement.classList.add('lean-back');
    if (!K.nodes.length) build();
    size();
    requestAnimationFrame(function () { host.classList.add('on'); });
    tick(); K.clock = setInterval(tick, 10000);
    K.q = []; K.qi = -1;
    clearTimeout(K.timer); K.timer = setTimeout(next, reduce ? 0 : 1600);
    K.raf = requestAnimationFrame(frame);
    if (!auto && !K.visitor) T.store.set('lean', 'back');
    if (!T.store.get('skyKey', false) && !K.visitor) { keyEl.hidden = false; T.store.set('skyKey', true); }
    host.classList.toggle('visitor', K.visitor);
    visEl.hidden = !K.visitor;
    if (K.visitor) { keyEl.hidden = true; T.$('#skyVisT').textContent = T.plural(K.projects.length, 'app') + ', each joined to the others through the modules it shares. Read-only.'; }
    T.emit('lean', 'back');
  };
  T.leanIn = function (quiet) {
    if (!K.on) return;
    K.on = false;
    S.lean = 'in';
    cancelAnimationFrame(K.raf); clearTimeout(K.timer); clearInterval(K.clock);
    host.classList.remove('on');
    document.documentElement.classList.remove('lean-back');
    setTimeout(function () { if (!K.on) { host.hidden = true; card.hidden = true; K.shown = null; } }, reduce ? 0 : 420);
    if (!K.auto && !quiet && !K.visitor) T.store.set('lean', 'in');
    K.auto = false;
    // leaving the free view puts your own sky back for next time
    if (K.visitor) { K.visitor = false; K.nodes = []; K.aspect = 0; K.dust = null; setTimeout(function () { if (!K.on) { host.classList.remove('visitor'); visEl.hidden = true; } }, reduce ? 0 : 420); }
    T.emit('lean', 'in');
    if (T.canopySize) T.canopySize();
  };
  T.isLeanBack = function () { return K.on; };
  T.isVisitor = function () { return K.on && K.visitor; };
  T.visitorView = function (on) {
    if (!on) { if (K.visitor) T.leanIn(); return; }
    if (K.on) T.leanIn(true);
    var go = function () { K.visitor = true; K.nodes = []; K.aspect = 0; K.dust = null; T.leanBack(false); };
    if (host.hidden) go(); else setTimeout(go, reduce ? 0 : 440);
  };
  T.leanBackAuto = function () { return K.on && K.auto; };
  T.skyNext = function () { next(); };   // for tests: move to the next item now
  T.skyProbe = function () { return K.nodes.map(function (x) { return { key: x.key, kind: x.kind, x: x.X, y: x.Y, R: x.R, n: x.n, users: x.users.length, mods: x.mods.length }; }); };

  T.initSky = function () {
    host = T.$('#sky'); cv = T.$('#cvSky'); g = cv.getContext('2d'); card = T.$('#skyCard'); timeEl = T.$('#skyT'); dateEl = T.$('#skyD'); visEl = T.$('#skyVis');
    T.$('#skyVisX').addEventListener('click', function () { T.leanIn(); });
    if ((location.hash || '') === '#visitor') setTimeout(function () { T.visitorView(true); }, 80);
    hint = T.$('#skyHint'); keyEl = T.$('#skyKeyBox');
    cv.addEventListener('pointermove', function (ev) {
      if (ev.pointerType !== 'mouse') return;
      var n = hitAt(ev.clientX, ev.clientY);
      if (n !== K.hover) { K.hover = n; cv.style.cursor = n ? 'pointer' : 'default'; }
    });
    cv.addEventListener('pointerleave', function () { K.hover = null; });
    cv.addEventListener('click', function (ev) {
      var n = hitAt(ev.clientX, ev.clientY);
      // a visitor stays in the sky: a star brings its app, or its module, to the surface
      if (K.visitor) {
        if (n) { K.sel = n; show(n.kind === 'p' ? appItem(n) : moduleItem(n)); clearTimeout(K.timer); K.timer = setTimeout(next, HOLD * 1.6); }
        else K.sel = null;
        return;
      }
      // with a mouse the pointer already lit it, so a click goes in; on glass the first tap lights it and the second goes in
      if (n && (ev.pointerType === 'mouse' || K.sel === n)) { K.sel = null; leanInOn(n); return; }
      if (n) { K.sel = n; return; }
      if (K.sel) { K.sel = null; return; }
      T.leanIn();
    });
    card.addEventListener('click', function () {
      var it = K.shown;
      if (K.visitor) { if (it && it.url) window.open(it.url, '_blank', 'noopener'); return; }
      T.leanIn();
      if (!it) return;
      if (it.open) setTimeout(function () { T.openTaskAt(it.open, window.innerWidth / 2, window.innerHeight * 0.3); }, 60);
      else if (it.lens) T.setLens(it.lens);
    });
    T.$('#skyIn').addEventListener('click', function () { T.leanIn(); });
    T.$('#skyAsk').addEventListener('click', function () { T.openAsk(''); });
    T.$('#skyKey').addEventListener('click', function () { keyEl.hidden = !keyEl.hidden; });
    T.$('#skyKeyX').addEventListener('click', function () { keyEl.hidden = true; });
    window.addEventListener('resize', function () { if (K.on) size(); });
  };
})();
