// Areas the player can travel to (plain data). Each one is generated from this in js/area.js.
// Terrain spawns (terrain: true) are fixed between visits (same seed); the others are re-rolled on every visit.
// Which areas can be reached from the map, how far they are and what they cost: data/world.js.
// theme.tones: [[rgb, alpha], ...] soft ground blotches (js/forestart.js). border: ring of trees / boulders
// around the map (null = open edge); border.kinds = resource types used for it.
// For now the new places only offer the existing resources in different mixes. Their own loot and enemies come later.
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  var BORDER = { step: 82, depth: 80, gap: 150 };

  // A standard area: the exit and the spawn are at the bottom center, one trail winds north from there.
  function zone(id, name, o) {
    var w = o.width, h = o.height, cx = Math.round(w / 2), bend = o.bend || 260;
    return {
      id: id, name: name, seed: o.seed, width: w, height: h, margin: 150,
      exit: { x: cx, y: h - 160, r: 78 },
      spawn: { x: cx, y: h - 270 },
      clearing: 210, reach: 26,
      paths: [[[cx, h], [cx, h - 300], [cx + bend, Math.round(h * 0.62)], [cx - bend, Math.round(h * 0.36)], [cx - bend + 120, Math.round(h * 0.2)]]],
      ponds: o.ponds || [],
      border: o.border === undefined ? BORDER : o.border,
      theme: o.theme,
      spawns: o.spawns
    };
  }

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
    },

    farm: zone('farm', 'החווה הנטושה', {
      seed: 3301, width: 3000, height: 2200, bend: 200,
      theme: { tones: [['86,76,44', 0.14], ['70,80,44', 0.12], ['0,0,0', 0.2], ['130,110,64', 0.07], ['170,180,140', 0.04]] },
      ponds: [{ x: 700, y: 760, r: 120 }],
      spawns: [
        { type: 'oak',       count: 24, gap: 150, grove: true, terrain: true },
        { type: 'pine',      count: 12, gap: 130, grove: true, terrain: true },
        { type: 'dead_tree', count: 8,  gap: 112, terrain: true },
        { type: 'boulder',   count: 4,  gap: 0,   terrain: true },
        { type: 'log',       count: 10 },
        { type: 'stones',    count: 24 },
        { type: 'branches',  count: 26, nearTree: true },
        { type: 'mushrooms', count: 26, nearTree: true }
      ]
    }),

    neighborhood: zone('neighborhood', 'השכונה הנטושה', {
      seed: 4410, width: 3200, height: 2400, bend: 240,
      theme: { tones: [['70,76,74', 0.16], ['0,0,0', 0.22], ['110,110,100', 0.07], ['60,64,66', 0.14]] },
      border: { step: 90, depth: 70, gap: 150, kinds: ['dead_tree', 'dead_tree', 'boulder'] },
      spawns: [
        { type: 'dead_tree', count: 32, gap: 120, terrain: true },
        { type: 'pine',      count: 10, gap: 130, terrain: true },
        { type: 'boulder',   count: 8,  gap: 0,   terrain: true },
        { type: 'log',       count: 14 },
        { type: 'stones',    count: 38 },
        { type: 'branches',  count: 24, nearTree: true },
        { type: 'mushrooms', count: 12, nearTree: true }
      ]
    }),

    quarry: zone('quarry', 'המחצבה', {
      seed: 5522, width: 3400, height: 2600, bend: 320,
      theme: { tones: [['108,98,82', 0.16], ['0,0,0', 0.22], ['140,128,104', 0.08], ['80,74,64', 0.14]] },
      border: { step: 84, depth: 70, gap: 150, kinds: ['boulder', 'boulder', 'dead_tree'] },
      ponds: [{ x: 2600, y: 900, r: 130 }],
      spawns: [
        { type: 'boulder',   count: 46, gap: 0,   terrain: true },
        { type: 'dead_tree', count: 12, gap: 115, terrain: true },
        { type: 'pine',      count: 6,  gap: 130, terrain: true },
        { type: 'stones',    count: 54 },
        { type: 'log',       count: 8 },
        { type: 'branches',  count: 12, nearTree: true },
        { type: 'mushrooms', count: 6,  nearTree: true }
      ]
    }),

    lake: zone('lake', 'אגם הסכר', {
      seed: 6633, width: 3800, height: 2800, bend: 360,
      theme: { tones: [['30,60,64', 0.16], ['44,78,52', 0.12], ['0,0,0', 0.2], ['120,150,150', 0.06]] },
      ponds: [{ x: 1300, y: 1100, r: 300 }, { x: 2800, y: 1500, r: 190 }, { x: 640, y: 2000, r: 150 }],
      spawns: [
        { type: 'oak',       count: 44, gap: 132, grove: true, terrain: true },
        { type: 'pine',      count: 42, gap: 122, grove: true, terrain: true },
        { type: 'dead_tree', count: 8,  gap: 112, terrain: true },
        { type: 'boulder',   count: 6,  gap: 0,   terrain: true },
        { type: 'log',       count: 14 },
        { type: 'stones',    count: 24 },
        { type: 'branches',  count: 26, nearTree: true },
        { type: 'mushrooms', count: 36, nearTree: true }
      ]
    }),

    police: zone('police', 'תחנת המשטרה', {
      seed: 7744, width: 3000, height: 2400, bend: 220,
      theme: { tones: [['66,72,80', 0.16], ['0,0,0', 0.22], ['108,112,118', 0.07], ['54,58,64', 0.14]] },
      border: { step: 90, depth: 70, gap: 150, kinds: ['dead_tree', 'boulder'] },
      spawns: [
        { type: 'dead_tree', count: 20, gap: 118, terrain: true },
        { type: 'pine',      count: 10, gap: 130, terrain: true },
        { type: 'boulder',   count: 10, gap: 0,   terrain: true },
        { type: 'log',       count: 8 },
        { type: 'stones',    count: 34 },
        { type: 'branches',  count: 14, nearTree: true },
        { type: 'mushrooms', count: 8,  nearTree: true }
      ]
    }),

    hospital: zone('hospital', 'בית החולים הישן', {
      seed: 8855, width: 3200, height: 2400, bend: 260,
      theme: { tones: [['58,84,66', 0.15], ['0,0,0', 0.22], ['150,170,150', 0.06], ['44,66,56', 0.14]] },
      ponds: [{ x: 2400, y: 700, r: 110 }],
      spawns: [
        { type: 'oak',       count: 22, gap: 135, grove: true, terrain: true },
        { type: 'dead_tree', count: 22, gap: 115, terrain: true },
        { type: 'boulder',   count: 6,  gap: 0,   terrain: true },
        { type: 'log',       count: 12 },
        { type: 'stones',    count: 26 },
        { type: 'branches',  count: 22, nearTree: true },
        { type: 'mushrooms', count: 24, nearTree: true }
      ]
    }),

    port: zone('port', 'הנמל', {
      seed: 9966, width: 4000, height: 2600, bend: 300, border: null,
      theme: { tones: [['40,64,76', 0.16], ['0,0,0', 0.22], ['86,100,110', 0.08], ['60,80,90', 0.12]] },
      ponds: [{ x: 900, y: 520, r: 340 }, { x: 2300, y: 440, r: 380 }, { x: 3300, y: 760, r: 260 }],
      spawns: [
        { type: 'dead_tree', count: 12, gap: 115, terrain: true },
        { type: 'boulder',   count: 12, gap: 0,   terrain: true },
        { type: 'log',       count: 24 },
        { type: 'stones',    count: 22 },
        { type: 'branches',  count: 14, nearTree: true },
        { type: 'mushrooms', count: 4,  nearTree: true }
      ]
    }),

    military: zone('military', 'הבסיס הצבאי', {
      seed: 11077, width: 4000, height: 3000, bend: 340,
      theme: { tones: [['58,68,48', 0.16], ['0,0,0', 0.24], ['100,104,84', 0.07], ['46,54,40', 0.14]] },
      ponds: [{ x: 3000, y: 900, r: 150 }],
      spawns: [
        { type: 'pine',      count: 46, gap: 122, grove: true, terrain: true },
        { type: 'dead_tree', count: 20, gap: 112, terrain: true },
        { type: 'boulder',   count: 26, gap: 0,   terrain: true },
        { type: 'log',       count: 16 },
        { type: 'stones',    count: 40 },
        { type: 'branches',  count: 20, nearTree: true },
        { type: 'mushrooms', count: 10, nearTree: true }
      ]
    }),

    airport: zone('airport', 'שדה התעופה', {
      seed: 12188, width: 4200, height: 3000, bend: 400, border: null,
      theme: { tones: [['96,98,86', 0.14], ['0,0,0', 0.2], ['130,132,118', 0.06], ['70,74,66', 0.12]] },
      spawns: [
        { type: 'pine',      count: 10, gap: 130, terrain: true },
        { type: 'oak',       count: 6,  gap: 135, terrain: true },
        { type: 'dead_tree', count: 16, gap: 112, terrain: true },
        { type: 'boulder',   count: 10, gap: 0,   terrain: true },
        { type: 'log',       count: 12 },
        { type: 'stones',    count: 50 },
        { type: 'branches',  count: 14, nearTree: true },
        { type: 'mushrooms', count: 8,  nearTree: true }
      ]
    })
  };
})(typeof window !== 'undefined' ? window : globalThis);
