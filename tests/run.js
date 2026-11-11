// Logic tests. Run: node tests/run.js  (no packages; loads game scripts into a vm sandbox)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function loadGame(files) {
  const ctx = { console, Math };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of files) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx.G;
}

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || '') + ` expected ${b}, got ${a}`); }
function near(a, b, eps, msg) { if (Math.abs(a - b) > (eps || 1e-6)) throw new Error((msg || '') + ` expected ~${b}, got ${a}`); }

const G = loadGame(['js/core.js', 'data/items.js', 'data/resources.js', 'data/areas.js', 'js/input.js', 'js/inventory.js', 'js/player.js', 'js/base.js', 'js/area.js']);
// Fixed item table for the inventory tests, so balance changes in data/items.js do not break them.
const IT = { wood: { stack: 20 }, stone: { stack: 20 }, axe: { stack: 1 } };
const world = { width: 1000, height: 800 };
const pc = G.config.player;

console.log('timing');
test('one step per 16.67ms', () => {
  const r = G.timing.advance(0, G.config.stepMs, G.config);
  eq(r.steps, 1); near(r.acc, 0);
});
test('remainder is carried over', () => {
  const r = G.timing.advance(0, G.config.stepMs * 2.5, G.config);
  eq(r.steps, 2); near(r.alpha, 0.5, 1e-9);
});
test('long hitch is capped (no spiral of death)', () => {
  const r = G.timing.advance(0, 60000, G.config);
  if (r.steps > G.config.maxStepsPerFrame) throw new Error('too many steps: ' + r.steps);
  if (r.acc >= G.config.stepMs) throw new Error('backlog kept: ' + r.acc);
});
test('negative frame time is ignored', () => {
  eq(G.timing.advance(0, -50, G.config).steps, 0);
});

console.log('input');
test('WASD maps to screen axes', () => {
  G.input.clear();
  G.input.keyDown('KeyW'); G.input.keyDown('KeyD');
  const m = G.input.getMove();
  eq(m.x, 1); eq(m.y, -1); eq(m.run, false);
});
test('opposite keys cancel', () => {
  G.input.clear();
  G.input.keyDown('KeyA'); G.input.keyDown('KeyD');
  eq(G.input.getMove().x, 0);
});
test('Shift sets run', () => {
  G.input.clear();
  G.input.keyDown('ShiftLeft');
  eq(G.input.getMove().run, true);
});
test('blur clears stuck keys', () => {
  G.input.keyDown('KeyS');
  G.input.clear();
  eq(G.input.getMove().y, 0);
});
test('wasPressed fires once until consumed', () => {
  G.input.clear();
  G.input.keyDown('KeyE'); G.input.keyDown('KeyE'); // key repeat
  eq(G.input.wasPressed('KeyE'), true);
  G.input.consumeFrame();
  eq(G.input.wasPressed('KeyE'), false);
});

console.log('player');
test('walks at walkSpeed', () => {
  const p = G.player.create(500, 400);
  G.player.update(p, { x: 1, y: 0 }, null, 1, world);
  near(p.x, 500 + pc.walkSpeed); eq(p.moving, true); eq(p.running, false);
});
test('diagonal is normalized (not faster)', () => {
  const p = G.player.create(500, 400);
  G.player.update(p, { x: 1, y: 1 }, null, 0.5, world);
  near(Math.hypot(p.x - 500, p.y - 400), pc.walkSpeed * 0.5);
});
test('running is faster by runMult', () => {
  const p = G.player.create(500, 400);
  G.player.update(p, { x: 0, y: -1, run: true }, null, 0.5, world);
  near(400 - p.y, pc.walkSpeed * pc.runMult * 0.5); eq(p.running, true);
});
test('Shift without moving is not running', () => {
  const p = G.player.create(500, 400);
  G.player.update(p, { x: 0, y: 0, run: true }, null, 0.1, world);
  eq(p.running, false); eq(p.moving, false); eq(p.x, 500);
});
test('stays inside world bounds', () => {
  const p = G.player.create(20, 20);
  G.player.update(p, { x: -1, y: -1, run: true }, null, 10, world);
  eq(p.x, p.radius); eq(p.y, p.radius);
  G.player.update(p, { x: 1, y: 1, run: true }, null, 100, world);
  eq(p.x, world.width - p.radius); eq(p.y, world.height - p.radius);
});
test('faces the mouse aim', () => {
  const p = G.player.create(500, 400);
  G.player.update(p, { x: 0, y: 0 }, { x: 500, y: 600 }, 0.016, world);
  near(p.angle, Math.PI / 2);
});
test('without aim, faces movement direction', () => {
  const p = G.player.create(500, 400);
  G.player.update(p, { x: -1, y: 0 }, null, 0.016, world);
  near(Math.abs(p.angle), Math.PI);
});
test('keeps previous position for interpolation', () => {
  const p = G.player.create(500, 400);
  G.player.update(p, { x: 1, y: 0 }, null, 0.1, world);
  eq(p.prevX, 500);
});

