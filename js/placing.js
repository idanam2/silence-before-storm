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
  function snap(v) { return Math.round(v / GRID) * GRID; }
  function overlap(p, q) { return p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y; }

  function inner() {                                   // walkable inside of the fenced yard
    var a = G.base.layout.area, t = 12 + FENCE_GAP;
    return { x: a.x + t, y: a.y + t, w: a.w - 2 * t, h: a.h - 2 * t };
  }

  var placing = {
    GRID: GRID, CELL: CELL, MAX_EACH: MAX_EACH,
    isPlaceable: isPlaceable,
    size: size,

    // Centered on a world point, snapped to the grid, and kept inside the yard.
    rectAt: function (id, wx, wy) {
      var s = size(id), a = inner();
      var x = snap(wx - s.w / 2), y = snap(wy - s.h / 2);
      x = Math.max(a.x, Math.min(x, a.x + a.w - s.w)); y = Math.max(a.y, Math.min(y, a.y + a.h - s.h));
      return { x: x, y: y, w: s.w, h: s.h };
    },

    // Why a rect cannot hold a structure: 'gate' | 'blocked' | null (ok). `b` = built base (b.solids has the placed copies).
    // `ignore`: a solid object to leave out (a copy that is being moved).
    check: function (b, r, ignore) {
      var L = G.base.layout, a = L.area;
      if (overlap(r, { x: L.gate.x - 40, y: a.y, w: L.gate.w + 80, h: 170 })) return 'gate';          // the way in stays open
      var s = b.solids;
      for (var i = 0; i < s.length; i++) {
        if (s[i] === ignore || s[i].kind === 'trunk') continue;
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

    // Safe copy of a list from a save: known structures, numbers, inside the yard, at most MAX_EACH of a kind.
    clean: function (list, levels) {
      if (!Array.isArray(list)) return placing.legacy(levels);
      var out = [], n = {}, a = inner();
      for (var i = 0; i < list.length && i < 80; i++) {
        var p = list[i];
        if (!p || typeof p.id !== 'string' || !isPlaceable(p.id) || !isFinite(p.x) || !isFinite(p.y)) continue;
        if (levels && !(levels[p.id] > 0)) continue;
        n[p.id] = (n[p.id] || 0) + 1; if (n[p.id] > MAX_EACH) continue;
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
