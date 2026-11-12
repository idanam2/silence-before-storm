// Fighting rules: what a blow or a shot hits, line of sight, noise, holding weapons, losing them on death.
// Pure logic (no DOM), unit-tested in Node. Numbers live in data/weapons.js; the infected themselves are in js/enemies.js.
(function (root) {
  'use strict';
  var G = root.G, TAU = Math.PI * 2;
  var STEP = 12;                                       // px between samples when walking a ray

  // Solid things that are low enough to see and shoot over (still stop a walker).
  var SOFT = { furn: 1, bollard: 1, lamp: 1, fence: 1, sandbags: 1, barrier: 1, vending: 1, pile: 1, boat: 1, car: 1 };

  function angDiff(a, b) { var d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
  function alive(e) { return e.state !== 'dying' && e.state !== 'dead'; }

  // Trunks and boulders (the nodes that are solid), found once per area.
  function solidNodes(area) {
    if (!area.sn) {
      area.sn = [];
      for (var i = 0; i < area.nodes.length; i++) if (area.nodes[i].solid > 0) area.sn.push(area.nodes[i]);
    }
    return area.sn;
  }

  // Does a wall, building or trunk stand at this point (for sight and bullets)?
  function blocked(area, x, y) {
    var s = area.solids, i;
    if (s) for (i = 0; i < s.length; i++) {
      var r = s[i];
      if (!SOFT[r.kind] && x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true;
    }
    var n = solidNodes(area);
    for (i = 0; i < n.length; i++) {
      var nd = n[i];
      if (nd.dead) continue;
      var dx = x - nd.x, dy = y - nd.y;
      if (dx * dx + dy * dy < nd.solid * nd.solid) return true;
    }
    return false;
  }

  // Distance a ray from (x, y) at angle a travels before it hits something solid (at most maxD).
  function rayBlock(area, x, y, a, maxD) {
    var c = Math.cos(a), s = Math.sin(a);
    for (var d = STEP; d <= maxD; d += STEP) {
      var px = x + c * d, py = y + s * d;
      if (px < 0 || py < 0 || px > area.width || py > area.height) return d - STEP / 2;
      if (blocked(area, px, py)) return d - STEP / 2;
    }
    return maxD;
  }

  // Free line between two points (nothing solid in the way).
  function clear(area, x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0, d = Math.sqrt(dx * dx + dy * dy);
    if (d < STEP) return true;
    return rayBlock(area, x0, y0, Math.atan2(dy, dx), d) >= d - 1;
  }

  var combat = {
    angDiff: angDiff, blocked: blocked, rayBlock: rayBlock, clear: clear, alive: alive,

    weapon: function (id) { return G.data.weapons[id] || null; },

    // Can this be held right now? (hands always, the rest only with the item in the backpack)
    canHold: function (bag, id) {
      var w = G.data.weapons[id];
      return !!w && (!w.item || G.inventory.count(bag, w.item) > 0);
    },

    // Which enemies a melee blow reaches: in front of the player, within reach, with a free line. Nearest first.
    meleeTargets: function (area, p, w, enemies) {
      var out = [], i;
      for (i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        if (!alive(e)) continue;
        var dx = e.x - p.x, dy = e.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d > w.range + e.radius) continue;
        if (d > e.radius + 14 && Math.abs(angDiff(Math.atan2(dy, dx), p.angle)) > w.arc / 2) continue;
        if (!clear(area, p.x, p.y, e.x, e.y)) continue;
        out.push({ e: e, d: d });
      }
      out.sort(function (a, b) { return a.d - b.d; });
      return out.slice(0, w.targets || 1).map(function (o) { return o.e; });
    },

    // A shot from the player along `angle` (plus spread): the first enemy it reaches before a wall, or none.
    // A weapon with `pierce` n goes on through up to n enemies (hits lists them, nearest first).
    // Returns { enemy, hits: [{ enemy, x, y }], dist, x, y, a, wall } where (x, y) is the point where the bullet ends.
    shoot: function (area, p, w, enemies, spread) {
      var a = p.angle + (spread || 0), c = Math.cos(a), s = Math.sin(a), i, cands = [];
      var limit = rayBlock(area, p.x, p.y, a, w.range), pierce = w.pierce || 1;
      var aim = w.aim || { mult: 0.95, add: 0, grow: 0 };           // forgiving: the hit zone is wider than the body, and widens with distance
      for (i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        if (!alive(e)) continue;
        var dx = e.x - p.x, dy = e.y - p.y, t = dx * c + dy * s;
        if (t < -e.radius || t > limit + e.radius) continue;
        var perp = Math.abs(-dx * s + dy * c), r = e.radius * aim.mult + aim.add + Math.max(0, t) * aim.grow;
        if (perp > r) continue;
        var tin = Math.max(0, t - Math.sqrt(r * r - perp * perp));
        if (tin >= limit) continue;
        // the tracer ends near the body, not at the edge of the wide zone
        cands.push({ e: e, tin: tin, end: Math.min(limit, Math.max(tin, t - e.radius * 0.4)) });
      }
      cands.sort(function (m, n) { return m.tin - n.tin; });
      var hits = cands.slice(0, pierce).map(function (m) { return { enemy: m.e, x: p.x + c * m.end, y: p.y + s * m.end }; });
      var best = hits.length ? hits[0].enemy : null;
      var end = limit;
      if (hits.length && (pierce === 1 || hits.length >= pierce)) end = cands[hits.length - 1].end;   // stopped by the last one it may go through
      return { enemy: best, hits: hits, dist: end, x: p.x + c * end, y: p.y + s * end, a: a, wall: !best && limit < w.range };
    },

    // ---- the pistol: magazine and wear (state: { mag, shots, life }) -----------------------------------------------
    // A new pistol breaks after about w.life shots (each one a little different), so the shots are counted per pistol.
    newGun: function (w, rand, loaded) {
      var f = 1 + ((rand ? rand() : 0.5) * 2 - 1) * w.lifeVar;
      return { mag: loaded ? w.mag : 0, shots: 0, life: Math.max(20, Math.round(w.life * f)) };
    },
    gunCondition: function (g) { return g ? Math.max(0, 1 - g.shots / g.life) : 0; },     // 1 = new, 0 = about to break
    // Pulls the trigger once: 'empty' (nothing happens), 'ok', or 'broke' (that was the last shot this pistol had).
    gunFire: function (g) {
      if (g.mag <= 0) return 'empty';
      g.mag--; g.shots++;
      return g.shots >= g.life ? 'broke' : 'ok';
    },
    // Rounds that a reload would move from the backpack into the magazine right now.
    gunRoom: function (g, w, bag) { return Math.max(0, Math.min(w.mag - g.mag, G.inventory.count(bag, w.ammo))); },
    gunLoad: function (g, w, bag) {
      var n = combat.gunRoom(g, w, bag);
      if (n > 0) { G.inventory.remove(bag, w.ammo, n); g.mag += n; }
      return n;
    },
    // A broken pistol: the rounds in it go back into the backpack as far as they fit. Returns how many were saved.
    gunBreak: function (g, w, bag) {
      var back = Math.min(g.mag, G.inventory.space(bag, w.ammo, G.data.items));
      if (back > 0) G.inventory.add(bag, w.ammo, back, G.data.items);
      return back;
    },
    // How wide a shot is: worn-out pistols are less accurate (up to +wearSpread times the base spread).
    gunSpread: function (g, w) { return w.spread * (1 + w.wearSpread * (1 - combat.gunCondition(g))); },
    gunClean: function (o, w) {                                    // a save's gun, made safe (or null = no pistol state yet)
      if (!o || typeof o !== 'object') return null;
      var life = Math.floor(o.life), shots = Math.floor(o.shots), mag = Math.floor(o.mag);
      if (!isFinite(life) || !isFinite(shots) || !isFinite(mag) || life < 1) return null;
      return { mag: Math.max(0, Math.min(w.mag, mag)), shots: Math.max(0, Math.min(life - 1, shots)), life: Math.min(life, w.life * 3) };
    },

    // ---- melee wear (axe, club, pickaxe) ----------------------------------------------------------------------
    // Two plain maps in the game state (both { weaponId: integer }, saved as they are):
    //   wear = blows that LANDED on an enemy so far, life = how many this very tool can take (rolled once, +-lifeVar).
    // Swings in the air do not count. Hands (shove) and guns have no melee wear.
    wears: function (w) { return !!w && w.kind === 'melee' && w.life > 0; },
    newWearLife: function (w, rand) {
      var f = 1 + ((rand ? rand() : 0.5) * 2 - 1) * (w.lifeVar || 0);
      return Math.max(10, Math.round(w.life * f));
    },
    // 1 = new, 0 = about to break (a tool whose life was not rolled yet counts as new).
    meleeCondition: function (wear, life, w) {
      if (!w || !combat.wears(w)) return 1;
      var l = life && life[w.id];
      if (!(l > 0)) return 1;
      return Math.max(0, Math.min(1, 1 - ((wear && wear[w.id]) || 0) / l));
    },
    // Damage multiplier of a worn tool: full above 30% condition, then linearly down to -25% at 0.
    wearDamageMult: function (cond) {
      var cfg = G.data.wear || { from: 0.3, loss: 0.25 };
      if (cond >= cfg.from) return 1;
      return 1 - cfg.loss * (1 - Math.max(0, cond) / cfg.from);
    },
    // A blow of tool `w` landed on an enemy: counts it. Returns 'ok', or 'broke' (that was the last blow it had: both
    // entries are removed, so the next one of this kind starts fresh), or 'none' (this weapon does not wear).
    meleeWear: function (wear, life, w, rand) {
      if (!combat.wears(w)) return 'none';
      if (!(life[w.id] > 0)) life[w.id] = combat.newWearLife(w, rand);
      wear[w.id] = Math.floor(wear[w.id] || 0) + 1;
      if (wear[w.id] >= life[w.id]) { delete wear[w.id]; delete life[w.id]; return 'broke'; }
      return 'ok';
    },
    // Forgets the wear of tools that are nowhere any more. count(itemId) = how many of the item the player owns.
    wearPrune: function (wear, life, count) {
      var W = G.data.weapons, id;
      for (id in wear) if (!W[id] || !W[id].item || count(W[id].item) <= 0) delete wear[id];
      for (id in life) if (!W[id] || !W[id].item || count(W[id].item) <= 0) delete life[id];
    },
    // A save's wear maps made safe: only melee tools, integers, wear below life. Returns { wear, life }.
    wearClean: function (o, l) {
      var W = G.data.weapons, out = { wear: {}, life: {} }, id;
      if (!o || typeof o !== 'object') o = {};
      if (!l || typeof l !== 'object') l = {};
      for (id in l) {
        var v = Math.floor(l[id]);
        if (W[id] && combat.wears(W[id]) && isFinite(v) && v >= 1) out.life[id] = Math.min(v, W[id].life * 3);
      }
      for (id in o) {
        var n = Math.floor(o[id]);
        if (out.life[id] && isFinite(n) && n >= 0) out.wear[id] = Math.min(n, out.life[id] - 1);
      }
      return out;
    },

    // ---- noise: what the infected can hear -----------------------------------------------------------
    newBurst: function () { return { r: 0, t: 0 }; },
    addBurst: function (b, r) {
      if (b.t <= 0 || r >= b.r) b.r = r;
      b.t = G.data.noise.burstSeconds;
    },
    stepBurst: function (b, dt) { if (b.t > 0) { b.t -= dt; if (b.t <= 0) { b.t = 0; b.r = 0; } } },
    // The radius within which the infected hear the player right now (movement noise, or a burst if louder).
    noiseRadius: function (p, b) {
      var N = G.data.noise, base = p.running ? N.run : (p.moving ? N.walk : 0);
      return Math.max(base, b && b.t > 0 ? b.r : 0);
    },

    // ---- dying -----------------------------------------------------------------------------------------
    // Death loss with the held weapon kept (unless the difficulty also takes weapons). Returns the lost [id, n] pairs.
    deathLoss: function (bag, diff, heldId) {
      var w = G.data.weapons[heldId], keep = null;
      if (w && w.item && !diff.loseWeapons && G.inventory.count(bag, w.item) > 0) { G.inventory.remove(bag, w.item, 1); keep = w.item; }
      var lost = G.needs.deathLoss(bag, diff);
      if (keep) G.inventory.add(bag, keep, 1);
      return lost;
    }
  };

  G.combat = combat;
})(typeof window !== 'undefined' ? window : globalThis);
