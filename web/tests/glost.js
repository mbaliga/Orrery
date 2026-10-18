const { chromium } = require('/opt/npm-tools/node_modules/playwright'); const path = require('path');
(async () => {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 5120, height: 1440 }, colorScheme: 'dark' }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'test.html') + '#year'); await page.waitForTimeout(1500);
  const info = async () => page.evaluate(() => { const P = T.yearProbe(); const v = P.GE.viewInfo(); const b = v.box; return { zoom: +v.zoom.toFixed(2), inside: +v.inside.toFixed(2), box: b && [b.x0, b.y0, b.x1, b.y1].map(Math.round), g: [P.Y.cx, P.Y.cy, P.Y.gR].map(Math.round), px: Math.round(P.GE.state.px), py: Math.round(P.GE.state.py) }; });
  const Y = await page.evaluate(() => { const Y = T.yearProbe().Y; return { cx: Y.cx, cy: Y.cy, gR: Y.gR }; });
  console.log('start', await info());
  // zoom hard into the top-left corner of the ground
  await page.mouse.move(Y.cx - Y.gR * 0.7, Y.cy - Y.gR * 0.7); for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(40); }
  await page.waitForTimeout(400); console.log('corner zoom', await info());
  await page.screenshot({ path: '../shots/g9-lost1.png', clip: { x: Y.cx - Y.gR - 40, y: Y.cy - Y.gR - 40, width: Y.gR * 2 + 80, height: Y.gR * 2 + 80 } });
  // pan it away hard, release: it should come back
  await page.mouse.move(Y.cx, Y.cy); await page.mouse.down(); await page.mouse.move(Y.cx + Y.gR * 1.5, Y.cy + Y.gR * 1.5, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(600);
  console.log('after pan', await info());
  await page.screenshot({ path: '../shots/g9-lost2.png', clip: { x: Y.cx - Y.gR - 40, y: Y.cy - Y.gR - 40, width: Y.gR * 2 + 80, height: Y.gR * 2 + 80 } });
  await page.keyboard.press('0'); await page.waitForTimeout(600); console.log('fit', await info());
  console.log(errors.length ? errors.join('\n') : 'no errors'); await browser.close();
})();
