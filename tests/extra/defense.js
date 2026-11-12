// Base defense (js/defense.js, data/defense.js). Active once the lead adds 'data/defense.js', 'js/defense.js' to the loader in tests/run.js.
if (G.defense) {
  console.log('base defense');
  const DF = G.defense, DD = G.data.defense;
  const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

  test('defense data: quiet trips never raid, chance grows with noise, a fence always helps, the first trip is safe', () => {
    eq(DF.chance(0, 1), 0); eq(DF.chance(DD.chance.quiet - 0.01, 0), 0);
    let prev = 0;
    for (let n = 0.5; n <= 40; n += 0.5) { const c = DF.chance(n, 1); if (c < prev - 1e-9) throw new Error('not monotonic at ' + n); prev = c; }
    for (const n of [1, 3, 8, 20]) if (!(DF.chance(n, 2) < DF.chance(n, 1) && DF.chance(n, 1) < DF.chance(n, 0))) throw new Error('fence order at ' + n);
    if (DF.chance(40, 0) > DD.chance.maxChance + 1e-9) throw new Error('over the cap');
    if (DF.chance(1.5, 1) > 0.05) throw new Error('a first, quiet trip should rarely raid: ' + DF.chance(1.5, 1));
    if (!(DF.chance(15, 2) < 0.4)) throw new Error('level 2 should cut a loud trip a lot');
    for (const lv of [0, 1, 2]) if (!(DD.fence.factor[lv] > 0 && DD.fence.factor[lv] <= 1)) throw new Error('factor ' + lv);
  });

  test('noise: guns count a lot, axes and gathering almost nothing, kills add a little, a refreshed burst counts once', () => {
    const d = DF.create(), b = G.combat.newBurst();
    DF.beginTrip(d, 0);
    for (let i = 0; i < 600; i++) {                                // 10 s of chopping every 0.42 s (r 260)
      if (i % 25 === 0) G.combat.addBurst(b, 260);
      G.combat.stepBurst(b, 1 / 60); DF.track(d, b, 0, 1 / 60);
    }
    if (!(d.noise > 0.5 && d.noise < 2)) throw new Error('chopping ' + d.noise);
    const d2 = DF.create(); DF.beginTrip(d2, 0);
    const b2 = G.combat.newBurst();
    G.combat.addBurst(b2, WP.gun.noise); G.combat.stepBurst(b2, 1 / 60); DF.track(d2, b2, 0, 1 / 60);
    for (let i = 0; i < 20; i++) { G.combat.stepBurst(b2, 1 / 60); DF.track(d2, b2, 0, 1 / 60); }   // the same burst fading: no extra
    near(d2.noise, DF.unit(WP.gun.noise), 1e-9);
    G.combat.stepBurst(b2, 1 / 60); DF.track(d2, b2, 3, 1 / 60); near(d2.noise, DF.unit(WP.gun.noise) + 3 * DD.noise.killNoise, 1e-9);
    G.combat.stepBurst(b2, 1 / 60); DF.track(d2, b2, 3, 1 / 60); near(d2.noise, DF.unit(WP.gun.noise) + 3 * DD.noise.killNoise, 1e-9);   // kills are counted once
    if (!(DF.unit(WP.gun.noise) > 10 * DF.unit(WP.axe.noise))) throw new Error('a shot should be far louder than a swing');
  });

  test('roll: the cooldown skips the trip after a raid, the noise resets, the delay and the count are in range', () => {
    const d = DF.create();
    eq(DF.roll(d, 1, () => 0), null);                              // noise 0: nothing, even with the luckiest roll
    d.noise = 30;
    const r = DF.roll(d, 1, () => 0);
    if (!r) throw new Error('a very loud trip with a 0 roll must raid');
    eq(d.noise, 0); eq(r.state, 'wait');
    if (!(r.wait >= DD.delay[0] && r.wait <= DD.delay[1])) throw new Error('delay ' + r.wait);
    eq(r.types.length, 3);
    DF.spawn(d, G.base.build(), 1, null, () => 0.5);               // the raid appears: cooldown starts
    eq(d.cool, DD.cooldownTrips);
    d.noise = 30; eq(DF.roll(d, 1, () => 0), null); eq(d.cool, 0);   // the next trip is spared
    d.noise = 30; if (!DF.roll(d, 1, () => 0)) throw new Error('the trip after that can raid again');
    d.noise = 30; eq(DF.roll(d, 1, () => 0.999), null);            // an unlucky roll: no raid
  });

  test('count and types: 1 to 3, more when louder, runners only when loud', () => {
    eq(DF.count(1), 1); eq(DF.count(8), 2); eq(DF.count(30), 3);
    eq(DF.types(2, () => 0).join(), 'shambler');
    eq(DF.types(30, () => 0).join(), 'runner,runner,runner');
    eq(DF.types(30, () => 0.99).join(), 'shambler,shambler,shambler');
  });

  test('waiting and spawning: time only runs while allowed, raiders appear north of the gate away from the player', () => {
    const d = DF.create(), base = G.base.build();
    d.noise = 30; DF.roll(d, 2, () => 0);
    eq(DF.waiting(d), true); eq(DF.active(d), false);
    for (let i = 0; i < 60 * 20; i++) if (DF.tickWait(d, 1 / 60, false)) throw new Error('spawned while not allowed');
    let n = 0; while (!DF.tickWait(d, 1 / 60, true) && n < 60 * 20) n++;
    if (!(n > 60 * 3 && n < 60 * 7)) throw new Error('waited ' + n);
    const pl = { x: 1605, y: 668 }, list = DF.spawn(d, base, 2, pl, () => 0.5);
    eq(list.length, 3); eq(DF.active(d), true);
    for (const s of list) {
      if (!(s.y < base.layout.area.y - 100)) throw new Error('not north of the fence: ' + s.y);
      if (Math.hypot(s.x - pl.x, s.y - pl.y) < DD.spawn.minFromPlayer - 1) throw new Error('on top of the player');
      if (Math.abs(s.x - base.layout.trail.x) > 150) throw new Error('off the trail');
      if (G.base.collide) { const q = { x: s.x, y: s.y, radius: 15 }; const x0 = q.x, y0 = q.y; G.base.collide(q, base.solids); if (Math.hypot(q.x - x0, q.y - y0) > 0.5) throw new Error('inside a solid'); }
    }
    ok2(d.raid.gate && d.raid.gate.hp === DD.gate.hp, 'level 2 has a gate');
    const d1 = DF.create(); d1.noise = 30; DF.roll(d1, 1, () => 0); DF.spawn(d1, base, 1, null, () => 0.5);
    eq(d1.raid.gate, null);                                         // level 1: no gate
    function ok2(v, m) { if (!v) throw new Error(m); }
  });

  // One raid on the real base: returns what happened to the player / gate / raiders.
  function raidSim(level, seconds, opts) {
    opts = opts || {};
    const base = G.base.build();
    G.base.setBuildings(base, Object.assign({}, G.crafting.startBuildings(), { fence: level }));
    const d = DF.create(); d.noise = 30; DF.roll(d, level, () => 0);
    d.raid.types = opts.types || ['shambler', 'shambler'];
    const pl = Object.assign({ x: 1500, y: 1000, radius: 18, alive: true }, opts.player || {});
    const list = DF.spawn(d, base, level, pl, () => 0.5).map(s => { const e = G.enemies.create(s.type, s.x, s.y, G.util.rng(3)); e.state = 'chase'; return e; });
    const res = { hits: 0, gateHits: 0, broke: false, firstIn: null, firstBroke: null, d, list, base };
    for (let t = 0; t < seconds * 60; t++) {
      const c = { area: DF.arena(d, base), world: { width: base.width, height: base.height }, noise: 0, player: { x: pl.x, y: pl.y, radius: pl.radius, alive: true }, events: [] };
      for (const e of list) {
        const aimed = e.state !== 'dead' && e.state !== 'dying' ? DF.aim(d, e, c, base) : null;
        const out = G.enemies.step(e, aimed ? aimed.c : c, 1 / 60);
        if (out.hit && aimed && aimed.gate !== false) { if (aimed.gate) { res.gateHits++; if (DF.hitGate(d, out.hit) === 'broke') { res.broke = true; if (res.firstBroke === null) res.firstBroke = t / 60; } } }
        else if (out.hit) res.hits++;
        if (res.firstIn === null && e.y > base.layout.area.y + 30) res.firstIn = t / 60;
      }
      G.enemies.separate(list, c.player, c.area);
    }
    return res;
  }

  test('fence level 1: the gate gap is open, raiders walk in through it and attack the player', () => {
    const r = raidSim(1, 25);
    if (r.firstIn === null) throw new Error('nobody came in');
    eq(r.gateHits, 0); if (!(r.hits > 0)) throw new Error('no blow reached the player');
    for (const e of r.list) if (e.y < r.base.layout.area.y - 5 && e.state !== 'dead') throw new Error('stuck outside at ' + e.x + ',' + e.y);
  });

  test('fence level 2: the gate holds them at first, they hit the gate and not the player, then it breaks and they come in', () => {
    const r = raidSim(2, 8);
    eq(r.firstIn, null, 'no one inside within 8 s');
    if (!(r.gateHits > 0)) throw new Error('nobody hit the gate');
    eq(r.hits, 0, 'the player must be untouched behind the gate');
    for (const e of r.list) if (e.y > r.base.layout.area.y) throw new Error('slipped through at ' + e.y);
    const r2 = raidSim(2, 90);
    eq(r2.broke, true); if (r2.firstIn === null) throw new Error('never came in after the gate broke');
    if (!(r2.firstBroke > 5)) throw new Error('the gate fell too fast: ' + r2.firstBroke);
    eq(DF.gateHolds(r2.d), false);
    eq(DF.arena(r2.d, r2.base).solids.length, r2.base.solids.length);        // a broken gate is no longer in the way
  });

  test('fence level 2: a runner pair chewing takes longer than a single blow, a lone one is slower than two', () => {
    const one = raidSim(2, 120, { types: ['shambler'] }), two = raidSim(2, 120, { types: ['shambler', 'shambler'] });
    if (!(one.firstBroke > two.firstBroke)) throw new Error('one ' + one.firstBroke + ' two ' + two.firstBroke);
  });

  test('the gate and arena: the gate is in the raiders solids only while it holds, the player solids never include it', () => {
    const base = G.base.build(), d = DF.create(); d.noise = 30; DF.roll(d, 2, () => 0); DF.spawn(d, base, 2, null, () => 0.5);
    eq(DF.arena(d, base).solids.length, base.solids.length + 1);
    eq(DF.arena(d, base), DF.arena(d, base), 'cached');
    const gi = DF.gateInfo(d, base); near(gi.frac, 1);
    DF.hitGate(d, DD.gate.hp / 2); near(DF.gateInfo(d, base).frac, 0.5);
    eq(DF.hitGate(d, 1e6), 'broke'); eq(DF.gateInfo(d, base), null); eq(DF.hitGate(d, 5), 'none');
    // the player walks through the gap whatever happens to the gate
    const q = { x: 1605, y: 755, radius: 18 }; G.base.collide(q, base.solids);
    near(q.x, 1605, 0.01); near(q.y, 755, 0.01);
  });

  test('a raider that is blocked by the gap target keeps hunting: it is never left idle, and the real player is the stand-in only outside', () => {
    const base = G.base.build(); G.base.setBuildings(base, Object.assign({}, G.crafting.startBuildings(), { fence: 1 }));
    const d = DF.create(); d.noise = 30; DF.roll(d, 1, () => 0); DF.spawn(d, base, 1, null, () => 0.5);
    const e = mkEnemy('shambler', 1605, 300); e.state = 'idle';
    const c = { area: DF.arena(d, base), world: { width: base.width, height: base.height }, noise: 0, player: { x: 1300, y: 1000, radius: 18, alive: true } };
    let a = DF.aim(d, e, c, base);
    eq(e.state, 'chase'); eq(a.gate, null); if (a.c.player.y > 600) throw new Error('should aim at the gap first');
    e.y = 900; a = DF.aim(d, e, c, base);                           // already inside: straight at the player
    eq(a.gate, false); eq(a.c, c);
    e.y = 900; c.player = { x: 1605, y: 380, radius: 18, alive: true };   // the player went out through the gap
    a = DF.aim(d, e, c, base); eq(a.gate, null);
    e.y = 300; a = DF.aim(d, e, c, base); eq(a.gate, false);        // both outside: straight at the player
  });

  test('the raid ends only when every raider is a corpse; a trip or fainting clears it (state is dropped by game.js)', () => {
    const d = DF.create(), base = G.base.build(); d.noise = 30; DF.roll(d, 2, () => 0); DF.spawn(d, base, 2, null, () => 0.5);
    const a = mkEnemy('shambler', 1, 1), b = mkEnemy('runner', 2, 2);
    eq(DF.finished(d, [a, b]), false);
    a.state = 'dead'; b.state = 'dying'; eq(DF.finished(d, [a, b]), false);
    b.state = 'dead'; eq(DF.finished(d, [a, b]), true); eq(DF.active(d), false); eq(d.raid, null);
    eq(DF.finished(d, [a, b]), false);
    d.noise = 30; DF.roll(d, 1, () => 0); DF.beginTrip(d, 5);        // leaving before they came: gone, and a fresh count
    eq(d.raid, null); eq(d.noise, 0); eq(d.killsSeen, 5);
  });

  test('a loud pistol fight with a level-2 fence stays rare, a level-0 one is likely', () => {
    const n = 4 * DF.unit(WP.gun.noise) + 3 * DD.noise.killNoise;     // four shots and three kills
    if (!(DF.chance(n, 2) < 0.12)) throw new Error('level 2: ' + DF.chance(n, 2));
    if (!(DF.chance(n, 0) > 0.2)) throw new Error('level 0: ' + DF.chance(n, 0));
  });
}
