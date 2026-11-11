// Areas the player can travel to (plain data). The forest layout is generated from this in js/area.js.
// spawns: terrain = fixed between visits (same seed); others are re-rolled on every trip.
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  G.data.areas = {
    base: { id: 'base', name: 'הבסיס' },

    forest: {
      id: 'forest', name: 'היער',
      seed: 2207,
      width: 3600, height: 2600,
      margin: 150,                              // nothing gatherable closer than this to the edge
      exit:  { x: 1800, y: 2440, r: 78 },       // exit point: back to the base
      spawn: { x: 1800, y: 2330 },
      clearing: 210,                            // no trees / boulders this close to the spawn
      reach: 26,                                // interaction distance beyond the node edge
      paths: [
        [[1800, 2600], [1800, 2300], [1700, 1960], [1860, 1600], [1660, 1260], [1260, 1060], [1040, 960]],
        [[1860, 1600], [2280, 1500], [2640, 1530]]
      ],
      ponds: [
        { x: 880, y: 900, r: 165 },
        { x: 2770, y: 1540, r: 118 }
      ],
      border: { step: 82, depth: 80, gap: 150 },  // wall of trees around the map, open at the exit
      spawns: [
        { type: 'pine',      count: 92, gap: 122, grove: true, terrain: true },
        { type: 'oak',       count: 54, gap: 132, grove: true, terrain: true },
        { type: 'dead_tree', count: 16, gap: 112, terrain: true },
        { type: 'boulder',   count: 14, gap: 0,   terrain: true },
        { type: 'log',       count: 12 },
        { type: 'stones',    count: 26 },
        { type: 'branches',  count: 30, nearTree: true },
        { type: 'mushrooms', count: 24, nearTree: true }
      ]
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
