// Vehicle rules: ownership, fuel and the parked position. Pure logic, unit-tested in Node. Data: data/vehicles.js.
// State: st.vehicles = { vehicleId: { fuel, at, up, dirt } } for every vehicle the player built (at = null: parked inside its garage,
// otherwise { area, x, y, angle }: where it was left; up = { upgradeId: level } fitted in the garage; dirt 0..1); st.ride = the vehicle being ridden, or null.
(function (root) {
  'use strict';
  var G = root.G;

  function def(id) { return G.data.vehicles[id]; }

  var vehicles = {
    def: def,

    create: function () { return { fuel: 0, at: null, up: {}, dirt: 0 }; },

    // ---- upgrades fitted in the garage (data/vehicles.js, vehicleUpgrades) and mud ----
    upgradesFor: function (id) { return G.data.vehicleUpgrades[id] || []; },
    upLevel: function (v, upId) { return v && v.up && v.up[upId] > 0 ? v.up[upId] : 0; },
    // Sum of one effect key ('speed' | 'burn' | 'cap') over the fitted upgrades, level times the share per level.
    upSum: function (id, v, key) {
      var sum = 0;
      vehicles.upgradesFor(id).forEach(function (u) { if (u[key]) sum += u[key] * vehicles.upLevel(v, u.id); });
      return sum;
    },
    // Speed factor: upgrades make it faster, mud slower (up to G.data.vehicleDirt.speed).
    speedMult: function (id, v) { return Math.max(0.3, 1 + vehicles.upSum(id, v, 'speed') - G.data.vehicleDirt.speed * (v && v.dirt || 0)); },
    burnMult: function (id, v) { return Math.max(0.3, 1 + vehicles.upSum(id, v, 'burn') + G.data.vehicleDirt.burn * (v && v.dirt || 0)); },
    dirtAdd: function (v, px) { v.dirt = Math.min(1, (v.dirt || 0) + px / G.data.vehicleDirt.per); },

    // ---- assembling a vehicle in its garage (data/vehicles.js, vehicleBuild): builds = { vehicleId: { partItem: fitted } } ----
    buildList: function (id) { return G.data.vehicleBuild[id] || []; },
    builtCount: function (builds, id, part) { return builds && builds[id] && builds[id][part] > 0 ? builds[id][part] : 0; },
    buildDone: function (builds, id) {
      var list = vehicles.buildList(id);
      return list.length > 0 && list.every(function (x) { return vehicles.builtCount(builds, id, x.part) >= x.n; });
    },
    // Fits one part of the vehicle under construction (bag first, then chest; free in creative mode).
    // { ok, fitted, need, done } or { ok: false, reason: 'unknown' | 'full' | 'part' }. `done`: this was the last missing part.
    assemble: function (builds, id, part, bag, chest) {
      var need = vehicles.buildList(id).filter(function (x) { return x.part === part; })[0];
      if (!need) return { ok: false, reason: 'unknown' };
      var got = vehicles.builtCount(builds, id, part);
      if (got >= need.n) return { ok: false, reason: 'full' };
      if (!(G.crafting && G.crafting.free) && !(G.inventory.remove(bag, part, 1) || G.inventory.remove(chest, part, 1))) return { ok: false, reason: 'part' };
      builds[id] = builds[id] || {}; builds[id][part] = got + 1;
      return { ok: true, fitted: got + 1, need: need.n, done: vehicles.buildDone(builds, id) };
    },
    // Safe copy of the work in progress from a save: known vehicles that are not built yet, known parts, no more than needed.
    cleanBuilds: function (o, owned) {
      var out = {};
      if (!o || typeof o !== 'object') return out;
      G.data.vehicleOrder.forEach(function (id) {
        if (owned && owned[id] || !o[id] || typeof o[id] !== 'object') return;
        var b = {};
        vehicles.buildList(id).forEach(function (x) { if (o[id][x.part] > 0) b[x.part] = Math.min(x.n, Math.floor(o[id][x.part])); });
        if (Object.keys(b).length) out[id] = b;
      });
      return out;
    },

    // Fits the next level of an upgrade: needs the part item (bag first, then chest). { ok, level } or { ok: false, reason: 'unknown' | 'max' | 'part' }.
    install: function (v, id, upId, bag, chest) {
      var u = vehicles.upgradesFor(id).filter(function (x) { return x.id === upId; })[0];
      if (!u || !v) return { ok: false, reason: 'unknown' };
      var lv = vehicles.upLevel(v, upId);
      if (lv >= u.max) return { ok: false, reason: 'max' };
      if (!(G.crafting && G.crafting.free) && !(G.inventory.remove(bag, u.part, 1) || G.inventory.remove(chest, u.part, 1))) return { ok: false, reason: 'part' };
      v.up = v.up || {}; v.up[upId] = lv + 1;
      return { ok: true, level: lv + 1 };
    },
    // Washes the vehicle with 1 clean water (bag first, then chest). { ok } or { ok: false, reason: 'clean' | 'water' }.
    wash: function (v, bag, chest) {
      if (!(v.dirt > 0.02)) return { ok: false, reason: 'clean' };
      if (!(G.inventory.remove(bag, 'water_clean', 1) || G.inventory.remove(chest, 'water_clean', 1))) return { ok: false, reason: 'water' };
      v.dirt = 0;
      return { ok: true };
    },

    // Tank size: the garage level (level 2: +50%, level 3: x2, level 4: x2.5) and the fitted tank upgrades.
    cap: function (id, buildings, v) {
      var d = def(id), lv = Math.max(1, Math.min(4, (buildings && buildings[d.garage]) || 1));
      return Math.round(d.fuelCap * [1, 1, 1.5, 2, 2.5][lv] * (1 + vehicles.upSum(id, v, 'cap')));
    },

    // Fuel units a trip of `km` costs (0 when it is free to ride, see perKm).
    tripFuel: function (id, km) { return Math.ceil(def(id).perKm * km); },

    // Burns fuel for `px` driven. Returns true while there is fuel left.
    drain: function (v, id, px) {
      v.fuel = Math.max(0, v.fuel - def(id).per1000 * vehicles.burnMult(id, v) * px / 1000);
      return v.fuel > 0.0001;
    },

    // Pours fuel cans (bag first, then chest; G.data.fuelPerCan units each) until the tank is full. Returns { cans, added }.
    refuel: function (v, id, buildings, bag, chest) {
      var cap = vehicles.cap(id, buildings, v), per = G.data.fuelPerCan, cans = 0, added = 0;
      while (cap - v.fuel >= 1) {
        var took = G.inventory.remove(bag, 'fuel', 1) || G.inventory.remove(chest, 'fuel', 1);
        if (!took) break;
        var add = Math.min(per, cap - v.fuel);
        v.fuel += add; added += add; cans++;
      }
      return { cans: cans, added: added };
    },

    // The garage rectangle a vehicle belongs to (its first copy in the yard, or the old fixed spot), or null.
    garageRect: function (id, placed) {
      var d = def(id), list = G.placing.list(placed, d.garage), s = G.data.buildings[d.garage].spot;
      return list.length ? { x: list[0].x, y: list[0].y, w: s.w, h: s.h } : { x: s.x, y: s.y, w: s.w, h: s.h };
    },
    // Where a vehicle that is not being ridden stands in the area `area`: where it was left, or inside its garage at home
    // (nose to the south, towards the open door). `placed` = the placed structures (js/placing.js). Returns { x, y, angle } or null (not here).
    // A `transport` vehicle (the helicopter) at home always sits on its pad, in the middle of the painted circle (vehicles.pad), whatever an old save says.
    pad: function (r) { return { x: r.x + r.w / 2, y: r.y + r.h * 0.55 }; },
    position: function (id, v, area, placed) {
      var d = def(id), r = vehicles.garageRect(id, placed);
      if (d.transport && area === 'base' && (!v.at || v.at.area === 'base')) { var pd = vehicles.pad(r); return { x: pd.x, y: pd.y, angle: Math.PI / 2 }; }
      if (v.at) return v.at.area === area ? { x: v.at.x, y: v.at.y, angle: v.at.angle || 0 } : null;
      if (area !== 'base') return null;
      var mates = G.data.vehicleOrder.filter(function (o) { return def(o).garage === d.garage; }), slot = mates.indexOf(id);       // the vehicles of one garage park side by side
      return { x: r.x + r.w * (slot + 0.5) / mates.length, y: r.y + r.h - d.len / 2 - 12, angle: Math.PI / 2 };
    },
    // Is the point (x, y) inside the garage of vehicle `id` (built and placed; a little slack at the door)? A vehicle left there parks in its place.
    garageAt: function (id, x, y, placed, buildings) {
      var d = def(id);
      if (!(buildings && buildings[d.garage] > 0) || !G.placing.list(placed, d.garage).length) return false;
      var r = vehicles.garageRect(id, placed);
      return x > r.x + 4 && x < r.x + r.w - 4 && y > r.y + 4 && y < r.y + r.h + 24;
    },
    // The ground the parked vehicle covers, as a rect (its hull turned to its heading): you cannot walk through it.
    solid: function (id, q) {
      var d = def(id), c = Math.abs(Math.cos(q.angle || 0)), s = Math.abs(Math.sin(q.angle || 0)), hl = d.len * 0.42, hw = d.wid * 0.45;
      var w = hl * c + hw * s, h = hl * s + hw * c;
      return { x: q.x - w, y: q.y - h, w: w * 2, h: h * 2, kind: 'vehicle', veh: id };
    },
    // Is the vehicle standing inside its garage (so it can be upgraded and washed there)?
    inGarage: function (id, v, area, placed) {
      var q = vehicles.position(id, v, area, placed), r = vehicles.garageRect(id, placed);
      return !!q && area === 'base' && q.x > r.x + 6 && q.x < r.x + r.w - 6 && q.y > r.y + 6 && q.y < r.y + r.h;
    },

    // Safe copy from a save: known vehicles only, fuel inside the tank, a parked position inside the world.
    clean: function (list, buildings) {
      var out = {};
      if (!list || typeof list !== 'object') return out;
      G.data.vehicleOrder.forEach(function (id) {
        var v = list[id];
        if (!v || typeof v !== 'object') return;
        var f = typeof v.fuel === 'number' && isFinite(v.fuel) ? v.fuel : 0, at = null;
        if (v.at && typeof v.at.area === 'string' && isFinite(v.at.x) && isFinite(v.at.y) && (v.at.area === 'base' || G.data.areas.hasOwnProperty(v.at.area))) {
          at = { area: v.at.area, x: Math.round(v.at.x), y: Math.round(v.at.y), angle: isFinite(v.at.angle) ? v.at.angle : 0 };
        }
        var up = {}, uo = v.up && typeof v.up === 'object' ? v.up : {};
        vehicles.upgradesFor(id).forEach(function (u) { if (uo[u.id] > 0) up[u.id] = Math.min(u.max, Math.floor(uo[u.id])); });
        var dirt = typeof v.dirt === 'number' && isFinite(v.dirt) ? Math.max(0, Math.min(1, v.dirt)) : 0;
        out[id] = { fuel: Math.max(0, Math.min(f, vehicles.cap(id, buildings, { up: up }))), at: at, up: up, dirt: Math.round(dirt * 1000) / 1000 };
      });
      return out;
    }
  };

  G.vehicles = vehicles;
})(typeof window !== 'undefined' ? window : globalThis);
