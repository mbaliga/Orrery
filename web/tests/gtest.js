const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 5120, height: 1440 }, colorScheme: 'dark' }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'test.html') + '#year'); await page.waitForTimeout(1500);
  const probe = async () => page.evaluate(() => { const P = T.yearProbe(); const Y = P.Y; return { cx: Y.cx, cy: Y.cy, gR: Y.gR, R0: Y.R0, mode: Y.gmode }; });
  let Y = await probe(); console.log('geom', Y);
  // brush select with shift inside the graph
  await page.keyboard.down('Shift'); await page.mouse.move(Y.cx - 150, Y.cy - 150); await page.mouse.down(); await page.mouse.move(Y.cx + 150, Y.cy + 150, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Shift'); await page.waitForTimeout(300);
  let sel = await page.evaluate(() => T.yearProbe().Y.sel || []); console.log('brushed', sel.length);
  await page.screenshot({ path: '../shots/g9-brush.png', clip: { x: Y.cx - Y.gR - 40, y: Y.cy - Y.gR - 40, width: Y.gR * 2 + 80, height: Y.gR * 2 + 80 } });
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  // find a node and drag it
  const n = await page.evaluate(() => { const Y = T.yearProbe().Y; const n = Y.nodes.find(n => n.band === 'p' && n.e.p.id === 'fylz'); return { x: n.sx, y: n.sy, id: n.id, px: n.x, py: n.y }; });
  await page.mouse.move(n.x, n.y); await page.mouse.down(); await page.mouse.move(n.x + 120, n.y + 60, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(300);
  const after = await page.evaluate(() => { const Y = T.yearProbe().Y; const n = Y.nodes.find(n => n.e && n.e.p && n.e.p.id === 'fylz'); return { px: n.x, py: n.y, pinned: n.pinned }; }); console.log('dragged', n.px.toFixed(3), '→', after.px.toFixed(3), 'pinned', after.pinned);
  // wheel zoom
  await page.mouse.move(Y.cx, Y.cy); await page.mouse.wheel(0, -400); await page.waitForTimeout(200);
  console.log('zoom', await page.evaluate(() => T.yearProbe().GE ? T.yearProbe().GE.state.zoom : 'n/a'));
  // double-click focus on a node, then context menu
  await page.mouse.dblclick(n.x + 120, n.y + 60); await page.waitForTimeout(500);
  await page.mouse.click(Y.cx + 30, Y.cy + 30, { button: 'right' }); await page.waitForTimeout(300);
  console.log('pop', await page.evaluate(() => !!document.querySelector('.pop')), (await page.evaluate(() => document.querySelector('.pop') ? document.querySelector('.pop').textContent.slice(0, 80) : '')));
  await page.screenshot({ path: '../shots/g9-ctx.png', clip: { x: Y.cx - Y.gR - 40, y: Y.cy - Y.gR - 40, width: Y.gR * 2 + 80, height: Y.gR * 2 + 80 } });
  console.log(errors.length ? errors.join('\n') : 'no errors'); await browser.close();
})();
