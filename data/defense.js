// Base defense numbers (plain data, no logic). Logic and the design notes: js/defense.js.
// noise: every loud action of a trip (a burst of radius r px, see G.combat.addBurst) adds (r / 1000) ^ burstPower "noise units";
//   a kill adds killNoise. So a pistol shot is ~1.2, a chop ~0.07, a swing ~0.05, gathering ~0.01: guns matter, melee hardly.
// chance: below `quiet` units a trip never brings a raid. Above it the chance is minChance, plus perUnit for each unit over
//   `free`, at most maxChance, then multiplied by the fence's factor.
// fence: chance factor by fence level (0 = none). gateLevel: from this level the north gate holds (raiders must break it).
// count: how many follow (thresholds on the noise units). runner: from `from` units each raider is a runner with `chance`.
// delay: seconds after arriving home before they show up. cooldownTrips: trips after a raid on which none can come.
// gate: hp of the closed gate and how much of a raider's blow it takes. spawn: raiders appear `dy` px north of the trailhead.
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  G.data.defense = {
    noise: { burstPower: 2, killNoise: 0.3 },
    chance: { quiet: 0.5, free: 2, minChance: 0.03, perUnit: 0.06, maxChance: 0.7 },
    fence: { factor: { 0: 1, 1: 0.75, 2: 0.35, 3: 0.22, 4: 0.12 }, gateLevel: 2 },
    count: [{ from: 0, n: 1 }, { from: 6, n: 2 }, { from: 14, n: 3 }],
    runner: { from: 6, chance: 0.35 },
    delay: [3.5, 6.5],
    cooldownTrips: 1,
    gate: { hp: 220, blowMult: 1, thick: 12 },       // thick = the fence thickness (T in js/base.js)
    spawn: { dy: 280, spread: 55, minFromPlayer: 160 }
  };
})(typeof window !== 'undefined' ? window : globalThis);
