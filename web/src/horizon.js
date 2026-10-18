/* time, as words: the clocks counting down, the nudges in the order they will arrive, the agenda for a phone, and the
   readouts on the glass over the flight path. The flight path itself is drawn in the canopy (space.js). */
(function () {
  'use strict';
  var T = window.T, G = T.G, S = T.S, SEED = T.SEED, el = T.el, sv = T.sv;
  var LANES = [['release', 'Release'], ['research', 'Research'], ['publish', 'Publish']];
  var DAYMS = 864e5;
  var MINOR = { S: 'Stack Overflow', M: 'Medium', N: 'Newsletter' };

  function marker(s) {
    if (s.hard && s.committed) return el('i', { class: 'dia s mk' });
    if (s.hard) return el('i', { class: 'dia o mk' });
    return el('i', { class: 'dot-o mk' });
  }
  function itemTip(s) {
    var f = document.createDocumentFragment(), d = new Date(s.at);
    f.appendChild(el('b', null, s.title));
    f.appendChild(el('span', { class: 'v' }, T.DAY[d.getDay()] + ' ' + T.dm(d) + ' ' + d.getFullYear() + ', ' + T.hm(d) + ' your time' + (s.where ? ' (' + s.where + ')' : '')));
    f.appendChild(el('span', { class: 'v' }, el('strong', null, T.leftShort(s.at)), s.hard ? (s.committed ? ', fixed date' : ', fixed date, not committed') : s.minor ? ', ' + MINOR[s.minor] : ', your target'));
    if (s.send) {
      var ready = s.send.filter(function (x) { return x[1] && T.isDone(x[1]); }).length;
      f.appendChild(el('span', { class: 'k' }, 'To send, ' + ready + ' of ' + s.send.length + ' ready'));
      f.appendChild(el('span', { class: 'v' }, s.send.map(function (x) { return x[0]; }).join('; ')));
    }
    var nz = T.nudgesFor(s).filter(function (n) { return n.when.getTime() > Date.now(); });
    if (nz.length) {
      f.appendChild(el('span', { class: 'k' }, 'Nudges ahead'));
      f.appendChild(el('span', { class: 'v' }, nz.map(function (n) { return T.dm(n.when) + ' ' + n.label; }).join(', ')));
    }
    var og = T.openGates(s.id);
    if (og.length) {
      f.appendChild(el('span', { class: 'k' }, 'Open gates upstream'));
      f.appendChild(el('span', { class: 'v' }, og.map(function (b) { return T.node(b).title; }).join('; ')));
    }
    if (s.note) { f.appendChild(el('span', { class: 'k' }, 'Note')); f.appendChild(el('span', { class: 'v' }, s.note)); }
    return f;
  }

  T.itemTip = itemTip;
  T.renderHorizon = function () {
    renderSide();
    renderAgenda();
  };

  // ---- on the glass over the flight path: the fixed dates counting down, the next nudge, the next things to send
  function byAt(a, b) { return new Date(a.at) - new Date(b.at); }
  function readout(s, sub, send) {
    var b = el('button', { class: 'ro' + (send ? ' send' : ''), 'aria-label': s.title + ', ' + T.leftShort(s.at) },
      el('span', { class: 'ro-t' }, s.hard && s.committed ? el('i', { class: 'dia s' }) : null, s.title), T.countdown(s.at), el('span', { class: 'ro-s' }, sub));
    b.addEventListener('click', function () { T.tip.hide(); T.openTask(s.id, b); });
    b.addEventListener('pointerenter', function (ev) { if (ev.pointerType === 'mouse') T.tip.show(itemTip(s), ev.clientX, ev.clientY); });
    b.addEventListener('pointerleave', T.tip.hide);
    return b;
  }
  T.renderHud = function () {
    var L = T.$('#hudL'), R = T.$('#hudR'), N = T.$('#hudN');
    if (!L) return;
    T.clear(L); T.clear(R); T.clear(N);
    var now = Date.now(), pano = S.mode === 'pano';
    SEED.schedule.filter(function (s) { return s.hard && s.committed && new Date(s.at).getTime() > now && T.inLens(s.p); })
      .sort(byAt).slice(0, pano ? 3 : 1).forEach(function (s) {
        var ready = s.send ? s.send.filter(function (x) { return x[1] && T.isDone(x[1]); }).length : null;
        L.appendChild(readout(s, T.DAY[new Date(s.at).getDay()].slice(0, 3) + ' ' + T.dm(s.at) + (s.where ? ', ' + s.where : '') +
          (ready != null ? ', ' + ready + ' of ' + s.send.length + ' ready' : ''), false));
      });
    SEED.schedule.filter(function (s) { return !(s.hard && s.committed) && new Date(s.at).getTime() > now && T.inLens(s.p); })
      .sort(byAt).slice(0, pano ? 2 : 1).forEach(function (s) {
        R.appendChild(readout(s, (s.minor ? MINOR[s.minor] : s.hard ? 'fixed date' : 'your target') + ', ' + T.dayTime(s.at), true));
      });
    var nx = T.upcomingNudges(1, true)[0];
    if (!L.children.length && !R.children.length && !nx) {
      N.appendChild(el('span', null, 'Nothing dated in this lens. Esc for all work.'));
      return;
    }
    if (nx) {
      var b = el('button', { class: 'hud-nb' }, el('span', null, el('i', { class: 'bell' + (nx.send ? ' s' : '') }), 'Next nudge, ' + T.DAY[nx.when.getDay()].slice(0, 3) + ' ' + T.hm(nx.when)),
        el('b', null, nx.item.title + ', ' + nx.label));
      b.addEventListener('click', function () { T.openTask(nx.item.id, b); });
      N.appendChild(b);
    }
  };

  // ---- the clocks: committed fixed dates, then the next send, then the nudges in order
  function renderSide() {
    var cd = T.$('#clocks'), nz = T.$('#nudges');
    if (!cd) return;
    T.clear(cd); T.clear(nz);
    var now = Date.now();
    var hard = SEED.schedule.filter(function (s) { return s.hard && s.committed && new Date(s.at).getTime() > now && T.inLens(s.p); })
      .sort(function (a, b) { return new Date(a.at) - new Date(b.at); });
    var next = SEED.schedule.filter(function (s) { return !s.hard && new Date(s.at).getTime() > now && T.inLens(s.p); })
      .sort(function (a, b) { return new Date(a.at) - new Date(b.at); })[0];
    var rows = (next ? [next] : []).concat(hard).slice(0, S.mode === 'pano' ? 4 : 6);
    rows.forEach(function (s, i) {
      var ready = s.send ? s.send.filter(function (x) { return x[1] && T.isDone(x[1]); }).length : null;
      var sub = s === next ? 'Next send, ' + T.dayTime(s.at) : T.DAY[new Date(s.at).getDay()].slice(0, 3) + ' ' + T.dm(s.at) + ', ' + (s.where || T.hm(s.at));
      if (ready != null) sub += ', ' + ready + ' of ' + s.send.length + ' ready';
      cd.appendChild(el('button', { class: 'clock-r' + (i === 0 ? ' first' : ''), on: { click: function (ev) { T.openTask(s.id, ev.currentTarget); } } },
        el('span', { class: 'row-t' }, s.title), T.countdown(s.at), el('span', { class: 'row-s' }, sub)));
    });
    if (!rows.length) cd.appendChild(el('p', { class: 'empty' }, 'No dates in this lens.'));
    T.upcomingNudges(S.mode === 'pano' ? 5 : 8, true).forEach(function (n) {
      nz.appendChild(el('button', { class: 'row', on: { click: function (ev) { T.openTask(n.item.id, ev.currentTarget); } } },
        el('i', { class: n.send ? 'bell s' : 'bell' }),
        el('span', null, el('span', { class: 'row-t' }, n.item.title), el('span', { class: 'row-s' }, n.label + (n.send ? ', push and calendar' : ', push'))),
        el('span', { class: 'row-r' }, T.DAY[n.when.getDay()].slice(0, 3) + ' ' + T.dm(n.when))));
    });
  }

  // phone: the same schedule as a list
  function renderAgenda() {
    var host = T.$('#agenda');
    if (!host) return;
    T.clear(host);
    var now = Date.now();
    var items = SEED.schedule.filter(function (s) { return new Date(s.at).getTime() > now - DAYMS; }).sort(function (a, b) { return new Date(a.at) - new Date(b.at); }), month = null, box = null;
    items.forEach(function (s) {
      var d = new Date(s.at), key = T.MONL[d.getMonth()] + ' ' + d.getFullYear();
      if (key !== month) { month = key; box = el('div', { class: 'ag-day' }, el('div', { class: 'ag-m' }, key)); host.appendChild(box); }
      var gates = T.openGates(s.id).length;
      var subt = T.DAY[d.getDay()].slice(0, 3) + ' ' + T.dm(d) + ', ' + T.hm(d) + (s.hard ? (s.committed ? ', fixed' : ', fixed, not committed') : s.minor ? ', ' + MINOR[s.minor] : ', target') +
        (gates ? ', ' + T.plural(gates, 'gate') + ' open' : '');
      var right = s.hard && s.committed ? T.countdown(s.at) : el('span', { class: 'row-r' }, T.leftShort(s.at).replace('in ', ''));
      box.appendChild(el('button', { class: 'row' + (T.inLens(s.p) ? '' : ' dim') + (s.minor ? ' minor' : ''), on: { click: function (ev) { T.openTask(s.id, ev.currentTarget); } } },
        s.minor ? el('i', { class: 'mk-l' }, s.minor) : el('i', { class: s.hard ? (s.committed ? 'dia s' : 'dia o') : 'dot-o' }),
        el('span', null, el('span', { class: 'row-t', style: { 'white-space': 'normal' } }, s.title), el('span', { class: 'row-s', style: { 'white-space': 'normal' } }, subt)),
        right));
    });
  }
})();
