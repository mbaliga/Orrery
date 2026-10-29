/* Ask Orrery: one input for anything, from anywhere. Find any project, group, library, agent, task, date or note;
   note a thought or add a task; move a card; switch views; or ask a question and get an answer from your own data.
   Speak to it where the browser allows a microphone. Nothing leaves the device: what it cannot answer from the data
   can go to an on-device model when one is present (the browser's built-in model here; ASOM in the build). */
(function () {
  'use strict';
  var T = window.T, G = T.G, S = T.S, SEED = T.SEED, E = T.E, el = T.el;
  var DAY = 864e5;
  var A = { open: false, rows: [], sel: 0, model: 'unknown', session: null, rec: null, listening: false, asked: 0 };
  var box, input, list, ans, foot, mic;

  // ---------------------------------------------------------------- matching
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[‘’']/g, '').replace(/[^a-z0-9#+@.\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function score(q, text) {
    var t = norm(text);
    if (!q || !t) return 0;
    if (t === q) return 120;
    if (t.indexOf(q) === 0) return 100 - Math.min(30, t.length - q.length) * 0.4;
    var i = t.indexOf(' ' + q);
    if (i >= 0) return 84 - Math.min(20, i * 0.1);
    i = t.indexOf(q);
    if (i >= 0 && q.length >= 3) return 60 - Math.min(20, i * 0.1);
    var qw = q.split(' '), tw = t.split(' ');
    if (qw.length > 1 && qw.every(function (w) { return tw.some(function (x) { return x.indexOf(w) === 0; }); })) return 72;
    if (q.length < 3) return 0;
    // the letters in order, with few gaps: "fbstudio" finds Fonebrew Studio
    var j = 0, gaps = 0, last = -1;
    for (var k = 0; k < t.length && j < q.length; k++) {
      if (t[k] === q[j]) { if (last >= 0 && k - last > 1) gaps++; last = k; j++; }
    }
    return j === q.length ? Math.max(4, 34 - gaps * 5) : 0;
  }
  function best(q, pool, key) {
    var b = null, bs = 0;
    pool.forEach(function (x) { var s = score(norm(q), key(x)); if (s > bs) { bs = s; b = x; } });
    return bs >= 30 ? b : null;
  }
  function entities() { var a = []; E.forEach(function (e) { a.push(e); }); return a; }
  function bestEntity(q) { return best(q.replace(/^(the|my)\s+/i, ''), entities(), function (e) { return e.name; }); }
  function bestDated(q) { return best(q.replace(/^(the|my)\s+/i, '').replace(/\s+(deadline|date|due)$/i, ''), SEED.schedule, function (s) { return s.title; }); }
  function bestTask(q) { return best(q, T.tasks, function (t) { return t.title; }); }

  // ---------------------------------------------------------------- what Ask can do
  var BANDN = { p: 'Project', c: 'Group', a: 'Agent', f: 'Platform', n: 'Kind of work', l: 'Language', t: 'Library', s: 'Shared' };
  var STATUS = { backlog: 'backlog', ready: 'ready', doing: 'doing', 'in progress': 'doing', progress: 'doing', started: 'doing',
    review: 'review', 'in review': 'review', done: 'done', finished: 'done', complete: 'done', completed: 'done' };
  function statusName(s) { var x = (T.STATUS || []).filter(function (r) { return r[0] === s; })[0]; return x ? x[1] : s; }
  function byAt(a, b) { return new Date(a.at) - new Date(b.at); }

  function leanIn() { if (T.isLeanBack && T.isLeanBack()) T.leanIn(); }
  function centre() { return [window.innerWidth / 2, window.innerHeight * 0.3]; }
  function openItem(id) {
    leanIn();
    setTimeout(function () { var c = centre(); T.openTaskAt(id, c[0], c[1]); }, 60);
  }
  function showNote(n) {
    leanIn();
    if (S.mode !== 'pano' && S.view !== 'canopy') T.setView('canopy');
    setTimeout(function () { T.noteTools(n, T.noteScreen(n)); }, 120);
  }
  function lens(e) {
    leanIn();
    if (S.mode !== 'pano' && S.view !== 'canopy') T.setView('canopy');
    T.setLens(e.id);
  }

  function lensRow(e, why) {
    var d = T.describe(e.id);
    return { k: BANDN[e.band] || 'Lens', title: e.name, sub: why || d.sub || d.kind, run: function () { lens(e); } };
  }
  function noteRow(text, strong) {
    var t = text.trim();
    return { k: 'Note', title: strong ? t : 'Keep as a note', sub: strong ? 'Keep as a note' + tagHint(t) : t, strong: strong,
      run: function () { T.addNote(t, null, true); } };
  }
  function tagHint(t) { var m = t.match(/#([\w-]+)/); return m ? ', tagged ' + m[1].toLowerCase() : ''; }
  function taskRow(text) {
    var t = text.trim(), pid = null, m = t.match(/\s+(?:in|for|on|under)\s+([\w .-]+)$/i), hash = t.match(/#([\w-]+)/);
    if (m) { var e = best(m[1], G.projects.map(function (p) { return E.get('p:' + p.id); }), function (x) { return x.name; }); if (e) { pid = e.p.id; t = t.slice(0, m.index); } }
    if (!pid && hash && T.P.has(hash[1].toLowerCase())) { pid = hash[1].toLowerCase(); }
    t = t.replace(/\s*#[\w-]+/g, '').trim();
    var le = S.lens && E.get(S.lens);
    if (!pid) pid = le && le.band === 'p' ? le.p.id : 'tracker';
    return { k: 'Task', title: t, sub: 'Add to Ready under ' + T.projectName(pid), strong: true, run: function () { T.addTask(t, pid); } };
  }
  function moveRow(what, to) {
    var t = bestTask(what), st = STATUS[to.toLowerCase()];
    if (!t || !st) return null;
    return { k: 'Move', title: t.title, sub: statusName(t.status) + ' to ' + statusName(st), strong: true, run: function () { T.moveTask(t.id, st); } };
  }
  function viewRow(v, name) {
    return { k: 'View', title: name, sub: S.mode === 'pano' && v !== 'chains' ? 'Already on the cockpit' : 'Go to ' + name,
      run: function () { leanIn(); if (v === 'chains') T.openChains(true); else T.setView(v); } };
  }
  function commands() {
    var out = [], back = T.isLeanBack && T.isLeanBack();
    out.push(back ? { k: 'Do', title: 'Lean in', sub: 'Back to the cockpit', run: leanIn }
      : { k: 'Do', title: 'Lean back', sub: 'The sky: your work as constellations, one thing at a time', run: function () { T.leanBack(false); } });
    out.push({ k: 'Do', title: T.canopyDepth() ? 'Flat' : 'Depth', sub: T.canopyDepth() ? 'The chord, face on' : 'The orrery and the flight path in 3D',
      run: function () { leanIn(); T.canopySet('depth', !T.canopyDepth()); } });
    out.push({ k: 'Do', title: T.focusRunning && T.focusRunning() ? 'Stop the focus block' : 'Start a focus block', sub: 'Sound made on this device', run: function () { T.toggleFocus(); } });
    if (S.lens) out.push({ k: 'Do', title: 'Clear the lens', sub: 'Back to all work', run: function () { T.setLens(null); } });
    out.push({ k: 'Do', title: 'Resume', sub: 'Where you were: in flight, dropped, and what to pick up', run: function () { leanIn(); T.openSheet('resume'); } });
    out.push({ k: 'Do', title: 'Releases', sub: 'How finished each thing is, against what it ships to', run: function () { leanIn(); T.openSheet('releases'); } });
    out.push({ k: 'Do', title: 'The year', sub: 'Every day around a circle; the next three days and the runways beside it', run: function () { leanIn(); if (T.openYear) T.openYear(); } });
    out.push({ k: 'Do', title: 'Body', sub: 'Sessions as their segments, sore regions, sitting', run: function () { leanIn(); if (T.openBody) T.openBody(); } });
    out.push({ k: 'Do', title: 'Check in', sub: 'Mood and energy, one tap each; today\u2019s capacity follows', run: function () { leanIn(); if (T.openYear) T.openYear(); } });
    out.push({ k: 'Do', title: 'Settings', sub: 'Background, sunbeam, torch, connectors, your own name and logo', run: function () { leanIn(); if (T.openSettings) T.openSettings(); } });
    out.push({ k: 'Do', title: 'What a visitor sees', sub: 'The free view: your apps as one sky, read-only', run: function () { if (T.visitorView) T.visitorView(true); } });
    out.push({ k: 'Do', title: 'How ' + (T.brandName ? T.brandName() : 'Orrery') + ' is wired', sub: 'Design notes and keys', run: function () { leanIn(); T.$('#blueprint').hidden = false; } });
    return out;
  }

  // ---------------------------------------------------------------- answers, from the data on this page
  function endOfDay(plus) { var d = new Date(); d.setHours(23, 59, 59, 0); return d.getTime() + plus * DAY; }
  function when(at) {
    var d = new Date(at), today = new Date(); today.setHours(0, 0, 0, 0);
    var days = Math.round((new Date(d).setHours(0, 0, 0, 0) - today.getTime()) / DAY);
    var day = days === 0 ? 'today' : days === 1 ? 'tomorrow' : T.DAY[d.getDay()].slice(0, 3) + ' ' + T.dm(d);
    return day + ' at ' + T.hm(d);
  }
  function datedRow(s) {
    var ob = T.openBlockers(s).length;
    return { k: s.hard ? 'Deadline' : s.minor ? 'Send' : 'Date', title: s.title, sub: when(s.at) + ', ' + T.leftShort(s.at) + (ob ? ', ' + T.plural(ob, 'thing') + ' open' : ''),
      run: function () { openItem(s.id); } };
  }
  function dueAnswer(q) {
    var now = Date.now(), lim = /\btoday\b/.test(q) ? endOfDay(0) : /\btomorrow\b/.test(q) ? endOfDay(1) : /\bweek\b/.test(q) ? now + 7 * DAY : /\bmonth\b/.test(q) ? now + 31 * DAY : 0;
    var items = SEED.schedule.filter(function (s) { var t = new Date(s.at).getTime(); return t > now && (!lim || t < lim) && T.inLens(s.p); }).sort(byAt);
    if (/\bdeadlines?\b|\bhard\b/.test(q)) items = items.filter(function (s) { return s.hard; });
    if (/\bsend|post|publish/.test(q)) items = items.filter(function (s) { return s.lane === 'publish'; });
    var span = /\btoday\b/.test(q) ? 'today' : /\btomorrow\b/.test(q) ? 'by the end of tomorrow' : /\bweek\b/.test(q) ? 'in the next seven days' : /\bmonth\b/.test(q) ? 'in the next month' : '';
    if (!items.length) return { text: span ? 'Nothing is due ' + span + (S.lens ? ' in this lens' : '') + '.' : 'Nothing dated is coming up' + (S.lens ? ' in this lens' : '') + '.' };
    var f = items[0], text;
    if (span) text = T.plural(items.length, 'thing') + ' due ' + span + '. First: ' + f.title + ', ' + when(f.at) + '.';
    else {
      text = 'Next: ' + f.title + ', ' + when(f.at) + '.';
      if (items[1]) text += ' Then ' + items[1].title + ', ' + when(items[1].at) + '.';
    }
    return { text: text, rows: items.slice(0, 6).map(datedRow) };
  }
  function whenAnswer(x) {
    var s = bestDated(x);
    if (!s) return null;
    var ready = s.send ? s.send.filter(function (y) { return y[1] && T.isDone(y[1]); }).length : 0, past = new Date(s.at) < new Date();
    var text = s.title + (past ? ' was ' : ' is ') + when(s.at) + (s.where ? ' (' + s.where + ')' : '') + (past ? '.' : ', ' + T.leftShort(s.at) + '.');
    if (s.send && s.send.length && !past) text += ' ' + ready + ' of ' + s.send.length + ' ready.';
    var g = T.openGates(s.id).length;
    if (g && !past) text += ' ' + T.plural(g, 'gate') + ' still open upstream.';
    var nz = T.nudgesFor(s).filter(function (n) { return n.when > new Date(); })[0];
    if (nz) text += ' Next reminder ' + when(nz.when) + '.';
    return { text: text, rows: [datedRow(s)] };
  }
  function nudgeAnswer() {
    var nz = T.upcomingNudges(4, true);
    if (!nz.length) return { text: 'No reminders are waiting.' };
    return { text: 'Next reminder ' + when(nz[0].when) + ': ' + nz[0].item.title + ', ' + nz[0].label + '.',
      rows: nz.map(function (n) { return { k: 'Reminder', title: n.item.title, sub: when(n.when) + ', ' + n.label, run: function () { openItem(n.item.id); } }; }) };
  }
  function gatesOnYou() {
    var gs = T.tasks.filter(function (t) { return t.kind === 'gate' && t.status !== 'done' && t.owner === 'you' && T.taskInLens(t); });
    gs.forEach(function (g) { g._f = T.frees(g.id); });
    gs.sort(function (a, b) { return b._f - a._f; });
    return gs;
  }
  function needsAnswer() {
    var gs = gatesOnYou();
    if (!gs.length) return { text: 'Nothing waits on you' + (S.lens ? ' in this lens' : '') + '.' };
    var f = gs[0];
    return { text: T.plural(gs.length, 'thing') + ' wait on you. Start with ' + f.title + (f._f ? ': it frees ' + f._f + ' downstream.' : '.'),
      rows: gs.slice(0, 6).map(function (g) { return { k: 'Gate', title: g.title, sub: T.projectName(g.p) + (g._f ? ', frees ' + g._f : '') + (g.stalled ? ', waiting ' + g.stalled : ''), run: function () { openItem(g.id); } }; }) };
  }
  function movedAnswer() {
    var since = new Date(G.digest_since), fresh = G.moves.filter(function (m) { return new Date(m.last) >= since; });
    var week = Date.now() - 7 * DAY, merged = G.merged.filter(function (m) { return new Date(m.date).getTime() > week; });
    if (!fresh.length) return { text: 'Nothing moved since yesterday.' + (G.moves[0] ? ' The last was ' + G.moves[0].title + ', ' + T.ago(G.moves[0].last) + '.' : '') };
    var c = 0, rs = {}; fresh.forEach(function (m) { c += m.n; m.ps.forEach(function (p) { rs[p] = 1; }); });
    fresh.sort(function (a, b) { return b.n - a.n; });
    var top = fresh[0], who = top.agents.map(function (a) { var e = E.get('a:' + a); return e ? e.name : a; });
    var text = T.plural(c, 'commit') + ' since yesterday across ' + T.plural(Object.keys(rs).length, 'repo') + '. Most of it: ' + top.title + ', by ' + T.list(who, 3) + '.';
    text += merged.length ? ' ' + T.plural(merged.length, 'merge') + ' this week.' : ' No merges this week.';
    return { text: text, rows: fresh.slice(0, 5).map(function (m) {
      var where = m.ps.length > 1 ? T.plural(m.ps.length, 'repo') : T.projectName(m.ps[0]);
      return { k: 'Moved', title: m.title, sub: where + ', ' + T.plural(m.n, 'commit') + ', ' + T.ago(m.last),
        run: function () { if (m.ps.length === 1) lens(E.get('p:' + m.ps[0])); else lens(E.get('a:' + m.agent)); } };
    }) };
  }
  function crewAnswer() {
    var last = G.agent_last || {}, ids = Object.keys(last).sort(function (a, b) { return last[b].localeCompare(last[a]); });
    if (!ids.length) return null;
    var name = function (id) { var e = E.get('a:' + id); return e ? e.name : id; };
    var day = function (d) { var t = new Date(d + 'T12:00:00'), n = new Date(); return t.toDateString() === n.toDateString() ? 'today' : T.dm(t); };
    var first = ids.filter(function (id) { return last[id] === last[ids[0]]; });
    var text = 'Most recently: ' + T.list(first.map(name), 4) + ', ' + day(last[ids[0]]) + '.';
    var rest = ids.slice(first.length, first.length + 3);
    if (rest.length) text += ' Before that: ' + rest.map(function (id) { return name(id) + ' ' + day(last[id]); }).join(', ') + '.';
    return { text: text, rows: ids.map(function (id) {
      var e = E.get('a:' + id);
      return { k: 'Agent', title: name(id), sub: 'last commit ' + day(last[id]) + (e ? ', ' + T.int(e.commits) + ' in all' : ''), run: function () { if (e) lens(e); } };
    }) };
  }
  function entityAnswer(e) {
    var d = T.describe(e.id), text = d.title + (d.kind ? ': ' + d.kind.charAt(0).toLowerCase() + d.kind.slice(1) : '') + '. ' + (d.sub ? d.sub.charAt(0).toUpperCase() + d.sub.slice(1) + '.' : '');
    var rows = d.rows.slice(0, 5).map(function (r) { return { k: r[0], title: r[1], sub: '', plain: true }; });
    rows.unshift(lensRow(e, 'Make it the lens'));
    return { text: text, rows: rows };
  }
  function commitsAnswer(q) {
    var e = null;
    q.replace(/\b(?:on|in|for|to)\s+([\w .-]+)$/, function (_, x) { e = bestEntity(x); });
    if (e && e.band === 'p') {
      var p = e.p;
      return { text: p.name + ': ' + T.int(p.commits) + ' commits since May, ' + T.plural(T.recentCommits(p.id), 'commit') + ' in the last four weeks.', rows: [lensRow(e)] };
    }
    var by = G.totals.by_agent, ids = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; });
    return { text: T.int(G.totals.commits) + ' commits since May across ' + G.projects.length + ' projects. ' +
      ids.slice(0, 3).map(function (id) { var x = E.get('a:' + id); return (x ? x.name : id) + ' ' + T.int(by[id]); }).join(', ') + '.' };
  }
  function stateAnswer() {
    var b = T.blockSamples ? T.blockSamples() : [], last = b[0];
    var text = 'I can\u2019t tell how you feel from here.';
    if (last) text += ' In the sample trace, your last block ran ' + last.min + ' minutes with ' + last.sound + ': focus ' + last.focus.toFixed(2) + ', calm ' + last.calm.toFixed(2) + '.';
    text += ' With your MW75 connected, Baseline answers this from your own signal, on this device.';
    return { text: text, rows: b.slice(0, 3).map(function (x) { return { k: 'Sample', title: x.at + ', ' + x.min + ' min, ' + x.sound, sub: 'focus ' + x.focus.toFixed(2) + ', calm ' + x.calm.toFixed(2), plain: true }; }) };
  }
  function answer(raw) {
    var q = norm(raw), m, e;
    var asking = /^(what|whats|when|whens|who|whos|how|hows|which|where|is|are|do|does|did|any|anything|tell me|show me|list|give me)\b/.test(q) || /\?\s*$/.test(raw);
    if ((m = q.match(/^(?:when is|whens|when does|when do|how long until|how long till|how many days until|how many days till|days until|days to)\s+(.+)/))) { var w = whenAnswer(m[1]); if (w) return w; }
    if ((m = q.match(/^(?:what is|whats|tell me about|about|describe|how is|hows|show me)\s+(.+)/))) {
      var rest = m[1].replace(/\s*\?$/, '');
      if (!/\b(next|due|up|moved|changed|happening|new|waiting)\b/.test(rest)) { e = bestEntity(rest); if (e) return entityAnswer(e); }
    }
    if (/^(?:catch me up(?: on)?|what happened (?:in|to|with)|bring me up to speed(?: on)?)\s+(.+)/.test(q)) { var cm = q.match(/^(?:catch me up(?: on)?|what happened (?:in|to|with)|bring me up to speed(?: on)?)\s+(.+)/); var ce = bestEntity(cm[1].replace(/\?$/, '')); if (ce && ce.band === 'p') return { text: T.catchUp(ce.p.id), rows: [lensRow(ce, 'Make it the lens')] }; }
    if (/\b(where was i|where did i leave|what was i doing|catch me up|pick (?:it |things )?back up|resume|left off|been away)\b/.test(q)) return { text: T.resumeSummary(), rows: commands().filter(function (c) { return c.title === 'Resume'; }) };
    if (/\b(how finished|how far along|how ready|release readiness|ready to ship|how close to (?:shipping|done|launch))\b/.test(q)) { var fm = q.match(/\b(?:is|are)\s+(.+?)\s*\??$/), fe = fm ? bestEntity(fm[1]) : null; if (fe && fe.band === 'p') return { text: T.releaseSummary(fe.p.id), rows: commands().filter(function (c) { return c.title === 'Releases'; }) }; return { text: 'Which project? Say “how finished is Fylz”, or open Releases for all of them.', rows: commands().filter(function (c) { return c.title === 'Releases'; }) }; }
    if ((m = q.match(/^(?:check ?in|i feel|feeling|i am|im)\s*:?\s*(.+)/)) && T.checkIn) {
      var words = m[1], mood = null, energy = null;
      T.MOOD.forEach(function (x) { if (new RegExp('\\b' + x[1] + '\\b').test(words)) mood = x[0]; });
      T.ENERGY.forEach(function (x) { if (new RegExp('\\b' + x[1] + '\\b').test(words)) energy = x[0]; });
      if (/\b(tired|exhausted|drained|wiped)\b/.test(words)) energy = energy == null ? 2 : energy;
      if (/\b(great|strong|sharp|energetic)\b/.test(words)) energy = energy == null ? 4 : energy;
      if (/\b(down|sad|heavy|low)\b/.test(words)) mood = mood == null ? -1 : mood;
      if (/\b(happy|up|good|fine|ok|okay)\b/.test(words)) mood = mood == null ? 1 : mood;
      if (mood != null || energy != null) {
        var last = T.lastCheckin(), c = T.checkIn(mood == null ? (last ? last.mood : 0) : mood, energy == null ? (last ? last.energy : 3) : energy);
        return { text: ['Noted: mood ' + T.moodWord(c.mood) + ', energy ' + T.energyWord(c.energy) + ', at ' + T.hm(c.at) + '.'].concat(T.planSummary().slice(0, 1)), rows: commands().filter(function (x) { return x.title === 'The year'; }) };
      }
      return { text: ['Say it in these words: mood ' + T.MOOD.map(function (x) { return x[1]; }).join(', ') + '; energy ' + T.ENERGY.map(function (x) { return x[1]; }).join(', ') + '. Or tap the marks under Today in the year.'], rows: commands().filter(function (x) { return x.title === 'The year'; }) };
    }
    if ((m = q.match(/^(?:log|i did|i had|just had|finished)\s+(?:a |an |my )?(fencing|archery|run|running|gym|walk|mobility)(?: class| session| practice)?(?:,? (\d+)\s*min(?:utes)?)?/)) && T.logSession) {
      var kind = { run: 'running', running: 'running' }[m[1]] || m[1], ss = T.logSession({ kind: kind });
      if (m[2]) { var tot = +m[2], base = ss.min || 1; ss.segs.forEach(function (g) { g.min = Math.round(g.min * tot / base); }); ss.min = ss.segs.reduce(function (n, g) { return n + g.min; }, 0); T.store.set('sessions', T.sessions); T.emit('activity'); }
      return { text: ['Logged ' + ss.label + ', ' + ss.min + ' min as ' + ss.segs.map(function (g) { return g.k + ' ' + g.min; }).join(', ') + '. Change the segments in Body; the plan takes a recovery slot off that day.'], rows: commands().filter(function (x) { return x.title === 'Body'; }) };
    }
    if (/\b(duplicat|redundan|repeat(s|ed|ing)? (work|itself)|overlap|same work|plan of action|efficient plan|where (does|is) work|what connects|connected ideas|audit)\b/.test(q) && T.auditSummary) return { text: T.auditSummary(), rows: commands().filter(function (x) { return x.title === 'Resume'; }) };
    if (/\b(productive|most productive|best hours|when do i work|when am i|my rhythm|rhythm|what time do i)\b/.test(q) && T.rhythm) return { text: T.rhythm().lines.concat(T.ideasSummary ? T.ideasSummary().slice(0, 1) : []), rows: [] };
    if (/\b(plan|todays plan|today's plan|sprint|what should i do|whats on today|what do i do|slots|capacity|runway|runways)\b/.test(q) && T.planSummary) return { text: T.planSummary(), rows: commands().filter(function (x) { return x.title === 'The year'; }) };
    if (/\b(body|sore|soreness|sitting|sat|stretch|break|fencing|archery|training|session|workout)\b/.test(q) && T.soreList) {
      var sore = T.soreList(), sit = T.sitting(), lines = [];
      lines.push(sore.length ? 'Sore: ' + sore.map(function (r) { return r.name.toLowerCase() + ' (' + r.word + ')'; }).join(', ') + '.' : 'Nothing marked sore.');
      if (sit) lines.push(sit.stale ? 'No movement logged today.' : 'Last moved ' + T.ago(sit.since) + ' ago' + (sit.long ? '; time to stand.' : '.'));
      T.breaksToday().slice(0, 3).forEach(function (b) { lines.push('\u2022 ' + b.title + ' \u2014 ' + b.why); });
      var last = T.sessions.slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; })[0];
      if (last) lines.push('Last session: ' + last.label + ', ' + T.dayTime(last.at) + ', ' + last.segs.map(function (g) { return g.k + ' ' + g.min; }).join(', ') + (last.sample ? ' (a sample)' : '') + '.');
      return { text: lines, rows: commands().filter(function (x) { return x.title === 'Body'; }) };
    }
    if (/\b(nudges?|reminders?|remind)\b/.test(q)) return nudgeAnswer();
    if (/\b(needs? me|need me|waiting on me|waits? on me|blocked|blocking|on me|my turn|gates?|my move)\b/.test(q)) return needsAnswer();
    if (/\b(moved|changed|happened|since yesterday|shipped|merged|merges)\b/.test(q)) return movedAnswer();
    if (asking && /\b(feel|feeling|focused|focus|calm|stress|stressed|tired|energy|mood|brain|eeg|headset|signal|baseline)\b/.test(q)) return stateAnswer();
    if (/\b(who|agents?|crew|working|busy)\b/.test(q)) { var c = crewAnswer(); if (c) return c; }
    if (/\b(next|upcoming|due|deadlines?|coming up|schedule|scheduled|sends?|posts?|going out|goes out)\b/.test(q) ||
      (/\b(today|tomorrow|this week|this month)\b/.test(q) && /^(what|whats|anything|any|is there|is anything)\b/.test(q))) return dueAnswer(q);
    if (/\bcommits?\b/.test(q)) return commitsAnswer(q);
    if (asking) return { none: true };
    return null;
  }

  // ---------------------------------------------------------------- the on-device model, where there is one
  function probeModel() {
    if (A.model !== 'unknown') return;
    A.model = 'none';
    try {
      if (typeof self.LanguageModel === 'undefined' || !self.LanguageModel.availability) return;
      self.LanguageModel.availability().then(function (s) { A.model = s === 'available' ? 'ready' : 'none'; paintFoot(); }, function () { A.model = 'none'; });
    } catch (err) { A.model = 'none'; }
  }
  function brief() {
    var now = Date.now(), lines = ['Today is ' + new Date().toString().slice(0, 21) + '.'];
    lines.push('Coming up: ' + SEED.schedule.filter(function (s) { return new Date(s.at).getTime() > now; }).sort(byAt).slice(0, 8)
      .map(function (s) { return s.title + ' (' + T.dm(s.at) + (s.hard ? ', fixed' : '') + ')'; }).join('; ') + '.');
    lines.push('Waiting on the user: ' + gatesOnYou().slice(0, 6).map(function (g) { return g.title; }).join('; ') + '.');
    lines.push('Busiest projects in the last four weeks: ' + G.projects.slice().sort(function (a, b) { return T.recentCommits(b.id) - T.recentCommits(a.id); }).slice(0, 6)
      .map(function (p) { return p.name + ' ' + T.recentCommits(p.id); }).join(', ') + '.');
    lines.push('Notes: ' + T.notes.slice(0, 10).map(function (n) { return n.text; }).join(' | '));
    return lines.join('\n');
  }
  function askModel(q) {
    paintAnswer({ text: 'Thinking, on this device…', thinking: true });
    var go = A.session ? Promise.resolve(A.session) : self.LanguageModel.create({ initialPrompts: [{ role: 'system',
      content: 'You answer questions about one person\'s work in at most three short sentences, plainly, from the facts given. If the facts do not say, say so.\n' + brief() }] });
    go.then(function (s) { A.session = s; return s.prompt(q); }).then(function (r) {
      paintAnswer({ text: String(r).trim(), rows: [], from: 'From the on-device model' });
    }, function () { paintAnswer({ text: 'The on-device model could not answer just now.', rows: [noteRow(q, false)] }); });
  }

  // ---------------------------------------------------------------- a model you attached (Settings → Data → Models)
  var SYSTEM = 'You answer questions about one person\'s own work, plainly, in at most four short sentences, using only the facts given. Name where a fact came from in brackets, for instance [Task] or [Note]. If the facts do not say, say so. Never invent a date, a name or a number.';
  function factsFor(q) {
    var res = results(q), lines = [];
    (res.rows || []).filter(function (r) { return r.k !== 'Ask' && r.k !== 'Command'; }).slice(0, 8).forEach(function (r) { lines.push('- [' + r.k + '] ' + r.title + (r.sub ? ' — ' + r.sub : '')); });
    if (T.search) T.search(q, 6).forEach(function (h) { var l = '- [' + h.kind + '] ' + h.text.slice(0, 220); if (lines.indexOf(l) < 0) lines.push(l); });
    return lines.join('\n') + '\n\nThe state of the workspace:\n' + brief();
  }
  function modelName(id) { return T.llm.list().filter(function (p) { return p.id === id; })[0]; }
  function askLLM(id, q) {
    if (!q || !T.llm.ready(id)) return;
    var p = modelName(id), user = 'Question: ' + q + '\n\nFacts from the person\'s own workspace:\n' + factsFor(q), pv = T.llm.preview(id, SYSTEM, user);
    function send() {
      paintAnswer({ text: (p.watched ? 'Asking ' + p.name + '…' : 'Thinking, on your own server…'), thinking: true });
      T.llm.chat(id, SYSTEM, user).then(function (r) {
        var u = r.usage; paintAnswer({ text: r.text || 'It answered with nothing.', rows: [noteRow(q, false)], from: p.name + ' (' + (r.model || T.llm.cfg(id).model) + ')' + (p.watched ? ', a watched object' : ', your own server') + ' — sent ' + T.int(pv.chars) + ' characters, ' + T.int(u.in + u.cr) + ' tokens in, ' + T.int(u.out) + ' out; counted in Usage' });
      }, function (e) { paintAnswer({ text: e.message, rows: [noteRow(q, false)] }); });
    }
    if (!p.watched || !T.llm.confirm()) { send(); return; }
    T.clear(ans); ans.hidden = false;
    ans.appendChild(el('p', { class: 'ask-a' }, 'This leaves the device, to ' + p.name + ' — a watched object. Exactly this is sent, and no key appears in it.'));
    ans.appendChild(el('pre', { class: 'ask-pv' }, pv.text));
    ans.appendChild(el('div', { class: 'ask-ch' }, el('button', { class: 'chip', type: 'button', on: { click: send } }, 'Send to ' + p.name), el('button', { class: 'chip', type: 'button', on: { click: function () { update(); } } }, 'Keep it here')));
  }
  function modelChips(q) {
    var ids = T.llm.configured(); if (!ids.length) return null;
    var w = el('div', { class: 'ask-ch' });
    ids.forEach(function (id) { var p = modelName(id); w.appendChild(el('button', { class: 'chip', type: 'button', title: p.watched ? 'A watched object: you will see what is sent first' : 'Your own server', on: { click: function () { askLLM(id, input.value.trim()); } } }, 'Ask ' + p.name + (p.watched ? ' ↗' : ''))); });
    return w;
  }

  // ---------------------------------------------------------------- results
  function results(raw) {
    var q = raw.trim(), lq = norm(q), rows = [], m;
    if (!q) return { rows: suggestions() };
    // things you said to do
    if ((m = q.match(/^(?:note|idea|remember|jot|thought)\s*[:,\-]?\s+([\s\S]+)/i)) || (m = q.match(/^\+\s*([\s\S]+)/))) rows.push(noteRow(m[1], true));
    if ((m = q.match(/^(?:task|todo|to do|add task|add a task|new task)\s*[:,\-]?\s+([\s\S]+)/i))) rows.push(taskRow(m[1]));
    if ((m = q.match(/^(?:move|mark|set|put)\s+(.+?)\s+(?:to|as|in|into)\s+(backlog|ready|doing|in progress|progress|started|review|in review|done|finished|complete|completed)\.?$/i))) { var mv = moveRow(m[1], m[2]); if (mv) rows.push(mv); }
    if ((m = q.match(/^(?:lens|lens on|only|filter|filter to|focus on|zoom to)\s+(.+)/i))) { var le = bestEntity(m[1]); if (le) { var lr = lensRow(le, 'Make it the lens'); lr.strong = true; rows.push(lr); } }
    if (/^(?:start\s+|begin\s+)?(?:a\s+)?(?:focus|deep work)(?:\s+block)?(?:\s+\d+\s*(?:m|min|minutes)?)?$/i.test(q)) rows.push(commands().filter(function (c) { return /focus block/.test(c.title); })[0]);
    if (/^(?:lean\s*back|sky|night|calm|ambient|stars?)$/i.test(q) && !(T.isLeanBack && T.isLeanBack())) rows.push(commands()[0]);
    if (/^(?:lean\s*in|cockpit|back)$/i.test(q) && T.isLeanBack && T.isLeanBack()) rows.push(commands()[0]);
    // an answer, if it was a question
    var a = answer(q);
    // everything that matches
    var pool = [];
    entities().forEach(function (e) { var s = score(lq, e.name); if (s) pool.push({ s: s * (e.band === 'p' ? 1.08 : e.band === 'c' ? 1.04 : 0.95), r: lensRow(e) }); });
    T.tasks.forEach(function (t) { var s = score(lq, t.title); if (s) pool.push({ s: s * (t.status === 'done' ? 0.8 : 1), r: { k: t.kind === 'gate' ? 'Gate' : 'Task', title: t.title, sub: T.projectName(t.p) + ', ' + statusName(t.status), run: function () { openItem(t.id); } } }); });
    SEED.schedule.forEach(function (s0) { var s = score(lq, s0.title); if (s) pool.push({ s: s * (new Date(s0.at) < new Date() ? 0.7 : 1.05), r: datedRow(s0) }); });
    T.notes.forEach(function (n) { var s = score(lq, n.text + ' ' + (n.tag || '')); if (s) pool.push({ s: s * 0.95, r: { k: 'Note', title: n.text, sub: (n.tag || 'idea') + (n.att ? ', on ' + T.projectName(n.att) : '') + (n.at ? ', ' + T.dm(n.at) : ''), run: function () { showNote(n); } } }); });
    [['canopy', 'Canopy'], ['today', 'Today'], ['board', 'Board'], ['crew', 'Crew'], ['time', 'Time'], ['chains', 'Chains']].forEach(function (v) { var s = score(lq, v[1]); if (s) pool.push({ s: s * 1.15, r: viewRow(v[0], v[1]) }); });
    commands().forEach(function (c) { var s = Math.max(score(lq, c.title), score(lq, c.sub) * 0.6); if (s) pool.push({ s: s * 1.1, r: c }); });
    pool = pool.filter(function (x) { return x.s >= 20; });
    pool.sort(function (x, y) { return y.s - x.s; });
    var seen = {};
    rows.forEach(function (r) { seen[r.k + '|' + r.title] = 1; });
    pool.forEach(function (x) { var key = x.r.k + '|' + x.r.title; if (!seen[key] && rows.length < 9) { seen[key] = 1; rows.push(x.r); } });
    if (/^(?:desk|the desk|board|hide windows|clear (?:the )?(?:windows|screen)|show (?:the )?(?:desk|board|notes))$/i.test(q)) rows.push({ k: 'Command', title: T.deskOpen() ? 'Bring the windows back' : 'Hide the windows, show the desk', sub: 'H', strong: true, run: function () { T.desk(); } });
    var pm = q.match(/^(?:pin|pin to desk|pin to board)\s*[:,\-]?\s+([\s\S]+)/i); if (pm) rows.push({ k: 'Note', title: pm[1].trim(), sub: 'Keep as a note, pinned to the desk', strong: true, run: function () { var tt = T.toast; T.toast = function () {}; var n = T.addNote(pm[1].trim(), null, true); T.toast = tt; T.pinToDesk(n); T.toast('Pinned. Press H to see the desk.'); } });
    var hm = q.match(/^(?:hand ?off|send to fonebrew|to fonebrew|fonebrew)\s*[:,\-]?\s+(.+)/i); if (hm && T.search) T.search(hm[1], 4, ['Task']).forEach(function (h) { rows.push({ k: 'Hand off', title: h.title, sub: 'Save the task with its notes and files for Fonebrew, and copy the prompt', strong: true, run: function () { T.handoffSave(h.id); } }); });
    // an idea you have had before, and anything else the index knows
    if (T.similarNotes && q.length >= 12 && !/^(?:note|idea|remember|jot|thought|task|todo|move|mark|set|put|lens|only|focus)\b/i.test(q)) T.similarNotes(q.replace(/^\+\s*/, ''), 2).forEach(function (h) { rows.push({ k: 'Before', title: (h.note ? h.note.text : h.text).slice(0, 110), sub: (h.same ? 'You wrote this' : 'Close to this') + (h.at ? ', ' + h.at : '') + (h.note ? ' — add it as a line there' : ''), strong: h.same, run: h.note ? function () { T.foldNote(h.id, q.replace(/^\+\s*/, '')); } : function () { T.toast(h.text); } }); });
    if (T.search && q.length >= 3) T.search(q, 8).filter(function (h) { return ['Session', 'File', 'Vault', 'Commit', 'Note'].indexOf(h.kind) >= 0; }).slice(0, 4).forEach(function (h) { var key = h.kind + '|' + h.text.slice(0, 40); if (!seen[key] && rows.length < 9) { seen[key] = 1; rows.push({ k: h.kind, title: (h.title || h.text).slice(0, 100), sub: (h.at || '') + (h.kind === 'Commit' || h.kind === 'Session' || h.kind === 'File' ? '' : ''), run: function () { T.toast(h.text.slice(0, 280)); } }); } });
    // anything at all can be kept
    if (!rows.some(function (r) { return r.k === 'Note' && r.strong; }) && !(a && a.text && !a.none) && q.length > 2) rows.push(noteRow(q, false));
    return { rows: rows, answer: a };
  }
  function suggestions() {
    var s = [['What is next?', 'Dates, in order'], ['What needs me?', 'Gates that wait on you'], ['What moved since yesterday?', 'Commits and merges'], ['Who is working?', 'The crew, most recent first']];
    var out = s.map(function (x) { return { k: 'Ask', title: x[0], sub: x[1], run: function () { input.value = x[0]; update(); } }; });
    return out.concat(commands().slice(0, 2));
  }

  // ---------------------------------------------------------------- the panel
  function paintAnswer(a) {
    T.clear(ans);
    ans.hidden = !a;
    if (!a) return;
    if (a.none) {
      ans.appendChild(el('p', { class: 'ask-a' }, 'I can’t answer that from what this page knows.'));
      var mc = modelChips(input.value.trim());
      if (A.model === 'ready') ans.appendChild(el('button', { class: 'chip', on: { click: function () { askModel(input.value.trim()); } } }, 'Ask the on-device model'));
      if (mc) ans.appendChild(mc);
      if (!mc && A.model !== 'ready') ans.appendChild(el('p', { class: 'ask-s' }, 'Attach a model — Llama on your own server, or Claude, ChatGPT, DeepSeek or Grok with your own key — under Settings → Models, and a question like this goes to it, from your own notes and tasks.'));
      return;
    }
    ans.appendChild(el('p', { class: 'ask-a' + (a.thinking ? ' wait' : '') + (Array.isArray(a.text) ? ' lines' : '') }, Array.isArray(a.text) ? a.text.join('\n') : a.text));
    if (!a.thinking && T.voice) T.voice.speak(Array.isArray(a.text) ? a.text.join(' ') : a.text);
    if (a.from) ans.appendChild(el('p', { class: 'ask-s' }, a.from));
    else if (!a.thinking) { var mc2 = modelChips(input.value.trim()); if (mc2 && input.value.trim().length > 3) ans.appendChild(mc2); }
  }
  function paintRows(rows, answerRows) {
    T.clear(list);
    A.rows = (answerRows || []).concat(rows).filter(Boolean);
    A.sel = Math.min(A.sel, Math.max(0, A.rows.length - 1));
    var firstRun = A.rows.findIndex(function (r) { return !!r.run; });
    if (A.sel < firstRun) A.sel = Math.max(0, firstRun);
    A.rows.forEach(function (r, i) {
      var li = el('li', { role: 'option', id: 'askO' + i, 'aria-selected': String(i === A.sel), class: 'ask-r' + (r.plain ? ' plain' : '') + (r.strong ? ' strong' : '') + (i === (answerRows || []).length && i ? ' gap' : ''),
        on: { click: function () { run(i); }, pointermove: function () { if (A.sel !== i && r.run) { A.sel = i; mark(); } } } },
        el('span', { class: 'ask-k' }, r.k), el('span', { class: 'ask-t' }, el('span', { class: 'ask-tt' }, r.title), r.sub ? el('span', { class: 'ask-ts' }, r.sub) : null));
      list.appendChild(li);
    });
    mark();
  }
  var lastSel = -1;
  function mark() {
    if (A.sel !== lastSel) { if (lastSel >= 0 && T.sfx) T.sfx('move'); lastSel = A.sel; }
    T.$$('#askList .ask-r').forEach(function (li, i) { li.setAttribute('aria-selected', String(i === A.sel)); });
    input.setAttribute('aria-activedescendant', A.rows.length ? 'askO' + A.sel : '');
    var cur = T.$('#askO' + A.sel);
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }
  function update() {
    var r = results(input.value);
    A.sel = 0;
    paintAnswer(r.answer && !r.answer.thinking ? r.answer : null);
    paintRows(r.rows, r.answer && r.answer.rows);
  }
  function run(i) {
    var r = A.rows[i];
    if (!r || !r.run) return;
    if (T.sfx) T.sfx('select');
    close();
    r.run();
  }
  function paintFoot() {
    if (!foot) return;
    foot.textContent = A.model === 'ready' ? 'Answers come from your data on this device. The on-device model is ready for anything else.'
      : 'Answers come from your data, on this device. Say note, task, move, lens, focus, or just ask.';
  }

  // ---------------------------------------------------------------- voice
  function listen() {
    var R = self.SpeechRecognition || self.webkitSpeechRecognition;
    if (!R) { paintAnswer({ text: 'Voice is not available in this browser. In the app, Orrery uses the device’s own speech recognition.' }); return; }
    if (A.listening) { try { A.rec.stop(); } catch (e) { /* already stopped */ } return; }
    var rec = A.rec = new R();
    rec.lang = navigator.language || 'en-GB'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    rec.onstart = function () { A.listening = true; box.classList.add('listening'); mic.setAttribute('aria-pressed', 'true'); input.placeholder = 'Listening…'; };
    rec.onresult = function (ev) {
      var t = '';
      for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
      input.value = t; update();
    };
    rec.onerror = function (ev) {
      var why = ev.error === 'not-allowed' || ev.error === 'service-not-allowed' ? 'The microphone is not allowed here. Opened in its own tab, or in the app, Orrery can listen.'
        : ev.error === 'no-speech' ? 'I didn’t hear anything.' : 'Voice stopped: ' + ev.error + '.';
      paintAnswer({ text: why });
    };
    rec.onend = function () { A.listening = false; box.classList.remove('listening'); mic.setAttribute('aria-pressed', 'false'); input.placeholder = 'Ask, find, or note anything'; input.focus(); };
    try { rec.start(); } catch (e) { paintAnswer({ text: 'Voice could not start here.' }); }
  }

  // ---------------------------------------------------------------- open and close
  function open(prefill) {
    if (!box) return;
    if (T.closePop) T.closePop();
    if (T.closeNoteUi) T.closeNoteUi();
    probeModel();
    A.open = true;
    box.hidden = false;
    document.documentElement.classList.add('asking');
    input.value = prefill || '';
    paintFoot();
    update();
    setTimeout(function () { input.focus(); if (prefill) input.setSelectionRange(prefill.length, prefill.length); }, 20);
  }
  function close() {
    if (!A.open) return;
    A.open = false;
    box.hidden = true;
    document.documentElement.classList.remove('asking');
    if (A.listening && A.rec) { try { A.rec.stop(); } catch (e) { /* stopped */ } }
    input.blur();
  }
  T.openAsk = open;
  T.closeAsk = close;
  T.askOpen = function () { return A.open; };

  T.initAsk = function () {
    box = T.$('#ask'); input = T.$('#askIn'); list = T.$('#askList'); ans = T.$('#askAns'); foot = T.$('#askFoot'); mic = T.$('#askMic');
    input.addEventListener('input', update);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        var d = ev.key === 'ArrowDown' ? 1 : -1, n = A.rows.length, i = A.sel;
        for (var k = 0; k < n; k++) { i = (i + d + n) % n; if (A.rows[i].run) break; }
        A.sel = i; mark();
      } else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && T.llm && T.llm.def()) {
        ev.preventDefault(); askLLM(T.llm.def(), input.value.trim());
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        var a = results(input.value).answer;
        if (a && a.none && A.model === 'ready' && !A.rows.some(function (r) { return r.strong; })) { askModel(input.value.trim()); return; }
        run(A.sel);
      } else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); }
    });
    mic.addEventListener('click', listen);
    box.addEventListener('pointerdown', function (ev) { if (ev.target === box) close(); });
  };
})();
