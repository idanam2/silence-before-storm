// Areas and travel, sleeping, fainting, saving, new game / continue / menu.
// Part of the old js/game.js: all js/game-*.js files share one private object (G.gx); load order is in index.html.
(function (root) {
  'use strict';
  var G = root.G, X = G.gx = G.gx || {};
  var cfg = X.cfg, cam = X.cam, FADE = X.FADE, SLEEP_FADE = X.SLEEP_FADE, FAINT_FADE = X.FAINT_FADE, DOOR_FADE = X.DOOR_FADE, st = X.st;

  // functions of the other game-*.js files
  function diffLevel() { return X.diffLevel.apply(null, arguments); }
  function cameraTarget() { return X.cameraTarget.apply(null, arguments); }
  function place() { return X.place.apply(null, arguments); }
  function snd() { return X.snd.apply(null, arguments); }
  function at() { return X.at.apply(null, arguments); }
  function audioScene() { return X.audioScene.apply(null, arguments); }
  function applyBuildings() { return X.applyBuildings.apply(null, arguments); }
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
    G.story.emit('enter_area', { area: id });
  }

  // Instant switch (the fade around it is handled in tick). Every trip to a destination re-rolls its loose resources.
  function setArea(id) {
    var prev = st.area, parentOf = prev !== 'base' && G.data.areas[prev] ? (G.data.areas[prev].parent || prev) : prev;
    st.placing = null;
    st.trip = {}; st.enemyKeep = {};                 // a new trip (or back home): building floors start fresh
    G.story.newTrip();
    if (prev && G.story.S) G.story.emit('leave_area', { area: parentOf });
    if (id === 'base' || !G.world.has(id)) {
      st.def.raid = null;                            // raiders (and a raid still on its way) never outlive a scene change
      clearScene();
      st.zone = null;
      st.area = 'base';
      X.vehAreaChanged('base');                      // vehicles left on a trip are towed back to their garage
      st.world = cfg.world;
      place(G.base.layout.arrive.x, G.base.layout.arrive.y, Math.PI / 2);
      G.ui.setArea(G.data.areas.base.name);
      if (prev !== 'base') G.story.emit('return_base', {});
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
    if (door.need && G.inventory.count(st.bag, door.need) === 0) {      // a locked way in: needs an item in the bag (the gas mask)
      snd('uiBad'); G.ui.toast(door.needText || 'צריך ציוד מיוחד כדי להיכנס', 2600); return false;
    }
    if (!st.fade) snd('door');
    return startFade(DOOR_FADE, function () {
      X.vehDismount('כלי רכב לא נכנסים לבניין · נשארו בחוץ');   // no riding indoors: it stays at the door
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
    if (st.scene !== 'play' || st.paused || st.fade || st.area !== 'base' || !G.world.has(id) || !G.story.isUnlocked(id)) return false;
    var cost = G.world.cost(id, diffLevel()), rv = st.ride ? st.vehicles[st.ride] : null, fuel = 0;
    if (rv) {                                          // on a vehicle: the trip burns fuel instead of energy
      fuel = G.vehicles.tripFuel(st.ride, G.data.world.destinations[id].km);
      if (rv.fuel < fuel) { snd('uiBad'); G.ui.toast('אין מספיק דלק לדרך (' + fuel + ' דרושים) · F לתדלוק', 2400); return false; }
    }
    snd('travel');
    return startFade(FADE, function () {
      if (rv) rv.fuel = Math.max(0, rv.fuel - fuel);
      else st.needs.energy = Math.max(0, st.needs.energy - cost);
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
    startFade(SLEEP_FADE, function () { G.needs.sleep(st.needs, lv, diffLevel()); st.low = {}; G.story.emit('sleep', {}); },
      function () { snd('wake'); G.story.emit('wake', {}); save('sleep'); G.ui.toast('ישנתם. האנרגיה התמלאה', 2800); });
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
      if (st.ride) X.vehDismount();                    // the vehicle stays where it fell; setArea('base') tows it home
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
    G.story.reset(); G.storyUI.reset(); G.storyArt.forget();      // the story of the previous game never leaks into a new one
    st.diff =G.data.difficulty.levels[diffId] ? diffId : G.data.difficulty.default;
    st.needs = G.needs.create();
    st.buildings = G.crafting.startBuildings();
    st.fence = { material: 'wood' };
    st.creative = false; G.crafting.free = false;
    st.equip = G.gear.create(); st.player.outfit = st.equip;
    st.placed = []; st.floor = G.placing.createFloor(); st.placing = null; G.base.setChest(null);
    st.vehicles = {}; st.ride = null;
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

  // mode 'creative': a game for looking around. Everything is free and open, the needs never drop, the bag is full of gear.
  function newGame(diffId, mode) {
    resetWorld(diffId);
    if (mode === 'creative') {
      st.creative = true; G.crafting.free = true;
      st.buildings.bag = G.data.buildings.bag.levels.length; st.buildings.chest = G.data.buildings.chest.levels.length;
      st.bag = G.inventory.fromList(G.crafting.bagSlots(st.buildings), G.data.creativeKit);
      applyBuildings();
    }
    setScene('play');
    G.menu.hide();
    if (st.creative) { G.story.S = G.story.legacyState(); G.story.begin(true); G.ui.toast('מצב יצירתי: הכול חינם, כל המפה פתוחה, בלי רעב ובלי מוות', 5200); }
    else G.story.begin();
    save('new');
  }

  // Loads the save. Returns { ok: true } or { ok: false, reason }.
  function continueGame() {
    var r = G.save.read();
    if (!r.ok) return r;
    var d = r.data;
    resetWorld(d.diff);
    st.needs = d.needs; st.bag = d.bag; st.chest = d.chest; st.buildings = d.buildings; st.fence = d.fence; st.creative = !!d.creative; G.crafting.free = st.creative; st.equip = d.equip || G.gear.create(); st.player.outfit = st.equip; st.placed = d.placed; st.floor = d.floor; st.placing = null; G.base.setChest(d.chestAt);
    st.tank = d.tank; st.visits = d.visits; st.playTime = d.playTime;
    st.vehicles = d.vehicles || {}; st.ride = d.ride && st.vehicles[d.ride] ? d.ride : null;
    st.guns = d.guns;                                  // missing in older saves: a gun in the bag then starts with an empty magazine
    applyBuildings();
    st.trip = d.trip || {};
    st.wear = d.wear || {}; st.wearLife = d.wearLife || {};      // melee wear (the saved ids were checked against the weapons)
    if (d.story && !d.storyLegacy) G.story.load(d.story);        // a save made with the story
    else { G.story.S = G.story.legacyState(); G.story.begin(true); }   // an older save: everything open, no intro
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

  X.clearScene = clearScene; X.enterZone = enterZone; X.setArea = setArea; X.startFade = startFade; X.goThrough = goThrough; X.travel = travel; X.depart = depart; X.sleep = sleep; X.takeRain = takeRain; X.faint = faint; X.floater = floater; X.noteFull = noteFull; X.save = save; X.resetWorld = resetWorld; X.setScene = setScene; X.newGame = newGame; X.continueGame = continueGame; X.setPaused = setPaused; X.toMenu = toMenu; X.exit = exit;
})(window);
