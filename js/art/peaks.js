// Drawing for the snowy mountains (data/places/peaks.js): fires, snow drifts and the frozen packs. Ground 'snow': js/placeart.js.
(function (root) {
  'use strict';
  var G = root.G, TAU = Math.PI * 2;
  if (!G || !G.placeArt) return;

  // a fire: a warm patch of bare ground, a ring of stones, crossed logs, flames that flicker, a soft glow and a thread of smoke
  G.placeArt.register('snowfire', function (ctx, s, c, time, H) {
    var cx = s.x + s.w / 2, cy = s.y + s.h / 2, p = H.lift(cx, cy, 0.01, c), i, x = p[0], y = p[1];
    ctx.fillStyle = 'rgba(52,40,30,0.55)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 46, 30, 0, 0, TAU); ctx.fill();          // the melted ring
    ctx.fillStyle = 'rgba(30,22,16,0.7)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 30, 19, 0, 0, TAU); ctx.fill();
    for (i = 0; i < 9; i++) {                                                                                               // stones
      var a = i / 9 * TAU, sx = x + Math.cos(a) * 24, sy = y + 2 + Math.sin(a) * 14;
      ctx.fillStyle = i % 2 ? '#7a7d80' : '#62666a'; ctx.beginPath(); ctx.ellipse(sx, sy, 6, 4.4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(sx, sy - 2.2, 4, 1.6, 0, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = '#3b2a1c'; ctx.lineWidth = 5; ctx.lineCap = 'round';                                                  // logs
    ctx.beginPath(); ctx.moveTo(x - 14, y + 4); ctx.lineTo(x + 14, y - 2); ctx.moveTo(x - 12, y - 4); ctx.lineTo(x + 12, y + 6); ctx.stroke();
    var fl = 0.8 + Math.sin(time * 9) * 0.12 + Math.sin(time * 14.3 + 1) * 0.08;
    var gr = ctx.createRadialGradient(x, y - 6, 4, x, y - 6, 150 * fl);
    gr.addColorStop(0, 'rgba(255,170,70,0.32)'); gr.addColorStop(1, 'rgba(255,140,50,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y - 6, 150 * fl, 0, TAU); ctx.fill();
    for (i = 0; i < 3; i++) {                                                                                               // flames
      var ph = time * (7 + i * 1.7) + i * 2, h = (22 - i * 4) * (0.8 + Math.sin(ph) * 0.2), w = 8 - i * 1.6, dx = (i - 1) * 6 + Math.sin(ph * 0.7) * 2;
      ctx.fillStyle = ['#e8602a', '#f39a2e', '#ffd860'][i];
      ctx.beginPath(); ctx.moveTo(x + dx - w, y); ctx.quadraticCurveTo(x + dx - w * 0.4, y - h * 0.6, x + dx, y - h); ctx.quadraticCurveTo(x + dx + w * 0.4, y - h * 0.6, x + dx + w, y); ctx.closePath(); ctx.fill();
    }
    for (i = 0; i < 4; i++) {                                                                                               // smoke
      var t = (time * 0.35 + i * 0.25) % 1;
      ctx.fillStyle = 'rgba(190,196,204,' + (0.22 * (1 - t)).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(x + Math.sin(t * 5 + i) * 8 + t * 14, y - 26 - t * 70, 5 + t * 12, 0, TAU); ctx.fill();
    }
  });

  // deep snow: soft bluish-white mounds with a faint shadow side
  G.placeArt.register('drift', function (ctx, s, c, time, H) {
    var cx = s.x + s.w / 2, cy = s.y + s.h / 2, i, n = 5;
    for (i = 0; i < n; i++) {
      var u = (i + 0.5) / n, rx = s.w * (0.22 + 0.06 * ((i * 7) % 3)), ry = s.h * (0.3 + 0.04 * ((i * 5) % 3));
      var x = s.x + s.w * u, y = cy + Math.sin(i * 2.3) * s.h * 0.18;
      var gr = ctx.createRadialGradient(x - rx * 0.2, y - ry * 0.3, 2, x, y, Math.max(rx, ry));
      gr.addColorStop(0, 'rgba(250,253,255,0.95)'); gr.addColorStop(0.7, 'rgba(214,228,242,0.7)'); gr.addColorStop(1, 'rgba(180,200,225,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
    }
  });

  // a pack half buried in snow (the six pack_* resources share it)
  ['pack_parka', 'pack_hat', 'pack_pants', 'pack_boots', 'pack_tea', 'pack_warmer'].forEach(function (name, n) {
    G.placeArt.sprite(name, 2, 910 + n * 11, 56, 44, function (g) {
      g.translate(28, 24);
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(2, 10, 24, 8, 0, 0, TAU); g.fill();
      g.fillStyle = ['#3d5a4a', '#5a4a3a', '#3a4a5a'][n % 3]; g.beginPath(); g.ellipse(0, 0, 17, 12, 0, 0, TAU); g.fill();       // the rucksack
      g.strokeStyle = '#1a1c1a'; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-9, -1, 18, 3);
      g.fillStyle = '#d8a84a'; g.fillRect(-2, 2, 4, 4);
      g.fillStyle = 'rgba(244,250,255,0.95)'; g.beginPath(); g.ellipse(-2, -7, 14, 5, -0.1, 0, TAU); g.fill();                       // snow on top
      g.beginPath(); g.ellipse(12, 6, 9, 4, 0.2, 0, TAU); g.fill();
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
