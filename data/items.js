// Item definitions and the starting loadout (plain data, no logic).
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  // stack: max units per inventory slot. color: fallback tile color in the UI. kind: for UI grouping.
  // use: what one unit does when the player uses it from the backpack ({ need: change }, see data/needs.js).
  // weapon: counts as a weapon (lost on hard difficulty, used by combat in stage 5).
  // Everything that can stack holds up to 50 per slot; tools and weapons are single items. The backpack size (slots, see the bag in data/buildings.js) is what sends the player back to the base.
  G.data.items = {
    wood:        { name: 'עץ',         stack: 50, color: '#6b5a44', kind: 'resource' },
    stone:       { name: 'אבן',        stack: 50, color: '#6a6f6c', kind: 'resource' },
    mushroom:    { name: 'פטריות',     stack: 50,  color: '#7d6f5e', kind: 'food',  use: { hunger: 8, health: -3 } },
    water_dirty: { name: 'מים מלוכלכים', stack: 50, color: '#55604f', kind: 'drink', use: { thirst: 20, health: -6 } },
    water_clean: { name: 'מים נקיים',  stack: 50,  color: '#4f6670', kind: 'drink', use: { thirst: 40 } },
    fuel: { name: "ג'ריקן דלק", stack: 50, color: '#a8452f', kind: 'material' },
    // Vehicles show up in the garage recipes only (a built vehicle is not an item you carry: G.state.vehicles).
    veh_motorcycle: { name: 'אופנוע', stack: 1, color: '#8a3a2e', kind: 'material' },
    veh_atv:        { name: 'טרקטורון', stack: 1, color: '#4d5a3c', kind: 'material' },
    veh_jeep:       { name: "ג'יפ", stack: 1, color: '#5a6246', kind: 'material' },
    veh_heli:       { name: 'מסוק', stack: 1, color: '#3f4c58', kind: 'material' },
    veh_tank:       { name: 'טנק', stack: 1, color: '#4a5240', kind: 'material' },
    canned_food: { name: 'שימורים',    stack: 50,  color: '#7a6a4a', kind: 'food',  use: { hunger: 40 } },
    metal:       { name: 'מתכת',       stack: 50, color: '#5c6468', kind: 'resource' },
    cloth:       { name: 'בד',         stack: 50, color: '#6e6660', kind: 'resource' },
    electronics: { name: 'אלקטרוניקה', stack: 50,  color: '#4d6458', kind: 'resource' },
    bandage:     { name: 'תחבושת',     stack: 50,  color: '#8a857a', kind: 'medical', use: { health: 25 } },
    axe:         { name: 'גרזן',       stack: 1,  color: '#756a5c', kind: 'tool' },
    pickaxe:     { name: 'מכוש',       stack: 1,  color: '#6c7572', kind: 'tool' },
    // crafted at the workbench / campfire (data/recipes.js)
    plank:       { name: 'קרשים',      stack: 50, color: '#7a6648', kind: 'resource' },
    nails:       { name: 'מסמרים',     stack: 50, color: '#5c6468', kind: 'resource' },
    club:        { name: 'אלה',        stack: 1,  color: '#6b5840', kind: 'tool', weapon: true },
    pistol:      { name: 'אקדח',       stack: 1,  color: '#4a4f52', kind: 'tool', weapon: true },
    uzi:         { name: 'עוזי',        stack: 1,  color: '#3a3f42', kind: 'tool', weapon: true },
    m16:         { name: 'M16',        stack: 1,  color: '#33383a', kind: 'tool', weapon: true },
    ak47:        { name: 'קלצ׳ניקוב',  stack: 1,  color: '#5a4630', kind: 'tool', weapon: true },
    sniper:      { name: 'רובה צלפים', stack: 1,  color: '#3a3f34', kind: 'tool', weapon: true },
    // ammunition: 9 mm (pistol, Uzi), 5.56 (M16), 7.62 (Kalashnikov, sniper rifle)
    ammo:        { name: 'כדורי 9מ״מ',  stack: 50, color: '#8a7448', kind: 'ammo' },
    ammo_556:    { name: 'כדורי 5.56',  stack: 50, color: '#9a9a8c', kind: 'ammo' },
    ammo_762:    { name: 'כדורי 7.62',  stack: 50, color: '#7e5f2c', kind: 'ammo' },
    cooked_food: { name: 'אוכל מבושל', stack: 50,  color: '#8a6a44', kind: 'food',  use: { hunger: 30, energy: 3 } },
    stew:        { name: 'מרק פטריות', stack: 50,  color: '#7a6a48', kind: 'food',  use: { hunger: 45, thirst: 10, energy: 6, health: 5 } },
    // workbench level 2-3 (rope, first-aid kit, torch, lantern, crate) and the drying rack (dried food)
    rope:        { name: 'חבל',         stack: 50, color: '#8a7a58', kind: 'resource' },
    crate:       { name: 'ארגז עץ',     stack: 50, color: '#6e5a3c', kind: 'resource' },
    firstaid:    { name: 'ערכת עזרה ראשונה', stack: 50, color: '#8a5a52', kind: 'medical', use: { health: 60 } },
    torch:       { name: 'לפיד',        stack: 1,  color: '#7a5a38', kind: 'tool' },
    lantern:     { name: 'פנס',         stack: 1,  color: '#8a7a50', kind: 'tool' },
    dried_mushroom: { name: 'פטריות מיובשות', stack: 50, color: '#8a7a5e', kind: 'food', use: { hunger: 14 } },
    ration:      { name: 'מנת שדה',     stack: 50, color: '#7a6a44', kind: 'food',  use: { hunger: 42, energy: 8 } }
  };

  G.data.inventory = {
    bagSlots: 12,
    chestSlots: 24,
    // Temporary loadout for a new game. [itemId, amount]
    start: {
      // pistol, club and ammo: temporary, so combat can be tried right away (the story hands out weapons later, stage 7)
      bag:   [['axe', 1], ['canned_food', 1], ['water_clean', 1], ['club', 1], ['pistol', 1], ['ammo', 16]],
      // metal, plank, nails, cloth, electronics: temporary, so the guns can be crafted and tried right away (the neighborhood, stage 8, gives them for real)
      chest: [['fuel', 12], ['cloth', 10], ['bandage', 2], ['metal', 10], ['metal', 10], ['metal', 10], ['metal', 10], ['metal', 10], ['metal', 10], ['plank', 10], ['nails', 12], ['electronics', 5], ['electronics', 3]]
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
