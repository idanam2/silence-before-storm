// The story in the world: what the engine may do (host), objects in reach, wind chimes.
// Part of the old js/game.js: all js/game-*.js files share one private object (G.gx); load order is in index.html.
(function (root) {
  'use strict';
  var G = root.G, X = G.gx = G.gx || {};
  var st = X.st;

  // functions of the other game-*.js files
  function snd() { return X.snd.apply(null, arguments); }
  function at() { return X.at.apply(null, arguments); }
  function goThrough() { return X.goThrough.apply(null, arguments); }
  function floater() { return X.floater.apply(null, arguments); }
  // What the story engine may do in the world.
  function setupStory() {
    var items = G.data.items;
    function put(inv, id, n) { return inv ? n - G.inventory.add(inv, id, n, items) : 0; }
    G.story.setHost({
      count: function (id) { return G.inventory.count(st.bag, id) + G.inventory.count(st.chest, id); },
      give: function (id, n, to) {                       // to 'chest': straight into the storage; otherwise bag first, then chest
        var got = 0;
        if (to !== 'chest') got += put(st.bag, id, n);
        if (got < n) got += put(st.chest, id, n - got);
        if (got > 0) { G.ui.markDirty(); if (st.player && to !== 'chest') floater(st.player.x, st.player.y, id, got); }
        return got;
      },
      take: function (id, n) {
        var got = G.inventory.remove(st.bag, id, n);
        if (got < n) got += G.inventory.remove(st.chest, id, n - got);
        if (got > 0) G.ui.markDirty();
        return got;
      },
      toast: function (t, ms) { G.ui.toast(t, ms); },
      area: function () { return st.area; },
      buildings: function () { return st.buildings; },
      door: function (to) { if (st.zone && G.data.areas[to]) goThrough({ to: to }); },
      noise: function (r) { G.combat.addBurst(st.burst, r); },
      spawn: function (a) {                              // a relay wave { wave: {count, kinds} } or { kind, near, count, calm }
        var Z = st.zone, p = st.player, kinds = [], i, cx = p.x, cy = p.y, minR = 520, maxR = 840, pl;
        if (!Z) return;
        if (a.wave) kinds = a.wave.kinds.slice(0, a.wave.count);
        else for (i = 0; i < (a.count || 1); i++) kinds.push(a.kind);
        if (a.near === 'edges') { cx = Z.width / 2; cy = Z.height / 2; minR = 0; maxR = Math.max(200, Math.min(Z.width, Z.height) / 2 - 220); }
        else if (a.near && a.near !== 'player' && G.data.storyPlace[a.near]) { pl = G.data.storyPlace[a.near]; cx = pl.x; cy = pl.y; minR = 200; maxR = 480; }
        for (i = 0; i < kinds.length && st.enemies.length < 40; i++) {
          var e = G.enemies.spawnNear(Z, kinds[i], Math.random, cx, cy, minR, maxR);
          if (!e) continue;
          if (!a.calm) { e.state = 'investigate'; e.goal = { x: p.x, y: p.y }; e.alertT = 0.7; e.t = 0; }
          st.enemies.push(e);
        }
      }
    });
  }

  // Story objects in reach: E uses them (hold E for "hold" / "relay" ones), "listen" ones need standing still.
  // Returns { sp: the spot in reach or null, holding: true while E is held on one }.
  var NOSPOT = { sp: null, holding: false };
  function storySpot(areaId, dt, frozen) {
    if (frozen || !G.story.S) return NOSPOT;
    var inp = G.input, p = st.player, sp = G.story.nearSpot(areaId, p), holding = false, k;
    if (sp) {
      k = sp.s.kind;
      if ((k === 'hold' || k === 'relay') && sp.state !== 'deny') {
        if (inp.isDown('KeyE')) { holding = true; G.story.holdSpot(sp, dt); }
      } else if (inp.wasPressed('KeyE')) { G.story.activate(sp); snd('ui', { vol: 0.4 }); }
    }
    G.story.listenStep(areaId, p, dt);
    return sp ? { sp: sp, holding: holding } : NOSPOT;
  }

  // The wind chimes of the farm ring every few seconds until the five are taken down: the infected nearby come to see.
  var chimeT = 0;
  function chimeStep(dt, frozen) {
    if (st.zone.id !== 'farm' || frozen || !G.story.hasFlag('chimes_task') || G.story.hasFlag('rachel_deal_done')) { chimeT = 0; return; }
    chimeT += dt;
    if (chimeT < 3.2) return;
    chimeT = 0;
    var l = G.story.visibleSpots('farm'), i, e;
    for (i = 0; i < l.length; i++) {
      e = l[i];
      if (e.id.indexOf('spot_chime') !== 0) continue;
      snd('notice', at(e.x, e.y, { vol: 0.5, key: e.id, gap: 2 }));
      G.enemies.alertAround(st.enemies, e.x, e.y, G.data.noise.chime, e.x, e.y, null, null);
    }
  }


  X.setupStory = setupStory; X.storySpot = storySpot; X.chimeStep = chimeStep;
})(window);
