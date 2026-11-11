// Item definitions and the starting loadout (plain data, no logic).
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  // stack: max units per inventory slot. color: fallback tile color in the UI. kind: for UI grouping.
  // use: what one unit does when the player uses it from the backpack ({ need: change }, see data/needs.js).
  // weapon: counts as a weapon (lost on hard difficulty, used by combat in stage 5).
  // Stacks are small on purpose: the backpack limit is what sends the player back to the base.
  G.data.items = {
    wood:        { name: 'עץ',         stack: 10, color: '#6b5a44', kind: 'resource' },
    stone:       { name: 'אבן',        stack: 10, color: '#6a6f6c', kind: 'resource' },
    mushroom:    { name: 'פטריות',     stack: 6,  color: '#7d6f5e', kind: 'food',  use: { hunger: 8, health: -3 } },
    water_dirty: { name: 'מים מלוכלכים', stack: 3, color: '#55604f', kind: 'drink', use: { thirst: 20, health: -6 } },
    water_clean: { name: 'מים נקיים',  stack: 3,  color: '#4f6670', kind: 'drink', use: { thirst: 40 } },
    canned_food: { name: 'שימורים',    stack: 4,  color: '#7a6a4a', kind: 'food',  use: { hunger: 40 } },
    metal:       { name: 'מתכת',       stack: 10, color: '#5c6468', kind: 'resource' },
    cloth:       { name: 'בד',         stack: 10, color: '#6e6660', kind: 'resource' },
    electronics: { name: 'אלקטרוניקה', stack: 5,  color: '#4d6458', kind: 'resource' },
    bandage:     { name: 'תחבושת',     stack: 3,  color: '#8a857a', kind: 'medical', use: { health: 25 } },
    axe:         { name: 'גרזן',       stack: 1,  color: '#756a5c', kind: 'tool' },
    pickaxe:     { name: 'מכוש',       stack: 1,  color: '#6c7572', kind: 'tool' },
    // crafted at the workbench / campfire (data/recipes.js)
    plank:       { name: 'קרשים',      stack: 10, color: '#7a6648', kind: 'resource' },
    nails:       { name: 'מסמרים',     stack: 12, color: '#5c6468', kind: 'resource' },
    club:        { name: 'אלה',        stack: 1,  color: '#6b5840', kind: 'tool', weapon: true },
    cooked_food: { name: 'אוכל מבושל', stack: 4,  color: '#8a6a44', kind: 'food',  use: { hunger: 30, energy: 3 } },
    stew:        { name: 'מרק פטריות', stack: 3,  color: '#7a6a48', kind: 'food',  use: { hunger: 45, thirst: 10, energy: 6, health: 5 } }
  };

  G.data.inventory = {
    bagSlots: 12,
    chestSlots: 24,
    // Temporary loadout for a new game. [itemId, amount]
    start: {
      bag:   [['axe', 1], ['canned_food', 1], ['water_clean', 1]],
      chest: [['cloth', 3], ['bandage', 2], ['metal', 6]]   // metal: temporary, until the neighborhood (stage 8)
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
