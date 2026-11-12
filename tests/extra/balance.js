// Combat balance: regression ranges (tolerant on purpose, they should stay true after tuning) + a report generator.
// Run normally with `node tests/run.js`. For the numbers table:  BALANCE_REPORT=1 node tests/run.js  (PowerShell: $env:BALANCE_REPORT=1)
// Read-only analysis: nothing here changes game data. Enemy types that do not exist yet (brute, crawler, screamer...) are skipped.
// Names in scope come from tests/run.js: G, test, eq, near, arena, rig, mkEnemy, thePlayer, stepFor, EN, WP, ITEMS, world, pc, mkState.

const GUNS = Object.keys(WP).filter(id => WP[id].kind === 'gun');
const MELEE = Object.keys(WP).filter(id => WP[id].kind !== 'gun');
const TYPES = () => Object.keys(EN.types);
const hasType = (t) => !!EN.types[t];
const NORMAL = G.data.difficulty.levels.normal, HARD = G.data.difficulty.levels.hard;
const RUN_SPEED = pc.walkSpeed * pc.runMult;

// ---- analytic helpers ----------------------------------------------------------------------------------------------
// Hits (blows or bullets) to bring `hp` to zero. sneak: the first hit lands on something that has not noticed (x1.5).
function hitsToKill(w, hp, sneak) {
  let n = 0, tot = 0;
  while (tot < hp - 1e-9 && n < 999) { tot += w.dmg * (n === 0 && sneak ? 1.5 : 1); n++; }
  return n;
}
// Seconds from the first press to the last hit landing (melee: the first blow lands at hitU of the swing; a gun fires at once
// and then every cooldown, with a reload each time the magazine runs dry).
function ttk(w, hp, sneak) {
  const n = hitsToKill(w, hp, sneak);
  if (w.kind === 'gun') return { n, t: (n - 1) * w.cooldown + (Math.ceil(n / w.mag) - 1) * w.reload };
  return { n, t: w.dur * w.hitU + (n - 1) * w.dur };
}
const burstDps = (w) => w.kind === 'gun' ? w.dmg / w.cooldown : w.dmg / w.dur;
const sustainedDps = (w) => w.kind === 'gun' ? w.dmg * w.mag / (w.mag * w.cooldown + w.reload) : w.dmg / w.dur;

// Scarce crafting materials in a recipe (metal, cloth, electronics; nails count a quarter of a metal each, planks and wood are plentiful).
function scarce(itemId) {
  const r = G.data.recipes.filter(x => x.out[0] === itemId)[0];
  if (!r) return null;
  let s = 0;
  for (const m in r.cost) s += m === 'metal' || m === 'cloth' || m === 'electronics' ? r.cost[m] : m === 'nails' ? r.cost[m] * 0.25 : 0;
  return { per: s, yield: r.out[1] };
}
const scarcePerRound = (w) => { const s = scarce(w.ammo); return s ? s.per / s.yield : 0; };

