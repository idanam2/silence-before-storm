// Loot dropped by infected when they die. Pure data; the rolling logic is in js/loot.js.
// types[typeId] = list of entries { item, chance (0..1), min, max }. Unknown enemy types use `default`.
// Weapons are never listed here (and js/loot.js refuses them anyway).
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  G.data.loot = {
    sneakMult: 1.35,        // chances are multiplied by this when the kill was a quiet one (enemy had not noticed the player)
    gunMult: 1.6,           // ammo chances are multiplied by this when the bag holds a gun that uses that ammo
    maxChance: 0.85,        // no entry ever goes above this after the bonuses
    maxUnits: 5,            // hard cap on items from one body (all entries together)

    types: {
      shambler: [
        { item: 'cloth',       chance: 0.26, min: 1, max: 2 },
        { item: 'canned_food', chance: 0.08, min: 1, max: 1 },
        { item: 'bandage',     chance: 0.07, min: 1, max: 1 },
        { item: 'metal',       chance: 0.08, min: 1, max: 2 },
        { item: 'nails',       chance: 0.08, min: 1, max: 3 },
        { item: 'ammo',        chance: 0.15, min: 1, max: 3 },
        { item: 'ammo_556',    chance: 0.05, min: 1, max: 2 },
        { item: 'ammo_762',    chance: 0.04, min: 1, max: 2 }
      ],
      // fast and weak: carries little, mostly small things
      runner: [
        { item: 'cloth',       chance: 0.20, min: 1, max: 1 },
        { item: 'canned_food', chance: 0.05, min: 1, max: 1 },
        { item: 'bandage',     chance: 0.05, min: 1, max: 1 },
        { item: 'nails',       chance: 0.06, min: 1, max: 2 },
        { item: 'ammo',        chance: 0.12, min: 1, max: 2 },
        { item: 'ammo_556',    chance: 0.04, min: 1, max: 2 },
        { item: 'ammo_762',    chance: 0.03, min: 1, max: 1 }
      ],
      // placeholders for the types another agent is adding (they carry more than a plain infected)
      brute: [
        { item: 'cloth',       chance: 0.28, min: 1, max: 2 },
        { item: 'canned_food', chance: 0.12, min: 1, max: 2 },
        { item: 'bandage',     chance: 0.12, min: 1, max: 1 },
        { item: 'metal',       chance: 0.14, min: 1, max: 2 },
        { item: 'nails',       chance: 0.12, min: 1, max: 3 },
        { item: 'ammo',        chance: 0.2, min: 1, max: 3 },
        { item: 'ammo_556',    chance: 0.10, min: 1, max: 3 },
        { item: 'ammo_762',    chance: 0.08, min: 1, max: 3 }
      ],
      crawler: [
        { item: 'cloth',       chance: 0.22, min: 1, max: 1 },
        { item: 'canned_food', chance: 0.06, min: 1, max: 1 },
        { item: 'nails',       chance: 0.07, min: 1, max: 2 },
        { item: 'ammo',        chance: 0.10, min: 1, max: 2 }
      ],
      screamer: [
        { item: 'cloth',       chance: 0.22, min: 1, max: 1 },
        { item: 'bandage',     chance: 0.08, min: 1, max: 1 },
        { item: 'canned_food', chance: 0.06, min: 1, max: 1 },
        { item: 'ammo',        chance: 0.10, min: 1, max: 2 },
        { item: 'ammo_556',    chance: 0.04, min: 1, max: 1 }
      ]
    },

    default: [
      { item: 'cloth',       chance: 0.22, min: 1, max: 2 },
      { item: 'canned_food', chance: 0.06, min: 1, max: 1 },
      { item: 'bandage',     chance: 0.05, min: 1, max: 1 },
      { item: 'nails',       chance: 0.06, min: 1, max: 2 },
      { item: 'ammo',        chance: 0.12, min: 1, max: 2 }
    ]
  };
})(window);
