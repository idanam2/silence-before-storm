// Insides of buildings, generated from the outside structures (plain data, built once at load).
// Every house, shop, office, warehouse and block in a hand-built place gets an interior area of its own and a door:
// the type comes from `s.interior` or from the kind (see typeOf). Multi-storey ones get stairs (like the hospital).
// Each interior is an area with parent = the place, exit = null, a door back out, furniture (`furn` in js/placeart.js)
// and loot spots in front of furniture. A structure with `interior: 'none'` (or one that already has a door) is skipped.
// Load after data/areas.js.
(function (root) {
  'use strict';
  var G = root.G, AREAS = G.data.areas, PI = Math.PI;
  var T = 22, K = 0.06;

  var NAMES = { house: 'בית', shop: 'חנות', office: 'משרד', hall: 'מחסן', hangar: 'האנגר', barn: 'האסם', garage: 'המוסך',
    pump: 'תחנת השאיבה', barracks: 'מגורי החיילים', ward: 'אגף אשפוז', offices: 'בניין משרדים', terminal: 'הטרמינל', boathouse: 'בית הסירות' };

  function typeOf(s) {
    if (s.interior) return s.interior;
    if (s.kind === 'house') return 'house';
    if (s.kind === 'shop') return 'shop';
    if (s.kind === 'office') return 'office';
    if (s.kind === 'warehouse') return 'hall';
    if (s.kind === 'block') return s.garage ? 'garage' : (s.floors >= 2 ? 'offices' : 'office');
    return null;
  }

  // ---- a small builder for one floor ------------------------------------------------------------------------
  function Builder(W, H, seed, mirror) {
    var S = [], spots = [], rand = G.util.rng(seed);
    function mx(x, w) { return mirror ? W - x - (w || 0) : x; }
    var b = {
      W: W, H: H, S: S, rand: rand, spots: spots, doors: [],
      add: function (o) {
        o.x = mx(o.x, o.w);
        if (o.legs) o.legs.forEach(function (l) { l.x = mx(l.x, l.w); });
        S.push(o); return o;
      },
      f: function (style, x, y, w, h, k, o) {
        var e = { kind: 'furn', style: style, x: x, y: y, w: w, h: h, k: k };
        for (var q in o || {}) if (q !== 'spot' && q !== 'at') e[q] = o[q];
        b.add(e);
        if (o && o.spot) b.spot(o.spot, o.at ? o.at[0] : x + w / 2, o.at ? o.at[1] : y + h + 30, true);
        return e;
      },
      vending: function (x, y, v) {
        b.add({ kind: 'vending', variant: v, x: x, y: y, w: 92, h: 58, k: 0.11 });
        b.spot(v === 'snack' ? 'vend_snack' : 'vend_drink', x + 46, y + 94, true);
      },
      spot: function (type, x, y, keep) { spots.push({ type: type, x: mx(x), y: y, keep: !!keep }); },
      hwall: function (y, x0, x1, gaps) {
        span(x0, x1, gaps, function (a, c) { b.add({ kind: 'iwall', x: a, y: y, w: c - a, h: T, k: K }); });
      },
      vwall: function (x, y0, y1, gaps) {
        span(y0, y1, gaps, function (a, c) { b.add({ kind: 'iwall', x: x, y: a, w: T, h: c - a, k: K }); });
      },
      // stairs in a well: `up` and / or `down` flights at x (pre-mirror), doors at their foot
      stairs: function (x, y, up, down, idBase, level, arrive) {
        if (up) { b.add({ kind: 'stairs', dir: 'up', x: x, y: y, w: 100, h: 340, k: 0.06 }); b.doors.push({ x: mx(x + 50), y: y + 385, r: 44, to: idBase + (level + 1), at: { x: mx(arrive[0]), y: arrive[1] }, face: PI / 2, label: 'עלייה לקומה ' + (level + 1) }); }
        if (down) { b.add({ kind: 'stairs', dir: 'down', x: x + 130, y: y, w: 100, h: 340, k: 0.06 }); b.doors.push({ x: mx(x + 180), y: y + 385, r: 44, to: idBase + (level - 1), at: { x: mx(arrive[0]), y: arrive[1] }, face: PI / 2, label: 'ירידה לקומה ' + (level - 1) }); }
        b.f('rail', x + 107, y, 14, 340, 0.05);
      },
      mx: mx
    };
    return b;
  }
  function span(a, c, gaps, fn) {
    var cur = a;
    (gaps || []).slice().sort(function (p, q) { return p[0] - q[0]; }).forEach(function (g) { if (g[0] > cur) fn(cur, g[0]); cur = Math.max(cur, g[1]); });
    if (c > cur) fn(cur, c);
  }

  function solidsOf(S) {
    var out = [];
    S.forEach(function (s) {
      if (s.legs) s.legs.forEach(function (l) { out.push(l); });
      else if (s.solid !== false) out.push(s);
    });
    return out;
  }
  function blocked(solids, x, y, pad) {
    for (var i = 0; i < solids.length; i++) { var r = solids[i]; if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) return true; }
    return false;
  }

  // Outer walls with the way out, then the area definition. counts: { type: how many of its spots get loot }.
  function finish(b, o) {
    var W = b.W, H = b.H, north = o.exitNorth, ex = b.mx(o.exitX || W / 2);
    b.S.push({ kind: 'iwall', x: 100, y: 100, w: W - 200, h: T, k: K });
    if (north) { b.S.pop(); span(100, W - 100, [[ex - 60, ex + 60]], function (a, c) { b.S.push({ kind: 'iwall', x: a, y: 100, w: c - a, h: T, k: K }); }); }
    b.S.push({ kind: 'iwall', x: 100, y: 100, w: T, h: H - 140, k: K }, { kind: 'iwall', x: W - 122, y: 100, w: T, h: H - 140, k: K });
    var southGap = o.exit && !north ? [[ex - 60, ex + 60]] : [];
    span(100, W - 100, southGap, function (a, c) { b.S.push({ kind: 'iwall', x: a, y: H - 62, w: c - a, h: T, k: K }); });
    var doors = b.doors.slice(), inside = null;
    if (o.exit) {
      inside = north ? { x: ex, y: 220 } : { x: ex, y: H - 150 };
      doors.push({ x: ex, y: north ? 112 : H - 52, r: 56, to: o.exit.to, at: o.exit.at, face: o.exit.face, label: o.exit.label });
    }
    // keep loot spots that are free, inside the walls and away from the doors
    var solids = solidsOf(b.S), byType = {};
    b.spots.forEach(function (p) {
      if (p.x < 140 || p.x > W - 140 || p.y < 140 || p.y > H - 80) return;
      if (blocked(solids, p.x, p.y, 22)) return;
      for (var d = 0; d < doors.length; d++) if (Math.hypot(p.x - doors[d].x, p.y - doors[d].y) < doors[d].r + 40) return;
      if (inside && Math.hypot(p.x - inside.x, p.y - inside.y) < 60) return;
      (byType[p.type] = byType[p.type] || []).push([Math.round(p.x), Math.round(p.y)]);
    });
    var loot = [];
    Object.keys(byType).forEach(function (t) {
      var n = byType[t].length, want = o.counts && o.counts[t] !== undefined ? o.counts[t] : Math.ceil(n * 0.6);
      if (want > 0) loot.push({ type: t, count: Math.min(n, want), spots: byType[t] });
    });
    var lights = [];
    for (var lx = 300; lx < W - 200; lx += 600) { lights.push([lx, 140, 240]); lights.push([lx, H - 80, 200]); }
    return {
      id: o.id, name: o.name, parent: o.parent, interior: true, seed: o.seed, width: W, height: H, margin: 120,
      exit: null, doors: doors, spawn: inside || doors[0].at,
      clearing: 0, reach: 26, paths: [], roads: [], ponds: [], water: [], decks: [], structures: b.S,
      footprint: { x: 100, y: 100, w: W - 200, h: H - 140 }, floors: (o.floors || []).map(function (f) { return { x: b.mx(f.x, f.w), y: f.y, w: f.w, h: f.h, tone: f.tone }; }), lights: lights, border: null,
      theme: { ground: 'tiles', trail: false, tones: [['0,0,0', 0.24], ['70,64,52', 0.08]], decor: o.decor || [['papers', 30], ['pebbles', 40], ['leaves', 12]] },
      spawns: [], loot: loot, inside: inside
    };
  }

  // ---- the layouts, one function per type. Each returns a list of floors (usually one). --------------------
  var LAYOUT = {};

  LAYOUT.house = function (o) {
    var W = 1400, H = 1000, b = Builder(W, H, o.seed, o.rand() < 0.5), r = b.rand;
    b.vwall(700, 122, 938, [[250, 350], [660, 760]]);
    b.hwall(500, 122, 700, [[300, 400]]); b.hwall(500, 722, 1278, [[1100, 1200]]); b.vwall(1000, 122, 500, [[300, 400]]);
    b.f('bunk', 160, 160, 210, 140, 0.03, { spot: 'tarp', at: [270, 340] });            // bedroom
    b.f('cabinet', 540, 140, 120, 50, 0.09, { spot: 'tarp' });
    b.f('cabinet', 400, 150, 50, 50, 0.04, { spot: 'medkit', at: [425, 230] });
    b.f('desk', 760, 160, 190, 70, 0.042, { spot: 'radio' });                           // small study
    b.f('chair', 830, 250, 40, 40, 0.025);
    b.f('counter', 1060, 150, 190, 90, 0.035, { color: '#9a9c94' });                    // bathroom
    b.f('medcab', 1200, 330, 60, 60, 0.06, { spot: 'medkit', at: [1150, 360] });
    b.f('sofa', 150, 560, 70, 230, 0.035);                                              // living room
    b.f('cabinet', 420, 540, 180, 40, 0.04, { spot: 'radio' });
    b.f('table', 300, 680, 150, 90, 0.035, { spot: 'cargo' });
    b.f('counter', 740, 540, 380, 46, 0.05, { spot: 'cargo' });                         // kitchen
    b.f('fridge', 1170, 530, 80, 64, 0.1, { spot: 'cargo' });
    b.f('table', 900, 720, 160, 100, 0.035);
    b.f('chair', 860, 750, 40, 40, 0.025); b.f('chair', 1080, 750, 40, 40, 0.025);
    if (r() < 0.5) b.spot('barrel', 1220, 880);
    return [finish(b, { id: o.id, name: o.name, parent: o.parent, seed: o.seed, exit: o.exit, exitX: 420,
      floors: [{ x: 122, y: 522, w: 578, h: 416, tone: '64,52,42' }, { x: 1022, y: 122, w: 256, h: 378, tone: '70,78,80' }],
      counts: { cargo: 2, tarp: 1, medkit: 1, radio: 1, barrel: 1 } })];
  };

  LAYOUT.shop = function (o) {
    var W = 1400, H = 900, b = Builder(W, H, o.seed, o.rand() < 0.5);
    b.hwall(600, 122, 1278, [[1000, 1100]]);
    b.f('shelf', 250, 260, 640, 50, 0.09, { spot: 'cargo', at: [400, 350] }); b.spot('cargo', 760, 350, true);
    b.f('shelf', 250, 420, 640, 50, 0.09, { spot: 'cargo', at: [400, 510] }); b.spot('cargo', 760, 510, true);
    b.f('counter', 960, 200, 220, 46, 0.05, { spot: 'vend_snack', at: [1070, 290] });
    b.f('fridge', 1190, 330, 70, 200, 0.1, { spot: 'vend_drink', at: [1150, 430] });
    b.f('shelf', 140, 640, 60, 180, 0.09);                                               // the back room
    b.spot('crate', 400, 700); b.spot('crate', 700, 760); b.spot('pallet', 1150, 760); b.spot('tarp', 300, 780);
    return [finish(b, { id: o.id, name: o.name, parent: o.parent, seed: o.seed, exit: o.exit, exitNorth: true, exitX: 700,
      counts: { cargo: 3, vend_snack: 1, vend_drink: 1, crate: 1, pallet: 1, tarp: 1 } })];
  };

  LAYOUT.office = function (o) {
    var W = 1100, H = 800, b = Builder(W, H, o.seed, o.rand() < 0.5);
    b.f('desk', 200, 200, 200, 80, 0.042, { spot: 'radio' }); b.f('chair', 280, 300, 40, 40, 0.025);
    b.f('desk', 650, 200, 200, 80, 0.042, { spot: 'radio' }); b.f('chair', 730, 300, 40, 40, 0.025);
    b.f('cabinet', 124, 420, 60, 180, 0.075, { spot: 'tarp', at: [220, 500] });
    b.f('cabinet', 940, 140, 60, 200, 0.075, { spot: 'medkit', at: [900, 390] });
    b.f('counter', 300, 470, 250, 46, 0.05, { spot: 'cargo' });
    b.f('fridge', 880, 560, 80, 60, 0.1, { spot: 'cargo', at: [820, 600] });
    return [finish(b, { id: o.id, name: o.name, parent: o.parent, seed: o.seed, exit: o.exit, exitX: 700,
      counts: { radio: 1, medkit: 1, cargo: 1, tarp: 1 } })];
  };

  function hall(o, variant) {
    var W = 2000, H = 1300, b = Builder(W, H, o.seed, o.rand() < 0.5), r = b.rand, i;
    if (variant === 'hangar') {
      b.add({ kind: 'plane', x: 450, y: 260, w: 820, h: 560, k: 0.05, fw: 40, legs: [{ x: 450, y: 520, w: 820, h: 40 }], solid: false });
      for (i = 0; i < 4; i++) b.f('cabinet', 300 + i * 360, 124, 120, 50, 0.075, { spot: i % 2 ? 'scrap' : 'radio' });
      b.add({ kind: 'car', style: 'tanker', x: 1500, y: 860, w: 220, h: 80, k: 0.065, color: '#6a6a4a', tank: '#8a8a80' });
      ['scrap', 'crate', 'tarp', 'barrel', 'scrap', 'crate'].forEach(function (t, n) { b.spot(t, 300 + n * 260, 1000 + (n % 2) * 90); });
      return [finish(b, { id: o.id, name: o.name, parent: o.parent, seed: o.seed, exit: o.exit, exitX: 1000, counts: { scrap: 3, radio: 1, crate: 2, tarp: 1, barrel: 1 } })];
    }
    if (variant === 'barn') {
      for (i = 0; i < 5; i++) b.add({ kind: 'iwall', x: 300 + i * 260, y: 122, w: 16, h: 280, k: 0.035 });   // stalls along the north wall
      [[400, 640, 160], [700, 700, 130], [1500, 620, 170], [1700, 820, 120]].forEach(function (p) { b.add({ kind: 'pile', x: p[0], y: p[1], w: p[2], h: p[2], k: 0.055, color: '#8a7a4a' }); });
      b.add({ kind: 'car', style: 'tractor', x: 1050, y: 760, w: 150, h: 84, k: 0.06, color: '#6a3a2a' });
      for (i = 0; i < 5; i++) b.spot(['pallet', 'tarp', 'cargo', 'crate', 'pallet'][i], 430 + i * 260, 340);
      ['crate', 'pallet', 'scrap', 'tarp'].forEach(function (t, n) { b.spot(t, 300 + n * 420, 1100); });
      return [finish(b, { id: o.id, name: o.name, parent: o.parent, seed: o.seed, exit: o.exit, exitX: 1000, counts: { pallet: 2, tarp: 2, cargo: 1, crate: 2, scrap: 1 } })];
    }
    if (variant === 'boathouse') {
      for (i = 0; i < 3; i++) b.add({ kind: 'boat', x: 300 + i * 260, y: 300, w: 80, h: 200, k: 0.03 });
      b.f('shelf', 1300, 140, 520, 50, 0.09, { spot: 'tarp', at: [1450, 240] }); b.spot('scrap', 1700, 240, true);
      b.f('desk', 1400, 500, 220, 80, 0.042, { spot: 'crate' });
      ['tarp', 'scrap', 'barrel', 'crate'].forEach(function (t, n) { b.spot(t, 300 + n * 350, 1050); });
      return [finish(b, { id: o.id, name: o.name, parent: o.parent, seed: o.seed, exit: o.exit, exitX: 1000, counts: { tarp: 2, scrap: 2, barrel: 1, crate: 1 } })];
    }
    // warehouse: rows of shelving, a forklift, a small office in a corner
    for (i = 0; i < 4; i++) {
      b.f('shelf', 280 + i * 300, 200, 70, 560, 0.1);
      b.spot(['crate', 'tarp', 'crate', 'scrap'][i], 250 + i * 300, 480); b.spot(['pallet', 'crate', 'scrap', 'pallet'][i], 385 + i * 300, 480);
    }
    b.vwall(1560, 122, 520, [[300, 400]]); b.hwall(520, 1560, 1878, [[1700, 1800]]);
    b.f('desk', 1620, 170, 200, 80, 0.042, { spot: 'radio' }); b.f('cabinet', 1800, 300, 60, 160, 0.075);
    b.add({ kind: 'car', style: 'truck', x: 1450, y: 820, w: 160, h: 70, k: 0.05, color: '#7a6a34', cargo: '#5a4a3a' });
    for (i = 0; i < 5; i++) b.spot(['pallet', 'crate', 'barrel', 'pallet', 'tarp'][i], 250 + i * 240, 1000 + (i % 2) * 90);
    if (r() < 0.5) b.spot('cargo', 1700, 700);
    return [finish(b, { id: o.id, name: o.name, parent: o.parent, seed: o.seed, exit: o.exit, exitX: 1000, counts: { crate: 3, pallet: 2, scrap: 2, tarp: 1, radio: 1, barrel: 1, cargo: 1 } })];
  }
  LAYOUT.hall = function (o) { return hall(o, 'warehouse'); };
  LAYOUT.hangar = function (o) { return hall(o, 'hangar'); };
  LAYOUT.barn = function (o) { return hall(o, 'barn'); };
  LAYOUT.boathouse = function (o) { return hall(o, 'boathouse'); };

  LAYOUT.garage = function (o) {
    var W = 1600, H = 1000, b = Builder(W, H, o.seed, o.rand() < 0.5);
    b.add({ kind: 'car', x: 650, y: 380, w: 140, h: 260, k: 0.05, police: !!o.police, color: o.police ? '#3b4a5c' : '#5b5348', open: true });
    b.spot('scrap', 720, 690, true); b.spot('scrap', 860, 500, true);
    b.f('desk', 200, 140, 300, 80, 0.045, { spot: 'radio' }); b.f('desk', 1000, 140, 300, 80, 0.045, { spot: 'scrap' });
    b.f('cabinet', 124, 400, 60, 200, 0.075, { spot: 'crate', at: [220, 500] }); b.f('cabinet', 1416, 400, 60, 200, 0.075, { spot: 'radio', at: [1380, 500] });
    b.spot('barrel', 300, 820); b.spot('crate', 1300, 820);
    return [finish(b, { id: o.id, name: o.name, parent: o.parent, seed: o.seed, exit: o.exit, exitX: 450, counts: { scrap: 2, radio: 1, crate: 1, barrel: 1 } })];
  };

  LAYOUT.pump = function (o) {
    var W = 1400, H = 900, b = Builder(W, H, o.seed, false);
    b.add({ kind: 'tankc', x: 260, y: 220, w: 220, h: 220, k: 0.12 }); b.add({ kind: 'tankc', x: 620, y: 240, w: 180, h: 180, k: 0.1 });
    b.f('rail', 480, 320, 140, 14, 0.04); b.f('cabinet', 1000, 140, 220, 60, 0.08, { spot: 'radio' }); b.f('desk', 1000, 450, 200, 80, 0.042, { spot: 'scrap' });
    b.spot('scrap', 370, 500); b.spot('barrel', 1180, 760); b.spot('scrap', 710, 500);
    return [finish(b, { id: o.id, name: o.name, parent: o.parent, seed: o.seed, exit: o.exit, exitX: 700, counts: { radio: 1, scrap: 2, barrel: 1 } })];
  };

  LAYOUT.barracks = function (o) {
    var W = 1700, H = 800, b = Builder(W, H, o.seed, false), i;
    for (i = 0; i < 6; i++) b.f('bunk', 160 + i * 240, 140, 170, 70, 0.08, { spot: i % 2 ? 'tarp' : 'cargo' });
    for (i = 0; i < 6; i++) if (i !== 2 && i !== 3) b.f('bunk', 160 + i * 240, 600, 170, 70, 0.08, { spot: i % 2 ? 'medkit' : 'cargo', at: [245 + i * 240, 560] });
    b.f('table', 640, 380, 420, 90, 0.035); b.f('locker', 124, 300, 46, 180, 0.1, { spot: 'crate', at: [210, 390] });
    b.f('locker', 1532, 300, 46, 180, 0.1, { spot: 'crate', at: [1490, 390] });
    return [finish(b, { id: o.id, name: o.name, parent: o.parent, seed: o.seed, exit: o.exit, exitX: 850, counts: { cargo: 2, tarp: 2, medkit: 1, crate: 1 } })];
  };

  LAYOUT.ward = function (o) {
    var W = 1600, H = 900, b = Builder(W, H, o.seed, false), i;
    for (i = 0; i < 5; i++) {
      b.f('hbed', 180 + i * 270, 160, 80, 150, 0.035, { spot: i % 2 ? 'tarp' : 'medkit' });
      b.f('ivpole', 154 + i * 270, 170, 12, 12, 0.11);
      if (i < 4) b.f('curtain', 290 + i * 270, 140, 8, 190, 0.1, { solid: false });
    }
    b.f('medcab', 124, 600, 60, 150, 0.09, { spot: 'medkit', at: [220, 680] }); b.f('counter', 1100, 620, 300, 46, 0.05, { spot: 'cargo' });
    b.f('wheelchair', 600, 650, 50, 56, 0.04);
    return [finish(b, { id: o.id, name: o.name, parent: o.parent, seed: o.seed, exit: o.exit, exitX: 900, counts: { medkit: 2, tarp: 1, cargo: 1 } })];
  };

  // Office building with several floors: a corridor, rooms off it, the stairwell in the north-east corner.
  LAYOUT.offices = function (o) {
    var n = Math.max(2, o.s.floors || 2), out = [], W = 1900, H = 1200;
    for (var lv = 1; lv <= n; lv++) {
      var b = Builder(W, H, o.seed + lv * 13, false), i;
      b.vwall(1480, 122, 560);
      b.stairs(1520, 150, lv < n, lv > 1, o.id + '_f', lv, [1640, 640]);
      b.hwall(560, 122, 1778, [[300, 400], [800, 900], [1250, 1350], [1560, 1720]]);
      b.vwall(600, 122, 560); b.vwall(1050, 122, 560);
      b.hwall(680, 122, 1778, [[300, 400], [900, 1100], [1450, 1550]]);
      b.vwall(700, 702, 1138); b.vwall(1300, 702, 1138);
      b.f('desk', 200, 200, 240, 90, 0.045, { spot: 'radio' }); b.f('cabinet', 124, 380, 60, 150, 0.075, { spot: 'tarp', at: [220, 460] });
      b.f('table', 700, 250, 260, 140, 0.04, { spot: 'cargo', at: [830, 450] });                   // map table / meeting room
      for (i = 0; i < 3; i++) b.f('chair', 720 + i * 90, 190, 40, 40, 0.025);
      b.f('desk', 1120, 200, 240, 90, 0.045, { spot: 'medkit' }); b.f('cabinet', 1380, 140, 60, 200, 0.075);
      b.f('desk', 200, 820, 240, 90, 0.045, { spot: 'radio' }); b.f('sofa', 200, 1030, 200, 70, 0.035);
      b.vending(760, 720, 'snack'); b.vending(862, 720, 'drink'); b.f('table', 900, 950, 200, 100, 0.035);
      b.f('desk', 1400, 820, 280, 90, 0.045, { spot: 'radio' }); b.f('safe', 1680, 1040, 70, 60, 0.055, { spot: 'medkit', at: [1640, 980] });
      var fl = finish(b, { id: o.id + '_f' + lv, name: o.name + ' · קומה ' + lv, parent: o.parent, seed: o.seed + lv, exit: lv === 1 ? o.exit : null, exitX: 1170,
        counts: { radio: 2, medkit: 1, cargo: 1, tarp: 1, vend_snack: 1, vend_drink: 1 } });
      if (lv > 1) fl.spawn = { x: 1640, y: 640 };
      out.push(fl);
    }
    return out;
  };

  // The airport terminal, by hand: check-in hall, baggage belt, security, a shop and cafe below; gates, food court,
  // duty free and a lounge above.
  LAYOUT.terminal = function (o) {
    var W = 2700, H = 1400, out = [];
    // floor 1
    var b = Builder(W, H, o.seed + 1, false), i, j;
    b.vwall(2200, 122, 620); b.stairs(2260, 150, true, false, o.id + '_f', 1, [2380, 680]);
    for (i = 0; i < 6; i++) { b.f('counter', 300 + i * 280, 330, 200, 50, 0.05, { spot: i % 2 ? 'tarp' : 'radio', at: [400 + i * 280, 270] }); b.f('counter', 300 + i * 280, 380, 200, 30, 0.02, { color: '#2e302c' }); }   // check-in desks with their belts
    b.f('counter', 300, 140, 1600, 30, 0.04, { color: '#3a3c38' });                                     // the baggage belt behind them
    for (i = 0; i < 4; i++) b.spot('tarp', 450 + i * 400, 220);
    // security line: barriers with a gap, a scanner arch
    for (i = 0; i < 5; i++) if (i !== 2) b.add({ kind: 'barrier', x: 400 + i * 300, y: 620, w: 220, h: 26, k: 0.03 });
    b.f('xray', 1060, 660, 200, 120, 0.08);
    // south half: rows of seats, an info desk, a small shop, a cafe with vending machines
    for (j = 0; j < 2; j++) for (i = 0; i < 8; i++) b.f('chair', 300 + i * 90 + (i > 3 ? 120 : 0), 900 + j * 130, 50, 50, 0.026);
    b.f('counter', 1300, 900, 260, 60, 0.05, { spot: 'medkit' });
    b.vwall(1800, 860, 1338, [[1100, 1200]]); b.hwall(860, 1800, 2578, [[2100, 2250]]);
    b.f('shelf', 1880, 960, 60, 300, 0.09, { spot: 'cargo', at: [1980, 1100] }); b.f('shelf', 2060, 960, 60, 300, 0.09, { spot: 'cargo', at: [2160, 1100] });
    b.vending(2300, 900, 'snack'); b.vending(2402, 900, 'drink'); b.f('table', 2300, 1150, 200, 100, 0.035, { spot: 'cargo' });
    b.f('wheelchair', 1650, 1000, 50, 56, 0.04);
    out.push(finish(b, { id: o.id + '_f1', name: o.name + ' · קומה 1', parent: o.parent, seed: o.seed + 1, exit: o.exit, exitX: 1350,
      floors: [{ x: 1822, y: 882, w: 756, h: 456, tone: '58,52,44' }], counts: { radio: 2, tarp: 4, medkit: 1, cargo: 2, vend_snack: 1, vend_drink: 1 } }));
    // floor 2
    b = Builder(W, H, o.seed + 2, false);
    b.vwall(2200, 122, 620); b.stairs(2260, 150, false, true, o.id + '_f', 2, [2380, 680]);
    for (j = 0; j < 3; j++) for (i = 0; i < 10; i++) b.f('chair', 250 + i * 80 + (i > 4 ? 100 : 0), 200 + j * 120, 46, 46, 0.026);   // gate seating
    for (i = 0; i < 3; i++) b.f('counter', 1250 + i * 300, 160, 200, 50, 0.05, { spot: i === 1 ? 'radio' : 'tarp' });        // gate desks
    b.hwall(700, 122, 2578, [[500, 700], [1300, 1500], [2300, 2500]]);
    b.vwall(900, 722, 1338); b.vwall(1700, 722, 1338);
    for (i = 0; i < 3; i++) b.f('shelf', 200 + i * 220, 820, 60, 380, 0.09, { spot: 'cargo', at: [300 + i * 220, 1260] });      // duty free
    b.f('counter', 950, 760, 400, 50, 0.05, { spot: 'vend_snack', at: [1150, 860] }); b.vending(1400, 750, 'drink'); b.vending(1502, 750, 'snack');   // food court
    for (i = 0; i < 3; i++) b.f('table', 1000 + i * 220, 1050, 140, 90, 0.035, { spot: 'cargo' });
    b.f('sofa', 1800, 800, 300, 80, 0.035); b.f('sofa', 1800, 1150, 300, 80, 0.035); b.f('sofa', 2350, 900, 80, 300, 0.035);   // lounge
    b.f('table', 1950, 980, 160, 90, 0.035, { spot: 'medkit', at: [2030, 1110] }); b.f('fridge', 2480, 760, 80, 64, 0.1, { spot: 'vend_drink', at: [2420, 860] });
    var f2 = finish(b, { id: o.id + '_f2', name: o.name + ' · קומה 2', parent: o.parent, seed: o.seed + 2, exit: null,
      floors: [{ x: 1722, y: 722, w: 856, h: 616, tone: '62,46,42' }], counts: { cargo: 3, radio: 1, tarp: 2, medkit: 1, vend_snack: 2, vend_drink: 2 } });
    f2.spawn = { x: 2380, y: 680 };
    out.push(f2);
    return out;
  };

  // ---- link every building of every hand-built place ---------------------------------------------------------
  function link(place) {
    var P = AREAS[place];
    if (!P || P.interior || !P.structures) return;
    P.doors = P.doors || [];
    var solids = solidsOf(P.structures), n = 0;
    P.structures.forEach(function (s) {
      var type = typeOf(s);
      if (!type || type === 'none' || !LAYOUT[type]) return;
      var north = s.kind === 'shop' || s.doorSide === 'north';
      var face = north ? s.y : s.y + s.h, taken = P.doors.some(function (d) { return d.x > s.x && d.x < s.x + s.w && Math.abs(d.y - face) < 90; });
      if (taken) return;
      // the door: the drawn door if there is one, else the middle; slide along the face until door and arrival are free
      var u0 = s.entrance || s.door || (s.garage === 2 ? 0.275 : 0.5), best = null;
      var tries = [];
      [[40, 112], [40, 96], [30, 80]].forEach(function (g) { [0, 0.08, -0.08, 0.16, -0.16, 0.24, -0.24, 0.32, -0.32].forEach(function (du) { tries.push([du, g[0], g[1]]); }); });
      tries.some(function (tr) {
        var u = u0 + tr[0];
        if (u < 0.12 || u > 0.88) return false;
        var x = s.x + s.w * u, dy = north ? -1 : 1, d = { x: x, y: face + dy * tr[1] }, a = { x: x, y: face + dy * tr[2] };
        if (blocked(solids, d.x, d.y, 20) || blocked(solids, a.x, a.y, 24)) return false;
        if (a.x < 60 || a.y < 60 || a.x > P.width - 60 || a.y > P.height - 60) return false;
        if (P.exit && Math.hypot(a.x - P.exit.x, a.y - P.exit.y) < P.exit.r + 40) return false;
        if (P.doors.some(function (o2) { return Math.hypot(o2.x - d.x, o2.y - d.y) < 140; })) return false;
        best = { u: u, d: d, a: a };
        return true;
      });
      if (!best) return;
      n++;
      var id = place + '_in' + n, name = (s.sign ? s.sign : NAMES[type]) + ' · ' + P.name;
      if (type === 'house' || type === 'shop') name = P.name + ' · ' + NAMES[type];
      var floors = LAYOUT[type]({
        id: id, name: name, parent: place, s: s, seed: (P.seed || 1) * 7 + n * 131, rand: G.util.rng((P.seed || 1) + n * 977), police: place === 'police',
        exit: { to: place, at: best.a, face: north ? -PI / 2 : PI / 2, label: 'יציאה' }
      });
      floors.forEach(function (f) { AREAS[f.id] = f; });
      var first = floors[0];
      P.doors.push({ x: best.d.x, y: best.d.y, r: 40, to: first.id, at: first.inside, face: north ? PI / 2 : -PI / 2, label: 'כניסה ל' + NAMES[type].replace(/^ה/, '') });
      if (s.kind === 'house' || s.kind === 'warehouse') s.door = best.u;
      if (s.kind === 'block' && !s.garage && !s.entrance) s.entrance = best.u;
    });
  }

  Object.keys(AREAS).forEach(link);
  G.data.interiorTypes = Object.keys(LAYOUT);
})(typeof window !== 'undefined' ? window : globalThis);
