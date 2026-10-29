/* recall: everything put in is findable the moment it is put in, and an idea you have had before says so.
   One index over what the page holds — notes (and the lines folded into them), tasks, projects, dated things,
   commits, shared modules, and, when you have imported them, Claude Code sessions and the files they kept re-reading
   and an Obsidian vault. Words first: a small BM25 on the device, rebuilt as things change, with no model and no
   network. Meaning (embeddings) is a seam, `T.embedder`, that does nothing until a model is attached; nothing here
   claims more than words can do. Two jobs: `T.search(q, n)` for Ask and the models' context, and
   `T.similarNotes(text)` for the moment you are about to write something you wrote before: it shows the earlier note
   and offers to fold the new words into it as another line, append-only, never replacing. `[[Title]]` in a note makes
   a link to the note, task or thing of that name; the compiler's own word-matching is unchanged, so nobody has to learn
   the syntax to be linked. */
(function (root) {
  'use strict';
  var STOP = {}; 'a an and are as at be but by for from has have i if in into is it its me my of on or so that the their then there they this to was we were what when which with you your not no do does did can could should would will just about than too very also'.split(' ').forEach(function (w) { STOP[w] = 1; });
  function stem(w) { return w.length > 5 && /ing$/.test(w) ? w.slice(0, -3) : w.length > 4 && /ed$/.test(w) ? w.slice(0, -2) : w.length > 4 && /es$/.test(w) ? w.slice(0, -2) : w.length > 3 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w; }
  function tokens(text) { return String(text || '').toLowerCase().replace(/[^a-z0-9#\s\-_]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 1 && !STOP[w]; }).map(stem); }
  function grams(ts) { var o = ts.slice(); for (var i = 0; i + 1 < ts.length; i++) o.push(ts[i] + '_' + ts[i + 1]); return o; }

  // the engine: docs in, scored hits out
  function Index() { this.docs = []; this.df = {}; this.avg = 1; }
  Index.prototype.build = function (docs) {
    var df = {}, tot = 0; this.docs = docs.map(function (d) {
      var ts = grams(tokens(d.title + ' ' + d.text)), tf = {}; ts.forEach(function (t) { tf[t] = (tf[t] || 0) + 1; });
      Object.keys(tf).forEach(function (t) { df[t] = (df[t] || 0) + 1; }); tot += ts.length; return Object.assign({}, d, { tf: tf, len: ts.length });
    }); this.df = df; this.avg = tot / Math.max(1, this.docs.length); return this;
  };
  Index.prototype.idf = function (t) { var n = this.docs.length, d = this.df[t] || 0; return Math.log(1 + (n - d + 0.5) / (d + 0.5)); };
  Index.prototype.search = function (q, n, kinds) {
    var qs = grams(tokens(q)), self = this, k1 = 1.2, b = 0.75, out = [];
    if (!qs.length) return out;
    this.docs.forEach(function (d) {
      if (kinds && kinds.indexOf(d.kind) < 0) return;
      var s = 0; qs.forEach(function (t) { var f = d.tf[t]; if (f) s += self.idf(t) * f * (k1 + 1) / (f + k1 * (1 - b + b * d.len / self.avg)); });
      if (s > 0) out.push({ doc: d, score: s });
    });
    out.sort(function (a, b2) { return b2.score - a.score; }); return out.slice(0, n || 8);
  };
  // closeness of two texts, 0..1: cosine over idf-weighted words and word pairs
  Index.prototype.similar = function (text, n, kinds, skip) {
    var qs = grams(tokens(text)), qtf = {}, self = this, out = []; qs.forEach(function (t) { qtf[t] = (qtf[t] || 0) + 1; });
    var qn = 0; Object.keys(qtf).forEach(function (t) { var w = qtf[t] * self.idf(t); qn += w * w; }); qn = Math.sqrt(qn); if (!qn) return out;
    this.docs.forEach(function (d) {
      if ((kinds && kinds.indexOf(d.kind) < 0) || d.id === skip) return;
      var dot = 0, dn = 0; Object.keys(d.tf).forEach(function (t) { var w = d.tf[t] * self.idf(t); dn += w * w; if (qtf[t]) dot += w * qtf[t] * self.idf(t); });
      dn = Math.sqrt(dn); var c = dn ? dot / (qn * dn) : 0; if (c > 0.12) out.push({ doc: d, score: c });
    });
    out.sort(function (a, b2) { return b2.score - a.score; }); return out.slice(0, n || 3);
  };
  var API = { Index: Index, tokens: tokens };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }

  // ---------------------------------------------------------------- the page
  var T = root.T, el = T.el, G = T.G, SEED = T.SEED, IX = new Index(), dirty = true;
  function docs() {
    var out = [], pn = function (id) { var e = T.E.get('p:' + id); return e ? e.name : id; };
    (T.notes || []).forEach(function (n) { out.push({ id: n.id, kind: 'Note', title: '', text: n.text + ' ' + (n.lines || []).map(function (l) { return l.text; }).join(' ') + ' ' + (n.tag || ''), at: n.at, p: T.P.has(n.tag) ? n.tag : (n.att || null), w: 1 + (n.links || []).length + (n.lines || []).length, src: 'own', mood: n.ctx && typeof n.ctx.dev === 'number' ? n.ctx.dev : (n.ctx && typeof n.ctx.energy === 'number' ? 1 - Math.min(1, n.ctx.energy / 5) : null) }); });
    (T.tasks || []).forEach(function (t) { out.push({ id: t.id, kind: 'Task', title: t.title, text: [t.note, t.why, pn(t.p), t.status].filter(Boolean).join(' '), at: t.added, p: t.p, w: 1, done: t.status === 'done', src: t.agent === 'you' ? 'own' : 'model' }); });
    G.projects.forEach(function (p) { out.push({ id: 'p:' + p.id, kind: 'Project', title: p.name, text: (SEED.ambitions || {})[p.id] || '', p: p.id, w: T.recentCommits ? T.recentCommits(p.id) : 1, src: 'own' }); });
    (SEED.schedule || []).forEach(function (s, i) { out.push({ id: 's' + i, kind: 'Date', title: s.title, text: (s.note || '') + ' ' + pn(s.p || ''), at: s.at, p: s.p }); });
    (G.recent || []).slice(0, 400).forEach(function (c, i) { out.push({ id: 'c' + i, kind: 'Commit', title: c.s || '', text: pn(c.p) + ' ' + (c.who || ''), at: String(c.t || '').slice(0, 10), p: c.p, w: 1, src: /claude|agent|bot/i.test(c.a || '') ? 'model' : 'own' }); });
    (G.shared || []).forEach(function (m) { out.push({ id: 'm:' + m.id, kind: 'Module', title: m.name, text: (m.users || []).map(pn).join(' '), p: m.home, w: (m.users || []).length + 1, src: 'borrowed' }); });
    (T.usageSessionList ? T.usageSessionList() : []).forEach(function (s) {
      out.push({ id: 'u:' + s.id, kind: 'Session', title: s.project + ' — ' + String(s.first || '').slice(0, 10), text: Object.keys(s.tools || {}).slice(0, 8).join(' ') + ' ' + s.entry, at: String(s.last || '').slice(0, 10), w: Math.round(s.units || 1), src: 'model' });
      (s.rereads || []).forEach(function (r) { out.push({ id: 'f:' + s.id + r[0], kind: 'File', title: r[0], text: s.project, at: String(s.last || '').slice(0, 10), w: r[1], src: 'model' }); });
    });
    (T.vaultNotes ? T.vaultNotes() : []).forEach(function (v) { out.push({ id: 'v:' + v.path, kind: 'Vault', title: v.title, text: v.body, at: v.at, w: 1, src: 'own' }); });
    return out;
  }
  T.indexDocs = function () { return docs(); };
  function ix() { if (dirty) { IX.build(docs()); dirty = false; } return IX; }
  T.reindex = function () { dirty = true; };
  T.search = function (q, n, kinds) { return ix().search(q, n, kinds).map(function (h) { return { id: h.doc.id, kind: h.doc.kind, title: h.doc.title, text: (h.doc.title ? h.doc.title + ' — ' : '') + h.doc.text, at: h.doc.at, score: h.score }; }); };
  T.indexSize = function () { return ix().docs.length; };
  T.indexKinds = function () { var o = {}; ix().docs.forEach(function (d) { o[d.kind] = (o[d.kind] || 0) + 1; }); return o; };
  // earlier notes close to these words; the new text is never in the index yet
  T.similarNotes = function (text, n, skip) {
    if (tokens(text).length < 3) return [];
    return ix().similar(text, n || 2, ['Note', 'Vault'], skip).filter(function (h) { return h.score >= 0.34; }).map(function (h) { var note = (T.notes || []).filter(function (x) { return x.id === h.doc.id; })[0]; return { id: h.doc.id, kind: h.doc.kind, note: note, text: note ? note.text : h.doc.title, at: h.doc.at, score: h.score, same: h.score >= 0.55 }; });
  };
  // fold new words into an earlier note as another line: appended, dated, never replacing
  T.foldNote = function (id, text) {
    var n = (T.notes || []).filter(function (x) { return x.id === id; })[0]; if (!n) return false;
    var d = new Date(); n.lines = (n.lines || []).concat([{ at: d.getFullYear() + '-' + T.pad(d.getMonth() + 1) + '-' + T.pad(d.getDate()), text: String(text).trim() }]);
    if (T.compileNote) T.compileNote(n, false); T.saveNotes(); dirty = true; T.toast('Added to the note you wrote on ' + n.at + ', not kept twice.'); return true;
  };
  // [[Title]] → the note, task, or thing of that name
  function refs(n) {
    var out = [], re = /\[\[([^\]]+)\]\]/g, m; n.refs = [];
    while ((m = re.exec(n.text))) {
      var t = m[1].trim(), hit = ix().search(t, 1, ['Note', 'Task', 'Project', 'Module', 'Vault'])[0];
      if (hit && hit.doc.id !== n.id) { n.refs.push(hit.doc.id); if (/^(p:|m:)/.test(hit.doc.id) || hit.doc.kind === 'Task') { n.links = n.links || []; if (n.links.indexOf(hit.doc.id) < 0) n.links.push(hit.doc.id); } }
    }
    return n.refs;
  }
  T.noteRefs = function (n) { return (n.refs || []).map(function (id) { return ix().docs.filter(function (d) { return d.id === id; })[0]; }).filter(Boolean); };
  T.backlinks = function (id) { return (T.notes || []).filter(function (n) { return (n.refs || []).indexOf(id) >= 0; }); };

  T.initRecall = function () {
    var cn = T.compileNote; T.compileNote = function (n, fresh) { var r = cn.call(T, n, fresh); dirty = true; refs(n); return r; };
    ['notes', 'tasks', 'usage', 'vault'].forEach(function (ev) { T.on(ev, T.reindex); });
    var sv = T.saveNotes; T.saveNotes = function () { dirty = true; return sv.apply(T, arguments); };
    var at = T.addTask; T.addTask = function () { var r2 = at.apply(T, arguments); dirty = true; return r2; };
    // as you type a note: have you had this before
    var inp = T.$('#noteIn'), box = T.$('#noteSim'); if (!inp || !box) return;
    function show() {
      T.clear(box); var hits = T.similarNotes(inp.value, 1); box.hidden = !hits.length; if (!hits.length) return;
      var h = hits[0]; box.appendChild(el('span', { class: 'ns-k' }, h.same ? 'You wrote this' : 'Close to'));
      box.appendChild(el('span', { class: 'ns-t' }, (h.note ? h.note.text : h.text).slice(0, 140) + (h.at ? ' · ' + h.at : '')));
      if (h.note) box.appendChild(el('button', { type: 'button', class: 'chip', on: { pointerdown: function (ev) { ev.preventDefault(); T.foldNote(h.id, inp.value); inp.value = ''; box.hidden = true; inp.blur(); } } }, 'Add as a line'));
    }
    inp.addEventListener('input', show); inp.addEventListener('blur', function () { setTimeout(function () { box.hidden = true; }, 200); });
  };
})(typeof window !== 'undefined' ? window : this);
