// Saving the combat state: the infected of the zone, the floors kept for the trip, and the melee wear counters.
const SRES = G.data.resources;
const roundTrip = (st) => G.save.parse(JSON.stringify(G.save.snapshot(st, 1)));
const inLake = () => {
  const st = mkState(), A = G.area.generate(G.data.areas.lake, SRES, 2);
  st.area = 'lake'; st.zone = A; st.player = { x: 900, y: 1200 }; st.trip = {};
  return st;
};

test('save combat: three infected come back with type, position, hp and the dead one still dead', () => {
  const st = inLake();
  const a = mkEnemy('shambler', 500, 600), b = mkEnemy('runner', 900, 700), c = mkEnemy('shambler', 1200, 800);
  a.hp = 31.4; a.angle = 1.25;
  c.state = 'dead'; c.hp = 0; c.angle = 3;
  st.enemies = [a, b, c];
  const d = roundTrip(st).data;
  eq(d.enemies.length, 3);
  eq(d.enemies[0].t, 'shambler'); eq(d.enemies[0].x, 500); eq(d.enemies[0].y, 600); near(d.enemies[0].hp, 31.4, 0.11); near(d.enemies[0].a, 1.25, 0.01);
  eq(d.enemies[1].t, 'runner'); eq(d.enemies[1].s, 'idle'); eq(d.enemies[1].hp, EN.types.runner.hp);
  eq(d.enemies[2].s, 'dead'); eq(d.enemies[2].hp, 0);
  const back = G.save.restoreEnemies(d.enemies, null);
  eq(back.length, 3);
  eq(back[0].type, 'shambler'); eq(back[0].x, 500); eq(back[0].y, 600); near(back[0].hp, 31.4, 0.11); eq(back[0].kind, 'enemy');
  eq(back[1].type, 'runner'); eq(back[1].state, 'idle');
  eq(back[2].state, 'dead'); eq(back[2].hp, 0); eq(back[2].fall, 1);
  eq(G.enemies.alive(back), 2);
});

test('save combat: chasing, hunting and dying infected are saved as wander / dead, never mid-blow', () => {
  const chase = mkEnemy('shambler', 400, 400), wind = mkEnemy('shambler', 450, 400), dying = mkEnemy('shambler', 500, 400), inv = mkEnemy('runner', 550, 400);
  chase.state = 'chase'; wind.state = 'windup'; dying.state = 'dying'; dying.hp = 0; inv.state = 'investigate';
  const out = G.save.enemiesOf([chase, wind, dying, inv]);
  eq(out.map(e => e.s).join(','), 'wander,wander,wander,dead');       // living first, the fallen last
  const back = G.save.restoreEnemies(G.save.cleanEnemies(out), null);
  const w = back.find(e => e.type === 'shambler' && e.x === 400);
  eq(w.state, 'wander'); eq(!!w.goal, true);
  // a restored wanderer and an idle one can be stepped without errors
  const A = arena(), c = { area: A, world: A, player: { x: 1800, y: 1400, radius: 18, alive: true }, noise: 0 };
  for (const e of back) for (let i = 0; i < 120; i++) G.enemies.step(e, c, 1 / 60);
});

