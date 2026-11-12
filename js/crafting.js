// Crafting and building rules. Pure logic (no DOM), unit-tested in Node.
// A "ctx" is { bag, chest, buildings } where buildings maps a structure id to its level (0 / missing = not built).
// Materials come from the backpack first, then from the chest. Every action is all-or-nothing.
(function (root) {
  'use strict';
  var G = root.G;

  function levelOf(ctx, id) { return (ctx.buildings && ctx.buildings[id]) || 0; }
  function invs(ctx) { return [ctx.bag, ctx.chest]; }

  function have(list, id) {
    var n = 0;
    for (var i = 0; i < list.length; i++) n += G.inventory.count(list[i], id);
    return n;
  }

  // { itemId: missingAmount } or null when the whole cost is covered.
  function missing(list, cost) {
    var m = null;
    for (var id in cost) {
      var lack = cost[id] - have(list, id);
      if (lack > 0) { m = m || {}; m[id] = lack; }
    }
    return m;
  }

  function snapshot(list) {
    return list.map(function (inv) { return inv.slots.map(function (s) { return s ? { id: s.id, n: s.n } : null; }); });
  }
  function restore(list, snap) { for (var i = 0; i < list.length; i++) list[i].slots = snap[i]; }

  function pay(list, cost) {
    for (var id in cost) {
      var need = cost[id];
      for (var i = 0; i < list.length && need > 0; i++) need -= G.inventory.remove(list[i], id, need);
    }
  }

  function recipeById(id) {
    var r = G.data.recipes;
    for (var i = 0; i < r.length; i++) if (r[i].id === id) return r[i];
    return null;
  }

  var crafting = {
    levelOf: levelOf,
    have: function (ctx, id) { return have(invs(ctx), id); },
    recipe: recipeById,

    // Recipes of one station, in data order; with a category id (not 'all') only that tab's recipes.
    recipesFor: function (station, cat) {
      return G.data.recipes.filter(function (r) { return r.station === station && (!cat || cat === 'all' || r.cat === cat); });
    },

    // Why a recipe cannot be crafted right now: 'station' | 'level' | 'cost' | null (ok).
    // Free space for the result is only checked when crafting (it depends on the order of operations).
    recipeStatus: function (ctx, r) {
      var lv = levelOf(ctx, r.station);
      if (lv < 1) return 'station';
      if (lv < r.level) return 'level';
      if (missing(invs(ctx), r.cost)) return 'cost';
      return null;
    },

    craft: function (ctx, recipeId) {
      var r = recipeById(recipeId);
      if (!r) return { ok: false, reason: 'unknown' };
      var why = crafting.recipeStatus(ctx, r);
      if (why) return { ok: false, reason: why };
      var list = invs(ctx), snap = snapshot(list);
      pay(list, r.cost);
      var left = r.out[1];
      for (var i = 0; i < list.length && left > 0; i++) left = G.inventory.add(list[i], r.out[0], left);
      if (left > 0) { restore(list, snap); return { ok: false, reason: 'space' }; }
      return { ok: true, out: r.out };
    },

    // Level a structure would get next, or 0 when it is already at the top.
    nextLevel: function (ctx, id) {
      var d = G.data.buildings[id];
      var cur = levelOf(ctx, id);
      return d && cur < d.levels.length ? cur + 1 : 0;
    },
    // The fence is priced in the material the player chose (ctx.fence.material, see G.data.fenceMaterials).
    buildCost: function (ctx, id) {
      var next = crafting.nextLevel(ctx, id);
      if (!next) return null;
      var cost = G.data.buildings[id].levels[next - 1].cost;
      var m = id === 'fence' && ctx.fence && G.data.fenceMaterials[ctx.fence.material];
      if (!m) return cost;
      var out = {};
      for (var it in cost) {
        var to = m.swap[it] || it, n = m.half && to !== it ? Math.ceil(cost[it] / 2) : cost[it];
        out[to] = (out[to] || 0) + n;
      }
      return out;
    },

    // 'max' | 'cost' | null (ok).
    buildStatus: function (ctx, id) {
      var cost = crafting.buildCost(ctx, id);
      if (!cost) return 'max';
      return missing(invs(ctx), cost) ? 'cost' : null;
    },

    // Builds a structure or upgrades it by one level.
    build: function (ctx, id) {
      if (!G.data.buildings[id]) return { ok: false, reason: 'unknown' };
      var why = crafting.buildStatus(ctx, id);
      if (why) return { ok: false, reason: why };
      var level = crafting.nextLevel(ctx, id);
      pay(invs(ctx), crafting.buildCost(ctx, id));
      ctx.buildings[id] = level;
      return { ok: true, level: level };
    },

    // ---- free placement (see js/placing.js): the first copy of a structure costs level 1 and sets the level, more copies cost
    // the same again. Paid when the copy is put down. 'max' | 'cost' | null.
    placeStatus: function (ctx, id) {
      var d = G.data.buildings[id];
      if (!d || !d.spot) return 'unknown';
      if (ctx.placed && G.placing.count(ctx.placed, id) >= G.placing.MAX_EACH) return 'max';
      return missing(invs(ctx), d.levels[0].cost) ? 'cost' : null;
    },
    place: function (ctx, id) {
      var why = crafting.placeStatus(ctx, id);
      if (why) return { ok: false, reason: why };
      pay(invs(ctx), G.data.buildings[id].levels[0].cost);
      if (levelOf(ctx, id) < 1) ctx.buildings[id] = 1;
      return { ok: true };
    },
    // Takes / returns a cost (floor blocks). spend: null when paid, else 'cost'. refund: bag first, then chest, lost if full.
    spend: function (ctx, cost) { if (missing(invs(ctx), cost)) return 'cost'; pay(invs(ctx), cost); return null; },
    refund: function (ctx, cost) {
      for (var id in cost) { var left = cost[id]; for (var i = 0; i < 2 && left > 0; i++) left = G.inventory.add(invs(ctx)[i], id, left); }
    },

    chestSlots: function (buildings) {
      var d = G.data.buildings.chest, lv = Math.max(1, (buildings && buildings.chest) || 1);
      return d.levels[lv - 1].chestSlots;
    },

    // Backpack size for the bag level (building 'bag'); never below the starting size.
    bagSlots: function (buildings) {
      var d = G.data.buildings.bag, lv = Math.min(d.levels.length, Math.max(1, (buildings && buildings.bag) || 1));
      return Math.max(G.data.inventory.bagSlots, d.levels[lv - 1].bagSlots);
    },

    startBuildings: function () {
      var out = {}, defs = G.data.buildings;
      for (var id in defs) out[id] = defs[id].start;
      return out;
    }
  };

  G.crafting = crafting;
})(typeof window !== 'undefined' ? window : globalThis);
