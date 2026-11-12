// New infected types: brute, crawler, screamer (data/enemies.js, js/enemies.js, palettes in js/player.js).
console.log('enemy types: brute, crawler, screamer');
const NT = ['brute', 'crawler', 'screamer'], ALLT = ['shambler', 'runner'].concat(NT);
const RESD = G.data.resources, W2 = { width: 2000, height: 1500 };
const hasFinite = (e) => Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.hp);
const STATES = ['idle', 'wander', 'investigate', 'chase', 'windup', 'stagger', 'scream', 'dying', 'dead'];

test('new types: data is complete and has the intended character', () => {
  const T = EN.types;
  for (const id of ALLT) {
    const d = T[id];
    if (!d) throw new Error('missing type ' + id);
    for (const k of ['hp', 'speed', 'wander', 'radius', 'scale', 'mass', 'stunMult', 'sight', 'hear', 'range', 'dmg', 'attackTime', 'hitU', 'cooldown', 'lunge'])
      if (!(typeof d[k] === 'number' && d[k] >= 0 && Number.isFinite(d[k]))) throw new Error(id + '.' + k);
    eq(d.id, id); eq(d.look, id);
    if (!(d.hitU > 0.2 && d.hitU < 0.9)) throw new Error(id + ' hitU');
  }
  const b = T.brute, c = T.crawler, s = T.screamer, sh = T.shambler;
  if (!(b.scale >= 1.2 && b.hp >= sh.hp * 3 && b.speed < sh.speed && b.dmg > sh.dmg && b.attackTime > sh.attackTime * 1.4)) throw new Error('brute is not big, slow and heavy');
  if (!(b.mass >= 3 && b.stunMult <= 0.35)) throw new Error('brute should barely be pushed or staggered');
  if (!(c.scale < 0.8 && c.radius < sh.radius && c.hp < sh.hp && c.dmg < sh.dmg && c.attackTime < sh.attackTime && c.speed > sh.speed)) throw new Error('crawler is not low, quick and weak');
  if (!(c.sight < sh.sight)) throw new Error('crawler should see short');
  if (!(s.hp < sh.hp && s.dmg < sh.dmg)) throw new Error('screamer should be weak');
  for (const id in T) if (id !== 'screamer' && s.sight <= T[id].sight) throw new Error('screamer should see further than ' + id);
  if (!(s.scream && Math.abs(s.scream.radius - 600) <= 100 && s.scream.time > 0.3)) throw new Error('scream data');
  // spawn table: only known types, brutes from risk 3, crawlers and screamers from risk 2
  for (let r = 1; r <= 5; r++) {
    const t = EN.spawn[r];
    for (const id in t) if (!T[id]) throw new Error('unknown type in spawn table: ' + id);
    if (r < 3 && t.brute) throw new Error('brute below risk 3');
    if (r < 2 && (t.crawler || t.screamer)) throw new Error('crawler / screamer at risk 1');
    if (r >= 3 && !t.brute) throw new Error('no brute at risk ' + r);
    if (r >= 2 && !(t.crawler && t.screamer)) throw new Error('no crawler / screamer at risk ' + r);
  }
  if (!(EN.maxPerArea <= 12)) throw new Error('cap');
});

test('new types: spawn only at the allowed risk, never more than 12 per area, deterministic per visit', () => {
  const A = G.area.generate(G.data.areas.forest, RESD, 1);
  const outdoor = { interior: false }, inside = { interior: true };
  const seen = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} };
  for (let r = 1; r <= 5; r++) {
    for (let v = 1; v <= 60; v++) {
      const rand = G.util.rng(1000 + v * 17 + r);
      const list = G.enemies.plan(outdoor, r, rand);
      if (list.length > 12) throw new Error('risk ' + r + ': ' + list.length + ' enemies');
      list.forEach(t => { seen[r][t] = (seen[r][t] || 0) + 1; });
      const inn = G.enemies.plan(inside, r, G.util.rng(v + r));
      if (inn.length > 12) throw new Error('interior too many');
      if (inn.indexOf('brute') >= 0) throw new Error('a brute inside a room');
    }
  }
  eq(!!(seen[1].crawler || seen[1].screamer || seen[1].brute), false);
  eq(!!seen[2].brute, false);
  eq(!!(seen[2].crawler && seen[2].screamer), true);
  eq(!!(seen[3].brute && seen[4].brute && seen[5].brute), true);
  eq(!!(seen[5].crawler && seen[5].screamer && seen[5].runner && seen[5].shambler), true);
  // the real thing: spawnFor on a real area, same visit = same list, spots are free
  for (let r = 1; r <= 5; r++) {
    const a = G.enemies.spawnFor(A, r, 3, { x: A.spawn.x, y: A.spawn.y, r: EN.avoidSpawn }), b = G.enemies.spawnFor(A, r, 3, { x: A.spawn.x, y: A.spawn.y, r: EN.avoidSpawn });
    eq(JSON.stringify(a.map(e => [e.type, e.x, e.y])), JSON.stringify(b.map(e => [e.type, e.x, e.y])));
    if (a.length > 12) throw new Error('spawnFor ' + a.length);
    a.forEach(e => {
      if (r < 3 && e.type === 'brute') throw new Error('brute at risk ' + r);
      if (r < 2 && (e.type === 'crawler' || e.type === 'screamer')) throw new Error(e.type + ' at risk 1');
      if (G.area.inWater(A, e.x, e.y, 0) || G.area.inSolid(A, e.x, e.y, 0)) throw new Error('spawned inside something');
      eq(e.look, e.type); eq(e.scale, EN.types[e.type].scale);
    });
  }
  // floors of buildings never get a brute
  for (let v = 1; v <= 10; v++) {
    const f = G.area.generate(G.data.areas.police_f1, RESD, v);
    G.enemies.spawnFor(f, 5, v, null).forEach(e => { if (e.type === 'brute') throw new Error('brute on a floor'); });
  }
});

