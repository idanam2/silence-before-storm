// Combat feel helpers (js/feel.js): shake, kick, casings, low health, crit. Skipped if feel.js is not in the Node loader list.
if (G.feel) {
  const F = G.feel;
  const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
  const lcg = (seed) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

  console.log('feel');
  test('feel: enabled by default', () => { eq(F.enabled, true); });

  test('feel: shake decays to exactly 0 and the offset is 0 afterwards', () => {
    const s = F.newShake(), o = { x: 9, y: 9 };
    F.addShake(s, 3); F.kick(s, 1, 0, 2);
    let n = 0;
    while ((s.amp > 0 || s.kx !== 0) && n < 600) { F.stepShake(s, 1 / 60); n++; }
    if (n >= 600) throw new Error('never reached 0');
    F.shakeOffset(s, 0, o);
    eq(o.x, 0); eq(o.y, 0);
  });

  test('feel: offsets are bounded by amp + kick, and deterministic', () => {
    const s = F.newShake(); F.addShake(s, 4); F.kick(s, 0, 1, 2);
    const a = { x: 0, y: 0 }, b = { x: 0, y: 0 };
    for (let i = 0; i < 300; i++) {
      F.stepShake(s, 1 / 60);
      const ex = (i % 7) / 7 / 60;
      F.shakeOffset(s, ex, a); F.shakeOffset(s, ex, b);
      eq(a.x, b.x); eq(a.y, b.y);
      const lim = s.amp + Math.hypot(s.kx, s.ky) + 1e-9;
      if (Math.abs(a.x) > lim + 1e-9 || Math.abs(a.y) > lim + 1e-9) throw new Error('out of bounds at step ' + i);
    }
  });

  test('feel: shake is capped and the offset is continuous across a step', () => {
    const s = F.newShake();
    for (let i = 0; i < 50; i++) F.addShake(s, 3);
    if (s.amp > 5 + 1e-9) throw new Error('uncapped ' + s.amp);
    const a = { x: 0, y: 0 }, b = { x: 0, y: 0 }, dt = 1 / 60;
    F.shakeOffset(s, dt, a);          // render slightly ahead of the state
    F.stepShake(s, dt); F.shakeOffset(s, 0, b);
    near(a.x, b.x, 1e-9); near(a.y, b.y, 1e-9);
  });

  test('feel: kick points along the blow direction and is capped', () => {
    const s = F.newShake();
    F.kick(s, 10, 0, 2); near(s.kx, 2); near(s.ky, 0);
    for (let i = 0; i < 10; i++) F.kick(s, 1, 1, 2);
    if (Math.abs(s.kx) > 3 || Math.abs(s.ky) > 3) throw new Error('kick uncapped');
    F.kick(s, 0, 0, 2);               // zero direction: ignored, no NaN
    if (isNaN(s.kx)) throw new Error('NaN');
  });

  test('feel: heavier / louder weapons shake more', () => {
    const pistol = WP.gun, sniper = WP.sniper, uzi = WP.uzi;
    if (!(F.shotAmp(sniper) > F.shotAmp(pistol))) throw new Error('sniper should shake more than pistol');
    if (!(F.shotAmp(pistol) > F.shotAmp(uzi))) throw new Error('pistol should shake more than uzi');
    if (F.shotAmp(sniper) > 5) throw new Error('single shot above the cap');
    if (!(F.hurtAmp(30) > F.hurtAmp(2))) throw new Error('hurt amp should grow with damage');
  });

  test('feel: casing flies out to the right of the aim, lands, bounces once, fades', () => {
    const c = F.casing(lcg(7), 1, 0, 28), p = { x: 0, y: 0, z: 0 };
    if (!(c.vy > 0)) throw new Error('should go to the right-hand side (down on screen) when aiming east');
    F.casingPos(c, 0, p); near(p.z, 28); near(p.x, 0);
    let top = 0, maxZ = 0, landed = false, hopped = false;
    for (let t = 0; t <= c.life; t += 1 / 120) {
      F.casingPos(c, t, p);
      if (p.z < 0) throw new Error('below ground');
      if (t < c.tl) top = Math.max(top, p.z);
      if (t > c.tl && p.z > 0.2) hopped = true;
      if (t > c.tl + 0.01 && p.z === 0) landed = true;
      maxZ = Math.max(maxZ, p.z);
    }
    if (!hopped) throw new Error('no bounce');
    if (!landed) throw new Error('never settles');
    near(F.casingAlpha(c, 0), 0.9); eq(F.casingAlpha(c, c.life), 0);
    // continuous at the moment of landing
    const a = F.casingPos(c, c.tl - 1e-4, {}), b = F.casingPos(c, c.tl + 1e-4, {});
    near(a.x, b.x, 0.05); near(a.y, b.y, 0.05); near(a.z, b.z, 0.5);
  });

  test('feel: casing is repeatable from the same seed', () => {
    const a = F.casing(lcg(3), 0.6, -0.8, 30), b = F.casing(lcg(3), 0.6, -0.8, 30);
    eq(JSON.stringify(a), JSON.stringify(b));
  });

  test('feel: low health intensity curve (0 at 25%+, 1 at 5%-, monotonic)', () => {
    eq(F.lowIntensity(100, 100), 0); eq(F.lowIntensity(25, 100), 0); eq(F.lowIntensity(40, 100), 0);
    eq(F.lowIntensity(5, 100), 1); eq(F.lowIntensity(0, 100), 1);
    let prev = 0;
    for (let h = 25; h >= 0; h -= 0.5) {
      const v = F.lowIntensity(h, 100);
      if (v < prev - 1e-12) throw new Error('not monotonic at ' + h);
      prev = v;
    }
    const mid = F.lowIntensity(15, 100);
    if (!(mid > 0.3 && mid < 0.7)) throw new Error('mid ' + mid);
  });

  test('feel: low health fx pulses slowly and stays bounded', () => {
    const o = { edge: 0, desat: 0 };
    F.lowFx(60, 100, 1.234, o); eq(o.edge, 0); eq(o.desat, 0);
    let lo = 9, hi = -9, prevE = null, maxJump = 0;
    for (let t = 0; t < 4; t += 1 / 60) {
      F.lowFx(10, 100, t, o);
      lo = Math.min(lo, o.edge); hi = Math.max(hi, o.edge);
      if (o.desat > 0.3 + 1e-9 || o.desat < 0) throw new Error('desat ' + o.desat);
      if (prevE !== null) maxJump = Math.max(maxJump, Math.abs(o.edge - prevE));
      prevE = o.edge;
    }
    if (!(hi - lo > 0.1)) throw new Error('no pulse');
    if (hi > 0.7) throw new Error('edge too strong ' + hi);
    if (maxJump > 0.02) throw new Error('edge jumps between frames: ' + maxJump);
  });

  test('feel: crit is one deterministic roll; damage is not touched', () => {
    const r = F.crit(seq([0.01, 0.5, 0.99]), null);
    eq(r.crit, true); eq(r.mult, 1.75);
    const r2 = F.crit(seq([0.5]), null); eq(r2.crit, false); eq(r2.mult, 1);
    const always = F.crit(seq([0.9]), { crit: 1 }); eq(always.crit, true);
    const never = F.crit(seq([0]), { crit: 0 }); eq(never.crit, false);
    let calls = 0; F.crit(() => (calls++, 0.5), null); eq(calls, 1);
  });

  test('feel: enabled=false returns zeros and changes nothing', () => {
    F.enabled = false;
    try {
      const s = F.newShake(), o = { x: 5, y: 5 };
      F.addShake(s, 4); F.kick(s, 1, 0, 3);
      eq(s.amp, 0); eq(s.kx, 0);
      F.shakeOffset(s, 0.01, o); eq(o.x, 0); eq(o.y, 0);
      eq(F.shotAmp(WP.gun), 0); eq(F.hurtAmp(50), 0); eq(F.meleeKick(true), 0);
      eq(F.lowIntensity(1, 100), 0);
      F.lowFx(1, 100, 0.5, o); eq(o.edge, 0); eq(o.desat, 0);
      eq(F.casing(lcg(1), 1, 0, 20), null);
      eq(F.glowRadius(WP.gun), 0); eq(F.glowAlpha(WP.gun), 0);
    } finally { F.enabled = true; }
  });
}