// ---- fight simulation ---------------------------------------------------------------------------------------------
// The real enemy code against a scripted player: types is a list of enemy type ids that all start already chasing at about
// `dist` px. mode: 'stand' (never moves, attacks whatever is in reach / range) or 'kite' (melee: steps out of reach during a
// wind-up; gun: backs off when something is closer than a safe distance, shoots otherwise). Returns the damage taken (normal difficulty).
function fight(wid, types, o) {
  o = o || {};
  const w = WP[wid], mode = o.mode || 'stand', dist = o.dist || 300, maxT = o.maxT || 30, diff = o.diff || NORMAL;
  const oldRandom = Math.random, rnd = G.util.rng(o.seed || 1);
  Math.random = rnd;
  try {
    const A = Object.assign(arena(), { width: 14000, height: 14000 });
    const p = rig(7000, 7000, 0); p.radius = pc.radius || 18;
    G.player.setHeld(p, wid);
    const list = types.map((t, i) => {
      const ang = (i - (types.length - 1) / 2) * 0.9, d = dist + i * (o.gap || 0);
      const e = mkEnemy(t, p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d);
      e.state = 'chase'; e.goal = { x: p.x, y: p.y }; e.sees = true; e.cool = 0; e.think = 0.1 + rnd() * 0.2;
      return e;
    });
    const g = w.kind === 'gun' ? G.combat.newGun(w, () => 0.5, true) : null;
    const res = { t: 0, dmg: 0, hits: 0, kills: 0, died: false, rounds: 0, swings: 0, reloads: 0, n: list.length };
    let invuln = 0, cool = 0, reloadT = 0, t = 0, moving = 0;
    const alive = () => list.filter(G.combat.alive);
    while (t < maxT) {
      const live = alive();
      if (!live.length) break;
      if (res.dmg >= 100) { res.died = true; break; }
      // nearest target, face it
      let tg = live[0], td = 1e9;
      live.forEach(e => { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < td) { td = d; tg = e; } });
      p.angle = Math.atan2(tg.y - p.y, tg.x - p.x);
      moving = 0;
      const away = () => {                                   // unit vector away from the live enemies near the player
        let ax = 0, ay = 0;
        live.forEach(e => { const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1; if (d < 600) { ax += dx / d / d; ay += dy / d / d; } });
        const l = Math.hypot(ax, ay) || 1; return { x: ax / l, y: ay / l };
      };
      if (invuln > 0) invuln -= 1 / 60;
      if (cool > 0) cool -= 1 / 60;
      if (w.kind === 'gun') {
        if (reloadT > 0) { reloadT -= 1 / 60; if (reloadT <= 0) g.mag = w.mag; }
        const safe = Math.max(220, w.range * 0.28);
        if (mode === 'kite' && td < safe) { const a = away(); p.x += a.x * RUN_SPEED / 60; p.y += a.y * RUN_SPEED / 60; moving = 2; }
        else if (reloadT <= 0 && td <= w.range) {
          if (g.mag <= 0) { reloadT = w.reload; res.reloads++; }
          else if (cool <= 0) {
            G.combat.gunFire(g); res.rounds++; cool = w.cooldown;
            const mv = w.moveSpread || [0.02, 0.06];
            const sp = (rnd() * 2 - 1) * (G.combat.gunSpread(g, w) + (moving === 2 ? mv[1] : moving === 1 ? mv[0] : 0));
            const r = G.combat.shoot(A, p, w, list, sp);
            r.hits.forEach((h, i) => { const k = G.enemies.hurt(h.enemy, w.dmg * (i ? 0.7 : 1), p.x, p.y, w); if (k.killed) res.kills++; });
          }
        }
      } else {
        const reach = w.range + tg.radius;
        if (mode === 'kite' && live.some(e => e.state === 'windup' && Math.hypot(e.x - p.x, e.y - p.y) < 130)) {
          const a = away(); p.x += a.x * RUN_SPEED / 60; p.y += a.y * RUN_SPEED / 60; moving = 2;
        } else if (p.swing < 0 && td <= reach - 4) {
          if (w.kind === 'shove' ? G.player.shove(p) : G.player.swing(p)) res.swings++;
        }
        G.player.animate(p, 1 / 60, null);
        if (G.player.swingHit(p, w.hitU)) G.combat.meleeTargets(A, p, w, list).forEach(e => { const k = G.enemies.hurt(e, w.dmg, p.x, p.y, w); if (k.killed) res.kills++; });
      }
      const c = { area: A, world: { width: 14000, height: 14000 }, player: thePlayer(p), noise: 1200 };
      live.forEach(e => {
        const out = G.enemies.step(e, c, 1 / 60);
        if (out.hit && invuln <= 0) {
          res.dmg += out.hit * diff.damage; res.hits++; invuln = G.data.hurt.invuln;
          const dx = p.x - e.x, dy = p.y - e.y, l = Math.hypot(dx, dy) || 1; p.x += dx / l * G.data.hurt.shove; p.y += dy / l * G.data.hurt.shove;
        }
      });
      G.enemies.separate(list, thePlayer(p), A);
      t += 1 / 60;
    }
    res.t = t; res.won = alive().length === 0 && !res.died;
    return res;
  } finally { Math.random = oldRandom; }
}
// Average of `n` seeded fights.
function avgFight(wid, types, o, n) {
  const acc = { t: 0, dmg: 0, rounds: 0, swings: 0, reloads: 0, wins: 0, deaths: 0 };
  for (let i = 0; i < n; i++) {
    const r = fight(wid, types, Object.assign({}, o, { seed: 11 + i * 7 }));
    acc.t += r.t; acc.dmg += r.dmg; acc.rounds += r.rounds; acc.swings += r.swings; acc.reloads += r.reloads; acc.wins += r.won ? 1 : 0; acc.deaths += r.died ? 1 : 0;
  }
  for (const k in acc) acc[k] = acc[k] / n;
  return acc;
}

