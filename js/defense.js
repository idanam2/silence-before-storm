// Base defense: a loud trip can bring a few infected home behind the player. Pure logic (no DOM), unit-tested in Node.
// Numbers: data/defense.js. Wiring: js/game.js (setArea / travel / tickBase / combatStep / render).
//
// DESIGN (kept small on purpose; the base stays peaceful unless the trip was loud):
//  1. Noise score. While the player is away, every loud action (a burst of radius r, see G.combat.addBurst) adds
//     (r / 1000) ^ 2 units and every kill adds a little: guns count a lot, axes and gathering hardly at all (track()).
//  2. Arrival. Back at the base, roll() turns the score into a chance (chance(): quiet trips = no raid, then a small base chance
//     that grows with the score, capped), multiplied by the fence: level 1 x0.75, level 2 x0.35. A raid never follows a raid
//     (cooldownTrips) and never happens at game start, after fainting, or when loading (only travel home calls roll()).
//  3. The raid. 3.5-6.5 s later (only while nothing is open / fading) 1-3 infected (count(), a few runners when loud) walk down
//     the trail to the gate and hunt the player. They are ordinary G.enemies, stepped by game.js combatStep.
//  4. Fence. Level 0/1: the gate gap is open, they come in. Level 2: the gate holds. Raiders outside the fence strike the
//     gate instead of the player (aim()), every blow costs gate hp, and when it breaks they pour in. The player walks through
//     the gate freely and can fight over the low fence. The gate is repaired for free: it lives only in the raid object, so
//     the next raid starts with a whole one.
//  5. The raid ends when every raider lies dead (finished()), or when the player leaves for a trip (setArea clears the list).
//     Dying in a raid is the usual faint: wake up at the base start with the usual loss.
// Raiders are stepped against a thin "area" adapter built from the base (arena()): width/height/solids, no trees or ponds.
(function (root) {
  'use strict';
  var G = root.G;

  function D() { return G.data.defense; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  var defense = {
    // ---- state ----------------------------------------------------------------------------------------------
    create: function () {
      return { noise: 0, burstT: 0, killsSeen: 0, cool: 0, raid: null, _arena: null, _solids: null, _gateOn: null };
    },

    // A new trip starts: noise counted from zero, no raid hangs around.
    beginTrip: function (d, kills) { d.noise = 0; d.burstT = 0; d.killsSeen = kills | 0; d.raid = null; },

    // Noise units of one burst of radius r.
    unit: function (r) { return Math.pow(Math.max(0, r) / 1000, D().noise.burstPower); },

    // Called every step during a trip, AFTER G.combat.stepBurst. A burst that was just refreshed (its timer went up instead of
    // down) is a new loud action. kills: the running kill counter.
    track: function (d, burst, kills, dt) {
      if (burst && burst.t > 0 && burst.t > d.burstT - dt * 0.5) d.noise += defense.unit(burst.r);
      d.burstT = burst ? burst.t : 0;
      var k = kills | 0;
      if (k > d.killsSeen) d.noise += (k - d.killsSeen) * D().noise.killNoise;
      d.killsSeen = k;
    },

    // ---- the roll ---------------------------------------------------------------------------------------------
    fenceFactor: function (level) { var f = D().fence.factor; return f[level] !== undefined ? f[level] : f[1]; },

    // Chance (0..1) of a raid after a trip with `noise` units and a fence of `level`.
    chance: function (noise, level) {
      var C = D().chance;
      if (noise < C.quiet) return 0;
      var p = Math.min(C.maxChance, C.minChance + Math.max(0, noise - C.free) * C.perUnit);
      return p * defense.fenceFactor(level);
    },

    // How many follow.
    count: function (noise) {
      var out = 1, t = D().count;
      for (var i = 0; i < t.length; i++) if (noise >= t[i].from) out = t[i].n;
      return out;
    },

    // The types of the raiders for a noise score. rand: random function.
    types: function (noise, rand) {
      var n = defense.count(noise), out = [], R = D().runner;
      for (var i = 0; i < n; i++) out.push(noise >= R.from && rand() < R.chance ? 'runner' : 'shambler');
      return out;
    },

    // Arrival at the base. Maybe schedules a raid (d.raid = { state: 'wait', wait, types }). Returns the raid or null.
    roll: function (d, level, rand) {
      d.raid = null;
      var noise = d.noise;
      d.noise = 0;
      if (d.cool > 0) { d.cool--; return null; }                 // never twice in a row
      if (rand() >= defense.chance(noise, level)) return null;
      var dl = D().delay;
      d.raid = { state: 'wait', wait: dl[0] + rand() * (dl[1] - dl[0]), types: defense.types(noise, rand), gate: null, noise: noise };
      return d.raid;
    },

    // ---- the raid ---------------------------------------------------------------------------------------------
    waiting: function (d) { return !!d.raid && d.raid.state === 'wait'; },
    active: function (d) { return !!d.raid && d.raid.state === 'active'; },

    // Counts the delay down while `ok` (nothing open, no fade). Returns true on the step the raiders should appear.
    tickWait: function (d, dt, ok) {
      if (!defense.waiting(d) || !ok) return false;
      d.raid.wait -= dt;
      return d.raid.wait <= 0;
    },

    // Where the raiders stand when they appear: a loose column on the trail north of the gate, away from the player.
    // Returns [{ type, x, y }]. Also turns the raid active and gives it its gate (fence level >= gateLevel).
    spawn: function (d, base, level, player, rand) {
      var R = d.raid, L = base.layout, S = D().spawn, out = [], n = R.types.length, i;
      for (i = 0; i < n; i++) {
        var x = L.trail.x + (i - (n - 1) / 2) * S.spread + (rand() - 0.5) * 20;
        var y = L.trail.y - S.dy - i * 34;
        if (player) {
          var dx = x - player.x, dy = y - player.y;
          if (dx * dx + dy * dy < S.minFromPlayer * S.minFromPlayer) y = Math.max(40, player.y - S.minFromPlayer - i * 34);
        }
        out.push({ type: R.types[i], x: x, y: y });
      }
      R.state = 'active';
      R.gate = level >= D().fence.gateLevel ? { hp: D().gate.hp, max: D().gate.hp } : null;
      d.cool = D().cooldownTrips;
      return out;
    },

    // The raid is over when every raider is a corpse (not just dying). Clears it (the gate is whole again) and returns true.
    finished: function (d, list) {
      if (!defense.active(d)) return false;
      for (var i = 0; i < list.length; i++) if (list[i].state !== 'dead') return false;
      d.raid = null;
      return true;
    },

    // ---- the gate ---------------------------------------------------------------------------------------------
    gateRect: function (base) {
      var g = base.layout.gate, a = base.layout.area;
      return { x: g.x, y: a.y, w: g.w, h: D().gate.thick, kind: 'fence' };
    },
    gateHolds: function (d) { var R = d.raid; return !!(R && R.state === 'active' && R.gate && R.gate.hp > 0); },
    // For drawing: { x, y, w, h, frac } while the gate is shut, else null.
    gateInfo: function (d, base) {
      if (!defense.gateHolds(d)) return null;
      var r = defense.gateRect(base);
      r.frac = d.raid.gate.hp / d.raid.gate.max;
      return r;
    },
    // A blow lands on the gate. Returns 'broke' when that was the last of it, else 'hit'.
    hitGate: function (d, dmg) {
      if (!defense.gateHolds(d)) return 'none';
      var g = d.raid.gate;
      g.hp = Math.max(0, g.hp - dmg * D().gate.blowMult);
      return g.hp <= 0 ? 'broke' : 'hit';
    },

    // The area the raiders walk in: the base's solids plus the shut gate. Cached until the solids or the gate change.
    arena: function (d, base) {
      var on = defense.gateHolds(d);
      if (!d._arena || d._solids !== base.solids || d._gateOn !== on) {
        d._solids = base.solids; d._gateOn = on;
        d._arena = {
          width: base.width, height: base.height, nodes: [], ponds: [], water: [], decks: [], doors: [], exit: null, footprint: null,
          solids: on ? base.solids.concat([defense.gateRect(base)]) : base.solids
        };
      }
      return d._arena;
    },

    // ---- hunting ----------------------------------------------------------------------------------------------
    // Before G.enemies.step for a raider: keeps it hunting and decides what it is really after. Returns { c, gate }:
    // c = the step context (its `player` may be a stand-in point: the gate, or the gap), gate = true when a blow it lands
    // belongs to the gate (apply it with hitGate, not to the player). A blow aimed at the gap itself is dropped (gate === null).
    aim: function (d, e, c, base) {
      var st = e.state, P = c.player, L = base.layout, a = L.area, g = L.gate, T = D().gate.thick;
      if (st === 'idle' || st === 'wander' || st === 'investigate') { e.state = 'chase'; e.t = 0; e.atk = -1; }
      e.lostT = 0;
      var outside = e.y < a.y + T, playerIn = P.y > a.y + 4, playerOut = P.y < a.y - 10;
      var tx = P.x, ty = P.y, stand = false, gate = false;
      if (outside && playerIn) {
        stand = true;
        if (defense.gateHolds(d)) {                              // shut: strike the gate itself
          tx = clamp(e.x, g.x + 10, g.x + g.w - 10); ty = a.y; gate = true;
        } else { tx = g.x + g.w / 2; ty = a.y + T + 50; }        // open: through the gap first
      } else if (!outside && playerOut) {                        // inside, the player went out: through the gap
        stand = true; tx = g.x + g.w / 2; ty = a.y + T + 40;
      }
      if (e.state === 'chase') e.goal = { x: tx, y: ty };
      if (!stand) return { c: c, gate: false };
      var c2 = defense._c2 || (defense._c2 = {});
      for (var k in c) c2[k] = c[k];
      c2.player = { x: tx, y: ty, radius: gate ? 0 : P.radius * 0.5, alive: P.alive };
      return { c: c2, gate: gate ? true : null };
    }
  };

  G.defense = defense;
})(typeof window !== 'undefined' ? window : globalThis);
