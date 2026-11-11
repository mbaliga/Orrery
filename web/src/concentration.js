/* Concentration — whole or fragmented, read from what was actually committed.
   Each column is one week. Its blocks are the projects that week, tallest first, so a week spent in one project is a single
   tall block and a week spread over many is a column of slivers. Nothing here is simulated: it is the scan's commit counts
   per project per week (yours, your agents', all of them), filtered by the lens. The pure core is exported for node tests. */
(function () {
  'use strict';

  // weeks: { 'YYYY-MM-DD': { projectId: commits } } → [{ week, total, parts: [{id, n, share}], top, eff, kind }]
  function analyse(weeks, count, until) {
    // a week still open when the scan ran would read as a sliver of a week: leave it out
    var keys = Object.keys(weeks).sort().filter(function (w) { return !until || Date.parse(w + 'T00:00:00Z') + 7 * 864e5 <= Date.parse(until); }).slice(-(count || 12)), out = [];
    keys.forEach(function (w) {
      var m = weeks[w], total = 0, parts = [];
      Object.keys(m).forEach(function (id) { if (m[id] > 0) { total += m[id]; parts.push({ id: id, n: m[id] }); } });
      parts.sort(function (a, b) { return b.n - a.n; });
      var hhi = 0;
      parts.forEach(function (p) { p.share = p.n / total; hhi += p.share * p.share; });
      var top = parts.length ? parts[0].share : 0;
      out.push({ week: w, total: total, parts: parts, top: top, eff: hhi ? 1 / hhi : 0, kind: !total ? 'none' : top > 0.5 ? 'whole' : top < 0.3 ? 'fragmented' : 'split' });
    });
    return out;
  }

  // the week's own commit counts, per project, summed over whoever made them
  function collect(projects) {
    var weeks = {};
    projects.forEach(function (p) {
      Object.keys(p.weeks || {}).forEach(function (w) {
        var x = p.weeks[w], n = 0; Object.keys(x).forEach(function (k) { n += x[k] || 0; });
        if (n > 0) { (weeks[w] = weeks[w] || {})[p.id] = n; }
      });
    });
    return weeks;
  }

  function summary(cols) {
    var live = cols.filter(function (c) { return c.total > 0; }), s = { whole: 0, split: 0, fragmented: 0 };
    live.forEach(function (c) { s[c.kind]++; });
    return { weeks: live.length, whole: s.whole, split: s.split, fragmented: s.fragmented };
  }

  var core = { analyse: analyse, collect: collect, summary: summary };
  if (typeof module !== 'undefined' && module.exports) { module.exports = core; return; }

  var T = window.T, G = T.G, el = T.el;
  var NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, kids) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }
  function wk(w) { var d = new Date(w + 'T00:00:00'); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  var WORD = { whole: 'whole', split: 'split in two or three', fragmented: 'in pieces', none: 'quiet' };

  T.renderConcentration = function () {
    var host = T.$('#czHost'); if (!host) return;
    var ps = G.projects.filter(function (p) { return T.inLens(p.id); });
    var names = {}; G.projects.forEach(function (p) { names[p.id] = p.name; });
    var cols = analyse(collect(ps), 12, G.scanned_at), sm = summary(cols);
    T.clear(host);
    var last = null; cols.forEach(function (c) { if (c.total > 0) last = c; });
    if (!last) { host.appendChild(el('p', { class: 'cap' }, 'No commits in this lens yet. Pick a wider lens, or scan a repo.')); return; }

    // the headline: the latest week, in words and in one number
    var lead = last.parts[0];
    host.appendChild(el('div', { class: 'cz-head' },
      el('b', { class: 'cz-big' }, Math.round(last.top * 100) + '%'),
      el('span', { class: 'cz-lead' }, 'of the week of ' + wk(last.week) + ' went to ' + (names[lead.id] || lead.id)),
      el('span', { class: 'cz-sub' }, last.eff.toFixed(1) + ' projects at once · ' + WORD[last.kind])));

    // the columns
    var CW = 17, GAP = 7, H = 104, PADY = 4, W = cols.length * (CW + GAP) - GAP, VH = H + PADY * 2 + 16;
    var root = svg('svg', { viewBox: '0 0 ' + W + ' ' + VH, class: 'cz-svg', role: 'img', preserveAspectRatio: 'xMidYMid meet',
      'aria-label': 'Weekly concentration, ' + sm.weeks + ' weeks: ' + sm.whole + ' whole, ' + sm.split + ' split, ' + sm.fragmented + ' in pieces.' });
    cols.forEach(function (c, i) {
      var x = i * (CW + GAP), g = svg('g', { class: 'cz-col ' + c.kind + (i === cols.length - 1 ? ' now' : '') });
      var tip = wk(c.week) + ': ' + c.total + ' commits, ' + WORD[c.kind] + ', ' + Math.round(c.top * 100) + '% in ' + (c.parts.length ? (names[c.parts[0].id] || c.parts[0].id) : 'nothing');
      g.appendChild(svg('title', {}, [document.createTextNode(tip)]));
      var y = PADY + H, dust = 0;
      c.parts.forEach(function (p, k) {
        if (p.share < 0.045) { dust += p.n; return; }
        var h = Math.max(2.4, p.share * H - 1.6);
        y -= h;
        // a fill is the biggest part, a lighter fill the second, an outline every other: state never rests on hue alone
        g.appendChild(svg('rect', { x: x, y: y.toFixed(2), width: CW, height: h.toFixed(2), rx: 2, class: 'cz-b ' + (k === 0 ? 'b0' : k === 1 ? 'b1' : 'b2') }));
        y -= 1.6;
      });
      if (dust) {   // everything under 4.5% each: a line of dots, the dust of the week
        var dots = Math.min(5, Math.max(1, Math.round(dust / c.total * 20)));
        for (var d = 0; d < dots; d++) g.appendChild(svg('circle', { cx: x + CW / 2 + (d % 2 ? 3 : -3), cy: (y - 3 - d * 4.2).toFixed(2), r: 1.1, class: 'cz-dust' }));
      }
      if (i % 3 === cols.length % 3 || i === cols.length - 1) {
        var t = svg('text', { x: x + CW / 2, y: VH - 2, 'text-anchor': 'middle', class: 'cz-wk' }); t.textContent = wk(c.week); g.appendChild(t);
      }
      root.appendChild(g);
    });
    host.appendChild(el('div', { class: 'cz-plot' }, root));

    // a plain reading of all of it, and the key
    host.appendChild(el('p', { class: 'cz-read' }, sm.weeks + ' weeks: ' + sm.whole + ' whole, ' + sm.split + ' split, ' + sm.fragmented + ' in pieces.'));
    host.appendChild(el('div', { class: 'cz-key', 'aria-hidden': 'true' },
      el('span', null, el('i', { class: 'k0' }), 'most of the week'), el('span', null, el('i', { class: 'k1' }), 'next most'),
      el('span', null, el('i', { class: 'k2' }), 'the rest'), el('span', null, el('i', { class: 'kd' }), 'dust')));
    host.appendChild(el('p', { class: 'cap cz-note' }, 'From commit counts per project per week, closed weeks only. Whole is more than half in one project; in pieces is under 30% in any one.'));
  };
})();
