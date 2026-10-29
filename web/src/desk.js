/* desk: notes with a place, and a key that clears the windows away.
   A desk is a flat board behind everything: a note pinned to it keeps its place — as a fraction of the window, so it
   is in the same place on the G9, the iPad and the phone — whatever else is on screen. `H` (or the Desk button, or
   "hide windows" in Ask) fades the modules, the wings and the docks away and brings the desk forward; press again,
   or Escape, and they return. There is one desk for each project (the lens decides which) and one for everything.
   On the desk: drag a note to move it; double-click empty space for a new one; double-click a note to rewrite it;
   Shift-drag from one note to another to tie them with a line (again to untie); the dot cycles its colour, always
   with the tag written beside it so no state is colour alone; × lets it off the desk (the note stays a note).
   Drop a note on another to stack it; the + on the top one fans the stack out, and dragging one out unstacks it.
   The desk is an arrangement of the same notes, so they are indexed, linked and exported as before. */
(function () {
  'use strict';
  var T = window.T, S = T.S, el = T.el, host, svg, on = false, drag = null, tieFrom = null;
  var COL = [['142,123,255', 'violet'], ['120,214,236', 'cyan'], ['199,239,158', 'green'], ['255,196,120', 'amber'], ['236,232,228', 'plain']];
  function board() { var e = S.lens && T.E.get(S.lens); return e && e.band === 'p' ? e.p.id : 'all'; }
  function pinned() { var b = board(); return (T.notes || []).filter(function (n) { return n.bd && n.bd.b === b; }); }
  function slot(b) { var i = (T.notes || []).filter(function (n) { return n.bd && n.bd.b === b; }).length; return { x: 8 + (i % 5) * 17 + (Math.floor(i / 20) * 3), y: 12 + (Math.floor(i / 5) % 4) * 20 }; }
  T.pinToDesk = function (n, x, y) {
    var b = board(), s = slot(b); n.bd = { b: b, x: x != null ? x : s.x, y: y != null ? y : s.y, c: (n.bd && n.bd.c) || 4, tie: (n.bd && n.bd.tie) || [] };
    T.saveNotes(); return n;
  };
  T.deskOpen = function () { return on; };
  T.desk = function (v) {
    on = v == null ? !on : !!v; var app = T.$('#app'); app.classList.toggle('clear', on);
    var b = T.$('#deskBtn'); if (b) b.setAttribute('aria-pressed', String(on));
    if (on) paint(); else if (document.activeElement && host.contains(document.activeElement)) document.activeElement.blur();
    if (T.sfx) T.sfx(on ? 'open' : 'close'); T.emit('desk', on);
  };
  function save() { T.saveNotes(); }
  function mk(n) {
    var c = COL[n.bd.c || 0] || COL[4], d = el('div', { class: 'bn', tabindex: '0', 'data-id': n.id, style: { left: n.bd.x + '%', top: n.bd.y + '%', '--bnc': c[0] }, role: 'group', 'aria-label': 'Pinned note: ' + n.text });
    var txt = el('div', { class: 'bn-t' }, n.text);
    var tag = el('span', { class: 'bn-g' }, (n.tag || 'idea') + ' · ' + c[1]);
    var dot = el('button', { class: 'bn-d', type: 'button', 'aria-label': 'Change colour', title: 'Colour: ' + c[1], on: { pointerdown: function (e) { e.stopPropagation(); }, click: function (e) { e.stopPropagation(); n.bd.c = ((n.bd.c || 0) + 1) % COL.length; save(); paint(); } } });
    var x = el('button', { class: 'bn-x', type: 'button', 'aria-label': 'Take off the desk', title: 'Take off the desk', on: { pointerdown: function (e) { e.stopPropagation(); }, click: function (e) { e.stopPropagation(); delete n.bd; T.notes.forEach(function (m) { if (m.bd && m.bd.tie) m.bd.tie = m.bd.tie.filter(function (id) { return id !== n.id; }); }); save(); paint(); } } }, '×');
    var lines = (n.lines || []).map(function (l) { return el('div', { class: 'bn-l' }, '+ ' + l.text); });
    d.appendChild(el('div', { class: 'bn-h' }, tag, dot, x)); d.appendChild(txt); lines.forEach(function (l) { d.appendChild(l); });
    d.addEventListener('pointerdown', function (e) {
      if (e.button || e.target.isContentEditable) return;
      var r = host.getBoundingClientRect(); d.setPointerCapture(e.pointerId);
      drag = { n: n, el: d, sx: e.clientX, sy: e.clientY, ox: n.bd.x, oy: n.bd.y, r: r, tie: e.shiftKey, moved: false };
      if (e.shiftKey) { tieFrom = n; }
    });
    d.addEventListener('pointermove', function (e) {
      if (!drag || drag.n !== n) return; var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; if (!drag.moved) return;
      if (drag.tie) { ties(e.clientX - drag.r.left, e.clientY - drag.r.top); return; }
      n.bd.x = Math.max(0, Math.min(92, drag.ox + dx / drag.r.width * 100)); n.bd.y = Math.max(0, Math.min(90, drag.oy + dy / drag.r.height * 100));
      d.style.left = n.bd.x + '%'; d.style.top = n.bd.y + '%'; ties();
    });
    d.addEventListener('pointerup', function (e) {
      if (!drag || drag.n !== n) return; var was = drag; drag = null; tieFrom = null;
      if (was.tie && was.moved) { var t = document.elementFromPoint(e.clientX, e.clientY), tn = t && t.closest && t.closest('.bn'); if (tn && tn.dataset.id !== n.id) { var other = tn.dataset.id; n.bd.tie = n.bd.tie || []; var i = n.bd.tie.indexOf(other); if (i >= 0) n.bd.tie.splice(i, 1); else n.bd.tie.push(other); save(); } ties(); return; }
      if (was.moved) {
        d.style.pointerEvents = 'none'; var under = document.elementFromPoint(e.clientX, e.clientY); d.style.pointerEvents = ''; var tb = under && under.closest && under.closest('.bn');
        if (tb && tb.dataset.id !== n.id && !tb.classList.contains('fanned')) { var base = pinned().filter(function (m) { return m.id === tb.dataset.id; })[0]; if (base && base.bd.on !== n.id) { var mine = pinned().filter(function (m) { return m.bd.on === n.id; }); n.bd.on = base.id; mine.forEach(function (m) { m.bd.on = base.id; }); n.bd.x = base.bd.x; n.bd.y = base.bd.y; save(); paint(); T.toast('Stacked under that note. The + shows how many; it fans them out.'); return; } }
        else if (n.bd.on) { delete n.bd.on; }
        save(); paint();
      }
    });
    d.addEventListener('dblclick', function (e) { e.stopPropagation(); edit(n, txt); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target === d) { e.preventDefault(); edit(n, txt); } else if ((e.key === 'Delete' || e.key === 'Backspace') && e.target === d) { delete n.bd; save(); paint(); } });
    return d;
  }
  function edit(n, txt) {
    txt.contentEditable = 'true'; txt.focus(); var r = document.createRange(); r.selectNodeContents(txt); var s = getSelection(); s.removeAllRanges(); s.addRange(r);
    txt.onblur = function () { txt.contentEditable = 'false'; var v = txt.textContent.trim(); if (!v) { delete n.bd; var i = T.notes.indexOf(n); if (i >= 0 && n.fresh && Date.now() - n.fresh < 60000 && n.text === '…') T.notes.splice(i, 1); } else if (v !== n.text) { n.text = v; if (T.compileNote) T.compileNote(n, false); } save(); paint(); };
    txt.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); txt.blur(); } else if (e.key === 'Escape') { e.stopPropagation(); txt.textContent = n.text; txt.blur(); } };
  }
  function ties(px, py) {
    if (!svg) return; var r = host.getBoundingClientRect(); svg.setAttribute('viewBox', '0 0 ' + r.width + ' ' + r.height); T.clear(svg);
    function ctr(id) { var e = host.querySelector('.bn[data-id="' + id + '"]'); if (!e) return null; var b = e.getBoundingClientRect(); return { x: b.left - r.left + b.width / 2, y: b.top - r.top + b.height / 2 }; }
    pinned().forEach(function (n) { (n.bd.tie || []).forEach(function (id) { var a = ctr(n.id), b = ctr(id); if (a && b) svg.appendChild(T.sv('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'bd-tie' })); }); });
    if (tieFrom && px != null) { var a2 = ctr(tieFrom.id); if (a2) svg.appendChild(T.sv('line', { x1: a2.x, y1: a2.y, x2: px, y2: py, class: 'bd-tie live' })); }
  }
  function paint() {
    if (!host) return; Array.prototype.slice.call(host.querySelectorAll('.bn')).forEach(function (n) { n.remove(); });
    var ns = pinned(), ids = {}; ns.forEach(function (n) { ids[n.id] = n; });
    var kids = {}; ns.forEach(function (n) { if (n.bd.on && ids[n.bd.on] && n.bd.on !== n.id) (kids[n.bd.on] = kids[n.bd.on] || []).push(n); else if (n.bd.on) delete n.bd.on; });
    ns.forEach(function (n) {
      if (n.bd.on && ids[n.bd.on]) return;
      var d0 = mk(n), ks = kids[n.id] || [];
      if (ks.length) { d0.classList.add('stacked'); d0.appendChild(el('button', { type: 'button', class: 'bn-s', 'aria-label': (n.bd.fan ? 'Fold' : 'Fan out') + ' the ' + ks.length + ' notes under this one', title: n.bd.fan ? 'Fold the stack' : 'Fan out the stack', on: { pointerdown: function (e) { e.stopPropagation(); }, click: function (e) { e.stopPropagation(); n.bd.fan = !n.bd.fan; save(); paint(); } } }, (n.bd.fan ? '− ' : '+ ') + ks.length)); }
      host.appendChild(d0);
      if (ks.length && n.bd.fan) ks.forEach(function (k, i) { var dk = mk(k); dk.style.left = n.bd.x + '%'; dk.style.top = n.bd.y + '%'; dk.style.marginTop = ((i + 1) * 3.9) + 'rem'; dk.classList.add('fanned'); host.appendChild(dk); });
    });
    var hint = host.querySelector('.bd-hint'); hint.hidden = ns.length > 0; hint.textContent = ns.length ? '' : (board() === 'all' ? 'Nothing pinned here yet. Double-click for a note; any note can be sent here from its tools.' : 'Nothing pinned to this project yet. Double-click for a note.');
    var lab = host.querySelector('.bd-lab'); lab.textContent = board() === 'all' ? 'Desk' : 'Desk · ' + T.projectName(board());
    ties();
  }
  T.initDesk = function () {
    host = T.$('#board'); svg = host.querySelector('svg');
    host.addEventListener('dblclick', function (e) {
      if (e.target !== host && !e.target.classList.contains('bd-hint') && e.target !== svg) return;
      var r = host.getBoundingClientRect(), tt = T.toast; T.toast = function () {};
      var n = T.addNote('…', { shelf: 0, x: 0, y: 0.4, z: 8 }, true); T.toast = tt;
      T.pinToDesk(n, Math.max(0, Math.min(86, (e.clientX - r.left) / r.width * 100 - 3)), Math.max(0, Math.min(84, (e.clientY - r.top) / r.height * 100 - 3)));
      paint(); var d = host.querySelector('.bn[data-id="' + n.id + '"]'); if (d) edit(n, d.querySelector('.bn-t'));
    });
    var btn = T.$('#deskBtn'); if (btn) btn.addEventListener('click', function () { T.desk(); });
    ['#deskFab', '#deskBack'].forEach(function (id) { var b2 = T.$(id); if (b2) b2.addEventListener('click', function () { T.desk(); }); });
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target, tag = (t.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;
      if (T.askOpen && T.askOpen()) return; if (T.settingsOpen && T.settingsOpen()) return;
      if ((e.key === 'h' || e.key === 'H')) { e.preventDefault(); T.desk(); } else if (e.key === 'Escape' && on) { e.preventDefault(); T.desk(false); }
    });
    ['lens', 'notes'].forEach(function (ev) { T.on(ev, function () { if (on) paint(); }); });
    window.addEventListener('resize', function () { if (on) ties(); });
  };
})();
