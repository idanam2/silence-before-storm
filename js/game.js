// Game loop, camera, scenes (menu / play / paused), travel, sleeping, needs, saving and rendering.
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
  var SLEEP_FADE = 1.0;        // and for the slower, darker fade of a night's sleep
  var FAINT_FADE = 0.9;
  var AUTOSAVE = 30;           // seconds between automatic saves
  var ZERO = { x: 0, y: 0, run: false };
  var PROMPTS = { chest: 'E · פתיחת המחסן', workbench: 'E · שולחן עבודה', campfire: 'E · מדורה' };
  var LOW_NOTE = { hunger: 'מתחילים להיות רעבים', thirst: 'מתחילים להיות צמאים', energy: 'מתחילים להיות עייפים' };
  var pcfg = { radius: cfg.player.radius, walkSpeed: cfg.player.walkSpeed, runMult: cfg.player.runMult };

  // Exposed for debugging and JS-injection tests.
  var st = G.state = {
    scene: 'menu',           // 'menu' (main menu over the base) | 'play'
    paused: false,
    player: null, cam: cam, view: view, frames: 0, ticks: 0, time: 0,
    area: 'base', world: cfg.world, zone: null, visits: {},
    gather: G.area.newGather(), gathering: false, target: null, targetBlock: null,
    floaters: [], particles: [], fade: null, fullNoteAt: -10,
    diff: 'normal', needs: null, tank: null, playTime: 0, sinceSave: 0, low: {}, saveWarned: false
  };

  function diffLevel() { return G.data.difficulty.levels[st.diff] || G.data.difficulty.levels[G.data.difficulty.default]; }

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

  // ---- areas and travel -----------------------------------------------------------------------

  function place(x, y, angle) {
    var p = st.player;
    p.x = p.prevX = x; p.y = p.prevY = y;
    p.angle = p.prevAngle = angle;
    p.moving = p.running = false; p.stride = 0;
    var t = cameraTarget();
    cam.x = t.x; cam.y = t.y;
  }

  function clearScene() {
    st.gather = G.area.newGather(); st.target = null; st.targetBlock = null; st.gathering = false;
    st.floaters.length = 0; st.particles.length = 0;
  }

  // Generates a destination for a given visit number (the same visit always gives the same area) and puts the
  // player there: at its entrance, or at `pos` when a save is loaded.
  function enterZone(id, visit, delta, pos) {
    var def = G.data.areas[id];
    clearScene();
    st.visits[id] = visit;
    st.zone = G.area.generate(def, G.data.resources, visit);
    if (delta) G.area.applyDelta(st.zone, delta);
    G.forestArt.prepare(st.zone);
    st.area = id;
    st.world = { width: st.zone.width, height: st.zone.height };
    place(st.zone.spawn.x, st.zone.spawn.y, -Math.PI / 2);
    if (pos) {
      st.player.x = st.player.prevX = G.util.clamp(pos.x, 40, st.zone.width - 40);
      st.player.y = st.player.prevY = G.util.clamp(pos.y, 40, st.zone.height - 40);
      G.area.collide(st.player, st.zone);
      var t = cameraTarget(); cam.x = t.x; cam.y = t.y;
    }
    G.ui.setArea(def.name);
  }

  // Instant switch (the fade around it is handled in tick). Every trip to a destination re-rolls its loose resources.
  function setArea(id) {
    if (id === 'base' || !G.world.has(id)) {
      clearScene();
      st.zone = null;
      st.area = 'base';
      st.world = cfg.world;
      place(G.base.layout.arrive.x, G.base.layout.arrive.y, Math.PI / 2);
      G.ui.setArea(G.data.areas.base.name);
    } else {
      enterZone(id, (st.visits[id] || 0) + 1);
    }
  }

  // A fade through black: `mid` runs while the screen is dark, `done` when it is clear again.
  function startFade(dur, mid, done) {
    if (st.fade) return false;
    G.ui.close();
    st.fade = { t: 0, dur: dur, mid: mid, done: done, swapped: false };
    return true;
  }

  // Back to the base (from an exit point).
  function travel(to) {
    return startFade(FADE, function () { setArea(to); }, function () { save('arrive'); });
  }

  // From the world map: pay the energy and go. The way back is free.
  function depart(id) {
    if (st.scene !== 'play' || st.paused || st.fade || st.area !== 'base' || !G.world.has(id)) return false;
    var cost = G.world.cost(id, diffLevel());
    return startFade(FADE, function () {
      st.needs.energy = Math.max(0, st.needs.energy - cost);
      setArea(id);
    }, function () {
      save('arrive');
      if (G.needs.isExhausted(st.needs)) G.ui.toast('הגעתם מותשים: איטיים וחלשים עד שתנוחו');
    });
  }

  function sleep() {
    if (st.fade) return;
    var lv = st.buildings.bed || 0;
    if (lv < 1) return;
    if (st.needs.energy >= 95) { G.ui.toast('אינכם עייפים מספיק כדי לישון', 2200); return; }
    startFade(SLEEP_FADE, function () { G.needs.sleep(st.needs, lv, diffLevel()); st.low = {}; },
      function () { save('sleep'); G.ui.toast('ישנתם. האנרגיה התמלאה', 2800); });
  }

  function takeRain() {
    var p = st.player, moved = G.tank.take(st.tank, st.bag, st.chest);
    if (moved) { floater(p.x, p.y, G.tank.ITEM, moved); G.ui.markDirty(); save('rain'); }
    else floater(p.x, p.y - 22, null, 0, st.tank.amount > 0 ? 'אין מקום בתיק ובמחסן' : 'המיכל ריק');
  }

  // Health reached 0: fade out, lose part of the bag (by difficulty), wake up in the base.
  function faint() {
    startFade(FAINT_FADE, function () {
      st.lostItems = G.needs.deathLoss(st.bag, diffLevel());
      G.needs.revive(st.needs);
      st.low = {};
      setArea('base');
      G.ui.markDirty();
    }, function () {
      var n = st.lostItems ? st.lostItems.length : 0;
      G.ui.toast('נפלתם מתשישות ושבתם לבסיס' + (n ? ' · אבדו ' + n + ' פריטים מהתיק' : ''), 4200);
      save('faint');
    });
  }

  function floater(x, y, item, n, text) {
    st.floaters.push({ x: x, y: y, item: item, n: n, text: text, t: 0, max: 1.15 });
  }
  function noteFull(p) {
    if (st.time - st.fullNoteAt < 1.4) return;
    st.fullNoteAt = st.time;
    floater(p.x, p.y - 22, null, 0, 'התיק מלא');
  }

  // ---- saving -----------------------------------------------------------------------------------

  // Writes the current game to the save slot. Returns true on success.
  function save(reason) {
    if (st.scene !== 'play' || !st.needs) return false;
    var ok = G.save.write(G.save.snapshot(st, Date.now()));
    st.sinceSave = 0;
    if (ok) { G.ui.saveNote(); st.lastSave = reason; }
    else if (!st.saveWarned) { st.saveWarned = true; G.ui.toast('השמירה נכשלה: האחסון בדפדפן חסום או מלא'); }
    return ok;
  }

  // ---- worlds: new game, continue, back to the menu -------------------------------------------

  // Fresh world state (also used as the quiet backdrop behind the main menu).
  function resetWorld(diffId) {
    var inv = G.data.inventory;
    st.diff = G.data.difficulty.levels[diffId] ? diffId : G.data.difficulty.default;
    st.needs = G.needs.create();
    st.buildings = G.crafting.startBuildings();
    st.tank = G.tank.create();
    st.visits = {}; st.playTime = 0; st.sinceSave = 0; st.low = {}; st.saveWarned = false;
    st.fade = null; st.paused = false; st.lostItems = null;
    st.bag = G.inventory.fromList(inv.bagSlots, inv.start.bag);
    st.chest = G.inventory.fromList(G.crafting.chestSlots(st.buildings), inv.start.chest);
    G.ui.close();
    applyBuildings();
    setArea('base');
    place(G.base.layout.spawn.x, G.base.layout.spawn.y, -Math.PI / 2);
    G.ui.markDirty();
  }

  function setScene(scene) {
    st.scene = scene;
    document.body.classList.toggle('menu', scene === 'menu');
  }

  function newGame(diffId) {
    resetWorld(diffId);
    setScene('play');
    G.menu.hide();
    save('new');
  }

  // Loads the save. Returns { ok: true } or { ok: false, reason }.
  function continueGame() {
    var r = G.save.read();
    if (!r.ok) return r;
    var d = r.data;
    resetWorld(d.diff);
    st.needs = d.needs; st.bag = d.bag; st.chest = d.chest; st.buildings = d.buildings;
    st.tank = d.tank; st.visits = d.visits; st.playTime = d.playTime;
    applyBuildings();
    if (d.zone) enterZone(d.zone.id, d.zone.visit, d.zone.delta, d.pos);
    else {
      setArea('base');
      if (d.pos) {
        place(d.pos.x, d.pos.y, -Math.PI / 2);
        G.base.collide(st.player, st.base.solids);
        var t = cameraTarget(); cam.x = t.x; cam.y = t.y;
      } else place(G.base.layout.spawn.x, G.base.layout.spawn.y, -Math.PI / 2);
    }
    setScene('play');
    G.menu.hide();
    G.ui.markDirty();
    return { ok: true };
  }

  function setPaused(on) {
    if (st.scene !== 'play' || st.fade) return;
    st.paused = !!on;
    if (on) { G.ui.close(); G.input.clear(); G.menu.pause(); save('pause'); }
    else G.menu.hide();
  }

  function toMenu() {
    if (st.scene === 'play') save('menu');
    resetWorld(G.data.difficulty.default);
    setScene('menu');
    G.menu.showMain();
  }

  function exit() {
    if (st.scene === 'play') save('exit');
    try { root.close(); } catch (e) { /* browsers only allow this for script-opened tabs */ }
    G.menu.showBye();
  }

  // ---- simulation -----------------------------------------------------------------------------

  function moveInput() {
    var m = G.input.getMove();
    if (m.run && !G.needs.canRun(st.needs)) m.run = false;
    return m;
  }

  function tickBase(dt, frozen) {
    var inp = G.input, p = st.player, ui = G.ui;
    var near = G.base.nearStation(p, st.base), trail = G.base.nearTrail(p);
    if (inp.wasPressed('KeyE') && !st.fade) {
      if (ui.isOpen()) ui.close();
      else if (near === 'chest') ui.openChest();
      else if (near === 'bed') sleep();
      else if (near === 'tank') takeRain();
      else if (near) ui.openCraft(near);
      else if (trail) ui.openMap();
    }
    if (inp.wasPressed('KeyB') && !st.fade) ui.toggleBuild();
    // Chest / crafting panels close by themselves if the player is somehow no longer next to the structure
    if (ui.mode() === 'chest' && near !== 'chest') ui.close();
    if (ui.mode() === 'craft' && near !== ui.station()) ui.close();

    frozen = frozen || ui.isOpen();
    st.near = near; st.gathering = false;
    var aim = !frozen && inp.mouse.inside ? { x: inp.mouse.x + cam.x, y: inp.mouse.y + cam.y } : null;
    pcfg.walkSpeed = cfg.player.walkSpeed * G.needs.speedMult(st.needs);
    G.player.update(p, frozen ? ZERO : moveInput(), aim, dt, st.world, pcfg);
    G.base.collide(p, st.base.solids);
    G.area.updateVisuals({ nodes: st.base.trees }, p, dt);

    var text = null;
    if (!frozen) {
      if (near === 'bed') text = st.needs.energy >= 95 ? 'מיטה · אינכם עייפים' : 'E · שינה';
      else if (near === 'tank') text = st.tank.amount > 0 ? 'E · איסוף מי גשם (' + st.tank.amount + ')' : 'מיכל גשם · מתמלא לאט';
      else text = PROMPTS[near] || (trail ? 'E · מפת העולם' : null);
    }
    ui.showPrompt(text);
  }

  function tickZone(dt, frozen) {
    var inp = G.input, p = st.player, ui = G.ui, F = st.zone;
    var res = G.data.resources, items = G.data.items;
    var target = G.area.findTarget(F, p);

    if (inp.wasPressed('KeyE') && !st.fade) {
      if (ui.isOpen()) ui.close();
      else if (target && target.kind === 'exit') travel('base');
    }
    frozen = frozen || ui.isOpen() || !!st.fade;

    var held = !frozen && inp.isDown('KeyE');
    var out = G.area.gatherStep(st.gather, target, held, dt * G.needs.gatherMult(st.needs), st.bag, res, items);
    st.gathering = out.active;
    var def = target && target.node ? res[target.node.type] : null;
    if (out.hit && def) G.forestArt.spawnFx(st.particles, def.fx, target.x, target.y, out.done ? 12 : 5, fxRand);
    if (out.done) {
      if (out.done.gained) { floater(p.x, p.y, out.done.item, out.done.gained); ui.markDirty(); }
      if (out.done.left) noteFull(p);
    }
    if (out.blocked === 'full') noteFull(p);

    var aim = out.active ? { x: target.x, y: target.y }
      : (!frozen && inp.mouse.inside ? { x: inp.mouse.x + cam.x, y: inp.mouse.y + cam.y } : null);
    pcfg.walkSpeed = cfg.player.walkSpeed * G.needs.speedMult(st.needs);
    G.player.update(p, frozen || out.active ? ZERO : moveInput(), aim, dt, st.world, pcfg);
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

  // Needs, rain tank and the autosave timer. Time stands still while a panel is open or a fade runs.
  function tickSurvival(dt) {
    var p = st.player, k, n = st.needs;
    G.tank.step(st.tank, st.buildings.tank || 0, dt);
    if (st.fade || G.ui.isOpen()) return;
    G.needs.drain(n, dt, { moving: p.moving, running: p.running, gathering: st.gathering }, diffLevel());
    for (k in LOW_NOTE) {
      var low = G.needs.isLow(n, k);
      if (low && !st.low[k]) floater(p.x, p.y - 22, null, 0, LOW_NOTE[k]);
      st.low[k] = low;
    }
    if (n.health <= 0) { faint(); return; }
    st.sinceSave += dt;
    if (st.sinceSave >= AUTOSAVE) save('auto');
  }

  function tick(dt) {
    var inp = G.input, ui = G.ui, i;
    st.time += dt;

    if (st.scene !== 'play') {                       // main menu: only the quiet backdrop moves
      ui.showPrompt(null);
      follow(dt);
      st.ticks++;
      return;
    }
    if (st.paused) {
      ui.showPrompt(null);
      if (inp.wasPressed('Escape')) setPaused(false);
      follow(dt);
      st.ticks++;
      return;
    }
    st.playTime += dt;

    var frozen = false;
    if (st.fade) {
      var f = st.fade;
      frozen = true;
      f.t += dt;
      if (!f.swapped && f.t >= f.dur) { f.swapped = true; f.mid(); }
      if (f.t >= f.dur * 2) {
        var done = f.done;
        st.fade = null; frozen = false;
        if (done) done();
      }
    }

    if (inp.wasPressed('Escape')) {
      if (ui.isOpen()) ui.close();
      else if (!st.fade) { setPaused(true); return; }
    }
    if (!st.fade && (inp.wasPressed('KeyI') || inp.wasPressed('Tab'))) ui.toggleBag();

    if (st.area === 'base') tickBase(dt, frozen); else tickZone(dt, frozen);

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

    tickSurvival(dt);
    follow(dt);
    st.ticks++;
  }

  function follow(dt) {
    var t = cameraTarget(), k = 1 - Math.exp(-cfg.camera.follow * dt);
    cam.x += (t.x - cam.x) * k;
    cam.y += (t.y - cam.y) * k;
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
    if (st.area !== 'base') {
      var def = st.gather.node ? G.data.resources[st.gather.node.type] : null;
      G.forestArt.drawBelow(ctx, st.zone, st, vr, time);
      G.player.draw(ctx, p, alpha);
      G.forestArt.drawTool(ctx, p, alpha, st.gather, def ? def.tool : null);
      G.forestArt.drawParticles(ctx, st.particles);
      G.forestArt.drawAbove(ctx, st.zone, st, vr, time);
    } else {
      var tr = G.base.layout.trail;
      var py = G.util.lerp(p.prevY, p.y, alpha);
      var opts = { near: st.near, spots: G.ui.mode() === 'build' };
      G.baseArt.drawBelow(ctx, st.base, vr, time, py, opts);
      G.forestArt.drawExit(ctx, tr.x, tr.y, tr.r, time, -1);
      G.player.draw(ctx, p, alpha);
      G.baseArt.drawAbove(ctx, st.base, vr, time, py, opts);
    }
    G.forestArt.drawFloaters(ctx, st.floaters);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (st.fade) {                                   // travel / sleep: smooth fade through black
      var f = st.fade, ft = f.t + alpha * cfg.stepMs / 1000;
      var a = ft < f.dur ? ft / f.dur : 1 - (ft - f.dur) / f.dur;
      a = G.util.clamp(a, 0, 1);
      ctx.fillStyle = 'rgba(4,5,6,' + (a * a * (3 - 2 * a)).toFixed(3) + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(vignette, 0, 0);
    if (st.needs) G.ui.setNeeds(st.needs);
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

  // Called after a structure was built or upgraded (or a save was loaded): collision, drawing and chest size follow the levels.
  function applyBuildings() {
    G.base.setBuildings(st.base, st.buildings);
    G.baseArt.refresh(st.base);
    G.inventory.resize(st.chest, G.crafting.chestSlots(st.buildings));
    G.ui.markDirty();
  }

  G.game = {
    applyBuildings: applyBuildings,
    diff: diffLevel,
    init: function () {
      canvas = document.getElementById('game');
      ctx = canvas.getContext('2d', { alpha: false });
      G.input.attach(canvas);
      resize();
      root.addEventListener('resize', resize);
      G.forestArt.init(ctx, view.dpr);
      // Paint the forest terrain now, so the first trip does not hitch during the fade.
      G.forestArt.prepare(G.area.generate(G.data.areas.forest, G.data.resources, 0));
      st.buildings = G.crafting.startBuildings();
      st.base = G.base.build();
      G.base.setBuildings(st.base, st.buildings);
      G.baseArt.prepare(st.base);
      st.player = G.player.create(G.base.layout.spawn.x, G.base.layout.spawn.y);
      G.ui.init();
      G.menu.init();
      resetWorld(G.data.difficulty.default);        // quiet backdrop for the main menu
      G.menu.showMain();
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) { if (st.scene === 'play' && !st.fade) save('hidden'); }
        else { last = performance.now(); acc = 0; }
      });
      root.addEventListener('beforeunload', function () { if (st.scene === 'play' && !st.fade) save('close'); });
    },
    start: function () {
      running = true;
      last = performance.now();
      root.requestAnimationFrame(frame);
    },
    tick: tick,       // exposed for JS-injection tests
    render: render,
    travel: travel,
    depart: depart,
    setArea: setArea,
    sleep: sleep,
    save: save,
    newGame: newGame,
    continueGame: continueGame,
    setPaused: setPaused,
    toMenu: toMenu,
    exit: exit
  };

  root.addEventListener('DOMContentLoaded', function () {
    G.game.init();
    G.game.start();
    document.body.classList.add('ready');
  });
})(window);
