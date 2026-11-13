// Free placement at home: the player puts structures (workbench, campfire, rack, bed, tank) anywhere in the yard, as many as
// he wants, and lays the floor block by block. Pure logic, unit-tested in Node. Drawing: js/baseart.js, input: js/game.js.
// State: st.placed = [{ id, x, y }] (top-left corner of each structure, size from the building's `spot` in data/buildings.js),
// st.floor = { cells: { 'cx,cy': materialId } } (cells of G.data.floorMaterials CELL px on the ground).
// The level of a structure type (st.buildings[id]) is shared by all its copies: one upgrade upgrades every copy.
(function (root) {
  'use strict';
  var G = root.G;

  var GRID = 8, CELL = 128, MAX_EACH = 8, MAX_CELLS = 3000, FENCE_GAP = 8;

  function defs() { return G.data.buildings; }
  function isPlaceable(id) { var d = defs()[id]; return !!(d && d.spot); }
  function size(id) {
    if (id === 'chest') return { w: G.base.layout.chest.w, h: G.base.layout.chest.h };      // the storage chest can be moved too
    var s = defs()[id].spot; return { w: s.w, h: s.h };
  }
  function maxOf(id) { var d = defs()[id]; return d && d.max ? d.max : MAX_EACH; }      // most copies of a structure (bed, garages: 1)
  function snap(v) { return Math.round(v / GRID) * GRID; }
  function overlap(p, q) { return p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y; }

  function inner() {                                   // walkable inside of the fenced yard
    var a = G.base.layout.area, t = 12 + FENCE_GAP;
    return { x: a.x + t, y: a.y + t, w: a.w - 2 * t, h: a.h - 2 * t };
  }

  var placing = {
    GRID: GRID, CELL: CELL, MAX_EACH: MAX_EACH,
    isPlaceable: isPlaceable,
    max: maxOf,
    size: size,

    // Centered on a world point, snapped to the grid, and kept inside the yard.
    rectAt: function (id, wx, wy) {
      var s = size(id), a = inner();
      var x = snap(wx - s.w / 2), y = snap(wy - s.h / 2);
      x = Math.max(a.x, Math.min(x, a.x + a.w - s.w)); y = Math.max(a.y, Math.min(y, a.y + a.h - s.h));
      return { x: x, y: y, w: s.w, h: s.h };
    },

    // Why a rect cannot hold a structure: 'gate' | 'blocked' | null (ok). `b` = built base (b.solids has the placed copies).
    // `ignore`: a solid (or a list of solids: a garage has several) to leave out (a copy that is being moved).
    check: function (b, r, ignore) {
      var L = G.base.layout, a = L.area;
      if (overlap(r, { x: L.gate.x - 40, y: a.y, w: L.gate.w + 80, h: 170 })) return 'gate';          // the way in stays open
      var s = b.solids;
      for (var i = 0; i < s.length; i++) {
        if ((ignore && (Array.isArray(ignore) ? ignore.indexOf(s[i]) >= 0 : s[i] === ignore)) || (s[i].kind === 'trunk' && !(s[i].tree && s[i].tree.yard))) continue;     // the woods outside never matter; a tree in the yard does
        if (overlap(r, { x: s[i].x - 4, y: s[i].y - 4, w: s[i].w + 8, h: s[i].h + 8 })) return 'blocked';
      }
      return null;
    },

    list: function (placed, id) { return (placed || []).filter(function (p) { return p.id === id; }); },
    count: function (placed, id) { return placing.list(placed, id).length; },

    // Index of the copy of `id` under a world point, or -1.
    indexAt: function (placed, id, wx, wy) {
      for (var i = 0; i < placed.length; i++) {
        var p = placed[i], s = size(p.id);
        if (p.id === id && wx >= p.x && wx <= p.x + s.w && wy >= p.y && wy <= p.y + s.h) return i;
      }
      return -1;
    },

    // Old saves (and tests) know only "level of each structure": put every built one on its first fixed spot.
    legacy: function (levels) {
      var out = [];
      for (var id in defs()) if (isPlaceable(id) && levels && levels[id] > 0) out.push({ id: id, x: defs()[id].spot.x, y: defs()[id].spot.y });
      return out;
    },

    // Safe copy of a list from a save: known structures, numbers, inside the yard, at most max (default MAX_EACH) of a kind.
    clean: function (list, levels) {
      if (!Array.isArray(list)) return placing.legacy(levels);
      var out = [], n = {}, a = inner();
      for (var i = 0; i < list.length && i < 80; i++) {
        var p = list[i];
        if (!p || typeof p.id !== 'string' || !isPlaceable(p.id) || !isFinite(p.x) || !isFinite(p.y)) continue;
        if (levels && !(levels[p.id] > 0)) continue;
        n[p.id] = (n[p.id] || 0) + 1; if (n[p.id] > maxOf(p.id)) continue;
        var s = size(p.id);
        out.push({ id: p.id, x: Math.round(Math.max(a.x, Math.min(p.x, a.x + a.w - s.w))), y: Math.round(Math.max(a.y, Math.min(p.y, a.y + a.h - s.h))) });
      }
      return out;
    },

    // ---- floor ---------------------------------------------------------------------------------------------------
    createFloor: function () { return { cells: {} }; },

    // The block grid: CELL px blocks, centred in the yard (cols x rows blocks, margins at the fence).
    grid: function () {
      var a = G.base.layout.area, cols = Math.floor(a.w / CELL), rows = Math.floor(a.h / CELL);
      return { x0: a.x + (a.w - cols * CELL) / 2, y0: a.y + (a.h - rows * CELL) / 2, cols: cols, rows: rows };
    },
    cellRect: function (cx, cy) {
      var g = placing.grid();
      if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows) return null;
      return { cx: cx, cy: cy, x: g.x0 + cx * CELL, y: g.y0 + cy * CELL, w: CELL, h: CELL, key: cx + ',' + cy };
    },
    // The floor block under a world point (null outside the grid).
    cellAt: function (wx, wy) {
      var g = placing.grid();
      return placing.cellRect(Math.floor((wx - g.x0) / CELL), Math.floor((wy - g.y0) / CELL));
    },
    // Keys of the whole connected floor that contains `key` (4-neighbours), for moving the floor in one piece.
    group: function (floor, key) {
      var out = [], seen = {}, stack = [key];
      while (stack.length) {
        var k = stack.pop();
        if (seen[k] || !floor.cells[k]) continue;
        seen[k] = true; out.push(k);
        var p = k.split(','), x = +p[0], y = +p[1];
        stack.push((x + 1) + ',' + y, (x - 1) + ',' + y, x + ',' + (y + 1), x + ',' + (y - 1));
      }
      return out;
    },
    // The living yard tree inside a floor block (or a rect), or null: it has to be felled before anything goes there.
    treeIn: function (b, r) {
      for (var i = 0; i < b.trees.length; i++) {
        var t = b.trees[i];
        if (t.yard && !t.dead && t.x > r.x - 14 && t.x < r.x + r.w + 14 && t.y > r.y - 14 && t.y < r.y + r.h + 14) return t;
      }
      return null;
    },

    // ---- fence pieces: one block long, standing on the edge of a block. { o: 'h' | 'v', cx, cy, m } ('h': the north edge of block
    // cx,cy; 'v': its west edge). A piece may only stand on an edge that touches a floor block. ----
    FENCE_T: 12, MAX_FENCES: 400,
    fenceRect: function (f) {
      var g = placing.grid(), t = placing.FENCE_T;
      return f.o === 'h' ? { x: g.x0 + f.cx * CELL, y: g.y0 + f.cy * CELL - t / 2, w: CELL, h: t } : { x: g.x0 + f.cx * CELL - t / 2, y: g.y0 + f.cy * CELL, w: t, h: CELL };
    },
    fenceKey: function (f) { return f.o + f.cx + ',' + f.cy; },
    fenceInRange: function (f) {
      var g = placing.grid();
      return (f.o === 'h' || f.o === 'v') && f.cx === Math.floor(f.cx) && f.cy === Math.floor(f.cy) &&
        (f.o === 'h' ? f.cx >= 0 && f.cx < g.cols && f.cy >= 0 && f.cy <= g.rows : f.cx >= 0 && f.cx <= g.cols && f.cy >= 0 && f.cy < g.rows);
    },
    // The edge nearest a world point, for orientation o.
    fenceNear: function (o, wx, wy) {
      var g = placing.grid(), f = o === 'h' ? { o: 'h', cx: Math.floor((wx - g.x0) / CELL), cy: Math.round((wy - g.y0) / CELL) } : { o: 'v', cx: Math.round((wx - g.x0) / CELL), cy: Math.floor((wy - g.y0) / CELL) };
      f.cx = Math.max(0, Math.min(f.cx, o === 'h' ? g.cols - 1 : g.cols)); f.cy = Math.max(0, Math.min(f.cy, o === 'h' ? g.rows : g.rows - 1));
      return f;
    },
    fenceIndex: function (fences, f) { for (var i = 0; i < fences.length; i++) if (fences[i].o === f.o && fences[i].cx === f.cx && fences[i].cy === f.cy) return i; return -1; },
    // 'floor' (no floor block beside it) | 'gate' (the way in) | 'tree' | 'dup' | null (ok)
    fenceCheck: function (b, floor, fences, f) {
      var a = (f.o === 'h' ? [[f.cx, f.cy - 1], [f.cx, f.cy]] : [[f.cx - 1, f.cy], [f.cx, f.cy]]), ok = false, i;
      for (i = 0; i < 2; i++) if (floor.cells[a[i][0] + ',' + a[i][1]]) ok = true;
      if (!ok) return 'floor';
      if (placing.fenceIndex(fences, f) >= 0) return 'dup';
      var L = G.base.layout, r = placing.fenceRect(f);
      if (overlap(r, { x: L.gate.x - 40, y: L.area.y - 20, w: L.gate.w + 80, h: 190 })) return 'gate';
      if (b && placing.treeIn(b, { x: r.x, y: r.y, w: r.w, h: r.h })) return 'tree';
      return null;
    },
    // Fence level (for the raid chance, js/defense.js) from how many pieces stand.
    fenceLevel: function (n) { return n >= 60 ? 4 : n >= 36 ? 3 : n >= 18 ? 2 : n >= 6 ? 1 : 0; },
    cleanFences: function (list) {
      var out = [], seen = {}, mats = G.data.fenceMaterials;
      if (!Array.isArray(list)) return out;
      for (var i = 0; i < list.length && out.length < placing.MAX_FENCES; i++) {
        var f = list[i];
        if (!f || !placing.fenceInRange(f)) continue;
        var n = { o: f.o, cx: f.cx, cy: f.cy, m: mats.hasOwnProperty(f.m) ? f.m : 'wood' }, k = placing.fenceKey(n);
        if (seen[k]) continue;
        seen[k] = true; out.push(n);
      }
      return out;
    },

    cellCount: function (floor) { return Object.keys(floor.cells).length; },

    cleanFloor: function (f) {
      var out = { cells: {} }, n = 0, mats = G.data.floorMaterials;
      if (!f || typeof f !== 'object' || f.cell !== CELL) return out;        // blocks of another size (an older version): dropped
      var cells = f.cells && typeof f.cells === 'object' ? f.cells : {};
      for (var k in cells) {
        var m = /^(\d{1,3}),(\d{1,3})$/.exec(k);
        if (!m || !mats.hasOwnProperty(cells[k]) || n >= MAX_CELLS || !placing.cellRect(+m[1], +m[2])) continue;
        out.cells[k] = cells[k]; n++;
      }
      return out;
    }
  };

  G.placing = placing;
})(typeof window !== 'undefined' ? window : globalThis);
