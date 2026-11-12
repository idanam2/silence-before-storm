// Melee wear: axe, club and pickaxe break after a number of blows that LAND (js/combat.js meleeWear & co).
console.log('melee wear');
const MELEE = ['axe', 'club', 'pickaxe'];

test('melee wear: data has life and lifeVar for every melee tool, none for hands', () => {
  for (const id of MELEE) {
    if (!(WP[id].life >= 50 && WP[id].life <= 250)) throw new Error(id + ' life ' + WP[id].life);
    if (!(WP[id].lifeVar > 0 && WP[id].lifeVar < 0.6)) throw new Error(id + ' lifeVar');
  }
  eq(WP.hands.life, undefined);
  eq(G.combat.wears(WP.hands), false); eq(G.combat.wears(WP.gun), false); eq(G.combat.wears(WP.axe), true);
  if (!(WP.club.life < WP.axe.life && WP.axe.life < WP.pickaxe.life)) throw new Error('order: the nailed club breaks first');
});

test('melee wear: rolled life stays within +-lifeVar and is an integer', () => {
  for (const id of MELEE) {
    const w = WP[id], lo = G.combat.newWearLife(w, () => 0), hi = G.combat.newWearLife(w, () => 1), mid = G.combat.newWearLife(w, () => 0.5);
    eq(mid, w.life);
    eq(lo, Math.round(w.life * (1 - w.lifeVar))); eq(hi, Math.round(w.life * (1 + w.lifeVar)));
    for (let i = 0; i < 200; i++) {
      const v = G.combat.newWearLife(w, Math.random);
      if (!Number.isInteger(v) || v < w.life * (1 - w.lifeVar) - 1 || v > w.life * (1 + w.lifeVar) + 1) throw new Error(id + ' ' + v);
    }
  }
});

test('melee wear: counts landed blows, rolls life on the first one, breaks exactly at life and starts fresh', () => {
  const w = WP.axe, wear = {}, life = {};
  eq(G.combat.meleeCondition(wear, life, w), 1);                     // nothing rolled yet = new
  eq(G.combat.meleeWear(wear, life, w, () => 0.5), 'ok');
  eq(life.axe, w.life); eq(wear.axe, 1);
  for (let i = 2; i < w.life; i++) eq(G.combat.meleeWear(wear, life, w, () => 0.5), 'ok');
  eq(wear.axe, w.life - 1);
  eq(G.combat.meleeWear(wear, life, w, () => 0.5), 'broke');         // the life-th blow is the last
  eq(wear.axe, undefined); eq(life.axe, undefined);
  eq(G.combat.meleeWear(wear, life, w, () => 0), 'ok');              // a new axe: fresh count, freshly rolled life
  eq(wear.axe, 1); eq(life.axe, Math.round(w.life * (1 - w.lifeVar)));
});

test('melee wear: the maps stay plain integers keyed by weapon id (the save contract)', () => {
  const wear = {}, life = {};
  for (const id of MELEE) G.combat.meleeWear(wear, life, WP[id], Math.random);
  eq(JSON.stringify(Object.keys(wear).sort()), JSON.stringify(['axe', 'club', 'pickaxe']));
  const back = JSON.parse(JSON.stringify({ wear, life }));
  for (const id of MELEE) { eq(Number.isInteger(back.wear[id]), true); eq(Number.isInteger(back.life[id]), true); }
});

test('melee wear: hands and guns never wear', () => {
  const wear = {}, life = {};
  for (let i = 0; i < 500; i++) { eq(G.combat.meleeWear(wear, life, WP.hands, Math.random), 'none'); eq(G.combat.meleeWear(wear, life, WP.gun, Math.random), 'none'); }
  eq(Object.keys(wear).length, 0); eq(Object.keys(life).length, 0);
  eq(G.combat.meleeCondition(wear, life, WP.hands), 1);
});

