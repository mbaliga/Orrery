/* widgets: the day's measures from other sources, and the nudges that answer them.
   Steps, energy burned, distance, sleep, resting heart rate, floors — read from the exports of whatever already
   counts them (Google Fit's Takeout, Apple Health's export, Garmin, Samsung Health, a plain CSV with a date column),
   and the sitting time the page itself can see. Each measure is one record a day with its source named, kept on the
   device (the repo's `local/metrics/<yyyy-mm>.jsonl` once the workspace exists); a widget is a reading of one
   measure, fourteen days of cells and today's number. Nothing here talks to a service: the exports come in as
   files; live sources (Health Connect through Crocodyl, the watch) write the same records later. Nudges — sit
   upright, stand, rest the eyes — fire from the sitting clock and the routine, as a toast, a tone and, if you let
   the browser, a system notification. */
(function () {
  'use strict';
  var T = window.T, S = T.S, el = T.el;
  var METRICS = {
    steps: { name: 'Steps', unit: '', fmt: function (v) { return T.int(Math.round(v)); }, goal: 8000 },
    energy_kcal: { name: 'Energy burned', unit: ' kcal', fmt: function (v) { return T.int(Math.round(v)); } },
    distance_m: { name: 'Distance', unit: ' km', fmt: function (v) { return (v / 1000).toFixed(1); } },
    sitting_min: { name: 'Sitting', unit: '', fmt: function (v) { return v >= 60 ? Math.floor(v / 60) + 'h ' + Math.round(v % 60) + 'm' : Math.round(v) + 'm'; }, low: true },
    sleep_min: { name: 'Sleep', unit: '', fmt: function (v) { return Math.floor(v / 60) + 'h ' + Math.round(v % 60) + 'm'; } },
    hr_rest: { name: 'Resting heart rate', unit: ' bpm', fmt: function (v) { return Math.round(v); }, low: true },
    floors: { name: 'Floors', unit: '', fmt: function (v) { return Math.round(v); } },
    active_min: { name: 'Active minutes', unit: ' min', fmt: function (v) { return Math.round(v); } }
  };
  T.METRICS = METRICS;
  var M = T.store.get('metrics', {});   // { 'yyyy-mm-dd': { steps: { v, src, at } } }
  function save() { T.store.set('metrics', M); T.emit('metrics'); }
  function dkey(d) { d = d || new Date(); return d.getFullYear() + '-' + T.pad(d.getMonth() + 1) + '-' + T.pad(d.getDate()); }
  T.metricSet = function (day, key, v, src, quiet) {
    if (!METRICS[key] || !(v >= 0)) return;
    var d = M[day] || (M[day] = {}), cur = d[key];
    // a measured source outranks the page's own estimate; between measured sources the latest import wins
    if (cur && cur.src !== src && cur.src !== 'orrery' && src === 'orrery') return;
    d[key] = { v: +v, src: src, at: new Date().toISOString() };
    if (!quiet) save();
  };
  T.metricGet = function (day, key) { var d = M[day]; return d && d[key] ? d[key] : null; };
  T.metricSeries = function (key, n) {
    var out = [], d = new Date(); d.setHours(12, 0, 0, 0);
    for (var i = n - 1; i >= 0; i--) { var k = dkey(new Date(d.getTime() - i * 864e5)), r = T.metricGet(k, key); out.push({ day: k, v: r ? r.v : null, src: r ? r.src : null }); }
    return out;
  };
  T.metricSources = function () { var s = {}; Object.keys(M).forEach(function (d) { Object.keys(M[d]).forEach(function (k) { var r = M[d][k]; s[r.src] = (s[r.src] || 0) + 1; }); }); return s; };
  T.metricsClear = function (src) { Object.keys(M).forEach(function (d) { Object.keys(M[d]).forEach(function (k) { if (!src || M[d][k].src === src) delete M[d][k]; }); if (!Object.keys(M[d]).length) delete M[d]; }); save(); };

  // ---------------------------------------------------------------- importers: files from the counters you already have
  function num(s) { var v = parseFloat(String(s == null ? '' : s).replace(/[^0-9.\-]/g, '')); return isFinite(v) ? v : null; }
  function csv(text) {
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') { if (cell !== '' || row.length) { row.push(cell); rows.push(row); } row = []; cell = ''; if (c === '\r' && text[i + 1] === '\n') i++; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function dayOf(s) { var m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3]; var d = new Date(s); return isNaN(d) ? null : dkey(d); }
  // column names each export uses for each measure; matched case-insensitively, first hit wins
  var COLS = {
    steps: [/^step count$/i, /^steps$/i, /^totalsteps$/i, /step/i],
    energy_kcal: [/^calories \(kcal\)$/i, /^calories$/i, /active energy/i, /kcal/i, /calor/i],
    distance_m: [/^distance \(m\)$/i, /^distance$/i, /distance/i],
    active_min: [/^move minutes count$/i, /active minutes/i, /minutes active/i, /move minutes/i],
    sleep_min: [/sleep duration/i, /sleep \(min\)/i, /^sleep$/i],
    hr_rest: [/resting heart rate/i, /rhr/i],
    floors: [/floors/i]
  };
  function importCsv(text, src) {
    var rows = csv(text); if (rows.length < 2) return 0;
    var head = rows[0].map(function (h) { return h.trim(); }), di = head.findIndex(function (h) { return /^date$|^day$|^calendar date$|^start/i.test(h); });
    if (di < 0) di = 0;
    var map = {};
    Object.keys(COLS).forEach(function (k) { for (var p = 0; p < COLS[k].length && map[k] == null; p++) { var ci = head.findIndex(function (h) { return COLS[k][p].test(h); }); if (ci >= 0) map[k] = ci; } });
    // units: Google Fit's distance is metres, Garmin's km; sleep may be hours
    var n = 0;
    rows.slice(1).forEach(function (r) {
      var day = dayOf(r[di]); if (!day) return;
      Object.keys(map).forEach(function (k) {
        var v = num(r[map[k]]); if (v == null) return;
        if (k === 'distance_m' && /km/i.test(head[map[k]])) v *= 1000;
        if (k === 'sleep_min' && /hour|\(h\)/i.test(head[map[k]])) v *= 60;
        T.metricSet(day, k, v, src, true); n++;
      });
    });
    return n;
  }
  // Apple Health: export.xml, one <Record type=… startDate=… value=…/> per sample; summed by day for quantities
  var APPLE = { HKQuantityTypeIdentifierStepCount: 'steps', HKQuantityTypeIdentifierActiveEnergyBurned: 'energy_kcal', HKQuantityTypeIdentifierDistanceWalkingRunning: 'distance_m', HKQuantityTypeIdentifierFlightsClimbed: 'floors', HKQuantityTypeIdentifierRestingHeartRate: 'hr_rest', HKQuantityTypeIdentifierAppleExerciseTime: 'active_min' };
  function importApple(text) {
    // attributes come in Apple's own order (type, sourceName, …, unit, creationDate, startDate, endDate, value); read them by name
    var re = /<Record\b([^>]*)\/?>/g, m, sum = {}, n = 0;
    function attr(a, k) { var x = a.match(new RegExp('\\b' + k + '="([^"]*)"')); return x ? x[1] : null; }
    while ((m = re.exec(text))) {
      var a = m[1], type = attr(a, 'type'); if (!type) continue;
      if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
        if (!/Asleep/i.test(attr(a, 'value') || '')) continue;
        var d1 = new Date(attr(a, 'endDate')), d0 = new Date(attr(a, 'startDate')), mins = (d1 - d0) / 6e4;
        if (mins > 0 && mins < 1440) { var day2 = dkey(d1), s2 = sum[day2] || (sum[day2] = {}); s2.sleep_min = (s2.sleep_min || 0) + mins; n++; }
        continue;
      }
      var k = APPLE[type]; if (!k) continue;
      var day = dayOf(attr(a, 'startDate')), v = num(attr(a, 'value')), unit = attr(a, 'unit') || ''; if (!day || v == null) continue;
      if (k === 'distance_m' && /km/i.test(unit)) v *= 1000; if (k === 'distance_m' && /^mi/i.test(unit)) v *= 1609.34;
      if (k === 'energy_kcal' && /kJ/i.test(unit)) v /= 4.184;
      var s = sum[day] || (sum[day] = {}); if (k === 'hr_rest') s[k] = v; else s[k] = (s[k] || 0) + v; n++;
    }
    Object.keys(sum).forEach(function (day) { Object.keys(sum[day]).forEach(function (k) { T.metricSet(day, k, sum[day][k], 'import:apple-health', true); }); });
    return n;
  }
  // the page's own export, and any JSON of the same shape: { 'yyyy-mm-dd': { steps: { v, src } } } or [{ day, key, v, src }]
  function importJson(text) {
    var j = JSON.parse(text), n = 0;
    if (Array.isArray(j)) j.forEach(function (r) { if (r.day && METRICS[r.key]) { T.metricSet(r.day, r.key, r.v, r.src || 'import:json', true); n++; } });
    else Object.keys(j).forEach(function (day) { Object.keys(j[day] || {}).forEach(function (k) { if (METRICS[k]) { var r = j[day][k]; T.metricSet(day, k, typeof r === 'object' ? r.v : r, (r && r.src) || 'import:json', true); n++; } }); });
    return n;
  }
  T.importMetricsText = function (text, name) {
    var n = 0, src = 'import:csv', low = String(name || '').toLowerCase();
    if (/<HealthData|<Record /.test(text.slice(0, 4000)) || /export\.xml$/.test(low)) n = importApple(text);
    else if (/^\s*[\[{]/.test(text)) n = importJson(text);
    else {
      if (/daily activity metrics|fit/.test(low) || /Move Minutes count/i.test(text.slice(0, 600))) src = 'import:google-fit';
      else if (/garmin/.test(low)) src = 'import:garmin'; else if (/samsung|shealth/.test(low)) src = 'import:samsung-health'; else if (/fitbit/.test(low)) src = 'import:fitbit';
      n = importCsv(text, src);
    }
    save();
    return n;
  };
  T.importMetricsFile = function (file, done) {
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () { var n = 0; try { n = T.importMetricsText(String(fr.result), file.name); } catch (e) { n = -1; } if (done) done(n); };
    fr.readAsText(file);
  };
  T.exportMetrics = function () { return JSON.stringify(M, null, 1); };

  // ---------------------------------------------------------------- the sitting clock: what the page itself can see
  // While the page is open and in front of you, and nothing has moved you, the minutes count as sitting. A break
  // logged in Body, or a session, ends the stretch. Only an estimate — a watch's own count replaces it.
  var SIT = { tick: 0, lastMin: 0 };
  function sitTick() {
    if (document.hidden) return;
    var sit = T.sitting && T.sitting(); if (!sit || sit.stale) return;
    if (T.activeSession && T.activeSession()) return;
    var day = dkey(), cur = T.metricGet(day, 'sitting_min');
    if (cur && cur.src !== 'orrery') return;
    T.metricSet(day, 'sitting_min', (cur ? cur.v : 0) + 1, 'orrery', true);
    if (SIT.tick++ % 5 === 0) save();
    nudgeTick(sit);
  }

  // ---------------------------------------------------------------- nudges
  var NUD = T.store.get('nudges', { upright: 30, stand: 50, eyes: 0, system: false });
  T.nudges = function () { return NUD; };
  T.setNudges = function (patch) { Object.keys(patch).forEach(function (k) { NUD[k] = patch[k]; }); T.store.set('nudges', NUD); if (NUD.system && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission(); };
  var lastFired = {};
  function fire(kind, text) {
    var now = Date.now(); if (lastFired[kind] && now - lastFired[kind] < 5 * 60e3) return; lastFired[kind] = now;
    T.toast(text); if (T.sfx) T.sfx('open');
    if (NUD.system && 'Notification' in window && Notification.permission === 'granted' && document.hidden) { try { new Notification('Orrery', { body: text, silent: true }); } catch (e) {} }
    T.emit('nudge', { kind: kind, text: text });
  }
  function nudgeTick(sit) {
    var m = sit.mins;
    if (NUD.stand && m > 0 && m % NUD.stand === 0) fire('stand', 'Sitting ' + m + ' minutes. Stand, walk for five.');
    else if (NUD.upright && m > 0 && m % NUD.upright === 0) fire('upright', 'Sit upright: chin back, shoulders down, feet flat.');
    if (NUD.eyes && m > 0 && m % NUD.eyes === 0) fire('eyes', 'Look at something twenty feet away for twenty seconds.');
  }

  // ---------------------------------------------------------------- the widgets
  // Each widget is one measure: fourteen days as cells, today's number, the source. The same reading will come
  // from an app's own widget.html under the widget contract (D-AC) on the channel `metrics.day`.
  var WIDGETS = T.store.get('widgets', ['steps', 'energy_kcal', 'sitting_min', 'sleep_min']);
  T.widgetList = function () { return WIDGETS.slice(); };
  T.setWidgets = function (list) { WIDGETS = list.filter(function (k) { return METRICS[k]; }); T.store.set('widgets', WIDGETS); T.renderWidgets(); };
  function srcName(s) { return !s ? '' : s === 'orrery' ? 'this page' : s.replace('import:', '').replace(/-/g, ' '); }
  T.renderWidgets = function () {
    var host = T.$('#widgets'); if (!host) return;
    T.clear(host);
    var any = false;
    WIDGETS.forEach(function (key) {
      var mt = METRICS[key], ser = T.metricSeries(key, 14), today = ser[ser.length - 1], max = 1, have = ser.filter(function (d) { return d.v != null; });
      have.forEach(function (d) { max = Math.max(max, d.v); });
      if (have.length) any = true;
      var w = el('div', { class: 'wg', 'data-k': key });
      w.appendChild(el('span', { class: 'wg-k' }, mt.name));
      w.appendChild(el('b', { class: 'wg-v' }, today.v != null ? mt.fmt(today.v) + mt.unit : '—'));
      var cells = el('div', { class: 'wg-c', 'aria-label': 'The last fourteen days' });
      ser.forEach(function (d) {
        var k = d.v == null ? 0 : mt.low ? 0.25 + 0.75 * (d.v / max) : 0.25 + 0.75 * (d.v / max);
        var fill = d.v == null ? 'rgba(236,232,228,.1)' : (key === 'sitting_min' ? 'rgba(165,147,255,' + k.toFixed(2) + ')' : 'rgba(199,239,158,' + k.toFixed(2) + ')');
        cells.appendChild(el('span', { class: 'wg-d' + (d === today ? ' now' : ''), title: d.day + (d.v != null ? ': ' + mt.fmt(d.v) + mt.unit + ' (' + srcName(d.src) + ')' : ': nothing'), html: '<svg viewBox="-7 -7 14 14">' + T.cellMark(key + d.day, { fill: fill }) + '</svg>' }));
      });
      w.appendChild(cells);
      var sub = [];
      if (today.src) sub.push('from ' + srcName(today.src));
      if (mt.goal && today.v != null) sub.push(Math.round(today.v / mt.goal * 100) + '% of ' + T.int(mt.goal));
      if (have.length > 1) { var avg = have.reduce(function (a, d) { return a + d.v; }, 0) / have.length; sub.push('fourteen-day mean ' + mt.fmt(avg) + mt.unit); }
      w.appendChild(el('span', { class: 'wg-s' }, sub.join(' · ') || 'nothing yet'));
      host.appendChild(w);
    });
    var sit = T.sitting && T.sitting();
    T.$('#widgetsNote').textContent = any ? '' : 'Nothing measured yet. Bring a file from the counter you already have — Settings → Data → Import a day file — or log a session in Body. Sitting is counted here while the page is in front of you' + (sit && !sit.stale ? ' (' + sit.mins + ' min since anything moved you)' : '') + '.';
  };

  T.initWidgets = function () {
    T.renderWidgets();
    ['metrics', 'body', 'lens'].forEach(function (ev) { T.on(ev, T.renderWidgets); });
    setInterval(sitTick, 60e3);
  };
})();
