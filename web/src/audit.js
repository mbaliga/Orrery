/* audit: where work repeats, and what connects.
   Read deterministically from the scan, the board and the notes: projects that share a stack but no shared module
   (a module waiting to be carved out), tasks whose titles say the same thing in two places, purposes that overlap,
   notes that tie several projects together. Every finding names its evidence and the move it suggests, so the plan
   of action is a list you can act on, not a mood. The model, on the device or in the cloud with your own key, reads
   these findings and the repos themselves in the build (spec §5) and writes the narrative; here Ask reads them out. */
(function () {
  'use strict';
  var T = window.T, G = T.G, SEED = T.SEED, E = T.E, el = T.el;
  var STOP = {};
  'the a an and or of to in on for with from by at as is are was be this that it its into over under about after before your you my me we our one two new all any more most less than then v1 v2 app apps'.split(' ').forEach(function (w) { STOP[w] = 1; });
  function words(s) { return String(s || '').toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 4 && !STOP[w]; }); }
  function jaccard(a, b) { var A = {}, n = 0, u = 0; a.forEach(function (w) { A[w] = 1; }); b.forEach(function (w) { if (A[w]) n++; else u++; }); return (n / (Object.keys(A).length + u)) || 0; }
  var cache = null;
  T.redundancies = function () {
    if (cache) return cache;
    var out = [];
    var ps = G.projects.filter(function (p) { return p.src === 'scan'; });
    // 1. the same stack, no shared module between them: a module waiting to be carved out
    for (var i = 0; i < ps.length; i++) for (var j = i + 1; j < ps.length; j++) {
      var a = ps[i], b = ps[j], common = a.tech.filter(function (t) { return b.tech.indexOf(t) >= 0; });
      var sharedBoth = a.shared.filter(function (s) { return b.shared.indexOf(s) >= 0; });
      if (common.length >= 4 && sharedBoth.length === 0) out.push({ kind: 'stack', strength: common.length / 4, ps: [a.id, b.id], title: a.name + ' and ' + b.name + ' build on the same ' + common.length + ' libraries and share no module',
        evidence: common.join(', '), move: 'Carve the common layer into Shared-Libraries-asoc, or record why the two stay apart.' });
    }
    // 2. a shared module that only its home uses while others carry the same libraries
    (G.shared || []).forEach(function (s) {
      var users = ps.filter(function (p) { return p.shared.indexOf(s.id) >= 0; });
      if (users.length === 1 && users[0].id === s.home) {
        var home = users[0], others = ps.filter(function (p) { return p.id !== home.id && p.tech.filter(function (t) { return home.tech.indexOf(t) >= 0; }).length >= 3; });
        if (others.length) out.push({ kind: 'lonely', strength: 0.8, ps: [home.id].concat(others.slice(0, 3).map(function (p) { return p.id; })), title: s.name + ' is used only by ' + home.name + ' while ' + T.list(others.map(function (p) { return p.name; }), 3) + ' share its stack',
          evidence: 'module ' + s.id + ', home ' + home.name, move: 'Adopt the module where the stack matches, or fold it back into ' + home.name + '.' });
      }
    });
    // 3. tasks that say the same thing in two projects
    var ts = T.tasks.filter(function (t) { return t.status !== 'done'; });
    for (var x = 0; x < ts.length; x++) for (var y = x + 1; y < ts.length; y++) {
      var ta = ts[x], tb = ts[y]; if (ta.p === tb.p) continue;
      var sim = jaccard(words(ta.title), words(tb.title));
      if (sim >= 0.4) out.push({ kind: 'task', strength: sim, ps: [ta.p, tb.p], title: '“' + ta.title + '” and “' + tb.title + '” read as the same work', evidence: Math.round(sim * 100) + '% of their words in common', move: 'Do it once, in the shared place, and point both projects at it.', tasks: [ta.id, tb.id] });
    }
    // 4. purposes that overlap, by the registry's own words
    var amb = SEED.ambitions || {}, ids = Object.keys(amb);
    for (var m = 0; m < ids.length; m++) for (var n = m + 1; n < ids.length; n++) {
      var sm = jaccard(words(amb[ids[m]]), words(amb[ids[n]]));
      if (sm >= 0.18) out.push({ kind: 'purpose', strength: sm, ps: [ids[m], ids[n]], title: T.projectName(ids[m]) + ' and ' + T.projectName(ids[n]) + ' are described in overlapping words', evidence: words(amb[ids[m]]).filter(function (w) { return words(amb[ids[n]]).indexOf(w) >= 0; }).join(', '), move: 'Say in one line how they differ, or merge the ambitions.' });
    }
    // 5. notes that tie projects together: connected ideas
    (T.notes || []).forEach(function (q) {
      var lp = (q.links || []).filter(function (id) { return id.indexOf('p:') === 0; });
      if (lp.length >= 2) out.push({ kind: 'idea', strength: 0.5 + lp.length * 0.1, ps: lp.map(function (id) { return id.slice(2); }), title: 'A note connects ' + T.list(lp.map(function (id) { return E.get(id).name; }), 4) + ': “' + q.text.slice(0, 60) + (q.text.length > 60 ? '…' : '') + '”', evidence: 'the compiler’s links', move: 'If it is one idea, make it one task under one project.' });
    });
    // 6. a repo quiet for long while its purpose is live elsewhere: the registry's stalled projects
    G.projects.forEach(function (p) { if (p.state === 'stalled') out.push({ kind: 'stalled', strength: 0.4, ps: [p.id], title: p.name + ' is stalled' + (p.last ? '; last commit ' + T.dm(p.last) : ''), evidence: 'registry state', move: 'Decide: continue, fold into a neighbour, or archive with a note.' }); });
    out.sort(function (a, b) { return b.strength - a.strength; });
    cache = out;
    return out;
  };
  ['tasks', 'notes'].forEach(function (ev) { T.on(ev, function () { cache = null; }); });
  var KIND = { stack: 'Same stack, no shared module', lonely: 'A module only its home uses', task: 'The same work in two places', purpose: 'Overlapping purposes', idea: 'An idea across projects', stalled: 'Stalled' };
  T.auditSummary = function () {
    var r = T.redundancies(), lines = [], by = {};
    r.forEach(function (f) { by[f.kind] = (by[f.kind] || 0) + 1; });
    lines.push(T.plural(r.length, 'finding') + ': ' + Object.keys(by).map(function (k) { return by[k] + ' ' + KIND[k].toLowerCase(); }).join('; ') + '.');
    r.slice(0, 6).forEach(function (f) { lines.push('• ' + f.title + '. ' + f.move); });
    lines.push('Read from the scan, the board and the notes, by words and shared libraries; in the build the model reads the repos themselves and writes the plan, with your own key or on the device.');
    return lines;
  };
  T.renderAudit = function (host) {
    var r = T.redundancies();
    var sec = el('section', { class: 'rs-sec' });
    sec.appendChild(el('h3', { class: 'mod-t' }, 'Where work repeats ', el('span', { class: 'n' }, String(r.length)), T.info('Found by words and shared libraries across the scan, the board and the notes: the same stack with no shared module, the same task in two projects, overlapping purposes, notes that tie projects together, stalled repos. In the build the on-device or cloud model reads the repos themselves and writes the plan of action from these findings.', 'About the audit')));
    if (!r.length) sec.appendChild(el('p', { class: 'rs-p' }, 'Nothing repeats, by this reading.'));
    r.slice(0, 12).forEach(function (f) {
      var row = el('div', { class: 'au' });
      row.appendChild(el('span', { class: 'au-k' }, KIND[f.kind]));
      row.appendChild(el('p', { class: 'au-t' }, f.title + '.'));
      row.appendChild(el('p', { class: 'au-s' }, f.evidence + ' — ' + f.move));
      var chips = el('div', { class: 'au-c' });
      f.ps.slice(0, 4).forEach(function (pid) { if (T.P.has(pid)) chips.appendChild(el('button', { class: 'chip', on: { click: function () { T.setLens('p:' + pid); } } }, T.projectName(pid))); });
      if (f.tasks) f.tasks.forEach(function (id) { chips.appendChild(el('button', { class: 'chip', on: { click: function (ev) { T.openTask(id, ev.currentTarget); } } }, 'open task')); });
      row.appendChild(chips);
      sec.appendChild(row);
    });
    host.appendChild(sec);
  };
})();
