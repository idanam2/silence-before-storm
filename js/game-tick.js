// One simulation step: base, zone, survival, and the tick that runs them.
// Part of the old js/game.js: all js/game-*.js files share one private object (G.gx); load order is in index.html.
(function (root) {
  'use strict';
  var G = root.G, X = G.gx = G.gx || {};
  var cfg = X.cfg, cam = X.cam, fxRand = X.fxRand, AUTOSAVE = X.AUTOSAVE, ZERO = X.ZERO, PROMPTS = X.PROMPTS, LOW_NOTE = X.LOW_NOTE, pcfg = X.pcfg, st = X.st;

  // functions of the other game-*.js files
  function diffLevel() { return X.diffLevel.apply(null, arguments); }
  function snd() { return X.snd.apply(null, arguments); }
  function at() { return X.at.apply(null, arguments); }
  function footsteps() { return X.footsteps.apply(null, arguments); }
  function gatherMat() { return X.gatherMat.apply(null, arguments); }
  function goThrough() { return X.goThrough.apply(null, arguments); }
  function travel() { return X.travel.apply(null, arguments); }
  function sleep() { return X.sleep.apply(null, arguments); }
  function takeRain() { return X.takeRain.apply(null, arguments); }
  function faint() { return X.faint.apply(null, arguments); }
  function floater() { return X.floater.apply(null, arguments); }
  function noteFull() { return X.noteFull.apply(null, arguments); }
  function save() { return X.save.apply(null, arguments); }
  function setPaused() { return X.setPaused.apply(null, arguments); }
  function exit() { return X.exit.apply(null, arguments); }
  function equip() { return X.equip.apply(null, arguments); }
  function cycleWeapon() { return X.cycleWeapon.apply(null, arguments); }
  function checkHeld() { return X.checkHeld.apply(null, arguments); }
  function startReload() { return X.startReload.apply(null, arguments); }
  function attackInput() { return X.attackInput.apply(null, arguments); }
  function combatStep() { return X.combatStep.apply(null, arguments); }
  function tickFight() { return X.tickFight.apply(null, arguments); }
  function moveInput() { return X.moveInput.apply(null, arguments); }
  function raidStep() { return X.raidStep.apply(null, arguments); }
  function startPlacing() { return X.startPlacing.apply(null, arguments); }
  function stopPlacing() { return X.stopPlacing.apply(null, arguments); }
  function placingStep() { return X.placingStep.apply(null, arguments); }
  function storySpot() { return X.storySpot.apply(null, arguments); }
  function chimeStep() { return X.chimeStep.apply(null, arguments); }
  function follow() { return X.follow.apply(null, arguments); }
  function tickBase(dt, frozen) {
    var inp = G.input, p = st.player, ui = G.ui;
    var near = st.ride ? null : G.base.nearStation(p, st.base), trail = G.base.nearTrail(p);   // no workbench, chest or bed from the saddle
    var sp = storySpot('base', dt, frozen || ui.isOpen() || !!st.fade || !!st.placing);
    if (inp.wasPressed('KeyE') && !st.fade && !sp.sp) {
      if (ui.isOpen()) ui.close();
      else if (near === 'chest') ui.openChest();
      else if (near === 'bed') sleep();
      else if (near === 'tank') takeRain();
      else if (near) {
        G.story.emit('station', { id: near });          // the story may want to speak first (e.g. the radio on the workbench)
        if (!G.story.hasPending()) ui.openCraft(near);
      }
      else if (trail) ui.openMap();
    }
    if (inp.wasPressed('KeyB') && !st.fade) { stopPlacing(); ui.toggleBuild(); }
    if (inp.wasPressed('KeyT') && !st.fade && !ui.isOpen()) { if (st.placing && st.placing.kind === 'move') stopPlacing(); else { stopPlacing(); startPlacing({ kind: 'move', carry: null }); } }
    // Chest / crafting panels close by themselves if the player is somehow no longer next to the structure
    if (ui.mode() === 'chest' && near !== 'chest') ui.close();
    if (ui.mode() === 'craft' && near !== ui.station()) ui.close();

    frozen = frozen || ui.isOpen();
    st.near = near; st.gathering = false;
    X.vehKeys(p, frozen);                                    // V: climb on / off, F: refuel
    pcfg.walkSpeed = cfg.player.walkSpeed * G.needs.speedMult(st.needs);
    var riding = X.vehSpeed(pcfg, cfg.player.walkSpeed);
    var aim = !riding && !frozen && inp.mouse.inside ? { x: inp.mouse.x + cam.x, y: inp.mouse.y + cam.y } : null;   // the vehicle points where it drives
    G.player.update(p, frozen || sp.holding ? ZERO : moveInput(), aim, dt, st.world, pcfg);
    raidStep(dt, frozen);                                   // a loud trip may have been followed home
    var raid = G.defense.active(st.def);
    if (st.placing && !frozen) placingStep(dt, inp);
    if (!frozen && !st.placing && !riding) attackInput(p, inp, raid);   // guns (and their cost) work at home only while raiders are here
    G.player.animate(p, dt, null);
    if (!(riding && G.data.vehicles[st.ride].fly)) G.base.collide(p, st.base.solids);   // the helicopter flies over the base
    X.vehStep(dt, p);
    G.area.updateVisuals({ nodes: st.base.trees }, p, dt);
    if (!frozen && !st.ride) footsteps(p, 1, 'me');
    if (G.audio) G.audio.tension(0);
    if (raid) combatStep(dt, frozen);
    if (G.defense.finished(st.def, st.enemies)) { G.ui.toast('הבסיס שקט שוב', 2000); save('raid'); }

    var text = null;
    if (!frozen) {
      if (near === 'bed') text = st.needs.energy >= 95 ? 'מיטה · אינכם עייפים' : 'E · שינה';
      else if (near === 'tank') text = st.tank.amount > 0 ? 'E · איסוף מי גשם (' + st.tank.amount + ')' : 'מיכל גשם · מתמלא לאט';
      else text = PROMPTS[near] || (trail ? 'E · מפת העולם' : null);
      var vp = X.vehPrompt(p);
      if (vp) text = text ? text + ' · ' + vp : vp;
      if (sp.sp) text = G.story.spotPrompt(sp.sp);
      if (st.placing) text = null;
    }
    ui.showPrompt(text);
  }

  function tickZone(dt, frozen) {
    var inp = G.input, p = st.player, ui = G.ui, F = st.zone;
    var res = G.data.resources, items = G.data.items;
    var target = G.area.findTarget(F, p);
    var sp = storySpot(F.id, dt, frozen || ui.isOpen() || !!st.fade);
    if (sp.sp) target = null;                       // a story object in reach wins over exits, doors and gathering
    chimeStep(dt, frozen || ui.isOpen() || !!st.fade);

    if (inp.wasPressed('KeyE') && !st.fade && !sp.sp) {
      if (ui.isOpen()) ui.close();
      else if (target && target.kind === 'exit') travel('base');
      else if (target && target.kind === 'door') goThrough(target.door);
    }
    frozen = frozen || ui.isOpen() || !!st.fade;

    X.vehKeys(p, frozen);                            // V: climb on / off, F: refuel
    var held = !frozen && inp.isDown('KeyE') && !sp.sp && !st.ride;      // no gathering from the saddle
    var out = G.area.gatherStep(st.gather, target, held, dt * G.needs.gatherMult(st.needs), st.bag, res, items);
    st.gathering = out.active;
    var def = target && target.node ? res[target.node.type] : null;
    if (out.hit && def) {
      snd('hit', at(target.x, target.y, { mat: gatherMat(def), heavy: !!out.done }));
      G.forestArt.spawnFx(st.particles, def.fx, target.x, target.y, out.done ? 12 : 5, fxRand);
      G.combat.addBurst(st.burst, def.tool ? G.data.noise.chop : G.data.noise.gather);     // chopping carries far
    }
    if (out.done) {
      if (out.done.gained) { snd('pickup'); floater(p.x, p.y, out.done.item, out.done.gained); ui.markDirty(); G.story.emit('item_gain', { item: out.done.item, n: out.done.gained, src: 'gather' }); }
      if (out.done.left) noteFull(p);
    }
    if (out.blocked === 'full') noteFull(p);

    pcfg.walkSpeed = cfg.player.walkSpeed * G.needs.speedMult(st.needs);
    var riding = X.vehSpeed(pcfg, cfg.player.walkSpeed);
    var aim = out.active ? { x: target.x, y: target.y }
      : (!riding && !frozen && inp.mouse.inside ? { x: inp.mouse.x + cam.x, y: inp.mouse.y + cam.y } : null);
    G.player.update(p, frozen || out.active || sp.holding ? ZERO : moveInput(), aim, dt, st.world, pcfg);
    if (!frozen && !out.active && !riding) attackInput(p, inp, true);
    G.player.animate(p, dt, out.active ? { tool: def ? def.tool : null, phase: (st.gather.t % G.area.HIT) / G.area.HIT } : null);
    if (!(riding && G.data.vehicles[st.ride].fly)) G.area.collide(p, F);       // the helicopter flies over trees and walls
    X.vehStep(dt, p);
    if (!frozen && !st.ride) footsteps(p, 1, 'me');
    combatStep(dt, frozen);
    G.area.updateVisuals(F, p, dt);

    // Prompt + highlight for whatever is in reach (re-checked after a harvest changed things)
    if (target && target.kind === 'node' && target.node.dead) target = null;
    st.target = frozen ? null : target;
    st.targetBlock = null;
    var text = null;
    if (sp.sp && !frozen) text = G.story.spotPrompt(sp.sp);
    else if (st.target) {
      if (target.kind === 'exit') text = 'E · חזרה לבסיס';
      else if (target.kind === 'door') text = 'E · ' + target.door.label;
      else {
        st.targetBlock = G.area.check(target, st.bag, res, items);
        if (st.targetBlock === 'tool') text = def.action + ' · דרוש ' + items[def.tool].name;
        else if (st.targetBlock === 'full') text = 'התיק מלא · חזרו לבסיס לפרוק';
        else text = 'E (החזקה) · ' + def.action;
      }
    }
    var vp = !frozen && X.vehPrompt(p);
    if (vp) text = text ? text + ' · ' + vp : vp;
    ui.showPrompt(text);
  }

  // Needs, rain tank and the autosave timer. Time stands still while a panel is open or a fade runs.
  function tickSurvival(dt) {
    var p = st.player, k, n = st.needs;
    G.tank.step(st.tank, st.buildings.tank || 0, dt, G.placing.count(st.placed, 'tank'));
    if (st.fade || G.ui.isOpen()) return;
    if (st.creative) {                                // creative mode: nothing drains, and a blow never sticks
      for (k in n) if (typeof n[k] === 'number') n[k] = Math.min(G.data.needs.max, n[k] + (k === 'health' ? 30 * dt : G.data.needs.max));
      if (n.health < 1) n.health = 1;
      st.sinceSave += dt;
      if (st.sinceSave >= AUTOSAVE) save('auto');
      return;
    }
    if (n.health <= 0) { faint(); return; }          // a blow took the last health this step: no slow regeneration first
    G.needs.drain(n, dt, { moving: p.moving && !st.ride, running: p.running && !st.ride, gathering: st.gathering }, diffLevel());   // riding costs no energy (it burns fuel instead)
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
    if (G.storyUI.active()) {                        // a dialogue, note or the journal is open: the world stands still
      G.storyUI.step(inp);
      ui.showPrompt(null);
      G.player.update(st.player, ZERO, null, dt, st.world, pcfg);     // the figure settles into standing
      G.player.animate(st.player, dt, null);
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
    if (!st.fade && !st.placing && !ui.isOpen() && inp.wasPressed('KeyJ')) { G.storyUI.openJournal(); return; }

    // 1-5 pick up a weapon from the backpack (hands always work). Losing the item puts the hands back to empty.
    if (!st.fade && !ui.isOpen()) {
      // 1 = primary weapon, 2 = secondary (both chosen in the backpack screen), 3 = empty hands
      if (inp.wasPressed('Digit1')) { if (st.equip.primary) equip(st.equip.primary); else ui.toast('אין נשק ראשי · בחרו בתיק (I)', 1600); }
      if (inp.wasPressed('Digit2')) { if (st.equip.secondary) equip(st.equip.secondary); else ui.toast('אין נשק משני · בחרו בתיק (I)', 1600); }
      if (inp.wasPressed('Digit3')) equip('hands');
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

    // Story: bring up whatever is queued (dialogue, note) once nothing else is in the way; re-check the state now and then.
    if (st.ticks % 20 === 0) G.story.poll();
    if (!st.fade && !ui.isOpen() && !G.storyUI.active() && G.story.queueSize()) {
      var it = G.story.pump();
      if (it) G.storyUI.open(it);
    }
    G.storyArt.tick(dt, st.area === 'base' ? 'base' : st.zone.id, st.player, st.world);

    tickFight(dt);
    tickSurvival(dt);
    follow(dt);
    st.ticks++;
  }


  X.tickBase = tickBase; X.tickZone = tickZone; X.tickSurvival = tickSurvival; X.tick = tick;
})(window);