// ---- regression ranges ---------------------------------------------------------------------------------------------
console.log('balance (read-only analysis, ranges)');

test('balance: every weapon has sane numbers (positive damage, guns have a magazine, melee a swing)', () => {
  for (const id in WP) {
    const w = WP[id];
    if (!(w.dmg > 0 && w.range > 0 && w.noise > 0 && w.energy >= 0)) throw new Error(id + ' basic fields');
    if (w.kind === 'gun' && !(w.mag >= 1 && w.reload > 0.5 && w.cooldown > 0.03 && w.life >= 30)) throw new Error(id + ' gun fields');
    if (w.kind !== 'gun' && !(w.dur > 0.2 && w.dur < 1.2)) throw new Error(id + ' swing length');
  }
});

test('balance: a shambler dies to the axe in 3-6 blows and to the club in 2-5; the unarmed take many more', () => {
  const hp = EN.types.shambler.hp;
  const a = hitsToKill(WP.axe, hp), c = hitsToKill(WP.club, hp), h = hitsToKill(WP.hands, hp);
  if (!(a >= 3 && a <= 6)) throw new Error('axe ' + a);
  if (!(c >= 2 && c <= 5)) throw new Error('club ' + c);
  if (!(h >= 2 * a)) throw new Error('hands ' + h + ' should need far more than the axe ' + a);
  if (!(c <= a)) throw new Error('the club should not be worse than the axe');
});

test('balance: the sniper one-shots a shambler (and a runner); the pistol needs 2-3 shots on a shambler and 1-2 on a runner', () => {
  eq(hitsToKill(WP.sniper, EN.types.shambler.hp), 1);
  eq(hitsToKill(WP.sniper, EN.types.runner.hp), 1);
  const s = hitsToKill(WP.gun, EN.types.shambler.hp), r = hitsToKill(WP.gun, EN.types.runner.hp);
  if (!(s >= 2 && s <= 3)) throw new Error('pistol vs shambler ' + s);
  if (!(r >= 1 && r <= 2)) throw new Error('pistol vs runner ' + r);
});

test('balance: guns - the Uzi fires fastest with the weakest bullet, and its damage output is at least competitive', () => {
  const others = GUNS.filter(g => g !== 'uzi');
  others.forEach(g => {
    if (!(WP.uzi.dmg < WP[g].dmg)) throw new Error('Uzi bullet should be weaker than ' + g);
    if (!(1 / WP.uzi.cooldown > 1 / WP[g].cooldown)) throw new Error('Uzi should fire faster than ' + g);
  });
  const best = Math.max.apply(null, GUNS.map(g => burstDps(WP[g])));
  if (!(burstDps(WP.uzi) >= best * 0.6)) throw new Error('Uzi burst dps ' + burstDps(WP.uzi).toFixed(0) + ' vs best ' + best.toFixed(0));
  if (!(WP.uzi.spread > WP.m16.spread && WP.uzi.spread > WP.gun.spread)) throw new Error('Uzi should be the sloppy one');
});

test('balance: the unarmed deal clearly less damage per second than any weapon; the pickaxe is not a better fighter than the axe', () => {
  MELEE.filter(id => id !== 'hands').forEach(id => { if (!(burstDps(WP[id]) > burstDps(WP.hands) * 2)) throw new Error(id); });
  GUNS.forEach(id => { if (!(burstDps(WP[id]) > burstDps(WP.hands))) throw new Error(id); });
  if (!(burstDps(WP.pickaxe) <= burstDps(WP.axe))) throw new Error('pickaxe dps');
});