test('melee wear: condition goes 1 -> 0 linearly with the blows', () => {
  const w = WP.club, wear = { club: 0 }, life = { club: 90 };
  near(G.combat.meleeCondition(wear, life, w), 1);
  wear.club = 45; near(G.combat.meleeCondition(wear, life, w), 0.5);
  wear.club = 72; near(G.combat.meleeCondition(wear, life, w), 0.2);
  wear.club = 89; near(G.combat.meleeCondition(wear, life, w), 1 / 90);
  wear.club = 500; eq(G.combat.meleeCondition(wear, life, w), 0);     // never negative
});

test('melee wear: damage is full down to 30%, then falls linearly to -25% at 0', () => {
  const m = G.combat.wearDamageMult;
  eq(m(1), 1); eq(m(0.5), 1); eq(m(0.3), 1);
  near(m(0.15), 1 - 0.25 * 0.5); near(m(0), 0.75); near(m(-1), 0.75);
  if (!(m(0.25) < 1 && m(0.25) > m(0.1))) throw new Error('not monotone');
});

test('melee wear: a fight with a real axe, only landed blows count, swings in the air do not', () => {
  const A = arena(), p = rig(500, 700, 0), w = WP.axe, wear = {}, life = {};
  const e = mkEnemy('shambler', 550, 700); e.hp = 1e6; e.maxHp = 1e6;
  const blow = (target) => {
    G.player.setHeld(p, 'axe'); p.swing = -1; G.player.swing(p);
    let landed = 0;
    for (let i = 0; i < 80; i++) {
      G.player.animate(p, 1 / 60, null);
      if (G.player.swingHit(p, w.hitU)) {
        const list = G.combat.meleeTargets(A, p, w, target);
        if (list.length) { G.combat.meleeWear(wear, life, w, () => 0.5); landed++; }
      }
    }
    return landed;
  };
  eq(blow([]), 0); eq(wear.axe, undefined);                          // air: nothing counted
  eq(blow([mkEnemy('shambler', 1500, 700)]), 0); eq(wear.axe, undefined);   // out of reach
  eq(blow([e]), 1); eq(wear.axe, 1);
  eq(blow([e]), 1); eq(wear.axe, 2);
});

test('melee wear: two enemies hit by one swing is still one blow (checked in the game loop: one wear per swing)', () => {
  const A = arena(), p = rig(500, 700, 0), w = WP.axe;
  const two = [mkEnemy('shambler', 550, 690), mkEnemy('shambler', 550, 715)];
  eq(G.combat.meleeTargets(A, p, w, two).length, 2);
  const wear = {}, life = {}; G.combat.meleeWear(wear, life, w, () => 0.5);
  eq(wear.axe, 1);
});

test('melee wear: pruning forgets tools that are gone from bag and chest, keeps the rest', () => {
  const wear = { axe: 10, club: 5 }, life = { axe: 100, club: 80, pickaxe: 150 };
  const have = { axe: 1, pickaxe: 1 };
  G.combat.wearPrune(wear, life, (item) => have[item] || 0);
  eq(JSON.stringify(wear), JSON.stringify({ axe: 10 }));
  eq(JSON.stringify(life), JSON.stringify({ axe: 100, pickaxe: 150 }));
  G.combat.wearPrune(wear, { bogus: 3 }, () => 5);                   // unknown ids are dropped too
});

test('melee wear: save cleaning keeps integers, drops junk, never leaves a tool already broken', () => {
  const c = G.combat.wearClean({ axe: 7.9, club: 9999, nope: 3, pickaxe: -4, hands: 2 }, { axe: 120, club: 90, nope: 5, pickaxe: 150, hands: 10 });
  eq(c.wear.axe, 7); eq(c.life.axe, 120);
  eq(c.wear.club, 89);                                               // clamped below life
  eq(c.wear.pickaxe, undefined); eq(c.life.pickaxe, 150);            // negative wear dropped, life kept
  eq(c.wear.nope, undefined); eq(c.life.nope, undefined); eq(c.life.hands, undefined);
  const bad = G.combat.wearClean('junk', null);
  eq(Object.keys(bad.wear).length + Object.keys(bad.life).length, 0);
  eq(G.combat.wearClean({ axe: 5 }, { axe: 'x' }).wear.axe, undefined);
  eq(G.combat.wearClean({}, { axe: 99999 }).life.axe, WP.axe.life * 3);   // absurd life is capped
});
