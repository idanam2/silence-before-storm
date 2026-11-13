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

  // ---- the port: a hand-built place (water, piers, warehouses, a container yard, a moored ship, cranes) ----
  // Hand-built places add to the standard area:
  //   water:  [rect]  open water you cannot walk into (drawn by js/placeart.js). decks: [rect] walkable piers over it.
  //   structures: [{ kind, x, y, w, h, k, solid, legs, ... }] boxes with height k (same scale as the base, see
  //     js/baseart.js). solid: false = only drawn (ships in the water, crane beams). legs: [rect] solid feet only.
  //   loot: [{ type, count, spots: [[x, y], ...] }] resources placed at sensible spots: each visit picks `count` of them.
  //   theme.ground: 'concrete' paving instead of forest floor. theme.decor: [[kind, count], ...] small decor.
  //   theme.trail: false = no worn dirt trail (roads are drawn by js/placeart.js from `roads`).
  function port() {
    var W = 4000, H = 2600, rand = G.util.rng(9966), S = [], i, j;
    function add(o) { S.push(o); return o; }

    // north: the sea, a small boat basin cut into the quay, two wooden piers (the east one with a T-head)
    var water = [{ x: 0, y: 0, w: W, h: 880 }, { x: 1150, y: 880, w: 500, h: 230 }];
    var decks = [{ x: 520, y: 360, w: 150, h: 530 }, { x: 3420, y: 400, w: 160, h: 490 }, { x: 3260, y: 300, w: 480, h: 110 },
      { x: 1150, y: 1000, w: 260, h: 46 }];

    // moored: a long cargo ship along the quay, a fishing boat at the west pier, a small boat in the basin
    add({ kind: 'ship', x: 1880, y: 560, w: 1300, h: 270, k: 0.05, solid: false });
    add({ kind: 'boat', x: 700, y: 470, w: 92, h: 260, k: 0.04, solid: false, cabin: true });
    add({ kind: 'boat', x: 1440, y: 930, w: 66, h: 150, k: 0.03, solid: false, sunk: true });

    // quay cranes: four solid feet on the quay, a tall gantry, a boom reaching over the ship
    [2330, 2820].forEach(function (cx) {
      add({ kind: 'crane', x: cx - 100, y: 920, w: 200, h: 160, k: 0.36, solid: false, boom: 360,
        legs: [{ x: cx - 100, y: 920, w: 26, h: 26 }, { x: cx + 74, y: 920, w: 26, h: 26 }, { x: cx - 100, y: 1054, w: 26, h: 26 }, { x: cx + 74, y: 1054, w: 26, h: 26 }] });
    });
    for (i = 1740; i <= 3300; i += 170) {                    // mooring bollards along the quay edge
      if (Math.abs(i - 2330) < 140 || Math.abs(i - 2820) < 140) continue;
      add({ kind: 'bollard', x: i, y: 896, w: 16, h: 16, k: 0.022 });
    }
    add({ kind: 'bollard', x: 420, y: 896, w: 16, h: 16, k: 0.022 }); add({ kind: 'bollard', x: 860, y: 896, w: 16, h: 16, k: 0.022 });

    // container yard east of the main road: back-to-back rows of stacks (1-3 high), a cross lane in the middle
    var COLS = ['#7a3f30', '#2f5a5c', '#8a6a2c', '#4b5358', '#3c4f72', '#6b4a3a', '#55623f'], open = [];
    [[1240, 1316], [1520, 1596]].forEach(function (pair) {
      for (var c = 0; c < 7; c++) {
        var x = 2110 + c * 238 + (c >= 4 ? 70 : 0);
        for (j = 0; j < 2; j++) {
          if (rand() < 0.13) continue;                       // a gap where a stack is missing
          var lv = 1 + Math.floor(rand() * 3), ct = add({ kind: 'container', x: x, y: pair[j], w: 220, h: 76, k: 0.068 * lv, level: lv, color: COLS[Math.floor(rand() * COLS.length)] });
          if (j === 1 && lv === 1 && open.length < 3 && rand() < 0.6) { ct.open = true; open.push([x + 110, pair[j] + 112]); }
        }
      }
    });
    if (open.length < 2) { S[S.length - 1].open = true; open.push([S[S.length - 1].x + 110, S[S.length - 1].y + 112]); }
    add({ kind: 'container', x: 1700, y: 950, w: 220, h: 76, k: 0.068, level: 1, color: COLS[0] });        // left on the quay
    add({ kind: 'container', x: 3640, y: 940, w: 220, h: 76, k: 0.136, level: 2, color: COLS[3] });

    // warehouses on the west side, big doors facing the road (south), one with a collapsed roof
    add({ kind: 'warehouse', x: 260, y: 1240, w: 780, h: 360, k: 0.17, door: 0.5, color: '#4b4f4a' });
    add({ kind: 'warehouse', x: 260, y: 1860, w: 640, h: 260, k: 0.13, door: 0.62, color: '#55503f', broken: true });
    add({ kind: 'dock', x: 520, y: 1600, w: 260, h: 44, k: 0.03, solid: false });           // loading ramp in front of the big door

    // harbour office by the gate, fuel tanks to the east, a perimeter fence with an open gate
    add({ kind: 'office', x: 2200, y: 1960, w: 230, h: 140, k: 0.11 });
    add({ kind: 'tankc', x: 3380, y: 1880, w: 200, h: 200, k: 0.16 });
    add({ kind: 'tankc', x: 3640, y: 1960, w: 160, h: 160, k: 0.13 });
    add({ kind: 'fence', x: 150, y: 2236, w: 1730, h: 12, k: 0.05 });
    add({ kind: 'fence', x: 2120, y: 2236, w: 1730, h: 12, k: 0.05 });
    [[1860, 2228], [2120, 2228]].forEach(function (p) { add({ kind: 'gatepost', x: p[0], y: p[1], w: 22, h: 26, k: 0.08 }); });
    for (i = 0; i < 6; i++) add({ kind: 'lamp', x: 1892 + (i % 2) * 204, y: 1260 + Math.floor(i / 2) * 330, w: 10, h: 10, k: 0.2 });

    var A = {
      id: 'port', name: 'הנמל',
      seed: 9966, width: W, height: H, margin: 150,
      exit: { x: 2000, y: 2440, r: 78 }, spawn: { x: 2000, y: 2330 },
      clearing: 210, reach: 26,
      paths: [[[2000, H], [2000, 1130]], [[260, 1130], [3800, 1130]], [[2000, 1700], [3800, 1700]]],
      roads: [{ x: 1920, y: 1120, w: 160, h: H - 1120 }, { x: 150, y: 1095, w: 3700, h: 110 }, { x: 1700, y: 1660, w: 2150, h: 100 }],
      ponds: [], water: water, decks: decks, structures: S,
      border: null,
      theme: {
        ground: 'concrete', trail: false,
        tones: [['40,64,76', 0.1], ['0,0,0', 0.2], ['86,92,88', 0.07], ['70,62,48', 0.1], ['44,60,40', 0.08]],
        decor: [['pebbles', 260], ['grass', 300], ['leaves', 60]]
      },
      spawns: [
        { type: 'dead_tree', count: 7,  gap: 115, terrain: true },
        { type: 'boulder',   count: 3,  gap: 0,   terrain: true },
        { type: 'stones',    count: 14 },
        { type: 'log',       count: 4 },
        { type: 'branches',  count: 5, nearTree: true }
      ],
      loot: [
        // wooden crates: loading ramp, warehouse doors, on the quay by the cranes, on the T-head pier
        { type: 'crate', count: 6, spots: [[470, 1660], [840, 1662], [650, 1700], [470, 2195], [760, 2195], [1960, 980], [2560, 960], [3080, 970], [3380, 350], [3660, 350]] },
        { type: 'pallet', count: 6, spots: [[1100, 1300], [1100, 1460], [960, 1640], [1000, 1960], [1680, 1450], [2200, 1440], [3020, 1440], [3560, 1450], [2480, 1800], [1500, 1260]] },
        // scrap metal: under the cranes, along the yard, by the fuel tanks and the office
        { type: 'scrap', count: 7, spots: [[2330, 1000], [2820, 1000], [2580, 1180], [3300, 1180], [1660, 1340], [3700, 1440], [3260, 1820], [3640, 2160], [2520, 2060], [1240, 1180], [3500, 1720]] },
        { type: 'tarp', count: 4, spots: [[590, 820], [600, 450], [1350, 1023], [3500, 850], [2050, 1000], [2700, 1180], [1080, 2060]] },
        { type: 'cargo', count: 2, spots: open.concat([[650, 1625]]) },
        { type: 'barrel', count: 3, spots: [[220, 1600], [1080, 1180], [2470, 2120], [1960, 2160], [3820, 1820]] }
      ]
    };
    return A;
  }

  // ---- the police station: a town block. The station (two floors you can walk through, see stationFloor below),
  // a garage wing, a walled yard with a watchtower, a parking lot of abandoned patrol cars behind sandbags,
  // an impound yard and shops across the main street ----
  //   extra keys: lots: [rect] painted parking areas (drawn by js/placeart.js).
  //   doors: [{ x, y, r, to, at: {x, y}, face, label }] E inside the circle goes to area `to`, arriving at `at`.
  function police() {
    var W = 3600, H = 2600, S = [], i;
    function add(o) { S.push(o); return o; }
    function car(x, y, o) {                                  // vertical cars are 70 x 140, horizontal 140 x 70
      o = o || {};
      var v = o.horiz ? { w: 140, h: 70 } : { w: 70, h: 140 };
      return add({ kind: 'car', x: x, y: y, w: o.w || v.w, h: o.h || v.h, k: o.bus ? 0.075 : 0.045, police: !!o.police, burnt: !!o.burnt, bus: !!o.bus,
        open: !!o.open, color: o.color || (o.police ? '#3b4a5c' : '#5b5348') });
    }

    // the station: big two-storey offices, the entrance in the middle of the south face; a garage wing to the east
    add({ kind: 'block', x: 900, y: 560, w: 1800, h: 640, k: 0.17, floors: 2, color: '#5c5f59', entrance: 0.5, sign: 'משטרה', antenna: true, bars: true });
    add({ kind: 'block', x: 2700, y: 640, w: 380, h: 520, k: 0.11, floors: 1, color: '#55584f', garage: 2 });
    add({ kind: 'flagpole', x: 1500, y: 1250, w: 10, h: 10, k: 0.3 });
    // walled exercise yard behind the station (open on the west side), with a watchtower in the corner
    add({ kind: 'wall', x: 900, y: 260, w: 1800, h: 18, k: 0.075 });
    add({ kind: 'wall', x: 900, y: 260, w: 18, h: 140, k: 0.075 });
    add({ kind: 'wall', x: 2682, y: 260, w: 18, h: 300, k: 0.075 });
    add({ kind: 'tower', x: 2540, y: 300, w: 100, h: 100, k: 0.27, solid: false,
      legs: [{ x: 2540, y: 300, w: 16, h: 16 }, { x: 2624, y: 300, w: 16, h: 16 }, { x: 2540, y: 384, w: 16, h: 16 }, { x: 2624, y: 384, w: 16, h: 16 }] });

    // the front: sandbag walls with a gap at the door, a parking lot of patrol cars, concrete barriers on the street
    add({ kind: 'sandbags', x: 1580, y: 1262, w: 170, h: 30, k: 0.03 });
    add({ kind: 'sandbags', x: 1850, y: 1262, w: 170, h: 30, k: 0.03 });
    car(960, 1350, { police: true }); car(1070, 1350, { police: true, open: true }); car(1180, 1350, { police: true });
    car(2000, 1350, { police: true, burnt: true }); car(2110, 1350, { police: true }); car(2400, 1340, { color: '#4a5a52' }); car(2520, 1440, { horiz: true, color: '#6a5a44', open: true });
    add({ kind: 'barrier', x: 1000, y: 1628, w: 190, h: 30, k: 0.028 }); add({ kind: 'barrier', x: 1210, y: 1628, w: 190, h: 30, k: 0.028 });
    add({ kind: 'barrier', x: 2400, y: 1680, w: 190, h: 30, k: 0.028 }); add({ kind: 'barrier', x: 2610, y: 1660, w: 190, h: 30, k: 0.028 });
    car(380, 1605, { bus: true, burnt: true, horiz: true, w: 340, h: 92 });
    car(3000, 1620, { horiz: true, burnt: true });

    // impound yard to the east: chain-link fence with a gate gap in the south side, wrecks inside
    add({ kind: 'fence', x: 3110, y: 640, w: 350, h: 12, k: 0.06 });
    add({ kind: 'fence', x: 3110, y: 640, w: 12, h: 860, k: 0.06 });
    add({ kind: 'fence', x: 3448, y: 640, w: 12, h: 860, k: 0.06 });
    add({ kind: 'fence', x: 3110, y: 1488, w: 110, h: 12, k: 0.06 });
    add({ kind: 'fence', x: 3330, y: 1488, w: 130, h: 12, k: 0.06 });
    car(3160, 720, { burnt: true }); car(3300, 760, { color: '#5e4a3c', open: true });
    car(3170, 1100, { horiz: true, color: '#56604c' }); car(3300, 1250, { horiz: true, burnt: true });

    // shops across the main street, awnings over broken windows
    [[300, 420, 0.12, '#5a5348'], [760, 380, 0.1, '#4f5550'], [2000, 460, 0.13, '#57504a'], [2500, 400, 0.1, '#4d524c'], [2960, 380, 0.11, '#55504a']].forEach(function (s) {
      add({ kind: 'shop', x: s[0], y: 1820, w: s[1], h: 230, k: s[2], color: s[3] });
    });
    for (i = 0; i < 7; i++) add({ kind: 'lamp', x: 420 + i * 500, y: 1562, w: 10, h: 10, k: 0.2 });

    return {
      id: 'police', name: 'תחנת המשטרה',
      seed: 7744, width: W, height: H, margin: 150,
      exit: { x: 1800, y: 2440, r: 78 }, spawn: { x: 1800, y: 2330 },
      doors: [{ x: 1800, y: 1236, r: 52, to: 'police_f1', at: { x: 1200, y: 1300 }, face: -Math.PI / 2, label: 'כניסה לתחנה' }],
      clearing: 210, reach: 26,
      paths: [[[1800, H], [1800, 1580]], [[150, 1655], [3450, 1655]]],
      roads: [{ x: 150, y: 1580, w: 3300, h: 150 }, { x: 1720, y: 1730, w: 160, h: H - 1730 }],
      lots: [{ x: 900, y: 1300, w: 1800, h: 270 }, { x: 3125, y: 655, w: 320, h: 830 }],
      ponds: [], water: [], decks: [], structures: S,
      border: null,
      theme: {
        ground: 'concrete', trail: false,
        tones: [['66,72,80', 0.1], ['0,0,0', 0.2], ['90,94,90', 0.06], ['44,58,40', 0.1]],
        decor: [['pebbles', 260], ['grass', 460], ['leaves', 130], ['bush', 10]]
      },
      spawns: [
        { type: 'dead_tree', count: 12, gap: 118, terrain: true },
        { type: 'oak',       count: 4,  gap: 140, terrain: true },
        { type: 'stones',    count: 12 },
        { type: 'branches',  count: 8, nearTree: true },
        { type: 'mushrooms', count: 4, nearTree: true }
      ],
      loot: [
        { type: 'medkit', count: 2, spots: [[2890, 1200], [1400, 1236], [2300, 1236], [1500, 480], [2480, 470]] },
        { type: 'radio', count: 2, spots: [[995, 1520], [1105, 1520], [1215, 1520], [2145, 1520], [2600, 470]] },
        { type: 'scrap', count: 5, spots: [[3200, 920], [3360, 1000], [3240, 1240], [3380, 1420], [800, 1770], [3100, 1770], [2035, 1520]] },
        { type: 'cargo', count: 3, spots: [[1300, 420], [2000, 440], [510, 2090], [2230, 2090], [2700, 2090]] },
        { type: 'tarp', count: 3, spots: [[1650, 1318], [1950, 1318], [1200, 460], [2800, 1545]] },
        { type: 'crate', count: 2, spots: [[1100, 420], [2200, 330], [2880, 1260]] },
        { type: 'barrel', count: 2, spots: [[860, 1240], [3400, 1545], [260, 2090], [1650, 1560]] },
        { type: 'pallet', count: 2, spots: [[2300, 330], [1150, 2100], [3200, 2100]] }
      ]
    };
  }

  // ---- inside the station: floor 1 and floor 2 (2400 x 1440, the building's outer walls at 100..2300 / 100..1400).
  // A corridor runs east-west, rooms open off it; the stairs are in the north-east corner on both floors.
  // Furniture is `furn` with a `style` (js/placeart.js), vending machines are `vending` with loot in front of them.
  function stationFloor(level) {
    var W = 2400, H = 1440, S = [], T = 22, K = 0.06;
    function add(o) { S.push(o); return o; }
    function f(style, x, y, w, h, k, o) { var e = { kind: 'furn', style: style, x: x, y: y, w: w, h: h, k: k }; for (var q in o || {}) e[q] = o[q]; return add(e); }
    // a wall from a to b along one axis, with door gaps [[from, to], ...]
    function hwall(y, x0, x1, gaps) { span(x0, x1, gaps, function (a, b) { add({ kind: 'iwall', x: a, y: y, w: b - a, h: T, k: K }); }); }
    function vwall(x, y0, y1, gaps) { span(y0, y1, gaps, function (a, b) { add({ kind: 'iwall', x: x, y: a, w: T, h: b - a, k: K }); }); }
    function span(a, b, gaps, fn) {
      var cur = a;
      (gaps || []).forEach(function (g) { if (g[0] > cur) fn(cur, g[0]); cur = g[1]; });
      if (b > cur) fn(cur, b);
    }
    function vending(x, y, v) { return add({ kind: 'vending', variant: v, x: x, y: y, w: 92, h: 58, k: 0.11 }); }

    // outer walls (the entrance gap on floor 1 only) + the corridor walls
    hwall(100, 100, 2300);
    vwall(100, 100, 1400); vwall(2278, 100, 1400);
    hwall(1378, 100, 2300, level === 1 ? [[1140, 1260]] : null);
    hwall(800, 122, 2278, [[330, 430], [820, 920], [1350, 1460], [1800, 1900], [2080, 2180]]);
    // stairwell in the north-east corner, the same place on both floors
    vwall(2000, 122, 800);
    add({ kind: 'stairs', dir: level === 1 ? 'up' : 'down', x: 2060, y: 160, w: 180, h: 400, k: 0.06 });
    add({ kind: 'furn', style: 'rail', x: 2040, y: 160, w: 14, h: 400, k: 0.05 });
    var loot = [], doors = [];
    function L(type, spots, count) { loot.push({ type: type, count: count || spots.length, spots: spots }); }

    if (level === 1) {
      doors.push({ x: 1200, y: 1388, r: 58, to: 'police', at: { x: 1800, y: 1300 }, face: Math.PI / 2, label: 'יציאה מהתחנה' });
      doors.push({ x: 2150, y: 610, r: 52, to: 'police_f2', at: { x: 2150, y: 680 }, face: Math.PI / 2, label: 'עלייה לקומה 2' });
      // north: two offices, the briefing room, the locker room
      vwall(640, 122, 800); vwall(1100, 122, 800); vwall(1700, 122, 800);
      f('desk', 200, 260, 160, 80, 0.042); f('desk', 420, 420, 160, 80, 0.042); f('cabinet', 124, 600, 60, 150, 0.075); f('chair', 260, 360, 40, 40, 0.025);
      f('desk', 760, 220, 200, 90, 0.042); f('cabinet', 1040, 140, 50, 220, 0.075); f('sofa', 700, 600, 180, 70, 0.035);
      for (var r = 0; r < 3; r++) for (var c = 0; c < 6; c++) f('chair', 1160 + c * 80, 360 + r * 110, 44, 44, 0.025);
      f('podium', 1350, 190, 110, 60, 0.05); f('board', 1180, 124, 440, 18, 0.075);
      f('locker', 1722, 124, 256, 46, 0.1); f('locker', 1722, 620, 46, 160, 0.1); f('bench', 1800, 380, 160, 40, 0.025);
      // south: break room, lobby with the front desk, the cell block
      hwall(920, 122, 2278, [[380, 480], [1000, 1500], [1700, 1800]]);
      vwall(760, 942, 1378); vwall(1620, 942, 1378);
      vending(160, 950, 'drink'); vending(262, 950, 'snack'); f('fridge', 650, 950, 80, 64, 0.1);
      f('table', 380, 1150, 220, 110, 0.035); f('chair', 330, 1180, 40, 40, 0.025); f('chair', 620, 1180, 40, 40, 0.025);
      vending(790, 950, 'snack'); vending(892, 950, 'drink');
      f('counter', 1000, 1080, 420, 46, 0.05); f('counter', 1380, 1080, 40, 160, 0.05);
      f('bench', 800, 1270, 46, 90, 0.025); f('bench', 1560, 1270, 46, 90, 0.025);
      add({ kind: 'bars', x: 1642, y: 1160, w: 130, h: 10, k: 0.07 }); add({ kind: 'bars', x: 1852, y: 1160, w: 210, h: 10, k: 0.07 }); add({ kind: 'bars', x: 2102, y: 1160, w: 176, h: 10, k: 0.07 });
      vwall(1850, 1170, 1378); vwall(2080, 1170, 1378);
      f('bunk', 1680, 1280, 140, 60, 0.03); f('bunk', 1900, 1290, 150, 56, 0.03); f('bunk', 2120, 1290, 140, 56, 0.03);
      L('vend_drink', [[206, 1044], [938, 1044]]); L('vend_snack', [[308, 1044], [836, 1044]]);
      L('medkit', [[1200, 1150], [1840, 660], [470, 560], [1720, 1100]], 2);
      L('radio', [[880, 360], [1405, 290], [320, 420]], 2);
      L('cargo', [[690, 1060], [1500, 1180]], 1);
      L('tarp', [[1760, 300], [1700, 1230]], 1);
    } else {
      doors.push({ x: 2150, y: 610, r: 52, to: 'police_f1', at: { x: 2150, y: 680 }, face: Math.PI / 2, label: 'ירידה לקומה 1' });
      // north: armory, records, the chief's office
      vwall(640, 122, 800); vwall(1300, 122, 800);
      f('rack', 124, 200, 40, 460, 0.085); f('rack', 300, 124, 300, 36, 0.085); f('table', 300, 460, 200, 90, 0.035);
      for (var s = 0; s < 4; s++) f('shelf', 700 + s * 150, 180, 60, 520, 0.09);
      f('desk', 1550, 300, 260, 110, 0.045); f('chair', 1660, 230, 50, 50, 0.03); f('sofa', 1340, 600, 70, 170, 0.035); f('safe', 1900, 160, 70, 60, 0.055); f('cabinet', 1320, 140, 160, 50, 0.075);
      // south: dorm, kitchenette, comms room
      hwall(920, 122, 2278, [[420, 520], [1100, 1300], [1800, 1900]]);
      vwall(900, 942, 1378); vwall(1500, 942, 1378);
      for (var b = 0; b < 3; b++) { f('bunk', 160 + b * 240, 1040, 170, 70, 0.08); f('bunk', 160 + b * 240, 1250, 170, 70, 0.08); }
      vending(930, 950, 'drink'); vending(1032, 950, 'snack'); f('fridge', 1390, 950, 80, 64, 0.1); f('table', 1060, 1180, 260, 120, 0.035);
      f('desk', 1560, 1000, 300, 90, 0.045); f('desk', 1900, 1000, 300, 90, 0.045); f('cabinet', 2180, 1150, 80, 200, 0.075); f('chair', 1680, 1100, 44, 44, 0.025);
      L('vend_drink', [[976, 1044]]); L('vend_snack', [[1078, 1044]]);
      L('crate', [[380, 300], [200, 720], [540, 680]], 2);
      L('tarp', [[400, 600], [560, 300]], 1);
      L('scrap', [[230, 400], [500, 200]], 1);
      L('medkit', [[1940, 260], [1480, 420], [600, 1160]], 2);
      L('radio', [[1700, 1150], [2050, 1150], [1450, 1060]], 2);
      L('cargo', [[350, 1170], [1250, 1060], [860, 1180]], 2);
    }

    return {
      id: 'police_f' + level, name: 'תחנת המשטרה · קומה ' + level, parent: 'police', interior: true,
      seed: 7744 + level * 101, width: W, height: H, margin: 120,
      exit: null, doors: doors,
      spawn: level === 1 ? { x: 1200, y: 1300 } : { x: 2150, y: 680 },
      clearing: 0, reach: 26,
      paths: [], roads: [], ponds: [], water: [], decks: [], structures: S,
      footprint: { x: 100, y: 100, w: 2200, h: 1300 },
      floors: level === 1
        ? [{ x: 122, y: 122, w: 518, h: 678, tone: '58,52,44' }, { x: 662, y: 122, w: 438, h: 678, tone: '58,52,44' }, { x: 1642, y: 942, w: 636, h: 436, tone: '40,42,40' }]
        : [{ x: 1322, y: 122, w: 678, h: 678, tone: '70,44,40' }, { x: 122, y: 942, w: 778, h: 436, tone: '52,56,48' }],
      lights: [[400, 140, 260], [1000, 140, 260], [1600, 140, 260], [400, 1360, 220], [1600, 1360, 220], [1200, 860, 300], [2270, 860, 200]],
      border: null,
      theme: { ground: 'tiles', trail: false, tones: [['0,0,0', 0.25], ['70,64,52', 0.08]], decor: [['papers', 45], ['pebbles', 50]] },
      spawns: [],
      loot: loot
    };
  }

  // ---- the other hand-built places. site() fills in the usual parts of an area; the rest is per place. ----
  function site(id, name, W, H, o) {
    var d = {
      id: id, name: name, seed: 0, width: W, height: H, margin: 150,
      exit: { x: W / 2, y: H - 160, r: 78 }, spawn: { x: W / 2, y: H - 270 },
      clearing: 210, reach: 26, paths: [[[W / 2, H], [W / 2, H - 420]]],
      roads: [], lots: [], pads: [], crops: [], ponds: [], water: [], decks: [], structures: [],
      border: null, spawns: [], loot: []
    };
    for (var k in o) d[k] = o[k];
    return d;
  }
  function maker(S) {
    var api = {
      add: function (o) { S.push(o); return o; },
      car: function (x, y, o) {
        o = o || {};
        var v = o.horiz ? { w: 140, h: 70 } : { w: 70, h: 140 };
        return api.add({ kind: 'car', x: x, y: y, w: o.w || v.w, h: o.h || v.h, k: o.k || (o.bus ? 0.075 : 0.045), police: !!o.police, burnt: !!o.burnt,
          bus: !!o.bus, open: !!o.open, style: o.style || null, aim: o.aim, cargo: o.cargo, tank: o.tank, color: o.color || '#5b5348' });
      },
      tower: function (x, y, k) {
        return api.add({ kind: 'tower', x: x, y: y, w: 100, h: 100, k: k || 0.27, solid: false,
          legs: [{ x: x, y: y, w: 16, h: 16 }, { x: x + 84, y: y, w: 16, h: 16 }, { x: x, y: y + 84, w: 16, h: 16 }, { x: x + 84, y: y + 84, w: 16, h: 16 }] });
      },
      fenceRect: function (x, y, w, h, gap, k) {     // gap: [from, to] along the south side
        k = k || 0.06;
        api.add({ kind: 'fence', x: x, y: y, w: w, h: 12, k: k });
        api.add({ kind: 'fence', x: x, y: y, w: 12, h: h, k: k });
        api.add({ kind: 'fence', x: x + w - 12, y: y, w: 12, h: h, k: k });
        if (gap) { api.add({ kind: 'fence', x: x, y: y + h - 12, w: gap[0] - x, h: 12, k: k }); api.add({ kind: 'fence', x: gap[1], y: y + h - 12, w: x + w - gap[1], h: 12, k: k }); }
        else api.add({ kind: 'fence', x: x, y: y + h - 12, w: w, h: 12, k: k });
      },
      vending: function (x, y, v) { return api.add({ kind: 'vending', variant: v, x: x, y: y, w: 92, h: 58, k: 0.11 }); }
    };
    return api;
  }

  // The old hospital: a three-storey main block with two wings, an ambulance bay, triage tents on the lawn, a helipad.
  function hospital() {
    var S = [], m = maker(S), i;
    m.add({ kind: 'block', x: 900, y: 500, w: 1600, h: 600, k: 0.2, floors: 3, color: '#6a6c66', entrance: 0.5, sign: 'בית חולים' });
    m.add({ kind: 'block', x: 400, y: 700, w: 500, h: 450, k: 0.15, floors: 2, color: '#62655f', interior: 'ward' });
    m.add({ kind: 'block', x: 2500, y: 700, w: 500, h: 450, k: 0.15, floors: 2, color: '#62655f', interior: 'ward' });
    m.vending(1350, 1105, 'snack'); m.vending(1452, 1105, 'drink');
    m.car(1100, 1180, { style: 'ambulance', horiz: true, w: 150, h: 72, k: 0.065, color: '#9a9a90' });
    m.car(2100, 1190, { style: 'ambulance', horiz: true, w: 150, h: 72, k: 0.065, color: '#9a9a90' });
    m.car(2700, 1220, { horiz: true, burnt: true, w: 150, h: 72 });
    [[900, 1450], [1250, 1480], [2050, 1460], [2400, 1500]].forEach(function (t) { m.add({ kind: 'tent', x: t[0], y: t[1], w: 240, h: 150, k: 0.07, color: '#7c7c6c', cross: true, open: true }); });
    m.add({ kind: 'sandbags', x: 1450, y: 1400, w: 140, h: 28, k: 0.03 }); m.add({ kind: 'sandbags', x: 1810, y: 1400, w: 140, h: 28, k: 0.03 });
    m.add({ kind: 'barrier', x: 1520, y: 1960, w: 190, h: 30, k: 0.028 });
    [[300, 1520], [420, 1520], [660, 1520], [540, 1760]].forEach(function (c, n) { m.car(c[0], c[1], { color: ['#4a5a52', '#5e4a3c', '#46505a', '#6a5a44'][n], burnt: n === 2 }); });
    m.add({ kind: 'fence', x: 150, y: 2200, w: 1450, h: 12, k: 0.06 }); m.add({ kind: 'fence', x: 1800, y: 2200, w: 1450, h: 12, k: 0.06 });
    for (i = 0; i < 6; i++) m.add({ kind: 'lamp', x: 600 + i * 420, y: 1330, w: 10, h: 10, k: 0.2 });
    return site('hospital', 'בית החולים הישן', 3400, 2600, {
      seed: 8855, structures: S,
      doors: [{ x: 1700, y: 1136, r: 52, to: 'hospital_f1', at: { x: 1300, y: 1300 }, face: -Math.PI / 2, label: 'כניסה לבית החולים' }],
      roads: [{ x: 1620, y: 1300, w: 160, h: 1300 }, { x: 400, y: 1150, w: 2600, h: 150 }],
      lots: [{ x: 250, y: 1450, w: 560, h: 600 }], pads: [{ x: 2900, y: 1900, r: 150 }],
      paths: [[[1700, 2600], [1700, 1150]], [[400, 1225], [3000, 1225]]],
      theme: { ground: 'concrete', trail: false, tones: [['58,84,66', 0.12], ['0,0,0', 0.2], ['44,66,56', 0.12]], decor: [['grass', 700], ['pebbles', 200], ['leaves', 200], ['flowers', 60], ['bush', 20]] },
      spawns: [
        { type: 'oak', count: 14, gap: 140, grove: true, terrain: true }, { type: 'dead_tree', count: 10, gap: 115, terrain: true },
        { type: 'stones', count: 10 }, { type: 'branches', count: 10, nearTree: true }, { type: 'mushrooms', count: 18, nearTree: true }
      ],
      loot: [
        { type: 'medkit', count: 5, spots: [[1020, 1630], [1370, 1660], [2170, 1640], [2520, 1680], [1830, 1170], [1075, 1215], [2075, 1225]] },
        { type: 'vend_snack', count: 1, spots: [[1396, 1195]] }, { type: 'vend_drink', count: 1, spots: [[1498, 1195]] },
        { type: 'cargo', count: 2, spots: [[330, 1720], [720, 1720], [1190, 1560], [2340, 1560]] },
        { type: 'tarp', count: 3, spots: [[960, 1630], [1310, 1660], [2110, 1640], [2460, 1680]] },
        { type: 'radio', count: 1, spots: [[1275, 1215], [2275, 1225]] },
        { type: 'scrap', count: 3, spots: [[2680, 1255], [2875, 1260], [600, 1960], [3000, 1500]] },
        { type: 'barrel', count: 2, spots: [[300, 1300], [3100, 1300], [1600, 2100]] }
      ]
    });
  }

  // The military base: a fenced compound with watchtowers, barracks, HQ, a vehicle park, a hangar, tents, fuel and a helipad.
  function military() {
    var S = [], m = maker(S), i;
    m.add({ kind: 'fence', x: 300, y: 300, w: 3400, h: 12, k: 0.07 });
    m.add({ kind: 'fence', x: 300, y: 300, w: 12, h: 2200, k: 0.07 });
    m.add({ kind: 'fence', x: 3688, y: 300, w: 12, h: 2200, k: 0.07 });
    m.add({ kind: 'fence', x: 300, y: 2488, w: 1580, h: 12, k: 0.07 }); m.add({ kind: 'fence', x: 2120, y: 2488, w: 1580, h: 12, k: 0.07 });
    m.add({ kind: 'gatepost', x: 1860, y: 2480, w: 22, h: 26, k: 0.08 }); m.add({ kind: 'gatepost', x: 2120, y: 2480, w: 22, h: 26, k: 0.08 });
    m.add({ kind: 'office', x: 2200, y: 2330, w: 140, h: 100, k: 0.09, doorSide: 'north' });
    m.add({ kind: 'sandbags', x: 1700, y: 2380, w: 150, h: 30, k: 0.032 }); m.add({ kind: 'sandbags', x: 2150, y: 2250, w: 30, h: 150, k: 0.032 });
    [[360, 360], [3540, 360], [360, 2340], [3540, 2340]].forEach(function (t) { m.tower(t[0], t[1], 0.27); });
    for (i = 0; i < 3; i++) m.add({ kind: 'block', x: 700, y: 540 + i * 290, w: 700, h: 160, k: 0.09, floors: 1, color: '#59604c', interior: 'barracks' });
    m.add({ kind: 'block', x: 1800, y: 500, w: 700, h: 360, k: 0.13, floors: 2, color: '#5d6152', entrance: 0.5, sign: 'מפקדה', antenna: true });
    m.add({ kind: 'sandbags', x: 1900, y: 900, w: 160, h: 30, k: 0.032 }); m.add({ kind: 'sandbags', x: 2240, y: 900, w: 160, h: 30, k: 0.032 });
    for (i = 0; i < 3; i++) m.car(2700 + i * 200, 700, { style: 'apc', w: 100, h: 180, k: 0.06, color: '#4f5640', aim: -Math.PI / 2 + (i - 1) * 0.5, burnt: i === 2 });
    m.car(2700, 1100, { style: 'truck', horiz: true, w: 230, h: 84, k: 0.07, color: '#4a5240', cargo: '#5a5e48' });
    m.car(3050, 1100, { style: 'tanker', horiz: true, w: 230, h: 84, k: 0.07, color: '#4a5240', tank: '#5e6450' });
    m.add({ kind: 'warehouse', x: 2700, y: 1500, w: 800, h: 450, k: 0.15, door: 0.5, color: '#4f5448' });
    for (i = 0; i < 6; i++) m.add({ kind: 'tent', x: 650 + (i % 3) * 300, y: 1750 + Math.floor(i / 3) * 260, w: 220, h: 150, k: 0.065, color: '#5f6448', open: i % 2 === 0 });
    m.add({ kind: 'tankc', x: 3300, y: 2050, w: 180, h: 180, k: 0.15, color: '#5a6050' }); m.add({ kind: 'tankc', x: 3520, y: 2100, w: 130, h: 130, k: 0.12, color: '#5a6050' });
    m.add({ kind: 'container', x: 1500, y: 1960, w: 220, h: 76, k: 0.068, level: 1, color: '#55623f', open: true });
    for (i = 0; i < 5; i++) m.add({ kind: 'lamp', x: 1890 + (i % 2) * 220, y: 1000 + Math.floor(i / 2) * 500, w: 10, h: 10, k: 0.2 });
    return site('military', 'הבסיס הצבאי', 4000, 3000, {
      seed: 11077, structures: S,
      roads: [{ x: 1920, y: 860, w: 160, h: 2140 }, { x: 400, y: 1300, w: 3200, h: 120 }],
      lots: [{ x: 2600, y: 600, w: 900, h: 640 }], pads: [{ x: 1500, y: 1520, r: 160 }],
      paths: [[[2000, 3000], [2000, 860]], [[400, 1360], [3600, 1360]]],
      theme: { ground: 'concrete', trail: false, tones: [['58,68,48', 0.14], ['0,0,0', 0.22], ['46,54,40', 0.12]], decor: [['grass', 600], ['pebbles', 260], ['leaves', 80], ['bush', 12]] },
      spawns: [
        { type: 'pine', count: 22, gap: 122, grove: true, terrain: true }, { type: 'dead_tree', count: 8, gap: 112, terrain: true },
        { type: 'boulder', count: 6, gap: 0, terrain: true }, { type: 'stones', count: 16 }, { type: 'branches', count: 10, nearTree: true }
      ],
      loot: [
        { type: 'crate', count: 6, spots: [[1450, 690], [1450, 990], [1450, 1260], [2650, 1290], [3550, 1240], [2600, 1600], [2600, 1900], [1800, 2080], [1250, 2240]] },
        { type: 'cargo', count: 4, spots: [[760, 1930], [1060, 1930], [1360, 1930], [760, 2190], [1060, 2190], [1610, 2076]] },
        { type: 'medkit', count: 3, spots: [[2150, 900], [2050, 1460], [1660, 1500], [2240, 2460], [1360, 2190]] },
        { type: 'radio', count: 3, spots: [[2400, 880], [1780, 880], [2270, 2460], [3600, 470], [470, 470]] },
        { type: 'scrap', count: 5, spots: [[2760, 920], [2960, 920], [3160, 920], [2800, 1220], [3150, 1220], [3580, 1600]] },
        { type: 'tarp', count: 4, spots: [[680, 1930], [980, 1930], [1280, 1930], [680, 2190], [980, 2190]] },
        { type: 'barrel', count: 2, spots: [[3260, 2300], [3600, 2290], [3200, 1980]] }
      ]
    });
  }

  // The airport: a runway across the north, an airliner on the apron, a terminal, hangars, the control tower.
  function airport() {
    var S = [], m = maker(S), i;
    m.add({ kind: 'plane', x: 1700, y: 880, w: 900, h: 520, k: 0.09, fw: 64, legs: [{ x: 1700, y: 1108, w: 900, h: 64 }], solid: false });
    m.add({ kind: 'plane', x: 3000, y: 2050, w: 380, h: 300, k: 0.045, fw: 34, broken: true, burnt: true, color: '#7a7a72', legs: [{ x: 3000, y: 2183, w: 380, h: 34 }], solid: false });
    m.add({ kind: 'block', x: 1300, y: 1500, w: 1800, h: 480, k: 0.16, floors: 2, color: '#62666a', entrance: 0.5, sign: 'טרמינל', interior: 'terminal' });
    m.vending(1900, 1985, 'snack'); m.vending(2002, 1985, 'drink');
    m.tower(3500, 1250, 0.42);
    m.add({ kind: 'warehouse', x: 300, y: 950, w: 700, h: 450, k: 0.18, door: 0.5, color: '#4e5350', interior: 'hangar' });
    m.add({ kind: 'warehouse', x: 3600, y: 850, w: 600, h: 380, k: 0.16, door: 0.4, color: '#545750', broken: true, interior: 'hangar' });
    m.car(1250, 1000, { style: 'tanker', horiz: true, w: 220, h: 80, k: 0.065, color: '#6a6a4a', tank: '#8a8a80' });
    for (i = 0; i < 4; i++) m.car(2750 + (i % 2) * 120, 950 + Math.floor(i / 2) * 140, { style: 'truck', horiz: true, w: 100, h: 50, k: 0.035, color: '#4a4c48', cargo: ['#5a4a3a', '#4a5560'][i % 2] });
    for (i = 0; i < 8; i++) m.car(1400 + i * 200, 2180 + (i % 3 === 1 ? 160 : 0), { color: ['#4a5a52', '#5e4a3c', '#46505a', '#6a5a44'][i % 4], burnt: i === 5, open: i === 2 });
    m.add({ kind: 'barrier', x: 1300, y: 2080, w: 190, h: 30, k: 0.028 }); m.add({ kind: 'barrier', x: 2950, y: 2090, w: 190, h: 30, k: 0.028 });
    for (i = 0; i < 6; i++) m.add({ kind: 'lamp', x: 1300 + i * 360, y: 1440, w: 10, h: 10, k: 0.22 });
    return site('airport', 'שדה התעופה', 4400, 3000, {
      seed: 12188, structures: S,
      roads: [{ x: 200, y: 400, w: 4000, h: 260, style: 'runway' }, { x: 600, y: 680, w: 3200, h: 90 }, { x: 2120, y: 2080, w: 160, h: 920 }, { x: 1300, y: 2000, w: 1800, h: 80 }],
      lots: [{ x: 1100, y: 780, w: 2300, h: 660 }, { x: 1300, y: 2120, w: 1800, h: 420 }],
      paths: [[[2200, 3000], [2200, 2000]], [[300, 530], [4100, 530]]],
      theme: { ground: 'concrete', trail: false, tones: [['96,98,86', 0.12], ['0,0,0', 0.2], ['70,74,66', 0.1]], decor: [['grass', 800], ['pebbles', 260], ['leaves', 60]] },
      spawns: [
        { type: 'pine', count: 8, gap: 130, terrain: true }, { type: 'dead_tree', count: 12, gap: 112, terrain: true },
        { type: 'boulder', count: 4, gap: 0, terrain: true }, { type: 'stones', count: 20 }, { type: 'branches', count: 8, nearTree: true }
      ],
      loot: [
        { type: 'tarp', count: 5, spots: [[2720, 1060], [2840, 1060], [2720, 1200], [2840, 1200], [2000, 1440], [2300, 1440], [1650, 1250]] },
        { type: 'cargo', count: 4, spots: [[3015, 1000], [3015, 1140], [1800, 1440], [2500, 1440], [1500, 2470]] },
        { type: 'crate', count: 3, spots: [[400, 1450], [800, 1450], [3700, 1280], [3950, 1280]] },
        { type: 'scrap', count: 5, spots: [[2900, 2200], [3420, 2120], [3200, 2400], [2620, 1250], [1490, 1050], [3500, 1450]] },
        { type: 'radio', count: 2, spots: [[3480, 1400], [3640, 1400], [1350, 1990]] },
        { type: 'medkit', count: 2, spots: [[2200, 1990], [2700, 1990], [1600, 1990]] },
        { type: 'vend_snack', count: 1, spots: [[1946, 2075]] }, { type: 'vend_drink', count: 1, spots: [[2048, 2075]] },
        { type: 'barrel', count: 2, spots: [[260, 1500], [4100, 1300], [3200, 1800]] }
      ]
    });
  }

  // The abandoned neighborhood: two streets of houses with tiled roofs, low yard fences, cars left in the road.
  function neighborhood() {
    var S = [], m = maker(S), rand = G.util.rng(4410), i, loot = { cargo: [], tarp: [], radio: [], scrap: [], barrel: [] };
    var WALLS = ['#6a6256', '#5e625a', '#6e6658', '#5a5650', '#665a50'], ROOFS = ['#6a3e30', '#5a4a40', '#4e5048', '#6e4a36'];
    [[420, 0], [1120, 0], [1900, 1]].forEach(function (row) {               // three rows of houses, the avenue gap in the middle
      var y = row[0];
      for (var x = 220; x < 3400; x += 360) {
        if (x > 1520 && x < 1900) continue;
        if (rand() < 0.1) continue;                                          // an empty lot
        var w = 240 + Math.floor(rand() * 60), h = 190 + Math.floor(rand() * 40), hx = x + Math.floor(rand() * 40);
        m.add({ kind: 'house', x: hx, y: y, w: w, h: h, k: 0.095 + rand() * 0.02, color: WALLS[Math.floor(rand() * WALLS.length)], roof: ROOFS[Math.floor(rand() * ROOFS.length)], broken: rand() < 0.25, chimney: rand() < 0.5 });
        if (rand() < 0.5) { m.add({ kind: 'fence', x: hx - 30, y: y + h + 70, w: w + 60, h: 10, k: 0.03 }); }
        loot.cargo.push([hx + w / 2, y + h + 34]);
        loot.tarp.push([hx - 40, y + h / 2]);
        loot.barrel.push([hx + w + 40, y + 30]);
        if (rand() < 0.5) loot.radio.push([hx + w + 40, y + h - 20]);
      }
    });
    [[600, 960], [1300, 990, true], [2300, 960], [3000, 1720, true], [700, 1740], [2500, 1760]].forEach(function (c, n) {
      var cr = m.car(c[0], c[1], { horiz: true, color: WALLS[n % WALLS.length], burnt: !!c[2], open: n === 3 });
      loot.scrap.push([cr.x + cr.w + 30, cr.y + cr.h / 2]);
    });
    m.car(1750, 1400, { color: '#4a5a52' }); loot.scrap.push([1840, 1470]);
    for (i = 0; i < 7; i++) m.add({ kind: 'lamp', x: 300 + i * 480, y: 870, w: 10, h: 10, k: 0.2 });
    return site('neighborhood', 'השכונה הנטושה', 3600, 2600, {
      seed: 4410, structures: S,
      roads: [{ x: 150, y: 900, w: 3300, h: 130 }, { x: 150, y: 1690, w: 3300, h: 130 }, { x: 1720, y: 300, w: 160, h: 2300 }],
      paths: [[[1800, 2600], [1800, 300]], [[150, 965], [3450, 965]], [[150, 1755], [3450, 1755]]],
      theme: { ground: 'concrete', trail: false, tones: [['70,76,74', 0.12], ['0,0,0', 0.2], ['44,60,40', 0.14]], decor: [['grass', 1100], ['leaves', 300], ['pebbles', 200], ['flowers', 60], ['bush', 30]] },
      spawns: [
        { type: 'oak', count: 18, gap: 140, terrain: true }, { type: 'dead_tree', count: 16, gap: 118, terrain: true }, { type: 'pine', count: 6, gap: 130, terrain: true },
        { type: 'stones', count: 16 }, { type: 'branches', count: 14, nearTree: true }, { type: 'mushrooms', count: 10, nearTree: true }
      ],
      loot: [
        { type: 'cargo', count: 6, spots: loot.cargo }, { type: 'tarp', count: 4, spots: loot.tarp }, { type: 'radio', count: 3, spots: loot.radio },
        { type: 'scrap', count: 5, spots: loot.scrap }, { type: 'barrel', count: 4, spots: loot.barrel },
        { type: 'medkit', count: 2, spots: loot.cargo.slice(1).map(function (p) { return [p[0] + 60, p[1]]; }) }
      ]
    });
  }

  // The abandoned farm: farmhouse, a red barn with a broken roof, two silos, a tractor, ploughed fields gone wild.
  function farm() {
    var S = [], m = maker(S);
    m.add({ kind: 'house', x: 520, y: 560, w: 380, h: 260, k: 0.11, color: '#6e6658', roof: '#5a3a2c', chimney: true });
    m.add({ kind: 'house', x: 1250, y: 480, w: 620, h: 400, k: 0.16, color: '#6a3a2e', roof: '#4a4a44', broken: true, interior: 'barn' });
    m.add({ kind: 'tankc', x: 2000, y: 500, w: 170, h: 170, k: 0.3, color: '#7a7a70' }); m.add({ kind: 'tankc', x: 2220, y: 540, w: 130, h: 130, k: 0.25, color: '#6e706a' });
    m.car(1080, 1000, { style: 'tractor', horiz: true, w: 150, h: 84, k: 0.06, color: '#6a3a2a' });
    m.car(2300, 900, { style: 'truck', horiz: true, w: 220, h: 80, k: 0.06, color: '#5a6050', cargo: '#6a5a3e', burnt: false });
    [[1400, 1000, 110], [1560, 1040, 90], [2500, 1300, 120], [900, 1250, 100], [2700, 1500, 90]].forEach(function (h) { m.add({ kind: 'pile', x: h[0], y: h[1], w: h[2], h: h[2], k: 0.05, color: '#8a7a4a' }); });
    m.add({ kind: 'fence', x: 400, y: 440, w: 2100, h: 10, k: 0.035 }); m.add({ kind: 'fence', x: 400, y: 440, w: 10, h: 700, k: 0.035 });
    m.add({ kind: 'fence', x: 400, y: 1140, w: 1050, h: 10, k: 0.035 }); m.add({ kind: 'fence', x: 1750, y: 1140, w: 750, h: 10, k: 0.035 });
    return site('farm', 'החווה הנטושה', 3200, 2400, {
      seed: 3301, structures: S,
      roads: [{ x: 1540, y: 880, w: 120, h: 1520, style: 'dirt' }, { x: 420, y: 880, w: 2060, h: 110, style: 'dirt' }],
      crops: [{ x: 1750, y: 1250, w: 1250, h: 700, tone: '72,58,36', plant: '78,92,46' }, { x: 300, y: 1300, w: 1100, h: 640, vert: true, tone: '66,56,36', plant: '96,92,52' }],
      paths: [[[1600, 2400], [1600, 880]], [[420, 935], [2480, 935]]],
      ponds: [{ x: 2800, y: 650, r: 120 }],
      theme: { tones: [['86,76,44', 0.14], ['70,80,44', 0.12], ['0,0,0', 0.2], ['130,110,64', 0.07]] },
      border: { step: 82, depth: 80, gap: 150 },
      spawns: [
        { type: 'oak', count: 22, gap: 150, grove: true, terrain: true }, { type: 'pine', count: 8, gap: 130, grove: true, terrain: true },
        { type: 'dead_tree', count: 6, gap: 112, terrain: true }, { type: 'log', count: 6 }, { type: 'stones', count: 16 },
        { type: 'branches', count: 18, nearTree: true }, { type: 'mushrooms', count: 26, nearTree: true }
      ],
      loot: [
        { type: 'cargo', count: 3, spots: [[710, 860], [940, 700], [480, 700], [1560, 920]] },
        { type: 'crate', count: 3, spots: [[1220, 700], [1900, 760], [1300, 940], [2150, 760]] },
        { type: 'pallet', count: 4, spots: [[1960, 880], [1450, 1180], [2550, 1000], [1000, 1180], [2450, 760]] },
        { type: 'tarp', count: 3, spots: [[1270, 1060], [2450, 1030], [1700, 1060], [860, 1050]] },
        { type: 'scrap', count: 3, spots: [[1260, 1000], [2550, 940], [2100, 980], [700, 1100]] },
        { type: 'barrel', count: 3, spots: [[480, 860], [960, 820], [2400, 700], [1950, 1100]] },
        { type: 'radio', count: 2, spots: [[650, 890], [1075, 1120], [2260, 980], [1700, 1100]] }      // old farm radios: electronics for the story's radio repair
      ]
    });
  }

  // The old quarry: stepped pits, an excavator, dump trucks, gravel piles, a site office and a storage container.
  function quarry() {
    var S = [], m = maker(S);
    m.car(1500, 900, { style: 'excavator', w: 150, h: 120, k: 0.07, color: '#7a6a34' });
    m.car(2100, 1500, { style: 'truck', horiz: true, w: 240, h: 90, k: 0.075, color: '#6a6a4a', cargo: '#5a564c' });
    m.car(700, 1600, { style: 'truck', horiz: true, w: 240, h: 90, k: 0.075, color: '#5a5a48', cargo: '#5a564c', burnt: true });
    [[2400, 800, 260, 0.1], [2700, 950, 200, 0.08], [1000, 1100, 220, 0.09], [2600, 1700, 180, 0.07]].forEach(function (p) { m.add({ kind: 'pile', x: p[0], y: p[1], w: p[2], h: p[2], k: p[3], color: '#77705f' }); });
    m.add({ kind: 'office', x: 1900, y: 1900, w: 220, h: 130, k: 0.1 });
    m.add({ kind: 'container', x: 2250, y: 1950, w: 220, h: 76, k: 0.068, level: 1, color: '#6b4a3a', open: true });
    m.add({ kind: 'fence', x: 1200, y: 2200, w: 400, h: 12, k: 0.06 }); m.add({ kind: 'fence', x: 1800, y: 2200, w: 400, h: 12, k: 0.06 });
    return site('quarry', 'המחצבה', 3400, 2600, {
      seed: 5522, structures: S,
      roads: [{ x: 1640, y: 1300, w: 120, h: 1300, style: 'dirt' }, { x: 400, y: 1460, w: 2700, h: 110, style: 'dirt' }],
      terraces: [{ x: 1300, y: 700, rx: 600, ry: 380, n: 4 }],
      paths: [[[1700, 2600], [1700, 1300]], [[400, 1515], [3100, 1515]]],
      ponds: [{ x: 2900, y: 500, r: 110 }],
      theme: { ground: 'gravel', trail: false, tones: [['108,98,82', 0.16], ['0,0,0', 0.22], ['140,128,104', 0.08], ['80,74,64', 0.14]], decor: [['pebbles', 900], ['grass', 220], ['leaves', 40], ['bush', 8]] },
      border: { step: 84, depth: 70, gap: 150, kinds: ['boulder', 'boulder', 'dead_tree'] },
      spawns: [
        { type: 'boulder', count: 34, gap: 0, terrain: true }, { type: 'dead_tree', count: 10, gap: 115, terrain: true },
        { type: 'stones', count: 50 }, { type: 'log', count: 4 }, { type: 'branches', count: 8, nearTree: true }
      ],
      loot: [
        { type: 'scrap', count: 4, spots: [[1680, 960], [2370, 1545], [960, 1700], [2500, 2040], [1460, 1060]] },
        { type: 'crate', count: 2, spots: [[2150, 2080], [1850, 2060], [2520, 1990]] },
        { type: 'barrel', count: 2, spots: [[1860, 1900], [2160, 1900], [1550, 1300]] },
        { type: 'radio', count: 1, spots: [[2010, 2070], [2400, 2070]] },
        { type: 'tarp', count: 2, spots: [[2650, 1060], [1250, 1250], [2500, 1650]] }
      ]
    });
  }

  // The dam lake: the dam wall across the north, a pump station, a boathouse and a fishing cabin, boats left on the shore.
  function lake() {
    var S = [], m = maker(S);
    m.add({ kind: 'wall', x: 400, y: 220, w: 2600, h: 60, k: 0.14 });
    m.add({ kind: 'block', x: 3100, y: 300, w: 360, h: 240, k: 0.12, floors: 1, color: '#5e605a', garage: 1, interior: 'pump' });
    m.add({ kind: 'tankc', x: 3150, y: 620, w: 140, h: 140, k: 0.12 });
    m.add({ kind: 'house', x: 2100, y: 450, w: 320, h: 220, k: 0.1, color: '#5a4e40', roof: '#4a4a44', broken: true, interior: 'boathouse' });
    m.add({ kind: 'house', x: 400, y: 1300, w: 260, h: 190, k: 0.09, color: '#5e5446', roof: '#5a3a2c', chimney: true });
    m.add({ kind: 'boat', x: 1900, y: 750, w: 70, h: 170, k: 0.03 }); m.add({ kind: 'boat', x: 2000, y: 770, w: 66, h: 160, k: 0.03 });
    m.add({ kind: 'boat', x: 900, y: 1500, w: 70, h: 170, k: 0.03 });
    return site('lake', 'אגם הסכר', 3800, 2800, {
      seed: 6633, structures: S,
      ponds: [{ x: 1300, y: 1100, r: 300 }, { x: 2800, y: 1500, r: 190 }, { x: 640, y: 2050, r: 140 }],
      roads: [{ x: 400, y: 300, w: 2600, h: 90, style: 'dirt' }],
      paths: [[[1900, 2800], [1900, 2500], [2260, 1740], [1540, 1010], [1660, 560]]],
      theme: { tones: [['30,60,64', 0.16], ['44,78,52', 0.12], ['0,0,0', 0.2], ['120,150,150', 0.06]] },
      border: { step: 82, depth: 80, gap: 150 },
      spawns: [
        { type: 'oak', count: 40, gap: 132, grove: true, terrain: true }, { type: 'pine', count: 40, gap: 122, grove: true, terrain: true },
        { type: 'dead_tree', count: 8, gap: 112, terrain: true }, { type: 'boulder', count: 6, gap: 0, terrain: true }, { type: 'log', count: 12 },
        { type: 'stones', count: 22 }, { type: 'branches', count: 24, nearTree: true }, { type: 'mushrooms', count: 34, nearTree: true }
      ],
      loot: [
        { type: 'cargo', count: 2, spots: [[530, 1530], [2260, 710], [700, 1400]] },
        { type: 'tarp', count: 3, spots: [[1880, 960], [2100, 960], [880, 1720], [2440, 560]] },
        { type: 'scrap', count: 2, spots: [[3280, 580], [3060, 450], [2000, 410]] },
        { type: 'barrel', count: 2, spots: [[3350, 700], [370, 1280], [2460, 700]] },
        { type: 'crate', count: 1, spots: [[2080, 700], [3320, 560]] },
        { type: 'medkit', count: 1, spots: [[690, 1400], [2200, 700]] }
      ]
    });
  }

  // ---- inside the hospital: three floors (2600 x 1440, outer walls at 100..2500 / 100..1400). A corridor runs
  // east-west; the stairwell is in the north-east corner with a flight up and a flight down side by side.
  function hospitalFloor(level) {
    var W = 2600, H = 1440, S = [], T = 22, K = 0.06, PI = Math.PI;
    function add(o) { S.push(o); return o; }
    function f(style, x, y, w, h, k, o) { var e = { kind: 'furn', style: style, x: x, y: y, w: w, h: h, k: k }; for (var q in o || {}) e[q] = o[q]; return add(e); }
    function hwall(y, x0, x1, gaps) { span(x0, x1, gaps, function (a, b) { add({ kind: 'iwall', x: a, y: y, w: b - a, h: T, k: K }); }); }
    function vwall(x, y0, y1, gaps) { span(y0, y1, gaps, function (a, b) { add({ kind: 'iwall', x: x, y: a, w: T, h: b - a, k: K }); }); }
    function span(a, b, gaps, fn) { var cur = a; (gaps || []).forEach(function (g) { if (g[0] > cur) fn(cur, g[0]); cur = g[1]; }); if (b > cur) fn(cur, b); }
    function vending(x, y, v) { return add({ kind: 'vending', variant: v, x: x, y: y, w: 92, h: 58, k: 0.11 }); }
    function bed(x, y, curtain) {                     // hospital bed with an IV stand, and a curtain on its east side
      f('hbed', x, y, 80, 150, 0.035);
      f('ivpole', x - 26, y + 10, 12, 12, 0.11);
      if (curtain) f('curtain', x + 110, y - 20, 8, 190, 0.1, { solid: false });
    }
    var loot = [], doors = [];
    function L(type, spots, count) { loot.push({ type: type, count: count || spots.length, spots: spots }); }

    hwall(100, 100, 2500); vwall(100, 100, 1400); vwall(2478, 100, 1400);
    hwall(1378, 100, 2500, level === 1 ? [[1240, 1360]] : null);
    vwall(2180, 122, 800);
    if (level < 3) { add({ kind: 'stairs', dir: 'up', x: 2230, y: 160, w: 100, h: 380, k: 0.06 }); doors.push({ x: 2280, y: 585, r: 44, to: 'hospital_f' + (level + 1), at: { x: 2345, y: 690 }, face: PI / 2, label: 'עלייה לקומה ' + (level + 1) }); }
    if (level > 1) { add({ kind: 'stairs', dir: 'down', x: 2360, y: 160, w: 100, h: 380, k: 0.06 }); doors.push({ x: 2410, y: 585, r: 44, to: 'hospital_f' + (level - 1), at: { x: 2345, y: 690 }, face: PI / 2, label: 'ירידה לקומה ' + (level - 1) }); }
    f('rail', 2337, 160, 14, 380, 0.05);
    var north = [[2240, 2460]];                         // the stairwell door in the corridor wall, plus each floor's rooms

    if (level === 1) {
      doors.push({ x: 1300, y: 1388, r: 58, to: 'hospital', at: { x: 1700, y: 1200 }, face: PI / 2, label: 'יציאה מבית החולים' });
      hwall(800, 122, 2478, [[400, 520], [1000, 1100], [1500, 1600], [1940, 2040]].concat(north));
      vwall(800, 122, 800); vwall(1300, 122, 800); vwall(1800, 122, 800);
      // MRI: the scanner, its sliding table, the control desk behind a window
      f('mri', 260, 260, 320, 230, 0.12); f('desk', 600, 160, 170, 70, 0.042); f('cabinet', 124, 600, 60, 170, 0.075);
      // X-ray: the arm over a table, a lead screen
      f('xray', 920, 260, 240, 140, 0.1); f('hbed', 980, 450, 80, 150, 0.035); f('cabinet', 1210, 140, 70, 200, 0.075);
      // pharmacy: shelves of empty boxes and two drug cabinets
      for (var s = 0; s < 3; s++) f('shelf', 1350 + s * 140, 180, 60, 460, 0.09);
      f('medcab', 1720, 140, 60, 220, 0.09); f('counter', 1330, 700, 300, 40, 0.05);
      // staff room: vending machines
      vending(1830, 140, 'snack'); vending(1932, 140, 'drink'); f('sofa', 1830, 560, 180, 70, 0.035); f('table', 2020, 400, 120, 120, 0.035);
      // south: emergency room (beds behind curtains), the lobby with reception and waiting seats, the cafeteria
      hwall(920, 122, 2478, [[450, 560], [1000, 1700], [2000, 2100]]);
      vwall(900, 942, 1378); vwall(1800, 942, 1378);
      bed(160, 1010, true); bed(360, 1010, true); bed(560, 1010, true); bed(760, 1010, false);
      f('medcab', 124, 1260, 60, 100, 0.09);
      f('counter', 1000, 1000, 360, 46, 0.05); f('counter', 1320, 1000, 40, 150, 0.05);
      for (var r = 0; r < 2; r++) for (var c = 0; c < 5; c++) f('chair', 1420 + c * 70, 1120 + r * 120, 44, 44, 0.025);
      f('wheelchair', 960, 1250, 50, 56, 0.04); f('wheelchair', 1720, 1000, 50, 56, 0.04);
      vending(1840, 950, 'snack'); vending(1942, 950, 'drink');
      for (c = 0; c < 3; c++) { f('table', 1900 + c * 190, 1150, 130, 90, 0.035); f('chair', 1920 + c * 190, 1250, 40, 40, 0.025); }
      L('medkit', [[250, 1220], [450, 1220], [650, 1220], [1480, 770], [1650, 700], [1750, 420], [210, 690]], 4);
      L('vend_snack', [[1876, 234], [1886, 1044]]); L('vend_drink', [[1978, 234], [1988, 1044]]);
      L('radio', [[685, 270], [640, 600], [1250, 420]], 2);
      L('tarp', [[340, 1220], [540, 1220], [840, 1300]], 2);
      L('cargo', [[2100, 1310], [2300, 1050], [1100, 1100]], 2);
    } else if (level === 2) {
      // the ward: four patient rooms off the north side of the corridor, two beds in each
      hwall(800, 122, 2478, [[330, 430], [850, 950], [1370, 1470], [1880, 1980]].concat(north));
      vwall(640, 122, 800); vwall(1160, 122, 800); vwall(1680, 122, 800);
      [122, 640, 1160, 1680].forEach(function (x0) { bed(x0 + 60, 180, true); bed(x0 + 300, 180, false); f('cabinet', x0 + 200, 560, 60, 60, 0.05); });
      // south: two doctors' offices, the nurses' station, a fifth room with three beds
      hwall(920, 122, 2478, [[380, 480], [950, 1050], [1300, 1880], [2100, 2200]]);
      vwall(700, 942, 1378); vwall(1280, 942, 1378); vwall(1900, 942, 1378);
      f('desk', 200, 1060, 220, 90, 0.045); f('chair', 280, 1170, 44, 44, 0.025); f('cabinet', 124, 1240, 60, 120, 0.075); f('sofa', 480, 1260, 180, 70, 0.035); f('board', 300, 942, 300, 18, 0.07);
      f('desk', 780, 1060, 220, 90, 0.045); f('chair', 860, 1170, 44, 44, 0.025); f('shelf', 1180, 980, 60, 300, 0.09); f('hbed', 1060, 1220, 150, 70, 0.035);
      f('counter', 1400, 1060, 380, 46, 0.05); f('counter', 1400, 1060, 46, 200, 0.05); f('medcab', 1750, 1260, 120, 60, 0.09); f('wheelchair', 1600, 1300, 50, 56, 0.04);
      bed(1960, 1000, true); bed(2160, 1000, true); bed(2360, 1000, false);
      L('medkit', [[260, 680], [780, 680], [1300, 680], [1820, 680], [1600, 1150], [1810, 1220], [2150, 1220]], 4);
      L('radio', [[360, 1190], [940, 1190], [1700, 1150]], 2);
      L('cargo', [[560, 680], [1080, 680], [2400, 1260]], 2);
      L('tarp', [[420, 680], [1460, 680], [2050, 1220]], 2);
    } else {
      // north: two operating rooms, intensive care
      hwall(800, 122, 2478, [[400, 520], [1080, 1200], [1780, 1900]].concat(north));
      vwall(800, 122, 800); vwall(1480, 122, 800);
      [122, 800].forEach(function (x0) { f('optable', x0 + 240, 300, 200, 80, 0.045); f('medcab', x0 + 30, 140, 60, 200, 0.09); f('monitor', x0 + 500, 300, 50, 40, 0.07); });
      bed(1560, 180, true); bed(1780, 180, true); bed(1990, 180, false);
      for (var m = 0; m < 3; m++) f('monitor', 1620 + m * 220, 400, 50, 40, 0.07);
      // south: the lab, the supply store, a staff room
      hwall(920, 122, 2478, [[400, 500], [1150, 1350], [1900, 2000]]);
      vwall(900, 942, 1378); vwall(1600, 942, 1378);
      f('table', 200, 1000, 500, 90, 0.04); f('table', 200, 1220, 500, 90, 0.04); f('fridge', 780, 960, 90, 64, 0.1); f('shelf', 124, 1100, 50, 100, 0.09);
      for (s = 0; s < 3; s++) f('shelf', 980 + s * 200, 980, 70, 330, 0.09);
      vending(1640, 950, 'drink'); vending(1742, 950, 'snack'); f('sofa', 2200, 1100, 70, 200, 0.035); f('table', 1900, 1150, 160, 100, 0.035);
      L('medkit', [[340, 450], [1020, 450], [180, 380], [860, 380], [1700, 560], [2120, 560]], 4);
      L('crate', [[1100, 1340], [1300, 1340], [1500, 1340], [1150, 960]], 3);
      L('scrap', [[600, 300], [1280, 300], [1700, 460]], 2);
      L('radio', [[450, 1150], [650, 1150]], 1);
      L('vend_drink', [[1686, 1044]]); L('vend_snack', [[1788, 1044]]);
      L('cargo', [[1950, 1300], [2300, 1000]], 1);
    }

    return {
      id: 'hospital_f' + level, name: 'בית החולים · קומה ' + level, parent: 'hospital', interior: true,
      seed: 8855 + level * 101, width: W, height: H, margin: 120,
      exit: null, doors: doors,
      spawn: level === 1 ? { x: 1300, y: 1300 } : { x: 2345, y: 690 },
      clearing: 0, reach: 26,
      paths: [], roads: [], ponds: [], water: [], decks: [], structures: S,
      footprint: { x: 100, y: 100, w: 2400, h: 1300 },
      floors: level === 1
        ? [{ x: 122, y: 122, w: 678, h: 678, tone: '50,58,62' }, { x: 122, y: 942, w: 778, h: 436, tone: '54,62,58' }]
        : level === 2 ? [{ x: 122, y: 942, w: 1158, h: 436, tone: '58,52,44' }] : [{ x: 122, y: 122, w: 1358, h: 678, tone: '52,64,62' }],
      lights: [[400, 140, 260], [1100, 140, 260], [1800, 140, 260], [400, 1360, 220], [1300, 1360, 220], [2100, 1360, 220], [1300, 860, 320]],
      border: null,
      theme: { ground: 'tiles', trail: false, tones: [['0,0,0', 0.22], ['80,90,86', 0.08]], decor: [['papers', 40], ['pebbles', 40]] },
      spawns: [],
      loot: loot
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

    farm: farm(),

    neighborhood: neighborhood(),

    quarry: quarry(),

    lake: lake(),

    police: police(),
    police_f1: stationFloor(1),
    police_f2: stationFloor(2),

    hospital: hospital(),
    hospital_f1: hospitalFloor(1),
    hospital_f2: hospitalFloor(2),
    hospital_f3: hospitalFloor(3),

    port: port(),

    military: military(),

    airport: airport(),
  };
})(typeof window !== 'undefined' ? window : globalThis);
