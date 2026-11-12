// Rain tank: fills slowly over time, the player collects the water with E. Pure logic, unit-tested in Node.
// A tank state is plain JSON: { amount, t } (units stored, seconds since the last unit). Numbers per level are in
// data/buildings.js (levels[].tank = { cap, secs }). It produces clean water.
(function (root) {
  'use strict';
  var G = root.G;
  var ITEM = 'water_clean';

  function spec(level) {
    var lv = G.data.buildings.tank.levels[Math.max(1, level) - 1];
    return lv.tank;
  }

  var tank = {
    ITEM: ITEM,
    create: function () { return { amount: 0, t: 0 }; },
    // `count` = number of tanks standing in the yard: each adds its capacity and fills on its own.
    cap: function (level, count) { return level > 0 ? spec(level).cap * (count || 1) : 0; },

    // Time passes. level 0 = not built (nothing happens).
    step: function (tk, level, dt, count) {
      if (!(level > 0)) return tk;
      var n = Math.max(1, count || 1), s = { cap: spec(level).cap * n, secs: spec(level).secs / n };
      if (tk.amount >= s.cap) { tk.amount = s.cap; tk.t = 0; return tk; }
      tk.t += dt;
      while (tk.t >= s.secs && tk.amount < s.cap) { tk.t -= s.secs; tk.amount++; }
      if (tk.amount >= s.cap) tk.t = 0;
      return tk;
    },

    // Moves the stored water into the bag, then the chest. What does not fit stays in the tank.
    // Returns the number of units collected.
    take: function (tk, bag, chest, items) {
      var moved = 0;
      [bag, chest].forEach(function (inv) {
        var want = tk.amount - moved;
        if (want > 0) moved += want - G.inventory.add(inv, ITEM, want, items);
      });
      tk.amount -= moved;
      return moved;
    }
  };

  G.tank = tank;
})(typeof window !== 'undefined' ? window : globalThis);
