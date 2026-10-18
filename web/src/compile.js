/* compile: every note joins the graph on its own.
   When a note is written or rewritten, its words are read against everything the page knows by name: projects and
   their aliases, agents, platforms, languages, libraries, shared modules, tasks and dated things by their titles, and
   the hour it was written. What matches becomes a link, so the note sits in the Year graph beside what it is about
   and lights those arcs on the chord. The note also keeps the moment: the hour, the weekday, what view and lens you
   were in, your latest check-in, and what was in progress, so that later the record can say when ideas come and
   what they come out of. The matching here is by words; the build swaps in the on-device embedder for meaning. */
(function () {
  'use strict';
  var T = window.T, G = T.G, S = T.S, SEED = T.SEED, E = T.E;
  var STOP = {};
  'the a an and or of to in on for with from by at as is are was be this that it its into over under about after before your you my me we our one two new all any more most less than then'.split(' ').forEach(function (w) { STOP[w] = 1; });
  function words(s) { return String(s || '').toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9#+]+/).filter(function (w) { return w.length >= 3 && !STOP[w]; }); }
  function norm(s) { return ' ' + String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim() + ' '; }

  // ---------------------------------------------------------------- what can be named
  var names = [];     // { id, text (normalised, padded), w (how specific) }
  function addName(id, text, w) { var t = norm(text); if (t.trim().length >= 3) names.push({ id: id, text: t, w: w || 1 }); }
  function index() {
    names = [];
    var AL = SEED.aliases || {};
    G.projects.forEach(function (p) {
      addName('p:' + p.id, p.name, 2); addName('p:' + p.id, p.id, 2);
      if (p.repo && p.repo.length >= 4) addName('p:' + p.id, p.repo.replace(/[-_]/g, ' '), 2);
      (AL[p.id] || []).forEach(function (a) { addName('p:' + p.id, a, 1.5); });
    });
    G.agents.forEach(function (a) { if (a.kind !== 'person') addName('a:' + a.id, a.name, 1.5); });
    addName('a:codex', 'codex', 1.5); addName('a:claude-sonnet', 'sonnet', 1.5); addName('a:claude-opus', 'opus', 1.5); addName('a:claude-fable', 'fable', 1.5);
    E.forEach(function (e) {
      if (e.band === 'f' || e.band === 'l' || e.band === 't' || e.band === 's') addName(e.id, e.name, e.band === 'l' ? 0.8 : 1);
      if (e.band === 'c') addName(e.id, e.name, 1);
    });
    addName('f:play', 'play store', 1); addName('f:web', 'website', 0.8); addName('f:wearos', 'watch', 0.8); addName('f:garmin', 'garmin', 1);
  }
  // tasks and dated things match on the words of their titles
  function titled() {
    var out = [];
    T.tasks.forEach(function (t) { out.push({ id: t.id, ws: words(t.title), t: t }); });
    SEED.schedule.forEach(function (s) { out.push({ id: s.id, ws: words(s.title), s: s }); });
    return out;
  }

  // ---------------------------------------------------------------- compile one note
  T.compileNote = function (n, fresh) {
    if (!names.length) index();
    var text = norm(n.text + ' ' + (n.tag || '')), ws = words(n.text), links = [], why = {};
    function link(id, reason) { if (!E.has(id) && !T.node(id)) return; if (links.indexOf(id) < 0) { links.push(id); why[id] = reason; } }
    // by name
    names.forEach(function (nm) { if (text.indexOf(nm.text) >= 0) link(nm.id, 'named'); });
    // the tag, when it names a project
    if (n.tag && T.P.has(n.tag)) link('p:' + n.tag, 'tag');
    if (n.att && T.P.has(n.att)) link('p:' + n.att, 'tied');
    // by title: two shared telling words, or half the title
    if (ws.length) titled().forEach(function (x) {
      if (!x.ws.length) return;
      var shared = x.ws.filter(function (w) { return ws.indexOf(w) >= 0; }).length;
      if ((shared >= 2 && shared / x.ws.length >= 0.34) || shared / x.ws.length >= 0.6) link(x.id, 'title');
    });
    // the moment
    var at = n.fresh ? new Date(n.fresh) : (n.hour != null ? null : null);
    if (fresh || (n.fresh && n.hour == null)) {
      var d = n.fresh ? new Date(n.fresh) : new Date();
      n.hour = d.getHours(); n.wd = (d.getDay() + 6) % 7;
      var ck = T.lastCheckin && T.lastCheckin();
      n.ctx = { view: S.view, mode: S.mode, lens: S.lens || null, lean: S.lean || 'in',
        doing: T.tasks.filter(function (t) { return t.status === 'doing' && t.agent === 'you'; }).map(function (t) { return t.id; }) };
      if (ck) n.ctx.mood = ck.mood, n.ctx.energy = ck.energy;
    }
    if (n.hour != null) link(T.segOf(n.hour).id, 'hour');
    void at;
    n.links = links; n.why = why;
    return links;
  };
  // every note carries its links; older ones are read once here
  T.compileAll = function () { (T.notes || []).forEach(function (n) { if (!n.links) T.compileNote(n, false); }); };
  T.noteLinks = function (n) {
    return (n.links || []).map(function (id) { var e = E.get(id); if (e) return { id: id, name: e.name, band: e.band, why: n.why && n.why[id] }; var x = T.node(id); return x ? { id: id, name: x.title, band: 'task', why: n.why && n.why[id] } : null; }).filter(Boolean);
  };
  // the notes that touch an entity or a task
  T.notesFor = function (id) { return (T.notes || []).filter(function (n) { return (n.links || []).indexOf(id) >= 0; }); };

  // ---------------------------------------------------------------- the record of ideas, in words
  T.ideasSummary = function () {
    var ns = T.notes || [], stamped = ns.filter(function (n) { return n.hour != null; }), lines = [];
    var byHour = {}, byP = {};
    stamped.forEach(function (n) { byHour[n.hour] = (byHour[n.hour] || 0) + 1; });
    ns.forEach(function (n) { (n.links || []).forEach(function (id) { if (id.indexOf('p:') === 0) byP[id] = (byP[id] || 0) + 1; }); });
    var topP = Object.keys(byP).sort(function (a, b) { return byP[b] - byP[a]; }).slice(0, 3);
    lines.push(T.plural(ns.length, 'note') + ', ' + ns.filter(function (n) { return (n.links || []).length; }).length + ' linked to something by their words.');
    if (topP.length) lines.push('Most notes touch ' + topP.map(function (id) { return E.get(id).name + ' (' + byP[id] + ')'; }).join(', ') + '.');
    if (stamped.length) { var h = Object.keys(byHour).sort(function (a, b) { return byHour[b] - byHour[a]; })[0]; lines.push(T.plural(stamped.length, 'note') + ' carry the hour they were written; most around ' + T.pad(+h) + ':00.'); }
    else lines.push('None carry an hour yet: notes written from now on do, with the view, the lens and your last check-in.');
    return lines;
  };
  T.compileAll();
})();