test('brute: survives a club sequence much longer than a shambler, barely pushed or staggered', () => {
  const A = arena(), p = rig(500, 700), c = { area: A, world: W2, player: thePlayer(p), noise: 0 };
  const blows = (type) => {
    const e = mkEnemy(type, 560, 700);
    let n = 0;
    while (e.state !== 'dying' && e.state !== 'dead' && n < 200) {
      G.enemies.hurt(e, WP.club.dmg, 500, 700, WP.club); n++;
      for (let i = 0; i < 40; i++) G.enemies.step(e, c, 1 / 60);       // 0.67 s between blows
    }
    return n;
  };
  const sh = blows('shambler'), br = blows('brute');
  if (!(br >= sh * 3)) throw new Error('brute took ' + br + ' blows, shambler ' + sh);
  const s1 = mkEnemy('shambler', 600, 700), b1 = mkEnemy('brute', 600, 700);
  G.enemies.hurt(s1, 1, 500, 700, WP.club); G.enemies.hurt(b1, 1, 500, 700, WP.club);
  if (!(b1.kvx < s1.kvx * 0.5 && b1.stun < s1.stun * 0.5)) throw new Error('brute pushed ' + b1.kvx + ' vs ' + s1.kvx + ', stun ' + b1.stun + ' vs ' + s1.stun);
});

test('brute: the wind-up is long enough to step away, and the blow is heavy', () => {
  const A = arena(), p = rig(300, 700), e = mkEnemy('brute', 360, 700), d = EN.types.brute;
  const c = { area: A, world: W2, player: thePlayer(p), noise: 0 };
  let t = 0, hit = 0;
  while (e.state !== 'windup' && t < 4) { hit += G.enemies.step(e, c, 1 / 60).hit; t += 1 / 60; }
  eq(e.state, 'windup'); eq(hit, 0);
  p.x = 40; c.player = thePlayer(p);
  for (let i = 0; i < d.attackTime * 60 + 5; i++) hit += G.enemies.step(e, c, 1 / 60).hit;
  eq(hit, 0);
  // standing still it does take the blow
  const q = rig(300, 700), e2 = mkEnemy('brute', 400, 700), c2 = { area: A, world: W2, player: thePlayer(q), noise: 0 };
  const total = stepFor(e2, c2, 12);
  if (!(total >= d.dmg && total % d.dmg === 0)) throw new Error('hits ' + total);
});

test('screamer: notices from far, screams once, and every infected within 600px comes to the player', () => {
  const run = (withList) => {
    const A = arena(), p = rig(300, 700);
    const sc = mkEnemy('screamer', 800, 700);                       // 500px from the player: beyond a shambler's sight
    const n1 = mkEnemy('shambler', 900, 900), n2 = mkEnemy('runner', 1100, 700), n3 = mkEnemy('crawler', 820, 640);
    const far = mkEnemy('shambler', 1750, 1400);                    // ~1000px from the screamer
    const busy = mkEnemy('shambler', 1000, 760); busy.state = 'chase'; busy.goal = { x: 5, y: 5 }; busy.t = 0;
    const dead = mkEnemy('shambler', 850, 760); dead.state = 'dead';
    const list = [sc, n1, n2, n3, far, busy, dead];
    list.forEach(e => { e.think = 9; });                            // only the screamer thinks at first
    sc.think = 0;
    const events = [];
    const c = { area: A, world: W2, player: thePlayer(p), noise: 0, events, enemies: withList ? list : undefined };
    let screamEv = null;
    for (let i = 0; i < 40; i++) {
      for (const e of list) G.enemies.step(e, c, 1 / 60);
      G.enemies.separate(list, c.player, A);
      if (!screamEv) screamEv = events.find(ev => ev.type === 'scream') || null;
    }
    if (!screamEv) throw new Error('no scream event');
    eq(screamEv.e, sc); eq(screamEv.x, sc.x); eq(screamEv.y, sc.y); eq(screamEv.radius, 600);
    eq(sc.state, 'scream'); eq(sc.screaming, true);
    for (const e of [n1, n2, n3]) {
      eq(e.state, 'investigate'); eq(e.goal.x, p.x); eq(e.goal.y, p.y);
    }
    if (far.state === 'investigate' || far.state === 'chase') throw new Error('the far one was alerted: ' + far.state);
    eq(busy.goal.x, 5);                                             // one already busy is left alone
    eq(dead.state, 'dead');
    // the scream ends, it goes for the player, and never screams a second time
    for (let i = 0; i < 90; i++) for (const e of list) G.enemies.step(e, c, 1 / 60);
    eq(sc.screaming, false);
    eq(sc.state === 'chase' || sc.state === 'windup', true);
    eq(events.filter(ev => ev.type === 'scream').length, 1);
  };
  run(true);                                                         // game passes c.enemies
  run(false);                                                        // game does not: separate() spreads the alert
});