console.log('inventory');
test('add fills existing stack, then a new slot', () => {
  const inv = G.inventory.create(3);
  eq(G.inventory.add(inv, 'wood', 15, IT), 0);
  eq(G.inventory.add(inv, 'wood', 10, IT), 0);       // stack is 20: 20 + 5
  eq(inv.slots[0].n, 20); eq(inv.slots[1].n, 5);
  eq(G.inventory.count(inv, 'wood'), 25);
});
test('add returns the leftover when full', () => {
  const inv = G.inventory.create(1);
  eq(G.inventory.add(inv, 'wood', 27, IT), 7);
  eq(G.inventory.add(inv, 'stone', 1, IT), 1);
});
test('unknown item is rejected', () => {
  eq(G.inventory.add(G.inventory.create(2), 'nope', 3, IT), 3);
});
test('non-stackable items take one slot each', () => {
  const inv = G.inventory.create(2);
  eq(G.inventory.add(inv, 'axe', 3, IT), 1);
  eq(G.inventory.usedSlots(inv), 2);
});
test('remove takes across stacks and frees slots', () => {
  const inv = G.inventory.create(3);
  G.inventory.add(inv, 'wood', 30, IT);
  eq(G.inventory.remove(inv, 'wood', 25), 25);
  eq(G.inventory.count(inv, 'wood'), 5); eq(G.inventory.usedSlots(inv), 1);
  eq(G.inventory.remove(inv, 'wood', 99), 5);
});
test('move transfers a whole stack', () => {
  const a = G.inventory.fromList(2, [['stone', 9]], IT), b = G.inventory.create(2);
  eq(G.inventory.move(a, 0, b, Infinity, IT), 9);
  eq(a.slots[0], null); eq(G.inventory.count(b, 'stone'), 9);
});
test('move transfers one unit', () => {
  const a = G.inventory.fromList(2, [['stone', 9]], IT), b = G.inventory.create(2);
  eq(G.inventory.move(a, 0, b, 1, IT), 1);
  eq(a.slots[0].n, 8); eq(G.inventory.count(b, 'stone'), 1);
});
test('move is partial when the target is nearly full (nothing lost)', () => {
  const a = G.inventory.fromList(2, [['wood', 20]], IT), b = G.inventory.fromList(1, [['wood', 15]], IT);
  eq(G.inventory.move(a, 0, b, Infinity, IT), 5);
  eq(a.slots[0].n, 15); eq(b.slots[0].n, 20);
});
test('move from an empty slot does nothing', () => {
  eq(G.inventory.move(G.inventory.create(2), 0, G.inventory.create(2), 1), 0);
});
test('space counts partial stacks and empty slots', () => {
  const inv = G.inventory.fromList(3, [['wood', 15], ['stone', 20]], IT);
  eq(G.inventory.space(inv, 'wood', IT), 25); eq(G.inventory.space(inv, 'stone', IT), 20);
  eq(G.inventory.space(inv, 'axe', IT), 1); eq(G.inventory.space(inv, 'nope', IT), 0);
});
test('starting loadout fits its containers', () => {
  const d = G.data.inventory;
  for (const key of ['bag', 'chest']) {
    const inv = G.inventory.create(d[key + 'Slots']);
    for (const [id, n] of d.start[key]) eq(G.inventory.add(inv, id, n), 0, key + ' ' + id);
  }
});

