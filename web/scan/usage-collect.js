#!/usr/bin/env node
/* usage-collect.js — turn Claude Code transcripts into a small, content-free file Orrery's Usage module can read.
   A transcript holds every prompt, reply and tool output; the ledger needs none of it. This keeps, per request, only the
   session, project folder, time, model, effort, the token counts the API reported, and the names of the tools used (and
   the file path of a Read, so re-reads can be counted), and per tool result only its length. No prompt, reply or tool
   output is written. Usage: node scan/usage-collect.js [dir-or-file ...] > usage.jsonl     (default ~/.claude/projects) */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
function walk(p, out) { let st; try { st = fs.statSync(p); } catch (e) { return out; } if (st.isDirectory()) fs.readdirSync(p).forEach(f => walk(path.join(p, f), out)); else if (/\.jsonl$/.test(p)) out.push(p); return out; }
function slim(line) {
  let d; try { d = JSON.parse(line); } catch (e) { return null; }
  if (!d.sessionId) return null; const m = d.message;
  if (d.type === 'assistant' && m && m.usage) {
    return { type: 'assistant', sessionId: d.sessionId, cwd: d.cwd, timestamp: d.timestamp, requestId: d.requestId, isSidechain: !!d.isSidechain, effort: d.effort || d.perTurnEffort, entrypoint: d.entrypoint,
      message: { model: m.model, id: m.id, stop_reason: m.stop_reason, usage: { input_tokens: m.usage.input_tokens, output_tokens: m.usage.output_tokens, cache_read_input_tokens: m.usage.cache_read_input_tokens, cache_creation_input_tokens: m.usage.cache_creation_input_tokens, cache_creation: m.usage.cache_creation },
        content: (Array.isArray(m.content) ? m.content : []).filter(c => c && c.type === 'tool_use').map(c => ({ type: 'tool_use', id: c.id, name: c.name, input: c.input && (c.input.file_path || c.input.path) ? { file_path: c.input.file_path || c.input.path } : {} })) } };
  }
  if (d.type === 'user' && m && Array.isArray(m.content)) {
    const rs = m.content.filter(c => c && c.type === 'tool_result').map(c => ({ type: 'tool_result', tool_use_id: c.tool_use_id, len: Array.isArray(c.content) ? c.content.reduce((a, x) => a + (x && x.type === 'image' ? 6400 : String((x && x.text) || '').length), 0) : String(c.content || '').length }));
    if (rs.length) return { type: 'user', sessionId: d.sessionId, timestamp: d.timestamp, message: { content: rs } };
  }
  return null;
}
if (require.main === module) {
  const args = process.argv.slice(2), roots = args.length ? args : [path.join(os.homedir(), '.claude', 'projects')], files = roots.reduce((a, r) => walk(r, a), []);
  let n = 0; files.forEach(f => fs.readFileSync(f, 'utf8').split('\n').forEach(l => { if (!l) return; const s = slim(l); if (s) { process.stdout.write(JSON.stringify(s) + '\n'); n++; } }));
  process.stderr.write(`${files.length} transcripts, ${n} records kept; no prompts, replies or tool output.\n`);
}
module.exports = { slim };
