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

const G = loadGame(['js/core.js', 'data/items.js', 'data/resources.js', 'data/areas.js', 'data/recipes.js', 'data/buildings.js',
  'data/difficulty.js', 'data/needs.js', 'data/world.js',
  'js/input.js', 'js/inventory.js', 'js/crafting.js', 'js/needs.js', 'js/tank.js', 'js/world.js', 'js/save.js', 'js/player.js', 'js/base.js', 'js/area.js']);
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
    eq(d.levels.length, 2, id + ' levels: ');
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
  const c = mkctx([['wood', 10], ['stone', 10]], [['plank', 6]], { workbench: 1 });
  eq(G.crafting.nextLevel(c, 'workbench'), 2);
  eq(G.crafting.build(c, 'workbench').level, 2);
  eq(G.crafting.nextLevel(c, 'workbench'), 0);
  eq(G.crafting.build(c, 'workbench').reason, 'max');
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
  eq(G.crafting.recipesFor('workbench').length + G.crafting.recipesFor('campfire').length, RECIPES.length);
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
  const t = { amount: 6, t: 0 }, bag = G.inventory.create(1), chest = G.inventory.create(1);
  eq(G.tank.take(t, bag, chest), 6);
  eq(G.inventory.count(bag, 'water_clean'), 3); eq(G.inventory.count(chest, 'water_clean'), 3); eq(t.amount, 0);
  const u = { amount: 5, t: 0 }, b2 = G.inventory.fromList(1, [['stone', 10]]), c2 = G.inventory.create(1);
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
  eq(d.buildings.workbench, 2); eq(d.buildings.ghost, undefined); eq(d.buildings.tank, 0); eq(d.buildings.chest, 1); eq(d.buildings.bed, 0);
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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
