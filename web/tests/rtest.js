process.chdir(__dirname + '/..'); require('fs').mkdirSync('shots', { recursive: true });
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: 'dark' })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'test.html')); await page.waitForTimeout(800);
  console.log(' index', await page.evaluate(() => JSON.stringify(T.indexKinds())));
  await page.evaluate(() => T.addNote('A single preferences file that every app of mine answers to, starting with the browser', null, true));
  const sim = await page.evaluate(() => T.similarNotes('a preferences file every app answers to, start with the browser', 2).map(h => [h.note && h.note.text.slice(0, 40), +h.score.toFixed(2), h.same]));
  console.log(' similar', JSON.stringify(sim)); ok(sim.length >= 1, 'a rephrased idea finds the earlier note');
  const none = await page.evaluate(() => T.similarNotes('buy oranges on the way home tomorrow evening', 2).length); ok(none === 0, 'an unrelated thought finds nothing');
  const id = await page.evaluate(() => T.notes[T.notes.length - 1].id);
  await page.evaluate(i => T.foldNote(i, 'Also: start with Fylz'), id);
  ok(await page.evaluate(i => T.notes.filter(n => n.id === i)[0].lines.length === 1, id), 'folding adds a line, keeps the note');
  ok((await page.evaluate(() => T.search('fylz', 5).map(h => h.kind))).includes('Note'), 'the folded line is searchable at once');
  // wikilinks
  await page.evaluate(() => { const n = T.addNote('Think about [[browser]] again', null, true); window.__w = n.id; });
  ok(await page.evaluate(() => { const n = T.notes.filter(x => x.id === window.__w)[0]; return Array.isArray(n.refs); }), 'wikilinks parse into refs');
  // note form hint
  await page.evaluate(() => T.newNoteAt({}, 400, 300)); await page.waitForTimeout(300);
  await page.fill('#noteIn', 'a preferences file every app answers to, start with the browser'); await page.waitForTimeout(200);
  ok(await page.isVisible('#noteSim') && /Add as a line/.test(await page.textContent('#noteSim')), 'typing a note shows the earlier one and offers to add as a line');
  await page.screenshot({ path: 'shots/note-sim.png' });
  await page.fill('#noteIn', ''); await page.keyboard.press('Escape');
  // sessions become searchable
  const L = []; for (let i = 0; i < 20; i++) { L.push(JSON.stringify({ type: 'user', sessionId: 'sx', timestamp: '2026-10-25T10:00:30Z', message: { content: [{ type: 'tool_result', tool_use_id: 't' + i, content: 'ok' }] } })); L.push(JSON.stringify({ type: 'assistant', sessionId: 'sx', cwd: '/home/claude/zorblat', timestamp: '2026-10-25T10:0' + (i % 9) + ':00Z', requestId: 'r' + i, message: { model: 'claude-sonnet-5-5', stop_reason: 'tool_use', usage: { input_tokens: 5, output_tokens: 50 }, content: [{ type: 'tool_use', id: 't' + i, name: 'Read', input: { file_path: '/x/zorblat/main.kt' } }] } })); }
  fs.writeFileSync('shots/t2.jsonl', L.join('\n'));
  await page.evaluate(t => new Promise(r => T.usageImport([new File([t], 'a.jsonl')], r)), L.join('\n')); await page.waitForTimeout(200);
  const hits = await page.evaluate(() => T.search('zorblat', 5).map(h => h.kind)); ok(hits.includes('Session') && hits.includes('File'), 'an imported session and its re-read file are searchable: ' + hits);
  // Ask shows them
  await page.keyboard.press('Control+k'); await page.waitForTimeout(300); await page.fill('#askIn', 'zorblat'); await page.waitForTimeout(300);
  ok((await page.$$eval('#askList .ask-k', e => e.map(x => x.textContent))).some(k => k === 'Session' || k === 'File'), 'Ask lists them');
  await page.fill('#askIn', 'a preferences file every app answers to, start with the browser'); await page.waitForTimeout(300);
  ok((await page.$$eval('#askList .ask-k', e => e.map(x => x.textContent))).includes('Before'), 'Ask says: you have had this before');
  console.log(errors.length ? errors : 'no errors'); await b.close(); process.exit(fail ? 1 : 0);
})();