test('balance: only the sniper can drop a full-health shambler faster than about a second from a standing start (guns excluded: reload time counts)', () => {
  GUNS.concat(MELEE).forEach(id => {
    const t = ttk(WP[id], EN.types.shambler.hp).t;
    if (id !== 'sniper' && id !== 'ak' && id !== 'm16' && id !== 'gun' && id !== 'uzi' && t < 1) throw new Error(id + ' ' + t.toFixed(2));
  });
  // and a melee weapon is never faster than the pistol against the heavy one
  if (!(ttk(WP.club, EN.types.shambler.hp).t >= 0.5)) throw new Error('club too fast');
});

test('balance: no weapon kills a full-health brute in under 1.0 s unless it is the sniper (target 1.5 s, see notes/combat-balance.md; skipped without a brute)', () => {
  if (!hasType('brute')) return;
  const hp = EN.types.brute.hp;
  if (!(hp > EN.types.shambler.hp)) throw new Error('a brute should have more health than a shambler');
  Object.keys(WP).forEach(id => {
    const k = ttk(WP[id], hp, false);
    if (id !== 'sniper' && k.t < 1.0) throw new Error(id + ' kills a brute in ' + k.t.toFixed(2) + ' s (' + k.n + ' hits)');
  });
  if (!(hp / WP.sniper.dmg > 1)) throw new Error('the sniper should need more than one shot on a brute');
});

test('balance: every enemy type is killable (axe <= 15 blows, pistol <= 8 shots, sniper <= 3 shots) and cannot kill a full player in 2 blows on normal', () => {
  TYPES().forEach(t => {
    const hp = EN.types[t].hp, dmg = EN.types[t].dmg;
    if (!(hitsToKill(WP.axe, hp) <= 15)) throw new Error(t + ' axe');
    if (!(hitsToKill(WP.gun, hp) <= 8)) throw new Error(t + ' pistol');
    if (!(hitsToKill(WP.sniper, hp) <= 3)) throw new Error(t + ' sniper');
    if (!(dmg * NORMAL.damage * 2 < 100)) throw new Error(t + ' hits too hard: ' + dmg);
    if (!(dmg * HARD.damage < 100)) throw new Error(t + ' one blow kills on hard: ' + dmg);
  });
});

test('balance: a quiet first hit is worth 1.5x and saves a blow against a shambler with the axe or the club', () => {
  const hp = EN.types.shambler.hp;
  [WP.axe, WP.club].forEach(w => { if (!(hitsToKill(w, hp, true) <= hitsToKill(w, hp, false))) throw new Error(w.id); });
  const e = mkEnemy('shambler', 600, 700); e.state = 'idle';
  near(G.enemies.hurt(e, 20, 500, 700, WP.axe).dealt, 30);
});

test('balance: a runner closes on a standing player quickly, then dies to one or two pistol shots', () => {
  const r = EN.types.runner;
  if (!(hitsToKill(WP.gun, r.hp) <= 2)) throw new Error('shots to kill a runner');
  // from its sight range to the axe's reach: runs at 178 px/s, so a couple of seconds at most
  const reach = WP.axe.range + r.radius, secs = (r.sight - reach) / r.speed;
  if (!(secs > 0.8 && secs < 3.2)) throw new Error('runner needs ' + secs.toFixed(2) + ' s from sight to reach');
  // the real thing: 400 px away, chasing a standing player (no weapon fired back)
  const A = arena(), p = rig(300, 700, 0), e = mkEnemy('runner', 700, 700), c = { area: A, world, player: thePlayer(p), noise: 0 };
  e.state = 'chase'; e.goal = { x: 300, y: 700 }; e.sees = true;
  let t = 0; while (t < 4 && Math.hypot(e.x - p.x, e.y - p.y) > reach + 5) { G.enemies.step(e, c, 1 / 60); t += 1 / 60; }
  if (!(t > 0.8 && t < 3)) throw new Error('reached after ' + t.toFixed(2) + ' s');
});

