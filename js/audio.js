// Audio core: one Web Audio context, three buses (sfx, amb, music) and small helpers.
// Every sound is synthesized in code (js/sfx.js, js/ambience.js); no files, no fetch.
// The browser only allows sound after a user gesture, so unlock() runs on the first key / click.
// API used by the game:
//   G.audio.play(name, opts)   one-shot effect from G.sfx[name]; opts.x/opts.y = world position (distance + pan)
//   G.audio.listen(x, y)       where the player's ears are (call each frame)
//   G.audio.scene(place, indoor, menu)   ambience + music for the current place
//   G.audio.tension(k)         0..1 fight intensity (music / ambience react)
//   G.audio.update(dt)         drives ambience and music
//   G.audio.toggle()           mute on/off (KeyM), remembered in localStorage
(function (root) {
  var G = root.G = root.G || {};
  var AC = root.AudioContext || root.webkitAudioContext;
  var A = {
    ctx: null, master: null, sfx: null, amb: null, music: null, ready: false,
    muted: false, lx: 0, ly: 0, place: null, indoor: false, menu: true, tense: 0,
    vol: { master: 0.8, sfx: 0.9, amb: 0.55, music: 0.32 },
    HEAR: 1600,                                      // world px: beyond this a positional sound is silent
    _noise: null, _last: {}
  };

  try { A.muted = root.localStorage && root.localStorage.getItem('sbs_muted') === '1'; } catch (e) { A.muted = false; }

  // Player volume settings (0..1 per bus, 1 = the default mix), from the settings screen. Kept in localStorage.
  A.user = { sfx: 1, amb: 1, music: 1 };
  try {
    var saved = JSON.parse(root.localStorage.getItem('sbs_volume') || 'null');
    if (saved) for (var bk in A.user) if (typeof saved[bk] === 'number' && saved[bk] >= 0 && saved[bk] <= 1) A.user[bk] = saved[bk];
  } catch (e) { /* blocked storage: defaults */ }

  A.setVolume = function (busName, v) {
    if (!(busName in A.user)) return;
    A.user[busName] = Math.max(0, Math.min(1, +v || 0));
    if (A[busName]) A[busName].gain.setTargetAtTime(A.vol[busName] * A.user[busName], A.ctx.currentTime, 0.04);
    try { root.localStorage.setItem('sbs_volume', JSON.stringify(A.user)); } catch (e) {}
  };

  A.unlock = function () {
    if (!AC) return;
    if (!A.ctx) {
      try { A.ctx = new AC(); } catch (e) { return; }
      var c = A.ctx;
      A.master = c.createGain(); A.master.gain.value = A.muted ? 0 : A.vol.master;
      var comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
      A.master.connect(comp); comp.connect(c.destination);
      A.sfx = bus(A.vol.sfx * A.user.sfx); A.amb = bus(A.vol.amb * A.user.amb); A.music = bus(A.vol.music * A.user.music);
      A.ready = true;
      if (G.ambience && G.ambience.init) G.ambience.init(A);
      if (A.place !== null || A.menu) A.scene(A.place, A.indoor, A.menu);
    }
    if (A.ctx.state === 'suspended') A.ctx.resume();
  };

  function bus(v) { var g = A.ctx.createGain(); g.gain.value = v; g.connect(A.master); return g; }
  // (the buses start at the default mix times the player's setting)

  A.toggle = function () {
    A.muted = !A.muted;
    try { root.localStorage.setItem('sbs_muted', A.muted ? '1' : '0'); } catch (e) {}
    if (A.master) A.master.gain.setTargetAtTime(A.muted ? 0 : A.vol.master, A.ctx.currentTime, 0.05);
    return A.muted;
  };

  A.now = function () { return A.ctx ? A.ctx.currentTime : 0; };

  // A shared 2 s white-noise buffer (filtered differently per sound).
  A.noiseBuf = function () {
    if (A._noise) return A._noise;
    var c = A.ctx, n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return (A._noise = b);
  };

  // Helpers. All take an absolute start time t (A.now() + offset).
  A.noise = function (t, dur, dest) {
    var s = A.ctx.createBufferSource();
    s.buffer = A.noiseBuf(); s.loop = true;
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    if (dest) s.connect(dest);
    return s;
  };
  A.osc = function (type, freq, t, dur, dest) {
    var o = A.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    o.start(t); o.stop(t + dur + 0.05);
    if (dest) o.connect(dest);
    return o;
  };
  A.filter = function (type, freq, q, dest) {
    var f = A.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; if (q != null) f.Q.value = q;
    if (dest) f.connect(dest);
    return f;
  };
  A.gain = function (v, dest) { var g = A.ctx.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; };
  // Percussive envelope on a gain node: 0 -> peak in a, then exponential decay over d.
  A.env = function (g, t, a, d, peak) {
    var p = g.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + Math.max(0.001, a));
    p.exponentialRampToValueAtTime(0.0001, t + a + Math.max(0.01, d));
    return g;
  };
  A.rand = function (a, b) { return a + Math.random() * (b - a); };

  // Output node for one effect: volume by distance, stereo pan by screen side. Returns null when inaudible.
  A.out = function (opts, busName) {
    if (!A.ready || A.muted) return null;
    opts = opts || {};
    var v = opts.vol == null ? 1 : opts.vol, pan = 0;
    if (opts.x != null) {
      var dx = opts.x - A.lx, dy = opts.y - A.ly, d = Math.sqrt(dx * dx + dy * dy);
      if (d > A.HEAR) return null;
      v *= 1 / (1 + Math.pow(d / 380, 1.6));
      pan = Math.max(-0.85, Math.min(0.85, dx / 700));
    }
    if (v < 0.004) return null;
    var g = A.gain(v);
    if (A.ctx.createStereoPanner) { var p = A.ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(A[busName || 'sfx']); }
    else g.connect(A[busName || 'sfx']);
    return g;
  };

  // Plays a synth from G.sfx. opts.gap (s) = minimum time between two plays of the same name (no machine-gun stacking).
  A.play = function (name, opts) {
    if (!A.ready || A.muted || !G.sfx || !G.sfx[name]) return;
    opts = opts || {};
    var t = A.now() + (opts.delay || 0), key = name + (opts.key || '');
    if (opts.gap && A._last[key] && t - A._last[key] < opts.gap) return;
    A._last[key] = t;
    var dest = A.out(opts, 'sfx');
    if (!dest) return;
    try { G.sfx[name](A, dest, t, opts); } catch (e) { if (root.console) console.warn('sfx ' + name, e); }
  };

  A.listen = function (x, y) { A.lx = x; A.ly = y; };

  // Pushes the ambience and music down for a moment (a gunshot), then lets them come back.
  A.duck = function (depth) {
    if (!A.ready) return;
    var now = A.ctx.currentTime, k = Math.max(0.15, 1 - depth);
    ['amb', 'music'].forEach(function (b) {
      var p = A[b].gain, full = A.vol[b] * A.user[b];
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.linearRampToValueAtTime(full * k, now + 0.015);
      p.setTargetAtTime(full, now + 0.08, 0.25);
    });
  };

  // The engine of the vehicle being ridden: kind (null = none) and load 0..1 (standing still .. full speed).
  // Switching kind fades the old one out; a mute / volume change follows through the sfx bus.
  A._eng = null; A._engKind = null;
  A.engine = function (kind, load) {
    if (!A.ready) return;
    if (!G.engines || !G.engines[kind]) kind = null;
    if (kind !== A._engKind) {
      if (A._eng) A._eng.stop();
      A._eng = null; A._engKind = kind;
      if (kind) {
        var g = A.ctx.createGain(); g.gain.value = 0; g.connect(A.sfx);
        A._eng = G.engines[kind](A, g);
        if (G.sfx && G.sfx.ignition) A.play('ignition', { kind: kind });
      }
    }
    if (A._eng) A._eng.set(Math.max(0, Math.min(1, load || 0)));
  };

  A.scene = function (place, indoor, menu) {
    A.place = place; A.indoor = !!indoor; A.menu = !!menu;
    if (A.ready && G.ambience && G.ambience.set) G.ambience.set(A, place, A.indoor, A.menu);
  };

  A.tension = function (k) { A.tense = Math.max(0, Math.min(1, k)); };

  A.update = function (dt) {
    if (A.ready && G.ambience && G.ambience.update) G.ambience.update(A, dt);
  };

  G.audio = A;
})(typeof window !== 'undefined' ? window : globalThis);
