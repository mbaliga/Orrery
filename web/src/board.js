/* tasks: the model shared by the board, the today column, the ideapad and the dependency chains */
(function () {
  'use strict';
  var T = window.T, G = T.G, S = T.S, SEED = T.SEED, el = T.el;
  var STATUS = T.STATUS = [['backlog', 'Backlog'], ['ready', 'Ready'], ['doing', 'In progress'], ['review', 'In review'], ['done', 'Done']];
  var WIP = 5;

  // ---- model (local to this browser in the prototype; GitHub is the store in the build)
  var saved = T.store.get('tasks', null);
  T.tasks = SEED.tasks.map(function (t) { var c = {}; Object.keys(t).forEach(function (k) { c[k] = t[k]; }); return c; });
  if (saved) {
    T.tasks.forEach(function (t) { if (saved.status && saved.status[t.id]) t.status = saved.status[t.id]; });
    (saved.added || []).forEach(function (t) { T.tasks.push(t); });
  }
  T.notes = T.store.get('notes', null) || SEED.notes.map(function (n) { var c = {}; Object.keys(n).forEach(function (k) { c[k] = n[k]; }); return c; });
  function persist() {
    var status = {}, added = [];
    T.tasks.forEach(function (t) { if (t.added) added.push(t); else status[t.id] = t.status; });
    T.store.set('tasks', { status: status, added: added });
    T.store.set('notes', T.notes);
  }
  T.resetLocal = function () { T.store.del('tasks'); T.store.del('notes'); };

  var byId = T.taskById = function (id) { for (var i = 0; i < T.tasks.length; i++) if (T.tasks[i].id === id) return T.tasks[i]; return null; };
  var sched = T.schedById = function (id) { for (var i = 0; i < SEED.schedule.length; i++) if (SEED.schedule[i].id === id) return SEED.schedule[i]; return null; };
  T.node = function (id) { return byId(id) || sched(id); };
  T.isDone = function (id) {
    var t = byId(id);
    if (t) return t.status === 'done';
    var s = sched(id);
    return !!s && new Date(s.at).getTime() < Date.now() && T.openBlockers(s).length === 0;
  };
  T.openBlockers = function (n) { return (n.by || []).filter(function (b) { return !T.isDone(b); }); };
  // everything upstream that is still open, and the open gates among it
  T.upstream = function (id) {
    var seen = {}, out = [];
    (function walk(x) { var n = T.node(x); if (!n) return; (n.by || []).forEach(function (b) { if (!seen[b]) { seen[b] = 1; out.push(b); walk(b); } }); })(id);
    return out;
  };
  T.openGates = function (id) {
    return T.upstream(id).filter(function (b) { var t = byId(b); return t && t.kind === 'gate' && t.status !== 'done'; });
  };
  // how many open things sit downstream of a node
  T.frees = function (id) {
    var seen = {}, n = 0;
    (function walk(x) {
      T.tasks.concat(SEED.schedule).forEach(function (t) {
        if ((t.by || []).indexOf(x) >= 0 && !seen[t.id]) { seen[t.id] = 1; if (!T.isDone(t.id)) n++; walk(t.id); }
      });
    })(id);
    return n;
  };

  // ---- board
  var popEl;
  function closePop() { if (popEl) { popEl.remove(); popEl = null; document.removeEventListener('pointerdown', outside, true); } }
  function outside(ev) { if (popEl && !popEl.contains(ev.target)) closePop(); }
  T.closePop = closePop;
  T.openPop = function (anchor, build) {
    closePop();
    popEl = el('div', { class: 'pop', role: 'dialog' });
    build(popEl);
    document.body.appendChild(popEl);
    var r = anchor.getBoundingClientRect(), pr = popEl.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
    var left = Math.min(Math.max(16, r.left), vw - pr.width - 16), top = r.bottom + 8;
    if (top + pr.height > vh - 16) top = Math.max(16, r.top - pr.height - 8);
    popEl.style.left = left + 'px'; popEl.style.top = top + 'px';
    setTimeout(function () { document.addEventListener('pointerdown', outside, true); }, 0);
    return popEl;
  };

  T.moveTask = function (id, status) {
    var t = byId(id);
    if (!t || t.status === status) return;
    t.status = status;
    if (T.sfx) T.sfx(status === 'done' ? 'done' : 'tick');
    if (status === 'done' && T.logDone) T.logDone(id);
    persist();
    T.emit('tasks');
    var name = STATUS.filter(function (s) { return s[0] === status; })[0][1];
    T.toast('Moved to ' + name + '. In the build this sets Status on GitHub.');
  };

  T.openTask = function (id, anchor) {
    var t = T.node(id);
    if (!t) return;
    T.openPop(anchor, function (pop) {
      var isTask = !!byId(id);
      pop.appendChild(el('b', { style: { display: 'block', 'font-size': 'var(--fs-sm)', 'font-weight': '500', color: 'var(--ink)', 'margin-bottom': '.3rem' } }, t.title));
      var meta = [T.projectName(t.p)];
      if (isTask) { meta.push(T.trackName(t.lane)); meta.push(T.E.get('a:' + t.agent).name); }
      else meta.push(T.dm(t.at) + ' ' + new Date(t.at).getFullYear() + (t.where ? ', ' + t.where : ''));
      pop.appendChild(el('span', { class: 'row-s', style: { 'white-space': 'normal' } }, meta.join(', ')));
      if (t.real) pop.appendChild(el('span', { class: 'row-s' }, 'Real: from your repos or the registry'));
      else if (t.plan) pop.appendChild(el('span', { class: 'row-s' }, 'From your publishing calendar or the venue\u2019s page'));
      else pop.appendChild(el('span', { class: 'row-s' }, 'Example'));
      if (t.stalled) pop.appendChild(el('span', { class: 'row-s' }, 'No movement for ' + t.stalled));
      if (t.slipped) pop.appendChild(el('span', { class: 'row-s' }, 'Slipped ' + t.slipped));
      if (t.note) pop.appendChild(el('p', { style: { margin: '.6rem 0 0', color: 'var(--ink-2)' } }, t.note));
      if (t.send && t.send.length) {
        var ready = t.send.filter(function (x) { return x[1] && T.isDone(x[1]); }).length;
        pop.appendChild(el('span', { class: 'mod-t' }, 'To send, ' + ready + ' of ' + t.send.length + ' ready'));
        t.send.forEach(function (x) {
          var done = x[1] && T.isDone(x[1]);
          pop.appendChild(el('span', { class: 'row-s', style: { color: 'var(--ink-2)', 'white-space': 'normal', display: 'flex', gap: '.5rem', 'align-items': 'baseline' } },
            done ? el('i', { class: 'tick' }) : el('i', { class: 'dot-o' }), x[0]));
        });
      }
      if (!isTask && t.at) {
        var nz = T.nudgesFor(t);
        if (nz.length) {
          pop.appendChild(el('span', { class: 'mod-t' }, 'Nudges'));
          pop.appendChild(el('span', { class: 'row-s', style: { 'white-space': 'normal', color: 'var(--ink-2)' } },
            nz.map(function (n) { return n.label + ', ' + T.DAY[n.when.getDay()].slice(0, 3) + ' ' + T.dm(n.when); }).join('; ')));
        }
      }
      var ob = T.openBlockers(t);
      if (ob.length) {
        pop.appendChild(el('span', { class: 'mod-t' }, 'Held by'));
        ob.forEach(function (b) {
          var n = T.node(b);
          pop.appendChild(el('span', { class: 'row-s', style: { color: 'var(--ink-2)', 'white-space': 'normal', display: 'flex', gap: '.5rem', 'align-items': 'baseline' } },
            n.kind === 'gate' ? el('i', { class: 'dia' }) : el('i', { class: 'dot-o' }), n.title));
        });
      }
      var f = T.frees(id);
      if (f) pop.appendChild(el('span', { class: 'row-s', style: { 'margin-top': '.5rem' } }, 'Clearing this frees ' + T.plural(f, 'item') + ' downstream.'));
      if (isTask) {
        pop.appendChild(el('span', { class: 'mod-t' }, 'Move to'));
        var seg = el('div', { class: 'seg' });
        STATUS.forEach(function (s) {
          seg.appendChild(el('button', { class: 'chip', 'aria-pressed': String(t.status === s[0]), on: { click: function () { closePop(); T.moveTask(id, s[0]); } } }, s[1]));
        });
        pop.appendChild(seg);
      }
      pop.appendChild(el('div', { class: 'seg', style: { 'margin-top': '.9rem' } },
        el('button', { class: 'chip', on: { click: function () { closePop(); T.setLens('p:' + t.p); } } }, 'Lens on ' + T.projectName(t.p))));
    });
  };

  T.trackName = function (k) { var x = SEED.tracks.filter(function (l) { return l[0] === k; })[0]; return x ? x[1] : k; };

  // ---- change sets: open pull requests grouped by branch name, read from git
  T.openChange = function (c, anchor) {
    T.openPop(anchor, function (pop) {
      pop.appendChild(el('b', { style: { display: 'block', 'font-size': 'var(--fs-sm)', 'font-weight': '500', color: 'var(--ink)', 'margin-bottom': '.3rem' } }, c.title));
      pop.appendChild(el('span', { class: 'row-s', style: { 'white-space': 'normal' } },
        T.plural(c.repos.length, 'pull request') + ', last commit ' + T.ago(c.last) + ' ago by ' + c.who.join(', ')));
      pop.appendChild(el('span', { class: 'row-s', style: { 'white-space': 'normal' } }, 'Branch ' + (c.branch || 'none') + '. Real: read from git.'));
      if (c.sub) pop.appendChild(el('p', { style: { margin: '.6rem 0 0', color: 'var(--ink-2)' } }, c.sub));
      pop.appendChild(el('span', { class: 'mod-t' }, 'Open on GitHub'));
      var list = el('div', { class: 'links' });
      c.repos.forEach(function (r) {
        var p = T.P.get(r[0]);
        list.appendChild(el('a', { href: 'https://github.com/mbaliga/' + p.repo + '/pull/' + r[1], target: '_blank', rel: 'noopener' },
          el('span', null, p.name), el('span', { class: 'mono' }, '#' + r[1] + (r[2] ? ', ' + r[2] + ' ahead' : ''))));
      });
      pop.appendChild(list);
      pop.appendChild(el('p', { class: 'cap', style: { 'margin-top': '.8rem' } }, 'In the build, Approve and Merge act here and on GitHub at once.'));
    });
  };
  function changeCard(c) {
    var stale = (Date.now() - new Date(c.last).getTime()) / 864e5 > 21;
    var b = el('button', { class: 'kcard pr' + (stale ? ' stale' : ''), data: { s: 'review', cid: c.id }, 'aria-label': c.title + ', pull request' });
    b.appendChild(el('span', { class: 'kcard-t' }, c.title));
    var where = c.repos.length > 1 ? c.repos.length + ' repos' : T.projectName(c.repos[0][0]);
    var r = el('span', { class: 'r' }, el('span', { class: 'mono' }, T.ago(c.last)), T.agentGlyph(c.agent));
    b.appendChild(el('span', { class: 'kcard-m' }, el('i', { class: 'prg', title: 'Pull request' }), el('span', { class: 'p' }, where), r));
    b.addEventListener('click', function (ev) { ev.stopPropagation(); T.openChange(c, b); });
    return b;
  }

  function card(t) {
    var held = T.openBlockers(t).length, done = t.status === 'done';
    var c = el('button', { class: 'kcard' + (held && !done ? ' held' : '') + (t.kind === 'gate' ? ' gate' : ''), data: { id: t.id, s: t.status },
      'aria-label': t.title + (held && !done ? ', held by ' + T.plural(held, 'item') : '') });
    c.appendChild(el('span', { class: 'kcard-t' }, t.title));
    if (t.status !== 'backlog') {
      var r = el('span', { class: 'r' });
      if (held && !done) r.appendChild(el('span', { title: 'Held by ' + held }, 'held ' + held));
      if (t.stalled && !done) r.appendChild(el('span', { title: 'No movement' }, t.stalled));
      if (t.kind === 'gate' && !done) r.appendChild(el('i', { class: 'dia', title: 'Needs you' }));
      if (done) r.appendChild(el('i', { class: 'tick' }));
      r.appendChild(T.agentGlyph(t.agent));
      c.appendChild(el('span', { class: 'kcard-m' }, el('span', { class: 'p' }, T.projectName(t.p)), r));
    } else if (t.kind === 'gate') {
      c.firstChild.insertBefore(el('i', { class: 'dia', style: { 'margin-right': '.45em' } }), c.firstChild.firstChild);
    }
    return c;
  }

  T.renderBoard = function () {
    var box = T.$('#cols');
    T.clear(box);
    var tasks = T.tasks.filter(T.taskInLens), n = 0;
    STATUS.forEach(function (s) {
      var list = tasks.filter(function (t) { return t.status === s[0]; });
      if (s[0] === 'done') list.sort(function (a, b) { return (b.at || '').localeCompare(a.at || ''); });
      if (s[0] === 'backlog') list.sort(function (a, b) { return (a.kind === 'gate' ? 0 : 1) - (b.kind === 'gate' ? 0 : 1); });
      n += list.length;
      var head = el('div', { class: 'kcol-h' }, el('span', { class: 'kcol-t' }, s[1]), el('span', { class: 'kcol-n' }, String(list.length)));
      if (s[0] === 'doing') {
        var pips = el('span', { class: 'pips', title: 'Work in progress limit of ' + WIP });
        for (var i = 0; i < WIP; i++) pips.appendChild(el('i', { class: i < list.length ? 'on' : '' }));
        head.appendChild(pips);
      }
      var body = el('div', { class: 'kcol-b' });
      list.forEach(function (t) { body.appendChild(card(t)); });
      if (s[0] === 'review') {
        var cs = G.changes.filter(function (c) { return T.changeInLens(c) && c.agent !== 'bot'; });
        cs.forEach(function (c) { body.appendChild(changeCard(c)); });
        n += cs.length;
        head.querySelector('.kcol-n').textContent = String(list.length + cs.length);
        head.appendChild(el('span', { class: 'src', title: 'Open pull requests, grouped by branch' }, 'git'));
      }
      if (!list.length) body.appendChild(el('span', { class: 'kmore' }, s[0] === 'done' ? 'Nothing closed yet' : 'Empty'));
      box.appendChild(el('div', { class: 'kcol', data: { s: s[0] } }, head, body));
    });
    T.$('#boardN').textContent = String(n);
    if (S.mode === 'pano') T.$$('.kcol-b', box).forEach(fit);
  };
  // on the ultrawide nothing scrolls: trim each column to what fits and say how many are left
  function fit(body) {
    var hidden = 0, max = body.parentNode.clientHeight - body.offsetTop + body.parentNode.offsetTop;
    if (max <= 0) return;
    var more = null;
    while (body.scrollHeight > max + 1 && body.children.length > 1) {
      var last = body.children[body.children.length - (more ? 2 : 1)];
      if (!last || last === more) break;
      body.removeChild(last); hidden++;
      if (!more) { more = el('span', { class: 'kmore' }); body.appendChild(more); }
      more.textContent = '+ ' + hidden + ' more';
    }
  }
  T.fitList = fit;

  // drag with the mouse, tap for a menu on touch
  var drag = null;
  function onDown(ev) {
    var c = ev.target.closest && ev.target.closest('.kcard');
    if (!c || ev.button !== 0 || c.hasAttribute('data-cid')) return;
    drag = { card: c, id: c.getAttribute('data-id'), x: ev.clientX, y: ev.clientY, on: false, mouse: ev.pointerType === 'mouse', ghost: null, over: null };
  }
  function onMove(ev) {
    if (!drag || !drag.mouse) return;
    var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (!drag.on) {
      if (Math.abs(dx) + Math.abs(dy) < 6 || drag.card.getAttribute('data-s') === 'done' && false) return;
      drag.on = true;
      var r = drag.card.getBoundingClientRect();
      drag.ox = drag.x - r.left; drag.oy = drag.y - r.top;
      drag.ghost = drag.card.cloneNode(true);
      drag.ghost.classList.add('ghost');
      drag.ghost.style.width = r.width + 'px';
      document.body.appendChild(drag.ghost);
      drag.card.classList.add('drag');
      closePop();
    }
    drag.ghost.style.left = (ev.clientX - drag.ox) + 'px';
    drag.ghost.style.top = (ev.clientY - drag.oy) + 'px';
    var under = document.elementFromPoint(ev.clientX, ev.clientY), col = under && under.closest && under.closest('.kcol');
    if (drag.over && drag.over !== col) drag.over.classList.remove('over');
    if (col) col.classList.add('over');
    drag.over = col;
  }
  function onUp() {
    if (!drag) return;
    var d = drag; drag = null;
    if (d.on) {
      d.ghost.remove(); d.card.classList.remove('drag');
      if (d.over) { d.over.classList.remove('over'); T.moveTask(d.id, d.over.getAttribute('data-s')); }
      d.card.addEventListener('click', function stop(e) { e.stopPropagation(); e.preventDefault(); d.card.removeEventListener('click', stop, true); }, true);
    }
  }
  T.initBoard = function () {
    var box = T.$('#cols');
    box.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    box.addEventListener('click', function (ev) {
      var c = ev.target.closest('.kcard');
      if (c) T.openTask(c.getAttribute('data-id'), c);
    });
  };

  // ---- reminders: each dated item carries a ladder of days before; the day itself, and an early send for hard dates
  T.nudgesFor = function (s) {
    var at = new Date(s.at).getTime(), out = [];
    (s.ladder || []).forEach(function (d) { out.push({ when: new Date(at - d * 864e5), item: s, days: d, label: d + 'd before' }); });
    if (s.early) out.push({ when: new Date(at - s.early * 864e5), item: s, days: s.early, label: 'send early', send: true });
    out.push({ when: new Date(at - (s.minor ? 0 : 3 * 36e5)), item: s, days: 0, label: s.minor ? 'send now' : 'on the day', send: true });
    out.sort(function (a, b) { return a.when - b.when; });
    return out;
  };
  T.upcomingNudges = function (max, inLensOnly) {
    var now = Date.now(), all = [];
    SEED.schedule.forEach(function (s) {
      if (inLensOnly && !T.inLens(s.p)) return;
      T.nudgesFor(s).forEach(function (n) { if (n.when.getTime() > now) all.push(n); });
    });
    all.sort(function (a, b) { return a.when - b.when; });
    return all.slice(0, max);
  };
  T.nextNudge = function () { return T.upcomingNudges(1)[0] || null; };

  // ---- today: what moved, what needs you, what goes out this week
  T.renderToday = function () {
    var now = new Date();
    T.$('#dayD').textContent = T.DAY[now.getDay()] + ' ' + now.getDate() + ' ' + T.MONL[now.getMonth()];

    var dg = T.$('#digest'); T.clear(dg);
    var week = Date.now() - 7 * 864e5;
    var moves = G.moves.filter(function (m) {
      return new Date(m.last).getTime() > week && m.ps.some(function (p) { return T.inLens(p); }) && T.changeInLens({ agent: m.agent, repos: m.ps.map(function (p) { return [p]; }) });
    });
    var since = new Date(G.digest_since), fresh = moves.filter(function (m) { return new Date(m.last) >= since; });
    var sum = T.$('#sinceSum'); T.clear(sum);
    if (fresh.length) {
      var c = 0, rs = {}; fresh.forEach(function (m) { c += m.n; m.ps.forEach(function (p) { rs[p] = 1; }); });
      sum.appendChild(el('b', null, T.plural(c, 'commit')));
      sum.appendChild(document.createTextNode(' since yesterday across ' + T.plural(Object.keys(rs).length, 'repo') + '.'));
    } else sum.appendChild(document.createTextNode('Nothing moved since yesterday.'));
    var merged = G.merged.filter(function (m) { return new Date(m.date).getTime() > week && T.inLens(m.p); });
    sum.appendChild(document.createTextNode(merged.length ? ' ' + T.plural(merged.length, 'merge') + ' this week.' : ' No merges this week; the last was ' + (G.merged[0] ? T.dm(G.merged[0].date) : 'not seen') + '.'));
    moves.forEach(function (m) {
      var glyphs = el('span', { style: { display: 'flex', gap: '.18rem' } });
      m.agents.slice(0, 2).forEach(function (a) { glyphs.appendChild(T.agentGlyph(a, new Date(m.last).getTime() > Date.now() - 3 * 36e5)); });
      var where = m.ps.length > 1 ? T.plural(m.ps.length, 'repo') : T.projectName(m.ps[0]);
      dg.appendChild(el('button', { class: 'row', on: { click: function () { if (m.ps.length === 1) T.setLens('p:' + m.ps[0]); else T.setLens('a:' + m.agent); } } }, glyphs,
        el('span', null, el('span', { class: 'row-t' }, m.title), el('span', { class: 'row-s' }, where + ', ' + T.plural(m.n, 'commit') + (m.prs ? ', ' + T.plural(m.prs, 'pull request') + ' open' : ''))),
        el('span', { class: 'row-r' }, T.ago(m.last))));
    });
    if (!moves.length) dg.appendChild(el('li', { class: 'empty' }, 'Nothing moved in this lens this week.'));
    if (S.mode === 'pano') trimRows(dg, 5);

    // needs you: open gates, the one that frees the most first
    var nd = T.$('#needs'); T.clear(nd);
    var gates = T.tasks.filter(function (t) { return t.kind === 'gate' && t.status !== 'done' && t.owner === 'you' && T.taskInLens(t); });
    gates.forEach(function (g) { g._f = T.frees(g.id); g._soon = soonestDownstream(g.id); });
    gates.sort(function (a, b) { return (a._soon || 9e15) - (b._soon || 9e15) || b._f - a._f; });
    gates.forEach(function (g) {
      var right = g._soon ? 'by ' + T.dm(g._soon) : g._f ? 'frees ' + g._f : '';
      nd.appendChild(el('button', { class: 'row', data: { id: g.id }, on: { click: function (ev) { T.openTask(g.id, ev.currentTarget); } } }, el('i', { class: 'dia' }),
        el('span', null, el('span', { class: 'row-t' }, g.title), el('span', { class: 'row-s' }, T.projectName(g.p) + (g._f ? ', frees ' + g._f : '') + (g.stalled ? ', waiting ' + g.stalled : ''))),
        el('span', { class: 'row-r' }, right)));
    });
    T.$('#needsN').textContent = String(gates.length);
    if (S.mode === 'pano') trimRows(nd, 6);

    // this week: what goes out in the next seven days
    var due = T.$('#due'); T.clear(due);
    var horizon = Date.now() + 7 * 864e5;
    var items = SEED.schedule.filter(function (s) { var t = new Date(s.at).getTime(); return t > Date.now() && t < horizon && T.inLens(s.p); })
      .sort(function (a, b) { return new Date(a.at) - new Date(b.at); });
    items.forEach(function (s) {
      var g = T.openGates(s.id).length, ob = T.openBlockers(s).length;
      due.appendChild(el('button', { class: 'row', on: { click: function (ev) { T.openTask(s.id, ev.currentTarget); } } },
        el('i', { class: s.hard ? (s.committed ? 'dia s' : 'dia o') : s.minor ? 'mk-l' : 'dot-o', text: s.minor ? s.minor : null }),
        el('span', null, el('span', { class: 'row-t' }, s.title), el('span', { class: 'row-s' }, T.dayTime(s.at) + (ob ? ', ' + T.plural(ob, 'thing') + ' still open' : ', ready') + (g ? ', ' + T.plural(g, 'gate') : ''))),
        el('span', { class: 'row-r' }, T.leftShort(s.at).replace('in ', ''))));
    });
    if (!items.length) due.appendChild(el('li', { class: 'empty' }, 'Nothing goes out in the next seven days in this lens.'));
    if (S.mode === 'pano') trimRows(due, 4);
    var nx = T.upcomingNudges(1, true)[0];
    var ng = T.$('#nudge'); T.clear(ng);
    if (nx) {
      ng.appendChild(document.createTextNode('Next nudge '));
      ng.appendChild(el('b', null, T.dayTime(nx.when)));
      ng.appendChild(document.createTextNode(nx.item.title + ', ' + nx.label));
    }
  };
  // the date of the nearest dated item that waits on this gate
  function soonestDownstream(id) {
    var best = 0, seen = {};
    (function walk(x) {
      SEED.schedule.concat(T.tasks).forEach(function (t) {
        if ((t.by || []).indexOf(x) >= 0 && !seen[t.id]) {
          seen[t.id] = 1;
          if (t.at && !t.status) { var w = new Date(t.at).getTime(); if (w > Date.now() && (!best || w < best)) best = w; }
          walk(t.id);
        }
      });
    })(id);
    return best ? new Date(best) : null;
  }
  function trimRows(ul, max) {
    var extra = ul.children.length - max;
    if (extra <= 0) return;
    while (ul.children.length > max) ul.removeChild(ul.lastChild);
    ul.appendChild(el('li', { class: 'more' }, '+ ' + extra + ' more'));
  }

  // ---- notes: each one has a place in the canopy. Free notes keep their spot in front of you;
  // a note tied to a project rides above it on the ring and turns with it.
  // sample notes start in the clear air around the ring: two pinned ones close, the rest further off
  var PLACE = {
    n1: { x: -1.99, y: 1.14, z: 7.4 }, n3: { x: 1.58, y: 1.09, z: 7.2 }, n5: { x: -3.0, y: -0.17, z: 10.4 },
    n6: { x: 2.24, y: -0.28, z: 11 }, n9: { x: -2.65, y: 0.14, z: 13 },
    n2: { att: 'hyle', lift: 0 }, n4: { att: 'hyle', lift: 0.4 }, n7: { att: 'runout', lift: 0 }, n8: { att: 'animalcules', lift: 0 }
  };
  T.notes.forEach(function (n, i) {
    if (n.x != null || n.att) return;
    var d = PLACE[n.id];
    if (d) Object.keys(d).forEach(function (k) { n[k] = d[k]; });
    else { n.x = ((i % 5) - 2) * 1.1; n.y = 0.2 + (i % 3) * 0.45; n.z = 8 + (i % 4) * 1.4; }
  });
  T.saveNotes = function () { persist(); T.renderNotes(); T.emit('notes'); };

  // the same notes as a list, for screen readers and keyboards
  T.renderNotes = function () {
    var box = T.$('#notesSr');
    if (!box) return;
    T.clear(box);
    T.notes.slice().sort(function (a, b) { return (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b.at || '').localeCompare(a.at || ''); }).forEach(function (n) {
      box.appendChild(el('li', null, el('button', { on: { click: function () { T.noteTools(n, null); } } },
        n.text + '. ' + (n.tag || 'idea') + (n.att ? ', tied to ' + T.projectName(n.att) : '') + (n.pin ? ', pinned' : ''))));
    });
  };

  function hideTools() {
    var b = T.$('#noteTools');
    document.removeEventListener('pointerdown', outsideTools, true);
    if (b && !b.hidden) { b.hidden = true; if (T.canopyNoteActive) T.canopyNoteActive(null); return true; }
    return false;
  }
  function outsideTools(ev) { if (!T.$('#noteTools').contains(ev.target)) hideTools(); }
  var form = null;
  function hideForm() {
    var f = T.$('#noteNew');
    form = null;
    if (f && !f.hidden) { f.hidden = true; return true; }
    return false;
  }
  T.closeNoteUi = function () { var a = hideTools(), b = hideForm(); return a || b; };

  // what you can do to a note: pin it, rewrite it, move it in depth, untie it, make it a task, let it go
  T.noteTools = function (n, r) {
    hideForm(); hideTools();
    var box = T.$('#noteTools'); T.clear(box);
    var host = T.$('#canopy').getBoundingClientRect();
    if (!r) { var c = T.noteScreen(n); r = c || { x0: host.width / 2 - 80, y0: host.height / 2 - 20, x1: host.width / 2 + 80, y1: host.height / 2 + 20 }; }
    function act(label, fn, cls, title) {
      box.appendChild(el('button', { class: 'hud-l' + (cls ? ' ' + cls : ''), title: title || null, on: { click: function (ev) { ev.stopPropagation(); hideTools(); fn(); } } }, label));
    }
    // on a phone the note shows one line in space; its tools carry the whole of it
    var full = T.canopyCompact && T.canopyCompact();
    box.classList.toggle('has-text', !!full);
    if (full) box.appendChild(el('p', { class: 'nt-x' }, n.text, el('span', { class: 'nt-m' }, (n.tag || 'idea') + (n.att ? ', on ' + T.projectName(n.att) : '') + (n.at ? ', ' + T.dm(n.at) : ''))));
    // what the compiler tied it to, by its words and its hour
    var lk = T.noteLinks ? T.noteLinks(n) : [];
    if (lk.length) box.appendChild(el('p', { class: 'nt-l' }, 'Linked: ' + T.list(lk.map(function (l) { return l.band === 'h' ? 'written ' + l.name : l.name; }), 5) + (n.ctx && n.ctx.energy ? '; you were ' + T.energyWord(n.ctx.energy) : '')));
    act(n.pin ? 'Unpin' : 'Pin', function () { n.pin = !n.pin; T.saveNotes(); });
    act('Edit', function () { openForm(n, host.left + r.x0 + 4, host.top + (r.y0 + r.y1) / 2, null); });
    act('Closer', function () { T.noteDepth(n, 0.72); }, null, T.canopyDepth && !T.canopyDepth() ? 'Up a shelf: larger and brighter' : 'Pull it toward you');
    act('Further', function () { T.noteDepth(n, 1.38); }, null, T.canopyDepth && !T.canopyDepth() ? 'Down a shelf: smaller and quieter' : 'Push it away');
    if (n.att) act('Untie', function () { T.noteFree(n); T.saveNotes(); T.toast('Untied. It stays where it is.'); });
    act('To task', function () { toTask(n); });
    act('Delete', function () { var i = T.notes.indexOf(n); if (i >= 0) T.notes.splice(i, 1); T.saveNotes(); T.toast('Note deleted.'); }, 'warn');
    box.hidden = false;
    if (T.canopyNoteActive) T.canopyNoteActive(n);
    var bw = box.offsetWidth, bh = box.offsetHeight;
    var left = Math.min(Math.max(12, host.left + r.x0), window.innerWidth - bw - 12);
    var top = host.top + r.y1 + 10;
    if (top + bh > window.innerHeight - 12) top = Math.max(12, host.top + r.y0 - bh - 10);
    box.style.left = left + 'px'; box.style.top = top + 'px';
    setTimeout(function () { document.addEventListener('pointerdown', outsideTools, true); }, 0);
  };

  // a new note opens exactly where you asked for it; Enter places it there
  function openForm(n, x, y, w) {
    hideTools();
    var f = T.$('#noteNew'), i = T.$('#noteIn');
    form = { note: n, w: w };
    i.value = n ? n.text + (n.tag && n.tag !== 'idea' && !n.att ? ' #' + n.tag : '') : '';
    i.placeholder = n ? 'Rewrite the note' : 'A thought, #tag it';
    f.hidden = false;
    var fw = f.offsetWidth, fh = f.offsetHeight;
    f.style.left = Math.min(Math.max(12, x - 6), window.innerWidth - fw - 12) + 'px';
    f.style.top = Math.min(Math.max(12, y - fh / 2), window.innerHeight - fh - 12) + 'px';
    setTimeout(function () { i.focus(); }, 20);
  }
  // pos: where the note goes, both on the glass (fx, fy, shelf) and in depth (x, y, z)
  T.newNoteAt = function (pos, sx, sy) {
    var host = T.$('#canopy').getBoundingClientRect();
    openForm(null, host.left + sx, host.top + sy, pos);
  };
  // a note from anywhere: #words tag it, the lens's project if there is one; with no place given it lines up with the others
  T.addNote = function (text, pos, fromAsk) {
    var m = text.match(/#([\w-]+)/), body = text.replace(/\s*#[\w-]+/g, '').trim() || text;
    var lens = S.lens && T.E.get(S.lens), d = new Date(), i = T.notes.length;
    var note = { id: 'n-' + Date.now(), text: body, tag: m ? m[1].toLowerCase() : (lens && lens.band === 'p' ? lens.p.id : 'idea'),
      at: d.getFullYear() + '-' + T.pad(d.getMonth() + 1) + '-' + T.pad(d.getDate()), fresh: Date.now() };
    if (pos) Object.keys(pos).forEach(function (k) { note[k] = pos[k]; });
    else { note.shelf = 0; note.x = ((i % 5) - 2) * 1.1; note.y = 0.2 + (i % 3) * 0.45; note.z = 8 + (i % 4) * 1.4; }
    if (T.compileNote) T.compileNote(note, true);
    T.notes.push(note);
    T.saveNotes();
    var linked = T.noteLinks ? T.noteLinks(note).filter(function (l) { return l.band !== 'h'; }) : [];
    if (fromAsk) T.toast('Noted' + (m ? ', tagged ' + m[1].toLowerCase() : '') + (linked.length ? '; linked to ' + T.list(linked.map(function (l) { return l.name; }), 3) : '') + '. It waits with your other notes on the canopy.');
    else {
      var depth = T.canopyDepth && T.canopyDepth();
      T.toast(S.mode === 'pano' ? (depth ? 'Placed. Drag it, scroll on it to push it away, drop it on a project to tie it there.' : 'Placed. Drag it anywhere, scroll on it to change its shelf, drop it on a project to tie it there.')
        : 'Placed. Drag it anywhere, or onto a project to tie it there.');
    }
    return note;
  };
  T.addTask = function (title, pid) {
    T.tasks.push({ id: 'x-' + Date.now(), title: title.length > 90 ? title.slice(0, 88) + '\u2026' : title, p: pid, lane: 'design', status: 'ready', agent: 'you', added: true });
    persist();
    T.emit('tasks');
    T.toast('Added to Ready under ' + T.projectName(pid) + '. In the build it opens an issue there.');
  };
  function submitForm(ev) {
    if (ev) ev.preventDefault();
    var st = form, i = T.$('#noteIn'), text = i.value.trim();
    hideForm();
    if (!st || !text) return;
    if (st.note) {
      var m = text.match(/#([\w-]+)/);
      st.note.text = text.replace(/\s*#[\w-]+/g, '').trim() || text;
      if (m) st.note.tag = m[1].toLowerCase();
      if (T.compileNote) T.compileNote(st.note, false);
      T.saveNotes();
      return;
    }
    T.addNote(text, st.w || {}, false);
  }
  T.initNotes = function () {
    T.$('#noteNew').addEventListener('submit', submitForm);
    T.$('#noteIn').addEventListener('blur', function () {
      // leaving the field with words in it keeps them; leaving it empty lets the note go
      setTimeout(function () { if (form && document.activeElement !== T.$('#noteIn')) submitForm(null); }, 160);
    });
  };

  function toTask(n) {
    var lens = S.lens && T.E.get(S.lens);
    var pid = n.att && T.P.has(n.att) ? n.att : lens && lens.band === 'p' ? lens.p.id : (T.P.has(n.tag) ? n.tag : 'tracker');
    T.notes.splice(T.notes.indexOf(n), 1);
    T.addTask(n.text, pid);
    T.saveNotes();
  }

  // a dated item from the canopy: the same card as everywhere else, opened where you clicked
  T.openTaskAt = function (id, x, y) {
    var a = el('span', { style: { position: 'fixed', left: x + 'px', top: y + 'px', width: '1px', height: '1px' } });
    document.body.appendChild(a);
    T.openTask(id, a);
    a.remove();
  };
})();
