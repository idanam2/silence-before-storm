// The player's base: layout, collision and the storage chest. Pure logic, tested in Node.
// Drawing lives in js/baseart.js.
(function (root) {
  'use strict';
  var G = root.G;

  var layout = {
    area:  { x: 800, y: 480, w: 1600, h: 1040 },   // fenced yard (4x the first version, same centre)
    gate:  { x: 1560, w: 90 },                     // the way in from the forest (north): placed things keep it open. No fence is built at the start
    chest: { x: 1770, y: 790, w: 52, h: 36 },       // the storage chest (the player can move it: setChest)
    spawn: { x: 1600, y: 1060 },
    trail: { x: 1605, y: 350, r: 74 },             // trailhead north of the gate: travel to the forest
    arrive: { x: 1605, y: 408 },                   // where the player stands when coming back
    interactRange: 36,                             // extra reach beyond the chest edge
    trees: { seed: 8121, count: 78, gap: 128, clear: 135, trunk: 22, borderStep: 84, borderDepth: 80, yard: 16, yardGap: 170 }
  };

  function rect(x, y, w, h, kind) { return { x: x, y: y, w: w, h: h, kind: kind }; }

  // Woods around the yard (same on every load). Kept clear of the fence and of the trail going north.
  function plantTrees(world) {
    var a = layout.area, tr = layout.trail, c = layout.trees, rand = G.util.rng(c.seed), out = [];
    function ok(x, y, gap) {
      if (x > a.x - c.clear && x < a.x + a.w + c.clear && y > a.y - c.clear && y < a.y + a.h + c.clear) return false;
      if (Math.abs(x - tr.x) < 150 && y < a.y) return false;
      for (var i = 0; i < out.length; i++) {
        var dx = out[i].x - x, dy = out[i].y - y;
        if (dx * dx + dy * dy < gap * gap) return false;
      }
      return true;
    }
    function add(x, y, border) {
      out.push({
        type: rand() < 0.62 ? 'pine' : 'oak', x: Math.round(x), y: Math.round(y), r: 16,
        canopy: 78 + rand() * 30, variant: Math.floor(rand() * 1000), phase: rand() * Math.PI * 2,
        border: border, dead: false, deadT: 0, fade: 1
      });
    }
    var x, y;
    for (x = 30; x < world.width; x += c.borderStep) {
      y = 14 + rand() * c.borderDepth; if (ok(x, y, 60)) add(x + rand() * 30, y, true);
      y = world.height - 14 - rand() * c.borderDepth; if (ok(x, y, 60)) add(x + rand() * 30, y, true);
    }
    for (y = 90; y < world.height - 60; y += c.borderStep) {
      x = 14 + rand() * c.borderDepth; if (ok(x, y, 60)) add(x, y + rand() * 30, true);
      x = world.width - 14 - rand() * c.borderDepth; if (ok(x, y, 60)) add(x, y + rand() * 30, true);
    }
    var placed = 0, tries = c.count * 60;
    while (placed < c.count && tries-- > 0) {
      x = 130 + rand() * (world.width - 260); y = 130 + rand() * (world.height - 260);
      if (!ok(x, y, c.gap)) continue;
      add(x, y, false); placed++;
    }
    // Trees standing inside the yard (the player fells them with the axe before laying floor there): away from the way in,
    // the first spot, the chest and the fixed building spots. They are added last, so the woods above keep their places.
    var yardTrees = 0, tries2 = c.yard * 80, avoid = [{ x: layout.spawn.x - 130, y: layout.spawn.y - 130, w: 260, h: 260 },
      { x: layout.gate.x - 130, y: a.y, w: layout.gate.w + 260, h: 320 }, { x: layout.chest.x - 110, y: layout.chest.y - 110, w: layout.chest.w + 220, h: layout.chest.h + 220 }];
    var bd = G.data && G.data.buildings;
    for (var id in bd) if (bd[id].spot) avoid.push({ x: bd[id].spot.x - 70, y: bd[id].spot.y - 70, w: bd[id].spot.w + 140, h: bd[id].spot.h + 140 });
    while (yardTrees < c.yard && tries2-- > 0) {
      x = a.x + 70 + rand() * (a.w - 140); y = a.y + 70 + rand() * (a.h - 140);
      var hit = false, q;
      for (q = 0; q < avoid.length && !hit; q++) hit = x > avoid[q].x && x < avoid[q].x + avoid[q].w && y > avoid[q].y && y < avoid[q].y + avoid[q].h;
      for (q = 0; q < out.length && !hit; q++) if (out[q].yard) hit = Math.hypot(out[q].x - x, out[q].y - y) < c.yardGap;
      if (hit) continue;
      add(x, y, false);
      var t = out[out.length - 1]; t.yard = true; t.amount = t.a0 = 4 + Math.floor(rand() * 3);
      yardTrees++;
    }
    return out;
  }

  function build(world) {
    var solids = [], W = world || G.config.world;
    solids.push(rect(layout.chest.x, layout.chest.y, layout.chest.w, layout.chest.h, 'chest'));
    var trees = plantTrees(W), s = layout.trees.trunk;
    for (var i = 0; i < trees.length; i++) { var tr = rect(trees[i].x - s / 2, trees[i].y - s / 2, s, s, 'trunk'); tr.tree = trees[i]; solids.push(tr); }
    // fixed = always there; solids = fixed + the structures the player has built (see setBuildings)
    return { layout: layout, fixed: solids, solids: solids.slice(), levels: {}, trees: trees, width: W.width, height: W.height };
  }

  // A garage is a room without a roof: three walls (north, west, east; the south side is the open door), a workbench along the back
  // wall and a floor you can drive onto. Its parts are separate rects with the garage's kind, so each can be drawn and sorted by itself:
  //   part 'room'  the whole footprint: not solid, only keeps the place reserved (hollow) and holds the floor
  //   part 'wall'  solid, drawn as a low wall (side walls come in short pieces so they sort correctly against people and vehicles)
  //   part 'bench' solid, the garage's own workbench (E opens its crafting panel)
  // Every part has ox, oy = the top-left corner of the whole garage, so a copy can be found again when it is moved.
  var WALL = 10, PIECE = 36, BENCH = { w: 78, h: 22 };
  function roomParts(p, d) {
    var w = d.spot.w, h = d.spot.h, out = [], y, n, k, bx = Math.min(BENCH.w, w - 2 * WALL - 40);
    function add(part, x, yy, ww, hh, extra) {
      var r = rect(x, yy, ww, hh, p.id); r.part = part; r.ox = p.x; r.oy = p.y;
      if (extra) for (var key in extra) r[key] = extra[key];
      out.push(r);
    }
    add('room', p.x, p.y, w, h, { hollow: true });
    add('wall', p.x, p.y, w, WALL, { noUse: true });
    n = Math.ceil((h - WALL) / PIECE);
    for (k = 0; k < n; k++) {
      y = p.y + WALL + k * ((h - WALL) / n);
      add('wall', p.x, y, WALL, (h - WALL) / n, { noUse: true, side: 'w', first: k === 0, last: k === n - 1 });
      add('wall', p.x + w - WALL, y, WALL, (h - WALL) / n, { noUse: true, side: 'e', first: k === 0, last: k === n - 1 });
    }
    add('bench', p.x + WALL + 6, p.y + WALL, bx, BENCH.h);
    return out;
  }

  // Applies the built structures ({ id: level }) to the base: built ones become solid rects.
  // `placed` = [{ id, x, y }] copies put down by the player (js/placing.js); without it every built structure sits on its old fixed spot.
  // `fences` = [{ o: 'h' | 'v', cx, cy, m: material }] pieces on the block grid (js/placing.js); `felled` = indices of yard trees that were cut down.
  function setBuildings(b, levels, placed, fences, felled) {
    var defs = G.data.buildings, i;
    var cut = {};
    for (i = 0; felled && i < felled.length; i++) cut[felled[i]] = true;
    for (i = 0; i < b.trees.length; i++) {                                    // yard trees: felled ones lie down, the others stand (a new game starts with all of them up)
      var yt = b.trees[i];
      if (!yt.yard) continue;
      if (cut[i]) { if (!yt.dead) { yt.dead = true; yt.deadT = 99; yt.amount = 0; } }
      else if (yt.dead && yt.deadT >= 99) { yt.dead = false; yt.deadT = 0; yt.amount = yt.a0; }
    }
    var s = b.fixed.filter(function (r) { return r.kind !== 'chest' && !(r.tree && r.tree.dead); });
    s.push(rect(layout.chest.x, layout.chest.y, layout.chest.w, layout.chest.h, 'chest'));
    b.levels = levels;
    placed = placed || G.placing.legacy(levels);
    for (i = 0; i < placed.length; i++) {
      var p = placed[i], d = defs[p.id];
      if (!d || !d.spot || !(levels[p.id] > 0)) continue;
      if (d.room) { roomParts(p, d).forEach(function (r) { r.level = levels[p.id]; s.push(r); }); continue; }
      var r = rect(p.x, p.y, d.spot.w, d.spot.h, p.id);
      r.level = levels[p.id];
      s.push(r);
    }
    for (i = 0; fences && i < fences.length; i++) { var fr = G.placing.fenceRect(fences[i]); fr.kind = 'fence'; fr.mat = fences[i].m; fr.piece = true; s.push(fr); }
    if (b.kennelOn) { s.push(rect(1960, 640, 96, 64, 'kennel')); s.push(rect(1978, 722, 40, 24, 'dogbowl')); }   // appear when the dog joins (js/companions.js)
    b.solids = s;
    return b;
  }

  // Rect of a structure you can use with E (chest, or a built workbench / campfire).
  function stationRect(b, id) {
    if (id === 'chest') return layout.chest;
    var d = G.data.buildings[id];
    return d && d.spot && b.levels[id] > 0 ? d.spot : null;
  }

  // Closest point on rect r to (px, py).
  function closest(r, px, py) {
    return {
      x: Math.max(r.x, Math.min(px, r.x + r.w)),
      y: Math.max(r.y, Math.min(py, r.y + r.h))
    };
  }

  // Pushes a circle out of every solid rect. Mutates p.x / p.y.
  function collide(p, solids) {
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < solids.length; i++) {
        var r = solids[i];
        if (r.hollow) continue;                                       // the inside of a garage: walk and drive in
        var c = closest(r, p.x, p.y);
        var dx = p.x - c.x, dy = p.y - c.y, d2 = dx * dx + dy * dy;
        if (d2 >= p.radius * p.radius) continue;
        if (d2 > 1e-9) {
          var d = Math.sqrt(d2), push = p.radius - d;
          p.x += (dx / d) * push; p.y += (dy / d) * push;
        } else {
          // center is inside the rect: leave through the nearest side
          var l = p.x - r.x, rt = r.x + r.w - p.x, t = p.y - r.y, b = r.y + r.h - p.y;
          var m = Math.min(l, rt, t, b);
          if (m === l) p.x = r.x - p.radius;
          else if (m === rt) p.x = r.x + r.w + p.radius;
          else if (m === t) p.y = r.y - p.radius;
          else p.y = r.y + r.h + p.radius;
        }
      }
    }
  }

  function nearChest(p) {
    var c = closest(layout.chest, p.x, p.y);
    var dx = p.x - c.x, dy = p.y - c.y;
    var reach = p.radius + layout.interactRange;
    return dx * dx + dy * dy <= reach * reach;
  }

  // Id of the closest usable structure within reach ('chest' | 'workbench' | 'campfire' | 'bed' | 'tank'), or null.
  function nearStation(p, b) {
    var defs = G.data.buildings, best = null, bestD = Infinity, reach = p.radius + layout.interactRange;
    var rs = [{ id: 'chest', r: layout.chest }], i;
    for (i = 0; i < b.solids.length; i++) {
      var k = b.solids[i].kind, d = defs[k];
      if (d && d.spot && (d.station || d.use) && !b.solids[i].hollow && !b.solids[i].noUse) rs.push({ id: k, r: b.solids[i] });
    }
    for (i = 0; i < rs.length; i++) {
      var c = closest(rs[i].r, p.x, p.y), dx = p.x - c.x, dy = p.y - c.y, d2 = dx * dx + dy * dy;
      if (d2 <= reach * reach && d2 < bestD) { best = rs[i].id; bestD = d2; }
    }
    return best;
  }

  function nearTrail(p) {
    var dx = p.x - layout.trail.x, dy = p.y - layout.trail.y;
    return dx * dx + dy * dy <= layout.trail.r * layout.trail.r;
  }

  var CHEST0 = { x: layout.chest.x, y: layout.chest.y };
  // Moves the chest (null = back to its first place). Call applyBuildings afterwards so the collision follows.
  function setChest(at) {
    var a = layout.area, t = 20, x = at ? at.x : CHEST0.x, y = at ? at.y : CHEST0.y;
    layout.chest.x = Math.max(a.x + t, Math.min(x, a.x + a.w - t - layout.chest.w));
    layout.chest.y = Math.max(a.y + t, Math.min(y, a.y + a.h - t - layout.chest.h));
  }

  G.base = {
    setChest: setChest,
    layout: layout, build: build, setBuildings: setBuildings, collide: collide,
    nearChest: nearChest, nearStation: nearStation, nearTrail: nearTrail
  };
})(typeof window !== 'undefined' ? window : globalThis);
