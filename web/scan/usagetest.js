// usagetest.js — the usage analyser against a real transcript and a synthetic marathon.
const U = require('../src/usage.js'), fs = require('fs');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
// synthetic: 400 turns on a top-tier model, context growing to 480k, tool loops, idle gaps, repeated reads
const L = []; let t = Date.parse('2026-10-20T09:00:00Z');
for (let i = 0; i < 400; i++) {
  t += (i % 50 === 49 ? 20 * 60e3 : 40e3);
  const ctx = 20000 + i * 1150, id = 'tu' + i, gap = i % 50 === 49;
  L.push(JSON.stringify({ type: 'assistant', sessionId: 's1', cwd: '/home/claude/orrery', timestamp: new Date(t).toISOString(), requestId: 'r' + i, isSidechain: i % 3 === 0, effort: 'high',
    message: { model: 'claude-fable-5-1', id: 'm' + i, stop_reason: 'tool_use', usage: { input_tokens: 3, cache_read_input_tokens: gap ? 0 : ctx, cache_creation_input_tokens: gap ? ctx : 900, cache_creation: { ephemeral_1h_input_tokens: gap ? ctx : 900, ephemeral_5m_input_tokens: 0 }, output_tokens: 400 },
      content: [{ type: 'tool_use', id, name: i % 7 === 0 ? 'Read' : 'Edit', input: { file_path: '/home/claude/orrery/src/app.js' } }] } }));
  // duplicate block record of the same request (Claude Code writes one per content block)
  L.push(L[L.length - 1]);
  L.push(JSON.stringify({ type: 'user', sessionId: 's1', timestamp: new Date(t + 1000).toISOString(), message: { content: [{ type: 'tool_result', tool_use_id: id, content: 'x'.repeat(i % 9 === 0 ? 30000 : 500) }] } }));
}
const a = U.analyse([L.join('\n')]), s = a.s1;
ok(s && s.turns === 400, 'requests are de-duplicated by request id: ' + (s && s.turns));
ok(s.peak > 400000, 'peak context ' + s.peak);
ok(s.idle.n >= 6, 'idle rebuilds found: ' + s.idle.n);
ok(s.rereads.length && s.rereads[0][1] >= 3, 'repeated reads: ' + JSON.stringify(s.rereads));
ok(s.big.n > 30, 'big tool results: ' + s.big.n);
const R = U.report(a, {}); const ids = R.finds.map(f => f.id);
console.log(' units', Math.round(R.units), 'kinds', Object.fromEntries(Object.entries(R.kinds).map(([k, v]) => [k, Math.round(v)])), 'finds', ids.join(','));
['context', 'tier', 'idle', 'side', 'big', 'reread', 'long', 'effort'].forEach(id => ok(ids.includes(id), 'finding: ' + id));
ok(R.kinds.cache_read > R.kinds.out * 0.3, 'cache reads are counted');
// Sonnet counterfactual: same tokens on sonnet weigh 1/5
const S2 = U.analyse([L.join('\n').replace(/fable-5-1/g, 'sonnet-5-5')]);
ok(Math.abs(U.report(S2, {}).units * 5 / R.units - 1) < 0.01, 'the same thread on Sonnet weighs a fifth');
// the real session transcript
for (const f of fs.readdirSync('/root/.claude/projects/-home-claude').filter(x => x.endsWith('.jsonl'))) {
  const r = U.analyse([fs.readFileSync('/root/.claude/projects/-home-claude/' + f, 'utf8')]); const k = Object.keys(r);
  ok(k.length > 0, 'real transcript read: ' + k.length + ' session(s), ' + k.map(x => r[x].turns + ' requests, ' + Math.round(r[x].units) + ' units, peak ' + r[x].peak).join('; '));
}
// claude.ai export
const chats = JSON.stringify([{ uuid: 'c1', name: 'a long chat', chat_messages: Array.from({ length: 60 }, (_, i) => ({ sender: i % 2 ? 'assistant' : 'human', text: 'word '.repeat(i % 2 ? 900 : 200), created_at: '2026-10-21T10:' + String(i % 60).padStart(2, '0') + ':00Z' })) }]);
const c = U.analyseChats(chats, {}); ok(Object.keys(c).length === 1 && c['chat-c1'].est, 'claude.ai export estimated');
process.exit(fail ? 1 : 0);
