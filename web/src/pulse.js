/* agents, vitals, signal and focus. Signal and focus are written as widgets: an id, the channels
   they read, and a render function. More widgets register the same way. */
(function () {
  'use strict';
  var T = window.T, G = T.G, S = T.S, SEED = T.SEED, el = T.el, sv = T.sv;

  function lensProjects() { return G.projects.filter(function (p) { return T.inLens(p.id); }); }

  // ------------------------------------------------------------ agents
  T.renderAgents = function () {
    var box = T.$('#agentRows'); T.clear(box);
    var ps = lensProjects(), tot = {}, sum = 0, max = 1;
    ps.forEach(function (p) { Object.keys(p.agents).forEach(function (a) { tot[a] = (tot[a] || 0) + p.agents[a]; sum += p.agents[a]; }); });
    G.agents.forEach(function (a) { max = Math.max(max, tot[a.id] || 0); });
    G.agents.forEach(function (a) {
      var n = tot[a.id] || 0;
      var row = el('button', { class: 'ag' + (S.lens === 'a:' + a.id ? ' sel' : '') + (n ? '' : ' dim'), on: { click: function () { T.setLens('a:' + a.id); } } },
        T.agentGlyph(a.id), el('span', { class: 'ag-n' }, a.name),
        el('span', { class: 'ag-b' }, el('i', { style: { width: (n / max * 100).toFixed(1) + '%' } })),
        el('span', { class: 'ag-p' }, sum ? T.pct(n / sum) : '0%'),
        el('span', { class: 'ag-r' }, SEED.agentRoles[a.id] || ''),
        el('span', { class: 'ag-l' }, T.int(n) + ', last ' + (G.agent_last[a.id] ? T.dm(G.agent_last[a.id]) : 'none')));
      box.appendChild(row);
    });
    T.$('#agentsN').textContent = T.int(sum);

    // commits a week by who made them
    var weeks = {}, order = [];
    ps.forEach(function (p) {
      Object.keys(p.weeks || {}).forEach(function (w) {
        var c = p.weeks[w], x = weeks[w] = weeks[w] || [0, 0, 0];
        x[0] += c.person || 0; x[1] += (c.claude || 0) + (c.named || 0); x[2] += c.codex || 0;
      });
    });
    var start = new Date('2026-05-04T00:00:00'), end = new Date(G.scanned_at);
    for (var d = new Date(start); d <= end; d = new Date(d.getTime() + 7 * 864e5)) {
      order.push(d.getFullYear() + '-' + T.pad(d.getMonth() + 1) + '-' + T.pad(d.getDate()));
    }
    var host = T.$('#agentWeeks'); T.clear(host);
    var W = host.clientWidth || 300, H = Math.max(54, Math.min(110, W * 0.26)), top = 12, bot = 14, mx = 1;
    order.forEach(function (w) { var x = weeks[w]; if (x) mx = Math.max(mx, x[0] + x[1] + x[2]); });
    var svg = sv('svg', { class: 'mini', viewBox: '0 0 ' + W + ' ' + H, height: H, role: 'img', 'aria-label': 'Commits a week by you, Claude and Codex' });
    var slot = W / order.length, bw = Math.min(14, slot * 0.62);
    svg.appendChild(sv('line', { x1: 0, x2: W, y1: H - bot, y2: H - bot, stroke: 'rgba(255,255,255,.14)' }));
    svg.appendChild(sv('text', { x: 0, y: 9, 'font-size': 9 }, 'peak ' + T.int(mx) + ' a week'));
    order.forEach(function (w, i) {
      var x = weeks[w] || [0, 0, 0], bx = i * slot + (slot - bw) / 2, y = H - bot - 1, dd = new Date(w + 'T00:00:00');
      [['bar-you', x[0]], ['bar-claude', x[1]], ['bar-codex', x[2]]].forEach(function (s) {
        if (!s[1]) return;
        var h = Math.max(2, s[1] / mx * (H - top - bot - 2));
        y -= h;
        svg.appendChild(sv('rect', { class: s[0], x: bx.toFixed(1), y: y.toFixed(1), width: bw.toFixed(1), height: Math.max(1, h - 1.5).toFixed(1), rx: 1.5 }));
      });
      if (dd.getDate() <= 7) svg.appendChild(sv('text', { x: bx.toFixed(1), y: H - 3, 'font-size': 9 }, T.MON[dd.getMonth()]));
      var hit = sv('rect', { x: (i * slot).toFixed(1), y: 0, width: slot.toFixed(1), height: H, fill: 'transparent' });
      hit.addEventListener('pointerenter', function (ev) {
        var f = document.createDocumentFragment();
        f.appendChild(el('b', null, 'Week of ' + T.dm(dd)));
        f.appendChild(el('span', { class: 'v' }, el('strong', null, T.int(x[0] + x[1] + x[2])), ' commits'));
        f.appendChild(el('span', { class: 'v' }, 'You ' + x[0] + ', Claude ' + x[1] + ', Codex ' + x[2]));
        T.tip.show(f, ev.clientX, ev.clientY);
      });
      hit.addEventListener('pointerleave', T.tip.hide);
      svg.appendChild(hit);
    });
    host.appendChild(svg);

    // the loop: where work is sitting right now
    var tasks = T.tasks.filter(T.taskInLens), loop = T.$('#loop'); T.clear(loop);
    var c = function (f) { return tasks.filter(f).length; };
    [['Briefed', c(function (t) { return t.kind !== 'gate' && (t.status === 'ready' || t.status === 'backlog'); })],
      ['Building', c(function (t) { return t.kind !== 'gate' && t.status === 'doing'; })],
      ['In review', c(function (t) { return t.status === 'review'; })],
      ['Waiting on you', c(function (t) { return t.kind === 'gate' && t.status !== 'done'; }), true],
      ['Done', c(function (t) { return t.status === 'done'; })]].forEach(function (s) {
      loop.appendChild(el('div', { class: s[2] ? 'stuck' : '' }, el('b', null, String(s[1])), el('span', null, s[0])));
    });

    // open work: pull requests waiting, grouped by branch, newest first
    var ow = T.$('#openWork'); T.clear(ow);
    var cs = G.changes.filter(function (c) { return T.changeInLens(c) && c.agent !== 'bot'; });
    var waiting = 0; cs.forEach(function (c) { waiting += c.repos.length; });
    T.$('#openN').textContent = waiting ? T.plural(waiting, 'pull request') + ' open' : '';
    cs.slice(0, S.mode === 'pano' ? 4 : 10).forEach(function (c) {
      var where = c.repos.length > 1 ? T.plural(c.repos.length, 'repo') : T.projectName(c.repos[0][0]);
      var b = el('button', { class: 'row' }, T.agentGlyph(c.agent, Date.now() - new Date(c.last).getTime() < 3 * 36e5),
        el('span', null, el('span', { class: 'row-t' }, c.title), el('span', { class: 'row-s' }, where + ', ' + c.who.slice(0, 2).join(', '))),
        el('span', { class: 'row-r' }, T.ago(c.last)));
      b.addEventListener('click', function () { T.openChange(c, b); });
      ow.appendChild(b);
    });
    if (cs.length > (S.mode === 'pano' ? 4 : 10)) ow.appendChild(el('li', { class: 'more' }, '+ ' + (cs.length - (S.mode === 'pano' ? 4 : 10)) + ' more on the board'));
    // on the ultrawide nothing scrolls: keep the rows that fit and count the rest
    if (S.mode === 'pano') {
      var mod = T.$('#m-agents'), rows = T.$$('#openWork > button'), cut = 0;
      while (rows.length && mod.scrollHeight > mod.clientHeight + 1) { rows.pop().remove(); cut++; }
      if (cut) {
        var more = ow.querySelector('.more'), left = cs.length - rows.length;
        if (!more) { more = el('li', { class: 'more' }); ow.appendChild(more); }
        more.textContent = left ? '+ ' + left + ' more on the board' : '';
        if (!rows.length) more.textContent = 'All ' + cs.length + ' are on the board, under In review.';
      }
    }
  };

  // ------------------------------------------------------------ vitals
  T.renderVitals = function () {
    var ps = lensProjects(), scan = ps.filter(function (p) { return p.src === 'scan'; });
    var commits = 0, you = 0, branches = 0;
    scan.forEach(function (p) { commits += p.commits; you += p.agents.you || 0; branches += p.branches || 0; });
    // leverage: agent hours for each hour of yours, from commit times, last four weeks that have data
    var keys = Object.keys(G.agent_hours).concat(Object.keys(G.work_hours)).filter(function (k) { return k >= '2026-09-08'; });
    var ah = 0, yh = 0;
    keys.filter(function (k, i, a) { return a.indexOf(k) === i; }).forEach(function (k) {
      var a = G.agent_hours[k] || {}; ah += (a.claude || 0) + (a.codex || 0); yh += G.work_hours[k] || 0;
    });
    var st = T.$('#stats'); T.clear(st);
    function stat(v, label, off) { st.appendChild(el('div', { class: 'stat' + (off ? ' off' : '') }, el('b', null, v), el('span', null, label))); }
    stat(T.int(commits), 'commits since May');
    stat(commits ? T.pct(you / commits) : '0%', 'made by you');
    stat(yh ? Math.round(ah / yh) + '×' : '0', 'agent hours per hour of yours');
    var prs = 0, open = 0; scan.forEach(function (p) { prs += p.prs || 0; open += p.prs_open || 0; });
    stat(T.int(prs), 'pull requests, ' + open + ' open');
    stat(T.int(branches), 'branches');
    stat('\u2013', 'stars and forks, need a token', true);

    // your commits, sixteen weeks, one cell a day
    var heat = T.$('#heat'); T.clear(heat);
    var first = new Date(G.days[0][0] + 'T00:00:00'), lead = (first.getDay() + 6) % 7, i;
    for (i = 0; i < lead; i++) heat.appendChild(el('i', { style: { visibility: 'hidden' } }));
    G.days.forEach(function (r) {
      var n = r[1], l = n === 0 ? 0 : n < 3 ? 1 : n < 10 ? 2 : n < 30 ? 3 : 4;
      heat.appendChild(el('i', { data: { l: l }, title: T.dm(r[0]) + ': ' + T.plural(n, 'commit') }));
    });
    // when you commit
    var hh = T.$('#hours'); T.clear(hh);
    var W = hh.clientWidth || 200, H = Math.max(44, Math.min(74, W * 0.3)), mx = Math.max.apply(null, G.hours_ist), slot = W / 24;
    var svg = sv('svg', { class: 'mini', viewBox: '0 0 ' + W + ' ' + H, height: H, role: 'img', 'aria-label': 'Your commits by hour of day, India time' });
    svg.appendChild(sv('line', { x1: 0, x2: W, y1: H - 12, y2: H - 12, stroke: 'rgba(255,255,255,.14)' }));
    G.hours_ist.forEach(function (n, h) {
      var bh = n ? Math.max(2, n / mx * (H - 16)) : 0, bw = Math.min(10, slot * 0.62);
      if (bh) svg.appendChild(sv('rect', { x: (h * slot + (slot - bw) / 2).toFixed(1), y: (H - 12 - bh).toFixed(1), width: bw.toFixed(1), height: bh.toFixed(1), rx: 1.5, fill: 'rgba(199,239,158,.78)' },
        sv('title', null, T.pad(h) + ':00, ' + T.plural(n, 'commit'))));
      if (h % 6 === 0) svg.appendChild(sv('text', { x: (h * slot).toFixed(1), y: H - 2, 'font-size': 9 }, T.pad(h)));
    });
    hh.appendChild(svg);

    var pr = T.$('#progress'); T.clear(pr);
    SEED.completion.filter(function (c) { return T.inLens(c.p); }).slice(0, S.mode === 'pano' ? 4 : 6).forEach(function (c) {
      pr.appendChild(el('button', { class: 'prog', on: { click: function () { T.setLens('p:' + c.p); } } },
        el('span', { class: 'prog-n' }, T.projectName(c.p), el('span', null, c.label)), el('span', { class: 'prog-v' }, T.pct(c.v)),
        el('span', { class: 'prog-b' }, el('i', { style: { width: (c.v * 100) + '%' } }))));
    });
    if (!pr.children.length) pr.appendChild(el('span', { class: 'empty' }, 'No milestone in this lens.'));
    var tp = SEED.throughput, o = 0, c2 = 0;
    tp.opened.forEach(function (v) { o += v; }); tp.closed.forEach(function (v) { c2 += v; });
    var th = T.$('#through'); T.clear(th);
    th.appendChild(el('b', null, T.pct(c2 / o)));
    th.appendChild(document.createTextNode(' of tasks opened in 8 weeks are closed. Median ' + tp.cycleDays + ' days from start to done.'));
  };

  // ------------------------------------------------------------ signal (simulated until the stream is connected)
  var sig = { t: 0, amp: [0.5, 0.4, 0.6, 0.5, 0.2], hist: [], raf: 0, last: 0, canvas: null, ctx: null, w: 0, h: 0, dpr: 1 };
  var F = [2, 6, 10, 20, 38];
  function sample(t, ch) {
    var v = 0, i;
    for (i = 0; i < 5; i++) v += sig.amp[i] * Math.sin(2 * Math.PI * F[i] * (t + ch * 0.137) + ch * 1.7 + i);
    return v + (Math.random() - 0.5) * 0.5;
  }
  function sizeCanvas() {
    var c = sig.canvas;
    if (!c) return;
    sig.dpr = Math.min(2, window.devicePixelRatio || 1);
    sig.w = c.clientWidth; sig.h = c.clientHeight;
    c.width = Math.round(sig.w * sig.dpr); c.height = Math.round(sig.h * sig.dpr);
  }
  function drawSignal(now) {
    sig.raf = requestAnimationFrame(drawSignal);
    if (!sig.canvas || !sig.canvas.offsetParent || document.hidden || S.lean === 'back') return;
    if (now - sig.last < 33) return;
    var dt = sig.last ? Math.min(0.1, (now - sig.last) / 1000) : 0.033;
    sig.last = now; sig.t += dt;
    // the band amplitudes wander slowly; the bars read the same numbers the trace is made of
    for (var i = 0; i < 5; i++) sig.amp[i] = Math.max(0.08, Math.min(1, sig.amp[i] + (Math.random() - 0.5) * 0.02 + (0.5 - sig.amp[i]) * 0.002));
    var ctx = sig.ctx, w = sig.w, h = sig.h, CH = 3, span = 4, n = Math.max(60, Math.floor(w / 2));
    ctx.setTransform(sig.dpr, 0, 0, sig.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (var ch = 0; ch < CH; ch++) {
      var cy = h * (ch + 0.5) / CH, k;
      ctx.beginPath();
      for (k = 0; k <= n; k++) {
        var tt = sig.t - span + span * k / n, v = sample(tt, ch) * 0.2;
        var px = w * k / n, py = cy - v * (h / CH) * 0.9;
        if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.strokeStyle = 'rgba(236,232,228,' + (ch === 0 ? 0.85 : 0.38) + ')';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
  function tickBands() {
    var bars = T.$$('#bands .band i'), sum = 0;
    if (!bars.length || !bars[0].offsetParent) return;
    sig.amp.forEach(function (a) { sum += a * a; });
    sig.amp.forEach(function (a, i) { bars[i].style.height = Math.round(18 + a * a / sum * 180) + '%'; });
    var live = T.$('#sigLive');
    if (live) live.textContent = S.liveDerived ? 'Focus estimate ' + (sig.amp[3] / (sig.amp[1] + sig.amp[2])).toFixed(2) + ', beta over theta and alpha' : 'Derived focus appears after each block, following the Baseline rule.';
  }
  T.renderSignal = function () {
    var bands = T.$('#bands');
    if (!bands.children.length) {
      [['δ', 'delta'], ['θ', 'theta'], ['α', 'alpha'], ['β', 'beta'], ['γ', 'gamma']].forEach(function (b) {
        bands.appendChild(el('div', { class: 'band', title: b[1] }, el('i'), el('span', null, b[0])));
      });
      var cups = T.$('#cups'), q = [[2, 2, 1, 2, 2, 2], [2, 1, 2, 2, 0, 2]];
      q.forEach(function (row, i) {
        var cup = el('div', { class: 'cup', title: (i ? 'Right' : 'Left') + ' ear cup, six contacts' });
        row.forEach(function (v) { cup.appendChild(el('i', { data: { q: v } })); });
        cups.appendChild(cup);
      });
      var swb = T.$('#liveSw');
      swb.addEventListener('click', function () { S.liveDerived = !S.liveDerived; swb.setAttribute('aria-pressed', String(S.liveDerived)); tickBands(); });
      sig.canvas = T.$('#sigCanvas'); sig.ctx = sig.canvas.getContext('2d');
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      sizeCanvas();
      if (reduce) { sig.t = 4; cancelAnimationFrame(sig.raf); sig.last = 0; requestAnimationFrame(function (n) { drawSignal(n); cancelAnimationFrame(sig.raf); }); }
      else sig.raf = requestAnimationFrame(drawSignal);
      setInterval(tickBands, 500);
    }
    sizeCanvas();
    tickBands();
    renderAfter();
  };
  // what the headset says about each block once it is over: Baseline's rule is no live score, so this is where focus shows
  // the sample blocks, newest first, as numbers: what the panel shows, for anything else that asks
  T.blockSamples = function () {
    var names = {}; SEED.sounds.forEach(function (s) { names[s.id] = s.name.toLowerCase(); });
    var plan = ['brown', 'rain', 'brown', 'none', 'drone'];
    return SEED.blocks.map(function (b, i) {
      var h = Math.floor(b[0]), m = Math.round((b[0] - h) * 60), snd = plan[i % plan.length];
      return { at: T.pad(h) + ':' + T.pad(m), min: b[1], sound: snd === 'none' ? 'silence' : names[snd],
        focus: 0.56 + ((Math.round(b[0] * 10) * 37) % 25) / 100, calm: 0.38 + ((Math.round(b[0] * 10) * 53) % 29) / 100 };
    }).reverse();
  };
  function renderAfter() {
    var ul = T.$('#afterBlocks');
    if (!ul) return;
    T.clear(ul);
    var names = {}; SEED.sounds.forEach(function (s) { names[s.id] = s.name.toLowerCase(); });
    var plan = ['brown', 'rain', 'brown', 'none', 'drone'];
    SEED.blocks.map(function (b, i) { return { b: b, i: i }; }).reverse().forEach(function (x) {
      var b = x.b, f = 0.56 + ((Math.round(b[0] * 10) * 37) % 25) / 100, calm = 0.38 + ((Math.round(b[0] * 10) * 53) % 29) / 100;
      var h = Math.floor(b[0]), m = Math.round((b[0] - h) * 60);
      ul.appendChild(el('li', { class: 'row' }, el('span', { class: 'row-r' }, T.pad(h) + ':' + T.pad(m)),
        el('span', null, el('span', { class: 'row-t' }, b[1] + ' min, ' + (plan[x.i % plan.length] === 'none' ? 'silence' : names[plan[x.i % plan.length]])),
          el('span', { class: 'row-s' }, 'focus ' + f.toFixed(2) + ', calm ' + calm.toFixed(2))),
        el('span', { class: 'fbar', title: 'Focus estimate, beta over theta and alpha' }, el('i', { style: { width: Math.round(f * 100) + '%' } }))));
    });
  }

  // ------------------------------------------------------------ focus: a session clock and sound made on the device
  var fo = { running: false, start: 0, elapsed: 0, target: 50 * 60, sound: 'none', vol: 0.5, ctx: null, gain: null, nodes: [], lock: null };
  function noiseBuffer(ctx, kind) {
    var len = ctx.sampleRate * 4, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c), last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (var i = 0; i < len; i++) {
        var w = Math.random() * 2 - 1;
        if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
        else if (kind === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        } else d[i] = w * 0.5;
      }
    }
    return buf;
  }
  function stopSound() {
    if (own.el) { try { own.el.pause(); } catch (e) { /* not playing */ } }
    fo.nodes.forEach(function (n) { try { n.stop ? n.stop() : n.disconnect(); } catch (e) { /* already stopped */ } });
    fo.nodes = [];
  }
  function startSound(id) {
    stopSound();
    if (id === 'none') return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { T.toast('This browser cannot make sound here.'); return false; }
    try {
      fo.ctx = fo.ctx || new AC();
      if (fo.ctx.state === 'suspended') fo.ctx.resume();
      if (!fo.gain) { fo.gain = fo.ctx.createGain(); fo.gain.connect(fo.ctx.destination); }
      fo.gain.gain.value = fo.vol * fo.vol;
      var ctx = fo.ctx, src, f, f2, lfo, lg;
      if (id === 'brown' || id === 'pink') {
        src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, id); src.loop = true; src.connect(fo.gain); src.start(); fo.nodes.push(src);
      } else if (id === 'rain') {
        src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, 'white'); src.loop = true;
        f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
        f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 7000;
        lg = ctx.createGain(); lg.gain.value = 0.5;
        lfo = ctx.createOscillator(); lfo.frequency.value = 0.13; var la = ctx.createGain(); la.gain.value = 0.16; lfo.connect(la); la.connect(lg.gain);
        src.connect(f); f.connect(f2); f2.connect(lg); lg.connect(fo.gain); src.start(); lfo.start();
        var low = ctx.createBufferSource(); low.buffer = noiseBuffer(ctx, 'brown'); low.loop = true; var lg2 = ctx.createGain(); lg2.gain.value = 0.35;
        low.connect(lg2); lg2.connect(fo.gain); low.start();
        fo.nodes.push(src, lfo, low);
      } else if (id === 'drone') {
        f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; f.connect(fo.gain);
        [55, 82.41, 110, 164.81].forEach(function (hz, i) {
          var o = ctx.createOscillator(), g = ctx.createGain();
          o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = hz; o.detune.value = (i - 1.5) * 4; g.gain.value = 0.16 / (i * 0.5 + 1);
          o.connect(g); g.connect(f); o.start(); fo.nodes.push(o);
        });
        lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; lg = ctx.createGain(); lg.gain.value = 160; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); fo.nodes.push(lfo);
      }
      return true;
    } catch (e) { T.toast('Sound did not start. Tap once more.'); return false; }
  }
  function fmtClock(sec) { return T.pad(Math.floor(sec / 60)) + ':' + T.pad(Math.floor(sec % 60)); }
  function paintFocus() {
    var el2 = fo.running ? fo.elapsed + (Date.now() - fo.start) / 1000 : fo.elapsed;
    T.$('#foT').textContent = fmtClock(el2);
    T.$('#foS').textContent = fo.running ? 'In a block of ' + Math.round(fo.target / 60) + ' minutes' : el2 > 0 ? 'Paused' : 'Start a ' + Math.round(fo.target / 60) + ' minute block';
    var b = T.$('#foPlay');
    b.setAttribute('aria-pressed', String(fo.running));
    b.setAttribute('aria-label', fo.running ? 'Pause the block' : 'Start a focus block');
    T.$('#foIcon').setAttribute('d', fo.running ? 'M6 4h4v16H6zM14 4h4v16h-4z' : 'M7 4l13 8-13 8z');
    if (T.nucleusRing) T.nucleusRing(el2 / fo.target);
  }
  T.focusRunning = function () { return fo.running; };
  T.toggleFocus = function () {
    if (fo.running) { fo.elapsed += (Date.now() - fo.start) / 1000; fo.running = false; stopSound(); if (fo.lock) { try { fo.lock.release(); } catch (e) { /* gone */ } fo.lock = null; } }
    else {
      fo.running = true; fo.start = Date.now();
      if (fo.sound === 'own' && own.el) { var pp = own.el.play(); if (pp && pp.catch) pp.catch(function () { /* needs a tap */ }); }
      else if (fo.sound !== 'none') startSound(fo.sound);
      if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request('screen').then(function (l) { fo.lock = l; }).catch(function () { /* optional */ });
    }
    paintFocus();
  };
  // the day as a dial: midnight at the top, now as a hand. Outer ring: focus blocks. Inner ticks: when you commit.
  // Diamonds: today's nudges. The ring around the chord's nucleus shows the block in progress.
  T.renderDial = function () {
    var host = T.$('#dial');
    if (!host) return;
    T.clear(host);
    var R = 100, now = new Date(), nowH = now.getHours() + now.getMinutes() / 60;
    function ang(h) { return (h / 24) * 2 * Math.PI - Math.PI / 2; }
    function pt(r, h) { var a = ang(h); return [r * Math.cos(a), r * Math.sin(a)]; }
    function arc(r, h0, h1) {
      var p0 = pt(r, h0), p1 = pt(r, h1), big = (h1 - h0) > 12 ? 1 : 0;
      return 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + 'A' + r + ' ' + r + ' 0 ' + big + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
    }
    var svg = sv('svg', { viewBox: '-122 -122 244 244', role: 'img', 'aria-label': 'Today as a 24 hour dial: focus blocks, your usual commit hours and the nudges due today' });
    svg.appendChild(sv('circle', { class: 'dl-track', r: R }));
    for (var h = 0; h < 24; h++) {
      var a = pt(R + 5, h), b = pt(R + (h % 6 ? 8 : 12), h);
      svg.appendChild(sv('line', { class: 'dl-hour', x1: a[0], y1: a[1], x2: b[0], y2: b[1] }));
      if (h % 6 === 0) { var tp = pt(R + 19, h); svg.appendChild(sv('text', { class: 'dl-t', x: tp[0], y: tp[1], dy: '.35em' }, T.pad(h))); }
    }
    // your commit hours, real, as radial ticks inside the ring
    var mx = Math.max.apply(null, G.hours_ist);
    G.hours_ist.forEach(function (n, hh) {
      if (!n) return;
      var len = 6 + 34 * n / mx, p0 = pt(R - 10, hh + 0.5), p1 = pt(R - 10 - len, hh + 0.5);
      svg.appendChild(sv('line', { class: 'dl-commit', x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1] }, sv('title', null, T.pad(hh) + ':00, ' + T.plural(n, 'commit') + ' since May')));
    });
    // focus blocks in the last day (sample until the headset is connected)
    var tot = 0, longest = 0;
    SEED.blocks.forEach(function (bk) {
      // a block belongs to the last 24 hours, so a block from yesterday evening still shows after midnight
      var ago = ((nowH - bk[0]) % 24 + 24) % 24, h0 = bk[0], h1 = bk[0] + Math.min(bk[1] / 60, ago);
      if (h1 <= h0) return;
      tot += bk[1]; longest = Math.max(longest, bk[1]);
      svg.appendChild(sv('path', { class: 'dl-block', d: arc(R, h0, h1) }, sv('title', null, T.pad(Math.floor(h0)) + ':' + T.pad(Math.round(h0 % 1 * 60)) + ', ' + bk[1] + ' minutes')));
    });
    // today's nudges
    var end = new Date(now); end.setHours(23, 59, 59, 999);
    var start = new Date(now); start.setHours(0, 0, 0, 0);
    T.upcomingNudges(40).concat([]).forEach(function (n) {
      if (n.when > end) return;
      var hh = n.when.getHours() + n.when.getMinutes() / 60, p = pt(R, hh);
      svg.appendChild(sv('rect', { class: 'dl-nudge', x: p[0] - 3.4, y: p[1] - 3.4, width: 6.8, height: 6.8, transform: 'rotate(45 ' + p[0] + ' ' + p[1] + ')' }, sv('title', null, T.hm(n.when) + ', ' + n.item.title)));
    });
    // now
    var hn = pt(R + 3, nowH);
    svg.appendChild(sv('line', { class: 'dl-now', x1: 0, y1: 0, x2: hn[0], y2: hn[1] }));
    svg.appendChild(sv('circle', { class: 'dl-hub', r: 3 }));
    host.appendChild(svg);
    void start;
    T.$('#dialCap').textContent = SEED.blocks.length + ' focus blocks in the last 24 hours, ' + Math.floor(tot / 60) + ' h ' + (tot % 60) + ' min, longest ' + longest + '. Ticks inside are your usual commit hours.';
  };

  var own = { url: null, el: null, name: '' };
  function playOwn(file) {
    try {
      if (own.url) URL.revokeObjectURL(own.url);
      own.url = URL.createObjectURL(file); own.name = file.name;
      own.el = own.el || new Audio();
      own.el.src = own.url; own.el.loop = true; own.el.volume = fo.vol;
      stopSound();
      fo.sound = 'own';
      T.$$('#sounds .snd').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-id') === 'own')); });
      T.$('#ownName').textContent = file.name;
      var pr = own.el.play();
      if (pr && pr.catch) pr.catch(function () { T.toast('Tap play to start ' + file.name + '.'); });
      if (!fo.running) T.toggleFocus();
    } catch (e) { T.toast('That file did not play here.'); }
  }

  T.renderFocus = function () {
    var list = T.$('#sounds');
    T.renderDial();
    if (!list.children.length) {
      var mx = 0; SEED.sounds.forEach(function (s) { mx = Math.max(mx, s.median); });
      SEED.sounds.forEach(function (s) {
        var b = el('button', { class: 'snd', 'aria-pressed': String(fo.sound === s.id), data: { id: s.id } }, el('i', { class: 'snd-o' }), el('span', { class: 'snd-n' }, s.name),
          el('span', { class: 'snd-b' }, el('i', { style: { width: (s.median / mx * 100) + '%' } })), el('span', { class: 'snd-v' }, s.median + ' min, n ' + s.n));
        b.addEventListener('click', function () {
          fo.sound = s.id;
          T.$$('#sounds .snd').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-id') === s.id)); });
          if (startSound(s.id) && s.id !== 'none') T.toast(s.name + ', made on this device.');
        });
        list.appendChild(b);
      });
      var ownB = el('button', { class: 'snd', 'aria-pressed': 'false', data: { id: 'own' } }, el('i', { class: 'snd-o' }), el('span', { class: 'snd-n' }, 'Your own file'),
        el('span', { class: 'snd-own', id: 'ownName' }, 'from this device, stays here'), el('span', { class: 'snd-v' }, 'open'));
      var fin = el('input', { type: 'file', accept: 'audio/*', id: 'ownFile', class: 'sr', 'aria-label': 'Choose an audio file' });
      fin.addEventListener('change', function () { if (fin.files && fin.files[0]) playOwn(fin.files[0]); });
      ownB.addEventListener('click', function () { if (own.url && fo.sound !== 'own') { stopSound(); fo.sound = 'own'; T.$$('#sounds .snd').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-id') === 'own')); }); if (fo.running) own.el.play(); } else fin.click(); });
      list.appendChild(ownB); list.appendChild(fin);
      T.$('#foPlay').addEventListener('click', T.toggleFocus);
      var v = T.$('#vol');
      v.addEventListener('input', function () { fo.vol = v.value / 100; if (fo.gain) fo.gain.gain.value = fo.vol * fo.vol; if (own.el) own.el.volume = fo.vol; });
      setInterval(paintFocus, 1000);
    }
    paintFocus();
  };

  T.widgets = [
    { id: 'signal', title: 'Signal', reads: ['eeg.raw', 'eeg.bands', 'eeg.contact', 'focus.blocks'], render: T.renderSignal },
    { id: 'focus', title: 'Focus', reads: ['focus.session', 'focus.blocks', 'schedule.nudges', 'git.hours'], render: T.renderFocus }
  ];
})();
