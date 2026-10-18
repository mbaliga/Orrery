/* runways: the plan's dated things as rows on the shared gantt (ASOC.gantt), grouped any way the lens of work
   demands: by group of projects, project, lane, owner, team or sprint, each group a swimlane that folds. */
(function () {
  'use strict';
  var T = window.T, el = T.el;
  var GROUPS = T.GANTT_GROUPS = [['none', 'No grouping'], ['cluster', 'Group of projects'], ['project', 'Project'], ['lane', 'Lane'], ['owner', 'Owner'], ['team', 'Team'], ['sprint', 'Sprint']];
  var groupBy = T.store.get('ganttGroup', 'none'), folded = T.store.get('ganttFolded', {});
  T.ganttGroup = function () { return groupBy; };
  T.setGanttGroup = function (g) { groupBy = g; T.store.set('ganttGroup', g); T.emit('plan'); };
  function keyOf(r) {
    var s = r.s, p = T.P.get(s.p);
    if (groupBy === 'cluster') return p ? p.cluster : 'other';
    if (groupBy === 'project') return s.p;
    if (groupBy === 'lane') return s.lane || 'other';
    if (groupBy === 'owner') { var owners = {}; r.items.forEach(function (it) { owners[it.t ? it.t.agent : 'you'] = 1; }); var ks = Object.keys(owners); return ks.length === 1 ? ks[0] : ks.length ? 'several' : 'you'; }
    if (groupBy === 'team') return s.team || T.teamOf(s.p);
    if (groupBy === 'sprint') return T.sprintOf(s.at);
    return 'all';
  }
  function labelOf(k) {
    if (groupBy === 'cluster') return T.clusterName[k] || k;
    if (groupBy === 'project') return T.projectName(k);
    if (groupBy === 'lane') return T.trackName ? T.trackName(k) : k;
    if (groupBy === 'owner') return k === 'several' ? 'Several owners' : (T.E.get('a:' + k) ? T.E.get('a:' + k).name : k);
    if (groupBy === 'team') return T.teamName(k);
    if (groupBy === 'sprint') return T.sprintName(k);
    return 'All';
  }
  T.renderRunways = function (host, opts) {
    opts = opts || {};
    var plan = T.plan(), rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    var only = opts.only || null;
    var rows = plan.runways.filter(function (r) { if (!only) return true; var pid = r.s.p || (r.items[0] && r.items[0].p); return !pid || only.has(pid) || r.items.some(function (it) { return only.has(it.p); }); }).slice(0, opts.rows || 60).map(function (r) {
      return { id: r.id, label: r.s.title, date: T.dm(r.at), dueIdx: r.dueIdx, end: r.end, kind: r.s.hard ? 'hard' : r.s.minor ? 'send' : 'plan', vio: r.gates > 0,
        fits: r.fits, late: r.late, unplaced: r.unplaced, slots: r.slots, dayKey: T.planDay(r.at), group: keyOf(r),
        verdict: r.fits ? (r.slots ? r.slots + (r.slots === 1 ? ' slot' : ' slots') : (r.allUp ? 'all done' : '')) : null,
        items: r.items.map(function (it) {
          var runs = [], cur = null;
          (it.parts || []).forEach(function (p) { if (cur && p[0] === cur.b + 1) { cur.b = p[0]; cur.slots += p[1]; } else { cur = { a: p[0], b: p[0], slots: p[1] }; runs.push(cur); } });
          return { id: it.t ? it.id : (it.sched ? it.sched.id : it.id), kind: it.kind, title: it.title, prefix: it.kind === 'brief' ? 'Brief: ' : it.kind === 'review' ? 'Review: ' : it.kind === 'gate' ? 'Gate: ' : '', runs: runs };
        }) };
    });
    var groups = null;
    if (groupBy !== 'none') {
      var seen = {}, order = [];
      rows.forEach(function (r) { if (!seen[r.group]) { seen[r.group] = 1; order.push(r.group); } });
      groups = order.map(function (k) { return { key: k, label: labelOf(k), collapsed: !!folded[groupBy + ':' + k] }; });
    }
    var out = ASOC.gantt.render(host, {
      days: plan.days, rows: rows, groups: groups, height: opts.height, rem: rem, compact: opts.compact, field: T.fieldA ? T.fieldA(1) : '#000',
      onHover: function (id, r) { if (opts.onDay) opts.onDay(r ? r.dayKey : null); },
      onClick: function (id, ev) { T.openTaskAt(id, ev.clientX || 300, ev.clientY || 300); },
      onBar: function (id, ev) { T.openTaskAt(id, ev.clientX, ev.clientY); },
      onGroup: function (k) { var key = groupBy + ':' + k; if (folded[key]) delete folded[key]; else folded[key] = 1; T.store.set('ganttFolded', folded); if (T.sfx) T.sfx(folded[key] ? 'back' : 'select'); T.renderRunways(host, opts); }
    });
    if (plan.runways.length > rows.length) host.appendChild(el('p', { class: 'yf-s' }, 'And ' + (plan.runways.length - rows.length) + ' more, further out.'));
    return out;
  };
  // the grouping control: a row of chips
  T.renderGanttGroups = function (host) {
    T.clear(host);
    GROUPS.forEach(function (g) {
      host.appendChild(el('button', { class: 'chip' + (g[0] === groupBy ? ' on' : ''), 'aria-pressed': String(g[0] === groupBy), on: { click: function () { T.setGanttGroup(g[0]); } } }, g[1]));
    });
  };
})();
