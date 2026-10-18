/* plan: a rolling sprint of three days over the open work, and the runway to each dated thing.
   Capacity is counted in slots, one block of attention, fifty minutes unless you say otherwise. A weekday's slots
   are read from your own commit record and can be overruled in Settings; today's bend with your latest check-in;
   and the whole plan is scaled by what you finished against what was planned over the last two weeks. Items are
   placed earliest deadline first, after whatever blocks them, never beyond a day's slots, so each dated thing gets a
   runway of days that either reaches it or runs past it. A task moved, a check-in, a session logged: each replans.
   Your day does not start at midnight: it starts after your quietest hours, which the record puts around nine. */
(function () {
  'use strict';
  var T = window.T, G = T.G, S = T.S, SEED = T.SEED, el = T.el;
  var DAY = 864e5, H = 16 * 7;
  function dkey(d) { d = new Date(d); return d.getFullYear() + '-' + T.pad(d.getMonth() + 1) + '-' + T.pad(d.getDate()); }
  function fromKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(k, n) { var d = fromKey(k); return dkey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); }
  function sum(a) { var n = 0; for (var i = 0; i < a.length; i++) n += a[i] || 0; return n; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ---------------------------------------------------------------- routine: how much attention a day has
  var WDN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  T.WDN = WDN;
  function derivedCap() {
    var w = (G.wdays && G.wdays.you) || [], tot = sum(w);
    if (!tot) return [2, 2, 2, 2, 2, 1, 1];
    var mean = tot / 7;
    return w.map(function (n) { return n > mean * 1.5 ? 3 : n < mean * 0.5 ? 1 : 2; });
  }
  // the day starts where your quietest three hours between 03:00 and 11:00 end
  function derivedStart() {
    var h = G.hours_ist || [], best = 9, bn = 1e9;
    for (var s = 3; s <= 9; s++) { var n = (h[s] || 0) + (h[s + 1] || 0) + (h[s + 2] || 0); if (n < bn) { bn = n; best = s + 3; } }
    return best;
  }
  // the nine hours that hold most of your commits, allowed to wrap past midnight
  function derivedWindow() {
    var h = G.hours_ist || [], best = 20, bn = -1;
    for (var s = 0; s < 24; s++) { var n = 0; for (var i = 0; i < 9; i++) n += h[(s + i) % 24] || 0; if (n > bn) { bn = n; best = s; } }
    return [best, (best + 9) % 24];
  }
  var DEF = { slotMin: 50, cap: derivedCap(), dayStart: derivedStart(), window: derivedWindow(), fixed: [], capSource: 'commits' };
  var savedR = T.store.get('routine', null) || {};
  var R = T.routine = {};
  Object.keys(DEF).forEach(function (k) { R[k] = savedR[k] != null ? savedR[k] : DEF[k]; });
  T.routineDefault = function (k) { return DEF[k]; };
  T.setRoutine = function (patch) {
    Object.keys(patch).forEach(function (k) { R[k] = patch[k]; savedR[k] = patch[k]; });
    if (patch.cap) { R.capSource = 'you'; savedR.capSource = 'you'; }
    T.store.set('routine', savedR);
    invalidate(); T.emit('routine');
  };
  T.resetRoutine = function () { savedR = {}; T.store.del('routine'); Object.keys(DEF).forEach(function (k) { R[k] = DEF[k]; }); invalidate(); T.emit('routine'); };
  // the planner's day for a moment: anything before the day starts belongs to the day before
  T.planDay = function (d) { d = new Date(d || Date.now()); return dkey(new Date(d.getTime() - R.dayStart * 36e5)); };

  // ---------------------------------------------------------------- what was planned and what got done, per day
  var planlog = T.store.get('planlog', {}), donelog = T.store.get('donelog', {});
  T.logDone = function (id) {
    var t = T.taskById(id); if (!t) return;
    var k = T.planDay(), size = t.agent === 'you' ? sizeOf(t) : 0.5;
    donelog[k] = (donelog[k] || 0) + size;
    T.store.set('donelog', donelog);
  };
  T.velocity = function () {
    var today = T.planDay(), keys = Object.keys(planlog).filter(function (k) { return k < today && k >= addDays(today, -14) && planlog[k] > 0; }).sort();
    var planned = 0, done = 0;
    keys.forEach(function (k) { planned += planlog[k]; done += donelog[k] || 0; });
    var scale = keys.length >= 3 && planned > 0 ? clamp(done / planned, 0.5, 1.25) : 1;
    return { scale: scale, days: keys.length, planned: planned, done: done,
      basis: keys.length >= 3 ? 'the last ' + keys.length + ' planned days finished ' + done + ' of ' + planned + ' slots' : keys.length ? 'only ' + T.plural(keys.length, 'planned day') + ' on record; three are needed before the plan scales itself' : 'no planned days on record yet; the plan runs at your stated capacity' };
  };

  // ---------------------------------------------------------------- teams and sprints: the organisation's shape, when there is one
  // A team is a file in the workspace (teams/<id>.md: name, members, projects); a sprint is another (sprints/<id>.md: name,
  // from, to, team). With neither, a project's group stands in for its team and the publishing sprint is the one sprint.
  var TEAMS = SEED.teams || [], SPRINTS = SEED.sprints || (SEED.sprint ? [{ id: 'sprint-1', name: SEED.sprint.label.split(',')[0], from: SEED.sprint.from, to: SEED.sprint.to }] : []);
  T.TEAMS = TEAMS; T.SPRINTS = SPRINTS;
  T.teamOf = function (pid) { for (var i = 0; i < TEAMS.length; i++) if ((TEAMS[i].projects || []).indexOf(pid) >= 0) return TEAMS[i].id; var p = T.P.get(pid); return p ? 'c:' + p.cluster : 'none'; };
  T.teamName = function (id) { for (var i = 0; i < TEAMS.length; i++) if (TEAMS[i].id === id) return TEAMS[i].name; if (id && id.indexOf('c:') === 0) return (T.clusterName[id.slice(2)] || id.slice(2)) + ' (group, no team file)'; return 'No team'; };
  T.sprintOf = function (at) { var k = T.planDay(at); for (var i = 0; i < SPRINTS.length; i++) if (k >= SPRINTS[i].from && k <= SPRINTS[i].to) return SPRINTS[i].id; return k < (SPRINTS[0] ? SPRINTS[0].from : '9999') ? 'before' : 'beyond'; };
  T.sprintName = function (id) { for (var i = 0; i < SPRINTS.length; i++) if (SPRINTS[i].id === id) return SPRINTS[i].name + ', ' + T.dm(fromKey(SPRINTS[i].from)) + ' to ' + T.dm(fromKey(SPRINTS[i].to)); return id === 'before' ? 'Before the sprint' : 'Beyond the sprint'; };

  // ---------------------------------------------------------------- items: everything that wants a slot of yours
  function sizeOf(t) {
    if (t.size) return t.size;
    var m = /(\d[\d,]*)\s*words/i.exec(t.title || '');
    if (m) { var w = +m[1].replace(/,/g, ''); return w >= 3000 ? 4 : w >= 1500 ? 3 : w >= 400 ? 2 : 1; }
    if (/full draft|write-up|explorable|pictorial|poster|skeleton|v1\b/i.test(t.title || '')) return 3;
    if (/smoke pass|device pass|verify|redraw|review the/i.test(t.title || '')) return 2;
    return 1;
  }
  T.sizeOf = sizeOf;
  var KIND = T.PLAN_KIND = { task: 'your work', gate: 'a gate only you can clear', brief: 'brief an agent', review: 'review what came back', send: 'send on the day', post: 'post', fixed: 'in the routine', session: 'training', break: 'a break', done: 'done' };
  function items() {
    var out = [];
    T.tasks.forEach(function (t) {
      if (t.status === 'done') return;
      var mine = t.agent === 'you', kind, size;
      if (t.kind === 'gate') { kind = 'gate'; size = 0.5; }
      else if (mine) { kind = 'task'; size = sizeOf(t); if (t.status === 'doing') size = Math.max(0.5, Math.round(size)); if (t.status === 'review') size = 0.5; }
      else if (t.status === 'review') { kind = 'review'; size = 0.5; }
      else if (t.status === 'doing') return;        // an agent has it; nothing from you until it comes back
      else { kind = 'brief'; size = 0.5; }
      out.push({ id: t.id, t: t, title: t.title, p: t.p, kind: kind, size: size, by: (t.by || []).slice(), status: t.status, mine: mine });
    });
    SEED.schedule.forEach(function (s) {
      if (T.isDone(s.id) || new Date(s.at).getTime() < Date.now() - DAY) return;
      (s.send || []).forEach(function (x, i) {
        if (x[1]) return;      // tied to a task, which carries it
        out.push({ id: 'send:' + s.id + ':' + i, title: x[0], p: s.p, kind: 'send', size: 0.5, by: [], due: s.at, sched: s, onDay: true });
      });
    });
    return out;
  }
  // the earliest dated thing downstream of a node, by the by-edges
  function deadlines(its) {
    var byId = {}; its.forEach(function (it) { byId[it.id] = it; });
    var memo = {};
    var all = T.tasks.concat(SEED.schedule);
    function dl(id, seen) {
      if (memo[id] !== undefined) return memo[id];
      seen = seen || {}; if (seen[id]) return null; seen[id] = 1;
      var best = null;
      all.forEach(function (n) {
        if ((n.by || []).indexOf(id) < 0) return;
        var d = n.at && !T.taskById(n.id) ? { at: n.at, id: n.id } : dl(n.id, seen);
        if (d && (!best || d.at < best.at)) best = d;
      });
      memo[id] = best;
      return best;
    }
    its.forEach(function (it) { if (it.due) { it.dueId = it.sched.id; return; } var d = dl(it.id); it.due = d ? d.at : null; it.dueId = d ? d.id : null; });
  }

  // ---------------------------------------------------------------- capacity, day by day
  function fixedOn(k) {
    var wd = (fromKey(k).getDay() + 6) % 7;
    return (R.fixed || []).filter(function (f) { return f.day ? f.day === k : f.wd === wd; });
  }
  function capacity(k, i, vel, today) {
    var wd = (fromKey(k).getDay() + 6) % 7, base = R.cap[wd] || 0, notes = [];
    var cap = base * vel.scale;
    if (vel.scale !== 1) notes.push('×' + vel.scale.toFixed(2) + ', ' + vel.basis);
    if (k === today) {
      var ck = T.lastCheckin(dkey(new Date()));
      if (ck) { var m = T.energyMult(ck.energy); if (m !== 1) { cap *= m; notes.push('energy ' + T.energyWord(ck.energy) + ', ×' + m); } }
    }
    fixedOn(k).forEach(function (f) { var slots = Math.round((f.to - f.from) * 60 / R.slotMin * 2) / 2; if (slots > 0) { cap -= slots; notes.push(f.label + ' takes ' + slots); } });
    (T.sessionsOn ? T.sessionsOn(k) : []).forEach(function (s) { if (s.hard >= 30 && k >= today) { cap -= 1; notes.push('recovery after ' + s.kind + ', −1'); } });
    cap = Math.max(0, Math.round(cap * 2) / 2);
    return { k: k, i: i, wd: wd, base: base, cap: cap, used: 0, items: [], notes: notes };
  }

  // ---------------------------------------------------------------- placement
  var cache = null;
  function invalidate() { cache = null; }
  T.plan = function () {
    if (cache && cache.today === T.planDay() && Date.now() - cache.at < 60000) return cache;
    var today = T.planDay(), vel = T.velocity(), days = [], idx = {};
    for (var i = 0; i < H; i++) { var k = addDays(today, i); days.push(capacity(k, i, vel, today)); idx[k] = i; }
    var its = items(); deadlines(its);
    var byId = {}; its.forEach(function (it) { byId[it.id] = it; });
    var ck = T.lastCheckin(dkey(new Date())), lowMood = ck && ck.mood <= -1;
    function rank(it) { return it.kind === 'send' ? 0 : it.status === 'doing' ? 1 : it.status === 'review' ? 2 : it.status === 'ready' ? 3 : 4; }
    its.forEach(function (it) { it.frees = T.frees(it.id); });
    its.sort(function (a, b) {
      var da = a.due || '9999', db = b.due || '9999';
      if (da.slice(0, 10) !== db.slice(0, 10)) return da < db ? -1 : 1;
      if (lowMood && a.size !== b.size) return a.size - b.size;             // a low day: the short wins first
      return rank(a) - rank(b) || b.frees - a.frees || a.size - b.size;
    });
    function dayIndexOf(at) { var k = T.planDay(at); return idx[k] != null ? idx[k] : (k < today ? 0 : H - 1); }
    var placed = {};
    function place(it, depth) {
      if (placed[it.id]) return placed[it.id];
      placed[it.id] = it; it.parts = [];
      var earliest = 0;
      it.by.forEach(function (b) {
        if (T.isDone(b)) return;
        var bi = byId[b];
        if (bi) { if (depth < 40) place(bi, depth + 1); if (bi.end != null) earliest = Math.max(earliest, bi.size >= 1 ? bi.end + 1 : bi.end); if (bi.unplaced) it.heldBy = (it.heldBy || []).concat([b]); }
        else {
          var n = T.node(b);
          if (!n) return;
          if (n.at && !T.taskById(b)) earliest = Math.max(earliest, dayIndexOf(n.at));               // a dated thing: not before its day
          else { earliest = Math.max(earliest, 1); it.waits = (it.waits || []).concat([n.agent ? T.E.get('a:' + n.agent).name : 'someone']); }   // an agent has it: tomorrow at the earliest
        }
      });
      var left = it.size, i2 = earliest;
      if (it.onDay) {
        i2 = clamp(dayIndexOf(it.due), 0, H - 1);
        days[i2].items.push({ it: it, slots: it.size }); days[i2].used += it.size; it.parts.push([i2, it.size]);
        it.start = it.end = i2; left = 0;
      }
      while (left > 0 && i2 < H) {
        var d = days[i2], free = d.cap - d.used;
        if (free > 0) { var take = Math.min(free, left); d.items.push({ it: it, slots: take }); d.used += take; it.parts.push([i2, take]); if (it.start == null) it.start = i2; it.end = i2; left -= take; }
        i2++;
      }
      if (left > 0) { it.unplaced = left; }
      if (it.due) { var di = dayIndexOf(it.due); it.dueIdx = di; it.late = it.end != null && it.end > di ? it.end - di : (it.unplaced ? H - di : 0); }
      return it;
    }
    its.forEach(function (it) { place(it, 0); });
    // the runway to each dated thing ahead
    var runways = [];
    SEED.schedule.forEach(function (s) {
      var t = new Date(s.at).getTime(); if (t < Date.now() - DAY || T.isDone(s.id)) return;
      var up = T.upstream(s.id).map(function (id) { return byId[id]; }).filter(Boolean);
      its.forEach(function (it) { if (it.sched === s) up.push(it); });
      var seen = {}; up = up.filter(function (it) { if (seen[it.id]) return false; seen[it.id] = 1; return true; });
      var allUp = T.upstream(s.id), doneUp = allUp.filter(function (id) { return T.isDone(id); }).length;
      var di = dayIndexOf(s.at), start = null, end = null, slots = 0, late = 0, unplaced = 0;
      up.forEach(function (it) { slots += it.size; if (it.start != null) { start = start == null ? it.start : Math.min(start, it.start); end = end == null ? it.end : Math.max(end, it.end); } if (it.unplaced) unplaced += it.unplaced; });
      if (end != null && end > di) late = end - di;
      if (unplaced) late = Math.max(late, H - di);
      runways.push({ s: s, id: s.id, at: s.at, dueIdx: di, items: up, start: start, end: end, slots: slots, late: late, unplaced: unplaced, fits: !late && !unplaced, doneUp: doneUp, allUp: allUp.length, gates: T.openGates(s.id).length });
    });
    runways.sort(function (a, b) { return new Date(a.at) - new Date(b.at); });
    // write today's planned slots down once, so velocity has something to compare against later
    if (planlog[today] == null) { planlog[today] = days[0].used; T.store.set('planlog', planlog); }
    cache = { today: today, at: Date.now(), days: days, items: its, byId: byId, runways: runways, vel: vel, idx: idx, lowMood: !!lowMood, checkin: ck };
    return cache;
  };
  T.planInvalidate = invalidate;
  ['tasks', 'checkin', 'routine', 'activity', 'body', 'notes'].forEach(function (ev) { T.on(ev, function () { invalidate(); T.emit('plan'); }); });

  // ---------------------------------------------------------------- what a day holds, beyond its slots
  // the steady posts, routine events, logged sessions and suggested breaks sit in the day too, as marks, not slots
  T.dayExtras = function (k, i) {
    var out = [], d = fromKey(k), pu = SEED.pulse;
    if (pu && k >= pu.from && k <= pu.to && pu.days.indexOf(d.getDay()) >= 0 && pu.off.indexOf(k) < 0) out.push({ kind: 'post', title: 'LinkedIn post', at: T.pad(pu.hourIst) + ':00', p: 'chakravyuha' });
    fixedOn(k).forEach(function (f) { out.push({ kind: 'fixed', title: f.label, at: T.pad(f.from) + ':00–' + T.pad(f.to) + ':00' }); });
    (T.sessionsOn ? T.sessionsOn(k) : []).forEach(function (s) { out.push({ kind: 'session', title: s.label, at: s.at ? T.hm(s.at) : '', session: s }); });
    if (i === 0 && T.breaksToday) T.breaksToday().forEach(function (b) { out.push({ kind: 'break', title: b.title, at: b.when, brk: b }); });
    return out;
  };

  // ---------------------------------------------------------------- one day, drawn as a column
  var MARK = {
    gate: '<path d="M0-5.2L5.2 0 0 5.2-5.2 0z" fill="rgb(165,147,255)"/>',
    send: '<rect x="-4" y="-4" width="8" height="8" fill="none" stroke="rgb(236,232,228)"/>',
    post: '<circle r="2" fill="rgb(236,232,228)" fill-opacity=".7"/>',
    fixed: '<rect x="-4.5" y="-2.2" width="9" height="4.4" fill="none" stroke="rgba(236,232,228,.7)"/>',
    session: '<path d="M-5 3L0-4 5 3z" fill="none" stroke="rgb(236,232,228)" stroke-width="1.2"/>',
    break: '<path d="M-5 0h10M0-5v10" stroke="rgba(236,232,228,.75)" stroke-width="1.2"/>',
    done: '<path d="M-4.5 0.5l3 3 6-7" fill="none" stroke="rgb(199,239,158)" stroke-width="1.5"/>'
  };
  // your work is a cell; an agent's is a cell in their colour, hollow while it waits for your brief
  function cellFor(kind, seed) {
    if (kind === 'task') return T.cellMark(seed, { r: 4.8, fill: 'rgb(236,232,228)' });
    if (kind === 'brief') return T.cellMark(seed, { r: 4.6, stroke: 'rgb(53,224,255)', width: 1.3 });
    if (kind === 'review') return T.cellMark(seed, { r: 4.8, fill: 'rgba(53,224,255,.85)' });
    return null;
  }
  T.planMark = function (kind, seed) { return '<svg viewBox="-7 -7 14 14" aria-hidden="true">' + (MARK[kind] || cellFor(kind, seed || kind) || cellFor('task', seed || kind)) + '</svg>'; };
  function dueWord(it, plan) {
    if (!it.due) return '';
    var s = it.dueId && T.schedById(it.dueId), name = s ? s.title : T.dm(it.due), passed = T.planDay(it.due) < plan.today, d = it.dueIdx != null ? it.dueIdx : 0;
    // a send whose dated thing carries the same words says only when
    function core(t) { return String(t || '').replace(/^[^:]{1,22}:\s*/, '').toLowerCase().slice(0, 24); }
    if (s && (s.title === it.title || core(s.title) === core(it.title))) return passed ? 'was due ' + T.dm(it.due) : d === 0 ? 'due today' : d === 1 ? 'due tomorrow' : 'due in ' + d + 'd';
    return '→ ' + name + (passed ? ', was due ' + T.dm(it.due) : d === 0 ? ', today' : d === 1 ? ', tomorrow' : ', ' + d + 'd');
  }
  // host: where to draw; i: 0 today, 1 tomorrow, 2 the day after; opts.compact for small screens
  T.renderDay = function (host, i, opts) {
    opts = opts || {};
    var plan = T.plan(), d = plan.days[i], date = fromKey(d.k), today = i === 0;
    var col = el('section', { class: 'pd' + (today ? ' pd-today' : ''), 'aria-label': (today ? 'Today' : i === 1 ? 'Tomorrow' : 'The day after') + ', ' + T.dm(date) });
    var head = el('header', { class: 'pd-h' },
      el('span', { class: 'pd-k' }, today ? 'Today' : i === 1 ? 'Tomorrow' : 'Day after'),
      el('span', { class: 'pd-d' }, T.DAY[date.getDay()].slice(0, 3) + ' ' + T.dm(date)));
    col.appendChild(head);
    // the day's slots: filled where planned, hollow where free; the stroke counts what the routine or your energy took away
    var meter = el('div', { class: 'pd-m', title: d.cap + ' of ' + d.base + ' slots' + (d.notes.length ? ': ' + d.notes.join('; ') : '') + '. One slot is ' + R.slotMin + ' minutes.' });
    var full = Math.max(d.base, d.cap, Math.ceil(d.used)), used = d.used;
    for (var s = 0; s < full; s++) {
      var cls = 'pd-s';
      if (s + 1 <= used) cls += ' on'; else if (s < used) cls += ' half';
      if (s >= d.cap) cls += ' off';
      meter.appendChild(el('i', { class: cls }));
    }
    var cnt = el('span', { class: 'pd-c' }, d.used % 1 ? d.used.toFixed(1) : d.used, el('span', { class: 'of' }, ' / ' + d.cap + (d.cap !== d.base ? ' of ' + d.base : '')));
    col.appendChild(el('div', { class: 'pd-mr' }, meter, cnt));
    if (d.notes.length) col.appendChild(el('p', { class: 'pd-n' }, d.notes.join('; ')));
    if (today) {
      T.renderCheckin(col, !!opts.compact);
      if (plan.lowMood) col.appendChild(el('p', { class: 'pd-n' }, 'A low day: the short wins come first.'));
    }
    var list = el('ol', { class: 'pd-l' });
    var extras = T.dayExtras(d.k, i);
    extras.filter(function (x) { return x.kind === 'fixed' || x.kind === 'session' || x.kind === 'post'; }).forEach(function (x) { list.appendChild(extraRow(x)); });
    d.items.forEach(function (part) {
      var it = part.it, row = el('li', { class: 'pd-i k-' + it.kind, role: 'button', tabindex: '0',
        on: { click: function (ev) { if (it.t) T.openTask(it.id, ev.currentTarget); else if (it.sched) T.openTask(it.sched.id, ev.currentTarget); } } });
      row.appendChild(el('span', { class: 'mk', html: T.planMark(it.kind, it.id) }));
      var body = el('span', { class: 'pd-b' });
      body.appendChild(el('span', { class: 'pd-t' }, (it.kind === 'brief' ? 'Brief ' + T.E.get('a:' + it.t.agent).name + ': ' : it.kind === 'review' ? 'Review: ' : '') + it.title));
      var sub = [T.projectName(it.p)];
      if (part.slots !== it.size) sub.push(part.slots + ' of ' + it.size + ' slots' + (it.parts[0][0] === i ? ', starts here' : it.parts[it.parts.length - 1][0] === i ? ', finishes here' : ''));
      else if (it.size !== 1) sub.push(it.size + ' slots');
      if (it.waits) sub.push('after ' + it.waits.join(' and '));
      var dw = dueWord(it, plan); if (dw) sub.push(dw);
      if (it.late && !(it.due && T.planDay(it.due) < plan.today)) sub.push('late by ' + T.plural(it.late, 'day'));
      body.appendChild(el('span', { class: 'pd-s2' + (it.late ? ' late' : '') }, sub.join(' · ')));
      row.appendChild(body);
      if (it.t && today) row.appendChild(el('button', { class: 'pd-done', title: 'Done', 'aria-label': 'Mark done', on: { click: function (ev) { ev.stopPropagation(); T.moveTask(it.id, 'done'); } } }, '✓'));
      list.appendChild(row);
    });
    extras.filter(function (x) { return x.kind === 'break'; }).forEach(function (x) { list.appendChild(extraRow(x)); });
    if (!d.items.length) list.appendChild(el('li', { class: 'pd-e' }, d.cap ? 'Nothing planned here yet; the runway has room.' : 'No slots this day.'));
    col.appendChild(list);
    host.appendChild(col);
    return col;
  };
  function extraRow(x) {
    var row = el('li', { class: 'pd-i x k-' + x.kind, role: x.brk || x.session ? 'button' : null, tabindex: x.brk || x.session ? '0' : null,
      on: { click: function () { if (x.brk && T.openBody) T.openBody(x.brk.region); else if (x.session && T.openBody) T.openBody(); } } });
    row.appendChild(el('span', { class: 'mk', html: T.planMark(x.kind, x.title) }));
    var body = el('span', { class: 'pd-b' }, el('span', { class: 'pd-t' }, x.title));
    var sub = [KIND[x.kind]]; if (x.at) sub.unshift(x.at);
    if (x.session && x.session.segs) sub.push(x.session.segs.map(function (s) { return s.k + ' ' + s.min; }).join(', '));
    if (x.brk) sub.push(x.brk.why);
    body.appendChild(el('span', { class: 'pd-s2' }, sub.join(' · ')));
    row.appendChild(body);
    return row;
  }

  // ---------------------------------------------------------------- one day as a calendar column
  // Twenty-four hours from the day's start, your working window shaded, every block placed on the clock: fixed events
  // and sessions where they are, posts at their hour, and the plan's slots laid into the window from its start, one
  // after another with a short break between, stepping round whatever is already there.
  function hourOf(at) { var d = new Date(at); return d.getHours() + d.getMinutes() / 60; }
  function off(h) { return ((h - R.dayStart) % 24 + 24) % 24; }   // hours since the day began
  function layoutDay(plan, i) {
    var d = plan.days[i], blocks = [], busy = [];
    function add(b) { blocks.push(b); if (b.hard) busy.push([b.t0, b.t1]); }
    T.dayExtras(d.k, i).forEach(function (x) {
      if (x.kind === 'fixed') { var f = (R.fixed || []).filter(function (q) { return q.label === x.title; })[0]; if (f) add({ kind: 'fixed', title: x.title, t0: off(f.from), t1: off(f.to), hard: true }); }
      else if (x.kind === 'session' && x.session) { var t0 = off(hourOf(x.session.at)); add({ kind: 'session', title: x.title, t0: t0, t1: t0 + (x.session.min || 60) / 60, hard: true, session: x.session, sub: (x.session.segs || []).map(function (g) { return g.k + ' ' + g.min; }).join(', ') }); }
      else if (x.kind === 'post') { var tp = off(SEED.pulse.hourIst); add({ kind: 'post', title: x.title, t0: tp, t1: tp + 0.25, hard: false }); }
    });
    var slot = R.slotMin / 60, gap = 10 / 60, t = off(R.window[0]), end = t + 24;
    function free(a, b) { return !busy.some(function (q) { return a < q[1] && b > q[0]; }); }
    var breaks = i === 0 && T.breaksToday ? T.breaksToday().filter(function (b) { return b.region || b.when === 'now'; }) : [], bi = 0;
    d.items.forEach(function (part) {
      var len = part.slots * slot + Math.max(0, Math.ceil(part.slots) - 1) * gap;
      while (!free(t, t + len) && t < end) t += 0.25;
      if (t >= end) return;
      add({ kind: part.it.kind, title: part.it.title, t0: t, t1: t + len, it: part.it, part: part, hard: false });
      t += len;
      if (breaks.length && bi < breaks.length && part.slots >= 1) { add({ kind: 'break', title: breaks[bi].title, sub: breaks[bi].why, t0: t, t1: t + gap, brk: breaks[bi], hard: false }); bi++; }
      t += gap;
    });
    return blocks;
  }
  T.renderDayCal = function (host, i, opts) {
    opts = opts || {};
    var plan = T.plan(), d = plan.days[i], date = fromKey(d.k), today = i === 0, blocks = layoutDay(plan, i);
    var col = el('section', { class: 'pd pd-cal' + (today ? ' pd-today' : ''), 'aria-label': (today ? 'Today' : i === 1 ? 'Tomorrow' : 'The day after') + ', ' + T.dm(date) });
    var top = el('div', { class: 'pd-top' }); col.appendChild(top);
    top.appendChild(el('header', { class: 'pd-h' }, el('span', { class: 'pd-k' }, today ? 'Today' : i === 1 ? 'Tomorrow' : 'Day after'), el('span', { class: 'pd-d' }, T.DAY[date.getDay()].slice(0, 3) + ' ' + T.dm(date))));
    var meter = el('div', { class: 'pd-m', title: d.cap + ' of ' + d.base + ' slots' + (d.notes.length ? ': ' + d.notes.join('; ') : '') + '. One slot is ' + R.slotMin + ' minutes.' });
    var full = Math.max(d.base, d.cap, Math.ceil(d.used));
    for (var sI = 0; sI < full; sI++) { var cls = 'pd-s'; if (sI + 1 <= d.used) cls += ' on'; else if (sI < d.used) cls += ' half'; if (sI >= d.cap) cls += ' off'; meter.appendChild(el('i', { class: cls })); }
    top.appendChild(el('div', { class: 'pd-mr' }, meter, el('span', { class: 'pd-c' }, d.used % 1 ? d.used.toFixed(1) : d.used, el('span', { class: 'of' }, ' / ' + d.cap + (d.cap !== d.base ? ' of ' + d.base : '')))));
    if (d.notes.length) top.appendChild(el('p', { class: 'pd-n' }, d.notes.join('; ')));
    if (today) { T.renderCheckin(top, true); if (plan.lowMood) top.appendChild(el('p', { class: 'pd-n' }, 'A low day: the short wins come first.')); }
    var cal = el('div', { class: 'cal', role: 'list' });
    var ws = off(R.window[0]), we = off(R.window[1]); if (we <= ws) we += 24;
    cal.appendChild(el('i', { class: 'cal-win', style: { top: (ws / 24 * 100) + '%', height: (Math.min(24, we) - ws) / 24 * 100 + '%' } }));
    if (we > 24) cal.appendChild(el('i', { class: 'cal-win', style: { top: '0%', height: ((we - 24) / 24 * 100) + '%' } }));
    for (var h = 0; h < 24; h += 3) {
      var hh = (R.dayStart + h) % 24;
      cal.appendChild(el('span', { class: 'cal-h', style: { top: (h / 24 * 100) + '%' } }, T.pad(hh)));
      cal.appendChild(el('i', { class: 'cal-l', style: { top: (h / 24 * 100) + '%' } }));
    }
    if (today) { var nowH = off(hourOf(Date.now())); cal.appendChild(el('i', { class: 'cal-now', style: { top: (nowH / 24 * 100) + '%' } })); }
    blocks.forEach(function (b) {
      var top = b.t0 / 24 * 100, hgt = Math.max(0.6, (b.t1 - b.t0) / 24 * 100), tall = (b.t1 - b.t0) >= 0.6;
      var it = b.it, title = (b.kind === 'brief' && it ? 'Brief ' + T.E.get('a:' + it.t.agent).name + ': ' : b.kind === 'review' ? 'Review: ' : '') + b.title;
      var blk = el('div', { class: 'cal-b k-' + b.kind + (tall ? '' : ' thin') + (it && it.late && !(it.due && T.planDay(it.due) < plan.today) ? ' late' : ''), role: 'listitem', tabindex: '0', style: { top: top + '%', height: hgt + '%' },
        title: title + (b.sub ? ' — ' + b.sub : '') + (it && it.due ? ' ' + dueWord(it, plan) : ''),
        on: { click: function (ev) { if (it && it.t) T.openTask(it.id, ev.currentTarget); else if (it && it.sched) T.openTask(it.sched.id, ev.currentTarget); else if ((b.brk || b.session) && T.openBody) T.openBody(b.brk ? b.brk.region : null); },
          keydown: function (ev) { if (ev.key === 'Enter') ev.currentTarget.click(); } } });
      blk.appendChild(el('span', { class: 'mk', html: T.planMark(b.kind, it ? it.id : b.title) }));
      var body = el('span', { class: 'cal-t' }, el('b', null, title));
      var sub = [];
      if (it) { sub.push(T.projectName(it.p)); if (b.part && b.part.slots !== it.size) sub.push(b.part.slots + ' of ' + it.size); var dw = dueWord(it, plan); if (dw) sub.push(dw); }
      if (b.sub) sub.push(b.sub);
      if (sub.length && tall) body.appendChild(el('span', { class: 'cal-s' }, sub.join(' · ')));
      blk.appendChild(body);
      if (it && it.t && today) blk.appendChild(el('button', { class: 'pd-done', title: 'Done', 'aria-label': 'Mark done', on: { click: function (ev) { ev.stopPropagation(); T.moveTask(it.id, 'done'); } } }, '✓'));
      cal.appendChild(blk);
    });
    if (!blocks.length) cal.appendChild(el('p', { class: 'pd-e cal-e' }, d.cap ? 'Nothing planned here yet; the runway has room.' : 'No slots this day.'));
    col.appendChild(cal);
    host.appendChild(col);
    return col;
  };

  // the three days, side by side or stacked, as clock faces unless a list is asked for
  T.renderSprint = function (host, opts) {
    T.clear(host);
    var plan = T.plan();
    var head = el('p', { class: 'pd-hd' }, el('span', { class: 'yf-ah' }, 'Next three days'),
      el('span', { class: 'pd-hs' }, 'Slots of ' + R.slotMin + ' min; the day starts ' + T.pad(R.dayStart) + ':00' + (plan.vel.scale !== 1 ? '; planned at ×' + plan.vel.scale.toFixed(2) : '')));
    host.appendChild(head);
    var wrap = el('div', { class: 'pd-w' });
    for (var i = 0; i < 3; i++) (opts && opts.list ? T.renderDay : T.renderDayCal)(wrap, i, opts);
    host.appendChild(wrap);
  };

  // ---------------------------------------------------------------- the plan, in words, for Ask
  T.planSummary = function () {
    var plan = T.plan(), d = plan.days[0], lines = [];
    lines.push('Today, ' + T.dm(fromKey(d.k)) + ': ' + d.used + ' of ' + d.cap + ' slots planned' + (d.notes.length ? ' (' + d.notes.join('; ') + ')' : '') + '.');
    d.items.slice(0, 6).forEach(function (p) { lines.push('• ' + (p.it.kind === 'brief' ? 'Brief: ' : p.it.kind === 'review' ? 'Review: ' : p.it.kind === 'gate' ? 'Gate: ' : '') + p.it.title + (p.it.due ? ' → ' + T.dm(p.it.due) : '')); });
    var late = plan.runways.filter(function (r) { return !r.fits; });
    lines.push(late.length ? late.length + ' of ' + plan.runways.length + ' runways run past their date: ' + late.slice(0, 3).map(function (r) { return r.s.title + (r.late ? ' by ' + T.plural(r.late, 'day') : ''); }).join('; ') + '.' : 'Every runway reaches its date at this capacity.');
    lines.push('Capacity: ' + plan.vel.basis + '.');
    return lines;
  };
})();
