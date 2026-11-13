// Rendering, the frame loop, G.game and start-up.
// Part of the old js/game.js: all js/game-*.js files share one private object (G.gx); load order is in index.html.
(function (root) {
  'use strict';
  var G = root.G, X = G.gx = G.gx || {};
  var cfg = X.cfg, view = X.view, cam = X.cam, st = X.st, shakeOff = X.shakeOff, lowOut = X.lowOut;

  // functions of the other game-*.js files
  function diffLevel() { return X.diffLevel.apply(null, arguments); }
  function cameraTarget() { return X.cameraTarget.apply(null, arguments); }
  function snd() { return X.snd.apply(null, arguments); }
  function setArea() { return X.setArea.apply(null, arguments); }
  function travel() { return X.travel.apply(null, arguments); }
  function depart() { return X.depart.apply(null, arguments); }
  function sleep() { return X.sleep.apply(null, arguments); }
  function save() { return X.save.apply(null, arguments); }
  function resetWorld() { return X.resetWorld.apply(null, arguments); }
  function newGame() { return X.newGame.apply(null, arguments); }
  function continueGame() { return X.continueGame.apply(null, arguments); }
  function setPaused() { return X.setPaused.apply(null, arguments); }
  function toMenu() { return X.toMenu.apply(null, arguments); }
  function exit() { return X.exit.apply(null, arguments); }
  function startPlacing() { return X.startPlacing.apply(null, arguments); }
  function setupStory() { return X.setupStory.apply(null, arguments); }
  function tick() { return X.tick.apply(null, arguments); }
  var canvas, ctx, vignette, hurtVig;
  var acc = 0, last = 0, running = false;

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
    hurtVig = G.combatArt.buildHurt(view.w, view.h, view.dpr);
  }

  function follow(dt) {
    var t = cameraTarget(), k = 1 - Math.exp(-cfg.camera.follow * dt);
    cam.x += (t.x - cam.x) * k;
    cam.y += (t.y - cam.y) * k;
  }

  // ---- rendering ------------------------------------------------------------------------------

  // The fallen first, then the living infected and the player from far to near (by y), all with the same body rig.
  // Everything that stands on the ground (buildings, trunks, corpses, the infected, the player) is drawn from far to near
  // by its feet, so a building hides whatever is behind it. Corpses sort a little earlier than the living at the same depth.
  function drawFigures(alpha, time, vr, py) {
    var list = st.enemies, items = [], i, e, lo = -Infinity;
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (e.x < vr.x0 - 120 || e.x > vr.x1 + 120 || e.y < vr.y0 - 160 || e.y > vr.y1 + 120) continue;
      items.push({ y: e.state === 'dead' ? e.y - 6 : e.y, e: e });
    }
    items.push({ y: py, e: st.player });
    items = items.concat(X.vehItems(alpha));                         // the vehicles parked here and the one being ridden
    items.sort(function (a, b) { return a.y - b.y; });
    for (i = 0; i < items.length; i++) {
      G.forestArt.drawRange(ctx, st.zone, st, vr, time, lo, items[i].y, py);
      lo = items[i].y;
      if (items[i].veh) { G.vehicleArt.draw(ctx, items[i].veh, time); continue; }
      if (items[i].e === st.player && X.vehHides()) continue;       // inside a closed cab
      G.player.draw(ctx, items[i].e, alpha, time);
      if (items[i].e.hurtK > 0 && G.feel.enabled && items[i].e !== st.player) G.combatArt.drawHit(ctx, items[i].e);   // feel: hit flash
    }
    G.forestArt.drawRange(ctx, st.zone, st, vr, time, lo, Infinity, py);
  }

  // At home: the player, raiders and their corpses, plus the shut gate, from far to near by their feet.
  function drawBaseFigures(alpha, time, vr) {
    var items = [{ y: st.player.y, e: st.player }], i, e, gate = G.defense.gateInfo(st.def, st.base);
    for (i = 0; i < st.enemies.length; i++) { e = st.enemies[i]; items.push({ y: e.state === 'dead' ? e.y - 6 : e.y, e: e }); }
    if (gate) items.push({ y: gate.y + gate.h, gate: gate });
    items = items.concat(X.vehItems(alpha));
    items.sort(function (a, b) { return a.y - b.y; });
    for (i = 0; i < items.length; i++) {
      if (items[i].gate) { G.baseArt.drawGate(ctx, st.base, vr, items[i].gate.frac, time); continue; }
      if (items[i].veh) { G.vehicleArt.draw(ctx, items[i].veh, time); continue; }
      if (items[i].e === st.player && X.vehHides()) continue;
      G.player.draw(ctx, items[i].e, alpha, time);
      if (items[i].e.hurtK > 0 && G.feel.enabled && items[i].e !== st.player) G.combatArt.drawHit(ctx, items[i].e);
    }
  }

  function render(alpha) {
    var p = st.player;
    var time = st.time + alpha * cfg.stepMs / 1000;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = cfg.colors.bg;
    ctx.fillRect(0, 0, view.w, view.h);

    var so = G.feel.shakeOffset(st.shake, alpha * cfg.stepMs / 1000, shakeOff);   // feel: shake offset, whole device pixels like the camera
    var cx = Math.round(cam.x * view.dpr) / view.dpr + Math.round(so.x * view.dpr) / view.dpr; // pixel-snapped: no shimmer
    var cy = Math.round(cam.y * view.dpr) / view.dpr + Math.round(so.y * view.dpr) / view.dpr;
    ctx.translate(-cx, -cy);

    var vr = { x0: cx, y0: cy, x1: cx + view.w, y1: cy + view.h };
    var py = G.util.lerp(p.prevY, p.y, alpha);
    if (st.area !== 'base') {
      G.forestArt.drawBelow(ctx, st.zone, st, vr, time, py, true);
      G.combatArt.drawStains(ctx, st.enemies, vr);
      G.storyArt.draw(ctx, st.zone.id, vr, time, p);
      drawFigures(alpha, time, vr, py);
      G.forestArt.drawParticles(ctx, st.particles);
      G.combatArt.drawShots(ctx, st.shots, alpha * cfg.stepMs / 1000, G.feel.glowGain(!!(st.zone && G.data.areas[st.zone.id].interior)));
      G.forestArt.drawAbove(ctx, st.zone, st, vr, time, py, true);
      G.combatArt.drawMarks(ctx, st.enemies, vr);
    } else {
      var tr = G.base.layout.trail;
      var opts = { near: st.near, ghost: st.placing && st.placing.ghost, floor: st.floor };
      G.baseArt.drawBelow(ctx, st.base, vr, time, py, opts);
      G.forestArt.drawExit(ctx, tr.x, tr.y, tr.r, time, -1);
      if (st.enemies.length) G.combatArt.drawStains(ctx, st.enemies, vr);
      G.storyArt.draw(ctx, 'base', vr, time, p);
      drawBaseFigures(alpha, time, vr);
      if (st.enemies.length || st.particles.length || st.shots.length) {            // raiders at home: blood, smoke and bullet lines
        G.forestArt.drawParticles(ctx, st.particles);
        G.combatArt.drawShots(ctx, st.shots, alpha * cfg.stepMs / 1000, G.feel.glowGain(false));
      }
      G.baseArt.drawAbove(ctx, st.base, vr, time, py, opts);
      if (st.enemies.length) G.combatArt.drawMarks(ctx, st.enemies, vr);
    }
    var fv = X.vehFlying(alpha);                     // the ridden helicopter: over the roofs and the treetops
    if (fv) G.vehicleArt.draw(ctx, fv, time);
    G.forestArt.drawFloaters(ctx, st.floaters);
    X.vehGauge();                                    // the fuel gauge (DOM; only touched when its text changes)

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (st.fade) {                                   // travel / sleep: smooth fade through black
      var f = st.fade, ft = f.t + alpha * cfg.stepMs / 1000;
      var a = ft < f.dur ? ft / f.dur : 1 - (ft - f.dur) / f.dur;
      a = G.util.clamp(a, 0, 1);
      ctx.fillStyle = 'rgba(4,5,6,' + (a * a * (3 - 2 * a)).toFixed(3) + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (st.scene === 'play' && st.needs && G.feel.enabled) {   // feel: low health = slow red pulse + a little less colour
      G.feel.lowFx(st.needs.health, G.data.needs.max, time, lowOut);
      if (lowOut.edge > 0 || lowOut.desat > 0) G.combatArt.drawLowHealth(ctx, canvas.width, canvas.height, hurtVig, lowOut);
    }
    ctx.drawImage(vignette, 0, 0);
    if (st.hurt > 0.01) {                            // red edge flash after a hit
      ctx.globalAlpha = Math.min(1, st.hurt);
      ctx.drawImage(hurtVig, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    }
    var wd = G.data.weapons[p.held];
    var wtxt = null, wlow = false;
    var gs = wd && wd.kind === 'gun' ? st.guns[wd.id] : null;
    if (gs) {            // "magazine / spare rounds / condition", e.g. 7/8 · ×16 · 82%
      var spare = G.inventory.count(st.bag, wd.ammo);
      wtxt = (st.reload ? 'טוען…' : gs.mag + '/' + wd.mag) + ' · ×' + spare + ' · ' + Math.round(G.combat.gunCondition(gs) * 100) + '%';
      wlow = !st.reload && gs.mag === 0;
    } else if (G.combat.wears(wd)) {                 // melee tool: "condition 82%" (red when nearly broken)
      var mc = G.combat.meleeCondition(st.wear, st.wearLife, wd);
      wtxt = 'מצב ' + Math.round(mc * 100) + '%';
      wlow = mc <= G.data.wear.warn;
    }
    G.ui.setWeapon(wd ? wd.name : '', wtxt, wlow);
    if (st.needs) G.ui.setNeeds(st.needs);
    G.ui.update();
  }

  var lastAudio = 0;

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
    if (G.audio) { if (st.player) G.audio.listen(st.player.x, st.player.y); G.audio.update(Math.min(0.1, (now - (lastAudio || now)) / 1000)); }
    lastAudio = now;
    st.frames++;
    root.requestAnimationFrame(frame);
  }

  // Called after a structure was built or upgraded (or a save was loaded): collision, drawing and chest size follow the levels.
  function applyBuildings() {
    G.base.setBuildings(st.base, st.buildings, st.placed);
    G.baseArt.refresh(st.base);
    G.inventory.resize(st.chest, G.crafting.chestSlots(st.buildings));
    G.inventory.resize(st.bag, G.crafting.bagSlots(st.buildings));
    G.ui.markDirty();
  }

  G.game = {
    applyBuildings: applyBuildings,
    startPlacing: startPlacing,
    diff: diffLevel,
    init: function () {
      canvas = document.getElementById('game');
      ctx = canvas.getContext('2d', { alpha: false });
      G.input.attach(canvas);
      resize();
      root.addEventListener('resize', resize);
      G.forestArt.init(ctx, view.dpr);
      G.placeArt.init(ctx, view.dpr);
      // Paint the forest terrain now, so the first trip does not hitch during the fade.
      G.forestArt.prepare(G.area.generate(G.data.areas.forest, G.data.resources, 0));
      st.buildings = G.crafting.startBuildings();
      st.fence = st.fence || { material: 'wood' };
      st.placed = st.placed || []; st.floor = st.floor || G.placing.createFloor();
      st.base = G.base.build();
      G.base.setBuildings(st.base, st.buildings, st.placed);
      G.baseArt.prepare(st.base);
      st.player = G.player.create(G.base.layout.spawn.x, G.base.layout.spawn.y);
      G.ui.init();
      G.storyUI.init();
      setupStory();
      G.menu.init();
      resetWorld(G.data.difficulty.default);        // quiet backdrop for the main menu
      G.menu.showMain();
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) { if (st.scene === 'play' && !st.fade) save('hidden'); }
        else { last = performance.now(); acc = 0; }
      });
      // The browser lets sound start only after a gesture: the first key or click unlocks it. M = sound on / off.
      var unlock = function () { if (G.audio) G.audio.unlock(); };
      root.addEventListener('keydown', function (ev) {
        unlock();
        if (ev.code === 'KeyM' && G.audio && !ev.repeat) G.ui.toast(G.audio.toggle() ? 'הצליל כבוי (M)' : 'הצליל פועל (M)', 1400);
      }, true);
      root.addEventListener('mousedown', unlock, true);
      root.addEventListener('touchstart', unlock, true);
      document.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest && ev.target.closest('button');
        if (b && b.closest('#menu-layer, #map-panel, #craft-tabs')) snd('ui');
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

  X.buildVignette = buildVignette; X.resize = resize; X.follow = follow; X.drawFigures = drawFigures; X.drawBaseFigures = drawBaseFigures; X.render = render; X.frame = frame; X.applyBuildings = applyBuildings;
})(window);
