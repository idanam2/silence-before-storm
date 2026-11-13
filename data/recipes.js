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
    { id: 'vehicles', name: 'כלי רכב' }
  ];

  G.data.recipes = [
    // Vehicles: crafted at their garage, one of each (G.crafting.craft hands the vehicle to ctx.vehicles instead of an item).
    { id: 'v_motorcycle', station: 'garage_moto', level: 1, cat: 'vehicles', out: ['veh_motorcycle', 1], vehicle: 'motorcycle', cost: { metal: 12, nails: 6, electronics: 2, cloth: 2 } },
    { id: 'v_atv',        station: 'garage_moto', level: 1, cat: 'vehicles', out: ['veh_atv', 1],        vehicle: 'atv',        cost: { metal: 18, nails: 8, electronics: 2, cloth: 4 } },
    { id: 'v_jeep',       station: 'garage_jeep', level: 1, cat: 'vehicles', out: ['veh_jeep', 1],       vehicle: 'jeep',       cost: { metal: 40, plank: 6, nails: 12, electronics: 4, cloth: 6 } },
    { id: 'v_heli',       station: 'garage_heli', level: 1, cat: 'vehicles', out: ['veh_heli', 1],       vehicle: 'heli',       cost: { metal: 70, nails: 20, electronics: 12, cloth: 8 } },
    { id: 'v_tank',       station: 'garage_tank', level: 1, cat: 'vehicles', out: ['veh_tank', 1],       vehicle: 'tank',       cost: { metal: 120, plank: 10, nails: 30, electronics: 10 } },
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
})(typeof window !== 'undefined' ? window : globalThis);