test('save combat: corrupt entries are dropped, the rest survive', () => {
  const raw = [
    { t: 'shambler', x: 100, y: 200, hp: 50, s: 'idle', a: 0 },
    null, 5, 'x', [], {},
    { t: 'dragon', x: 100, y: 100, hp: 5, s: 'idle', a: 0 },
    { t: 'shambler', x: 'a', y: 5, hp: 5, s: 'idle', a: 0 },
    { t: 'shambler', x: NaN, y: 5 },
    { t: 'shambler', x: 1, y: Infinity },
    { t: '__proto__', x: 100, y: 100 },
    { t: 'constructor', x: 100, y: 100 },
    { t: 'runner', x: 300, y: 300, hp: 'lots', s: 'flying', a: 'x' },
    { t: 'runner', x: 400, y: 400, hp: -9, s: 'idle', a: 0 },
    { t: 'shambler', x: 500, y: 500, hp: 9999, s: 'dead', a: 1e9 }
  ];
  const c = G.save.cleanEnemies(raw);
  eq(c.length, 4);
  eq(c[0].t, 'shambler'); eq(c[0].hp, 50);
  eq(c[1].t, 'runner'); eq(c[1].s, 'idle'); eq(c[1].hp, EN.types.runner.hp); eq(c[1].a, 0);
  eq(c[2].s, 'dead'); eq(c[2].hp, 0);                         // hp 0 or less is a corpse
  eq(c[3].s, 'dead'); eq(c[3].hp, 0); eq(c[3].a, 100);
  for (const bad of [undefined, null, 'x', 7, {}, { length: 3 }]) eq(G.save.cleanEnemies(bad).length, 0);
  // coordinates are clamped to the zone
  const e = G.save.cleanEnemies([{ t: 'shambler', x: -50, y: 99999, hp: 10, s: 'idle', a: 0 }], { width: 2000, height: 1500 })[0];
  eq(e.x, 20); eq(e.y, 1480);
  // through the whole parse: a corrupt field never throws and never loses the rest of the save
  const st = inLake(), snap = G.save.snapshot(st, 1);
  for (const junk of ['x', 5, null, { a: 1 }, [[1, 2]], [null, 3]]) {
    snap.enemies = junk; snap.enemyKeep = junk;
    const r = G.save.parse(JSON.stringify(snap));
    eq(r.ok, true); eq(r.data.zone.id, 'lake');
    eq(Array.isArray(r.data.enemies) ? r.data.enemies.length : r.data.enemies, Array.isArray(junk) ? 0 : null);
    eq(Object.keys(r.data.enemyKeep).length, 0);
  }
});

test('save combat: never more than 40 infected per zone, and the living are kept first', () => {
  const list = [];
  for (let i = 0; i < 30; i++) { const d = mkEnemy('shambler', 100 + i, 100); d.state = 'dead'; d.hp = 0; list.push(d); }
  for (let i = 0; i < 30; i++) list.push(mkEnemy('runner', 200 + i, 300));
  const out = G.save.enemiesOf(list);
  eq(out.length, 40); eq(out.filter(e => e.s !== 'dead').length, 30); eq(out.filter(e => e.s === 'dead').length, 10);
  const raw = []; for (let i = 0; i < 100; i++) raw.push({ t: 'shambler', x: 100 + i, y: 100, hp: 10, s: 'idle', a: 0 });
  eq(G.save.cleanEnemies(raw).length, 40);
  const st = inLake(); st.enemies = list;
  eq(roundTrip(st).data.enemies.length, 40);
});

test('save combat: floors kept in memory for the trip are saved under their zone ids, bounded', () => {
  const st = mkState(), A = G.area.generate(G.data.areas.police_f2, SRES, 3);
  st.area = 'police_f2'; st.zone = A; st.player = { x: 2150, y: 680 }; st.trip = { police_f1: [[0, 0]] };
  st.enemies = [mkEnemy('shambler', 800, 800)];
  st.enemyKeep = {
    police_f1: [mkEnemy('runner', 700, 500), mkEnemy('shambler', 900, 600)],
    police_f2: st.enemies,                       // the current floor is saved once, as `enemies`
    ghost_floor: [mkEnemy('shambler', 100, 100)]  // not a place: dropped on load
  };
  const d = roundTrip(st).data;
  eq(d.enemies.length, 1);
  eq(Object.keys(d.enemyKeep).join(','), 'police_f1');
  eq(d.enemyKeep.police_f1.length, 2); eq(d.enemyKeep.police_f1[0].t, 'runner'); eq(d.enemyKeep.police_f1[1].x, 900);
  const snap = G.save.snapshot(st, 1);
  eq(Object.keys(snap.enemyKeep).length <= 12, true);
  // bound on floors
  const many = {}; for (let i = 0; i < 30; i++) many['f' + i] = [mkEnemy('shambler', 100, 100)];
  st.enemyKeep = many;
  eq(Object.keys(G.save.snapshot(st, 1).enemyKeep).length, 12);
  // a plain restore, as continueGame does
  const lists = {}; for (const k in d.enemyKeep) lists[k] = G.save.restoreEnemies(d.enemyKeep[k], null);
  eq(lists.police_f1[0].type, 'runner');
});

