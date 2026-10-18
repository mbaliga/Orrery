/* dependencies: one tree per goal. Read left to right: what must clear first, then what it frees.
   Line style is the relation: solid = depends on, dashed = delayed by, dotted = stalled at a gate. */
(function () {
  'use strict';
  var T = window.T, S = T.S, SEED = T.SEED, el = T.el, sv = T.sv;

  function chainOf(goalId, maxLevel) {
    var level = {}, order = [goalId], cut = {};
    level[goalId] = 0;
    // longest distance to the goal decides the column
    for (var i = 0; i < order.length; i++) {
      var n = T.node(order[i]);
      if (!n) continue;
      (n.by || []).forEach(function (b) {
        if (!T.node(b)) return;
        var d = level[order[i]] + 1;
        if (d > maxLevel) { cut[order[i]] = T.upstream(order[i]).length; return; }
        if (level[b] == null) { level[b] = d; order.push(b); }
        else if (d > level[b]) { level[b] = d; order.push(b); }
      });
    }
    var ids = Object.keys(level), max = 0;
    ids.forEach(function (id) { max = Math.max(max, level[id]); });
    var cols = [];
    for (var c = 0; c <= max; c++) cols.push([]);
    ids.forEach(function (id) { cols[max - level[id]].push(id); });
    var edges = [];
    ids.forEach(function (id) { (T.node(id).by || []).forEach(function (b) { if (level[b] != null) edges.push([b, id]); }); });
    // order each column by where its dependants sit, right to left
    var row = {};
    row[goalId] = 0;
    for (var k = cols.length - 2; k >= 0; k--) {
      cols[k].forEach(function (id) {
        var t = edges.filter(function (e) { return e[0] === id && row[e[1]] != null; }).map(function (e) { return row[e[1]]; });
        row['_' + id] = t.length ? t.reduce(function (a, b) { return a + b; }, 0) / t.length : 0;
      });
      cols[k].sort(function (a, b) { return row['_' + a] - row['_' + b]; });
      cols[k].forEach(function (id, i) { row[id] = i; });
    }
    return { goal: goalId, cols: cols, edges: edges, ids: ids, cut: cut };
  }

  function stateOf(n) {
    if (T.isDone(n.id)) return 'done';
    if (n.kind === 'gate') return 'gate';
    if (!T.taskById(n.id)) return 'goal';
    if (T.openBlockers(n).length) return 'held';
    return n.status === 'doing' || n.status === 'review' ? 'doing' : 'open';
  }
  function glyph(st) {
    if (st === 'done') return el('i', { class: 'tick gl' });
    if (st === 'gate') return el('i', { class: 'dia gl' });
    if (st === 'goal') return el('i', { class: 'dia o gl' });
    if (st === 'doing') return el('i', { class: 'half gl' });
    return el('i', { class: 'dot-o gl' });
  }
  function sub(n, st) {
    if (st === 'gate') return (n.owner === 'you' ? 'yours' : n.owner) + (n.stalled ? ', ' + n.stalled : '');
    if (st === 'goal') return T.leftShort(n.at);
    if (st === 'done') return 'done';
    var b = [T.projectName(n.p)];
    if (n.slipped) b.push('slipped');
    else if (n.stalled) b.push(n.stalled);
    return b.join(', ');
  }

  function drawChain(ch, width, rem) {
    var nc = ch.cols.length, gapX = rem * 1.7, gapY = rem * 0.42, pano = S.mode === 'pano';
    var w = Math.min(rem * (pano ? 15 : 13), (width - gapX * (nc - 1)) / nc), h = Math.max(38, rem * (pano ? 3.2 : 2.95));
    var rows = 0;
    ch.cols.forEach(function (c) { rows = Math.max(rows, c.length); });
    var height = rows * h + (rows - 1) * gapY, pos = {};
    var total = nc * w + (nc - 1) * gapX, x0 = width - total;       // the goal sits at the right edge
    var box = el('div', { class: 'chain-g', style: { height: height + 'px' } });
    var svg = sv('svg', { 'aria-hidden': 'true' });
    box.appendChild(svg);
    var els = {}, edgeEls = [];
    ch.cols.forEach(function (col, ci) {
      var off = (height - (col.length * h + (col.length - 1) * gapY)) / 2;
      col.forEach(function (id, ri) {
        var n = T.node(id), st = stateOf(n), x = x0 + ci * (w + gapX), y = off + ri * (h + gapY);
        pos[id] = { x: x, y: y };
        var d = el('button', { class: 'dn ' + st, data: { id: id }, style: { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' },
          'aria-label': n.title }, glyph(st), el('span', { class: 'dn-x' }, n.title,
          el('span', { class: 'dn-s' }, ch.cut[id] ? ch.cut[id] + ' more upstream' : sub(n, st))));
        d.addEventListener('click', function (ev) { ev.stopPropagation(); T.openTask(id, d); });
        d.addEventListener('pointerenter', function () { light(id); });
        d.addEventListener('pointerleave', function () { light(null); });
        d.addEventListener('focus', function () { light(id); });
        d.addEventListener('blur', function () { light(null); });
        els[id] = d; box.appendChild(d);
      });
    });
    ch.edges.forEach(function (e) {
      var a = pos[e[0]], b = pos[e[1]], from = T.node(e[0]);
      var x1 = a.x + w, y1 = a.y + h / 2, x2 = b.x, y2 = b.y + h / 2, mx = (x1 + x2) / 2;
      var cls = 'edge' + (T.isDone(e[0]) ? ' done' : from.kind === 'gate' ? ' gate' : from.slipped ? ' slip' : '');
      var p = sv('path', { class: cls, d: 'M' + x1 + ' ' + y1 + 'C' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + (x2 - 4) + ' ' + y2 });
      var head = sv('path', { class: 'edge' + (T.isDone(e[0]) ? ' done' : ''), d: 'M' + (x2 - 5) + ' ' + (y2 - 3) + 'L' + (x2 - 1) + ' ' + y2 + 'L' + (x2 - 5) + ' ' + (y2 + 3) });
      svg.appendChild(p); svg.appendChild(head);
      edgeEls.push({ e: e, p: p, h: head });
    });
    function light(id) {
      var wrapEl = box.parentNode;
      if (!wrapEl) return;
      wrapEl.classList.toggle('hl', !!id);
      var on = {};
      if (id) {
        on[id] = 1;
        (function up(x) { ch.edges.forEach(function (e) { if (e[1] === x && !on[e[0]]) { on[e[0]] = 1; up(e[0]); } }); })(id);
        (function down(x) { ch.edges.forEach(function (e) { if (e[0] === x && !on[e[1]]) { on[e[1]] = 1; down(e[1]); } }); })(id);
      }
      Object.keys(els).forEach(function (k) { els[k].classList.toggle('on', !!on[k]); });
      edgeEls.forEach(function (x) { var o = !!(on[x.e[0]] && on[x.e[1]]); x.p.classList.toggle('on', o); x.h.classList.toggle('on', o); });
    }
    return box;
  }

  T.renderDeps = function () {
    var host = T.$('#chains'), sum = T.$('#depsSum'), top = T.$('#depsTop');
    // drawn only when it can be seen: on the ultrawide it is a sheet that opens over the canopy
    if (!T.shown || !T.shown(T.$('#m-deps'))) return;
    T.clear(host); T.clear(sum); T.clear(top);
    var gates = T.tasks.filter(function (t) { return t.kind === 'gate' && t.status !== 'done'; });
    var held = T.tasks.filter(function (t) { return t.status !== 'done' && T.openBlockers(t).length; });
    var yours = gates.filter(function (g) { return g.owner === 'you'; }).length;
    sum.appendChild(el('b', null, T.plural(gates.length, 'open gate')));
    sum.appendChild(document.createTextNode(' hold ' + T.plural(held.length, 'task') + '. ' + yours + ' of them are yours to clear.'));
    T.$('#depsN').textContent = String(held.length);

    gates.forEach(function (g) { g._f = T.frees(g.id); });
    gates.slice().sort(function (a, b) { return b._f - a._f; }).slice(0, 3).forEach(function (g) {
      top.appendChild(el('button', { class: 'row', on: { click: function (ev) { T.openTask(g.id, ev.currentTarget); } } }, el('i', { class: 'dia' }),
        el('span', { class: 'row-t' }, g.title), el('span', { class: 'row-r' }, 'frees ' + g._f)));
    });

    var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    var depth = S.mode === 'pano' ? 3 : 4;
    var chains = SEED.chains.map(function (id) { return chainOf(id, depth); });
    function touches(ch) { return ch.ids.some(function (id) { var n = T.node(id); return T.taskById(id) ? T.taskInLens(n) : T.inLens(n.p); }); }
    function when(ch) { var g = T.node(ch.goal); return g.at ? new Date(g.at).getTime() : 9e15; }
    chains.sort(function (a, b) { return (touches(b) ? 1 : 0) - (touches(a) ? 1 : 0) || when(a) - when(b); });
    var shown = 0, width = 0;
    chains.forEach(function (ch) {
      var g = T.node(ch.goal), open = ch.ids.filter(function (id) { var n = T.node(id); return n.kind === 'gate' && !T.isDone(id); }).length;
      var wrap = el('div', { class: 'chain' + (S.lens && !touches(ch) ? ' dim' : '') });
      var head = el('div', { class: 'chain-h' }, el('span', { class: 'chain-t' }, g.title),
        el('span', { class: 'chain-d' }, (g.at ? T.dm(g.at) + ', ' + T.leftShort(g.at) + (open ? ', ' : '') : '') + (open ? T.plural(open, 'gate') + ' open' : '')));
      wrap.appendChild(head);
      host.appendChild(wrap);
      width = wrap.clientWidth || host.clientWidth;
      wrap.appendChild(drawChain(ch, width, rem));
      shown++;
      if (S.mode === 'pano' && host.scrollHeight > host.clientHeight + 1 && shown > 1) { host.removeChild(wrap); shown--; }
    });
    var more = chains.length - shown;
    T.$('#depsMore').textContent = more > 0 ? '+ ' + T.plural(more, 'more chain') + '. Set a lens to bring one forward.' : '';
  };
})();
