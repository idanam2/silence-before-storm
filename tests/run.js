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

const G = loadGame(['js/core.js', 'data/items.js', 'data/resources.js', 'data/areas.js', ...fs.readdirSync(path.join(ROOT, 'data/places')).sort().map(f => 'data/places/' + f), 'data/interiors.js', 'data/recipes.js', 'data/buildings.js',
  'data/difficulty.js', 'data/needs.js', 'data/world.js', 'data/weapons.js', 'data/enemies.js',
  'js/input.js', 'js/inventory.js', 'js/crafting.js', 'js/needs.js', 'js/tank.js', 'js/world.js', 'js/save.js', 'js/player.js', 'js/base.js', 'js/placing.js', 'js/area.js', 'js/combat.js', 'js/enemies.js', 'data/loot.js', 'js/loot.js', 'data/defense.js', 'js/defense.js', 'js/feel.js']);
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

test('walk blend eases in and back out, the body turns toward the aim', () => {
  const p = G.player.create(500, 400);
  for (let i = 0; i < 30; i++) G.player.update(p, { x: 1, y: 0 }, null, 1 / 60, world);
  if (!(p.gait > 0.95 && p.stride > 0)) throw new Error('gait ' + p.gait);
  near(p.face, 0, 0.01);
  G.player.update(p, { x: 0, y: 0 }, null, 1 / 60, world);
  if (!(p.gait > 0.5)) throw new Error('legs snapped to standing: ' + p.gait);
  for (let i = 0; i < 60; i++) G.player.update(p, { x: 0, y: 0 }, null, 1 / 60, world);
  eq(p.gait, 0); eq(p.stride, 0);
});
test('swing needs a melee tool, runs once and ends', () => {
  const p = G.player.create(500, 400);
  eq(G.player.swing(p), false);
  eq(G.player.setHeld(p, 'gun'), true); eq(G.player.swing(p), false);
  eq(G.player.setHeld(p, 'nope'), false); eq(p.held, 'gun');
  G.player.setHeld(p, 'axe'); eq(p.heldK, 0);
  eq(G.player.swing(p), true); eq(G.player.swing(p), false);
  G.player.animate(p, 0.1, null);
  near(p.swing, 0.1);
  for (let i = 0; i < 60; i++) G.player.animate(p, 1 / 60, null);
  eq(p.swing, -1); eq(p.heldK, 1);
  eq(G.player.swing(p), true);
});
test('gathering drives the work pose and cancels a swing', () => {
  const p = G.player.create(500, 400);
  G.player.setHeld(p, 'club'); G.player.swing(p);
  G.player.animate(p, 1 / 60, { tool: 'axe', phase: 0.5 });
  eq(p.swing, -1); eq(p.workTool, 'axe'); near(p.workPh, 0.5);
  for (let i = 0; i < 40; i++) G.player.animate(p, 1 / 60, { tool: null, phase: 0.2 });
  if (!(p.work > 0.95)) throw new Error('work ' + p.work);
  eq(p.workTool, null); eq(G.player.swing(p), false);
  for (let i = 0; i < 80; i++) G.player.animate(p, 1 / 60, null);
  eq(p.work, 0);
});
test('settle resets the animation after a teleport', () => {
  const p = G.player.create(500, 400);
  for (let i = 0; i < 20; i++) G.player.update(p, { x: 1, y: 1, run: true }, null, 1 / 60, world);
  G.player.settle(p, 1);
  eq(p.gait, 0); eq(p.runK, 0); eq(p.stride, 0); eq(p.face, 1); eq(p.angle, 1); eq(p.moving, false);
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

console.log('crafting');
const RECIPES = G.data.recipes, BLD = G.data.buildings;
const mkctx = (bag, chest, buildings) => ({
  bag: G.inventory.fromList(12, bag || []), chest: G.inventory.fromList(24, chest || []),
  buildings: Object.assign(G.crafting.startBuildings(), buildings || {})
});
const total = (c, id) => G.crafting.have(c, id);
test('data: recipes use known items, stations and sane numbers', () => {
  const ids = new Set();
  if (RECIPES.length < 8) throw new Error('too few recipes: ' + RECIPES.length);
  for (const r of RECIPES) {
    if (ids.has(r.id)) throw new Error('duplicate ' + r.id); ids.add(r.id);
    if (!ITEMS[r.out[0]] || !(r.out[1] > 0)) throw new Error(r.id + ' output');
    if (!BLD[r.station] || !BLD[r.station].station) throw new Error(r.id + ' station');
    if (r.level < 1 || r.level > BLD[r.station].levels.length) throw new Error(r.id + ' level');
    for (const [id, n] of Object.entries(r.cost)) if (!ITEMS[id] || !(n > 0)) throw new Error(r.id + ' cost ' + id);
  }
});
test('data: every building has 2 levels, known costs, a spot inside the yard that overlaps nothing', () => {
  const a = G.base.layout.area, L = G.base.layout, fixed = G.base.build().fixed.filter(s => s.kind !== 'trunk');
  const spots = [];
  for (const id of G.data.buildingOrder) {
    const d = BLD[id];
    if (!d) throw new Error('order ' + id);
    if (!(d.levels.length >= 2)) throw new Error(id + ' needs at least 2 levels');     // the bag, workbench and rack have more
    for (const lv of d.levels) for (const [it, n] of Object.entries(lv.cost)) if (!ITEMS[it] || !(n > 0)) throw new Error(id + ' cost ' + it);
    if (d.spot) spots.push([id, d.spot]);
  }
  eq(Object.keys(BLD).length, G.data.buildingOrder.length);
  const hit = (p, q) => p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y;
  for (const [id, s] of spots) {
    if (s.x < a.x + 30 || s.y < a.y + 30 || s.x + s.w > a.x + a.w - 30 || s.y + s.h > a.y + a.h - 30) throw new Error(id + ' outside the yard');
    for (const f of fixed) if (hit({ x: s.x - 20, y: s.y - 20, w: s.w + 40, h: s.h + 40 }, f)) throw new Error(id + ' too close to ' + f.kind);
    for (const [id2, s2] of spots) if (id !== id2 && hit({ x: s.x - 20, y: s.y - 20, w: s.w + 40, h: s.h + 40 }, s2)) throw new Error(id + ' too close to ' + id2);
    if (hit(s, { x: L.spawn.x - 40, y: L.spawn.y - 40, w: 80, h: 80 })) throw new Error(id + ' on the spawn');
  }
});
test('data: nothing is stuck: every upgrade cost is made of items the player can obtain in the forest or chest', () => {
  const obtainable = new Set(['wood', 'stone', 'plank', 'mushroom', 'water_dirty']);
  for (const id of G.data.buildingOrder) for (const lv of BLD[id].levels) for (const it of Object.keys(lv.cost)) {
    if (id === 'bag') continue;                  // the bag needs cloth and nails from the places beyond the forest (checked in its own test)
    if (BLD[id].levels.indexOf(lv) >= 3 && ['nails', 'metal', 'cloth'].includes(it)) continue;   // the last upgrade needs things from beyond the forest
    if (!obtainable.has(it)) throw new Error(id + ' needs ' + it);
  }
});
test('start: chest and fence exist, the rest is not built', () => {
  const s = G.crafting.startBuildings();
  eq(s.chest, 1); eq(s.fence, 1); eq(s.workbench, 0); eq(s.campfire, 0); eq(s.bed, 0); eq(s.tank, 0);
  eq(G.crafting.chestSlots(s), G.data.inventory.chestSlots);
});
test('building: needs the full cost, takes it from bag then chest, sets level 1', () => {
  const ok = mkctx([['wood', 3]], [['wood', 3], ['stone', 4]]);      // workbench costs 6 wood + 4 stone: split over bag and chest
  const r = G.crafting.build(ok, 'workbench');
  eq(r.ok, true); eq(r.level, 1); eq(ok.buildings.workbench, 1);
  eq(total(ok, 'wood'), 0); eq(total(ok, 'stone'), 0);
  eq(G.inventory.count(ok.bag, 'wood'), 0, 'bag is emptied first: ');
});
test('building: not enough materials changes nothing', () => {
  const c = mkctx([['wood', 5], ['stone', 4]], []);
  const r = G.crafting.build(c, 'workbench');
  eq(r.ok, false); eq(r.reason, 'cost'); eq(c.buildings.workbench, 0); eq(total(c, 'wood'), 5); eq(total(c, 'stone'), 4);
});
test('building: upgrade to level 2, then the top is reached', () => {
  const c = mkctx([['wood', 10], ['stone', 50]], [['plank', 20], ['metal', 8]], { campfire: 1 });     // (the workbench has 3 levels now, see the tests at the end)
  eq(G.crafting.nextLevel(c, 'campfire'), 2);
  eq(G.crafting.build(c, 'campfire').level, 2);
  eq(G.crafting.build(c, 'campfire').level, 3); eq(G.crafting.build(c, 'campfire').level, 4);
  eq(G.crafting.nextLevel(c, 'campfire'), 0);
  eq(G.crafting.build(c, 'campfire').reason, 'max');
  eq(G.crafting.build(c, 'nope').ok, false);
});
test('chest upgrade grows the chest and never drops items', () => {
  const c = mkctx([], [['cloth', 3]], {});
  G.inventory.add(c.bag, 'wood', 10); G.inventory.add(c.bag, 'plank', 6);
  eq(G.crafting.build(c, 'chest').ok, true);
  eq(G.crafting.chestSlots(c.buildings), 36);
  G.inventory.resize(c.chest, G.crafting.chestSlots(c.buildings));
  eq(c.chest.slots.length, 36); eq(G.inventory.count(c.chest, 'cloth'), 3);
  G.inventory.resize(c.chest, 10); eq(c.chest.slots.length, 36, 'never shrinks: ');
});
test('crafting: needs the station, its level and the materials', () => {
  const axe = RECIPES.find(r => r.id === 'axe'), club = RECIPES.find(r => r.id === 'club');
  let c = mkctx([['wood', 5], ['stone', 5]]);
  eq(G.crafting.craft(c, 'axe').reason, 'station');
  c = mkctx([['wood', 1], ['stone', 5]], [], { workbench: 1 });
  eq(G.crafting.craft(c, 'axe').reason, 'cost');
  c = mkctx([['wood', 5], ['nails', 4]], [], { workbench: 1 });
  eq(G.crafting.recipeStatus(c, club), 'level');
  eq(G.crafting.craft(c, 'club').reason, 'level');
  c.buildings.workbench = 2;
  eq(G.crafting.craft(c, 'club').ok, true); eq(total(c, 'club'), 1); eq(total(c, 'nails'), 0); eq(total(c, 'wood'), 2);
  c = mkctx([['wood', 5], ['stone', 5]], [], { workbench: 1 });
  eq(G.crafting.recipeStatus(c, axe), null);
  eq(G.crafting.craft(c, 'nope').ok, false);
});
test('crafting: result goes to the bag, then the chest when the bag is full', () => {
  const c = mkctx([['wood', 2], ['stone', 3]], [], { workbench: 1 });
  c.bag = G.inventory.fromList(2, [['wood', 2], ['stone', 3]]);        // exactly full: 2 slots
  eq(G.crafting.craft(c, 'axe').ok, true);
  eq(G.inventory.count(c.bag, 'axe'), 1, 'cost freed slots, axe lands in the bag: ');
  const d = mkctx([], [], { workbench: 1 });
  d.bag = G.inventory.fromList(2, [['wood', 10], ['stone', 10]]);      // no slot is freed by paying
  eq(G.crafting.craft(d, 'axe').ok, true);
  eq(G.inventory.count(d.bag, 'axe'), 0); eq(G.inventory.count(d.chest, 'axe'), 1, 'axe goes to the chest: ');
});
test('crafting: with no room anywhere it is refused and every change is rolled back', () => {
  const c = { bag: G.inventory.fromList(2, [['wood', 10], ['stone', 10]]), chest: G.inventory.fromList(1, [['mushroom', 6]]), buildings: Object.assign(G.crafting.startBuildings(), { workbench: 1 }) };
  const r = G.crafting.craft(c, 'plank');
  eq(r.ok, false); eq(r.reason, 'space');
  eq(G.inventory.count(c.bag, 'wood'), 10); eq(G.inventory.count(c.bag, 'stone'), 10); eq(G.inventory.count(c.chest, 'mushroom'), 6);
  eq(G.inventory.count(c.bag, 'plank'), 0);
});
test('crafting: recipes are split between the workbench and the campfire', () => {
  eq(G.crafting.recipesFor('workbench').length + G.crafting.recipesFor('campfire').length + G.crafting.recipesFor('rack').length, RECIPES.length);
  const c = mkctx([['mushroom', 2], ['water_dirty', 1]], [], { campfire: 1 });
  eq(G.crafting.craft(c, 'cooked_food').ok, true); eq(total(c, 'cooked_food'), 1);
  eq(G.crafting.craft(c, 'water_clean').ok, true); eq(total(c, 'water_clean'), 1);
  eq(G.crafting.craft(c, 'stew').reason, 'level');
});
test('the whole progression is possible with forest materials: bench -> planks -> upgrades', () => {
  const c = mkctx([['wood', 10], ['stone', 4]], [], {});
  eq(G.crafting.build(c, 'workbench').ok, true);
  G.inventory.add(c.bag, 'wood', 8); G.inventory.add(c.bag, 'stone', 8);
  for (let i = 0; i < 3; i++) eq(G.crafting.craft(c, 'plank').ok, true);   // 6 planks from 6 wood
  G.inventory.add(c.bag, 'wood', 4);
  eq(G.crafting.craft(c, 'plank').ok, true);                               // 8 planks, wood left: 8
  eq(G.crafting.build(c, 'workbench').ok, true);                           // level 2 needs 8 wood, 8 stone, 4 planks
  eq(c.buildings.workbench, 2);
});
test('base: built structures become solid and usable only once built', () => {
  const b = G.base.build(), L = G.base.layout, wb = BLD.workbench.spot, p = G.player.create(wb.x + wb.w / 2, wb.y + wb.h + 24);
  const n0 = b.solids.length;
  eq(G.base.nearStation(p, b), null);
  G.base.setBuildings(b, Object.assign(G.crafting.startBuildings(), { workbench: 1, campfire: 2 }));
  eq(b.solids.length, n0 + 2);
  eq(b.solids.filter(s => s.kind === 'campfire')[0].level, 2);
  eq(G.base.nearStation(p, b), 'workbench');
  const q = G.player.create(wb.x + wb.w / 2, wb.y + wb.h / 2); G.base.collide(q, b.solids);
  if (q.x > wb.x && q.x < wb.x + wb.w && q.y > wb.y && q.y < wb.y + wb.h) throw new Error('inside the workbench');
  eq(G.base.nearStation(G.player.create(L.spawn.x, L.spawn.y), b), null);
  G.base.setBuildings(b, G.crafting.startBuildings());
  eq(b.solids.length, n0); eq(G.base.nearStation(p, b), null);
});
test('base: the nearest of two stations wins, the chest still works', () => {
  const b = G.base.build(), c = G.base.layout.chest;
  G.base.setBuildings(b, Object.assign(G.crafting.startBuildings(), { workbench: 1 }));
  eq(G.base.nearStation(G.player.create(c.x + c.w / 2, c.y + c.h + 30), b), 'chest');
});
test('base: every building spot can be walked up to (not enclosed)', () => {
  const b = G.base.build();
  G.base.setBuildings(b, Object.assign(G.crafting.startBuildings(), { workbench: 2, campfire: 2, bed: 2, tank: 2 }));
  for (const id of G.data.buildingOrder) {
    const s = BLD[id].spot; if (!s) continue;
    const p = G.player.create(G.base.layout.spawn.x, G.base.layout.spawn.y);
    for (let i = 0; i < 1500; i++) {
      const tx = s.x + s.w / 2, ty = s.y + s.h + 30;
      G.player.update(p, { x: tx - p.x, y: ty - p.y }, null, 1 / 60, G.config.world); G.base.collide(p, b.solids);
      if (Math.hypot(tx - p.x, ty - p.y) < 25) break;
    }
    if (Math.hypot(s.x + s.w / 2 - p.x, s.y + s.h + 30 - p.y) > 40) throw new Error(id + ' unreachable, stopped at ' + Math.round(p.x) + ',' + Math.round(p.y));
  }
});

console.log('needs');
const DIFF = G.data.difficulty.levels, ND = G.data.needs, still = { moving: false, running: false, gathering: false };
const fresh = () => G.needs.create();
test('data: difficulty levels are complete and ordered easy < normal < hard', () => {
  eq(G.data.difficulty.order.join(), 'easy,normal,hard');
  for (const id of G.data.difficulty.order) {
    const d = DIFF[id];
    for (const k of ['hunger', 'thirst', 'energy', 'damage', 'deathLoss']) if (!(d[k] > 0)) throw new Error(id + '.' + k);
    if (!d.name || !d.desc) throw new Error(id + ' text');
  }
  for (const k of ['hunger', 'thirst', 'energy', 'damage']) if (!(DIFF.easy[k] < DIFF.normal[k] && DIFF.normal[k] < DIFF.hard[k])) throw new Error(k + ' order');
  eq(DIFF.easy.deathLoss, 0.5); eq(DIFF.normal.deathLoss, 1); eq(DIFF.hard.loseWeapons, true);
  eq(G.data.difficulty.levels[G.data.difficulty.default].id, 'normal');
});
test('data: needs have labels, a start value and every item effect names a real need', () => {
  for (const k of ND.order) if (!ND.labels[k] || ND.start[k] !== 100) throw new Error(k);
  for (const [id, d] of Object.entries(ITEMS)) for (const k of Object.keys(d.use || {})) if (!ND.order.includes(k)) throw new Error(id + ' effect ' + k);
  for (const lv of BLD.bed.levels) for (const k of ['energy', 'health', 'hunger', 'thirst']) if (!(lv.sleep[k] >= 0)) throw new Error('bed sleep ' + k);
  for (const lv of BLD.tank.levels) if (!(lv.tank.cap > 0 && lv.tank.secs > 0)) throw new Error('tank level');
});
test('a new player is full', () => {
  const n = fresh();
  for (const k of ND.order) eq(n[k], 100, k);
});
test('hunger and thirst drop over time, thirst faster; standing still costs no energy', () => {
  const n = fresh();
  for (let i = 0; i < 60; i++) G.needs.drain(n, 1, still, DIFF.normal);
  near(n.hunger, 100 - ND.drain.hunger * 60, 1e-9); near(n.thirst, 100 - ND.drain.thirst * 60, 1e-9);
  if (!(n.thirst < n.hunger)) throw new Error('thirst must drop faster');
  eq(n.energy, 100); eq(n.health, 100);
});
test('difficulty scales how fast needs drop', () => {
  const a = fresh(), b = fresh(), c = fresh();
  for (let i = 0; i < 100; i++) { G.needs.drain(a, 1, still, DIFF.easy); G.needs.drain(b, 1, still, DIFF.normal); G.needs.drain(c, 1, still, DIFF.hard); }
  if (!(a.hunger > b.hunger && b.hunger > c.hunger)) throw new Error('hunger order ' + [a.hunger, b.hunger, c.hunger]);
  if (!(a.thirst > b.thirst && b.thirst > c.thirst)) throw new Error('thirst order');
});
test('energy: running costs more than walking, gathering costs, resting does not', () => {
  const cost = act => { const n = fresh(); G.needs.drain(n, 10, act, DIFF.normal); return 100 - n.energy; };
  const idle = cost(still), walk = cost({ moving: true }), run = cost({ moving: true, running: true }), gather = cost({ gathering: true });
  eq(idle, 0);
  if (!(walk > 0 && run > walk * 3 && gather > walk)) throw new Error([walk, run, gather]);
  const e = fresh(), h = fresh();
  for (let i = 0; i < 100; i++) { G.needs.drain(e, 1, { moving: true, running: true }, DIFF.easy); G.needs.drain(h, 1, { moving: true, running: true }, DIFF.hard); }
  if (!(e.energy > h.energy)) throw new Error('difficulty energy');
});
test('needs never go below 0, and an empty stomach or throat drains health (scaled by damage)', () => {
  const a = fresh(), b = fresh();
  a.hunger = 0; b.hunger = 0;
  for (let i = 0; i < 10; i++) { G.needs.drain(a, 1, still, DIFF.normal); G.needs.drain(b, 1, still, DIFF.hard); }
  eq(a.hunger, 0);
  near(100 - a.health, ND.starve.hunger * 10, 1e-6);
  if (!(b.health < a.health)) throw new Error('hard should hurt more');
  const t = fresh(); t.thirst = 0; t.hunger = 0;
  for (let i = 0; i < 1000; i++) G.needs.drain(t, 1, still, DIFF.normal);
  eq(t.health, 0);
});
test('health regenerates slowly only while fed and watered', () => {
  const n = fresh(); n.health = 50;
  G.needs.drain(n, 10, still, DIFF.normal);
  near(n.health, 50 + ND.regen.rate * 10, 1e-9);
  const h = fresh(); h.health = 50; h.thirst = 30;
  G.needs.drain(h, 10, still, DIFF.normal);
  eq(h.health, 50);
});
test('exhaustion: slower, no running, slower gathering, but never a death sentence', () => {
  const n = fresh();
  eq(G.needs.isExhausted(n), false); eq(G.needs.speedMult(n), 1); eq(G.needs.canRun(n), true); eq(G.needs.gatherMult(n), 1);
  n.energy = 0;
  for (let i = 0; i < 500; i++) { n.hunger = 100; n.thirst = 100; G.needs.drain(n, 1, { moving: true, running: true }, DIFF.hard); }
  eq(n.energy, 0); if (!(n.health > 0)) throw new Error('energy alone must not hurt');
  eq(G.needs.isExhausted(n), true); eq(G.needs.speedMult(n), ND.exhausted.speed); eq(G.needs.canRun(n), false);
  if (!(G.needs.gatherMult(n) < 1)) throw new Error('gather');
});
test('using food and water restores needs, clamped at 100', () => {
  const n = fresh(); n.hunger = 50; n.thirst = 90;
  eq(G.needs.use(n, ITEMS.canned_food).ok, true); eq(n.hunger, 90);
  eq(G.needs.use(n, ITEMS.water_clean).ok, true); eq(n.thirst, 100);
  const s = fresh(); s.hunger = 10; s.thirst = 10; s.energy = 10; s.health = 10;
  eq(G.needs.use(s, ITEMS.stew).ok, true);
  eq(s.hunger, 55); eq(s.thirst, 20); eq(s.energy, 16); eq(s.health, 15);
});
test('using something that would change nothing is refused (nothing is wasted)', () => {
  const n = fresh();
  eq(G.needs.use(n, ITEMS.canned_food).reason, 'full');
  eq(G.needs.use(n, ITEMS.bandage).reason, 'full');
  eq(G.needs.use(n, ITEMS.axe).reason, 'nouse');
  eq(G.needs.use(n, undefined).reason, 'nouse');
});
test('bad items cost some health but can never kill', () => {
  const n = fresh(); n.thirst = 50;
  eq(G.needs.use(n, ITEMS.water_dirty).ok, true); eq(n.thirst, 70); eq(n.health, 94);
  n.health = 2; n.thirst = 10;
  G.needs.use(n, ITEMS.water_dirty); eq(n.health, 1);
  n.health = 1; n.thirst = 10;
  G.needs.use(n, ITEMS.water_dirty); eq(n.health, 1);
});
test('sleeping: energy full, health back, hunger and thirst drop (scaled, with a floor)', () => {
  const n = fresh(); n.energy = 10; n.health = 40;
  G.needs.sleep(n, 1, DIFF.normal);
  eq(n.energy, 100); eq(n.health, 50); eq(n.hunger, 100 - BLD.bed.levels[0].sleep.hunger); eq(n.thirst, 100 - BLD.bed.levels[0].sleep.thirst);
  const b = fresh(); b.energy = 10; b.health = 40; G.needs.sleep(b, 2, DIFF.normal);
  if (!(b.health > n.health)) throw new Error('level 2 bed heals more');
  const e = fresh(), h = fresh(); G.needs.sleep(e, 1, DIFF.easy); G.needs.sleep(h, 1, DIFF.hard);
  if (!(e.hunger > h.hunger && e.thirst > h.thirst)) throw new Error('sleep cost by difficulty');
  const f = fresh(); f.hunger = 3; f.thirst = 0; G.needs.sleep(f, 1, DIFF.hard);
  eq(f.hunger, 3); eq(f.thirst, 0, 'sleeping never makes it worse than it already was: ');
  const g = fresh(); g.hunger = 8; G.needs.sleep(g, 1, DIFF.hard);
  eq(g.hunger, 5, 'sleep alone never starves you: ');
});
test('fainting: easy loses every second used slot, normal and hard lose the whole bag', () => {
  const mk = () => G.inventory.fromList(12, [['axe', 1], ['wood', 7], ['stone', 3], ['canned_food', 1], ['mushroom', 4]]);
  const e = mk(), n = mk(), h = mk();
  const le = G.needs.deathLoss(e, DIFF.easy);
  eq(le.length, 2); eq(G.inventory.usedSlots(e), 3);
  eq(G.needs.deathLoss(n, DIFF.normal).length, 5); eq(G.inventory.usedSlots(n), 0);
  eq(G.needs.deathLoss(h, DIFF.hard).length, 5); eq(G.inventory.usedSlots(h), 0);
  eq(G.needs.deathLoss(G.inventory.create(4), DIFF.normal).length, 0);
});
test('reviving restores a survivable state without making anything worse', () => {
  const n = fresh(); n.health = 0; n.hunger = 0; n.thirst = 80; n.energy = 5;
  G.needs.revive(n);
  eq(n.health, ND.revive.health); eq(n.hunger, ND.revive.hunger); eq(n.thirst, 80); eq(n.energy, ND.revive.energy);
});

console.log('rain tank');
test('the tank fills one unit per interval up to its capacity', () => {
  const t = G.tank.create(), s = BLD.tank.levels[0].tank;
  G.tank.step(t, 0, 9999); eq(t.amount, 0, 'not built: ');
  G.tank.step(t, 1, s.secs - 1); eq(t.amount, 0);
  G.tank.step(t, 1, 1); eq(t.amount, 1);
  G.tank.step(t, 1, s.secs * 10); eq(t.amount, s.cap);
  G.tank.step(t, 1, 100); eq(t.amount, s.cap); eq(t.t, 0);
});
test('level 2 holds more and fills faster', () => {
  const a = BLD.tank.levels[0].tank, b = BLD.tank.levels[1].tank;
  if (!(b.cap > a.cap && b.secs < a.secs)) throw new Error('level 2 must be better');
  eq(G.tank.cap(0), 0); eq(G.tank.cap(2), b.cap);
});
test('collecting moves water into the bag, then the chest; the rest stays in the tank', () => {
  const WS = ITEMS.water_clean.stack;
  const t = { amount: 6, t: 0 }, bag = G.inventory.fromList(1, [['water_clean', WS - 3]]), chest = G.inventory.create(1);
  eq(G.tank.take(t, bag, chest), 6);
  eq(G.inventory.count(bag, 'water_clean'), WS); eq(G.inventory.count(chest, 'water_clean'), 3); eq(t.amount, 0);
  const u = { amount: 5, t: 0 }, b2 = G.inventory.fromList(1, [['stone', ITEMS.stone.stack]]), c2 = G.inventory.fromList(1, [['water_clean', WS - 3]]);
  eq(G.tank.take(u, b2, c2), 3); eq(u.amount, 2, 'what does not fit stays: ');
  eq(G.tank.take(u, b2, c2), 0); eq(u.amount, 2);
});

console.log('world map');
const DEST = G.data.world.destinations, WORLD = G.data.world;
test('data: every destination has an area, sane numbers, and a place on the map', () => {
  eq(WORLD.order.length, Object.keys(DEST).length);
  if (WORLD.order.length < 8) throw new Error('too few destinations');
  for (const id of WORLD.order) {
    const d = DEST[id], a = G.data.areas[id];
    if (!a || a.id !== id || !a.name) throw new Error(id + ' area');
    if (!(d.km > 0) || !(d.risk >= 1 && d.risk <= 5) || !d.blurb) throw new Error(id + ' numbers');
    if (d.pos.x < 4 || d.pos.x > 96 || d.pos.y < 4 || d.pos.y > 90) throw new Error(id + ' off the map');
    if (Math.hypot(d.pos.x - WORLD.base.pos.x, d.pos.y - WORLD.base.pos.y) < 12) throw new Error(id + ' on top of the base');
  }
  for (const a of WORLD.order) for (const b of WORLD.order) {
    if (a < b && Math.hypot(DEST[a].pos.x - DEST[b].pos.x, DEST[a].pos.y - DEST[b].pos.y) < 9) throw new Error(a + ' and ' + b + ' overlap on the map');
  }
  eq(WORLD.order[0], 'forest'); eq(G.world.has('forest'), true); eq(G.world.has('base'), false); eq(G.world.has('nope'), false);
});
test('map: every destination has a road from the base that ends at it, and a pictogram-free name', () => {
  const geo = WORLD.geo;
  for (const id of WORLD.order) {
    const r = geo.routes[id], d = DEST[id];
    if (!r || r.length < 2) throw new Error(id + ' has no road');
    eq(r[0][0], WORLD.base.pos.x, id + ' road start x: '); eq(r[0][1], WORLD.base.pos.y, id + ' road start y: ');
    eq(r[r.length - 1][0], d.pos.x, id + ' road end x: '); eq(r[r.length - 1][1], d.pos.y, id + ' road end y: ');
  }
});
test('travel cost grows with distance and follows the difficulty', () => {
  let prev = 0;
  for (const id of WORLD.order) {
    const c = G.world.cost(id, DIFF.normal);
    if (!(c > prev)) throw new Error(id + ' is farther than the previous one but not more expensive: ' + c + ' <= ' + prev);
    prev = c;
    if (!(G.world.cost(id, DIFF.easy) < c && c < G.world.cost(id, DIFF.hard))) throw new Error(id + ' difficulty');
  }
  if (G.world.cost('forest', DIFF.normal) > 8) throw new Error('the first trip must be cheap');
  if (G.world.cost('airport', DIFF.normal) >= 100) throw new Error('even the farthest trip is possible from full energy');
  eq(G.world.cost('nope', DIFF.normal), 0);
});
test('loot summary names real resources, most plentiful first', () => {
  for (const id of WORLD.order) {
    const l = G.world.loot(id);
    if (!l.length || l.length > 3) throw new Error(id + ' loot ' + l);
  }
  eq(G.world.loot('quarry')[0], ITEMS.stone.name);
  eq(G.world.loot('forest')[0], ITEMS.wood.name);
});
test('every destination is generated in full, deterministic, and its spawn and exit are usable', () => {
  for (const id of WORLD.order) {
    const def = G.data.areas[id], A = G.area.generate(def, RES, 1), B = G.area.generate(def, RES, 1);
    for (const s of def.spawns) {
      const n = A.nodes.filter(x => x.type === s.type && !x.border).length;
      if (n < s.count) throw new Error(id + ' ' + s.type + ': ' + n + '/' + s.count);
    }
    eq(JSON.stringify(A.nodes.map(n => [n.type, n.x, n.y, n.amount])), JSON.stringify(B.nodes.map(n => [n.type, n.x, n.y, n.amount])), id + ' deterministic: ');
    const p = G.player.create(A.spawn.x, A.spawn.y);
    G.area.collide(p, A);
    eq(p.x, A.spawn.x, id + ' spawn x: '); eq(p.y, A.spawn.y, id + ' spawn y: ');
    eq(G.area.findTarget(A, p), null, id + ' spawn target: ');
    for (let i = 0; i < 200 && !G.area.findTarget(A, p); i++) { G.player.update(p, { x: 0, y: 1 }, null, 1 / 60, A); G.area.collide(p, A); }
    eq(G.area.findTarget(A, p).kind, 'exit', id + ' exit: ');
    for (const n of A.nodes) {
      if (n.border) continue;
      if (G.area.inWater(A, n.x, n.y, 0)) throw new Error(id + ' node in water');
      if (n.x < def.margin || n.y < def.margin || n.x > A.width - def.margin || n.y > A.height - def.margin) throw new Error(id + ' node outside');
    }
  }
});
test('a visit can be changed and restored from the delta list alone', () => {
  const def = G.data.areas.quarry, A = G.area.generate(def, RES, 2);
  eq(G.area.delta(A).length, 0, 'untouched area: ');
  const stones = A.nodes.filter(n => n.type === 'stones' && !n.border), tree = A.nodes.find(n => n.type === 'dead_tree' && !n.border);
  const bag = bagWith([['axe', 1]]);
  G.area.harvest(stones[0], bag, RES);                                   // used up
  const tight = bagWith([['stone', ITEMS.stone.stack - 1]], 1);
  G.area.harvest(stones[1], tight, RES);                                 // partly taken (1 unit fits)
  G.area.harvest(tree, bag, RES);
  const d = JSON.parse(JSON.stringify(G.area.delta(A)));
  eq(d.length, 3);
  const B = G.area.applyDelta(G.area.generate(def, RES, 2), d);
  eq(B.nodes[stones[0].id].dead, true); eq(B.nodes[tree.id].dead, true);
  eq(B.nodes[stones[1].id].dead, false); eq(B.nodes[stones[1].id].amount, stones[1].amount);
  eq(JSON.stringify(G.area.delta(B)), JSON.stringify(d), 'restoring changes nothing more: ');
  const w = G.player.create(B.nodes[stones[0].id].x, B.nodes[stones[0].id].y);
  if (G.area.findTarget(B, w) && G.area.findTarget(B, w).node === B.nodes[stones[0].id]) throw new Error('a used-up node is still targetable');
});

console.log('port');
const PORT = G.data.areas.port;
test('port: structures are solid, cranes only at their feet, ships are not walkable', () => {
  const A = G.area.generate(PORT, RES, 1);
  const wh = PORT.structures.find(s => s.kind === 'warehouse');
  if (!G.area.inSolid(A, wh.x + wh.w / 2, wh.y + wh.h / 2)) throw new Error('warehouse not solid');
  const cr = PORT.structures.find(s => s.kind === 'crane');
  if (G.area.inSolid(A, cr.x + cr.w / 2, cr.y + cr.h / 2)) throw new Error('you should walk between the crane legs');
  if (!G.area.inSolid(A, cr.legs[0].x + 5, cr.legs[0].y + 5)) throw new Error('crane leg not solid');
  const ship = PORT.structures.find(s => s.kind === 'ship');
  if (!G.area.inSea(A, ship.x + ship.w / 2, ship.y + ship.h / 2)) throw new Error('the ship should lie in open water');
});
test('port: the sea stops the player, the piers carry them', () => {
  const A = G.area.generate(PORT, RES, 1);
  const p = G.player.create(1000, 960);                      // on the quay, walk north into the sea
  for (let i = 0; i < 240; i++) { G.player.update(p, { x: 0, y: -1 }, null, 1 / 60, A); G.area.collide(p, A); }
  if (p.y < 880) throw new Error('walked into the sea: y=' + p.y);
  if (G.area.inWater(A, p.x, p.y, 0)) throw new Error('standing in water');
  const pier = PORT.decks[0], q = G.player.create(pier.x + pier.w / 2, 960);
  for (let i = 0; i < 400; i++) { G.player.update(q, { x: 0, y: -1 }, null, 1 / 60, A); G.area.collide(q, A); }
  if (q.y > pier.y + 60) throw new Error('could not walk out onto the pier: y=' + q.y);
  for (let i = 0; i < 200; i++) { G.player.update(q, { x: 1, y: 0 }, null, 1 / 60, A); G.area.collide(q, A); }
  if (q.x > pier.x + pier.w) throw new Error('walked off the side of the pier');
});
for (const PID of Object.keys(G.data.areas).filter(id => G.data.areas[id].loot)) test(PID + ': salvage sits at reachable spots, re-rolled per visit, and the map names it', () => {
  const DEF = G.data.areas[PID], kinds = DEF.loot.map(l => l.type);
  const A = G.area.generate(DEF, RES, 1), B = G.area.generate(DEF, RES, 2);
  for (const k of kinds) {
    const want = DEF.loot.find(l => l.type === k).count, got = A.nodes.filter(n => n.type === k);
    eq(got.length, want, k + ' count: ');
    if (!ITEMS[RES[k].item]) throw new Error(k + ' gives an unknown item');
    for (const n of got) {
      if (G.area.inSolid(A, n.x, n.y, 0) || G.area.inWater(A, n.x, n.y, 0)) throw new Error(k + ' at ' + n.x + ',' + n.y + ' is blocked');
      // somewhere around the node there is a free spot for the player within reach
      let ok = false;
      for (let a = 0; a < 16 && !ok; a++) {
        const d = n.r + 18 + 10, x = n.x + Math.cos(a / 16 * Math.PI * 2) * d, y = n.y + Math.sin(a / 16 * Math.PI * 2) * d;
        const p = G.player.create(x, y); G.area.collide(p, A);
        if (Math.hypot(p.x - x, p.y - y) < 1 && G.area.findTarget(A, p) && G.area.findTarget(A, p).node === n) ok = true;
      }
      if (!ok) throw new Error(k + ' at ' + n.x + ',' + n.y + ' cannot be reached');
    }
  }
  const pos = v => JSON.stringify(v.nodes.filter(n => kinds.includes(n.type)).map(n => [n.x, n.y]));
  if (pos(A) === pos(B)) throw new Error('salvage spots should change between visits');
  if (!G.world.has(PID)) return;
  const loot = G.world.loot(PID, 6);
  const main = ITEMS[RES[DEF.loot[0].type].item].name;                    // the map names what the place is known for
  if (!loot.includes(main)) throw new Error('map summary ' + loot + ' lacks ' + main);
});

test('police: the station, walls and cars block, the yard and the impound lot can be entered', () => {
  const A = G.area.generate(G.data.areas.police, RES, 1);
  if (!G.area.inSolid(A, 1500, 800)) throw new Error('station not solid');
  const car = G.data.areas.police.structures.find(s => s.kind === 'car');
  if (!G.area.inSolid(A, car.x + car.w / 2, car.y + car.h / 2)) throw new Error('car not solid');
  for (const [x, y, gx, gy] of [[800, 500, 1, 0], [3275, 1560, 0, -1]]) {   // walk into the yard (west gap) / the impound lot (south gate)
    const p = G.player.create(x, y);
    for (let i = 0; i < 200; i++) { G.player.update(p, { x: gx, y: gy }, null, 1 / 60, A); G.area.collide(p, A); }
    if (gx && p.x < 1100) throw new Error('could not enter the yard: x=' + p.x);
    if (gy && p.y > 1300) throw new Error('could not enter the impound lot: y=' + p.y);
  }
});

test('buildings: every door leads somewhere, both ways, to a free spot outside the door circle', () => {
  const AR = G.data.areas;
  for (const id of Object.keys(AR)) {
    for (const d of AR[id].doors || []) {
      const to = AR[d.to];
      if (!to) throw new Error(id + ' door to nowhere: ' + d.to);
      if (!(to.doors || []).some(b => b.to === id)) throw new Error(d.to + ' has no way back to ' + id);
      const A = G.area.generate(to, RES, 1), p = G.player.create(d.at.x, d.at.y);
      G.area.collide(p, A);
      if (Math.hypot(p.x - d.at.x, p.y - d.at.y) > 0.5) throw new Error(id + ' -> ' + d.to + ': arrival spot is blocked');
      const t = G.area.findTarget(A, p);
      if (t && t.kind === 'door') throw new Error(id + ' -> ' + d.to + ': arriving right inside another door');
      // the door is reachable from inside its own area
      const B = G.area.generate(AR[id], RES, 1), q = G.player.create(d.x, d.y); G.area.collide(q, B);
      if (Math.hypot(q.x - d.x, q.y - d.y) > d.r) throw new Error(id + ' door at ' + d.x + ',' + d.y + ' is inside a wall');
    }
  }
  if (AR.police_f1.parent !== 'police' || G.world.has('police_f1')) throw new Error('floors are not map destinations');
});
console.log('saving');
const mkState = () => {
  const st = {
    diff: 'hard', playTime: 123.4, needs: Object.assign(fresh(), { hunger: 61.5, energy: 12 }),
    bag: G.inventory.fromList(12, [['axe', 1], ['wood', 7]]), chest: G.inventory.fromList(36, [['cloth', 3], ['plank', 10], ['plank', 4]]),
    buildings: Object.assign(G.crafting.startBuildings(), { workbench: 2, chest: 2, tank: 1 }),
    tank: { amount: 2, t: 40 }, visits: { forest: 3, quarry: 1 },
    area: 'base', zone: null, player: { x: 1600.4, y: 1060.2 }
  };
  return st;
};
const memStore = () => { const m = {}; return { m, getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; };
test('a save is plain JSON with a version number', () => {
  const s = G.save.snapshot(mkState(), 1700000000000);
  eq(s.v, G.save.VERSION); eq(typeof s.v, 'number');
  eq(JSON.stringify(JSON.parse(JSON.stringify(s))), JSON.stringify(s));
});
test('save -> load gives the same game', () => {
  const st = mkState(), r = G.save.parse(JSON.stringify(G.save.snapshot(st, 5)));
  eq(r.ok, true);
  const d = r.data;
  eq(d.diff, 'hard'); eq(d.playTime, 123); near(d.needs.hunger, 61.5); eq(d.needs.energy, 12); eq(d.needs.health, 100);
  eq(d.buildings.workbench, 2); eq(d.buildings.chest, 2); eq(d.buildings.tank, 1); eq(d.buildings.bed, 0);
  eq(JSON.stringify(d.bag), JSON.stringify(st.bag)); eq(JSON.stringify(d.chest), JSON.stringify(st.chest));
  eq(d.chest.slots.length, 36); eq(d.bag.slots.length, 12);
  eq(d.tank.amount, 2); eq(d.visits.forest, 3); eq(d.visits.quarry, 1); eq(d.visits.port, 0);
  eq(d.area, 'base'); eq(d.zone, null); eq(d.pos.x, 1600); eq(d.savedAt, 5);
});
test('saved inside an area: the visit, the position and what was gathered come back', () => {
  const st = mkState(), A = G.area.generate(G.data.areas.lake, RES, 4);
  G.area.harvest(A.nodes.find(n => n.type === 'stones' && !n.border), bagWith([]), RES);
  st.area = 'lake'; st.zone = A; st.player = { x: 900, y: 1200 };
  const d = G.save.parse(JSON.stringify(G.save.snapshot(st, 1))).data;
  eq(d.area, 'lake'); eq(d.zone.id, 'lake'); eq(d.zone.visit, 4); eq(d.zone.delta.length, 1); eq(d.pos.x, 900); eq(d.visits.lake, 4);
});
test('damaged saves are refused, never crash', () => {
  eq(G.save.parse('{not json').reason, 'corrupt'); eq(G.save.parse('').reason, 'corrupt'); eq(G.save.parse('null').reason, 'corrupt');
  eq(G.save.parse('"hi"').reason, 'corrupt'); eq(G.save.parse('{"v":"1"}').reason, 'corrupt'); eq(G.save.parse('[]').reason, 'corrupt');
  eq(G.save.parse(JSON.stringify({ v: G.save.VERSION + 1 })).reason, 'newer');
  eq(G.save.parse(JSON.stringify({ v: 0 })).reason, 'old');
});
test('an old version is upgraded through MIGRATIONS', () => {
  G.save.MIGRATIONS[G.save.VERSION - 1] = null;     // none exist yet: prove the hook is used by faking one
  const was = G.save.VERSION;
  const fake = { v: was - 1 };                      // version 0
  eq(G.save.parse(JSON.stringify(fake)).reason, 'old');
  G.save.MIGRATIONS[0] = o => Object.assign({}, o, { v: 1, diff: 'easy' });
  const r = G.save.parse(JSON.stringify(fake));
  eq(r.ok, true); eq(r.data.diff, 'easy');
  delete G.save.MIGRATIONS[0];
});
test('wrong or missing values are repaired: unknown items, overstacks, NaN, unknown buildings, dead player', () => {
  const r = G.save.parse(JSON.stringify({
    v: 1, diff: 'impossible', playTime: -5,
    needs: { health: -20, hunger: 400, thirst: 'x', energy: null },
    bag: [['wood', 999], ['nope', 3], ['axe', 5], 'junk', ['stone', 0], null, ['stone', 2.9]],
    chest: [['cloth', 2]], buildings: { workbench: 99, ghost: 4, tank: -1, chest: 0, bed: 'x' },
    tank: { amount: 99, t: -3 }, visits: { forest: 2.7, ghost: 5 }, area: 'forest', zone: { id: 'ghost', visit: 1, delta: [] },
    pos: { x: 'a', y: 3 }
  }));
  eq(r.ok, true);
  const d = r.data;
  eq(d.diff, 'normal'); eq(d.playTime, 0);
  eq(d.needs.health, 1, 'health is at least 1: '); eq(d.needs.hunger, 100); eq(d.needs.thirst, 100); eq(d.needs.energy, 100);
  eq(d.bag.slots.length, 12); eq(d.bag.slots[0].n, ITEMS.wood.stack); eq(d.bag.slots[1], null); eq(d.bag.slots[2].n, 1);
  eq(d.bag.slots[3], null); eq(d.bag.slots[4], null); eq(d.bag.slots[6].n, 2);
  eq(d.buildings.workbench, BLD.workbench.levels.length); eq(d.buildings.ghost, undefined); eq(d.buildings.tank, 0); eq(d.buildings.chest, 1); eq(d.buildings.bed, 0);
  eq(d.tank.amount, 0, 'no tank built: nothing stored: ');
  eq(d.visits.forest, 2); eq(d.visits.ghost, undefined);
  eq(d.area, 'base'); eq(d.zone, null); eq(d.pos, null);
  eq(d.chest.slots.length, 24);
});
test('an empty object still loads as a fresh game', () => {
  const r = G.save.parse('{"v":1}');
  eq(r.ok, true); eq(r.data.diff, 'normal'); eq(G.inventory.usedSlots(r.data.bag), 0); eq(r.data.needs.energy, 100);
});
test('storage: write and read back, clear, and every failure is handled', () => {
  const m = memStore();
  G.save.useStorage(m);
  eq(G.save.available(), true); eq(G.save.read().reason, 'none');
  eq(G.save.write(G.save.snapshot(mkState(), 9)), true);
  eq(G.save.read().ok, true); eq(G.save.read().data.diff, 'hard');
  m.m[G.save.KEY] = '{broken';
  eq(G.save.read().reason, 'corrupt'); eq(m.m[G.save.KEY], '{broken', 'a damaged save is kept, not erased: ');
  eq(G.save.clear(), true); eq(G.save.read().reason, 'none');
  G.save.useStorage({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('blocked'); } });
  eq(G.save.write({ v: 1 }), false); eq(G.save.read().reason, 'unavailable'); eq(G.save.clear(), false);
  G.save.useStorage(null);
  eq(G.save.available(), false); eq(G.save.write({ v: 1 }), false);
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

console.log('buildings (save)');
test('save: the inside of a building and the floors already searched survive a reload', () => {
  const st = mkState(), A = G.area.generate(G.data.areas.police_f2, RES, 3);
  G.area.harvest(A.nodes[0], bagWith([]), RES);
  st.area = 'police_f2'; st.zone = A; st.player = { x: 2150, y: 680 }; st.trip = { police: [[1, 0]], police_f1: [[0, 0], [2, 1]] };
  const d = G.save.parse(JSON.stringify(G.save.snapshot(st, 1))).data;
  eq(d.area, 'police_f2'); eq(d.zone.visit, 3); eq(d.zone.delta.length, 1); eq(d.visits.police, 3);
  eq(JSON.stringify(d.trip), JSON.stringify({ police: [[1, 0]], police_f1: [[0, 0], [2, 1]] }));
  const bad = G.save.parse(JSON.stringify(Object.assign(G.save.snapshot(st, 1), { trip: { ghost: [[0, 0]], police: 'x' } }))).data;
  eq(JSON.stringify(bad.trip), JSON.stringify({ police: [] }));
});

console.log('combat (stage 5)');
const WP = G.data.weapons, EN = G.data.enemies;
// A bare 2000x1500 area for fights, optionally with solids.
const arena = (solids) => ({ width: 2000, height: 1500, nodes: [], ponds: [], water: [], decks: [], solids: solids || [], doors: [], exit: null });
const rig = (x, y, angle) => { const p = G.player.create(x, y); G.player.settle(p, angle || 0); p.radius = 18; return p; };
const mkEnemy = (type, x, y) => G.enemies.create(type, x, y, G.util.rng(5));
const thePlayer = (p, alive) => ({ x: p.x, y: p.y, radius: p.radius, alive: alive !== false });
const stepFor = (e, c, seconds) => { let hit = 0; for (let t = 0; t < seconds * 60; t++) hit += G.enemies.step(e, c, 1 / 60).hit; return hit; };

test('weapons: every item, ammo and key points at something real', () => {
  for (const id in WP) {
    const w = WP[id];
    if (w.item && !ITEMS[w.item]) throw new Error(id + ': unknown item ' + w.item);
    if (w.kind === 'gun' && !ITEMS[w.ammo]) throw new Error(id + ': unknown ammo');
    if (w.kind !== 'gun' && !(w.hitU > 0 && w.hitU < 1 && w.dur > 0)) throw new Error(id + ': bad timing');
  }
  for (const k in G.data.weaponKeys) if (!WP[G.data.weaponKeys[k]]) throw new Error(k);
  eq(WP.hands.item, null);
});
test('enemies: data is sane (the runner is faster than a walking player and weaker than a shambler)', () => {
  const s = EN.types.shambler, r = EN.types.runner;
  if (!(r.speed > pc.walkSpeed && r.speed < pc.walkSpeed * pc.runMult)) throw new Error('runner speed ' + r.speed);
  if (!(s.speed < pc.walkSpeed)) throw new Error('shambler too fast');
  if (!(r.hp < s.hp && r.dmg < s.dmg)) throw new Error('runner should be weaker');
  for (const t in EN.types) if (!(EN.types[t].hitU > 0.2 && EN.types[t].hitU < 0.9)) throw new Error(t);
});

test('swing and shove: the blow lands exactly once, at hitU, and a shove is quicker than a club swing', () => {
  const p = G.player.create(500, 400);
  eq(G.player.shove(p), true); eq(G.player.shove(p), false);
  let hits = 0;
  for (let i = 0; i < 80; i++) { G.player.animate(p, 1 / 60, null); if (G.player.swingHit(p, WP.hands.hitU)) hits++; }
  eq(hits, 1); eq(p.swing, -1);
  G.player.setHeld(p, 'club'); eq(G.player.shove(p), false);
  eq(G.player.swing(p), true); near(p.swingDur, 0.5);
  let t = 0; hits = 0;
  while (p.swing >= 0 && t < 2) { G.player.animate(p, 1 / 60, null); t += 1 / 60; if (G.player.swingHit(p, WP.club.hitU)) { hits++; if (!(t > 0.2 && t < 0.3)) throw new Error('blow at ' + t); } }
  eq(hits, 1);
  if (!(WP.hands.dur < WP.club.dur)) throw new Error('a shove should be quicker');
});

test('sight and shots: walls and trunks block, low furniture does not', () => {
  const wall = { x: 900, y: 0, w: 40, h: 1500, kind: 'iwall' }, desk = { x: 900, y: 0, w: 40, h: 1500, kind: 'furn' };
  eq(G.combat.clear(arena([wall]), 500, 700, 1300, 700), false);
  eq(G.combat.clear(arena([desk]), 500, 700, 1300, 700), true);
  eq(G.combat.clear(arena([]), 500, 700, 1300, 700), true);
  const d = G.combat.rayBlock(arena([wall]), 500, 700, 0, 780);
  if (!(d > 380 && d < 410)) throw new Error('ray stopped at ' + d);
  const tree = Object.assign(arena([]), { nodes: [{ x: 800, y: 700, solid: 16, dead: false }] });
  eq(G.combat.clear(tree, 500, 700, 1100, 700), false);
  tree.nodes[0].dead = true; tree.sn = null;
  eq(G.combat.clear(tree, 500, 700, 1100, 700), true);
});

test('melee: reaches the enemy in front, not behind, not too far, not through a wall, not the dead', () => {
  const A = arena(), p = rig(500, 700, 0), w = WP.axe;
  const front = mkEnemy('shambler', 550, 700), back = mkEnemy('shambler', 450, 700), far = mkEnemy('shambler', 640, 700);
  const dead = mkEnemy('shambler', 540, 710); dead.state = 'dead';
  const got = G.combat.meleeTargets(A, p, w, [back, far, dead, front]);
  eq(got.length, 1); eq(got[0], front);
  const wall = arena([{ x: 520, y: 600, w: 16, h: 200, kind: 'iwall' }]);
  eq(G.combat.meleeTargets(wall, p, w, [front]).length, 0);
  const two = [mkEnemy('shambler', 555, 700), mkEnemy('shambler', 560, 722), mkEnemy('shambler', 560, 678)];
  eq(G.combat.meleeTargets(A, p, w, two).length, 2);             // the axe hits two at most
  eq(G.combat.meleeTargets(A, p, WP.pickaxe, two).length, 1);
});

test('gun: hits the first enemy on the line, a wall stops the bullet, a miss just flies on', () => {
  const p = rig(500, 700, 0), w = WP.gun, near1 = mkEnemy('shambler', 700, 700), far1 = mkEnemy('shambler', 900, 700);
  let r = G.combat.shoot(arena(), p, w, [far1, near1], 0);
  eq(r.enemy, near1); if (!(r.dist > 170 && r.dist < 200)) throw new Error('dist ' + r.dist);       // the near one's front edge, not the far one
  r = G.combat.shoot(arena([{ x: 600, y: 600, w: 20, h: 200, kind: 'iwall' }]), p, w, [near1], 0);
  eq(r.enemy, null); eq(r.wall, true);
  r = G.combat.shoot(arena(), p, w, [near1], 0.4);              // aimed well off to the side
  eq(r.enemy, null); eq(r.wall, false); near(r.dist, w.range);
  near1.state = 'dying';
  eq(G.combat.shoot(arena(), p, w, [near1], 0).enemy, null);
});

test('hurt: damage, knock-back away from the source, stagger, a quiet hit does extra, death', () => {
  const e = mkEnemy('shambler', 600, 700);
  eq(e.state, 'idle');
  const r1 = G.enemies.hurt(e, 20, 500, 700, WP.club);
  near(r1.dealt, 30); eq(r1.sneak, true); eq(r1.killed, false);                // unaware: x1.5
  eq(e.state, 'stagger'); if (!(e.kvx > 0 && Math.abs(e.kvy) < 1e-6)) throw new Error('knock ' + e.kvx);
  near(e.hp, EN.types.shambler.hp - 30);
  const r2 = G.enemies.hurt(e, 20, 500, 700, WP.club);
  near(r2.dealt, 20); eq(r2.sneak, false);                                      // already alerted
  const r3 = G.enemies.hurt(e, 999, 500, 700, WP.club);
  eq(r3.killed, true); eq(e.state, 'dying'); eq(e.hp, 0);
  near(Math.cos(e.angle + Math.PI), 1, 1e-9);                                    // hit from the left: lies with the head to the right
  eq(G.enemies.hurt(e, 5, 500, 700, WP.club).dealt, 0);                         // the dying cannot be hurt again
  const c = { area: arena(), world, player: thePlayer(rig(100, 100)), noise: 0 };
  for (let i = 0; i < 60; i++) G.enemies.step(e, c, 1 / 60);
  eq(e.state, 'dead'); eq(e.fall, 1);
  const light = mkEnemy('runner', 600, 700), heavy = mkEnemy('shambler', 600, 700);
  G.enemies.hurt(light, 1, 500, 700, WP.club); G.enemies.hurt(heavy, 1, 500, 700, WP.club);
  if (!(light.stun > heavy.stun && light.kvx > heavy.kvx)) throw new Error('the light one should fly and stagger more');
});

test('senses: unaware at a distance, notices in sight, a wall hides the player, noise draws it in', () => {
  const A = arena(), c = (area, pl, noise) => ({ area, world, player: thePlayer(pl), noise: noise || 0 });
  const p = rig(300, 700), e = mkEnemy('shambler', 1200, 700);
  stepFor(e, c(A, p), 2);
  if (e.state === 'chase') throw new Error('noticed from 900px');
  const near1 = mkEnemy('shambler', 500, 700);
  stepFor(near1, c(A, p), 1);
  eq(near1.state, 'chase');
  const walled = arena([{ x: 380, y: 0, w: 30, h: 1500, kind: 'iwall' }]), hidden = mkEnemy('shambler', 500, 700);
  stepFor(hidden, c(walled, p), 1);
  if (hidden.state === 'chase') throw new Error('saw through a wall');
  const heard = mkEnemy('shambler', 700, 700);
  stepFor(heard, c(walled, p, 600), 0.6);
  eq(heard.state, 'investigate');
  const still = mkEnemy('shambler', 700, 700);
  stepFor(still, c(walled, p, 100), 0.6);                       // too quiet for 400px
  if (still.state === 'investigate') throw new Error('heard a whisper');
});

test('a shambler walks to the player, winds up, and the blow lands (with the player standing still)', () => {
  const A = arena(), p = rig(300, 700), e = mkEnemy('shambler', 560, 700), c = { area: A, world, player: thePlayer(p), noise: 0 };
  const hit = stepFor(e, c, 12);
  eq(hit > 0, true);
  eq(hit % EN.types.shambler.dmg, 0);
  if (dist2(e, p) > 80) throw new Error('did not close in: ' + dist2(e, p));
});
function dist2(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

test('stepping away during the wind-up dodges the blow', () => {
  const A = arena(), p = rig(300, 700), e = mkEnemy('shambler', 345, 700), d = EN.types.shambler;
  const c = { area: A, world, player: thePlayer(p), noise: 0 };
  let t = 0, hit = 0;
  while (e.state !== 'windup' && t < 3) { hit += G.enemies.step(e, c, 1 / 60).hit; t += 1 / 60; }
  eq(e.state, 'windup'); eq(hit, 0);
  p.x = 60; c.player = thePlayer(p);                            // the player is well out of reach before it lands
  for (let i = 0; i < d.attackTime * 60 + 5; i++) hit += G.enemies.step(e, c, 1 / 60).hit;
  eq(hit, 0);
});

test('a runner is faster than a walking player and slower than a running one', () => {
  const A = arena(), r = mkEnemy('runner', 900, 700), c = { area: A, world, player: thePlayer(rig(100, 700)), noise: 0 };
  r.state = 'chase'; r.goal = { x: 100, y: 700 }; r.sees = true;
  const x0 = r.x; stepFor(r, c, 1);
  const moved = x0 - r.x;
  if (!(moved > pc.walkSpeed && moved < pc.walkSpeed * pc.runMult)) throw new Error('moved ' + moved + ' px in a second');
});

test('a hit enemy staggers, then comes back at the player', () => {
  const A = arena(), p = rig(300, 700), e = mkEnemy('shambler', 400, 700), c = { area: A, world, player: thePlayer(p), noise: 0 };
  G.enemies.hurt(e, 5, 300, 700, WP.axe);
  eq(e.state, 'stagger');
  stepFor(e, c, 1);
  eq(e.state === 'chase' || e.state === 'windup', true);
});

test('a dead player is left alone', () => {
  const A = arena(), p = rig(300, 700), e = mkEnemy('shambler', 360, 700), c = { area: A, world, player: thePlayer(p, false), noise: 0 };
  e.state = 'chase'; e.goal = { x: 300, y: 700 };
  eq(stepFor(e, c, 3), 0);
});

test('bodies keep apart: enemies do not stand inside each other or the player', () => {
  const p = rig(500, 500), a = mkEnemy('shambler', 500, 505), b = mkEnemy('shambler', 503, 500);
  G.enemies.separate([a, b], thePlayer(p), arena());
  if (dist2(a, b) < 20) throw new Error('overlap ' + dist2(a, b));
  if (dist2(a, p) < a.radius + p.radius * 0.7 - 1) throw new Error('inside the player');
});

test('spawning: seeded per visit, away from the arrival point, on free ground, more at higher risk', () => {
  const A1 = G.area.generate(G.data.areas.forest, RES, 1), A2 = G.area.generate(G.data.areas.forest, RES, 2);
  const av = { x: A1.spawn.x, y: A1.spawn.y, r: EN.avoidSpawn };
  const l1 = G.enemies.spawnFor(A1, 1, 1, av), l1b = G.enemies.spawnFor(A1, 1, 1, av), l2 = G.enemies.spawnFor(A2, 1, 2, av);
  eq(JSON.stringify(l1.map(e => [e.type, e.x, e.y])), JSON.stringify(l1b.map(e => [e.type, e.x, e.y])));
  eq(JSON.stringify(l1.map(e => [e.x, e.y])) === JSON.stringify(l2.map(e => [e.x, e.y])), false);
  if (!(l1.length >= 1 && l1.length <= 4)) throw new Error('forest count ' + l1.length);
  l1.forEach(e => {
    if (dist2(e, A1.spawn) < EN.avoidSpawn) throw new Error('too near the arrival');
    if (G.area.inWater(A1, e.x, e.y, 0) || G.area.inSolid(A1, e.x, e.y, 0)) throw new Error('in water / a wall');
  });
  const P = G.area.generate(G.data.areas.port, RES, 1), air = G.area.generate(G.data.areas.airport, RES, 1);
  let lo = 0, hi = 0;
  for (let v = 1; v <= 6; v++) { lo += G.enemies.spawnFor(A1, 1, v, null).length; hi += G.enemies.spawnFor(air, 5, v, null).length; }
  if (!(hi > lo * 2)) throw new Error('risk 5 should be much busier: ' + lo + ' vs ' + hi);
  const inside = G.area.generate(G.data.areas.police_f1, RES, 1);
  let out = 0, inn = 0;
  for (let v = 1; v <= 8; v++) { out += G.enemies.spawnFor(G.area.generate(G.data.areas.police, RES, v), 3, v, null).length; inn += G.enemies.spawnFor(G.area.generate(G.data.areas.police_f1, RES, v), 3, v, null).length; }
  if (!(inn < out)) throw new Error('a floor should be calmer than the street: ' + inn + ' vs ' + out);
  void P; void inside;
});

test('spawning: every outdoor and indoor area gets valid, free spots', () => {
  let n = 0;
  for (const id in G.data.areas) {
    const def = G.data.areas[id];
    if (!def.spawns) continue;                                   // the base has no destination terrain
    const A = G.area.generate(def, RES, 1);
    const list = G.enemies.spawnFor(A, 5, 1, { x: A.spawn.x, y: A.spawn.y, r: 300 });
    list.forEach(e => {
      n++;
      if (!(e.x > 0 && e.x < A.width && e.y > 0 && e.y < A.height)) throw new Error(id + ' outside');
      if (G.area.inWater(A, e.x, e.y, 0) || G.area.inSolid(A, e.x, e.y, 0)) throw new Error(id + ': inside something');
      if (A.footprint && !(e.x > A.footprint.x && e.x < A.footprint.x + A.footprint.w && e.y > A.footprint.y && e.y < A.footprint.y + A.footprint.h)) throw new Error(id + ': outside the building');
    });
  }
  if (n < 100) throw new Error('only ' + n + ' enemies in the whole world');
});

test('noise: standing is silent, running is louder than walking, a burst lasts a moment', () => {
  const p = rig(0, 0), b = G.combat.newBurst();
  eq(G.combat.noiseRadius(p, b), 0);
  p.moving = true; const walk = G.combat.noiseRadius(p, b);
  p.running = true; const run = G.combat.noiseRadius(p, b);
  if (!(walk > 0 && run > walk)) throw new Error(walk + ' ' + run);
  p.moving = p.running = false;
  G.combat.addBurst(b, WP.gun.noise);
  eq(G.combat.noiseRadius(p, b), WP.gun.noise);
  G.combat.stepBurst(b, 0.3); eq(G.combat.noiseRadius(p, b), WP.gun.noise);
  G.combat.stepBurst(b, 1); eq(G.combat.noiseRadius(p, b), 0);
});

test('death: the held weapon is kept unless the difficulty takes it, the rest of the bag goes', () => {
  const L = G.data.difficulty.levels, mk = () => bagWith([['axe', 1], ['club', 1], ['pistol', 1], ['ammo', 10], ['wood', 5]]);
  let bag = mk(); G.combat.deathLoss(bag, L.normal, 'gun');
  eq(G.inventory.count(bag, 'pistol'), 1); eq(G.inventory.count(bag, 'ammo'), 0); eq(G.inventory.count(bag, 'axe'), 0); eq(G.inventory.count(bag, 'wood'), 0);
  bag = mk(); G.combat.deathLoss(bag, L.hard, 'gun');
  eq(G.inventory.count(bag, 'pistol'), 0);
  bag = mk(); G.combat.deathLoss(bag, L.normal, 'hands');
  eq(G.inventory.usedSlots(bag), 0);
  bag = mk(); const lost = G.combat.deathLoss(bag, L.easy, 'club');
  eq(G.inventory.count(bag, 'club'), 1); if (!lost.length) throw new Error('easy lost nothing');
});

test('holding: hands always, others only with the item in the backpack; gun ammo counts', () => {
  const bag = bagWith([['axe', 1]]);
  eq(G.combat.canHold(bag, 'hands'), true); eq(G.combat.canHold(bag, 'axe'), true);
  eq(G.combat.canHold(bag, 'gun'), false); eq(G.combat.canHold(bag, 'nope'), false);
  G.inventory.add(bag, 'pistol', 1);
  eq(G.combat.canHold(bag, 'gun'), true);
});

test('needs: an exhausted body hits weaker, swings and shots cost energy (scaled by difficulty)', () => {
  const n = G.needs.create(), L = G.data.difficulty.levels;
  eq(G.needs.attackMult(n), 1);
  G.needs.spend(n, 2, L.hard); near(n.energy, 100 - 2 * L.hard.energy);
  n.energy = 5; if (!(G.needs.attackMult(n) < 1)) throw new Error('exhausted should hit weaker');
  G.needs.spend(n, 50, L.normal); eq(n.energy, 0);
});

test('damage to the player is scaled by the difficulty (the same blow hurts more on hard)', () => {
  const L = G.data.difficulty.levels, a = G.needs.create(), b = G.needs.create(), c2 = G.needs.create();
  G.needs.hurt(a, EN.types.shambler.dmg, L.easy); G.needs.hurt(b, EN.types.shambler.dmg, L.normal); G.needs.hurt(c2, EN.types.shambler.dmg, L.hard);
  if (!(a.health > b.health && b.health > c2.health)) throw new Error([a.health, b.health, c2.health].join(' '));
});

test('a whole fight: a shambler reaches a standing player, the player kills it with the club in a few blows', () => {
  const A = arena(), p = rig(300, 700, 0), e = mkEnemy('shambler', 360, 700), d = EN.types.shambler;
  e.state = 'chase'; e.goal = { x: 300, y: 700 }; e.sees = true;
  const c = { area: A, world, player: thePlayer(p), noise: 0 };
  G.player.setHeld(p, 'club');
  let blows = 0, t = 0;
  while (e.state !== 'dying' && e.state !== 'dead' && t < 20) {
    if (p.swing < 0 && t > 0.1 * blows) { G.player.swing(p); blows++; }
    G.player.animate(p, 1 / 60, null);
    if (G.player.swingHit(p, WP.club.hitU)) G.combat.meleeTargets(A, p, WP.club, [e]).forEach(x => G.enemies.hurt(x, WP.club.dmg, p.x, p.y, WP.club));
    G.enemies.step(e, c, 1 / 60);
    t += 1 / 60;
  }
  eq(e.state === 'dying' || e.state === 'dead', true);
  if (!(blows >= 3 && blows <= 6)) throw new Error('blows ' + blows);
  void d;
});

console.log('pistol: magazine, wear, aim tolerance');
test('gun: a shot slightly off still hits, more so up close than far, and a really wide one misses', () => {
  const p = rig(500, 700, 0), w = WP.gun, e = mkEnemy('shambler', 800, 700);          // 300 px away
  const at = (off) => { const q = mkEnemy('shambler', 800, 700 + off); return G.combat.shoot(arena(), p, w, [q], 0).enemy === q; };
  eq(at(0), true); eq(at(24), true);                                                   // the body radius is 15: 24 px off used to miss
  eq(at(30), true); eq(at(60), false);
  const bare = Object.assign({}, w, { aim: undefined });                               // the old, exact aim
  const q = mkEnemy('shambler', 800, 726);
  eq(G.combat.shoot(arena(), p, bare, [q], 0).enemy, null);
  const r = G.combat.shoot(arena(), p, w, [e], 0);
  if (!(r.dist > 270 && r.dist < 310)) throw new Error('the tracer should end near the body: ' + r.dist);
});
test('gun: the magazine holds a few rounds, a reload takes them from the backpack, an empty click does nothing', () => {
  const w = WP.gun, g = G.combat.newGun(w, () => 0.5, false), bag = G.inventory.create(6);
  eq(g.mag, 0); eq(G.combat.gunFire(g), 'empty'); eq(g.shots, 0);
  G.inventory.add(bag, 'ammo', 20, ITEMS);
  eq(G.combat.gunRoom(g, w, bag), w.mag);
  eq(G.combat.gunLoad(g, w, bag), w.mag); eq(g.mag, w.mag); eq(G.inventory.count(bag, 'ammo'), 20 - w.mag);
  eq(G.combat.gunFire(g), 'ok'); eq(g.mag, w.mag - 1); eq(g.shots, 1);
  eq(G.combat.gunLoad(g, w, bag), 1); eq(g.mag, w.mag);                                // tops up only what is missing
  eq(G.combat.gunLoad(g, w, bag), 0);                                                  // full: nothing moves
  const few = G.inventory.create(2); G.inventory.add(few, 'ammo', 3, ITEMS); const h = G.combat.newGun(w, () => 0.5, false);
  eq(G.combat.gunLoad(h, w, few), 3); eq(h.mag, 3);                                    // fewer rounds than room: takes what there is
});
test('gun: wears out after roughly a hundred and fifty shots, breaks on the last one, gives the loaded rounds back', () => {
  const w = WP.gun, bag = G.inventory.create(6);
  const lo = G.combat.newGun(w, () => 0, true), hi = G.combat.newGun(w, () => 1, true);
  if (!(lo.life >= 100 && lo.life < 120 && hi.life > 180 && hi.life <= 200)) throw new Error(lo.life + ' ' + hi.life);
  const g = G.combat.newGun(w, () => 0.5, true); eq(g.life, w.life);
  let n = 0, res = 'ok';
  while (res !== 'broke' && n < 1000) { if (g.mag <= 0) g.mag = w.mag; res = G.combat.gunFire(g); n++; }
  eq(n, w.life); eq(res, 'broke');
  g.mag = 5; eq(G.combat.gunBreak(g, w, bag), 5); eq(G.inventory.count(bag, 'ammo'), 5);
  const sp = (k) => { const x = G.combat.newGun(w, () => 0.5, true); x.shots = Math.floor(x.life * k); return G.combat.gunSpread(x, w); };
  if (!(sp(0) < sp(0.5) && sp(0.5) < sp(0.9))) throw new Error('a worn pistol should be less accurate');
  near(sp(0), w.spread); near(G.combat.gunCondition({ mag: 0, shots: 30, life: 120 }), 0.75);
});
test('saving: the pistol state survives a round trip, and a broken or odd one is cleaned', () => {
  const st = mkState();
  st.guns = { gun: { mag: 3, shots: 40, life: 150 }, ak: { mag: 30, shots: 7, life: 500 } };
  const back = G.save.parse(JSON.stringify(G.save.snapshot(st, 1)));
  eq(back.ok, true); eq(back.data.guns.gun.mag, 3); eq(back.data.guns.gun.shots, 40); eq(back.data.guns.gun.life, 150);
  eq(back.data.guns.ak.mag, 30); eq(back.data.guns.uzi, undefined);
  st.guns = {}; eq(Object.keys(G.save.parse(JSON.stringify(G.save.snapshot(st, 1))).data.guns).length, 0);
  const old = Object.assign(G.save.snapshot(mkState(), 1), { gun: { mag: 2, shots: 9, life: 120 } });   // a save from before there were several guns
  eq(G.save.parse(JSON.stringify(old)).data.guns.gun.shots, 9);
  const w = WP.gun;
  eq(G.combat.gunClean({ mag: 99, shots: 9999, life: 150 }, w).mag, w.mag);
  eq(G.combat.gunClean({ mag: 99, shots: 9999, life: 150 }, w).shots, 149);
  eq(G.combat.gunClean({ mag: 'x', shots: 1, life: 150 }, w), null);
  eq(G.combat.gunClean('junk', w), null);
});

console.log('more guns and crafting categories');
test('guns: Uzi, M16, Kalashnikov and sniper are complete, with ammo that exists and a recipe that makes them', () => {
  const guns = Object.keys(WP).filter(k => WP[k].kind === 'gun');
  eq(guns.length, 5);
  for (const id of guns) {
    const w = WP[id];
    for (const f of ['dmg', 'range', 'cooldown', 'spread', 'mag', 'reload', 'life', 'noise', 'height']) if (!(w[f] > 0)) throw new Error(id + '.' + f);
    if (!ITEMS[w.item] || !ITEMS[w.ammo]) throw new Error(id + ': item or ammo');
    if (!G.data.recipes.some(r => r.out[0] === w.item)) throw new Error(id + ': nothing crafts it');
    if (!G.data.weaponOrder.includes(id)) throw new Error(id + ' is not in the cycle order');
  }
  for (const k in G.data.weaponKeys) if (!G.data.weaponOrder.includes(G.data.weaponKeys[k])) throw new Error(k);
  if (!(WP.uzi.cooldown < WP.gun.cooldown && WP.uzi.dmg < WP.gun.dmg)) throw new Error('uzi: fast and weak');
  if (!(WP.sniper.dmg >= EN.types.shambler.hp && WP.sniper.cooldown > WP.gun.cooldown && WP.sniper.range > WP.m16.range)) throw new Error('sniper: one shot, slow, far');
  eq(WP.sniper.auto, false);
});
test('crafting: every recipe has a real category, the first tab shows everything, the guns and ammo are in their own tabs', () => {
  const ids = G.data.recipeCats.map(c => c.id);
  eq(ids[0], 'all');
  for (const r of G.data.recipes) if (r.cat === 'all' || !ids.includes(r.cat)) throw new Error(r.id + ': bad category ' + r.cat);
  const wb = G.crafting.recipesFor('workbench');
  eq(G.crafting.recipesFor('workbench', 'all').length, wb.length);
  const names = (cat) => G.crafting.recipesFor('workbench', cat).map(r => r.out[0]);
  for (const g of ['pistol', 'uzi', 'm16', 'ak47', 'sniper', 'club']) if (!names('weapons').includes(g)) throw new Error(g + ' not under weapons');
  eq(names('ammo').sort().join(), ['ammo', 'ammo_556', 'ammo_762'].sort().join());
  if (names('weapons').some(n => !(ITEMS[n].weapon))) throw new Error('a non-weapon under weapons');
  eq(G.crafting.recipesFor('campfire', 'food').length, G.crafting.recipesFor('campfire').length);
  eq(G.crafting.recipesFor('campfire', 'weapons').length, 0);
});
test('crafting a gun and its ammo takes materials from the backpack then the chest', () => {
  const ctx = { bag: G.inventory.create(12), chest: G.inventory.fromList(24, G.data.inventory.start.chest, ITEMS), buildings: { workbench: 2 } };
  eq(G.crafting.craft(ctx, 'ak47').ok, true); eq(G.inventory.count(ctx.bag, 'ak47'), 1);
  eq(G.crafting.craft(ctx, 'ammo_762').ok, true); eq(G.inventory.count(ctx.bag, 'ammo_762'), 6);
  eq(G.crafting.craft(ctx, 'sniper').ok, true); eq(G.crafting.craft(ctx, 'm16').ok, true); eq(G.crafting.craft(ctx, 'uzi').ok, true);
  ctx.buildings.workbench = 1; eq(G.crafting.craft(ctx, 'uzi').reason, 'level');
});
test('sniper: one bullet goes through two enemies in a line (the second is hit softer, by the game), and stops at a wall', () => {
  const p = rig(300, 700, 0), w = WP.sniper;
  const a = mkEnemy('shambler', 700, 700), b = mkEnemy('shambler', 900, 700), c3 = mkEnemy('shambler', 1100, 700);
  let r = G.combat.shoot(arena(), p, w, [c3, b, a], 0);
  eq(r.hits.length, 2); eq(r.hits[0].enemy, a); eq(r.hits[1].enemy, b); eq(r.enemy, a);
  if (!(r.dist > 560 && r.dist < 620)) throw new Error('the bullet should stop at the second one: ' + r.dist);
  r = G.combat.shoot(arena([{ x: 800, y: 600, w: 20, h: 200, kind: 'iwall' }]), p, w, [a, b], 0);
  eq(r.hits.length, 1); eq(r.hits[0].enemy, a);                                       // the wall is between the two
  r = G.combat.shoot(arena(), p, WP.gun, [a, b], 0);
  eq(r.hits.length, 1);                                                                // a pistol bullet stops in the first
  r = G.combat.shoot(arena(), p, w, [mkEnemy('shambler', 1790, 700)], 0);              // a really long shot
  eq(r.hits.length, 1);
});
test('every gun has its own magazine and wear (a pistol shot does not use up the rifle)', () => {
  const g1 = G.combat.newGun(WP.gun, () => 0.5, true), g2 = G.combat.newGun(WP.m16, () => 0.5, true);
  eq(g1.mag, 8); eq(g2.mag, 30); G.combat.gunFire(g1); eq(g2.mag, 30); eq(g2.shots, 0);
  eq(g2.life, WP.m16.life);
});

// Extra test files: every tests/extra/*.js is run with these helpers in scope (so parallel work never edits this file).
const extraDir = path.join(__dirname, 'extra');
if (fs.existsSync(extraDir)) {
  for (const f of fs.readdirSync(extraDir).sort()) {
    if (!f.endsWith('.js')) continue;
    console.log('extra: ' + f);
    try {
      new Function('G', 'test', 'eq', 'near', 'arena', 'rig', 'mkEnemy', 'thePlayer', 'stepFor', 'EN', 'WP', 'ITEMS', 'world', 'pc', 'mkState',
        fs.readFileSync(path.join(extraDir, f), 'utf8'))(G, test, eq, near, arena, rig, mkEnemy, thePlayer, stepFor, EN, WP, ITEMS, world, pc, mkState);
    } catch (e) { failed++; console.log('  FAIL ' + f + ' did not load\n       ' + e.message); }
  }
}

console.log('backpack: stacks of 50 and the upgradable bag');
test('stacks: everything that stacks holds 50, tools and weapons are single', () => {
  for (const [id, it] of Object.entries(ITEMS)) {
    if (it.tool || (G.data.weapons[id] && G.data.weapons[id].kind !== 'ammo' && !it.ammo)) { if (it.stack > 1 && ['axe', 'pickaxe', 'club', 'pistol'].includes(id)) throw new Error(id + ' stacks'); }
  }
  for (const id of ['wood', 'stone', 'plank', 'mushroom', 'water_clean']) eq(ITEMS[id].stack, 50, id + ' stack: ');
  for (const id of ['axe', 'pickaxe', 'club', 'pistol']) eq(ITEMS[id].stack, 1, id + ' stack: ');
  const inv = G.inventory.create(2);
  eq(G.inventory.add(inv, 'wood', 50), 0); eq(G.inventory.usedSlots(inv), 1); eq(G.inventory.add(inv, 'wood', 51), 1);
});
test('bag: sizes per level are 12 / 18 / 24 / 32 and never below the starting size', () => {
  const sizes = [1, 2, 3, 4].map(l => G.crafting.bagSlots({ bag: l }));
  eq(sizes.join(','), '12,18,24,32');
  eq(G.crafting.bagSlots({}), G.data.inventory.bagSlots); eq(G.crafting.bagSlots({ bag: 99 }), 32);
});
test('bag: upgrade costs are taken, each level grows the bag, the top is reached', () => {
  const ctx = mkctx([['cloth', 30], ['wood', 30], ['plank', 30], ['nails', 30]], []);
  ctx.buildings = G.crafting.startBuildings();
  eq(ctx.buildings.bag, 1);
  for (let lv = 2; lv <= 4; lv++) {
    eq(G.crafting.build(ctx, 'bag').ok, true); eq(ctx.buildings.bag, lv);
    G.inventory.resize(ctx.bag, G.crafting.bagSlots(ctx.buildings));
    eq(ctx.bag.slots.length, [0, 12, 18, 24, 32][lv]);
  }
  eq(G.crafting.build(ctx, 'bag').reason, 'max');
  const poor = mkctx([['cloth', 1]], []); poor.buildings = G.crafting.startBuildings();
  eq(G.crafting.build(poor, 'bag').reason, 'cost');
});
test('bag: a saved game with a bigger bag keeps its slots and items', () => {
  const st = { diff: G.data.difficulty.default, playTime: 5, needs: { health: 80, hunger: 60, thirst: 60, energy: 60 }, buildings: G.crafting.startBuildings(), tank: { amount: 0, t: 0 }, visits: {}, guns: {}, area: 'base', player: { x: 10, y: 10 } };
  st.buildings.bag = 3;
  st.bag = G.inventory.fromList(G.crafting.bagSlots(st.buildings), [['wood', 50], ['stone', 50]]);
  st.chest = G.inventory.create(24);
  const back = G.save.parse(JSON.stringify(G.save.snapshot(st, 1)));
  eq(back.ok, true); eq(back.data.buildings.bag, 3); eq(back.data.bag.slots.length, 24);
  eq(G.inventory.count(back.data.bag, 'wood'), 50); eq(G.inventory.count(back.data.bag, 'stone'), 50);
});

console.log('workbench levels and the drying rack');
test('workbench: 3 levels, each more expensive, made of forest items only', () => {
  const lv = BLD.workbench.levels;
  eq(lv.length, 4);
  const sum = (c) => Object.values(c.cost).reduce((a, b) => a + b, 0);
  if (!(sum(lv[0]) < sum(lv[1]) && sum(lv[1]) < sum(lv[2]) && sum(lv[2]) < sum(lv[3]))) throw new Error('costs do not grow');
  const forest = new Set(['wood', 'stone', 'plank']);
  for (const l of lv.slice(0, 3)) for (const it of Object.keys(l.cost)) if (!forest.has(it)) throw new Error('workbench cost ' + it);
});
test('workbench: the whole line 1 -> 2 -> 3 can be built from forest materials, then the top is reached', () => {
  const c = mkctx([['wood', 50], ['stone', 30], ['plank', 14]], [], {});
  for (let l = 1; l <= 3; l++) { eq(G.crafting.build(c, 'workbench').level, l); }
  eq(G.crafting.build(c, 'workbench').reason, 'cost');                // the 4th level needs nails and metal
  eq(total(c, 'wood'), 50 - 6 - 8 - 14); eq(total(c, 'plank'), 0);
});
test('workbench: level 3 recipes are locked until the third level', () => {
  const l3 = RECIPES.filter(r => r.station === 'workbench' && r.level === 3);
  if (l3.length < 3) throw new Error('level 3 should unlock several recipes');
  const c = mkctx([['wood', 20], ['metal', 6], ['cloth', 3], ['electronics', 2]], [], { workbench: 2 });
  eq(G.crafting.craft(c, 'plank_bulk').reason, 'level');
  c.buildings.workbench = 3;
  eq(G.crafting.craft(c, 'plank_bulk').ok, true); eq(total(c, 'plank'), 10); eq(total(c, 'wood'), 14);
  eq(G.crafting.craft(c, 'nails_bulk').ok, true); eq(total(c, 'nails'), 18);
  eq(G.crafting.craft(c, 'lantern').ok, true); eq(total(c, 'lantern'), 1);
});
test('workbench: rope, first-aid kit, torch and crate can all be made along the way', () => {
  let c = mkctx([['cloth', 10], ['bandage', 4], ['water_clean', 1], ['wood', 4]], [], { workbench: 1 });
  eq(G.crafting.craft(c, 'rope').ok, true); eq(total(c, 'rope'), 1);
  eq(G.crafting.craft(c, 'firstaid').reason, 'level');
  c.buildings.workbench = 2;
  eq(G.crafting.craft(c, 'firstaid').ok, true); eq(total(c, 'firstaid'), 1); eq(total(c, 'bandage'), 2);
  eq(G.crafting.craft(c, 'torch').ok, true); eq(total(c, 'torch'), 1);
  c = mkctx([['plank', 6], ['nails', 4], ['rope', 1]], [], { workbench: 3 });
  eq(G.crafting.craft(c, 'crate').ok, true); eq(total(c, 'crate'), 1); eq(total(c, 'rope'), 0);
});
test('workbench: the first-aid kit heals more than a bandage', () => {
  if (!(ITEMS.firstaid.use.health > ITEMS.bandage.use.health)) throw new Error('first-aid is not better');
});
test('rack: a built station with 4 levels and a free spot in the yard, listed in the build order', () => {
  if (!G.data.buildingOrder.includes('rack')) throw new Error('rack is not in buildingOrder');
  eq(BLD.rack.station, true); eq(BLD.rack.levels.length, 4); eq(BLD.rack.start, 0);
  const s = BLD.rack.spot, a = G.base.layout.area;
  if (!(s.x > a.x + 30 && s.x + s.w < a.x + a.w - 30 && s.y > a.y + 30 && s.y + s.h < a.y + a.h - 30)) throw new Error('rack outside the yard');
  eq(G.crafting.startBuildings().rack, 0);
});
test('rack: becomes solid and usable with E only once built, and can be walked up to', () => {
  const b = G.base.build(), s = BLD.rack.spot, p = G.player.create(s.x + s.w / 2, s.y + s.h + 24);
  eq(G.base.nearStation(p, b), null);
  G.base.setBuildings(b, Object.assign(G.crafting.startBuildings(), { rack: 1 }));
  eq(b.solids.filter(r => r.kind === 'rack').length, 1);
  eq(G.base.nearStation(p, b), 'rack');
  const q = G.player.create(s.x + s.w / 2, s.y + s.h / 2); G.base.collide(q, b.solids);
  if (q.x > s.x && q.x < s.x + s.w && q.y > s.y && q.y < s.y + s.h) throw new Error('inside the rack');
});
test('rack: drying recipes exist, need the rack, and make food that is safer and fuller than raw', () => {
  const rr = G.crafting.recipesFor('rack');
  if (rr.length < 2) throw new Error('too few drying recipes');
  let c = mkctx([['mushroom', 6]], [], {});
  eq(G.crafting.craft(c, 'dried_mushroom').reason, 'station');
  c.buildings.rack = 1;
  eq(G.crafting.craft(c, 'dried_mushroom').ok, true); eq(total(c, 'dried_mushroom'), 2); eq(total(c, 'mushroom'), 3);
  eq(G.crafting.craft(c, 'ration').reason, 'level');
  const raw = ITEMS.mushroom.use, dry = ITEMS.dried_mushroom.use;
  if (!(dry.hunger > raw.hunger && !(dry.health < 0))) throw new Error('dried mushrooms are not better');
  c = mkctx([['dried_mushroom', 3], ['cooked_food', 1]], [], { rack: 2 });
  eq(G.crafting.craft(c, 'ration').ok, true); eq(total(c, 'ration'), 2); eq(total(c, 'dried_mushroom'), 0);
  if (!(ITEMS.ration.use.hunger > ITEMS.cooked_food.use.hunger)) throw new Error('a ration should fill more than cooked food');
});
test('rack and workbench: every new item has a name, a stack (50, tools 1) and a drawn icon; recipes only use known items', () => {
  const iconSrc = fs.readFileSync(path.join(ROOT, 'js', 'icons.js'), 'utf8');
  for (const id of ['rope', 'crate', 'firstaid', 'torch', 'lantern', 'dried_mushroom', 'ration']) {
    const it = ITEMS[id];
    if (!it || !it.name) throw new Error(id + ' missing');
    eq(it.stack, it.kind === 'tool' ? 1 : 50, id + ' stack: ');
    if (!new RegExp('\\b' + id + ':\\s*function').test(iconSrc)) throw new Error(id + ' has no icon');
  }
  for (const r of RECIPES) if (r.station === 'rack' && r.cat !== 'food') throw new Error(r.id + ' should be a food recipe');
});

console.log('big base, three upgrades, fence materials, floor');
test('yard is four times the first one, holds the cabin, chest, woodpile and every building spot', () => {
  const a = G.base.layout.area, L = G.base.layout;
  if (a.w * a.h < 4 * 800 * 520) throw new Error('yard too small');
  for (const r of [L.cabin, L.chest, L.woodpile]) if (r.x < a.x || r.y < a.y || r.x + r.w > a.x + a.w || r.y + r.h > a.y + a.h) throw new Error('outside the yard');
  for (const id of G.data.buildingOrder) { const sp = BLD[id].spot; if (sp && (sp.x < a.x || sp.y < a.y || sp.x + sp.w > a.x + a.w || sp.y + sp.h > a.y + a.h)) throw new Error(id + ' outside'); }
  if (!(L.gate.x > a.x && L.gate.x + L.gate.w < a.x + a.w)) throw new Error('gate is not on the north fence');
  if (!(L.trail.y < a.y && L.arrive.y < a.y)) throw new Error('trailhead must be north of the fence');
});
test('every structure has three upgrades after it is built', () => {
  for (const id of ['workbench', 'rack', 'campfire', 'bed', 'tank', 'chest', 'fence']) if (BLD[id].levels.length < 4) throw new Error(id + ' has ' + BLD[id].levels.length + ' levels');
  eq(G.crafting.chestSlots({ chest: 4 }), 60);
});
test('fence material: the cost follows the chosen material, an unknown one falls back to wood in a save', () => {
  const b = G.crafting.startBuildings(), cWood = { bag: G.inventory.create(4), chest: G.inventory.create(4), buildings: b, fence: { material: 'wood' } };
  eq(G.crafting.buildCost(cWood, 'fence').plank, 10);
  const cSt = Object.assign({}, cWood, { fence: { material: 'stone' } }), st = G.crafting.buildCost(cSt, 'fence');
  eq(st.plank, undefined); eq(st.stone, 20);
  const cMe = Object.assign({}, cWood, { fence: { material: 'metal' } }), me = G.crafting.buildCost(cMe, 'fence');
  eq(me.metal, 10);
  eq(G.save.parse(JSON.stringify({ v: 1, fence: { material: 'gold' } })).data.fence.material, 'wood');
  eq(G.save.parse(JSON.stringify({ v: 1, fence: { material: 'metal' } })).data.fence.material, 'metal');
});
test('placing: a structure goes anywhere free in the yard, as many as wanted, and the first copy sets the level', () => {
  const P = G.placing, a = G.base.layout.area;
  const base = G.base.build(), levels = G.crafting.startBuildings(), placed = [];
  const r1 = P.rectAt('tank', a.x + 200, a.y + 700);               // far from the old spots, in the new part of the yard
  eq(P.check(base, r1), null);
  const ctx = mkctx([['wood', 30], ['plank', 30], ['stone', 30]], [], levels); ctx.placed = placed; ctx.buildings = levels;
  eq(G.crafting.place(ctx, 'tank').ok, true); eq(levels.tank, 1); placed.push({ id: 'tank', x: r1.x, y: r1.y });
  G.base.setBuildings(base, levels, placed);
  eq(base.solids.filter(s => s.kind === 'tank').length, 1);
  eq(P.check(base, r1), 'blocked');                                  // the same place is taken now
  const r2 = P.rectAt('tank', a.x + 500, a.y + 700);
  eq(G.crafting.place(ctx, 'tank').ok, true); placed.push({ id: 'tank', x: r2.x, y: r2.y });
  G.base.setBuildings(base, levels, placed);
  eq(base.solids.filter(s => s.kind === 'tank').length, 2); eq(levels.tank, 1);
  const gate = P.rectAt('bed', G.base.layout.gate.x + 40, a.y + 60);
  eq(P.check(base, gate), 'gate');
  const inside = P.rectAt('bed', a.x, a.y);                         // clamped inside the fence
  if (inside.x <= a.x + 12 || inside.y <= a.y + 12) throw new Error('not clamped inside the fence');
  eq(P.indexAt(placed, 'tank', r1.x + 5, r1.y + 5), 0);
  eq(G.base.nearStation({ x: r2.x + 20, y: r2.y + 60, radius: 18 }, base), 'tank');
});
test('placing: a built structure is saved where it stands, old saves get the old spots, bad entries are dropped', () => {
  const levels = G.crafting.startBuildings(); levels.campfire = 2; levels.bed = 1;
  const a = G.base.layout.area;
  const clean = G.placing.clean([{ id: 'campfire', x: a.x + 100, y: a.y + 300 }, { id: 'nope', x: 1, y: 1 }, { id: 'bed', x: 'x', y: 1 }, { id: 'tank', x: a.x + 100, y: a.y + 400 }], levels);
  eq(clean.length, 1); eq(clean[0].id, 'campfire');             // the tank is not built (level 0), the rest is junk
  const legacy = G.placing.clean(undefined, levels);
  eq(legacy.length, 2); eq(legacy.map(p => p.id).sort().join(), 'bed,campfire');
});
test('floor blocks: cost per block, only inside the yard, saved and cleaned', () => {
  const P = G.placing, a = G.base.layout.area, f = P.createFloor();
  eq(P.cellAt(a.x - 5, a.y - 5), null);
  const c = P.cellAt(a.x + 300, a.y + 300), g = P.grid();
  eq(c.w, P.CELL); eq((c.x - g.x0) % P.CELL, 0);
  if (P.CELL < 100) throw new Error('floor blocks should be big');
  if (g.x0 < a.x || g.x0 + g.cols * P.CELL > a.x + a.w) throw new Error('grid sticks out of the yard');
  const ctx = mkctx([['plank', G.data.floorMaterials.wood.cost.plank]], [], G.crafting.startBuildings());
  eq(G.crafting.spend(ctx, G.data.floorMaterials.wood.cost), null); f.cells[c.key] = 'wood';
  eq(G.crafting.spend(ctx, G.data.floorMaterials.wood.cost), 'cost');        // no more planks
  G.crafting.refund(ctx, G.data.floorMaterials.wood.cost); eq(total(ctx, 'plank'), G.data.floorMaterials.wood.cost.plank);
  const dirty = P.cleanFloor({ cell: P.CELL, cells: { [c.key]: 'wood', 'x,y': 'wood', '99,99': 'tile', '1,1': 'gold' } });
  eq(Object.keys(dirty.cells).join(), c.key);
  eq(Object.keys(P.cleanFloor({ cell: 40, cells: { [c.key]: 'wood' } }).cells).length, 0);        // blocks of the old size are dropped
  const fl = { cells: { '1,1': 'wood', '2,1': 'wood', '5,5': 'tile' } };
  eq(P.group(fl, '1,1').sort().join(' '), '1,1 2,1');                                            // the connected floor moves together
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
