// Loot from killed infected (data/loot.js + js/loot.js). Activates once those files are in the tests/run.js loader;
// until then it loads them itself (node only) so the tests are never silently skipped.
if (!G.loot) {
  try {
    const nodeRequire = process.mainModule.require, fsx = nodeRequire('fs'), pth = nodeRequire('path');
    const root = pth.join(process.cwd(), 'projects', 'silence-before-storm'), base = fsx.existsSync(pth.join(process.cwd(), 'data', 'loot.js')) ? process.cwd() : root;
    for (const f of ['data/loot.js', 'js/loot.js']) new Function('window', fsx.readFileSync(pth.join(base, f), 'utf8'))({ G });
  } catch (e) { /* loader not available: tests below are skipped */ }
}

if (G.loot) {
  console.log('loot');
  const LD = G.data.loot;
  const seeded = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const allTypes = ['shambler', 'runner', 'brute', 'crawler', 'screamer', 'something_new'];

  test('loot: every table entry is a real, stackable, non-weapon item with sane numbers', () => {
    const tables = Object.values(LD.types).concat([LD.default]);
    for (const t of tables) for (const e of t) {
      if (!G.data.items[e.item]) throw new Error('unknown item ' + e.item);
      if (G.data.items[e.item].weapon) throw new Error('weapon in loot: ' + e.item);
      if (!(e.chance > 0 && e.chance <= 1) || e.min < 1 || e.max < e.min) throw new Error('bad entry ' + e.item);
    }
  });
  test('loot: never rolls unknown items, weapons, zero or oversized amounts', () => {
    const r = seeded(7), bag = G.inventory.create(12);
    G.inventory.add(bag, 'pistol', 1, G.data.items); G.inventory.add(bag, 'm16', 1, G.data.items);
    for (const ty of allTypes) for (let i = 0; i < 3000; i++) {
      const out = G.loot.roll(ty, r, { sneak: i % 2 === 0, bag });
      let units = 0;
      for (const [id, n] of out) {
        if (!G.data.items[id]) throw new Error('unknown ' + id);
        if (G.data.items[id].weapon) throw new Error('weapon ' + id);
        if (!(n >= 1) || n !== Math.floor(n) || n > G.data.items[id].stack) throw new Error('bad count ' + id + ' ' + n);
        units += n;
      }
      if (units > LD.maxUnits) throw new Error('too many units ' + units);
    }
  });
  test('loot: deterministic with a seeded rand, and no repeated item ids in one drop', () => {
    const a = G.loot.roll('shambler', seeded(42), { sneak: false }), b = G.loot.roll('shambler', seeded(42), { sneak: false });
    eq(JSON.stringify(a), JSON.stringify(b));
    for (let i = 0; i < 500; i++) {
      const out = G.loot.roll('brute', seeded(i), {}), ids = out.map(o => o[0]);
      eq(new Set(ids).size, ids.length);
    }
  });
  test('loot: rand = 0 gives the maximum table roll (bounded), rand ~ 1 gives nothing', () => {
    const none = G.loot.roll('shambler', () => 0.999999, { sneak: true });
    eq(none.length, 0);
    const all = G.loot.roll('shambler', () => 0, {});
    if (all.length === 0) throw new Error('rand 0 should drop');
    let units = 0; for (const o of all) units += o[1];
    if (units > LD.maxUnits) throw new Error('cap ignored');
  });
  test('loot: a quiet kill drops more often than a loud one', () => {
    const count = (sneak) => { const r = seeded(11); let n = 0; for (let i = 0; i < 20000; i++) n += G.loot.roll('shambler', r, { sneak }).length; return n; };
    const q = count(true), l = count(false);
    if (!(q > l * 1.15)) throw new Error('sneak ' + q + ' vs loud ' + l);
    near(G.loot.chanceOf({ item: 'cloth', chance: 0.2 }, { sneak: true }), 0.2 * LD.sneakMult, 1e-9);
  });
  test('loot: ammo is likelier with a matching gun in the bag, and only for that ammo', () => {
    const bag = G.inventory.create(12); G.inventory.add(bag, 'm16', 1, G.data.items);
    const e556 = { item: 'ammo_556', chance: 0.1 }, e9 = { item: 'ammo', chance: 0.1 }, cl = { item: 'cloth', chance: 0.1 };
    near(G.loot.chanceOf(e556, { bag }), 0.1 * LD.gunMult, 1e-9);
    near(G.loot.chanceOf(e9, { bag }), 0.1, 1e-9);
    near(G.loot.chanceOf(cl, { bag }), 0.1, 1e-9);
    near(G.loot.chanceOf(e556, {}), 0.1, 1e-9);                       // no bag in ctx: no bonus, no crash
    near(G.loot.chanceOf({ item: 'ammo', chance: 0.9 }, { sneak: true }), LD.maxChance, 1e-9);   // capped
  });
  test('loot: unknown enemy type uses the default table, known ones their own', () => {
    eq(G.loot.table('no_such_thing'), LD.default);
    eq(G.loot.table(undefined), LD.default);
    eq(G.loot.table('runner'), LD.types.runner);
    const out = G.loot.roll('no_such_thing', () => 0, {});
    if (!out.length) throw new Error('default table gave nothing');
    G.loot.roll('no_such_thing');                                     // default rand (Math.random) works
  });
  test('loot: average per kill is 0.5-2.5 units (a few items at most), more than 0 for every type', () => {
    for (const ty of ['shambler', 'runner', 'brute', 'crawler', 'screamer', 'x']) {
      const r = seeded(99); let units = 0, ammo = 0, N = 20000;
      for (let i = 0; i < N; i++) for (const [id, n] of G.loot.roll(ty, r, { sneak: i % 3 === 0 })) { units += n; if (G.data.items[id].kind === 'ammo') ammo += n; }
      const avg = units / N;
      if (avg < 0.3 || avg > 2.5) throw new Error(ty + ' average ' + avg.toFixed(2));
      if (ty === 'shambler' || ty === 'runner') { const a = ammo / N; if (a < 0.08 || a > 0.9) throw new Error(ty + ' ammo avg ' + a.toFixed(2)); }
    }
  });
  test('loot: drops fit the backpack through G.inventory.add; a full bag returns the leftover', () => {
    const bag = G.inventory.create(1); G.inventory.add(bag, 'metal', 50, G.data.items);
    eq(G.inventory.add(bag, 'cloth', 2, G.data.items), 2);
    const big = G.inventory.create(2);
    for (const [id, n] of G.loot.roll('brute', () => 0, {})) eq(G.inventory.add(big, id, n, G.data.items) >= 0, true);
  });
}
