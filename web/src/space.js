/* canopy: the one space behind the glass.
   Flat, the default: the chord face on, with a bar outside each project for its last four weeks of commits,
   a time strip under it on the ultrawide, and notes on the glass on one of three shelves.
   Depth, if you want it: the orrery (what everything is made of, and who made it) and the flight path (time,
   coming toward you), with notes placed by hand in depth.

   Projection, in Depth. On a curved 32:9 panel the scene is drawn for a cylinder. The Odyssey OLED G9 (G93SD) is
   1800R and about 1.2 m wide, and you sit far nearer than 1.8 m, so every ray from your eye is traced to where it
   meets the curved panel. Drawn that way, straight lines stay straight to the eye and sizes stay true out to the
   edges, which is what lets depth read. Flat screens get ordinary planar perspective. */
(function () {
  'use strict';
  var T = window.T, G = T.G, S = T.S, SEED = T.SEED, E = T.E;
  var DEG = Math.PI / 180, DAY = 864e5;
  var ORDER = ['p', 'n', 'a', 'h', 'f', 'l', 't', 's'];
  var INK = '236,232,228', RAD = '199,239,158', CYAN = '53,224,255', CYAN2 = '31,138,160', VIO = '142,123,255', VIOH = '165,147,255';
  // ---- colour: the field is mostly ink, but what has a known identity can wear it. Three schemes: brands (a language,
  // library or platform in its own colour, with its mark), bands (one hue per kind of thing), mono (ink only).
  var LOOK = T.look = { colour: T.store.get('colour', 'brands'), logos: T.store.get('logos', true) };
  var BAND_HUE = { n: '240,180,80', h: '200,160,255', f: '120,210,160', l: '255,130,120', t: '110,190,255', s: '230,200,120' };
  T.setColourScheme = function (v) { LOOK.colour = v; T.store.set('colour', v); C.dirty = true; C.starsDirty = true; T.emit('look'); };
  T.setLogos = function (v) { LOOK.logos = !!v; T.store.set('logos', LOOK.logos); C.dirty = true; T.emit('look'); };
  // the colour an entity wears, as 'r,g,b'; ink when the scheme or the entity has none
  T.tint = function (e) {
    if (!e || e.band === 'p' || e.band === 'a' || e.band === 'c') return INK;
    if (LOOK.colour === 'brands') { var b = (e.band === 'l' || e.band === 't' || e.band === 'f') && ASOC.brands.rgb(e.name); return b ? b.join(',') : INK; }
    if (LOOK.colour === 'bands') return BAND_HUE[e.band] || INK;
    return INK;
  };
  // the mark an entity wears beside its name, when marks are on and it has one
  T.brandOf = function (e) { return LOOK.logos && e && (e.band === 'l' || e.band === 't' || e.band === 'f') && ASOC.brands.get(e.name) && ASOC.brands.get(e.name).path ? e.name : null; };
  var G9_WIDTH_M = 1.1976;          // 49 inch, 32:9, measured along the curve
  var EYE_M = 0.8;                  // where most people sit from a 49 inch panel; set yours in Settings, under Display
  var REF_HALF = 0.2994;            // half the canopy's angle that the sample notes were placed for
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- state
  var saved = T.store.get('canopy', null) || {};
  var C = T.canopy = {
    host: null, stars: null, far: null, near: null, sx: null, fx: null, nx: null,
    W: 0, H: 0, dpr: 1, cx: 0, cy: 0, x0: 0, x1: 0,
    proj: 'cyl', R: 1, D: 1, ppm: 4275, F: 1200, off: 0,
    curve: saved.curve || 'auto', eye: saved.eye || 0,
    yaw: 0, yawT: 0, tilt: 0.22, tiltT: 0.22, tilt0: 0.22, zoom: 1, zoomT: 1,
    px: 0, py: 0, pxT: 0, pyT: 0, focus: 0, focusT: 0, nk: 1, on: false, flat: saved.depth !== true, wheelAcc: 0,
    hover: null, drag: null, dirty: true, starsDirty: true, last: 0, drift: !reduce && saved.drift !== false, idleAt: Date.now()
  };
  var RING = { r: 4.0, zc: 17, yc: 1.7 };
  var FLOOR = { y: -1.0, z0: 7.4, k: 0.62, days: 116, lanes: { release: -1.9, research: 0, publish: 1.9 }, half: 2.75 };

  function rgba(c, a) { return 'rgba(' + c + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')'; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---------------------------------------------------------------- projection
  // camera space: eye at the origin, +x right, +y up, +z ahead
  var P = { x: 0, y: 0, s: 0, d: 0, v: false };
  function project(x, y, z) {
    x -= C.px; y -= C.py;
    if (C.proj === 'cyl') {
      var dh = Math.sqrt(x * x + z * z), a = Math.atan2(x, z);
      if (dh < 0.05 || Math.abs(a) > 1.5) { P.v = false; return P; }
      var t, beta;
      if (!C.off) { t = C.R; beta = a; }
      else {
        var e = C.off, ca = Math.cos(a), sa = Math.sin(a);
        t = -e * ca + Math.sqrt(Math.max(0, e * e * ca * ca - e * e + C.R * C.R));
        beta = Math.atan2(t * sa, e + t * ca);
      }
      P.s = t * C.ppm / dh;
      P.x = C.cx + beta * C.R * C.ppm;
      P.y = C.cy - y * P.s;
      P.d = Math.sqrt(dh * dh + y * y);
      P.v = true;
    } else {
      if (z < 0.2) { P.v = false; return P; }
      P.s = C.F / z; P.x = C.cx + x * P.s; P.y = C.cy - y * P.s; P.d = Math.sqrt(x * x + y * y + z * z); P.v = true;
    }
    return P;
  }
  function cp(o) { return { x: o.x, y: o.y, s: o.s, d: o.d, v: o.v }; }
  function arcOf(a) {
    var e = C.off, ca = Math.cos(a), sa = Math.sin(a), t = -e * ca + Math.sqrt(Math.max(0, e * e * ca * ca - e * e + C.R * C.R));
    return Math.atan2(t * sa, e + t * ca);
  }
  // the angle at your eye of the ray that meets the panel at arc angle beta: the inverse of the mapping above
  function rayAngle(beta) {
    if (!C.off) return beta;
    var a = beta * C.R / C.D;
    for (var i = 0; i < 8; i++) a += (beta - arcOf(a)) * C.R / C.D;
    return a;
  }
  // On a tall screen one camera cannot fit both the ring and the flight path, so the floor gets its own:
  // a lower horizon, the same perspective, and lanes drawn closer together.
  function fp(x, y, z) {
    var f = C.fc;
    if (!f) return project(x * C.fxs, y, z);
    if (z < 0.2) { P.v = false; return P; }
    P.s = f.F / z; P.x = f.cx + x * f.xs * P.s; P.y = f.cy - y * P.s; P.d = Math.sqrt(x * x + y * y + z * z); P.v = true;
    return P;
  }
  var PJ = project;
  // distance haze: far things are dimmer, which is half of reading depth
  function haze(d) { return clamp(1.3 - d / 42, 0.38, 1); }

  // ---------------------------------------------------------------- the orrery: layout on the ring
  var nodes = [], byId = {}, ribs = [], arches = [];
  function projWeight(p) { return Math.sqrt(p.commits + 2); }
  function layout() {
    var bands = ORDER.filter(function (b) { return b === 'p' || S.layers[b]; });
    var lists = { p: [], n: [], a: [], h: [], f: [], l: [], t: [], s: [] };
    E.forEach(function (e) { if (lists[e.band]) lists[e.band].push(e.id); });
    var pw = {}, vis = {};
    G.projects.forEach(function (p) { pw['p:' + p.id] = projWeight(p); });
    bands.forEach(function (b) { vis[b] = true; });
    var live = T.links.filter(function (l) { return vis[l.band]; });
    var perProj = {};
    live.forEach(function (l) { (perProj[l.a] = perProj[l.a] || {}); (perProj[l.a][l.band] = perProj[l.a][l.band] || []).push(l); });
    var weight = {};
    Object.keys(pw).forEach(function (a) { weight[a] = pw[a]; });
    live.forEach(function (l) {
      var groups = perProj[l.a], nb = Object.keys(groups).length, sum = 0;
      groups[l.band].forEach(function (x) { sum += x.w; });
      l.shareA = (l.w / sum) / nb;
      l.c = pw[l.a] * l.shareA;
      weight[l.b] = (weight[l.b] || 0) + l.c;
    });
    var count = 0;
    bands.forEach(function (b) { count += lists[b].length; });
    var GAP = 3.2, CGAP = 0.9, nClusters = G.clusters.length;
    var avail = 360 - GAP * bands.length - CGAP * (nClusters - 1);
    var base = Math.min(2.7, avail * 0.8 / count), spare = avail - base * count, others = count - lists.p.length;
    var bandAngle = {};
    bands.forEach(function (b) {
      var n = lists[b].length;
      bandAngle[b] = base * n + (b === 'p' ? spare * (others ? 0.6 : 1) : spare * 0.4 * n / Math.max(1, others));
    });
    // projects are centred on the front of the ring, the side nearest you
    var a = -(bandAngle.p + CGAP * (nClusters - 1)) / 2;
    nodes = []; byId = {};
    bands.forEach(function (b) {
      var ids = lists[b], tw = 0, extra = bandAngle[b] - base * ids.length, last = null;
      ids.forEach(function (id) { tw += (weight[id] || 0.0001); });
      ids.forEach(function (id) {
        var e = E.get(id);
        if (b === 'p') { if (last && e.p.cluster !== last) a += CGAP; last = e.p.cluster; }
        var span = base + extra * (weight[id] || 0.0001) / tw;
        var n = { id: id, e: e, band: b, a0: a, a1: a + span, mid: a + span / 2, w: weight[id] || 0 };
        nodes.push(n); byId[id] = n; a += span;
      });
      a += GAP;
    });
    // where each link leaves and lands along its arcs, ordered so neighbours do not cross
    var PAD = 0.3;
    nodes.forEach(function (n) {
      var ls = live.filter(function (l) { return l.a === n.id || l.b === n.id; }), isP = n.band === 'p', tot = 0;
      ls.forEach(function (l) { var o = byId[l.a === n.id ? l.b : l.a]; l._off = ((o.mid - n.mid) % 360 + 360) % 360; });
      ls.sort(function (x, y) { return y._off - x._off; });
      ls.forEach(function (l) { tot += isP ? l.shareA : l.c; });
      var span = n.a1 - n.a0 - PAD, cur = n.a0 + PAD / 2;
      ls.forEach(function (l) {
        var w = span * (isP ? l.shareA : l.c) / (tot || 1);
        if (isP) { l.pm = cur + w / 2; l.pw = w; } else { l.rm = cur + w / 2; l.rw = w; }
        cur += w;
      });
    });
    ribs = live;
    // arches: each link as a quadratic arc that rises out of the ring plane, leaning in toward the centre
    var max = 0; ribs.forEach(function (l) { max = Math.max(max, l.w); });
    arches = ribs.map(function (l) {
      var A = local(l.pm * DEG, RING.r * 0.985, 0), B = local(l.rm * DEG, RING.r * 0.985, 0);
      var dx = A[0] - B[0], dz = A[2] - B[2], c = Math.sqrt(dx * dx + dz * dz);
      var M = [(A[0] + B[0]) / 2 * 0.5, 0.2 * c, (A[2] + B[2]) / 2 * 0.5];
      var pts = new Float32Array(17 * 3);
      for (var i = 0; i <= 16; i++) {
        var t = i / 16, u = 1 - t;
        pts[i * 3] = u * u * A[0] + 2 * t * u * M[0] + t * t * B[0];
        pts[i * 3 + 1] = u * u * A[1] + 2 * t * u * M[1] + t * t * B[1];
        pts[i * 3 + 2] = u * u * A[2] + 2 * t * u * M[2] + t * t * B[2];
      }
      var ag = l.band === 'a' ? E.get(l.b) : null;
      return { l: l, pts: pts, col: ag ? (ag.kind === 'person' ? RAD : CYAN) : INK, w: l.band === 'a' ? 0.5 + 0.9 * Math.sqrt(l.w / max) : 0.7 };
    });
    C.dirty = true;
  }
  T.canopyLayout = layout;

  // ring-local point at angle phi (radians, 0 = the front), radius r, height h above the ring plane
  function local(phi, r, h) { return [r * Math.sin(phi), h, -r * Math.cos(phi)]; }
  // ring-local to camera space: turn, tilt the front down toward you, then place. Zoom flies you toward the
  // ring's centre along your line of sight, so the ring grows and its centre stays where you are looking.
  var Wt = [0, 0, 0];
  function world(lx, ly, lz) {
    var cy = Math.cos(C.yaw), sy = Math.sin(C.yaw);
    var x = lx * cy + lz * sy, z = -lx * sy + lz * cy, y = ly;
    var ct = Math.cos(C.tilt), st = Math.sin(C.tilt);
    Wt[0] = x; Wt[1] = RING.yc / C.zoom + y * ct + z * st; Wt[2] = RING.zc / C.zoom - y * st + z * ct;
    return Wt;
  }
  function pw(lx, ly, lz) { var w = world(lx, ly, lz); return project(w[0], w[1], w[2]); }

  // ---------------------------------------------------------------- what is lit
  function focusSet() {
    if (C.hover && C.hover.kind === 'note' && C.hover.n && C.hover.n.links && C.hover.n.links.length) {
      var ls = C.hover.n.links.filter(function (id) { return E.has(id); });
      if (ls.length) return new Set(ls);
    }
    var id = (C.hover && C.hover.kind === 'node') ? C.hover.id : (S.hover || S.lens);
    var e = id && E.get(id);
    if (!e) return null;
    var src = new Set();
    if (e.band === 'c') G.projects.forEach(function (p) { if (p.cluster === e.key) src.add('p:' + p.id); });
    else src.add(id);
    return src;
  }

  // ---------------------------------------------------------------- the far layer
  var hits = [], snap = null, fadeAt = 0, litKey = '';
  function drawFar() {
    var g = C.fx, W = C.W, H = C.H, now = performance.now();
    var key = (S.hover || '') + '|' + (S.lens || '') + '|' + C.flat + '|' + C.far.width;
    if (litKey && key !== litKey && !reduce) {
      // keep what was on the glass, and fade it out over the new state
      snap = snap || document.createElement('canvas');
      if (snap.width !== C.far.width || snap.height !== C.far.height) { snap.width = C.far.width; snap.height = C.far.height; }
      var sg = snap.getContext('2d');
      sg.setTransform(1, 0, 0, 1, 0, 0); sg.clearRect(0, 0, snap.width, snap.height); sg.drawImage(C.far, 0, 0);
      fadeAt = now;
    }
    litKey = key;
    g.setTransform(C.dpr, 0, 0, C.dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    hits = [];
    var labels = [];
    if (C.flat) { drawStrip(g, labels); drawChord(g, labels); drawClockOn(g); }
    else { drawFloor(g, labels); drawOrrery(g, labels); }
    placeLabels(g, labels);
    var t = (now - fadeAt) / 220;
    if (snap && t < 1 && snap.width === C.far.width) {
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = (1 - t) * (1 - t); g.drawImage(snap, 0, 0); g.restore();
      C.dirty = true;
    }
  }

  // ---- time: the flight path. Now is at your feet; every day ahead is further away.
  function zOf(days) { return FLOOR.z0 + FLOOR.k * days; }
  function daysFrom(t) { return (new Date(t).getTime() - Date.now()) / DAY; }
  function line3(g, pts, col, a, w, dash) {
    g.beginPath();
    var on = false;
    for (var i = 0; i < pts.length; i += 3) {
      var p = PJ(pts[i], pts[i + 1], pts[i + 2]);
      if (!p.v) { on = false; continue; }
      if (on) g.lineTo(p.x, p.y); else { g.moveTo(p.x, p.y); on = true; }
    }
    g.strokeStyle = rgba(col, a); g.lineWidth = w; g.setLineDash(dash || []); g.stroke(); g.setLineDash([]);
  }
  function floorLine(x0, x1, z, n) {
    var pts = [];
    for (var i = 0; i <= n; i++) { pts.push(x0 + (x1 - x0) * i / n, FLOOR.y, z); }
    return pts;
  }
  var LANES = [['release', 'Release'], ['research', 'Research'], ['publish', 'Publish']];
  function drawFloor(g, labels) {
    PJ = fp;
    try { floor(g, labels); } finally { PJ = project; }
  }
  function floor(g, labels) {
    var rem = C.rem, dimLens = !!S.lens;
    var zEnd = zOf(FLOOR.days);
    // the lanes, converging on the far future
    LANES.forEach(function (l) {
      var x = FLOOR.lanes[l[0]], pts = [];
      for (var i = 0; i <= 40; i++) { var z = FLOOR.z0 + (zEnd - FLOOR.z0) * i / 40; pts.push(x, FLOOR.y, z); }
      line3(g, pts, INK, 0.11, 1);
      var p = fp(x - 0.55, FLOOR.y, FLOOR.z0 + 0.9);
      if (p.v) labels.push({ x: p.x, y: p.y, text: l[1], size: rem * 0.62, col: INK, a: 0.42, track: true, pri: 100, align: 'left', fixed: true });
    });
    // weeks: a line every Monday, a brighter one each month
    var d = new Date(); d.setHours(0, 0, 0, 0);
    for (var i = 1; i <= FLOOR.days; i++) {
      var day = new Date(d.getTime() + i * DAY), z = zOf(daysFrom(day));
      var first = day.getDate() === 1;
      if (day.getDay() !== 1 && !first) continue;
      line3(g, floorLine(-FLOOR.half, FLOOR.half, z, 24), INK, first ? 0.17 : 0.07, 1);
      var lp = fp(-FLOOR.half - 0.12, FLOOR.y, z);
      if (lp.v && (first || lp.s > 90)) {
        labels.push({ x: C.fc ? C.x0 + 6 : lp.x, y: lp.y, text: first ? T.MONL[day.getMonth()] + (day.getMonth() === 0 ? ' ' + day.getFullYear() : '') : String(day.getDate()),
          size: first ? rem * 0.7 : rem * 0.56, col: INK, a: first ? 0.6 : 0.38, mono: !first, align: C.fc ? 'left' : 'right', pri: first ? 90 : 20, fixed: !C.fc });
      }
    }
    // now, at your feet
    line3(g, floorLine(-FLOOR.half, FLOOR.half, FLOOR.z0, 30), INK, 0.55, 1.2);
    // the publishing pulse: LinkedIn, Monday Wednesday Friday, as centre-line lights on the publish lane
    var pu = SEED.pulse, pd = new Date(pu.from + 'T00:00:00'), end = new Date(pu.to + 'T23:59:00');
    for (; pd <= end; pd = new Date(pd.getTime() + DAY)) {
      if (pu.days.indexOf(pd.getDay()) < 0) continue;
      var key = pd.getFullYear() + '-' + T.pad(pd.getMonth() + 1) + '-' + T.pad(pd.getDate());
      if (pu.off.indexOf(key) >= 0) continue;
      var at = new Date(pd); at.setHours(pu.hourIst, 0, 0, 0);
      var dd = daysFrom(at);
      if (dd < 0) continue;
      var pp = fp(FLOOR.lanes.publish, FLOOR.y, zOf(dd));
      if (!pp.v) continue;
      g.fillStyle = rgba(INK, 0.4 * haze(pp.d) * (dimLens && !T.inLens('chakravyuha') ? 0.4 : 1));
      g.beginPath(); g.arc(pp.x, pp.y, clamp(0.012 * pp.s, 1, 3.2), 0, 6.283); g.fill();
    }
    // what is due, lane by lane
    var next = T.nextNudge();
    LANES.forEach(function (l) {
      var items = SEED.schedule.filter(function (s) { return s.lane === l[0]; }).sort(function (a, b) { return new Date(a.at) - new Date(b.at); });
      var lastD = -99, side = 1;
      items.forEach(function (s) {
        var days = daysFrom(s.at);
        if (days < -0.2 || days > FLOOR.days) return;
        if (days - lastD < 1.6) side = -side; else side = 1;
        var x = FLOOR.lanes[l[0]] + (days - lastD < 1.6 ? side * 0.42 : 0);
        lastD = days;
        var z = zOf(Math.max(0, days)), p = fp(x, FLOOR.y, z);
        if (!p.v) return;
        var on = T.inLens(s.p), a = (on ? 1 : 0.22) * haze(p.d);
        var px = p.x, py = p.y, s0 = p.s;
        // approach lights: the nudge ladder, leading up to fixed dates
        if (s.hard) (s.ladder || []).forEach(function (L) {
          var dl = days - L;
          if (dl < 0) return;
          var big = next && next.item === s && next.days === L;
          [-0.5, 0.5].forEach(function (o) {
            var q = fp(x + o, FLOOR.y, zOf(dl));
            if (!q.v) return;
            g.fillStyle = rgba(big ? VIOH : INK, (big ? 0.95 : 0.5) * a);
            g.beginPath(); g.arc(q.x, q.y, clamp((big ? 0.05 : 0.032) * q.s, 1.1, big ? 5 : 3.2), 0, 6.283); g.fill();
          });
        });
        var r = clamp(0.1 * s0, 3, 9);
        if (s.minor) {
          var m = clamp(0.12 * s0, 6, 12);
          g.strokeStyle = rgba(INK, 0.6 * a); g.lineWidth = 1;
          g.strokeRect(px - m / 2, py - m / 2, m, m);
          g.fillStyle = rgba(INK, 0.75 * a); g.font = '500 ' + Math.round(m * 0.72) + 'px ' + T.MONO; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(s.minor, px, py + 0.5);
          hits.push({ kind: 'way', id: s.id, x0: px - m, y0: py - m, x1: px + m, y1: py + m, pri: 2 });
          if (days < 7.5) labels.push({ x: px, y: py - m * 0.9, text: s.title, sub: T.leftShort(s.at).replace('in ', ''), size: clamp(0.1 * s0, 10, 14), col: INK, a: 0.62 * a, pri: 40 - days, way: s.id, stem: true });
          return;
        }
        if (s.hard && s.committed) {
          // a gate to fly through
          var hgt = 0.62, w2 = 0.42;
          var pts = [x - w2, FLOOR.y, z, x - w2, FLOOR.y + hgt, z, x + w2, FLOOR.y + hgt, z, x + w2, FLOOR.y, z];
          line3(g, pts, INK, 0.75 * a, clamp(0.03 * s0, 1, 2));
          var top = fp(x, FLOOR.y + hgt, z);
          diamond(g, px, py, r, rgba(INK, 0.95 * a), true);
          hits.push({ kind: 'way', id: s.id, x0: px - (w2 * s0 + 4), y0: top.y - 6, x1: px + (w2 * s0 + 4), y1: py + 6, pri: 3 });
          labels.push({ x: top.x, y: top.y - 4, text: s.title, sub: T.leftShort(s.at).replace('in ', ''), gates: T.openGates(s.id).length, size: clamp(0.12 * s0, 11, 16), col: INK, a: 0.95 * a, pri: 200 - days * 0.2, way: s.id });
          return;
        }
        if (s.hard) diamond(g, px, py, r, rgba(INK, 0.8 * a), false);
        else { g.strokeStyle = rgba(INK, 0.8 * a); g.lineWidth = 1.2; g.beginPath(); g.arc(px, py, r * 0.8, 0, 6.283); g.stroke(); }
        hits.push({ kind: 'way', id: s.id, x0: px - r - 4, y0: py - r - 4, x1: px + r + 4, y1: py + r + 4, pri: 2 });
        if (!C.fc || days < 21) labels.push({ x: px, y: py - r - 3, text: s.title, sub: T.leftShort(s.at).replace('in ', ''), gates: T.openGates(s.id).length, size: clamp(0.11 * s0, 10.5, 15), col: INK, a: (s.hard ? 0.8 : 0.85) * a, pri: 120 - days, way: s.id, stem: true });
      });
    });
    // undated on purpose: it sits at the vanishing point
    SEED.undated.forEach(function (u) {
      var p = fp(0, FLOOR.y, 4000);
      if (!p.v) return;
      g.strokeStyle = rgba(INK, 0.45); g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, 3, 0, 6.283); g.stroke();
      labels.push({ x: p.x, y: p.y + rem * 1.1, text: u[0] + ', no date by rule', size: rem * 0.6, col: INK, a: T.inLens(u[2]) ? 0.55 : 0.2, pri: 160, below: true });
    });
  }
  function diamond(g, x, y, r, col, fill) {
    g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath();
    if (fill) { g.fillStyle = col; g.fill(); } else { g.strokeStyle = col; g.lineWidth = 1.2; g.stroke(); }
  }

  // ---- structure: the orrery
  var ringScreen = { x: 0, y: 0 };
  function drawOrrery(g, labels) {
    if (!nodes.length) layout();
    var src = focusSet(), lit = null;
    if (src) {
      lit = new Set();
      ribs.forEach(function (l) { if (src.has(l.a) || src.has(l.b)) { lit.add(l.a); lit.add(l.b); } });
      src.forEach(function (id) { lit.add(id); });
    }
    var sel = null, le = S.lens && E.get(S.lens);
    if (le) { sel = new Set(); if (le.band === 'c') G.projects.forEach(function (p) { if (p.cluster === le.key) sel.add('p:' + p.id); }); else sel.add(S.lens); }
    var r = RING.r;
    // the ecliptic: the ring itself, and its shadow on the floor
    var ring = [], shadow = [];
    for (var i = 0; i <= 120; i++) {
      var L = local(i / 120 * 6.2832, r, 0), w = world(L[0], L[1], L[2]);
      ring.push(w[0], w[1], w[2]);
      shadow.push(w[0] * 0.98, FLOOR.y, w[2]);
    }
    if (!C.fc) line3(g, shadow, INK, 0.035, 1);
    line3(g, ring, INK, 0.13, 1);
    // arches, the quiet ones first, lit ones over them
    var quiet = {}, loud = [];
    arches.forEach(function (ar) {
      var on = src && (src.has(ar.l.a) || src.has(ar.l.b));
      if (on) { loud.push(ar); return; }
      var k = ar.col + '|' + ar.w.toFixed(1);
      (quiet[k] = quiet[k] || []).push(ar);
    });
    Object.keys(quiet).forEach(function (k) {
      var list = quiet[k], col = list[0].col;
      g.beginPath();
      list.forEach(function (ar) { trace(g, ar.pts); });
      g.strokeStyle = rgba(col, src ? 0.022 : (col === INK ? 0.06 : 0.1)); g.lineWidth = list[0].w; g.stroke();
    });
    loud.forEach(function (ar) {
      g.beginPath(); trace(g, ar.pts);
      g.strokeStyle = rgba(ar.col, ar.col === INK ? 0.5 : 0.7); g.lineWidth = ar.w + 0.5; g.stroke();
    });
    // the bodies: an arc on the ring for each thing, its length its share of the work
    var c0 = cp(pw(0, 0, 0)); ringScreen.x = c0.x; ringScreen.y = c0.y;
    nodes.forEach(function (n) {
      var e = n.e, isP = n.band === 'p', pts = [], pad = 0.16;
      for (var a = n.a0 + pad; a <= n.a1 - pad + 0.001; a += Math.max(0.4, (n.a1 - n.a0) / 8)) {
        var L = local(a * DEG, r, 0), w = world(L[0], L[1], L[2]); pts.push(w[0], w[1], w[2]);
      }
      if (pts.length < 6) { var L2 = local((n.a1 - pad) * DEG, r, 0), w2 = world(L2[0], L2[1], L2[2]); pts.push(w2[0], w2[1], w2[2]); }
      var mid = pw.apply(null, local(n.mid * DEG, r, 0));
      var mx = mid.x, my = mid.y, ms = mid.s, md = mid.d;
      var on = lit ? lit.has(n.id) : true, s = sel && sel.has(n.id);
      var col = n.band === 'a' ? (e.kind === 'person' ? RAD : CYAN) : INK;
      var base = isP ? 0.8 : n.band === 'a' ? 0.9 : 0.5;
      var alpha = (lit ? (on ? 1 : 0.13) : base) * haze(md);
      var lw = clamp((isP ? 0.085 : 0.06) * ms, 1.5, isP ? 7 : 5);
      line3(g, pts, s ? VIO : col, s ? 1 : alpha, lw, isP && e.p.src === 'notes' ? [2, 3] : null);
      // hit polyline in screen space
      var poly = [];
      for (var k = 0; k < pts.length; k += 3) { var q = project(pts[k], pts[k + 1], pts[k + 2]); if (q.v) poly.push(q.x, q.y); }
      hits.push({ kind: 'node', id: n.id, poly: poly, pri: 1 });
      // label, set along the ring's outward normal like the marks on a dial
      var La = local(n.mid * DEG, r + 0.3, 0), Lb = local((n.mid + 0.6) * DEG, r + 0.3, 0);
      var pa = cp(pw(La[0], La[1], La[2])), ax = pa.x, ay = pa.y, as = pa.s;
      var pb = pw(Lb[0], Lb[1], Lb[2]);
      var tx = pb.x - ax, ty = pb.y - ay, tl = Math.sqrt(tx * tx + ty * ty) || 1;
      var nx = ty / tl, ny = -tx / tl;
      if ((ax - c0.x) * nx + (ay - c0.y) * ny < 0) { nx = -nx; ny = -ny; }
      var size = clamp((isP ? 0.052 : 0.044) * as, C.rem * (isP ? 0.6 : 0.55), C.rem * (isP ? 0.86 : 0.74));
      labels.push({ x: ax, y: ay, nx: nx, ny: ny, text: e.name, size: size, col: s ? VIOH : (n.band === 'a' ? col : INK),
        a: (lit ? (on ? 1 : 0.16) : (isP ? 0.9 : 0.62)) * haze(pa.d), radial: true, pri: (lit && on ? 1000 : 0) + (isP ? 300 : 100) + n.w, node: n.id, bold: s, icon: T.brandOf(e) ? null : e.icon, brand: T.brandOf(e), markCol: T.tint(e) !== INK ? T.tint(e) : null });
    });
    // the nucleus: what the lens is on
    var d = T.describe(S.hover || S.lens);
    C.nucleus = { x: c0.x, y: c0.y, title: d.title, sub: d.sub, k: S.hover ? 'Looking at' : S.lens ? 'Lens' : '' };
    var grad = g.createRadialGradient(c0.x, c0.y, 0, c0.x, c0.y, 0.9 * c0.s);
    grad.addColorStop(0, FA(0.72)); grad.addColorStop(1, FA(0));
    g.fillStyle = grad; g.beginPath(); g.arc(c0.x, c0.y, 0.9 * c0.s, 0, 6.283); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if (C.nucleus.k) { g.font = '500 ' + Math.round(C.rem * 0.56) + 'px ' + T.SANS; g.fillStyle = rgba(INK, 0.45); g.fillText(C.nucleus.k.toUpperCase().split('').join(' '), c0.x, c0.y - C.rem * 1.35); }
    g.font = '300 ' + Math.round(C.rem * 1.3) + 'px ' + T.SANS; g.fillStyle = rgba(INK, 0.95);
    g.fillText(d.title, c0.x, c0.y);
    g.font = '400 ' + Math.round(C.rem * 0.62) + 'px ' + T.MONO; g.fillStyle = rgba(INK, 0.55);
    g.fillText(d.sub || '', c0.x, c0.y + C.rem * 1.1);
    hits.push({ kind: 'nucleus', x0: c0.x - 120, y0: c0.y - 30, x1: c0.x + 120, y1: c0.y + 24, pri: 4 });
  }

  // ---------------------------------------------------------------- flat: the chord, face on
  // Everything a chord says lives in its plane: arc length is share, ribbon width is how strongly two things connect,
  // place on the circle is grouping. So the default view draws it flat. The bars outside each project add a second
  // facet, the depth of work: commits in the last four weeks.
  var F2 = { cx: 0, cy: 0, r: 100, th: 8, bar: 40, lr: 160, strip: null, field: { x0: 0, x1: 1, y0: 0, y1: 1 } };
  var RECENT = (function () {
    var since = new Date(new Date(G.scanned_at).getTime() - 28 * DAY).toISOString().slice(0, 10), out = {}, max = 1;
    G.projects.forEach(function (p) {
      var n = 0;
      Object.keys(p.weeks || {}).forEach(function (w) {
        if (w < since) return;
        var c = p.weeks[w]; n += (c.person || 0) + (c.claude || 0) + (c.codex || 0) + (c.named || 0);
      });
      out['p:' + p.id] = n; max = Math.max(max, n);
    });
    out._max = max;
    return out;
  })();
  T.recentCommits = function (pid) { return RECENT['p:' + pid] || 0; };
  T.canopyProbe = function () { return { F2: F2, hit: function (x, y) { return hitAt(x, y); } }; };   // for tests
  function ang2(deg) { return (deg - 90) * DEG + C.yaw; }                 // projects sit on the left
  function pt2(deg, r) { var a = ang2(deg); return [F2.cx + r * Math.sin(a), F2.cy - r * Math.cos(a)]; }
  function ca(deg) { return ang2(deg) - Math.PI / 2; }                    // the same angle as canvas arcs count it
  function colOf(l) { var e = l.band === 'a' ? E.get(l.b) : null; if (e) return e.kind === 'person' ? RAD : CYAN; var o = E.get(l.b); return o ? T.tint(o) : INK; }
  var BANDS = { p: 'Projects', n: 'Kinds of work', a: 'Agents', h: 'When', f: 'Platforms', l: 'Languages', t: 'Libraries', s: 'Shared' };
  function drawChord(g, labels) {
    if (!nodes.length) layout();
    var src = focusSet(), lit = null;
    if (src) {
      lit = new Set();
      ribs.forEach(function (l) { if (src.has(l.a) || src.has(l.b)) { lit.add(l.a); lit.add(l.b); } });
      src.forEach(function (id) { lit.add(id); });
    }
    var sel = null, le = S.lens && E.get(S.lens);
    if (le) { sel = new Set(); if (le.band === 'c') G.projects.forEach(function (p) { if (p.cluster === le.key) sel.add('p:' + p.id); }); else sel.add(S.lens); }
    var R = F2.r, cx = F2.cx, cy = F2.cy, rem = C.rem;
    function ribbon(l) {
      var a0 = l.pm - l.pw / 2, a1 = l.pm + l.pw / 2, b0 = l.rm - l.rw / 2, b1 = l.rm + l.rw / 2, A = pt2(a0, R), B = pt2(b0, R);
      g.moveTo(A[0], A[1]);
      g.arc(cx, cy, R, ca(a0), ca(a1));
      g.quadraticCurveTo(cx, cy, B[0], B[1]);
      g.arc(cx, cy, R, ca(b0), ca(b1));
      g.quadraticCurveTo(cx, cy, A[0], A[1]);
      g.closePath();
    }
    // ribbons: the quiet ones in one pass per colour, the lit ones over them
    var groups = {}, loud = [];
    ribs.forEach(function (l) {
      if (!l.pw || !l.rw) return;
      if (src && (src.has(l.a) || src.has(l.b))) { loud.push(l); return; }
      var c = colOf(l); (groups[c] = groups[c] || []).push(l);
    });
    Object.keys(groups).forEach(function (c) {
      g.beginPath(); groups[c].forEach(ribbon);
      g.fillStyle = rgba(c, src ? 0.025 : (c === INK ? 0.085 : 0.16)); g.fill();
    });
    loud.forEach(function (l) { var c = colOf(l); g.beginPath(); ribbon(l); g.fillStyle = rgba(c, c === INK ? 0.4 : 0.55); g.fill(); });
    // arcs, bars and labels
    var spans = {}, order = [];
    nodes.forEach(function (n) {
      var e = n.e, isP = n.band === 'p', on = lit ? lit.has(n.id) : true, s = sel && sel.has(n.id);
      var col = n.band === 'a' ? (e.kind === 'person' ? RAD : CYAN) : T.tint(e), tinted = col !== INK;
      var th = isP ? F2.th : F2.th * 0.62, pad = Math.min(0.2, (n.a1 - n.a0) * 0.18), r0 = R + 2;
      var key = isP ? 'c:' + e.p.cluster : n.band;
      if (!spans[key]) { spans[key] = [n.a0, n.a1]; order.push(key); }
      spans[key][0] = Math.min(spans[key][0], n.a0); spans[key][1] = Math.max(spans[key][1], n.a1);
      g.beginPath(); g.arc(cx, cy, r0 + th / 2, ca(n.a0 + pad), ca(Math.max(n.a0 + pad + 0.05, n.a1 - pad)));
      g.lineWidth = th; g.lineCap = 'butt';
      g.strokeStyle = rgba(s ? VIO : col, s ? 1 : lit ? (on ? 1 : 0.14) : (isP ? 0.85 : n.band === 'a' ? 0.9 : tinted ? 0.78 : 0.5));
      g.setLineDash(isP && e.p.src === 'notes' ? [2, 2] : []); g.stroke(); g.setLineDash([]);
      // the second facet: how much happened here in the last four weeks
      if (isP) {
        var len = F2.bar * Math.sqrt((RECENT[n.id] || 0) / RECENT._max);
        if (len > 0.6) {
          var b0 = r0 + th + 3, b1 = b0 + len;
          g.beginPath(); g.arc(cx, cy, b1, ca(n.a0 + pad), ca(n.a1 - pad)); g.arc(cx, cy, b0, ca(n.a1 - pad), ca(n.a0 + pad), true); g.closePath();
          g.fillStyle = rgba(s ? VIO : INK, lit ? (on ? 0.8 : 0.08) : 0.42); g.fill();
        }
      }
      var a = ang2(n.mid), r1 = isP ? F2.lr : F2.lr0, lp = pt2(n.mid, r1);
      var brand = T.brandOf(e);
      labels.push({ x: lp[0], y: lp[1], nx: Math.sin(a), ny: -Math.cos(a), r0: r1, max: F2.label + F2.lr - r1, text: e.name, size: isP ? F2.fs : F2.fs2,
        col: s ? VIOH : (n.band === 'a' ? col : INK), a: lit ? (on ? 1 : 0.18) : (isP ? 0.92 : 0.66), radial: true, markCol: tinted ? col : null,
        pri: (lit && on ? 1000 : 0) + (isP ? 300 : 100) + Math.min(90, n.w), node: n.id, bold: s, icon: brand ? null : e.icon, brand: brand });
    });
    // what each stretch of the circle holds, written just inside it: groups of projects on the left, kinds of thing on the right
    if (R >= 170) order.forEach(function (k) {
      var sp = spans[k], m = (sp[0] + sp[1]) / 2, isC = k.indexOf('c:') === 0, ce = isC ? E.get(k) : null;
      var p = pt2(m, R * 0.86), nx = Math.sin(ang2(m)), on = !src || (isC && sel && le && le.id === k);
      labels.push({ x: p[0], y: p[1] + rem * 0.18, text: isC ? (ce ? ce.name : k.slice(2)) : BANDS[k], size: rem * 0.48, col: on && src ? VIOH : INK,
        a: src ? (on ? 0.8 : 0.16) : 0.4, track: true, pri: 250, align: nx < -0.45 ? 'left' : nx > 0.45 ? 'right' : null, node: isC ? k : null, inner: true });
    });
    // the nucleus: what the lens is on
    var d = T.describe(S.hover || S.lens);
    C.nucleus = { x: cx, y: cy, w: R * 0.5, title: d.title, sub: d.sub, k: S.hover ? 'Looking at' : S.lens ? 'Lens' : '' };
    var rg = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.62);
    rg.addColorStop(0, FA(0.82)); rg.addColorStop(1, FA(0));
    g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, R * 0.62, 0, 6.283); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    var big = Math.round(clamp(R * 0.17, rem * 0.9, rem * 1.3)), small = Math.round(clamp(R * 0.068, rem * 0.5, rem * 0.56)), tw = Math.max(R * 1.4, rem * 9.5);
    if (C.nucleus.k) { g.font = '500 ' + small + 'px ' + T.SANS; g.fillStyle = rgba(INK, 0.45); g.fillText(C.nucleus.k.toUpperCase().split('').join(' '), cx, cy - big * 1.15); }
    g.font = '300 ' + big + 'px ' + T.SANS; g.fillStyle = rgba(INK, 0.95); g.fillText(clip(g, d.title, tw), cx, cy);
    g.font = '400 ' + small + 'px ' + T.MONO; g.fillStyle = rgba(INK, 0.55); g.fillText(clip(g, d.sub || '', tw), cx, cy + big * 0.95);
    if (!C.nucleus.k) { g.fillStyle = rgba(INK, 0.32); g.fillText(clip(g, 'bars: commits, last four weeks', tw), cx, cy + big * 0.95 + small * 1.7); }
    hits.push({ kind: 'nucleus', x0: cx - R * 0.5, y0: cy - big * 1.6, x1: cx + R * 0.5, y1: cy + big * 1.6, pri: 4 });
  }
  // flat: which arc is under the pointer, by angle, anywhere from the ribbons' edge out to the end of the labels
  function hitFlatNode(x, y) {
    var dx = x - F2.cx, dy = y - F2.cy, r = Math.sqrt(dx * dx + dy * dy);
    if (r < F2.r - 6 || r > F2.out + 6) return null;
    var ca0 = Math.atan2(dy, dx), lens = r > F2.lr0 - 4 ? torchLens() : null;
    if (lens) ca0 = unfish(lens, ca0);
    var deg = (ca0 + Math.PI / 2 - C.yaw) / DEG + 90;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i], d = ((deg - n.a0) % 360 + 360) % 360;
      if (d <= n.a1 - n.a0) return { kind: 'node', id: n.id, pri: 1 };
    }
    return null;
  }

  // ---- flat geometry: the chord as large as the canopy allows, with room outside it for the bars and the labels.
  // Wide canopies keep a column for notes on either side; tall or square ones put the chord at the top and the
  // notes in a tray under it.
  var measured = {};
  function textW(font, text) {
    var k = font + '|' + text;
    if (measured[k] == null) { C.fx.font = font; measured[k] = C.fx.measureText(text).width; }
    return measured[k];
  }
  function labelRoom(cap) {
    if (!nodes.length) layout();
    var ws = nodes.map(function (n) { return textW('400 ' + Math.round(n.band === 'p' ? F2.fs : F2.fs2) + 'px ' + T.SANS, n.e.name); });
    ws.sort(function (a, b) { return a - b; });
    return clamp((ws.length ? ws[Math.floor(ws.length * 0.92)] : cap) + 4, C.rem * 3.4, cap);
  }
  function flatGeom(W, H, reserve) {
    var rem = C.rem, pano = S.mode === 'pano', x0 = C.x0, x1 = C.x1;
    var top = pano ? rem * 4.4 : rem * 0.9, bottom = H - reserve;
    F2.strip = null;
    if (pano) {
      var sy1 = bottom - rem * 0.6;
      F2.strip = { x0: x0 + rem * 7, x1: x1 - rem * 2.4, y0: sy1 - rem * 11.4, y1: sy1 };
      bottom = F2.strip.y0 - rem * 1.2;
    }
    var rw = x1 - x0, rh = Math.max(80, bottom - top), small = Math.min(rw, rh) < 620;
    F2.side = pano || rw >= rh * 1.45;
    F2.fs = rem * (small ? 0.64 : 0.7); F2.fs2 = F2.fs * 0.86;
    F2.th = rem * (small ? 0.38 : 0.5);
    F2.bar = rem * (small ? 1 : pano ? 2.6 : 2.2);
    F2.label = labelRoom(Math.min(rem * (pano ? 8.5 : small ? 5.4 : 8), Math.min(rw, rh) * 0.2));
    var ring = 2 + F2.th + 3 + F2.bar + 6, outer;
    F2.cx = (x0 + x1) / 2;
    if (F2.side) {
      outer = Math.min(rh / 2, rw / 2 - rem * 14);
      F2.cy = top + rh / 2;
      F2.field = { x0: x0 + rem * 1.4, x1: x1 - rem * 1.4, y0: top + rem * 0.2, y1: bottom };
      F2.cols = 1;
    } else {
      // the tray ends above the readouts, or above the new-note button on a phone
      var fy1 = S.mode === 'stack' ? H - rem * 4.4 : bottom - rem * 0.4;
      F2.cols = Math.max(1, Math.floor((rw - rem * 2) / (rem * 11)));
      var rows = Math.ceil(Math.max(1, T.notes.length) / F2.cols);
      var tray = clamp(rows * rem * 1.9 + rem * 1.6, rem * 6, (fy1 - top) * 0.42);
      outer = Math.min(rw / 2 - rem * 0.4, (fy1 - top - tray) / 2);
      F2.cy = top + outer;
      F2.field = { x0: x0 + rem, x1: x1 - rem, y0: top + outer * 2 + rem * 0.9, y1: fy1 };
    }
    F2.out = Math.max(60, outer);
    F2.r = Math.max(24, F2.out - F2.label - ring);
    F2.lr = F2.r + ring;                      // a project's label starts past its bar
    F2.lr0 = F2.r + 2 + F2.th * 0.62 + 6;     // every other label starts at its arc
  }

  // ---- when, flat: the hours clock takes the empty lower-left corner beside the chord. No lines cross the chart:
  // the band and the clock answer each other by light, a stretch lit on one lights its hours on the other.
  function clockPlace() {
    var rem = C.rem, out = F2.out, fld = F2.field;
    if (!F2.side) return null;
    var R = clamp(out * 0.25, rem * 2.6, rem * 5.6);
    if (R < rem * 2.2) return null;
    // just outside the labels, down and to the left; higher when the field ends sooner, so the caption still fits
    var d = out + R + rem * 0.9, maxDown = fld.y1 - rem * 2 - R - F2.cy;
    var sin = clamp(maxDown / d, 0.18, 0.72), cos = Math.sqrt(1 - sin * sin);
    var cx = F2.cx - d * cos, cy = F2.cy + d * sin;
    if (cx - R < fld.x0 + rem * 0.4) cx = fld.x0 + rem * 0.4 + R;
    return { cx: cx, cy: cy, R: R };
  }
  function drawClockOn(g) {
    if (!T.drawClock || S.mode === 'stack') return;
    var pl = clockPlace(); if (!pl) return;
    var focus = (C.hover && C.hover.kind === 'node' && C.hover.hour == null) ? C.hover.id : (S.hover || S.lens);
    T.drawClock(g, pl.cx, pl.cy, pl.R, { rem: C.rem, focus: focus, hour: C.hourHover, segs: true });
  }

  // ---- time, flat: a strip under the chord on the ultrawide, now at the left and four months ahead to the right
  function drawStrip(g, labels) {
    var st = F2.strip;
    if (!st) return;
    var rem = C.rem, x0 = st.x0, x1 = st.x1, yt = st.y0 + rem * 1.7, y1 = st.y1, dimLens = !!S.lens;
    var now = Date.now(), t0 = now - 2 * DAY, t1 = now + FLOOR.days * DAY;
    var X = function (t) { return x0 + (t - t0) / (t1 - t0) * (x1 - x0); };
    var laneH = (y1 - yt) / 3, laneY = function (i) { return yt + laneH * (i + 0.6); };
    // months, and a tick each Monday
    var d = new Date(t0); d.setHours(0, 0, 0, 0);
    g.lineWidth = 1;
    for (; d.getTime() <= t1; d = new Date(d.getTime() + DAY)) {
      var xx = X(d.getTime());
      if (xx < x0) continue;
      if (d.getDate() === 1) {
        g.strokeStyle = rgba(INK, 0.12); g.beginPath(); g.moveTo(xx, st.y0 + rem * 1.1); g.lineTo(xx, y1); g.stroke();
        labels.push({ x: xx + 5, y: st.y0 + rem * 0.95, text: T.MONL[d.getMonth()] + (d.getMonth() === 0 ? ' ' + d.getFullYear() : ''), size: rem * 0.66, col: INK, a: 0.6, align: 'left', pri: 2000, fixed: true });
      } else if (d.getDay() === 1) {
        g.strokeStyle = rgba(INK, 0.22); g.beginPath(); g.moveTo(xx, st.y0 + rem * 1.1); g.lineTo(xx, st.y0 + rem * 1.45); g.stroke();
      }
    }
    LANES.forEach(function (l, i) {
      var y = laneY(i);
      g.strokeStyle = rgba(INK, 0.1); g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
      labels.push({ x: x0 - rem * 0.8, y: y + rem * 0.2, text: l[1], size: rem * 0.54, col: INK, a: 0.44, track: true, pri: 2000, align: 'right', fixed: true });
    });
    // now
    var xn = X(now);
    g.strokeStyle = rgba(INK, 0.6); g.beginPath(); g.moveTo(xn, st.y0 + rem * 1.1); g.lineTo(xn, y1); g.stroke();
    labels.push({ x: xn + 4, y: y1 + rem * 0.15, text: 'now', size: rem * 0.56, col: INK, a: 0.7, mono: true, align: 'left', pri: 2000, fixed: true });
    // the publishing pulse: LinkedIn, Monday Wednesday Friday, small lights under the publish lane
    var pu = SEED.pulse, pd = new Date(pu.from + 'T00:00:00'), end = new Date(pu.to + 'T23:59:00');
    for (; pd <= end; pd = new Date(pd.getTime() + DAY)) {
      if (pu.days.indexOf(pd.getDay()) < 0) continue;
      var key = pd.getFullYear() + '-' + T.pad(pd.getMonth() + 1) + '-' + T.pad(pd.getDate());
      if (pu.off.indexOf(key) >= 0) continue;
      var at = new Date(pd); at.setHours(pu.hourIst, 0, 0, 0);
      if (at.getTime() < t0 || at.getTime() > t1) continue;
      g.fillStyle = rgba(INK, (at.getTime() < now ? 0.15 : 0.45) * (dimLens && !T.inLens('chakravyuha') ? 0.4 : 1));
      g.beginPath(); g.arc(X(at.getTime()), laneY(2) + rem * 0.55, 1.6, 0, 6.283); g.fill();
    }
    // what is due, lane by lane
    var next = T.nextNudge();
    LANES.forEach(function (l, i) {
      var y = laneY(i);
      SEED.schedule.filter(function (s) { return s.lane === l[0]; }).sort(function (a, b) { return new Date(a.at) - new Date(b.at); }).forEach(function (s) {
        var t = new Date(s.at).getTime(), days = (t - now) / DAY;
        if (t < t0 || t > t1) return;
        var x = X(t), on = T.inLens(s.p), a = on ? 1 : 0.22, r = rem * 0.36;
        if (s.hard) (s.ladder || []).forEach(function (L) {
          var tl = t - L * DAY;
          if (tl < now) return;
          var big = next && next.item === s && next.days === L, xl = X(tl);
          g.strokeStyle = rgba(big ? VIOH : INK, (big ? 0.95 : 0.45) * a); g.lineWidth = big ? 2 : 1;
          g.beginPath(); g.moveTo(xl, y - (big ? 7 : 4)); g.lineTo(xl, y + (big ? 7 : 4)); g.stroke(); g.lineWidth = 1;
        });
        var sub = days < 0 ? 'passed' : T.leftShort(s.at).replace('in ', '');
        if (s.minor) {
          var m = rem * 0.78;
          g.fillStyle = FA(1); g.fillRect(x - m / 2, y - m / 2, m, m);
          g.strokeStyle = rgba(INK, 0.6 * a); g.strokeRect(x - m / 2, y - m / 2, m, m);
          g.fillStyle = rgba(INK, 0.75 * a); g.font = '500 ' + Math.round(m * 0.66) + 'px ' + T.MONO; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(s.minor, x, y + 0.5);
          hits.push({ kind: 'way', id: s.id, x0: x - m, y0: y - m, x1: x + m, y1: y + m, pri: 2 });
          if (days < 10) labels.push({ x: x - 2, y: y - m * 0.9, text: s.title, sub: sub, size: rem * 0.62, col: INK, a: 0.62 * a, pri: 40 - days, way: s.id, stem: true, align: 'left', lo: st.x0 - 4, up: true });
          return;
        }
        if (s.hard) diamond(g, x, y, r * 1.15, rgba(INK, 0.95 * a), !!s.committed);
        else { g.fillStyle = FA(1); g.beginPath(); g.arc(x, y, r * 0.8, 0, 6.283); g.fill(); g.strokeStyle = rgba(INK, 0.85 * a); g.lineWidth = 1.2; g.stroke(); g.lineWidth = 1; }
        hits.push({ kind: 'way', id: s.id, x0: x - r - 5, y0: y - r - 5, x1: x + r + 5, y1: y + r + 5, pri: 3 });
        labels.push({ x: x - 2, y: y - r - 4, text: s.title, sub: sub, gates: T.openGates(s.id).length, size: rem * (s.hard && s.committed ? 0.74 : 0.68),
          col: INK, a: (s.hard ? 0.95 : 0.85) * a, pri: (s.hard && s.committed ? 200 : 120) - days * 0.3, way: s.id, stem: true, align: 'left', lo: st.x0 - 4, up: true });
      });
    });
    // undated on purpose: at the far end of the research lane
    SEED.undated.forEach(function (u) {
      var y = laneY(1);
      g.strokeStyle = rgba(INK, 0.45); g.beginPath(); g.arc(x1, y, 3, 0, 6.283); g.stroke();
      labels.push({ x: x1, y: y + rem * 1.1, text: u[0] + ', no date by rule', size: rem * 0.58, col: INK, a: T.inLens(u[2]) ? 0.55 : 0.2, align: 'right', pri: 150, fixed: true });
    });
  }

  function trace(g, pts) {
    var on = false;
    for (var i = 0; i < pts.length; i += 3) {
      var w = world(pts[i], pts[i + 1], pts[i + 2]), p = project(w[0], w[1], w[2]);
      if (!p.v) { on = false; continue; }
      if (on) g.lineTo(p.x, p.y); else { g.moveTo(p.x, p.y); on = true; }
    }
  }

  // ---- the colour everything sits on, for fills that have to match it
  function FA(a) { return T.fieldA ? T.fieldA(a) : 'rgba(0,0,0,' + a + ')'; }

  // ---- plain icons for where work runs, drawn as outlines the size of the words beside them
  function rrect(g, x0, y0, w, h, r) {
    g.beginPath(); g.moveTo(x0 + r, y0); g.arcTo(x0 + w, y0, x0 + w, y0 + h, r); g.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
    g.arcTo(x0, y0 + h, x0, y0, r); g.arcTo(x0, y0, x0 + w, y0, r); g.closePath();
  }
  function glyph(g, kind, x, y, s, col) {
    var h = s / 2;
    g.save(); g.translate(x, y);
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = Math.max(1, s * 0.085); g.lineJoin = 'round'; g.lineCap = 'round';
    if (kind === 'phone') { rrect(g, -h * 0.58, -h, h * 1.16, s, h * 0.24); g.stroke(); g.beginPath(); g.moveTo(-h * 0.16, h * 0.7); g.lineTo(h * 0.16, h * 0.7); g.stroke(); }
    else if (kind === 'watch') {
      g.beginPath(); g.arc(0, 0, h * 0.6, 0, 6.283); g.stroke();
      g.beginPath(); g.moveTo(-h * 0.32, -h * 0.5); g.lineTo(-h * 0.26, -h); g.lineTo(h * 0.26, -h); g.lineTo(h * 0.32, -h * 0.5);
      g.moveTo(-h * 0.32, h * 0.5); g.lineTo(-h * 0.26, h); g.lineTo(h * 0.26, h); g.lineTo(h * 0.32, h * 0.5); g.stroke();
    } else if (kind === 'browser') { rrect(g, -h, -h * 0.78, s, h * 1.56, h * 0.18); g.stroke(); g.beginPath(); g.moveTo(-h, -h * 0.3); g.lineTo(h, -h * 0.3); g.stroke(); }
    else if (kind === 'desktop') { rrect(g, -h, -h * 0.86, s, h * 1.22, h * 0.12); g.stroke(); g.beginPath(); g.moveTo(0, h * 0.38); g.lineTo(0, h * 0.82); g.moveTo(-h * 0.42, h * 0.86); g.lineTo(h * 0.42, h * 0.86); g.stroke(); }
    else if (kind === 'store') { g.beginPath(); g.moveTo(-h * 0.78, -h * 0.3); g.lineTo(h * 0.78, -h * 0.3); g.lineTo(h * 0.66, h * 0.9); g.lineTo(-h * 0.66, h * 0.9); g.closePath(); g.stroke(); g.beginPath(); g.arc(0, -h * 0.3, h * 0.36, Math.PI, 0); g.stroke(); }
    else if (kind === 'font') { g.font = '500 ' + Math.round(s * 0.92) + 'px ' + T.SANS; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Aa', 0, h * 0.06); }
    else if (kind === 'design') {
      g.beginPath(); g.moveTo(-h * 0.78, h * 0.66); g.bezierCurveTo(-h * 0.25, -h * 0.95, h * 0.25, h * 0.95, h * 0.78, -h * 0.66); g.stroke();
      [[-h * 0.78, h * 0.66], [h * 0.78, -h * 0.66]].forEach(function (q) { g.fillRect(q[0] - h * 0.17, q[1] - h * 0.17, h * 0.34, h * 0.34); });
    } else if (kind === 'cloud') {
      g.beginPath(); g.moveTo(-h * 0.5, h * 0.55); g.lineTo(h * 0.55, h * 0.55);
      g.arc(h * 0.52, h * 0.16, h * 0.39, Math.PI * 0.5, -Math.PI * 0.5, true);
      g.arc(h * 0.02, -h * 0.12, h * 0.52, -Math.PI * 0.08, -Math.PI * 0.95, true);
      g.arc(-h * 0.52, h * 0.2, h * 0.35, -Math.PI * 0.55, Math.PI * 0.5, true);
      g.stroke();
    } else if (kind === 'gear') {
      g.beginPath(); g.arc(0, 0, h * 0.4, 0, 6.283); g.stroke();
      g.beginPath(); for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; g.moveTo(Math.cos(a) * h * 0.58, Math.sin(a) * h * 0.58); g.lineTo(Math.cos(a) * h * 0.9, Math.sin(a) * h * 0.9); } g.stroke();
    }
    g.restore();
  }
  T.drawGlyph = glyph;

  // ---- the torch: the names under the light win their space, and on the flat chord they spread apart like a
  // loupe on the ring, magnified where the pointer is and squeezed at the edge of the light
  function angDiff(a, b) { return ((a - b) % 6.2832 + 9.4248) % 6.2832 - 3.1416; }
  function torchLens() {
    var t = T.torch;
    if (!t || !C.flat || !C.hostRect || S.lean === 'back') return null;
    var x = t.x - C.hostRect.left, y = t.y - C.hostRect.top, dx = x - F2.cx, dy = y - F2.cy, d = Math.sqrt(dx * dx + dy * dy);
    var off = d < F2.lr0 ? F2.lr0 - d : d > F2.out ? d - F2.out : 0, k = clamp(1 - off / (t.r * 0.8), 0, 1);
    if (k <= 0) return null;
    var mid = Math.max(t.r, (F2.lr0 + F2.out) / 2);
    return { x: x, y: y, r: t.r, ang: Math.atan2(dy, dx), W: Math.min(1.1, 1.5 * Math.asin(Math.min(1, t.r / mid))), d: 2.6 * k, k: k };
  }
  function fish(L, a) {
    var dd = angDiff(a, L.ang), m = Math.abs(dd);
    if (m >= L.W || !L.d) return a;
    var x = m / L.W;
    return L.ang + (dd < 0 ? -1 : 1) * (L.d + 1) * x / (L.d * x + 1) * L.W;
  }
  function unfish(L, a) {
    var dd = angDiff(a, L.ang), m = Math.abs(dd);
    if (m >= L.W || !L.d) return a;
    var y = m / L.W;
    return L.ang + (dd < 0 ? -1 : 1) * y / (L.d + 1 - L.d * y) * L.W;
  }
  var torchWas = false;
  T.canopyTorch = function () {
    if (!C.host || S.lean === 'back') return;
    var on = !!T.torch;
    if (C.flat) { var l = on && torchLens(); if (l || torchWas) C.dirty = true; torchWas = !!l; return; }
    if (on || torchWas) C.dirty = true;
    torchWas = on;
  };

  // ---- labels: placed in order of importance; the rest wait for the pointer
  var placed = [];
  function overlaps(r) {
    for (var i = 0; i < placed.length; i++) {
      var q = placed[i];
      if (r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]) return true;
    }
    return false;
  }
  function placeLabels(g, labels) {
    placed = [];
    var fans = [];
    // the nucleus and the HUD keep their space
    if (C.nucleus) { var nw = C.nucleus.w || 150; placed.push([C.nucleus.x - nw, C.nucleus.y - C.rem * 2, C.nucleus.x + nw, C.nucleus.y + C.rem * 1.5]); }
    // under the torch, the nearest names win
    var lens = torchLens(), tt = T.torch && C.hostRect && S.lean !== 'back' ? { x: T.torch.x - C.hostRect.left, y: T.torch.y - C.hostRect.top, r: T.torch.r } : null;
    if (tt) labels.forEach(function (L) {
      if (L.fixed) return;
      var near;
      if (L.radial && lens) near = 1 - Math.abs(angDiff(Math.atan2(L.ny, L.nx), lens.ang)) / lens.W;
      else { var ddx = L.x - tt.x, ddy = L.y - tt.y; near = 1 - Math.sqrt(ddx * ddx + ddy * ddy) / tt.r; }
      if (near > 0) L.pri += 640 * near * (lens && L.radial ? lens.k : 1);
    });
    labels.sort(function (a, b) { return b.pri - a.pri; });
    labels.forEach(function (L) {
      if (L.a < 0.02) return;
      var font = (L.bold ? '600 ' : L.track ? '500 ' : '400 ') + Math.round(L.size) + 'px ' + (L.mono ? T.MONO : T.SANS);
      g.font = font;
      var text = L.track ? L.text.toUpperCase().split('').join(' ') : L.text;
      var w = g.measureText(text).width, sw = 0, sub = L.sub ? '  ' + L.sub : '';
      if (L.radial) {
        var ang0 = Math.atan2(L.ny, L.nx), ang = ang0, lx = L.x, ly = L.y, lnx = L.nx, lny = L.ny, lead = 0;
        if (lens && C.flat) {
          ang = fish(lens, ang0);
          var shift = Math.abs(angDiff(ang, ang0));
          if (shift > 0.0012) {
            lead = Math.min(C.rem * 0.85, shift * L.r0 * 0.75);
            lnx = Math.cos(ang); lny = Math.sin(ang);
            lx = F2.cx + lnx * (L.r0 + lead); ly = F2.cy + lny * (L.r0 + lead);
          }
        }
        var flip = lnx < -0.001, ic = (L.icon || L.brand) ? L.size * 1.15 : 0, icGap = ic ? ic + L.size * 0.45 : 0;
        var maxLen = (L.max || C.labelMax || C.rem * 9.5) - lead - icGap;
        while (w > maxLen && text.length > 4) { text = text.slice(0, -2); w = g.measureText(text + '…').width; }
        if (text !== L.text) text += '…';
        var x0 = lx, y0 = ly, x1 = lx + lnx * (w + icGap), y1 = ly + lny * (w + icGap);
        var h = L.size * 0.55;
        var box = [Math.min(x0, x1) - h, Math.min(y0, y1) - h, Math.max(x0, x1) + h, Math.max(y0, y1) + h];
        if (C.flat) {
          // face on, every label points away from one centre: two collide only when their angles are too close
          var half = L.size * 0.54 / (L.r0 || 100);
          if (fans.some(function (q) { return Math.abs(((ang - q[0]) % 6.2832 + 9.4248) % 6.2832 - 3.1416) < half + q[1]; })) return;
          fans.push([ang, half]);
        } else {
          if (L.pri < 1000 && overlaps(box)) { if (L.node) hits.push({ kind: 'node', id: L.node, x0: box[0], y0: box[1], x1: box[2], y1: box[3], pri: 0, hidden: true }); return; }
          placed.push(box);
        }
        if (lead) {   // a fine line from the arc to the name the loupe moved
          g.strokeStyle = rgba(L.col, L.a * 0.4); g.lineWidth = 1; g.beginPath();
          g.moveTo(L.x - L.nx * 2, L.y - L.ny * 2); g.lineTo(lx - lnx * 2, ly - lny * 2); g.stroke();
        }
        if (ic && L.brand) ASOC.brands.draw(g, L.brand, lx + lnx * ic * 0.55, ly + lny * ic * 0.55, ic, rgba(L.markCol || L.col, Math.min(1, L.a * 1.05)));
        else if (ic) glyph(g, L.icon, lx + lnx * ic * 0.55, ly + lny * ic * 0.55, ic, rgba(L.markCol || L.col, Math.min(1, L.a * 1.05)));
        g.save(); g.translate(lx + lnx * icGap, ly + lny * icGap); g.rotate(flip ? ang + Math.PI : ang);
        g.textAlign = flip ? 'right' : 'left'; g.textBaseline = 'middle';
        g.fillStyle = rgba(L.col, L.a); g.fillText(text, 0, 0);
        g.restore();
        if (L.node && !C.flat) hits.push({ kind: 'node', id: L.node, x0: box[0], y0: box[1], x1: box[2], y1: box[3], pri: 1 });
        return;
      }
      g.font = '400 ' + Math.round(L.size * 0.82) + 'px ' + T.MONO;
      if (sub) sw = g.measureText(sub).width;
      var gw = L.gates ? L.size * 1.6 : 0;
      // labels stay on the canopy: shortened if they cannot fit, slid inward if they would run under a wing
      var lo = L.lo != null ? L.lo : C.x0 + 8, hi = C.x1 - 8, room = hi - lo - sw - gw;
      if (w > room && room > 40) {
        g.font = font;
        while (w > room && text.length > 4) { text = text.slice(0, -2); w = g.measureText(text + '…').width; }
        text += '…'; w = g.measureText(text).width;
      }
      var tw = w + sw + gw, x = L.align === 'left' ? L.x : L.align === 'right' ? L.x - tw : L.x - tw / 2, y = L.y;
      if (!L.fixed) { if (x + tw > hi) x = hi - tw; if (x < lo) x = lo; }
      var tries = L.fixed ? [0] : L.up ? [0, -1, -2, -3] : [0, -1, -2, 1];
      for (var i = 0; i < tries.length; i++) {
        var yy = L.below ? y + tries[i] * L.size * 1.3 : y + tries[i] * L.size * 1.35;
        var rect = [x - 3, yy - L.size, x + tw + 3, yy + L.size * 0.3];
        if (!L.fixed && overlaps(rect)) continue;
        placed.push(rect);
        if (L.stem && tries[i] !== 0) { g.strokeStyle = rgba(INK, L.a * 0.35); g.lineWidth = 1; g.beginPath(); g.moveTo(L.x, L.y + 2); g.lineTo(L.x, yy + 2); g.stroke(); }
        g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        g.font = font; g.fillStyle = rgba(L.col, L.a); g.fillText(text, x, yy);
        if (sub) { g.font = '400 ' + Math.round(L.size * 0.82) + 'px ' + T.MONO; g.fillStyle = rgba(INK, L.a * 0.55); g.fillText(sub, x + w, yy); }
        if (L.gates) { diamond(g, x + w + sw + L.size * 0.7, yy - L.size * 0.32, L.size * 0.28, rgba(VIO, Math.min(1, L.a + 0.2)), true); }
        if (L.way) hits.push({ kind: 'way', id: L.way, x0: rect[0], y0: rect[1], x1: rect[2], y1: rect[3], pri: 2 });
        if (L.node) hits.push({ kind: 'node', id: L.node, x0: rect[0], y0: rect[1], x1: rect[2], y1: rect[3], pri: 2 });
        return;
      }
    });
  }

  // ---------------------------------------------------------------- the stars: one for each commit in sixteen weeks
  function rnd(seed) { var x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }
  function drawStars() {
    var g = C.sx, W = C.W, H = C.H;
    g.setTransform(C.dpr, 0, 0, C.dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    var le = S.lens && E.get(S.lens), only = le && le.band === 'a' ? le.key : null;
    var n = 0, today = Date.now();
    // the ceiling: on a starlit night the stars come up a little; under cloud they dim; by day they are faint
    var ceil = T.ceiling ? T.ceiling() : null, skyK = !ceil ? 1 : ceil.kind === 'stars' ? 1.35 : ceil.kind === 'moon' ? 1.1 : ceil.kind === 'overcast' ? 0.55 : 0.85;
    G.days.forEach(function (row, di) {
      var age = (today - new Date(row[0] + 'T12:00:00').getTime()) / DAY;
      [[1, RAD, 'you'], [2, CYAN, 'claude'], [3, CYAN2, 'codex'], [4, CYAN, 'named']].forEach(function (k) {
        for (var j = 0; j < row[k[0]]; j++) {
          n++;
          var a = (0.1 + 0.62 * Math.exp(-age / 9)) * skyK, p;
          if (C.flat) {
            // face on there is no horizon: the stars fill the glass, thinly where the chord and the strip are
            p = { x: C.x0 + rnd(n + di * 0.13) * (C.x1 - C.x0), y: rnd(n * 1.7 + 3) * H, v: true };
            var sdx = p.x - F2.cx, sdy = p.y - F2.cy, st = F2.strip;
            if (sdx * sdx + sdy * sdy < F2.out * F2.out) a *= 0.16;
            else if (st && p.y > st.y0 - 6 && p.y < st.y1 + 6 && p.x > st.x0 - C.rem * 7 && p.x < st.x1 + 6) a *= 0.3;
          } else {
            var az = (rnd(n + di * 0.13) - 0.5) * 1.25, el = 0.008 + Math.pow(rnd(n * 1.7 + 3), 1.3) * 0.2;
            // a star at infinity: direction only
            var x = Math.sin(az), z = Math.cos(az), y = Math.tan(el);
            var save = [C.px, C.py]; C.px = 0; C.py = 0;
            p = project(x * 1000, y * 1000, z * 1000);
            C.px = save[0]; C.py = save[1];
            if (!p.v || p.y > C.cy - 2 || p.y < 0) continue;
          }
          if (only) a *= (only === 'you' ? k[2] === 'you' : k[2] !== 'you') ? 1.4 : 0.25;
          // the wings are solid: stars fade behind them
          var edge = p.x < C.x0 ? clamp(1 - (C.x0 - p.x) / 260, 0.12, 1) : p.x > C.x1 ? clamp(1 - (p.x - C.x1) / 260, 0.12, 1) : 1;
          g.fillStyle = rgba(k[1], a * edge);
          var sz = age < 1.5 ? 1.7 : 1.1;
          g.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
        }
      });
    });
    C.starCount = n;
  }

  // ---------------------------------------------------------------- the near layer: notes in depth
  var noteRects = [];
  // where a note is, in camera space. A note tied to a project rides above it on the ring.
  // Free notes keep their place in front of you; on a narrower screen the same places draw in toward the middle.
  function notePos(n) {
    if (n.att && byId['p:' + n.att]) {
      var b = byId['p:' + n.att], L = local(b.mid * DEG, RING.r * 0.9, 0.42 + (n.lift || 0)), w = world(L[0], L[1], L[2]);
      return [w[0] + (n.ox || 0), w[1] + (n.oy || 0), w[2]];
    }
    return [n.x * C.nk, n.y * C.nk, n.z];
  }
  function setFree(n, w) { n.att = null; n.ox = 0; n.oy = 0; n.x = w[0] / C.nk; n.y = w[1] / C.nk; n.z = w[2]; }
  function wrap(g, text, max) {
    var words = text.split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  }
  function clip(g, text, max) {
    if (g.measureText(text).width <= max) return text;
    while (text.length > 4 && g.measureText(text + '…').width > max) text = text.slice(0, -1);
    return text.replace(/[\s,.;:]+$/, '') + '…';
  }
  function drawNear() {
    var g = C.nx, W = C.W, H = C.H;
    g.setTransform(C.dpr, 0, 0, C.dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    noteRects = [];
    if (C.flat) { drawNearFlat(g); return; }
    var near = C.focus, set = T.lensProjects(), compact = C.W < 700, list = [];
    T.notes.forEach(function (n) {
      var q = notePos(n), p = cp(project(q[0], q[1], q[2]));
      if (!p.v) return;
      var it = { n: n, q: q, p: p, d: Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2]) };
      it.size = clamp(0.04 * p.s, C.rem * 0.68, C.rem * (compact ? 1 : 1.3));
      it.hot = !!((C.hover && C.hover.kind === 'note' && C.hover.id === n.id) || (C.drag && C.drag.note === n) || C.toolsFor === n);
      g.font = '400 ' + it.size.toFixed(1) + 'px ' + T.SANS;
      it.lines = compact && !it.hot ? [clip(g, n.text, it.size * 9)] : wrap(g, n.text, it.size * 13);
      var w = 0;
      it.lines.forEach(function (l) { w = Math.max(w, g.measureText(l).width); });
      it.r = Math.max(2.2, it.size * 0.24); it.tx = p.x + it.r * 2.4; it.ty = p.y + it.size * 0.36; it.lh = it.size * 1.28;
      it.meta = !compact || it.hot;
      if (it.tx + w > C.x1 - 6 && p.x - it.r * 2.4 - w > C.x0 + 6) { it.tx = p.x - it.r * 2.4 - w; it.left = true; }
      var bottom = it.ty + (it.lines.length - 1) * it.lh + (it.meta ? it.size * 1.05 : it.size * 0.3);
      it.box = it.left ? [it.tx - 6, p.y - it.size, p.x + it.r + 6, bottom + 4] : [p.x - it.r - 6, p.y - it.size, it.tx + w + 6, bottom + 4];
      list.push(it);
    });
    // nearest first: a note whose words would cover a nearer note's words shows only its cell until you look at it
    list.sort(function (a, b) { return a.d - b.d; });
    var taken = [];
    list.forEach(function (it) {
      var b = it.box;
      it.quiet = !it.hot && taken.some(function (t) { return b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1]; });
      if (!it.quiet) taken.push(b);
    });
    // then from far to near, with the note you are holding or looking at drawn last, on top
    list.sort(function (a, b) { return (a.hot ? 1 : 0) - (b.hot ? 1 : 0) || b.d - a.d; });
    list.forEach(function (it) { drawNote(g, it, near, set); });
  }
  function drawNote(g, it, near, set) {
    var n = it.n, p = it.p, size = it.size, r = it.r, off = set && !(set.has(n.att) || set.has(n.tag));
    var a = (off ? 0.3 : 1) * (it.hot ? 1 : (0.62 + 0.38 * near) * (n.pin ? 1 : 0.9)) * clamp(1.2 - it.d / 40, 0.55, 1);
    if (it.quiet) a *= 0.75;
    // depth cues when you are working with notes: a stem to the floor and a shadow on it
    if (!C.fc && !it.quiet && (near > 0.3 || it.hot)) {
      var f = project(it.q[0], FLOOR.y, it.q[2]);
      if (f.v) {
        var k = Math.max(near, it.hot ? 1 : 0);
        g.strokeStyle = rgba(INK, 0.14 * k * a); g.lineWidth = 1; g.setLineDash([1, 4]);
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(f.x, f.y); g.stroke(); g.setLineDash([]);
        // a soft shadow where it would land: a radial falloff, squashed onto the floor
        var rx = Math.max(2, 0.12 * f.s), ry = Math.max(1, 0.03 * f.s);
        g.save(); g.translate(f.x, f.y); g.scale(1, ry / rx);
        var sg = g.createRadialGradient(0, 0, 0, 0, 0, rx);
        sg.addColorStop(0, rgba(INK, 0.09 * k * a)); sg.addColorStop(1, rgba(INK, 0));
        g.fillStyle = sg; g.beginPath(); g.arc(0, 0, rx, 0, 6.283); g.fill(); g.restore();
      }
    }
    // tied to a project: a tether to its body on the ring
    if (n.att && byId['p:' + n.att]) {
      var b = byId['p:' + n.att], q = pw.apply(null, local(b.mid * DEG, RING.r, 0));
      if (q.v) { g.strokeStyle = rgba(INK, 0.22 * a); g.lineWidth = 1; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); }
    }
    // the cell: a lit body with its highlight up and to the left, like everything in Hyle
    var cg = g.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
    cg.addColorStop(0, rgba(n.pin ? VIOH : INK, a)); cg.addColorStop(1, rgba(n.pin ? VIO : INK, a * 0.35));
    g.fillStyle = cg; g.beginPath(); g.arc(p.x, p.y, r, 0, 6.283); g.fill();
    if (it.hot) { g.strokeStyle = rgba(INK, 0.6); g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, r + 3, 0, 6.283); g.stroke(); }
    // a note just placed sends out one ring, so you can see where it landed
    if (n.fresh) {
      var age = (Date.now() - n.fresh) / 1600;
      if (age < 1) { g.strokeStyle = rgba(INK, 0.7 * (1 - age)); g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, r + 4 + age * size * 2.2, 0, 6.283); g.stroke(); C.dirty = true; }
      else delete n.fresh;
    }
    if (it.quiet) {
      noteRects.push({ n: n, x0: p.x - r - 9, y0: p.y - r - 9, x1: p.x + r + 9, y1: p.y + r + 9, quiet: true });
      return;
    }
    // a dark halo keeps a note legible wherever it floats
    g.shadowColor = FA(0.92); g.shadowBlur = Math.max(5, size * 0.55);
    g.font = '400 ' + size.toFixed(1) + 'px ' + T.SANS;
    g.fillStyle = rgba(INK, 0.94 * a); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    it.lines.forEach(function (l, i) { g.fillText(l, it.tx, it.ty + i * it.lh); });
    if (it.meta) {
      g.font = '400 ' + Math.round(size * 0.62) + 'px ' + T.MONO; g.fillStyle = rgba(INK, 0.52 * a);
      var meta = (n.tag || 'idea') + (n.att ? ', on ' + T.projectName(n.att) : '') + (n.at ? ', ' + T.dm(n.at) : '');
      g.fillText(meta, it.tx, it.ty + it.lines.length * it.lh + size * 0.1);
    }
    g.shadowBlur = 0; g.shadowColor = 'transparent';
    noteRects.push({ n: n, x0: it.box[0], y0: it.box[1], x1: it.box[2], y1: it.box[3] });
  }

  // ---------------------------------------------------------------- notes, flat: on the glass, each on one of three shelves
  // Near notes are larger and brighter; far ones recede. A note you have placed keeps its place; the rest line up
  // beside the chord (or in a tray under it), pinned first. A note tied to a project hangs just past its label.
  var SHELF = [1, 0.84, 0.7], SHELF_A = [1, 0.82, 0.62], SHELF_N = ['near', 'middle', 'far'];
  function shelfOf(n) { return n.shelf != null ? n.shelf : n.z == null ? 0 : n.z < 9 ? 0 : n.z < 12.5 ? 1 : 2; }
  function fieldXY(fx, fy) { var f = F2.field; return [f.x0 + fx * (f.x1 - f.x0), f.y0 + fy * (f.y1 - f.y0)]; }
  function fieldOf(x, y) { var f = F2.field; return [clamp((x - f.x0) / Math.max(1, f.x1 - f.x0), 0, 1), clamp((y - f.y0) / Math.max(1, f.y1 - f.y0), 0, 1)]; }
  function notesCompact() { return C.W < 700 || (C.flat && !F2.side); }
  function setFlat(n, x, y) { var q = fieldOf(x, y); n.att = null; n.ox = 0; n.oy = 0; n.fx = +q[0].toFixed(4); n.fy = +q[1].toFixed(4); }
  function shelfStep(n, d) {
    var s0 = shelfOf(n), s1 = clamp(s0 + d, 0, 2);
    if (s1 === s0) return false;
    n.shelf = s1; C.focusT = 1; C.lookAway = performance.now(); C.dirty = true;
    return true;
  }
  function drawNearFlat(g) {
    var compact = notesCompact(), set = T.lensProjects(), f = F2.field, rem = C.rem, list = [], auto = [], tied = {};
    var colW = compact ? (f.x1 - f.x0) / F2.cols - rem * 1.2 : 0;
    var sideX = Math.min(F2.cx + F2.out + rem * 1.4, f.x1 - rem * 8), sideW = f.x1 - sideX - rem;
    var tieX = Math.max(f.x0 + rem * 8, F2.cx - F2.out - rem * 1.4), tieW = tieX - f.x0 - rem * 0.6;
    T.notes.forEach(function (n) {
      var sh = shelfOf(n), it = { n: n, sh: sh, size: rem * SHELF[sh] * (compact ? 0.92 : 1) };
      it.hot = !!((C.hover && C.hover.kind === 'note' && C.hover.id === n.id) || (C.drag && C.drag.note === n) || C.toolsFor === n);
      g.font = '400 ' + it.size.toFixed(1) + 'px ' + T.SANS;
      it.r = Math.max(2.2, it.size * 0.24); it.lh = it.size * 1.28;
      var isTied = F2.side && n.att && byId['p:' + n.att], lined = F2.side && n.fx == null && !isTied;
      var room = isTied ? tieW : lined ? sideW : 1e9;
      it.lines = compact && !it.hot ? [clip(g, n.text, Math.max(60, colW - it.r * 3))] : wrap(g, n.text, Math.max(it.size * 7, Math.min(it.size * 13, room - it.r * 3)));
      it.w = 0; it.lines.forEach(function (l) { it.w = Math.max(it.w, g.measureText(l).width); });
      it.meta = !compact || it.hot;
      it.h = it.size * 0.9 + (it.lines.length - 1) * it.lh + (it.meta ? it.size * 1.05 : 0) + it.size * (compact ? 0.75 : 1.1);
      list.push(it);
      if (n.att && byId['p:' + n.att] && F2.side) (tied[n.att] = tied[n.att] || []).push(it);
      else if (n.fx != null) { var q = fieldXY(n.fx, n.fy); it.x = q[0]; it.y = q[1]; }
      else auto.push(it);
    });
    // tied: in a column on the left of the chord, each at its project's height, with a leader to the end of its label
    var tl = [];
    Object.keys(tied).forEach(function (pid) {
      var b = byId['p:' + pid], a = ang2(b.mid);
      var rho = F2.lr + Math.min(F2.label, textW('400 ' + Math.round(F2.fs) + 'px ' + T.SANS, b.e.name)) + rem * 0.4;
      tied[pid].sort(function (p, q) { return (p.n.lift || 0) - (q.n.lift || 0); }).forEach(function (it) {
        it.lead = [F2.cx + rho * Math.sin(a), F2.cy - rho * Math.cos(a)]; tl.push(it);
      });
    });
    tl.sort(function (p, q) { return p.lead[1] - q.lead[1]; });
    var yNext = f.y0 + rem * 0.8;
    tl.forEach(function (it) {
      it.x = tieX - it.r; it.y = Math.max(it.lead[1], yNext); it.left = true;
      yNext = it.y + it.h;
    });
    // the rest in order: pinned first, then nearer shelves, then newest
    auto.sort(function (p, q) { return (q.n.pin ? 1 : 0) - (p.n.pin ? 1 : 0) || p.sh - q.sh || String(q.n.at || '').localeCompare(String(p.n.at || '')); });
    if (F2.side) {
      var cols = [{ x: sideX, y: f.y0 + rem * 0.8 }, { x: f.x0, y: f.y0 + rem * 0.8 }], ci = 0;
      auto.forEach(function (it) {
        if (cols[ci].y + it.h > f.y1 && ci < cols.length - 1) ci++;
        it.x = cols[ci].x + it.r; it.y = cols[ci].y + it.size * 0.4; cols[ci].y += it.h;
      });
    } else {
      var cw = (f.x1 - f.x0) / F2.cols, rowH = rem * 1.9;
      var per = Math.max(1, Math.min(Math.floor((f.y1 - f.y0) / rowH), Math.ceil(auto.length / F2.cols)));
      auto.forEach(function (it, i) {
        var c = Math.floor(i / per) % F2.cols, r = i % per + Math.floor(i / (per * F2.cols)) * 0.5;
        it.x = f.x0 + c * cw + it.r; it.y = f.y0 + rem * 0.5 + r * rowH;
      });
    }
    // text beside the dot, flipped to the left where it would run off the glass
    list.forEach(function (it) {
      if (it.x == null) return;
      var off = it.r * 2.4;
      if (!it.left && it.x + off + it.w > C.x1 - 6 && it.x - off - it.w > C.x0 + 6) it.left = true;
      if (it.left && it.x - off - it.w < C.x0 + 6) it.left = false;
      it.tx = it.left ? it.x - off - it.w : it.x + off;
      it.ty = it.y + it.size * 0.36;
      var bottom = it.ty + (it.lines.length - 1) * it.lh + (it.meta ? it.size * 1.05 : it.size * 0.3);
      it.box = it.left ? [it.tx - 6, it.y - it.size, it.x + it.r + 6, bottom + 4] : [it.x - it.r - 6, it.y - it.size, it.tx + it.w + 6, bottom + 4];
    });
    list = list.filter(function (it) { return it.x != null; });
    // nearest shelf first: a note whose words would cover a nearer note's words shows only its dot until you look at it
    list.sort(function (a, b) { return a.sh - b.sh || (b.n.pin ? 1 : 0) - (a.n.pin ? 1 : 0); });
    var taken = [];
    list.forEach(function (it) {
      var b = it.box;
      it.quiet = !it.hot && taken.some(function (t) { return b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1]; });
      if (!it.quiet) taken.push(b);
    });
    list.sort(function (a, b) { return (a.hot ? 1 : 0) - (b.hot ? 1 : 0) || b.sh - a.sh; });
    list.forEach(function (it) {
      var n = it.n, size = it.size, r = it.r, p = { x: it.x, y: it.y };
      var off = set && !(set.has(n.att) || set.has(n.tag));
      var a = (off ? 0.3 : 1) * (it.hot ? 1 : SHELF_A[it.sh]) * (it.quiet ? 0.75 : 1);
      if (it.lead) {
        g.strokeStyle = rgba(INK, (it.hot ? 0.5 : 0.14) * a); g.lineWidth = 1; g.setLineDash(it.hot ? [] : [2, 3]);
        g.beginPath(); g.moveTo(p.x + r + 3, p.y); g.lineTo(it.lead[0], it.lead[1]); g.stroke(); g.setLineDash([]);
      }
      var cg = g.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
      cg.addColorStop(0, rgba(n.pin ? VIOH : INK, a)); cg.addColorStop(1, rgba(n.pin ? VIO : INK, a * 0.35));
      g.fillStyle = cg; g.beginPath(); g.arc(p.x, p.y, r, 0, 6.283); g.fill();
      if (it.hot) { g.strokeStyle = rgba(INK, 0.6); g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, r + 3, 0, 6.283); g.stroke(); }
      if (n.fresh) {
        var age = (Date.now() - n.fresh) / 1600;
        if (age < 1) { g.strokeStyle = rgba(INK, 0.7 * (1 - age)); g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, r + 4 + age * size * 2.2, 0, 6.283); g.stroke(); C.dirty = true; }
        else delete n.fresh;
      }
      if (it.quiet) { noteRects.push({ n: n, px: p.x, py: p.y, x0: p.x - r - 9, y0: p.y - r - 9, x1: p.x + r + 9, y1: p.y + r + 9, quiet: true }); return; }
      g.shadowColor = FA(0.92); g.shadowBlur = Math.max(5, size * 0.55);
      g.font = '400 ' + size.toFixed(1) + 'px ' + T.SANS;
      g.fillStyle = rgba(INK, 0.94 * a); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      it.lines.forEach(function (l, i) { g.fillText(l, it.tx, it.ty + i * it.lh); });
      if (it.meta) {
        g.font = '400 ' + Math.round(size * 0.62) + 'px ' + T.MONO; g.fillStyle = rgba(INK, 0.52 * a);
        var meta = (n.tag || 'idea') + (n.att ? ', on ' + T.projectName(n.att) : '') + (n.at ? ', ' + T.dm(n.at) : '') + (it.hot ? ', ' + SHELF_N[it.sh] : '');
        g.fillText(meta, it.tx, it.ty + it.lines.length * it.lh + size * 0.1);
      }
      g.shadowBlur = 0; g.shadowColor = 'transparent';
      noteRects.push({ n: n, px: p.x, py: p.y, x0: it.box[0], y0: it.box[1], x1: it.box[2], y1: it.box[3] });
    });
  }

  // ---------------------------------------------------------------- frame loop
  function ease() {
    var k = reduce ? 1 : 0.16, m = false;
    function to(a, b) { var v = C[a] + (C[b] - C[a]) * k; if (Math.abs(C[b] - v) < 1e-4) v = C[b]; else m = true; C[a] = v; }
    to('yaw', 'yawT'); to('tilt', 'tiltT'); to('zoom', 'zoomT'); to('px', 'pxT'); to('py', 'pyT');
    var f = C.focus + (C.focusT - C.focus) * (reduce ? 1 : 0.22);
    if (Math.abs(C.focusT - f) < 0.01) f = C.focusT; else m = true;
    if (f !== C.focus) { C.focus = f; C.host.style.setProperty('--near', f.toFixed(3)); }
    return m;
  }
  var driftPhase = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!C.host || document.hidden || !C.on || S.lean === 'back') return;
    var moving = ease();
    // the eye returns to the far scene a moment after it leaves the notes
    if (C.focusT > 0 && !C.drag && C.lookAway && now - C.lookAway > 1400) { C.focusT = 0; C.lookAway = 0; }
    // a slow sway: parallax that keeps the depth alive, and pixels that never sit still on an OLED panel
    // it steps only when the ring's edge would move about half a pixel, so an idle screen redraws a few times a second at most
    if (C.drift && !C.drag && now - C.last > 250) {
      var t = now / 1000;
      var sway = 0.03 * Math.sin(t * 2 * Math.PI / 240), step = 0.5 / Math.max(200, C.flat ? F2.out : RING.r * C.k / RING.zc);
      if (Math.abs(sway - driftPhase) > step) { C.yaw += sway - driftPhase; C.yawT += sway - driftPhase; driftPhase = sway; C.dirty = true; }
    }
    if (C.starsDirty) { drawStars(); C.starsDirty = false; }
    if (!C.dirty && !moving) return;
    C.last = now; C.dirty = false;
    drawFar(); drawNear();
  }

  // ---------------------------------------------------------------- sizing and projection choice
  function size() {
    var r = C.host.getBoundingClientRect();
    C.hostRect = { left: r.left, top: r.top };
    var W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (W * H * dpr * dpr > 9e6) dpr = Math.max(1, Math.sqrt(9e6 / (W * H)));
    C.W = W; C.H = H; C.dpr = dpr;
    [C.stars, C.far, C.near].forEach(function (cv) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); });
    C.on = r.width > 2 && r.height > 2;
    C.rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    var wide = W / H >= 2.5 && S.mode === 'pano', portrait = H > W * 1.1;
    var curve = C.curve === 'auto' ? (wide ? '1800' : 'flat') : C.curve;
    C.cx = W / 2;
    // the canopy proper: between the wings on the ultrawide, the whole width elsewhere
    var wl = T.$('#wingL'), wr = T.$('#wingR');
    C.x0 = S.mode === 'pano' && wl ? wl.getBoundingClientRect().right : 0;
    C.x1 = S.mode === 'pano' && wr ? wr.getBoundingClientRect().left : W;
    var label = C.rem * (portrait ? 5.2 : 9);                       // room kept outside the ring for its labels
    // the near edge of the flight path sits just above the readouts on the glass
    var reserve = S.mode === 'pano' ? C.rem * 6.6 : S.mode === 'split' ? C.rem * 6 : C.rem * 1.4;
    C.fc = null;
    if (curve !== 'flat') {
      C.proj = 'cyl';
      C.R = curve === '1000' ? 1.0 : 1.8;
      C.ppm = W / (wide ? G9_WIDTH_M : W / 3800);
      C.D = C.eye || EYE_M; C.off = Math.abs(C.R - C.D) < 0.005 ? 0 : C.R - C.D;
      C.cy = H * 0.58;
      C.tilt0 = 0.26;
      C.k = C.D * C.ppm;
      C.half = Math.tan(Math.min(1.2, rayAngle(((C.x1 - C.x0) / 2) / (C.R * C.ppm))));
      // the ring fills about three quarters of the canopy, however near you sit
      C.zoom0 = RING.zc * Math.tan(0.775 * Math.atan(C.half)) / RING.r;
    } else {
      C.proj = 'flat';
      var half = (C.x1 - C.x0) / 2;
      C.F = Math.min((half - label) * RING.zc / RING.r, portrait ? 1e9 : H * 3.1);
      C.k = C.F;
      C.half = half / C.F;
      C.zoom0 = 1;
      if (portrait) {
        // the ring in the upper half, the flight path below it under its own horizon
        var hz = H * 0.58, nearPx = Math.max(60, H - reserve - hz);
        C.fc = { cx: W / 2, cy: hz, F: nearPx * 4.5, xs: (W * 0.36) / (1.9 * nearPx) };
        C.cy = hz * 0.5 + RING.yc * C.F / RING.zc;
        C.tilt0 = 0.62;
      } else {
        C.cy = H * 0.5;
        C.tilt0 = 0.3;
      }
    }
    // free notes keep their place within the canopy's frame, however wide its angle
    C.nk = clamp(C.half / Math.tan(REF_HALF), 0.35, 1.35);
    C.labelMax = clamp(C.proj === 'flat' ? label : (C.x1 - C.x0) / 2 * 0.225 - C.rem, C.rem * 4.5, C.rem * 9.5);
    flatGeom(W, H, reserve);
    if (C.flat) C.labelMax = F2.label;
    C.host.setAttribute('data-flat', C.flat ? '1' : '0');
    C.far.setAttribute('aria-label', C.flat
      ? 'The chord: every project on the left of a circle, linked by ribbons to its kinds of work, agents, languages, libraries and shared modules on the right. Bars outside each project are its commits in the last four weeks.' + (F2.strip ? ' Under it, the time strip: everything dated over the next four months.' : '')
      : 'The orrery: every project on a ring, linked by arches to its languages, libraries, shared modules, agents and kinds of work. Below it the flight path: everything dated, coming toward you.');
    var key = C.proj + (portrait ? 'p' : 'l');
    if (C.poseKey !== key) { C.posed = false; C.poseKey = key; }
    FLOOR.z0 = C.fc ? 4.5 : clamp(C.k * -FLOOR.y / Math.max(40, H - reserve - C.cy), 4.5, 14);
    // the outer lanes sit about a third of the canopy out from the middle at your feet, on any screen
    C.fxs = C.fc || C.proj === 'cyl' ? 1 : Math.min(1, 0.36 * (C.x1 - C.x0) / (1.9 * C.k / FLOOR.z0));
    if (!C.posed) { C.tilt = C.tiltT = C.tilt0; C.zoom = C.zoomT = C.zoom0; C.posed = true; }
    C.dirty = true; C.starsDirty = true;
  }
  C.fxs = 1;
  T.canopySize = function () { if (C.host) { size(); } };

  // ---------------------------------------------------------------- pointer: look, turn, place
  function local2(ev) { var r = C.host.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
  function segDist(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
    var x = ax + t * dx - px, y = ay + t * dy - py; return Math.sqrt(x * x + y * y);
  }
  function hitAt(x, y, past) {
    // past: the note in your hand, which is always under the pointer and never its own target
    if (!past) for (var i = noteRects.length - 1; i >= 0; i--) { var r = noteRects[i]; if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return { kind: 'note', id: r.n.id, n: r.n, r: r }; }
    var ch = C.flat && T.clockHit ? T.clockHit(C.fx, x, y) : null;
    if (ch) return { kind: 'node', id: ch.seg.id, hour: ch.hour, seg: ch.seg, pri: 5 };
    var best = null, bd = 1e9;
    hits.forEach(function (h) {
      if (h.poly) {
        for (var k = 0; k + 3 < h.poly.length; k += 2) {
          var d = segDist(x, y, h.poly[k], h.poly[k + 1], h.poly[k + 2], h.poly[k + 3]);
          if (d < 9 && d < bd) { bd = d; best = h; }
        }
      } else if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) {
        var d2 = 4 - (h.pri || 0) * 0.5;
        if (d2 < bd) { bd = d2; best = h; }
      }
    });
    if (!best && C.flat) best = hitFlatNode(x, y);
    return best;
  }
  function setHover(h) {
    var key = h ? h.kind + ':' + (h.id || '') + ':' + (h.hour == null ? '' : h.hour) : '';
    if (key === (C.hover ? C.hover.kind + ':' + (C.hover.id || '') + ':' + (C.hover.hour == null ? '' : C.hover.hour) : '')) return;
    C.hover = h;
    if (h && T.sfx) T.sfx('hover');
    C.hourHover = h && h.hour != null ? h.hour : null;
    C.host.style.cursor = h ? (h.kind === 'note' ? 'grab' : 'pointer') : 'default';
    if (h && h.kind === 'node') T.setHover(h.id);
    else if (h && h.kind === 'note' && h.n.att && E.get('p:' + h.n.att)) T.setHover('p:' + h.n.att);
    else T.setHover(null);
    C.dirty = true;
  }
  function screenToWorldAtDepth(x, y, z) {
    // invert the projection for a point at depth z (camera space), near the centre where cylinder and plane agree closely
    if (C.proj === 'cyl') {
      var a = rayAngle((x - C.cx) / (C.R * C.ppm));
      var X = Math.tan(a) * z, dh = Math.sqrt(X * X + z * z);
      var ca2 = Math.cos(a), t2 = C.off ? -C.off * ca2 + Math.sqrt(Math.max(0, C.off * C.off * ca2 * ca2 - C.off * C.off + C.R * C.R)) : C.R;
      var s = t2 * C.ppm / dh;
      return [X + C.px, (C.cy - y) / s + C.py, z];
    }
    var s2 = C.F / z;
    return [(x - C.cx) / s2 + C.px, (C.cy - y) / s2 + C.py, z];
  }
  function onMove(ev) {
    var q = local2(ev), x = q[0], y = q[1];
    if (ev.pointerType === 'mouse' && S.mode === 'pano' && !C.flat) {
      // the eye follows the pointer a few centimetres: near things move against far ones
      C.pxT = (x - C.cx) / C.W * 0.16; C.pyT = -(y - C.cy) / C.H * 0.07; C.dirty = true;
    }
    if (C.drag) {
      var d = C.drag, dx = x - d.x, dy = y - d.y;
      if (!d.on && Math.abs(dx) + Math.abs(dy) > (ev.pointerType === 'mouse' ? 4 : 9)) { d.on = true; clearTimeout(C.press); if (d.note) { C.focusT = 1; C.lookAway = 0; } T.tip.hide(); }
      if (!d.on) return;
      if (d.note) {
        var n = d.note;
        if (C.flat) setFlat(n, clamp(x - d.gx, C.x0 + 10, C.x1 - C.rem * 4), y - d.gy);
        else {
          var w = screenToWorldAtDepth(clamp(x - d.gx, C.x0 + 14, C.x1 - C.rem * 6), clamp(y - d.gy, C.rem * 4, C.H - C.rem * 2), d.z);
          w[1] = clamp(w[1], FLOOR.y + 0.15, 4.5); w[2] = d.z;
          setFree(n, w);
        }
        // over a project body? show where it would tie on
        var h = hitAt(x, y, true);
        d.target = h && h.kind === 'node' && h.id.indexOf('p:') === 0 ? h.id.slice(2) : null;
        setHover(d.target ? { kind: 'node', id: 'p:' + d.target } : null);
        C.dirty = true;
      } else if (!C.flat) {
        C.yawT = d.yaw - dx * 0.0042;
        C.tiltT = clamp(d.tilt + dy * 0.003, 0.06, 1.3);
        C.dirty = true;
      }
      return;
    }
    var h = hitAt(x, y);
    setHover(h);
    if (h && h.kind === 'note') { C.focusT = 1; C.lookAway = 0; }
    else if (h) { C.focusT = 0; C.lookAway = 0; }
    else if (C.focusT > 0 && !C.lookAway) C.lookAway = performance.now();
    if (h && ev.pointerType === 'mouse') {
      if (h.kind === 'node') T.tip.show(h.hour != null ? T.clockTip(h) : T.describeNode(h.id), ev.clientX, ev.clientY);
      else if (h.kind === 'way' && T.itemTip) T.tip.show(T.itemTip(T.node(h.id)), ev.clientX, ev.clientY);
      else T.tip.hide();
    } else T.tip.hide();
  }
  function onDown(ev) {
    if (ev.button !== undefined && ev.button !== 0) return;
    var q = local2(ev), x = q[0], y = q[1];
    var h = hitAt(x, y);
    try { C.near.setPointerCapture(ev.pointerId); } catch (e) { /* not supported */ }
    clearTimeout(C.press);
    if (h && h.kind === 'note' && C.flat) {
      C.drag = { note: h.n, x: x, y: y, gx: x - h.r.px, gy: y - h.r.py, on: false, hit: h };
      C.host.style.cursor = 'grabbing';
    } else if (h && h.kind === 'note') {
      var p = notePos(h.n), pr = project(p[0], p[1], p[2]);
      C.drag = { note: h.n, x: x, y: y, gx: x - pr.x, gy: y - pr.y, z: p[2], on: false, hit: h };
      C.host.style.cursor = 'grabbing';
    } else {
      C.drag = { x: x, y: y, yaw: C.yawT, tilt: C.tiltT, on: false, hit: h };
      // on glass without a mouse, press and hold on empty space for a new note
      if (!h && ev.pointerType !== 'mouse') {
        C.press = setTimeout(function () {
          if (C.drag && !C.drag.on && !C.drag.hit) { C.drag = null; newNoteAtScreen(x, y); }
        }, 620);
      }
    }
  }
  function onUp(ev) {
    clearTimeout(C.press);
    var d = C.drag; C.drag = null;
    if (!d) return;
    C.host.style.cursor = C.hover ? (C.hover.kind === 'note' ? 'grab' : 'pointer') : 'default';
    if (d.on) {
      if (d.note) {
        if (d.target) {
          d.note.att = d.target; d.note.ox = 0; d.note.oy = 0; delete d.note.fx; delete d.note.fy;
          d.note.lift = (T.notes.filter(function (o) { return o.att === d.target && o !== d.note; }).length) * 0.4;
          T.toast('Tied to ' + T.projectName(d.target) + '. It moves with it now.');
        }
        T.saveNotes(); setHover(null); C.dirty = true;
      }
      return;
    }
    // a click
    var h = d.hit;
    if (!h) return;
    if (h.kind === 'node') {
      T.tip.hide();
      T.setLens(h.id);
      var n = byId[h.id];
      if (n && S.lens === h.id && !C.flat) {
        var eff = ((n.mid * DEG - C.yawT) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
        if (Math.abs(eff) > 1.0) C.yawT += eff;
      }
    } else if (h.kind === 'way') {
      T.tip.hide();
      T.openTaskAt(h.id, ev.clientX, ev.clientY);
    } else if (h.kind === 'nucleus') {
      if (S.lens) T.setLens(null); else T.openLensPicker();
    } else if (h.kind === 'note') {
      T.tip.hide();
      T.noteTools(h.n, h.r);
    }
  }
  // push a note away from you or pull it close, keeping it under the same point on the glass
  function noteDepth(n, factor) {
    var p = notePos(n), pr = cp(project(p[0], p[1], p[2]));
    if (!pr.v) return;
    var z = clamp(p[2] * factor, 3.5, 26), w = screenToWorldAtDepth(pr.x, pr.y, z);
    w[1] = clamp(w[1], FLOOR.y + 0.15, 6);
    setFree(n, w);
    if (C.drag && C.drag.note === n) C.drag.z = z;
    C.focusT = 1; C.lookAway = performance.now(); C.dirty = true;
  }
  function onWheel(ev) {
    var q = local2(ev), h = C.drag && C.drag.note ? { kind: 'note', n: C.drag.note } : hitAt(q[0], q[1]);
    if (C.flat) {
      if (!h || h.kind !== 'note') return;
      ev.preventDefault();
      var now = performance.now(), dy = ev.deltaMode === 1 ? ev.deltaY * 33 : ev.deltaY;
      if (now - (C.wheelAt || 0) > 500) C.wheelAcc = 0;
      C.wheelAt = now; C.wheelAcc += dy;
      if (Math.abs(C.wheelAcc) >= 80) {
        if (shelfStep(h.n, C.wheelAcc > 0 ? 1 : -1)) { clearTimeout(onWheel.t); onWheel.t = setTimeout(T.saveNotes, 400); }
        C.wheelAcc = 0;
      }
      return;
    }
    ev.preventDefault();
    if (h && h.kind === 'note') {
      noteDepth(h.n, Math.exp(ev.deltaY * 0.0016));
      clearTimeout(onWheel.t); onWheel.t = setTimeout(T.saveNotes, 400);
      return;
    }
    C.zoomT = clamp(C.zoomT * Math.exp(-ev.deltaY * 0.0011), 0.72, 2.3);
    C.dirty = true;
  }
  function newNoteAtScreen(x, y, lineUp) {
    // a new note, exactly where you asked for it: on the glass face on, at arm's length in depth
    var w = screenToWorldAtDepth(x, y, 8);
    w[1] = clamp(w[1], FLOOR.y + 0.15, 4.5);
    var pos = { x: w[0] / C.nk, y: w[1] / C.nk, z: 8 };
    if (C.flat) {
      pos.shelf = 0;
      if (lineUp) {
        // from a key or a button: it joins the others in order, and the form opens where it will land
        var f = F2.field;
        x = F2.side ? Math.min(F2.cx + F2.out + C.rem * 1.4, f.x1 - C.rem * 8) : f.x0;
        y = f.y0 + C.rem * 1.2;
      } else { var q = fieldOf(x, y); pos.fx = +q[0].toFixed(4); pos.fy = +q[1].toFixed(4); }
    }
    T.newNoteAt(pos, x, y);
  }
  function onDbl(ev) {
    var q = local2(ev), h = hitAt(q[0], q[1]);
    if (h) return;
    newNoteAtScreen(q[0], q[1]);
  }
  // touch: two fingers pinch to fly closer
  var pts = {};
  function onTouchStart(ev) { if (ev.touches.length === 2 && !C.flat) { pts.d = dist2(ev); pts.z = C.zoomT; clearTimeout(C.press); } }
  function onTouchMove(ev) {
    if (ev.touches.length === 2 && pts.d && !C.flat) { ev.preventDefault(); C.zoomT = clamp(pts.z * dist2(ev) / pts.d, 0.72, 2.3); C.drag = null; C.dirty = true; }
  }
  function dist2(ev) { var a = ev.touches[0], b = ev.touches[1]; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }

  // ---------------------------------------------------------------- public
  T.canopyHome = function () { C.yawT = 0; C.tiltT = C.tilt0; C.zoomT = C.zoom0 || 1; C.dirty = true; };
  T.canopyRedraw = function () { C.dirty = true; };
  T.canopyStars = function () { C.starsDirty = true; };
  T.canopyFocus = function (v) { C.focusT = v; C.dirty = true; };
  T.canopySet = function (k, v) {
    if (k === 'depth') { C.flat = !v; C.pxT = C.pyT = 0; C.hover = null; }
    else C[k] = v;
    saved[k] = v; T.store.set('canopy', saved); size();
    if (k === 'depth') T.emit('depth', !!v);
  };
  T.canopyDepth = function () { return !C.flat; };
  T.notePosition = notePos;
  T.canopyNoteActive = function (n) { C.toolsFor = n || null; C.focusT = n ? 1 : 0; C.lookAway = 0; C.dirty = true; };
  T.canopyCompact = notesCompact;
  T.newNoteAtScreen = newNoteAtScreen;
  T.noteDepth = function (n, f) {
    if (C.flat) { if (!shelfStep(n, f > 1 ? 1 : -1)) T.toast(f > 1 ? 'Already on the far shelf.' : 'Already on the near shelf.'); }
    else noteDepth(n, f);
    T.saveNotes();
  };
  T.noteFree = function (n) {
    if (C.flat) { var r = T.noteScreen(n); if (r) setFlat(n, r.px, r.py); else n.att = null; return; }
    var p = notePos(n); setFree(n, [p[0], p[1], p[2]]);
  };
  T.noteScreen = function (n) {
    for (var i = 0; i < noteRects.length; i++) if (noteRects[i].n === n) return noteRects[i];
    return null;
  };
  T.renderChord = function () { C.dirty = true; };
  T.paintChord = function () { C.dirty = true; };
  T.renderInspector = function () { /* the nucleus is the inspector */ };
  T.nucleusRing = function () { /* the focus session shows on the dial */ };

  T.initCanopy = function () {
    C.host = T.$('#canopy');
    C.stars = T.$('#cvStars'); C.far = T.$('#cvFar'); C.near = T.$('#cvNear');
    C.sx = C.stars.getContext('2d'); C.fx = C.far.getContext('2d'); C.nx = C.near.getContext('2d');
    T.SANS = '"Archivo", ui-sans-serif, system-ui, sans-serif';
    T.MONO = '"JetBrains Mono", ui-monospace, monospace';
    layout(); size();
    var top = C.near;
    top.addEventListener('pointermove', onMove);
    top.addEventListener('pointerdown', onDown);
    top.addEventListener('pointerup', onUp);
    top.addEventListener('pointercancel', function () { C.drag = null; clearTimeout(C.press); });
    top.addEventListener('pointerleave', function () { if (!C.drag) { setHover(null); T.tip.hide(); C.pxT = 0; C.pyT = 0; } });
    top.addEventListener('wheel', onWheel, { passive: false });
    top.addEventListener('dblclick', onDbl);
    top.addEventListener('touchstart', onTouchStart, { passive: true });
    top.addEventListener('touchmove', onTouchMove, { passive: false });
    T.on('lens', function () { C.dirty = true; C.starsDirty = true; });
    T.on('hover', function () { C.dirty = true; });
    T.on('tasks', function () { C.dirty = true; });
    T.on('notes', function () { C.dirty = true; });
    requestAnimationFrame(frame);
  };
})();
