const { chromium } = require('/opt/npm-tools/node_modules/playwright'); const path = require('path'), fs = require('fs');
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: 'dark' })).newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'test.html')); await page.waitForTimeout(800);
  const fit = fs.readFileSync('../shots/fit.csv', 'utf8'), xml = fs.readFileSync('../shots/export.xml', 'utf8');
  console.log('fit', await page.evaluate(t => T.importMetricsText(t, 'Daily activity metrics.csv'), fit));
  console.log('apple', await page.evaluate(t => T.importMetricsText(t, 'export.xml'), xml));
  console.log(await page.evaluate(() => JSON.stringify(T.metricSeries('steps', 3)) + ' sleep ' + JSON.stringify(T.metricGet('2026-10-22', 'sleep_min')) + ' src ' + JSON.stringify(T.metricSources())));
  await page.evaluate(() => { T.setView('crew'); T.setNudges({ upright: 1 }); }); await page.waitForTimeout(600);
  const el = await page.$('#m-widgets'); await el.screenshot({ path: '../shots/desk-wg.png' });
  console.log(errors.length ? errors : 'no errors'); await b.close();
})();
