// Game loop, camera, scenes (menu / play / paused), travel, sleeping, needs, fighting, saving and rendering.
(function (root) {
  'use strict';
  var G = root.G;
  var cfg = G.config;

  var canvas, ctx, vignette, hurtVig;
  var view = { w: 0, h: 0, dpr: 1 };
  var cam = { x: 0, y: 0 };
  var acc = 0, last = 0, running = false;
  var fxRand = G.util.rng(99);
  var FADE = 0.38;             // seconds for each half of the travel fade
  var SLEEP_FADE = 1.0;        // and for the slower, darker fade of a night's sleep
  var FAINT_FADE = 0.9;
  var DOOR_FADE = 0.26;        // quicker fade through a door / up the stairs
  var AUTOSAVE = 30;           // seconds between automatic saves
  var ZERO = { x: 0, y: 0, run: false };
  var PROMPTS = { chest: 'E · פתיחת המחסן', workbench: 'E · שולחן עבודה', campfire: 'E · מדורה', rack: 'E · מתלה ייבוש' };
  var LOW_NOTE = { hunger: 'מתחילים להיות רעבים', thirst: 'מתחילים להיות צמאים', energy: 'מתחילים להיות עייפים' };
  var pcfg = { radius: cfg.player.radius, walkSpeed: cfg.player.walkSpeed, runMult: cfg.player.runMult };

  // Exposed for debugging and JS-injection tests.
  var st = G.state = {
    scene: 'menu',           // 'menu' (main menu over the base) | 'play'
    paused: false,
    player: null, cam: cam, view: view, frames: 0, ticks: 0, time: 0,
    area: 'base', world: cfg.world, zone: null, visits: {}, trip: {},
    gather: G.area.newGather(), gathering: false, target: null, targetBlock: null,
    floaters: [], particles: [], fade: null, fullNoteAt: -10,
    diff: 'normal', needs: null, tank: null, playTime: 0, sinceSave: 0, low: {}, saveWarned: false,
    // fighting: the infected of this area, bullet lines, noise the player is making, hit feedback
    enemies: [], enemyKeep: {}, shots: [], burst: G.combat.newBurst(), gunCool: 0, dryAt: -10, kills: 0, guns: {}, reload: null,
    wear: {}, wearLife: {}, wearWarned: {},          // melee wear: blows landed / rolled life per weapon id (saved), warned flags (not saved)
    invuln: 0, hurt: 0, hurtGoal: 0, lastHitAt: -99,
    shake: G.feel.newShake()                         // camera shake / kick (js/feel.js)
  };
  var shakeOff = { x: 0, y: 0 }, lowOut = { edge: 0, desat: 0 };   // reused every frame: no allocation in render

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
    hurtVig = G.combatArt.buildHurt(view.w, view.h, view.dpr);
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
    G.player.settle(p, angle);
    var t = cameraTarget();
    cam.x = t.x; cam.y = t.y;
  }

  // ---- sound (js/audio.js; every call is a no-op until the first key / click unlocks audio) -------------

  function snd(name, o) { if (G.audio) G.audio.play(name, o); }
  function at(x, y, o) { o = o || {}; o.x = x; o.y = y; return o; }

  // Ambience and music follow the place: the base, a destination, or a building of it (indoor), or the main menu.
  function audioScene() {
    if (!G.audio) return;
    var def = st.zone ? G.data.areas[st.zone.id] : null;
    G.audio.scene(st.area === 'base' || !def ? 'base' : (def.parent || st.area), !!(def && def.interior), st.scene !== 'play');
  }

  // What is under the feet: the ground theme of the area, decks (wood planks), the base's grass.
  function surfaceAt(x, y) {
    if (st.area === 'base' || !st.zone) return 'grass';
    var Z = st.zone, i, d;
    for (i = 0; i < Z.decks.length; i++) { d = Z.decks[i]; if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return d.metal ? 'metal' : 'wood'; }
    var th = G.data.areas[Z.id] && G.data.areas[Z.id].theme;
    var g = th && th.ground;
    if (g === 'tiles' || g === 'concrete' || g === 'gravel') return g;
    return 'grass';
  }

  // One footstep each time a leg comes down (half a stride cycle). f._sk remembers the last one per figure.
  function footsteps(f, vol, key) {
    var k = Math.floor(f.stride / Math.PI);
    if (!f.moving || f.gait < 0.3) { f._sk = k; return; }
    if (f._sk === undefined) f._sk = k;
    if (k !== f._sk) {
      f._sk = k;
      snd('step', at(f.x, f.y, { surface: surfaceAt(f.x, f.y), run: !!f.running, vol: vol, key: key }));
    }
  }

  // Hit sound for a resource being gathered: by its particle style and the tool it needs.
  function gatherMat(def) {
    if (def.fx === 'wood') return def.tool ? 'wood' : 'soft';
    if (def.fx === 'stone') return 'stone';
    if (def.fx === 'metal') return 'metal';
    if (def.fx === 'water') return 'water';
    return 'soft';
  }

  function clearScene() {
    st.gather = G.area.newGather(); st.target = null; st.targetBlock = null; st.gathering = false;
    st.floaters.length = 0; st.particles.length = 0;
    st.enemies = []; st.shots.length = 0;          // new array: a building floor may keep its own list (st.enemyKeep)
  }

  // Generates a destination for a given visit number (the same visit always gives the same area) and puts the
  // player there: at its entrance, or at `pos` when a save is loaded.
  function enterZone(id, visit, delta, pos, face) {
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
      if (face !== undefined) st.player.angle = st.player.prevAngle = face;
      G.player.settle && G.player.settle(st.player, st.player.angle);
      G.area.collide(st.player, st.zone);
      var t = cameraTarget(); cam.x = t.x; cam.y = t.y;
    }
    var keep = st.enemyKeep[id];
    if (keep) st.enemies = keep;
    else {
      var dest = G.data.world.destinations[def.parent || id];
      var av = pos ? { x: pos.x, y: pos.y, r: 320 } : { x: st.zone.spawn.x, y: st.zone.spawn.y, r: G.data.enemies.avoidSpawn };
      st.enemies = G.enemies.spawnFor(st.zone, dest ? dest.risk : 1, visit, av);
    }
    G.ui.setArea(def.name);
    audioScene();
  }

  // Instant switch (the fade around it is handled in tick). Every trip to a destination re-rolls its loose resources.
  function setArea(id) {
    st.placing = null;
    st.trip = {}; st.enemyKeep = {};                 // a new trip (or back home): building floors start fresh
    if (id === 'base' || !G.world.has(id)) {
      st.def.raid = null;                            // raiders (and a raid still on its way) never outlive a scene change
      clearScene();
      st.zone = null;
      st.area = 'base';
      st.world = cfg.world;
      place(G.base.layout.arrive.x, G.base.layout.arrive.y, Math.PI / 2);
      G.ui.setArea(G.data.areas.base.name);
    } else {
      G.defense.beginTrip(st.def, st.kills);         // a new trip: count its noise from zero
      enterZone(id, (st.visits[id] || 0) + 1);
    }
    audioScene();
  }

  // A fade through black: `mid` runs while the screen is dark, `done` when it is clear again.
  function startFade(dur, mid, done) {
    if (st.fade) return false;
    G.ui.close();
    st.fade = { t: 0, dur: dur, mid: mid, done: done, swapped: false };
    return true;
  }

  // Through a door or up / down the stairs: another area of the same trip (a building's floor). What was taken
  // on each floor is kept for the rest of the trip (st.trip), so nothing refills by walking in and out.
  function goThrough(door) {
    if (!G.data.areas[door.to]) return false;
    if (!st.fade) snd('door');
    return startFade(DOOR_FADE, function () {
      st.trip[st.zone.id] = G.area.delta(st.zone);
      st.enemyKeep[st.zone.id] = st.enemies;          // the infected on this floor stay as they are
      enterZone(door.to, st.zone.visit, st.trip[door.to] || null, door.at, door.face);
    }, function () { save('arrive'); });
  }

  // Back to the base (from an exit point).
  function travel(to) {
    if (!st.fade) snd('travel');
    return startFade(FADE, function () {
      setArea(to);
      if (to === 'base') G.defense.roll(st.def, st.buildings.fence || 0, Math.random);   // a loud trip may be followed home
    }, function () { save('arrive'); });
  }

  // From the world map: pay the energy and go. The way back is free.
  function depart(id) {
    if (st.scene !== 'play' || st.paused || st.fade || st.area !== 'base' || !G.world.has(id)) return false;
    var cost = G.world.cost(id, diffLevel());
    snd('travel');
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
    if (st.needs.energy >= 95) { snd('uiBad'); G.ui.toast('אינכם עייפים מספיק כדי לישון', 2200); return; }
    snd('sleep');
    startFade(SLEEP_FADE, function () { G.needs.sleep(st.needs, lv, diffLevel()); st.low = {}; },
      function () { snd('wake'); save('sleep'); G.ui.toast('ישנתם. האנרגיה התמלאה', 2800); });
  }

  function takeRain() {
    var p = st.player, moved = G.tank.take(st.tank, st.bag, st.chest);
    if (moved) { snd('rain'); floater(p.x, p.y, G.tank.ITEM, moved); G.ui.markDirty(); save('rain'); }
    else snd('uiBad'), floater(p.x, p.y - 22, null, 0, st.tank.amount > 0 ? 'אין מקום בתיק ובמחסן' : 'המיכל ריק');
  }

  // Health reached 0: fade out, lose part of the bag (by difficulty), wake up in the base.
  // (A blow in the last few seconds means it was a fight, otherwise hunger, thirst or a bad meal.) The weapon in hand is
  // kept unless the difficulty takes it too.
  function faint() {
    var fight = st.playTime - st.lastHitAt < 3;
    if (!st.fade) snd('faint');
    startFade(FAINT_FADE, function () {
      st.lostItems = G.combat.deathLoss(st.bag, diffLevel(), st.player.held);
      for (var gid in st.guns) if (G.inventory.count(st.bag, G.data.weapons[gid].item) <= 0) delete st.guns[gid];   // a lost gun takes its magazine and wear with it
      st.reload = null; st.player.reload = 0;
      G.needs.revive(st.needs);
      st.low = {}; st.invuln = 0; st.hurt = 0; st.hurtGoal = 0; st.lastHitAt = -99;
      setArea('base');
      G.ui.markDirty();
    }, function () {
      var n = st.lostItems ? st.lostItems.length : 0;
      G.ui.toast((fight ? 'נפלתם בקרב ושבתם לבסיס' : 'נפלתם מתשישות ושבתם לבסיס') + (n ? ' · אבדו ' + n + ' פריטים מהתיק' : ''), 4200);
      save('faint');
    });
  }

  function floater(x, y, item, n, text, color) {
    st.floaters.push({ x: x, y: y, item: item, n: n, text: text, color: color, t: 0, max: 1.15 });
  }
  function noteFull(p) {
    if (st.time - st.fullNoteAt < 1.4) return;
    st.fullNoteAt = st.time;
    snd('uiBad', { vol: 0.7 });
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
    st.fence = { material: 'wood' };
    st.placed = []; st.floor = G.placing.createFloor(); st.placing = null; G.base.setChest(null);
    st.tank = G.tank.create();
    st.visits = {}; st.playTime = 0; st.sinceSave = 0; st.low = {}; st.saveWarned = false;
    st.fade = null; st.paused = false; st.lostItems = null;
    st.enemies = []; st.enemyKeep = {}; st.shots.length = 0; st.burst = G.combat.newBurst();
    st.gunCool = 0; st.kills = 0; st.invuln = 0; st.hurt = 0; st.hurtGoal = 0; st.lastHitAt = -99;
    st.def = G.defense.create();
    st.guns = { gun: G.combat.newGun(G.data.weapons.gun, Math.random, true) }; st.reload = null;   // the pistol of the test loadout starts loaded
    st.player.reload = 0;
    st.wear = {}; st.wearLife = {}; st.wearWarned = {};
    G.player.setHeld(st.player, 'hands');
    st.bag = G.inventory.fromList(G.crafting.bagSlots(st.buildings), inv.start.bag);
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
    audioScene();
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
    st.needs = d.needs; st.bag = d.bag; st.chest = d.chest; st.buildings = d.buildings; st.fence = d.fence; st.placed = d.placed; st.floor = d.floor; st.placing = null; G.base.setChest(d.chestAt);
    st.tank = d.tank; st.visits = d.visits; st.playTime = d.playTime;
    st.guns = d.guns;                                  // missing in older saves: a gun in the bag then starts with an empty magazine
    applyBuildings();
    st.trip = d.trip || {};
    st.wear = d.wear || {}; st.wearLife = d.wearLife || {};      // melee wear (the saved ids were checked against the weapons)
    st.enemyKeep = {};
    for (var kid in d.enemyKeep || {}) st.enemyKeep[kid] = G.save.restoreEnemies(d.enemyKeep[kid], null);   // the other floors of the trip
    if (d.zone && d.enemies) st.enemyKeep[d.zone.id] = G.save.restoreEnemies(d.enemies, null);   // enterZone then uses them instead of re-rolling (old saves: no list, re-rolled)
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

  // ---- fighting ---------------------------------------------------------------------------------
  // Blows and shots start from the mouse (attackInput), land at the moment the animation says (swingHit) or at once
  // (the gun), and hurt the infected through G.enemies.hurt. The infected move in combatStep and hurt the player.

  function equip(id) {
    var w = G.data.weapons[id], p = st.player;
    if (!w || p.held === id) return;
    if (!G.combat.canHold(st.bag, id)) { G.ui.toast('אין ' + w.name + ' בתיק', 1600); return; }
    G.player.setHeld(p, id);
    snd('pickup', { vol: 0.5 });
    G.ui.toast('ביד: ' + w.name, 1200);
  }

  // Q: the next weapon you can hold (hands, then melee tools, then the guns you own).
  function cycleWeapon() {
    var order = G.data.weaponOrder, i = order.indexOf(st.player.held), k;
    for (k = 1; k <= order.length; k++) {
      var id = order[(i + k) % order.length];
      if (G.combat.canHold(st.bag, id)) { equip(id); return; }
    }
  }

  // What leaves the hands when the player has something held: dropped from the backpack = back to empty hands.
  // A gun that appears in the backpack gets its own state (empty magazine, a fresh life); one that is gone (and
  // not just stored in the chest: the state is kept until it breaks or is lost) keeps its magazine and wear.
  function checkHeld() {
    var h = st.player.held, W = G.data.weapons, id;
    if (h !== 'hands' && !G.combat.canHold(st.bag, h)) G.player.setHeld(st.player, 'hands');
    for (id in W) {
      if (W[id].kind === 'gun' && !st.guns[id] && G.inventory.count(st.bag, W[id].item) > 0) st.guns[id] = G.combat.newGun(W[id], Math.random, false);
    }
    if (st.bag) G.combat.wearPrune(st.wear, st.wearLife, function (item) {       // a tool that is gone (bag and chest) takes its wear with it
      return G.inventory.count(st.bag, item) + (st.chest ? G.inventory.count(st.chest, item) : 0);
    });
  }

  // The last blow a melee tool had: it breaks and leaves the backpack, the hands are empty again.
  function breakMelee(p, w) {
    snd('gunbreak');
    G.inventory.remove(st.bag, w.item, 1);
    delete st.wearWarned[w.id];
    checkHeld();
    G.ui.markDirty();
    G.ui.toast(w.name + ' נשבר', 3200);
    floater(p.x, p.y - 22, null, 0, w.name + ' נשבר', '#e0b08a');
  }

  // R: put rounds from the backpack into the magazine (takes a moment; putting the gun away cancels it).
  function startReload(auto) {
    var p = st.player, w = G.data.weapons[p.held], g = w && w.kind === 'gun' ? st.guns[p.held] : null;
    if (!g || st.reload) return;
    if (g.mag >= w.mag) { if (!auto) G.ui.toast('המחסנית מלאה', 1200); return; }
    if (G.combat.gunRoom(g, w, st.bag) <= 0) {
      if (st.time - st.dryAt > 1.2) { st.dryAt = st.time; floater(p.x, p.y - 22, null, 0, 'אין ' + G.data.items[w.ammo].name); }
      return;
    }
    st.reload = { t: 0, dur: w.reload, id: p.held };
    snd('reload', { phase: 'start', weapon: w.id });
    if (st.area !== 'base') G.combat.addBurst(st.burst, w.reloadNoise);
  }

  function stepReload(dt) {
    var p = st.player, r = st.reload;
    if (!r) return;
    if (p.held !== r.id || !st.guns[r.id]) { st.reload = null; p.reload = 0; return; }
    r.t += dt;
    if (r.t < r.dur) { p.reload = r.t / r.dur; return; }
    var n = G.combat.gunLoad(st.guns[r.id], G.data.weapons[r.id], st.bag);
    st.reload = null; p.reload = 0;
    if (n > 0) { G.ui.markDirty(); snd('reload', { phase: 'end', weapon: r.id }); }
  }

  // The last shot a gun had: it breaks, the rounds left in it go back in the backpack, the hands are empty again.
  function breakGun(p, w) {
    var back = G.combat.gunBreak(st.guns[w.id], w, st.bag);
    snd('gunbreak');
    G.inventory.remove(st.bag, w.item, 1);
    delete st.guns[w.id]; st.reload = null; p.reload = 0;
    checkHeld();
    G.ui.markDirty();
    G.ui.toast(w.name + ' נשבר' + (back ? ' · ' + back + ' כדורים חזרו לתיק' : ''), 3200);
    floater(p.x, p.y - 22, null, 0, w.name + ' נשבר', '#e0b08a');
  }

  function hitEnemy(e, dmg, w, fx, fy, from) {
    var res = G.enemies.hurt(e, dmg, from.x, from.y, w);
    if (!res.dealt) return;
    snd('hit', at(fx, fy, { mat: 'flesh', heavy: res.killed || w.kind !== 'gun', vol: w.kind === 'gun' ? 0.6 : 1 }));
    if (res.killed) { snd('growl', at(e.x, e.y, { kind: e.type, mood: 'die' })); snd('body', at(e.x, e.y, { delay: 0.7 })); }
    else snd('growl', at(e.x, e.y, { kind: e.type, mood: 'hurt', gap: 0.35, key: e.uid }));
    G.forestArt.spawnFx(st.particles, 'blood', fx, fy, res.killed ? 12 : 6, fxRand);
    if (w.kind !== 'gun') G.feel.kick(st.shake, e.x - from.x, e.y - from.y, G.feel.meleeKick(res.killed));   // feel: a tiny camera kick along the blow
    floater(e.x, e.y + 26, null, 0, (res.sneak ? 'מכה שקטה ' : '') + '-' + Math.round(res.dealt), res.sneak ? '#d8c07a' : '#d8a496');
    if (res.killed) { st.kills++; lootEnemy(e, res.sneak, from); }
  }

  // Loot of a killed infected goes straight into the backpack (once per body); what does not fit is dropped.
  function lootEnemy(e, sneak, p) {
    if (e.looted || !G.loot) return;
    e.looted = true;
    var drops = G.loot.roll(e.type, Math.random, { sneak: !!sneak, bag: st.bag }), i, left, full = false, shown = 0;
    for (i = 0; i < drops.length; i++) {
      left = G.inventory.add(st.bag, drops[i][0], drops[i][1]);
      if (left > 0) full = true;
      if (drops[i][1] - left > 0) { floater(e.x + (shown % 2 ? 14 : -14), e.y - 4 - shown * 8, drops[i][0], drops[i][1] - left); shown++; }
    }
    if (shown) { snd('pickup', { vol: 0.6 }); G.ui.markDirty(); }
    if (full) noteFull(p);
  }

  function fire(p, w) {
    var g = st.guns[w.id];
    if (!g || st.reload) return;
    if (g.mag <= 0) {                                  // empty: load another magazine by itself if there are rounds, else just click
      st.gunCool = 0.3;
      if (G.combat.gunRoom(g, w, st.bag) > 0) startReload(true);
      else if (snd('dry', { gap: 0.25 }), st.time - st.dryAt > 1.2) { st.dryAt = st.time; floater(p.x, p.y - 22, null, 0, 'אין ' + G.data.items[w.ammo].name); }
      return;
    }
    var res = G.combat.gunFire(g);
    snd('shot', { weapon: w.id, indoor: !!(st.zone && G.data.areas[st.zone.id].interior) });
    G.ui.markDirty();
    st.gunCool = w.cooldown;
    G.needs.spend(st.needs, w.energy, diffLevel());
    G.player.recoil(p);
    G.combat.addBurst(st.burst, w.noise);
    var mv = w.moveSpread || [0.02, 0.06];
    var spread = (Math.random() * 2 - 1) * (G.combat.gunSpread(g, w) + (p.running ? mv[1] : (p.moving ? mv[0] : 0)));
    var r = G.combat.shoot(fightArea(), p, w, st.enemies, spread), m = G.player.muzzle(p), i;
    var shot = { x0: m.x, y0: m.y, x1: r.x, y1: r.y, h: w.height, t: 0, max: w.pierce ? 0.18 : 0.1 };
    if (G.feel.enabled) {                              // feel: muzzle glow, a brass casing (lives longer than the tracer), camera shake
      shot.tl = shot.max; shot.max = 0.9;
      shot.gr = G.feel.glowRadius(w); shot.ga = G.feel.glowAlpha(w);
      shot.cas = G.feel.casing(fxRand, Math.cos(p.angle), Math.sin(p.angle), w.height);
      G.feel.addShake(st.shake, G.feel.shotAmp(w));
    }
    st.shots.push(shot);
    G.forestArt.spawnFx(st.particles, 'smoke', m.x, m.y - w.height, 3, fxRand);
    for (i = 0; i < r.hits.length; i++) hitEnemy(r.hits[i].enemy, w.dmg * (i ? 0.7 : 1), w, r.hits[i].x, r.hits[i].y - w.height, p);   // a bullet that went through hits a bit softer
    if (!r.hits.length && r.wall) G.forestArt.spawnFx(st.particles, 'spark', r.x, r.y - w.height, 5, fxRand);
    if (res === 'broke') breakGun(p, w);
    else if (!g.warned && G.combat.gunCondition(g) <= 0.2) {
      g.warned = true;
      floater(p.x, p.y - 22, null, 0, w.name + ' בלוי, יישבר בקרוב', '#e0b08a');
    }
  }

  // The mouse: a click swings / shoves (once), holding the button keeps a gun firing. Only in a destination for the gun.
  function attackInput(p, inp, inZone) {
    var w = G.data.weapons[p.held];
    if (!w) return;
    if (w.kind === 'gun') {
      if (inZone && (inp.mouse.clicked || (w.auto !== false && inp.mouse.down)) && st.gunCool <= 0) fire(p, w);   // a bolt-action rifle: one shot per click
      return;
    }
    if (inp.mouse.clicked) {
      var started = w.kind === 'shove' ? G.player.shove(p) : G.player.swing(p);
      if (started) snd('swing', { weapon: w.kind === 'shove' ? 'hands' : w.id });
      if (started && inZone) { G.needs.spend(st.needs, w.energy, diffLevel()); G.combat.addBurst(st.burst, w.noise); }   // swings at home are free practice
    }
  }

  // The ground a fight happens on: the destination, or (raiders at home) the base seen as a thin area (js/defense.js arena).
  function fightArea() { return st.area === 'base' ? G.defense.arena(st.def, st.base) : st.zone; }

  function damagePlayer(dmg, from) {
    var p = st.player;
    if (st.invuln > 0 || st.needs.health <= 0) return;
    var dealt = G.needs.hurt(st.needs, dmg, diffLevel());
    snd('hurt');
    st.invuln = G.data.hurt.invuln; st.hurtGoal = 1; st.lastHitAt = st.playTime;
    floater(p.x, p.y - 22, null, 0, '-' + Math.round(dealt), '#e08a7c');
    G.forestArt.spawnFx(st.particles, 'blood', p.x, p.y - 14, 7, fxRand);
    G.feel.addShake(st.shake, G.feel.hurtAmp(dealt));   // feel: camera shake when the player is hurt
    var dx = p.x - from.x, dy = p.y - from.y, l = Math.sqrt(dx * dx + dy * dy) || 1;
    p.x += dx / l * G.data.hurt.shove; p.y += dy / l * G.data.hurt.shove;
    if (st.area === 'base') G.base.collide(p, st.base.solids); else G.area.collide(p, st.zone);
  }

  // One step of a fight in a destination: lands the player's blow, then moves the infected and applies theirs.
  function combatStep(dt, frozen) {
    var p = st.player, i;
    var w = G.data.weapons[p.held];
    if (w && w.kind !== 'gun' && G.player.swingHit(p, w.hitU)) {
      var list = G.combat.meleeTargets(fightArea(), p, w, st.enemies);
      var cond = G.combat.meleeCondition(st.wear, st.wearLife, w);
      var mult = G.needs.attackMult(st.needs) * G.combat.wearDamageMult(cond);   // a worn tool hits weaker
      if (list.length && w.kind === 'shove') snd('shove', at(list[0].x, list[0].y));
      for (i = 0; i < list.length; i++) hitEnemy(list[i], w.dmg * mult, w, list[i].x, list[i].y - 14, p);
      if (list.length && G.combat.wears(w)) {          // only a blow that landed wears the tool (one per swing, however many it hit)
        if (G.combat.meleeWear(st.wear, st.wearLife, w, Math.random) === 'broke') breakMelee(p, w);
        else if (!st.wearWarned[w.id] && G.combat.meleeCondition(st.wear, st.wearLife, w) <= G.data.wear.warn) {
          st.wearWarned[w.id] = true;
          floater(p.x, p.y - 22, null, 0, w.name + ' בלוי, יישבר בקרוב', '#e0b08a');
        }
      }
    }
    if (frozen) return;                                // time stands still while a panel is open or a fade runs
    var c = { area: fightArea(), world: st.world, noise: G.combat.noiseRadius(p, st.burst),
      player: { x: p.x, y: p.y, radius: p.radius, alive: st.needs.health > 0 }, events: [] };
    var hunt = 0, e;
    for (i = 0; i < st.enemies.length; i++) {
      e = st.enemies[i];
      if (e.uid === undefined) e.uid = ++uidSeq;
      var aimed = st.area === 'base' && e.state !== 'dying' && e.state !== 'dead' ? G.defense.aim(st.def, e, c, st.base) : null;   // raiders: hunt, or strike the gate
      var out = G.enemies.step(e, aimed ? aimed.c : c, dt);
      if (out.hit && aimed && aimed.gate !== false) {
        if (aimed.gate && G.defense.hitGate(st.def, out.hit) === 'broke') { snd('hit', at(e.x, e.y - 20, { mat: 'wood', heavy: true })); G.ui.toast('הדוממים פרצו את השער!', 2200); }
        else if (aimed.gate) snd('hit', at(e.x, e.y - 20, { mat: 'wood', vol: 0.8 }));
      } else if (out.hit) damagePlayer(out.hit, e);
      if (e.state === 'dying' || e.state === 'dead') continue;
      footsteps(e, e.type === 'runner' ? 0.55 : 0.4, e.uid);
      var ex = e.x - p.x, ey = e.y - p.y;
      if ((e.state === 'chase' || e.state === 'windup') && ex * ex + ey * ey < 1000 * 1000) hunt++;
      // now and then a moan from the ones nearby (more often when they are after the player)
      if (Math.random() < dt * (e.state === 'chase' ? 0.35 : 0.07)) snd('growl', at(e.x, e.y, { kind: e.type, mood: 'idle', gap: 2.5, key: e.uid }));
    }
    for (i = 0; i < c.events.length; i++) {
      var ev = c.events[i], q = ev.e;
      if (ev.type === 'notice') {
        snd('growl', at(q.x, q.y, { kind: q.type, mood: 'notice', gap: 1, key: q.uid }));
        snd('notice', { gap: 5, vol: 0.8 });
      } else if (ev.type === 'blow') snd('growl', at(q.x, q.y, { kind: q.type, mood: 'attack', gap: 0.4, key: q.uid }));
      else if (ev.type === 'hear') snd('growl', at(q.x, q.y, { kind: q.type, mood: 'idle', vol: 0.8, gap: 1.5, key: q.uid }));
    }
    if (G.audio) G.audio.tension(Math.min(1, hunt * 0.4));
    G.enemies.separate(st.enemies, c.player, c.area);
  }

  // Timers that run every step in play: noise fading, gun cooldown, hit invulnerability, the red flash, bullet lines.
  function tickFight(dt) {
    var i;
    G.combat.stepBurst(st.burst, dt);
    if (st.area !== 'base') G.defense.track(st.def, st.burst, st.kills, dt);     // the noise of the trip decides whether something follows home
    if (st.gunCool > 0) st.gunCool -= dt;
    stepReload(dt);
    if (st.invuln > 0) st.invuln -= dt;
    G.feel.stepShake(st.shake, dt);
    if (st.hurt < st.hurtGoal) { st.hurt = Math.min(st.hurtGoal, st.hurt + dt * 12); if (st.hurt >= st.hurtGoal) st.hurtGoal = 0; }
    else if (st.hurt > 0) st.hurt = Math.max(0, st.hurt - dt * 1.7);
    for (i = st.shots.length - 1; i >= 0; i--) {
      st.shots[i].t += dt;
      if (st.shots[i].t >= st.shots[i].max) st.shots.splice(i, 1);
    }
  }

  // ---- simulation -----------------------------------------------------------------------------

  function moveInput() {
    var m = G.input.getMove();
    if (m.run && !G.needs.canRun(st.needs)) m.run = false;
    return m;
  }

  // The raid that follows a loud trip: waits a few seconds after arriving (only while nothing is open or fading), then the
  // infected come down the trail to the gate (js/defense.js).
  function raidStep(dt, frozen) {
    var d = st.def;
    if (!G.defense.waiting(d)) return;
    var p = st.player;
    if (!G.defense.tickWait(d, dt, !frozen && !st.fade && !G.ui.isOpen() && st.needs.health > 0)) return;
    var list = G.defense.spawn(d, st.base, st.buildings.fence || 0, p, Math.random), i;
    st.enemies = [];
    for (i = 0; i < list.length; i++) {
      var e = G.enemies.create(list[i].type, list[i].x, list[i].y, Math.random);
      e.state = 'chase'; e.goal = { x: p.x, y: p.y }; e.alertT = 0.9; e.uid = ++uidSeq;
      G.player.settle(e, Math.PI / 2);
      st.enemies.push(e);
      snd('growl', at(e.x, e.y, { kind: e.type, mood: 'notice', gap: 0.5, key: e.uid }));
    }
    snd('notice', { gap: 5, vol: 0.8 });
    G.ui.toast('דוממים עקבו אחריכם הביתה!', 2800);
  }

  // ---- free placement at home (rules and state: js/placing.js) ----------------------------------------------------
  // st.placing = null | { kind: 'struct', id, carry: {x,y} | null, ghost } | { kind: 'floor', mat, ghost, warnT }
  function placingCtx() { return { bag: st.bag, chest: st.chest, buildings: st.buildings, fence: st.fence, placed: st.placed }; }

  function startPlacing(p) {
    st.placing = p; p.ghost = null; p.warnT = 0;
    G.ui.toast(p.kind === 'move' ? 'הזזה: לחצו על מבנה, מחסן או בלוק רצפה (Shift: כל הרצפה), ואז על המקום החדש · קליק ימני או Esc: ביטול/סיום' : p.kind === 'floor' ? 'רצפה: לחיצה (או החזקה) מניחה בלוק · קליק ימני מסיר · Esc לסיום'
      : 'בחרו מקום: לחיצה מניחה · קליק ימני על מבנה מרים אותו · Esc ביטול', 3200);
  }

  // ---- "move" mode: grab a placed structure, the chest or floor blocks (Shift: the whole connected floor) and put it down again ----
  function moveTarget(w) {
    var P = G.placing, i, p, s, L = G.base.layout.chest;
    for (i = st.placed.length - 1; i >= 0; i--) {
      p = st.placed[i]; s = P.size(p.id);
      if (w.x >= p.x && w.x <= p.x + s.w && w.y >= p.y && w.y <= p.y + s.h) return { type: 'struct', id: p.id, idx: i, rect: { x: p.x, y: p.y, w: s.w, h: s.h } };
    }
    if (w.x >= L.x && w.x <= L.x + L.w && w.y >= L.y && w.y <= L.y + L.h) return { type: 'chest', id: 'chest', rect: { x: L.x, y: L.y, w: L.w, h: L.h } };
    var c = P.cellAt(w.x, w.y);
    return c && st.floor.cells[c.key] ? { type: 'floor', cell: c } : null;
  }

  function solidOf(kind, x, y) {
    for (var i = 0; i < st.base.solids.length; i++) { var r = st.base.solids[i]; if (r.kind === kind && r.x === x && r.y === y) return r; }
    return null;
  }

  function moveStep(pl, inp, w) {
    var P = G.placing, shift = inp.isDown('ShiftLeft') || inp.isDown('ShiftRight'), c = pl.carry, t, r;
    if (!c) {
      t = moveTarget(w);
      if (t && t.type === 'floor') {
        var keys = shift ? P.group(st.floor, t.cell.key) : [t.cell.key];
        pl.ghost = { cells: keys.map(function (k) { var q = k.split(','); return P.cellRect(+q[0], +q[1]); }), ok: true };
      } else if (t) pl.ghost = { rect: t.rect, ok: true };
      if (inp.mouse.rclicked) { stopPlacing(); return; }
      if (!inp.mouse.clicked || !t) return;
      snd('ui');
      if (t.type === 'floor') {                                 // lift the block(s): they leave the ground until put down again
        var ks = shift ? P.group(st.floor, t.cell.key) : [t.cell.key], ax = t.cell.cx, ay = t.cell.cy;
        pl.carry = { type: 'floor', cells: ks.map(function (k) { var q = k.split(','); return { dx: +q[0] - ax, dy: +q[1] - ay, mat: st.floor.cells[k], key: k }; }) };
        ks.forEach(function (k) { delete st.floor.cells[k]; });
      } else pl.carry = { type: t.type, id: t.id, idx: t.idx, from: { x: t.rect.x, y: t.rect.y } };
      return;
    }
    if (c.type === 'floor') {
      var a = P.cellAt(w.x, w.y);
      if (!a) return;
      var rects = c.cells.map(function (q) { return P.cellRect(a.cx + q.dx, a.cy + q.dy); }), ok = rects.every(function (q) { return !!q; });
      pl.ghost = { cells: rects.filter(function (q) { return q; }), ok: ok };
      if (inp.mouse.rclicked) { stopPlacing(); return; }
      if (inp.mouse.clicked) {
        if (!ok) { G.ui.toast('הרצפה לא נכנסת שם', 1200); snd('uiBad'); return; }
        c.cells.forEach(function (q, i) { st.floor.cells[rects[i].key] = q.mat; });
        pl.carry = null; snd('build'); save('floor');
      }
      return;
    }
    r = P.rectAt(c.id, w.x, w.y);
    var why = P.check(st.base, r, c.type === 'chest' ? solidOf('chest', G.base.layout.chest.x, G.base.layout.chest.y) : solidOf(c.id, c.from.x, c.from.y));
    pl.ghost = { rect: r, ok: !why, label: c.id === 'chest' ? 'מחסן' : G.data.buildings[c.id].name };
    if (inp.mouse.rclicked) { stopPlacing(); return; }
    if (inp.mouse.clicked) {
      if (why) { G.ui.toast(why === 'gate' ? 'השאירו את הכניסה פנויה' : 'המקום תפוס', 1200); snd('uiBad'); return; }
      if (c.type === 'chest') G.base.setChest({ x: r.x, y: r.y }); else { st.placed[c.idx].x = r.x; st.placed[c.idx].y = r.y; }
      pl.carry = null; applyBuildings(); snd('build'); save('move');
    }
  }

  function stopPlacing() {
    var pl = st.placing;
    if (!pl) return;
    if (pl.kind === 'move') {                                   // a lifted floor goes back where it was; structures never left
      if (pl.carry && pl.carry.type === 'floor') pl.carry.cells.forEach(function (q) { st.floor.cells[q.key] = q.mat; });
      st.placing = null; save('move'); return;
    }
    if (pl.kind === 'struct' && pl.carry) { st.placed.push({ id: pl.id, x: pl.carry.x, y: pl.carry.y }); applyBuildings(); }   // a picked-up copy goes back
    st.placing = null;
    if (pl.kind === 'floor') save('floor');
  }

  function placingStep(dt, inp) {
    var pl = st.placing, P = G.placing, inside = inp.mouse.inside;
    var w = inside ? { x: inp.mouse.x + cam.x, y: inp.mouse.y + cam.y } : null;
    pl.warnT = Math.max(0, pl.warnT - dt);
    pl.ghost = null;
    if (!w) return;
    if (pl.kind === 'move') { moveStep(pl, inp, w); return; }
    if (pl.kind === 'struct') {
      var r = P.rectAt(pl.id, w.x, w.y), why = P.check(st.base, r, null);
      pl.ghost = { rect: r, ok: !why, label: G.data.buildings[pl.id].name };
      if (inp.mouse.rclicked) {
        var i = pl.carry ? -1 : P.indexAt(st.placed, pl.id, w.x, w.y);
        if (i >= 0) { var q = st.placed.splice(i, 1)[0]; pl.carry = { x: q.x, y: q.y }; applyBuildings(); snd('ui'); }
        else stopPlacing();
        return;
      }
      if (inp.mouse.clicked) {
        if (why) { G.ui.toast(why === 'gate' ? 'השאירו את הכניסה פנויה' : 'המקום תפוס', 1200); snd('uiBad'); return; }
        if (!pl.carry) {
          var res = G.crafting.place(placingCtx(), pl.id);
          if (!res.ok) { G.ui.toast('חסרים חומרים', 1500); snd('uiBad'); st.placing = null; return; }
        }
        st.placed.push({ id: pl.id, x: r.x, y: r.y });
        pl.carry = null;
        applyBuildings(); snd('build'); save('place');
        G.ui.toast((pl.id === 'tank' ? 'הוצב: ' : 'הוצב: ') + G.data.buildings[pl.id].name, 1200);
        st.placing = null;
      }
      return;
    }
    // floor: hold the left button to lay blocks, the right one to take them up again
    var c = P.cellAt(w.x, w.y), M = G.data.floorMaterials;
    if (!c) return;
    pl.ghost = { cell: c, ok: true };
    var have = st.floor.cells[c.key];
    if (inp.mouse.down && have !== pl.mat) {
      if (have) G.crafting.refund(placingCtx(), M[have].cost);
      if (G.crafting.spend(placingCtx(), M[pl.mat].cost)) {
        if (have) G.crafting.spend(placingCtx(), M[have].cost);          // could not pay for the new one: keep the old block
        if (pl.warnT <= 0) { G.ui.toast('חסרים חומרים (' + Object.keys(M[pl.mat].cost).map(function (k) { return G.data.items[k].name; }).join(', ') + ')', 1400); pl.warnT = 1.5; snd('uiBad'); }
      } else { st.floor.cells[c.key] = pl.mat; snd('build', { gap: 0.12 }); G.ui.markDirty(); }
    } else if (inp.mouse.rdown && have) {
      G.crafting.refund(placingCtx(), M[have].cost);
      delete st.floor.cells[c.key]; snd('ui', { gap: 0.12 }); G.ui.markDirty();
    }
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
    if (inp.wasPressed('KeyB') && !st.fade) { stopPlacing(); ui.toggleBuild(); }
    if (inp.wasPressed('KeyT') && !st.fade && !ui.isOpen()) { if (st.placing && st.placing.kind === 'move') stopPlacing(); else { stopPlacing(); startPlacing({ kind: 'move', carry: null }); } }
    // Chest / crafting panels close by themselves if the player is somehow no longer next to the structure
    if (ui.mode() === 'chest' && near !== 'chest') ui.close();
    if (ui.mode() === 'craft' && near !== ui.station()) ui.close();

    frozen = frozen || ui.isOpen();
    st.near = near; st.gathering = false;
    var aim = !frozen && inp.mouse.inside ? { x: inp.mouse.x + cam.x, y: inp.mouse.y + cam.y } : null;
    pcfg.walkSpeed = cfg.player.walkSpeed * G.needs.speedMult(st.needs);
    G.player.update(p, frozen ? ZERO : moveInput(), aim, dt, st.world, pcfg);
    raidStep(dt, frozen);                                    // a loud trip may have been followed home
    var raid = G.defense.active(st.def);
    if (st.placing && !frozen) placingStep(dt, inp);
    if (!frozen && !st.placing) attackInput(p, inp, raid);   // guns (and their cost) work at home only while raiders are here
    G.player.animate(p, dt, null);
    G.base.collide(p, st.base.solids);
    G.area.updateVisuals({ nodes: st.base.trees }, p, dt);
    if (!frozen) footsteps(p, 1, 'me');
    if (G.audio) G.audio.tension(0);
    if (raid) combatStep(dt, frozen);
    if (G.defense.finished(st.def, st.enemies)) { G.ui.toast('הבסיס שקט שוב', 2000); save('raid'); }

    var text = null;
    if (!frozen) {
      if (near === 'bed') text = st.needs.energy >= 95 ? 'מיטה · אינכם עייפים' : 'E · שינה';
      else if (near === 'tank') text = st.tank.amount > 0 ? 'E · איסוף מי גשם (' + st.tank.amount + ')' : 'מיכל גשם · מתמלא לאט';
      else text = PROMPTS[near] || (trail ? 'E · מפת העולם' : null);
      if (st.placing) text = null;
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
      else if (target && target.kind === 'door') goThrough(target.door);
    }
    frozen = frozen || ui.isOpen() || !!st.fade;

    var held = !frozen && inp.isDown('KeyE');
    var out = G.area.gatherStep(st.gather, target, held, dt * G.needs.gatherMult(st.needs), st.bag, res, items);
    st.gathering = out.active;
    var def = target && target.node ? res[target.node.type] : null;
    if (out.hit && def) {
      snd('hit', at(target.x, target.y, { mat: gatherMat(def), heavy: !!out.done }));
      G.forestArt.spawnFx(st.particles, def.fx, target.x, target.y, out.done ? 12 : 5, fxRand);
      G.combat.addBurst(st.burst, def.tool ? G.data.noise.chop : G.data.noise.gather);     // chopping carries far
    }
    if (out.done) {
      if (out.done.gained) { snd('pickup'); floater(p.x, p.y, out.done.item, out.done.gained); ui.markDirty(); }
      if (out.done.left) noteFull(p);
    }
    if (out.blocked === 'full') noteFull(p);

    var aim = out.active ? { x: target.x, y: target.y }
      : (!frozen && inp.mouse.inside ? { x: inp.mouse.x + cam.x, y: inp.mouse.y + cam.y } : null);
    pcfg.walkSpeed = cfg.player.walkSpeed * G.needs.speedMult(st.needs);
    G.player.update(p, frozen || out.active ? ZERO : moveInput(), aim, dt, st.world, pcfg);
    if (!frozen && !out.active) attackInput(p, inp, true);
    G.player.animate(p, dt, out.active ? { tool: def ? def.tool : null, phase: (st.gather.t % G.area.HIT) / G.area.HIT } : null);
    G.area.collide(p, F);
    if (!frozen) footsteps(p, 1, 'me');
    combatStep(dt, frozen);
    G.area.updateVisuals(F, p, dt);

    // Prompt + highlight for whatever is in reach (re-checked after a harvest changed things)
    if (target && target.kind === 'node' && target.node.dead) target = null;
    st.target = frozen ? null : target;
    st.targetBlock = null;
    var text = null;
    if (st.target) {
      if (target.kind === 'exit') text = 'E · חזרה לבסיס';
      else if (target.kind === 'door') text = 'E · ' + target.door.label;
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
    G.tank.step(st.tank, st.buildings.tank || 0, dt, G.placing.count(st.placed, 'tank'));
    if (st.fade || G.ui.isOpen()) return;
    if (n.health <= 0) { faint(); return; }          // a blow took the last health this step: no slow regeneration first
    G.needs.drain(n, dt,{ moving: p.moving, running: p.running, gathering: st.gathering }, diffLevel());
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
      if (inp.wasPressed('Escape') && !G.menu.takeEscBack() && G.menu.screen() === 'pause') setPaused(false);   // Esc on the settings screen goes back to the pause menu
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
      if (st.placing) { stopPlacing(); }
      else if (ui.isOpen()) ui.close();
      else if (!st.fade) { setPaused(true); return; }
    }
    if (!st.fade && (inp.wasPressed('KeyI') || inp.wasPressed('Tab'))) ui.toggleBag();

    // 1-5 pick up a weapon from the backpack (hands always work). Losing the item puts the hands back to empty.
    if (!st.fade && !ui.isOpen()) {
      var wk = G.data.weaponKeys;
      for (var hk in wk) if (inp.wasPressed(hk)) equip(wk[hk]);
      if (inp.wasPressed('KeyR')) startReload(false);
      if (inp.wasPressed('KeyQ')) cycleWeapon();
    }
    checkHeld();

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

    tickFight(dt);
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
    items.sort(function (a, b) { return a.y - b.y; });
    for (i = 0; i < items.length; i++) {
      G.forestArt.drawRange(ctx, st.zone, st, vr, time, lo, items[i].y, py);
      lo = items[i].y;
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
    items.sort(function (a, b) { return a.y - b.y; });
    for (i = 0; i < items.length; i++) {
      if (items[i].gate) { G.baseArt.drawGate(ctx, st.base, vr, items[i].gate.frac, time); continue; }
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
      drawBaseFigures(alpha, time, vr);
      if (st.enemies.length || st.particles.length || st.shots.length) {            // raiders at home: blood, smoke and bullet lines
        G.forestArt.drawParticles(ctx, st.particles);
        G.combatArt.drawShots(ctx, st.shots, alpha * cfg.stepMs / 1000, G.feel.glowGain(false));
      }
      G.baseArt.drawAbove(ctx, st.base, vr, time, py, opts);
      if (st.enemies.length) G.combatArt.drawMarks(ctx, st.enemies, vr);
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

  var uidSeq = 0, lastAudio = 0;

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
})(window);
