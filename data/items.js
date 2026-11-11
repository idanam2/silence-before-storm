// Item definitions and the starting loadout (plain data, no logic).
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  // stack: max units per inventory slot. color: fallback tile color in the UI. kind: for UI grouping.
  // Stacks are small on purpose: the backpack limit is what sends the player back to the base.
  G.data.items = {
    wood:        { name: 'עץ',         stack: 10, color: '#6b5a44', kind: 'resource' },
    stone:       { name: 'אבן',        stack: 10, color: '#6a6f6c', kind: 'resource' },
    mushroom:    { name: 'פטריות',     stack: 6,  color: '#7d6f5e', kind: 'food' },
    water_dirty: { name: 'מים מלוכלכים', stack: 3, color: '#55604f', kind: 'drink' },
    water_clean: { name: 'מים נקיים',  stack: 3,  color: '#4f6670', kind: 'drink' },
    canned_food: { name: 'שימורים',    stack: 4,  color: '#7a6a4a', kind: 'food' },
    metal:       { name: 'מתכת',       stack: 10, color: '#5c6468', kind: 'resource' },
    cloth:       { name: 'בד',         stack: 10, color: '#6e6660', kind: 'resource' },
    electronics: { name: 'אלקטרוניקה', stack: 5,  color: '#4d6458', kind: 'resource' },
    bandage:     { name: 'תחבושת',     stack: 3,  color: '#8a857a', kind: 'medical' },
    axe:         { name: 'גרזן',       stack: 1,  color: '#756a5c', kind: 'tool' },
    pickaxe:     { name: 'מכוש',       stack: 1,  color: '#6c7572', kind: 'tool' }   // crafted from stage 3
  };

  G.data.inventory = {
    bagSlots: 12,
    chestSlots: 24,
    // Temporary loadout until crafting (stage 3) and saving (stage 4). [itemId, amount]
    start: {
      bag:   [['axe', 1], ['canned_food', 1], ['water_clean', 1]],
      chest: [['cloth', 3], ['bandage', 2]]
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
