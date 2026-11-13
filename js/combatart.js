// Drawing for fights: blood stains under the fallen, health bars and alert marks above the infected, bullet
// tracers with a muzzle flash, and the red edge flash when the player is hit. The bodies themselves are drawn by
// js/player.js (the infected use the same rig).
(function (root) {
  'use strict';
  var G = root.G, TAU = Math.PI * 2;

  var GLOW_T = 0.12, casingOut = { x: 0, y: 0, z: 0 }, glowCanvas = null;

  // The muzzle glow sprite, painted once (a soft warm radial falloff).
  function glowSprite() {
    if (glowCanvas) return glowCanvas;
    if (typeof document === 'undefined') return null;
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,226,160,0.95)'); gr.addColorStop(0.25, 'rgba(255,184,90,0.5)');
    gr.addColorStop(0.6, 'rgba(255,130,40,0.16)'); gr.addColorStop(1, 'rgba(255,110,30,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return (glowCanvas = c);
  }

  // Body-shaped tint for a hit figure: torso/legs ellipse and a head circle (heights follow e.scale).
  function hitShape(ctx, x, y, s) {
    ctx.beginPath(); ctx.ellipse(x, y, 10 * s, 26 * s, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - 26 * s, 7.5 * s, 0, TAU); ctx.fill();
  }

  function inView(e, vr, pad) { return e.x > vr.x0 - pad && e.x < vr.x1 + pad && e.y > vr.y0 - pad && e.y < vr.y1 + pad + 60; }

  var art = {
    // A dark patch that spreads under each body that is falling or lying (drawn under the figures).
    drawStains: function (ctx, list, vr) {
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if ((e.state !== 'dying' && e.state !== 'dead') || !inView(e, vr, 80)) continue;
        var k = e.state === 'dead' ? 1 : e.fall;
        ctx.fillStyle = 'rgba(34,10,8,' + (0.12 + 0.3 * k).toFixed(3) + ')';
        ctx.beginPath(); ctx.ellipse(e.x + 5 * k, e.y + 4 * k, 10 + 16 * k, 6 + 9 * k, 0.2, 0, TAU); ctx.fill();
      }
    },

    // Health bar (while recently hurt) and the "!" when something just noticed the player. Over the heads of the living.
    drawMarks: function (ctx, list, vr) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr';
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (e.state === 'dying' || e.state === 'dead' || !inView(e, vr, 60)) continue;
        var top = e.y - 62 * (e.scale || 1);
        if (e.hp < e.maxHp && e.sinceHit < 5) {
          var a = e.sinceHit < 3.5 ? 1 : 1 - (e.sinceHit - 3.5) / 1.5, w = 34, h = 4.5, x = e.x - w / 2;
          ctx.globalAlpha = a * 0.85;
          ctx.fillStyle = 'rgba(8,9,9,0.8)'; ctx.fillRect(x - 1.5, top - 1.5, w + 3, h + 3);
          ctx.fillStyle = e.hp / e.maxHp > 0.35 ? '#b0685c' : '#cf7a4c';
          ctx.fillRect(x, top, w * Math.max(0, e.hp / e.maxHp), h);
          ctx.globalAlpha = 1;
        }
        if (e.alertT > 0) {
          ctx.globalAlpha = Math.min(1, e.alertT / 0.3);
          ctx.font = '700 20px "Segoe UI", Arial, sans-serif';
          ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(8,9,9,0.85)'; ctx.lineJoin = 'round';
          ctx.fillStyle = '#e0a85a';
          ctx.strokeText('!', e.x, top - 14); ctx.fillText('!', e.x, top - 14);
          ctx.globalAlpha = 1;
        }
      }
    },

    // Bullet lines: from the muzzle to where the shot ended, fading fast, with a flash at the gun.
    // shot: { x0, y0, x1, y1, h, t, max } (ground points and the height they fly at). Optional feel data (js/feel.js):
    // tl = how long the tracer lasts (`max` is then longer, so the brass can keep falling), gr/ga = muzzle glow radius and
    // alpha, cas = a spent casing (see G.feel.casing). extra = seconds since the last step (render alpha), gain = glow gain.
    drawShots: function (ctx, shots, extra, gain) {
      extra = extra || 0;
      var glow = null, i, s, tt, k, a;
      for (i = 0; i < shots.length; i++) {
        s = shots[i]; tt = s.t + extra;
        var tl = s.tl || s.max;
        k = Math.min(1, tt / tl); a = 1 - k;
        if (k < 1) {
          ctx.lineCap = 'round';
          ctx.globalAlpha = a * 0.35; ctx.strokeStyle = '#f4e8b4'; ctx.lineWidth = 3.4;
          ctx.beginPath(); ctx.moveTo(s.x0, s.y0 - s.h); ctx.lineTo(s.x1, s.y1 - s.h); ctx.stroke();
          ctx.globalAlpha = a * 0.95; ctx.strokeStyle = '#fff6d6'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(s.x0, s.y0 - s.h); ctx.lineTo(s.x1, s.y1 - s.h); ctx.stroke();
          if (tt < 0.05) {                               // the flash itself: a few bright spikes out of the muzzle for 3 frames
            var dx = s.x1 - s.x0, dy = s.y1 - s.y0, dl = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / dl, uy = dy / dl, fl = 1 - tt / 0.05;
            ctx.globalAlpha = fl; ctx.strokeStyle = '#fff2c0'; ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(s.x0, s.y0 - s.h); ctx.lineTo(s.x0 + ux * 26 * fl, s.y0 - s.h + uy * 26 * fl);
            ctx.moveTo(s.x0, s.y0 - s.h); ctx.lineTo(s.x0 + (ux * 0.8 - uy * 0.6) * 13 * fl, s.y0 - s.h + (uy * 0.8 + ux * 0.6) * 13 * fl);
            ctx.moveTo(s.x0, s.y0 - s.h); ctx.lineTo(s.x0 + (ux * 0.8 + uy * 0.6) * 13 * fl, s.y0 - s.h + (uy * 0.8 - ux * 0.6) * 13 * fl);
            ctx.stroke();
          }
          var fr = 20 * (1 - k * 0.7), gr = ctx.createRadialGradient(s.x0, s.y0 - s.h, 0, s.x0, s.y0 - s.h, fr);
          gr.addColorStop(0, 'rgba(255,238,170,' + (a * 0.95).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,170,60,0)');
          ctx.globalAlpha = 1; ctx.fillStyle = gr;
          ctx.beginPath(); ctx.arc(s.x0, s.y0 - s.h, fr, 0, TAU); ctx.fill();
        }
        if (s.cas) art.drawCasing(ctx, s, tt);
      }
      // The warm glow of the muzzle flash (additive, a pre-drawn sprite: no gradients per frame), only for fresh shots.
      for (i = 0; i < shots.length; i++) {
        s = shots[i]; tt = s.t + extra;
        if (!s.gr || tt >= GLOW_T) continue;
        if (!glow) { glow = glowSprite(); if (!glow) break; ctx.globalCompositeOperation = 'lighter'; }
        var q = 1 - tt / GLOW_T, r = s.gr * (0.85 + 0.15 * q);
        ctx.globalAlpha = Math.min(1, s.ga * (gain === undefined ? 1 : gain) * q * q);
        ctx.drawImage(glow, s.x0 - r, s.y0 - s.h - r, r * 2, r * 2);
      }
      if (glow) ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },

    // A small gold dot that flies out, falls (its shadow stays on the ground), bounces once and fades.
    drawCasing: function (ctx, s, t) {
      var c = s.cas, p = casingOut;
      if (t >= c.life) return;
      G.feel.casingPos(c, t, p);
      var gx = s.x0 + p.x, gy = s.y0 + p.y;
      var a = G.feel.casingAlpha(c, t);
      ctx.globalAlpha = a * 0.3; ctx.fillStyle = '#000';
      ctx.fillRect(gx - 1.2, gy - 0.4, 2.4, 1.2);                       // shadow on the ground
      ctx.globalAlpha = a; ctx.fillStyle = '#d9b45a';
      ctx.fillRect(gx - 1.3, gy - p.z - 0.9, 2.6, 1.8);
      ctx.globalAlpha = a * 0.8; ctx.fillStyle = '#fff1b0';
      ctx.fillRect(gx - 1.3, gy - p.z - 0.9, 1.1, 0.8);
    },

    // A short white then red tint over a figure that was just hit (e.hurtK runs 1..0 in 0.42 s). Cheap: two fills of the
    // same body-shaped ellipse + head circle, no offscreen canvas. Called right after the figure is drawn.
    drawHit: function (ctx, e) {
      var k = e.hurtK;
      if (!(k > 0) || e.state === 'dying' || e.state === 'dead') return;
      var s = e.scale || 1, wa = k > 0.6 ? (k - 0.6) / 0.4 * 0.5 : 0, ra = k * k * 0.3;
      var bx = e.x, by = e.y - 28 * s;
      if (wa > 0) { ctx.globalAlpha = wa; ctx.fillStyle = '#fff4ec'; hitShape(ctx, bx, by, s); }
      ctx.globalAlpha = ra; ctx.fillStyle = '#c0261c'; hitShape(ctx, bx, by, s);
      ctx.globalAlpha = 1;
    },

    // Low health: the red edge pulses slowly and the picture loses a little colour. fx = G.feel.lowFx output; hurt = the
    // pre-painted red edge canvas (buildHurt). Screen space (pixels of the canvas), drawn before the vignette.
    drawLowHealth: function (ctx, w, h, hurt, fx) {
      if (fx.desat > 0.005) {
        ctx.globalCompositeOperation = 'saturation';
        ctx.globalAlpha = fx.desat; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (fx.edge > 0.005 && hurt) { ctx.globalAlpha = fx.edge; ctx.drawImage(hurt, 0, 0, w, h); }
      ctx.globalAlpha = 1;
    },

    // The red edge flash, painted once per window size (drawn with an alpha that follows the hit).
    buildHurt: function (w, h, dpr) {
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
      var g = c.getContext('2d'), cx = c.width / 2, cy = c.height / 2;
      var grad = g.createRadialGradient(cx, cy, Math.min(cx, cy) * 0.55, cx, cy, Math.hypot(cx, cy));
      grad.addColorStop(0, 'rgba(120,16,12,0)'); grad.addColorStop(0.7, 'rgba(120,16,12,0.28)'); grad.addColorStop(1, 'rgba(130,18,14,0.62)');
      g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
      return c;
    }
  };

  G.combatArt = art;
})(typeof window !== 'undefined' ? window : globalThis);
