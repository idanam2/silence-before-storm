// Vehicle rules: ownership, fuel and the parked position. Pure logic, unit-tested in Node. Data: data/vehicles.js.
// State: st.vehicles = { vehicleId: { fuel, at } } for every vehicle the player built (at = null: parked at its garage,
// otherwise { area, x, y, angle }: where it was left); st.ride = the vehicle being ridden, or null.
(function (root) {
  'use strict';
  var G = root.G;

  function def(id) { return G.data.vehicles[id]; }

  var vehicles = {
    def: def,

    create: function () { return { fuel: 0, at: null }; },

    // Tank size, with the garage upgrades (level 2: +50%, level 3: x2, level 4: x2.5).
    cap: function (id, buildings) {
      var d = def(id), lv = Math.max(1, Math.min(4, (buildings && buildings[d.garage]) || 1));
      return Math.round(d.fuelCap * [1, 1, 1.5, 2, 2.5][lv]);
    },

    // Fuel units a trip of `km` costs (0 when it is free to ride, see perKm).
    tripFuel: function (id, km) { return Math.ceil(def(id).perKm * km); },

    // Burns fuel for `px` driven. Returns true while there is fuel left.
    drain: function (v, id, px) {
      v.fuel = Math.max(0, v.fuel - def(id).per1000 * px / 1000);
      return v.fuel > 0.0001;
    },

    // Pours fuel cans (bag first, then chest; G.data.fuelPerCan units each) until the tank is full. Returns { cans, added }.
    refuel: function (v, id, buildings, bag, chest) {
      var cap = vehicles.cap(id, buildings), per = G.data.fuelPerCan, cans = 0, added = 0;
      while (cap - v.fuel >= 1) {
        var took = G.inventory.remove(bag, 'fuel', 1) || G.inventory.remove(chest, 'fuel', 1);
        if (!took) break;
        var add = Math.min(per, cap - v.fuel);
        v.fuel += add; added += add; cans++;
      }
      return { cans: cans, added: added };
    },

    // Where a vehicle that is not being ridden stands in the area `area`: where it was left, or in front of its garage at home.
    // `placed` = the placed structures (js/placing.js). Returns { x, y, angle } or null (not here).
    position: function (id, v, area, placed) {
      if (v.at) return v.at.area === area ? { x: v.at.x, y: v.at.y, angle: v.at.angle || 0 } : null;
      if (area !== 'base') return null;
      var d = def(id), list = G.placing.list(placed, d.garage);
      var r = list.length ? { x: list[0].x, y: list[0].y } : { x: G.data.buildings[d.garage].spot.x, y: G.data.buildings[d.garage].spot.y };
      var s = G.data.buildings[d.garage].spot, slot = id === 'atv' ? 1 : 0;       // the two vehicles of one garage park side by side
      var n = G.data.vehicleOrder.filter(function (o) { return def(o).garage === d.garage; }).length;
      return { x: r.x + s.w * (slot + 0.5) / n, y: r.y + s.h + d.len / 2 + 6, angle: Math.PI / 2 };   // nose to the south, just outside the door
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
        out[id] = { fuel: Math.max(0, Math.min(f, vehicles.cap(id, buildings))), at: at };
      });
      return out;
    }
  };

  G.vehicles = vehicles;
})(typeof window !== 'undefined' ? window : globalThis);
