// Interiors the story needs that no generated building gives: the cargo ship's engine room and bridge (chapter 5).
// Same format as the station floors in data/areas.js. Loaded after data/interiors.js, before data/story-wire.js.
// storyEntry: the way in has no door in the port (it is a story spot), so the door-pairing test skips it.
// The way in is a story spot on the quay (spot_ship_hatch / spot_ship_door in data/story-wire.js); the way out is the door at the bottom.
(function (root) {
  'use strict';
  var G = root.G;
  var AREAS = G.data.areas, PI = Math.PI;

  function room(o) {
    var W = o.w, H = o.h, S = [], T = 22, K = 0.06;
    function add(e) { S.push(e); return e; }
    function f(style, x, y, w, h, k, x2) { var e = { kind: 'furn', style: style, x: x, y: y, w: w, h: h, k: k }; for (var q in x2 || {}) e[q] = x2[q]; return add(e); }
    add({ kind: 'iwall', x: 100, y: 100, w: W - 200, h: T, k: K });                       // north
    add({ kind: 'iwall', x: 100, y: 100, w: T, h: H - 200, k: K });                       // west
    add({ kind: 'iwall', x: W - 122, y: 100, w: T, h: H - 200, k: K });                   // east
    var gx = o.doorX;                                                                      // south wall with the door gap
    add({ kind: 'iwall', x: 100, y: H - 122, w: gx - 70 - 100, h: T, k: K });
    add({ kind: 'iwall', x: gx + 70, y: H - 122, w: W - 100 - (gx + 70), h: T, k: K });
    o.furniture(f, add);
    return {
      id: o.id, name: o.name, parent: 'port', interior: true,
      seed: o.seed, width: W, height: H, margin: 120,
      exit: null, doors: [{ x: gx, y: H - 112, r: 56, to: 'port', at: o.outside, face: PI / 2, label: 'יציאה לרציף', storyEntry: true }],
      spawn: { x: gx, y: H - 210 },
      clearing: 0, reach: 26,
      paths: [], roads: [], ponds: [], water: [], decks: [], structures: S,
      footprint: { x: 100, y: 100, w: W - 200, h: H - 200 },
      floors: [{ x: 122, y: 122, w: W - 244, h: H - 244, tone: o.tone }],
      lights: o.lights,
      border: null,
      theme: { ground: 'tiles', trail: false, tones: [['0,0,0', 0.28], ['60,62,64', 0.08]], decor: [['papers', 14], ['pebbles', 30]] },
      spawns: [], loot: o.loot || []
    };
  }

  // Engine room: a dead main engine, a small generator humming in the corner, a mattress, a rain bucket and a fishing line through a hatch.
  AREAS.ship_engine = room({
    id: 'ship_engine', name: 'הספינה · חדר המכונות', w: 1700, h: 1000, doorX: 850, seed: 9966 + 11, tone: '46,50,52',
    outside: { x: 2560, y: 945 },
    lights: [[450, 300, 240], [1250, 300, 200], [850, 820, 260]],
    furniture: function (f) {
      f('cabinet', 380, 170, 560, 200, 0.11);                       // the main engine
      f('cabinet', 1300, 170, 120, 110, 0.075);                    // the generator with the one bulb
      f('bunk', 160, 640, 150, 70, 0.03);                          // the mattress
      f('table', 1250, 560, 200, 90, 0.035); f('locker', 124, 330, 50, 200, 0.1);
      f('shelf', 1500, 330, 60, 300, 0.09);
    },
    loot: [{ type: 'cargo', count: 1, spots: [[1370, 680], [1520, 700]] }, { type: 'scrap', count: 2, spots: [[300, 520], [700, 560], [1100, 480]] }]
  });

  // Bridge: chart table, the helm, a chair with a blanket, windows to the sea (the north wall).
  AREAS.ship_bridge = room({
    id: 'ship_bridge', name: 'הספינה · גשר הפיקוד', w: 1400, h: 800, doorX: 700, seed: 9966 + 12, tone: '56,52,46',
    outside: { x: 2050, y: 945 },
    lights: [[400, 260, 240], [1000, 260, 240], [700, 600, 220]],
    furniture: function (f) {
      f('table', 540, 250, 300, 110, 0.04);                        // the chart table
      f('cabinet', 1020, 140, 180, 60, 0.075);                     // the helm
      f('chair', 1090, 400, 50, 50, 0.03); f('locker', 124, 300, 50, 200, 0.1); f('bench', 200, 560, 160, 40, 0.025);
    },
    loot: [{ type: 'medkit', count: 1, spots: [[260, 480], [1180, 560]] }]
  });
})(typeof window !== 'undefined' ? window : globalThis);