console.log('base');
test('wall pushes the player out', () => {
  const b = G.base.build(), a = G.base.layout.area;
  const p = G.player.create(a.x + 100, a.y + a.h - 8);   // inside the south fence
  G.base.collide(p, b.solids);
  if (p.y > a.y + a.h - 12 - p.radius + 1e-6) throw new Error('still in wall: ' + p.y);
});
test('player cannot walk through the cabin', () => {
  const b = G.base.build(), c = G.base.layout.cabin;
  const p = G.player.create(c.x + c.w / 2, c.y + c.h + 40);
  for (let i = 0; i < 120; i++) { G.player.update(p, { x: 0, y: -1, run: true }, null, 1 / 60, G.config.world); G.base.collide(p, b.solids); }
  if (p.y < c.y + c.h + p.radius - 1e-3) throw new Error('inside cabin: ' + p.y);
});
test('gate is open: player can leave the base to the north', () => {
  const b = G.base.build(), L = G.base.layout;
  const p = G.player.create(L.gate.x + L.gate.w / 2, L.area.y + 200);
  for (let i = 0; i < 180; i++) { G.player.update(p, { x: 0, y: -1, run: false }, null, 1 / 60, G.config.world); G.base.collide(p, b.solids); }
  if (p.y > L.area.y - 40) throw new Error('stuck at gate: ' + p.y);
});
test('spawn is free and inside the yard', () => {
  const b = G.base.build(), L = G.base.layout, p = G.player.create(L.spawn.x, L.spawn.y);
  const before = [p.x, p.y]; G.base.collide(p, b.solids);
  eq(p.x, before[0]); eq(p.y, before[1]);
});
test('chest is reachable from inside the yard (interaction range)', () => {
  const L = G.base.layout, b = G.base.build();
  const p = G.player.create(L.chest.x + L.chest.w / 2, L.chest.y + L.chest.h + 40);
  G.base.collide(p, b.solids);
  eq(G.base.nearChest(p), true);
  eq(G.base.nearChest(G.player.create(L.spawn.x, L.spawn.y)), false);
});
test('chest is solid', () => {
  const L = G.base.layout, b = G.base.build();
  const p = G.player.create(L.chest.x + 5, L.chest.y + 5);
  G.base.collide(p, b.solids);
  const c = L.chest;
  if (p.x > c.x - p.radius + 1e-3 && p.x < c.x + c.w + p.radius && p.y > c.y - p.radius + 1e-3 && p.y < c.y + c.h + p.radius &&
      (p.x >= c.x && p.x <= c.x + c.w || p.y >= c.y && p.y <= c.y + c.h)) throw new Error('inside chest');
});

