// Drawing of hand-built places (the port first): paved ground, open water, wooden piers, and structures with
// height (warehouses, containers, cranes, ships, tanks, fences). Same tilted view and light as the base
// (js/baseart.js): a point at height k is lifted away from a point south of the screen center, shadows fall
// to the south-east. Static layers (ground details, cast shadows) are painted once per area.
(function (root) {
  'use strict';
  var G = root.G, TAU = Math.PI * 2;
  var VIEW = G.config.view, SUN = { x: 0.62, y: 0.78 }, SH = 600;   // shadow length = k * SH (the base uses the same scale)
  var K = null, S = 1, grounds = {}, cache = {}, mainCtx = null;

  // ---- small geometry helpers (as in baseart.js) ------------------------------------------------------

  function lift(x, y, k, c) { return [x + (x - c.x) * k, y + (y - c.y) * k * VIEW.persp]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function poly(ctx, pts, fill, stroke) {
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) ctx[i ? 'lineTo' : 'moveTo'](pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function line(ctx, a, b) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  function rgb(hex) { var n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function tone(hex, f) {                       // f < 1 darker, f > 1 lighter
    var c = rgb(hex);
    return 'rgb(' + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f))); }).join(',') + ')';
  }
  function hash(a, b) { var h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); }

  // Light per face: faces turned to the north-west are lit, the rest in shade.
  function faceLight(nx, ny) { return 0.78 + 0.34 * (nx * -0.6 + ny * -0.8); }

  // Extruded polygon (clockwise, y down) from height k0 to k1. side(i, f) = color of edge i with light f.
  // Returns the lifted top and bottom points, and per edge whether it faces the viewer.
  function prism(ctx, pts, k0, k1, c, side, top) {
    var n = pts.length, b = [], t = [], vis = [], i;
    for (i = 0; i < n; i++) { b.push(lift(pts[i][0], pts[i][1], k0, c)); t.push(lift(pts[i][0], pts[i][1], k1, c)); }
    for (i = 0; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n], nx = q[1] - p[1], ny = -(q[0] - p[0]);
      vis.push((c.x - (p[0] + q[0]) / 2) * nx + (c.y - (p[1] + q[1]) / 2) * ny > 0);
    }
    ctx.lineWidth = 1;
    for (var pass = 0; pass < 2; pass++) {
      for (i = 0; i < n; i++) {
        if (vis[i] !== (pass === 1)) continue;
        var j = (i + 1) % n, p2 = pts[i], q2 = pts[j], ex = q2[0] - p2[0], ey = q2[1] - p2[1], L = Math.sqrt(ex * ex + ey * ey) || 1;
        poly(ctx, [b[i], b[j], t[j], t[i]], side(i, faceLight(ey / L, -ex / L)));
      }
    }
    if (top) poly(ctx, t, top);
    return { b: b, t: t, vis: vis };
  }
  function rectPts(r) { return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]; }
  function box(ctx, r, k0, k1, c, col, top) { return prism(ctx, rectPts(r), k0, k1, c, function (i, f) { return tone(col, f * 0.56); }, top || tone(col, 0.84)); }
  // point on a box face: side 0 n, 1 e, 2 s, 3 w; u along the edge (clockwise), f up between k0 and k1
  function onFace(r, side, u, k, c) {
    var P = rectPts(r), a = P[side], b = P[(side + 1) % 4];
    return lift(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, k, c);
  }

  // ---- sprites for the salvage resources ----------------------------------------------------------------

  function shadowBlob(g, x, y, rx, ry, a) { K.softShadow(g, x, y, rx, ry, a); }

  function drawCrate(g, rand, hue) {
    shadowBlob(g, 6, 8, 30, 26, 0.6);
    var w = 34, h = 30;
    g.fillStyle = K.hsl(hue, 22, 12); g.fillRect(-w / 2, -h / 2 + 5, w, h);                 // south face
    g.fillStyle = K.hsl(hue, 26, 26 + rand() * 4); g.fillRect(-w / 2, -h / 2, w, h);        // top
    g.strokeStyle = 'rgba(0,0,0,0.38)'; g.lineWidth = 1;
    for (var i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-w / 2, -h / 2 + i * h / 4); g.lineTo(w / 2, -h / 2 + i * h / 4); g.stroke(); }
    g.strokeStyle = K.hsl(hue, 24, 18); g.lineWidth = 3.2;
    g.strokeRect(-w / 2 + 1.6, -h / 2 + 1.6, w - 3.2, h - 3.2);
    g.beginPath(); g.moveTo(-w / 2 + 3, -h / 2 + 3); g.lineTo(w / 2 - 3, h / 2 - 3); g.stroke();
    g.fillStyle = 'rgba(30,26,20,0.45)'; g.fillRect(-7, -4, 12, 3); g.fillRect(-7, 1, 8, 2);   // stencil marks
    g.strokeStyle = 'rgba(220,200,160,0.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-w / 2, -h / 2 + 0.5); g.lineTo(w / 2, -h / 2 + 0.5); g.stroke();
  }

  function drawPallet(g, rand) {
    shadowBlob(g, 5, 6, 30, 26, 0.5);
    var stack = 1 + Math.floor(rand() * 2), i, k;
    for (k = 0; k < stack; k++) {
      var oy = -k * 5, ox = (rand() - 0.5) * 4;
      g.fillStyle = '#17130e'; g.fillRect(-20 + ox, -16 + oy + 3, 40, 34);
      for (i = 0; i < 5; i++) {
        if (k === stack - 1 && rand() < 0.12) continue;                                     // a broken slat
        g.fillStyle = K.hsl(34, 22, 30 + rand() * 8); g.fillRect(-20 + ox, -16 + oy + i * 7, 40, 5);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-20 + ox, -16 + oy + i * 7 + 4, 40, 1);
      }
      g.fillStyle = 'rgba(30,22,14,0.8)';
      [-14, 0, 14].forEach(function (x) { g.fillRect(x - 1 + ox, -16 + oy, 2, 34); });
    }
  }

  function drawScrap(g, rand) {
    shadowBlob(g, 5, 6, 28, 22, 0.55);
    for (var i = 0; i < 6; i++) {
      var a = rand() * Math.PI, x = (rand() - 0.5) * 18, y = (rand() - 0.5) * 14, rust = rand() < 0.6;
      g.save(); g.translate(x, y); g.rotate(a);
      if (i % 3 === 0) {                                                                    // a pipe
        g.strokeStyle = '#191b1a'; g.lineWidth = 6; g.beginPath(); g.moveTo(-14, 1); g.lineTo(14, 1); g.stroke();
        g.strokeStyle = rust ? '#6b4a34' : '#646c69'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(-14, 0); g.lineTo(14, 0); g.stroke();
        g.strokeStyle = 'rgba(220,220,210,0.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-13, -1.5); g.lineTo(13, -1.5); g.stroke();
      } else {                                                                              // a bent plate
        g.fillStyle = '#121413'; g.fillRect(-9, -6 + 2, 18, 12);
        g.fillStyle = rust ? K.hsl(22, 34, 26 + rand() * 8) : K.hsl(160, 4, 34 + rand() * 8); g.fillRect(-9, -6, 18, 12);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-2, -6, 2, 12);
        g.fillStyle = 'rgba(30,20,12,0.5)'; g.beginPath(); g.arc(4, 2, 1.4, 0, TAU); g.fill();
      }
      g.restore();
    }
  }

  function drawTarp(g, rand, hue) {
    shadowBlob(g, 4, 6, 30, 24, 0.5);
    g.fillStyle = K.hsl(hue, 16, 18);
    g.beginPath();
    for (var i = 0; i <= 10; i++) {
      var a = i / 10 * TAU, r = 17 + rand() * 6;
      g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * 1.15, Math.sin(a) * r * 0.85);
    }
    g.closePath(); g.fill();
    g.fillStyle = K.hsl(hue, 18, 27); g.beginPath(); g.ellipse(-3, -3, 15, 10, 0.3, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.2;                                     // folds
    for (i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-14 + i * 7, -8); g.quadraticCurveTo(-10 + i * 7, 0, -16 + i * 8, 9); g.stroke(); }
    g.strokeStyle = '#6e6046'; g.lineWidth = 2.2;                                               // rope coil on top
    for (i = 0; i < 3; i++) { g.beginPath(); g.ellipse(9, 5, 7 - i * 2, 5 - i * 1.4, 0, 0, TAU); g.stroke(); }
  }

  function drawCargo(g, rand) {
    shadowBlob(g, 4, 6, 28, 22, 0.55);
    g.fillStyle = '#2c2418'; g.fillRect(-15, -10, 26, 22);                                      // torn carton
    g.fillStyle = '#6a5838'; g.fillRect(-15, -12, 26, 20);
    g.fillStyle = '#1a150e'; g.fillRect(-11, -9, 18, 14);
    g.fillStyle = '#7a6840'; g.beginPath(); g.moveTo(-15, -12); g.lineTo(-21, -18); g.lineTo(-9, -15); g.closePath(); g.fill();   // flaps
    g.beginPath(); g.moveTo(11, -12); g.lineTo(17, -17); g.lineTo(13, -6); g.closePath(); g.fill();
    for (var i = 0; i < 6; i++) {                                                                 // cans inside and spilled
      var x = i < 4 ? -7 + (i % 2) * 9 : 12 + (i - 4) * 6, y = i < 4 ? -5 + Math.floor(i / 2) * 7 : 8 + (i - 4) * 3;
      g.fillStyle = '#0e0f0e'; g.beginPath(); g.arc(x + 0.8, y + 1.2, 3.6, 0, TAU); g.fill();
      g.fillStyle = K.hsl(i % 2 ? 4 : 40, 26, 34 + rand() * 6); g.beginPath(); g.arc(x, y, 3.4, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(230,230,220,0.4)'; g.lineWidth = 0.8; g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.stroke();
    }
  }

  function drawBarrel(g, rand) {
    shadowBlob(g, 6, 8, 24, 20, 0.6);
    g.fillStyle = '#141615'; g.beginPath(); g.ellipse(0, 4, 15, 14, 0, 0, TAU); g.fill();
    var hue = rand() < 0.5 ? 205 : 18;
    g.fillStyle = K.hsl(hue, 22, 26); g.beginPath(); g.arc(0, 0, 15, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.stroke();
    g.fillStyle = '#1b2a2c'; g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.fill();                    // rain water inside
    g.fillStyle = 'rgba(160,200,195,0.18)'; g.beginPath(); g.ellipse(-3, -3, 6, 2, -0.5, 0, TAU); g.fill();
    g.fillStyle = 'rgba(110,70,40,0.5)'; g.beginPath(); g.arc(9, 7, 3, 0, TAU); g.fill();         // rust
  }

  function drawFuelDrum(g, rand) {
    shadowBlob(g, 6, 8, 24, 20, 0.6);
    g.fillStyle = '#141615'; g.beginPath(); g.ellipse(0, 4, 15, 14, 0, 0, TAU); g.fill();
    g.fillStyle = rand() < 0.5 ? '#8a3a2a' : '#7a3326'; g.beginPath(); g.arc(0, 0, 15, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.stroke();
    g.fillStyle = '#2a1a16'; g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill();
    g.fillStyle = '#c9a23a'; g.beginPath(); g.arc(-3, -3, 2.2, 0, TAU); g.fill();           // cap
    g.fillStyle = 'rgba(255,200,120,0.18)'; g.beginPath(); g.ellipse(-5, -6, 6, 2, -0.5, 0, TAU); g.fill();
  }

  function variants(n, seed, make) {
    var out = [], rand = G.util.rng(seed);
    for (var i = 0; i < n; i++) out.push(make(rand, i));
    return out;
  }

  function buildSprites() {
    var SP = K.SP, mk = K.mk;
    SP.crate = variants(3, 211, function (r, i) { return mk(70, 70, function (g) { drawCrate(g, r, [32, 26, 40][i]); }); });
    SP.pallet = variants(3, 223, function (r) { return mk(64, 64, function (g) { drawPallet(g, r); }); });
    SP.scrap = variants(3, 229, function (r) { return mk(64, 64, function (g) { drawScrap(g, r); }); });
    SP.tarp = variants(3, 233, function (r, i) { return mk(70, 64, function (g) { drawTarp(g, r, [196, 80, 30][i]); }); });
    SP.cargo = variants(2, 239, function (r) { return mk(64, 60, function (g) { drawCargo(g, r); }); });
    SP.barrel = variants(2, 241, function (r) { return mk(52, 52, function (g) { drawBarrel(g, r); }); });
    SP.fueldrum = variants(2, 247, function (r) { return mk(52, 52, function (g) { drawFuelDrum(g, r); }); });
    SP.vend_snack = variants(2, 263, function (r) { return mk(60, 52, function (g) { drawVendLoot(g, r, false); }); });
    SP.vend_drink = variants(2, 269, function (r) { return mk(60, 52, function (g) { drawVendLoot(g, r, true); }); });
    SP.papers = variants(4, 271, function (r) { return mk(40, 36, function (g) { drawPapers(g, r); }); });
    SP.medkit = variants(2, 251, function (r) { return mk(52, 52, function (g) { drawMedkit(g, r); }); });
    SP.radio = variants(2, 257, function (r) { return mk(56, 56, function (g) { drawRadio(g, r); }); });
  }

  function buildConcrete(ctx, kind) {
    var gravel = kind === 'gravel', snow = kind === 'snow';
    var size = 512, rand = G.util.rng(4121), i;
    var c = document.createElement('canvas');
    c.width = c.height = size * S;
    var g = c.getContext('2d');
    g.scale(S, S);
    g.fillStyle = snow ? '#9aa9bc' : gravel ? '#25221d' : '#1b1d1c'; g.fillRect(0, 0, size, size);
    var tones = snow ? ['255,255,255,0.28', '120,150,200,0.16', '230,240,252,0.22', '70,92,130,0.12'] : gravel ? ['0,0,0,0.2', '96,86,66,0.14', '70,62,48,0.14', '50,46,38,0.14'] : ['0,0,0,0.2', '70,74,68,0.12', '60,52,40,0.1', '40,48,40,0.12'];
    for (i = 0; i < 40; i++) {
      var px = rand() * size, py = rand() * size, pr = 30 + rand() * 90, t = tones[i % 4];
      for (var ox = -size; ox <= size; ox += size) for (var oy = -size; oy <= size; oy += size) {
        var gr = g.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, pr);
        gr.addColorStop(0, 'rgba(' + t + ')'); gr.addColorStop(1, 'rgba(' + t.replace(/[\d.]+$/, '0') + ')');
        g.fillStyle = gr; g.fillRect(px + ox - pr, py + oy - pr, pr * 2, pr * 2);
      }
    }
    for (i = 0; i < 3200; i++) { g.fillStyle = ['rgba(150,150,140,0.06)', 'rgba(0,0,0,0.22)', 'rgba(90,80,64,0.08)'][i % 3]; g.fillRect(rand() * size, rand() * size, 1 + rand() * 1.5, 1 + rand() * 1.5); }
    if (gravel) for (i = 0; i < 2600; i++) { g.fillStyle = ['rgba(150,140,120,0.12)', 'rgba(0,0,0,0.3)'][i % 2]; g.beginPath(); g.arc(rand() * size, rand() * size, 0.8 + rand() * 1.6, 0, TAU); g.fill(); }
    g.strokeStyle = gravel || snow ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.32)'; g.lineWidth = 1.5;                                       // slab joints
    for (i = 0; i <= size; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, size); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(size, i); g.stroke(); }
    g.strokeStyle = gravel || snow ? 'rgba(0,0,0,0)' : 'rgba(170,170,160,0.05)'; g.lineWidth = 1;
    for (i = 0; i <= size; i += 128) { g.beginPath(); g.moveTo(i + 1.5, 0); g.lineTo(i + 1.5, size); g.stroke(); g.beginPath(); g.moveTo(0, i + 1.5); g.lineTo(size, i + 1.5); g.stroke(); }
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1;                                          // hairline cracks
    for (i = 0; i < (snow ? 0 : 14); i++) {
      var x = rand() * size, y = rand() * size, a = rand() * TAU;
      g.beginPath(); g.moveTo(x, y);
      for (var s = 0; s < 6; s++) { a += (rand() - 0.5) * 1.2; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); }
      g.stroke();
    }
    var pat = ctx.createPattern(c, 'repeat');
    try { if (S !== 1 && pat.setTransform) pat.setTransform(new DOMMatrix().scale(1 / S)); } catch (e) { /* tile resolution */ }
    return pat;
  }

  // ---- per-area static layers ---------------------------------------------------------------------------

  // Ground details at half resolution: water, quay edges, roads with markings, piers, stains and weeds.
  function buildOverlay(area) {
    var k = 0.5, W = area.width, H = area.height, rand = G.util.rng(area.seed * 7 + 3), i;
    var c = document.createElement('canvas');
    c.width = Math.ceil(W * k); c.height = Math.ceil(H * k);
    var g = c.getContext('2d');
    g.scale(k, k); g.lineCap = 'butt';

    area.roads.forEach(function (r) {                                                           // asphalt
      var horiz0 = r.w > r.h;
      if (r.style === 'dirt') {                                                                 // a dirt track with two wheel ruts
        g.fillStyle = 'rgba(70,58,40,0.4)'; g.fillRect(r.x, r.y, r.w, r.h);
        g.strokeStyle = 'rgba(40,32,22,0.45)'; g.lineWidth = 12;
        [0.3, 0.7].forEach(function (u) { g.beginPath(); if (horiz0) { g.moveTo(r.x, r.y + r.h * u); g.lineTo(r.x + r.w, r.y + r.h * u); } else { g.moveTo(r.x + r.w * u, r.y); g.lineTo(r.x + r.w * u, r.y + r.h); } g.stroke(); });
        return;
      }
      if (r.style === 'runway') {                                                               // light concrete, threshold bars, center dashes
        g.fillStyle = 'rgba(70,72,68,0.55)'; g.fillRect(r.x, r.y, r.w, r.h);
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
        for (var jx = r.x; jx < r.x + r.w; jx += 160) { g.beginPath(); g.moveTo(jx, r.y); g.lineTo(jx, r.y + r.h); g.stroke(); }
        g.fillStyle = 'rgba(200,200,186,0.25)';
        [r.x + 40, r.x + r.w - 40 - 120].forEach(function (tx) { for (var b = 0; b < 8; b++) g.fillRect(tx, r.y + 20 + b * (r.h - 40) / 8, 120, (r.h - 40) / 8 * 0.55); });
        g.strokeStyle = 'rgba(210,210,196,0.3)'; g.lineWidth = 6; g.setLineDash([90, 70]);
        g.beginPath(); g.moveTo(r.x + 220, r.y + r.h / 2); g.lineTo(r.x + r.w - 220, r.y + r.h / 2); g.stroke(); g.setLineDash([]);
        g.strokeStyle = 'rgba(200,200,186,0.18)'; g.lineWidth = 4; g.strokeRect(r.x + 10, r.y + 10, r.w - 20, r.h - 20);
        return;
      }
      g.fillStyle = 'rgba(14,15,16,0.55)'; g.fillRect(r.x, r.y, r.w, r.h);
      g.strokeStyle = 'rgba(190,186,170,0.1)'; g.lineWidth = 3;
      var horiz = r.w > r.h;
      if (horiz) { g.beginPath(); g.moveTo(r.x, r.y + 8); g.lineTo(r.x + r.w, r.y + 8); g.moveTo(r.x, r.y + r.h - 8); g.lineTo(r.x + r.w, r.y + r.h - 8); g.stroke(); }
      else { g.beginPath(); g.moveTo(r.x + 8, r.y); g.lineTo(r.x + 8, r.y + r.h); g.moveTo(r.x + r.w - 8, r.y); g.lineTo(r.x + r.w - 8, r.y + r.h); g.stroke(); }
      g.strokeStyle = 'rgba(170,140,60,0.16)'; g.lineWidth = 4; g.setLineDash([46, 40]);       // faded center line
      g.beginPath();
      if (horiz) { g.moveTo(r.x, r.y + r.h / 2); g.lineTo(r.x + r.w, r.y + r.h / 2); } else { g.moveTo(r.x + r.w / 2, r.y); g.lineTo(r.x + r.w / 2, r.y + r.h); }
      g.stroke(); g.setLineDash([]);
      for (var p = 0; p < (r.w * r.h) / 9000; p++) {                                           // potholes
        var px = r.x + 20 + rand() * (r.w - 40), py = r.y + 14 + rand() * (r.h - 28), pr = 6 + rand() * 14;
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(px, py, pr, pr * 0.7, rand() * 3, 0, TAU); g.fill();
        if (rand() < 0.4) { g.fillStyle = 'rgba(120,150,150,0.08)'; g.beginPath(); g.ellipse(px - 1, py - 1, pr * 0.6, pr * 0.35, 0, 0, TAU); g.fill(); }
      }
    });

    interiorOverlay(g, area, rand);
    (area.pads || []).forEach(function (pd) {                                                    // helipads
      g.fillStyle = 'rgba(30,32,30,0.7)'; g.beginPath(); g.arc(pd.x, pd.y, pd.r, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(200,190,150,0.3)'; g.lineWidth = 6; g.beginPath(); g.arc(pd.x, pd.y, pd.r - 14, 0, TAU); g.stroke();
      g.lineWidth = 10; var hs = pd.r * 0.35;
      g.beginPath(); g.moveTo(pd.x - hs, pd.y - hs); g.lineTo(pd.x - hs, pd.y + hs); g.moveTo(pd.x + hs, pd.y - hs); g.lineTo(pd.x + hs, pd.y + hs); g.moveTo(pd.x - hs, pd.y); g.lineTo(pd.x + hs, pd.y); g.stroke();
    });
    (area.terraces || []).forEach(function (q) {                                                 // stepped quarry pit, each bench darker
      for (var n = 0; n < q.n; n++) {
        var f = 1 - n / q.n;
        g.fillStyle = 'rgba(' + (96 - n * 12) + ',' + (88 - n * 11) + ',' + (74 - n * 10) + ',0.55)';
        g.beginPath(); g.ellipse(q.x, q.y, q.rx * f, q.ry * f, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(170,160,130,0.18)'; g.lineWidth = 3;
        g.beginPath(); g.ellipse(q.x, q.y - 4, q.rx * f, q.ry * f, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 6;
        g.beginPath(); g.ellipse(q.x, q.y + 3, q.rx * f, q.ry * f, 0, 0.1, Math.PI - 0.1); g.stroke();
      }
    });
    (area.crops || []).forEach(function (f) {                                                    // ploughed rows, gone to weeds
      g.fillStyle = 'rgba(' + (f.tone || '70,58,36') + ',0.5)'; g.fillRect(f.x, f.y, f.w, f.h);
      g.lineCap = 'round';
      for (var o = 10; o < (f.vert ? f.w : f.h); o += 22) {
        g.strokeStyle = 'rgba(30,24,14,0.5)'; g.lineWidth = 7;
        g.beginPath(); if (f.vert) { g.moveTo(f.x + o, f.y + 6); g.lineTo(f.x + o, f.y + f.h - 6); } else { g.moveTo(f.x + 6, f.y + o); g.lineTo(f.x + f.w - 6, f.y + o); } g.stroke();
        g.strokeStyle = 'rgba(' + (f.plant || '70,86,44') + ',0.55)'; g.lineWidth = 3; g.setLineDash([5, 7]);
        g.beginPath(); if (f.vert) { g.moveTo(f.x + o + 6, f.y + 6); g.lineTo(f.x + o + 6, f.y + f.h - 6); } else { g.moveTo(f.x + 6, f.y + o + 6); g.lineTo(f.x + f.w - 6, f.y + o + 6); } g.stroke();
        g.setLineDash([]);
      }
      g.lineCap = 'butt';
    });
    (area.lots || []).forEach(function (r) {                                                    // parking lots with faded bay lines
      g.fillStyle = 'rgba(14,15,16,0.45)'; g.fillRect(r.x, r.y, r.w, r.h);
      g.strokeStyle = 'rgba(190,186,170,0.1)'; g.lineWidth = 3;
      for (var bx = r.x + 30; bx < r.x + r.w - 20; bx += 110) { g.beginPath(); g.moveTo(bx, r.y + 20); g.lineTo(bx, r.y + Math.min(190, r.h - 20)); g.stroke(); }
      for (var q = 0; q < r.w * r.h / 30000; q++) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(r.x + rand() * r.w, r.y + rand() * r.h, 8 + rand() * 20, 5 + rand() * 9, rand() * 3, 0, TAU); g.fill(); }
    });
    area.structures.forEach(function (s) {                                                      // painted bays under containers, crane rails, loading ramp
      if (s.kind === 'container') { g.strokeStyle = 'rgba(200,196,170,0.09)'; g.lineWidth = 3; g.strokeRect(s.x - 8, s.y - 8, s.w + 16, s.h + 16); }
      if (s.kind === 'crane') {
        g.strokeStyle = 'rgba(140,146,140,0.3)'; g.lineWidth = 3;
        [s.y + 13, s.y + s.h - 13].forEach(function (y) { g.beginPath(); g.moveTo(1680, y); g.lineTo(3360, y); g.stroke(); });
      }
      if (s.kind === 'dock') {
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(s.x + 6, s.y + 8, s.w, s.h);
        g.fillStyle = '#2a2c2a'; g.fillRect(s.x, s.y, s.w, s.h);
        g.save(); g.beginPath(); g.rect(s.x, s.y + s.h - 9, s.w, 9); g.clip();
        for (var x = s.x - 20; x < s.x + s.w; x += 18) { g.fillStyle = 'rgba(160,130,50,0.45)'; g.beginPath(); g.moveTo(x, s.y + s.h); g.lineTo(x + 9, s.y + s.h - 9); g.lineTo(x + 18, s.y + s.h - 9); g.lineTo(x + 9, s.y + s.h); g.fill(); }
        g.restore();
      }
    });

    for (i = 0; i < (area.interior ? 0 : 70); i++) {                                            // oil stains and rust marks
      var sx = 150 + rand() * (W - 300), sy = 900 + rand() * (H - 1000), sr = 10 + rand() * 40;
      var gr = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
      gr.addColorStop(0, rand() < 0.5 ? 'rgba(6,6,8,0.4)' : 'rgba(80,46,24,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    }
    for (i = 0; i < (area.interior ? 0 : 40); i++) {                                            // moss along cracks
      var mx = 150 + rand() * (W - 300), my = 900 + rand() * (H - 1000), a = rand() * TAU;
      g.strokeStyle = 'rgba(52,70,40,0.28)'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(mx, my);
      for (var s2 = 0; s2 < 7; s2++) { a += (rand() - 0.5); mx += Math.cos(a) * 16; my += Math.sin(a) * 16; g.lineTo(mx, my); }
      g.stroke();
    }

    // open water, then the dark band under the quay wall and the lit curb on top of it
    area.water.forEach(function (w) {
      var lg = g.createLinearGradient(0, w.y + w.h, 0, w.y);
      lg.addColorStop(0, '#102026'); lg.addColorStop(0.4, '#0d1b20'); lg.addColorStop(1, '#09141a');
      g.fillStyle = lg; g.fillRect(w.x, w.y, w.w, w.h);
    });
    g.fillStyle = 'rgba(160,190,190,0.035)';
    for (i = 0; i < 400; i++) {
      var wx = rand() * W, wy = rand() * H;
      if (G.area.inSea(area, wx, wy)) { g.beginPath(); g.ellipse(wx, wy, 14 + rand() * 40, 1.4, 0, 0, TAU); g.fill(); }
    }
    function shoreRun(x0, y0, x1, y1, nx, ny) {                                                  // a quay edge segment; (nx, ny) points into the water
      var lg2 = g.createLinearGradient(x0, y0, x0 + nx * 46, y0 + ny * 46);
      lg2.addColorStop(0, 'rgba(0,0,0,0.6)'); lg2.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = lg2;
      g.fillRect(Math.min(x0, x1, x0 + nx * 46), Math.min(y0, y1, y0 + ny * 46), Math.abs(x1 - x0) + Math.abs(nx) * 46, Math.abs(y1 - y0) + Math.abs(ny) * 46);
      g.strokeStyle = '#3b3e3a'; g.lineWidth = 10; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(x0 - nx * 5, y0 - ny * 5); g.lineTo(x1 - nx * 5, y1 - ny * 5); g.stroke();
      g.strokeStyle = 'rgba(200,200,186,0.14)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0 - nx * 9, y0 - ny * 9); g.lineTo(x1 - nx * 9, y1 - ny * 9); g.stroke();
      g.strokeStyle = 'rgba(70,90,60,0.4)'; g.lineWidth = 3;                                    // slime at the waterline
      g.beginPath(); g.moveTo(x0 + nx * 2, y0 + ny * 2); g.lineTo(x1 + nx * 2, y1 + ny * 2); g.stroke();
    }
    var SEG = 20;                                                                               // walk the land/sea boundary in small steps
    for (var x2 = 0; x2 < W; x2 += SEG) for (var y2 = 0; y2 < H; y2 += SEG) {
      var here = G.area.inSea(area, x2 + SEG / 2, y2 + SEG / 2);
      if (!here) continue;
      if (y2 + SEG < H && !G.area.inSea(area, x2 + SEG / 2, y2 + SEG * 1.5) && !onDeck(area, x2 + SEG / 2, y2 + SEG * 1.5)) shoreRun(x2, y2 + SEG, x2 + SEG, y2 + SEG, 0, -1);
      if (x2 + SEG < W && !G.area.inSea(area, x2 + SEG * 1.5, y2 + SEG / 2) && !onDeck(area, x2 + SEG * 1.5, y2 + SEG / 2)) shoreRun(x2 + SEG, y2, x2 + SEG, y2 + SEG, -1, 0);
      if (x2 > 0 && !G.area.inSea(area, x2 - SEG / 2, y2 + SEG / 2) && !onDeck(area, x2 - SEG / 2, y2 + SEG / 2)) shoreRun(x2, y2, x2, y2 + SEG, 1, 0);
    }

    area.decks.forEach(function (d) {                                                           // wooden piers on pilings
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(d.x + 12, d.y + 16, d.w, d.h);
      var horiz = d.w > d.h, step = 14, o;
      g.fillStyle = '#2b241a'; g.fillRect(d.x, d.y, d.w, d.h);
      for (o = 0; o < (horiz ? d.w : d.h); o += step) {
        if (hash(d.x + o, d.y) < 0.05) continue;                                               // a missing plank shows the water
        g.fillStyle = K.hsl(32, 20, 22 + hash(o, d.y) * 7);
        if (horiz) g.fillRect(d.x + o + 1, d.y + 2, step - 2, d.h - 4); else g.fillRect(d.x + 2, d.y + o + 1, d.w - 4, step - 2);
      }
      g.fillStyle = '#1d1810';
      if (horiz) { g.fillRect(d.x, d.y, d.w, 4); g.fillRect(d.x, d.y + d.h - 5, d.w, 5); } else { g.fillRect(d.x, d.y, 4, d.h); g.fillRect(d.x + d.w - 5, d.y, 5, d.h); }
      for (o = 10; o < (horiz ? d.w : d.h); o += 70) {                                          // piling heads along both edges
        [0, 1].forEach(function (e) {
          var px = horiz ? d.x + o : d.x + (e ? d.w - 6 : 6), py = horiz ? d.y + (e ? d.h - 6 : 6) : d.y + o;
          g.fillStyle = '#16120c'; g.beginPath(); g.arc(px, py, 7, 0, TAU); g.fill();
          g.fillStyle = '#4a3f30'; g.beginPath(); g.arc(px - 1, py - 1, 5, 0, TAU); g.fill();
        });
      }
    });
    interiorFinish(g, area);
    return { c: c, k: k };
  }
  function onDeck(area, x, y) {
    for (var i = 0; i < area.decks.length; i++) { var d = area.decks[i]; if (x > d.x && x < d.x + d.w && y > d.y && y < d.y + d.h) return true; }
    return false;
  }

  // All cast shadows of the structures, blurred once.
  function buildShadows(area) {
    var k = 0.5, c = document.createElement('canvas');
    c.width = Math.ceil(area.width * k); c.height = Math.ceil(area.height * k);
    var g = c.getContext('2d');
    g.scale(k, k);
    try { g.filter = 'blur(4px)'; } catch (e) { /* sharp shadows */ }
    g.fillStyle = '#000';
    function sweep(r, hh) {
      var dx = SUN.x * hh, dy = SUN.y * hh;
      g.beginPath();
      g.moveTo(r.x, r.y); g.lineTo(r.x + r.w, r.y); g.lineTo(r.x + r.w + dx, r.y + dy);
      g.lineTo(r.x + r.w + dx, r.y + r.h + dy); g.lineTo(r.x + dx, r.y + r.h + dy); g.lineTo(r.x, r.y + r.h);
      g.closePath(); g.fill();
    }
    area.structures.forEach(function (s) {
      var hh = s.k * SH;
      if (s.kind === 'tower') {
        s.legs.forEach(function (l) { sweep({ x: l.x + 3, y: l.y + 3, w: l.w - 6, h: l.h - 6 }, hh); });
        g.globalAlpha = 0.8; g.fillRect(s.x - 6 + SUN.x * hh * 0.9, s.y - 6 + SUN.y * hh * 0.9, s.w + 12, s.h + 12); g.globalAlpha = 1;
      } else if (s.kind === 'crane') {
        s.legs.forEach(function (l) { sweep({ x: l.x + 4, y: l.y + 4, w: l.w - 8, h: l.h - 8 }, hh); });
        g.globalAlpha = 0.6;                                                                    // the girders high above
        var dx = SUN.x * hh, dy = SUN.y * hh;
        g.fillRect(s.x + dx, s.y + dy - s.boom, 34, s.h + s.boom); g.fillRect(s.x + s.w - 34 + dx, s.y + dy, 34, s.h);
        g.fillRect(s.x + s.w / 2 - 22 + dx, s.y + dy - s.boom, 44, s.boom + s.h);
        g.globalAlpha = 1;
      } else if (s.kind === 'plane') {
        var pcy = s.y + s.h / 2, pdx = SUN.x * hh, pdy = SUN.y * hh;
        g.fillRect(s.x + pdx, pcy - 28 + pdy, s.w, 56);
        g.fillRect(s.x + s.w * 0.42 + pdx * 0.9, s.y + pdy * 0.9, s.w * 0.2, s.h);
      } else if (s.kind === 'house') {
        sweep(s, hh * 1.4);
      } else if (s.kind === 'tankc' || s.kind === 'bollard' || s.kind === 'pile') {
        var r = s.w / 2, cx = s.x + r, cy = s.y + r;
        for (var t = 0; t <= 1; t += 0.1) { g.beginPath(); g.arc(cx + SUN.x * hh * t, cy + SUN.y * hh * t, r, 0, TAU); g.fill(); }
      } else if (s.kind === 'lamp' || s.kind === 'flagpole') {
        g.globalAlpha = 0.7; g.lineWidth = 5; g.strokeStyle = '#000';
        g.beginPath(); g.moveTo(s.x + 5, s.y + 5); g.lineTo(s.x + 5 + SUN.x * hh, s.y + 5 + SUN.y * hh); g.stroke(); g.globalAlpha = 1;
      } else if (s.kind === 'fence') {
        g.globalAlpha = 0.35; sweep(s, hh); g.globalAlpha = 1;
      } else if (s.kind !== 'dock') {
        sweep(s, hh);
      }
    });
    return { c: c, k: k };
  }

  function prepare(area) {
    if (cache[area.id]) return cache[area.id];
    var T = { overlay: buildOverlay(area), shadows: buildShadows(area), order: [], fade: {} };
    T.order = area.structures.filter(function (s) { return s.kind !== 'dock'; });
    T.order.sort(function (p, q) { return (p.y + p.h) - (q.y + q.h); });
    cache[area.id] = T;
    return T;
  }

  function layer(ctx, L, area, vr) {
    var k = L.k, sx = Math.max(0, vr.x0), sy = Math.max(0, vr.y0), ex = Math.min(area.width, vr.x1), ey = Math.min(area.height, vr.y1);
    if (ex > sx && ey > sy) ctx.drawImage(L.c, sx * k, sy * k, (ex - sx) * k, (ey - sy) * k, sx, sy, ex - sx, ey - sy);
  }

  // ---- frame drawing --------------------------------------------------------------------------------------

  function drawGround(ctx, area, vr, time) {
    var T = prepare(area), i;
    layer(ctx, T.overlay, area, vr);
    ctx.lineWidth = 1.2;                                                                        // slow glints drifting on the water
    for (i = 0; i < 60; i++) {
      var x = vr.x0 + ((hash(i, 1) * 1.3 * (vr.x1 - vr.x0) + time * (6 + hash(i, 2) * 8)) % (vr.x1 - vr.x0 + 120)) - 60;
      var y = vr.y0 + hash(i, 3) * (vr.y1 - vr.y0);
      if (!G.area.inSea(area, x, y)) continue;
      var a = 0.5 + 0.5 * Math.sin(time * 0.9 + i * 1.7);
      ctx.strokeStyle = 'rgba(170,200,196,' + (a * 0.09).toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x + 14, y); ctx.stroke();
    }
    area.water.forEach(function (w) {                                                           // gentle lapping along the quay edge
      if (w.y + w.h < vr.y0 - 20 || w.y + w.h > vr.y1 + 20) return;
      for (var x = Math.max(w.x, vr.x0 - 40); x < Math.min(w.x + w.w, vr.x1 + 40); x += 40) {
        if (!G.area.inSea(area, x + 20, w.y + w.h - 4)) continue;
        var ph = Math.sin(time * 1.3 + x * 0.013);
        ctx.fillStyle = 'rgba(150,180,175,' + (0.04 + ph * 0.025).toFixed(3) + ')';
        ctx.fillRect(x, w.y + w.h - 10 - ph * 3, 40, 3);
      }
    });
    ctx.globalAlpha = 0.5;
    layer(ctx, T.shadows, area, vr);
    ctx.globalAlpha = 1;
  }

  var CRANE = '#6c5734';
  function drawContainer(ctx, s, c) {
    var bx = box(ctx, s, 0, s.k, c, s.color), b = bx.b, t = bx.t, i, lv;
    ctx.lineWidth = 1;
    for (var side = 0; side < 4; side++) {                                                      // ribs and stack seams on the visible faces
      if (!bx.vis[side]) continue;
      var P = rectPts(s), A = P[side], B = P[(side + 1) % 4], len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      for (var u = 8; u < len - 4; u += 9) line(ctx, onFace(s, side, u / len, 0.004, c), onFace(s, side, u / len, s.k - 0.004, c));
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2;
      for (lv = 1; lv < s.level; lv++) line(ctx, onFace(s, side, 0, s.k * lv / s.level, c), onFace(s, side, 1, s.k * lv / s.level, c));
      ctx.lineWidth = 1;
      for (i = 0; i < 3; i++) {                                                                 // rust streaks
        var ru = hash(s.x + side, s.y + i);
        if (ru > 0.7) continue;
        ctx.strokeStyle = 'rgba(70,36,18,0.35)'; ctx.lineWidth = 3;
        line(ctx, onFace(s, side, ru, s.k * 0.96, c), onFace(s, side, ru + 0.01, s.k * (0.3 + hash(i, s.x) * 0.5), c));
        ctx.lineWidth = 1;
      }
    }
    if (s.open && bx.vis[2]) {                                                                   // doors swung open on the south face
      var u0 = 0.36, u1 = 0.64;
      poly(ctx, [onFace(s, 2, 1 - u0, 0, c), onFace(s, 2, 1 - u1, 0, c), onFace(s, 2, 1 - u1, s.k * 0.94, c), onFace(s, 2, 1 - u0, s.k * 0.94, c)], '#0a0b0a');
      var hinge = onFace(s, 2, 1 - u0, 0, c), hingeT = onFace(s, 2, 1 - u0, s.k * 0.94, c);
      var leaf = lift(s.x + s.w * u0 - 6, s.y + s.h + 52, 0, c), leafT = lift(s.x + s.w * u0 - 6, s.y + s.h + 52, s.k * 0.94, c);
      poly(ctx, [hinge, leaf, leafT, hingeT], tone(s.color, 0.8), 'rgba(0,0,0,0.5)');
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';                                                        // corrugated roof + lit north edge
    for (i = 1; i < 12; i++) line(ctx, mix(t[0], t[1], i / 12), mix(t[3], t[2], i / 12));
    ctx.strokeStyle = 'rgba(230,220,200,0.16)'; line(ctx, t[0], t[1]); line(ctx, t[3], t[0]);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; poly(ctx, t, null, 'rgba(0,0,0,0.55)');
  }

  function drawWarehouse(ctx, s, c) {
    var col = s.color, bx = box(ctx, s, 0, s.k, c, col, null), i;
    ctx.lineWidth = 1;
    [1, 2].forEach(function (side) {                                                            // vertical cladding ribs
      if (!bx.vis[side]) return;
      var len = side === 2 ? s.w : s.h;
      ctx.strokeStyle = 'rgba(0,0,0,0.24)';
      for (var u = 12; u < len; u += 12) line(ctx, onFace(s, side, u / len, 0.004, c), onFace(s, side, u / len, s.k, c));
    });
    if (bx.vis[2]) {                                                                             // big roller door, half up, dark inside
      var d0 = 1 - s.door - 0.12, d1 = 1 - s.door + 0.12;
      poly(ctx, [onFace(s, 2, d0, 0, c), onFace(s, 2, d1, 0, c), onFace(s, 2, d1, s.k * 0.72, c), onFace(s, 2, d0, s.k * 0.72, c)], '#3d403b');
      poly(ctx, [onFace(s, 2, d0, 0, c), onFace(s, 2, d1, 0, c), onFace(s, 2, d1, s.k * 0.42, c), onFace(s, 2, d0, s.k * 0.42, c)], '#070807');
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      for (i = 1; i < 6; i++) { var f = s.k * (0.42 + 0.3 * i / 6); line(ctx, onFace(s, 2, d0, f, c), onFace(s, 2, d1, f, c)); }
      ctx.fillStyle = 'rgba(140,110,50,0.35)';                                                  // faded stencil number
      var m = onFace(s, 2, 0.15, s.k * 0.6, c); ctx.fillRect(m[0], m[1], 18, 10);
    }
    // low gable roof along the long axis, overhanging, with a skylight strip; broken = a collapsed patch
    var ov = 10, my = s.y + s.h / 2, kR = s.k * 1.22;
    var nw = lift(s.x - ov, s.y - ov, s.k, c), ne = lift(s.x + s.w + ov, s.y - ov, s.k, c);
    var se = lift(s.x + s.w + ov, s.y + s.h + ov, s.k, c), sw = lift(s.x - ov, s.y + s.h + ov, s.k, c);
    var rw = lift(s.x - ov, my, kR, c), re = lift(s.x + s.w + ov, my, kR, c);
    function slope(a, b2, north) {
      poly(ctx, [a, b2, re, rw], north ? tone(col, 0.86) : tone(col, 0.6));
      ctx.strokeStyle = 'rgba(0,0,0,0.26)';
      for (var u = 0.02; u < 1; u += 0.018) line(ctx, mix(a, b2, u), mix(rw, re, u));
      ctx.fillStyle = north ? 'rgba(150,170,170,0.16)' : 'rgba(110,130,130,0.12)';             // skylight panels
      for (var p = 0.12; p < 0.9; p += 0.2) poly(ctx, [mix(mix(a, b2, p), mix(rw, re, p), 0.35), mix(mix(a, b2, p + 0.06), mix(rw, re, p + 0.06), 0.35), mix(mix(a, b2, p + 0.06), mix(rw, re, p + 0.06), 0.65), mix(mix(a, b2, p), mix(rw, re, p), 0.65)], ctx.fillStyle);
      ctx.fillStyle = 'rgba(80,46,22,0.3)';
      for (var q = 0; q < 5; q++) { var z = mix(mix(a, b2, hash(s.x, q)), mix(rw, re, hash(q, s.y)), hash(q, q)); ctx.beginPath(); ctx.ellipse(z[0], z[1], 14, 6, 0, 0, TAU); ctx.fill(); }
      if (!north && s.broken) {                                                                 // collapsed patch: dark interior and bent sheets
        var h0 = mix(mix(a, b2, 0.55), mix(rw, re, 0.55), 0.1), h1 = mix(mix(a, b2, 0.78), mix(rw, re, 0.78), 0.12);
        var h2 = mix(mix(a, b2, 0.74), mix(rw, re, 0.74), 0.85), h3 = mix(mix(a, b2, 0.58), mix(rw, re, 0.58), 0.78);
        poly(ctx, [h0, mix(h0, h1, 0.5), h1, h2, mix(h2, h3, 0.4), h3], '#060706');
        ctx.strokeStyle = tone(col, 0.5); ctx.lineWidth = 3;
        line(ctx, h1, mix(h1, h3, 0.35)); line(ctx, h0, mix(h0, h2, 0.25)); ctx.lineWidth = 1;
      }
    }
    poly(ctx, [nw, sw, rw], tone(col, 0.8)); poly(ctx, [ne, se, re], tone(col, 0.55));
    if (c.y > my) { slope(nw, ne, true); slope(sw, se, false); } else { slope(sw, se, false); slope(nw, ne, true); }
    ctx.strokeStyle = 'rgba(214,220,200,0.2)'; ctx.lineWidth = 2; line(ctx, rw, re);
    ctx.lineWidth = 1.5; poly(ctx, [nw, ne, se, sw], null, 'rgba(0,0,0,0.6)');
  }

  function drawOffice(ctx, s, c) {
    var bx = box(ctx, s, 0, s.k, c, '#575a52', '#3b3e39'), t = bx.t, i;
    if (bx.vis[2]) {
      for (i = 0; i < 3; i++) {                                                                  // windows, one smashed
        var u0 = 0.1 + i * 0.22, u1 = u0 + 0.14;
        if (i === 1) { poly(ctx, [onFace(s, 2, 1 - 0.45, 0, c), onFace(s, 2, 1 - 0.55, 0, c), onFace(s, 2, 1 - 0.55, s.k * 0.75, c), onFace(s, 2, 1 - 0.45, s.k * 0.75, c)], '#0d0e0d'); continue; }
        poly(ctx, [onFace(s, 2, 1 - u0, s.k * 0.38, c), onFace(s, 2, 1 - u1, s.k * 0.38, c), onFace(s, 2, 1 - u1, s.k * 0.78, c), onFace(s, 2, 1 - u0, s.k * 0.78, c)], i === 2 ? '#141c1d' : '#1b2526', 'rgba(0,0,0,0.6)');
        if (i === 2) { ctx.strokeStyle = 'rgba(180,200,200,0.25)'; line(ctx, onFace(s, 2, 1 - u0, s.k * 0.7, c), onFace(s, 2, 1 - u1, s.k * 0.45, c)); }
      }
      var w3 = [onFace(s, 2, 0.12, s.k * 0.38, c), onFace(s, 2, 0.28, s.k * 0.38, c), onFace(s, 2, 0.28, s.k * 0.78, c), onFace(s, 2, 0.12, s.k * 0.78, c)];
      poly(ctx, w3, '#1b2526', 'rgba(0,0,0,0.6)');
    }
    ctx.lineWidth = 3; poly(ctx, t, null, '#666a62');                                            // roof parapet
    box(ctx, { x: s.x + s.w * 0.6, y: s.y + 30, w: 40, h: 30 }, s.k, s.k + 0.025, c, '#5e625c');    // dead AC unit
  }

  function drawCylinder(ctx, s, c, col, k0) {
    var r = s.w / 2, cx = s.x + r, cy = s.y + r, N = 36, b = [], t = [], i;
    for (i = 0; i < N; i++) {
      var a = i / N * TAU;
      b.push(lift(cx + Math.cos(a) * r, cy + Math.sin(a) * r, k0 || 0, c));
      t.push(lift(cx + Math.cos(a) * r, cy + Math.sin(a) * r, s.k, c));
    }
    var order = [];
    for (i = 0; i < N; i++) order.push(i);
    order.sort(function (p, q) { return Math.sin(p / N * TAU) - Math.sin(q / N * TAU); });        // north strips first
    for (var o = 0; o < N; o++) {
      i = order[o];
      var j = (i + 1) % N, am = (i + 0.5) / N * TAU;
      poly(ctx, [b[i], b[j], t[j], t[i]], tone(col, faceLight(Math.cos(am), Math.sin(am)) * 0.66));
    }
    poly(ctx, t, tone(col, 1));
    return { t: t, cx: cx, cy: cy, r: r };
  }

  function drawTankC(ctx, s, c) {
    var cy = drawCylinder(ctx, s, c, s.color || '#6a6e66'), t = cy.t, i;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5;
    var rings = [];
    for (i = 0; i <= 18; i++) { var a = i / 18 * Math.PI; rings.push(lift(cy.cx + Math.cos(a) * cy.r, cy.cy + Math.sin(a) * cy.r, s.k * 0.5, c)); }
    ctx.beginPath(); rings.forEach(function (p, n) { ctx[n ? 'lineTo' : 'moveTo'](p[0], p[1]); }); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;                                     // ladder up the south side
    var l0 = lift(cy.cx + cy.r * 0.3, cy.cy + cy.r * 0.95, 0, c), l1 = lift(cy.cx + cy.r * 0.3, cy.cy + cy.r * 0.95, s.k, c);
    line(ctx, l0, l1); line(ctx, [l0[0] + 8, l0[1]], [l1[0] + 8, l1[1]]);
    ctx.lineWidth = 1; for (i = 1; i < 12; i++) line(ctx, mix(l0, l1, i / 12), [mix(l0, l1, i / 12)[0] + 8, mix(l0, l1, i / 12)[1]]);
    ctx.fillStyle = 'rgba(80,44,22,0.35)';
    for (i = 0; i < 4; i++) { var z = mix(t[Math.floor(hash(s.x, i) * 36)], [cy.cx, cy.cy], 0.4); ctx.beginPath(); ctx.ellipse(z[0], z[1], 18, 8, 0, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; poly(ctx, t, null);
    ctx.strokeStyle = 'rgba(220,220,200,0.15)'; ctx.lineWidth = 2; ctx.beginPath();
    for (i = 18; i <= 30; i++) ctx[i === 18 ? 'moveTo' : 'lineTo'](t[i % 36][0], t[i % 36][1]);
    ctx.stroke();
  }

  function drawBollard(ctx, s, c) {
    var cy = drawCylinder(ctx, s, c, '#2a2d2b');
    var cap = drawCylinder(ctx, { x: s.x - 3, y: s.y - 3, w: s.w + 6, h: s.h + 6, k: s.k + 0.006 }, c, '#363a37', s.k);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; poly(ctx, cap.t, null);
    return cy;
  }

  function drawLamp(ctx, s, c) {
    var b0 = lift(s.x + 5, s.y + 5, 0, c), t0 = lift(s.x + 5, s.y + 5, s.k, c), arm = lift(s.x + 5, s.y + 34, s.k, c);
    ctx.strokeStyle = '#151716'; ctx.lineWidth = 5; line(ctx, b0, t0);
    ctx.strokeStyle = '#4d524e'; ctx.lineWidth = 3; line(ctx, b0, t0); line(ctx, t0, arm);
    ctx.fillStyle = '#2b2e2c'; ctx.beginPath(); ctx.ellipse(arm[0], arm[1] + 2, 9, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(160,170,160,0.25)'; ctx.beginPath(); ctx.ellipse(arm[0], arm[1] + 3, 5, 2, 0, 0, TAU); ctx.fill();
  }

  function drawFence(ctx, s, c) {
    var horiz = s.w >= s.h, len = horiz ? s.w : s.h, o, posts = [];
    var a0 = horiz ? [s.x, s.y + s.h / 2] : [s.x + s.w / 2, s.y], a1 = horiz ? [s.x + s.w, s.y + s.h / 2] : [s.x + s.w / 2, s.y + s.h];
    var top0 = lift(a0[0], a0[1], s.k, c), top1 = lift(a1[0], a1[1], s.k, c);
    var bot0 = lift(a0[0], a0[1], 0, c), bot1 = lift(a1[0], a1[1], 0, c);
    poly(ctx, [bot0, bot1, top1, top0], 'rgba(120,128,124,0.08)');                              // chain-link mesh
    ctx.strokeStyle = 'rgba(150,158,150,0.14)'; ctx.lineWidth = 1;
    for (o = 0; o < len; o += 9) { line(ctx, mix(bot0, bot1, o / len), mix(top0, top1, Math.min(1, (o + 14) / len))); line(ctx, mix(bot0, bot1, Math.min(1, (o + 14) / len)), mix(top0, top1, o / len)); }
    for (o = 0; o <= len; o += 90) posts.push(o);
    ctx.strokeStyle = '#1a1c1a'; ctx.lineWidth = 4;
    posts.forEach(function (p) { line(ctx, mix(bot0, bot1, p / len), mix(top0, top1, p / len)); });
    ctx.strokeStyle = '#5c625c'; ctx.lineWidth = 2;
    posts.forEach(function (p) { line(ctx, mix(bot0, bot1, p / len), mix(top0, top1, p / len)); });
    line(ctx, top0, top1);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;                                     // a sagging, torn stretch
    var u = 0.3 + hash(s.x, 2) * 0.4; line(ctx, mix(top0, top1, u), mix(bot0, bot1, u + 0.04));
  }

  function drawGatepost(ctx, s, c, area) {
    box(ctx, s, 0, s.k, c, '#5a5f5a');
    if (s.x < area.width / 2) {                                                                  // the gate leaf hangs open to the south-west
      var h0 = lift(s.x + 4, s.y + s.h, 0, c), h1 = lift(s.x + 4, s.y + s.h, s.k * 0.7, c);
      var e0 = lift(s.x - 130, s.y + 150, 0, c), e1 = lift(s.x - 130, s.y + 150, s.k * 0.7, c);
      poly(ctx, [h0, e0, e1, h1], 'rgba(120,128,124,0.1)');
      ctx.strokeStyle = '#4c524c'; ctx.lineWidth = 2.5; line(ctx, h1, e1); line(ctx, h0, e0); line(ctx, e0, e1); line(ctx, h0, e1);
    }
  }

  function hullPts(s, bowEast) {
    var x = s.x, y = s.y, w = s.w, h = s.h;
    if (bowEast) return [[x, y + 10], [x + w - 220, y], [x + w - 70, y + h * 0.18], [x + w, y + h / 2], [x + w - 70, y + h * 0.82], [x + w - 220, y + h], [x, y + h - 10], [x - 14, y + h / 2]];
    return [[x + w / 2, y], [x + w, y + h * 0.28], [x + w, y + h - 8], [x + w * 0.8, y + h], [x + w * 0.2, y + h], [x, y + h - 8], [x, y + h * 0.28]];
  }

  function drawShip(ctx, s, c, time) {
    var pts = hullPts(s, true), kD = s.k, i;
    prism(ctx, pts, -0.004, kD, c, function (n, f) { return tone('#3a2724', f * 0.7); }, '#2e302c');
    var wl = pts.map(function (p) { return lift(p[0], p[1], 0.006, c); });                         // rusty red waterline band
    ctx.strokeStyle = 'rgba(110,44,30,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); wl.forEach(function (p, n) { ctx[n ? 'lineTo' : 'moveTo'](p[0], p[1]); }); ctx.closePath(); ctx.stroke();
    var deck = pts.map(function (p) { return lift(p[0], p[1], kD, c); });
    ctx.strokeStyle = 'rgba(200,200,180,0.18)'; ctx.lineWidth = 2; ctx.beginPath(); deck.forEach(function (p, n) { ctx[n ? 'lineTo' : 'moveTo'](p[0], p[1]); }); ctx.closePath(); ctx.stroke();
    for (i = 0; i < 4; i++) {                                                                      // hatch covers, two still loaded with containers
      var hx = s.x + 280 + i * 210, hr = { x: hx, y: s.y + 46, w: 180, h: s.h - 92 };
      box(ctx, hr, kD, kD + 0.012, c, '#3a3d37');
      if (i === 1 || i === 3) {
        for (var j = 0; j < 2; j++) {
          var cr = { x: hx + 8, y: s.y + 52 + j * 86, w: 164, h: 76, k: kD + 0.012 + 0.068, level: 1, color: ['#2f5a5c', '#7a3f30', '#8a6a2c'][(i + j) % 3] };
          box(ctx, cr, kD + 0.012, cr.k, c, cr.color);
        }
      }
    }
    // the bridge at the stern: superstructure with window bands, then the funnel
    var br = { x: s.x + 30, y: s.y + 50, w: 170, h: s.h - 100 };
    var bb = box(ctx, br, kD, 0.2, c, '#77746a', '#55534c');
    if (bb.vis[2]) for (i = 1; i < 4; i++) { var f = kD + (0.2 - kD) * (i / 4 + 0.08); ctx.strokeStyle = '#151a1b'; ctx.lineWidth = 3; line(ctx, onFace(br, 2, 0.05, f, c), onFace(br, 2, 0.95, f, c)); }
    if (bb.vis[1]) for (i = 1; i < 4; i++) { var f2 = kD + (0.2 - kD) * (i / 4 + 0.08); ctx.strokeStyle = '#151a1b'; ctx.lineWidth = 3; line(ctx, onFace(br, 1, 0.1, f2, c), onFace(br, 1, 0.9, f2, c)); }
    box(ctx, { x: s.x + 70, y: s.y + 105, w: 60, h: 60 }, 0.2, 0.26, c, '#3a2c26', '#1c1714');
    var sm = lift(s.x + 100, s.y + 135, 0.26, c);                                                 // no smoke: the engines are long dead
    ctx.fillStyle = '#0b0a09'; ctx.beginPath(); ctx.ellipse(sm[0], sm[1], 16, 9, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a2b28'; ctx.lineWidth = 2;                                               // mooring lines to the quay bollards
    for (i = 0; i < 3; i++) {
      var mx = s.x + 120 + i * 520, a = lift(mx, s.y + s.h - 4, kD, c), b = lift(mx + 40, s.y + s.h + 66, 0.02, c);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 14, b[0], b[1]); ctx.stroke();
    }
    var bob = Math.sin(time * 0.6) * 2;                                                            // foam at the waterline, breathing slowly
    ctx.strokeStyle = 'rgba(170,200,196,' + (0.07 + 0.03 * Math.sin(time * 0.6)).toFixed(3) + ')'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(s.x - 10, s.y + s.h + 4 + bob * 0.5); ctx.lineTo(s.x + s.w - 220, s.y + s.h + 4 + bob * 0.5); ctx.stroke();
  }

  function drawBoat(ctx, s, c) {
    var pts = hullPts(s, false), k1 = s.sunk ? 0.008 : s.k;
    prism(ctx, pts, -0.004, k1, c, function (n, f) { return tone(s.sunk ? '#3f4542' : '#5d5f58', f * 0.66); }, s.sunk ? '#1e2a2a' : '#4a3e30');
    if (s.sunk) {
      var m0 = lift(s.x + s.w / 2, s.y + s.h * 0.45, 0, c), m1 = lift(s.x + s.w / 2 + 24, s.y + s.h * 0.45, 0.14, c);
      ctx.strokeStyle = '#2b2620'; ctx.lineWidth = 3; line(ctx, m0, m1);
      ctx.fillStyle = 'rgba(16,30,34,0.55)'; poly(ctx, pts.map(function (p) { return lift(p[0], p[1], 0.002, c); }).slice(3), 'rgba(16,30,34,0.55)');
      return;
    }
    if (s.cabin) box(ctx, { x: s.x + 14, y: s.y + s.h * 0.52, w: s.w - 28, h: 64 }, s.k, s.k + 0.05, c, '#7c7a70', '#55534c');
    var m = lift(s.x + s.w / 2, s.y + s.h * 0.35, s.k, c), mt = lift(s.x + s.w / 2, s.y + s.h * 0.35, 0.2, c);
    ctx.strokeStyle = '#1c1a16'; ctx.lineWidth = 3; line(ctx, m, mt);
    ctx.strokeStyle = 'rgba(60,56,46,0.8)'; ctx.lineWidth = 1; line(ctx, mt, lift(s.x + 6, s.y + s.h - 10, s.k, c)); line(ctx, mt, lift(s.x + s.w / 2, s.y + 6, s.k, c));
  }

  function drawCrane(ctx, s, c, time) {
    var k = s.k, kT = k * 0.9, i;
    s.legs.forEach(function (l) { box(ctx, { x: l.x + 6, y: l.y + 6, w: l.w - 12, h: l.h - 12 }, 0, kT, c, CRANE); });
    ctx.strokeStyle = tone(CRANE, 0.6); ctx.lineWidth = 3;                                          // cross bracing between the legs
    for (i = 0; i < 2; i++) {
      var a = s.legs[i * 2], b = s.legs[i * 2 + 1];
      var xa = a.x + a.w / 2, ya = a.y + a.h / 2, xb = b.x + b.w / 2, yb = b.y + b.h / 2;
      line(ctx, lift(xa, ya, kT * 0.35, c), lift(xb, yb, kT * 0.35, c));
      line(ctx, lift(xa, ya, kT * 0.35, c), lift((xa + xb) / 2, (ya + yb) / 2, kT * 0.7, c)); line(ctx, lift(xb, yb, kT * 0.35, c), lift((xa + xb) / 2, (ya + yb) / 2, kT * 0.7, c));
    }
    // girder frame on top, the boom reaching north over the water, the machinery house
    box(ctx, { x: s.x, y: s.y, w: 30, h: s.h }, kT, k, c, CRANE);
    box(ctx, { x: s.x + s.w - 30, y: s.y, w: 30, h: s.h }, kT, k, c, CRANE);
    var boom = { x: s.x + s.w / 2 - 20, y: s.y - s.boom, w: 40, h: s.boom + s.h + 30 };
    var bb = box(ctx, boom, k, k * 1.05, c, CRANE);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;                                          // lattice on the boom top
    for (i = 0; i < 24; i++) line(ctx, mix(bb.t[0], bb.t[3], i / 24), mix(bb.t[1], bb.t[2], (i + 1) / 24));
    var tx = boom.x + 20, ty = s.y - s.boom * 0.62, tr = lift(tx, ty, k, c), hook = lift(tx, ty, 0.11, c);   // trolley, cables, spreader over the ship
    ctx.strokeStyle = '#141412'; ctx.lineWidth = 1.5; line(ctx, [tr[0] - 5, tr[1]], [hook[0] - 5, hook[1]]); line(ctx, [tr[0] + 5, tr[1]], [hook[0] + 5, hook[1]]);
    box(ctx, { x: tx - 60, y: ty - 16, w: 120, h: 32 }, 0.1, 0.115, c, '#6e5a34');
    box(ctx, { x: tx - 22, y: ty - 18, w: 44, h: 36 }, k * 1.05, k * 1.1, c, '#555a55');
    box(ctx, { x: s.x + s.w / 2 - 50, y: s.y + s.h - 50, w: 100, h: 70 }, k * 1.05, k * 1.2, c, '#6c6f69', '#4d504b');
    ctx.strokeStyle = 'rgba(230,210,160,0.2)'; ctx.lineWidth = 1.5; line(ctx, bb.t[0], bb.t[3]);
  }


  // ---- town pieces (the police station first) --------------------------------------------------------

  // window band on a face: floors rows of n windows; bars = iron bars; broken = some panes smashed
  function windows(ctx, s, side, c, floors, o) {
    var len = side % 2 ? s.h : s.w, n = Math.max(2, Math.round(len / 90)), f, i;
    for (f = 0; f < floors; f++) {
      var k0 = s.k * (f + 0.32) / floors, k1 = s.k * (f + 0.78) / floors;
      for (i = 0; i < n; i++) {
        var u0 = (i + 0.25) / n, u1 = (i + 0.75) / n;
        if (o.skip && o.skip(f, (u0 + u1) / 2, side)) continue;
        var broken = hash(s.x + i * 7, s.y + f * 13 + side) < 0.22;
        poly(ctx, [onFace(s, side, u0, k0, c), onFace(s, side, u1, k0, c), onFace(s, side, u1, k1, c), onFace(s, side, u0, k1, c)], broken ? '#070807' : '#172022', 'rgba(0,0,0,0.6)');
        if (!broken) { ctx.strokeStyle = 'rgba(170,190,190,0.12)'; ctx.lineWidth = 1; line(ctx, onFace(s, side, u0 + 0.01, k1 - s.k * 0.06 / floors, c), onFace(s, side, u0 + (u1 - u0) * 0.5, k1 - s.k * 0.02 / floors, c)); }
        if (o.bars) {
          ctx.strokeStyle = 'rgba(20,22,21,0.9)'; ctx.lineWidth = 1.5;
          for (var b = 1; b < 4; b++) { var u = u0 + (u1 - u0) * b / 4; line(ctx, onFace(s, side, u, k0, c), onFace(s, side, u, k1, c)); }
        }
      }
    }
  }

  function roofKit(ctx, s, c, t) {                                                                  // flat roof: parapet, gravel, AC boxes
    ctx.lineWidth = 3; poly(ctx, t, null, tone(s.color, 1.0));
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (var i = 0; i < 30; i++) { var z = mix(mix(t[0], t[1], hash(s.x, i)), mix(t[3], t[2], hash(s.x, i)), hash(i, s.y)); ctx.fillRect(z[0], z[1], 3, 2); }
    var n = Math.max(1, Math.round(s.w / 400));
    for (i = 0; i < n; i++) box(ctx, { x: s.x + s.w * (0.2 + 0.6 * hash(i, s.x)), y: s.y + 40 + hash(s.y, i) * (s.h - 120), w: 46, h: 34 }, s.k, s.k + 0.024, c, '#5e625c');
  }

  function drawBlock(ctx, s, c) {
    var bx = box(ctx, s, 0, s.k, c, s.color, tone(s.color, 0.7)), i;
    var door = s.entrance, dw = 0.07;
    if (bx.vis[2]) {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;                                      // floor line
      for (i = 1; i < s.floors; i++) line(ctx, onFace(s, 2, 0, s.k * i / s.floors, c), onFace(s, 2, 1, s.k * i / s.floors, c));
      if (s.garage) {                                                                                 // roller doors, one forced half open
        for (i = 0; i < s.garage; i++) {
          var g0 = 0.1 + i * 0.45, g1 = g0 + 0.35;
          poly(ctx, [onFace(s, 2, g0, 0, c), onFace(s, 2, g1, 0, c), onFace(s, 2, g1, s.k * 0.7, c), onFace(s, 2, g0, s.k * 0.7, c)], '#3a3d38');
          if (i === 1) poly(ctx, [onFace(s, 2, g0, 0, c), onFace(s, 2, g1, 0, c), onFace(s, 2, g1, s.k * 0.3, c), onFace(s, 2, g0, s.k * 0.3, c)], '#070807');
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
          for (var r2 = 1; r2 < 7; r2++) line(ctx, onFace(s, 2, g0, s.k * 0.7 * r2 / 7, c), onFace(s, 2, g1, s.k * 0.7 * r2 / 7, c));
        }
      } else {
        windows(ctx, s, 2, c, s.floors, { bars: s.bars, skip: door ? function (f, u) { return f === 0 && Math.abs(u - (1 - door)) < dw + 0.04; } : null });
      }
      if (door) {                                                                                     // glass doors, steps and an awning
        var d0 = 1 - door - dw, d1 = 1 - door + dw, kd = s.k * 0.38 / s.floors * 2;
        poly(ctx, [onFace(s, 2, d0, 0, c), onFace(s, 2, d1, 0, c), onFace(s, 2, d1, kd, c), onFace(s, 2, d0, kd, c)], '#0b0e0e', 'rgba(0,0,0,0.6)');
        ctx.strokeStyle = 'rgba(150,170,170,0.25)'; ctx.lineWidth = 1.5; line(ctx, onFace(s, 2, (d0 + d1) / 2, 0, c), onFace(s, 2, (d0 + d1) / 2, kd, c));
        var ax = s.x + s.w * (door - dw - 0.02), aw = s.w * (dw * 2 + 0.04);
        box(ctx, { x: ax, y: s.y + s.h, w: aw, h: 34 }, kd * 1.05, kd * 1.2, c, '#3e4a56', '#34404c');
        if (s.sign) {                                                                                 // the station's name above the awning
          var sp = onFace(s, 2, 1 - door, s.k * 0.66, c);
          ctx.fillStyle = 'rgba(16,20,24,0.85)'; ctx.fillRect(sp[0] - 52, sp[1] - 13, 104, 24);
          ctx.font = '700 16px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
          ctx.fillStyle = 'rgba(196,204,206,0.7)'; ctx.fillText(s.sign, sp[0], sp[1]);
          ctx.fillStyle = 'rgba(70,90,130,0.5)'; ctx.fillRect(sp[0] - 52, sp[1] + 11, 104, 2);
        }
        ctx.fillStyle = 'rgba(120,124,118,0.5)';                                                      // steps
        for (i = 0; i < 2; i++) { var st0 = lift(ax + 10 - i * 6, s.y + s.h + 4 + i * 8, 0, c), st1 = lift(ax + aw - 10 + i * 6, s.y + s.h + 4 + i * 8, 0, c); ctx.fillRect(st0[0], st0[1], st1[0] - st0[0], 4); }
      }
    }
    if (bx.vis[1]) windows(ctx, s, 1, c, s.floors, { bars: s.bars });
    if (bx.vis[3]) windows(ctx, s, 3, c, s.floors, { bars: s.bars });
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
    for (i = 0; i < 4; i++) line(ctx, bx.b[i], bx.t[i]);
    roofKit(ctx, s, c, bx.t);
    if (s.antenna) {                                                                                  // radio mast with guy wires
      var m0 = lift(s.x + s.w * 0.82, s.y + s.h * 0.3, s.k, c), m1 = lift(s.x + s.w * 0.82, s.y + s.h * 0.3, s.k + 0.18, c);
      ctx.strokeStyle = '#1a1c1b'; ctx.lineWidth = 3; line(ctx, m0, m1);
      ctx.strokeStyle = '#626862'; ctx.lineWidth = 1.5; line(ctx, m0, m1);
      ctx.strokeStyle = 'rgba(90,96,92,0.5)'; ctx.lineWidth = 1;
      line(ctx, m1, lift(s.x + s.w * 0.74, s.y + s.h * 0.2, s.k, c)); line(ctx, m1, lift(s.x + s.w * 0.9, s.y + s.h * 0.45, s.k, c));
      for (i = 1; i < 4; i++) { var q = mix(m0, m1, i / 4); line(ctx, [q[0] - 6, q[1]], [q[0] + 6, q[1]]); }
    }
  }

  function drawShop(ctx, s, c) {
    var bx = box(ctx, s, 0, s.k, c, s.color, tone(s.color, 0.68)), i;
    if (bx.vis[2]) windows(ctx, s, 2, c, 1, {});
    var aw = [lift(s.x, s.y, s.k * 0.62, c), lift(s.x + s.w, s.y, s.k * 0.62, c), lift(s.x + s.w, s.y - 46, s.k * 0.5, c), lift(s.x, s.y - 46, s.k * 0.5, c)];
    var hue = [8, 150, 36, 200][Math.floor(hash(s.x, 3) * 4)];                                       // striped, torn awning over the street side
    poly(ctx, aw, K.hsl(hue, 16, 22));
    ctx.fillStyle = K.hsl(hue, 14, 30);
    for (i = 0; i < 12; i += 2) poly(ctx, [mix(aw[0], aw[1], i / 12), mix(aw[0], aw[1], (i + 1) / 12), mix(aw[3], aw[2], (i + 1) / 12), mix(aw[3], aw[2], i / 12)], ctx.fillStyle);
    var tear = 0.3 + hash(s.y, s.x) * 0.4;
    poly(ctx, [mix(aw[3], aw[2], tear), mix(aw[3], aw[2], tear + 0.12), mix(mix(aw[0], aw[1], tear + 0.08), mix(aw[3], aw[2], tear + 0.08), 0.4)], '#0b0c0b');
    roofKit(ctx, s, c, bx.t);
  }

  function drawWall(ctx, s, c) {
    var bx = box(ctx, s, 0, s.k, c, '#5c5e58', '#6a6c66');
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    var horiz = s.w > s.h, len = horiz ? s.w : s.h, side = horiz ? 2 : (bx.vis[1] ? 1 : 3);
    if (bx.vis[side]) for (var u = 60; u < len; u += 60) line(ctx, onFace(s, side, u / len, 0, c), onFace(s, side, u / len, s.k, c));
    ctx.strokeStyle = 'rgba(160,160,150,0.35)'; ctx.lineWidth = 1.2;                               // razor wire along the top
    ctx.beginPath();
    for (var o = 0; o <= len; o += 6) {
      var x = horiz ? s.x + o : s.x + s.w / 2, y = horiz ? s.y + s.h / 2 : s.y + o, p2 = lift(x, y, s.k + 0.012 + Math.sin(o * 0.5) * 0.006, c);
      ctx[o ? 'lineTo' : 'moveTo'](p2[0] + (horiz ? 0 : Math.cos(o * 0.5) * 4), p2[1]);
    }
    ctx.stroke();
  }

  function drawTower(ctx, s, c) {
    var kC = s.k * 0.78, i;
    s.legs.forEach(function (l) { box(ctx, { x: l.x + 3, y: l.y + 3, w: l.w - 6, h: l.h - 6 }, 0, kC, c, '#4a4237'); });
    ctx.strokeStyle = '#2c2720'; ctx.lineWidth = 2;                                                    // braces
    for (i = 0; i < 2; i++) {
      var a = s.legs[i * 2], b = s.legs[i * 2 + 1];
      line(ctx, lift(a.x + 8, a.y + 8, 0.02, c), lift(b.x + 8, b.y + 8, kC * 0.5, c)); line(ctx, lift(b.x + 8, b.y + 8, 0.02, c), lift(a.x + 8, a.y + 8, kC * 0.5, c));
    }
    var ladder0 = lift(s.x + s.w * 0.5, s.y + s.h + 30, 0, c), ladder1 = lift(s.x + s.w * 0.5, s.y + s.h, kC, c);
    ctx.strokeStyle = '#3a342b'; ctx.lineWidth = 2; line(ctx, ladder0, ladder1); line(ctx, [ladder0[0] + 9, ladder0[1]], [ladder1[0] + 9, ladder1[1]]);
    var cab = { x: s.x - 6, y: s.y - 6, w: s.w + 12, h: s.h + 12 }, cb = box(ctx, cab, kC, s.k, c, '#5a5044', null);
    if (cb.vis[2]) poly(ctx, [onFace(cab, 2, 0.1, kC + (s.k - kC) * 0.45, c), onFace(cab, 2, 0.9, kC + (s.k - kC) * 0.45, c), onFace(cab, 2, 0.9, kC + (s.k - kC) * 0.9, c), onFace(cab, 2, 0.1, kC + (s.k - kC) * 0.9, c)], '#0b0d0d');
    var top = lift(s.x + s.w / 2, s.y + s.h / 2, s.k * 1.12, c), e = [lift(cab.x - 8, cab.y - 8, s.k, c), lift(cab.x + cab.w + 8, cab.y - 8, s.k, c), lift(cab.x + cab.w + 8, cab.y + cab.h + 8, s.k, c), lift(cab.x - 8, cab.y + cab.h + 8, s.k, c)];
    for (i = 0; i < 4; i++) poly(ctx, [e[i], e[(i + 1) % 4], top], tone('#3e4038', [1, 0.7, 0.55, 0.85][i]));
    var sl = lift(s.x + s.w * 0.8, s.y + s.h * 0.95, s.k * 0.95, c);                                // dead searchlight
    ctx.fillStyle = '#1b1d1c'; ctx.beginPath(); ctx.arc(sl[0], sl[1], 6, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(170,180,170,0.2)'; ctx.beginPath(); ctx.arc(sl[0] - 1, sl[1] - 1, 3, 0, TAU); ctx.fill();
  }

  function drawFlag(ctx, s, c, time) {
    var b0 = lift(s.x + 5, s.y + 5, 0, c), t0 = lift(s.x + 5, s.y + 5, s.k, c);
    ctx.strokeStyle = '#151716'; ctx.lineWidth = 4; line(ctx, b0, t0);
    ctx.strokeStyle = '#7a7e78'; ctx.lineWidth = 2; line(ctx, b0, t0);
    var k = s.k * 0.97, n = 8, top = [], bot = [];                                                    // tattered, faded flag stirring slowly
    for (var i = 0; i <= n; i++) {
      var u = i / n, wv = Math.sin(time * 1.6 - u * 4) * 5 * u;
      var p = lift(s.x + 5 + u * 70, s.y + 5 + wv, k, c), q = lift(s.x + 5 + u * 70, s.y + 5 + wv, k - 0.045 * (1 - u * 0.25), c);
      top.push(p); bot.push(q);
    }
    poly(ctx, top.concat(bot.reverse()), 'rgba(120,124,118,0.5)');
    ctx.fillStyle = 'rgba(64,84,124,0.5)';
    poly(ctx, [top[0], top[n], mix(top[n], bot[0], 0.12), mix(top[0], bot[n], 0.12)], ctx.fillStyle);
  }

  function drawSandbags(ctx, s, c) {
    var horiz = s.w >= s.h, len = horiz ? s.w : s.h, rows = 2, i, r;
    for (r = 0; r < rows; r++) {
      var kb = s.k * r / rows, kt = s.k * (r + 1) / rows, off = r % 2 ? 14 : 0;
      for (i = off - 14; i < len; i += 28) {
        var a = Math.max(0, i), b = Math.min(len, i + 28);
        if (b - a < 6) continue;
        var rr = horiz ? { x: s.x + a + 1, y: s.y + 2, w: b - a - 2, h: s.h - 4 } : { x: s.x + 2, y: s.y + a + 1, w: s.w - 4, h: b - a - 2 };
        var bx = box(ctx, rr, kb, kt, c, '#6a604a');
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; poly(ctx, bx.t, null);
      }
    }
  }

  function drawBarrier(ctx, s, c) {
    var bx = box(ctx, s, 0, s.k, c, '#55574f', '#5f6159');
    ctx.fillStyle = 'rgba(150,120,60,0.35)';
    if (bx.vis[2]) for (var u = 0.05; u < 0.95; u += 0.3) poly(ctx, [onFace(s, 2, u, s.k * 0.55, c), onFace(s, 2, u + 0.14, s.k * 0.55, c), onFace(s, 2, u + 0.14, s.k * 0.8, c), onFace(s, 2, u, s.k * 0.8, c)], ctx.fillStyle);
  }

  function drawCar(ctx, s, c) {
    if (s.style) return drawVehicle(ctx, s, c);
    var horiz = s.w > s.h, col = s.burnt ? '#2a2622' : s.color, i;
    var wheels = horiz ? [[0.18, 0], [0.82, 0], [0.18, 1], [0.82, 1]] : [[0, 0.2], [1, 0.2], [0, 0.8], [1, 0.8]];
    ctx.fillStyle = '#0a0b0a';
    wheels.forEach(function (w) { var p = lift(s.x + s.w * w[0], s.y + s.h * w[1], 0.008, c); ctx.beginPath(); ctx.ellipse(p[0], p[1], horiz ? 13 : 7, horiz ? 7 : 12, 0, 0, TAU); ctx.fill(); });
    var body = box(ctx, { x: s.x, y: s.y, w: s.w, h: s.h }, 0.008, s.k * 0.55, c, col);
    if (s.police && !s.burnt) {                                                                       // white doors on the patrol cars
      ctx.fillStyle = 'rgba(190,194,186,0.32)';
      if (horiz && body.vis[2]) poly(ctx, [onFace(s, 2, 0.3, 0.012, c), onFace(s, 2, 0.7, 0.012, c), onFace(s, 2, 0.7, s.k * 0.5, c), onFace(s, 2, 0.3, s.k * 0.5, c)], ctx.fillStyle);
      if (!horiz && body.vis[1]) poly(ctx, [onFace(s, 1, 0.3, 0.012, c), onFace(s, 1, 0.7, 0.012, c), onFace(s, 1, 0.7, s.k * 0.5, c), onFace(s, 1, 0.3, s.k * 0.5, c)], ctx.fillStyle);
      if (!horiz && body.vis[3]) poly(ctx, [onFace(s, 3, 0.3, 0.012, c), onFace(s, 3, 0.7, 0.012, c), onFace(s, 3, 0.7, s.k * 0.5, c), onFace(s, 3, 0.3, s.k * 0.5, c)], ctx.fillStyle);
    }
    var cab = s.bus ? { x: s.x + 6, y: s.y + 6, w: s.w - 12, h: s.h - 12 }
      : horiz ? { x: s.x + s.w * 0.28, y: s.y + 6, w: s.w * 0.44, h: s.h - 12 } : { x: s.x + 6, y: s.y + s.h * 0.3, w: s.w - 12, h: s.h * 0.42 };
    var cb = box(ctx, cab, s.k * 0.55, s.k, c, s.burnt ? '#1e1b18' : '#141a1c', s.burnt ? '#24201c' : tone(col, 0.9));
    if (s.bus) {                                                                                       // a row of empty window holes
      ctx.fillStyle = '#060707';
      for (i = 0; i < 9; i++) { if (cb.vis[2]) poly(ctx, [onFace(cab, 2, 0.04 + i * 0.105, s.k * 0.62, c), onFace(cab, 2, 0.12 + i * 0.105, s.k * 0.62, c), onFace(cab, 2, 0.12 + i * 0.105, s.k * 0.92, c), onFace(cab, 2, 0.04 + i * 0.105, s.k * 0.92, c)], '#060707'); }
    }
    if (s.police && !s.burnt) {                                                                        // light bar, dark
      var lb = horiz ? { x: cab.x + cab.w * 0.4, y: cab.y + 4, w: cab.w * 0.2, h: cab.h - 8 } : { x: cab.x + 4, y: cab.y + cab.h * 0.4, w: cab.w - 8, h: cab.h * 0.2 };
      var lbb = box(ctx, lb, s.k, s.k + 0.007, c, '#2a2e34');
      var half = horiz ? [{ x: lb.x, y: lb.y, w: lb.w, h: lb.h / 2 }, { x: lb.x, y: lb.y + lb.h / 2, w: lb.w, h: lb.h / 2 }] : [{ x: lb.x, y: lb.y, w: lb.w / 2, h: lb.h }, { x: lb.x + lb.w / 2, y: lb.y, w: lb.w / 2, h: lb.h }];
      poly(ctx, rectPts(half[0]).map(function (p) { return lift(p[0], p[1], s.k + 0.007, c); }), 'rgba(140,50,46,0.55)');
      poly(ctx, rectPts(half[1]).map(function (p) { return lift(p[0], p[1], s.k + 0.007, c); }), 'rgba(52,72,130,0.6)');
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; poly(ctx, lbb.t, null);
    }
    if (s.burnt) {                                                                                     // soot and a melted roof
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; poly(ctx, cb.t, ctx.fillStyle);
      ctx.fillStyle = 'rgba(90,50,30,0.35)';
      for (i = 0; i < 4; i++) { var z = mix(mix(body.t[0], body.t[1], hash(s.x, i)), mix(body.t[3], body.t[2], hash(s.x, i)), hash(i, s.y)); ctx.beginPath(); ctx.ellipse(z[0], z[1], 9, 5, 0, 0, TAU); ctx.fill(); }
    } else {
      ctx.strokeStyle = 'rgba(200,210,210,0.14)'; ctx.lineWidth = 1; line(ctx, cb.t[0], cb.t[1]);
    }
    if (s.open) {                                                                                      // a door left open
      var hz = horiz ? [s.x + s.w * 0.62, s.y + s.h] : [s.x + s.w, s.y + s.h * 0.62];
      var tip = horiz ? [hz[0] - 34, hz[1] + 30] : [hz[0] + 30, hz[1] - 34];
      poly(ctx, [lift(hz[0], hz[1], 0.012, c), lift(tip[0], tip[1], 0.012, c), lift(tip[0], tip[1], s.k * 0.55, c), lift(hz[0], hz[1], s.k * 0.55, c)], tone(col, 0.6), 'rgba(0,0,0,0.6)');
    }
  }

  function drawMedkit(g, rand) {
    shadowBlob(g, 4, 6, 24, 20, 0.55);
    g.fillStyle = '#1d2219'; g.fillRect(-15, -9, 30, 22);
    g.fillStyle = K.hsl(96, 14, 30 + rand() * 4); g.fillRect(-15, -12, 30, 21);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-15, -3, 30, 2);
    g.fillStyle = 'rgba(214,214,200,0.75)'; g.fillRect(-2.5, -9, 5, 14); g.fillRect(-7, -4.5, 14, 5);
    g.strokeStyle = '#2a2f26'; g.lineWidth = 2; g.beginPath(); g.moveTo(-6, -12); g.lineTo(-6, -15); g.lineTo(6, -15); g.lineTo(6, -12); g.stroke();
  }

  function drawRadio(g, rand) {
    shadowBlob(g, 4, 6, 24, 20, 0.55);
    g.fillStyle = '#0d0f0e'; g.fillRect(-14, -6, 22, 16);
    g.fillStyle = '#2a2e2c'; g.fillRect(-14, -9, 22, 15);
    g.fillStyle = '#141716'; g.fillRect(-11, -6, 10, 8);
    g.fillStyle = 'rgba(120,150,120,0.35)'; g.fillRect(2, -6, 4, 3);
    for (var i = 0; i < 3; i++) { g.fillStyle = '#555b58'; g.beginPath(); g.arc(-8 + i * 4, 4, 1.4, 0, TAU); g.fill(); }
    g.strokeStyle = '#1a1c1b'; g.lineWidth = 2; g.beginPath(); g.moveTo(5, -9); g.lineTo(11, -20); g.stroke();
    g.fillStyle = '#1e2120'; g.save(); g.translate(13, 6); g.rotate(0.6); g.fillRect(-3, -8, 7, 16); g.restore();   // handset
    g.strokeStyle = '#1a1c1b'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(8, 2); g.quadraticCurveTo(14, -2, 13, 2); g.stroke();
  }


  // ---- inside buildings ---------------------------------------------------------------------------------

  function drawIWall(ctx, s, c) {
    var bx = box(ctx, s, 0, s.k, c, '#5b5a52', '#2a2a26');
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;                                       // skirting board line
    for (var side = 1; side <= 3; side += 1) if (bx.vis[side] && side !== 0) line(ctx, onFace(s, side, 0, s.k * 0.12, c), onFace(s, side, 1, s.k * 0.12, c));
    ctx.strokeStyle = 'rgba(200,196,180,0.12)'; poly(ctx, bx.t, null);
  }

  var FURN = {
    desk: '#4d4234', counter: '#3f3b35', cabinet: '#5a5f5c', locker: '#4f5a5e', bench: '#4a4034', chair: '#3a3632',
    table: '#4f4536', fridge: '#8a8a80', shelf: '#4a3f30', bunk: '#4f5452', rack: '#3c3f3c', board: '#8e918a',
    sofa: '#4c3a34', safe: '#2e3230', podium: '#4a3e30', rail: '#5d625e'
  };
  function drawFurn(ctx, s, c) {
    if (EXT.furn[s.style]) return EXT.furn[s.style](ctx, s, c, HELP);            // furniture styles added by js/art/*.js
    var col = FURN[s.style] || '#4a4a44', st = s.style, i, n;
    if (st === 'bunk') {                                                                              // bed frame, mattress, a second bunk above on tall ones
      var bb = box(ctx, s, 0, Math.min(s.k, 0.03), c, '#3e4240', '#5f5a4c');
      poly(ctx, [mix(bb.t[0], bb.t[3], 0), mix(bb.t[1], bb.t[2], 0), mix(bb.t[1], bb.t[2], 0.25), mix(bb.t[0], bb.t[3], 0.25)], '#7a7464');   // pillow
      if (s.k > 0.05) {
        [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(function (q) { var p0 = lift(s.x + q[0] * s.w, s.y + q[1] * s.h, 0, c), p1 = lift(s.x + q[0] * s.w, s.y + q[1] * s.h, s.k, c); ctx.strokeStyle = '#2a2d2b'; ctx.lineWidth = 2.5; line(ctx, p0, p1); });
        var tb = box(ctx, { x: s.x + 2, y: s.y + 2, w: s.w - 4, h: s.h - 4 }, s.k - 0.015, s.k, c, '#3e4240', '#56524a');
        poly(ctx, [tb.t[0], tb.t[1], mix(tb.t[1], tb.t[2], 0.25), mix(tb.t[0], tb.t[3], 0.25)], '#6c675a');
      }
      return;
    }
    if (st === 'chair') {
      box(ctx, s, 0, s.k, c, col);
      box(ctx, { x: s.x, y: s.y, w: s.w, h: 8 }, s.k, s.k * 1.9, c, col);                             // back rest
      return;
    }
    if (st === 'sofa') {
      var horiz = s.w > s.h;
      box(ctx, s, 0, s.k, c, col, tone(col, 0.95));
      box(ctx, horiz ? { x: s.x, y: s.y, w: s.w, h: 16 } : { x: s.x, y: s.y, w: 16, h: s.h }, s.k, s.k * 1.8, c, col);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; var t0 = lift(s.x + s.w * 0.5, s.y + s.h * 0.6, s.k, c); ctx.beginPath(); ctx.ellipse(t0[0], t0[1], 10, 5, 0.4, 0, TAU); ctx.fill();   // a tear in the seat
      return;
    }
    if (st === 'rail') {                                                                              // stair banister
      var r0 = lift(s.x + s.w / 2, s.y, s.k, c), r1 = lift(s.x + s.w / 2, s.y + s.h, s.k * 0.3, c);
      ctx.strokeStyle = '#151716'; ctx.lineWidth = 5; line(ctx, r0, r1);
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; line(ctx, r0, r1);
      for (i = 0; i <= 8; i++) { var u = i / 8, b0 = lift(s.x + s.w / 2, s.y + s.h * u, 0, c), b1 = lift(s.x + s.w / 2, s.y + s.h * u, s.k - (s.k * 0.7) * u, c); ctx.lineWidth = 1.5; line(ctx, b0, b1); }
      return;
    }
    if (st === 'hbed') {                                                                              // hospital bed: frame, white sheet, pillow, side rails
      var hb = box(ctx, s, 0, s.k, c, '#5e6462', '#9a9c94');
      var vertB = s.h >= s.w;
      poly(ctx, vertB ? [hb.t[0], hb.t[1], mix(hb.t[1], hb.t[2], 0.2), mix(hb.t[0], hb.t[3], 0.2)] : [hb.t[0], mix(hb.t[0], hb.t[1], 0.2), mix(hb.t[3], hb.t[2], 0.2), hb.t[3]], '#b4b4aa');
      ctx.fillStyle = 'rgba(80,90,80,0.35)'; var blk = mix(mix(hb.t[0], hb.t[1], 0.5), mix(hb.t[3], hb.t[2], 0.5), 0.62); ctx.beginPath(); ctx.ellipse(blk[0], blk[1], s.w * 0.35, s.h * 0.2, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#7a807c'; ctx.lineWidth = 2;
      if (vertB) { line(ctx, lift(s.x - 2, s.y + s.h * 0.3, s.k * 1.5, c), lift(s.x - 2, s.y + s.h * 0.8, s.k * 1.5, c)); line(ctx, lift(s.x + s.w + 2, s.y + s.h * 0.3, s.k * 1.5, c), lift(s.x + s.w + 2, s.y + s.h * 0.8, s.k * 1.5, c)); }
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; poly(ctx, hb.t, null);
      return;
    }
    if (st === 'ivpole') {
      var i0 = lift(s.x + 6, s.y + 6, 0, c), i1 = lift(s.x + 6, s.y + 6, s.k, c);
      ctx.strokeStyle = '#161817'; ctx.lineWidth = 3; line(ctx, i0, i1); ctx.strokeStyle = '#8a908c'; ctx.lineWidth = 1.5; line(ctx, i0, i1);
      ctx.fillStyle = 'rgba(170,190,180,0.55)'; ctx.fillRect(i1[0] - 3, i1[1] + 2, 6, 9);
      ctx.fillStyle = '#2a2c2b'; ctx.beginPath(); ctx.ellipse(i0[0], i0[1], 8, 4, 0, 0, TAU); ctx.fill();
      return;
    }
    if (st === 'curtain') {                                                                           // a hanging privacy curtain, half drawn, see-through
      var cu0 = lift(s.x + s.w / 2, s.y, 0.004, c), cu1 = lift(s.x + s.w / 2, s.y + s.h * 0.7, 0.004, c), cuT0 = lift(s.x + s.w / 2, s.y, s.k, c), cuT1 = lift(s.x + s.w / 2, s.y + s.h * 0.7, s.k, c);
      poly(ctx, [cu0, cu1, cuT1, cuT0], 'rgba(120,150,150,0.35)');
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
      for (i = 1; i < 8; i++) line(ctx, mix(cu0, cu1, i / 8), mix(cuT0, cuT1, i / 8));
      ctx.strokeStyle = '#6a706c'; ctx.lineWidth = 2; line(ctx, cuT0, lift(s.x + s.w / 2, s.y + s.h, s.k, c));
      return;
    }
    if (st === 'mri') {                                                                               // the scanner: a big housing with the bore facing south, the table sliding in
      var hr = { x: s.x, y: s.y, w: s.w, h: s.h * 0.55 };
      var mb = box(ctx, hr, 0, s.k, c, '#8e9088', '#9c9e96');
      var b0 = onFace(hr, 2, 0.5, s.k * 0.5, c), bl = onFace(hr, 2, 0.22, s.k * 0.5, c), bt = onFace(hr, 2, 0.5, s.k * 0.9, c);
      var rx = Math.abs(b0[0] - bl[0]), ry = Math.max(6, Math.abs(b0[1] - bt[1]));
      ctx.fillStyle = '#0a0c0c'; ctx.beginPath(); ctx.ellipse(b0[0], b0[1], rx, ry, 0, 0, TAU); ctx.fill();          // the bore
      ctx.strokeStyle = '#5e605a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(b0[0], b0[1], rx + 3, ry + 2, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(90,110,130,0.5)'; var lg = mix(mb.t[3], mb.t[2], 0.5); ctx.fillRect(lg[0] - 30, lg[1] - 6, 60, 4);
      box(ctx, { x: s.x + s.w * 0.4, y: s.y + s.h * 0.5, w: s.w * 0.2, h: s.h * 0.5 }, 0, s.k * 0.42, c, '#6e706a', '#a8aaa2');   // the table sliding in
      return;
    }
    if (st === 'xray') {
      box(ctx, { x: s.x, y: s.y + s.h * 0.3, w: s.w, h: s.h * 0.4 }, 0, s.k * 0.35, c, '#8a8c86', '#9c9e96');
      var xp0 = lift(s.x + 20, s.y + s.h * 0.5, 0, c), xp1 = lift(s.x + 20, s.y + s.h * 0.5, s.k, c), xa = lift(s.x + s.w * 0.5, s.y + s.h * 0.5, s.k, c);
      ctx.strokeStyle = '#2a2c2b'; ctx.lineWidth = 6; line(ctx, xp0, xp1); line(ctx, xp1, xa);
      ctx.strokeStyle = '#9a9c94'; ctx.lineWidth = 3.5; line(ctx, xp0, xp1); line(ctx, xp1, xa);
      box(ctx, { x: s.x + s.w * 0.44, y: s.y + s.h * 0.38, w: 40, h: 34 }, s.k * 0.75, s.k, c, '#7a7c76');
      return;
    }
    if (st === 'optable') {                                                                           // operating table with the big lamp above it
      box(ctx, { x: s.x + s.w * 0.4, y: s.y + s.h * 0.3, w: s.w * 0.2, h: s.h * 0.4 }, 0, s.k * 0.7, c, '#5e6462');
      var ot = box(ctx, s, s.k * 0.7, s.k, c, '#6e7470', '#7e9a96');
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; poly(ctx, ot.t, null);
      var lp = lift(s.x + s.w / 2, s.y + s.h / 2, s.k * 3.4, c), la = lift(s.x + s.w / 2, s.y - 60, s.k * 3.6, c);
      ctx.strokeStyle = '#3a3e3c'; ctx.lineWidth = 3; line(ctx, la, lp);
      ctx.fillStyle = '#4e5452'; ctx.beginPath(); ctx.ellipse(lp[0], lp[1], 34, 22, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(200,210,200,0.22)'; ctx.beginPath(); ctx.ellipse(lp[0], lp[1], 26, 16, 0, 0, TAU); ctx.fill();
      return;
    }
    if (st === 'monitor') {                                                                           // patient monitor on a stand, screen dark
      var mo0 = lift(s.x + s.w / 2, s.y + s.h / 2, 0, c), mo1 = lift(s.x + s.w / 2, s.y + s.h / 2, s.k * 0.7, c);
      ctx.strokeStyle = '#1a1c1b'; ctx.lineWidth = 3; line(ctx, mo0, mo1);
      var mbx = box(ctx, { x: s.x, y: s.y + s.h * 0.3, w: s.w, h: s.h * 0.4 }, s.k * 0.7, s.k, c, '#3a3e3c');
      if (mbx.vis[2]) poly(ctx, [onFace({ x: s.x, y: s.y + s.h * 0.3, w: s.w, h: s.h * 0.4 }, 2, 0.1, s.k * 0.74, c), onFace({ x: s.x, y: s.y + s.h * 0.3, w: s.w, h: s.h * 0.4 }, 2, 0.9, s.k * 0.74, c), onFace({ x: s.x, y: s.y + s.h * 0.3, w: s.w, h: s.h * 0.4 }, 2, 0.9, s.k * 0.96, c), onFace({ x: s.x, y: s.y + s.h * 0.3, w: s.w, h: s.h * 0.4 }, 2, 0.1, s.k * 0.96, c)], '#101818');
      return;
    }
    if (st === 'wheelchair') {
      ctx.fillStyle = '#121413';
      [[0, 0.65], [1, 0.65]].forEach(function (w) { var p = lift(s.x + s.w * w[0], s.y + s.h * w[1], 0.012, c); ctx.beginPath(); ctx.ellipse(p[0], p[1], 5, 14, 0, 0, TAU); ctx.fill(); });
      box(ctx, { x: s.x + 6, y: s.y + 10, w: s.w - 12, h: s.h - 20 }, s.k * 0.45, s.k * 0.6, c, '#3a4a5a');
      box(ctx, { x: s.x + 6, y: s.y + 6, w: s.w - 12, h: 8 }, s.k * 0.6, s.k * 1.4, c, '#3a4a5a');
      return;
    }
    if (st === 'medcab') {                                                                            // white drug cabinet with glass doors and a cross
      var mc = box(ctx, s, 0, s.k, c, '#8e9088', '#9c9e96');
      var front = mc.vis[2] ? 2 : (mc.vis[1] ? 1 : 3), mcr = onFace(s, front, 0.5, s.k * 0.82, c);
      [0.08, 0.52].forEach(function (u) { poly(ctx, [onFace(s, front, u, s.k * 0.12, c), onFace(s, front, u + 0.4, s.k * 0.12, c), onFace(s, front, u + 0.4, s.k * 0.7, c), onFace(s, front, u, s.k * 0.7, c)], 'rgba(30,40,42,0.85)', 'rgba(0,0,0,0.5)'); });
      ctx.fillStyle = 'rgba(70,120,80,0.7)'; ctx.fillRect(mcr[0] - 2, mcr[1] - 6, 4, 12); ctx.fillRect(mcr[0] - 6, mcr[1] - 2, 12, 4);
      return;
    }
    var bx = box(ctx, s, 0, s.k, c, col);
    if (st === 'desk') {                                                                              // papers, a dead monitor, a mug
      var m = { x: s.x + s.w * 0.15, y: s.y + 8, w: 40, h: 14 };
      box(ctx, m, s.k, s.k + 0.03, c, '#262a2a', '#1c1f1f');
      var mf = onFace(m, 2, 0.5, s.k + 0.015, c); ctx.fillStyle = 'rgba(80,100,104,0.25)'; ctx.fillRect(mf[0] - 15, mf[1] - 5, 30, 8);
      ctx.fillStyle = 'rgba(200,196,180,0.55)';
      for (i = 0; i < 3; i++) { var pp = mix(mix(bx.t[0], bx.t[1], 0.5 + i * 0.12), mix(bx.t[3], bx.t[2], 0.5 + i * 0.12), 0.45 + i * 0.1); ctx.save(); ctx.translate(pp[0], pp[1]); ctx.rotate(i * 0.5 - 0.3); ctx.fillRect(-8, -5, 16, 11); ctx.restore(); }
      var mg = mix(mix(bx.t[0], bx.t[1], 0.85), mix(bx.t[3], bx.t[2], 0.85), 0.3); ctx.fillStyle = '#6a5e50'; ctx.beginPath(); ctx.arc(mg[0], mg[1], 4, 0, TAU); ctx.fill();
    } else if (st === 'cabinet' || st === 'locker') {                                                // drawers / locker doors on the faces we see
      [1, 2, 3].forEach(function (side) {
        if (!bx.vis[side]) return;
        var len = side % 2 ? s.h : s.w, cnt = Math.max(1, Math.round(len / (st === 'locker' ? 36 : 50)));
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1;
        for (var q = 1; q < cnt; q++) line(ctx, onFace(s, side, q / cnt, 0, c), onFace(s, side, q / cnt, s.k, c));
        if (st === 'cabinet') for (var d = 1; d < 4; d++) line(ctx, onFace(s, side, 0, s.k * d / 4, c), onFace(s, side, 1, s.k * d / 4, c));
        else for (q = 0; q < cnt; q++) { ctx.strokeStyle = 'rgba(0,0,0,0.5)'; for (var v = 0; v < 3; v++) line(ctx, onFace(s, side, (q + 0.3) / cnt, s.k * (0.8 - v * 0.05), c), onFace(s, side, (q + 0.7) / cnt, s.k * (0.8 - v * 0.05), c)); }
        if (hash(s.x, side) < 0.5) {                                                                // one hanging open
          var hz = onFace(s, side, 0.5 / cnt, 0, c), hzT = onFace(s, side, 0.5 / cnt, s.k, c);
          poly(ctx, [onFace(s, side, 0, 0.005, c), onFace(s, side, 1 / cnt, 0.005, c), onFace(s, side, 1 / cnt, s.k * 0.95, c), onFace(s, side, 0, s.k * 0.95, c)], '#0b0c0c');
          void hz; void hzT;
        }
      });
    } else if (st === 'shelf') {                                                                      // archive boxes on the shelf top
      for (i = 0; i < Math.floor(s.h / 60); i++) { var bxs = { x: s.x + 6, y: s.y + 8 + i * 60, w: s.w - 12, h: 46 }; if (hash(s.x, i) < 0.75) box(ctx, bxs, s.k, s.k + 0.02, c, hash(i, s.x) < 0.5 ? '#6a5a42' : '#5c5446'); }
      if (bx.vis[2]) for (i = 1; i < 4; i++) { ctx.strokeStyle = 'rgba(0,0,0,0.5)'; line(ctx, onFace(s, 2, 0, s.k * i / 4, c), onFace(s, 2, 1, s.k * i / 4, c)); }
    } else if (st === 'rack') {                                                                       // empty gun rack: slots and pegs
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
      var horz = s.w > s.h, len2 = horz ? s.w : s.h;
      for (var o = 16; o < len2; o += 22) { var a0 = horz ? [s.x + o, s.y + 4] : [s.x + 4, s.y + o], a1 = horz ? [s.x + o, s.y + s.h - 4] : [s.x + s.w - 4, s.y + o]; line(ctx, lift(a0[0], a0[1], s.k, c), lift(a1[0], a1[1], s.k, c)); }
    } else if (st === 'board') {                                                                      // whiteboard with old scribbles
      ctx.strokeStyle = 'rgba(40,60,90,0.5)'; ctx.lineWidth = 1.5;
      if (bx.vis[2]) for (i = 0; i < 5; i++) { var y0 = s.k * (0.75 - i * 0.12); line(ctx, onFace(s, 2, 0.1 + hash(i, 1) * 0.2, y0, c), onFace(s, 2, 0.5 + hash(i, 2) * 0.4, y0, c)); }
    } else if (st === 'fridge') {
      if (bx.vis[2]) { ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; line(ctx, onFace(s, 2, 0, s.k * 0.62, c), onFace(s, 2, 1, s.k * 0.62, c)); line(ctx, onFace(s, 2, 0.12, s.k * 0.4, c), onFace(s, 2, 0.12, s.k * 0.55, c)); }
      ctx.fillStyle = 'rgba(90,60,30,0.3)'; var rs = mix(bx.t[0], bx.t[2], 0.6); ctx.beginPath(); ctx.ellipse(rs[0], rs[1], 9, 5, 0, 0, TAU); ctx.fill();
    } else if (st === 'safe') {
      if (bx.vis[2]) { var dl = onFace(s, 2, 0.5, s.k * 0.5, c); ctx.strokeStyle = '#8a8a80'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(dl[0], dl[1], 5, 0, TAU); ctx.stroke(); }
    } else if (st === 'counter') {
      ctx.strokeStyle = 'rgba(210,200,180,0.15)'; ctx.lineWidth = 1.5; line(ctx, bx.t[0], bx.t[1]);
      if (s.w > s.h) { var bell = mix(mix(bx.t[0], bx.t[1], 0.3), mix(bx.t[3], bx.t[2], 0.3), 0.5); ctx.fillStyle = '#8a7a50'; ctx.beginPath(); ctx.arc(bell[0], bell[1], 3.5, 0, TAU); ctx.fill(); }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1; poly(ctx, bx.t, null);
  }

  // Vending machines: tall boxes, the glass front (south) with rows of what is left inside, smashed on some.
  function drawVending(ctx, s, c) {
    var snack = s.variant === 'snack', col = snack ? '#5a3430' : '#2f4a5c', bx = box(ctx, s, 0, s.k, c, col, tone(col, 0.75)), i, j;
    if (bx.vis[2]) {
      var g0 = 0.08, g1 = 0.68, k0 = s.k * 0.22, k1 = s.k * 0.9;
      poly(ctx, [onFace(s, 2, g0, k0, c), onFace(s, 2, g1, k0, c), onFace(s, 2, g1, k1, c), onFace(s, 2, g0, k1, c)], '#0e1314', 'rgba(0,0,0,0.7)');
      for (i = 0; i < 4; i++) for (j = 0; j < (snack ? 5 : 4); j++) {                                   // what is still on the spirals / shelves
        if (hash(s.x + i, j + s.y) < 0.45) continue;
        var u = g0 + (g1 - g0) * (j + 0.5) / (snack ? 5 : 4), kk = k0 + (k1 - k0) * (i + 0.35) / 4, p = onFace(s, 2, u, kk, c);
        ctx.fillStyle = snack ? K.hsl([10, 40, 90, 200][(i + j) % 4], 30, 34) : K.hsl([200, 180, 30][(i + j) % 3], 26, 40);
        if (snack) ctx.fillRect(p[0] - 4, p[1] - 3, 8, 5); else ctx.fillRect(p[0] - 2, p[1] - 6, 4, 9);
      }
      ctx.strokeStyle = 'rgba(200,220,220,0.22)'; ctx.lineWidth = 1;                                 // glass shine + cracks
      line(ctx, onFace(s, 2, g0 + 0.04, k1 - 0.01, c), onFace(s, 2, g0 + 0.2, k0 + 0.02, c));
      var cc = onFace(s, 2, 0.38, s.k * 0.55, c);
      for (i = 0; i < 6; i++) { var a = i / 6 * TAU + 0.3; line(ctx, cc, [cc[0] + Math.cos(a) * 12, cc[1] + Math.sin(a) * 9]); }
      poly(ctx, [onFace(s, 2, 0.74, s.k * 0.5, c), onFace(s, 2, 0.92, s.k * 0.5, c), onFace(s, 2, 0.92, s.k * 0.85, c), onFace(s, 2, 0.74, s.k * 0.85, c)], '#1a1c1c');   // coin panel
      ctx.fillStyle = 'rgba(160,150,120,0.5)'; var sl = onFace(s, 2, 0.83, s.k * 0.72, c); ctx.fillRect(sl[0] - 2, sl[1] - 4, 4, 6);
      poly(ctx, [onFace(s, 2, g0, s.k * 0.04, c), onFace(s, 2, g1, s.k * 0.04, c), onFace(s, 2, g1, s.k * 0.16, c), onFace(s, 2, g0, s.k * 0.16, c)], '#050606');   // the tray at the bottom
    }
    var band = [mix(bx.t[3], bx.t[0], 0), mix(bx.t[2], bx.t[1], 0), mix(bx.t[2], bx.t[1], 0.3), mix(bx.t[3], bx.t[0], 0.3)];
    poly(ctx, band, snack ? 'rgba(200,150,80,0.35)' : 'rgba(150,190,210,0.3)');                       // faded brand stripe on the top
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; poly(ctx, bx.t, null);
  }

  function drawBars(ctx, s, c) {
    var horiz = s.w >= s.h, len = horiz ? s.w : s.h;
    var a0 = horiz ? [s.x, s.y + s.h / 2] : [s.x + s.w / 2, s.y], a1 = horiz ? [s.x + s.w, s.y + s.h / 2] : [s.x + s.w / 2, s.y + s.h];
    var b0 = lift(a0[0], a0[1], 0, c), b1 = lift(a1[0], a1[1], 0, c), t0 = lift(a0[0], a0[1], s.k, c), t1 = lift(a1[0], a1[1], s.k, c);
    ctx.lineWidth = 2;
    for (var o = 4; o < len; o += 12) {
      var u = o / len;
      ctx.strokeStyle = '#101211'; line(ctx, [mix(b0, b1, u)[0] + 1, mix(b0, b1, u)[1]], [mix(t0, t1, u)[0] + 1, mix(t0, t1, u)[1]]);
      ctx.strokeStyle = '#6a706c'; line(ctx, mix(b0, b1, u), mix(t0, t1, u));
    }
    ctx.lineWidth = 3; ctx.strokeStyle = '#4e5450'; line(ctx, t0, t1); line(ctx, mix(b0, t0, 0.5), mix(b1, t1, 0.5));
  }

  // Stairs: steps rising to the north (up) or a dark well going down.
  function drawStairs(ctx, s, c) {
    var n = 12, i, up = s.dir === 'up';
    for (i = 0; i < n; i++) {
      var y0 = s.y + s.h - (i + 1) * s.h / n, r = { x: s.x, y: y0, w: s.w, h: s.h / n + 1 };
      if (up) box(ctx, r, 0, s.k * 0.35 + (i + 1) * s.k * 0.65 / n, c, '#5a554a', tone('#6a6456', 0.9 + i * 0.012));
      else { var p = rectPts(r).map(function (q) { return lift(q[0], q[1], 0, c); }); poly(ctx, p, tone('#4a463e', Math.max(0.2, 1 - i * 0.07))); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; line(ctx, p[0], p[1]); }
    }
    if (!up) { var gr = ctx.createLinearGradient(0, lift(s.x, s.y + s.h, 0, c)[1], 0, lift(s.x, s.y, 0, c)[1]); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.7)'); ctx.fillStyle = gr; poly(ctx, rectPts(s).map(function (q) { return lift(q[0], q[1], 0, c); }), gr); }
    ctx.strokeStyle = 'rgba(210,200,170,0.25)'; ctx.lineWidth = 1.5;                                     // painted nosing on the first step
    line(ctx, lift(s.x, s.y + s.h, up ? s.k * 0.35 : 0, c), lift(s.x + s.w, s.y + s.h, up ? s.k * 0.35 : 0, c));
  }

  function drawVendLoot(g, rand, drink) {
    shadowBlob(g, 3, 5, 24, 18, 0.45);
    g.fillStyle = 'rgba(170,200,200,0.35)';                                                               // broken glass
    for (var i = 0; i < 10; i++) { var a = rand() * TAU, d = 6 + rand() * 14; g.beginPath(); g.moveTo(Math.cos(a) * d, Math.sin(a) * d); g.lineTo(Math.cos(a) * d + 3, Math.sin(a) * d + 1); g.lineTo(Math.cos(a) * d + 1, Math.sin(a) * d + 3); g.fill(); }
    for (i = 0; i < 5; i++) {
      var x = (rand() - 0.5) * 22, y = (rand() - 0.5) * 14;
      g.save(); g.translate(x, y); g.rotate(rand() * 3);
      if (drink) { g.fillStyle = '#0f1414'; g.fillRect(-2.6, -6, 6, 13); g.fillStyle = K.hsl([200, 180, 30][i % 3], 28, 42); g.fillRect(-3, -7, 6, 13); g.fillStyle = 'rgba(230,230,220,0.5)'; g.fillRect(-1.5, -9, 3, 3); }
      else { g.fillStyle = '#100e0c'; g.fillRect(-6, -3, 13, 8); g.fillStyle = K.hsl([10, 40, 90, 200][i % 4], 32, 36); g.fillRect(-7, -4, 13, 8); g.fillStyle = 'rgba(230,220,200,0.35)'; g.fillRect(-4, -2, 5, 2); }
      g.restore();
    }
  }

  function drawPapers(g, rand) {
    for (var i = 0; i < 3; i++) {
      g.save(); g.translate((rand() - 0.5) * 16, (rand() - 0.5) * 12); g.rotate(rand() * 3);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-6, -4, 13, 10);
      g.fillStyle = 'rgba(' + (140 + rand() * 30 | 0) + ',' + (136 + rand() * 24 | 0) + ',124,0.4)'; g.fillRect(-7, -5, 13, 10);
      g.fillStyle = 'rgba(40,40,40,0.25)'; g.fillRect(-5, -3, 8, 1); g.fillRect(-5, 0, 9, 1);
      g.restore();
    }
  }

  function buildTiles(ctx) {
    var size = 256, rand = G.util.rng(611), i;
    var c = document.createElement('canvas');
    c.width = c.height = size * S;
    var g = c.getContext('2d');
    g.scale(S, S);
    g.fillStyle = '#25272a'; g.fillRect(0, 0, size, size);
    for (var x = 0; x < size; x += 32) for (var y = 0; y < size; y += 32) {
      g.fillStyle = ((x + y) / 32) % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.06)'; g.fillRect(x, y, 32, 32);
      if (rand() < 0.04) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 2, y + 2, 28, 28); }               // a missing tile
    }
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
    for (i = 0; i <= size; i += 32) { g.beginPath(); g.moveTo(i + 0.5, 0); g.lineTo(i + 0.5, size); g.stroke(); g.beginPath(); g.moveTo(0, i + 0.5); g.lineTo(size, i + 0.5); g.stroke(); }
    for (i = 0; i < 1500; i++) { g.fillStyle = ['rgba(0,0,0,0.18)', 'rgba(150,140,120,0.05)'][i % 2]; g.fillRect(rand() * size, rand() * size, 1 + rand(), 1 + rand()); }
    for (i = 0; i < 6; i++) {
      var sx = rand() * size, sy = rand() * size, sr = 10 + rand() * 26, gr = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
      gr.addColorStop(0, 'rgba(40,30,18,0.25)'); gr.addColorStop(1, 'rgba(40,30,18,0)'); g.fillStyle = gr; g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    }
    var pat = ctx.createPattern(c, 'repeat');
    try { if (S !== 1 && pat.setTransform) pat.setTransform(new DOMMatrix().scale(1 / S)); } catch (e) { /* tile resolution */ }
    return pat;
  }

  // floors of rooms (carpet / concrete), mats at the doors, daylight from the windows, nothing outside the walls
  function interiorOverlay(g, area, rand) {
    (area.floors || []).forEach(function (f) {
      g.fillStyle = 'rgba(' + f.tone + ',0.75)'; g.fillRect(f.x, f.y, f.w, f.h);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      for (var i = 0; i < f.w * f.h / 2500; i++) g.fillRect(f.x + rand() * f.w, f.y + rand() * f.h, 2, 2);
    });
    (area.doors || []).forEach(function (d) {
      g.fillStyle = 'rgba(30,26,20,0.8)'; g.fillRect(d.x - 46, d.y - 26, 92, 52);
      g.strokeStyle = 'rgba(120,110,80,0.25)'; g.lineWidth = 2; g.strokeRect(d.x - 42, d.y - 22, 84, 44);
    });
  }
  function interiorFinish(g, area) {
    (area.lights || []).forEach(function (l) {                                                             // pale daylight
      var gr = g.createRadialGradient(l[0], l[1], 0, l[0], l[1], l[2]);
      gr.addColorStop(0, 'rgba(170,186,190,0.1)'); gr.addColorStop(1, 'rgba(170,186,190,0)');
      g.fillStyle = gr; g.fillRect(l[0] - l[2], l[1] - l[2], l[2] * 2, l[2] * 2);
    });
    var F = area.footprint;
    if (F) {
      g.fillStyle = '#050606';
      g.fillRect(0, 0, area.width, F.y); g.fillRect(0, F.y + F.h, area.width, area.height); g.fillRect(0, 0, F.x, area.height); g.fillRect(F.x + F.w, 0, area.width, area.height);
    }
  }


  // ---- more places: houses, tents, planes, piles, special vehicles ---------------------------------------

  function gable(ctx, s, c, kW, kR, wallCol, roofCol, o) {
    o = o || {};
    var ov = o.ov === undefined ? 10 : o.ov, horiz = s.w >= s.h, i;
    var nw = lift(s.x - ov, s.y - ov, kW, c), ne = lift(s.x + s.w + ov, s.y - ov, kW, c);
    var se = lift(s.x + s.w + ov, s.y + s.h + ov, kW, c), sw = lift(s.x - ov, s.y + s.h + ov, kW, c);
    var r0, r1;
    if (horiz) { r0 = lift(s.x - ov, s.y + s.h / 2, kR, c); r1 = lift(s.x + s.w + ov, s.y + s.h / 2, kR, c); }
    else { r0 = lift(s.x + s.w / 2, s.y - ov, kR, c); r1 = lift(s.x + s.w / 2, s.y + s.h + ov, kR, c); }
    var faces = horiz
      ? [{ p: [nw, ne, r1, r0], lit: 0.95, north: true }, { p: [sw, se, r1, r0], lit: 0.62 }]
      : [{ p: [nw, sw, r1, r0], lit: 0.95 }, { p: [ne, se, r1, r0], lit: 0.6 }];
    if (horiz) { poly(ctx, [nw, sw, r0], tone(wallCol, 0.7)); poly(ctx, [ne, se, r1], tone(wallCol, 0.5)); }
    else { poly(ctx, [nw, ne, r0], tone(wallCol, 0.7)); poly(ctx, [sw, se, r1], tone(wallCol, 0.55)); }
    var cy = (s.y + s.h / 2);
    if (horiz && c.y < cy) faces.reverse();
    faces.forEach(function (f) {
      poly(ctx, f.p, tone(roofCol, f.lit));
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
      var rows = o.rows || 6;
      for (i = 1; i < rows; i++) line(ctx, mix(f.p[0], f.p[3], i / rows), mix(f.p[1], f.p[2], i / rows));
      if (o.moss && f.north) { ctx.fillStyle = 'rgba(58,82,48,0.4)'; var m = mix(mix(f.p[0], f.p[1], 0.3), mix(f.p[3], f.p[2], 0.3), 0.4); ctx.beginPath(); ctx.ellipse(m[0], m[1], 16, 8, 0, 0, TAU); ctx.fill(); }
      if (o.hole && !f.north && horiz) {
        var h0 = mix(mix(f.p[0], f.p[1], 0.55), mix(f.p[3], f.p[2], 0.55), 0.15), h1 = mix(mix(f.p[0], f.p[1], 0.78), mix(f.p[3], f.p[2], 0.78), 0.2);
        var h2 = mix(mix(f.p[0], f.p[1], 0.72), mix(f.p[3], f.p[2], 0.72), 0.8), h3 = mix(mix(f.p[0], f.p[1], 0.58), mix(f.p[3], f.p[2], 0.58), 0.7);
        poly(ctx, [h0, h1, h2, h3], '#070807');
      }
    });
    ctx.strokeStyle = 'rgba(214,214,190,0.2)'; ctx.lineWidth = 2; line(ctx, r0, r1);
    ctx.lineWidth = 1.2; poly(ctx, [nw, ne, se, sw], null, 'rgba(0,0,0,0.45)');
  }

  function drawHouse(ctx, s, c) {
    var col = s.color || '#6a6256', roof = s.roof || '#6a3e30', bx = box(ctx, s, 0, s.k, c, col, null), i;
    if (bx.vis[2]) {
      var du = s.door !== undefined ? 1 - s.door : 0.5 + (hash(s.x, 1) - 0.5) * 0.4;
      poly(ctx, [onFace(s, 2, du - 0.05, 0, c), onFace(s, 2, du + 0.05, 0, c), onFace(s, 2, du + 0.05, s.k * 0.78, c), onFace(s, 2, du - 0.05, s.k * 0.78, c)], hash(s.y, 2) < 0.4 ? '#060707' : '#2a2018', 'rgba(0,0,0,0.6)');
      [0.2, 0.8].forEach(function (u, n) {
        var broken = hash(s.x + n, s.y) < 0.35, boarded = !broken && hash(s.y + n, s.x) < 0.3;
        var q = [onFace(s, 2, u - 0.07, s.k * 0.35, c), onFace(s, 2, u + 0.07, s.k * 0.35, c), onFace(s, 2, u + 0.07, s.k * 0.76, c), onFace(s, 2, u - 0.07, s.k * 0.76, c)];
        poly(ctx, q, broken ? '#050606' : '#182022', 'rgba(0,0,0,0.6)');
        if (boarded) { ctx.strokeStyle = '#5a4a34'; ctx.lineWidth = 3; line(ctx, q[0], q[2]); line(ctx, q[1], q[3]); }
      });
    }
    if (bx.vis[1] || bx.vis[3]) {
      var sd = bx.vis[1] ? 1 : 3;
      poly(ctx, [onFace(s, sd, 0.4, s.k * 0.35, c), onFace(s, sd, 0.6, s.k * 0.35, c), onFace(s, sd, 0.6, s.k * 0.76, c), onFace(s, sd, 0.4, s.k * 0.76, c)], '#182022', 'rgba(0,0,0,0.6)');
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.2; for (i = 0; i < 4; i++) line(ctx, bx.b[i], bx.t[i]);
    gable(ctx, s, c, s.k, s.k * 1.55, col, roof, { moss: true, hole: s.broken, rows: 7 });
    if (s.chimney) box(ctx, { x: s.x + s.w * 0.72, y: s.y + s.h * 0.2, w: 20, h: 20 }, s.k * 1.25, s.k * 1.75, c, '#5c5550', '#161515');
  }

  function drawTent(ctx, s, c) {
    var col = s.color || '#7a7a68';
    box(ctx, s, 0, s.k * 0.35, c, col, null);
    gable(ctx, s, c, s.k * 0.35, s.k, col, col, { ov: 2, rows: 3 });
    if (s.cross) {
      var m = lift(s.x + s.w / 2, s.y + s.h * 0.75, s.k * 0.68, c);
      ctx.fillStyle = 'rgba(150,56,50,0.7)'; ctx.fillRect(m[0] - 3, m[1] - 9, 6, 18); ctx.fillRect(m[0] - 9, m[1] - 3, 18, 6);
    }
    if (s.open) {                                                                                        // flap tied back on the south end
      var horiz = s.w >= s.h, side = horiz ? 1 : 2;
      poly(ctx, [onFace(s, side, 0.3, 0, c), onFace(s, side, 0.7, 0, c), onFace(s, side, 0.5, s.k * 0.34, c)], '#070807');
    }
  }

  function cone(ctx, cx, cy, r, k, c, col) {
    var N = 28, b = [], i, top = lift(cx, cy, k, c);
    for (i = 0; i < N; i++) { var a = i / N * TAU; b.push(lift(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0, c)); }
    var order = [];
    for (i = 0; i < N; i++) order.push(i);
    order.sort(function (p, q) { return Math.sin(p / N * TAU) - Math.sin(q / N * TAU); });
    order.forEach(function (i2) { var am = (i2 + 0.5) / N * TAU; poly(ctx, [b[i2], b[(i2 + 1) % N], top], tone(col, faceLight(Math.cos(am), Math.sin(am)) * 0.75)); });
  }
  function drawPile(ctx, s, c) {
    cone(ctx, s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.k, c, s.color || '#6f685a');
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (var i = 0; i < 14; i++) { var a = hash(s.x, i) * TAU, d = hash(i, s.y) * s.w * 0.45, p = lift(s.x + s.w / 2 + Math.cos(a) * d, s.y + s.h / 2 + Math.sin(a) * d, s.k * (1 - d / (s.w / 2)) * 0.9, c); ctx.fillRect(p[0], p[1], 2, 2); }
  }

  function drawPlane(ctx, s, c) {
    // fuselage along x (nose east), wings across, tail fin at the west end. s.broken: the east wing snapped off.
    var x = s.x, y = s.y, L = s.w, cy = y + s.h / 2, fw = s.fw || 56, k0 = s.k * 0.35, k1 = s.k;
    var wingK0 = s.k * 0.45, wingK1 = s.k * 0.52, wx = x + L * 0.42, ww = L * 0.16, span = s.h / 2;
    var wing = [[wx, cy - span], [wx + ww * 0.6, cy - span], [wx + ww * 1.4, cy - fw / 2], [wx + ww * 1.4, cy + fw / 2], [wx + ww * 0.6, cy + span], [wx, cy + span], [wx + ww * 0.2, cy + fw / 2], [wx + ww * 0.2, cy - fw / 2]];
    if (s.broken) wing = [[wx, cy - span], [wx + ww * 0.6, cy - span], [wx + ww * 1.4, cy - fw / 2], [wx + ww * 1.4, cy + fw / 2], [wx + ww * 0.9, cy + span * 0.45], [wx + ww * 0.35, cy + span * 0.4], [wx + ww * 0.2, cy + fw / 2], [wx + ww * 0.2, cy - fw / 2]];
    var col = s.color || '#6e716c';
    function engine(ey) { var e = { x: wx + ww * 0.1, y: ey - 12, w: 60, h: 24 }; box(ctx, e, wingK0 - 0.02, wingK0 + 0.002, c, '#5a5c58', '#4a4c48'); }
    engine(cy - span * 0.5); if (!s.broken) engine(cy + span * 0.5);
    prism(ctx, wing, wingK0, wingK1, c, function (n, f) { return tone(col, f * 0.6); }, tone(col, 0.82));
    var body = [[x + 20, cy - fw / 2], [x + L - 90, cy - fw / 2], [x + L - 30, cy - fw * 0.36], [x + L, cy], [x + L - 30, cy + fw * 0.36], [x + L - 90, cy + fw / 2], [x + 20, cy + fw / 2], [x, cy]];
    var bb = prism(ctx, body, k0, k1, c, function (n, f) { return tone(col, f * 0.62); }, tone(col, 0.92));
    ctx.fillStyle = '#121616';                                                                       // cockpit windows and the row of portholes
    var ck = mix(bb.t[3], [(bb.t[2][0] + bb.t[4][0]) / 2, (bb.t[2][1] + bb.t[4][1]) / 2], 0.5); ctx.beginPath(); ctx.ellipse(ck[0], ck[1], 10, 6, 0, 0, TAU); ctx.fill();
    for (var i = 0; i < 18; i++) { var u = 0.12 + i * 0.038, p = lift(x + L * u, cy + fw / 2, k0 + (k1 - k0) * 0.7, c); ctx.fillRect(p[0] - 2, p[1] - 1.5, 4, 3); }
    ctx.fillStyle = 'rgba(70,90,120,0.4)'; poly(ctx, [lift(x + 30, cy + fw / 2, k0 + (k1 - k0) * 0.45, c), lift(x + L - 100, cy + fw / 2, k0 + (k1 - k0) * 0.45, c), lift(x + L - 100, cy + fw / 2, k0 + (k1 - k0) * 0.55, c), lift(x + 30, cy + fw / 2, k0 + (k1 - k0) * 0.55, c)], ctx.fillStyle);
    var tail = [[x + 6, cy - 4], [x + 80, cy - 4], [x + 80, cy + 4], [x + 6, cy + 4]];               // the fin
    prism(ctx, tail, k1, k1 + s.k * 0.9, c, function (n, f) { return tone(col, f * 0.6); }, tone(col, 0.9));
    var stab = [[x + 10, cy - span * 0.35], [x + 60, cy - span * 0.35], [x + 70, cy + span * 0.35], [x + 10, cy + span * 0.35]];
    prism(ctx, stab, k1 - 0.004, k1 + 0.004, c, function (n, f) { return tone(col, f * 0.6); }, tone(col, 0.85));
    if (s.burnt) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; var bm = mix(bb.t[0], bb.t[1], 0.6); ctx.beginPath(); ctx.ellipse(bm[0], bm[1] + 12, 60, 18, 0, 0, TAU); ctx.fill(); }
  }

  function drawVehicle(ctx, s, c) {                                                                    // the special vehicles (car with a style)
    var st = s.style, horiz = s.w > s.h, i;
    var wheels = horiz ? [[0.15, 0], [0.85, 0], [0.15, 1], [0.85, 1]] : [[0, 0.15], [1, 0.15], [0, 0.85], [1, 0.85]];
    if (st === 'excavator' || st === 'apc') {                                                          // tracks along the sides
      var tr = horiz ? [{ x: s.x, y: s.y - 6, w: s.w, h: 16 }, { x: s.x, y: s.y + s.h - 10, w: s.w, h: 16 }] : [{ x: s.x - 6, y: s.y, w: 16, h: s.h }, { x: s.x + s.w - 10, y: s.y, w: 16, h: s.h }];
      if (st === 'excavator') tr.forEach(function (t) { box(ctx, t, 0, 0.022, c, '#262826', '#2e302d'); });
    } else {
      ctx.fillStyle = '#0a0b0a';
      wheels.forEach(function (w) { var p = lift(s.x + s.w * w[0], s.y + s.h * w[1], 0.008, c), big = st === 'tractor' && w[horiz ? 0 : 1] < 0.5; ctx.beginPath(); ctx.ellipse(p[0], p[1], horiz ? (big ? 22 : 13) : 8, horiz ? 8 : (big ? 22 : 13), 0, 0, TAU); ctx.fill(); });
    }
    var col = s.burnt ? '#2a2622' : s.color, k = s.k;
    if (st === 'ambulance') {
      var body = box(ctx, s, 0.008, k, c, col, tone(col, 0.9));
      if (body.vis[2] && horiz) { ctx.fillStyle = 'rgba(150,56,50,0.55)'; poly(ctx, [onFace(s, 2, 0.05, k * 0.5, c), onFace(s, 2, 0.95, k * 0.5, c), onFace(s, 2, 0.95, k * 0.62, c), onFace(s, 2, 0.05, k * 0.62, c)], ctx.fillStyle); }
      if (!horiz && body.vis[1]) { ctx.fillStyle = 'rgba(150,56,50,0.55)'; poly(ctx, [onFace(s, 1, 0.05, k * 0.5, c), onFace(s, 1, 0.95, k * 0.5, c), onFace(s, 1, 0.95, k * 0.62, c), onFace(s, 1, 0.05, k * 0.62, c)], ctx.fillStyle); }
      var tp = mix(mix(body.t[0], body.t[1], 0.5), mix(body.t[3], body.t[2], 0.5), 0.5);
      ctx.fillStyle = 'rgba(150,56,50,0.6)'; ctx.fillRect(tp[0] - 3, tp[1] - 9, 6, 18); ctx.fillRect(tp[0] - 9, tp[1] - 3, 18, 6);
      var lb = horiz ? { x: s.x + s.w - 40, y: s.y + 6, w: 12, h: s.h - 12 } : { x: s.x + 6, y: s.y + 6, w: s.w - 12, h: 12 };
      box(ctx, lb, k, k + 0.006, c, '#6a3632');
      return;
    }
    if (st === 'apc') {
      box(ctx, s, 0.01, k * 0.7, c, col);
      var tur = { x: s.x + s.w * 0.3, y: s.y + s.h * 0.25, w: s.w * 0.4, h: s.h * 0.5 };
      var tb = box(ctx, tur, k * 0.7, k, c, tone(col, 0.95));
      var m0 = mix(mix(tb.t[0], tb.t[1], 0.5), mix(tb.t[3], tb.t[2], 0.5), 0.5), dir = s.aim || 0;
      var m1 = lift(s.x + s.w / 2 + Math.cos(dir) * s.w * 0.6, s.y + s.h / 2 + Math.sin(dir) * s.w * 0.6, k * 0.9, c);
      ctx.strokeStyle = '#161814'; ctx.lineWidth = 6; line(ctx, m0, m1); ctx.strokeStyle = tone(col, 0.7); ctx.lineWidth = 3.5; line(ctx, m0, m1);
      ctx.fillStyle = '#0b0c0a'; ctx.beginPath(); ctx.arc(m0[0], m0[1], 5, 0, TAU); ctx.fill();
      return;
    }
    if (st === 'truck' || st === 'tanker') {
      var cab = horiz ? { x: s.x + s.w - 70, y: s.y, w: 70, h: s.h } : { x: s.x, y: s.y + s.h - 70, w: s.w, h: 70 };
      var bed = horiz ? { x: s.x, y: s.y, w: s.w - 76, h: s.h } : { x: s.x, y: s.y, w: s.w, h: s.h - 76 };
      box(ctx, cab, 0.008, k * 0.85, c, col);
      if (st === 'tanker') drawCylinderLying(ctx, bed, k * 0.25, k, c, s.tank || '#8a8a82');
      else { var bb2 = box(ctx, bed, 0.012, k, c, s.cargo || tone(col, 0.8)); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; for (i = 1; i < 8; i++) line(ctx, mix(bb2.t[0], bb2.t[1], i / 8), mix(bb2.t[3], bb2.t[2], i / 8)); }
      return;
    }
    if (st === 'tractor') {
      var hood = horiz ? { x: s.x + s.w * 0.45, y: s.y + 12, w: s.w * 0.55, h: s.h - 24 } : { x: s.x + 12, y: s.y, w: s.w - 24, h: s.h * 0.55 };
      var cabT = horiz ? { x: s.x + 6, y: s.y + 6, w: s.w * 0.4, h: s.h - 12 } : { x: s.x + 6, y: s.y + s.h * 0.55, w: s.w - 12, h: s.h * 0.4 };
      box(ctx, hood, 0.01, k * 0.6, c, col);
      box(ctx, cabT, 0.01, k, c, tone(col, 0.9), '#1c2020');
      var ex = lift(hood.x + 10, hood.y + 10, k * 0.6, c), ex2 = lift(hood.x + 10, hood.y + 10, k * 1.1, c); ctx.strokeStyle = '#141412'; ctx.lineWidth = 3; line(ctx, ex, ex2);
      return;
    }
    if (st === 'excavator') {
      var hb = box(ctx, { x: s.x + 10, y: s.y + 10, w: s.w - 20, h: s.h - 20 }, 0.022, k * 0.55, c, col);
      box(ctx, { x: s.x + 14, y: s.y + 14, w: (s.w - 28) * 0.45, h: (s.h - 28) * 0.55 }, k * 0.55, k, c, tone(col, 0.9), '#1a1e1e');
      var a0 = lift(s.x + s.w * 0.6, s.y + s.h * 0.4, k * 0.6, c), a1 = lift(s.x + s.w * 1.4, s.y + s.h * 0.2, k * 1.4, c), a2 = lift(s.x + s.w * 1.9, s.y + s.h * 0.45, 0.01, c);
      ctx.strokeStyle = '#141412'; ctx.lineWidth = 10; line(ctx, a0, a1); line(ctx, a1, a2);
      ctx.strokeStyle = tone(col, 0.9); ctx.lineWidth = 7; line(ctx, a0, a1); line(ctx, a1, a2);
      ctx.fillStyle = '#2a2b28'; ctx.beginPath(); ctx.ellipse(a2[0], a2[1], 16, 10, 0, 0, TAU); ctx.fill();
      void hb;
    }
  }

  function drawCylinderLying(ctx, r, k0, k1, c, col) {                                               // a tank on a truck bed
    box(ctx, r, k0, k1, c, col, tone(col, 0.95));
    var t = [lift(r.x, r.y + r.h * 0.2, k1, c), lift(r.x + r.w, r.y + r.h * 0.2, k1, c), lift(r.x + r.w, r.y + r.h * 0.8, k1, c), lift(r.x, r.y + r.h * 0.8, k1, c)];
    poly(ctx, t, 'rgba(255,255,255,0.06)');
  }

  // Structures whose base is south of the player are drawn after the player; ships, boats and cranes have
  // fixed layers (water below everything, cranes above everything). Tall things over the player fade.
  // Range mode (lo/hi given): draws the structures whose base is in (lo, hi], so the game can interleave them
  // with every figure (the player and the infected) by depth. `realPy` is the player's depth for the see-through fade.
  function drawStructures(ctx, area, st, vr, time, py, front, lo, hi, realPy) {
    var T = prepare(area), c = { x: (vr.x0 + vr.x1) / 2, y: (vr.y0 + vr.y1) / 2 + VIEW.tilt / VIEW.persp };
    var px = st.player ? st.player.x : 0, dt = T.last === undefined ? 0 : Math.max(0, Math.min(0.1, time - T.last));
    var ranged = lo !== undefined, ply = realPy === undefined ? py : realPy;
    if (front) T.last = time;
    for (var i = 0; i < T.order.length; i++) {
      var s = T.order[i], wet = s.kind === 'ship' || s.kind === 'boat', base = s.y + s.h;
      if (s.smashed) continue;                                                                        // a wall that was broken down (js/area.js)
      if (ranged) { if (wet || s.kind === 'crane' || base <= lo || base > hi) continue; }
      else {
        var isFront = s.kind === 'crane' ? true : (wet ? false : base > py);
        if (isFront !== front) continue;
      }
      var reach = s.k * 900 + 40;
      if (s.x + s.w < vr.x0 - reach || s.x > vr.x1 + reach || s.y + s.h < vr.y0 - 60 || s.y - (s.boom || 0) > vr.y1 + reach) continue;
      var a = 1, covers = ranged ? base > ply : front;
      if (covers && s.k > 0.09) {                                                                    // see-through when it hides the player
        var hide = px > s.x - 40 && px < s.x + s.w + 40 && ply < s.y + s.h + (s.kind === 'crane' ? 40 : 0) && ply > s.y - s.k * 700 - (s.boom || 0);
        var f = T.fade[i] === undefined ? 1 : T.fade[i], want = hide ? (s.kind === 'crane' ? 0.45 : 0.4) : 1;
        f += (want - f) * (1 - Math.exp(-7 * dt));
        T.fade[i] = f; a = f;
      }
      ctx.globalAlpha = a;
      if (s.kind === 'container') drawContainer(ctx, s, c);
      else if (s.kind === 'warehouse') drawWarehouse(ctx, s, c);
      else if (s.kind === 'office') drawOffice(ctx, s, c);
      else if (s.kind === 'tankc') drawTankC(ctx, s, c);
      else if (s.kind === 'bollard') drawBollard(ctx, s, c);
      else if (s.kind === 'lamp') drawLamp(ctx, s, c);
      else if (s.kind === 'fence') drawFence(ctx, s, c);
      else if (s.kind === 'gatepost') drawGatepost(ctx, s, c, area);
      else if (s.kind === 'ship') drawShip(ctx, s, c, time);
      else if (s.kind === 'boat') drawBoat(ctx, s, c);
      else if (s.kind === 'crane') drawCrane(ctx, s, c, time);
      else if (s.kind === 'block') drawBlock(ctx, s, c);
      else if (s.kind === 'shop') drawShop(ctx, s, c);
      else if (s.kind === 'wall') drawWall(ctx, s, c);
      else if (s.kind === 'tower') drawTower(ctx, s, c);
      else if (s.kind === 'flagpole') drawFlag(ctx, s, c, time);
      else if (s.kind === 'sandbags') drawSandbags(ctx, s, c);
      else if (s.kind === 'barrier') drawBarrier(ctx, s, c);
      else if (s.kind === 'car') drawCar(ctx, s, c);
      else if (s.kind === 'iwall') drawIWall(ctx, s, c);
      else if (s.kind === 'house') drawHouse(ctx, s, c);
      else if (s.kind === 'tent') drawTent(ctx, s, c);
      else if (s.kind === 'pile') drawPile(ctx, s, c);
      else if (s.kind === 'plane') drawPlane(ctx, s, c);
      else if (s.kind === 'furn') drawFurn(ctx, s, c);
      else if (s.kind === 'vending') drawVending(ctx, s, c);
      else if (s.kind === 'bars') drawBars(ctx, s, c);
      else if (s.kind === 'stairs') drawStairs(ctx, s, c);
      else if (EXT.kinds[s.kind]) EXT.kinds[s.kind](ctx, s, c, time, HELP);     // kinds added by js/art/*.js
    }
    ctx.globalAlpha = 1;
    if (front && EXT.overlays[area.id]) EXT.overlays[area.id].forEach(function (fn) { fn(ctx, area, vr, time, HELP); });
  }

  var EXT = { kinds: {}, furn: {}, sprites: [], overlays: {}, ready: false };
  // shared drawing helpers for extensions
  var HELP = {
    lift: lift, mix: mix, poly: poly, line: line, tone: tone, hash: hash, prism: prism, box: box, rectPts: rectPts, onFace: onFace,
    cone: function () { return cone.apply(null, arguments); }, cylinder: function () { return drawCylinder.apply(null, arguments); },
    gable: function () { return gable.apply(null, arguments); }, faceLight: faceLight, kit: function () { return K; }, TAU: TAU
  };

  G.placeArt = {
    init: function (ctx, dpr) {
      S = Math.max(1, Math.min(dpr || 1, 2));
      mainCtx = ctx;
      K = G.forestArt.kit();
      buildSprites();
      EXT.sprites.forEach(function (sp) { K.SP[sp.name] = variants(sp.n, sp.seed, function (r, i) { return K.mk(sp.w, sp.h, function (g) { sp.draw(g, r, i, HELP); }); }); });
      EXT.ready = true;
    },
    // Extension points for js/art/*.js (one file per place / theme, so parallel work never touches this file):
    //   register(kind, fn(ctx, s, c, time, H))  draws a new structure kind; furn(style, fn(ctx, s, c, H)) a new furniture style;
    //   sprite(name, n, seed, w, h, draw(g, rand, i, H)) a sprite list for a new resource type (K.SP[name]);
    //   overlay(areaId, fn(ctx, area, vr, time, H)) extra drawing after the front structures (ambient effects, no flashing).
    register: function (kind, fn) { EXT.kinds[kind] = fn; },
    furn: function (style, fn) { EXT.furn[style] = fn; },
    sprite: function (name, n, seed, w, h, draw) { EXT.sprites.push({ name: name, n: n, seed: seed, w: w, h: h, draw: draw }); },
    overlay: function (areaId, fn) { (EXT.overlays[areaId] = EXT.overlays[areaId] || []).push(fn); },
    helpers: function () { return HELP; },
    has: function (area) { return !!(area && ((area.structures && area.structures.length) || (area.water && area.water.length))); },
    ground: function (kind) {
      if (!grounds[kind]) grounds[kind] = kind === 'tiles' ? buildTiles(mainCtx) : buildConcrete(mainCtx, kind);
      return grounds[kind];
    },
    prepare: prepare,
    drawGround: drawGround,
    drawStructures: drawStructures
  };
})(typeof window !== 'undefined' ? window : globalThis);
