/* rhythm: when work happens.
   Eight three-hour stretches of the day join the chord as a band, When, linked from each project by your own commits
   in that stretch, so a ribbon says when a project gets your hands. The clock draws the same record as a rose of
   twenty-four hours, yours inside and the agents' outside, and breaks it out for whatever the lens or the pointer is
   on: a project, a group, an agent, one stretch of the day. Check-ins, mood and energy, are the first signal here
   that is not a commit; the planner reads the latest one. Everything written here stays in this browser; the build
   keeps it in the workspace's local/ folder, which is never pushed unless you say so. */
(function () {
  'use strict';
  var T = window.T, G = T.G, S = T.S, E = T.E;
  var TAU = Math.PI * 2;
  var INK = '236,232,228', RAD = '199,239,158', CYAN = '53,224,255', VIOH = '165,147,255';
  function rgba(c, a) { return 'rgba(' + c + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')'; }
  function sum(arr, a, b) { var n = 0; for (var i = a; i < b; i++) n += arr[i] || 0; return n; }
  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  G.hours_ag = G.hours_ag || zeros(24);

  // ---------------------------------------------------------------- the band: eight stretches of the day
  var SEGS = T.SEGS = [];
  for (var i = 0; i < 8; i++) SEGS.push({ id: 'h:' + i, i: i, h0: i * 3, h1: i * 3 + 3, name: T.pad(i * 3) + '–' + T.pad(i * 3 + 3) });
  T.BAND.h = 'When';
  if (S.layers.h == null) S.layers.h = true;
  SEGS.forEach(function (s) {
    s.you = sum(G.hours_ist, s.h0, s.h1); s.ag = sum(G.hours_ag, s.h0, s.h1);
    E.set(s.id, { id: s.id, band: 'h', name: s.name, key: s.i, h0: s.h0, h1: s.h1, you: s.you, ag: s.ag });
  });
  // links from projects: your commits in each stretch. Agents are not linked here; the agents band already says who.
  G.projects.forEach(function (p) {
    if (!p.hours) return;
    SEGS.forEach(function (s) {
      var n = sum(p.hours.you, s.h0, s.h1);
      if (n <= 0) return;
      var l = { a: 'p:' + p.id, b: s.id, band: 'h', w: n };
      T.links.push(l);
      if (!T.adj.has(l.a)) T.adj.set(l.a, []);
      if (!T.adj.has(l.b)) T.adj.set(l.b, []);
      T.adj.get(l.a).push(l); T.adj.get(l.b).push(l);
    });
  });
  T.segOf = function (h) { return SEGS[Math.floor(((h % 24) + 24) % 24 / 3)]; };

  // ---------------------------------------------------------------- the record by hour, overall or for one thing
  function hoursFor(id) {
    var e = id && E.get(id), you = zeros(24), ag = zeros(24), what = 'all work';
    function addP(p) { if (!p.hours) return; for (var h = 0; h < 24; h++) { you[h] += p.hours.you[h]; ag[h] += p.hours.ag[h]; } }
    if (!e) { you = G.hours_ist.slice(); ag = G.hours_ag.slice(); }
    else if (e.band === 'p') { addP(e.p); what = e.name; }
    else if (e.band === 'c') { G.projects.forEach(function (p) { if (p.cluster === e.key) addP(p); }); what = e.name; }
    else if (e.band === 'a') { if (e.kind === 'person') you = G.hours_ist.slice(); else ag = G.hours_ag.slice(); what = e.kind === 'person' ? 'your commits' : 'all agents (the scan keeps one clock for them)'; }
    else if (e.band === 'h') { you = G.hours_ist.slice(); ag = G.hours_ag.slice(); what = e.name; }
    else { T.neighbours(id).forEach(function (pid) { if (pid.indexOf('p:') === 0) addP(E.get(pid).p); }); what = e.name; }
    return { you: you, ag: ag, e: e, what: what };
  }
  T.hoursFor = hoursFor;

  // ---------------------------------------------------------------- the clock
  // A rose: each hour a wedge, midnight at the top. Your commits fill from the hub outward, the agents' continue
  // from where yours end, both on one square-root scale so that area reads as count. Notes and check-ins, when there
  // are any, sit as dots on the hub ring at the hour they were made.
  var drawn = [];   // where clocks were last drawn, per canvas, for pointing
  T.drawRose = function (g, cx, cy, R, series, o) {
    o = o || {};
    var geo = ASOC.rose.draw(g, cx, cy, R, series, Object.assign({ ink: INK, mono: T.MONO, sans: T.SANS, hub: function (ctx, x, y, r0) { T.cell(ctx, x, y, r0, 'hub', { stroke: rgba(INK, 0.26), wob: 0.05, n: 9 }); } }, o));
    geo.g = g;
    for (var k = 0; k < drawn.length; k++) if (drawn[k].g === g) { drawn[k] = geo; return; }
    drawn.push(geo);
  };
  // the commits clock: yours inside, the agents' outside; notes and check-ins as dots on the hub
  T.drawClock = function (g, cx, cy, R, o) {
    o = o || {};
    var rec = hoursFor(o.focus), seg = rec.e && rec.e.band === 'h' ? rec.e : null, dots = [];
    (T.notes || []).forEach(function (n) { if (n.hour != null) dots.push({ h: n.hour, col: INK, a: 0.75, r: 1.3 }); });
    T.checkins.forEach(function (c) { dots.push({ h: new Date(c.at).getHours(), col: c.energy >= 4 ? RAD : c.energy <= 2 ? VIOH : INK, a: 0.8, r: 1.3, row: 1 }); });
    T.drawRose(g, cx, cy, R, [{ vals: rec.you, col: RAD, a: 0.92 }, { vals: rec.ag, col: CYAN, a: 0.62 }],
      { rem: o.rem, hour: o.hour, range: seg ? [seg.h0, seg.h1] : null, dots: dots, caption: o.caption === false ? null : (o.focus ? rec.what : 'When'), sub: o.focus ? null : 'yours inside, agents’ outside',
        segs: o.segs ? SEGS.map(function (sg) { return [sg.h0, sg.h1, sg.name]; }) : null, hotSeg: seg ? seg.key : (o.hour != null ? T.segOf(o.hour).i : -1) });
    return rec;
  };
  // which hour sits under a point on a canvas the clock was drawn on; null if none
  T.clockHit = function (g, x, y) {
    for (var k = 0; k < drawn.length; k++) {
      var d = drawn[k]; if (d.g !== g) continue;
      var h = ASOC.rose.hit(d.cx, d.cy, d.R, x, y);
      return h == null ? null : { hour: h, seg: T.segOf(h) };
    }
    return null;
  };
  T.clockTip = function (hit) {
    var h = hit.hour, rec = hoursFor(S.lens), box = document.createDocumentFragment();
    box.appendChild(T.el('b', null, T.pad(h) + ':00 to ' + T.pad(h + 1) + ':00'));
    box.appendChild(T.el('span', { class: 'v' }, (S.lens && rec.e ? rec.what : 'All work') + ', since May'));
    box.appendChild(T.el('span', { class: 'k' }, 'Commits'));
    box.appendChild(T.el('span', { class: 'v' }, rec.you[h] + ' yours, ' + rec.ag[h] + ' by agents'));
    // which projects most, at this hour
    var top = G.projects.filter(function (p) { return p.hours && (p.hours.you[h] + p.hours.ag[h]) > 0 && T.inLens(p.id); })
      .sort(function (a, b) { return (b.hours.you[h] + b.hours.ag[h]) - (a.hours.you[h] + a.hours.ag[h]); }).slice(0, 4);
    if (top.length) { box.appendChild(T.el('span', { class: 'k' }, 'Mostly')); box.appendChild(T.el('span', { class: 'v' }, top.map(function (p) { return p.name + ' ' + (p.hours.you[h] + p.hours.ag[h]); }).join(', '))); }
    box.appendChild(T.el('span', { class: 'k' }, 'Stretch'));
    box.appendChild(T.el('span', { class: 'v' }, hit.seg.name + ' on the chord, ' + hit.seg.you + ' of your commits'));
    return box;
  };

  // ---------------------------------------------------------------- check-ins: mood and energy, a few words
  T.MOOD = [[-2, 'low'], [-1, 'flat'], [0, 'even'], [1, 'good'], [2, 'bright']];
  T.ENERGY = [[1, 'spent'], [2, 'low'], [3, 'steady'], [4, 'fresh'], [5, 'full']];
  T.checkins = T.store.get('checkins', []);
  function dkey(d) { d = new Date(d); return d.getFullYear() + '-' + T.pad(d.getMonth() + 1) + '-' + T.pad(d.getDate()); }
  T.checkIn = function (mood, energy, note) {
    var c = { at: new Date().toISOString(), mood: mood, energy: energy };
    if (note) c.note = note;
    T.checkins.push(c);
    if (T.checkins.length > 400) T.checkins = T.checkins.slice(-400);
    T.store.set('checkins', T.checkins);
    T.emit('checkin', c);
    return c;
  };
  T.lastCheckin = function (day) {
    var k = day || dkey(new Date()), last = null;
    T.checkins.forEach(function (c) { if (dkey(c.at) === k) last = c; });
    return last;
  };
  // the energy multiplier the planner applies to a day's capacity: spent halves it, full adds a fifth
  T.energyMult = function (energy) { return energy == null ? 1 : [0.5, 0.75, 1, 1.1, 1.2][Math.max(1, Math.min(5, energy)) - 1]; };
  T.moodWord = function (m) { for (var i = 0; i < T.MOOD.length; i++) if (T.MOOD[i][0] === m) return T.MOOD[i][1]; return ''; };
  T.energyWord = function (e) { for (var i = 0; i < T.ENERGY.length; i++) if (T.ENERGY[i][0] === e) return T.ENERGY[i][1]; return ''; };

  // two rows of five marks; the latest check-in of the day is filled, earlier ones leave a small tick
  T.renderCheckin = function (host, compact) {
    var el = T.el, today = dkey(new Date()), last = T.lastCheckin(today);
    var box = el('div', { class: 'ck' + (compact ? ' ck-c' : '') });
    function row(label, scale, key) {
      var r = el('div', { class: 'ck-r' }, el('span', { class: 'ck-l' }, label));
      scale.forEach(function (s) {
        var on = last && last[key] === s[0];
        var earlier = T.checkins.some(function (c) { return c !== last && dkey(c.at) === today && c[key] === s[0]; });
        r.appendChild(el('button', { class: 'ck-b' + (on ? ' on' : '') + (earlier ? ' was' : ''), title: s[1], 'aria-label': label + ': ' + s[1], 'aria-pressed': String(!!on),
          html: '<svg viewBox="-7 -7 14 14" aria-hidden="true">' + T.cellMark(key + s[0], on ? { r: 5.2, fill: 'rgb(236,232,228)', nucleus: 'rgba(0,0,0,.55)' } : { r: 5, stroke: 'rgba(236,232,228,.5)', width: 1.1 }) + '</svg>',
          on: { pointerenter: function () { if (T.sfx) T.sfx('hover'); }, click: function () {
            if (T.sfx) T.sfx('tick');
            var m = key === 'mood' ? s[0] : (last ? last.mood : 0), e = key === 'energy' ? s[0] : (last ? last.energy : 3);
            T.checkIn(m, e);
            T.toast('Noted: ' + T.moodWord(m) + ', ' + T.energyWord(e) + '. Today’s plan is adjusted.');
          } } }));
      });
      r.appendChild(el('span', { class: 'ck-w' }, last ? (key === 'mood' ? T.moodWord(last.mood) : T.energyWord(last.energy)) : ''));
      return r;
    }
    box.appendChild(row('Mood', T.MOOD, 'mood'));
    box.appendChild(row('Energy', T.ENERGY, 'energy'));
    var n = T.checkins.filter(function (c) { return dkey(c.at) === today; }).length;
    box.appendChild(el('span', { class: 'ck-t' }, last ? 'at ' + T.hm(last.at) + (n > 1 ? ', ' + n + ' today' : '') : '', T.info('One tap for mood, one for energy, as often as you like. Energy bends today’s slots: spent halves them, full adds a fifth; a low mood puts the short wins first. Check-ins stay in this browser.', 'About check-ins')));
    host.appendChild(box);
    return box;
  };

  // ---------------------------------------------------------------- the rhythm, in words
  var WDN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  T.rhythm = function () {
    var you = G.hours_ist, tot = sum(you, 0, 24) || 1, best = SEGS.slice().sort(function (a, b) { return b.you - a.you; });
    var night = sum(you, 21, 24) + sum(you, 0, 5), wd = (G.wdays && G.wdays.you) || zeros(7), wtot = sum(wd, 0, 7) || 1;
    var wbest = [0, 1, 2, 3, 4, 5, 6].sort(function (a, b) { return wd[b] - wd[a]; });
    var out = { total: tot, segs: best, night: night / tot, weekdays: wbest.map(function (i) { return { i: i, name: WDN[i], n: wd[i], share: wd[i] / wtot }; }) };
    // notes by hour, from the compiler's stamps
    var nh = zeros(24), nn = 0;
    (T.notes || []).forEach(function (n) { if (n.hour != null) { nh[n.hour]++; nn++; } });
    out.notesByHour = nh; out.notesStamped = nn;
    // check-ins: the hours you felt best, if you have said
    var ck = T.checkins, byH = {};
    ck.forEach(function (c) { var h = new Date(c.at).getHours(); (byH[h] = byH[h] || []).push(c.energy); });
    var bestH = Object.keys(byH).map(function (h) { var a = byH[h]; return { h: +h, e: a.reduce(function (x, y) { return x + y; }, 0) / a.length, n: a.length }; }).sort(function (a, b) { return b.e - a.e; });
    out.checkins = ck.length; out.bestHours = bestH.slice(0, 3);
    var lines = [];
    lines.push('By your commits since May, ' + T.int(tot) + ' of them: ' + best[0].name + ' carries ' + T.pct(best[0].you / tot) + ', then ' + best[1].name + ' with ' + T.pct(best[1].you / tot) + '. ' + T.pct(out.night) + ' of your commits land between 21:00 and 05:00.');
    lines.push('By weekday: ' + out.weekdays[0].name + ' ' + T.pct(out.weekdays[0].share) + ', ' + out.weekdays[1].name + ' ' + T.pct(out.weekdays[1].share) + '; ' + out.weekdays[6].name + ' is the quietest at ' + T.pct(out.weekdays[6].share) + '.');
    if (nn) { var top = nh.indexOf(Math.max.apply(null, nh)); lines.push(T.plural(nn, 'note') + ' carry an hour; most were written around ' + T.pad(top) + ':00.'); }
    if (ck.length) lines.push(T.plural(ck.length, 'check-in') + ' so far' + (bestH.length ? '; energy ran highest around ' + T.pad(bestH[0].h) + ':00 (' + bestH[0].e.toFixed(1) + ' of 5)' : '') + '.');
    else lines.push('No check-ins yet, so commits are the only record of when you work. Mood and energy check-ins add the hours you felt best; Baseline adds the signal itself once it is connected.');
    out.lines = lines;
    return out;
  };
})();
