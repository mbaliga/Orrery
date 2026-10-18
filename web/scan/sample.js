#!/usr/bin/env node
/* sample.js — make the public sample data from a real workspace.
   Orrery's app is open; a person's workspace is theirs. The build reads `src/graph.js` and `src/seed.js` (the scan and
   the curated content), which never leave the owner's private repo. This script derives `graph.sample.js` and
   `seed.sample.js` from them: the same shapes, the same counts and dates, but every project, group, module, task, note
   and page renamed to something that says nothing. Languages, libraries, platforms and agent names are public already
   and stay. Usage: node scan/sample.js   (reads src/graph.js + src/seed.js, writes src/*.sample.js) */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, '..', 'src');
function load(file, key) { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(SRC, file), 'utf8'), ctx); return ctx.window[key]; }
const G = load('graph.js', 'TRACKER_GRAPH'), SEED = load('seed.js', 'TRACKER_SEED');

const WORDS = 'alder birch cedar damson elder fig ginkgo hazel ilex juniper katsura larch maple nutmeg olive pine quince rowan sorbus tamarind umbrella vine walnut yew zelkova aspen beech cypress'.split(' ');
const cap = s => s[0].toUpperCase() + s.slice(1);
const pmap = {}, cmap = {}, smap = {};
G.projects.forEach((p, i) => { pmap[p.id] = { id: 'p' + (i + 1), name: cap(WORDS[i % WORDS.length]) + (i >= WORDS.length ? ' ' + Math.floor(i / WORDS.length + 1) : '') }; });
(G.clusters || []).forEach((c, i) => { cmap[c[0]] = { id: 'g' + (i + 1), name: 'Group ' + String.fromCharCode(65 + i) }; });
(G.shared || []).forEach((s, i) => { smap[s.id] = { id: 'mod-' + (i + 1), name: 'module-' + (i + 1) }; });
const P = id => (pmap[id] || {}).id || id, PN = id => (pmap[id] || {}).name || id;

// the graph: rename, keep every number
const g = JSON.parse(JSON.stringify(G));
g.clusters = g.clusters.map(c => [cmap[c[0]].id, cmap[c[0]].name]);
g.projects = g.projects.map(p => Object.assign({}, p, { id: P(p.id), name: PN(p.id), repo: PN(p.id).toLowerCase().replace(/ /g, '-'), cluster: cmap[p.cluster] ? cmap[p.cluster].id : p.cluster, branch: 'main',
  shared: (p.shared || []).map(s => smap[s] ? smap[s].id : s) }));
g.shared = (g.shared || []).map(s => Object.assign({}, s, { id: smap[s.id].id, name: smap[s.id].name, home: P(s.home), users: (s.users || []).map(P) }));
['recent', 'changes', 'merged', 'moves'].forEach(k => { if (!Array.isArray(g[k])) return; g[k] = g[k].map(x => { const y = Object.assign({}, x); if (y.repos) y.repos = y.repos.map(r => Array.isArray(r) ? [P(r[0])].concat(r.slice(1)) : P(r)); if (y.p) y.p = P(y.p); if (y.project) y.project = P(y.project); if (y.title) y.title = 'A change in ' + PN(y.p || (y.repos && y.repos[0] && (Array.isArray(y.repos[0]) ? y.repos[0][0] : y.repos[0])) || ''); if (y.msg) y.msg = y.title || 'A commit'; return y; }); });
if (g.lane_share) g.lane_share = g.lane_share;   // shares are numbers only
if (g.agent_last) Object.keys(g.agent_last).forEach(a => { const v = g.agent_last[a]; if (v && v.p) v.p = P(v.p); if (v && v.repo) v.repo = P(v.repo); });
fs.writeFileSync(path.join(SRC, 'graph.sample.js'), '// Sample scan, derived from a real workspace with every name replaced (scan/sample.js). Shapes and numbers are real.\nwindow.TRACKER_GRAPH = ' + JSON.stringify(g) + ';\n');

// the seed: generic words, the same ids, dates and links
const s = JSON.parse(JSON.stringify(SEED));
const KIND = ['Write the brief', 'Fix the build', 'Review the draft', 'Ship the beta', 'Measure the baseline', 'Answer the reviewers', 'Record the demo', 'Carve out the module', 'Port the screen', 'Tune the model'];
let n = 0;
(s.tasks || []).forEach(t => { n++; t.title = KIND[n % KIND.length] + ' for ' + PN(t.p); if (t.p) t.p = P(t.p); if (t.also) t.also = t.also.map(P); if (t.note) t.note = 'A note on the task.'; if (t.why) t.why = 'Why it matters, in one line.'; if (t.url) delete t.url; });
(s.schedule || []).forEach((d, i) => { d.title = (d.hard ? 'Deadline ' : 'Milestone ') + (i + 1); if (d.p) d.p = P(d.p); if (d.note) d.note = 'What this date is for.'; if (d.url) delete d.url; if (d.where) d.where = 'Somewhere'; });
if (s.undated) s.undated = s.undated.map(u => ['A launch on its own clock', 'Undated on purpose.', P(u[2])]);
if (s.sprint) s.sprint.label = 'A sprint, about twelve hours a week';
if (s.pages) s.pages = {};
if (s.aliases) { const a = {}; Object.keys(s.aliases).forEach(k => { const v = s.aliases[k]; if (pmap[v]) a[(PN(v) + ' app').toLowerCase()] = P(v); }); s.aliases = a; }
if (s.ambitions) { const a = {}; Object.keys(s.ambitions).forEach(k => { a[P(k)] = 'What ' + PN(k) + ' is for, in a sentence or two, as the owner wrote it.'; }); s.ambitions = a; }
if (s.earlier) s.earlier = 'Three apps went live earlier this year';
(s.notes || []).forEach((q, i) => { q.text = 'A thought about ' + PN((q.p || q.links && q.links[0] || '').replace(/^p:/, '')) + ', kept at the hour it came.'; if (q.p) q.p = P(q.p); if (q.links) q.links = q.links.map(l => l.replace(/^p:(.*)$/, (m, id) => 'p:' + P(id))); });
(s.completion || []).forEach(c => { if (c.p) c.p = P(c.p); if (c.title) c.title = 'How finished ' + PN(c.p) + ' is'; });
(s.sounds || []).forEach(x => { if (x.name) x.name = 'A sound'; });
fs.writeFileSync(path.join(SRC, 'seed.sample.js'), '// Sample content, derived from a real workspace with every name replaced (scan/sample.js).\nwindow.TRACKER_SEED = ' + JSON.stringify(s, null, 1) + ';\n');
console.log('wrote src/graph.sample.js and src/seed.sample.js:', g.projects.length, 'projects,', (s.tasks || []).length, 'tasks');
