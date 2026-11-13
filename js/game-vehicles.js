// Riding vehicles: mount / dismount (V), refuel (F), speed, fuel use, ramming and the fuel gauge.
// Part of the main loop: all js/game-*.js files share one private object (G.gx); load order is in index.html.
// Rules and data: js/vehicles.js, data/vehicles.js. State: st.vehicles = { id: { fuel, at } }, st.ride = id | null.
(function (root) {
  'use strict';
  var G = root.G, X = G.gx = G.gx || {};
  var st = X.st;
  var REACH = 110, hud = null, hudText = '', angle = 0;

  function snd() { return X.snd.apply(null, arguments); }
  function save() { return X.save.apply(null, arguments); }
  function V() { return G.vehicles; }

  function pos(id) { return V().position(id, st.vehicles[id], st.area, st.placed); }

  // The vehicle the player can climb onto / refuel: the closest one parked in this area within reach.
  function nearVehicle(p) {
    var best = null, bd = REACH * REACH;
    G.data.vehicleOrder.forEach(function (id) {
      if (!st.vehicles[id] || st.ride === id) return;
      var q = pos(id);
      if (!q) return;
      var dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = id; }
    });
    return best;
  }

  function mount(id) {
    var v = st.vehicles[id], q = pos(id), p = st.player;
    if (!v || !q) return;
    if (v.fuel < 0.5) { snd('uiBad'); G.ui.toast('אין דלק ב' + G.data.vehicles[id].name + ' · F לתדלוק מג׳ריקנים', 2200); return; }
    v.at = null; st.ride = id; angle = q.angle || 0;
    snd('door'); G.ui.toast('על ' + G.data.vehicles[id].name + ' · V לרדת, F לתדלוק', 1800);
  }

  function dismount(why) {
    var id = st.ride, p = st.player;
    if (!id) return;
    var v = st.vehicles[id];
    v.at = { area: st.area, x: Math.round(p.x), y: Math.round(p.y), angle: angle };
    st.ride = null; p.moving = false; p.running = false;
    if (why) G.ui.toast(why, 2400);
    if (!st.fade) save('dismount');                 // (during a fade the scene is half switched: the arrival saves)
  }

  function refuel(id) {
    var v = st.vehicles[id], cap = V().cap(id, st.buildings);
    if (v.fuel > cap - 1) { G.ui.toast('המיכל מלא', 1200); return; }
    var r = V().refuel(v, id, st.buildings, st.bag, st.chest);
    if (!r.cans) { snd('uiBad'); G.ui.toast("אין ג'ריקני דלק בתיק ובמחסן", 1800); return; }
    snd('pickup'); G.ui.markDirty();
    G.ui.toast('תודלק: +' + Math.round(r.added) + ' (' + Math.round(v.fuel) + '/' + cap + ')', 1800);
    save('fuel');
  }

  // Keys V (mount / dismount) and F (refuel). Not while a panel is open or placing.
  function keys(p, frozen) {
    var inp = G.input;
    if (frozen || st.fade || st.placing || G.ui.isOpen()) return;
    if (inp.wasPressed('KeyV')) {
      if (st.ride) dismount(); else { var n = nearVehicle(p); if (n) mount(n); }
    }
    if (inp.wasPressed('KeyF')) {
      var id = st.ride || nearVehicle(p);
      if (id) refuel(id);
    }
  }

  // Walking speed while riding: the vehicle's, no running, and no energy cost (needs.drain gets `moving` false, see game-tick).
  function speed(pcfg, base) {
    if (!st.ride) { pcfg.runMult = X.cfg.player.runMult; return false; }
    pcfg.walkSpeed = base * G.data.vehicles[st.ride].speed;
    pcfg.runMult = 1;
    return true;
  }

  // After the player moved and collided: heading, fuel use, ramming, out-of-fuel.
  function step(dt, p) {
    if (!st.ride) return;
    var id = st.ride, d = G.data.vehicles[id], v = st.vehicles[id];
    var dx = p.x - p.prevX, dy = p.y - p.prevY, moved = Math.sqrt(dx * dx + dy * dy);
    if (moved > 0.4) {                                              // the heading follows the way it drives, smoothly
      var a = Math.atan2(dy, dx), da = Math.atan2(Math.sin(a - angle), Math.cos(a - angle));
      angle += da * (1 - Math.exp(-9 * dt));
    }
    if (!V().drain(v, id, moved)) { dismount('נגמר הדלק · ' + d.name + ' נשאר כאן. ג׳ריקן + F לתדלוק'); return; }
    if (d.ram && moved > 0.5) {                                     // run the infected over (not the dead, not too often per body)
      var r = d.len / 2 + 14;
      for (var i = 0; i < st.enemies.length; i++) {
        var e = st.enemies[i];
        if (e.state === 'dead' || e.state === 'dying') continue;
        var ex = e.x - p.x, ey = e.y - p.y;
        if (ex * ex + ey * ey > r * r) continue;
        e.ramT = (e.ramT || 0) - dt;
        if (e.ramT > 0) continue;
        e.ramT = 0.3;
        X.hitEnemy(e, d.ram * 0.3, { kind: 'ram', knock: 160, stun: 0.6 }, e.x, e.y, { x: p.x, y: p.y });
      }
    }
    var cap = V().cap(id, st.buildings), q = v.fuel / cap;
    if (q < 0.2 && !v.warned) { v.warned = true; G.ui.toast('הדלק אוזל (' + Math.round(v.fuel) + ')', 1800); }
    if (q >= 0.2) v.warned = false;
  }

  // The bottom-of-screen hint near a vehicle (null when there is none).
  function prompt(p) {
    if (st.ride) return null;
    var id = nearVehicle(p);
    if (!id) return null;
    var v = st.vehicles[id];
    return 'V · עלייה ל' + G.data.vehicles[id].name + ' · דלק ' + Math.round(v.fuel) + '/' + V().cap(id, st.buildings) + ' · F לתדלוק';
  }

  // Things to draw: every owned vehicle that stands in this area (the ridden one sorts just under the player).
  function items(alpha) {
    var out = [], p = st.player;
    G.data.vehicleOrder.forEach(function (id) {
      var v = st.vehicles[id];
      if (!v) return;
      if (st.ride === id && G.data.vehicles[id].fly) return;                  // a flying helicopter is drawn over everything (flying())
      if (st.ride === id) {
        var x = G.util.lerp(p.prevX, p.x, alpha), y = G.util.lerp(p.prevY, p.y, alpha);
        out.push({ y: y + (G.vehicleArt.covers(id) ? 1 : -1), veh: { id: id, x: x, y: y, angle: angle, ridden: true, moving: p.moving } });   // a closed cab hides the rider
      } else { var q = pos(id); if (q) out.push({ y: q.y, veh: { id: id, x: q.x, y: q.y, angle: q.angle, ridden: false } }); }
    });
    return out;
  }
  // The ridden helicopter, to draw last: it flies over roofs and treetops.
  function flying(alpha) {
    if (!st.ride || !G.data.vehicles[st.ride].fly) return null;
    var p = st.player;
    return { id: st.ride, x: G.util.lerp(p.prevX, p.x, alpha), y: G.util.lerp(p.prevY, p.y, alpha), angle: angle, ridden: true, moving: p.moving };
  }
  function hidesRider() { return !!st.ride && G.vehicleArt.covers(st.ride); }

  // A small fuel gauge while riding (created on first use).
  function gauge() {
    if (!hud && root.document) {
      hud = root.document.createElement('div');
      hud.id = 'fuel-hud';
      root.document.body.appendChild(hud);
    }
    if (!hud) return;
    var text = '';
    if (st.ride && st.scene === 'play') {
      var id = st.ride, v = st.vehicles[id], cap = V().cap(id, st.buildings);
      text = G.data.vehicles[id].name + ' · דלק <b>' + Math.round(v.fuel) + '</b>/' + cap +
        '<i><u style="width:' + Math.round(100 * v.fuel / cap) + '%"></u></i>';
    }
    if (text !== hudText) { hudText = text; hud.innerHTML = text; hud.classList.toggle('show', !!text); }
  }

  // Back home or fainted: vehicles left in another area are towed to their garage.
  function areaChanged(area) {
    for (var id in st.vehicles) if (st.vehicles[id].at && st.vehicles[id].at.area !== area && area === 'base') st.vehicles[id].at = null;
  }

  X.vehNear = nearVehicle; X.vehKeys = keys; X.vehSpeed = speed; X.vehStep = step; X.vehPrompt = prompt; X.vehItems = items; X.vehHides = hidesRider; X.vehFlying = flying;
  X.vehGauge = gauge; X.vehDismount = dismount; X.vehAreaChanged = areaChanged; X.vehMount = mount; X.vehRefuel = refuel;
})(window);
