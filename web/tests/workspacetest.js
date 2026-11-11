// A stranger's path: the sample build shows a welcome sheet; loading a graph (and no seed) makes it theirs; the platform editor
// overrides the scan and survives a reload; "back to the built-in data" undoes it. No rebuild anywhere.
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs'), os = require('os');
(async () => {
  const root = path.resolve(__dirname, '..'); let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'orr-'));
  const src = fs.readFileSync(path.join(root, 'src/graph.sample.js'), 'utf8').replace(/^[^{]*=/, '').replace(/;\s*$/, '');
  const g = JSON.parse(src); g.projects = g.projects.slice(0, 6).map((p, i) => Object.assign({}, p, { name: 'Mine ' + i }));
  fs.writeFileSync(path.join(tmp, 'graph.js'), 'window.TRACKER_GRAPH = ' + JSON.stringify(g) + ';\n');
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 800 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(root, 'dist/test.html') + '?welcome=1'); await p.waitForTimeout(1500);
  ok(await p.locator('.sheet.ws').count() === 1, 'welcome sheet appears on a sample build');
  await p.locator('.sheet.ws input[type=file]').setInputFiles(path.join(tmp, 'graph.js'));
  await p.locator('.ws-text').fill('some-person');
  await p.locator('.ws-main').click(); await p.waitForLoadState('load'); await p.waitForTimeout(1800);
  ok(await p.locator('.sheet.ws').count() === 0, 'no welcome once the workspace is theirs');
  let n = await p.evaluate(() => [window.T.G.projects.length, !!window.ORRERY_USER, window.T.repoOwner(), window.T.G.projects[0].name, window.T.SEED.tasks.length]);
  ok(n[0] === 6 && n[1] && n[2] === 'some-person' && n[3] === 'Mine 0' && n[4] === 0, 'their six projects, empty tasks, their github name: ' + JSON.stringify(n));
  // the platform editor
  await p.evaluate(() => window.T.openRunsOn()); await p.waitForTimeout(300);
  const row = p.locator('.ws-prow').first(); const chip = row.locator('.ws-chip', { hasText: 'Desktop' });
  const before = await chip.getAttribute('aria-pressed'); await chip.click();
  ok((await p.locator('.ws-prow').first().locator('.ws-chip', { hasText: 'Desktop' }).getAttribute('aria-pressed')) !== before, 'a chip toggles');
  await p.locator('.ws-main').click(); await p.waitForLoadState('load'); await p.waitForTimeout(1800);
  const plat = await p.evaluate(() => { const s = window.T.store.get('platforms', {}); return Object.keys(s).length; });
  ok(plat === 1, 'the override is kept: ' + plat);
  // back to built in
  await p.evaluate(() => window.T.userDataClear()); await p.waitForLoadState('load'); await p.waitForTimeout(1500);
  n = await p.evaluate(() => [!!window.ORRERY_USER, window.T.G.projects.length]);
  ok(!n[0] && n[1] > 6, 'back to the built-in data: ' + JSON.stringify(n));
  // a bad file says so
  fs.writeFileSync(path.join(tmp, 'bad.json'), '{"nope":1}');
  const msg = await p.evaluate(() => new Promise(r => { window.T.userDataLoad([new File(['{"nope":1}'], 'bad.json')], '', e => r(e)); }));
  ok(/graph/i.test(msg || ''), 'a bad file is refused with a reason: ' + msg);
  ok(errs.length === 0, 'no page errors: ' + errs.join('|'));
  console.log(fail ? fail + ' FAIL' : 'workspace ok'); await b.close(); process.exit(fail ? 1 : 0);
})();
