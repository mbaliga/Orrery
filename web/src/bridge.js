/* bridge: the doors in and out.
   Obsidian — a vault is a folder of Markdown with front matter, [[wikilinks]], #tags and checkboxes, and that is the
   whole interface: open one and its notes join the index and the map as `Vault` nodes; send a note out and it is a
   plain .md file with front matter a vault understands. Orrery does not run Obsidian's plugins (they need Obsidian's
   own API); it speaks the files, which are open.
   Baseline — a check-in file (`checkin/1`: at, deviation 0..1) is drawn, never computed here: how far a phrase's
   delivery sat from your own baseline, kept beside the note written nearest in time.
   Fonebrew — a task leaves as `handoff/1`: the task, its project and repo, the notes and files the graph says are tied
   to it, as a file Fonebrew's Agent (or any model) can be given. The other direction, Fonebrew's own usage ledger, is
   `usage/1`, the same shape the Usage module reads and writes.
   Voice — answers can be read aloud with the device's own voice; speech in is the browser's recogniser, an online
   service in Chrome, and is said to be. The pure parsers and the zip writer run in node too (scan/bridgetest.js). */
(function (root) {
  'use strict';
  // ---------------------------------------------------------------- Markdown the way a vault writes it
  function parseMd(text, path) {
    var fm = {}, body = String(text || '');
    var m = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (m) { body = body.slice(m[0].length); m[1].split(/\r?\n/).forEach(function (l) { var q = l.match(/^([\w-]+):\s*(.*)$/); if (q) fm[q[1]] = q[2].replace(/^["']|["']$/g, '').replace(/^\[|\]$/g, ''); }); }
    var links = [], tags = {}, tasks = [], re = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g, t;
    while ((t = re.exec(body))) if (links.indexOf(t[1].trim()) < 0) links.push(t[1].trim());
    (body.match(/(?:^|\s)#([A-Za-z][\w\/-]*)/g) || []).forEach(function (x) { tags[x.trim().slice(1).toLowerCase()] = 1; });
    (fm.tags || '').split(/[,\s]+/).filter(Boolean).forEach(function (x) { tags[x.replace(/^#/, '').toLowerCase()] = 1; });
    body.split(/\r?\n/).forEach(function (l) { var k = l.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/); if (k) { var due = k[2].match(/(?:📅|due:?)\s*(\d{4}-\d{2}-\d{2})/); tasks.push({ done: k[1] !== ' ', text: k[2].replace(/(?:📅|⏳|🛫|✅)\s*\d{4}-\d{2}-\d{2}/g, '').trim(), due: due ? due[1] : null }); } });
    var h1 = body.match(/^#\s+(.+)$/m), name = String(path || '').split('/').pop().replace(/\.md$/i, '');
    return { title: (fm.title || (h1 && h1[1]) || name).trim(), path: path || name, fm: fm, body: body.trim(), links: links, tags: Object.keys(tags), tasks: tasks };
  }
  function canvasText(json, path) {
    var c; try { c = JSON.parse(json); } catch (e) { return null; }
    var nodes = (c.nodes || []).filter(function (n) { return n.type === 'text' && n.text; }).map(function (n) { return n.text; });
    return nodes.length ? { title: String(path || '').split('/').pop().replace(/\.canvas$/i, '') + ' (canvas)', path: path, fm: {}, body: nodes.join('\n\n'), links: [], tags: [], tasks: [] } : null;
  }
  function slug(s) { return String(s || 'note').replace(/[\\/:*?"<>|#^\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70) || 'note'; }
  function noteToMd(n, name) {
    var fm = ['---', 'title: "' + String(n.text).replace(/"/g, "'").slice(0, 80) + '"', 'orrery_id: ' + n.id, 'created: ' + (n.at || ''), 'tags: [' + [n.tag || 'idea'].join(', ') + ']'];
    if (n.bd) fm.push('desk: { x: ' + n.bd.x.toFixed(1) + ', y: ' + n.bd.y.toFixed(1) + ' }');
    fm.push('---', '', n.text, '');
    (n.lines || []).forEach(function (l) { fm.push('- ' + l.at + ': ' + l.text); });
    var ln = name ? name(n) : []; if (ln.length) { fm.push('', 'Tied to: ' + ln.map(function (x) { return '[[' + x + ']]'; }).join(' ')); }
    return fm.join('\n') + '\n';
  }
  // ---------------------------------------------------------------- a zip, stored (no compression): enough for a folder of notes
  var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function u16(n) { return [n & 255, (n >>> 8) & 255]; } function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
  function zip(files) {
    var enc = new TextEncoder(), out = [], cen = [], off = 0, d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)), dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate());
    files.forEach(function (f) {
      var nm = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
      var h = [0x50, 0x4b, 3, 4].concat(u16(20), u16(0x0800), u16(0), u16(dt), u16(dd), u32(crc), u32(data.length), u32(data.length), u16(nm.length), u16(0));
      out.push(Uint8Array.from(h), nm, data);
      cen.push(Uint8Array.from([0x50, 0x4b, 1, 2].concat(u16(20), u16(20), u16(0x0800), u16(0), u16(dt), u16(dd), u32(crc), u32(data.length), u32(data.length), u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), nm);
      off += h.length + nm.length + data.length;
    });
    var csz = cen.reduce(function (a, x) { return a + x.length; }, 0), end = Uint8Array.from([0x50, 0x4b, 5, 6, 0, 0, 0, 0].concat(u16(files.length), u16(files.length), u32(csz), u32(off), u16(0)));
    var all = out.concat(cen, [end]), tot = all.reduce(function (a, x) { return a + x.length; }, 0), res = new Uint8Array(tot), p = 0; all.forEach(function (x) { res.set(x, p); p += x.length; }); return res;
  }
  var API = { parseMd: parseMd, canvasText: canvasText, noteToMd: noteToMd, zip: zip, crc32: crc32, slug: slug };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }

  // ---------------------------------------------------------------- the page
  var T = root.T, el = T.el;
  var VAULT = T.store.get('vault', { name: '', notes: [], at: null, tasks: 0, cut: 0 });
  T.vaultNotes = function () { return VAULT.notes; };
  T.vaultInfo = function () { return VAULT; };
  T.vaultImport = function (files, done) {
    var list = Array.prototype.slice.call(files).filter(function (f) { return /\.(md|markdown|canvas)$/i.test(f.name) && !/(^|\/)\.(obsidian|trash)\//.test(f.webkitRelativePath || ''); }), notes = [], left = list.length, tasks = 0, cut = 0;
    if (!left) { done(0); return; }
    var root0 = (list[0].webkitRelativePath || '').split('/')[0];
    list.forEach(function (f) {
      f.text().then(function (txt) {
        var rel = f.webkitRelativePath || f.name, p = /\.canvas$/i.test(f.name) ? canvasText(txt, rel) : parseMd(txt, rel);
        if (p) { tasks += p.tasks.filter(function (x) { return !x.done; }).length; notes.push({ path: p.path, title: p.title, body: p.body.slice(0, 1500), at: f.lastModified ? new Date(f.lastModified).toISOString().slice(0, 10) : '', tags: p.tags, links: p.links, open: p.tasks.filter(function (x) { return !x.done; }).length }); }
      }).catch(function () {}).then(function () { if (!--left) fin(); });
    });
    function fin() {
      notes.sort(function (a, b) { return (b.at || '').localeCompare(a.at || ''); }); if (notes.length > 800) { cut = notes.length - 800; notes = notes.slice(0, 800); }
      VAULT = { name: root0 || 'a vault', notes: notes, at: new Date().toISOString(), tasks: tasks, cut: cut };
      try { T.store.set('vault', VAULT); } catch (e) { VAULT.notes = VAULT.notes.slice(0, 300); VAULT.cut += 500; try { T.store.set('vault', VAULT); } catch (e2) {} }
      T.emit('vault'); done(notes.length);
    }
  };
  T.vaultForget = function () { VAULT = { name: '', notes: [], at: null, tasks: 0, cut: 0 }; T.store.set('vault', VAULT); T.emit('vault'); };
  function download(name, data, type) { var a = el('a', { href: URL.createObjectURL(new Blob([data], { type: type })), download: name }); document.body.appendChild(a); a.click(); a.remove(); }
  // every note as a file a vault reads, in one zip; the names it is tied to become [[wikilinks]]
  T.vaultExport = function () {
    var used = {}, files = (T.notes || []).map(function (n) {
      var nm = slug(n.text.split(/[.!?\n]/)[0]), i = 1, base = nm; while (used[nm]) nm = base + ' ' + (++i); used[nm] = 1;
      return { name: 'Orrery/' + nm + '.md', text: noteToMd(n, function (x) { return T.noteLinks ? T.noteLinks(x).filter(function (l) { return l.band !== 'h'; }).map(function (l) { return l.name; }) : []; }) };
    });
    files.push({ name: 'Orrery/README.md', text: '# Orrery\n\nNotes sent from Orrery on ' + new Date().toISOString().slice(0, 10) + '. Each has front matter (`orrery_id`, `created`, `tags`, and `desk` for its place on the desk) and links to what it is tied to as wikilinks. Edit freely; Orrery reads vaults, it does not own them.\n' });
    download('orrery-notes.zip', zip(files), 'application/zip'); return files.length - 1;
  };
  // ---------------------------------------------------------------- Baseline: check-ins from the engine, drawn, never computed
  var BL = T.store.get('baseline', []);
  T.baselineImport = function (text) {
    var j; try { j = JSON.parse(text); } catch (e) { return -1; } var arr = Array.isArray(j) ? j : j && (j.records || j.checkins) || []; var n = 0;
    arr.forEach(function (r) { if (r && r.at && typeof r.deviation === 'number' && r.deviation >= 0 && r.deviation <= 1 && !isNaN(new Date(r.at))) { BL.push({ at: new Date(r.at).toISOString(), dev: r.deviation, src: r.src || 'baseline' }); n++; } });
    BL.sort(function (a, b) { return a.at < b.at ? -1 : 1; }); var seen = {}; BL = BL.filter(function (r) { if (seen[r.at]) return false; seen[r.at] = 1; return true; }).slice(-2000); T.store.set('baseline', BL); tie(); T.emit('baseline'); return n;
  };
  T.baselineList = function () { return BL; };
  function nearest(ms) { var best = null, bd = 3 * 3600e3; BL.forEach(function (r) { var d = Math.abs(new Date(r.at).getTime() - ms); if (d < bd) { bd = d; best = r; } }); return best; }
  function tie() { var ch = false; (T.notes || []).forEach(function (n) { var ms = n.fresh || (n.at ? new Date(n.at).getTime() : 0); if (!ms || !n.fresh) return; var r = nearest(ms); if (r) { n.ctx = n.ctx || {}; if (n.ctx.dev !== r.dev) { n.ctx.dev = r.dev; ch = true; } } }); if (ch) T.saveNotes(); }
  // ---------------------------------------------------------------- Fonebrew: a task, with what the graph ties to it, as a file
  T.handoff = function (taskId) {
    var t = (T.tasks || []).filter(function (x) { return x.id === taskId; })[0]; if (!t) return null;
    var p = T.G.projects.filter(function (x) { return x.id === t.p; })[0] || {}, notes = (T.notesFor ? T.notesFor(t.id).concat(T.notesFor('p:' + t.p)) : []).filter(function (n, i, a) { return a.indexOf(n) === i; }).slice(0, 12);
    var q = [t.title, t.note, t.why].filter(Boolean).join(' '), files = (T.search ? T.search(q, 12, ['File']) : []).map(function (h) { return h.title; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 8);
    var prior = (T.search ? T.search(q, 8, ['Session']) : []).map(function (h) { return h.title; });
    return { schema: 'handoff/1', at: new Date().toISOString(), task: { id: t.id, title: t.title, note: t.note || '', why: t.why || '', status: t.status }, project: { id: t.p, name: p.name || t.p, repo: p.repo || null, branch: p.branch || null },
      context: { notes: notes.map(function (n) { return { at: n.at, text: n.text + (n.lines ? ' ' + n.lines.map(function (l) { return l.text; }).join(' ') : '') }; }), files: files, earlier_sessions: prior },
      ask: 'Plan before code; propose a ChangeSet for per-hunk review; do not commit without review.', note: 'Files and notes are what the graph ties to the task, not a guarantee they are the right ones.' };
  };
  T.handoffPrompt = function (h) { return 'Task: ' + h.task.title + (h.task.note ? '\n' + h.task.note : '') + (h.task.why ? '\nWhy: ' + h.task.why : '') + '\nProject: ' + h.project.name + (h.project.repo ? ' (' + h.project.repo + ')' : '') + (h.context.notes.length ? '\n\nNotes tied to it:\n' + h.context.notes.map(function (n) { return '- ' + n.text; }).join('\n') : '') + (h.context.files.length ? '\n\nFiles earlier sessions kept returning to:\n' + h.context.files.map(function (f) { return '- ' + f; }).join('\n') : '') + '\n\n' + h.ask; };
  T.handoffSave = function (taskId) { var h = T.handoff(taskId); if (!h) return false; download('handoff-' + taskId + '.json', JSON.stringify(h, null, 1), 'application/json'); if (navigator.clipboard) navigator.clipboard.writeText(T.handoffPrompt(h)).then(function () { T.toast('Handoff saved, and the prompt copied.'); }, function () { T.toast('Handoff saved.'); }); else T.toast('Handoff saved.'); return true; };
  // ---------------------------------------------------------------- voice out
  var VOICE = T.store.get('voice', { out: false });
  T.voice = { out: function () { return !!VOICE.out; }, setOut: function (v) { VOICE.out = !!v; T.store.set('voice', VOICE); if (!v && root.speechSynthesis) root.speechSynthesis.cancel(); },
    speak: function (text) { if (!VOICE.out || !root.speechSynthesis || !text) return; try { root.speechSynthesis.cancel(); var u = new root.SpeechSynthesisUtterance(String(text).replace(/\[[^\]]+\]/g, '').slice(0, 600)); u.rate = 1.02; root.speechSynthesis.speak(u); } catch (e) {} } };
  T.initBridge = function () { T.on('notes', function () { if (BL.length) tie(); }); };
})(typeof window !== 'undefined' ? window : this);
