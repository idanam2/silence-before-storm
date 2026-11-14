// Gatherable resource nodes (plain data, no logic).
// action: prompt text. item: what the node gives. yield: [min, max] units. time: seconds of holding E.
// tool: item id that must be in the backpack (or null). r: visual / interaction radius.
// solid: collision radius (0 = walk over it). canopy: [min, max] tree crown radius. fx: particle style.
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  G.data.resources = {
    pine:      { action: 'כריתת עץ',      item: 'wood',  yield: [4, 6], time: 1.7,  tool: 'axe',     r: 16, solid: 14, canopy: [76, 104], tree: true, fx: 'wood' },
    oak:       { action: 'כריתת עץ',      item: 'wood',  yield: [5, 7], time: 2.1,  tool: 'axe',     r: 18, solid: 16, canopy: [84, 112], tree: true, fx: 'wood' },
    dead_tree: { action: 'כריתת עץ יבש',  item: 'wood',  yield: [2, 3], time: 1.1,  tool: 'axe',     r: 13, solid: 11, canopy: [58, 78],  tree: true, fx: 'wood' },
    log:       { action: 'ביקוע גזע',     item: 'wood',  yield: [2, 4], time: 1.2,  tool: 'axe',     r: 24, solid: 0,  fx: 'wood' },
    branches:  { action: 'איסוף ענפים',   item: 'wood',  yield: [1, 2], time: 0.5,  tool: null,      r: 16, solid: 0,  fx: 'wood' },
    stones:    { action: 'איסוף אבנים',   item: 'stone', yield: [2, 3], time: 0.6,  tool: null,      r: 15, solid: 0,  fx: 'stone' },
    boulder:   { action: 'חציבת סלע',     item: 'stone', yield: [5, 8], time: 2.4,  tool: 'pickaxe', r: 34, solid: 30, scale: [0.8, 1.2], fx: 'stone' },
    mushrooms: { action: 'קטיף פטריות',   item: 'mushroom', yield: [1, 3], time: 0.45, tool: null,   r: 13, solid: 0,  fx: 'spore' },
    // salvage in built-up places (the port first). Hand-placed at sensible spots, see `loot` in data/areas.js.
    crate:     { action: 'פירוק ארגז מטען', item: 'plank',   yield: [2, 3], time: 1.5, tool: 'axe', r: 22, solid: 0, fx: 'wood' },
    pallet:    { action: 'פירוק משטח עץ',   item: 'wood',    yield: [2, 4], time: 1.0, tool: null,  r: 24, solid: 0, fx: 'wood' },
    scrap:     { action: 'איסוף גרוטאות',   item: 'metal',   yield: [1, 3], time: 1.2, tool: null,  r: 18, solid: 0, fx: 'metal' },
    tarp:      { action: 'חיתוך ברזנט וחבלים', item: 'cloth', yield: [1, 3], time: 0.9, tool: null, r: 20, solid: 0, fx: 'cloth' },
    cargo:     { action: 'חיפוש במטען',     item: 'canned_food', yield: [1, 2], time: 1.3, tool: null, r: 20, solid: 0, fx: 'metal' },
    medkit:    { action: 'פתיחת ערכת עזרה ראשונה', item: 'bandage', yield: [1, 2], time: 1.1, tool: null, r: 16, solid: 0, fx: 'cloth' },
    radio:     { action: 'פירוק מכשיר קשר', item: 'electronics', yield: [1, 2], time: 1.6, tool: null, r: 16, solid: 0, fx: 'metal' },
    vend_snack: { action: 'שבירת מכונת החטיפים', item: 'canned_food', yield: [1, 3], time: 1.4, tool: null, r: 18, solid: 0, fx: 'metal' },
    vend_drink: { action: 'שבירת מכונת השתייה', item: 'water_clean', yield: [1, 3], time: 1.4, tool: null, r: 18, solid: 0, fx: 'water' },
    // what is kept in a sealed room (behind a wall that only an axe breaks): always there, richer than loose salvage
    stash_food:  { action: 'פתיחת מחבוא: מזון',  item: 'canned_food', yield: [3, 5], time: 1.4, tool: null, r: 18, solid: 0, fx: 'wood' },
    stash_med:   { action: 'פתיחת מחבוא: תרופות', item: 'bandage',     yield: [3, 4], time: 1.4, tool: null, r: 18, solid: 0, fx: 'cloth' },
    stash_ammo:  { action: 'פתיחת מחבוא: תחמושת', item: 'ammo_556',    yield: [14, 20], time: 1.6, tool: null, r: 18, solid: 0, fx: 'metal' },
    stash_arms:  { action: 'פתיחת מחבוא: נשק',    item: 'm16',         yield: [1, 1],  time: 2.0, tool: null, r: 18, solid: 0, fx: 'metal' },
    // warm things in frozen packs (the snowy mountains, data/places/peaks.js); the items themselves are in story/data/companions.js
    pack_parka:  { action: 'פתיחת תרמיל קפוא: מעיל חורף', item: 'parka',         yield: [1, 1], time: 1.6, tool: null, r: 18, solid: 0, fx: 'cloth' },
    pack_hat:    { action: 'פתיחת תרמיל קפוא: כובע',      item: 'wool_hat',      yield: [1, 1], time: 1.3, tool: null, r: 18, solid: 0, fx: 'cloth' },
    pack_pants:  { action: 'פתיחת תרמיל קפוא: מכנסיים',  item: 'thermal_pants', yield: [1, 1], time: 1.4, tool: null, r: 18, solid: 0, fx: 'cloth' },
    pack_boots:  { action: 'פתיחת תרמיל קפוא: מגפיים',   item: 'snow_boots',    yield: [1, 1], time: 1.4, tool: null, r: 18, solid: 0, fx: 'cloth' },
    pack_tea:    { action: 'פתיחת תרמיל קפוא: תה',         item: 'hot_tea',       yield: [1, 2], time: 1.1, tool: null, r: 18, solid: 0, fx: 'cloth' },
    pack_warmer: { action: 'פתיחת תרמיל קפוא: מחממים',   item: 'hand_warmer',   yield: [1, 2], time: 1.0, tool: null, r: 18, solid: 0, fx: 'cloth' },
    stash_parts: { action: 'פתיחת מחבוא: חלקים',  item: 'electronics', yield: [2, 3], time: 1.5, tool: null, r: 18, solid: 0, fx: 'metal' },
    fueldrum:  { action: "מילוי ג'ריקנים מחבית דלק", item: 'fuel', yield: [2, 3], time: 1.1, tool: null, r: 16, solid: 0, fx: 'water' },
    barrel:    { action: 'מילוי מחבית גשם', item: 'water_dirty', yield: [2, 3], time: 0.9, tool: null, r: 16, solid: 0, fx: 'water' },
    water:     { action: 'מילוי מים',     item: 'water_dirty', yield: [1, 1], time: 0.9, tool: null, r: 0,  solid: 0,  infinite: true, fx: 'water' }
  };
})(typeof window !== 'undefined' ? window : globalThis);