console.log('forest');
const RES = G.data.resources, FDEF = G.data.areas.forest, ITEMS = G.data.items;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const bagWith = (list, size) => G.inventory.fromList(size || 12, list);
const nodeOf = (F, type) => F.nodes.find(n => n.type === type && !n.border);
const targetOf = n => ({ kind: 'node', node: n, x: n.x, y: n.y, r: n.r });
test('data: every resource gives a known item and needs a known tool', () => {
  for (const [id, d] of Object.entries(RES)) {
    if (!ITEMS[d.item]) throw new Error(id + ' item ' + d.item);
    if (d.tool && !ITEMS[d.tool]) throw new Error(id + ' tool ' + d.tool);
    if (!(d.time > 0) || d.yield[0] > d.yield[1]) throw new Error(id + ' numbers');
  }
  for (const s of FDEF.spawns) if (!RES[s.type]) throw new Error('spawn ' + s.type);
});
test('terrain is the same on every trip, loose resources are re-rolled', () => {
  const a = G.area.generate(FDEF, RES, 1), b = G.area.generate(FDEF, RES, 2);
  const key = (F, f) => F.nodes.filter(f).map(n => n.type + n.x + ',' + n.y).join('|');
  const tree = n => !!n.canopy, loose = n => n.type === 'mushrooms' || n.type === 'stones';
  eq(key(a, tree), key(b, tree));
  if (key(a, loose) === key(b, loose)) throw new Error('loose resources identical');
  eq(key(a, loose), key(G.area.generate(FDEF, RES, 1), loose), 'same trip is deterministic: ');
});
test('every resource type is placed in full', () => {
  const F = G.area.generate(FDEF, RES, 1);
  for (const s of FDEF.spawns) {
    const n = F.nodes.filter(x => x.type === s.type && !x.border).length;
    if (n < s.count) throw new Error(s.type + ': ' + n + '/' + s.count);
  }
});
test('gatherable nodes are inside the map, out of the water and off the exit', () => {
  const F = G.area.generate(FDEF, RES, 3);
  for (const n of F.nodes) {
    if (n.border) continue;
    if (n.x < FDEF.margin || n.y < FDEF.margin || n.x > F.width - FDEF.margin || n.y > F.height - FDEF.margin) throw new Error('outside ' + n.type);
    if (G.area.inWater(F, n.x, n.y, 0)) throw new Error('in water ' + n.type);
    if (dist(n, F.exit) < F.exit.r) throw new Error('on exit ' + n.type);
  }
});
test('spawn is free, outside the exit ring, and the exit is a short walk south', () => {
  const F = G.area.generate(FDEF, RES, 1), p = G.player.create(F.spawn.x, F.spawn.y);
  G.area.collide(p, F);
  eq(p.x, F.spawn.x); eq(p.y, F.spawn.y);
  eq(G.area.findTarget(F, p), null);
  for (let i = 0; i < 90 && !G.area.findTarget(F, p); i++) { G.player.update(p, { x: 0, y: 1 }, null, 1 / 60, F); G.area.collide(p, F); }
  eq(G.area.findTarget(F, p).kind, 'exit');
});
test('the trail from the spawn into the forest is walkable', () => {
  const F = G.area.generate(FDEF, RES, 1), p = G.player.create(F.spawn.x, F.spawn.y), path = FDEF.paths[0];
  for (let k = 2; k < path.length; k++) {
    for (let i = 0; i < 900 && Math.hypot(path[k][0] - p.x, path[k][1] - p.y) > 60; i++) {
      G.player.update(p, { x: path[k][0] - p.x, y: path[k][1] - p.y }, null, 1 / 60, F); G.area.collide(p, F);
    }
    if (Math.hypot(path[k][0] - p.x, path[k][1] - p.y) > 60) throw new Error('blocked before waypoint ' + k);
  }
});
test('trunks, boulders and water are solid; stumps are not', () => {
  const F = G.area.generate(FDEF, RES, 1), t = nodeOf(F, 'pine'), p = G.player.create(t.x + 3, t.y);
  G.area.collide(p, F);
  if (dist(p, t) < t.solid + p.radius - 1e-6) throw new Error('inside trunk');
  const pond = F.ponds[0], q = G.player.create(pond.x, pond.y + 5);
  G.area.collide(q, F);
  if (dist(q, pond) < pond.r - 8 + q.radius - 1e-6) throw new Error('in water');
  t.dead = true;
  const w = G.player.create(t.x + 3, t.y); G.area.collide(w, F);
  eq(w.x, t.x + 3);
});
test('target is the nearest node in reach; border trees are ignored', () => {
  const F = G.area.generate(FDEF, RES, 1), n = nodeOf(F, 'stones');
  const p = G.player.create(n.x + n.r + 18 + 4, n.y);
  const got = G.area.findTarget(F, p);
  if (!got || got.kind !== 'node') throw new Error('no target');
  for (const o of F.nodes) if (!o.border && !o.dead && dist(o, p) - o.r < dist(got.node, p) - got.node.r - 1e-9) throw new Error('not nearest');
  const b = F.nodes.find(x => x.border), pb = G.player.create(b.x + b.r + 20, b.y);
  const t = G.area.findTarget(F, pb);
  if (t && t.node === b) throw new Error('border tree targeted');
  eq(G.area.findTarget(F, G.player.create(F.spawn.x, F.spawn.y)), null);
});
test('a tree needs an axe; loose stones need nothing', () => {
  const F = G.area.generate(FDEF, RES, 1);
  eq(G.area.check(targetOf(nodeOf(F, 'pine')), bagWith([]), RES), 'tool');
  eq(G.area.check(targetOf(nodeOf(F, 'pine')), bagWith([['axe', 1]]), RES), null);
  eq(G.area.check(targetOf(nodeOf(F, 'stones')), bagWith([]), RES), null);
  eq(G.area.check(targetOf(nodeOf(F, 'boulder')), bagWith([['axe', 1]]), RES), 'tool');
});
test('holding E for the full time harvests into the bag and removes the node', () => {
  const F = G.area.generate(FDEF, RES, 1), n = nodeOf(F, 'pine'), bag = bagWith([['axe', 1]]), g = G.area.newGather();
  const want = n.amount; let done = null, hits = 0, steps = 0;
  while (!done && steps < 600) { const o = G.area.gatherStep(g, targetOf(n), true, 1 / 60, bag, RES); if (o.hit) hits++; done = o.done; steps++; }
  near(steps / 60, RES.pine.time, 0.02);
  eq(done.gained, want); eq(G.inventory.count(bag, 'wood'), want); eq(n.dead, true); eq(n.amount, 0);
  if (hits < 3) throw new Error('hits: ' + hits);
});
test('releasing E or switching target resets the progress', () => {
  const F = G.area.generate(FDEF, RES, 1), n = nodeOf(F, 'stones'), m = nodeOf(F, 'branches'), bag = bagWith([]), g = G.area.newGather();
  for (let i = 0; i < 10; i++) G.area.gatherStep(g, targetOf(n), true, 1 / 60, bag, RES);
  if (!(g.t > 0)) throw new Error('no progress');
  G.area.gatherStep(g, targetOf(m), true, 1 / 60, bag, RES); near(g.t, 1 / 60);
  G.area.gatherStep(g, targetOf(m), false, 1 / 60, bag, RES); eq(g.t, 0);
  eq(G.inventory.usedSlots(bag), 0);
});
test('full bag blocks gathering; a partial fit leaves the rest on the node', () => {
  const F = G.area.generate(FDEF, RES, 1), n = nodeOf(F, 'pine');
  const full = bagWith([['axe', 1], ['stone', ITEMS.stone.stack]], 2);
  eq(G.area.check(targetOf(n), full, RES), 'full');
  eq(G.area.gatherStep(G.area.newGather(), targetOf(n), true, 5, full, RES).blocked, 'full');
  const tight = bagWith([['axe', 1], ['wood', ITEMS.wood.stack - 1]], 2), had = n.amount;
  const r = G.area.harvest(n, tight, RES);
  eq(r.gained, 1); eq(r.left, had - 1); eq(n.amount, had - 1); eq(n.dead, false);
  eq(G.area.check(targetOf(n), tight, RES), 'full');
});
test('water never runs out and is limited only by the bag', () => {
  const F = G.area.generate(FDEF, RES, 1), pond = F.ponds[0], bag = bagWith([], 1);
  const p = G.player.create(pond.x, pond.y - pond.r - 100);
  for (let i = 0; i < 200; i++) { G.player.update(p, { x: 0, y: 1 }, null, 1 / 60, F); G.area.collide(p, F); }
  const t = G.area.findTarget(F, p);
  eq(t.kind, 'water');
  for (let i = 0; i < ITEMS.water_dirty.stack; i++) eq(G.area.harvest(t.node, bag, RES).gained, 1);
  eq(G.area.check(t, bag, RES), 'full'); eq(pond.dead, undefined);
});
test('a whole trip fills the bag (the limit is reachable)', () => {
  const F = G.area.generate(FDEF, RES, 1), d = G.data.inventory, bag = bagWith(d.start.bag, d.bagSlots);
  for (const n of F.nodes) if (!n.border && RES[n.type].tool !== 'pickaxe') G.area.harvest(n, bag, RES);
  eq(G.inventory.usedSlots(bag), d.bagSlots);
});
test('base: trailhead is outside the gate, reachable, and the return point is free', () => {
  const b = G.base.build(), L = G.base.layout, p = G.player.create(L.gate.x + L.gate.w / 2, L.area.y + 120);
  eq(G.base.nearTrail(p), false);
  for (let i = 0; i < 200 && !G.base.nearTrail(p); i++) { G.player.update(p, { x: 0, y: -1 }, null, 1 / 60, G.config.world); G.base.collide(p, b.solids); }
  eq(G.base.nearTrail(p), true);
  const a = G.player.create(L.arrive.x, L.arrive.y); G.base.collide(a, b.solids);
  eq(a.x, L.arrive.x); eq(a.y, L.arrive.y); eq(G.base.nearTrail(a), true);
});
test('base: woods never block the yard, the gate or the trail', () => {
  const b = G.base.build(), L = G.base.layout, a = L.area;
  if (b.trees.length < 60) throw new Error('too few trees: ' + b.trees.length);
  eq(b.solids.filter(s => s.kind === 'trunk').length, b.trees.length);
  for (const t of b.trees) {
    if (t.x > a.x - 100 && t.x < a.x + a.w + 100 && t.y > a.y - 100 && t.y < a.y + a.h + 100) throw new Error('tree at the fence');
    if (Math.abs(t.x - L.trail.x) < 120 && t.y < a.y) throw new Error('tree on the trail');
  }
  eq(JSON.stringify(G.base.build().trees.map(t => [t.x, t.y])), JSON.stringify(b.trees.map(t => [t.x, t.y])));
});
test('base: trunks and the woodpile are solid', () => {
  const b = G.base.build(), t = b.trees.find(x => !x.border), p = G.player.create(t.x + 2, t.y);
  G.base.collide(p, b.solids);
  if (Math.abs(p.x - t.x) < 11 + p.radius - 1e-6 && Math.abs(p.y - t.y) < 11 + p.radius - 1e-6 && Math.hypot(p.x - t.x, p.y - t.y) < 11 + p.radius - 1e-6) throw new Error('inside trunk');
  const w = G.base.layout.woodpile, q = G.player.create(w.x + w.w / 2, w.y + w.h / 2);
  G.base.collide(q, b.solids);
  if (q.x > w.x && q.x < w.x + w.w && q.y > w.y && q.y < w.y + w.h) throw new Error('inside woodpile');
});

console.log('structure');
test('index.html loads every js file, core first', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  eq(srcs[0], 'js/core.js', 'first script');
  for (const s of srcs) if (!fs.existsSync(path.join(ROOT, s))) throw new Error('missing ' + s);
  for (const dir of ['js', 'data']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith('.js'))) {
      if (!srcs.includes(dir + '/' + f)) throw new Error('not loaded: ' + dir + '/' + f);
    }
  }
  if (/type="module"/.test(html)) throw new Error('ES modules are not allowed (file://)');
});
test('no fetch / import in game code', () => {
  for (const dir of ['js', 'data']) {
    const d = path.join(ROOT, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter(f => f.endsWith('.js'))) {
      const src = fs.readFileSync(path.join(d, f), 'utf8');
      if (/\bfetch\s*\(|^\s*(import|export)\s/m.test(src)) throw new Error(dir + '/' + f);
    }
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
