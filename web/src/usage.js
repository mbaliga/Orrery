/* usage: where the model usage goes, and where it leaks.
   Claude Code writes every request it makes to a transcript (~/.claude/projects/<project>/<session>.jsonl) with the
   token counts the API reported. This reads those files — in the browser, on this device, nothing sent — and
   attributes each request to a project, a model, a day, a session and the tool it was spent on. A plan's quota is
   not published in tokens, so the numbers here are *weighted units*: tokens times the relative price of each kind
   (fresh input 1, cache write 1.25 or 2, cache read 0.1, output 5) times a per-model multiplier you can edit.
   They rank where the usage went; they are not a reading of your quota. Only totals are kept — never a prompt,
   never a reply. Claude.ai's own data export (conversations.json) carries no token counts, so it is estimated
   from length and said to be.
   The pure core `analyse(texts, opts)` runs in node too (scan/usagetest.js). */
(function (root) {
  'use strict';
  var KIND_W = { fresh: 1, cw5: 1.25, cw1: 2, cr: 0.1, out: 5 };
  var DEFAULT_MULT = { haiku: 0.33, sonnet: 1, opus: 1.67, fable: 5, mythos: 5, other: 1 };
  var MECH = { Read: 1, Edit: 1, Write: 1, Bash: 1, Grep: 1, Glob: 1, MultiEdit: 1, NotebookEdit: 1, TaskCreate: 1, TaskUpdate: 1, TaskList: 1, TaskGet: 1, TodoWrite: 1 };

  function tier(model) { model = String(model || '').toLowerCase(); return /haiku/.test(model) ? 'haiku' : /sonnet/.test(model) ? 'sonnet' : /opus/.test(model) ? 'opus' : /fable/.test(model) ? 'fable' : /mythos/.test(model) ? 'mythos' : 'other'; }
  function mult(model, mults) { var t = tier(model), m = mults || DEFAULT_MULT; return m[t] != null ? m[t] : 1; }
  function dayOf(ts) { var d = new Date(ts); if (isNaN(d)) return null; return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function base(p) { p = String(p || ''); var s = p.replace(/\/+$/, '').split('/'); return s[s.length - 1] || p || '(unknown)'; }
  function textLen(c) {
    if (c == null) return 0; if (typeof c === 'string') return c.length;
    if (Array.isArray(c)) return c.reduce(function (a, x) { return a + (x && x.type === 'image' ? 6400 : textLen(x && (x.text != null ? x.text : x.content))); }, 0);
    return 0;
  }

  // one request's weight in units, from its usage block
  function weigh(u, model, mults) {
    var cw = u.cache_creation || {}, cw5 = cw.ephemeral_5m_input_tokens, cw1 = cw.ephemeral_1h_input_tokens, tot = u.cache_creation_input_tokens || 0;
    if (cw5 == null && cw1 == null) { cw5 = tot; cw1 = 0; }
    var k = { fresh: u.input_tokens || 0, cw5: cw5 || 0, cw1: cw1 || 0, cr: u.cache_read_input_tokens || 0, out: u.output_tokens || 0 }, m = mult(model, mults), w = {};
    var total = 0; for (var n in k) { w[n] = k[n] * KIND_W[n] * m / 1e6 * 1e3; total += w[n]; }   // milli-units per million → "units" = weighted thousands of tokens
    return { tok: k, w: w, total: total };
  }

  function analyse(texts, opts) {
    opts = opts || {}; var mults = opts.mults || DEFAULT_MULT, S = {};
    texts.forEach(function (text) {
      String(text).split('\n').forEach(function (line) {
        if (!line || line.charAt(0) !== '{') return;
        var d; try { d = JSON.parse(line); } catch (e) { return; }
        var sid = d.sessionId; if (!sid) return;
        var s = S[sid] || (S[sid] = { id: sid, reqs: {}, tools: {}, uses: {}, results: {}, cwd: d.cwd, entry: d.entrypoint, first: d.timestamp, last: d.timestamp });
        if (d.timestamp) { if (!s.first || d.timestamp < s.first) s.first = d.timestamp; if (!s.last || d.timestamp > s.last) s.last = d.timestamp; }
        if (d.cwd) s.cwd = d.cwd;
        var m = d.message; if (!m || typeof m !== 'object') return;
        if (d.type === 'assistant' && m.usage) {
          var key = d.requestId || m.id || d.uuid, r = s.reqs[key];
          if (!r) r = s.reqs[key] = { t: d.timestamp, model: m.model || d.requestedModel, side: !!d.isSidechain, effort: d.effort || d.perTurnEffort || '', u: {}, tools: [], stop: null };
          var u = m.usage; ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'output_tokens'].forEach(function (f) { if ((u[f] || 0) > (r.u[f] || 0)) r.u[f] = u[f]; });
          if (u.cache_creation) r.u.cache_creation = u.cache_creation;
          if (m.stop_reason) r.stop = m.stop_reason;
          if (Array.isArray(m.content)) m.content.forEach(function (c) {
            if (c && c.type === 'tool_use') { r.tools.push(c.name); s.uses[c.id] = { name: c.name, path: c.input && (c.input.file_path || c.input.path || c.input.notebook_path || '') }; }
          });
        } else if (d.type === 'user' && Array.isArray(m.content)) {
          m.content.forEach(function (c) { if (c && c.type === 'tool_result') s.results[c.tool_use_id] = textLen(c.content); });
        }
      });
    });

    var out = {};
    Object.keys(S).forEach(function (sid) {
      var s = S[sid], rs = Object.keys(s.reqs).map(function (k) { return s.reqs[k]; }).filter(function (r) { return r.t; }).sort(function (a, b) { return a.t < b.t ? -1 : 1; });
      if (!rs.length) return;
      var o = { id: sid, project: base(s.cwd), entry: s.entry || '', first: rs[0].t, last: rs[rs.length - 1].t, turns: rs.length, units: 0, kinds: { fresh: 0, cache_write: 0, cache_read: 0, out: 0 }, models: {}, days: {}, side: 0, peak: 0, ctx: [], toolLoop: {}, idle: { n: 0, units: 0 }, effort: {}, tools: {}, big: { n: 0, chars: 0 }, rereads: [], top: 0 }, prev = null, reads = {};
      rs.forEach(function (r, i) {
        var wt = weigh(r.u, r.model, mults), ctx = wt.tok.fresh + wt.tok.cw5 + wt.tok.cw1 + wt.tok.cr, ti = tier(r.model);
        o.units += wt.total; o.kinds.fresh += wt.w.fresh; o.kinds.cache_write += wt.w.cw5 + wt.w.cw1; o.kinds.cache_read += wt.w.cr; o.kinds.out += wt.w.out;
        var mo = o.models[ti] || (o.models[ti] = { turns: 0, units: 0, out: 0, tool: 0, mech: 0, names: {} }); mo.turns++; mo.units += wt.total; mo.out += wt.tok.out; mo.names[r.model || ''] = 1;
        if (r.stop === 'tool_use') { mo.tool += wt.total; if (r.tools.length && r.tools.every(function (t) { return MECH[t]; })) mo.mech += wt.total; }
        var dk = dayOf(r.t); if (dk) o.days[dk] = (o.days[dk] || 0) + wt.total;
        if (r.side) o.side += wt.total;
        if (ctx > o.peak) o.peak = ctx;
        o.ctx.push(ctx);
        var gap = prev ? (new Date(r.t) - new Date(prev.t)) / 1000 : 0;
        if (prev && gap > 300 && wt.tok.cw5 + wt.tok.cw1 > 30000 && ctx > 0) { o.idle.n++; o.idle.units += (wt.w.cw5 + wt.w.cw1) - (wt.tok.cw5 + wt.tok.cw1) * KIND_W.cr * mult(r.model, mults) / 1e3; }
        if (r.effort) { var ef = o.effort[r.effort] || (o.effort[r.effort] = { turns: 0, units: 0 }); ef.turns++; ef.units += wt.total; }
        r.tools.forEach(function (t) { var tt = o.tools[t] || (o.tools[t] = { calls: 0, chars: 0 }); tt.calls++; });
        prev = r;
      });
      Object.keys(s.results).forEach(function (id) {
        var u = s.uses[id]; if (!u) return; var n = s.results[id], tt = o.tools[u.name] || (o.tools[u.name] = { calls: 0, chars: 0 });
        tt.chars += n; if (n > 20000) { o.big.n++; o.big.chars += n; }
        if (u.name === 'Read' && u.path) reads[u.path] = (reads[u.path] || 0) + 1;
      });
      o.rereads = Object.keys(reads).filter(function (p) { return reads[p] >= 3; }).sort(function (a, b) { return reads[b] - reads[a]; }).slice(0, 6).map(function (p) { return [p.split('/').slice(-2).join('/'), reads[p]]; });
      // downsample the context curve to at most 40 points
      if (o.ctx.length > 40) { var step = o.ctx.length / 40, c2 = []; for (var j = 0; j < 40; j++) c2.push(o.ctx[Math.floor(j * step)]); o.ctx = c2; }
      var all = rs.map(function (r) { var t = weigh(r.u, r.model, mults).tok; return t.fresh + t.cw5 + t.cw1 + t.cr; });
      o.over200 = all.filter(function (c) { return c > 200000; }).length;
      o.over100 = all.filter(function (c) { return c > 100000; }).length;
      out[sid] = o;
    });
    return out;
  }

  // Claude.ai's data export: no token counts, so estimated from length (3.5 characters a token), and said to be
  function analyseChats(json, opts) {
    var arr; try { arr = JSON.parse(json); } catch (e) { return {}; } if (!Array.isArray(arr)) return {};
    var out = {};
    arr.forEach(function (c) {
      var ms = c.chat_messages; if (!Array.isArray(ms) || !ms.length) return;
      var ctx = 0, o = { id: 'chat-' + (c.uuid || c.name), project: (c.name || 'a chat').slice(0, 60), entry: 'claude.ai (estimated)', first: ms[0].created_at, last: ms[ms.length - 1].created_at, turns: 0, units: 0, kinds: { fresh: 0, cache_write: 0, cache_read: 0, out: 0 }, models: {}, days: {}, side: 0, peak: 0, ctx: [], toolLoop: {}, idle: { n: 0, units: 0 }, effort: {}, tools: {}, big: { n: 0, chars: 0 }, rereads: [], over200: 0, over100: 0, est: true };
      ms.forEach(function (m) {
        var n = (m.text || '').length + (m.content || []).reduce(function (a, x) { return a + ((x && x.text) || '').length; }, 0) + (m.files || []).length * 4000 + (m.attachments || []).reduce(function (a, x) { return a + ((x && x.extracted_content) || '').length; }, 0), tk = n / 3.5;
        if (m.sender === 'human') { ctx += tk; return; }
        var wt = weigh({ input_tokens: ctx, output_tokens: tk }, 'sonnet', opts && opts.mults);
        o.turns++; o.units += wt.total; o.kinds.fresh += wt.w.fresh; o.kinds.out += wt.w.out; ctx += tk; if (ctx > o.peak) o.peak = ctx;
        var dk = dayOf(m.created_at); if (dk) o.days[dk] = (o.days[dk] || 0) + wt.total;
        var mo = o.models.sonnet || (o.models.sonnet = { turns: 0, units: 0, out: 0, tool: 0, mech: 0, names: { 'claude.ai': 1 } }); mo.turns++; mo.units += wt.total; mo.out += tk;
      });
      if (o.turns) { o.over100 = o.peak > 100000 ? 1 : 0; out[o.id] = o; }
    });
    return out;
  }

  // what the stored sessions say: totals and findings, most to least at stake
  function report(sessions, opts) {
    opts = opts || {}; var mults = opts.mults || DEFAULT_MULT, ss = Object.keys(sessions).map(function (k) { return sessions[k]; });
    var R = { units: 0, turns: 0, sessions: ss.length, kinds: { fresh: 0, cache_write: 0, cache_read: 0, out: 0 }, models: {}, projects: {}, days: {}, side: 0, finds: [], from: null, to: null, est: 0 };
    ss.forEach(function (s) {
      R.units += s.units; R.turns += s.turns; R.side += s.side || 0; if (s.est) R.est += s.units;
      for (var k in s.kinds) R.kinds[k] += s.kinds[k];
      for (var t in s.models) { var m = R.models[t] || (R.models[t] = { turns: 0, units: 0, out: 0, tool: 0, mech: 0 }); ['turns', 'units', 'out', 'tool', 'mech'].forEach(function (f) { m[f] += s.models[t][f] || 0; }); }
      R.projects[s.project] = (R.projects[s.project] || 0) + s.units;
      for (var d in s.days) { R.days[d] = (R.days[d] || 0) + s.days[d]; if (!R.from || d < R.from) R.from = d; if (!R.to || d > R.to) R.to = d; }
    });
    var U = R.units || 1, F = function (x) { return Math.round(x / U * 100) + '%'; }, f = R.finds;
    var big = ss.filter(function (s) { return !s.est; });

    // 1. the same context, read again every turn
    var longs = big.filter(function (s) { return s.over100 > 0; }), longU = longs.reduce(function (a, s) { return a + s.units; }, 0), over200 = big.reduce(function (a, s) { return a + (s.over200 || 0); }, 0);
    if (R.kinds.cache_read / U > 0.4 && longs.length) f.push({ id: 'context', at: R.kinds.cache_read, title: 'Long threads re-read themselves every turn', evidence: F(R.kinds.cache_read) + ' of the weighted use is cache reads — the earlier conversation sent again on each turn. ' + longs.length + ' session' + (longs.length > 1 ? 's' : '') + ' carried over 100k tokens of context' + (over200 ? '; ' + over200 + ' turns ran above 200k' : '') + ', and those sessions hold ' + F(longU) + ' of the total.', do: 'One session per task. Write what must survive into the repo (STATE.md, CLAUDE.md) and start fresh instead of continuing; compact near 100–150k rather than after 400k. The same work in a short thread costs a fraction.' });

    // 2. top-tier models on tool-loop work
    var top = ['opus', 'fable', 'mythos'].reduce(function (a, t) { var m = R.models[t]; if (m) { a.u += m.units; a.tool += m.tool; a.mech += m.mech; a.turns += m.turns; } return a; }, { u: 0, tool: 0, mech: 0, turns: 0 });
    if (top.u / U > 0.3) {
      f.push({ id: 'tier', at: top.mech || top.tool, title: 'The largest model is doing the reading and editing', evidence: F(top.u) + ' of the weighted use is on the top tiers (' + top.turns + ' turns). ' + F(top.tool) + ' of the total went to turns that ended in a tool call, ' + F(top.mech) + ' of it turns that only read, searched, edited or ran commands.', do: 'Default to Sonnet for repo work that iterates (read, edit, run, repeat); keep the large model for the design, the architecture and the plan. Switching in the same session keeps the context but pays the cache write once; starting the build session on Sonnet does not.' });
    }

    // 3. idle rebuilds of the cache
    var idle = big.reduce(function (a, s) { a.n += s.idle.n; a.u += s.idle.units; return a; }, { n: 0, u: 0 });
    if (idle.n >= 3 && idle.u / U > 0.03) f.push({ id: 'idle', at: idle.u, title: 'Coming back after a pause rebuilds the cache', evidence: idle.n + ' times a session resumed after more than five minutes and wrote a large context from scratch again, costing about ' + F(idle.u) + ' of the total over reading it from cache.', do: 'Batch your questions, answer while the thread is warm, and when you know you will be away, finish the step and leave rather than letting a long thread sit and be rebuilt. A shorter thread rebuilds for less.' });

    // 4. subagents
    if (R.side / U > 0.2) f.push({ id: 'side', at: R.side, title: 'Subagents are a fifth or more of the use', evidence: F(R.side) + ' of the weighted use ran in subagents (sidechains), each with its own context built from scratch.', do: 'Send a subagent for a search that would read many files and return a short answer; do not fan out for work the main thread could do in three calls. Name the model for a worker (Sonnet) in the prompt.' });

    // 5. big tool results
    var bg = big.reduce(function (a, s) { a.n += s.big.n; a.c += s.big.chars; return a; }, { n: 0, c: 0 });
    if (bg.n >= 5) f.push({ id: 'big', at: bg.c / 3.5 * 0.1 * 1e-3 * 20, title: 'Large tool outputs stay in the context', evidence: bg.n + ' tool results were over 20,000 characters (about ' + Math.round(bg.c / 3.5 / 1000) + 'k tokens in all), and each one is carried and re-read on every later turn of its session.', do: 'Read a range, not the file; pipe command output through head, tail or grep; ask for a count before a listing; keep screenshots to the one that decides.' });

    // 6. the same file read again
    var rr = {}; big.forEach(function (s) { (s.rereads || []).forEach(function (r) { rr[r[0]] = (rr[r[0]] || 0) + r[1]; }); });
    var rk = Object.keys(rr).sort(function (a, b) { return rr[b] - rr[a]; }).slice(0, 4);
    if (rk.length) f.push({ id: 'reread', at: 0, title: 'The same files are read again and again', evidence: rk.map(function (k) { return k + ' ×' + rr[k]; }).join(', ') + '.', do: 'Name the lines in the prompt, or keep a short map of the repo in CLAUDE.md so each session does not rediscover it.' });

    // 7. very long sessions
    var marathons = big.filter(function (s) { return s.turns > 250; });
    if (marathons.length) f.push({ id: 'long', at: marathons.reduce(function (a, s) { return a + s.units; }, 0) * 0.3, title: 'Marathon sessions', evidence: marathons.length + ' session' + (marathons.length > 1 ? 's' : '') + ' ran over 250 requests (' + marathons.map(function (s) { return s.project + ' ' + s.turns; }).slice(0, 3).join(', ') + ').', do: 'Close a thread when a deliverable lands. The summary you write at the end is cheaper than the thread you carry on.' });

    // 8. effort
    var hi = 0; big.forEach(function (s) { ['high', 'xhigh', 'max'].forEach(function (e) { if (s.effort && s.effort[e]) hi += s.effort[e].units; }); });
    if (hi / U > 0.4) f.push({ id: 'effort', at: hi * 0.3, title: 'High effort is the default', evidence: F(hi) + ' of the weighted use ran at high effort or above.', do: 'Set effort to medium or low for edits and renames; raise it for design and debugging where the reasoning is the work.' });

    f.sort(function (a, b) { return b.at - a.at; });
    return R;
  }

  var API = { analyse: analyse, analyseChats: analyseChats, report: report, tier: tier, DEFAULT_MULT: DEFAULT_MULT, KIND_W: KIND_W, weigh: weigh };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }

  // -------------------------------------------------------------------------------- the page
  var T = root.T, el = T.el;
  var SESS = T.store.get('usage', {}), MULT = T.store.get('usageMult', {});
  function mults() { var m = {}; for (var k in DEFAULT_MULT) m[k] = MULT[k] != null ? MULT[k] : DEFAULT_MULT[k]; return m; }
  function save() { try { T.store.set('usage', SESS); } catch (e) { T.toast('The usage record is too large to keep on this device; forget the oldest and import again.'); } T.emit('usage'); }
  T.usageAPI = API;
  T.usageMult = function () { return mults(); };
  T.setUsageMult = function (text) {
    var m = {}; String(text || '').split(/[,;\n]+/).forEach(function (p) { var q = p.trim().match(/^([a-z]+)\s*[=:]?\s*([\d.]+)$/i); if (q) m[q[1].toLowerCase()] = +q[2]; });
    MULT = m; T.store.set('usageMult', MULT); T.emit('usage');
  };
  T.usageMultText = function () { var m = mults(); return ['haiku', 'sonnet', 'opus', 'fable'].map(function (k) { return k + ' ' + m[k]; }).join(', '); };
  T.usageImport = function (files, done) {
    var list = Array.prototype.slice.call(files), texts = [], chats = [], left = list.length;
    if (!left) { done(0); return; }
    list.forEach(function (f) {
      var fr = new FileReader();
      fr.onload = function () {
        var t = String(fr.result), head = t.slice(0, 400).trim();
        if (head.charAt(0) === '[') chats.push(t); else texts.push(t);
        if (!--left) finish();
      };
      fr.onerror = function () { if (!--left) finish(); };
      fr.readAsText(f);
    });
    function finish() {
      var got = analyse(texts, { mults: mults() }), n = 0, k;
      chats.forEach(function (c) { var g = analyseChats(c, { mults: mults() }); for (k in g) got[k] = g[k]; });
      for (k in got) { SESS[k] = got[k]; n++; }
      if (n) save(); done(n);
    }
  };
  T.usageClear = function () { SESS = {}; T.store.set('usage', SESS); T.emit('usage'); };
  T.usageExport = function () {
    var r = report(SESS, { mults: mults() });
    return JSON.stringify({ schema: 'usage/1', at: new Date().toISOString(), note: 'weighted units, not quota; totals only', mults: mults(), report: r, sessions: SESS }, null, 1);
  };
  T.usageReport = function () { return report(SESS, { mults: mults() }); };

  function u(x) { return x >= 1000 ? (x / 1000).toFixed(x >= 10000 ? 0 : 1) + 'M' : Math.round(x) + 'k'; }
  function pct(x, tot) { return tot ? Math.round(x / tot * 100) + '%' : '0%'; }
  var TIER_COL = { haiku: '199,239,158', sonnet: '142,123,255', opus: '120,214,236', fable: '255,196,120', mythos: '255,196,120', other: '236,232,228' };
  var KIND_COL = { cache_read: '142,123,255', cache_write: '120,214,236', fresh: '199,239,158', out: '255,196,120' };
  var KIND_NAME = { cache_read: 'earlier thread read again', cache_write: 'context written', fresh: 'new input', out: 'what it wrote' };

  function strip(label, parts, total) {
    var w = el('div', { class: 'us-row' }); w.appendChild(el('span', { class: 'wg-k' }, label));
    var bar = el('div', { class: 'us-bar', role: 'img', 'aria-label': label });
    parts.forEach(function (p) { if (p.v <= 0) return; bar.appendChild(el('span', { class: 'us-seg', style: { flex: String(p.v), background: 'rgba(' + p.c + ',.78)' }, title: p.n + ': ' + u(p.v) + ' (' + pct(p.v, total) + ')' })); });
    w.appendChild(bar);
    w.appendChild(el('span', { class: 'wg-s' }, parts.filter(function (p) { return p.v > 0; }).map(function (p) { return p.n + ' ' + pct(p.v, total); }).join(' · ')));
    return w;
  }

  T.renderUsage = function () {
    var host = T.$('#usage'); if (!host) return; T.clear(host);
    var R = report(SESS, { mults: mults() }), note = T.$('#usageNote');
    if (!R.sessions) { note.textContent = 'Nothing counted yet. Settings → Data → Import usage takes Claude Code transcripts (the .jsonl files in ~/.claude/projects, several at once) or Claude.ai’s conversations.json. They are read here and only totals are kept.'; return; }
    note.textContent = 'Weighted units (thousands of tokens at relative price), ' + R.from + ' to ' + R.to + ', ' + T.plural(R.sessions, 'session') + (R.est ? '; ' + pct(R.est, R.units) + ' of it estimated from length' : '') + '. Not a reading of your quota.';
    var head = el('div', { class: 'wg' }); head.appendChild(el('span', { class: 'wg-k' }, 'Used')); head.appendChild(el('b', { class: 'wg-v' }, u(R.units))); head.appendChild(el('span', { class: 'wg-s' }, T.int(R.turns) + ' requests')); host.appendChild(head);
    // days as cells
    var days = Object.keys(R.days).sort().slice(-14), mx = 1; days.forEach(function (d) { mx = Math.max(mx, R.days[d]); });
    var c = el('div', { class: 'wg-c', 'aria-label': 'Use by day' }); days.forEach(function (d) { c.appendChild(el('span', { class: 'wg-d', title: d + ': ' + u(R.days[d]), html: '<svg viewBox="-7 -7 14 14">' + T.cellMark('use' + d, { fill: 'rgba(165,147,255,' + (0.25 + 0.75 * R.days[d] / mx).toFixed(2) + ')' }) + '</svg>' })); });
    head.appendChild(c);
    host.appendChild(strip('Where the units went', Object.keys(KIND_NAME).map(function (k) { return { n: KIND_NAME[k], v: R.kinds[k], c: KIND_COL[k] }; }), R.units));
    host.appendChild(strip('By model', Object.keys(R.models).sort(function (a, b) { return R.models[b].units - R.models[a].units; }).map(function (t) { return { n: t, v: R.models[t].units, c: TIER_COL[t] || TIER_COL.other }; }), R.units));
    var ps = Object.keys(R.projects).sort(function (a, b) { return R.projects[b] - R.projects[a]; }), shown = ps.slice(0, 6), rest = ps.slice(6).reduce(function (a, p) { return a + R.projects[p]; }, 0), pal = ['142,123,255', '120,214,236', '199,239,158', '255,196,120', '255,140,160', '190,170,255'];
    var parts = shown.map(function (p, i) { return { n: p, v: R.projects[p], c: pal[i] }; }); if (rest) parts.push({ n: 'the rest', v: rest, c: '236,232,228' });
    host.appendChild(strip('By project', parts, R.units));
    var fl = el('div', { class: 'us-finds' });
    R.finds.forEach(function (x) {
      var d = el('div', { class: 'us-find' });
      d.appendChild(el('b', {}, x.title)); d.appendChild(el('p', {}, x.evidence)); d.appendChild(el('p', { class: 'us-do' }, x.do)); fl.appendChild(d);
    });
    if (!R.finds.length) fl.appendChild(el('p', { class: 'cap' }, 'No leak stands out in what has been counted.'));
    host.appendChild(fl);
  };
  T.initUsage = function () { T.renderUsage(); T.on('usage', T.renderUsage); };
})(typeof window !== 'undefined' ? window : this);