test('screamer: a screamer hurt before it noticed still screams afterwards; a sneak kill does not', () => {
  const A = arena(), p = rig(300, 700), sc = mkEnemy('screamer', 1500, 1300), nb = mkEnemy('shambler', 1450, 1300);
  const events = [], list = [sc, nb], c = { area: A, world: W2, player: thePlayer(p), noise: 0, events, enemies: list };
  G.enemies.hurt(sc, 4, 1400, 1300, WP.hands);
  eq(sc.state, 'stagger');
  for (let i = 0; i < 90; i++) { for (const e of list) G.enemies.step(e, c, 1 / 60); G.enemies.separate(list, c.player, A); }
  eq(events.filter(ev => ev.type === 'scream').length, 1);
  eq(nb.state, 'investigate');
  const dead = mkEnemy('screamer', 1500, 700), ev2 = [];
  G.enemies.hurt(dead, 999, 1400, 700, WP.club);
  const c2 = { area: A, world: W2, player: thePlayer(p), noise: 0, events: ev2 };
  stepFor(dead, c2, 2);
  eq(ev2.length, 0); eq(dead.state, 'dead');
});

test('crawler: short sight, low and quick, small fast blows', () => {
  const A = arena(), p = rig(300, 700), d = EN.types.crawler;
  const c = { area: A, world: W2, player: thePlayer(p), noise: 0 };
  const far = mkEnemy('crawler', 560, 700);                          // 260px: a shambler would see this, a crawler not
  stepFor(far, c, 2);
  if (far.state === 'chase' || far.state === 'windup') throw new Error('crawler saw from 260px');
  const near1 = mkEnemy('crawler', 440, 700);
  stepFor(near1, c, 1.5);
  eq(near1.state === 'chase' || near1.state === 'windup', true);
  const e = mkEnemy('crawler', 560, 700), c2 = { area: A, world: W2, player: thePlayer(p), noise: 0 };
  e.state = 'chase'; e.goal = { x: 300, y: 700 }; e.sees = true;
  const hit = stepFor(e, c2, 6);
  eq(hit > 0, true); eq(hit % d.dmg, 0);
  if (!(d.dmg < EN.types.shambler.dmg / 2)) throw new Error('not small');
});

test('every type draws its own palette and pose state without NaN (alive, hurt, screaming, dying)', () => {
  for (const id of ALLT) {
    const e = mkEnemy(id, 400, 400);
    eq(e.look, id);
    const A = arena(), c = { area: A, world: W2, player: thePlayer(rig(420, 400)), noise: 0 };
    e.state = 'chase'; e.goal = { x: 420, y: 400 }; e.sees = true;
    for (let i = 0; i < 120; i++) { G.enemies.step(e, c, 1 / 60); G.player.animate(e, 1 / 60, null); }
    G.enemies.hurt(e, 1, 380, 400, WP.club);
    for (let i = 0; i < 40; i++) G.enemies.step(e, c, 1 / 60);
    G.enemies.hurt(e, 9999, 380, 400, WP.club);
    for (let i = 0; i < 60; i++) G.enemies.step(e, c, 1 / 60);
    eq(e.state, 'dead'); if (!hasFinite(e)) throw new Error(id + ' NaN');
  }
});

test('no crash: each type chases a standing player for 60 seconds, stays finite and hurts', () => {
  for (const id of ALLT) {
    const A = arena([{ x: 700, y: 640, w: 30, h: 120, kind: 'iwall' }]);
    const p = rig(300, 700), e = mkEnemy(id, 1000, 700), other = mkEnemy('shambler', 1500, 900);
    const list = [e, other], events = [];
    const c = { area: A, world: W2, player: thePlayer(p), noise: 0, events, enemies: list };
    let hit = 0;
    e.state = 'chase'; e.goal = { x: p.x, y: p.y };
    for (let t = 0; t < 3600; t++) {
      for (const q of list) hit += G.enemies.step(q, c, 1 / 60).hit;
      G.enemies.separate(list, c.player, A);
      if (events.length > 200) events.length = 0;
      if (t % 600 === 599) {
        for (const q of list) {
          if (!hasFinite(q)) throw new Error(id + ' went NaN at ' + t);
          if (STATES.indexOf(q.state) < 0) throw new Error(id + ' bad state ' + q.state);
          if (q.x < -50 || q.x > 2050 || q.y < -50 || q.y > 1550) throw new Error(id + ' left the arena');
        }
      }
    }
    if (!(hit > 0)) throw new Error(id + ' never hurt a standing player in 60s');
  }
});
