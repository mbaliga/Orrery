// The kanban board must be visible on the wide layout, with or without any movement this week.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 2560, height: 800 } });
  await p.goto('file://' + path.resolve(__dirname, '../dist/test.html')); await p.waitForTimeout(1200);
  const r = await p.evaluate(() => { const e = document.querySelector('#m-board'); const s = getComputedStyle(e); const b = e.getBoundingClientRect();
    return { mode: document.querySelector('#app').dataset.mode, op: s.opacity, pe: s.pointerEvents, pos: s.position, w: b.width, h: b.height, cards: e.querySelectorAll('.card,.bc,[data-id]').length }; });
  let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m, JSON.stringify(r)); } };
  ok(r.op === '1', 'board opacity'); ok(r.pe !== 'none', 'board clickable'); ok(r.pos !== 'fixed', 'board in the wing'); ok(r.mode === 'pano', 'pano mode'); ok(r.w > 100 && r.h > 60, 'board has size');
  console.log(fail ? fail + ' FAIL' : 'kanban ok', JSON.stringify(r)); await b.close(); process.exit(fail ? 1 : 0);
})();
