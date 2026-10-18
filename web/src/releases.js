/* releases: how finished each thing is, against what the place it ships to asks for.
   One row per project, one meter per target: five bands, each filled by the steps that are met, hatched where nothing
   here can know yet. Every tick has a source: a task or date on the board, a fact read from a repo, a store's API once
   its connector is on, or your own mark. Nothing is ticked on a guess. Apps, fonts, sites, papers and posts all read
   the same way, because a venue's call for papers is a store spec by another name. */
(function () {
  'use strict';
  var T = window.T, G = T.G, S = T.S, SEED = T.SEED, E = T.E, el = T.el;
  var DAY = 864e5;

  // connectors that could tick the api steps; none is connected in this build
  T.CONNECTORS = {
    play: { name: 'Play Console', on: false, how: 'A service account you make in Google Cloud and invite in the Console. The nightly Action reads tracks, listings and images; nothing is written.' },
    asc: { name: 'App Store Connect', on: false, how: 'A team API key. Needs the paid Apple Developer Program.' },
    gitlab: { name: 'F-Droid (GitLab)', on: false, how: 'Polls your fdroiddata merge request with your own token, a few times an hour.' },
    github: { name: 'GitHub', on: false, how: 'Releases, the google/fonts pull request, and your repos’ LICENSE files, with the token you already hold.' }
  };

  // ---------------------------------------------------------------- which targets a project has
  function datedFor(pid) { return SEED.schedule.filter(function (s) { return s.p === pid; }); }
  function targetsFor(p) {
    var out = [], seen = {};
    function add(t, extra) { if (!t || seen[t.id]) return; seen[t.id] = 1; out.push(Object.assign({ t: t }, extra || {})); }
    (p.platforms || []).forEach(function (f) { var id = T.PLATFORM_TARGET[f]; if (id) add(T.targetById(id), { why: 'platform' }); });
    // an open Android app can also go to F-Droid
    if ((p.platforms || []).indexOf('android') >= 0 && p.vis === 'public') add(T.targetById('f-droid'), { why: 'open' });
    datedFor(p.id).forEach(function (s) {
      var t = T.TARGETS.filter(function (x) { return x.dated === s.id; })[0];
      if (t) add(t, { why: 'dated', dated: s });
      else if (s.minor) {
        var m = T.TARGETS.filter(function (x) { return x.minor === s.minor; })[0];
        if (!m) return;
        if (!seen[m.id]) add(m, { why: 'rhythm', items: [] });
        out.filter(function (x) { return x.t === m; })[0].items.push(s);
      }
    });
    return out;
  }

  // ---------------------------------------------------------------- what is known
  function markKey(pid, tid, sid) { return 'rel.' + pid + '.' + tid + '.' + sid; }
  function liveOn(pid, t) {
    // a store that lists the app has everything the listing needs; the record of going live is on the board
    if (t.id === 'play') return T.tasks.some(function (x) { return x.status === 'done' && /live on Play/i.test(x.title) && (x.p === pid || (x.also || []).indexOf(pid) >= 0); });
    return false;
  }
  function stateOf(pid, t, x) {
    if (t.kind === 'venue' || t.kind === 'publication') {
      var items = x.items || (x.dated ? [x.dated] : []);
      if (!items.length) return { word: t.states[0], n: 0 };
      var passed = items.filter(function (s) { return new Date(s.at).getTime() < Date.now(); });
      var sent = passed.filter(function (s) { return T.isDone(s.id); });
      if (x.items) return { word: sent.length + ' of ' + items.length + ' out', n: sent.length / items.length, late: passed.length - sent.length };
      var d = x.dated;
      if (T.isDone(d.id)) return { word: t.states[t.states.length - 1], n: 1 };
      var open = (d.by || []).filter(function (b) { var n = T.node(b); return n && !T.isDone(b); });
      var doing = open.some(function (b) { var n = T.node(b); return n && (n.status === 'doing' || n.status === 'review'); });
      return { word: doing ? 'drafting' : t.states[0] === 'skip' ? 'skip, by default' : 'not started', n: doing ? 0.3 : 0, due: d };
    }
    if (liveOn(pid, t)) return { word: 'production', n: 1, live: true };
    if (t.id === 'play-wear') {
      var tr = SEED.schedule.filter(function (s) { return s.p === pid && /closed track/i.test(s.title); })[0];
      if (tr) return { word: new Date(tr.at) < new Date() ? 'closed testing, if the track opened' : 'closed testing planned', n: 0.4, due: tr, unsure: true };
    }
    if (t.id === 'google-fonts') {
      var re = SEED.schedule.filter(function (s) { return s.p === pid && /resubmit/i.test(s.title); })[0];
      if (re) return { word: 'rejected once, resubmitting', n: 0.5, due: re };
    }
    if (t.id === 'web') { var pg = (SEED.pages || {})[pid]; if (pg) return { word: 'live', n: 1, live: true, url: pg }; }
    if (t.research === 'required') return { word: 'spec research required', n: 0, stub: true };
    return { word: T.CONNECTORS[t.api] ? 'no record; ' + T.CONNECTORS[t.api].name + ' not connected' : 'no record', n: 0, unknown: true };
  }
  function stepState(pid, t, step, x, st) {
    var manual = T.store.get(markKey(pid, t.id, step.id), null);
    if (manual != null) return { done: !!manual, src: 'your mark', manual: true };
    if (step.evidence === 'task') {
      var tid = step.task || (x.dated && (x.dated.by || []).filter(function (b) { var n = T.taskById(b); return n && !T.isDone(b); })[0]);
      if (step.id === 'closed-test' || step.id === 'glyphs') {
        var g = T.tasks.filter(function (k) { return k.p === pid && (step.id === 'closed-test' ? /tester|closed test|closed track/i.test(k.title) : /glyph/i.test(k.title)); })[0];
        if (g) return { done: T.isDone(g.id), src: g.kind === 'gate' ? 'a gate on the board' : 'a task on the board', task: g };
        return st.live ? { done: true, src: 'live on the store' } : { done: null, src: 'no task on the board' };
      }
      if (x.items) { var dr = x.items.filter(function (s) { return (s.by || []).length; }); return { done: dr.length ? dr.every(function (s) { return (s.by || []).every(T.isDone); }) : null, src: dr.length ? 'tasks on the board' : 'no draft task yet' }; }
      if (tid) { var tk = T.node(tid); return { done: T.isDone(tid), src: tk && tk.kind === 'gate' ? 'a gate on the board' : 'a task on the board', task: tk }; }
      return { done: null, src: 'no task on the board' };
    }
    if (step.evidence === 'date') {
      var items = x.items || (x.dated ? [x.dated] : []);
      if (!items.length) return { done: null, src: 'no date' };
      var passed = items.filter(function (s) { return new Date(s.at).getTime() < Date.now(); });
      return { done: passed.length ? passed.every(function (s) { return T.isDone(s.id); }) : false, src: passed.length ? 'the date, and its sends' : 'not due yet' };
    }
    if (step.evidence === 'repo') {
      var f = (T.FACTS[pid] || {})[step.fact];
      if (f) return { done: f.ok, src: 'read from ' + f.where };
      return { done: null, src: 'not read from the repo yet' };
    }
    if (step.evidence === 'api') {
      if (st.live) return { done: true, src: 'listed, so complete' };
      var c = T.CONNECTORS[t.api];
      return { done: null, src: c ? c.name + ' not connected' : 'no connector' };
    }
    return { done: null, src: 'yours to mark' };
  }
  function readiness(pid, t, x) {
    var st = stateOf(pid, t, x), bands = {}, done = 0, total = 0, unknown = 0, rows = [];
    T.BANDS.forEach(function (b) { bands[b[0]] = { done: 0, total: 0, unknown: 0 }; });
    t.steps.forEach(function (s) {
      var r = stepState(pid, t, s, x, st), b = bands[s.band];
      b.total++; total++;
      if (r.done === true) { b.done++; done++; } else if (r.done == null) { b.unknown++; unknown++; }
      rows.push({ step: s, r: r });
    });
    return { st: st, bands: bands, done: done, total: total, unknown: unknown, rows: rows, k: total ? done / total : st.n };
  }
  T.releaseOf = function (pid, tid) {
    var p = T.P.get(pid), t = T.targetById(tid);
    if (!p || !t) return null;
    var x = targetsFor(p).filter(function (y) { return y.t === t; })[0];
    return x ? readiness(pid, t, x) : null;
  };
  T.releasesFor = function (pid) {
    var p = T.P.get(pid);
    return p ? targetsFor(p).map(function (x) { var r = readiness(pid, x.t, x); r.t = x.t; r.x = x; return r; }) : [];
  };
  // one line, for Ask
  T.releaseSummary = function (pid) {
    var rs = T.releasesFor(pid);
    if (!rs.length) return T.projectName(pid) + ' ships nowhere yet: no platform in its scan and no date on the board.';
    return rs.map(function (r) { return r.t.name + ': ' + r.st.word + (r.total ? ', ' + r.done + ' of ' + r.total + ' steps met' + (r.unknown ? ', ' + r.unknown + ' unknown' : '') : ''); }).join('. ') + '.';
  };

  // ---------------------------------------------------------------- the view
  var open = {};   // pid|tid → expanded
  function meter(r) {
    var m = el('span', { class: 'rm', 'aria-hidden': 'true' });
    T.BANDS.forEach(function (b) {
      var x = r.bands[b[0]];
      if (!x.total) return;
      var seg = el('i', { class: 'rm-s' + (x.unknown === x.total ? ' rm-u' : ''), title: b[1] + ': ' + x.done + ' of ' + x.total + (x.unknown ? ', ' + x.unknown + ' unknown' : '') });
      seg.appendChild(el('b', { style: { width: (x.total ? x.done / x.total * 100 : 0).toFixed(0) + '%' } }));
      m.appendChild(seg);
    });
    return m;
  }
  function glyphFor(row) {
    if (row.r.done === true) return el('i', { class: 'tick gl' });
    if (row.r.done == null) return el('i', { class: 'unk gl', 'aria-label': 'unknown' });
    return el('i', { class: (row.step.band === 'gates' ? 'dia o' : 'dot-o') + ' gl' });
  }
  function detail(pid, t, r, host) {
    T.clear(host);
    var p = T.P.get(pid), name = p.name;
    if (t.research === 'required') {
      host.appendChild(el('p', { class: 'rel-note' }, 'This target’s requirements have not been researched yet, so nothing here is guessed. ' + (t.hint || '')));
    }
    if (t.partial) host.appendChild(el('p', { class: 'rel-note' }, 'Partly documented: Garmin’s own page says little, and the gaps are marked.'));
    if (t.verify) host.appendChild(el('p', { class: 'rel-note' }, t.verify));
    T.BANDS.forEach(function (b) {
      var rows = r.rows.filter(function (x) { return x.step.band === b[0]; });
      if (!rows.length) return;
      var sec = el('div', { class: 'rel-band' });
      sec.appendChild(el('h4', { class: 'mod-t' }, b[1], el('span', { class: 'n' }, r.bands[b[0]].done + '/' + r.bands[b[0]].total)));
      rows.forEach(function (row) {
        var s = row.step, line = el('div', { class: 'rel-step' + (row.r.done === true ? ' done' : row.r.done == null ? ' unknown' : '') });
        line.appendChild(glyphFor(row));
        var txt = el('span', { class: 'rel-x' }, el('span', { class: 'rel-l' }, s.label), el('span', { class: 'rel-src' }, row.r.src + (s.undocumented ? ' · ' + s.undocumented : '') + (s.hint && row.r.done !== true ? ' · ' + s.hint : '')));
        line.appendChild(txt);
        var acts = el('span', { class: 'rel-acts' });
        if (row.r.task) acts.appendChild(el('button', { class: 'hud-l', on: { click: function (ev) { T.openTask(row.r.task.id, ev.currentTarget); } } }, 'open'));
        if (s.prompt && row.r.done !== true) acts.appendChild(el('button', { class: 'hud-l ask-c', title: s.prompt.replace(/\{project\}/g, name), on: { click: function () { T.openAsk(s.prompt.replace(/\{project\}/g, name)); } } }, 'ask'));
        if (s.link) acts.appendChild(el('a', { class: 'hud-l', href: s.link, target: '_blank', rel: 'noopener' }, 'open ↗'));
        if (s.evidence === 'manual' || row.r.manual || row.r.done == null) {
          acts.appendChild(el('button', { class: 'hud-l', on: { click: function () {
            var k = markKey(pid, t.id, s.id), cur = T.store.get(k, null);
            if (cur === true) T.store.del(k); else T.store.set(k, true);
            T.renderReleases();
          } } }, row.r.done === true && row.r.manual ? 'unmark' : 'mark done'));
        }
        line.appendChild(acts);
        sec.appendChild(line);
      });
      host.appendChild(sec);
    });
    var foot = el('p', { class: 'rel-foot' });
    if (t.researchedAt) foot.appendChild(document.createTextNode('Requirements researched ' + T.dm(t.researchedAt) + ' ' + new Date(t.researchedAt).getFullYear() + '. Specs drift: check the official page before you submit. '));
    (t.sources || []).forEach(function (u, i) { foot.appendChild(el('a', { href: u, target: '_blank', rel: 'noopener' }, 'source ' + (i + 1))); foot.appendChild(document.createTextNode(' ')); });
    host.appendChild(foot);
  }
  function urgency(rs) {
    var next = null;
    rs.forEach(function (r) {
      var items = r.x.items || (r.x.dated ? [r.x.dated] : []), due = r.st.due ? [r.st.due] : [];
      items.concat(due).forEach(function (s) { var tt = new Date(s.at).getTime(); if (tt > Date.now() && (!next || tt < next)) next = tt; });
    });
    return next;
  }
  T.renderReleases = function () {
    var host = T.$('#relRows'), sum = T.$('#relSum');
    if (!host || !T.shown(host)) return;
    T.clear(host);
    var rows = [], live = 0, mid = 0, none = 0, waiting = 0;
    G.projects.forEach(function (p) {
      if (!T.inLens(p.id)) return;
      var rs = T.releasesFor(p.id);
      if (!rs.length) return;
      rs.forEach(function (r) {
        if (r.st.live || r.st.n === 1) live++; else if (r.st.n > 0) mid++; else none++;
        r.rows.forEach(function (x) { if (x.r.task && x.r.task.kind === 'gate' && x.r.done === false && x.r.task.owner === 'you') waiting++; });
      });
      rows.push({ p: p, rs: rs, next: urgency(rs), k: rs.reduce(function (a, r) { return a + r.k; }, 0) / rs.length });
    });
    rows.sort(function (a, b) { return (a.next || 9e15) - (b.next || 9e15) || b.k - a.k; });
    var off = Object.keys(T.CONNECTORS).filter(function (k) { return !T.CONNECTORS[k].on; }).map(function (k) { return T.CONNECTORS[k].name; });
    T.clear(sum);
    sum.appendChild(el('b', null, T.plural(live, 'thing') + ' live'));
    sum.appendChild(document.createTextNode(', ' + mid + ' part way, ' + none + ' not started' + (waiting ? ', ' + T.plural(waiting, 'gate') + ' on you' : '') + '. '));
    sum.appendChild(document.createTextNode(off.length ? 'Not connected: ' + T.list(off, 4) + ', so what the stores know is marked unknown, not assumed. ' : ''));
    sum.appendChild(el('button', { class: 'hud-l', on: { click: function () { T.openSettings('connect'); } } }, 'connectors'));
    T.$('#relN').textContent = String(rows.length);
    var byCluster = {};
    rows.forEach(function (r) { (byCluster[r.p.cluster] = byCluster[r.p.cluster] || []).push(r); });
    G.clusters.forEach(function (c) {
      var list = byCluster[c[0]];
      if (!list) return;
      var g = el('section', { class: 'rel-group' });
      g.appendChild(el('h3', { class: 'mod-t' }, c[1]));
      list.forEach(function (row) {
        var pr = el('div', { class: 'rel-row' });
        pr.appendChild(el('button', { class: 'rel-p', on: { click: function () { T.setLens('p:' + row.p.id); } } }, row.p.name,
          row.next ? el('span', { class: 'rel-due' }, 'next ' + T.dm(row.next)) : null));
        var ts = el('div', { class: 'rel-ts' });
        row.rs.forEach(function (r) {
          var key = row.p.id + '|' + r.t.id, isOpen = !!open[key];
          var b = el('button', { class: 'rel-t' + (isOpen ? ' on' : '') + (r.st.live ? ' live' : ''), 'aria-expanded': String(isOpen), on: { click: function () { open[key] = !open[key]; T.renderReleases(); } } },
            el('span', { class: 'rel-tn' }, r.t.name), meter(r),
            el('span', { class: 'rel-k' }, r.total ? r.done + '/' + r.total : ''), el('span', { class: 'rel-st' + (r.st.unknown || r.st.stub ? ' quiet' : '') }, r.st.word + (r.st.late ? ', ' + r.st.late + ' late' : '')));
          ts.appendChild(b);
          if (isOpen) { var d = el('div', { class: 'rel-detail' }); detail(row.p.id, r.t, r, d); ts.appendChild(d); }
        });
        pr.appendChild(ts);
        g.appendChild(pr);
      });
      host.appendChild(g);
    });
    if (!rows.length) host.appendChild(el('p', { class: 'empty' }, 'Nothing in this lens ships anywhere yet.'));
  };
})();
