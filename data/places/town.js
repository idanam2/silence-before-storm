// Extra details for hand-built places (town). Mutates G.data.areas before data/interiors.js links the doors.
// police (outside only): a checkpoint tent at the west end of the street, a bus stop, a phone booth, a newspaper
// stand, bins, litter and spent casings. neighborhood: a playground, a corner kiosk (a 'shop', so it gets an
// interior), mailboxes, garden sheds, laundry lines, kids' bikes, overturned bins, hedges, a bus stop, street
// signs and an abandoned sandbag barricade on the avenue. New kinds are drawn in js/art/town.js (prefix town_).
(function (root) {
  'use strict';
  var G = root.G, A = G.data && G.data.areas, R = G.data && G.data.resources;
  if (!A || !R) return;

  // salvage that only the town has (items are existing ids from data/items.js)
  R.town_ammo    = { action: 'חיפוש בארגז תחמושת', item: 'ammo',        yield: [2, 5], time: 1.4, tool: null, r: 18, solid: 0, fx: 'metal' };
  R.town_toolbox = { action: 'חיפוש בארגז כלים',   item: 'nails',       yield: [2, 4], time: 1.2, tool: null, r: 16, solid: 0, fx: 'metal' };
  R.town_laundry = { action: 'איסוף כביסה מהחבל',  item: 'cloth',       yield: [1, 2], time: 0.8, tool: null, r: 18, solid: 0, fx: 'cloth' };
  R.town_bin     = { action: 'חיטוט בפח האשפה',    item: 'canned_food', yield: [1, 1], time: 1.0, tool: null, r: 16, solid: 0, fx: 'metal' };

  function hash(a, b) { var h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); }
  function lootOf(P, type, count) {
    var l = P.loot.filter(function (e) { return e.type === type; })[0];
    if (!l) { l = { type: type, count: count || 1, spots: [] }; P.loot.push(l); }
    return l;
  }
  function spots(P, type, list, extra) { var l = lootOf(P, type, 1); list.forEach(function (p) { l.spots.push(p); }); l.count = Math.min(l.spots.length, l.count + (extra || 0)); }
  // flat ground decals: never solid, barely any height (so no cast shadow)
  function decal(S, kind, x, y, w, h, seed) { S.push({ kind: kind, x: x, y: y, w: w, h: h, k: 0.002, solid: false, seed: seed || (x * 7 + y) }); }

  // ---- police station, outside ------------------------------------------------------------------------------
  var P = A.police;
  if (P && P.structures) {
    var S = P.structures, add = function (o) { S.push(o); return o; };
    // checkpoint at the west end of the main street: an army tent, sandbag walls, a barrier, casings everywhere
    add({ kind: 'tent', x: 260, y: 1250, w: 200, h: 140, k: 0.1, color: '#5a5e4a', open: true, interior: 'none' });
    add({ kind: 'sandbags', x: 230, y: 1450, w: 150, h: 30, k: 0.03 });
    add({ kind: 'sandbags', x: 520, y: 1250, w: 30, h: 150, k: 0.03 });
    add({ kind: 'barrier', x: 600, y: 1470, w: 190, h: 30, k: 0.028 });
    add({ kind: 'town_crates', x: 180, y: 1180, w: 60, h: 46, k: 0.03 });
    decal(S, 'town_casings', 380, 1470, 140, 60);
    decal(S, 'town_casings', 560, 1410, 90, 50);
    // spent casings in front of the station's sandbags (someone held the door)
    decal(S, 'town_casings', 1600, 1296, 150, 40);
    decal(S, 'town_casings', 1860, 1296, 140, 40);
    decal(S, 'town_casings', 2260, 1600, 120, 50);
    // the south sidewalk between the shops: bus stop, phone booth, newspaper stand, bins
    add({ kind: 'town_busstop', x: 1230, y: 1752, w: 160, h: 44, k: 0.04, kh: 0.12, solid: false, legs: [{ x: 1230, y: 1786, w: 160, h: 10 }, { x: 1230, y: 1752, w: 8, h: 34 }] });
    add({ kind: 'town_phone', x: 1440, y: 1752, w: 44, h: 44, k: 0.13 });
    add({ kind: 'town_newsstand', x: 1530, y: 1756, w: 72, h: 40, k: 0.06 });
    add({ kind: 'town_bin', x: 1648, y: 1762, w: 30, h: 30, k: 0.04 });
    add({ kind: 'town_bin', x: 2468, y: 1764, w: 30, h: 30, k: 0.04, over: true });
    add({ kind: 'town_bin', x: 820, y: 1500, w: 30, h: 30, k: 0.04, over: true });
    add({ kind: 'town_sign', x: 1700, y: 1548, w: 10, h: 10, k: 0.14, sign: 'stop' });
    add({ kind: 'town_sign', x: 1896, y: 1744, w: 10, h: 10, k: 0.14, sign: 'street' });
    // litter on the street and sidewalks
    [[1260, 1700], [1580, 1640], [2050, 1600], [2700, 1610], [900, 1690], [600, 1730], [3100, 1740], [1950, 1990], [2150, 2300], [1420, 2250],
      [680, 1300], [430, 980], [2950, 1300], [1650, 1200]].forEach(function (p, n) { decal(S, 'town_trash', p[0], p[1], 70 + (n % 3) * 20, 40, n * 31 + 5); });

    spots(P, 'town_ammo', [[420, 1430], [210, 1260], [600, 1440]]);
    lootOf(P, 'town_ammo').count = 1;
    spots(P, 'town_bin', [[1663, 1830], [2483, 1830], [835, 1560]]);
    lootOf(P, 'town_bin').count = 2;
    spots(P, 'radio', [[300, 1232], [1462, 1722]]);
    spots(P, 'medkit', [[200, 1330]]);
    spots(P, 'scrap', [[1310, 1840], [700, 1450]], 1);
    spots(P, 'cargo', [[1566, 1722]]);
    spots(P, 'pallet', [[640, 1300]]);
    spots(P, 'tarp', [[380, 1225]]);
  }

  // ---- the neighborhood -------------------------------------------------------------------------------------
  var N = A.neighborhood;
  if (N && N.structures) {
    var T = N.structures, put = function (o) { T.push(o); return o; };
    var houses = T.filter(function (s) { return s.kind === 'house'; });
    var fenced = function (h) { return T.some(function (f) { return f.kind === 'fence' && Math.abs(f.y - (h.y + h.h + 70)) < 2 && f.x < h.x; }); };
    var tool = [], wash = [], bins = [];
    houses.forEach(function (h, n) {
      var r = hash(h.x, h.y), row = h.y < 800 ? 1 : (h.y < 1600 ? 2 : 3);
      // a mailbox at the front corner of every yard (west of the house, out of the door's way)
      put({ kind: 'town_mailbox', x: h.x - 18, y: h.y + h.h + 30, w: 12, h: 12, k: 0.05, color: ['#4a5560', '#5e4a3e', '#4e5a48'][n % 3] });
      if (row === 1) {                                                                 // backyards to the north: a shed or a laundry line
        if (r < 0.55) {
          var sx = r < 0.27 ? h.x + 10 : h.x + h.w - 90;
          put({ kind: 'town_shed', x: sx, y: 296, w: 80, h: 64, k: 0.075, color: ['#5a5244', '#4e5348', '#5c4c3e'][n % 3], interior: 'none' });
          tool.push([sx + 40, 390]);
        } else {
          put({ kind: 'town_laundry', x: h.x + 30, y: 330, w: 180, h: 10, k: 0.03, kh: 0.08, solid: false, legs: [{ x: h.x + 30, y: 330, w: 8, h: 8 }, { x: h.x + 202, y: 330, w: 8, h: 8 }] });
          wash.push([h.x + 120, 372]);
        }
      }
      if (row === 2 && r > 0.45) put({ kind: 'town_bike', x: h.x + 16 + r * 60, y: h.y + h.h + 100, w: 56, h: 24, k: 0.01, solid: false, kid: r > 0.7 });
      if (row === 3) {
        var bx = h.x + h.w + 8, by = h.y + h.h + 60;
        put({ kind: 'town_bin', x: bx, y: by, w: 30, h: 30, k: 0.04, over: r < 0.6 });
        bins.push([bx + 15, by + 64]);
        if (!fenced(h)) {                                                              // hedges at the corners of the front yard
          put({ kind: 'town_hedge', x: h.x - 30, y: h.y + h.h + 70, w: 70, h: 22, k: 0.035 });
          put({ kind: 'town_hedge', x: h.x + h.w - 40, y: h.y + h.h + 70, w: 70, h: 22, k: 0.035 });
        }
      }
    });

    // playground on the empty lot of the first row
    put({ kind: 'town_hedge', x: 2380, y: 410, w: 320, h: 20, k: 0.035 });
    put({ kind: 'town_swing', x: 2400, y: 470, w: 150, h: 40, k: 0.04, kh: 0.13, solid: false, legs: [{ x: 2400, y: 470, w: 12, h: 40 }, { x: 2538, y: 470, w: 12, h: 40 }] });
    put({ kind: 'town_slide', x: 2610, y: 460, w: 44, h: 130, k: 0.07 });
    put({ kind: 'town_sandbox', x: 2420, y: 610, w: 120, h: 90, k: 0.012, solid: false });
    put({ kind: 'town_bike', x: 2580, y: 660, w: 56, h: 24, k: 0.01, solid: false, kid: true });
    // a trampoline and a laundry line in the empty lot at the west end of the third row
    put({ kind: 'town_trampoline', x: 280, y: 1940, w: 130, h: 130, k: 0.035 });
    put({ kind: 'town_laundry', x: 200, y: 2140, w: 220, h: 10, k: 0.03, kh: 0.08, solid: false, legs: [{ x: 200, y: 2140, w: 8, h: 8 }, { x: 412, y: 2140, w: 8, h: 8 }] });
    wash.push([310, 2180]);
    put({ kind: 'town_bike', x: 450, y: 2000, w: 56, h: 24, k: 0.01, solid: false, kid: true });

    // corner kiosk on the empty lot of the second row, the door on the north (street) side; a drinks machine behind
    put({ kind: 'shop', x: 2420, y: 1150, w: 260, h: 170, k: 0.09, color: '#5a5650', kiosk: true });
    put({ kind: 'vending', variant: 'drink', x: 2560, y: 1336, w: 92, h: 58, k: 0.11 });
    put({ kind: 'town_bin', x: 2380, y: 1300, w: 30, h: 30, k: 0.04, over: true });
    bins.push([2395, 1370]);

    // bus stop and street signs on the main road, the barricade across the avenue
    put({ kind: 'town_busstop', x: 1930, y: 816, w: 150, h: 44, k: 0.04, kh: 0.12, solid: false, legs: [{ x: 1930, y: 816, w: 150, h: 10 }, { x: 2072, y: 816, w: 8, h: 44 }] });
    put({ kind: 'town_sign', x: 1700, y: 870, w: 10, h: 10, k: 0.14, sign: 'stop' });
    put({ kind: 'town_sign', x: 1896, y: 1666, w: 10, h: 10, k: 0.14, sign: 'street' });
    put({ kind: 'town_sign', x: 1700, y: 1840, w: 10, h: 10, k: 0.14, sign: 'kids' });
    put({ kind: 'sandbags', x: 1640, y: 2000, w: 110, h: 30, k: 0.03 });
    put({ kind: 'sandbags', x: 1850, y: 2000, w: 110, h: 30, k: 0.03 });
    put({ kind: 'barrier', x: 1610, y: 1940, w: 30, h: 90, k: 0.028 });
    decal(N.structures, 'town_casings', 1700, 1930, 200, 60);
    decal(N.structures, 'town_casings', 1760, 2050, 90, 40);
    [[400, 980], [1100, 1050], [2100, 990], [2900, 960], [800, 1760], [1500, 1780], [2300, 1700], [3200, 1800], [1790, 1250], [1810, 640], [2600, 1450]]
      .forEach(function (p, n) { decal(T, 'town_trash', p[0], p[1], 60 + (n % 3) * 20, 36, n * 17 + 3); });

    spots(N, 'town_toolbox', tool); lootOf(N, 'town_toolbox').count = Math.min(2, tool.length);
    spots(N, 'town_laundry', wash); lootOf(N, 'town_laundry').count = Math.min(3, wash.length);
    spots(N, 'town_bin', bins); lootOf(N, 'town_bin').count = Math.min(3, bins.length);
    spots(N, 'town_ammo', [[1700, 1965], [1905, 1965]]); lootOf(N, 'town_ammo').count = 1;
    spots(N, 'scrap', [[2470, 760], [500, 2060]]);
    spots(N, 'tarp', [[2480, 740]]);
    spots(N, 'cargo', [[2005, 880]]);
  }
})(typeof window !== 'undefined' ? window : globalThis);
