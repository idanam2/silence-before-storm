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

const G = loadGame(['js/core.js', 'js/input.js', 'js/player.js']);
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

console.log('structure');
test('index.html loads every js file, core first', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  eq(srcs[0], 'js/core.js', 'first script');
  for (const s of srcs) if (!fs.existsSync(path.join(ROOT, s))) throw new Error('missing ' + s);
  for (const f of fs.readdirSync(path.join(ROOT, 'js'))) {
    if (!srcs.includes('js/' + f)) throw new Error('not loaded: js/' + f);
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
