// Game loop, camera, travel between areas and rendering of the world.
(function (root) {
  'use strict';
  var G = root.G;
  var cfg = G.config;

  var canvas, ctx, vignette;
  var view = { w: 0, h: 0, dpr: 1 };
  var cam = { x: 0, y: 0 };
  var acc = 0, last = 0, running = false;
  var fxRand = G.util.rng(99);
  var FADE = 0.38;             // seconds for each half of the travel fade
  var ZERO = { x: 0, y: 0, run: false };

  // Exposed for debugging and JS-injection tests.
  var st = G.state = {
    player: null, cam: cam, view: view, frames: 0, ticks: 0, time: 0,
    area: 'base', world: cfg.world, forest: null, trips: 0,
    gather: G.area.newGather(), target: null, targetBlock: null,
    floaters: [], particles: [], fade: null, fullNoteAt: -10
  };

  function buildVignette() {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(view.w * view.dpr));
    c.height = Math.max(1, Math.round(view.h * view.dpr));
    var g = c.getContext('2d');
    var cx = c.width / 2, cy = c.height / 2;
    var grad = g.createRadialGradient(cx, cy, Math.min(cx, cy) * 0.35, cx, cy, Math.hypot(cx, cy));
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.35)');
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    vignette = c;
  }

  function resize() {
    view.dpr = Math.min(root.devicePixelRatio || 1, 2);
    view.w = canvas.clientWidth;
    view.h = canvas.clientHeight;
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
    buildVignette();
  }

  function cameraTarget() {
    var p = st.player, W = st.world;
    var tx = p.x - view.w / 2, ty = p.y - view.h / 2;
    tx = view.w >= W.width ? (W.width - view.w) / 2 : G.util.clamp(tx, 0, W.width - view.w);
    ty = view.h >= W.height ? (W.height - view.h) / 2 : G.util.clamp(ty, 0, W.height - view.h);
    return { x: tx, y: ty };
  }

  // ---- travel ---------------------------------------------------------------------------------

  function place(x, y, angle) {
    var p = st.player;
    p.x = p.prevX = x; p.y = p.prevY = y;
    p.angle = p.prevAngle = angle;
    p.moving = p.running = false; p.stride = 0;
    var t = cameraTarget();
    cam.x = t.x; cam.y = t.y;
  }

  // Instant switch (the fade around it is handled in tick). A new forest trip re-rolls loose resources.
  function setArea(id) {
    var areas = G.data.areas;
    st.gather = G.area.newGather(); st.target = null; st.targetBlock = null;
    st.floaters.length = 0; st.particles.length = 0;
    if (id === 'forest') {
      st.trips++;
      st.forest = G.area.generate(areas.forest, G.data.resources, st.trips);
      G.forestArt.prepare(st.forest);
      st.area = 'forest';
      st.world = { width: st.forest.width, height: st.forest.height };
      place(st.forest.spawn.x, st.forest.spawn.y, -Math.PI / 2);
    } else {
      st.area = 'base';
      st.world = cfg.world;
      place(G.base.layout.arrive.x, G.base.layout.arrive.y, Math.PI / 2);
    }
    G.ui.setArea(areas[st.area].name);
  }

  function travel(to) {
    if (st.fade) return;
    G.ui.close();
    st.fade = { to: to, t: 0, swapped: false };
  }

  function floater(x, y, item, n, text) {
    st.floaters.push({ x: x, y: y, item: item, n: n, text: text, t: 0, max: 1.15 });
  }
  function noteFull(p) {
    if (st.time - st.fullNoteAt < 1.4) return;
    st.fullNoteAt = st.time;
    floater(p.x, p.y - 22, null, 0, 'התיק מלא');
  }

  // ---- simulation -----------------------------------------------------------------------------

  function tickBase(dt, frozen) {
    var inp = G.input, p = st.player, ui = G.ui;
    var near = G.base.nearChest(p), trail = G.base.nearTrail(p);
    if (inp.wasPressed('KeyE') && !st.fade) {
      if (ui.isOpen()) ui.close();
      else if (near) ui.openChest();
      else if (trail) travel('forest');
    }
    // Chest panel closes by itself if the player is somehow no longer near it
    if (ui.mode() === 'chest' && !near) ui.close();

    frozen = frozen || ui.isOpen();
    var aim = !frozen && inp.mouse.inside ? { x: inp.mouse.x + cam.x, y: inp.mouse.y + cam.y } : null;
    G.player.update(p, frozen ? ZERO : inp.getMove(), aim, dt, st.world);
    G.base.collide(p, st.base.solids);
    G.area.updateVisuals({ nodes: st.base.trees }, p, dt);
    ui.showPrompt(frozen ? null : (near ? 'E · פתיחת המחסן' : (trail ? 'E · יציאה ליער' : null)));
  }

  function tickForest(dt, frozen) {
    var inp = G.input, p = st.player, ui = G.ui, F = st.forest;
    var res = G.data.resources, items = G.data.items;
    var target = G.area.findTarget(F, p);

    if (inp.wasPressed('KeyE') && !st.fade) {
      if (ui.isOpen()) ui.close();
      else if (target && target.kind === 'exit') travel('base');
    }
    frozen = frozen || ui.isOpen() || !!st.fade;

    var held = !frozen && inp.isDown('KeyE');
    var out = G.area.gatherStep(st.gather, target, held, dt, st.bag, res, items);
    var def = target && target.node ? res[target.node.type] : null;
    if (out.hit && def) G.forestArt.spawnFx(st.particles, def.fx, target.x, target.y, out.done ? 12 : 5, fxRand);
    if (out.done) {
      if (out.done.gained) { floater(p.x, p.y, out.done.item, out.done.gained); ui.markDirty(); }
      if (out.done.left) noteFull(p);
    }
    if (out.blocked === 'full') noteFull(p);

    var aim = out.active ? { x: target.x, y: target.y }
      : (!frozen && inp.mouse.inside ? { x: inp.mouse.x + cam.x, y: inp.mouse.y + cam.y } : null);
    G.player.update(p, frozen || out.active ? ZERO : inp.getMove(), aim, dt, st.world);
    G.area.collide(p, F);
    G.area.updateVisuals(F, p, dt);

    // Prompt + highlight for whatever is in reach (re-checked after a harvest changed things)
    if (target && target.kind === 'node' && target.node.dead) target = null;
    st.target = frozen ? null : target;
    st.targetBlock = null;
    var text = null;
    if (st.target) {
      if (target.kind === 'exit') text = 'E · חזרה לבסיס';
      else {
        st.targetBlock = G.area.check(target, st.bag, res, items);
        if (st.targetBlock === 'tool') text = def.action + ' · דרוש ' + items[def.tool].name;
        else if (st.targetBlock === 'full') text = 'התיק מלא · חזרו לבסיס לפרוק';
        else text = 'E (החזקה) · ' + def.action;
      }
    }
    ui.showPrompt(text);
  }

  function tick(dt) {
    var inp = G.input, ui = G.ui, i;
    st.time += dt;

    var frozen = false;
    if (st.fade) {
      var f = st.fade;
      frozen = true;
      f.t += dt;
      if (!f.swapped && f.t >= FADE) { setArea(f.to); f.swapped = true; }
      if (f.t >= FADE * 2) { st.fade = null; frozen = false; }
    }

    if (inp.wasPressed('Escape')) ui.close();
    if (!st.fade && (inp.wasPressed('KeyI') || inp.wasPressed('Tab'))) ui.toggleBag();

    if (st.area === 'forest') tickForest(dt, frozen); else tickBase(dt, frozen);

    for (i = st.floaters.length - 1; i >= 0; i--) {
      st.floaters[i].t += dt;
      if (st.floaters[i].t >= st.floaters[i].max) st.floaters.splice(i, 1);
    }
    for (i = st.particles.length - 1; i >= 0; i--) {
      var q = st.particles[i];
      q.life += dt;
      if (q.life >= q.max) { st.particles.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= 0.9; q.vy = q.vy * 0.9 + 4;
    }

    var t = cameraTarget(), k = 1 - Math.exp(-cfg.camera.follow * dt);
    cam.x += (t.x - cam.x) * k;
    cam.y += (t.y - cam.y) * k;
    st.ticks++;
  }

  // ---- rendering ------------------------------------------------------------------------------

  function render(alpha) {
    var p = st.player;
    var time = st.time + alpha * cfg.stepMs / 1000;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = cfg.colors.bg;
    ctx.fillRect(0, 0, view.w, view.h);

    var cx = Math.round(cam.x * view.dpr) / view.dpr; // pixel-snapped: no shimmer
    var cy = Math.round(cam.y * view.dpr) / view.dpr;
    ctx.translate(-cx, -cy);

    var vr = { x0: cx, y0: cy, x1: cx + view.w, y1: cy + view.h };
    if (st.area === 'forest') {
      var def = st.gather.node ? G.data.resources[st.gather.node.type] : null;
      G.forestArt.drawBelow(ctx, st.forest, st, vr, time);
      G.player.draw(ctx, p, alpha);
      G.forestArt.drawTool(ctx, p, alpha, st.gather, def ? def.tool : null);
      G.forestArt.drawParticles(ctx, st.particles);
      G.forestArt.drawAbove(ctx, st.forest, st, vr, time);
    } else {
      var tr = G.base.layout.trail;
      var nearC = G.base.nearChest(p), py = G.util.lerp(p.prevY, p.y, alpha);
      G.baseArt.drawBelow(ctx, st.base, vr, time, nearC, py);
      G.forestArt.drawExit(ctx, tr.x, tr.y, tr.r, time, -1);
      G.player.draw(ctx, p, alpha);
      G.baseArt.drawAbove(ctx, st.base, vr, time, nearC, py);
    }
    G.forestArt.drawFloaters(ctx, st.floaters);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (st.fade) {                                   // travel: smooth fade through black
      var ft = st.fade.t + alpha * cfg.stepMs / 1000;
      var a = ft < FADE ? ft / FADE : 1 - (ft - FADE) / FADE;
      a = G.util.clamp(a, 0, 1);
      ctx.fillStyle = 'rgba(5,7,8,' + (a * a * (3 - 2 * a)).toFixed(3) + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(vignette, 0, 0);
    G.ui.update();
  }

  function frame(now) {
    if (!running) return;
    var res = G.timing.advance(acc, now - last, cfg);
    last = now;
    acc = res.acc;
    for (var i = 0; i < res.steps; i++) {
      tick(cfg.stepMs / 1000);
      G.input.consumeFrame();
    }
    render(res.alpha);
    st.frames++;
    root.requestAnimationFrame(frame);
  }

  G.game = {
    init: function () {
      canvas = document.getElementById('game');
      ctx = canvas.getContext('2d', { alpha: false });
      G.input.attach(canvas);
      resize();
      root.addEventListener('resize', resize);
      G.forestArt.init(ctx, view.dpr);
      // Paint the forest terrain now, so the first trip does not hitch during the fade.
      G.forestArt.prepare(G.area.generate(G.data.areas.forest, G.data.resources, 0));
      var inv = G.data.inventory;
      st.base = G.base.build();
      G.baseArt.prepare(st.base);
      st.bag = G.inventory.fromList(inv.bagSlots, inv.start.bag);
      st.chest = G.inventory.fromList(inv.chestSlots, inv.start.chest);
      G.ui.init();
      st.player = G.player.create(G.base.layout.spawn.x, G.base.layout.spawn.y);
      var t = cameraTarget();
      cam.x = t.x; cam.y = t.y;
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) { last = performance.now(); acc = 0; }
      });
    },
    start: function () {
      running = true;
      last = performance.now();
      root.requestAnimationFrame(frame);
    },
    tick: tick,       // exposed for JS-injection tests
    render: render,
    travel: travel,
    setArea: setArea
  };

  root.addEventListener('DOMContentLoaded', function () {
    G.game.init();
    G.game.start();
    document.body.classList.add('ready');
  });
})(window);
