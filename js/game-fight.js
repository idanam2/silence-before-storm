// Fighting: weapons, reloading, shots, blows, the infected and the raid at home.
// Part of the old js/game.js: all js/game-*.js files share one private object (G.gx); load order is in index.html.
(function (root) {
  'use strict';
  var G = root.G, X = G.gx = G.gx || {};
  var fxRand = X.fxRand, st = X.st;

  // functions of the other game-*.js files
  function diffLevel() { return X.diffLevel.apply(null, arguments); }
  function snd() { return X.snd.apply(null, arguments); }
  function at() { return X.at.apply(null, arguments); }
  function footsteps() { return X.footsteps.apply(null, arguments); }
  function floater() { return X.floater.apply(null, arguments); }
  function noteFull() { return X.noteFull.apply(null, arguments); }
  var uidSeq = 0;                // unique ids for the infected (used here only)

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
    if (st.equip && G.gear.refresh(st.equip, G.data.weaponOrder, function (wid) { return G.combat.canHold(st.bag, wid); })) G.ui.markDirty();   // weapon slots follow the backpack
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
    var gun = w.kind === 'gun';                       // a bullet: the shot itself is the sound, the impact only a dull thud under it
    snd('hit', at(fx, fy, { mat: 'flesh', heavy: res.killed || !gun, vol: gun ? 0.35 : 1 }));
    if (res.killed) { snd('growl', at(e.x, e.y, { kind: e.type, mood: 'die', delay: gun ? 0.08 : 0 })); snd('body', at(e.x, e.y, { delay: 0.75 })); }
    else if (!gun || Math.random() < 0.3) snd('growl', at(e.x, e.y, { kind: e.type, mood: 'hurt', gap: gun ? 1.2 : 0.5, key: e.uid, delay: gun ? 0.1 : 0 }));
    G.forestArt.spawnFx(st.particles, 'blood', fx, fy, res.killed ? 12 : 6, fxRand);
    if (w.kind !== 'gun') G.feel.kick(st.shake, e.x - from.x, e.y - from.y, G.feel.meleeKick(res.killed));   // feel: a tiny camera kick along the blow
    floater(e.x, e.y + 14, null, 0, (res.sneak ? 'מכה שקטה ' : '') + '-' + Math.round(res.dealt), res.sneak ? '#d8c07a' : '#d8a496');
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
    var dealt = G.needs.hurt(st.needs, dmg * (1 - G.gear.armor(st.equip)), diffLevel());    // worn clothes take a share of the blow
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
      if (st.zone && st.area !== 'base') {              // a sealed room: only an axe breaks the wall (hp blows, then it is open)
        var wl = G.area.wallNear(st.zone, p, w.range || 60);
        if (wl && w.id === 'axe') {
          var wr = G.area.hitWall(st.zone, wl.idx);
          snd('hit', at(wl.s.x + wl.s.w / 2, wl.s.y + wl.s.h / 2, { mat: 'wood', heavy: wr === 'broke' }));
          G.feel && G.feel.addShake && G.feel.addShake(st.shake, wr === 'broke' ? 5 : 2);
          if (wr === 'broke') { G.ui.toast('הקיר נשבר. החדר פתוח', 2000); }
        } else if (wl && !st.wallHint) { st.wallHint = true; G.ui.toast('הקיר חסום בקרשים. אפשר לשבור אותו רק בגרזן', 2600); }
      }
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
      } else if (ev.type === 'blow') snd('growl', at(q.x, q.y, { kind: q.type, mood: 'attack', gap: 0.4, key: q.uid }));
      else if (ev.type === 'scream') snd('growl', at(q.x, q.y, { kind: q.type, mood: 'scream', gap: 2, key: q.uid }));
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
    if (m.run && !st.ride && !G.needs.canRun(st.needs)) m.run = false;   // on a vehicle Shift is the boost: no energy needed
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
    G.ui.toast('דוממים עקבו אחריכם הביתה!', 2800);
  }

  // ---- free placement at home (rules and state: js/placing.js) ----------------------------------------------------

  X.equip = equip; X.cycleWeapon = cycleWeapon; X.checkHeld = checkHeld; X.breakMelee = breakMelee; X.startReload = startReload; X.stepReload = stepReload; X.breakGun = breakGun; X.hitEnemy = hitEnemy; X.lootEnemy = lootEnemy; X.fire = fire; X.attackInput = attackInput; X.fightArea = fightArea; X.damagePlayer = damagePlayer; X.combatStep = combatStep; X.tickFight = tickFight; X.moveInput = moveInput; X.raidStep = raidStep;
})(window);
