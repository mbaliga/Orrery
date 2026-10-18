/* look: the colour everything sits on, the sunbeam, the torch, and your own name and logo.
   The sunbeam is light through a window that follows the sun across your day: from the left in the morning,
   overhead at noon, from the right in the evening, gone at night. Each mote of dust in it is a commit from the last
   seven days of the scan, tinted radium for yours and cyan for an agent's. The torch is a soft light around the
   pointer; names the chord had no room for show inside it. */
(function () {
  'use strict';
  var T = window.T, G = T.G, S = T.S, el = T.el;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rng(seed) { var x = Math.floor(seed * 2147483646) + 1; return function () { x = x * 16807 % 2147483647; return (x - 1) / 2147483646; }; }

  // ---------------------------------------------------------------- the field
  T.FIELDS = [
    ['#000000', 'Black', 'True black. On an OLED panel these pixels are off: the deepest contrast, and the least power.'],
    ['#06090f', 'Ink', 'A blue-black, like a clear night.'],
    ['#0f1012', 'Graphite', 'A neutral dark grey, for LCD panels, where black shows as grey anyway.'],
    ['#110b14', 'Aubergine', 'A violet-black that sits with the violet of what needs you.'],
    ['#070f0c', 'Forest', 'A green-black.'],
    ['#120d09', 'Umber', 'A warm brown-black, easy in the evening.']
  ];
  function hexRgb(h) { h = String(h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); var n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgbHex(c) { return '#' + c.map(function (v) { return ('0' + clamp(Math.round(v), 0, 255).toString(16)).slice(-2); }).join(''); }
  function lift(c, k) { return c.map(function (v) { return v + (255 - v) * k; }); }
  // the ink is light, so the field stays dark: a colour lighter than 14% is darkened, keeping its hue
  function keepDark(c) {
    var mx = Math.max(c[0], c[1], c[2]) / 255, mn = Math.min(c[0], c[1], c[2]) / 255, l = (mx + mn) / 2;
    return l <= 0.14 ? { c: c, clamped: false } : { c: c.map(function (v) { return v * 0.14 / l; }), clamped: true };
  }
  T.field = [0, 0, 0];
  T.fieldA = function (a) { return 'rgba(' + T.field.map(Math.round).join(',') + ',' + a + ')'; };
  T.fieldHex = function () { return rgbHex(T.field); };
  T.setField = function (hex, quiet) {
    var kd = keepDark(hexRgb(hex)), c = kd.c;
    T.field = c;
    root.style.setProperty('--field', rgbHex(c));
    root.style.setProperty('--field-rgb', c.map(Math.round).join(','));
    root.style.setProperty('--panel-rgb', lift(c, 0.028).map(Math.round).join(','));
    root.style.setProperty('--raised', rgbHex(lift(c, 0.045)));
    root.style.setProperty('--lift', rgbHex(lift(c, 0.075)));
    root.style.setProperty('--lift-2', rgbHex(lift(c, 0.105)));
    if (!quiet) { T.store.set('field', rgbHex(c)); if (T.canopyRedraw) T.canopyRedraw(); T.emit('field', rgbHex(c)); }
    return kd.clamped;
  };

  // ---------------------------------------------------------------- the sunbeam
  var B = { on: false, cv: null, g: null, motes: [], raf: 0, last: 0, W: 0, H: 0, dpr: 1, sprite: null, beam: null, beamAt: 0 };
  // ---------------------------------------------------------------- the ceiling: where the sun and the moon are
  // The room is not a black box: the light tells you, without saying so, whether the sun is up, the moon is out or
  // the sky is only stars — and, when you let it ask, what the weather is. From your clock alone the sun is placed
  // by the hour; with a place set (Settings → Display → Weather) the sun and moon are placed by the real sky.
  var WX = { on: false, lat: null, lon: null, place: '', last: null, timer: 0 };
  (function () { var w = T.store.get('wx', null); if (w) { WX.on = !!w.on; WX.lat = w.lat; WX.lon = w.lon; WX.place = w.place || ''; } WX.last = T.store.get('wxLast', null); })();
  function sunAlt(d) {
    if (WX.lat == null) { var h = d.getHours() + d.getMinutes() / 60, t = (h - 6) / 12.5; return { t: t < 0 || t > 1 ? null : t, alt: Math.sin(Math.PI * Math.max(-0.5, Math.min(1.5, t))), fromClock: true }; }
    // the standard low-precision solar position: declination from the day of the year, the hour angle from UTC and longitude
    var J = (d.getTime() / 864e5) - 10957.5, g = (357.529 + 0.98560028 * J) * Math.PI / 180, q = 280.459 + 0.98564736 * J;
    var L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * Math.PI / 180, e = (23.439 - 0.00000036 * J) * Math.PI / 180;
    var dec = Math.asin(Math.sin(e) * Math.sin(L)), RA = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    var GMST = (18.697374558 + 24.06570982441908 * J) % 24, lst = ((GMST + WX.lon / 15) % 24 + 24) % 24, H = (lst * 15 * Math.PI / 180) - RA;
    var lat = WX.lat * Math.PI / 180, alt = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
    // t: where in the arc of the day, 0 rising and 1 setting, from the hour angle
    var hh = ((H + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;   // -π..π, 0 at noon
    return { t: alt > 0 ? 0.5 + hh / Math.PI * 0.5 : null, alt: Math.sin(alt), H: hh, fromClock: false };
  }
  function moonNow(d, sun) {
    // phase from a known new moon; where it stands, from the sun's hour angle: the moon trails the sun by its age
    var age = ((d.getTime() - 947182440000) / 864e5) % 29.530588853, phase = age / 29.530588853;
    var illum = (1 - Math.cos(2 * Math.PI * phase)) / 2;
    var sH = sun.H != null ? sun.H : (d.getHours() + d.getMinutes() / 60 - 12) / 12 * Math.PI;
    var mH = sH - phase * 2 * Math.PI; mH = ((mH + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    return { phase: phase, illum: illum, alt: Math.cos(mH), up: Math.abs(mH) < Math.PI / 2, t: 0.5 + mH / Math.PI * 0.5 };
  }
  T.ceiling = function () {
    var d = new Date(), sun = sunAlt(d), moon = moonNow(d, sun), w = WX.on && WX.last && Date.now() - WX.last.at < 3 * 3600e3 ? WX.last : null;
    var clouds = w ? (w.clouds || 0) / 100 : 0, wet = w && w.code >= 51;
    var kind = sun.alt > 0 ? (clouds > 0.8 ? 'overcast' : 'sun') : moon.up && moon.illum > 0.08 ? (clouds > 0.8 ? 'overcast' : 'moon') : 'stars';
    return { sun: sun, moon: moon, clouds: clouds, wet: !!wet, weather: w, kind: kind, night: sun.alt <= 0 };
  };
  function sunNow() { var c = T.ceiling(); return c.sun.t; }
  T.sunNow = sunNow;
  // weather: asked of open-meteo.com with your place only, no key, no account — a watched object, off unless you turn it on
  var WXK = { 0: ['clear', 'Clear'], 1: ['clear', 'Mostly clear'], 2: ['part', 'Partly cloudy'], 3: ['cloud', 'Overcast'], 45: ['fog', 'Fog'], 48: ['fog', 'Rime fog'], 51: ['drizzle', 'Drizzle'], 53: ['drizzle', 'Drizzle'], 55: ['drizzle', 'Heavy drizzle'],
    56: ['drizzle', 'Freezing drizzle'], 57: ['drizzle', 'Freezing drizzle'], 61: ['rain', 'Light rain'], 63: ['rain', 'Rain'], 65: ['rain', 'Heavy rain'], 66: ['rain', 'Freezing rain'], 67: ['rain', 'Freezing rain'], 71: ['snow', 'Light snow'], 73: ['snow', 'Snow'], 75: ['snow', 'Heavy snow'], 77: ['snow', 'Snow grains'],
    80: ['rain', 'Showers'], 81: ['rain', 'Showers'], 82: ['rain', 'Violent showers'], 85: ['snow', 'Snow showers'], 86: ['snow', 'Snow showers'], 95: ['storm', 'Thunderstorm'], 96: ['storm', 'Thunderstorm, hail'], 99: ['storm', 'Thunderstorm, hail'] };
  var GLYPH = {
    sun: '<circle cx="12" cy="12" r="3.6"/><path d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3L5.6 5.6"/>',
    moon: '<path d="M15.5 3.5a8.5 8.5 0 1 0 5 15.4 7 7 0 0 1-5-15.4z"/>',
    part: '<circle cx="8.5" cy="9" r="3"/><path d="M8.5 3.5v1.6M3 9h1.6M4.6 5.1l1.1 1.1"/><path d="M9 19.5h8.6a3.2 3.2 0 0 0 .4-6.4 4.6 4.6 0 0 0-8.8-1.2A3.8 3.8 0 0 0 9 19.5z"/>',
    cloud: '<path d="M7 18.5h10.6a3.4 3.4 0 0 0 .4-6.8 5 5 0 0 0-9.6-1.3A4.1 4.1 0 0 0 7 18.5z"/>',
    fog: '<path d="M4 10h16M6 14h12M8 18h8"/>',
    drizzle: '<path d="M7 14.5h10.6a3.4 3.4 0 0 0 .4-6.8 5 5 0 0 0-9.6-1.3A4.1 4.1 0 0 0 7 14.5z"/><path d="M9 17.5v1.5M12.5 17.5v1.5M16 17.5v1.5"/>',
    rain: '<path d="M7 14h10.6a3.4 3.4 0 0 0 .4-6.8 5 5 0 0 0-9.6-1.3A4.1 4.1 0 0 0 7 14z"/><path d="M9.5 16.5l-1 3.5M13 16.5l-1 3.5M16.5 16.5l-1 3.5"/>',
    snow: '<path d="M7 14h10.6a3.4 3.4 0 0 0 .4-6.8 5 5 0 0 0-9.6-1.3A4.1 4.1 0 0 0 7 14z"/><path d="M9 17.5h.01M12.5 19.5h.01M16 17.5h.01M12.5 16.5h.01" stroke-width="2"/>',
    storm: '<path d="M7 13.5h10.6a3.4 3.4 0 0 0 .4-6.8 5 5 0 0 0-9.6-1.3A4.1 4.1 0 0 0 7 13.5z"/><path d="M12.5 13.5l-2 4h3l-2 4"/>'
  };
  T.wxGlyph = function (k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (GLYPH[k] || GLYPH.cloud) + '</svg>'; };
  function wxSave() { T.store.set('wx', { on: WX.on, lat: WX.lat, lon: WX.lon, place: WX.place }); }
  function wxPaint() {
    var host = T.$('#wx'); if (!host) return;
    var w = WX.on && WX.last ? WX.last : null;
    host.hidden = !w;
    if (!w) return;
    var k = WXK[w.code] || ['cloud', 'Cloud'], glyph = k[0] === 'clear' ? (w.isDay ? 'sun' : 'moon') : k[0];
    host.innerHTML = T.wxGlyph(glyph) + '<b>' + Math.round(w.temp) + '°</b>';
    host.title = k[1] + ', ' + Math.round(w.temp) + '°C, ' + w.clouds + '% cloud, at ' + (WX.place || 'your place') + ' — asked of open-meteo.com ' + T.ago(w.at) + ' ago';
    if (B.on) drawBeamImage();
    if (T.canopyStars) T.canopyStars();
  }
  function wxFetch() {
    if (!WX.on || WX.lat == null || typeof fetch !== 'function') return;
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + WX.lat + '&longitude=' + WX.lon + '&current=temperature_2m,weather_code,cloud_cover,is_day&timezone=auto')
      .then(function (r) { return r.json(); }).then(function (j) {
        var c = j && j.current; if (!c) return;
        WX.last = { at: Date.now(), temp: c.temperature_2m, code: c.weather_code, clouds: c.cloud_cover, isDay: c.is_day === 1 };
        T.store.set('wxLast', WX.last); wxPaint();
      }).catch(function () {});
  }
  function wxSchedule() { clearInterval(WX.timer); WX.timer = 0; if (WX.on && WX.lat != null) { wxFetch(); WX.timer = setInterval(wxFetch, 30 * 60 * 1000); } }
  T.weather = function () { return { on: WX.on, place: WX.place, lat: WX.lat, lon: WX.lon, last: WX.last }; };
  T.setWeather = function (on) { WX.on = !!on; wxSave(); wxSchedule(); wxPaint(); };
  // a place name becomes a latitude and longitude once, through open-meteo's geocoder; only the coordinates are kept
  T.setWeatherPlace = function (name) {
    WX.place = String(name || '').trim(); wxSave();
    clearTimeout(WX.geo);
    if (!WX.place || typeof fetch !== 'function') { WX.lat = WX.lon = null; wxSave(); wxPaint(); return; }
    WX.geo = setTimeout(function () {
      fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(WX.place) + '&count=1&language=en&format=json')
        .then(function (r) { return r.json(); }).then(function (j) {
          var hit = j && j.results && j.results[0]; if (!hit) return;
          WX.lat = hit.latitude; WX.lon = hit.longitude; WX.place = hit.name + (hit.country_code ? ', ' + hit.country_code : ''); wxSave(); wxSchedule(); T.emit('weather');
        }).catch(function () {});
    }, 700);
  };
  T.initWeather = function () { wxPaint(); wxSchedule(); };
  function sprite() {
    var s = document.createElement('canvas'), n = 32, x = s.getContext('2d');
    s.width = s.height = n;
    var gr = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, n, n);
    return s;
  }
  function seed() {
    // the last seven days of the scan, one mote a commit, the newest nine hundred at most
    var r = rng(0.3131), list = [];
    G.days.slice(-7).forEach(function (row) {
      for (var i = 0; i < row[1]; i++) list.push(true);
      for (var j = 0; j < row[2] + row[3] + row[4]; j++) list.push(false);
    });
    B.count = list.length;
    B.motes = list.slice(-900).map(function (you) {
      return { x: r(), y: r(), vx: (r() - 0.5) * 0.004, vy: (r() - 0.5) * 0.004, s: 0.6 + r() * 1.1, you: you, ph: r() * 6.283 };
    });
  }
  function beamGeom() {
    var c = T.ceiling(), W = B.W, H = B.H, t, col, a, gain = T.store.get('beamGain', 1) || 1, base = (S.mode === 'pano' ? 0.035 : 0.07) * gain;
    if (c.kind === 'sun' || (c.kind === 'overcast' && !c.night)) {
      t = c.sun.t; if (t == null) return null;
      var low = 1 - Math.sin(Math.PI * t);                                   // the lower the sun, the warmer the light
      col = [255, 236 - 46 * low, 214 - 96 * low]; a = base * (0.75 + 0.25 * low);
    } else if (c.kind === 'moon' || (c.kind === 'overcast' && c.moon.up)) {
      t = c.moon.t; col = [196, 212, 255]; a = base * 0.5 * (0.3 + 0.7 * c.moon.illum);   // moonlight: cool, and as bright as the moon is full
    } else return null;                                                      // stars only: no shafts, the motes drift unlit
    var ang = (0.5 - t) * 1.25;                                              // slanting right in the morning, left in the evening
    var cx = W * (0.5 - 0.22 * Math.sin(ang)), cy = H * 0.5, dx = Math.sin(ang), dy = Math.cos(ang), w = Math.max(W, H) * 0.16;
    // cloud takes the shafts apart: under an overcast sky what is left is a faint, even glow
    return { t: t, ang: ang, col: col, cx: cx, cy: cy, dx: dx, dy: dy, w: w, a: a * (1 - 0.8 * c.clouds), clouds: c.clouds, kind: c.kind, moon: c.kind === 'moon' };
  }
  // the light is several layers of shafts, each drawn once and then moved on its own: one layer sways while another
  // brightens, a gap opens here as one closes there, the way foliage never moves as one piece
  function drawBeamImage() {
    var bm = B.beam = beamGeom();
    B.beamAt = Date.now(); B.layers = [];
    if (!bm) { B.beamImg = null; return; }
    var L = Math.hypot(B.W, B.H) * 1.6, nx = -bm.dy, ny = bm.dx, cs = bm.col.join(',');
    var r = rng(0.17 + (new Date().getDate() % 7) * 0.11), span = bm.w * 4.2, loose = bm.moon ? 1.6 : 1;
    if (bm.kind === 'overcast') {
      var c0 = document.createElement('canvas'); c0.width = Math.round(B.W * B.dpr); c0.height = Math.round(B.H * B.dpr);
      var x0 = c0.getContext('2d'); x0.setTransform(B.dpr, 0, 0, B.dpr, 0, 0);
      var go = x0.createLinearGradient(bm.cx - nx * bm.w * 3, bm.cy - ny * bm.w * 3, bm.cx + nx * bm.w * 3, bm.cy + ny * bm.w * 3);
      go.addColorStop(0, 'rgba(' + cs + ',0)'); go.addColorStop(0.5, 'rgba(' + cs + ',' + (bm.a * 1.5) + ')'); go.addColorStop(1, 'rgba(' + cs + ',0)');
      x0.fillStyle = go; x0.fillRect(0, 0, B.W, B.H);
      B.pad = 0; B.layers.push({ img: c0, ph: 0, sp: 0.02, swing: 0, amp: 0.3 }); return;
    }
    var NL = 4, groups = []; for (var k = 0; k < NL; k++) groups.push([]);
    var cur = -span, i = 0;
    while (cur < span) {
      var w = bm.w * (0.06 + r() * 0.4), gap = bm.w * (0.1 + r() * 0.6) * loose;
      groups[i++ % NL].push({ o: cur + w, w: w, a: bm.a * (0.5 + r() * 0.9), lean: (r() - 0.5) * 0.05 });
      cur += w * 2 + gap;
    }
    groups.forEach(function (shafts, gi) {
      var PAD = B.pad = Math.round(Math.max(B.W, B.H) * 0.14);
      var c = document.createElement('canvas'); c.width = Math.round((B.W + PAD * 2) * B.dpr); c.height = Math.round((B.H + PAD * 2) * B.dpr);
      var x = c.getContext('2d'); x.setTransform(B.dpr, 0, 0, B.dpr, PAD * B.dpr, PAD * B.dpr);
      shafts.forEach(function (sh) {
        var ox = bm.cx + nx * sh.o, oy = bm.cy + ny * sh.o, dx = bm.dx + nx * sh.lean, dy = bm.dy + ny * sh.lean;
        var gx = x.createLinearGradient(ox - nx * sh.w, oy - ny * sh.w, ox + nx * sh.w, oy + ny * sh.w);
        gx.addColorStop(0, 'rgba(' + cs + ',0)'); gx.addColorStop(0.3, 'rgba(' + cs + ',' + sh.a + ')'); gx.addColorStop(0.5, 'rgba(' + cs + ',' + (sh.a * 1.3) + ')');
        gx.addColorStop(0.7, 'rgba(' + cs + ',' + sh.a + ')'); gx.addColorStop(1, 'rgba(' + cs + ',0)');
        x.fillStyle = gx; x.beginPath();
        x.moveTo(ox - dx * L - nx * sh.w, oy - dy * L - ny * sh.w); x.lineTo(ox - dx * L + nx * sh.w, oy - dy * L + ny * sh.w);
        x.lineTo(ox + dx * L + nx * sh.w * 1.5, oy + dy * L + ny * sh.w * 1.5); x.lineTo(ox + dx * L - nx * sh.w * 1.5, oy + dy * L - ny * sh.w * 1.5);
        x.closePath(); x.fill();
      });
      // brightest where the light comes in, fading across the room
      x.globalCompositeOperation = 'destination-in';
      var ga = x.createLinearGradient(bm.cx - bm.dx * B.H * 0.7, bm.cy - bm.dy * B.H * 0.7, bm.cx + bm.dx * B.H * 0.7, bm.cy + bm.dy * B.H * 0.7);
      ga.addColorStop(0, 'rgba(0,0,0,1)'); ga.addColorStop(1, 'rgba(0,0,0,.2)');
      x.fillStyle = ga; x.fillRect(-PAD, -PAD, B.W + PAD * 2, B.H + PAD * 2);
      // this layer's own leaves
      x.globalCompositeOperation = 'destination-out';
      for (var j = 0; j < 9; j++) {
        var px = -PAD + r() * (B.W + PAD * 2), py = -PAD + r() * (B.H + PAD * 2), rr = Math.max(B.W, B.H) * (0.03 + r() * 0.09);
        var gl = x.createRadialGradient(px, py, 0, px, py, rr);
        gl.addColorStop(0, 'rgba(0,0,0,' + (0.55 + r() * 0.4) + ')'); gl.addColorStop(0.6, 'rgba(0,0,0,' + (0.2 + r() * 0.3) + ')'); gl.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = gl; x.beginPath(); x.ellipse(px, py, rr * (0.6 + r() * 0.8), rr, r() * 3.14, 0, 6.283); x.fill();
      }
      // each layer has its own tempo: how fast it sways, how far, how much it flickers and how it breathes in size
      B.layers.push({ img: c, ph: r() * 6.283, sp: 0.05 + r() * 0.09, swing: bm.w * (0.1 + r() * 0.25) * (gi % 2 ? 1 : -1), amp: 0.25 + r() * 0.35, fl: 0.6 + r() * 1.4, grow: 0.01 + r() * 0.025 });
    });
    B.beamImg = B.layers.length ? true : null;
  }
  function beamSize() {
    if (!B.cv) return;
    B.W = Math.max(1, window.innerWidth); B.H = Math.max(1, window.innerHeight);
    B.dpr = Math.min(2, window.devicePixelRatio || 1);
    if (B.W * B.H * B.dpr * B.dpr > 6e6) B.dpr = Math.max(1, Math.sqrt(6e6 / (B.W * B.H)));
    B.cv.width = Math.round(B.W * B.dpr); B.cv.height = Math.round(B.H * B.dpr);
    drawBeamImage();
  }
  function beamFrame(now) {
    if (!B.on) return;
    B.raf = requestAnimationFrame(beamFrame);
    if (document.hidden || S.lean === 'back' || (S.mode !== 'pano' && S.view !== 'canopy') || now - B.last < (reduce ? 1000 : 33)) return;
    var dt = Math.min(0.1, (now - (B.last || now)) / 1000) || 0.033;
    B.last = now;
    if (Date.now() - B.beamAt > 60000) drawBeamImage();          // the sun and the moon move: redraw the light once a minute
    var g = B.g, W = B.W, H = B.H, bm = B.beam;
    g.setTransform(B.dpr, 0, 0, B.dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (B.layers && B.layers.length) {
      // the light is alive: each layer sways on its own tempo, flickers as leaves cross it, swells and thins; the
      // whole may breathe at a resting pace, six to the minute
      var t = now / 1000, move = T.store.get('beamMove', true) && !reduce, breathe = T.breath(now);
      var nx0 = bm ? -bm.dy : 0, ny0 = bm ? bm.dx : 0, cxp = B.W * B.dpr / 2, cyp = B.H * B.dpr / 2;
      B.layers.forEach(function (ly) {
        var sway = move ? Math.sin(t * ly.sp + ly.ph) * ly.swing + Math.sin(t * ly.sp * 0.37 + ly.ph * 2) * ly.swing * 0.5 : 0;
        // brightness: a slow swell with a quicker, smaller shimmer on top, never dropping out entirely
        var bright = move ? 1 - ly.amp * (0.5 + 0.5 * Math.sin(t * ly.sp * 1.7 + ly.ph)) - 0.08 * Math.sin(t * ly.fl * 2.1 + ly.ph) * Math.sin(t * ly.fl * 0.9) : 1;
        var grow = move ? 1 + ly.grow * Math.sin(t * ly.sp * 0.8 + ly.ph + 1) : 1;
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = Math.max(0, Math.min(1, bright * breathe));
        g.translate(cxp + nx0 * sway * B.dpr, cyp + ny0 * sway * B.dpr); g.rotate(move ? Math.sin(t * ly.sp * 0.5 + ly.ph) * 0.01 : 0); g.scale(grow, grow); g.translate(-cxp, -cyp);
        g.drawImage(ly.img, -(B.pad || 0) * B.dpr, -(B.pad || 0) * B.dpr); g.restore();
      });
      g.setTransform(B.dpr, 0, 0, B.dpr, 0, 0);
    }
    g.globalCompositeOperation = 'lighter';
    var nx = bm ? -bm.dy : 0, ny = bm ? bm.dx : 0;
    B.motes.forEach(function (m) {
      if (!reduce) {
        m.vx += (Math.random() - 0.5) * 0.0009 * dt * 30; m.vy += (Math.random() - 0.5) * 0.0009 * dt * 30 - 0.00004;   // drift, and warm air rising
        m.vx *= 0.985; m.vy *= 0.985;
        m.x += m.vx * dt; m.y += m.vy * dt;
        if (m.x < -0.02) m.x += 1.04; if (m.x > 1.02) m.x -= 1.04; if (m.y < -0.02) m.y += 1.04; if (m.y > 1.02) m.y -= 1.04;
      }
      var px = m.x * W, py = m.y * H, lit = 0.06;
      if (bm) { var d = ((px - bm.cx) * nx + (py - bm.cy) * ny) / bm.w; lit = 0.06 + Math.exp(-d * d * 3.2); }   // a mote shows when it crosses the light
      var a = clamp(lit * (S.mode === 'pano' ? 0.55 : 0.75), 0, 1), sz = m.s * 3.2 * (B.W > 3000 ? 1.4 : 1);
      g.globalAlpha = a;
      g.drawImage(m.you ? B.spriteYou : B.spriteAgent, px - sz, py - sz, sz * 2, sz * 2);
    });
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  function tinted(col) {
    var s = sprite(), c = document.createElement('canvas'), x = c.getContext('2d');
    c.width = c.height = s.width;
    x.drawImage(s, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = 'rgb(' + col.join(',') + ')'; x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  T.setBeam = function (on, quiet) {
    B.on = !!on;
    if (!quiet) T.store.set('beam', B.on);
    if (!B.cv) return;
    B.cv.hidden = !B.on;
    cancelAnimationFrame(B.raf);
    if (B.on) {
      if (!B.motes.length) seed();
      if (!B.spriteYou) { B.spriteYou = tinted([214, 244, 186]); B.spriteAgent = tinted([186, 238, 255]); }
      beamSize(); B.last = 0; B.raf = requestAnimationFrame(beamFrame);
    }
  };
  T.beamOn = function () { return B.on; };
  // the breath: one slow swell every ten seconds — six to the minute, a resting rate — that every glow on the page
  // shares when it is on: the light, the stars, the sky's halos, the marks that glow in the wings
  var BR = { on: T.store.get('beamBreathe', false), raf: 0, last: 0 };
  T.breath = function (now) { if (!BR.on || reduce) return 1; var t = (now || performance.now()) / 1000; return 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 10)); };
  function breathFrame(now) {
    if (!BR.on) return;
    BR.raf = requestAnimationFrame(breathFrame);
    if (document.hidden || now - BR.last < 100) return;
    BR.last = now;
    document.documentElement.style.setProperty('--breath', T.breath(now).toFixed(3));
    if (T.canopyStarsAlpha) T.canopyStarsAlpha(T.breath(now));
  }
  T.setBreathe = function (on) {
    BR.on = !!on; T.store.set('beamBreathe', BR.on); cancelAnimationFrame(BR.raf);
    if (BR.on) BR.raf = requestAnimationFrame(breathFrame); else { document.documentElement.style.removeProperty('--breath'); if (T.canopyStarsAlpha) T.canopyStarsAlpha(1); }
  };
  T.setBeamGain = function (v) { T.store.set('beamGain', Math.max(0.25, Math.min(4, +v || 1))); if (B.on) drawBeamImage(); };
  T.beamResize = function () { if (B.on) beamSize(); };
  T.beamInfo = function () {
    var n = 0;
    G.days.slice(-7).forEach(function (row) { n += row[1] + row[2] + row[3] + row[4]; });
    return { count: n, shown: Math.min(n, 900), sun: sunNow() };
  };

  // ---------------------------------------------------------------- the torch
  var TO = { on: true, el: null, x: 0, y: 0, tx: 0, ty: 0, raf: 0, shown: false, r: 0 };
  function torchStep() {
    TO.raf = 0;
    var k = reduce ? 1 : 0.24;
    TO.x += (TO.tx - TO.x) * k; TO.y += (TO.ty - TO.y) * k;
    TO.el.style.transform = 'translate3d(' + TO.x.toFixed(1) + 'px,' + TO.y.toFixed(1) + 'px,0)';
    T.torch = TO.shown && TO.on ? { x: TO.x, y: TO.y, r: TO.r } : null;
    if (T.canopyTorch) T.canopyTorch();
    if (Math.abs(TO.tx - TO.x) + Math.abs(TO.ty - TO.y) > 0.6) TO.raf = requestAnimationFrame(torchStep);
  }
  function torchMove(ev) {
    if (!TO.on || ev.pointerType !== 'mouse') return;
    TO.tx = ev.clientX; TO.ty = ev.clientY;
    if (!TO.shown) { TO.x = TO.tx; TO.y = TO.ty; TO.shown = true; TO.el.classList.add('on'); }
    if (!TO.raf) TO.raf = requestAnimationFrame(torchStep);
  }
  function torchHide() { TO.shown = false; T.torch = null; if (TO.el) TO.el.classList.remove('on'); if (T.canopyTorch) T.canopyTorch(); }
  T.setTorch = function (on, quiet) {
    TO.on = !!on;
    if (!quiet) T.store.set('torch', TO.on);
    if (!TO.on) torchHide();
  };
  T.torchOn = function () { return TO.on; };

  // ---------------------------------------------------------------- your own name and logo
  T.brand = T.store.get('brand', null) || { name: '', logo: '' };
  T.brandName = function () { return String(T.brand.name || '').trim() || 'Orrery'; };
  T.applyBrand = function () {
    var name = T.brandName(), host = T.$('#top .brand'), svg = host && host.querySelector('svg'), img = host && host.querySelector('img.brand-logo');
    T.$$('.wm').forEach(function (n) { n.textContent = name; });
    if (host) {
      if (T.brand.logo) {
        if (!img) { img = el('img', { class: 'brand-logo', alt: '' }); host.insertBefore(img, host.firstChild); }
        img.src = T.brand.logo;
        if (svg) svg.style.display = 'none';
      } else { if (img) img.remove(); if (svg) svg.style.display = ''; }
    }
    document.title = name;
    T.$$('[data-brand]').forEach(function (n) {
      var tpl = n.getAttribute('data-brand');
      if (n.hasAttribute('data-brand-attr')) n.setAttribute(n.getAttribute('data-brand-attr'), tpl.replace('{name}', name));
      else n.textContent = tpl.replace('{name}', name);
    });
    T.emit('brand', name);
  };
  T.setBrand = function (b) {
    T.brand = { name: b.name != null ? String(b.name).slice(0, 40) : T.brand.name, logo: b.logo != null ? b.logo : T.brand.logo };
    T.store.set('brand', T.brand);
    T.applyBrand();
  };

  T.initLook = function () {
    T.setField(T.store.get('field', '#000000'), true);
    B.cv = T.$('#cvBeam');
    if (B.cv) { B.g = B.cv.getContext('2d'); window.addEventListener('resize', function () { if (B.on) beamSize(); }); }
    T.setBeam(T.store.get('beam', false), true);
    T.initWeather();
    if (BR.on) T.setBreathe(true);
    TO.el = T.$('#torch');
    TO.r = (parseFloat(getComputedStyle(root).fontSize) || 16) * 9;
    window.addEventListener('pointermove', torchMove, { passive: true });
    document.addEventListener('pointerleave', torchHide);
    window.addEventListener('blur', torchHide);
    document.documentElement.addEventListener('mouseleave', torchHide);
    T.setTorch(T.store.get('torch', true), true);
    T.on('mode', function () { TO.r = (parseFloat(getComputedStyle(root).fontSize) || 16) * 9; if (B.on) beamSize(); });
    T.applyBrand();
  };
})();
