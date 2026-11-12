// Combat "feel": pure helpers for camera shake, shot glow, brass casings, the low-health effect and crit rolls.
// No DOM and no Math.random here: every function is deterministic (randomness comes in through a `rand` argument),
// so it is unit-tested in Node (tests/extra/feel.js). Drawing lives in js/combatart.js, wiring in js/game.js.
// G.feel.enabled = false switches every effect off (all helpers return zeros / do nothing).
(function (root) {
  'use strict';
  var G = root.G, TAU = Math.PI * 2;

  var SHAKE_DECAY = 9;         // 1/s, amplitude falls to 1/e in ~0.11 s
  var KICK_DECAY = 17;         // the melee kick is shorter
  var SHAKE_CAP = 5;           // px, no matter how fast a gun fires
  var KICK_CAP = 3;            // px

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  var feel = {
    enabled: true,

    // ---- settings escape hatch ------------------------------------------------------------------
    // Remembered in localStorage when there is one (try/catch: private mode, Node tests).
    setEnabled: function (on) {
      feel.enabled = !!on;
      try { if (typeof localStorage !== 'undefined') localStorage.setItem('sbs_feel', on ? '1' : '0'); } catch (e) { /* ignore */ }
    },
    loadEnabled: function () {
      try { if (typeof localStorage !== 'undefined' && localStorage.getItem('sbs_feel') === '0') feel.enabled = false; } catch (e) { /* ignore */ }
    },

    // ---- camera shake -----------------------------------------------------------------------------
    // state: { amp (px, random-looking wobble), t (its clock), kx, ky (a short directional kick, px) }
    newShake: function () { return { amp: 0, t: 0, kx: 0, ky: 0 }; },
    addShake: function (s, amp) {
      if (!feel.enabled || !(amp > 0)) return;
      s.amp = Math.min(SHAKE_CAP, s.amp + amp);
    },
    // A blow landed towards (dx, dy): nudge the camera that way for a moment (no hit-stop, the game keeps running).
    kick: function (s, dx, dy, amp) {
      if (!feel.enabled || !(amp > 0)) return;
      var l = Math.sqrt(dx * dx + dy * dy);
      if (l < 1e-6) return;
      s.kx = clamp(s.kx + dx / l * amp, -KICK_CAP, KICK_CAP);
      s.ky = clamp(s.ky + dy / l * amp, -KICK_CAP, KICK_CAP);
    },
    // One fixed step (1/60 s). Everything decays to exactly 0 so a resting camera is never touched.
    stepShake: function (s, dt) {
      s.t += dt;
      s.amp *= Math.exp(-SHAKE_DECAY * dt);
      if (s.amp < 0.03) s.amp = 0;
      var f = Math.exp(-KICK_DECAY * dt);
      s.kx *= f; s.ky *= f;
      if (Math.abs(s.kx) < 0.03) s.kx = 0;
      if (Math.abs(s.ky) < 0.03) s.ky = 0;
    },
    // Camera offset in px for rendering. `extra` = seconds since the last step (the render alpha), so it is smooth at any
    // refresh rate. Pure function of the state and the clock (two summed sines per axis): bounded by amp + |kick|.
    // Writes into `out` (no allocation) and returns it.
    shakeOffset: function (s, extra, out) {
      out = out || { x: 0, y: 0 };
      if (!feel.enabled) { out.x = 0; out.y = 0; return out; }
      extra = extra || 0;
      var t = s.t + extra, a = s.amp * Math.exp(-SHAKE_DECAY * extra), kf = Math.exp(-KICK_DECAY * extra);
      out.x = a * (0.62 * Math.sin(t * 51) + 0.38 * Math.sin(t * 89 + 1.7)) + s.kx * kf;
      out.y = a * (0.62 * Math.sin(t * 43 + 2.1) + 0.38 * Math.sin(t * 97 + 0.6)) + s.ky * kf;
      return out;
    },
    // How hard a shot shakes the camera: heavier and louder weapons shake more.
    shotAmp: function (w) {
      if (!feel.enabled || !w) return 0;
      return 0.6 + Math.sqrt(Math.max(0, w.dmg || 0)) * 0.18 + clamp((w.noise || 0) / 1600, 0, 1) * 0.9;
    },
    hurtAmp: function (dealt) {
      if (!feel.enabled) return 0;
      return clamp(2 + (dealt || 0) * 0.25, 2, 5);
    },
    meleeKick: function (killed) { return feel.enabled ? (killed ? 2.4 : 1.5) : 0; },

    // ---- muzzle glow and brass ---------------------------------------------------------------------
    glowRadius: function (w) { return feel.enabled && w ? 60 + clamp((w.noise || 0) / 1600, 0, 1) * 70 : 0; },
    glowAlpha: function (w) { return feel.enabled && w ? 0.45 + 0.3 * clamp((w.dmg || 0) / 60, 0, 1) : 0; },
    // How much the glow shows: strongest indoors and in dim places, softer in the open.
    glowGain: function (indoor) { return indoor ? 1 : 0.6; },
    // A spent casing thrown out to the right of the aim (dx, dy = aim direction, z0 = height of the gun).
    // Closed form (no integration): see casingPos. life = seconds it stays visible.
    casing: function (rand, dx, dy, z0) {
      if (!feel.enabled) return null;
      var l = Math.sqrt(dx * dx + dy * dy) || 1, ax = dx / l, ay = dy / l;
      var side = 70 + rand() * 50, back = 10 + rand() * 25;
      var vz = 110 + rand() * 60, g = 900, h = z0 || 0;
      return { vx: -ay * side - ax * back, vy: ax * side - ay * back, vz: vz, g: g, z0: h,
        tl: (vz + Math.sqrt(vz * vz + 2 * g * h)) / g,     // when it first reaches the ground
        hop: 0.28 * Math.sqrt(vz * vz + 2 * g * h),        // upward speed of its single small bounce
        life: 0.9 };
    },
    // Where the casing is `t` seconds after it left: ground offset (x, y) and height z (>= 0).
    casingPos: function (c, t, out) {
      out = out || { x: 0, y: 0, z: 0 };
      var gt, z;
      if (t <= c.tl) { gt = t; z = c.z0 + c.vz * t - 0.5 * c.g * t * t; }
      else {                                                // after landing it skids a little and bounces once
        var u = t - c.tl;
        gt = c.tl + (1 - Math.exp(-u * 12)) / 12 * 0.3;
        z = c.hop * u - 0.5 * c.g * u * u;
      }
      out.x = c.vx * gt; out.y = c.vy * gt; out.z = z > 0 ? z : 0;
      return out;
    },
    casingAlpha: function (c, t) { return clamp((c.life - t) / 0.3, 0, 1) * 0.9; },

    // ---- low health ----------------------------------------------------------------------------------
    // 0 at 25% health and above, rising smoothly to 1 at 5% and below.
    lowIntensity: function (health, max) {
      if (!feel.enabled || !(max > 0)) return 0;
      var x = clamp((0.25 - health / max) / 0.2, 0, 1);
      return x * x * (3 - 2 * x);
    },
    // Slow pulse (0.55 Hz, smooth 0..1, no jumps). Fills out = { edge: red edge alpha 0..~0.7, desat: grey mix 0..0.3 }.
    lowFx: function (health, max, time, out) {
      out = out || { edge: 0, desat: 0 };
      var i = feel.lowIntensity(health, max);
      if (i <= 0) { out.edge = 0; out.desat = 0; return out; }
      var pulse = 0.5 - 0.5 * Math.cos(TAU * 0.55 * time);
      out.edge = i * (0.2 + 0.45 * pulse);
      out.desat = 0.3 * i;
      return out;
    },

    // ---- crits (for a later agent: damage values are NOT changed anywhere yet) -----------------------
    // One roll from `rand` (so a seeded rng gives repeatable results). w.crit overrides the chance (default 8%).
    crit: function (rand, w) {
      var chance = w && typeof w.crit === 'number' ? w.crit : 0.08;
      var hit = rand() < chance;
      return { crit: hit, mult: hit ? 1.75 : 1, color: hit ? '#f0d060' : null, scale: hit ? 1.5 : 1 };
    }
  };

  feel.loadEnabled();
  G.feel = feel;
})(typeof window !== 'undefined' ? window : globalThis);
