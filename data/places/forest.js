// The forest's two hidden places (plain data; mutates G.data.areas before data/interiors.js links the doors):
//   forest_cellar  a dark bunker cellar under a hatch in the forest: a corridor, six open rooms (storage, workshop, bunks,
//                  generator, pantry, radio room) and two rooms sealed behind boarded walls that only an axe opens.
//   forest_rad     an irradiated zone behind a gate in the east of the forest. The gate opens only with a gas mask in the bag
//                  (item `gasmask`, crafted at the workbench level 2). Irradiated infected (`glower`) live there.
// Rooms are meant as places for story tasks: spots can be added per room in data/story-wire.js (area + x, y).
(function (root) {
  'use strict';
  var G = root.G, AR = G && G.data && G.data.areas;
  if (!AR || !AR.forest) return;
  var PI = Math.PI;

  // ---- the cellar ----
  function cellar() {
    var W = 2600, H = 1500, S = [], T = 22, K = 0.06, loot = [];
    function add(o) { S.push(o); return o; }
    function f(style, x, y, w, h, k, o) { var e = { kind: 'furn', style: style, x: x, y: y, w: w, h: h, k: k }; for (var q in o || {}) e[q] = o[q]; return add(e); }
    function span(a, b, gaps, fn) { var cur = a; (gaps || []).forEach(function (g) { if (g[0] > cur) fn(cur, g[0]); cur = g[1]; }); if (b > cur) fn(cur, b); }
    function hwall(y, x0, x1, gaps) { span(x0, x1, gaps, function (a, b) { add({ kind: 'iwall', x: a, y: y, w: b - a, h: T, k: K }); }); }
    function vwall(x, y0, y1, gaps) { span(y0, y1, gaps, function (a, b) { add({ kind: 'iwall', x: x, y: a, w: T, h: b - a, k: K }); }); }
    function sealed(x, y, w, h, room) { return add({ kind: 'bwall', x: x, y: y, w: w, h: h, k: K, breakable: true, hp: 4, room: room }); }
    function L(type, spots, count) { loot.push({ type: type, count: count || spots.length, spots: spots }); }

    hwall(100, 100, 2500); hwall(1378, 100, 2500); vwall(100, 100, 1400); vwall(2478, 100, 1400);
    // the corridor runs east-west between y 560 and y 760; a door in each north room, and in each south room except the sealed ones
    hwall(560, 122, 2478, [[380, 500], [960, 1080], [1560, 1680], [2160, 2280]]);
    hwall(760, 122, 2478, [[420, 540], [1100, 1220], [1700, 1820], [2200, 2320]]);
    vwall(700, 122, 560); vwall(1300, 122, 560); vwall(1900, 122, 560);
    vwall(800, 782, 1378); vwall(1500, 782, 1378); vwall(2100, 782, 1378);
    sealed(1700, 760, 120, T, { x: 1522, y: 782, w: 578, h: 596 }); sealed(2200, 760, 120, T, { x: 2122, y: 782, w: 356, h: 596 });                       // the vault and the lab are boarded up

    // north: A storage, B workshop, C bunks, D generator
    for (var s = 0; s < 3; s++) f('shelf', 140 + s * 170, 150, 60, 330, 0.09);
    f('rack', 640, 150, 50, 200, 0.07);
    f('table', 740, 250, 300, 90, 0.04); f('cabinet', 1180, 140, 90, 200, 0.075); f('rack', 760, 150, 220, 40, 0.07); f('chair', 840, 360, 44, 44, 0.025);
    f('bunk', 1340, 150, 80, 160, 0.06); f('bunk', 1460, 150, 80, 160, 0.06); f('bunk', 1580, 150, 80, 160, 0.06); f('locker', 1760, 140, 110, 60, 0.09); f('table', 1700, 400, 120, 90, 0.035);
    f('cabinet', 1930, 140, 100, 80, 0.08); f('cabinet', 2330, 140, 100, 80, 0.08); f('rack', 2060, 200, 200, 60, 0.07); f('monitor', 2140, 400, 50, 40, 0.07);
    // south: E pantry, F radio room, G vault (sealed), H lab (sealed)
    for (s = 0; s < 3; s++) f('shelf', 140 + s * 200, 1000, 70, 340, 0.09);
    f('fridge', 700, 810, 90, 64, 0.1);
    f('desk', 900, 1000, 300, 90, 0.045); f('chair', 1010, 1110, 44, 44, 0.025); f('monitor', 1000, 960, 50, 40, 0.07); f('board', 1100, 782, 260, 18, 0.07); f('cabinet', 1400, 1000, 80, 160, 0.075);
    f('safe', 1560, 1240, 90, 90, 0.07); f('shelf', 1530, 900, 60, 280, 0.09); f('shelf', 1900, 820, 160, 60, 0.09); f('locker', 1690, 1310, 150, 50, 0.09);
    f('table', 2200, 1000, 240, 90, 0.04); f('medcab', 2130, 900, 60, 160, 0.09); f('fridge', 2380, 820, 80, 60, 0.1); f('table', 2200, 1200, 240, 90, 0.04);
    f('rail', 140, 640, 14, 120, 0.05);

    // salvage: storage and workshop are plain, the pantry has food and water, the sealed rooms hold the good things
    L('crate', [[250, 600], [560, 300], [450, 480], [930, 440], [1010, 220], [1900, 1300], [1850, 1080]], 3);
    L('scrap', [[820, 420], [1100, 300], [900, 500]], 2);
    L('tarp', [[1380, 400], [1620, 330]], 1);
    L('cargo', [[300, 1280], [520, 1280], [300, 1050], [720, 1340], [2240, 1345], [1900, 1330]], 2);
    L('radio', [[1250, 1220], [1330, 1150]], 1);
    L('medkit', [[1780, 1200], [1650, 1160], [2300, 900], [2220, 900], [2300, 1340]], 3);       // vault and lab
    L('stash_ammo', [[1880, 1000]], 1);                                        // the vault: ammunition that is not found anywhere else
    L('stash_med', [[2330, 1150]], 1);                                         // the lab
    return {
      id: 'forest_cellar', name: 'המרתף ביער', parent: 'forest', interior: true,
      seed: 3377, width: W, height: H, margin: 120,
      exit: null,
      doors: [{ x: 150, y: 660, r: 52, to: 'forest', at: { x: 1330, y: 1210 }, face: PI / 2, label: 'עלייה ליער' },
        { x: 2420, y: 1325, r: 46, to: 'forest_deep', at: { x: 260, y: 660 }, face: 0, label: 'מעבר אל המנהרות' }],
      spawn: { x: 260, y: 660 }, clearing: 0, reach: 26,
      paths: [], roads: [], ponds: [], water: [], decks: [], structures: S,
      footprint: { x: 100, y: 100, w: 2400, h: 1300 },
      floors: [{ x: 122, y: 580, w: 2356, h: 180, tone: '40,44,42' }, { x: 122, y: 122, w: 578, h: 438, tone: '44,40,36' }, { x: 122, y: 782, w: 678, h: 596, tone: '46,42,36' }],
      // lamps: small pools of light along the corridor and in the rooms that are still powered (the rest is black)
      lights: [[160, 660, 190], [900, 660, 160], [1700, 660, 160], [2400, 660, 170], [1000, 360, 190], [1600, 330, 150], [1100, 1100, 190]],
      dark: { level: 0.96, torch: 360 },
      enemyPlan: { shambler: 5, crawler: 4, runner: 2, screamer: 1 },
      border: null,
      theme: { ground: 'tiles', trail: false, tones: [['0,0,0', 0.3], ['40,50,42', 0.08]], decor: [['papers', 30], ['pebbles', 30]] },
      spawns: [], loot: loot
    };
  }

  // ---- the tunnels under the cellar: reached from the sealed lab; a server room, a dormitory, a decontamination room,
  // a storage room and a sealed archive that has the way out to the irradiated zone (it needs the mask there too) ----
  function deep() {
    var W = 2200, H = 1300, S = [], T = 22, K = 0.06, loot = [];
    function add(o) { S.push(o); return o; }
    function f(style, x, y, w, h, k, o) { var e = { kind: 'furn', style: style, x: x, y: y, w: w, h: h, k: k }; for (var q in o || {}) e[q] = o[q]; return add(e); }
    function span(a, b, gaps, fn) { var cur = a; (gaps || []).forEach(function (g) { if (g[0] > cur) fn(cur, g[0]); cur = g[1]; }); if (b > cur) fn(cur, b); }
    function hwall(y, x0, x1, gaps) { span(x0, x1, gaps, function (a, b) { add({ kind: 'iwall', x: a, y: y, w: b - a, h: T, k: K }); }); }
    function vwall(x, y0, y1, gaps) { span(y0, y1, gaps, function (a, b) { add({ kind: 'iwall', x: x, y: a, w: T, h: b - a, k: K }); }); }
    function L(type, spots, count) { loot.push({ type: type, count: count || spots.length, spots: spots }); }
    hwall(100, 100, 2100); hwall(1178, 100, 2100); vwall(100, 100, 1200); vwall(2078, 100, 1200);
    hwall(560, 122, 2078, [[380, 500], [1000, 1120], [1700, 1820]]);
    hwall(760, 122, 2078, [[420, 540], [1100, 1220], [1700, 1820]]);
    vwall(700, 122, 560); vwall(1400, 122, 560); vwall(800, 782, 1178); vwall(1500, 782, 1178);
    add({ kind: 'bwall', x: 1100, y: 760, w: 120, h: T, k: K, breakable: true, hp: 5, room: { x: 822, y: 782, w: 678, h: 396 } });   // the archive
    for (var s = 0; s < 4; s++) f('rack', 140 + s * 130, 150, 90, 200, 0.09);                     // server room
    f('desk', 160, 420, 300, 80, 0.045); f('monitor', 240, 400, 50, 40, 0.07); f('chair', 300, 500, 44, 44, 0.025);
    for (s = 0; s < 4; s++) f('bunk', 740 + s * 150, 150, 80, 160, 0.06); f('locker', 760, 440, 200, 50, 0.09); f('table', 1100, 400, 200, 90, 0.035);
    f('medcab', 1440, 140, 70, 200, 0.09); f('counter', 1600, 150, 300, 50, 0.05); f('rail', 1580, 300, 300, 14, 0.05); f('medcab', 1960, 300, 90, 140, 0.09);
    for (s = 0; s < 3; s++) f('shelf', 150 + s * 190, 1000, 70, 150, 0.09);                         // storage
    f('table', 840, 1000, 80, 130, 0.035); f('desk', 1000, 1060, 280, 80, 0.045); f('safe', 1380, 1060, 90, 90, 0.07); f('cabinet', 1300, 830, 160, 50, 0.075);   // archive
    f('table', 1600, 1000, 300, 90, 0.04); f('fridge', 1960, 810, 90, 60, 0.1); f('shelf', 1560, 1090, 300, 60, 0.09);
    L('radio', [[330, 360], [250, 520]], 1); L('scrap', [[600, 420], [400, 610]], 1); L('tarp', [[820, 360], [1350, 450]], 1);
    L('cargo', [[250, 870], [450, 900]], 1); L('medkit', [[1520, 440], [1980, 450]], 1);
    L('stash_parts', [[660, 300]], 1);                                                           // server room
    L('stash_arms', [[1180, 980]], 1);                                                           // the archive: the one thing here that is found nowhere else
    L('stash_food', [[700, 1100]], 1);
    return {
      id: 'forest_deep', name: 'מנהרות מתחת ליער', parent: 'forest', interior: true,
      seed: 5599, width: W, height: H, margin: 120, exit: null,
      doors: [{ x: 150, y: 660, r: 52, to: 'forest_cellar', at: { x: 2330, y: 1345 }, face: PI, label: "חזרה למרתף" },
        { x: 1160, y: 1130, r: 50, to: 'forest_rad', at: { x: 1500, y: 640 }, face: PI / 2, label: 'מנהרה אל אזור הקרינה',
          need: 'gasmask', needText: 'המנהרה נפתחת אל האזור המוקרן. צריך מסכת גז בתיק' }],
      spawn: { x: 260, y: 660 }, clearing: 0, reach: 26,
      paths: [], roads: [], ponds: [], water: [], decks: [], structures: S,
      footprint: { x: 100, y: 100, w: 2000, h: 1100 },
      floors: [{ x: 122, y: 580, w: 1956, h: 180, tone: '36,40,38' }, { x: 122, y: 122, w: 578, h: 438, tone: '34,42,44' }, { x: 1400, y: 122, w: 678, h: 438, tone: '40,46,44' }],
      lights: [[160, 660, 180], [1000, 660, 160], [1900, 660, 170], [400, 300, 170], [1650, 300, 160]],
      dark: { level: 0.97, torch: 360 },
      enemyPlan: { shambler: 4, crawler: 4, runner: 2, glower: 2 },
      border: null,
      theme: { ground: 'tiles', trail: false, tones: [['0,0,0', 0.34], ['30,46,40', 0.1]], decor: [['papers', 20], ['pebbles', 30]] },
      spawns: [], loot: loot
    };
  }

  // ---- the irradiated zone (open air, fenced, a sickly green) ----
  function rad() {
    var W = 3000, H = 2200, S = [], loot = [];
    function add(o) { S.push(o); return o; }
    function L(type, spots, count) { loot.push({ type: type, count: count || spots.length, spots: spots }); }
    // a broken fence ring with the gate at the south, hazmat tents, drums and a leaking tank, burnt vehicles
    add({ kind: 'fence', x: 300, y: 300, w: 1200, h: 12, k: 0.05 }); add({ kind: 'fence', x: 1700, y: 300, w: 1000, h: 12, k: 0.05 });
    add({ kind: 'fence', x: 300, y: 300, w: 12, h: 1500, k: 0.05 }); add({ kind: 'fence', x: 2690, y: 300, w: 12, h: 1500, k: 0.05 });
    add({ kind: 'tent', x: 700, y: 700, w: 240, h: 170, k: 0.1, color: '#c9c25a' }); add({ kind: 'tent', x: 1050, y: 640, w: 200, h: 160, k: 0.09, color: '#b9b350' });
    add({ kind: 'tent', x: 2050, y: 900, w: 260, h: 180, k: 0.1, color: '#c9c25a' });
    add({ kind: 'tankc', x: 1500, y: 1000, w: 220, h: 220, k: 0.16 }); add({ kind: 'tankc', x: 1800, y: 1100, w: 170, h: 170, k: 0.13 });
    add({ kind: 'container', x: 500, y: 1200, w: 220, h: 76, k: 0.068, level: 1, color: '#55623f', open: true });
    add({ kind: 'container', x: 2250, y: 1500, w: 220, h: 76, k: 0.068, level: 1, color: '#6b4a3a' });
    add({ kind: 'car', x: 1100, y: 1400, w: 200, h: 84, k: 0.07, style: 'truck', color: '#4a4f40' });
    add({ kind: 'car', x: 2300, y: 600, w: 140, h: 70, k: 0.045, burnt: true, color: '#3a3430' });
    add({ kind: 'pile', x: 900, y: 1000, w: 120, h: 90, k: 0.05 }); add({ kind: 'pile', x: 1500, y: 1500, w: 140, h: 100, k: 0.05 });
    add({ kind: 'barrier', x: 1100, y: 1950, w: 190, h: 30, k: 0.028 }); add({ kind: 'barrier', x: 1700, y: 1950, w: 190, h: 30, k: 0.028 });
    L('barrel', [[820, 1000], [1380, 1080], [1980, 1250], [2080, 700], [640, 1320], [1620, 1380]], 4);
    L('scrap', [[1000, 880], [1900, 980], [1380, 1520], [800, 1500], [2300, 760], [1250, 1240]], 4);
    L('medkit', [[760, 920], [1100, 840], [2120, 1130]], 2);
    L('radio', [[610, 1290], [1200, 1560]], 1);
    L('cargo', [[570, 1310], [2330, 1580]], 1);
    L('tarp', [[1000, 1260], [2200, 840]], 1);
    return {
      id: 'forest_rad', name: 'אזור קרינה', parent: 'forest', interior: false,
      seed: 4411, width: W, height: H, margin: 150,
      exit: null,
      doors: [{ x: 1500, y: 2090, r: 90, to: 'forest', at: { x: 3080, y: 1100 }, face: PI, label: 'יציאה מאזור הקרינה', art: 'rad' },
        { x: 1500, y: 520, r: 50, to: 'forest_deep', at: { x: 1160, y: 1040 }, face: -PI / 2, label: 'ירידה אל המנהרות', art: 'hatch' }],
      spawn: { x: 1500, y: 1960 }, clearing: 210, reach: 26,
      paths: [[[1500, 2200], [1500, 1500]]],
      roads: [], ponds: [], water: [], decks: [], structures: S,
      enemyPlan: { glower: 4, shambler: 2, crawler: 2, screamer: 1 },
      border: null,
      theme: {
        ground: 'gravel', trail: false,
        tones: [['70,140,40', 0.3], ['0,0,0', 0.22], ['150,200,70', 0.06], ['60,70,40', 0.1]],
        decor: [['pebbles', 220], ['leaves', 80]]
      },
      spawns: [
        { type: 'dead_tree', count: 14, gap: 115, terrain: true },
        { type: 'boulder', count: 8, gap: 0, terrain: true },
        { type: 'stones', count: 12 },
        { type: 'branches', count: 6, nearTree: true }
      ],
      loot: loot
    };
  }

  AR.forest_cellar = cellar();
  AR.forest_deep = deep();
  AR.forest_rad = rad();

  // the forest: a hatch to the cellar (end of the west trail) and the gas-mask gate to the zone (end of a new trail, east)
  var F = AR.forest;
  F.doors = (F.doors || []).concat([
    { x: 1330, y: 1130, r: 50, to: 'forest_cellar', at: { x: 260, y: 660 }, face: 0, label: 'ירידה למרתף', art: 'hatch' },
    { x: 3180, y: 1030, r: 100, to: 'forest_rad', at: { x: 1500, y: 1960 }, face: -PI / 2, label: 'כניסה לאזור הקרינה', art: 'rad',
      need: 'gasmask', needText: 'השער מסומן בסימן קרינה. צריך מסכת גז בתיק (שולחן עבודה רמה 2)' }
  ]);
  F.paths = (F.paths || []).concat([[[2640, 1530], [2900, 1300], [3180, 1090]]]);
})(typeof window !== 'undefined' ? window : globalThis);
