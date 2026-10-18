/* resume: where you were. For coming back after time away, when the memory of what was in flight, and of why,
   has gone soft. Everything here is read from the scan and the board: when you last committed, what moved while you
   were away, what was half done, what was dropped, what each thing is for, and the three smallest moves that pick the
   work back up. Nothing is a verdict on you; it is a map of the loose ends. */
(function () {
  'use strict';
  var T = window.T, G = T.G, S = T.S, SEED = T.SEED, el = T.el;
  var DAY = 864e5;

  function lastOwnDay() { for (var i = G.days.length - 1; i >= 0; i--) if (G.days[i][1] > 0) return G.days[i][0]; return null; }
  function since(dateStr) { return new Date(dateStr + 'T00:00:00').getTime(); }
  function days(ms) { return Math.round(ms / DAY); }
  function catchUp(pid) {
    var cs = (G.recent || []).filter(function (c) { return c.p === pid; }).sort(function (a, b) { return new Date(b.t) - new Date(a.t); });
    var br = (G.changes || []).filter(function (c) { return (c.repos || []).some(function (r) { return r[0] === pid; }); });
    var p = T.P.get(pid), lines = [];
    if (p && p.last) lines.push('Last commit ' + T.dm(p.last) + '.');
    if (cs.length) lines.push(T.plural(cs.length, 'recent commit') + ' in the scan: ' + T.list(cs.slice(0, 3).map(function (c) { return '“' + c.s + '” by ' + c.who; }), 3) + '.');
    if (br.length) lines.push('Working branches: ' + T.list(br.slice(0, 3).map(function (b) { return b.title; }), 3) + '.');
    var open = T.tasks.filter(function (t) { return (t.p === pid || (t.also || []).indexOf(pid) >= 0) && t.status !== 'done'; });
    if (open.length) lines.push('On the board: ' + T.list(open.slice(0, 4).map(function (t) { return t.title + ' (' + t.status + ')'; }), 4) + '.');
    var amb = (SEED.ambitions || {})[pid];
    if (amb) lines.push('Why it exists: ' + amb);
    return lines.join(' ');
  }
  T.catchUp = catchUp;

  function model() {
    var now = Date.now(), lastDay = lastOwnDay(), scanAt = new Date(G.scanned_at).getTime();
    var away = lastDay ? days(now - since(lastDay)) : null, scanAge = days(now - scanAt);
    var agentCommits = 0, reposTouched = {};
    G.days.forEach(function (r) { if (lastDay && r[0] > lastDay) agentCommits += r[2] + r[3] + r[4]; });
    (G.recent || []).forEach(function (c) { if (!lastDay || c.t.slice(0, 10) > lastDay) reposTouched[c.p] = 1; });
    var merged = (G.merged || []).filter(function (m) { return !lastDay || m.date.slice(0, 10) > lastDay; });
    var inFlight = T.tasks.filter(function (t) { return t.status === 'doing' || t.status === 'review'; }).sort(function (a, b) { return (b.status === 'review') - (a.status === 'review') || (b.real ? 1 : 0) - (a.real ? 1 : 0); });
    var branches = (G.changes || []).slice().sort(function (a, b) { return sumC(b) - sumC(a); }).slice(0, 5);
    var prs = G.projects.filter(function (p) { return p.prs_open > 0; }).sort(function (a, b) { return b.prs_open - a.prs_open; }).slice(0, 6);
    var stalled = T.tasks.filter(function (t) { return t.stalled && t.status !== 'done'; });
    var slipped = T.tasks.filter(function (t) { return t.slipped && t.status !== 'done'; });
    var passed = SEED.schedule.filter(function (s) { return new Date(s.at).getTime() < now && !T.isDone(s.id) && (s.send || s.by); }).sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    var pinned = T.notes.filter(function (n) { return n.pin; }).sort(function (a, b) { return new Date(a.at || 0) - new Date(b.at || 0); });
    // the smallest moves that pick things back up
    var picks = [];
    var gates = T.tasks.filter(function (t) { return t.kind === 'gate' && t.owner === 'you' && t.status !== 'done'; });
    gates.forEach(function (g) { g._f = T.frees(g.id); });
    gates.sort(function (a, b) { return b._f - a._f || (b.stalled ? 1 : 0) - (a._f ? 1 : 0); });
    if (gates[0]) picks.push({ k: 'A gate only you can clear', t: gates[0].title, s: T.projectName(gates[0].p) + (gates[0]._f ? ', frees ' + T.plural(gates[0]._f, 'thing') : '') + (gates[0].stalled ? ', waiting ' + gates[0].stalled : ''), id: gates[0].id, p: gates[0].p });
    var upcoming = SEED.schedule.filter(function (s) { return new Date(s.at).getTime() > now && s.send && s.send.some(function (y) { return !y[1] || !T.isDone(y[1]); }); }).sort(function (a, b) { return new Date(a.at) - new Date(b.at); })[0];
    if (upcoming) { var ready = upcoming.send.filter(function (y) { return y[1] && T.isDone(y[1]); }).length; picks.push({ k: 'The nearest date with sends open', t: upcoming.title, s: T.leftShort(upcoming.at) + ', ' + ready + ' of ' + upcoming.send.length + ' ready', id: upcoming.id, p: upcoming.p }); }
    var nearDone = inFlight.filter(function (t) { return t.status === 'review'; })[0] || inFlight[0];
    if (nearDone) picks.push({ k: nearDone.status === 'review' ? 'Closest to done' : 'Was in your hands', t: nearDone.title, s: T.projectName(nearDone.p) + ', ' + nearDone.status + (nearDone.agent && nearDone.agent !== 'you' ? ', by ' + (T.E.get('a:' + nearDone.agent) || {}).name : ''), id: nearDone.id, p: nearDone.p });
    return { lastDay: lastDay, away: away, scanAge: scanAge, scanAt: scanAt, agentCommits: agentCommits, repos: Object.keys(reposTouched).length, merged: merged, inFlight: inFlight, branches: branches, prs: prs,
      stalled: stalled, slipped: slipped, passed: passed, pinned: pinned, picks: picks };
  }
  function sumC(ch) { return (ch.repos || []).reduce(function (a, r) { return a + (r[1] || 0); }, 0); }
  T.resumeModel = model;
  T.resumeSummary = function () {
    var m = model();
    return (m.lastDay ? 'Your last commit in the scan was on ' + T.dm(m.lastDay) + ', ' + T.plural(m.away, 'day') + ' ago. ' : '') +
      'Since then agents made ' + T.plural(m.agentCommits, 'commit') + ' across ' + T.plural(m.repos, 'repo') + ' and ' + T.plural(m.merged.length, 'pull request') + ' merged. ' +
      T.plural(m.inFlight.length, 'task') + ' in flight, ' + T.plural(m.stalled.length, 'gate') + ' stalled, ' + T.plural(m.passed.length, 'date') + ' passed with sends open. ' +
      (m.picks[0] ? 'Start with: ' + m.picks[0].t + '.' : '') + (m.scanAge > 2 ? ' The scan is ' + T.plural(m.scanAge, 'day') + ' old.' : '');
  };

  function row(title, sub, onOpen, right) {
    var b = el('button', { class: 'row', on: { click: onOpen } }, el('i', { class: 'dot-o' }), el('span', null, el('span', { class: 'row-t' }, title), sub ? el('span', { class: 'row-s' }, sub) : null), el('span', { class: 'row-r' }, right || ''));
    return b;
  }
  T.renderResume = function () {
    var host = T.$('#resumeBody');
    if (!host || !T.shown(host)) return;
    var m = model();
    T.clear(host);
    // away
    var away = el('section', { class: 'rs-sec' });
    away.appendChild(el('h3', { class: 'mod-t' }, 'While you were away'));
    var big = el('p', { class: 'rs-big' });
    if (m.lastDay) { big.appendChild(el('b', null, T.plural(m.away, 'day'))); big.appendChild(document.createTextNode(' since your last commit, on ' + T.DAY[new Date(m.lastDay + 'T12:00:00').getDay()] + ' ' + T.dm(m.lastDay) + '.')); }
    else big.appendChild(document.createTextNode('No commit of yours in the scan.'));
    away.appendChild(big);
    away.appendChild(el('p', { class: 'rs-p' }, 'Agents made ' + T.plural(m.agentCommits, 'commit') + ' across ' + T.plural(m.repos, 'repo') + '; ' + T.plural(m.merged.length, 'pull request') + ' merged' +
      (m.merged.length ? ', the last “' + m.merged[0].title + '” in ' + T.projectName(m.merged[0].p) : '') + '. ' +
      'The scan itself is from ' + T.dm(m.scanAt) + (m.scanAge > 2 ? ', ' + T.plural(m.scanAge, 'day') + ' ago; what happened after it is not here yet.' : '.')));
    host.appendChild(away);
    // pick up here
    var pk = el('section', { class: 'rs-sec' });
    pk.appendChild(el('h3', { class: 'mod-t' }, 'Pick up here'));
    m.picks.forEach(function (p) {
      var r = el('div', { class: 'rs-pick' });
      r.appendChild(el('span', { class: 'rs-k' }, p.k));
      r.appendChild(el('button', { class: 'rs-t', on: { click: function (ev) { T.openTask(p.id, ev.currentTarget); } } }, p.t));
      r.appendChild(el('span', { class: 'rs-s' }, p.s));
      r.appendChild(el('button', { class: 'hud-l ask-c', on: { click: function () { T.openAsk('Catch me up on ' + T.projectName(p.p)); } } }, 'catch me up'));
      pk.appendChild(r);
    });
    host.appendChild(pk);
    // in flight
    var fl = el('section', { class: 'rs-sec' });
    fl.appendChild(el('h3', { class: 'mod-t' }, 'In flight', el('span', { class: 'n' }, String(m.inFlight.length))));
    var ul = el('div', { class: 'rows' });
    m.inFlight.forEach(function (t) {
      var who = t.agent === 'you' ? 'you' : (T.E.get('a:' + t.agent) || {}).name || t.agent;
      ul.appendChild(row(t.title, T.projectName(t.p) + ', ' + t.status + ', ' + who + (t.real ? '' : ', example'), function (ev) { T.openTask(t.id, ev.currentTarget); }, t.status));
    });
    fl.appendChild(ul);
    if (m.branches.length) {
      fl.appendChild(el('h4', { class: 'mod-t sub-t' }, 'Working branches', el('span', { class: 'n' }, String((G.changes || []).length))));
      var bl = el('div', { class: 'rows' });
      m.branches.forEach(function (b) {
        bl.appendChild(row(b.title, T.list((b.who || []).slice(0, 2), 2) + ', ' + T.plural((b.repos || []).length, 'repo'), function () { T.setLens('a:' + b.agent); }, T.plural(sumC(b), 'commit')));
      });
      fl.appendChild(bl);
    }
    if (m.prs.length) fl.appendChild(el('p', { class: 'rs-p' }, 'Open pull requests: ' + T.list(m.prs.map(function (p) { return p.name + ' ' + p.prs_open; }), 6) + '.'));
    host.appendChild(fl);
    // dropped
    var dr = el('section', { class: 'rs-sec' });
    dr.appendChild(el('h3', { class: 'mod-t' }, 'Dropped threads', el('span', { class: 'n' }, String(m.stalled.length + m.slipped.length + m.passed.length))));
    var dl = el('div', { class: 'rows' });
    m.passed.forEach(function (s) {
      var ready = (s.send || []).filter(function (y) { return y[1] && T.isDone(y[1]); }).length;
      dl.appendChild(row(s.title, 'passed ' + T.dm(s.at) + (s.send ? ', ' + ready + ' of ' + s.send.length + ' sent' : ''), function (ev) { T.openTask(s.id, ev.currentTarget); }, 'passed'));
    });
    m.stalled.forEach(function (t) { dl.appendChild(row(t.title, T.projectName(t.p) + ', ' + (t.kind === 'gate' ? 'a gate, ' + (t.owner === 'you' ? 'yours' : t.owner) : t.status), function (ev) { T.openTask(t.id, ev.currentTarget); }, t.stalled)); });
    m.slipped.forEach(function (t) { dl.appendChild(row(t.title, T.projectName(t.p) + ', slipped ' + t.slipped, function (ev) { T.openTask(t.id, ev.currentTarget); }, t.status)); });
    dr.appendChild(dl);
    if (m.pinned.length) {
      dr.appendChild(el('h4', { class: 'mod-t sub-t' }, 'Pinned notes'));
      var nl = el('div', { class: 'rows' });
      m.pinned.forEach(function (n) { nl.appendChild(row(n.text, (n.tag || 'idea') + (n.at ? ', written ' + T.dm(n.at) : ''), function () { if (S.mode !== 'pano') T.setView('canopy'); setTimeout(function () { T.noteTools(n, T.noteScreen(n)); }, 120); }, n.at ? T.plural(days(Date.now() - new Date(n.at).getTime()), 'day') : '')); });
      dr.appendChild(nl);
    }
    host.appendChild(dr);
    // why
    var why = el('section', { class: 'rs-sec' });
    why.appendChild(el('h3', { class: 'mod-t' }, 'What each thing is for'));
    var touched = {};
    m.inFlight.concat(m.stalled, m.slipped).forEach(function (t) { touched[t.p] = 1; (t.also || []).forEach(function (p) { touched[p] = 1; }); });
    m.passed.forEach(function (s) { touched[s.p] = 1; });
    var wl = el('div', { class: 'rs-why' });
    G.projects.forEach(function (p) {
      var a = (SEED.ambitions || {})[p.id];
      if (!a || !(touched[p.id] || p.state === 'active' && T.recentCommits(p.id) > 0)) return;
      wl.appendChild(el('button', { class: 'rs-w', on: { click: function () { T.setLens('p:' + p.id); } } }, el('b', null, p.name), el('span', null, a)));
    });
    why.appendChild(wl);
    why.appendChild(el('p', { class: 'rs-p quiet' }, 'From the constellation registry, in your own words. Everything else that is yours to pick up is on the board and in Releases.'));
    host.appendChild(why);
    if (T.renderAudit) T.renderAudit(host);
  };
})();
