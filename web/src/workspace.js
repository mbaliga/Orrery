/* Making the page yours: the first-run sheet (load your own scan and content, name your GitHub account), "Where each project
   runs" (a platform editor that overrides what a scan can infer), and going back to the built-in data. Pure helpers are
   exported for node. */
(function () {
  'use strict';

  // a graph file is `window.TRACKER_GRAPH = {...};` (build_data.py) or plain JSON
  function parseGraph(text) {
    var t = String(text).replace(/^\s*(?:window\.TRACKER_GRAPH\s*=\s*)?/, '').replace(/;\s*$/, '');
    try { var g = JSON.parse(t); } catch (e) { return { err: 'That file is not JSON, or a graph.js from scan/build_data.py.' }; }
    if (!g || !Array.isArray(g.projects) || !Array.isArray(g.clusters)) return { err: 'That does not look like a graph: it has no projects and clusters.' };
    return { graph: g };
  }
  function parseSeed(text) {
    if (/^\s*(?:\/\/|window\.|var |const )/.test(text)) return { err: 'That is a seed.js, which is code. Turn it into JSON first: node scan/tojson.js seed.js > seed.json' };
    try { var s = JSON.parse(text); } catch (e) { return { err: 'That file is not JSON.' }; }
    if (!s || typeof s !== 'object' || Array.isArray(s)) return { err: 'That does not look like a seed.' };
    return { seed: s };
  }
  // the content of a workspace that has a scan but no notes of its own: the built-in seed's shape, with none of its content
  function emptySeed(seed) {
    var s = JSON.parse(JSON.stringify(seed || {}));
    ['tasks', 'schedule', 'undated', 'notes', 'chains', 'completion', 'blocks', 'targets'].forEach(function (k) { s[k] = []; });
    ['ambitions', 'aliases', 'pages', 'facts', 'platforms', 'platformsNot'].forEach(function (k) { s[k] = {}; });
    s.throughput = { opened: [], closed: [], cycle: (seed && seed.throughput && seed.throughput.cycle) || 0 };
    s.sounds = (s.sounds || []).map(function (x) { x.n = 0; x.median = 0; return x; });
    s.earlier = ''; s.repoOwner = '';
    return s;
  }
  var core = { parseGraph: parseGraph, parseSeed: parseSeed, emptySeed: emptySeed };
  if (typeof module !== 'undefined' && module.exports) { module.exports = core; return; }

  var T = window.T, el = T.el, G = T.G, SEED = T.SEED, BUILD = window.ORRERY_BUILD || {};
  var sheet = null;

  T.sheetOpen = function () { return !!sheet; };
  T.repoOwner = function () { return T.store.get('repoOwner', '') || (SEED && SEED.repoOwner) || ''; };

  function closeSheet(done) {
    if (!sheet) return;
    var s = sheet; sheet = null; s.remove(); document.documentElement.classList.remove('setting');
    if (done) done();
  }
  function openSheet(title, kids, onClose) {
    closeSheet();
    var box = el('div', { class: 'sheet ws', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
    var inn = el('div', { class: 'sheet-in ws-in' });
    kids.forEach(function (k) { inn.appendChild(k); });
    box.appendChild(inn); document.body.appendChild(box); sheet = box;
    box.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); closeSheet(onClose); } });
    box.addEventListener('mousedown', function (ev) { if (ev.target === box) closeSheet(onClose); });
    var f = box.querySelector('button, input'); if (f) f.focus();
    return box;
  }
  function readText(file) { return file.text ? file.text() : new Promise(function (ok) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.readAsText(file); }); }

  T.userDataActive = function () { return !!window.ORRERY_USER; };
  T.userDataClear = function () { T.store.del('userdata'); location.reload(); };
  // files: a graph (required) and optionally a seed; owner: the GitHub account the links point at
  T.userDataLoad = function (files, owner, cb) {
    var list = Array.prototype.slice.call(files || []), graph = null, seed = null, names = [], err = '';
    Promise.all(list.map(function (f) { return readText(f).then(function (t) {
      var g = parseGraph(t);
      if (g.graph && !graph) { graph = g.graph; names.push(f.name); return; }
      var s = parseSeed(t);
      if (s.seed && s.seed.tasks && !seed) { seed = s.seed; names.push(f.name); return; }
      err = err || (g.err && s.err ? (/graph|projects/.test(f.name) ? g.err : s.err) : '') || g.err;
    }); })).then(function () {
      if (!graph) return cb(err || 'No graph in those files. It is the graph.js that scan/build_data.py writes.');
      var finalSeed = seed || emptySeed(SEED);
      if (owner) finalSeed.repoOwner = owner;
      try { localStorage.setItem('tracker.userdata', JSON.stringify({ graph: graph, seed: finalSeed, at: new Date().toISOString(), files: names })); }
      catch (e) { return cb('This browser would not keep that much (its storage is full or blocked).'); }
      if (owner) T.store.set('repoOwner', owner);
      cb(null); location.reload();
    });
  };

  // ------------------------------------------------------------------ the first-run sheet
  function welcome() {
    var g = null, s = null, msg = el('p', { class: 'ws-msg', role: 'status' });
    var gIn = el('input', { type: 'file', accept: '.js,.json,application/json', multiple: true, 'aria-label': 'Your graph.js, and optionally your seed.json' });
    var owner = el('input', { type: 'text', class: 'ws-text', placeholder: 'your-github-name', 'aria-label': 'Your GitHub account name', value: T.repoOwner() });
    var go = el('button', { class: 'ws-btn ws-main', type: 'button', on: { click: function () {
      if (!gIn.files.length) { msg.textContent = 'Choose your graph.js first.'; return; }
      msg.textContent = 'Reading…';
      T.userDataLoad(gIn.files, owner.value.trim().replace(/[^A-Za-z0-9-]/g, ''), function (e) { if (e) msg.textContent = e; });
    } } }, 'Use my workspace');
    var step = function (n, head, body) { return el('li', null, el('b', null, head), body); };
    var code = function (t) { return el('code', { class: 'ws-code' }, t); };
    openSheet('Welcome to Orrery', [
      el('h2', null, 'This is a sample workspace'),
      el('p', null, 'Every name here is made up; the numbers and shapes are real. Orrery shows your own repos, tasks and notes the same way, and it does it all in this browser: nothing is uploaded, and nothing phones home. Load yours in a few minutes, no rebuild needed.'),
      el('h3', null, 'Bring your own'),
      el('ol', { class: 'ws-steps' },
        step(1, 'Scan your repos', el('span', null, ' with git alone, no token: ', code('python3 scan/scan.py cache scan.json owner/repo owner/repo'), ' then ', code('python3 scan/prs.py cache scan.json prs.json'), ' then ', code('python3 scan/build_data.py scan.json prs.json graph.js'), '. Set ', code('ORRERY_ME'), ' to your name or email so your commits count as yours.')),
        step(2, 'Your notes and tasks (optional)', el('span', null, ' start empty, or turn a seed.js into JSON with ', code('node scan/tojson.js seed.js > seed.json'), '.')),
        step(3, 'Load them here', el('span', null, ' graph.js, and seed.json if you have one. They stay in this browser until you choose “Back to the built-in data” in Settings.'))),
      el('div', { class: 'ws-form' },
        el('label', { class: 'ws-l' }, 'Your files', gIn),
        el('label', { class: 'ws-l' }, 'Your GitHub name, for links', owner),
        el('div', { class: 'ws-row' }, go, el('button', { class: 'ws-btn', type: 'button', on: { click: function () { T.store.set('welcomeSeen', true); closeSheet(); } } }, 'Keep exploring the sample'))),
      msg,
      el('p', { class: 'cap' }, 'Reopen this from Settings > Data > Load my workspace.')
    ], function () { T.store.set('welcomeSeen', true); });
  }
  T.openWelcome = welcome;

  // ------------------------------------------------------------------ where each project runs
  T.openRunsOn = function () {
    var dirty = false, set = T.store.get('platforms', {}) || {}, list = el('div', { class: 'ws-list' });
    function paint() {
      T.clear(list);
      G.projects.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (p) {
        var inferred = (T.platformsInferred || {})[p.id] || [], cur = Array.isArray(set[p.id]) ? set[p.id] : inferred;
        var row = el('div', { class: 'ws-prow' }, el('b', { class: 'ws-pn' }, p.name), el('span', { class: 'ws-ps cap' }, p.repo || ''));
        var chips = el('div', { class: 'ws-chips', role: 'group', 'aria-label': 'Where ' + p.name + ' runs' });
        T.PLATFORMS.forEach(function (f) {
          var on = cur.indexOf(f.id) >= 0, read = inferred.indexOf(f.id) >= 0;
          chips.appendChild(el('button', { type: 'button', class: 'ws-chip' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', title: f.rule,
            on: { click: function () {
              var next = cur.filter(function (x) { return x !== f.id; }); if (!on) next.push(f.id);
              var same = next.length === inferred.length && next.every(function (x) { return inferred.indexOf(x) >= 0; });
              if (same) delete set[p.id]; else set[p.id] = next;
              T.store.set('platforms', set); dirty = true; paint();
            } } }, (on ? '✓ ' : '') + f.name + (read ? ' · read' : on ? ' · yours' : '')));
        });
        row.appendChild(chips); list.appendChild(row);
      });
    }
    paint();
    var done = function () { closeSheet(function () { if (dirty) { T.toast('Saved. Redrawing the ring.'); setTimeout(function () { location.reload(); }, 400); } }); };
    openSheet('Where each project runs', [
      el('h2', null, 'Where each project runs'),
      el('p', null, 'Orrery reads this from what each repo is built with. A scan cannot see everything: a Kotlin-free repo that still ships to an Android phone, a tool for one device. Tick what is true. “read” marks what the scan found; “yours” is what you added or kept. Your choice wins over the scan and is kept in this browser.'),
      list,
      el('div', { class: 'ws-row' }, el('button', { class: 'ws-btn ws-main', type: 'button', on: { click: done } }, 'Done'),
        el('button', { class: 'ws-btn', type: 'button', on: { click: function () { set = {}; T.store.set('platforms', set); dirty = true; paint(); } } }, 'Back to what the scan read'))
    ], function () { if (dirty) setTimeout(function () { location.reload(); }, 200); });
  };

  T.initWorkspace = function () {
    if (BUILD.sample && !T.userDataActive() && !T.store.get('welcomeSeen', false) && !T.isVisitor()) setTimeout(welcome, 600);
  };
})();
