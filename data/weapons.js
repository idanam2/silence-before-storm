// What the player can hold and what it does in a fight (plain data, no logic). Logic: js/combat.js.
// The key is what the body shows in its hands (see js/player.js: hands, axe, club, pickaxe, gun).
// item: the inventory item that must be in the backpack to hold it (null = nothing needed).
// dmg: damage per blow / shot. range: reach of a blow in px from the body (melee) or of a shot (gun).
// arc: width of a melee blow in radians. targets: how many enemies one blow can hit.
// knock: push-back speed (px/s, decays quickly). stun: seconds an enemy staggers. energy: energy spent per use
// (times the difficulty's energy multiplier). noise: how far the sound of it carries (px), see enemies' hearing.
// dur / hitU: melee swing length in seconds and where in it the blow lands (js/player.js DUR and the poses).
// gun only: ammo (item id used up, one per shot), cooldown (seconds between shots), spread (radians), height (px above
// the ground where the bullet flies: the chest of a standing body). Magazine, wear and aim tolerance: see the guns below.
// melee tools (axe, club, pickaxe) wear out: life = how many blows that LAND on an enemy (not swings in the air) this tool
// takes before it breaks, each tool +-lifeVar (a fraction, rolled once per tool). Hands never wear. The state is in the game
// state as plain integer maps: st.wear = { weaponId: blows landed }, st.wearLife = { weaponId: its rolled life }.
// G.data.wear (below): under condition `from` (1 = new, 0 = breaking) the tool hits up to `loss` weaker (linear).
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  G.data.weapons = {
    hands:   { id: 'hands',   name: 'ידיים',  item: null,      kind: 'shove', dmg: 4,  range: 50, arc: 1.9, targets: 1, knock: 420, stun: 0.55, dur: 0.34, hitU: 0.5,  energy: 0.5, noise: 110 },
    axe:     { id: 'axe',     name: 'גרזן',   item: 'axe',     kind: 'melee', dmg: 24, range: 64, arc: 1.7, targets: 2, knock: 230, stun: 0.45, dur: 0.46, hitU: 0.52, energy: 1.3, noise: 220, life: 120, lifeVar: 0.3 },
    club:    { id: 'club',    name: 'אלה',    item: 'club',    kind: 'melee', dmg: 32, range: 68, arc: 1.9, targets: 2, knock: 320, stun: 0.6,  dur: 0.5,  hitU: 0.52, energy: 1.6, noise: 230, life: 90,  lifeVar: 0.3 },   // nailed together: breaks first
    pickaxe: { id: 'pickaxe', name: 'מכוש',   item: 'pickaxe', kind: 'melee', dmg: 20, range: 60, arc: 1.4, targets: 1, knock: 170, stun: 0.4,  dur: 0.52, hitU: 0.52, energy: 1.5, noise: 220, life: 160, lifeVar: 0.3 },
    // ---- guns ---------------------------------------------------------------------------------------------------
    // mag: rounds per magazine. reload: seconds. reloadNoise: how far the clack carries. life: shots until it breaks
    // (each gun +-lifeVar), wearSpread: extra spread when worn out. aim: forgiving aim, a bullet counts as a hit this far (px)
    // from the body's middle (mult x body radius + add + grow x distance). auto: false = one shot per click.
    // moveSpread: [walking, running] extra spread (radians). pierce: how many enemies one bullet can go through.
    gun:     { id: 'gun',     name: 'אקדח',        item: 'pistol', kind: 'gun', dmg: 36, range: 780,  targets: 1, knock: 150, stun: 0.3,  energy: 0.3,  noise: 1100,
               ammo: 'ammo',     cooldown: 0.42, spread: 0.018, height: 16, mag: 8,  reload: 1.7, reloadNoise: 150, life: 150, lifeVar: 0.3, wearSpread: 1.2,
               aim: { mult: 1.2, add: 11, grow: 0.045 } },
    uzi:     { id: 'uzi',     name: 'עוזי',        item: 'uzi',    kind: 'gun', dmg: 14, range: 600,  targets: 1, knock: 70,  stun: 0.18, energy: 0.15, noise: 1000,
               ammo: 'ammo',     cooldown: 0.085, spread: 0.05,  height: 16, mag: 25, reload: 1.9, reloadNoise: 170, life: 420, lifeVar: 0.3, wearSpread: 1.3,
               aim: { mult: 1.25, add: 12, grow: 0.05 }, moveSpread: [0.012, 0.03] },
    m16:     { id: 'm16',     name: 'M16',         item: 'm16',    kind: 'gun', dmg: 27, range: 900,  targets: 1, knock: 110, stun: 0.22, energy: 0.2,  noise: 1250,
               ammo: 'ammo_556', cooldown: 0.13,  spread: 0.016, height: 17, mag: 30, reload: 2.3, reloadNoise: 180, life: 330, lifeVar: 0.3, wearSpread: 1.2,
               aim: { mult: 1.2, add: 11, grow: 0.04 }, moveSpread: [0.018, 0.05] },
    ak:      { id: 'ak',      name: 'קלצ׳ניקוב',   item: 'ak47',   kind: 'gun', dmg: 34, range: 820,  targets: 1, knock: 190, stun: 0.3,  energy: 0.25, noise: 1300,
               ammo: 'ammo_762', cooldown: 0.15,  spread: 0.032, height: 17, mag: 30, reload: 2.4, reloadNoise: 190, life: 520, lifeVar: 0.3, wearSpread: 0.7,
               aim: { mult: 1.2, add: 11, grow: 0.045 }, moveSpread: [0.02, 0.055] },   // rugged: wears out slowly and keeps shooting when old
    sniper:  { id: 'sniper',  name: 'רובה צלפים',  item: 'sniper', kind: 'gun', dmg: 92, range: 1500, targets: 1, knock: 340, stun: 0.6,  energy: 0.45, noise: 1600,
               ammo: 'ammo_762', cooldown: 1.25,  spread: 0.004, height: 17, mag: 5,  reload: 3.2, reloadNoise: 200, life: 100, lifeVar: 0.3, wearSpread: 1.5,
               aim: { mult: 1.1, add: 9, grow: 0.022 }, moveSpread: [0.05, 0.12], auto: false, pierce: 2 }
  };

  // Melee wear: the warning shows at or below `warn` condition; damage falls off below `from` by up to `loss`.
  G.data.wear = { warn: 0.2, from: 0.3, loss: 0.25 };

  // Number keys: which weapon each one picks up (only if it is in the backpack; hands always work). Q cycles through the ones you have.
  G.data.weaponKeys = { Digit1: 'hands', Digit2: 'axe', Digit3: 'club', Digit4: 'gun', Digit5: 'pickaxe', Digit6: 'uzi', Digit7: 'm16', Digit8: 'ak', Digit9: 'sniper' };
  G.data.weaponOrder = ['hands', 'axe', 'club', 'pickaxe', 'gun', 'uzi', 'm16', 'ak', 'sniper'];

  // How loud the player is just by moving (px): standing still is silent. Bursts (swings, shots, chopping) come from the weapon / resource.
  G.data.noise = { walk: 130, run: 400, gather: 90, chop: 260, burstSeconds: 0.7 };

  // Getting hit: seconds of invulnerability after a blow, so two infected cannot chain a player to death in one second.
  G.data.hurt = { invuln: 0.55, flash: 1, shove: 22 };
})(typeof window !== 'undefined' ? window : globalThis);
