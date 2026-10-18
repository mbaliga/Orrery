/* core: helpers, state, the entity graph, the lens */
(function () {
  'use strict';
  var G = window.TRACKER_GRAPH, SEED = window.TRACKER_SEED;
  var T = window.T = { G: G, SEED: SEED };

  // ---------------------------------------------------------------- dom
  T.$ = function (s, r) { return (r || document).querySelector(s); };
  T.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function add(parent, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { add(parent, k); }); return; }
    parent.appendChild(typeof kid === 'object' ? kid : document.createTextNode(String(kid)));
  }
  function apply(e, attrs, ns) {
    if (!attrs) return;
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') { if (ns) e.setAttribute('class', v); else e.className = v; }
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;            // only ever our own markup
      else if (k === 'on') Object.keys(v).forEach(function (ev) { e.addEventListener(ev, v[ev]); });
      else if (k === 'data') Object.keys(v).forEach(function (d) { e.setAttribute('data-' + d, v[d]); });
      else if (k === 'style') Object.keys(v).forEach(function (p) { e.style.setProperty(p, v[p]); });
      else e.setAttribute(k, v === true ? '' : v);
    });
  }
  T.el = function (tag, attrs) {
    var e = document.createElement(tag);
    apply(e, attrs, false);
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  };
  T.sv = function (tag, attrs) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    apply(e, attrs, true);
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  };
  T.clear = function (n) { while (n.firstChild) n.removeChild(n.firstChild); return n; };

  // ---------------------------------------------------------------- format
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  T.MON = MON; T.DAY = DAY; T.MONL = MONL;
  T.int = function (n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  T.pct = function (x) { return Math.round(x * 100) + '%'; };
  T.dm = function (d) { d = new Date(d); return d.getDate() + ' ' + MON[d.getMonth()]; };
  T.pad = function (n) { return (n < 10 ? '0' : '') + n; };
  T.hm = function (d) { d = new Date(d); return T.pad(d.getHours()) + ':' + T.pad(d.getMinutes()); };
  T.plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); };
  T.list = function (arr, max) {
    if (arr.length <= max) return arr.join(', ');
    return arr.slice(0, max).join(', ') + ' and ' + (arr.length - max) + ' more';
  };
  // countdown parts for a target time
  T.left = function (at) {
    var ms = new Date(at).getTime() - Date.now(), late = ms < 0;
    ms = Math.abs(ms);
    var d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3);
    return { late: late, d: d, h: h, m: m, s: s, ms: ms };
  };
  // how long ago, short: 40m, 5h, 3d, 6w
  T.ago = function (at) {
    var ms = Date.now() - new Date(at).getTime(), m = Math.max(1, Math.round(ms / 6e4));
    if (m < 60) return m + 'm';
    var h = Math.round(m / 60);
    if (h < 36) return h + 'h';
    var d = Math.round(h / 24);
    return d < 21 ? d + 'd' : Math.round(d / 7) + 'w';
  };
  T.dayTime = function (at) { var d = new Date(at); return DAY[d.getDay()].slice(0, 3) + ' ' + T.dm(d) + ', ' + T.hm(d); };
  T.leftShort = function (at) {
    var c = T.left(at);
    var t = c.d >= 2 ? c.d + 'd' : c.d === 1 ? '1d ' + c.h + 'h' : c.h >= 1 ? c.h + 'h ' + c.m + 'm' : c.m + 'm';
    return c.late ? t + ' ago' : 'in ' + t;
  };
  // a ticking countdown element: 92d 15:37:21
  T.countdown = function (at) {
    var e = T.el('span', { class: 'cd', data: { at: at } });
    T.tick(e);
    return e;
  };
  T.tick = function (e) {
    var c = T.left(e.getAttribute('data-at'));
    T.clear(e);
    if (c.late) { e.appendChild(T.el('i', null, 'passed ')); }
    e.appendChild(T.el('b', null, String(c.d)));
    e.appendChild(T.el('i', null, 'd '));
    e.appendChild(T.el('b', null, T.pad(c.h) + ':' + T.pad(c.m) + ':' + T.pad(c.s)));
  };

  // ---------------------------------------------------------------- state
  var S = T.S = {
    mode: 'pano', view: 'today', lens: null, hover: null,
    layers: { n: true, a: true, f: true, l: true, t: true, s: true },
    sizeBy: 'activity', liveDerived: false
  };
  var subs = {};
  T.on = function (ev, fn) { (subs[ev] = subs[ev] || []).push(fn); };
  T.emit = function (ev, arg) { (subs[ev] || []).forEach(function (fn) { fn(arg); }); };
  T.store = {
    get: function (k, fb) { try { var v = localStorage.getItem('tracker.' + k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } },
    set: function (k, v) { try { localStorage.setItem('tracker.' + k, JSON.stringify(v)); } catch (e) { /* storage is a convenience only */ } },
    del: function (k) { try { localStorage.removeItem('tracker.' + k); } catch (e) { /* ignore */ } }
  };

  // ---------------------------------------------------------------- entities and links
  var E = T.E = new Map();
  var P = T.P = new Map();
  var BAND = T.BAND = { p: 'Projects', n: 'Kinds of work', a: 'Agents', f: 'Platforms', l: 'Languages', t: 'Libraries and tools', s: 'Shared' };
  var clusterName = {};
  G.clusters.forEach(function (c) { clusterName[c[0]] = c[1]; E.set('c:' + c[0], { id: 'c:' + c[0], band: 'c', name: c[1], key: c[0] }); });
  T.clusterName = clusterName;
  G.projects.forEach(function (p) { P.set(p.id, p); E.set('p:' + p.id, { id: 'p:' + p.id, band: 'p', name: p.name, p: p }); });
  G.lanes.forEach(function (l) { E.set('n:' + l[0], { id: 'n:' + l[0], band: 'n', name: l[1], key: l[0] }); });
  G.agents.forEach(function (a) { E.set('a:' + a.id, { id: 'a:' + a.id, band: 'a', name: a.name, kind: a.kind, key: a.id, commits: a.commits }); });
  G.langs.forEach(function (l) { E.set('l:' + l, { id: 'l:' + l, band: 'l', name: l }); });
  G.tech.forEach(function (t) { E.set('t:' + t, { id: 't:' + t, band: 't', name: t }); });
  G.shared.forEach(function (s) { E.set('s:' + s.id, { id: 's:' + s.id, band: 's', name: s.name, home: s.home, key: s.id }); });

  // ---------------------------------------------------------------- platforms: where each project runs or ships
  // Read from what each project is built with, so the scan decides, not a list kept by hand. A release recorded on
  // the board counts too: an app that went live on Play is on Play. Each kind has a plain icon; a company's own mark
  // can replace it in the build, from a file in the repo.
  function uses(p, names) { return (p.tech || []).some(function (t) { return names.indexOf(t) >= 0; }); }
  function onlyWeb(p) {
    var ls = Object.keys(p.langs || {});
    return ls.length > 0 && ls.every(function (l) { return /^(JavaScript|TypeScript|HTML and CSS|GLSL)$/.test(l); });
  }
  var released = {};
  (SEED.tasks || []).forEach(function (t) {
    var m = /\blive on (Play)\b/i.exec(t.title || '');
    if (m && t.status === 'done') [t.p].concat(t.also || []).forEach(function (id) { (released[id] = released[id] || []).push('play'); });
  });
  var LIVE_WALLPAPER = /wallpaper/i;
  var PLATFORMS = T.PLATFORMS = [
    { id: 'android', name: 'Android', by: 'Google', icon: 'phone', rule: 'Jetpack Compose, Room, WorkManager, CameraX, ML Kit, Media3, Coil, Hilt, Play Billing, a WebView bridge, Capacitor or a Trusted Web Activity',
      test: function (p) { return uses(p, ['Jetpack Compose', 'Room', 'WorkManager', 'CameraX', 'ML Kit', 'Media3', 'Coil', 'Hilt', 'Play Billing', 'WebView bridge', 'Capacitor', 'Trusted Web Activity']) || LIVE_WALLPAPER.test(p.repo || ''); } },
    { id: 'wearos', name: 'Wear OS', by: 'Google', icon: 'watch', rule: 'Watch Face Format', test: function (p) { return uses(p, ['Wear OS WFF']); } },
    { id: 'garmin', name: 'Garmin', by: 'Garmin', icon: 'watch', rule: 'Connect IQ, in Monkey C', test: function (p) { return uses(p, ['Connect IQ']) || !!(p.langs || {})['Monkey C']; } },
    { id: 'web', name: 'The web', by: '', icon: 'browser', rule: 'Vite, React, Astro, Next.js, Lit, Three.js, D3 or AntV G6, or nothing but web languages',
      test: function (p) { return uses(p, ['Vite', 'React', 'Astro', 'Next.js', 'Lit', 'Three.js', 'D3', 'AntV G6']) || (onlyWeb(p) && !LIVE_WALLPAPER.test(p.repo || '') && !uses(p, ['Figma Plugin API']) && p.id !== 'hyledeco'); } },
    { id: 'desktop', name: 'Desktop', by: '', icon: 'desktop', rule: 'Tauri, Compose Multiplatform, OrcaSlicer, or Bluetooth streaming with bleak',
      test: function (p) { return uses(p, ['Tauri', 'Compose Multiplatform', 'OrcaSlicer', 'bleak']); } },
    { id: 'play', name: 'Google Play', by: 'Google', icon: 'store', rule: 'Play Billing, or a release to Play recorded on the board',
      test: function (p) { return uses(p, ['Play Billing']) || (released[p.id] || []).indexOf('play') >= 0; } },
    { id: 'gfonts', name: 'Google Fonts', by: 'Google', icon: 'font', rule: 'a font made for the Google Fonts library', test: function (p) { return p.id === 'hyledeco'; } },
    { id: 'figma', name: 'Figma', by: 'Figma', icon: 'design', rule: 'the Figma Plugin API', test: function (p) { return uses(p, ['Figma Plugin API']); } },
    { id: 'vercel', name: 'Vercel', by: 'Vercel', icon: 'cloud', rule: 'a site deployed on Vercel', test: function (p) { return uses(p, ['Vercel']); } },
    { id: 'cloudflare', name: 'Cloudflare', by: 'Cloudflare', icon: 'cloud', rule: 'Cloudflare Workers', test: function (p) { return uses(p, ['Cloudflare Workers']); } },
    { id: 'actions', name: 'GitHub Actions', by: 'GitHub', icon: 'gear', rule: 'a workflow that runs on GitHub Actions', test: function (p) { return uses(p, ['GitHub Actions']) || p.id === 'orrery' || p.id === 'tracker'; } }
  ];
  // this page itself runs on the web
  var PLAT_KNOWN = { orrery: ['web'], tracker: ['web'] };
  G.projects.forEach(function (p) {
    p.platforms = PLATFORMS.filter(function (f) { return f.test(p) || (PLAT_KNOWN[p.id] || []).indexOf(f.id) >= 0; }).map(function (f) { return f.id; });
  });
  PLATFORMS.forEach(function (f) {
    if (G.projects.some(function (p) { return p.platforms.indexOf(f.id) >= 0; }))
      E.set('f:' + f.id, { id: 'f:' + f.id, band: 'f', name: f.name, key: f.id, icon: f.icon, by: f.by, rule: f.rule });
  });

  var links = T.links = [];
  G.projects.forEach(function (p) {
    var a = 'p:' + p.id;
    Object.keys(p.langs).forEach(function (l) { links.push({ a: a, b: 'l:' + l, band: 'l', w: p.langs[l] }); });
    p.tech.forEach(function (t) { if (E.has('t:' + t)) links.push({ a: a, b: 't:' + t, band: 't', w: 1 }); });
    p.shared.forEach(function (s) { if (E.has('s:' + s)) links.push({ a: a, b: 's:' + s, band: 's', w: 1 }); });
    p.platforms.forEach(function (f) { if (E.has('f:' + f)) links.push({ a: a, b: 'f:' + f, band: 'f', w: 1 }); });
    Object.keys(p.agents).forEach(function (g) { if (E.has('a:' + g)) links.push({ a: a, b: 'a:' + g, band: 'a', w: p.agents[g] }); });
    var ls = G.lane_share[p.id] || {};
    Object.keys(ls).forEach(function (n) { links.push({ a: a, b: 'n:' + n, band: 'n', w: ls[n] }); });
  });
  var adj = T.adj = new Map();
  links.forEach(function (l) {
    if (!adj.has(l.a)) adj.set(l.a, []);
    if (!adj.has(l.b)) adj.set(l.b, []);
    adj.get(l.a).push(l); adj.get(l.b).push(l);
  });
  T.neighbours = function (id) {
    return (adj.get(id) || []).map(function (l) { return l.a === id ? l.b : l.a; });
  };

  // ---------------------------------------------------------------- lens
  // The lens is one entity. Everything on the page narrows to the projects that touch it.
  var lensSet = null;
  function computeLens() {
    var e = S.lens && E.get(S.lens);
    if (!e) { lensSet = null; return; }
    if (e.band === 'p') lensSet = new Set([e.p.id]);
    else if (e.band === 'c') lensSet = new Set(G.projects.filter(function (p) { return p.cluster === e.key; }).map(function (p) { return p.id; }));
    else lensSet = new Set(T.neighbours(e.id).map(function (id) { return id.slice(2); }));
  }
  T.lensProjects = function () { return lensSet; };
  T.inLens = function (pid) { return !lensSet || lensSet.has(pid); };
  T.taskInLens = function (t) {
    var e = S.lens && E.get(S.lens);
    if (!e) return true;
    if (e.band === 'a') return t.agent === e.key;
    return lensSet.has(t.p) || (t.also || []).some(function (p) { return lensSet.has(p); });
  };
  T.changeInLens = function (c) {
    var e = S.lens && E.get(S.lens);
    if (!e) return true;
    if (e.band === 'a') return c.agent === e.key;
    return c.repos.some(function (r) { return lensSet.has(r[0]); });
  };
  T.setLens = function (id) {
    S.lens = (id && S.lens !== id) ? id : null;
    computeLens();
    T.emit('lens');
  };
  T.setHover = function (id) {
    if (S.hover === id) return;
    S.hover = id;
    T.emit('hover');
  };

  // ---------------------------------------------------------------- descriptions (nucleus, tooltip, inspector)
  var totalCommits = G.totals.commits;
  T.describe = function (id) {
    var e = id && E.get(id), out = { title: '', kind: '', sub: '', rows: [] };
    if (!e) {
      out.title = 'All work';
      out.sub = G.projects.length + ' projects, ' + T.int(totalCommits) + ' commits';
      return out;
    }
    // every link of a non-project entity ends at a project
    function names() {
      var ls = (adj.get(id) || []).slice();
      ls.sort(function (x, y) { return y.w - x.w; });
      return ls.map(function (l) { return { e: E.get(l.a === id ? l.b : l.a), w: l.w }; });
    }
    out.title = e.name;
    if (e.band === 'p') {
      var p = e.p;
      out.kind = clusterName[p.cluster] + ', ' + p.state + ', ' + p.vis;
      out.sub = p.src === 'scan' ? T.int(p.commits) + ' commits since May' : 'from notes, not scanned';
      if (p.src === 'scan') out.rows.push(['Repo', p.repo + ', ' + T.plural(p.branches, 'branch', 'branches') + ', last commit ' + T.dm(p.last)]);
      if (p.src === 'scan' && T.recentCommits) out.rows.push(['Last four weeks', T.plural(T.recentCommits(p.id), 'commit')]);
      else out.rows.push(['Repo', p.repo + ', private. Shown as an outline until it is scanned.']);
      var lg = Object.keys(p.langs).map(function (l) { return l + ' ' + T.pct(p.langs[l]); });
      if (lg.length) out.rows.push(['Languages', lg.join(', ')]);
      if (p.tech.length) out.rows.push(['Libraries and tools', T.list(p.tech, 9)]);
      if (p.shared.length) out.rows.push(['Shared', p.shared.map(function (s) { var x = E.get('s:' + s); return x ? x.name : s; }).join(', ')]);
      if (p.platforms && p.platforms.length) out.rows.push(['Runs on', p.platforms.map(function (f) { var x = E.get('f:' + f); return x ? x.name : f; }).join(', ')]);
      var tot = 0; Object.keys(p.agents).forEach(function (a) { tot += p.agents[a]; });
      var ag = Object.keys(p.agents).sort(function (a, b) { return p.agents[b] - p.agents[a]; })
        .map(function (a) { return E.get('a:' + a).name + ' ' + T.pct(p.agents[a] / tot); });
      if (ag.length) out.rows.push(['Who committed', T.list(ag, 5)]);
      if (p.prs) out.rows.push(['Pull requests', p.prs + ', ' + p.prs_open + ' open']);
    } else if (e.band === 'c') {
      var ps = G.projects.filter(function (p) { return p.cluster === e.key; });
      out.kind = 'Group of projects';
      out.sub = T.plural(ps.length, 'project');
      out.rows.push(['Projects', ps.map(function (p) { return p.name; }).join(', ')]);
    } else if (e.band === 'a') {
      out.kind = e.kind === 'person' ? 'You' : 'Cloud agent';
      out.sub = T.int(e.commits) + ' commits, ' + T.pct(e.commits / totalCommits) + ' of all';
      out.rows.push(['Does', SEED.agentRoles[e.key] || '']);
      out.rows.push(['Most active in', T.list(names('p').slice(0, 8).map(function (x) { return x.e.name + ' ' + T.int(x.w); }), 8)]);
      if (e.key === 'codex') out.rows.push(['How it is known', 'Commits on codex/, agent/ and batch/ branches. Inferred from the branch name.']);
      if (e.key === 'named') out.rows.push(['Identities', Object.keys(G.totals.named).join(', ')]);
    } else {
      var pr = names('p');
      out.kind = e.band === 'l' ? 'Language' : e.band === 't' ? 'Library or tool' : e.band === 's' ? 'Shared across projects' : e.band === 'f' ? 'Platform' + (e.by ? ', from ' + e.by : '') : e.band === 'h' ? 'Hours of the day, from your commits' : 'Kind of work, read from commit messages';
      out.sub = e.band === 'f' ? T.plural(pr.length, 'project') + ' run or ship here' : e.band === 'h' ? T.int(e.you) + ' of your commits, ' + T.pct(e.you / Math.max(1, G.hours_ist.reduce(function (a, b) { return a + b; }, 0))) + '; ' + T.int(e.ag) + ' by agents' : 'used by ' + T.plural(pr.length, 'project');
      if (e.band === 'h') { out.rows.push(['Projects then', T.list(pr.map(function (x) { return x.e.name + ' ' + T.int(x.w); }), 8)]); out.rows.push(['How it is read', 'Each of your commits falls in one three-hour stretch of the day, by its author time in IST. Agents are not linked here; their band already says who.']); return out; }
      if (e.band === 's' && e.home && P.get(e.home)) out.rows.push(['Lives in', P.get(e.home).name]);
      out.rows.push(['Projects', T.list(pr.map(function (x) { return x.e.name; }), 14)]);
      if (e.band === 'f') out.rows.push(['How it is read', 'From ' + e.rule + '.']);
    }
    return out;
  };
  T.describeNode = function (id) {
    var d = T.describe(id), box = document.createDocumentFragment();
    box.appendChild(T.el('b', null, d.title));
    if (d.kind) box.appendChild(T.el('span', { class: 'v' }, d.kind));
    if (d.sub) box.appendChild(T.el('span', { class: 'v' }, T.el('strong', null, d.sub)));
    d.rows.forEach(function (r) {
      box.appendChild(T.el('span', { class: 'k' }, r[0]));
      box.appendChild(T.el('span', { class: 'v' }, r[1]));
    });
    return box;
  };

  // ---------------------------------------------------------------- tooltip and toast
  var tipEl;
  T.tip = {
    show: function (content, x, y) {
      tipEl = tipEl || T.$('#tip');
      T.clear(tipEl).appendChild(content);
      tipEl.hidden = false;
      var r = tipEl.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
      var left = x + 18, top = y + 18;
      if (left + r.width > vw - 12) left = x - r.width - 18;
      if (top + r.height > vh - 12) top = Math.max(12, y - r.height - 18);
      tipEl.style.left = Math.max(12, left) + 'px';
      tipEl.style.top = top + 'px';
    },
    hide: function () { if (tipEl) tipEl.hidden = true; }
  };
  var toastTimer;
  T.toast = function (text) {
    var t = T.$('#toast');
    t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  };

  // ---------------------------------------------------------------- cells, from the shared kit (ASOC.cells)
  T.hash = ASOC.cells.hash; T.cellPts = ASOC.cells.pts; T.cell = ASOC.cells.cell; T.cellD = ASOC.cells.d; T.cellMark = ASOC.cells.mark;
  // an info mark: the explanation waits behind it, on hover or a tap
  T.info = function (text, label) {
    var b = T.el('button', { class: 'info', type: 'button', 'aria-label': label || 'About this', title: '' });
    b.appendChild(T.el('span', { 'aria-hidden': 'true' }, 'i'));
    function frag() { var f = document.createDocumentFragment(); f.appendChild(T.el('span', { class: 'v', style: { 'white-space': 'normal', 'max-width': '28rem', display: 'block' } }, text)); return f; }
    b.addEventListener('pointerenter', function (ev) { if (ev.pointerType === 'mouse') T.tip.show(frag(), ev.clientX, ev.clientY); });
    b.addEventListener('pointerleave', function () { T.tip.hide(); });
    b.addEventListener('focus', function () { var r = b.getBoundingClientRect(); T.tip.show(frag(), r.left, r.bottom); });
    b.addEventListener('blur', function () { T.tip.hide(); });
    b.addEventListener('click', function (ev) { ev.stopPropagation(); T.tip.hide(); if (T.openPop) T.openPop(b, function (pop) { pop.appendChild(T.el('p', { style: { margin: 0, color: 'var(--ink-2)', 'max-width': '26rem' } }, text)); }); if (T.sfx) T.sfx('tick'); });
    return b;
  };

  // glyphs
  T.agentGlyph = function (agentId, live) {
    var a = E.get('a:' + agentId), k = !a ? 'cloud' : a.kind === 'person' ? 'native' : a.key === 'named' ? 'named' : 'cloud';
    return T.el('i', { class: 'g ' + k + (live ? ' live' : ''), title: a ? a.name : agentId });
  };
  T.projectName = function (pid) { var p = P.get(pid); return p ? p.name : pid; };
})();
