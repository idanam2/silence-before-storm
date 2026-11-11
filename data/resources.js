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
    water:     { action: 'מילוי מים',     item: 'water_dirty', yield: [1, 1], time: 0.9, tool: null, r: 0,  solid: 0,  infinite: true, fx: 'water' }
  };
})(typeof window !== 'undefined' ? window : globalThis);
