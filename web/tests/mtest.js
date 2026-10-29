process.chdir(__dirname + '/..'); require('fs').mkdirSync('shots', { recursive: true });
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: 'dark' })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'test.html')); await page.waitForTimeout(800);
  const L = []; for (let i = 0; i < 12; i++) { L.push(JSON.stringify({ type: 'user', sessionId: 'sx', timestamp: '2026-10-25T10:00:30Z', message: { content: [{ type: 'tool_result', tool_use_id: 't' + i, content: 'ok' }] } })); L.push(JSON.stringify({ type: 'assistant', sessionId: 'sx', cwd: '/home/claude/nooz', timestamp: '2026-10-25T10:0' + (i % 9) + ':00Z', requestId: 'r' + i, message: { model: 'claude-sonnet-5-5', stop_reason: 'tool_use', usage: { input_tokens: 5, output_tokens: 50, cache_read_input_tokens: 90000 }, content: [{ type: 'tool_use', id: 't' + i, name: 'Read', input: { file_path: '/x/nooz/main.kt' } }] } })); }
  await page.evaluate(t => new Promise(r => T.usageImport([new File([t], 'a.jsonl')], r)), L.join('\n'));
  await page.evaluate(() => { T.addNote('A [[Nooz]] thought tied to the reader app', null, true); T.pinToDesk(T.notes[T.notes.length - 1]); T.pinToDesk(T.notes[0]); T.notes[T.notes.length - 1].bd.tie = [T.notes[0].id]; T.saveNotes(); });
  await page.keyboard.press('m'); await page.waitForTimeout(1500);
  ok(await page.evaluate(() => T.mapOpen()), 'M opens the map');
  const info = await page.evaluate(() => { const P = T.mapProbe(); const k = {}; P.nodes.forEach(n => k[n.kind] = (k[n.kind] || 0) + 1); return { kinds: k, links: P.GE.state.links.length, nodes: P.GE.state.nodes.length }; }); console.log(' map', JSON.stringify(info));
  ok(info.kinds.Note && info.kinds.Session && info.kinds.Project && info.kinds.File, 'notes, sessions, files and projects are all in one graph');
  ok(info.links > 50, 'tied together: ' + info.links + ' links');
  await page.waitForTimeout(800); await page.screenshot({ path: 'shots/map-default.png' });
  // mapping: change project from hue to shape and check swap rule
  await page.selectOption('select[aria-label="Kind is shown by"]', 'hue'); await page.waitForTimeout(200);
  const cfg = await page.evaluate(() => T.mapProbe().cfg.map); ok(cfg.kind === 'hue' && cfg.project === 'shape', 'giving hue to kind passes shape to project (no two facets share a channel): ' + JSON.stringify(cfg));
  await page.waitForTimeout(500); await page.screenshot({ path: 'shots/map-bykind.png' });
  await page.click('.mp-panel .chip:has-text("By project")'); await page.waitForTimeout(500);
  ok(await page.evaluate(() => T.mapProbe().cfg.map.project === 'hue'), 'a preset lens sets the mapping');
  // marks differ by facet
  const mk = await page.evaluate(() => { const P = T.mapProbe(); const a = P.nodes.find(n => n.kind === 'Note'), s = P.nodes.find(n => n.kind === 'Session'); return [P.marks(a).shape, P.marks(s).shape]; }); ok(mk[0] !== mk[1], 'a note and a session read differently: ' + mk);
  // save lens
  await page.fill('.mp-in', 'mine'); await page.click('.mp-panel .chip:has-text("Save lens")'); await page.waitForTimeout(200);
  ok(await page.$$eval('.mp-panel .chip', e => e.some(x => x.textContent === 'mine')), 'a lens can be saved and appears');
  // search lights
  await page.fill('#mapQ', 'nooz'); await page.waitForTimeout(500);
  ok(await page.evaluate(() => T.mapProbe().M.lit && T.mapProbe().M.lit.size > 2), 'search lights what the index finds and what is tied to it');
  await page.screenshot({ path: 'shots/map-search.png' });
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(600); ok(await page.evaluate(() => !T.mapOpen()), 'Escape closes it');
  console.log(errors.length ? errors : 'no errors'); await b.close(); process.exit(fail ? 1 : 0);
})();
