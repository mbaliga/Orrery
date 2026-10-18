/* constellation: a chord chart of projects against what they are made of and who works on them.
   Arc length is mass (work), ribbons are links, and any arc can become the lens. */
(function () {
  'use strict';
  var T = window.T, G = T.G, S = T.S, E = T.E, sv = T.sv, el = T.el;
  var ORDER = ['p', 'n', 'a', 'l', 't', 's'];
  var wrap, svgEl, nucleus, nodes = [], byId = {}, ribs = [], geom = null, measureCache = {};

  function rad(deg) { return (deg - 90) * Math.PI / 180; }
  function pt(r, deg) { var a = rad(deg); return [r * Math.cos(a), r * Math.sin(a)]; }
  function f(n) { return Math.round(n * 100) / 100; }
  function sector(r0, r1, a0, a1) {
    var p0 = pt(r1, a0), p1 = pt(r1, a1), p2 = pt(r0, a1), p3 = pt(r0, a0), big = (a1 - a0) > 180 ? 1 : 0;
    return 'M' + f(p0[0]) + ' ' + f(p0[1]) + 'A' + f(r1) + ' ' + f(r1) + ' 0 ' + big + ' 1 ' + f(p1[0]) + ' ' + f(p1[1]) +
      'L' + f(p2[0]) + ' ' + f(p2[1]) + 'A' + f(r0) + ' ' + f(r0) + ' 0 ' + big + ' 0 ' + f(p3[0]) + ' ' + f(p3[1]) + 'Z';
  }
  function ribbon(r, a0, a1, b0, b1) {
    var p0 = pt(r, a0), p1 = pt(r, a1), q0 = pt(r, b0), q1 = pt(r, b1);
    return 'M' + f(p0[0]) + ' ' + f(p0[1]) + 'A' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(p1[0]) + ' ' + f(p1[1]) +
      'Q0 0 ' + f(q0[0]) + ' ' + f(q0[1]) + 'A' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(q1[0]) + ' ' + f(q1[1]) +
      'Q0 0 ' + f(p0[0]) + ' ' + f(p0[1]) + 'Z';
  }
  function arcPath(r, a0, a1, flip) {
    var p0 = pt(r, flip ? a1 : a0), p1 = pt(r, flip ? a0 : a1);
    return 'M' + f(p0[0]) + ' ' + f(p0[1]) + 'A' + f(r) + ' ' + f(r) + ' 0 ' + ((a1 - a0) > 180 ? 1 : 0) + ' ' + (flip ? 0 : 1) + ' ' + f(p1[0]) + ' ' + f(p1[1]);
  }

  function projWeight(p) {
    if (S.sizeBy === 'even') return 1;
    if (S.sizeBy === 'code') return Math.sqrt((p.source_files || 0) + 8);
    return Math.sqrt(p.commits + 2);
  }

  // ---- layout: angles for every node and both ends of every ribbon
  function layout() {
    var bands = ORDER.filter(function (b) { return b === 'p' || S.layers[b]; });
    var lists = { p: [], n: [], a: [], l: [], t: [], s: [] };
    E.forEach(function (e) { if (lists[e.band]) lists[e.band].push(e.id); });
    var pw = {}, vis = {};
    G.projects.forEach(function (p) { pw['p:' + p.id] = projWeight(p); });
    bands.forEach(function (b) { vis[b] = true; });
    var live = T.links.filter(function (l) { return vis[l.band]; });

    // each project hands its mass to the things it touches, split evenly across the kinds of thing
    var perProj = {};
    live.forEach(function (l) { (perProj[l.a] = perProj[l.a] || {}); (perProj[l.a][l.band] = perProj[l.a][l.band] || []).push(l); });
    var weight = {};
    Object.keys(pw).forEach(function (a) { weight[a] = pw[a]; });
    live.forEach(function (l) {
      var groups = perProj[l.a], nb = Object.keys(groups).length, sum = 0;
      groups[l.band].forEach(function (x) { sum += x.w; });
      l.shareA = (l.w / sum) / nb;            // fraction of the project's arc
      l.c = pw[l.a] * l.shareA;                // contribution to the other end
      weight[l.b] = (weight[l.b] || 0) + l.c;
    });

    var count = 0;
    bands.forEach(function (b) { count += lists[b].length; });
    var GAP = 3, CGAP = 0.9, nClusters = G.clusters.length;
    var avail = 360 - GAP * bands.length - CGAP * (nClusters - 1);
    var base = Math.min(2.7, avail * 0.8 / count), spare = avail - base * count;
    var others = count - lists.p.length;
    nodes = []; byId = {};
    var bandAngle = {};
    bands.forEach(function (b) {
      var n = lists[b].length;
      bandAngle[b] = base * n + (b === 'p' ? spare * (others ? 0.62 : 1) : spare * 0.38 * n / others);
    });
    var a = 270 - (bandAngle.p + CGAP * (nClusters - 1)) / 2;
    var bandSpan = {};
    bands.forEach(function (b) {
      var ids = lists[b], tw = 0, extra = bandAngle[b] - base * ids.length;
      ids.forEach(function (id) { tw += (weight[id] || 0.0001); });
      var start = a, lastCluster = null;
      ids.forEach(function (id) {
        var e = E.get(id);
        if (b === 'p') { if (lastCluster && e.p.cluster !== lastCluster) a += CGAP; lastCluster = e.p.cluster; }
        var span = base + extra * (weight[id] || 0.0001) / tw;
        var n = { id: id, e: e, band: b, a0: a, a1: a + span, mid: a + span / 2, w: weight[id] || 0 };
        nodes.push(n); byId[id] = n; a += span;
      });
      bandSpan[b] = [start, a];
      a += GAP;
    });

    // ribbon ends: along each arc, order the links so that neighbours do not cross
    function order(id) {
      var n = byId[id], ls = live.filter(function (l) { return l.a === id || l.b === id; });
      ls.forEach(function (l) { var o = byId[l.a === id ? l.b : l.a]; l._off = ((o.mid - n.mid) % 360 + 360) % 360; });
      ls.sort(function (x, y) { return y._off - x._off; });
      return ls;
    }
    var PAD = 0.38;
    nodes.forEach(function (n) {
      var ls = order(n.id), span = n.a1 - n.a0 - PAD, cur = n.a0 + PAD / 2, isP = n.band === 'p', tot = 0;
      ls.forEach(function (l) { tot += isP ? l.shareA : l.c; });
      ls.forEach(function (l) {
        var w = span * (isP ? l.shareA : l.c) / (tot || 1);
        if (isP) { l.pa0 = cur; l.pa1 = cur + w; } else { l.ra0 = cur; l.ra1 = cur + w; }
        cur += w;
      });
    });
    ribs = live;
    return { bandSpan: bandSpan, bands: bands, pad: PAD };
  }

  function measure(text, px) {
    var key = px + '|' + text;
    if (measureCache[key] != null) return measureCache[key];
    var c = measure.ctx || (measure.ctx = document.createElement('canvas').getContext('2d'));
    c.font = '400 ' + px + 'px Archivo, sans-serif';
    return (measureCache[key] = c.measureText(text).width * 0.9);   // labels are set at 88% width
  }

  // ---- draw
  T.renderChord = function () {
    wrap = wrap || T.$('#chordWrap');
    nucleus = nucleus || T.$('#nucleus');
    var box = wrap.getBoundingClientRect(), size = Math.floor(Math.min(box.width, box.height));
    if (size < 120) return;
    var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    var L = layout();
    var fpx = Math.max(9, Math.min(12.5, S.mode === 'pano' ? rem * 0.66 : 11.5));
    var titlePx = Math.max(8.5, Math.min(11, fpx * 0.86));
    var showLabels = size >= 520, cap = size * 0.19, labelLen = 0;
    if (showLabels) {
      nodes.forEach(function (n) { labelLen = Math.max(labelLen, measure(n.e.name, fpx)); });
      labelLen = Math.min(labelLen, cap) + 10;
    } else labelLen = 6;
    var ring = titlePx * 2.2, thick = Math.max(4, Math.min(8, size * 0.011));
    var ro = size / 2 - labelLen - ring - 2, ri = ro - thick, nu = ri * 0.27;
    geom = { size: size, ro: ro, ri: ri, nu: nu, fpx: fpx, showLabels: showLabels };

    var root = sv('svg', { width: size, height: size, viewBox: (-size / 2) + ' ' + (-size / 2) + ' ' + size + ' ' + size, role: 'img',
      'aria-label': 'Chord chart linking ' + G.projects.length + ' projects to languages, libraries, shared modules, agents and kinds of work' });
    var defs = sv('defs', null,
      sv('radialGradient', { id: 'nuFade', gradientUnits: 'userSpaceOnUse', cx: 0, cy: 0, r: f(ri) },
        sv('stop', { offset: f(nu / ri * 0.95), 'stop-color': '#000' }),
        sv('stop', { offset: f(Math.min(0.62, nu / ri + 0.3)), 'stop-color': '#fff' }),
        sv('stop', { offset: 1, 'stop-color': '#fff' })),
      sv('mask', { id: 'nuMask', maskUnits: 'userSpaceOnUse', x: -size / 2, y: -size / 2, width: size, height: size },
        sv('rect', { x: -size / 2, y: -size / 2, width: size, height: size, fill: 'url(#nuFade)' })));
    root.appendChild(defs);

    var gR = sv('g', { mask: 'url(#nuMask)' });
    ribs.forEach(function (l) {
      var ag = l.band === 'a' ? E.get(l.b) : null;
      var cls = 'rb' + (ag ? (ag.kind === 'person' ? ' native' : ' cloud') : '');
      l.el = sv('path', { class: cls, d: ribbon(ri - 1.5, l.pa0, l.pa1, l.ra0, l.ra1) });
      gR.appendChild(l.el);
    });
    root.appendChild(gR);

    var gA = sv('g'), gL = sv('g'), gH = sv('g'), gT = sv('g');
    nodes.forEach(function (n) {
      var e = n.e, pad = L.pad / 2, cls = 'arc b-' + n.band;
      if (n.band === 'p' && e.p.src === 'notes') cls += ' notes';
      if (n.band === 'a') cls += e.kind === 'person' ? ' native' : ' cloud';
      n.arc = sv('path', { class: cls, d: sector(ri, ro, n.a0 + pad, n.a1 - pad) });
      gA.appendChild(n.arc);
      n.pitch = (n.a1 - n.a0) * Math.PI / 180 * ro;
      n.fits = showLabels && n.pitch >= fpx * 0.94;
      var right = n.mid >= 0 && n.mid < 180 || n.mid >= 360;
      var m = ((n.mid % 360) + 360) % 360; right = m < 180;
      var lr = ro + 6 + (n.band === 'a' ? fpx * 0.95 : 0), p = pt(lr, n.mid);
      var name = e.name;
      if (showLabels && measure(name, fpx) > cap) { while (name.length > 4 && measure(name + '…', fpx) > cap) name = name.slice(0, -1); name += '…'; }
      n.label = sv('text', { class: 'lb b-' + n.band, x: f(p[0]), y: f(p[1]), dy: '.34em', 'font-size': f(fpx),
        'text-anchor': right ? 'start' : 'end', transform: 'rotate(' + f(right ? m - 90 : m + 90) + ' ' + f(p[0]) + ' ' + f(p[1]) + ')' }, name);
      if (!n.fits) n.label.style.display = 'none';
      gL.appendChild(n.label);
      if (n.band === 'a' && showLabels) {
        var gp = pt(ro + 6 + fpx * 0.36, n.mid);
        n.glyph = sv('circle', { class: 'lb-g ' + (e.kind === 'person' ? 'native' : 'cloud'), cx: f(gp[0]), cy: f(gp[1]), r: f(fpx * 0.27) });
        gL.appendChild(n.glyph);
      }
      n.hit = sv('path', { class: 'hit', d: sector(ri - 10, ro + labelLen, n.a0, n.a1), tabindex: 0, role: 'button', 'aria-label': e.name });
      n.hit.addEventListener('pointerenter', function (ev) { if (ev.pointerType === 'mouse') { T.setHover(n.id); T.tip.show(T.describeNode(n.id), ev.clientX, ev.clientY); } });
      n.hit.addEventListener('pointermove', function (ev) { if (ev.pointerType === 'mouse') T.tip.show(T.describeNode(n.id), ev.clientX, ev.clientY); });
      n.hit.addEventListener('pointerleave', function () { T.setHover(null); T.tip.hide(); });
      n.hit.addEventListener('click', function () { T.tip.hide(); T.setLens(n.id); });
      n.hit.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); T.setLens(n.id); } });
      n.hit.addEventListener('focus', function () { T.setHover(n.id); });
      n.hit.addEventListener('blur', function () { T.setHover(null); });
      gH.appendChild(n.hit);
    });

    // the outer ring names the groups: project clusters on the left, kinds of thing on the right
    var rt = ro + labelLen + ring * 0.52, spans = [];
    var cl = {};
    nodes.forEach(function (n) { if (n.band === 'p') { var c = n.e.p.cluster; (cl[c] = cl[c] || [n.a0, n.a1]); cl[c][1] = n.a1; } });
    G.clusters.forEach(function (c) { if (cl[c[0]]) spans.push({ id: 'c:' + c[0], name: c[1], a0: cl[c[0]][0], a1: cl[c[0]][1] }); });
    L.bands.forEach(function (b) { if (b !== 'p') spans.push({ id: null, name: T.BAND[b], a0: L.bandSpan[b][0], a1: L.bandSpan[b][1] }); });
    spans.forEach(function (s, i) {
      var m = (((s.a0 + s.a1) / 2 % 360) + 360) % 360, flip = m > 90 && m < 270;
      var arcLen = (s.a1 - s.a0) * Math.PI / 180 * rt, name = s.name;
      var need = name.length * titlePx * 0.92;
      gT.appendChild(sv('path', { class: 'band-rule', d: arcPath(rt - ring * 0.5 + 2, s.a0 + 0.4, s.a1 - 0.4, false) }));
      if (need > arcLen - 6) return;
      var pid = 'bt' + i;
      defs.appendChild(sv('path', { id: pid, d: arcPath(rt + (flip ? titlePx * 0.36 : -titlePx * 0.36), s.a0, s.a1, flip) }));
      var t = sv('text', { class: 'band-t', 'font-size': f(titlePx) },
        sv('textPath', { href: '#' + pid, startOffset: '50%', 'text-anchor': 'middle' }, name));
      if (s.id) {
        t.style.cursor = 'pointer';
        t.addEventListener('click', function () { T.setLens(s.id); });
      }
      gT.appendChild(t);
    });
    root.appendChild(gA); root.appendChild(gT); root.appendChild(gL); root.appendChild(gH);

    if (svgEl) wrap.removeChild(svgEl);
    svgEl = root;
    wrap.insertBefore(svgEl, nucleus);
    nucleus.style.width = nucleus.style.height = f(nu * 2) + 'px';
    T.paintChord();
  };

  // ---- highlight: light is spent only on what the lens or the pointer touches
  T.paintChord = function () {
    if (!svgEl) return;
    var focus = S.hover || S.lens, e = focus && E.get(focus), src = null;
    if (e) {
      src = new Set();
      if (e.band === 'c') G.projects.forEach(function (p) { if (p.cluster === e.key) src.add('p:' + p.id); });
      else src.add(focus);
    }
    svgEl.classList.toggle('has-focus', !!src);
    var lit = new Set();
    ribs.forEach(function (l) {
      var on = !!src && (src.has(l.a) || src.has(l.b));
      l.el.classList.toggle('lit', on);
      if (on) { lit.add(l.a); lit.add(l.b); }
    });
    if (src) src.forEach(function (id) { lit.add(id); });
    var sel = null, le = S.lens && E.get(S.lens);
    if (le) { sel = new Set(); if (le.band === 'c') G.projects.forEach(function (p) { if (p.cluster === le.key) sel.add('p:' + p.id); }); else sel.add(S.lens); }
    nodes.forEach(function (n) {
      var on = lit.has(n.id), s = !!sel && sel.has(n.id);
      n.arc.classList.toggle('lit', on); n.arc.classList.toggle('sel', s);
      n.label.classList.toggle('lit', on); n.label.classList.toggle('sel', s);
      // a label too small to sit in its slot still appears while its node is lit
      n.label.style.display = (n.fits || (on && src && (geom.showLabels ? lit.size <= 40 : (src.has(n.id) && false)))) ? '' : 'none';
    });
    paintNucleus();
  };

  function paintNucleus() {
    var d = T.describe(S.hover || S.lens);
    T.$('#nuK').textContent = S.hover ? 'Looking at' : S.lens ? 'Lens' : 'Lens';
    T.$('#nuV').textContent = d.title;
    T.$('#nuS').textContent = d.sub;
    nucleus.setAttribute('aria-label', S.lens ? 'Clear the lens' : 'Choose a lens');
  }

  // session ring around the nucleus (drawn by the focus module)
  T.nucleusRing = function (frac) {
    var svgR = T.$('#nuRing');
    if (!svgR || !geom) return;
    var c = svgR.querySelector('circle.on'), len = 2 * Math.PI * 48;
    c.style.strokeDasharray = f(len * Math.max(0, Math.min(1, frac))) + ' ' + f(len);
    svgR.style.opacity = frac > 0 ? 1 : 0;
  };

  // ---- inspector under the chart on tablet and phone
  T.renderInspector = function () {
    var box = T.$('#inspect');
    if (!box) return;
    T.clear(box);
    var id = S.lens || S.hover;
    if (!id) {
      box.appendChild(el('p', { class: 'cap' }, 'Tap an arc to make it the lens. The board, the dependency chains, the horizon and the stats all narrow to it.'));
      var seg = el('div', { class: 'seg', style: { 'margin-top': '1rem' } });
      G.clusters.forEach(function (c) {
        seg.appendChild(el('button', { class: 'chip', on: { click: function () { T.setLens('c:' + c[0]); } } }, c[1]));
      });
      box.appendChild(seg);
      return;
    }
    var d = T.describe(id), tip = el('div', { class: 'tip', style: { position: 'static', 'max-width': 'none', 'pointer-events': 'auto' } });
    tip.appendChild(T.describeNode(id));
    box.appendChild(tip);
    if (E.get(id).band !== 'p') {
      var seg2 = el('div', { class: 'seg', style: { 'margin-top': '1rem' } });
      T.neighbours(id).slice(0, 40).forEach(function (pid) {
        seg2.appendChild(el('button', { class: 'chip', on: { click: function () { T.setLens(pid); } } }, E.get(pid).name));
      });
      box.appendChild(seg2);
    }
    void d;
  };

  T.on('hover', function () { T.paintChord(); });
  T.on('lens', function () { T.paintChord(); T.renderInspector(); });
})();
