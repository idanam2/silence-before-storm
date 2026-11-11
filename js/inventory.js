// Slot-based inventory. Pure data + functions (no DOM), so it is unit-tested in Node.
// An inventory is { slots: [ {id, n} | null, ... ] } (plain JSON, ready for saving in stage 4).
(function (root) {
  'use strict';
  var G = root.G;

  function itemsOf(items) { return items || (G.data && G.data.items) || {}; }
  function maxStack(id, items) { var d = itemsOf(items)[id]; return d ? d.stack : 0; }

  var inventory = {
    create: function (size) {
      var slots = [];
      for (var i = 0; i < size; i++) slots.push(null);
      return { slots: slots };
    },

    // Adds up to n units, filling existing stacks first. Returns the leftover that did not fit.
    add: function (inv, id, n, items) {
      var max = maxStack(id, items), left = n, i, s, take;
      if (!max || n <= 0) return n;
      for (i = 0; i < inv.slots.length && left > 0; i++) {
        s = inv.slots[i];
        if (s && s.id === id && s.n < max) {
          take = Math.min(max - s.n, left);
          s.n += take; left -= take;
        }
      }
      for (i = 0; i < inv.slots.length && left > 0; i++) {
        if (!inv.slots[i]) {
          take = Math.min(max, left);
          inv.slots[i] = { id: id, n: take }; left -= take;
        }
      }
      return left;
    },

    // Removes up to n units of an item (from the last stacks first). Returns how many were removed.
    remove: function (inv, id, n) {
      var left = n;
      for (var i = inv.slots.length - 1; i >= 0 && left > 0; i--) {
        var s = inv.slots[i];
        if (s && s.id === id) {
          var take = Math.min(s.n, left);
          s.n -= take; left -= take;
          if (s.n === 0) inv.slots[i] = null;
        }
      }
      return n - left;
    },

    count: function (inv, id) {
      var c = 0;
      for (var i = 0; i < inv.slots.length; i++) if (inv.slots[i] && inv.slots[i].id === id) c += inv.slots[i].n;
      return c;
    },

    // How many more units of an item would fit (partial stacks + empty slots).
    space: function (inv, id, items) {
      var max = maxStack(id, items), room = 0;
      if (!max) return 0;
      for (var i = 0; i < inv.slots.length; i++) {
        var s = inv.slots[i];
        if (!s) room += max;
        else if (s.id === id) room += max - s.n;
      }
      return room;
    },

    usedSlots: function (inv) {
      var u = 0;
      for (var i = 0; i < inv.slots.length; i++) if (inv.slots[i]) u++;
      return u;
    },

    // Moves up to `amount` units out of one slot into another inventory. Returns the amount moved
    // (less than requested if the target is full).
    move: function (from, idx, to, amount, items) {
      var s = from.slots[idx];
      if (!s) return 0;
      var want = Math.min(amount, s.n);
      var left = inventory.add(to, s.id, want, items);
      var moved = want - left;
      s.n -= moved;
      if (s.n === 0) from.slots[idx] = null;
      return moved;
    },

    // Grows an inventory to `size` slots (never shrinks, so nothing can be lost).
    resize: function (inv, size) {
      while (inv.slots.length < size) inv.slots.push(null);
      return inv;
    },

    // Builds an inventory from [[id, n], ...] (used for the starting loadout).
    fromList: function (size, list, items) {
      var inv = inventory.create(size);
      for (var i = 0; i < list.length; i++) inventory.add(inv, list[i][0], list[i][1], items);
      return inv;
    }
  };

  G.inventory = inventory;
})(typeof window !== 'undefined' ? window : globalThis);
