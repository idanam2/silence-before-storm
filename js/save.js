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

  // Magazine and wear of every gun that has a state: { weaponId: { mag, shots, life } }.
  function gunsOf(guns) {
    var out = {};
    for (var id in guns || {}) if (guns[id]) out[id] = { mag: guns[id].mag, shots: guns[id].shots, life: guns[id].life };
    return out;
  }

  // ---- combat state: the infected of the zone and the melee wear counters (all optional in a save) ----------

  var MAX_ENEMIES = 40, MAX_KEEP_FLOORS = 12, MAX_WEAR = 100000;

  // Living and dead infected -> compact entries { t: type, x, y, hp, s: 'idle' | 'wander' | 'dead', a: angle }.
  // Anything that is hunting or reacting is saved as 'wander' (a loaded game never starts mid-blow). Living ones first when over the bound.
  function enemiesOf(list) {
    var alive = [], dead = [], out = [], i, e, s;
    if (!Array.isArray(list)) return out;
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (!e || typeof e.type !== 'string' || !isFinite(e.x) || !isFinite(e.y)) continue;
      (e.state === 'dead' || e.state === 'dying' ? dead : alive).push(e);
    }
    alive.concat(dead).slice(0, MAX_ENEMIES).forEach(function (e) {
      var gone = e.state === 'dead' || e.state === 'dying';
      s = gone ? 'dead' : (e.state === 'idle' ? 'idle' : 'wander');
      out.push({ t: e.type, x: Math.round(e.x), y: Math.round(e.y), hp: gone ? 0 : Math.round((isFinite(e.hp) ? e.hp : 0) * 10) / 10,
        s: s, a: Math.round((isFinite(e.angle) ? e.angle : 0) * 100) / 100 });
    });
    return out;
  }

  // Raw saved entries -> a safe list: unknown types, broken numbers and non-objects are dropped, hp / position / angle clamped.
  // bounds: { width, height } of the zone (optional).
  function cleanEnemies(raw, bounds) {
    var out = [], types = G.data.enemies.types, i, r, d, s, hp, W, H;
    if (!Array.isArray(raw)) return out;
    W = bounds && isFinite(bounds.width) ? bounds.width : 1e5;
    H = bounds && isFinite(bounds.height) ? bounds.height : 1e5;
    for (i = 0; i < raw.length && i < 300 && out.length < MAX_ENEMIES; i++) {
      r = raw[i];
      if (!r || typeof r !== 'object' || typeof r.t !== 'string' || !Object.prototype.hasOwnProperty.call(types, r.t)) continue;
      if (typeof r.x !== 'number' || typeof r.y !== 'number' || !isFinite(r.x) || !isFinite(r.y)) continue;
      d = types[r.t];
      s = r.s === 'idle' || r.s === 'wander' || r.s === 'dead' ? r.s : 'idle';
      hp = num(r.hp, d.hp, 0, d.hp);
      if (hp <= 0) s = 'dead';
      if (s === 'dead') hp = 0;
      out.push({ t: r.t, x: num(r.x, 0, 20, Math.max(20, W - 20)), y: num(r.y, 0, 20, Math.max(20, H - 20)), hp: hp, s: s, a: num(r.a, 0, -100, 100) });
    }
    return out;
  }

  // Cleaned entries -> enemy objects (through G.enemies.create). zone (optional): keeps living ones out of walls.
  function restoreEnemies(clean, zone, rand) {
    var out = [], r = rand || Math.random, i, c, e;
    if (!Array.isArray(clean)) return out;
    for (i = 0; i < clean.length; i++) {
      c = clean[i];
      if (!c || !G.data.enemies.types[c.t]) continue;
      e = G.enemies.create(c.t, c.x, c.y, r);
      e.angle = e.prevAngle = c.a; e.hp = c.hp;
      if (c.s === 'dead') {
        e.state = 'dead'; e.hp = 0; e.fall = 1; e.fallDir = 1; e.t = 1;
      } else {
        if (zone && G.area && G.area.collide) G.area.collide(e, zone);
        e.home = { x: e.x, y: e.y };
        if (c.s === 'wander') { e.state = 'wander'; e.t = 2; e.goal = { x: e.x + Math.cos(c.a) * 60, y: e.y + Math.sin(c.a) * 60 }; }
      }
      G.player.settle(e, c.a);
      out.push(e);
    }
    return out;
  }

  // Enemy floors kept in memory for the trip (st.enemyKeep: { zoneId: [enemy] }) -> { zoneId: [entries] }, without the current zone.
  function keepOf(keep, exceptId) {
    var out = {}, n = 0, id;
    for (id in keep || {}) {
      if (id === exceptId || !Array.isArray(keep[id]) || n >= MAX_KEEP_FLOORS) continue;
      out[id] = enemiesOf(keep[id]); n++;
    }
    return out;
  }

  // { weaponId: integer } for the melee weapons (wear counters). Only weapons that exist and are melee, integers 0..100000.
  function cleanWear(raw) {
    var out = {}, W = G.data.weapons, id, v;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (id in raw) {
      if (!Object.prototype.hasOwnProperty.call(raw, id) || !Object.prototype.hasOwnProperty.call(W, id) || W[id].kind !== 'melee') continue;
      v = raw[id];
      if (typeof v !== 'number' || !isFinite(v)) continue;
      out[id] = Math.floor(num(v, 0, 0, MAX_WEAR));
    }
    return out;
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
      fence: { material: st.fence && st.fence.material },
      placed: (st.placed || []).map(function (p) { return { id: p.id, x: Math.round(p.x), y: Math.round(p.y) }; }),
      floor: { cell: G.placing.CELL, cells: Object.assign({}, st.floor && st.floor.cells) },
      chestAt: { x: Math.round(G.base.layout.chest.x), y: Math.round(G.base.layout.chest.y) },
      tank: { amount: st.tank.amount, t: st.tank.t },
      visits: JSON.parse(JSON.stringify(st.visits)),
      guns: gunsOf(st.guns),
      wear: cleanWear(st.wear), wearLife: cleanWear(st.wearLife),     // melee weapon wear: { weaponId: integer }
      area: st.area,
      pos: { x: Math.round(st.player.x), y: Math.round(st.player.y) }
    };
    if (st.area !== 'base' && st.zone) {
      o.zone = { id: st.zone.id, visit: st.zone.visit, delta: G.area.delta(st.zone) };
      o.trip = JSON.parse(JSON.stringify(st.trip || {}));     // other floors of the same building, already searched
      o.enemies = enemiesOf(st.enemies);                      // the infected here, living and fallen
      o.enemyKeep = keepOf(st.enemyKeep, st.zone.id);         // the infected of the other floors of this trip
    }
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

  function cleanDelta(list) {
    var delta = [];
    if (!Array.isArray(list)) return delta;
    for (var i = 0; i < list.length && i < 5000; i++) {
      var e = list[i];
      if (Array.isArray(e) && isFinite(e[0]) && isFinite(e[1]) && e[0] >= 0) delta.push([Math.floor(e[0]), Math.max(0, Math.floor(e[1]))]);
    }
    return delta;
  }
  // A destination, or a floor / inside of one (an area with a `parent` destination).
  function placeOk(id) {
    var a = typeof id === 'string' && G.data.areas.hasOwnProperty(id) ? G.data.areas[id] : null;
    return !!a && (G.world.has(id) || (!!a.parent && G.world.has(a.parent)));
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

    var fm = o.fence && typeof o.fence.material === 'string' ? o.fence.material : '';
    d.fence = { material: data.fenceMaterials.hasOwnProperty(fm) ? fm : 'wood' };      // unknown or missing: wood
    d.placed = G.placing.clean(o.placed, d.buildings);                                 // missing (old save): structures on their old spots
    d.floor = G.placing.cleanFloor(o.floor);
    d.chestAt = o.chestAt && isFinite(o.chestAt.x) && isFinite(o.chestAt.y) ? { x: o.chestAt.x, y: o.chestAt.y } : null;      // null = where the chest always stood
    d.bag = cleanInventory(o.bag, G.crafting.bagSlots(d.buildings), items);
    d.chest = cleanInventory(o.chest, G.crafting.chestSlots(d.buildings), items);

    var cap = d.buildings.tank > 0 ? G.tank.cap(d.buildings.tank, Math.max(1, G.placing.count(d.placed, 'tank'))) : 0;
    var tk = o.tank && typeof o.tank === 'object' ? o.tank : {};
    d.tank = { amount: Math.floor(num(tk.amount, 0, 0, cap)), t: num(tk.t, 0, 0, 1e6) };

    d.visits = {};
    var vs = o.visits && typeof o.visits === 'object' ? o.visits : {};
    for (k in data.world.destinations) d.visits[k] = Math.floor(num(vs[k], 0, 0, 1e6));

    d.guns = {};                                           // magazine and wear per gun (the first saves had only `gun`, the pistol)
    var gs = o.guns && typeof o.guns === 'object' ? o.guns : {};
    for (k in data.weapons) {
      if (data.weapons[k].kind !== 'gun') continue;
      var gc = G.combat.gunClean(gs[k] || (k === 'gun' ? o.gun : null), data.weapons[k]);
      if (gc) d.guns[k] = gc;
    }

    d.wear = cleanWear(o.wear); d.wearLife = cleanWear(o.wearLife);
    d.enemies = null; d.enemyKeep = {};                    // null = not in the save (older save): the game re-rolls them

    d.area = 'base'; d.zone = null; d.pos = null;
    if (o.pos && typeof o.pos === 'object' && isFinite(o.pos.x) && isFinite(o.pos.y)) d.pos = { x: o.pos.x, y: o.pos.y };
    var z = o.zone;
    d.trip = {};
    if (o.area !== 'base' && z && typeof z === 'object' && placeOk(z.id)) {
      d.area = z.id;
      d.zone = { id: z.id, visit: Math.max(1, Math.floor(num(z.visit, 1, 1, 1e6))), delta: cleanDelta(z.delta) };
      var root = G.data.areas[z.id].parent || z.id;
      d.visits[root] = Math.max(d.visits[root] || 0, d.zone.visit);
      var tr = o.trip && typeof o.trip === 'object' ? o.trip : {};
      for (k in tr) if (placeOk(k)) d.trip[k] = cleanDelta(tr[k]);
      if (Array.isArray(o.enemies)) d.enemies = cleanEnemies(o.enemies, G.data.areas[z.id]);
      var ek = o.enemyKeep && typeof o.enemyKeep === 'object' && !Array.isArray(o.enemyKeep) ? o.enemyKeep : {}, nk = 0;
      for (k in ek) {
        if (nk >= MAX_KEEP_FLOORS) break;
        if (Object.prototype.hasOwnProperty.call(ek, k) && k !== z.id && placeOk(k) && Array.isArray(ek[k])) { d.enemyKeep[k] = cleanEnemies(ek[k], G.data.areas[k]); nk++; }
      }
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
    enemiesOf: enemiesOf, cleanEnemies: cleanEnemies, restoreEnemies: restoreEnemies, cleanWear: cleanWear,

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