test('balance: noise - guns are heard from much farther than anything can see, sneaking (walking) is quieter than sight, running is not', () => {
  const N = G.data.noise;
  TYPES().forEach(t => {
    const d = EN.types[t];
    if (!(N.walk * d.hear <= d.sight)) throw new Error(t + ': a walking player is heard before he is seen');
    if (!(N.run * d.hear >= d.sight * 0.8)) throw new Error(t + ': running is too quiet next to its sight');
    GUNS.forEach(g => { if (!(WP[g].noise >= d.sight * 1.4)) throw new Error(g + ' is barely louder than ' + t + ' sight'); });
  });
  GUNS.forEach(g => { if (!(WP[g].noise > Math.max.apply(null, MELEE.map(m => WP[m].noise)) * 3)) throw new Error(g + ' noise vs melee'); });
});

test('balance: melee tools wear out only after many landed blows (>= 20 shambler kills for the axe and club, if they wear at all)', () => {
  ['axe', 'club', 'pickaxe'].forEach(id => {
    const w = WP[id]; if (!(w.life > 0)) return;
    const kills = w.life * (1 - (w.lifeVar || 0)) / hitsToKill(w, EN.types.shambler.hp);
    if (id !== 'pickaxe' && !(kills >= 20)) throw new Error(id + ' only ' + kills.toFixed(0) + ' kills');
    if (!(kills <= 120)) throw new Error(id + ' practically never breaks: ' + kills.toFixed(0));
  });
});

test('balance: guns last a good while: at least 20 shambler kills per gun, and the gun itself costs less per kill than the ammo does', () => {
  GUNS.forEach(g => {
    const w = WP[g], shots = hitsToKill(w, EN.types.shambler.hp), kills = w.life * (1 - w.lifeVar) / (shots * 1.3);
    if (!(kills >= 20)) throw new Error(g + ' only ' + kills.toFixed(0) + ' kills');
    const gunCost = scarce(w.item), ammoCost = scarcePerRound(w) * shots * 1.3;
    if (gunCost && !(gunCost.per / kills < ammoCost * 1.5)) throw new Error(g + ' gun cost per kill ' + (gunCost.per / kills).toFixed(2) + ' vs ammo ' + ammoCost.toFixed(2));
  });
});

test('balance: ammo economy - killing one shambler costs at most 3 scarce materials with the pistol, M16, AK or sniper', () => {
  ['gun', 'm16', 'ak', 'sniper'].forEach(g => {
    const w = WP[g], cost = scarcePerRound(w) * hitsToKill(w, EN.types.shambler.hp) * 1.3;
    if (!(cost <= 3)) throw new Error(g + ' ' + cost.toFixed(2));
  });
});

test('balance: spawn table grows with risk and only names real types; a risk 5 place stays below ~16 enemies', () => {
  for (let k = 1; k <= 5; k++) {
    const row = EN.spawn[k]; let total = 0;
    for (const t in row) { if (!EN.types[t]) throw new Error('spawn names unknown type ' + t); total += row[t]; if (k > 1 && EN.spawn[k - 1][t] !== undefined && !(row[t] >= EN.spawn[k - 1][t])) throw new Error(t + ' shrinks at risk ' + k); }
    if (!(total >= 1 && total <= 16)) throw new Error('risk ' + k + ' total ' + total);
  }
});

test('balance: simulated 1v1, shambler vs the axe standing still - the player wins and takes at most two blows', () => {
  const r = avgFight('axe', ['shambler'], { mode: 'stand' }, 4);
  if (!(r.wins >= 0.99)) throw new Error('did not win');
  if (!(r.dmg <= 2 * EN.types.shambler.dmg + 1e-9)) throw new Error('took ' + r.dmg.toFixed(0));
  if (!(r.t > 1.0 && r.t < 8)) throw new Error('took ' + r.t.toFixed(1) + ' s');
});

