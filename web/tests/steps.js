// Run a list of steps at a size and take named screenshots. Usage: node steps.js <size> '<json steps>'
// steps: ["key:,", "move:x,y", "click:x,y", "wait:ms", "eval:js", "shot:name", "shotclip:name:x,y,w,h", "hash:year"]
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path');
const SIZES = { g9: [5120, 1440, 1], g9low: [3840, 1080, 1], ipad: [1376, 1032, 2], ipadp: [1032, 1376, 2], pane: [834, 1000, 2], phone: [412, 915, 3], laptop: [1440, 900, 1], desk: [1920, 1080, 1] };
(async () => {
  const name = process.argv[2], steps = JSON.parse(process.argv[3] || '[]'), hash = process.argv[4] || '';
  const [w, h, dpr] = SIZES[name];
  const browser = await chromium.launch();
  const touch = name === 'phone' || name.startsWith('ipad') || name === 'pane';
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, colorScheme: 'dark' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.text().startsWith('LOG')) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'test.html') + (hash ? '#' + hash : ''));
  await page.waitForTimeout(900);
  for (const s of steps) {
    const i = s.indexOf(':'), k = s.slice(0, i), v = s.slice(i + 1);
    if (k === 'key') await page.keyboard.press(v);
    else if (k === 'move') { const [x, y] = v.split(',').map(Number); await page.mouse.move(x, y, { steps: 6 }); }
    else if (k === 'click') { const [x, y] = v.split(',').map(Number); await page.mouse.click(x, y); }
    else if (k === 'tap') { const [x, y] = v.split(',').map(Number); await page.touchscreen.tap(x, y); }
    else if (k === 'wait') await page.waitForTimeout(+v);
    else if (k === 'eval') { const r = await page.evaluate(new Function(v)); if (r !== undefined) console.log('eval:', typeof r === 'string' ? r : JSON.stringify(r)); }
    else if (k === 'shot') await page.screenshot({ path: path.join(__dirname, '..', 'shots', name + '-' + v + '.png') });
    else if (k === 'shotclip') { const [n, c] = [v.split(':')[0], v.split(':')[1].split(',').map(Number)]; await page.screenshot({ path: path.join(__dirname, '..', 'shots', name + '-' + n + '.png'), clip: { x: c[0], y: c[1], width: c[2], height: c[3] } }); }
  }
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
  await browser.close();
})();
