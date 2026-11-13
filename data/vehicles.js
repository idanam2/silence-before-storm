// Vehicles (plain data, no logic; rules in js/vehicles.js, glue in js/game-vehicles.js, drawing in js/vehicleart.js).
// Each vehicle is built once in its garage (a placeable building, see data/buildings.js and the recipes of the garage stations in
// data/recipes.js), needs fuel (cans of the item `fuel`, one can = fuelPerCan units) and never costs the rider any energy.
//   speed      times the walking speed (running is off while riding)
//   fuelCap    tank size in units; the garage levels enlarge it (level 2: +50%, 3: x2, 4: x2.5)
//   per1000    units burnt per 1000 px driven (in an area); a full tank lasts about 100-150 s of driving (bike 14/0.3 = 46000 px at 480 px/s)
//   perKm      units burnt per world-map km when travelling to a destination (instead of the energy a walk would cost)
//   fly        an aircraft (the helicopter)
//   (heli upgrades only change fuel use and tank: its speed is not used, the flight is paid by the km)
//   transport  not driven around an area: boarding it (V) opens the world map, and it flies from place to place (perKm fuel)
//   ram        damage per second dealt to infected touching it (the tank and the jeep run them over)
//   len, wid   body size in px (drawing and the ram radius)
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  G.data.vehicleOrder = ['motorcycle', 'atv', 'jeep', 'heli', 'tank'];
  G.data.fuelPerCan = 10;

  G.data.vehicles = {
    motorcycle: { name: 'אופנוע',  garage: 'garage_moto', speed: 3.2, fuelCap: 14, per1000: 0.3, perKm: 0.5, len: 46, wid: 18, ram: 0,   color: '#8a3a2e' },
    atv:        { name: 'טרקטורון', garage: 'garage_moto', speed: 2.5, fuelCap: 22, per1000: 0.5, perKm: 0.8, len: 54, wid: 38, ram: 0,   color: '#4d5a3c' },
    jeep:       { name: "ג'יפ",     garage: 'garage_jeep', speed: 3.7, fuelCap: 34, per1000: 0.55, perKm: 1.1, len: 92, wid: 50, ram: 60,  color: '#5a6246' },
    heli:       { name: 'מסוק',     garage: 'garage_heli', speed: 5.0, fuelCap: 40, per1000: 1.2, perKm: 0.8, len: 143, wid: 52, ram: 0,  color: '#3a4046', fly: true, transport: true },
    tank:       { name: 'טנק',      garage: 'garage_tank', speed: 2.0, fuelCap: 48, per1000: 1.1,  perKm: 2.2, len: 120, wid: 70, ram: 400, color: '#4a5240' }
  };

  // Upgrades fitted in the garage (the vehicle must stand inside it): each level uses up one part item (made at the garage bench).
  //   speed: + share of the speed per level, burn: + share of the fuel use per level (negative: thriftier), cap: + share of the tank per level.
  // A muddy vehicle (v.dirt 0..1, grows with the distance driven) is up to DIRT.speed slower and burns up to DIRT.burn more; washing (1 clean water) resets it.
  G.data.vehicleUpgrades = {
    motorcycle: [
      { id: 'wheels', name: 'גלגלים גדולים', icon: '🛞', max: 2, part: 'part_wheels', speed: 0.04, burn: -0.08, blurb: 'מהירות +4% וצריכת דלק -8% בכל רמה' },
      { id: 'engine', name: 'מנוע חזק',      icon: '⚙️', max: 3, part: 'part_engine', speed: 0.10, burn: 0,     blurb: 'מהירות +10% בכל רמה' },
      { id: 'tank',   name: 'מיכל דלק גדול', icon: '⛽', max: 2, part: 'part_tank',   cap: 0.25,               blurb: 'מיכל גדול ב-25% בכל רמה' }
    ]
  };
  G.data.vehicleUpgrades.atv = G.data.vehicleUpgrades.motorcycle;
  G.data.vehicleUpgrades.jeep = G.data.vehicleUpgrades.motorcycle;       // the jeep takes the same parts (made at its own garage bench)
  G.data.vehicleUpgrades.heli = [
    { id: 'engine', name: 'מנוע חזק',      icon: '⚙️', max: 3, part: 'part_engine', burn: -0.07, blurb: 'צריכת דלק -7% בכל רמה' },
    { id: 'rotor',  name: 'רוטור משופר',   icon: '🚁', max: 2, part: 'part_rotor',  burn: -0.08, blurb: 'צריכת דלק -8% בכל רמה' },
    { id: 'tank',   name: 'מיכל דלק גדול', icon: '⛽', max: 2, part: 'part_tank',   cap: 0.25,    blurb: 'מיכל גדול ב-25% בכל רמה' }
  ];
  G.data.vehicleUpgrades.tank = [
    { id: 'engine', name: 'מנוע חזק',      icon: '⚙️', max: 3, part: 'part_engine', speed: 0.08, blurb: 'מהירות +8% בכל רמה' },
    { id: 'tracks', name: 'זחלים רחבים',   icon: '⛓️', max: 2, part: 'part_tracks', speed: 0.05, burn: -0.06, blurb: 'מהירות +5% וצריכת דלק -6% בכל רמה' },
    { id: 'tank',   name: 'מיכל דלק גדול', icon: '⛽', max: 2, part: 'part_tank',   cap: 0.25,    blurb: 'מיכל גדול ב-25% בכל רמה' }
  ];

  // Assembling a vehicle in its garage (panel U): every part is fitted one by one, from the bag or the box, until all are on and the vehicle is complete.
  // Parts are made at the garage's own bench (data/recipes.js). st.builds = { vehicleId: { partItem: fitted } } holds the work in progress.
  G.data.vehicleBuild = {
    motorcycle: [{ part: 'part_frame', n: 1 }, { part: 'part_wheels', n: 2 }, { part: 'part_engine', n: 1 }, { part: 'part_tank', n: 1 }],
    atv:        [{ part: 'part_frame', n: 1 }, { part: 'part_wheels', n: 4 }, { part: 'part_engine', n: 1 }, { part: 'part_tank', n: 1 }],
    jeep:       [{ part: 'part_frame', n: 1 }, { part: 'part_wheels', n: 4 }, { part: 'part_engine', n: 1 }, { part: 'part_tank', n: 1 }],
    heli:       [{ part: 'part_frame', n: 2 }, { part: 'part_engine', n: 2 }, { part: 'part_rotor', n: 1 }, { part: 'part_tank', n: 1 }],
    tank:       [{ part: 'part_frame', n: 2 }, { part: 'part_engine', n: 2 }, { part: 'part_tracks', n: 2 }, { part: 'part_turret', n: 1 }, { part: 'part_tank', n: 1 }]
  };
  G.data.vehicleDirt = { speed: 0.1, burn: 0.15, per: 50000 };       // per: pixels driven for the vehicle to get completely muddy

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