test('save combat: an old save without any combat field still loads, with defaults', () => {
  const st = inLake(), snap = G.save.snapshot(st, 1);
  delete snap.enemies; delete snap.enemyKeep; delete snap.wear; delete snap.wearLife;
  const r = G.save.parse(JSON.stringify(snap));
  eq(r.ok, true); eq(r.data.zone.id, 'lake');
  eq(r.data.enemies, null);                           // null = re-roll like before
  eq(JSON.stringify(r.data.enemyKeep), '{}'); eq(JSON.stringify(r.data.wear), '{}'); eq(JSON.stringify(r.data.wearLife), '{}');
  const base = G.save.parse(JSON.stringify(G.save.snapshot(mkState(), 1))).data;     // at the base: no zone, no enemies
  eq(base.enemies, null); eq(base.zone, null);
  eq(G.save.VERSION, 2);                              // 2 = the story layer (tests/extra/story.js)
  const noEnemies = G.save.parse(JSON.stringify(Object.assign(G.save.snapshot(inLake(), 1), { enemies: [] }))).data;
  eq(noEnemies.enemies.length, 0);                    // an empty list is a real answer: a cleared zone stays cleared
});

test('save combat: melee wear round trip', () => {
  const st = mkState();
  st.wear = { axe: 12, club: 3 }; st.wearLife = { axe: 150, club: 99 };
  const d = roundTrip(st).data;
  eq(JSON.stringify(d.wear), JSON.stringify({ axe: 12, club: 3 })); eq(JSON.stringify(d.wearLife), JSON.stringify({ axe: 150, club: 99 }));
  // wear is saved at the base too, and with no wear fields in the state nothing breaks
  eq(G.save.snapshot(mkState(), 1).wear && Object.keys(G.save.snapshot(mkState(), 1).wear).length, 0);
});

test('save combat: unknown, non-melee and broken wear entries are dropped, numbers become clamped integers', () => {
  const snap = G.save.snapshot(mkState(), 1);
  snap.wear = { axe: 7.9, club: -4, pickaxe: 1e12, ghost: 5, gun: 5, hands: 2, uzi: 3, sword: 'x', __proto__x: 1 };
  snap.wearLife = { axe: NaN, club: '10', pickaxe: null, ghost: 1 };
  const d = G.save.parse(JSON.stringify(snap)).data;
  eq(d.wear.axe, 7); eq(d.wear.club, 0); eq(d.wear.pickaxe, 100000);
  for (const bad of ['ghost', 'gun', 'hands', 'uzi', 'sword', '__proto__x']) eq(bad in d.wear, false, bad + ' kept: ');
  eq(JSON.stringify(d.wearLife), '{}');
  for (const junk of [null, 5, 'x', [1, 2], true]) {
    const s2 = G.save.snapshot(mkState(), 1); s2.wear = junk; s2.wearLife = junk;
    const r = G.save.parse(JSON.stringify(s2));
    eq(r.ok, true); eq(JSON.stringify(r.data.wear), '{}'); eq(JSON.stringify(r.data.wearLife), '{}');
  }
  const proto = JSON.parse('{"v":1,"wear":{"__proto__":{"axe":5},"axe":2}}');
  eq(JSON.stringify(G.save.parse(JSON.stringify(proto)).data.wear), '{"axe":2}');
});
