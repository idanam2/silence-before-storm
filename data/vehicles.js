// Vehicles (plain data, no logic; rules in js/vehicles.js, glue in js/game-vehicles.js, drawing in js/vehicleart.js).
// Each vehicle is built once in its garage (a placeable building, see data/buildings.js and the recipes of the garage stations in
// data/recipes.js), needs fuel (cans of the item `fuel`, one can = fuelPerCan units) and never costs the rider any energy.
//   speed      times the walking speed (running is off while riding)
//   fuelCap    tank size in units; the garage levels enlarge it (level 2: +50%, 3: x2, 4: x2.5)
//   per1000    units burnt per 1000 px driven (in an area)
//   perKm      units burnt per world-map km when travelling to a destination (instead of the energy a walk would cost)
//   fly        ignores trees, buildings, water (the helicopter)
//   ram        damage per second dealt to infected touching it (the tank and the jeep run them over)
//   len, wid   body size in px (drawing and the ram radius)
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  G.data.vehicleOrder = ['motorcycle', 'atv', 'jeep', 'heli', 'tank'];
  G.data.fuelPerCan = 10;

  G.data.vehicles = {
    motorcycle: { name: 'אופנוע',  garage: 'garage_moto', speed: 3.2, fuelCap: 14, per1000: 2.6, perKm: 0.5, len: 46, wid: 18, ram: 0,   color: '#8a3a2e' },
    atv:        { name: 'טרקטורון', garage: 'garage_moto', speed: 2.5, fuelCap: 22, per1000: 3.6, perKm: 0.8, len: 54, wid: 38, ram: 0,   color: '#4d5a3c' },
    jeep:       { name: "ג'יפ",     garage: 'garage_jeep', speed: 3.7, fuelCap: 34, per1000: 5.2, perKm: 1.1, len: 92, wid: 50, ram: 60,  color: '#5a6246' },
    heli:       { name: 'מסוק',     garage: 'garage_heli', speed: 5.0, fuelCap: 40, per1000: 8.5, perKm: 1.6, len: 110, wid: 40, ram: 0,  color: '#3f4c58', fly: true },
    tank:       { name: 'טנק',      garage: 'garage_tank', speed: 2.0, fuelCap: 48, per1000: 11,  perKm: 2.2, len: 120, wid: 70, ram: 400, color: '#4a5240' }
  };

  // Fuel drums: extra loot in the places where fuel makes sense, on the spots their scrap uses (loaded after data/areas.js and the places).
  // A visit picks `count` of the spots, like every other loot entry.
  var DRUMS = { port: 2, military: 2, airport: 2, quarry: 1, farm: 1, neighborhood: 1, police: 1 };
  Object.keys(DRUMS).forEach(function (id) {
    var A = G.data.areas && G.data.areas[id];
    if (!A || !A.loot) return;
    var base = A.loot.filter(function (l) { return l.type === 'scrap'; })[0];
    if (base && base.spots.length >= 2) A.loot.push({ type: 'fueldrum', count: DRUMS[id], spots: base.spots.slice().reverse() });
  });
})(typeof window !== 'undefined' ? window : globalThis);
