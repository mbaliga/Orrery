const { chromium } = require('/opt/npm-tools/node_modules/playwright'); const path = require('path'), fs = require('fs');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: 'dark', acceptDownloads: true }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { window.__said = []; window.SpeechSynthesisUtterance = function (t) { this.text = t; }; Object.defineProperty(window, 'speechSynthesis', { value: { speak: u => window.__said.push(u.text), cancel() {} } }); });
  await page.goto('file://' + path.join(__dirname, 'dist', 'test.html')); await page.waitForTimeout(800);
  // vault through the real Settings input
  await page.evaluate(() => T.openSettings && T.openSettings('data')); await page.waitForTimeout(300);
  const inp = await page.$('.x-file[aria-label="Open an Obsidian vault"]'); ok(!!inp && await inp.evaluate(e => e.hasAttribute('webkitdirectory')), 'the vault row picks a folder');
  await inp.setInputFiles('shots/vault'); await page.waitForTimeout(500);
  ok(await page.evaluate(() => T.vaultNotes().length) === 2, 'two notes read');
  const hits = await page.evaluate(() => T.search('quokka habitats', 3).map(h => h.kind + ':' + h.title)); ok(hits[0] && hits[0].startsWith('Vault'), 'a vault note is found with everything else: ' + hits);
  ok(await page.evaluate(() => T.vaultInfo().tasks) === 1, 'open checkboxes counted');
  await page.keyboard.press('Escape');
  // export
  await page.evaluate(() => T.addNote('Fresh idea for the zip', null, true));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => T.vaultExport())]); const zp = 'shots/orrery-notes.zip'; await dl.saveAs(zp);
  const names = require('child_process').execSync(`python3 -c "import zipfile;z=zipfile.ZipFile('${zp}');print(z.testzip());print(len(z.namelist()));print([n for n in z.namelist() if 'Fresh' in n])"`).toString(); console.log(' ' + names.trim().replace(/\n/g, ' | '));
  ok(/^None/.test(names) && /Fresh idea/.test(names), 'the notes leave as a valid zip of Markdown');
  // baseline
  const now = new Date().toISOString(); await page.evaluate(() => { const n = T.addNote('Written near a check-in', null, true); window.__bl = n.id; });
  const cnt = await page.evaluate(t => T.baselineImport(t), fs.readFileSync('shots/bl.json', 'utf8').replace('__NOW__', now)); ok(cnt === 1, 'one valid check-in kept; out-of-range and malformed refused (' + cnt + ')');
  ok(await page.evaluate(() => { const n = T.notes.filter(x => x.id === window.__bl)[0]; return n.ctx && n.ctx.dev === 0.62; }), 'the note written nearest in time carries the deviation');
  const mood = await page.evaluate(() => T.indexDocs().filter(d => d.id === window.__bl)[0].mood); ok(mood === 0.62, 'it reaches the Map as the breath facet');
  // handoff
  const hp = await page.evaluate(() => { const t = T.tasks.filter(x => x.p === 'fonebrew' || true)[0]; const h = T.handoff(t.id); return { s: h.schema, title: h.task.title, proj: h.project.name, prompt: T.handoffPrompt(h).slice(0, 80), keys: Object.keys(h.context) }; }); console.log(' handoff', JSON.stringify(hp));
  ok(hp.s === 'handoff/1' && hp.title && hp.keys.join() === 'notes,files,earlier_sessions' && /^Task:/.test(hp.prompt), 'a task becomes handoff/1 with notes, files and earlier sessions');
  await page.keyboard.press('Control+k'); await page.waitForTimeout(300); await page.fill('#askIn', 'hand off ' + (await page.evaluate(() => T.tasks[0].title.split(' ').slice(0, 3).join(' ')))); await page.waitForTimeout(300);
  ok((await page.$$eval('#askList .ask-k', e => e.map(x => x.textContent))).includes('Hand off'), 'Ask offers the handoff'); await page.keyboard.press('Escape');
  // voice
  await page.evaluate(() => T.voice.setOut(true)); await page.keyboard.press('Control+k'); await page.waitForTimeout(300); await page.fill('#askIn', 'what is next?'); await page.waitForTimeout(400);
  ok((await page.evaluate(() => window.__said)).length >= 1, 'answers are spoken when asked to be'); 
  await page.evaluate(() => { T.voice.setOut(false); window.__said.length = 0; }); await page.fill('#askIn', 'what needs me?'); await page.waitForTimeout(400); ok((await page.evaluate(() => window.__said)).length === 0, 'and silent when not');
  console.log(errors.length ? errors : 'no errors'); await b.close(); process.exit(fail ? 1 : 0);
})();
