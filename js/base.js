// The player's base: layout, collision and the storage chest. Pure logic, tested in Node.
// Drawing lives in js/baseart.js.
(function (root) {
  'use strict';
  var G = root.G;

  var T = 12; // fence thickness
  var layout = {
    area:  { x: 1200, y: 740, w: 800, h: 520 },   // fenced yard
    gate:  { x: 1560, w: 90 },                     // gap in the north fence (leads to the forest)
    cabin: { x: 1250, y: 780, w: 230, h: 130 },
    chest: { x: 1770, y: 790, w: 52, h: 36 },
    woodpile: { x: 1486, y: 800, w: 34, h: 82 },    // stacked against the cabin's east wall
    spawn: { x: 1600, y: 1060 },
    trail: { x: 1605, y: 610, r: 74 },             // trailhead north of the gate: travel to the forest
    arrive: { x: 1605, y: 668 },                   // where the player stands when coming back
    interactRange: 36,                             // extra reach beyond the chest edge
    trees: { seed: 8121, count: 78, gap: 128, clear: 135, trunk: 22, borderStep: 84, borderDepth: 80 }
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
    return out;
  }

  function build(world) {
    var a = layout.area, g = layout.gate, solids = [], W = world || G.config.world;
    solids.push(rect(a.x, a.y, g.x - a.x, T, 'fence'));                          // north-west
    solids.push(rect(g.x + g.w, a.y, a.x + a.w - (g.x + g.w), T, 'fence'));      // north-east
    solids.push(rect(a.x, a.y + a.h - T, a.w, T, 'fence'));                      // south
    solids.push(rect(a.x, a.y, T, a.h, 'fence'));                                // west
    solids.push(rect(a.x + a.w - T, a.y, T, a.h, 'fence'));                      // east
    solids.push(rect(layout.cabin.x, layout.cabin.y, layout.cabin.w, layout.cabin.h, 'cabin'));
    solids.push(rect(layout.chest.x, layout.chest.y, layout.chest.w, layout.chest.h, 'chest'));
    solids.push(rect(layout.woodpile.x, layout.woodpile.y, layout.woodpile.w, layout.woodpile.h, 'woodpile'));
    var trees = plantTrees(W), s = layout.trees.trunk;
    for (var i = 0; i < trees.length; i++) solids.push(rect(trees[i].x - s / 2, trees[i].y - s / 2, s, s, 'trunk'));
    // fixed = always there; solids = fixed + the structures the player has built (see setBuildings)
    return { layout: layout, fixed: solids, solids: solids.slice(), levels: {}, trees: trees, width: W.width, height: W.height };
  }

  // Applies the built structures ({ id: level }) to the base: built ones become solid rects.
  function setBuildings(b, levels) {
    var defs = G.data.buildings, s = b.fixed.slice();
    b.levels = levels;
    for (var id in defs) {
      var spot = defs[id].spot;
      if (!spot || !(levels[id] > 0)) continue;
      var r = rect(spot.x, spot.y, spot.w, spot.h, id);
      r.level = levels[id];
      s.push(r);
    }
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
        var r = solids[i], c = closest(r, p.x, p.y);
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
    for (var id in defs) {
      if (!defs[id].station && !defs[id].use) continue;
      var r = stationRect(b, id);
      if (!r) continue;
      var c = closest(r, p.x, p.y), dx = p.x - c.x, dy = p.y - c.y, d2 = dx * dx + dy * dy;
      if (d2 <= reach * reach && d2 < bestD) { best = id; bestD = d2; }
    }
    return best;
  }

  function nearTrail(p) {
    var dx = p.x - layout.trail.x, dy = p.y - layout.trail.y;
    return dx * dx + dy * dy <= layout.trail.r * layout.trail.r;
  }

  G.base = {
    layout: layout, build: build, setBuildings: setBuildings, collide: collide,
    nearChest: nearChest, nearStation: nearStation, nearTrail: nearTrail
  };
})(typeof window !== 'undefined' ? window : globalThis);
