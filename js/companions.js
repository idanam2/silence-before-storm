// Companions: the dog and the partner. World and mechanics only (no story, no dialogue): they stay switched off until the story calls
// G.companions.unlock(st.comp, 'dog' | 'partner') (the dog joins around chapter 3, the partner in the middle of the story).
//   dog      follows the player, has hunger / thirst / cleanliness (E next to it: feed, water, wash), a kennel and a bowl at home.
//   partner  walks beside the player (looks and moves like the player's body: js/player.js, look 'partner').
// State (plain JSON, saved): st.comp = { dog: { on, x, y, angle, hunger, thirst, clean, ... }, partner: { on, x, y }, bowl: { food, water } }.
(function (root) {
  'use strict';
  var G = root.G, TAU = Math.PI * 2;

  var D = G.data.companions = {
    dog: {
      name: 'פלפל', radius: 11, walk: 150, run: 235, gap: 74, side: -34, teleport: 760,
      perMin: { hunger: 1.4, thirst: 2.0, clean: 0.6 },                    // numbers of story/data/companions.js (G.data.storyDog)                    // what it loses a minute
      low: 25, slow: 12,                                                  // below `low` it whines; below `slow` it drags its feet
      food: ['dog_food', 'mushroom', 'dried_mushroom', 'canned_food', 'cooked_food', 'ration', 'stew', 'fish', 'fish_cooked'],     // what it eats, plainest first
      foodGain: { dog_food: 45, fish: 25, fish_cooked: 35, mushroom: 10, dried_mushroom: 16, canned_food: 34, cooked_food: 38, ration: 40, stew: 46 },
      water: ['water_dirty', 'water_clean'], waterGain: { water_dirty: 22, water_clean: 48 },
      washGain: 60                                                        // one clean water for a wash
    },
    partner: { name: 'רוני', radius: 14, gap: 60, side: 58, teleport: 820, look: 'partner' },
    bowl: { cap: 3, foodEach: 1, waterEach: 1 }                           // the bowl holds up to `cap` portions of each
  };

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function angDiff(a, b) { var d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }

  function freshDog() { return { on: false, x: 0, y: 0, angle: 0, stride: 0, moving: 0, hunger: 100, thirst: 100, clean: 100, rest: 0, eat: 0, wag: 0, warned: 0, area: '' }; }
  function freshPartner() { return { on: false, x: 0, y: 0, area: '', body: null }; }

  var C = G.companions = {
    create: function () { return { dog: freshDog(), partner: freshPartner(), bowl: { food: 0, water: 0 } }; },

    // The story (or a test) switches a companion on: it appears next to the player at the next step.
    unlock: function (comp, id) { if (comp[id] && !comp[id].on) { comp[id].on = true; comp[id].area = ''; } return comp[id] && comp[id].on; },
    has: function (comp, id) { return !!(comp && comp[id] && comp[id].on); },

    // A save keeps who is on, the dog's needs and the bowl; positions are found again (they come to the player).
    snapshot: function (comp) {
      var d = comp.dog, b = comp.bowl;
      return { dog: { on: !!d.on, hunger: Math.round(d.hunger * 10) / 10, thirst: Math.round(d.thirst * 10) / 10, clean: Math.round(d.clean * 10) / 10 },
        partner: { on: !!comp.partner.on }, bowl: { food: b.food, water: b.water } };
    },
    clean: function (raw) {
      var c = C.create(), r = raw && typeof raw === 'object' ? raw : {}, num = function (v, def) { return isFinite(v) ? clamp(+v, 0, 100) : def; };
      if (r.dog && typeof r.dog === 'object') { c.dog.on = !!r.dog.on; c.dog.hunger = num(r.dog.hunger, 100); c.dog.thirst = num(r.dog.thirst, 100); c.dog.clean = num(r.dog.clean, 100); }
      if (r.partner && typeof r.partner === 'object') c.partner.on = !!r.partner.on;
      if (r.bowl && typeof r.bowl === 'object') { c.bowl.food = Math.round(clamp(isFinite(r.bowl.food) ? +r.bowl.food : 0, 0, D.bowl.cap)); c.bowl.water = Math.round(clamp(isFinite(r.bowl.water) ? +r.bowl.water : 0, 0, D.bowl.cap)); }
      return c;
    },

    // ---- care (E next to the dog) ----
    firstOf: function (bag, list) { for (var i = 0; i < list.length; i++) if (G.inventory.count(bag, list[i]) > 0) return list[i]; return null; },
    // What E would do now: { kind: 'feed' | 'water' | 'wash', item } or null.
    careOption: function (comp, bag) {
      var d = comp.dog, f = C.firstOf(bag, D.dog.food), w = C.firstOf(bag, ['water_clean']);
      if (d.hunger < 70 && f) return { kind: 'feed', item: f };
      if (d.thirst < 70 && (w || C.firstOf(bag, ['water_dirty']))) return { kind: 'water', item: w || 'water_dirty' };
      if (d.clean < 55 && w) return { kind: 'wash', item: w };
      return null;
    },
    care: function (comp, bag, opt) {
      var d = comp.dog;
      if (!opt || !G.inventory.remove(bag, opt.item, 1)) return false;
      if (opt.kind === 'feed') { d.hunger = clamp(d.hunger + D.dog.foodGain[opt.item], 0, 100); d.eat = 1; }
      else if (opt.kind === 'water') d.thirst = clamp(d.thirst + D.dog.waterGain[opt.item], 0, 100);
      else d.clean = clamp(d.clean + D.dog.washGain, 0, 100);
      d.wag = 1.6; d.warned = 0;
      return true;
    },
    prompt: function (comp, bag) {
      var d = comp.dog, o = C.careOption(comp, bag), st = 'רעב ' + Math.round(d.hunger) + ' · צמא ' + Math.round(d.thirst) + ' · ניקיון ' + Math.round(d.clean);
      if (o) return 'E · ' + (o.kind === 'feed' ? 'להאכיל את הכלב' : o.kind === 'water' ? 'לתת לכלב מים' : 'לרחוץ את הכלב') + ' (' + G.data.items[o.item].name + ') · ' + st;
      return 'הכלב · ' + st;
    },
    // The bowl at home: E puts one portion of food or water in (food first when both are short).
    fillBowl: function (comp, bag) {
      var b = comp.bowl, cap = D.bowl.cap, f = C.firstOf(bag, D.dog.food), w = C.firstOf(bag, ['water_clean', 'water_dirty']);
      if (f && b.food < cap && (b.food <= b.water || !w || b.water >= cap)) { G.inventory.remove(bag, f, 1); b.food++; comp.bowlFoodItem = f; return 'food'; }
      if (w && b.water < cap) { G.inventory.remove(bag, w, 1); b.water++; comp.bowlWaterItem = w; return 'water'; }
      return null;
    },
    bowlPrompt: function (comp, bag) {
      var b = comp.bowl;
      return 'קערת הכלב · אוכל ' + b.food + '/' + D.bowl.cap + ' · מים ' + b.water + '/' + D.bowl.cap + (C.firstOf(bag, D.dog.food) || C.firstOf(bag, ['water_clean', 'water_dirty']) ? ' · E למילוי' : ' · אין מה למלא');
    },

    // ---- movement ----
    // One step. `area` is the current area id; `solids` collides the figure (zone: st.zone, base: the base solids).
    step: function (st, dt) {
      var comp = st.comp, p = st.player, id, c, spec, tx, ty, d, mv, sp;
      if (!comp) return;
      var inBase = st.area === 'base', world = st.world;
      for (id in { dog: 1, partner: 1 }) {
        c = comp[id];
        if (!c.on) continue;
        spec = D[id];
        if (c.area !== st.area || dist(c, p) > spec.teleport) {             // a new place: it arrives at the player's heel
          c.x = p.x - Math.cos(p.face) * 60 + Math.cos(p.face + Math.PI / 2) * spec.side * 0.6; c.y = p.y - Math.sin(p.face) * 60 + Math.sin(p.face + Math.PI / 2) * spec.side * 0.6;
          c.area = st.area; c.angle = p.face;
          if (id === 'partner') { c.body = G.player.create(c.x, c.y); c.body.look = D.partner.look; c.body.scale = 0.96; c.body.face = c.body.angle = c.body.pFace = c.body.prevAngle = p.face; }
          G.companions.settle(st, c);
        }
        if (id === 'dog') C.dogStep(st, c, dt, inBase); else C.partnerStep(st, c, dt);
      }
    },
    place: function (st, c) {                                               // keeps it out of walls, trees and water
      var f = { x: c.x, y: c.y, radius: c.body ? c.body.radius : D.dog.radius };
      if (st.area === 'base') G.base.collide(f, st.base.solids); else if (st.zone) G.area.collide(f, st.zone);
      c.x = f.x; c.y = f.y;
      if (c.body) { c.body.x = f.x; c.body.y = f.y; }
    },
    settle: function (st, c) { C.place(st, c); },
    toward: function (st, c, tx, ty, dt, spd, runMult) {
      var dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
      if (d < 6) return 0;
      var s = Math.min(spd * runMult, d / dt) * dt;
      c.x += dx / d * s; c.y += dy / d * s;
      return s / dt;
    },
    dogStep: function (st, c, dt, inBase) {
      var p = st.player, spec = D.dog, comp = st.comp, i, ox = c.x, oy = c.y;
      // needs
      var k = dt / 60;
      c.hunger = Math.max(0, c.hunger - spec.perMin.hunger * k);
      c.thirst = Math.max(0, c.thirst - spec.perMin.thirst * k);
      c.clean = Math.max(0, c.clean - spec.perMin.clean * k * (st.area !== 'base' ? 1.6 : 1));
      c.eat = Math.max(0, c.eat - dt); c.wag = Math.max(0, c.wag - dt);
      c.warned = Math.max(0, c.warned - dt);
      if ((c.hunger < spec.low || c.thirst < spec.low) && c.warned <= 0) { c.warned = 90; G.ui.toast(c.hunger < c.thirst ? 'הכלב רעב' : 'הכלב צמא', 2200); }
      var ill = Math.min(c.hunger, c.thirst), pace = ill < spec.slow ? 0.55 : ill < spec.low ? 0.82 : 1;
      // at home it goes to the bowl when hungry or thirsty and there is something in it
      var bowl = null;
      if (inBase) for (i = 0; i < st.base.solids.length; i++) if (st.base.solids[i].kind === 'dogbowl') bowl = st.base.solids[i];
      var goBowl = bowl && ((c.hunger < 60 && comp.bowl.food > 0) || (c.thirst < 60 && comp.bowl.water > 0));
      var tx, ty;
      if (goBowl) { tx = bowl.x + bowl.w / 2; ty = bowl.y + bowl.h + 14; }
      else {
        var fx = Math.cos(p.face), fy = Math.sin(p.face), px = -fy, py = fx;
        tx = p.x - fx * spec.gap + px * spec.side; ty = p.y - fy * spec.gap + py * spec.side;
      }
      var d = Math.hypot(tx - c.x, ty - c.y), spd = 0;
      if (goBowl && d < 22) {                                              // at the bowl: eats and drinks a portion
        if (c.hunger < 60 && comp.bowl.food > 0) { comp.bowl.food--; c.hunger = clamp(c.hunger + spec.foodGain[comp.bowlFoodItem || 'canned_food'], 0, 100); c.eat = 1; }
        else if (c.thirst < 60 && comp.bowl.water > 0) { comp.bowl.water--; c.thirst = clamp(c.thirst + spec.waterGain[comp.bowlWaterItem || 'water_clean'], 0, 100); c.eat = 1; }
      } else if (d > (goBowl ? 8 : 46)) {
        spd = C.toward(st, c, tx, ty, dt, d > 170 ? spec.run : spec.walk, 1) * pace;
        if (pace < 1) { c.x = ox + (c.x - ox) * pace; c.y = oy + (c.y - oy) * pace; }
      }
      c.x = clamp(c.x, 14, st.world.width - 14); c.y = clamp(c.y, 14, st.world.height - 14);
      C.place(st, c);
      var mx = c.x - ox, my = c.y - oy, mv = Math.hypot(mx, my) / Math.max(dt, 1e-4);
      c.moving += ((mv > 8 ? 1 : 0) - c.moving) * (1 - Math.exp(-12 * dt));
      if (mv > 8) { c.angle += angDiff(Math.atan2(my, mx), c.angle) * (1 - Math.exp(-14 * dt)); c.stride += dt * (mv > 190 ? 22 : 14); }
      else { var a = Math.atan2(p.y - c.y, p.x - c.x); c.angle += angDiff(a, c.angle) * (1 - Math.exp(-4 * dt)); }
      // at home and when the player stands still for a while it lies down by the kennel (only drawn: it gets up when you move)
      c.rest = (inBase && !p.moving && mv < 4 && d < 60) ? Math.min(1, c.rest + dt * 0.25) : Math.max(0, c.rest - dt * 2);
      c.mv = mv;
    },
    partnerStep: function (st, c, dt) {
      var p = st.player, b = c.body, spec = D.partner;
      if (!b) { b = c.body = G.player.create(c.x, c.y); b.look = spec.look; b.scale = 0.96; }
      var fx = Math.cos(p.face), fy = Math.sin(p.face), px = -fy, py = fx;
      var tx = p.x - fx * spec.gap * 0.6 + px * spec.side, ty = p.y - fy * spec.gap * 0.6 + py * spec.side;
      var dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy), mv = { x: 0, y: 0, run: false };
      var cfg = { walkSpeed: G.config.player.walkSpeed * 1.04, runMult: G.config.player.runMult || 1.6, strideMult: 1 };
      if (d > 34) { mv.x = dx; mv.y = dy; mv.run = d > 160 || (p.running && d > 60); }
      G.player.update(b, mv, d > 34 ? null : { x: p.x + fx * 120, y: p.y + fy * 120 }, dt, st.world, cfg);
      var f = { x: b.x, y: b.y, radius: b.radius };
      if (st.area === 'base') G.base.collide(f, st.base.solids); else if (st.zone) G.area.collide(f, st.zone);
      b.x = f.x; b.y = f.y; c.x = b.x; c.y = b.y;
      G.player.animate(b, dt, null);
    },
    // The dog next to the player (for E), or false.
    nearPartner: function (st) { var d = st.comp && st.comp.partner; return !!(d && d.on && d.area === st.area && dist(d, st.player) < 70); },
    nearDog: function (st) { var d = st.comp && st.comp.dog; return !!(d && d.on && d.area === st.area && dist(d, st.player) < 58); },

    // ---- drawing (world coordinates, from far to near by y) ----
    items: function (st, vr, list) {
      var comp = st.comp; if (!comp) return;
      ['dog', 'partner'].forEach(function (id) {
        var c = comp[id];
        if (c.on && c.area === st.area && c.x > vr.x0 - 80 && c.x < vr.x1 + 80 && c.y > vr.y0 - 100 && c.y < vr.y1 + 80) list.push({ y: c.y, comp: id });
      });
    },
    draw: function (ctx, st, id, alpha, time) {
      var c = st.comp[id];
      if (id === 'partner') { if (c.body) G.player.draw(ctx, c.body, alpha, time); return; }
      C.drawDog(ctx, c, time);
    },
    drawDog: function (ctx, c, time) {
      var a = c.angle, ca = Math.cos(a), sa = Math.sin(a), st = c.stride, mvK = c.moving, rest = c.rest;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 6, 17, 6, 0, 0, TAU); ctx.fill();   // the shadow stays under it
      ctx.rotate(a);
      var thin = c.hunger < D.dog.low ? 0.84 : 1, dirty = 1 - c.clean / 100, fur = mix([156, 120, 78], [118, 98, 74], dirty), dark = mix([84, 62, 42], [66, 56, 44], dirty), belly = mix([214, 196, 160], [160, 146, 120], dirty);
      var legSw = Math.sin(st) * 5 * mvK, bob = Math.abs(Math.sin(st)) * 1.4 * mvK;
      if (rest > 0.5) { ctx.scale(0.9, 1); }
      function limb(x, y, ph) { var s = Math.sin(st + ph) * 5 * mvK; ctx.fillStyle = rgb(dark); ctx.beginPath(); ctx.ellipse(x + s, y, 4.2, 2.4, 0, 0, TAU); ctx.fill(); }
      limb(8, -5, 0); limb(8, 5, Math.PI); limb(-9, -5, Math.PI); limb(-9, 5, 0);
      ctx.fillStyle = rgb(fur); ctx.beginPath(); ctx.ellipse(-1, -bob * 0.3, 14, 6.2 * thin + 0.4, 0, 0, TAU); ctx.fill();          // the body
      ctx.fillStyle = rgb(belly); ctx.beginPath(); ctx.ellipse(1, 0, 8, 3.4 * thin, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = rgb(dark); ctx.beginPath(); ctx.ellipse(-2, 0, 7, 3.2, 0, 0, TAU); ctx.fill();                                  // the dark saddle
      var wag = (Math.sin(time * 16) * (0.3 + (c.wag > 0 ? 0.7 : 0.0)) + (c.hunger < D.dog.low ? -0.7 : 0)), tx = -14;
      ctx.strokeStyle = rgb(fur); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tx, 0); ctx.quadraticCurveTo(tx - 6, wag * 5, tx - 11, wag * 9); ctx.stroke();   // the tail
      var hx = 14, hy = c.eat > 0 ? 1.5 + Math.sin(time * 20) : 0;
      ctx.fillStyle = rgb(fur); ctx.beginPath(); ctx.ellipse(hx, hy, 6.2, 5.2, 0, 0, TAU); ctx.fill();                                // the head
      ctx.fillStyle = rgb(belly); ctx.beginPath(); ctx.ellipse(hx + 5, hy, 4, 2.6, 0, 0, TAU); ctx.fill();                            // the muzzle
      ctx.fillStyle = '#15110e'; ctx.beginPath(); ctx.arc(hx + 8.6, hy, 1.6, 0, TAU); ctx.fill();                                      // the nose
      ctx.fillStyle = rgb(dark); ctx.beginPath(); ctx.ellipse(hx - 1.5, hy - 5, 3.2, 2, 0.5, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(hx - 1.5, hy + 5, 3.2, 2, -0.5, 0, TAU); ctx.fill();   // the ears
      ctx.fillStyle = '#15110e'; ctx.fillRect(hx + 2.2, hy - 3, 1.6, 1.6); ctx.fillRect(hx + 2.2, hy + 1.4, 1.6, 1.6);
      ctx.restore();
    }
  };
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(c) { return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; }
})(typeof window !== 'undefined' ? window : globalThis);
