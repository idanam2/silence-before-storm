// Synthesized one-shot sound effects (Web Audio, no files). Played through G.audio.play(name, opts).
// Each entry: function (A, dest, t, o). A = G.audio, dest = output GainNode (volume/pan done),
// t = start time, o = opts. Every source node gets a stop time, so nothing keeps running.
// Small random changes per call keep repeats from sounding identical.
(function (root) {
  var G = root.G = root.G || {};

  // ---------- small building blocks ----------
  function pos(v) { return v > 0.0001 ? v : 0.0001; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rv(v, k) { return v * rnd(1 - k, 1 + k); }          // value with +-k random spread

  // Percussive envelope without cancelling earlier events (lets one node play several hits in a row).
  function pulse(g, t, a, d, peak) {
    var p = g.gain;
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(pos(peak), t + Math.max(0.001, a));
    p.exponentialRampToValueAtTime(0.0001, t + Math.max(0.001, a) + Math.max(0.01, d));
  }
  // Rise, sustain (slight fall), release.
  function hold(g, t, a, s, d, peak) {
    var p = g.gain;
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(pos(peak), t + a);
    p.linearRampToValueAtTime(pos(peak * 0.8), t + a + s);
    p.exponentialRampToValueAtTime(0.0001, t + a + s + Math.max(0.01, d));
  }
  // Filtered noise burst. Returns {f, g} so callers can sweep the filter.
  function nz(A, dest, t, type, freq, q, a, d, peak, extra) {
    var g = A.gain(0, dest), f = A.filter(type, freq, q, g);
    A.noise(t, a + d + (extra || 0), f);
    pulse(g, t, a, d, peak);
    return { f: f, g: g };
  }
  // Oscillator tone with optional exponential pitch slide f0 -> f1.
  function tn(A, dest, t, type, f0, f1, a, d, peak, slide) {
    var g = A.gain(0, dest), o = A.osc(type, pos(f0), t, a + d, g);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(pos(f1), t + (slide || a + d));
    pulse(g, t, a, d, peak);
    return o;
  }
  function sweep(param, t, f0, f1, dur) {
    param.setValueAtTime(pos(f0), t);
    param.exponentialRampToValueAtTime(pos(f1), t + Math.max(0.01, dur));
  }
  // Soft-clip distortion (curves cached by amount).
  var curves = {};
  function shaper(A, amt, dest) {
    var k = Math.round(amt);
    if (!curves[k]) {
      var n = 1024, c = new Float32Array(n);
      for (var i = 0; i < n; i++) { var x = i * 2 / (n - 1) - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
      curves[k] = c;
    }
    var w = A.ctx.createWaveShaper();
    w.curve = curves[k];
    if (dest) w.connect(dest);
    return w;
  }
  // A wooden creak: low sawtooth stick-slip through a resonant bandpass, pitch wandering.
  function creak(A, dest, t, dur, peak) {
    var g = A.gain(0, dest), f = A.filter('bandpass', rv(1100, 0.2), 7, g);
    var o = A.osc('sawtooth', rv(38, 0.2), t, dur, f);
    var steps = 7;
    for (var i = 1; i <= steps; i++) o.frequency.linearRampToValueAtTime(rnd(26, 62), t + dur * i / steps);
    hold(g, t, 0.05, dur * 0.6, dur * 0.35, peak);
  }

  // ---------- footsteps ----------
  var SURF = {
    grass: 1, dirt: 1, gravel: 1, concrete: 1, tiles: 1, wood: 1, metal: 1, water: 1
  };

  var S = {};

  S.step = function (A, dest, t, o) {
    o = o || {};
    var s = SURF[o.surface] ? o.surface : 'dirt';
    var run = !!o.run, k = run ? 1.45 : 1, dk = run ? 0.85 : 1, fk = run ? 1.15 : 1;
    var base = 0.18 * k;
    if (s === 'grass') {
      nz(A, dest, t, 'bandpass', rv(2300, 0.2) * fk, 0.8, 0.006, 0.09 * dk, base * 0.9);
      nz(A, dest, t + rnd(0.01, 0.03), 'highpass', rv(4200, 0.15), 0.7, 0.003, 0.05 * dk, base * 0.5);
      nz(A, dest, t, 'lowpass', 240, 0.7, 0.004, 0.06, base * 0.6);
    } else if (s === 'gravel') {
      var c = nz(A, dest, t, 'bandpass', rv(2900, 0.15) * fk, 0.7, 0.003, 0.03, base, 0.12);
      pulse(c.g, t + rnd(0.025, 0.04), 0.002, 0.03 * dk, base * 0.8);
      pulse(c.g, t + rnd(0.06, 0.085), 0.002, 0.04 * dk, base * 0.55);
      nz(A, dest, t, 'lowpass', 300, 0.7, 0.004, 0.06, base * 0.5);
    } else if (s === 'concrete') {
      nz(A, dest, t, 'bandpass', rv(1700, 0.15) * fk, 1.2, 0.002, 0.04 * dk, base);
      nz(A, dest, t + 0.012, 'highpass', rv(3500, 0.2), 0.7, 0.01, 0.05 * dk, base * 0.35);
    } else if (s === 'tiles') {
      nz(A, dest, t, 'bandpass', rv(3200, 0.12) * fk, 2, 0.001, 0.03 * dk, base * 1.1);
      tn(A, dest, t, 'sine', rv(180, 0.1), 120, 0.002, 0.04, base * 0.5);
    } else if (s === 'wood') {
      tn(A, dest, t, 'sine', rv(120, 0.12) * fk, 70, 0.003, 0.1 * dk, base * 1.2);
      nz(A, dest, t, 'lowpass', 380, 1, 0.003, 0.08 * dk, base * 0.8);
      nz(A, dest, t, 'bandpass', rv(1300, 0.15), 1.5, 0.002, 0.03, base * 0.4);
    } else if (s === 'metal') {
      var f0 = rv(420, 0.1) * fk;
      tn(A, dest, t, 'triangle', f0, f0 * 0.98, 0.002, 0.16 * dk, base * 0.45);
      tn(A, dest, t, 'sine', f0 * 2.71, f0 * 2.65, 0.002, 0.1 * dk, base * 0.22);
      nz(A, dest, t, 'bandpass', rv(2500, 0.15), 1.5, 0.002, 0.03, base * 0.6);
    } else if (s === 'water') {
      var w = nz(A, dest, t, 'bandpass', 700, 1.2, 0.01, 0.15 * dk, base * 1.1);
      sweep(w.f.frequency, t, rv(600, 0.2), rv(1800, 0.2) * fk, 0.12);
      nz(A, dest, t, 'lowpass', 500, 0.7, 0.006, 0.1, base * 0.6);
    } else { // dirt
      nz(A, dest, t, 'bandpass', rv(900, 0.2) * fk, 1, 0.004, 0.07 * dk, base * 0.9);
      nz(A, dest, t, 'lowpass', rv(220, 0.15), 0.7, 0.004, 0.07, base * 0.7);
    }
  };

  // ---------- melee ----------
  var SWING = {
    hands: { dur: 0.14, f0: 600, f1: 1500, peak: 0.12 },
    axe: { dur: 0.3, f0: 300, f1: 1400, peak: 0.3 },
    club: { dur: 0.28, f0: 250, f1: 1000, peak: 0.3 },
    pickaxe: { dur: 0.32, f0: 280, f1: 1200, peak: 0.32 }
  };
  S.swing = function (A, dest, t, o) {
    o = o || {};
    var c = SWING[o.weapon] || SWING.hands, dur = rv(c.dur, 0.1);
    var g = A.gain(0, dest), f = A.filter('bandpass', c.f0, 1.4, g);
    A.noise(t, dur, f);
    var top = rv(c.f1, 0.15);
    f.frequency.setValueAtTime(rv(c.f0, 0.1), t);
    f.frequency.exponentialRampToValueAtTime(top, t + dur * 0.55);
    f.frequency.exponentialRampToValueAtTime(pos(top * 0.5), t + dur);
    pulse(g, t, dur * 0.55, dur * 0.45, c.peak);
  };

  S.hit = function (A, dest, t, o) {
    o = o || {};
    var k = o.heavy ? 1.35 : 1, m = o.mat;
    if (m === 'wood') {
      nz(A, dest, t, 'bandpass', rv(1600, 0.15), 3, 0.001, 0.06 * k, 0.55 * k);
      tn(A, dest, t, 'sine', rv(240, 0.1), 150, 0.002, 0.09 * k, 0.4 * k);
      nz(A, dest, t + 0.004, 'highpass', 3500, 0.7, 0.001, 0.03, 0.2);
    } else if (m === 'stone') {
      nz(A, dest, t, 'highpass', rv(3200, 0.15), 0.7, 0.001, 0.03, 0.5 * k);
      nz(A, dest, t, 'bandpass', rv(2200, 0.2), 0.8, 0.003, 0.12 * k, 0.28 * k);
      tn(A, dest, t, 'triangle', rv(1800, 0.1), 1700, 0.001, 0.06, 0.1);
      tn(A, dest, t, 'sine', 160, 90, 0.002, 0.06, 0.25 * k);
    } else if (m === 'metal') {
      var f0 = rv(520, 0.12);
      tn(A, dest, t, 'sine', f0, f0 * 0.99, 0.001, 0.35 * k, 0.25 * k);
      tn(A, dest, t, 'sine', f0 * 2.58, f0 * 2.55, 0.001, 0.22 * k, 0.15 * k);
      tn(A, dest, t, 'sine', f0 * 4.25, f0 * 4.2, 0.001, 0.12, 0.08);
      nz(A, dest, t, 'bandpass', 3000, 1, 0.001, 0.03, 0.4 * k);
    } else if (m === 'soft') {
      var r = nz(A, dest, t, 'bandpass', rv(2500, 0.2), 0.6, 0.02, 0.06, 0.16 * k, 0.25);
      pulse(r.g, t + rnd(0.09, 0.12), 0.02, 0.07, 0.13 * k);
      pulse(r.g, t + rnd(0.18, 0.22), 0.02, 0.06, 0.09 * k);
    } else if (m === 'water') {
      var b = tn(A, dest, t, 'sine', rv(300, 0.15), 0, 0.005, 0.07, 0.18);
      sweep(b.frequency, t, rv(300, 0.15), rv(700, 0.15), 0.06);
      tn(A, dest, t + rnd(0.08, 0.12), 'sine', rv(380, 0.15), rv(850, 0.15), 0.005, 0.06, 0.12, 0.05);
      nz(A, dest, t, 'lowpass', 800, 0.7, 0.02, 0.15, 0.12);
    } else { // flesh
      nz(A, dest, t, 'lowpass', rv(500, 0.15), 1, 0.003, 0.12 * k, 0.5 * k);
      tn(A, dest, t, 'sine', rv(95, 0.1), 45, 0.003, 0.15 * k, 0.55 * k);
      nz(A, dest, t + 0.005, 'bandpass', rv(1200, 0.2), 1.5, 0.002, 0.05, 0.2 * k);
    }
  };

  S.shove = function (A, dest, t, o) {
    nz(A, dest, t, 'lowpass', rv(300, 0.15), 0.8, 0.004, 0.1, 0.45);
    tn(A, dest, t, 'sine', rv(80, 0.1), 50, 0.004, 0.12, 0.4);
    nz(A, dest, t, 'bandpass', rv(900, 0.2), 1, 0.004, 0.05, 0.15);
  };

  // ---------- guns ----------
  var SHOT = {
    gun:    { click: 0.6,  bf: 1800, bq: 0.7, bd: 0.09, bp: 0.85, s0: 150, s1: 45, sd: 0.14, sp: 0.7,  tf: 1200, td: 0.45, tp: 0.25 },
    uzi:    { click: 0.5,  bf: 2200, bq: 0.8, bd: 0.05, bp: 0.7,  s0: 180, s1: 60, sd: 0.07, sp: 0.5,  tf: 1500, td: 0.12, tp: 0.12 },
    m16:    { click: 0.6,  bf: 2000, bq: 0.8, bd: 0.07, bp: 0.85, s0: 130, s1: 45, sd: 0.12, sp: 0.6,  tf: 1400, td: 0.5,  tp: 0.25 },
    ak:     { click: 0.55, bf: 1300, bq: 0.6, bd: 0.11, bp: 0.9,  s0: 95,  s1: 35, sd: 0.2,  sp: 0.85, tf: 900,  td: 0.65, tp: 0.3, dist: 3 },
    sniper: { click: 0.7,  bf: 1600, bq: 0.5, bd: 0.14, bp: 0.9,  s0: 80,  s1: 28, sd: 0.3,  sp: 0.9,  tf: 700,  td: 1.2,  tp: 0.35, dist: 4, echo: true }
  };
  S.shot = function (A, dest, t, o) {
    o = o || {};
    var c = SHOT[o.weapon] || SHOT.gun, ind = !!o.indoor;
    // transient
    nz(A, dest, t, 'highpass', rv(4500, 0.1), 0.7, 0.0008, 0.008, c.click);
    // blast body (noise through bandpass, a bit of grit for the heavy rifles)
    var bg = A.gain(0, dest), bf = A.filter('bandpass', rv(c.bf, 0.1), c.bq, c.dist ? shaper(A, c.dist, bg) : bg);
    A.noise(t, c.bd, bf);
    sweep(bf.frequency, t, rv(c.bf, 0.1), c.bf * 0.45, c.bd);
    pulse(bg, t, 0.001, c.bd, c.bp);
    // low thump with pitch drop
    tn(A, dest, t, 'sine', rv(c.s0, 0.08), c.s1, 0.002, c.sd, c.sp, c.sd * 0.8);
    // tail
    if (ind) {
      var it = nz(A, dest, t + 0.006, 'bandpass', rv(480, 0.1), 1.3, 0.005, c.td * 0.3, c.tp * 1.1);
      it.f.frequency.value = rv(480, 0.1);
      nz(A, dest, t + rnd(0.02, 0.03), 'bandpass', rv(900, 0.1), 1.2, 0.002, 0.04, c.tp * 0.7); // early reflection
    } else {
      var tl = nz(A, dest, t + 0.008, 'lowpass', c.tf, 0.7, 0.01, c.td, c.tp);
      sweep(tl.f.frequency, t + 0.008, rv(c.tf, 0.1), c.tf * 0.3, c.td);
      if (c.echo) {
        nz(A, dest, t + rnd(0.32, 0.4), 'lowpass', 600, 0.7, 0.03, 0.4, 0.14);
        nz(A, dest, t + rnd(0.7, 0.8), 'lowpass', 450, 0.7, 0.05, 0.45, 0.08);
      }
    }
  };

  S.dry = function (A, dest, t, o) {
    nz(A, dest, t, 'highpass', rv(3500, 0.1), 0.7, 0.0008, 0.01, 0.35);
    nz(A, dest, t + 0.004, 'bandpass', rv(1500, 0.1), 4, 0.001, 0.02, 0.22);
  };

  S.reload = function (A, dest, t, o) {
    o = o || {};
    var rifle = o.weapon && o.weapon !== 'gun' && o.weapon !== 'pistol';
    var fk = rifle ? 0.75 : 1, k = rifle ? 1.2 : 1;
    if (o.phase === 'end') {
      // mag seats
      nz(A, dest, t, 'bandpass', rv(900, 0.1) * fk, 1.2, 0.002, 0.05, 0.35 * k);
      nz(A, dest, t + 0.02, 'highpass', rv(3500, 0.1), 0.7, 0.001, 0.012, 0.4);
      // slide / charging handle rack: pull back then snap forward
      var st = t + rnd(0.26, 0.32);
      var r = nz(A, dest, st, 'bandpass', 2500, 2, 0.02, 0.08, 0.22 * k);
      sweep(r.f.frequency, st, 3000 * fk, 1500 * fk, 0.1);
      nz(A, dest, st + 0.12, 'highpass', rv(3000, 0.1) * fk, 0.7, 0.001, 0.015, 0.45 * k);
      tn(A, dest, st + 0.12, 'triangle', rv(1500, 0.08) * fk, 1450 * fk, 0.001, 0.1, 0.08);
      tn(A, dest, st + 0.12, 'sine', 180 * fk, 120 * fk, 0.002, 0.06, 0.2 * k);
    } else {
      // mag release click and slide out
      nz(A, dest, t, 'highpass', rv(4000, 0.1), 0.7, 0.001, 0.012, 0.35);
      var s = nz(A, dest, t + 0.02, 'bandpass', 2500, 2, 0.02, 0.1, 0.2 * k);
      sweep(s.f.frequency, t + 0.02, 1800 * fk, 3500 * fk, 0.12);
      tn(A, dest, t + 0.02, 'triangle', rv(1900, 0.08) * fk, 1850 * fk, 0.001, 0.05, 0.07);
    }
  };

  S.gunbreak = function (A, dest, t, o) {
    nz(A, dest, t, 'highpass', 4000, 0.7, 0.001, 0.01, 0.5);
    var c = nz(A, dest, t, 'bandpass', rv(2000, 0.15), 1, 0.002, 0.04, 0.45, 0.2);
    pulse(c.g, t + rnd(0.04, 0.06), 0.002, 0.04, 0.35);
    pulse(c.g, t + rnd(0.1, 0.13), 0.002, 0.07, 0.25);
    tn(A, dest, t, 'sine', rv(700, 0.1), 650, 0.001, 0.12, 0.15);
    tn(A, dest, t, 'sine', rv(1630, 0.1), 1580, 0.001, 0.08, 0.1);
    tn(A, dest, t, 'sine', 150, 70, 0.003, 0.12, 0.35);
  };

  // ---------- infected voices ----------
  var VOICE = {
    shambler: { f: 82, fr: [450, 1050], q: [6, 8], vib: 5, vd: 4, br: 700, bk: 0.5, dist: 6 },
    runner:   { f: 160, fr: [800, 1800], q: [5, 7], vib: 7, vd: 9, br: 1800, bk: 0.9, dist: 9 }
  };
  var MOOD = {
    idle:   { dur: [1.0, 1.6], c: [0.9, 1.05, 0.85], a: 0.3, peak: 0.32 },
    notice: { dur: [0.5, 0.6], c: [1.25, 1.4, 1.1], a: 0.04, peak: 0.55, intake: true },
    attack: { dur: [0.32, 0.4], c: [1.4, 1.3, 1.05], a: 0.03, peak: 0.7 },
    hurt:   { dur: [0.18, 0.25], c: [1.6, 1.5, 1.2], a: 0.01, peak: 0.55 },
    die:    { dur: [1.1, 1.3], c: [1.1, 0.8, 0.55], a: 0.05, peak: 0.5, gurgle: true }
  };
  S.growl = function (A, dest, t, o) {
    o = o || {};
    var v = VOICE[o.kind] || VOICE.shambler, m = MOOD[o.mood] || MOOD.idle;
    var dur = rnd(m.dur[0], m.dur[1]), f = rv(v.f, 0.12);
    if (m.intake) { // sharp breath in before the snarl
      var ib = nz(A, dest, t, 'bandpass', 1500, 1.5, 0.14, 0.06, 0.18 * v.bk);
      sweep(ib.f.frequency, t, 900, 2600, 0.18);
      t += 0.2;
    }
    var out = A.gain(0, dest);
    var am = A.gain(1, null);
    var f1 = A.filter('bandpass', rv(v.fr[0], 0.1), v.q[0], out);
    var f2 = A.filter('bandpass', rv(v.fr[1], 0.1), v.q[1], out);
    am.connect(f1); am.connect(f2);
    var w = shaper(A, v.dist, am);
    var osc = A.osc('sawtooth', f * m.c[0], t, dur, w);
    osc.frequency.linearRampToValueAtTime(f * m.c[1], t + dur * 0.4);
    osc.frequency.linearRampToValueAtTime(f * m.c[2], t + dur);
    // vibrato + random jitter on pitch
    var lg = A.gain(v.vd, osc.frequency);
    A.osc('sine', rv(v.vib, 0.2), t, dur, lg);
    var jg = A.gain(f * 0.12, osc.frequency);
    A.noise(t, dur, A.filter('lowpass', 35, 0.7, jg));
    if (m.gurgle) { // wet bubbling amplitude modulation
      am.gain.value = 0.6;
      A.osc('sine', rnd(11, 16), t, dur, A.gain(0.4, am.gain));
    }
    hold(out, t, m.a, dur * 0.55, dur * 0.45 - m.a, m.peak);
    // breath / rasp layer
    var b = A.gain(0, dest), bf = A.filter('bandpass', rv(v.br, 0.15), 1.2, b);
    A.noise(t, dur, bf);
    hold(b, t, m.a, dur * 0.5, dur * 0.5 - m.a, m.peak * 0.35 * v.bk);
  };

  // ---------- bodies and the player ----------
  S.body = function (A, dest, t, o) {
    nz(A, dest, t, 'lowpass', rv(220, 0.15), 0.8, 0.005, 0.2, 0.7);
    tn(A, dest, t, 'sine', rv(70, 0.1), 38, 0.005, 0.22, 0.7);
    var b = t + rnd(0.15, 0.2);
    tn(A, dest, b, 'sine', rv(85, 0.1), 50, 0.004, 0.1, 0.25);
    nz(A, dest, t + 0.12, 'bandpass', rv(1500, 0.2), 0.8, 0.03, 0.12, 0.15);
  };

  S.hurt = function (A, dest, t, o) {
    nz(A, dest, t, 'lowpass', rv(400, 0.15), 0.8, 0.003, 0.1, 0.5);
    tn(A, dest, t, 'sine', rv(100, 0.1), 55, 0.003, 0.12, 0.5);
    // short human grunt: sawtooth through two vowel formants
    var gt = t + 0.03, gd = rv(0.2, 0.15), f = rnd(125, 165);
    var g = A.gain(0, dest);
    var a1 = A.filter('bandpass', rv(700, 0.08), 4, g), a2 = A.filter('bandpass', rv(1200, 0.08), 5, g);
    var lp = A.filter('lowpass', 2500, 0.7, null); lp.connect(a1); lp.connect(a2);
    var osc = A.osc('sawtooth', f, gt, gd, lp);
    osc.frequency.linearRampToValueAtTime(f * 0.78, gt + gd);
    pulse(g, gt, 0.02, gd, 0.32);
    nz(A, dest, gt, 'bandpass', 1200, 1, 0.02, 0.15, 0.1);
  };

  // ---------- items, crafting, building ----------
  S.pickup = function (A, dest, t, o) {
    var r = nz(A, dest, t, 'bandpass', rv(3000, 0.15), 0.7, 0.015, 0.05, 0.14, 0.1);
    pulse(r.g, t + rnd(0.06, 0.08), 0.015, 0.05, 0.11);
    var z = nz(A, dest, t + 0.03, 'bandpass', 3000, 3, 0.03, 0.07, 0.1);
    sweep(z.f.frequency, t + 0.03, 2000, rv(4500, 0.1), 0.1);
    tn(A, dest, t + 0.15, 'sine', rv(2600, 0.08), 2500, 0.001, 0.025, 0.08);
  };

  S.craft = function (A, dest, t, o) {
    var n = Math.random() < 0.5 ? 3 : 4, times = [];
    for (var i = 0; i < n; i++) times.push(t + i * rnd(0.14, 0.18));
    var span = times[n - 1] - t + 0.15;
    var cg = A.gain(0, dest), cf = A.filter('bandpass', rv(2800, 0.1), 3, cg);
    A.noise(t, span, cf);
    var pg = A.gain(0, dest), po = A.osc('triangle', 900, t, span, pg);
    var bg = A.gain(0, dest), bo = A.osc('sine', 160, t, span, bg);
    for (var j = 0; j < n; j++) {
      var tt = times[j], hard = j === n - 1 ? 1.2 : rnd(0.8, 1);
      pulse(cg, tt, 0.001, 0.03, 0.35 * hard);
      po.frequency.setValueAtTime(rv(900, 0.12), tt);
      pulse(pg, tt, 0.001, 0.08, 0.1 * hard);
      pulse(bg, tt, 0.002, 0.05, 0.2 * hard);
    }
  };

  S.build = function (A, dest, t, o) {
    var knocks = [t, t + rnd(0.18, 0.24), t + rnd(0.4, 0.46)];
    var kg = A.gain(0, dest), kf = A.filter('lowpass', 380, 1, kg);
    A.noise(t, 0.6, kf);
    var og = A.gain(0, dest), ko = A.osc('sine', 170, t, 0.6, og);
    for (var i = 0; i < knocks.length; i++) {
      var tt = knocks[i];
      pulse(kg, tt, 0.002, 0.08, 0.4);
      ko.frequency.setValueAtTime(rv(170, 0.1), tt);
      ko.frequency.exponentialRampToValueAtTime(105, tt + 0.08);
      pulse(og, tt, 0.002, 0.1, 0.4);
    }
    // saw strokes
    var s0 = t + 0.58, sg = A.gain(0, dest), sf = A.filter('bandpass', rv(1800, 0.1), 2, sg);
    A.noise(s0, 0.45, sf);
    for (var s = 0; s < 3; s++) {
      var st = s0 + s * 0.14;
      sf.frequency.setValueAtTime(s % 2 ? 2100 : 1600, st);
      sf.frequency.linearRampToValueAtTime(s % 2 ? 1600 : 2100, st + 0.12);
      pulse(sg, st, 0.04, 0.08, 0.18);
    }
  };

  S.cook = function (A, dest, t, o) {
    var g = A.gain(0, dest), f = A.filter('highpass', rv(3000, 0.1), 0.7, g);
    A.noise(t, 0.85, f);
    hold(g, t, 0.06, 0.45, 0.3, 0.2);
    var cg = A.gain(0, dest), cf = A.filter('bandpass', 2000, 4, cg);
    A.noise(t, 0.85, cf);
    for (var i = 0; i < 6; i++) pulse(cg, t + 0.05 + i * rnd(0.1, 0.13), 0.001, 0.015, rnd(0.08, 0.18));
  };

  S.eat = function (A, dest, t, o) {
    var n = Math.random() < 0.5 ? 2 : 3, span = n * 0.3 + 0.1;
    var g = A.gain(0, dest), f = A.filter('bandpass', rv(1800, 0.15), 0.8, g);
    A.noise(t, span, f);
    var lg = A.gain(0, dest), lf = A.filter('lowpass', 300, 0.7, lg);
    A.noise(t, span, lf);
    for (var i = 0; i < n; i++) {
      var b = t + i * rnd(0.26, 0.3);
      pulse(g, b, 0.003, 0.03, 0.28);
      pulse(g, b + rnd(0.035, 0.05), 0.003, 0.05, 0.2);
      pulse(lg, b, 0.004, 0.06, 0.22);
    }
  };

  S.drink = function (A, dest, t, o) {
    var n = Math.random() < 0.5 ? 2 : 3, span = n * 0.4 + 0.1;
    var bg = A.gain(0, dest), bo = A.osc('sine', 250, t, span, bg);
    var tg = A.gain(0, dest), to = A.osc('sine', 140, t, span, tg);
    for (var i = 0; i < n; i++) {
      var g0 = t + i * rnd(0.34, 0.4);
      bo.frequency.setValueAtTime(rv(250, 0.12), g0);
      bo.frequency.exponentialRampToValueAtTime(rv(480, 0.1), g0 + 0.06);
      pulse(bg, g0, 0.006, 0.07, 0.22);
      to.frequency.setValueAtTime(rv(140, 0.1), g0);
      to.frequency.exponentialRampToValueAtTime(85, g0 + 0.1);
      pulse(tg, g0, 0.005, 0.1, 0.3);
    }
    nz(A, dest, t, 'lowpass', 500, 0.7, 0.05, span * 0.8, 0.05);
  };

  S.bandage = function (A, dest, t, o) {
    var tg = A.gain(0, dest), tf = A.filter('bandpass', 1800, 1.5, tg);
    A.noise(t, 0.4, tf);
    sweep(tf.frequency, t, rv(1800, 0.1), rv(3500, 0.1), 0.35);
    for (var i = 0; i < 10; i++) pulse(tg, t + i * 0.033 + rnd(0, 0.008), 0.002, 0.02, rnd(0.12, 0.22));
    var w = nz(A, dest, t + 0.45, 'bandpass', rv(1500, 0.1), 0.7, 0.06, 0.1, 0.12, 0.25);
    pulse(w.g, t + 0.65, 0.06, 0.1, 0.1);
  };

  // ---------- storage, doors ----------
  S.open = function (A, dest, t, o) {
    creak(A, dest, t, rv(0.45, 0.1), 0.12);
    var tt = t + rnd(0.5, 0.56);
    nz(A, dest, tt, 'lowpass', 260, 0.8, 0.004, 0.1, 0.4);
    tn(A, dest, tt, 'sine', rv(90, 0.1), 60, 0.003, 0.12, 0.35);
  };

  S.close = function (A, dest, t, o) {
    nz(A, dest, t, 'lowpass', rv(300, 0.12), 0.8, 0.004, 0.1, 0.4);
    tn(A, dest, t, 'sine', rv(85, 0.1), 55, 0.003, 0.12, 0.38);
    nz(A, dest, t + 0.01, 'bandpass', 2000, 2, 0.001, 0.03, 0.08);
  };

  S.door = function (A, dest, t, o) {
    creak(A, dest, t, rv(0.42, 0.12), 0.11);
    var l = t + rnd(0.48, 0.54);
    nz(A, dest, l, 'highpass', rv(3000, 0.1), 0.7, 0.001, 0.015, 0.3);
    nz(A, dest, l + 0.003, 'bandpass', rv(1200, 0.1), 3, 0.001, 0.03, 0.2);
    nz(A, dest, l, 'lowpass', 250, 0.8, 0.004, 0.08, 0.25);
  };

  // ---------- interface ----------
  S.ui = function (A, dest, t, o) {
    tn(A, dest, t, 'sine', rv(950, 0.05), 900, 0.002, 0.05, 0.1);
    nz(A, dest, t, 'highpass', 5000, 0.7, 0.001, 0.006, 0.04);
  };

  S.uiBad = function (A, dest, t, o) {
    var lp = A.filter('lowpass', 900, 0.7, dest);
    tn(A, lp, t, 'triangle', 220, 215, 0.004, 0.07, 0.16);
    tn(A, lp, t + 0.11, 'triangle', 185, 180, 0.004, 0.08, 0.16);
  };

  S.save = function (A, dest, t, o) {
    tn(A, dest, t, 'sine', rv(2000, 0.05), 1950, 0.001, 0.015, 0.03);
  };

  // ---------- rest and states ----------
  S.sleep = function (A, dest, t, o) {
    var e = A.gain(0, dest), ef = A.filter('bandpass', 900, 0.8, e);
    A.noise(t, 1.2, ef);
    sweep(ef.frequency, t, 900, 380, 1.1);
    pulse(e, t, 0.25, 0.9, 0.14);
    tn(A, dest, t + 0.1, 'sine', 330, 220, 0.2, 1.2, 0.07, 1.2);
  };

  S.wake = function (A, dest, t, o) {
    tn(A, dest, t, 'sine', 220, 330, 0.4, 0.8, 0.07, 0.9);
    tn(A, dest, t + 0.05, 'triangle', 330, 495, 0.4, 0.7, 0.03, 0.9);
    var i = A.gain(0, dest), f = A.filter('bandpass', 400, 0.8, i);
    A.noise(t, 0.8, f);
    sweep(f.frequency, t, 400, 900, 0.5);
    pulse(i, t, 0.4, 0.3, 0.07);
  };

  S.faint = function (A, dest, t, o) {
    var beats = [0, 0.24, 0.9, 1.15, 1.85];
    var peaks = [0.5, 0.35, 0.4, 0.26, 0.22];
    var hg = A.gain(0, dest), ho = A.osc('sine', 60, t, 2.1, hg);
    for (var i = 0; i < beats.length; i++) {
      var b = t + beats[i];
      ho.frequency.setValueAtTime(62, b);
      ho.frequency.exponentialRampToValueAtTime(38, b + 0.12);
      pulse(hg, b, 0.008, 0.14, peaks[i]);
    }
    var dg = A.gain(0, dest), df = A.filter('lowpass', 400, 0.8, dg);
    A.osc('sawtooth', 55, t, 2.1, df);
    A.osc('sawtooth', 55.8, t, 2.1, df);
    sweep(df.frequency, t, 420, 140, 2);
    hold(dg, t, 0.5, 0.9, 0.7, 0.1);
  };

  S.travel = function (A, dest, t, o) {
    for (var i = 0; i < 4; i++) {
      var sg = A.gain(1 - i * 0.22, dest);
      S.step(A, sg, t + i * rnd(0.31, 0.35), { surface: 'dirt' });
    }
    var w = A.gain(0, dest), wf = A.filter('bandpass', 300, 0.7, w);
    A.noise(t + 0.2, 1.35, wf);
    wf.frequency.setValueAtTime(300, t + 0.2);
    wf.frequency.exponentialRampToValueAtTime(rv(900, 0.1), t + 0.8);
    wf.frequency.exponentialRampToValueAtTime(400, t + 1.55);
    pulse(w, t + 0.2, 0.6, 0.75, 0.2);
  };

  S.rain = function (A, dest, t, o) {
    var g = A.gain(0, dest), f = A.filter('bandpass', rv(1200, 0.1), 0.5, g);
    A.noise(t, 0.85, f);
    hold(g, t, 0.05, 0.5, 0.25, 0.2);
    var bg = A.gain(0, dest), bo = A.osc('sine', 500, t, 0.85, bg);
    for (var i = 0; i < 6; i++) {
      var b = t + 0.05 + i * rnd(0.1, 0.13);
      bo.frequency.setValueAtTime(rnd(400, 700), b);
      bo.frequency.exponentialRampToValueAtTime(rnd(900, 1300), b + 0.04);
      pulse(bg, b, 0.004, 0.04, rnd(0.04, 0.07));
    }
  };

  S.notice = function (A, dest, t, o) {
    var g = A.gain(0, dest), f = A.filter('lowpass', 500, 0.8, g);
    var b = rv(73, 0.04);
    A.osc('sawtooth', b, t, 0.65, f);
    A.osc('sawtooth', b * 1.06, t, 0.65, f);
    sweep(f.frequency, t, 300, 900, 0.35);
    pulse(g, t, 0.35, 0.3, 0.1);
  };

  G.sfx = S;
})(typeof window !== 'undefined' ? window : globalThis);
