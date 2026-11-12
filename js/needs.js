// The four needs (health, hunger, thirst, energy): drain, using items, sleeping, fainting.
// Pure logic (no DOM), unit-tested in Node. Numbers live in data/needs.js, data/difficulty.js and data/items.js.
// A needs object is plain JSON: { health, hunger, thirst, energy }, each 0..100 (100 = full / rested).
(function (root) {
  'use strict';
  var G = root.G;

  function D() { return G.data.needs; }
  function clamp(v) { return v < 0 ? 0 : (v > D().max ? D().max : v); }

  var needs = {
    create: function () {
      var s = D().start, o = {};
      D().order.forEach(function (k) { o[k] = s[k]; });
      return o;
    },

    // One simulation step. act: { moving, running, gathering }. diff: a level from data/difficulty.js.
    // Returns the health lost to starvation this step (the caller checks health <= 0).
    drain: function (n, dt, act, diff) {
      var d = D(), e = d.energyUse;
      n.hunger = clamp(n.hunger - d.drain.hunger * diff.hunger * dt);
      n.thirst = clamp(n.thirst - d.drain.thirst * diff.thirst * dt);
      var use = act.gathering ? e.gather : (act.running ? e.run : (act.moving ? e.walk : 0));
      n.energy = clamp(n.energy - use * diff.energy * dt);

      var lost = 0;
      if (n.hunger <= 0) lost += d.starve.hunger * dt;
      if (n.thirst <= 0) lost += d.starve.thirst * dt;
      if (lost > 0) lost = needs.hurt(n, lost, diff);
      else if (n.hunger >= d.regen.minHunger && n.thirst >= d.regen.minThirst) n.health = clamp(n.health + d.regen.rate * dt);
      return lost;
    },

    // Damage from any source, scaled by the difficulty. Returns the damage actually taken.
    hurt: function (n, amount, diff) {
      var dealt = amount * (diff ? diff.damage : 1), before = n.health;
      n.health = clamp(n.health - dealt);
      return before - n.health;
    },

    isExhausted: function (n) { return n.energy < D().exhausted.below; },
    speedMult: function (n) { return needs.isExhausted(n) ? D().exhausted.speed : 1; },
    gatherMult: function (n) { return needs.isExhausted(n) ? D().exhausted.gather : 1; },
    attackMult: function (n) { return needs.isExhausted(n) ? D().exhausted.attack : 1; },
    // Energy spent on a swing or a shot (scaled by the difficulty, never below 0).
    spend: function (n, amount, diff) { n.energy = clamp(n.energy - amount * (diff ? diff.energy : 1)); },
    canRun: function (n) { return !needs.isExhausted(n); },
    isLow: function (n, key) { return n[key] < D().low; },

    // What stops the player from using an item: null (ok) | 'nouse' (not usable) | 'full' (would change nothing).
    usable: function (n, def) {
      var u = def && def.use;
      if (!u) return 'nouse';
      for (var k in u) if (u[k] > 0 && n[k] < D().max) return null;
      return 'full';
    },

    // Uses one unit of an item. Never kills: a bad item can take health down to 1 at the lowest.
    use: function (n, def) {
      var why = needs.usable(n, def);
      if (why) return { ok: false, reason: why };
      for (var k in def.use) {
        var v = n[k] + def.use[k];
        n[k] = k === 'health' && def.use[k] < 0 ? Math.max(Math.min(1, n[k]), clamp(v)) : clamp(v);
      }
      return { ok: true };
    },

    // Sleeping in a bed of the given level: energy and health come back, hunger and thirst drop a little
    // (scaled by difficulty, never below 5 because of the sleep itself).
    sleep: function (n, bedLevel, diff) {
      var s = G.data.buildings.bed.levels[Math.max(1, bedLevel) - 1].sleep;
      n.energy = clamp(n.energy + s.energy);
      n.health = clamp(n.health + s.health);
      n.hunger = Math.max(clamp(n.hunger - s.hunger * diff.hunger), Math.min(n.hunger, 5));
      n.thirst = Math.max(clamp(n.thirst - s.thirst * diff.thirst), Math.min(n.thirst, 5));
      return n;
    },

    // Fainting (health 0): the bag loses a share of its contents (diff.deathLoss: 0.5 = every second used slot,
    // 1 = everything). Returns the lost [itemId, amount] pairs. Combat deaths (stage 5) reuse this.
    deathLoss: function (bag, diff) {
      var lost = [], used = 0, i, s;
      for (i = 0; i < bag.slots.length; i++) {
        s = bag.slots[i];
        if (!s) continue;
        used++;
        if (diff.deathLoss >= 1 || used % 2 === 0) { lost.push([s.id, s.n]); bag.slots[i] = null; }
      }
      return lost;
    },

    // Wake-up state after fainting.
    revive: function (n) {
      var r = D().revive;
      D().order.forEach(function (k) { n[k] = Math.max(n[k], r[k]); });
      n.health = r.health;
      return n;
    }
  };

  G.needs = needs;
})(typeof window !== 'undefined' ? window : globalThis);
