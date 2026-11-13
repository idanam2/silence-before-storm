// Clothes and the equipment slots (plain data). Logic: js/gear.js. Drawn on the body by js/player.js (OUTFIT there).
// A worn piece leaves the backpack and sits in its slot; weapons stay in the backpack and the two weapon slots only
// point at them (keys 1 and 2).
// wear: { slot, armor }: armor is the share of every blow the piece takes away (all worn pieces add up, see cap).
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  var items = G.data.items;
  items.cap    = { name: 'כובע צמר',    stack: 1, color: '#3d4148', kind: 'wear', wear: { slot: 'head', armor: 0.03 } };
  items.helmet = { name: 'קסדה',        stack: 1, color: '#5a6252', kind: 'wear', wear: { slot: 'head', armor: 0.10 } };
  items.jacket = { name: 'מעיל עבודה',  stack: 1, color: '#6a5236', kind: 'wear', wear: { slot: 'body', armor: 0.08 } };
  items.vest   = { name: 'אפוד מגן',    stack: 1, color: '#4c5a44', kind: 'wear', wear: { slot: 'body', armor: 0.20 } };
  items.pants  = { name: 'מכנסי דגמ״ח', stack: 1, color: '#5c5a44', kind: 'wear', wear: { slot: 'legs', armor: 0.06 } };
  // the yellow hazmat suit: worn in the body slot, lets you stand on radioactive floor (G.area.radAt, js/game-tick.js hazardStep)
  items.hazsuit = { name: 'חליפת מגן צהובה', stack: 1, color: '#d6b92a', kind: 'wear', wear: { slot: 'body', armor: 0.05 } };
  G.data.hazard = { dps: 7 };                                      // health lost per second on a radioactive patch without the suit
  items.boots  = { name: 'מגפיים',      stack: 1, color: '#4a3526', kind: 'wear', wear: { slot: 'feet', armor: 0.04 } };

  G.data.gear = {
    slots: ['head', 'body', 'legs', 'feet'],                      // clothes: the item itself sits in the slot
    weaponSlots: ['primary', 'secondary'],                        // weapons: the slot holds a weapon id (data/weapons.js)
    labels: { head: 'ראש', body: 'גוף', legs: 'רגליים', feet: 'נעליים', primary: 'נשק ראשי', secondary: 'נשק משני' },
    cap: 0.6                                                       // clothes never take away more than this share of a blow
  };

  G.data.recipeCats.splice(2, 0, { id: 'wear', name: 'בגדים' });
  G.data.recipes.push(
    { id: 'cap',    station: 'workbench', level: 1, cat: 'wear', out: ['cap', 1],    cost: { cloth: 2 } },
    { id: 'jacket', station: 'workbench', level: 1, cat: 'wear', out: ['jacket', 1], cost: { cloth: 6 } },
    { id: 'pants',  station: 'workbench', level: 1, cat: 'wear', out: ['pants', 1],  cost: { cloth: 4 } },
    { id: 'boots',  station: 'workbench', level: 1, cat: 'wear', out: ['boots', 1],  cost: { cloth: 3 } },
    { id: 'helmet', station: 'workbench', level: 2, cat: 'wear', out: ['helmet', 1], cost: { metal: 5, cloth: 2 } },
    { id: 'hazsuit', station: 'workbench', level: 2, cat: 'wear', out: ['hazsuit', 1], cost: { cloth: 8, metal: 4, plank: 1 } },
    { id: 'vest',   station: 'workbench', level: 2, cat: 'wear', out: ['vest', 1],   cost: { metal: 8, cloth: 6 } }
  );
})(typeof window !== 'undefined' ? window : globalThis);
