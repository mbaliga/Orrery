const { chromium } = require('/opt/npm-tools/node_modules/playwright'); const path = require('path'), fs = require('fs');
(async () => {
  const L = []; let t = Date.parse(new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10) + 'T04:00:00Z');
  for (let i = 0; i < 420; i++) { t += (i % 60 === 59 ? 25 * 60e3 : 4 * 60e3); const gap = i % 60 === 59, ctx = 20000 + (i % 140) * 3400, fable = i % 4 !== 0, id = 'tu' + i;
    L.push(JSON.stringify({ type: 'assistant', sessionId: 's' + Math.floor(i / 140), cwd: ['/home/claude/orrery', '/home/claude/fonebrew', '/home/claude/crocodyl'][Math.floor(i / 140)], timestamp: new Date(t).toISOString(), requestId: 'r' + i, isSidechain: i % 6 === 0, effort: 'high',
      message: { model: fable ? 'claude-fable-5-1' : 'claude-sonnet-5-5', id: 'm' + i, stop_reason: i % 9 ? 'tool_use' : 'end_turn', usage: { input_tokens: 3, cache_read_input_tokens: gap ? 0 : ctx, cache_creation_input_tokens: gap ? ctx : 900, output_tokens: 300 + (i % 9 ? 0 : 1500) }, content: [{ type: 'tool_use', id, name: i % 7 ? 'Edit' : 'Read', input: { file_path: '/x/src/app.js' } }] } }));
    L.push(JSON.stringify({ type: 'user', sessionId: 's' + Math.floor(i / 140), timestamp: new Date(t + 1000).toISOString(), message: { content: [{ type: 'tool_result', tool_use_id: id, content: 'x'.repeat(i % 11 === 0 ? 30000 : 400) }] } })); }
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: 'dark' })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(__dirname, 'dist', 'test.html')); await page.waitForTimeout(800);
  console.log('before', await page.evaluate(() => T.$('#usageNote').textContent.slice(0, 60)));
  // through the real Settings file input
  await page.evaluate(() => { T.openSettings && T.openSettings('data'); }); await page.waitForTimeout(300);
  const inp = await page.$('.x-row .x-file[aria-label="Import usage"]');
  console.log('input present', !!inp, 'multiple', inp && await inp.evaluate(e => e.multiple));
  fs.writeFileSync('shots/t1.jsonl', L.join('\n'));
  if (inp) await inp.setInputFiles(['shots/t1.jsonl']); await page.waitForTimeout(500);
  console.log('after', await page.evaluate(() => JSON.stringify(Object.keys(T.usageReport().projects)) + ' ' + Math.round(T.usageReport().units) + ' finds ' + T.usageReport().finds.map(f => f.id)));
  await page.keyboard.press('Escape'); await page.evaluate(() => { T.setView('crew'); }); await page.waitForTimeout(600);
  const el = await page.$('#m-usage'); await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: 'shots/desk-usage.png' });
  console.log(errors.length ? errors : 'no errors'); await b.close();
})();
