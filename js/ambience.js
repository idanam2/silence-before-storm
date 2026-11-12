// Ambience beds + generative music, all synthesized (no files). Called by js/audio.js:
//   G.ambience.init(A)                      once, after the AudioContext exists
//   G.ambience.set(A, place, indoor, menu)  on every area change (no-op if unchanged); 2.5 s crossfade
//   G.ambience.update(A, dt)                every frame: schedules sparse events / notes ~0.3 s ahead
// Ambience goes to A.amb, music to A.music. Every level change is a ramp (no clicks), one-shots stop themselves.
(function (root) {
  var G = root.G = root.G || {};

  var LOOK = 0.3;          // scheduling lookahead (s)
  var FADE = 2.5;          // bed crossfade (s)
  var MAXV = 20;           // max music oscillators sounding at once
  var URBAN = { neighborhood: 1, police: 1, hospital: 1, military: 1, airport: 1, port: 1 };
  var HOLLOW = { port: 1, airport: 1, military: 1, farm: 1, quarry: 1 };   // warehouses / hangars / barns

  var S = { A: null, ready: false, key: null, bed: null, dying: [], music: null };

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // ---------------------------------------------------------------- one-shot building blocks
  // Linear env on a fresh gain: 0.0001 -> peak (a) -> hold -> 0.0001 (r). Never reaches 0 exactly.
  function lin(g, t, a, hold, r, peak) {
    var p = g.gain;
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + a);
    if (hold > 0) p.setValueAtTime(peak, t + a + hold);
    p.linearRampToValueAtTime(0.0001, t + a + hold + r);
  }
  // A train of tiny linear spikes on one gain (crackle, rattle, gravel). times must be sorted.
  function spikes(g, times, peaks, len) {
    var p = g.gain;
    p.setValueAtTime(0.0001, times[0] - 0.01);
    for (var i = 0; i < times.length; i++) {
      p.linearRampToValueAtTime(0.0001, times[i]);
      p.linearRampToValueAtTime(peaks[i], times[i] + 0.002);
      p.linearRampToValueAtTime(0.0001, times[i] + len);
    }
  }
  function sortedTimes(t, n, span) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(t + Math.random() * span);
    a.sort(function (x, y) { return x - y; });
    for (var j = 1; j < a.length; j++) if (a[j] - a[j - 1] < 0.02) a[j] = a[j - 1] + 0.02;
    return a;
  }
  // carrier -> am gain (LFO modulated around 0.5) -> env gain -> d. env fades before the stop, so no click.
  function amChain(A, t, dur, rate, wave, d) {
    var am = A.gain(0.5), env = A.gain(0.0001, d);
    am.connect(env);
    var l = A.osc(wave || 'square', rate, t, dur), lg = A.gain(0.45);
    l.connect(lg); lg.connect(am.gain);
    return { am: am, env: env };
  }

  // ---------------------------------------------------------------- one-shot events (A, dest, t)
  var EV = {
    bird: function (A, d, t) {
      var n = 2 + ((Math.random() * 4) | 0), f0 = rnd(2600, 4400), s = t;
      for (var i = 0; i < n; i++) {
        var g = A.gain(0.0001, d), len = rnd(0.05, 0.11);
        A.env(g, s, 0.01, len, rnd(0.025, 0.05));
        var o = A.osc('sine', f0 * rnd(0.92, 1.08), s, len + 0.05, g);
        o.frequency.linearRampToValueAtTime(f0 * rnd(0.7, 1.4), s + len);
        s += rnd(0.09, 0.2);
      }
    },
    crackle: function (A, d, t) {
      var dur = rnd(0.8, 1.8), n = 4 + ((Math.random() * 9) | 0);
      var g = A.gain(0.0001, d), hp = A.filter('highpass', rnd(1800, 3200), 0.7, g);
      A.noise(t, dur + 0.1, hp);
      var ts = sortedTimes(t + 0.02, n, dur), pk = [];
      for (var i = 0; i < n; i++) pk.push(rnd(0.03, 0.09));
      spikes(g, ts, pk, 0.012);
    },
    creak: function (A, d, t, base, bp, peak, dur) {
      base = base || rnd(90, 150); dur = dur || rnd(0.7, 1.4); peak = peak || 0.03;
      var ch = amChain(A, t, dur, rnd(16, 30), 'square', d);
      var f = A.filter('bandpass', bp || rnd(700, 1100), 6, ch.am);
      var o = A.osc('sawtooth', base, t, dur, f);
      o.frequency.linearRampToValueAtTime(base * rnd(1.1, 1.35), t + dur * 0.45);
      o.frequency.linearRampToValueAtTime(base * rnd(0.85, 1), t + dur);
      lin(ch.env, t, dur * 0.3, dur * 0.2, dur * 0.45, peak);
    },
    caw: function (A, d, t) {
      var n = 2 + ((Math.random() * 2) | 0), lp = A.filter('lowpass', 1800, 0.7, d);
      for (var i = 0; i < n; i++) {
        var s = t + i * rnd(0.38, 0.5), g = A.gain(0.0001, lp), bp = A.filter('bandpass', 1250, 4, g);
        var o = A.osc('sawtooth', rnd(560, 640), s, 0.3, bp);
        o.frequency.linearRampToValueAtTime(rnd(400, 450), s + 0.24);
        lin(g, s, 0.03, 0.08, 0.15, 0.03);
      }
    },
    crickets: function (A, d, t) {
      var dur = rnd(1.5, 3), ch = amChain(A, t, dur, rnd(24, 34), 'square', d);
      A.osc('sine', rnd(4000, 4700), t, dur, ch.am);
      lin(ch.env, t, 0.4, dur - 0.9, 0.5, rnd(0.006, 0.012));
    },
    metal: function (A, d, t) {   // distant windmill / sign creak
      var dur = rnd(1.4, 2.2), ch = amChain(A, t, dur, rnd(9, 14), 'triangle', d);
      var f = A.filter('bandpass', rnd(500, 700), 9, ch.am);
      var o = A.osc('triangle', 220, t, dur, f);
      o.frequency.linearRampToValueAtTime(rnd(180, 195), t + dur * 0.5);
      o.frequency.linearRampToValueAtTime(rnd(225, 245), t + dur);
      lin(ch.env, t, dur * 0.35, dur * 0.2, dur * 0.4, 0.035);
    },
    bark: function (A, d, t) {
      var n = 1 + ((Math.random() * 3) | 0), lp = A.filter('lowpass', 1100, 0.7, d);
      for (var i = 0; i < n; i++) {
        var s = t + i * rnd(0.3, 0.45), g = A.gain(0.0001, lp), bp = A.filter('bandpass', 800, 2, g);
        var o = A.osc('sawtooth', rnd(380, 440), s, 0.16, bp);
        o.frequency.linearRampToValueAtTime(rnd(240, 280), s + 0.12);
        lin(g, s, 0.015, 0.04, 0.08, 0.018);
      }
    },
    gate: function (A, d, t) {
      var dur = rnd(0.9, 1.5);
      EV.creak(A, d, t, rnd(170, 250), rnd(1000, 1500), 0.022, dur);
      if (Math.random() < 0.6) {           // soft knock as it swings shut
        var g = A.gain(0.0001, d), o = A.osc('sine', 110, t + dur, 0.2, g);
        o.frequency.linearRampToValueAtTime(65, t + dur + 0.15);
        A.env(g, t + dur, 0.004, 0.16, 0.04);
      }
    },
    tin: function (A, d, t) {
      var n = 3 + ((Math.random() * 5) | 0), span = rnd(0.4, 0.9);
      var g = A.gain(0.0001, d), bp = A.filter('bandpass', rnd(2800, 4200), 7, g);
      A.noise(t, span + 0.2, bp);
      var ts = sortedTimes(t + 0.02, n, span), pk = [];
      for (var i = 0; i < n; i++) pk.push(rnd(0.05, 0.12) * (1 - i / (n + 2)));
      spikes(g, ts, pk, 0.05);
    },
    gravel: function (A, d, t) {
      var dur = rnd(1, 2.4), n = 10 + ((Math.random() * 16) | 0);
      var g = A.gain(0.0001, d), hp = A.filter('highpass', rnd(1500, 2400), 0.8, g);
      A.noise(t, dur + 0.2, hp);
      var ts = [], pk = [], s = t + 0.02;
      for (var i = 0; i < n; i++) { s += rnd(0.02, 0.09) * (1 + i / n * 2); ts.push(s); pk.push(rnd(0.015, 0.045) * (1 - i / n * 0.7)); }
      spikes(g, ts, pk, 0.02);
      if (Math.random() < 0.3) {          // a bigger stone thumps first
        var g2 = A.gain(0.0001, d), lp = A.filter('lowpass', 260, 0.7, g2);
        A.noise(t, 0.6, lp);
        A.env(g2, t, 0.01, 0.45, 0.08);
      }
    },
    loon: function (A, d, t) {
      var g = A.gain(0.0001, d), lp = A.filter('lowpass', 2000, 0.7, g), dur = rnd(1.6, 2.4);
      var o = A.osc('sine', rnd(600, 650), t, dur, lp);
      o.frequency.linearRampToValueAtTime(rnd(900, 980), t + 0.5);
      o.frequency.linearRampToValueAtTime(rnd(920, 960), t + dur * 0.6);
      o.frequency.linearRampToValueAtTime(rnd(840, 880), t + dur);
      var v = A.osc('sine', 5, t, dur), vg = A.gain(10);
      v.connect(vg); vg.connect(o.frequency);
      lin(g, t, 0.35, dur * 0.4, dur * 0.6 - 0.4, 0.028);
    },
    lap: function (A, d, t) {
      var g = A.gain(0.0001, d), lp = A.filter('lowpass', rnd(380, 650), 0.7, g), dur = rnd(0.9, 1.6);
      A.noise(t, dur + 0.1, lp);
      lin(g, t, dur * 0.4, 0, dur * 0.6, rnd(0.03, 0.055));
    },
    clank: function (A, d, t) {
      var lp = A.filter('lowpass', 1500, 0.7, d), r = rnd(0.8, 1.25), n = Math.random() < 0.4 ? 2 : 1;
      for (var i = 0; i < n; i++) {
        var s = t + i * rnd(0.25, 0.5), g = A.gain(0.0001, lp), g2 = A.gain(0.0001, lp);
        A.osc('sine', 380 * r, s, 1.2, g); A.osc('sine', 1030 * r, s, 0.7, g2);
        A.env(g, s, 0.003, 1.1, 0.022); A.env(g2, s, 0.002, 0.6, 0.01);
      }
    },
    rope: function (A, d, t) {   // flag / rope slapping a pole
      var n = 3 + ((Math.random() * 5) | 0);
      var g = A.gain(0.0001, d), bp = A.filter('bandpass', rnd(700, 1100), 1.5, g);
      A.noise(t, n * 0.12 + 0.3, bp);
      var ts = [], pk = [], s = t + 0.02;
      for (var i = 0; i < n; i++) { s += rnd(0.07, 0.14); ts.push(s); pk.push(rnd(0.04, 0.08)); }
      spikes(g, ts, pk, 0.04);
    },
    fence: function (A, d, t) {
      var dur = rnd(0.6, 1.1), n = 12 + ((Math.random() * 10) | 0);
      var g = A.gain(0.0001, d), bp = A.filter('bandpass', rnd(2400, 3200), 4, g);
      A.noise(t, dur + 0.2, bp);
      var ts = sortedTimes(t + 0.02, n, dur), pk = [];
      for (var i = 0; i < n; i++) pk.push(0.025 * Math.sin(Math.PI * (i + 0.5) / n) + 0.004);
      spikes(g, ts, pk, 0.025);
    },
    boom: function (A, d, t) {   // distant hangar door
      var g = A.gain(0.0001, d), o = A.osc('sine', 50, t, 2.6, g);
      o.frequency.linearRampToValueAtTime(32, t + 2.4);
      A.env(g, t, 0.05, 2.4, 0.09);
      var g2 = A.gain(0.0001, d), lp = A.filter('lowpass', 130, 0.7, g2);
      A.noise(t, 1.8, lp);
      A.env(g2, t, 0.03, 1.6, 0.07);
    },
    buzz: function (A, d, t, peak) {   // fluorescent tube, flickering
      var dur = rnd(2, 4.5), am = A.gain(0.0001), env = A.gain(0.0001, d);
      am.connect(env);
      var bp = A.filter('bandpass', rnd(2000, 2800), 3, am);
      A.osc('sawtooth', 120, t, dur, bp);
      var p = am.gain, s = t;
      p.setValueAtTime(0.0001, t);
      while (s < t + dur - 0.1) {           // on/off flicker with tiny ramps
        var on = Math.random() < 0.7 ? 1 : 0.15;
        s += rnd(0.04, 0.35);
        p.linearRampToValueAtTime(on, s);
      }
      lin(env, t, 0.15, dur - 0.5, 0.3, peak || 0.006);
    },
    gull: function (A, d, t) {
      var n = 2 + ((Math.random() * 3) | 0);
      for (var i = 0; i < n; i++) {
        var s = t + i * rnd(0.35, 0.55), g = A.gain(0.0001, d), bp = A.filter('bandpass', 1500, 3, g);
        var o = A.osc('sawtooth', rnd(1250, 1400), s, 0.45, bp);
        o.frequency.linearRampToValueAtTime(rnd(1550, 1700), s + 0.05);
        o.frequency.linearRampToValueAtTime(rnd(950, 1050), s + 0.38);
        lin(g, s, 0.03, 0.12, 0.25, 0.022);
      }
    },
    hull: function (A, d, t) { EV.creak(A, d, t, rnd(65, 100), rnd(350, 500), 0.04, rnd(1.5, 2.6)); },
    bell: function (A, d, t) {   // buoy bell, far away
      var lp = A.filter('lowpass', 1800, 0.7, d), b = rnd(310, 350), parts = [[1, 0.02], [2.4, 0.008], [3.9, 0.004]];
      for (var i = 0; i < parts.length; i++) {
        var g = A.gain(0.0001, lp);
        A.osc('sine', b * parts[i][0], t, 3.6, g);
        A.env(g, t, 0.005, 3.4 - i * 0.8, parts[i][1]);
      }
    },
    drip: function (A, d, t) {
      var n = Math.random() < 0.3 ? 2 : 1;
      for (var i = 0; i < n; i++) {
        var s = t + i * rnd(0.5, 0.9), g = A.gain(0.0001, d), f = rnd(900, 1400);
        var o = A.osc('sine', f, s, 0.12, g);
        o.frequency.linearRampToValueAtTime(f * 2, s + 0.04);
        A.env(g, s, 0.002, 0.08, 0.022);
      }
    },
    bcreak: function (A, d, t) { EV.creak(A, d, t, rnd(55, 90), rnd(250, 380), 0.035, rnd(1, 2)); },
    hollow: function (A, d, t) {   // big empty space resonating with a gust
      var g = A.gain(0.0001, d), bp = A.filter('bandpass', rnd(130, 220), 14, g), dur = rnd(3, 5);
      A.noise(t, dur + 0.1, bp);
      lin(g, t, dur * 0.4, dur * 0.1, dur * 0.5, rnd(0.12, 0.2));
    },
    radio: function (A, d, t) {
      var dur = rnd(1.2, 2.6), g = A.gain(0.0001, d), bp = A.filter('bandpass', 1700, 1.2, g);
      A.noise(t, dur + 0.1, bp);
      lin(g, t, 0.05, dur - 0.3, 0.2, 0.018);
      var cg = A.gain(0.0001, d), hp = A.filter('highpass', 3000, 0.7, cg);
      A.noise(t, dur + 0.1, hp);
      var n = 6 + ((Math.random() * 10) | 0), ts = sortedTimes(t + 0.05, n, dur - 0.2), pk = [];
      for (var i = 0; i < n; i++) pk.push(rnd(0.02, 0.06));
      spikes(cg, ts, pk, 0.01);
      if (Math.random() < 0.6) {           // a faint wavering carrier tone
        var tg = A.gain(0.0001, d), o = A.osc('sine', rnd(650, 900), t + 0.2, dur - 0.3, tg);
        var v = A.osc('sine', rnd(2, 4), t + 0.2, dur - 0.3), vg = A.gain(rnd(15, 40));
        v.connect(vg); vg.connect(o.frequency);
        lin(tg, t + 0.2, 0.3, dur - 1.1, 0.5, 0.004);
      }
    }
  };

  // ---------------------------------------------------------------- place beds
  // layer: noise (or osc) -> filter -> gain, with slow LFOs [rate Hz, depth, 'f' | 'g'] (gain depth < g).
  // ev: [name, min s, max s]
  var WIND_URBAN = { type: 'bandpass', f: 420, q: 1.2, g: 0.075, lfos: [[0.03, 160, 'f'], [0.045, 0.04, 'g']] };
  var URBAN_EV = [['clank', 10, 26], ['rope', 12, 30], ['radio', 60, 120]];
  var HUM = { osc: 'sawtooth', hz: 60, type: 'lowpass', f: 150, q: 0.7, g: 0.004 };
  var P = {
    menu: { layers: [{ type: 'lowpass', f: 380, q: 0.6, g: 0.1, lfos: [[0.04, 150, 'f'], [0.03, 0.045, 'g']] }], ev: [] },
    base: {
      layers: [{ type: 'bandpass', f: 900, q: 0.5, g: 0.05, lfos: [[0.06, 0.025, 'g'], [0.03, 300, 'f']] },
               { type: 'lowpass', f: 300, q: 0.7, g: 0.07, lfos: [[0.045, 0.03, 'g']] }],
      ev: [['bird', 5, 14], ['crackle', 10, 26]]
    },
    forest: {
      layers: [{ type: 'bandpass', f: 1200, q: 0.6, g: 0.085, lfos: [[0.08, 0.055, 'g'], [0.05, 500, 'f']] },
               { type: 'lowpass', f: 260, q: 0.7, g: 0.07, lfos: [[0.035, 0.04, 'g']] }],
      ev: [['bird', 3, 9], ['creak', 14, 35], ['caw', 25, 60]]
    },
    farm: {
      layers: [{ type: 'lowpass', f: 600, q: 0.4, g: 0.095, lfos: [[0.03, 300, 'f'], [0.05, 0.05, 'g']] },
               { type: 'highpass', f: 3200, q: 0.5, g: 0.012, lfos: [] }],
      ev: [['crickets', 2, 6], ['metal', 12, 30], ['bird', 12, 30]]
    },
    neighborhood: {
      layers: [{ type: 'lowpass', f: 450, q: 0.6, g: 0.07, lfos: [[0.04, 0.04, 'g'], [0.025, 120, 'f']] }],
      ev: [['bark', 70, 150], ['gate', 14, 35], ['tin', 18, 45], ['radio', 60, 120]]
    },
    quarry: {
      echo: true,
      layers: [{ type: 'bandpass', f: 320, q: 3, g: 0.08, lfos: [[0.04, 120, 'f'], [0.05, 0.045, 'g']] },
               { type: 'lowpass', f: 200, q: 0.7, g: 0.06, lfos: [] }],
      ev: [['gravel', 8, 20]]
    },
    lake: {
      echo: true,
      layers: [{ type: 'lowpass', f: 700, q: 0.6, g: 0.08, lfos: [[0.18, 0.055, 'g'], [0.07, 200, 'f']] },
               { type: 'lowpass', f: 350, q: 0.6, g: 0.04, lfos: [[0.04, 0.025, 'g']] }],
      ev: [['lap', 3, 7], ['loon', 35, 80], ['bird', 15, 35]]
    },
    police: { layers: [WIND_URBAN, HUM], ev: URBAN_EV },
    hospital: { layers: [WIND_URBAN, HUM], ev: URBAN_EV.concat([['buzz', 15, 35]]) },
    military: { layers: [WIND_URBAN, HUM], ev: URBAN_EV.concat([['fence', 10, 25]]) },
    airport: {
      layers: [{ type: 'lowpass', f: 500, q: 0.5, g: 0.11, lfos: [[0.03, 0.06, 'g'], [0.02, 200, 'f']] }, HUM],
      ev: [['boom', 30, 70], ['rope', 10, 26], ['clank', 16, 40], ['radio', 60, 120]]
    },
    port: {
      layers: [{ type: 'lowpass', f: 500, q: 0.6, g: 0.11, lfos: [[0.11, 0.07, 'g']] },
               { type: 'bandpass', f: 1500, q: 0.8, g: 0.025, lfos: [[0.11, 0.018, 'g']] },
               { type: 'lowpass', f: 350, q: 0.6, g: 0.035, lfos: [] }],
      ev: [['gull', 6, 16], ['hull', 10, 24], ['bell', 18, 40], ['radio', 60, 120]]
    }
  };

  function layer(A, L, dest, t, maxLfo) {
    var c = A.ctx, nodes = [], g = c.createGain(), src, f, i;
    g.gain.value = L.g; g.connect(dest);
    f = c.createBiquadFilter(); f.type = L.type || 'lowpass'; f.frequency.value = L.f; f.Q.value = L.q == null ? 0.7 : L.q;
    f.connect(g);
    if (L.osc) {
      src = c.createOscillator(); src.type = L.osc; src.frequency.value = L.hz;
      src.connect(f); src.start(t);
    } else {
      src = c.createBufferSource(); src.buffer = A.noiseBuf(); src.loop = true;
      src.playbackRate.value = rnd(0.9, 1.1);            // decorrelates layers sharing the buffer
      src.connect(f); src.start(t, Math.random() * 1.9);
    }
    nodes.push(src);
    var lfos = L.lfos || [], n = Math.min(lfos.length, maxLfo == null ? 9 : maxLfo);
    for (i = 0; i < n; i++) {
      var o = c.createOscillator(), lg = c.createGain();
      o.type = 'sine'; o.frequency.value = lfos[i][0] * rnd(0.85, 1.15);
      lg.gain.value = lfos[i][1];
      o.connect(lg); lg.connect(lfos[i][2] === 'f' ? f.frequency : g.gain);
      o.start(t);
      nodes.push(o);
    }
    return nodes;
  }

  function makeBed(A, place, indoor, menu) {
    var c = A.ctx, t = c.currentTime, cfg = menu || !place || !P[place] ? P.menu : P[place];
    var bed = { nodes: [], ev: [], out: c.createGain(), evIn: c.createGain(), muffle: null, killAt: 0 };
    bed.out.gain.value = 0.0001;
    bed.out.gain.setValueAtTime(0.0001, t);
    bed.out.gain.linearRampToValueAtTime(1, t + FADE);
    bed.out.connect(A.amb);
    bed.evIn.gain.value = 1; bed.evIn.connect(bed.out);
    var i;
    function addEv(list, mult, muffled) {
      for (var k = 0; k < list.length; k++) {
        var e = list[k];
        bed.ev.push({ fn: e[0], min: e[1] * mult, max: e[2] * mult, muffled: muffled,
          next: t + 1.5 + rnd(e[1], e[2]) * mult * 0.5 });
      }
    }
    if (!indoor || menu || !place) {
      if (cfg.echo) {                  // short echo for wide hard spaces (quarry walls, water)
        var dl = c.createDelay(1), fb = c.createGain(), dlp = c.createBiquadFilter();
        dl.delayTime.value = rnd(0.32, 0.45); fb.gain.value = 0.33;
        dlp.type = 'lowpass'; dlp.frequency.value = 1400;
        bed.evIn.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(bed.out);
      }
      for (i = 0; i < cfg.layers.length; i++) bed.nodes = bed.nodes.concat(layer(A, cfg.layers[i], bed.out, t));
      addEv(cfg.ev, 1, false);
    } else {
      // Inside: the outside is a muffled, quieter rumble; room tone + building sounds on top.
      var muf = c.createBiquadFilter(), mg = c.createGain();
      muf.type = 'lowpass'; muf.frequency.value = 300; muf.Q.value = 0.5;
      mg.gain.value = 0.5; muf.connect(mg); mg.connect(bed.out);
      bed.muffle = muf;
      bed.nodes = bed.nodes.concat(layer(A, cfg.layers[0], muf, t, 1));
      bed.nodes = bed.nodes.concat(layer(A, { type: 'lowpass', f: 180, q: 0.7, g: 0.045, lfos: [] }, bed.out, t));
      bed.nodes = bed.nodes.concat(layer(A, { osc: 'sine', hz: rnd(50, 58), type: 'lowpass', f: 200, q: 0.7, g: 0.007, lfos: [] }, bed.out, t));
      addEv(cfg.ev, 1.8, true);
      var inEv = [['bcreak', 12, 30], ['drip', 6, 18]];
      if (place === 'hospital' || place === 'police') inEv.push(['buzz', 5, 14]);
      if (HOLLOW[place]) inEv.push(['hollow', 14, 32]);
      addEv(inEv, 1, false);
    }
    return bed;
  }

  function killBed(A, bed, fast) {
    var t = A.ctx.currentTime, p = bed.out.gain, v = p.value, len = fast ? 0.4 : FADE;
    if (!(v > 0.0001)) v = 0.0001;
    p.cancelScheduledValues(t);
    p.setValueAtTime(v, t);
    p.linearRampToValueAtTime(0.0001, t + len);
    for (var i = 0; i < bed.nodes.length; i++) bed.nodes[i].stop(t + len + 0.2);
    bed.killAt = t + len + 0.5;
    bed.ev = [];
    if (!fast) S.dying.push(bed);
  }

  function evOut(A, bed, muffled) {
    var g = A.ctx.createGain();
    g.gain.value = 1;
    var dest = muffled && bed.muffle ? bed.muffle : bed.evIn;
    if (A.ctx.createStereoPanner) {
      var p = A.ctx.createStereoPanner();
      p.pan.value = rnd(-0.8, 0.8);
      g.connect(p); p.connect(dest);
    } else g.connect(dest);
    return g;
  }

  function updateBed(A) {
    var bed = S.bed, now = A.ctx.currentTime, i;
    for (i = S.dying.length - 1; i >= 0; i--) {
      if (now > S.dying[i].killAt) { try { S.dying[i].out.disconnect(); } catch (e) {} S.dying.splice(i, 1); }
    }
    if (!bed) return;
    for (i = 0; i < bed.ev.length; i++) {
      var e = bed.ev[i];
      if (e.next < now + LOOK) {
        var t = Math.max(e.next, now + 0.02);
        try { EV[e.fn](A, evOut(A, bed, e.muffled), t); } catch (err) { if (root.console) console.warn('amb ' + e.fn, err); }
        e.next = t + rnd(e.min, e.max);
      }
    }
  }

  // ---------------------------------------------------------------- music
  var CH = {
    Am: { r: 45, n: [57, 60, 64] }, F: { r: 41, n: [57, 60, 65] }, C: { r: 48, n: [55, 60, 64] },
    G: { r: 43, n: [55, 59, 62] }, Dm: { r: 38, n: [57, 62, 65] }, Em: { r: 40, n: [55, 59, 64] }
  };
  var PROGS = [['Am', 'F', 'C', 'G'], ['Dm', 'Am', 'F', 'C'], ['Am', 'F', 'Dm', 'Em'], ['Am', 'C', 'G', 'F'], ['Am', 'Dm', 'Am', 'Em']];
  var SCALE = [64, 67, 69, 72, 74, 76, 79, 81, 84];    // A minor pentatonic, E4..C6
  var MODES = {
    menu: { level: 1, phrased: false, gap: [1.5, 3], bass: true },
    base: { level: 0.8, phrased: false, gap: [2, 4], bass: true },
    trip: { level: 0.5, phrased: true, gap: [2, 4], bass: false },
    inside: { level: 0.3, phrased: true, gap: [2.5, 4.5], bass: false }
  };

  function initMusic(A) {
    var c = A.ctx, M = {};
    M.out = c.createGain(); M.out.gain.value = 0.0001; M.out.connect(A.music);
    M.padIn = c.createGain(); M.padIn.gain.value = 1;            // ducked under tension
    var plp = c.createBiquadFilter(); plp.type = 'lowpass'; plp.frequency.value = 850; plp.Q.value = 0.5;
    M.padIn.connect(plp); plp.connect(M.out);
    M.pluckIn = c.createGain(); M.pluckIn.gain.value = 1;
    var klp = c.createBiquadFilter(); klp.type = 'lowpass'; klp.frequency.value = 2300; klp.Q.value = 0.5;
    M.pluckIn.connect(klp); klp.connect(M.out);
    var dl = c.createDelay(2), fb = c.createGain(), dlp = c.createBiquadFilter(), wet = c.createGain();
    dl.delayTime.value = 0.46; fb.gain.value = 0.38; dlp.type = 'lowpass'; dlp.frequency.value = 1500; wet.gain.value = 0.45;
    klp.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(wet); wet.connect(M.out);
    M.tg = c.createGain(); M.tg.gain.value = 0.0001; M.tg.connect(A.music);   // tension layer: own level, also in trips
    M.mode = null; M.playing = false; M.switchAt = 0; M.nextChord = 0; M.nextPluck = 0;
    M.prog = pick(PROGS); M.ci = 0; M.voices = []; M.last = 5;
    M.tOn = false; M.tOffAt = -99; M.nextBeat = 0; M.tSet = 0.0001; M.duckSet = 1; M.drone = null;
    S.music = M;
  }

  function setMusic(A, place, indoor, menu) {
    var M = S.music, now = A.ctx.currentTime;
    var mode = menu ? 'menu' : place === 'base' ? 'base' : !place ? 'trip' : indoor ? 'inside' : 'trip';
    if (mode === M.mode) return;
    var was = M.mode ? MODES[M.mode] : null, m = MODES[mode];
    M.mode = mode;
    M.out.gain.setTargetAtTime(m.level, now, 1.2);
    if (!m.phrased) {
      if (!M.playing) { M.playing = true; M.nextChord = Math.max(M.nextChord, now + 0.2); M.nextPluck = Math.max(M.nextPluck, now + rnd(2, 4)); }
    } else if (!was || !was.phrased) {
      // Leaving home: let the last chord ring out, then silence before the first phrase.
      M.playing = false; M.switchAt = now + rnd(15, 35);
    }
  }

  function voiceCount(now) {
    var M = S.music, n = 0;
    for (var i = M.voices.length - 1; i >= 0; i--) {
      if (M.voices[i].end < now) M.voices.splice(i, 1); else n += M.voices[i].n;
    }
    return n;
  }

  function chord(A, t, dur, bass) {
    var M = S.music, ch = CH[M.prog[M.ci]], i, n = 0, rel = 3.5, end = t + dur + rel;
    M.ci++;
    if (M.ci >= M.prog.length) { M.ci = 0; if (Math.random() < 0.5) M.prog = pick(PROGS); }
    for (i = 0; i < ch.n.length; i++) {
      var f = mtof(ch.n[i]), g = A.gain(0.0001, M.padIn);
      lin(g, t, 2.6, dur - 2.6, rel, 0.03);
      A.osc('triangle', f, t, dur + rel, g);
      var o = A.osc('sawtooth', f, t, dur + rel, g);
      o.detune.value = rnd(5, 9) * (i % 2 ? -1 : 1);
      n += 2;
    }
    if (bass) {
      var bg = A.gain(0.0001, M.padIn);
      lin(bg, t, 3, dur - 3, rel, 0.045);
      A.osc('sine', mtof(ch.r), t, dur + rel, bg);
      n++;
    }
    M.voices.push({ end: end + 0.1, n: n });
  }

  function pluck(A, t) {
    var M = S.music, j = clamp(M.last + ((Math.random() * 5) | 0) - 2, 0, SCALE.length - 1);
    if (j === M.last) j = clamp(j + (Math.random() < 0.5 ? -1 : 1), 0, SCALE.length - 1);
    M.last = j;
    var f = mtof(SCALE[j]), g = A.gain(0.0001, M.pluckIn), g2 = A.gain(0.0001, M.pluckIn), dec = rnd(1.1, 1.8);
    A.env(g, t, 0.004, dec, rnd(0.05, 0.075));
    A.env(g2, t, 0.004, dec * 0.5, 0.02);
    A.osc('sine', f, t, dec + 0.05, g);
    A.osc('triangle', f * 2, t, dec * 0.5 + 0.05, g2);
    M.voices.push({ end: t + dec + 0.15, n: 2 });
  }

  function thump(A, t, f, peak) {
    var M = S.music, g = A.gain(0.0001, M.tg), o = A.osc('sine', f, t, 0.3, g);
    o.frequency.linearRampToValueAtTime(f * 0.65, t + 0.14);
    A.env(g, t, 0.006, 0.24, peak);
  }

  function droneOn(A, now) {
    var c = A.ctx, g = c.createGain(), lp = c.createBiquadFilter(), oscs = [], fr = [55, 58.27, 82.4], i;
    g.gain.value = 0.0001; g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.07, now + 3);
    lp.type = 'lowpass'; lp.frequency.value = 240; lp.Q.value = 0.8;
    lp.connect(g); g.connect(S.music.tg);
    for (i = 0; i < fr.length; i++) {
      var o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr[i]; o.detune.value = rnd(-6, 6);
      o.connect(lp); o.start(now); oscs.push(o);
    }
    S.music.drone = { g: g, oscs: oscs };
  }
  function droneOff(A, now) {
    var d = S.music.drone, p = d.g.gain, v = p.value;
    if (!(v > 0.0001)) v = 0.0001;
    p.cancelScheduledValues(now); p.setValueAtTime(v, now); p.linearRampToValueAtTime(0.0001, now + 4);
    for (var i = 0; i < d.oscs.length; i++) d.oscs[i].stop(now + 4.2);
    S.music.drone = null;
  }

  function updateMusic(A) {
    var M = S.music, now = A.ctx.currentTime, la = now + LOOK, m = MODES[M.mode || 'menu'];
    var k = clamp(+A.tense || 0, 0, 1);

    // Phrases in trips: ~40 s of music, then 40-90 s of silence.
    if (m.phrased && now >= M.switchAt) {
      M.playing = !M.playing;
      M.switchAt = now + (M.playing ? rnd(34, 46) : rnd(40, 90));
      if (M.playing) { M.nextChord = Math.max(M.nextChord, now + 0.2); M.nextPluck = Math.max(M.nextPluck, now + rnd(3, 6)); }
    }
    var busy = voiceCount(now);
    if (M.playing && M.nextChord < la && busy > MAXV) M.nextChord = now + 1;   // too much still ringing: wait
    if (M.playing && M.nextChord < la) {
      var t = Math.max(M.nextChord, now + 0.02), dur = rnd(7.5, 9.5);
      chord(A, t, dur, m.bass);
      M.nextChord = t + dur;
    }
    if (M.playing && M.nextPluck < la) {
      var tp = Math.max(M.nextPluck, now + 0.02), quiet = k > 0.3 ? 0.55 : 0.2;
      if (Math.random() > quiet && busy + 2 <= MAXV) {
        pluck(A, tp);
        if (Math.random() < 0.18 && busy + 4 <= MAXV) pluck(A, tp + rnd(0.25, 0.45));   // small two-note figure
      }
      var gap = rnd(m.gap[0], m.gap[1]) * (A.indoor ? 1.15 : 1) * (1 + k);
      M.nextPluck = tp + gap;
    }

    // Tension: heartbeat + dissonant drone in, pads duck. Hysteresis 0.3 on / 0.2 off.
    if (!M.tOn && k > 0.3) { M.tOn = true; M.nextBeat = Math.max(M.nextBeat, now + 0.05); if (!M.drone) droneOn(A, now); }
    else if (M.tOn && k < 0.2) { M.tOn = false; M.tOffAt = now; if (M.drone) droneOff(A, now); }
    var tt = M.tOn ? 0.45 + 0.55 * clamp((k - 0.3) / 0.7, 0, 1) : 0.0001;
    if (Math.abs(tt - M.tSet) > 0.03) { M.tg.gain.setTargetAtTime(tt, now, M.tOn ? 0.6 : 1.4); M.tSet = tt; }
    var duck = M.tOn ? Math.max(0.25, 1 - 0.9 * k) : 1;
    if (Math.abs(duck - M.duckSet) > 0.03) { M.padIn.gain.setTargetAtTime(duck, now, 0.8); M.duckSet = duck; }
    if ((M.tOn || now - M.tOffAt < 5) && M.nextBeat < la) {
      var tb = Math.max(M.nextBeat, now + 0.02), bpm = 70 + 40 * clamp((k - 0.3) / 0.7, 0, 1), iv = 60 / bpm;
      thump(A, tb, 58, 0.5);
      thump(A, tb + iv * 0.28, 52, 0.32);
      M.nextBeat = tb + iv;
    }
  }

  // ---------------------------------------------------------------- API
  function init(A) {
    if (S.ready || !A || !A.ctx) return;
    S.A = A; S.ready = true;
    initMusic(A);
  }

  function set(A, place, indoor, menu) {
    if (!A || !A.ctx) return;
    if (!S.ready) init(A);
    var key = menu ? 'menu' : (place || 'none') + (indoor ? ':in' : '');
    if (key === S.key) return;
    S.key = key;
    // Switching faster than the crossfade: quickly fade out older beds still fading, so layers never pile up.
    for (var i = 0; i < S.dying.length - 1; i++) if (S.dying[i].killAt - A.ctx.currentTime > 0.9) killBed(A, S.dying[i], true);
    if (S.bed) killBed(A, S.bed);
    S.bed = makeBed(A, place, !!indoor, !!menu);
    setMusic(A, place, !!indoor, !!menu);
  }

  function update(A, dt) {
    if (!S.ready || !A || !A.ctx) return;
    updateBed(A);
    if (S.music && S.music.mode) updateMusic(A);
  }

  G.ambience = { init: init, set: set, update: update };
})(typeof window !== 'undefined' ? window : globalThis);
