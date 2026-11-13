// Equipment: clothes worn on the body and the two weapon slots. Pure (no DOM), tested in Node.
// equip = { head, body, legs, feet: item id or null, primary, secondary: weapon id or null }.
(function (root) {
  'use strict';
  var G = root.G;

  function D() { return G.data.gear; }
  function itemsOf(items) { return items || G.data.items; }
  function wearOf(id, items) { var d = itemsOf(items)[id]; return d && d.wear ? d.wear : null; }

  var gear = {
    create: function () { return { head: null, body: null, legs: null, feet: null, primary: null, secondary: null }; },

    // The clothes slot an item goes in, or null when it is not something to wear.
    slotOf: function (id, items) { var w = wearOf(id, items); return w ? w.slot : null; },

    // Puts the piece in backpack slot `idx` on. Whatever was worn there goes back into that backpack slot.
    wear: function (equip, bag, idx, items) {
      var s = bag.slots[idx], slot = s ? gear.slotOf(s.id, items) : null;
      if (!slot) return { ok: false, reason: 'kind' };
      var old = equip[slot];
      equip[slot] = s.id;
      bag.slots[idx] = old ? { id: old, n: 1 } : null;
      return { ok: true, slot: slot, old: old };
    },

    // Takes a worn piece off into the backpack: into slot `idx` when it is free, else anywhere there is room.
    takeOff: function (equip, bag, slot, idx, items) {
      var id = equip[slot];
      if (!id || D().slots.indexOf(slot) < 0) return { ok: false, reason: 'empty' };
      if (idx >= 0 && idx < bag.slots.length && !bag.slots[idx]) bag.slots[idx] = { id: id, n: 1 };
      else if (G.inventory.add(bag, id, 1, items) > 0) return { ok: false, reason: 'space' };
      equip[slot] = null;
      return { ok: true, id: id };
    },

    // Share of a blow that the worn clothes take away (0..cap).
    armor: function (equip, items) {
      var a = 0, sl = D().slots;
      for (var i = 0; equip && i < sl.length; i++) { var w = equip[sl[i]] ? wearOf(equip[sl[i]], items) : null; if (w) a += w.armor || 0; }
      return Math.min(D().cap, a);
    },

    // Weapon slots. which: 'primary' | 'secondary'. A weapon is never in both: choosing it for one slot swaps the two.
    setWeapon: function (equip, which, id) {
      var other = which === 'primary' ? 'secondary' : 'primary';
      if (which !== 'primary' && which !== 'secondary') return false;
      if (id && equip[other] === id) equip[other] = equip[which];
      equip[which] = id || null;
      return true;
    },

    // Click on a weapon in the backpack: it becomes the primary one, and the old primary moves to the second slot.
    promote: function (equip, id) {
      if (!id || equip.primary === id) return false;
      var old = equip.primary;
      equip.primary = id;
      if (equip.secondary === id || !equip.secondary) equip.secondary = old;
      return true;
    },

    // Drops weapons that are no longer in the backpack and fills empty slots with ones that are (in `order`).
    // canHold(id) says whether the weapon can be taken in the hands right now. Returns true when something changed.
    refresh: function (equip, order, canHold) {
      var changed = false, i, id;
      ['primary', 'secondary'].forEach(function (k) { if (equip[k] && !canHold(equip[k])) { equip[k] = null; changed = true; } });
      if (!equip.primary && equip.secondary) { equip.primary = equip.secondary; equip.secondary = null; changed = true; }
      for (i = 0; i < order.length && (!equip.primary || !equip.secondary); i++) {
        id = order[i];
        if (id === 'hands' || id === equip.primary || id === equip.secondary || !canHold(id)) continue;
        if (!equip.primary) equip.primary = id; else equip.secondary = id;
        changed = true;
      }
      return changed;
    },

    // A loaded save: only known clothes in their own slot and known weapons survive.
    clean: function (o, items, weapons) {
      var e = gear.create(), sl = D().slots;
      if (!o || typeof o !== 'object') return e;
      sl.forEach(function (k) { if (typeof o[k] === 'string' && gear.slotOf(o[k], items) === k) e[k] = o[k]; });
      ['primary', 'secondary'].forEach(function (k) { if (typeof o[k] === 'string' && o[k] !== 'hands' && (weapons || G.data.weapons)[o[k]]) e[k] = o[k]; });
      if (e.primary && e.primary === e.secondary) e.secondary = null;
      return e;
    }
  };

  G.gear = gear;
})(typeof window !== 'undefined' ? window : globalThis);