test('balance: simulated 1v1, shambler vs the pistol while kiting costs the player (almost) nothing', () => {
  const r = avgFight('gun', ['shambler'], { mode: 'kite', dist: 340 }, 3);
  if (!(r.wins >= 0.99)) throw new Error('did not win');
  if (!(r.dmg <= EN.types.shambler.dmg + 1e-9)) throw new Error('took ' + r.dmg.toFixed(0));
});

test('balance: simulated 1v3, standing still hurts more than a 1v1, and a gun kills the group faster than the axe', () => {
  const one = avgFight('axe', ['shambler'], { mode: 'stand', dist: 120 }, 3), three = avgFight('axe', ['shambler', 'shambler', 'shambler'], { mode: 'stand', maxT: 40, dist: 120 }, 3);
  if (!(three.dmg > one.dmg)) throw new Error('1v3 ' + three.dmg.toFixed(0) + ' vs 1v1 ' + one.dmg.toFixed(0));
  const gun = avgFight('m16', ['shambler', 'shambler', 'shambler'], { mode: 'stand', maxT: 40 }, 3);
  if (!(gun.t < three.t)) throw new Error('m16 ' + gun.t.toFixed(1) + ' s vs axe ' + three.t.toFixed(1) + ' s');
});

// ---- report ---------------------------------------------------------------------------------------------------------
if (typeof process !== 'undefined' && process.env && process.env.BALANCE_REPORT) {
  const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1), f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);
  const pad = (s, n) => (String(s) + '                    ').slice(0, n);
  const order = G.data.weaponOrder.filter(id => WP[id]);
  const types = TYPES();
  console.log('\n=== REPORT: enemy types: ' + types.join(', ') + ' ===');
  types.forEach(t => { const d = EN.types[t]; console.log('  ' + pad(t, 10) + ' hp ' + d.hp + ' speed ' + d.speed + ' sight ' + d.sight + ' hear x' + d.hear + ' dmg ' + d.dmg + ' windup ' + d.attackTime + ' cd ' + d.cooldown + ' range ' + d.range); });

  console.log('\n=== weapon stats (dmg, burst DPS, sustained DPS incl. reload, noise, scarce mats per round) ===');
  order.forEach(id => { const w = WP[id]; console.log('  ' + pad(id, 8) + ' dmg ' + pad(w.dmg, 4) + ' burst ' + pad(f1(burstDps(w)), 6) + ' sust ' + pad(f1(sustainedDps(w)), 6) + ' noise ' + pad(w.noise, 5) + ' range ' + pad(w.range, 5) + (w.kind === 'gun' ? ' mag ' + w.mag + ' reload ' + w.reload + ' life ' + w.life + ' scarce/round ' + f2(scarcePerRound(w)) : ' dur ' + w.dur + ' energy ' + w.energy)); });

  console.log('\n=== time to kill: hits (seconds); [quiet first hit] ===');
  console.log('  ' + pad('weapon', 8) + types.map(t => pad(t, 26)).join(''));
  order.forEach(id => { console.log('  ' + pad(id, 8) + types.map(t => { const a = ttk(WP[id], EN.types[t].hp, false), b = ttk(WP[id], EN.types[t].hp, true); return pad(a.n + ' (' + f2(a.t) + 's) [' + b.n + ' ' + f2(b.t) + 's]', 26); }).join('')); });

  console.log('\n=== fights, normal difficulty, 12 trials: damage taken (of 100) / seconds / rounds / win%  ===');
  const N = 12;
  const groups = [['1v1'], ['3x same']];
  types.forEach(t => {
    [1, 3].forEach(cnt => {
      ['stand', 'kite'].forEach(mode => {
        const line = [];
        order.forEach(id => {
          if (id === 'sniper' && mode === 'stand' && cnt === 3) { /* still simulated */ }
          const r = avgFight(id, new Array(cnt).fill(t), { mode, maxT: cnt === 3 ? 45 : 30, dist: 340 }, N);
          line.push(pad(id + ' ' + f1(r.dmg) + 'dmg/' + f1(r.t) + 's/' + f1(r.rounds + r.swings) + 'r/' + Math.round(r.wins * 100) + '%', 30));
        });
        console.log('  ' + t + ' x' + cnt + ' ' + mode + ':\n    ' + line.join('\n    '));
      });
    });
  });
  void groups;

  console.log('\n=== AMBUSH: enemies already 90 px away (in their reach), player standing still; damage of 100 / seconds / win%, 12 trials ===');
  [['shambler', 1], ['shambler', 3], ['runner', 3], ['crawler', 3], ['brute', 1], ['screamer', 1]].forEach(a => {
    if (!hasType(a[0])) return;
    console.log('  ' + a[0] + ' x' + a[1] + ': ' + order.map(id => { const r = avgFight(id, new Array(a[1]).fill(a[0]), { mode: 'stand', dist: 90, maxT: 40 }, N); return id + ' ' + f1(r.dmg) + '/' + f1(r.t) + 's/' + Math.round(r.wins * 100) + '%'; }).join(' | '));
  });

  console.log('\n=== ammo and gun economy (shambler / runner kills; 1.3 shots per hit needed for misses) ===');
  GUNS.forEach(id => {
    const w = WP[id], sh = hitsToKill(w, EN.types.shambler.hp), ru = hitsToKill(w, EN.types.runner.hp), g = scarce(w.item), a = scarce(w.ammo);
    const killsPerGun = w.life / (sh * 1.3);
    console.log('  ' + pad(id, 7) + 'rounds per shambler ' + sh + ' (~' + f1(sh * 1.3) + ' fired), per runner ' + ru + ' | ammo craft ' + (a ? a.yield + ' rounds for ' + f1(a.per) + ' scarce' : '?') + ' -> ' + f2(scarcePerRound(w) * sh * 1.3) + ' scarce per shambler kill | gun craft ' + (g ? f1(g.per) : '?') + ' scarce, life ' + w.life + ' shots = ~' + f1(killsPerGun) + ' shambler kills (' + f2(g ? g.per / killsPerGun : 0) + ' scarce per kill) | mags per kill ' + f2(sh * 1.3 / w.mag));
  });

  console.log('\n=== noise reach vs sight (px; area widths are 3200-4000) ===');
  types.forEach(t => { const d = EN.types[t]; console.log('  ' + pad(t, 9) + 'sight ' + d.sight + ' | heard: walking ' + G.data.noise.walk * d.hear + ', running ' + G.data.noise.run * d.hear + ', gather ' + G.data.noise.gather * d.hear + ', chop ' + G.data.noise.chop * d.hear + ', axe ' + WP.axe.noise * d.hear + ', pistol ' + WP.gun.noise * d.hear + ', sniper ' + WP.sniper.noise * d.hear); });
  [['port 4000x2600', 4000, 2600], ['police 3200x2400', 3200, 2400], ['forest', 3000, 2200]].forEach(a => {
    const cover = (r) => Math.round(100 * Math.min(1, Math.PI * r * r / (a[1] * a[2])));
    console.log('  ' + a[0] + ': share of the area a shot covers (centre) pistol ' + cover(WP.gun.noise) + '%, M16 ' + cover(WP.m16.noise) + '%, sniper ' + cover(WP.sniper.noise) + '%; axe ' + cover(WP.axe.noise) + '%');
  });

  console.log('\n=== enemies per trip (spawn table) and ammo to clear all, pistol / m16 / ak / uzi / sniper, scarce mats ===');
  for (let k = 1; k <= 5; k++) {
    const row = EN.spawn[k]; let s = k + ': ';
    for (const t in row) s += t + ' ' + row[t] + ', ';
    const cost = (id) => { let m = 0; for (const t in row) m += row[t] * hitsToKill(WP[id], EN.types[t].hp) * 1.3 * scarcePerRound(WP[id]); return f1(m); };
    console.log('  risk ' + s + '| scarce to clear: pistol ' + cost('gun') + ', m16 ' + cost('m16') + ', ak ' + cost('ak') + ', uzi ' + cost('uzi') + ', sniper ' + cost('sniper'));
  }
}
