// Crafting recipes (plain data, no logic). Crafting is instant: it only costs materials.
// station: 'workbench' | 'campfire' (must be built, and the player must stand next to it).
// level: minimum level of that station. out: [itemId, amount]. cost: { itemId: amount }.
// Materials are taken from the backpack first, then from the chest.
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  G.data.recipes = [
    { id: 'plank',      station: 'workbench', level: 1, out: ['plank', 2],        cost: { wood: 2 } },
    { id: 'axe',        station: 'workbench', level: 1, out: ['axe', 1],          cost: { wood: 2, stone: 3 } },
    { id: 'pickaxe',    station: 'workbench', level: 1, out: ['pickaxe', 1],      cost: { wood: 2, stone: 4, plank: 1 } },
    { id: 'bandage',    station: 'workbench', level: 1, out: ['bandage', 1],      cost: { cloth: 2 } },
    { id: 'nails',      station: 'workbench', level: 1, out: ['nails', 4],        cost: { metal: 1 } },
    { id: 'club',       station: 'workbench', level: 2, out: ['club', 1],         cost: { wood: 3, nails: 4 } },
    { id: 'cooked_food', station: 'campfire', level: 1, out: ['cooked_food', 1],  cost: { mushroom: 2 } },
    { id: 'water_clean', station: 'campfire', level: 1, out: ['water_clean', 1],  cost: { water_dirty: 1 } },
    { id: 'stew',       station: 'campfire',  level: 2, out: ['stew', 1],         cost: { mushroom: 3, water_clean: 1 } }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
