// Crafting recipes (plain data, no logic). Crafting is instant: it only costs materials.
// station: 'workbench' | 'campfire' | 'rack' (must be built, and the player must stand next to it).
// level: minimum level of that station. out: [itemId, amount]. cost: { itemId: amount }.
// cat: which category tab the recipe shows under (see G.data.recipeCats; the first tab shows everything).
// Materials are taken from the backpack first, then from the chest.
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  // Tabs of the crafting panel. 'all' is the general one with everything; a tab shows only if the station has recipes in it.
  G.data.recipeCats = [
    { id: 'all',     name: 'הכול' },
    { id: 'home',    name: 'בית וציוד' },
    { id: 'weapons', name: 'נשקים' },
    { id: 'ammo',    name: 'תחמושת' },
    { id: 'food',    name: 'אוכל ומים' },
    { id: 'vehicles', name: 'כלי רכב' },
    { id: 'parts',    name: 'חלקים' }
  ];

  G.data.recipes = [
    { id: 'gasmask',    station: 'workbench', level: 2, cat: 'home',   out: ['gasmask', 1],      cost: { cloth: 4, metal: 3, plank: 1 } },
    { id: 'plank',      station: 'workbench', level: 1, cat: 'home',    out: ['plank', 2],        cost: { wood: 2 } },
    { id: 'axe',        station: 'workbench', level: 1, cat: 'home',    out: ['axe', 1],          cost: { wood: 2, stone: 3 } },
    { id: 'pickaxe',    station: 'workbench', level: 1, cat: 'home',    out: ['pickaxe', 1],      cost: { wood: 2, stone: 4, plank: 1 } },
    { id: 'bandage',    station: 'workbench', level: 1, cat: 'home',    out: ['bandage', 1],      cost: { cloth: 2 } },
    { id: 'nails',      station: 'workbench', level: 1, cat: 'home',    out: ['nails', 4],        cost: { metal: 1 } },
    { id: 'club',       station: 'workbench', level: 2, cat: 'weapons', out: ['club', 1],         cost: { wood: 3, nails: 4 }, unlock: 'unlock_club' },
    { id: 'pistol',     station: 'workbench', level: 2, cat: 'weapons', out: ['pistol', 1],       cost: { metal: 5, plank: 2, nails: 2 } },
    { id: 'uzi',        station: 'workbench', level: 2, cat: 'weapons', out: ['uzi', 1],          cost: { metal: 8, plank: 1, nails: 3 } },
    { id: 'm16',        station: 'workbench', level: 2, cat: 'weapons', out: ['m16', 1],          cost: { metal: 10, plank: 2, electronics: 1 } },
    { id: 'ak47',       station: 'workbench', level: 2, cat: 'weapons', out: ['ak47', 1],         cost: { metal: 10, plank: 3, nails: 3 } },
    { id: 'sniper',     station: 'workbench', level: 2, cat: 'weapons', out: ['sniper', 1],       cost: { metal: 12, plank: 2, electronics: 2, cloth: 1 } },
    { id: 'ammo',       station: 'workbench', level: 2, cat: 'ammo',    out: ['ammo', 6],         cost: { metal: 2, cloth: 1 } },
    { id: 'ammo_556',   station: 'workbench', level: 2, cat: 'ammo',    out: ['ammo_556', 8],     cost: { metal: 3, cloth: 1 } },
    { id: 'ammo_762',   station: 'workbench', level: 2, cat: 'ammo',    out: ['ammo_762', 6],     cost: { metal: 3, cloth: 1 } },
    { id: 'cooked_food', station: 'campfire', level: 1, cat: 'food',    out: ['cooked_food', 1],  cost: { mushroom: 2 } },
    { id: 'water_clean', station: 'campfire', level: 1, cat: 'food',    out: ['water_clean', 1],  cost: { water_dirty: 1 } },
    { id: 'stew',       station: 'campfire',  level: 2, cat: 'food',    out: ['stew', 1],         cost: { mushroom: 3, water_clean: 1 } },
    // workbench: rope (level 1), first-aid kit and torch (level 2), bulk planks / nails, lantern and crate (level 3)
    { id: 'rope',       station: 'workbench', level: 1, cat: 'home',    out: ['rope', 1],         cost: { cloth: 3 } },
    { id: 'firstaid',   station: 'workbench', level: 2, cat: 'home',    out: ['firstaid', 1],     cost: { bandage: 2, cloth: 2, water_clean: 1 } },
    { id: 'torch',      station: 'workbench', level: 2, cat: 'home',    out: ['torch', 1],        cost: { wood: 2, cloth: 1 } },
    { id: 'plank_bulk', station: 'workbench', level: 3, cat: 'home',    out: ['plank', 10],       cost: { wood: 6 } },
    { id: 'nails_bulk', station: 'workbench', level: 3, cat: 'home',    out: ['nails', 18],       cost: { metal: 3 } },
    { id: 'lantern',    station: 'workbench', level: 3, cat: 'home',    out: ['lantern', 1],      cost: { metal: 3, electronics: 1, cloth: 1 } },
    { id: 'crate',      station: 'workbench', level: 3, cat: 'home',    out: ['crate', 1],        cost: { plank: 6, nails: 4, rope: 1 } },
    // drying rack: dried food is safe to eat and more filling than raw
    { id: 'dried_mushroom', station: 'rack',  level: 1, cat: 'food',    out: ['dried_mushroom', 2], cost: { mushroom: 3 } },
    { id: 'ration',     station: 'rack',      level: 2, cat: 'food',    out: ['ration', 2],       cost: { dried_mushroom: 3, cooked_food: 1 } }
  ];

  // The garage benches: every garage makes raw parts (rubber, iron rods) and the parts a vehicle is assembled from and upgraded with.
  // Vehicles themselves are no recipes: they are assembled part by part in the garage panel (U, data/vehicles.js vehicleBuild).
  // Ids: g_ (garage_moto), j_ (garage_jeep), h_ (garage_heli), t_ (garage_tank). Wheels, tank, frame and engines (rotors, tracks, turrets for the heli and the tank) per garage.
  (function () {
    var PREFIX = { garage_moto: 'g_', garage_jeep: 'j_', garage_heli: 'h_', garage_tank: 't_' };
    var COMMON = [
      { k: 'rubber',  out: ['rubber', 2],      cost: { cloth: 2, fuel: 1 } },
      { k: 'rod',     out: ['iron_rod', 2],    cost: { metal: 2 } },
      { k: 'frame',   out: ['part_frame', 1],  cost: { metal: 8, iron_rod: 4, nails: 4 } },
      { k: 'wheels',  out: ['part_wheels', 1], cost: { rubber: 4, iron_rod: 2, metal: 3 }, not: ['garage_heli', 'garage_tank'] },
      { k: 'tank',    out: ['part_tank', 1],   cost: { metal: 6, iron_rod: 2, rubber: 2 } },
      { k: 'engine',  out: ['part_engine', 1], cost: { metal: 8, iron_rod: 4, electronics: 3, nails: 6 } },
      { k: 'rotor',   out: ['part_rotor', 1],  cost: { metal: 14, iron_rod: 6, electronics: 2, nails: 8 }, only: ['garage_heli'] },
      { k: 'tracks',  out: ['part_tracks', 1], cost: { metal: 12, iron_rod: 4, rubber: 6 }, only: ['garage_tank'] },
      { k: 'turret',  out: ['part_turret', 1], cost: { metal: 16, iron_rod: 6, electronics: 2, nails: 6 }, only: ['garage_tank'] }
    ];
    Object.keys(PREFIX).forEach(function (st) {
      COMMON.forEach(function (p) {
        if ((p.only && p.only.indexOf(st) < 0) || (p.not && p.not.indexOf(st) >= 0)) return;
        G.data.recipes.push({ id: PREFIX[st] + p.k, station: st, level: p.k === 'engine' && (st === 'garage_heli' || st === 'garage_tank') ? 2 : 1, cat: 'parts', out: p.out, cost: p.cost });
      });
    });
  })();
})(typeof window !== 'undefined' ? window : globalThis);
