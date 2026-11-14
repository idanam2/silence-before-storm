// The cold: body heat (st.needs.warmth, 0..100) that drains in snowy areas (area.cold), the clothes that slow the drain, fires that
// warm you, the slow walk in snow, and the screen: falling snow, a blue chill and frost on the edges. No story in here.
// The numbers are the story side's (story/data/companions.js: G.data.storyCold, G.data.storyWarmth); the same numbers are the
// fallback here so the game also runs without that file. An area is cold when it has `cold: { wind: true, drifts: [rect] }`;
// `warm: [{ x, y, r }]` are the fires (and other warm spots) in it. Also drawn here: the small HUD rows (cold meter, dog meters).
(function (root) {
  'use strict';
  var G = root.G, TAU = Math.PI * 2;

  var FALL = {
    loss: { base: 1.6, wind: 1.0, blizzard: 2.2, wet: 0.8 },
    gain: { fire: 6, indoorHeated: 3, indoor: 1, hotDrink: 25, handWarmer: 30 },
    effects: [
      { below: 60, text: 'קר', slow: 0.95 },
      { below: 35, text: 'קופא', slow: 0.85, noRun: true, frost: 0.4 },
      { below: 15, text: 'היפותרמיה', slow: 0.7, noRun: true, frost: 0.8, healthPerSec: -1.2 }
    ],
    snowWalk: { normal: 0.8, deep: 0.55, snowshoes: 0.92 }
  };
  var WARM = { cap: 0.10, jacket: 0.20, pants: 0.08, boots: 0.08, helmet: 0.02, vest: 0.05, hazsuit: 0.10, parka: 0.40, wool_hat: 0.20, thermal_pants: 0.20, snow_boots: 0.18, aharon_coat: 0.32 };

  function S() { return G.data.storyCold || FALL; }
  function clamp(v) { return v < 0 ? 0 : v > 100 ? 100 : v; }
  function inRect(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

  var cold = G.cold = {
    // Share of the cold that the worn clothes keep out (0..0.9).
    warmthOf: function (equip) {
      var s = 0, W = G.data.storyWarmth || WARM, items = G.data.items;
      ['head', 'body', 'legs', 'feet'].forEach(function (slot) {
        var id = equip && equip[slot], d = id && items[id];
        if (!d) return;
        s += d.wear && d.wear.warmth != null ? d.wear.warmth : (W[id] || 0);
      });
      return Math.min(0.9, s);
    },
    snowshoes: function (equip) { var id = equip && equip.feet, d = id && G.data.items[id]; return !!(d && d.wear && d.wear.snowshoes); },
    area: function (st) { return st.area !== 'base' && st.zone && st.zone.cold ? st.zone : null; },
    // A fire (or another warm spot) within reach of the player in this area.
    fireNear: function (z, p) {
      var w = (z && z.warm) || [];
      for (var i = 0; i < w.length; i++) if (Math.hypot(p.x - w[i].x, p.y - w[i].y) < w[i].r) return w[i];
      return null;
    },
    // What the current body heat does: the matching row of effects (the deepest one), or null.
    effect: function (warmth) {
      var e = null, list = S().effects;
      for (var i = 0; i < list.length; i++) if (warmth < list[i].below) e = list[i];
      return e;
    },
    // Walking speed in snow (and the chill itself slows you down).
    speedMult: function (st) {
      var z = cold.area(st), m = 1, w = S().snowWalk || FALL.snowWalk, p = st.player;
      if (z) {
        var deep = (z.cold.drifts || []).some(function (r) { return inRect(r, p.x, p.y); });
        m = cold.snowshoes(st.equip) ? w.snowshoes : (deep ? w.deep : w.normal);
      }
      var e = st.needs && st.needs.warmth != null ? cold.effect(st.needs.warmth) : null;
      return m * (e ? e.slow : 1);
    },
    noRun: function (st) { var e = st.needs && st.needs.warmth != null ? cold.effect(st.needs.warmth) : null; return !!(e && e.noRun); },
    // One step of body heat. Called from the survival tick (not in creative mode, where nothing drains).
    step: function (st, dt) {
      var n = st.needs, z = cold.area(st), cfg = S();
      if (n.warmth == null) n.warmth = 100;
      if (z) {
        if (cold.fireNear(z, st.player)) n.warmth = clamp(n.warmth + cfg.gain.fire * dt);
        else {
          var weather = G.story && G.story.weather ? G.story.weather() : 'clear';
          var extra = weather === 'storm' || weather === 'blizzard' ? cfg.loss.blizzard : (z.cold.wind ? cfg.loss.wind : 0);
          n.warmth = clamp(n.warmth - (cfg.loss.base + extra) * (1 - cold.warmthOf(st.equip)) * dt);
        }
      } else n.warmth = clamp(n.warmth + (st.area === 'base' ? cfg.gain.indoorHeated : cfg.gain.indoor) * dt);
      var e = cold.effect(n.warmth);
      if (e && e.healthPerSec) G.needs.hurt(n, -e.healthPerSec * dt, null);
      return e;
    },
    // ---- the screen ----
    // Falling snow (always the same flakes: positions come from the time), a cold blue tone and frost on the edges.
    draw: function (ctx, w, h, st, time, cx, cy) {
      var z = cold.area(st); if (!z) return;
      var i, n = Math.round(Math.min(220, w * h / 5200)), wind = z.cold.wind ? 1 : 0.5;
      ctx.save();
      ctx.fillStyle = 'rgba(120,150,200,0.07)'; ctx.fillRect(0, 0, w, h);               // a cold tone over everything
      ctx.fillStyle = '#eef4fb';
      for (i = 0; i < n; i++) {
        var depth = 0.35 + ((i * 37) % 100) / 100 * 0.65, sp = 40 + depth * 90, sz = (1.6 + depth * 2.6) * (cx === undefined ? 1 : 1);
        var x = (((i * 9301 + 49297) % 233280) / 233280 * (w + 200) + time * (22 + depth * 38) * wind + Math.sin(time * 0.7 + i) * 14 - cx * depth * 0.5) % (w + 200);
        var y = (((i * 7919 + 1013) % 104729) / 104729 * (h + 100) + time * sp - cy * depth * 0.5) % (h + 100);
        if (x < 0) x += w + 200; if (y < 0) y += h + 100;
        ctx.globalAlpha = 0.35 + depth * 0.5;
        ctx.fillRect(x - 100, y - 50, sz, sz);
      }
      ctx.globalAlpha = 1;
      var e = cold.effect(st.needs.warmth == null ? 100 : st.needs.warmth), fr = e && e.frost ? e.frost : (st.needs.warmth < 80 ? (80 - st.needs.warmth) / 80 * 0.2 : 0);
      if (fr > 0) {                                                                          // frost creeping in from the edges
        var g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.75);
        g.addColorStop(0, 'rgba(190,225,255,0)'); g.addColorStop(1, 'rgba(205,232,255,' + (fr * 0.7).toFixed(3) + ')');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();
    }
  };

  // ---- HUD rows under the needs: body heat (in the cold) and the dog's meters ----
  var row = null, dogRow = null, last = {};
  var SNOW = '<svg viewBox="0 0 20 20"><path d="M10 2v16M3.1 6l13.800 8M3.1 14 16.900 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var PAW = '<svg viewBox="0 0 20 20"><ellipse cx="10" cy="13" rx="4.2" ry="3.4" fill="currentColor"/><circle cx="4.800" cy="8.500" r="1.800" fill="currentColor"/><circle cx="8" cy="5.500" r="1.800" fill="currentColor"/><circle cx="12" cy="5.500" r="1.800" fill="currentColor"/><circle cx="15.200" cy="8.500" r="1.800" fill="currentColor"/></svg>';
  function build() {
    var nh = document.getElementById('needs-hud'); if (!nh || row) return !!row;
    row = document.createElement('div'); row.className = 'need warmth'; row.title = 'חום גוף'; row.style.display = 'none';
    row.innerHTML = '<span class="ico">' + SNOW + '</span><span class="meter"><i></i></span><b class="val"></b>';
    dogRow = document.createElement('div'); dogRow.className = 'dogbar'; dogRow.style.display = 'none';
    dogRow.innerHTML = '<span class="ico">' + PAW + '</span><span class="nm"></span>' +
      '<span class="meter hunger" title="רעב"><i></i></span><span class="meter thirst" title="צמא"><i></i></span><span class="meter clean" title="ניקיון"><i></i></span>';
    nh.appendChild(row); nh.appendChild(dogRow);
    return true;
  }
  G.compHud = {
    update: function (st) {
      if (!st || !st.needs || !build()) return;
      var w = st.needs.warmth == null ? 100 : st.needs.warmth, show = !!cold.area(st) || w < 96;
      if (last.show !== show) { last.show = show; row.style.display = show ? '' : 'none'; }
      if (show && Math.abs((last.w == null ? -9 : last.w) - w) > 0.3) {
        last.w = w; row.querySelector('i').style.transform = 'scaleX(' + (w / 100).toFixed(3) + ')'; row.querySelector('.val').textContent = Math.ceil(w);
        row.classList.toggle('low', w < 35);
      }
      var d = st.comp && st.comp.dog, on = !!(d && d.on);
      if (last.dog !== on) { last.dog = on; dogRow.style.display = on ? '' : 'none'; if (on) dogRow.querySelector('.nm').textContent = G.data.companions.dog.name; }
      if (on) {
        ['hunger', 'thirst', 'clean'].forEach(function (k) {
          var v = Math.round(d[k]);
          if (last['d' + k] !== v) { last['d' + k] = v; var m = dogRow.querySelector('.' + k); m.firstChild.style.transform = 'scaleX(' + (v / 100).toFixed(3) + ')'; m.classList.toggle('low', v < 25); }
        });
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
