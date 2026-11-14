// World map rules: which destinations exist, how much energy a trip costs, what you can gather there.
// Pure logic (no DOM), unit-tested in Node. The numbers are in data/world.js.
(function (root) {
  'use strict';
  var G = root.G;

  function W() { return G.data.world; }

  var world = {
    ids: function () { return W().order.slice(); },
    has: function (id) { return !!W().destinations[id] && !!G.data.areas[id]; },
    get: function (id) { return W().destinations[id] || null; },
    name: function (id) { var a = G.data.areas[id]; return a ? a.name : id; },

    // Can the player get to `id`? G.data.storyAccess (story/data/triggers.js) lists the hard places and the vehicles that get you there (`by`).
    // how = 'ground' (a trip from the base; `ride` = the vehicle being ridden or null) or 'fly' (in the helicopter, which counts as 'heli' in `by`).
    // Places without a rule are open. Returns { ok: true } or { ok: false, deny: text for the map, by: [vehicle ids] }.
    access: function (id, how, ride) {
      var A = G.data.storyAccess, r = A && A[id];
      if (!r || !r.by) return { ok: true };
      var ok = how === 'fly' ? r.by.indexOf('heli') >= 0 : !!ride && ride !== 'heli' && r.by.indexOf(ride) >= 0;
      return ok ? { ok: true } : { ok: false, deny: r.deny || 'המקום הזה לא נגיש כרגע.', by: r.by.slice() };
    },
    // The helicopter cannot take off while the storm flag is set (G.data.storyAccess.stormNoFly).
    stormGrounded: function () {
      var A = G.data.storyAccess;
      return !!(A && A.stormNoFly && G.story && G.story.S && G.story.hasFlag('storm'));
    },

    // Energy spent on leaving for a destination (the way back is free). At least 1.
    cost: function (id, diff) {
      var d = W().destinations[id];
      if (!d) return 0;
      var base = W().energy.base + d.km * W().energy.perKm;
      return Math.max(1, Math.round(base * (diff ? diff.energy : 1)));
    },

    // Names of the main things you can gather there, most plentiful first (at most `max`).
    loot: function (id, max) {
      var a = G.data.areas[id], res = G.data.resources, items = G.data.items, score = {}, d = W().destinations[id];
      if (d && d.finds) return d.finds.slice(0, max || 3).map(function (k) { return items[k].name; });   // hand-written for built places
      if (!a || !a.spawns) return [];
      a.spawns.concat(a.loot || []).forEach(function (s) {
        var r = res[s.type];
        if (!r || r.item === undefined) return;
        score[r.item] = (score[r.item] || 0) + s.count * (r.yield[0] + r.yield[1]) / 2;
      });
      if (a.ponds && a.ponds.length) score.water_dirty = (score.water_dirty || 0) + a.ponds.length * 12;
      return Object.keys(score).sort(function (p, q) { return score[q] - score[p]; })
        .slice(0, max || 3).map(function (k) { return items[k].name; });
    }
  };

  G.world = world;
})(typeof window !== 'undefined' ? window : globalThis);
