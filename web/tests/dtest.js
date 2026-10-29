const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'dark' }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'test.html')); await page.waitForTimeout(900);
  await page.evaluate(() => { T.leanIn(true); T.setView('dial'); }); await page.waitForTimeout(500);
  const D = await page.evaluate(() => { const D = T.dialProbe(); return { cx: D.cx, cy: D.cy, R: D.R, top: document.querySelector('#m-dial').getBoundingClientRect().top }; });
  const by = D.top + D.cy + D.R - 12;            // on the bottom ring
  // drag the bottom ring to the left by about two stops
  await page.mouse.move(D.cx, by); await page.mouse.down(); await page.mouse.move(D.cx + 90, by - 6, { steps: 12 }); await page.mouse.move(D.cx + 180, by - 24, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(500);
  console.log('lens after drag', await page.evaluate(() => T.S.lens), await page.evaluate(() => T.dialProbe().rot));
  // tap the "3 days" stop on the top ring
  const ty = D.top + D.cy - D.R + 14;
  const lp = await page.evaluate(() => T.dialProbe().lpitch);
  await page.mouse.click(D.cx + Math.sin(lp) * (D.R - 14), D.top + D.cy - Math.cos(lp) * (D.R - 14)); await page.waitForTimeout(500);
  console.log('level', await page.evaluate(() => T.dialProbe().lvl), (await page.evaluate(() => document.querySelector('#dialBody').textContent.slice(0, 120))));
  await page.screenshot({ path: '../shots/phone-dial2.png' });
  await page.evaluate(() => { T.dialProbe().lvl = 'year'; T.dialProbe().lrot = 4; T.renderCamera(); }); await page.waitForTimeout(300);
  await page.screenshot({ path: '../shots/phone-dial3.png' });
  await page.evaluate(() => { T.dialProbe().lvl = 'month'; T.dialProbe().lrot = 3; T.renderCamera(); }); await page.waitForTimeout(300);
  await page.screenshot({ path: '../shots/phone-dial4.png' });
  console.log(errors.length ? errors.join('\n') : 'no errors'); await browser.close();
})();
