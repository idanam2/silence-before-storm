// Loot from killed infected. Pure (no DOM, no globals except G), so it is unit-tested in Node.
// G.loot.roll(typeId, rand, ctx) -> [[itemId, n], ...]
//   rand: function returning 0..1 (pass a seeded one in tests)
//   ctx (all optional): { sneak: bool (a quiet kill), bag: inventory (the player's backpack) }
(function (root) {
  'use strict';
  var G = root.G;

  function cfg() { return G.data.loot; }

  // Is this item allowed as loot? It must exist, must not be a weapon, and must stack.
  function lootable(id) {
    var it = G.data.items[id], w, k;
    if (!it || it.weapon || !(it.stack > 0)) return false;
    for (k in G.data.weapons) { w = G.data.weapons[k]; if (w && w.item === id) return false; }
    return true;
  }

  // Ammo item ids that the bag holds a matching gun for, as a set { ammoId: true }.
  function ammoWanted(bag) {
    var out = {}, k, w;
    if (!bag || !bag.slots) return out;
    for (k in G.data.weapons) {
      w = G.data.weapons[k];
      if (w && w.kind === 'gun' && w.ammo && w.item && G.inventory.count(bag, w.item) > 0) out[w.ammo] = true;
    }
    return out;
  }

  function isAmmo(id) { var it = G.data.items[id]; return !!(it && it.kind === 'ammo'); }

  var loot = {
    table: function (typeId) {
      var t = cfg().types[typeId];
      return t || cfg().default;
    },

    // Chance (0..maxChance) of one table entry, after the quiet-kill and matching-gun bonuses.
    chanceOf: function (entry, ctx) {
      var c = cfg(), p = entry.chance;
      ctx = ctx || {};
      if (ctx.sneak) p *= c.sneakMult;
      if (isAmmo(entry.item) && ammoWanted(ctx.bag)[entry.item]) p *= c.gunMult;
      return Math.max(0, Math.min(c.maxChance, p));
    },

    roll: function (typeId, rand, ctx) {
      var c = cfg(), table = loot.table(typeId), out = [], total = 0, i, e, n, room;
      rand = rand || Math.random;
      ctx = ctx || {};
      for (i = 0; i < table.length && total < c.maxUnits; i++) {
        e = table[i];
        if (!lootable(e.item)) continue;
        if (rand() >= loot.chanceOf(e, ctx)) continue;
        n = e.min + Math.floor(rand() * (e.max - e.min + 1));
        n = Math.max(1, Math.min(e.max, n));
        room = c.maxUnits - total;
        if (n > room) n = room;
        out.push([e.item, n]);
        total += n;
      }
      return out;
    }
  };

  G.loot = loot;
})(window);
