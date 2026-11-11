// Saving: one versioned slot in localStorage (always inside try/catch: it can be blocked or full).
// snapshot() turns the game state into plain JSON, parse() reads text back and sanitizes everything
// (a damaged or edited save can never crash the game), write()/read() do the storage.
// To change the format later: raise VERSION and add MIGRATIONS[oldVersion] = function (obj) -> obj of the next version.
// Pure logic apart from the storage object, which can be replaced in tests (G.save.useStorage).
(function (root) {
  'use strict';
  var G = root.G;

  var KEY = 'silence-before-storm.save';
  var VERSION = 1;
  var MIGRATIONS = {};          // none yet: version 1 is the first

  var storage = null, probed = false;

  function getStorage() {
    if (probed) return storage;
    probed = true;
    try {
      var s = root.localStorage;
      s.setItem(KEY + '.probe', '1'); s.removeItem(KEY + '.probe');
      storage = s;
    } catch (e) { storage = null; }
    return storage;
  }

  function num(v, def, min, max) {
    v = typeof v === 'number' ? v : NaN;
    if (!isFinite(v)) return def;
    return v < min ? min : (v > max ? max : v);
  }

  function slotsOf(inv) {
    return inv.slots.map(function (s) { return s ? [s.id, s.n] : null; });
  }

  // Game state -> plain JSON. st: G.state (needs the fields listed below).
  function snapshot(st, now) {
    var o = {
      v: VERSION, savedAt: now || 0, diff: st.diff, playTime: Math.round(st.playTime),
      needs: { health: st.needs.health, hunger: st.needs.hunger, thirst: st.needs.thirst, energy: st.needs.energy },
      bag: slotsOf(st.bag), chest: slotsOf(st.chest),
      buildings: JSON.parse(JSON.stringify(st.buildings)),
      tank: { amount: st.tank.amount, t: st.tank.t },
      visits: JSON.parse(JSON.stringify(st.visits)),
      area: st.area,
      pos: { x: Math.round(st.player.x), y: Math.round(st.player.y) }
    };
    if (st.area !== 'base' && st.zone) o.zone = { id: st.zone.id, visit: st.zone.visit, delta: G.area.delta(st.zone) };
    return o;
  }

  function cleanInventory(list, minSize, items) {
    var slots = [], i, s;
    list = Array.isArray(list) ? list.slice(0, 200) : [];
    for (i = 0; i < list.length; i++) {
      s = list[i];
      if (Array.isArray(s) && typeof s[0] === 'string' && items[s[0]] && typeof s[1] === 'number' && s[1] >= 1) {
        slots.push({ id: s[0], n: Math.min(Math.floor(s[1]), items[s[0]].stack) });
      } else slots.push(null);
    }
    while (slots.length < minSize) slots.push(null);
    return { slots: slots };
  }

  // Raw object -> a safe, complete state (missing or invalid parts fall back to defaults).
  function sanitize(o) {
    var data = G.data, items = data.items, d = {}, k, i;
    d.diff = data.difficulty.levels[o.diff] ? o.diff : data.difficulty.default;
    d.playTime = num(o.playTime, 0, 0, 1e9);
    d.savedAt = num(o.savedAt, 0, 0, 1e15);

    d.needs = {};
    var ns = o.needs && typeof o.needs === 'object' ? o.needs : {};
    data.needs.order.forEach(function (key) { d.needs[key] = num(ns[key], data.needs.start[key], 0, data.needs.max); });
    if (d.needs.health < 1) d.needs.health = 1;           // a save never holds a dead player

    d.buildings = {};
    var bs = o.buildings && typeof o.buildings === 'object' ? o.buildings : {};
    for (k in data.buildings) {
      var def = data.buildings[k];
      d.buildings[k] = Math.floor(num(bs[k], def.start, def.start, def.levels.length));
    }

    d.bag = cleanInventory(o.bag, data.inventory.bagSlots, items);
    d.chest = cleanInventory(o.chest, G.crafting.chestSlots(d.buildings), items);

    var cap = d.buildings.tank > 0 ? G.tank.cap(d.buildings.tank) : 0;
    var tk = o.tank && typeof o.tank === 'object' ? o.tank : {};
    d.tank = { amount: Math.floor(num(tk.amount, 0, 0, cap)), t: num(tk.t, 0, 0, 1e6) };

    d.visits = {};
    var vs = o.visits && typeof o.visits === 'object' ? o.visits : {};
    for (k in data.world.destinations) d.visits[k] = Math.floor(num(vs[k], 0, 0, 1e6));

    d.area = 'base'; d.zone = null; d.pos = null;
    if (o.pos && typeof o.pos === 'object' && isFinite(o.pos.x) && isFinite(o.pos.y)) d.pos = { x: o.pos.x, y: o.pos.y };
    var z = o.zone;
    if (o.area !== 'base' && z && typeof z === 'object' && G.world.has(z.id)) {
      var delta = [];
      if (Array.isArray(z.delta)) {
        for (i = 0; i < z.delta.length && i < 5000; i++) {
          var e = z.delta[i];
          if (Array.isArray(e) && isFinite(e[0]) && isFinite(e[1]) && e[0] >= 0) delta.push([Math.floor(e[0]), Math.max(0, Math.floor(e[1]))]);
        }
      }
      d.area = z.id;
      d.zone = { id: z.id, visit: Math.max(1, Math.floor(num(z.visit, 1, 1, 1e6))), delta: delta };
      d.visits[z.id] = Math.max(d.visits[z.id], d.zone.visit);
    }
    return d;
  }

  // Text -> { ok: true, data } | { ok: false, reason: 'corrupt' | 'newer' | 'old' }.
  function parse(text) {
    var o;
    try { o = JSON.parse(text); } catch (e) { return { ok: false, reason: 'corrupt' }; }
    if (!o || typeof o !== 'object' || typeof o.v !== 'number') return { ok: false, reason: 'corrupt' };
    if (o.v > VERSION) return { ok: false, reason: 'newer' };
    try {
      while (o.v < VERSION) {
        var m = MIGRATIONS[o.v];
        if (!m) return { ok: false, reason: 'old' };
        o = m(o);
      }
      return { ok: true, data: sanitize(o) };
    } catch (e2) { return { ok: false, reason: 'corrupt' }; }
  }

  var save = {
    KEY: KEY, VERSION: VERSION, MIGRATIONS: MIGRATIONS,
    snapshot: snapshot, parse: parse,

    useStorage: function (s) { storage = s; probed = true; },     // tests
    available: function () { return !!getStorage(); },

    write: function (snap) {
      var s = getStorage();
      if (!s) return false;
      try { s.setItem(KEY, JSON.stringify(snap)); return true; } catch (e) { return false; }
    },

    // { ok: true, data } or { ok: false, reason: 'none' | 'unavailable' | 'corrupt' | 'newer' | 'old' }
    read: function () {
      var s = getStorage();
      if (!s) return { ok: false, reason: 'unavailable' };
      var text = null;
      try { text = s.getItem(KEY); } catch (e) { return { ok: false, reason: 'unavailable' }; }
      if (text === null || text === undefined) return { ok: false, reason: 'none' };
      return parse(text);
    },

    clear: function () {
      var s = getStorage();
      if (!s) return false;
      try { s.removeItem(KEY); return true; } catch (e) { return false; }
    }
  };

  G.save = save;
})(typeof window !== 'undefined' ? window : globalThis);
