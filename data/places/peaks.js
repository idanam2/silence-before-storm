// The snowy mountains in the east: a cold area (see js/cold.js). `cold: { wind, drifts }` makes it cold: body heat drains, walking is
// slower in the snow (deep drifts slower still), warm clothes slow the drain. `warm: [{ x, y, r }]` are the fires: standing in one
// brings the heat back. The frozen infected (`frozen`) live here. Warm clothes lie in frozen packs (pack_* resources), or are made
// at the workbench once the area is known (recipes in story/data/companions.js, unlocked by the flag `peak_known`, set on arrival).
(function (root) {
  'use strict';
  var G = root.G, AR = G && G.data && G.data.areas;
  if (!AR) return;

  function peaks() {
    var W = 3600, H = 2800, S = [];
    function add(o) { S.push(o); return o; }
    // the fires: a ring of stones and a warm patch of bare ground (kind 'snowfire', js/art/peaks.js)
    var warm = [{ x: 1800, y: 2330, r: 150 }, { x: 2330, y: 1700, r: 150 }, { x: 1640, y: 880, r: 150 }];
    warm.forEach(function (w) { add({ kind: 'snowfire', x: w.x - 22, y: w.y - 22, w: 44, h: 44, k: 0.02, solid: false }); });
    // a ranger's hut by the trail, two cars half buried in snow, a freight container, the stump of a radio tower on the ridge
    add({ kind: 'house', x: 2100, y: 1450, w: 300, h: 210, k: 0.1, color: '#5e5446', roof: '#c9d2da', chimney: true, broken: true });
    add({ kind: 'car', x: 1000, y: 2080, w: 140, h: 70, k: 0.045, color: '#5a6068', open: true });
    add({ kind: 'car', x: 2700, y: 1100, w: 70, h: 140, k: 0.045, color: '#6a4a44', burnt: true });
    add({ kind: 'container', x: 2550, y: 2200, w: 220, h: 76, k: 0.068, level: 1, color: '#4a5a66', open: true });
    add({ kind: 'tower', x: 1550, y: 380, w: 100, h: 100, k: 0.27, solid: false,
      legs: [{ x: 1550, y: 380, w: 16, h: 16 }, { x: 1634, y: 380, w: 16, h: 16 }, { x: 1550, y: 464, w: 16, h: 16 }, { x: 1634, y: 464, w: 16, h: 16 }] });
    // snow drifts: deep snow you wade through (slower); drawn as soft mounds
    var drifts = [{ x: 700, y: 1500, w: 520, h: 300 }, { x: 2650, y: 1800, w: 560, h: 320 }, { x: 1250, y: 1150, w: 440, h: 260 }, { x: 2300, y: 650, w: 600, h: 300 }, { x: 900, y: 2350, w: 460, h: 240 }];
    drifts.forEach(function (d) { add({ kind: 'drift', x: d.x, y: d.y, w: d.w, h: d.h, k: 0.0, solid: false }); });

    return {
      id: 'peaks', name: 'פסגות השלג', seed: 7744, width: W, height: H, margin: 150,
      exit: { x: W / 2, y: H - 160, r: 78 }, spawn: { x: W / 2, y: H - 270 },
      clearing: 210, reach: 26,
      paths: [[[1800, 2800], [1800, 2400], [1500, 1950], [2050, 1350], [1700, 760]]],
      roads: [], lots: [], pads: [], crops: [], ponds: [], water: [], decks: [],
      structures: S,
      cold: { wind: true, drifts: drifts },
      warm: warm,
      theme: { ground: 'snow', trail: false, tones: [['210,225,245', 0.2], ['120,150,200', 0.12], ['255,255,255', 0.14], ['40,60,100', 0.1]], decor: [['pebbles', 260]] },
      border: { step: 84, depth: 78, gap: 150, kinds: ['pine', 'pine', 'boulder'] },
      spawns: [
        { type: 'pine', count: 64, gap: 125, grove: true, terrain: true }, { type: 'boulder', count: 26, gap: 0, terrain: true },
        { type: 'dead_tree', count: 10, gap: 112, terrain: true },
        { type: 'stones', count: 16 }, { type: 'log', count: 5 }, { type: 'branches', count: 10, nearTree: true }
      ],
      enemyPlan: { frozen: 5, shambler: 2, crawler: 2, runner: 1 },
      loot: [
        { type: 'tarp', count: 3, spots: [[1500, 2240], [2600, 2060], [1100, 1700], [2000, 1130], [1800, 600]] },
        { type: 'crate', count: 2, spots: [[2640, 2320], [2480, 2290], [1230, 2160]] },
        { type: 'scrap', count: 3, spots: [[1050, 2000], [2840, 1300], [2440, 1620], [1500, 1400]] },
        { type: 'radio', count: 1, spots: [[1620, 520], [1780, 440]] },
        { type: 'pack_parka', count: 1, spots: [[2250, 1790], [1330, 1760], [2860, 1350]] },       // warm clothes in frozen packs
        { type: 'pack_hat', count: 1, spots: [[1450, 2260], [2050, 1900], [1950, 780]] },
        { type: 'pack_pants', count: 1, spots: [[2500, 1500], [1050, 1330], [1800, 1050]] },
        { type: 'pack_boots', count: 1, spots: [[2350, 2380], [1220, 1980], [2900, 1700]] },
        { type: 'pack_tea', count: 2, spots: [[2200, 1740], [1700, 2090], [2150, 1240]] },
        { type: 'pack_warmer', count: 1, spots: [[2620, 1160], [1580, 1480]] }
      ]
    };
  }

  AR.peaks = peaks();
})(typeof window !== 'undefined' ? window : globalThis);
