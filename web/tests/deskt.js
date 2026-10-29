process.chdir(__dirname + '/..'); require('fs').mkdirSync('shots', { recursive: true });
const { chromium } = require('playwright'); const path = require('path');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
(async () => {
  const b = await chromium.launch();
  for (const [name, w, h] of [['pano', 3440, 1440], ['phone', 390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', hasTouch: name === 'phone' }); const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'dist', 'test.html')); await page.waitForTimeout(900); await page.evaluate(() => { if (T.isLeanBack()) T.leanIn(true); }); await page.waitForTimeout(900);
    await page.evaluate(() => { T.notes.slice(0, 3).forEach((n, i) => T.pinToDesk(n, 10 + i * 24, 20 + i * 12)); T.pinToDesk(T.addNote('A fourth, pinned from Ask', null, true)); });
    ok(await page.evaluate(() => !T.deskOpen()), name + ': the desk starts closed');
    const before = await page.evaluate(() => getComputedStyle(document.querySelector('#m-dial, #m-widgets, .wing')).opacity);
    if (name === 'phone') await page.click('#deskFab'); else await page.keyboard.press('h'); await page.waitForTimeout(900);
    ok(await page.evaluate(() => T.deskOpen() && document.querySelector('#app').classList.contains('clear')), name + ': H clears the windows');
    ok(await page.evaluate(() => [...document.querySelectorAll('.wing,.mod')].filter(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').every(e => getComputedStyle(e).opacity === '0' || getComputedStyle(e).display === 'none')), name + ': the windows are gone');
    const n = await page.$$eval('.bn', e => e.length); ok(n === 4, name + ': four pinned notes shown (' + n + ')');
    await page.screenshot({ path: 'shots/desk-' + name + '.png' });
    // drag the first note, check it keeps its place as a fraction
    const box = await (await page.$('.bn')).boundingBox(); const id = await page.$eval('.bn', e => e.dataset.id); const x0 = await page.evaluate(i => T.notes.filter(n => n.id === i)[0].bd.x, id);
    await page.mouse.move(box.x + 30, box.y + 28); await page.mouse.down(); await page.mouse.move(box.x + 30 + w * 0.1, box.y + 28 + 60, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(100);
    const x1 = await page.evaluate(i => T.notes.filter(n => n.id === i)[0].bd.x, id); ok(Math.abs((x1 - x0) - 10) < 1.5, name + ': drag moves it by a tenth of the width (' + (x1 - x0).toFixed(1) + ')');
    // tie
    const bs = await page.$$('.bn'); const a = await bs[0].boundingBox(), c = await bs[1].boundingBox();
    await page.keyboard.down('Shift'); await page.mouse.move(a.x + 30, a.y + 28); await page.mouse.down(); await page.mouse.move(c.x + 40, c.y + 30, { steps: 6 }); await page.mouse.up(); await page.keyboard.up('Shift'); await page.waitForTimeout(100);
    ok(await page.evaluate(() => T.notes.some(n => n.bd && n.bd.tie && n.bd.tie.length)), name + ': shift-drag ties two notes');
    ok(await page.$$eval('.bd-tie', e => e.length) >= 1, name + ': the tie is drawn');
    // new note by double-click on empty desk
    const cnt = await page.evaluate(() => T.notes.length); await page.mouse.dblclick(w * 0.6, h * 0.7); await page.waitForTimeout(150); await page.keyboard.type('Pinned from the desk itself'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
    ok(await page.evaluate(c => T.notes.length === c + 1 && T.notes[T.notes.length - 1].text === 'Pinned from the desk itself' && !!T.notes[T.notes.length - 1].bd, cnt), name + ': double-click makes a pinned note');
    ok((await page.evaluate(() => T.search('desk itself', 3).map(h => h.kind))).includes('Note'), name + ': and it is searchable at once');
    if (name === 'phone') await page.click('#deskBack'); else await page.keyboard.press('Escape'); await page.waitForTimeout(700);
    ok(await page.evaluate(() => !T.deskOpen()), name + ': Escape brings the windows back');
    // persistence: reload
    await page.reload(); await page.waitForTimeout(800); await page.evaluate(() => T.desk(true)); await page.waitForTimeout(600);
    ok(await page.$$eval('.bn', e => e.length) === 5, name + ': the notes keep their place after a reload');
    console.log(errors.length ? errors : name + ' no errors'); await ctx.close();
  }
  await b.close(); process.exit(fail ? 1 : 0);
})();
