// Gathering areas (the forest): seeded generation, collision, targeting and gathering.
// Pure logic, no DOM, so it is unit-tested in Node. Drawing lives in js/forestart.js.
(function (root) {
  'use strict';
  var G = root.G;
  var TAU = Math.PI * 2;
  var HIT = 0.42;              // seconds between two "hits" while gathering (drives fx, later sound)

  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }

  function segDist(px, py, ax, ay, bx, by) {
    var vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
    var t = l2 ? ((px - ax) * vx + (py - ay) * vy) / l2 : 0;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return dist(px, py, ax + vx * t, ay + vy * t);
  }

  function pathDist(paths, x, y) {
    var best = Infinity;
    for (var i = 0; i < paths.length; i++) {
      for (var j = 0; j < paths[i].length - 1; j++) {
        var a = paths[i][j], b = paths[i][j + 1];
        var d = segDist(x, y, a[0], a[1], b[0], b[1]);
        if (d < best) best = d;
      }
    }
    return best;
  }

  // True when (x, y) is in a pond, or closer than `pad` to its shore.
  function inWater(area, x, y, pad) {
    for (var i = 0; i < area.ponds.length; i++) {
      var bl = area.ponds[i].blobs;
      for (var j = 0; j < bl.length; j++) if (dist(x, y, bl[j].x, bl[j].y) < bl[j].r + (pad || 0)) return true;
    }
    return false;
  }

  // Builds an area instance from its data definition. Terrain (trees, boulders, ponds) depends only
  // on def.seed; loose resources are re-rolled per visit.
  function generate(def, resDefs, visit) {
    var rT = G.util.rng(def.seed), rR = G.util.rng(def.seed * 31 + (visit || 0) * 977 + 5);
    var A = {
      id: def.id, name: def.name, width: def.width, height: def.height,
      exit: def.exit, spawn: def.spawn, paths: def.paths, reach: def.reach, theme: def.theme,
      ponds: [], nodes: [], visit: visit || 0
    };
    var i, k;

    for (i = 0; i < def.ponds.length; i++) {
      var pd = def.ponds[i], blobs = [{ x: pd.x, y: pd.y, r: pd.r }], nb = 3 + Math.floor(rT() * 2);
      for (k = 0; k < nb; k++) {
        var pa = rT() * TAU, pr = pd.r * (0.45 + rT() * 0.25), pdist = pd.r * (0.55 + rT() * 0.3);
        blobs.push({ x: Math.round(pd.x + Math.cos(pa) * pdist), y: Math.round(pd.y + Math.sin(pa) * pdist), r: Math.round(pr) });
      }
      A.ponds.push({ type: 'water', isPond: true, x: pd.x, y: pd.y, r: pd.r, blobs: blobs, amount: Infinity, phase: rT() * TAU });
    }

    function makeNode(type, x, y, rand) {
      var d = resDefs[type];
      var scale = d.scale ? d.scale[0] + rand() * (d.scale[1] - d.scale[0]) : 1;
      var n = {
        id: A.nodes.length, type: type, x: Math.round(x), y: Math.round(y),
        r: d.r * scale, solid: (d.solid || 0) * scale, scale: scale,
        amount: d.yield[0] + Math.floor(rand() * (d.yield[1] - d.yield[0] + 1)),
        variant: Math.floor(rand() * 1000), phase: rand() * TAU,
        border: false, dead: false, deadT: 0, fade: 1
      };
      n.a0 = n.amount;                      // amount when generated: lets the save store only what changed
      if (d.canopy) n.canopy = d.canopy[0] + rand() * (d.canopy[1] - d.canopy[0]);
      A.nodes.push(n);
      return n;
    }

    // wall of trees around the map (not harvestable), open where the trail leaves
    var B = def.border, kinds = (B && B.kinds) || ['pine', 'pine', 'oak'];
    function borderTree(x, y) {
      if (dist(x, y, def.exit.x, def.height) < B.gap && y > def.height - 260) return;
      makeNode(kinds[Math.floor(rT() * kinds.length)], x, y, rT).border = true;
    }
    if (B) {                                // border: null = open edge
      for (var bx = 30; bx < def.width; bx += B.step) {
        borderTree(bx + rT() * 30, 14 + rT() * B.depth);
        borderTree(bx + rT() * 30, def.height - 14 - rT() * B.depth);
      }
      for (var by = 90; by < def.height - 60; by += B.step) {
        borderTree(14 + rT() * B.depth, by + rT() * 30);
        borderTree(def.width - 14 - rT() * B.depth, by + rT() * 30);
      }
    }

    function free(d, x, y, gap) {
      var m = def.margin, big = !!(d.tree || d.solid);
      if (x < m || y < m || x > def.width - m || y > def.height - m) return false;
      if (inWater(A, x, y, d.r + 24)) return false;
      if (dist(x, y, def.exit.x, def.exit.y) < def.exit.r + d.r + 30) return false;
      if (big && dist(x, y, def.spawn.x, def.spawn.y) < def.clearing) return false;
      if (big && pathDist(def.paths, x, y) < 80) return false;
      for (var j = 0; j < A.nodes.length; j++) {
        var e = A.nodes[j], need = (d.tree && e.canopy) ? gap : d.r + e.r + 12;
        if (dist(x, y, e.x, e.y) < need) return false;
      }
      return true;
    }

    var trees = [];
    for (i = 0; i < def.spawns.length; i++) {
      var sp = def.spawns[i], d = resDefs[sp.type], rand = sp.terrain ? rT : rR;
      var placed = 0, tries = sp.count * 60;
      while (placed < sp.count && tries-- > 0) {
        var x, y;
        if (sp.nearTree && trees.length) {
          var t = trees[Math.floor(rand() * trees.length)], a = rand() * TAU, dd = t.canopy * (0.7 + rand() * 0.6);
          x = t.x + Math.cos(a) * dd; y = t.y + Math.sin(a) * dd;
        } else {
          x = def.margin + rand() * (def.width - def.margin * 2);
          y = def.margin + rand() * (def.height - def.margin * 2);
          if (sp.grove) {           // smooth density field: groves and clearings instead of even noise
            var dens = 0.5 + 0.5 * Math.sin(x * 0.0023 + 1.3) * Math.cos(y * 0.0029 + 0.4);
            if (rand() > 0.22 + 0.78 * dens) continue;
          }
        }
        if (!free(d, x, y, sp.gap)) continue;
        var n = makeNode(sp.type, x, y, rand);
        if (d.tree) trees.push(n);
        placed++;
      }
    }
    return A;
  }

  function pushCircle(p, x, y, r) {
    var dx = p.x - x, dy = p.y - y, need = r + p.radius, d2 = dx * dx + dy * dy;
    if (d2 >= need * need) return;
    var d = Math.sqrt(d2);
    if (d < 1e-6) { dx = 0; dy = 1; d = 1; }
    p.x = x + (dx / d) * need; p.y = y + (dy / d) * need;
  }

  // Pushes the player out of trunks, boulders and water. Mutates p.x / p.y.
  function collide(p, area) {
    for (var pass = 0; pass < 2; pass++) {
      var i, j;
      for (i = 0; i < area.nodes.length; i++) {
        var n = area.nodes[i];
        if (n.solid && !n.dead) pushCircle(p, n.x, n.y, n.solid);
      }
      for (i = 0; i < area.ponds.length; i++) {
        var bl = area.ponds[i].blobs;
        for (j = 0; j < bl.length; j++) pushCircle(p, bl[j].x, bl[j].y, bl[j].r - 8);
      }
    }
  }

  // What the player can interact with right now: the exit, the nearest node, or the water. Or null.
  function findTarget(area, p) {
    var ex = area.exit;
    if (dist(p.x, p.y, ex.x, ex.y) <= ex.r) return { kind: 'exit', node: null, x: ex.x, y: ex.y, r: ex.r };
    var best = null, bestD = area.reach, i, j, d;
    for (i = 0; i < area.nodes.length; i++) {
      var n = area.nodes[i];
      if (n.dead || n.border) continue;
      d = dist(p.x, p.y, n.x, n.y) - n.r - p.radius;
      if (d <= bestD) { bestD = d; best = { kind: 'node', node: n, x: n.x, y: n.y, r: n.r }; }
    }
    for (i = 0; i < area.ponds.length; i++) {
      var bl = area.ponds[i].blobs;
      for (j = 0; j < bl.length; j++) {
        var c = dist(p.x, p.y, bl[j].x, bl[j].y);
        d = c - bl[j].r - p.radius;
        if (d <= bestD && c > 1) {
          bestD = d;
          var k = (bl[j].r - 14) / c;
          best = { kind: 'water', node: area.ponds[i], x: bl[j].x + (p.x - bl[j].x) * k, y: bl[j].y + (p.y - bl[j].y) * k, r: 16 };
        }
      }
    }
    return best;
  }

  // null when gathering is possible, otherwise the reason: 'tool' | 'full'.
  function check(target, bag, resDefs, items) {
    var d = resDefs[target.node.type];
    if (d.tool && G.inventory.count(bag, d.tool) === 0) return 'tool';
    if (G.inventory.space(bag, d.item, items) === 0) return 'full';
    return null;
  }

  // Moves the node's yield into the bag. What does not fit stays on the node (nothing is lost).
  function harvest(node, bag, resDefs, items) {
    var d = resDefs[node.type];
    var n = d.infinite ? d.yield[0] : node.amount;
    var left = G.inventory.add(bag, d.item, n, items);
    if (!d.infinite) {
      node.amount = left;
      if (left === 0) { node.dead = true; node.deadT = 0; }
    }
    return { item: d.item, gained: n - left, left: left, fx: d.fx };
  }

  // What the player changed in a visit, as [[nodeIndex, amountLeft], ...] (0 = used up). Node order is
  // deterministic for a given area + visit, so the save only needs this list to restore the area.
  function delta(area) {
    var out = [];
    for (var i = 0; i < area.nodes.length; i++) {
      var n = area.nodes[i];
      if (n.dead || n.amount !== n.a0) out.push([i, n.dead ? 0 : n.amount]);
    }
    return out;
  }

  function applyDelta(area, list) {
    for (var k = 0; k < list.length; k++) {
      var n = area.nodes[list[k][0]];
      if (!n || n.border) continue;
      n.amount = list[k][1];
      if (n.amount <= 0) { n.amount = 0; n.dead = true; n.deadT = 9; }   // deadT 9: the fall animation is over
    }
    return area;
  }

  function newGather() { return { node: null, t: 0, time: 0 }; }

  // One simulation step of "hold E to gather". g is mutated. Returns what happened this step.
  function gatherStep(g, target, held, dt, bag, resDefs, items) {
    var out = { active: false, hit: false, done: null, blocked: null };
    if (!held || !target || target.kind === 'exit') { g.node = null; g.t = 0; return out; }
    if (g.node !== target.node) { g.node = target.node; g.t = 0; }
    var d = resDefs[target.node.type];
    g.time = d.time;
    out.blocked = check(target, bag, resDefs, items);
    if (out.blocked) { g.t = 0; return out; }
    var before = Math.floor(g.t / HIT);
    g.t += dt;
    out.active = true;
    out.hit = Math.floor(g.t / HIT) > before;
    if (g.t >= d.time - 1e-9) {
      out.done = harvest(target.node, bag, resDefs, items);
      out.hit = true;
      g.t = 0;
    }
    return out;
  }

  // Cosmetic per-node state: crowns fade while the player walks under them, felled trees fall.
  function updateVisuals(area, p, dt) {
    var k = 1 - Math.exp(-7 * dt);
    for (var i = 0; i < area.nodes.length; i++) {
      var n = area.nodes[i];
      if (n.dead) n.deadT += dt;
      if (n.canopy) {
        // the crown is drawn a little north of the roots (see forestart.js), so test against that spot
        var want = dist(p.x, p.y, n.x, n.y - n.canopy * 0.3) < n.canopy * 0.86 + 8 ? 0.26 : 1;
        n.fade += (want - n.fade) * k;
      }
    }
  }

  G.area = {
    HIT: HIT, generate: generate, collide: collide, findTarget: findTarget, check: check,
    harvest: harvest, newGather: newGather, gatherStep: gatherStep, updateVisuals: updateVisuals,
    delta: delta, applyDelta: applyDelta,
    inWater: inWater, pathDist: pathDist
  };
})(typeof window !== 'undefined' ? window : globalThis);
