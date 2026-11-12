// The infected (plain data, no logic). Logic: js/enemies.js. They are drawn with the player's own body rig
// (js/player.js) in a different palette (look) and posture.
// hp: health. speed: px/s while chasing (the player walks at 150 and runs at 247). wander: share of the speed while idle.
// radius: body radius for collision. scale: figure size. mass: divides knock-back. stunMult: scales how long a blow staggers it.
// sight: how far it notices the player in line of sight (px). hear: multiplier on the player's noise radius.
// range: reach of its blow (px from the body edge). dmg: damage to the player (before the difficulty). attackTime: seconds
// for one blow, hitU: where in it the blow lands (before that the player can step away). cooldown: pause after a blow.
// lunge: share of the speed it keeps moving toward the player while winding up. stride: leg speed against the speed.
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  G.data.enemies = {
    types: {
      // slow and sturdy: a heavy blow, easy to outwalk, dangerous in groups
      shambler: { id: 'shambler', name: 'דומם', look: 'shambler', hp: 72, speed: 66, wander: 0.4, radius: 15, scale: 1.03, mass: 1.0, stunMult: 1,
                  sight: 340, hear: 1, range: 20, dmg: 16, attackTime: 1.0, hitU: 0.58, cooldown: 0.7, lunge: 0.15 },
      // fast and fragile: faster than a walking player, much weaker, goes down in a blow or two
      runner:   { id: 'runner', name: 'דומם רץ', look: 'runner', hp: 30, speed: 178, wander: 0.35, radius: 13, scale: 0.97, mass: 0.7, stunMult: 1.5,
                  sight: 430, hear: 1.25, range: 18, dmg: 8, attackTime: 0.62, hitU: 0.5, cooldown: 0.45, lunge: 0.5 },
      // huge and slow: very high hp, a long wind-up and a crushing blow (4 of them kill on normal), hardly pushed (mass) or staggered
      // (stunMult). Easy to dodge if you watch the wind-up, deadly if you trade blows. Only outdoors (too big for rooms).
      brute:    { id: 'brute', name: 'ענק', look: 'brute', hp: 276, speed: 54, wander: 0.35, radius: 21, scale: 1.25, mass: 3.4, stunMult: 0.25,
                  sight: 320, hear: 0.9, range: 30, dmg: 31, attackTime: 1.7, hitU: 0.72, cooldown: 1.3, lunge: 0.05, indoor: false },
      // low and quick, hard to see coming: short sight, goes for the legs (small, fast blows)
      crawler:  { id: 'crawler', name: 'זוחל', look: 'crawler', hp: 22, speed: 135, wander: 0.5, radius: 9, scale: 0.72, mass: 0.6, stunMult: 1.2,
                  sight: 190, hear: 0.8, range: 13, dmg: 5, attackTime: 0.4, hitU: 0.5, cooldown: 0.3, lunge: 0.6 },
      // weak, but notices from far and screams: every infected within scream.radius px comes to where the player is
      // (the event {type:'scream', x, y, radius, e} is for the game to draw / play). scream.time: how long it screams.
      screamer: { id: 'screamer', name: 'צורח', look: 'screamer', hp: 26, speed: 88, wander: 0.4, radius: 12, scale: 0.95, mass: 0.8, stunMult: 1.3,
                  sight: 700, hear: 1.6, range: 16, dmg: 6, attackTime: 0.8, hitU: 0.55, cooldown: 0.8, lunge: 0.2,
                  scream: { radius: 600, time: 1.0 } }
    },
    // How many of each in an outdoor destination, by the destination's risk (data/world.js). Every visit rolls the exact
    // number again (a little fewer or more) and the places, so no two trips are the same. Brutes only from risk 3,
    // crawlers and screamers from risk 2. The list is cut to maxPerArea (the plain shamblers go first).
    spawn: {
      1: { shambler: 2, runner: 0, brute: 0, crawler: 0, screamer: 0 },
      2: { shambler: 3, runner: 1, brute: 0, crawler: 1, screamer: 1 },
      3: { shambler: 4, runner: 2, brute: 1, crawler: 1, screamer: 1 },
      4: { shambler: 4, runner: 3, brute: 1, crawler: 2, screamer: 1 },
      5: { shambler: 5, runner: 3, brute: 2, crawler: 2, screamer: 1 }
    },
    maxPerArea: 12,
    interiorFactor: 0.45,          // inside a building: this share of the outdoor numbers (at least one on high-risk floors)
    avoidSpawn: 560,               // nothing starts closer than this to where the player arrives
    corpseLimit: 40
  };
})(typeof window !== 'undefined' ? window : globalThis);
