// The four needs and how they change (plain data, no logic). All values are per second at "normal" difficulty,
// on a 0..100 scale (100 = full: not hungry, not thirsty, rested, healthy).
// What an item does when used is in data/items.js (`use`). What a bed gives is in data/buildings.js (`sleep`).
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  G.data.needs = {
    max: 100,
    order: ['health', 'hunger', 'thirst', 'energy'],
    labels: { health: 'בריאות', hunger: 'שובע', thirst: 'שתייה', energy: 'אנרגיה', warmth: 'חום גוף' },   // warmth is not in `order`: it only matters in the cold (js/cold.js)
    start: { health: 100, hunger: 100, thirst: 100, energy: 100, warmth: 100 },
    drain: { hunger: 0.11, thirst: 0.17 },               // always dropping (about 15 and 10 minutes from full to empty)
    energyUse: { walk: 0.04, run: 0.45, gather: 0.3 },   // energy spent per second of that activity
    starve: { hunger: 0.45, thirst: 0.8 },               // health lost per second while that need is empty
    regen: { rate: 0.15, minHunger: 40, minThirst: 40 }, // health comes back slowly while fed and watered
    exhausted: { below: 12, speed: 0.62, gather: 0.6, attack: 0.6 },  // no energy: slower, cannot run, gathers slower, hits weaker (never dies of it)
    low: 25,                                             // warning threshold
    // Where the player wakes up after fainting (until stage 5 adds real combat deaths)
    revive: { health: 35, hunger: 40, thirst: 40, energy: 40 }
  };
})(typeof window !== 'undefined' ? window : globalThis);
