// The infected: spawning, senses, behavior and taking damage. Pure logic (no DOM), unit-tested in Node.
// An enemy IS a player-rig figure (G.player.create) with a few extra fields, so it walks, turns, strikes and falls with the
// same animated body as the player (js/player.js); only its palette (look) and posture differ. Numbers: data/enemies.js.
//
// States: idle (stands), wander (ambles near its spot), investigate (walks to a sound), chase (goes for the player),
// windup (one blow: the player can step away before it lands), stagger (just hit), dying (collapsing), dead (corpse).
(function (root) {
  'use strict';
  var G = root.G, TAU = Math.PI * 2;
  var ZERO = { x: 0, y: 0, run: false };
  var mv = { x: 0, y: 0, run: false };
  var cfg = { walkSpeed: 0, runMult: 1, strideMult: 1 };

  function D() { return G.data.enemies; }
  function def(e) { return D().types[e.type]; }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function hash(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h >>> 0; }

  // A free place for a body of radius r: not in water, walls, furniture, trunks, near an exit / door or the avoid circle.
  function spot(area, r, rand, avoid) {
    var fp = area.footprint;
    var x0 = fp ? fp.x + 70 : 190, x1 = fp ? fp.x + fp.w - 70 : area.width - 190;
    var y0 = fp ? fp.y + 70 : 190, y1 = fp ? fp.y + fp.h - 70 : area.height - 190;
    var sn = area.nodes.filter(function (n) { return n.solid > 0 && !n.dead; });
    for (var t = 0; t < 120; t++) {
      var x = x0 + rand() * (x1 - x0), y = y0 + rand() * (y1 - y0), i, bad = false;
      if (avoid && dist(x, y, avoid.x, avoid.y) < avoid.r) continue;
      if (G.area.inWater(area, x, y, r + 30) || G.area.inSolid(area, x, y, r + 16)) continue;
      for (i = 0; i < sn.length && !bad; i++) if (dist(x, y, sn[i].x, sn[i].y) < sn[i].solid + r + 14) bad = true;
      if (area.exit && dist(x, y, area.exit.x, area.exit.y) < area.exit.r + 140) bad = true;
      for (i = 0; area.doors && i < area.doors.length && !bad; i++) if (dist(x, y, area.doors[i].x, area.doors[i].y) < area.doors[i].r + 90) bad = true;
      if (!bad) return { x: x, y: y };
    }
    return null;
  }

  var enemies = {
    // A new infected at (x, y). rand: a random function (looks and timers differ per body).
    create: function (type, x, y, rand) {
      var d = D().types[type];
      var e = G.player.create(x, y, { radius: d.radius, walkSpeed: d.speed, runMult: 1 });
      e.kind = 'enemy'; e.type = type;
      e.look = d.look; e.variant = Math.floor(rand() * 1000); e.scale = d.scale || 1; e.atkHit = d.hitU; e.fallDir = rand() < 0.5 ? 1 : -1;
      e.hp = e.maxHp = d.hp;
      e.state = 'idle'; e.t = rand() * 2.5; e.stun = 0; e.cool = 0; e.think = rand() * 0.25; e.sinceHit = 99; e.alertT = 0;
      e.home = { x: x, y: y }; e.goal = null; e.sees = false; e.lostT = 0; e.atkDone = false;
      e.kvx = 0; e.kvy = 0; e.side = 0; e.sideT = 0; e.chk = 0; e.cx = x; e.cy = y;
      e.screamed = false; e.screaming = false; e.screamPending = false;
      G.player.settle(e, rand() * TAU - Math.PI);
      return e;
    },

    // How many of each type for an area (a list of type names). rand: random function.
    plan: function (area, risk, rand) {
      var table = area.enemyPlan || D().spawn[Math.max(1, Math.min(5, Math.floor(risk) || 1))], out = [], type, n, i;   // enemyPlan: a hand-made mix for one area
      for (type in table) {
        if (area.interior && D().types[type].indoor === false) continue;       // too big for rooms
        n = area.interior ? Math.floor(table[type] * D().interiorFactor + rand()) : Math.round(table[type] * (0.8 + rand() * 0.5));
        for (i = 0; i < n; i++) out.push(type);
      }
      var cap = D().maxPerArea || 99;
      while (out.length > cap) { i = out.lastIndexOf('shambler'); out.splice(i >= 0 ? i : out.length - 1, 1); }
      return out;
    },

    // Everything that is not already busy with the player (idle, wandering, investigating) within `radius` of (x, y) goes
    // to (gx, gy). `except`: the one who made the noise. Returns how many were alerted.
    alertAround: function (list, x, y, radius, gx, gy, except, events) {
      var n = 0, i, q;
      for (i = 0; i < list.length; i++) {
        q = list[i];
        if (q === except || (q.state !== 'idle' && q.state !== 'wander' && q.state !== 'investigate')) continue;
        if (dist(q.x, q.y, x, y) > radius) continue;
        q.state = 'investigate'; q.goal = { x: gx, y: gy }; q.alertT = 0.7; q.t = 0; q.atk = -1; n++;
        if (events) events.push({ type: 'hear', e: q });
      }
      return n;
    },

    // The infected of one visit to an area. The same visit gives the same ones (seeded); `avoid` {x, y, r} keeps them
    // away from where the player arrives.
    spawnFor: function (area, risk, visit, avoid) {
      var rand = G.util.rng(hash(area.id) + (area.seed | 0) * 131 + (visit || 0) * 977 + 13);
      var types = enemies.plan(area, risk, rand), list = [], i;
      for (i = 0; i < types.length; i++) {
        var d = D().types[types[i]], s = spot(area, d.radius, rand, avoid);
        if (s) list.push(enemies.create(types[i], s.x, s.y, rand));
      }
      return list;
    },

    // One new infected of `type` on a free place between minR and maxR from (cx, cy), or null (story waves, js/game.js).
    spawnNear: function (area, type, rand, cx, cy, minR, maxR) {
      var d = D().types[type], r, t, a, rr, x, y, s;
      if (!d) return null;
      r = d.radius;
      for (t = 0; t < 60; t++) {
        a = rand() * TAU; rr = minR + rand() * (maxR - minR);
        x = cx + Math.cos(a) * rr; y = cy + Math.sin(a) * rr;
        if (x < 120 || y < 120 || x > area.width - 120 || y > area.height - 120) continue;
        if (area.footprint && (x < area.footprint.x + 60 || y < area.footprint.y + 60 || x > area.footprint.x + area.footprint.w - 60 || y > area.footprint.y + area.footprint.h - 60)) continue;
        if (G.area.inWater(area, x, y, r + 30) || G.area.inSolid(area, x, y, r + 16)) continue;
        for (var i = 0, bad = false; i < area.nodes.length && !bad; i++) { s = area.nodes[i]; if (s.solid > 0 && !s.dead && dist(x, y, s.x, s.y) < s.solid + r + 14) bad = true; }
        if (!bad) return enemies.create(type, x, y, rand);
      }
      return null;
    },

    alive: function (list) { var n = 0; for (var i = 0; i < list.length; i++) if (list[i].state !== 'dying' && list[i].state !== 'dead') n++; return n; },

    // A blow or a shot lands. dmg is final (before the unaware bonus); (sx, sy) is where it came from; w: the weapon.
    // Returns { dealt, killed, sneak }.
    hurt: function (e, dmg, sx, sy, w) {
      if (e.state === 'dying' || e.state === 'dead') return { dealt: 0, killed: false, sneak: false };
      var d = def(e), sneak = e.state === 'idle' || e.state === 'wander';
      var dealt = dmg * (sneak ? 1.5 : 1);
      e.hp -= dealt; e.sinceHit = 0; e.hurtK = 1; e.atk = e.patk = -1; e.atkDone = false; e.screaming = false;
      var dx = e.x - sx, dy = e.y - sy, l = Math.sqrt(dx * dx + dy * dy) || 1;
      var kn = ((w && w.knock) || 0) / d.mass;
      e.kvx = dx / l * kn; e.kvy = dy / l * kn;
      e.t = 0; e.goal = { x: sx, y: sy }; e.lostT = 0;
      if (e.hp <= 0) {
        e.hp = 0; e.state = 'dying'; e.fall = 0;
        // falls backward, turning so the body lies along the screen's horizontal with the head away from the blow
        // (seen from above at a tilt, a body lying toward / away from the camera would look like it still stood)
        e.fallDir = 1; e.angle = (dx >= 0 ? 0 : Math.PI) + Math.PI;
        return { dealt: dealt, killed: true, sneak: sneak };
      }
      e.state = 'stagger'; e.stun = ((w && w.stun) || 0.3) * d.stunMult;
      return { dealt: dealt, killed: false, sneak: sneak };
    },

    // One simulation step for one enemy. c: { area, world, player: {x, y, radius, alive}, noise: radius, events: [] (optional) }.
    // Returns { hit } with the damage the player takes from a blow that lands this step (0 = none).
    step: function (e, c, dt) {
      var d = def(e), P = c.player, out = { hit: 0 };
      if (e.state === 'dead') return out;
      e.sinceHit += dt;
      e.patk = e.atk;
      if (e.hurtK > 0) e.hurtK = Math.max(0, e.hurtK - dt / 0.42);
      if (e.alertT > 0) e.alertT -= dt;
      if (e.cool > 0) e.cool -= dt;

      var tx = null, ty = null, speed = 0, run = false, aim = null, pdist = dist(e.x, e.y, P.x, P.y);

      if (e.state === 'dying') {
        e.t += dt;
        e.fall = smooth(Math.min(1, e.t / 0.62));
        if (e.t >= 0.62) e.state = 'dead';
      } else if (e.state === 'stagger') {
        e.t += dt; e.atk = -1;
        if (e.t >= e.stun) {
          e.state = P.alive ? 'chase' : 'idle'; e.t = 0;
          if (P.alive && d.scream && !e.screamed) startScream(e, P, c);          // a hurt screamer that never noticed you still screams
        }
      } else {
        e.think -= dt;
        if (e.think <= 0) { e.think = 0.18 + Math.random() * 0.1; perceive(e, c, d, pdist); }
        if (!P.alive && e.state !== 'idle' && e.state !== 'wander') { e.state = 'idle'; e.t = 1; e.atk = -1; }

        if (e.state === 'idle') {
          e.t -= dt;
          if (e.t <= 0) {
            var a = Math.random() * TAU, r = 60 + Math.random() * 120;
            e.goal = { x: e.home.x + Math.cos(a) * r, y: e.home.y + Math.sin(a) * r };
            e.state = 'wander'; e.t = 2 + Math.random() * 3;
          }
        } else if (e.state === 'wander') {
          e.t -= dt;
          if (e.t <= 0 || dist(e.x, e.y, e.goal.x, e.goal.y) < 26) { e.state = 'idle'; e.t = 1.5 + Math.random() * 3.5; }
          else { tx = e.goal.x; ty = e.goal.y; speed = d.speed * d.wander; }
        } else if (e.state === 'investigate') {
          if (dist(e.x, e.y, e.goal.x, e.goal.y) < 42) { e.state = 'idle'; e.t = 2.2; e.home = { x: e.x, y: e.y }; }
          else { tx = e.goal.x; ty = e.goal.y; speed = d.speed * 0.85; run = d.look === 'runner'; }
        } else if (e.state === 'chase') {
          tx = e.goal.x; ty = e.goal.y; speed = d.speed; run = d.look === 'runner';
          if (e.sees) aim = P;
          if (P.alive && e.cool <= 0 && pdist <= d.range + P.radius + e.radius) {
            e.state = 'windup'; e.t = 0; e.atk = 0; e.atkDone = false;
          } else if (!e.sees && dist(e.x, e.y, e.goal.x, e.goal.y) < 32) {
            e.state = 'idle'; e.t = 2.2; e.home = { x: e.x, y: e.y };
          }
        }
        if (e.state === 'scream') {                              // standing and screaming; the rest of the infected come
          e.t += dt; e.atk = Math.min(1, e.t / d.scream.time);
          aim = P;
          if (e.t >= d.scream.time) { e.atk = -1; e.screaming = false; e.state = 'chase'; e.cool = 0.4; e.t = 0; e.goal = { x: P.x, y: P.y }; }
        }
        if (e.state === 'windup') {                              // the blow: raise, then it lands at hitU
          e.t += dt; e.atk = Math.min(1, e.t / d.attackTime);
          aim = P;
          if (e.atk < d.hitU && pdist > d.range * 0.6 + P.radius) { tx = P.x; ty = P.y; speed = d.speed * d.lunge; }
          if (!e.atkDone && e.atk >= d.hitU) {
            e.atkDone = true;
            if (P.alive && pdist <= d.range + P.radius + e.radius + 12 && G.combat.clear(c.area, e.x, e.y, P.x, P.y)) {
              out.hit = d.dmg;
              if (c.events) c.events.push({ type: 'blow', e: e });
            }
          }
          if (e.t >= d.attackTime) { e.atk = -1; e.state = 'chase'; e.cool = d.cooldown; e.t = 0; e.goal = { x: P.x, y: P.y }; }
        }
      }

      // movement: toward (tx, ty) at `speed`, steering around whatever blocks
      var dir = null;
      if (speed > 0 && tx !== null) dir = steer(e, tx, ty, speed, dt);
      if (dir) {
        mv.x = dir.x; mv.y = dir.y; mv.run = run;
        cfg.walkSpeed = speed; cfg.runMult = 1;
        cfg.strideMult = (speed / (run ? 16.5 : 14)) / (run ? 15 : 10.5);
      }
      var aimPt = aim ? aim : (tx !== null ? { x: tx, y: ty } : null);
      G.player.update(e, dir ? mv : ZERO, aimPt, dt, c.world, cfg);
      if (e.kvx || e.kvy) {                                      // knock-back
        e.x += e.kvx * dt; e.y += e.kvy * dt;
        var k = Math.exp(-8 * dt);
        e.kvx *= k; e.kvy *= k;
        if (Math.abs(e.kvx) + Math.abs(e.kvy) < 3) e.kvx = e.kvy = 0;
      }
      G.area.collide(e, c.area);
      if (e.state === 'dead') {                                  // lying still: no more walking in the legs
        G.player.settle(e, e.angle); e.prevX = e.x; e.prevY = e.y;
      }
      if (e.screamPending && c.enemies) flushScream(e, c.enemies, P, c.events);   // (otherwise separate() does it)
      return out;
    },

    // Keeps bodies from standing inside each other or inside the player (the enemy gives way). list: all enemies.
    separate: function (list, P, area) {
      var i, j, a, b;
      for (i = 0; i < list.length; i++) if (list[i].screamPending) flushScream(list[i], list, P, null);
      for (i = 0; i < list.length; i++) {
        a = list[i];
        if (a.state === 'dying' || a.state === 'dead') continue;
        for (j = i + 1; j < list.length; j++) {
          b = list[j];
          if (b.state === 'dying' || b.state === 'dead') continue;
          var dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy), need = (a.radius + b.radius) * 0.95;
          if (d < need) {
            if (d < 0.01) { dx = 1; dy = 0; d = 1; }
            var push = (need - d) / 2;
            a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push;
          }
        }
        if (P && P.alive) {
          var px = a.x - P.x, py = a.y - P.y, pd = Math.sqrt(px * px + py * py), pneed = a.radius + P.radius * 0.75;
          if (pd < pneed) {
            if (pd < 0.01) { px = 0; py = 1; pd = 1; }
            a.x = P.x + px / pd * pneed; a.y = P.y + py / pd * pneed;
          }
        }
        if (area) G.area.collide(a, area);
      }
    }
  };

  // What an enemy notices this moment: the player in sight (line of sight, within sight range), or a noise.
  function perceive(e, c, d, pd) {
    var P = c.player;
    if (!P.alive) { e.sees = false; return; }
    var sees = pd <= d.sight && (pd < 90 || G.combat.clear(c.area, e.x, e.y, P.x, P.y));
    var hears = c.noise > 0 && pd <= c.noise * d.hear;
    e.sees = sees;
    var s = e.state;
    if (s === 'idle' || s === 'wander') {
      if (sees) notice(e, P, c);
      else if (hears) { e.state = 'investigate'; e.goal = { x: P.x, y: P.y }; e.alertT = 0.7; if (c.events) c.events.push({ type: 'hear', e: e }); }
    } else if (s === 'investigate') {
      if (sees) notice(e, P, c);
      else if (hears) e.goal = { x: P.x, y: P.y };
    } else if (s === 'chase') {
      if (sees || (hears && pd < 260)) { e.goal = { x: P.x, y: P.y }; e.lostT = 0; }
      else { e.lostT += 0.22; if (e.lostT > 3.5) { e.state = 'investigate'; e.lostT = 0; } }
    }
  }

  // The scream: the screamer stops and screams once (its first notice of the player). The event is for the game to draw / play;
  // the alert itself is spread by flushScream (from step when c.enemies is given, else from separate()).
  function startScream(e, P, c) {
    var d = def(e);
    e.screamed = true; e.screaming = true; e.screamPending = true;
    e.state = 'scream'; e.t = 0; e.atk = 0; e.patk = 0; e.atkDone = false; e.goal = { x: P.x, y: P.y }; e.lostT = 0; e.alertT = 0.9;
    if (c && c.events) c.events.push({ type: 'scream', x: e.x, y: e.y, radius: d.scream.radius, e: e });
  }
  function flushScream(e, list, P, events) {
    e.screamPending = false;
    G.enemies.alertAround(list, e.x, e.y, def(e).scream.radius, P.x, P.y, e, events);
  }

  function notice(e, P, c) {
    if (def(e).scream && !e.screamed) { startScream(e, P, c); return; }
    e.state = 'chase'; e.goal = { x: P.x, y: P.y }; e.lostT = 0; e.alertT = 0.9; e.atk = -1;
    if (c.events) c.events.push({ type: 'notice', e: e });
  }

  // Unit direction toward a point, turned aside for a moment when the body has not been getting anywhere (blocked by a wall).
  function steer(e, tx, ty, speed, dt) {
    var dx = tx - e.x, dy = ty - e.y, l = Math.sqrt(dx * dx + dy * dy);
    if (l < 1) return null;
    var ux = dx / l, uy = dy / l;
    if (e.sideT > 0) {
      e.sideT -= dt;
      var ang = e.side * 1.15, ca = Math.cos(ang), sa = Math.sin(ang), nx = ux * ca - uy * sa, ny = ux * sa + uy * ca;
      ux = nx; uy = ny;
    }
    e.chk += dt;
    if (e.chk >= 0.4) {
      if (dist(e.x, e.y, e.cx, e.cy) < speed * 0.4 * 0.3 && l > 40) { e.side = Math.random() < 0.5 ? -1 : 1; e.sideT = 0.7 + Math.random() * 0.5; }
      e.chk = 0; e.cx = e.x; e.cy = e.y;
    }
    return { x: ux, y: uy };
  }

  G.enemies = enemies;
})(typeof window !== 'undefined' ? window : globalThis);
