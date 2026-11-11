// node scan/concentrationtest.js — the pure core of Concentration
const c = require('../src/concentration.js'); let fail = 0;
const ok = (x, m) => { if (!x) { fail++; console.log('FAIL', m); } };
const weeks = { '2026-09-07': { a: 90, b: 5, c: 5 }, '2026-09-14': { a: 20, b: 20, c: 20, d: 20, e: 20 }, '2026-09-21': { a: 40, b: 30, c: 30 }, '2026-10-05': { a: 3 } };
let r = c.analyse(weeks, 12, '2026-10-06T00:00:00Z');
ok(r.length === 3, 'the open week (5 Oct, scan 6 Oct) is left out: ' + r.length);
ok(r[0].kind === 'whole' && Math.abs(r[0].top - 0.9) < 1e-9, 'one project at 90% is whole');
ok(r[1].kind === 'fragmented' && Math.abs(r[1].eff - 5) < 1e-9, 'five equal parts: fragmented, five at once');
ok(r[2].kind === 'split', '40/30/30 is split');
ok(r[0].parts[0].id === 'a' && r[0].parts[0].share > r[0].parts[1].share, 'tallest first');
ok(c.analyse(weeks, 2, null).length === 2 && c.analyse(weeks, 2, null)[1].week === '2026-10-05', 'count keeps the newest weeks');
const col = c.collect([{ id: 'p', weeks: { w1: { claude: 3, person: 2 } } }, { id: 'q', weeks: { w1: { codex: 4 }, w2: {} } }]);
ok(col.w1.p === 5 && col.w1.q === 4 && !col.w2, 'collect sums kinds and skips empty weeks');
const s = c.summary(r); ok(s.weeks === 3 && s.whole === 1 && s.fragmented === 1 && s.split === 1, 'summary counts');
console.log(fail ? fail + ' FAIL' : 'concentration ok'); process.exit(fail ? 1 : 0);
