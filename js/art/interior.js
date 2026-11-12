// Extra furniture for building interiors (data/interiors.js): home, shop, office and workshop pieces.
// Every style is drawn with the shared helpers of js/placeart.js (H.box, H.onFace, H.lift ...), same light and tilt.
// Styles are prefixed `in_`. Optional fields on a piece: color, goods (shelf stock palette), ruined.
(function (root) {
  'use strict';
  var G = root.G;
  if (!G || !G.placeArt) return;
  var A = G.placeArt, TAU = Math.PI * 2;

  function q(H, s, u0, v0, u1, v1, k, c) {            // a flat quad on a level k inside rect s (u, v in 0..1)
    return [H.lift(s.x + s.w * u0, s.y + s.h * v0, k, c), H.lift(s.x + s.w * u1, s.y + s.h * v0, k, c), H.lift(s.x + s.w * u1, s.y + s.h * v1, k, c), H.lift(s.x + s.w * u0, s.y + s.h * v1, k, c)];
  }
  function front(bx) { return bx.vis[2] ? 2 : (bx.vis[1] ? 1 : 3); }
  function facePanel(H, ctx, s, side, u0, u1, f0, f1, c, fill, stroke) {
    H.poly(ctx, [H.onFace(s, side, u0, f0, c), H.onFace(s, side, u1, f0, c), H.onFace(s, side, u1, f1, c), H.onFace(s, side, u0, f1, c)], fill, stroke);
  }
  function dot(ctx, p, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill(); }
  function oval(ctx, p, rx, ry, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(p[0], p[1], rx, ry, 0, 0, TAU); ctx.fill(); }

  // ---- living room ----
  A.furn('in_bookshelf', function (ctx, s, c, H) {        // tall shelf against a wall, rows of book spines on the open face
    var col = s.color || '#4a3a2a', bx = H.box(ctx, s, 0, s.k, c, col), side = front(bx), n = 4, i, j;
    var pal = ['#6a3a30', '#3a4a5a', '#5a5a3a', '#7a6a4a', '#3a5040', '#5a3a4a', '#8a7a5a'];
    for (i = 0; i < n; i++) {
      var f0 = s.k * (0.06 + i * 0.235), f1 = f0 + s.k * 0.19;
      facePanel(H, ctx, s, side, 0.04, 0.96, f0, f1, c, 'rgba(10,8,6,0.8)');
      var u = 0.06, m = 0;
      while (u < 0.92 && m < 30) {
        var w = 0.03 + H.hash(s.x + i, m + s.y) * 0.045, top = 0.6 + H.hash(m, s.x + i * 7) * 0.4;
        if (H.hash(i * 3 + s.x, m) < 0.12) { u += w * 1.6; m++; continue; }   // a gap where books were taken
        facePanel(H, ctx, s, side, u, Math.min(0.94, u + w), f0, f0 + (f1 - f0) * top, c, H.tone(pal[(m + i * 3) % pal.length], 0.8));
        u += w + 0.005; m++;
      }
    }
    j = 0; void j;
  });
  A.furn('in_tv', function (ctx, s, c, H) {               // low stand with a flat screen on top, facing south
    var bx = H.box(ctx, s, 0, s.k * 0.4, c, '#3a3430');
    var scr = { x: s.x + s.w * 0.1, y: s.y + s.h * 0.35, w: s.w * 0.8, h: 6 };
    H.box(ctx, scr, s.k * 0.4, s.k, c, '#141616', '#1e2020');
    facePanel(H, ctx, scr, 2, 0.04, 0.96, s.k * 0.45, s.k * 0.95, c, '#0c1012');
    var gl = H.onFace(scr, 2, 0.3, s.k * 0.85, c); ctx.strokeStyle = 'rgba(140,160,170,0.12)'; ctx.lineWidth = 2; H.line(ctx, gl, H.onFace(scr, 2, 0.42, s.k * 0.55, c));
    if (s.ruined) { ctx.strokeStyle = 'rgba(160,170,170,0.3)'; ctx.lineWidth = 1; var m0 = H.onFace(scr, 2, 0.6, s.k * 0.7, c); H.line(ctx, m0, H.onFace(scr, 2, 0.8, s.k * 0.9, c)); H.line(ctx, m0, H.onFace(scr, 2, 0.45, s.k * 0.5, c)); }
    void bx;
  });
  A.furn('in_plant', function (ctx, s, c, H) {            // pot with a dried-out bush
    var pot = { x: s.x + s.w * 0.2, y: s.y + s.h * 0.2, w: s.w * 0.6, h: s.h * 0.6 };
    H.box(ctx, pot, 0, s.k * 0.45, c, '#6a4a36', '#2a2018');
    var ctr = H.lift(s.x + s.w / 2, s.y + s.h / 2, s.k * 0.45, c), i;
    var dry = H.hash(s.x, s.y) < 0.5;
    for (i = 0; i < 9; i++) {
      var a = i / 9 * TAU + H.hash(i, s.x) * 0.6, r = s.w * (0.25 + H.hash(s.y, i) * 0.35);
      var p = H.lift(s.x + s.w / 2 + Math.cos(a) * r, s.y + s.h / 2 + Math.sin(a) * r * 0.7, s.k * (0.8 + H.hash(i, i) * 0.5), c);
      ctx.strokeStyle = dry ? '#5a5034' : '#3a4a30'; ctx.lineWidth = 1.5; H.line(ctx, ctr, p);
      oval(ctx, p, 5, 3.5, dry ? '#6e6440' : '#44583a');
    }
  });
  A.furn('in_painting', function (ctx, s, c, H) {         // a framed picture hanging on the wall north of it
    var k0 = s.k * 0.45, k1 = s.k, r = { x: s.x, y: s.y, w: s.w, h: 2 };
    var fr = [H.onFace(r, 0, 1, k0, c), H.onFace(r, 0, 0, k0, c), H.onFace(r, 0, 0, k1, c), H.onFace(r, 0, 1, k1, c)];
    H.poly(ctx, fr, '#3a2c1e');
    var inn = [H.mix(fr[0], fr[2], 0.1), H.mix(fr[1], fr[3], 0.1), H.mix(fr[2], fr[0], 0.1), H.mix(fr[3], fr[1], 0.1)];
    var v = Math.floor(H.hash(s.x, s.y) * 3);
    H.poly(ctx, inn, ['#4a5a5e', '#5e5640', '#4a4048'][v]);
    ctx.fillStyle = ['rgba(60,80,60,0.8)', 'rgba(120,90,50,0.6)', 'rgba(150,140,120,0.5)'][v];   // a hill / a field / a face
    var lo = H.mix(inn[3], inn[2], 0.5), hi = H.mix(inn[0], inn[1], 0.5);
    ctx.beginPath(); ctx.moveTo(inn[3][0], inn[3][1]); ctx.quadraticCurveTo(lo[0] + (hi[0] - lo[0]) * 0.5, lo[1] + (hi[1] - lo[1]) * 0.7, inn[2][0], inn[2][1]); ctx.closePath(); ctx.fill();
    if (s.ruined) { ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; H.line(ctx, inn[0], inn[2]); }
  });
  A.furn('in_piano', function (ctx, s, c, H) {            // upright piano against the north wall, keys facing south
    var col = '#2a201a', body = { x: s.x, y: s.y, w: s.w, h: s.h * 0.55 };
    H.box(ctx, body, 0, s.k, c, col, '#3a2c22');
    var kb = { x: s.x + 6, y: s.y + s.h * 0.55, w: s.w - 12, h: s.h * 0.3 };
    var kt = H.box(ctx, kb, s.k * 0.5, s.k * 0.6, c, col, '#c8c2b0').t, i;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
    for (i = 1; i < 18; i++) H.line(ctx, H.mix(kt[0], kt[1], i / 18), H.mix(kt[3], kt[2], i / 18));
    ctx.fillStyle = '#141010';
    for (i = 1; i < 18; i++) if (i % 7 !== 3 && i % 7 !== 0) { var p = H.mix(H.mix(kt[0], kt[1], i / 18), H.mix(kt[3], kt[2], i / 18), 0.3); ctx.fillRect(p[0] - 1.5, p[1] - 3, 3, 6); }
    box2(H, ctx, { x: s.x + s.w * 0.3, y: s.y + s.h + 8, w: s.w * 0.4, h: 22 }, 0, s.k * 0.4, c, '#3a2c22');   // the stool
  });
  function box2(H, ctx, r, k0, k1, c, col) { return H.box(ctx, r, k0, k1, c, col); }

  // ---- bedrooms ----
  A.furn('in_bed', function (ctx, s, c, H) {              // double bed, head at the north, blanket and two pillows
    var col = s.color || '#6a5a7a', vert = s.h >= s.w;
    H.box(ctx, s, 0, s.k * 0.6, c, '#3a2e24', '#bab4a4');
    H.box(ctx, vert ? { x: s.x, y: s.y, w: s.w, h: 10 } : { x: s.x, y: s.y, w: 10, h: s.h }, s.k * 0.6, s.k * 1.5, c, '#3a2e24');   // headboard
    var bl = vert ? q(H, s, 0, 0.32, 1, 1, s.k * 0.66, c) : q(H, s, 0.32, 0, 1, 1, s.k * 0.66, c);
    H.poly(ctx, bl, H.tone(col, 0.9));
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1; H.line(ctx, H.mix(bl[0], bl[3], 0.2), H.mix(bl[1], bl[2], 0.25));
    [[0.08, 0.46], [0.54, 0.92]].forEach(function (p) {
      H.poly(ctx, vert ? q(H, s, p[0], 0.08, p[1], 0.26, s.k * 0.7, c) : q(H, s, 0.08, p[0], 0.26, p[1], s.k * 0.7, c), '#cfc8b6');
    });
  });
  A.furn('in_crib', function (ctx, s, c, H) {             // a baby cot with bars
    var b = H.box(ctx, s, 0, s.k * 0.35, c, '#8a8070', '#c4bca8'), i;
    H.poly(ctx, q(H, s, 0.1, 0.12, 0.9, 0.4, s.k * 0.38, c), '#d8d0bc');
    ctx.strokeStyle = '#a49a86'; ctx.lineWidth = 1.5;
    [[0, 1], [1, 2], [2, 3], [3, 0]].forEach(function (e) {
      var P = H.rectPts(s);
      for (i = 0; i <= 8; i++) {
        var x = P[e[0]][0] + (P[e[1]][0] - P[e[0]][0]) * i / 8, y = P[e[0]][1] + (P[e[1]][1] - P[e[0]][1]) * i / 8;
        H.line(ctx, H.lift(x, y, s.k * 0.35, c), H.lift(x, y, s.k, c));
      }
      ctx.lineWidth = 2.5; H.line(ctx, H.lift(P[e[0]][0], P[e[0]][1], s.k, c), H.lift(P[e[1]][0], P[e[1]][1], s.k, c)); ctx.lineWidth = 1.5;
    });
    void b;
  });
  A.furn('in_toybox', function (ctx, s, c, H) {           // painted chest with the lid open, a ball and blocks next to it
    var b = H.box(ctx, s, 0, s.k, c, s.color || '#5a7a8a', '#2a2420');
    ctx.strokeStyle = 'rgba(220,200,120,0.5)'; ctx.lineWidth = 2;
    if (b.vis[2]) H.line(ctx, H.onFace(s, 2, 0.05, s.k * 0.5, c), H.onFace(s, 2, 0.95, s.k * 0.5, c));
    H.poly(ctx, [b.t[0], b.t[1], H.lift(s.x + s.w, s.y - 6, s.k * 1.8, c), H.lift(s.x, s.y - 6, s.k * 1.8, c)], H.tone(s.color || '#5a7a8a', 0.7));   // the lid, open
    dot(ctx, H.lift(s.x + s.w + 14, s.y + s.h - 6, 0.012, c), 6, '#9a4a3a');
    ['#c0a040', '#4a7a5a', '#4a5a9a'].forEach(function (col, i) { H.box(ctx, { x: s.x - 22 + i * 9, y: s.y + s.h - 12 + (i % 2) * 6, w: 8, h: 8 }, 0, 0.008, c, col); });
  });
  A.furn('in_wardrobe', function (ctx, s, c, H) {
    var col = s.color || '#4e4032', b = H.box(ctx, s, 0, s.k, c, col), sd = front(b);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1;
    H.line(ctx, H.onFace(s, sd, 0.5, s.k * 0.04, c), H.onFace(s, sd, 0.5, s.k * 0.96, c));
    dot(ctx, H.onFace(s, sd, 0.45, s.k * 0.55, c), 1.6, '#a09070'); dot(ctx, H.onFace(s, sd, 0.55, s.k * 0.55, c), 1.6, '#a09070');
  });

  // ---- bathroom ----
  A.furn('in_tub', function (ctx, s, c, H) {              // white enamel tub, dark water stain inside
    var b = H.box(ctx, s, 0, s.k, c, '#9a9a90', '#b0b0a6');
    var inner = q(H, s, 0.1, 0.12, 0.9, 0.88, s.k, c);
    H.poly(ctx, inner, '#6e706a');
    var m = H.mix(H.mix(inner[0], inner[1], 0.5), H.mix(inner[3], inner[2], 0.5), 0.55);
    oval(ctx, m, s.w * 0.22, s.h * 0.12, 'rgba(70,60,40,0.55)');
    dot(ctx, H.mix(inner[0], inner[1], 0.5), 2.5, '#8a8a82'); void b;
  });
  A.furn('in_toilet', function (ctx, s, c, H) {           // cistern at the north, bowl in front
    H.box(ctx, { x: s.x, y: s.y, w: s.w, h: s.h * 0.35 }, 0, s.k, c, '#a2a29a', '#b4b4aa');
    var bowl = H.lift(s.x + s.w / 2, s.y + s.h * 0.66, s.k * 0.55, c), base = H.lift(s.x + s.w / 2, s.y + s.h * 0.66, 0, c);
    ctx.fillStyle = '#8a8a82'; ctx.fillRect(base[0] - s.w * 0.22, bowl[1], s.w * 0.44, base[1] - bowl[1]);
    oval(ctx, bowl, s.w * 0.4, s.h * 0.28, '#b0b0a6'); oval(ctx, bowl, s.w * 0.27, s.h * 0.17, '#4a4c46');
  });
  A.furn('in_sink', function (ctx, s, c, H) {             // a basin on a cabinet with a tap; s.color = cabinet
    var b = H.box(ctx, s, 0, s.k, c, s.color || '#8e8e86', '#a8a8a0');
    var bn = q(H, s, 0.2, 0.25, 0.8, 0.85, s.k, c);
    H.poly(ctx, bn, '#5a5c56');
    var tp = H.lift(s.x + s.w / 2, s.y + s.h * 0.12, s.k, c), tt = H.lift(s.x + s.w / 2, s.y + s.h * 0.3, s.k * 1.35, c);
    ctx.strokeStyle = '#7a7c78'; ctx.lineWidth = 3; H.line(ctx, tp, tt); void b;
    if (s.mirror) {                                                   // a mirror on the wall above it
      var r = { x: s.x + s.w * 0.2, y: s.y, w: s.w * 0.6, h: 2 };
      H.poly(ctx, [H.onFace(r, 0, 1, s.k * 1.5, c), H.onFace(r, 0, 0, s.k * 1.5, c), H.onFace(r, 0, 0, s.k * 2.5, c), H.onFace(r, 0, 1, s.k * 2.5, c)], 'rgba(120,140,145,0.55)', 'rgba(40,40,36,0.8)');
    }
  });
  A.furn('in_washer', function (ctx, s, c, H) {           // washing machine: white box, round door on the south face
    var b = H.box(ctx, s, 0, s.k, c, '#9c9c94', '#aeaea6'), sd = front(b);
    var d = H.onFace(s, sd, 0.5, s.k * 0.45, c);
    oval(ctx, d, s.w * 0.28, s.k * 140, '#3a3e3e'); oval(ctx, d, s.w * 0.2, s.k * 100, '#1c2224');
    facePanel(H, ctx, s, sd, 0.1, 0.9, s.k * 0.82, s.k * 0.94, c, 'rgba(60,60,56,0.6)');
  });

  // ---- kitchen / dining ----
  A.furn('in_stove', function (ctx, s, c, H) {            // cooker: four rings on top, an oven door
    var b = H.box(ctx, s, 0, s.k, c, '#7e7e76', '#3a3a36'), sd = front(b);
    [[0.28, 0.3], [0.72, 0.3], [0.28, 0.72], [0.72, 0.72]].forEach(function (p) {
      var pt = H.lift(s.x + s.w * p[0], s.y + s.h * p[1], s.k, c);
      ctx.strokeStyle = '#1a1a18'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(pt[0], pt[1], s.w * 0.15, s.h * 0.12, 0, 0, TAU); ctx.stroke();
    });
    facePanel(H, ctx, s, sd, 0.12, 0.88, s.k * 0.15, s.k * 0.7, c, '#262824', 'rgba(0,0,0,0.5)');
    if (s.pot) { var pp = H.lift(s.x + s.w * 0.28, s.y + s.h * 0.3, s.k, c); H.box(ctx, { x: s.x + s.w * 0.12, y: s.y + s.h * 0.12, w: s.w * 0.32, h: s.h * 0.34 }, s.k, s.k * 1.5, c, '#5a5a54', '#2a2a26'); void pp; }
  });
  A.furn('in_dtable', function (ctx, s, c, H) {           // dining table with plates and a jug
    var b = H.box(ctx, s, 0, s.k, c, s.color || '#5a4632');
    var n = Math.max(2, Math.round(s.w / 70)), i;
    for (i = 0; i < n; i++) {
      [0.25, 0.75].forEach(function (v) {
        var p = H.mix(H.mix(b.t[0], b.t[1], (i + 0.5) / n), H.mix(b.t[3], b.t[2], (i + 0.5) / n), v);
        oval(ctx, p, 8, 5, '#b4ae9e'); oval(ctx, p, 5, 3, '#9a9484');
      });
    }
    var j = H.mix(H.mix(b.t[0], b.t[1], 0.5), H.mix(b.t[3], b.t[2], 0.5), 0.5);
    ctx.fillStyle = '#6a7a80'; ctx.fillRect(j[0] - 3, j[1] - 9, 6, 9);
    if (s.cloth) H.poly(ctx, q(H, s, 0.05, 0.05, 0.95, 0.95, s.k + 0.0005, c), 'rgba(150,60,50,0.25)');
  });

  // ---- shops ----
  var GOODS = {
    grocery: ['#9a4a3a', '#c0a040', '#4a7a4a', '#a06a3a', '#6a8a9a', '#b0a080'],
    hardware: ['#6a6e70', '#8a5a3a', '#a08a40', '#4a5a4a', '#7a3a2a'],
    pharmacy: ['#c8c8be', '#6a9a9a', '#b4a0a0', '#9ab4a0', '#e0dcd0'],
    clothes: ['#4a4a6a', '#7a3a3a', '#3a5a4a', '#8a7a5a', '#5a4a5a', '#2a2e3a'],
    books: ['#6a3a30', '#3a4a5a', '#5a5a3a', '#7a6a4a']
  };
  A.furn('in_shelf', function (ctx, s, c, H) {            // gondola shelf: two levels of stock, gaps where it was looted
    var pal = GOODS[s.goods] || GOODS.grocery, col = s.color || '#5a5a54';
    var b = H.box(ctx, s, 0, s.k * 0.08, c, col), lv, i, horiz = s.w >= s.h;
    for (lv = 0; lv < 3; lv++) {
      var k0 = s.k * (0.08 + lv * 0.31), n = Math.floor((horiz ? s.w : s.h) / 22);
      if (lv) H.box(ctx, s, k0 - s.k * 0.03, k0, c, col);
      for (i = 0; i < n; i++) {
        var hv = H.hash(s.x + i * 3 + lv, s.y + lv * 11);
        if (hv < 0.35) continue;
        var u = (i + 0.15) / n, w = 0.7 / n;
        var r = horiz ? { x: s.x + s.w * u, y: s.y + 4 + (hv * 8 | 0), w: s.w * w, h: s.h - 10 } : { x: s.x + 4, y: s.y + s.h * u, w: s.w - 10, h: s.h * w };
        H.box(ctx, r, k0, k0 + s.k * (0.12 + hv * 0.12), c, pal[(i + lv) % pal.length]);
      }
    }
    H.box(ctx, s, s.k * 0.97, s.k, c, col); void b;
  });
  A.furn('in_clothesrack', function (ctx, s, c, H) {      // a rail on two posts with hanging clothes
    var horiz = s.w >= s.h, pal = GOODS.clothes, i;
    var a = horiz ? [s.x, s.y + s.h / 2] : [s.x + s.w / 2, s.y], e = horiz ? [s.x + s.w, s.y + s.h / 2] : [s.x + s.w / 2, s.y + s.h];
    ctx.strokeStyle = '#2a2c2a'; ctx.lineWidth = 2.5;
    H.line(ctx, H.lift(a[0], a[1], 0, c), H.lift(a[0], a[1], s.k, c)); H.line(ctx, H.lift(e[0], e[1], 0, c), H.lift(e[0], e[1], s.k, c));
    H.line(ctx, H.lift(a[0], a[1], s.k, c), H.lift(e[0], e[1], s.k, c));
    var n = Math.floor((horiz ? s.w : s.h) / 14);
    for (i = 1; i < n; i++) {
      if (H.hash(s.x + i, s.y) < 0.3) continue;
      var u = i / n, x = a[0] + (e[0] - a[0]) * u, y = a[1] + (e[1] - a[1]) * u;
      var r = horiz ? { x: x - 5, y: y - s.h * 0.45, w: 10, h: s.h * 0.9 } : { x: x - s.w * 0.45, y: y - 5, w: s.w * 0.9, h: 10 };
      H.box(ctx, r, s.k * 0.25, s.k * 0.95, c, pal[i % pal.length]);
    }
  });
  A.furn('in_mannequin', function (ctx, s, c, H) {        // a headless dummy on a stand, sometimes knocked over
    var m = H.lift(s.x + s.w / 2, s.y + s.h / 2, 0, c);
    if (s.ruined) { H.box(ctx, { x: s.x - 10, y: s.y + s.h * 0.3, w: s.w + 30, h: s.h * 0.4 }, 0, 0.012, c, '#a89a86'); return; }
    oval(ctx, m, 10, 5, '#2a2a28');
    var t0 = H.lift(s.x + s.w / 2, s.y + s.h / 2, s.k * 0.45, c), t1 = H.lift(s.x + s.w / 2, s.y + s.h / 2, s.k, c);
    ctx.strokeStyle = '#2a2a28'; ctx.lineWidth = 2; H.line(ctx, m, t0);
    ctx.fillStyle = s.color || '#6a3a3a'; ctx.beginPath(); ctx.moveTo(t0[0] - 7, t0[1]); ctx.lineTo(t0[0] + 7, t0[1]); ctx.lineTo(t1[0] + 10, t1[1]); ctx.lineTo(t1[0] - 10, t1[1]); ctx.closePath(); ctx.fill();
    oval(ctx, t1, 10, 4, '#a89a86');
  });
  A.furn('in_register', function (ctx, s, c, H) {         // checkout counter with a till and a conveyor strip
    var b = H.box(ctx, s, 0, s.k, c, s.color || '#3f3b35');
    H.poly(ctx, q(H, s, 0.05, 0.25, 0.6, 0.75, s.k + 0.0005, c), '#1e1e1c');
    H.box(ctx, { x: s.x + s.w * 0.7, y: s.y + 6, w: s.w * 0.22, h: s.h - 14 }, s.k, s.k * 1.35, c, '#2e302e', '#3e403c');
    if (b.vis[2]) facePanel(H, ctx, { x: s.x + s.w * 0.7, y: s.y + 6, w: s.w * 0.22, h: s.h - 14 }, 2, 0.1, 0.9, s.k * 1.1, s.k * 1.3, c, 'rgba(70,90,80,0.4)');
  });
  A.furn('in_toolwall', function (ctx, s, c, H) {         // pegboard on the north wall with hanging tools (not solid; put a bench under it)
    var r = { x: s.x, y: s.y, w: s.w, h: 2 }, i;
    H.poly(ctx, [H.onFace(r, 0, 1, s.k * 0.35, c), H.onFace(r, 0, 0, s.k * 0.35, c), H.onFace(r, 0, 0, s.k, c), H.onFace(r, 0, 1, s.k, c)], '#6a5a40');
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (i = 0; i < s.w / 12; i++) for (var j = 0; j < 4; j++) { var p = H.onFace(r, 0, 1 - i * 12 / s.w, s.k * (0.42 + j * 0.15), c); ctx.fillRect(p[0], p[1], 1.5, 1.5); }
    ctx.strokeStyle = '#2a2c2c'; ctx.lineWidth = 3;
    for (i = 0; i < s.w / 34; i++) {
      if (H.hash(s.x, i) < 0.3) continue;                                // an empty outline where a tool was taken
      var u = 1 - (i + 0.5) * 34 / s.w, t0 = H.onFace(r, 0, u, s.k * 0.9, c), t1 = H.onFace(r, 0, u, s.k * 0.5, c);
      H.line(ctx, t0, t1); if (i % 2) { ctx.lineWidth = 6; H.line(ctx, t1, H.onFace(r, 0, u, s.k * 0.57, c)); ctx.lineWidth = 3; }
    }
  });
  A.furn('in_workbench', function (ctx, s, c, H) {        // heavy bench: worn top, a vice, scattered tools
    var b = H.box(ctx, s, 0, s.k, c, '#4a3e2e', '#6a5a42');
    H.box(ctx, { x: s.x + s.w - 34, y: s.y + s.h - 22, w: 26, h: 18 }, s.k, s.k * 1.4, c, '#3a4a4a');
    ctx.strokeStyle = '#2a2c2c'; ctx.lineWidth = 3;
    var a = H.mix(H.mix(b.t[0], b.t[1], 0.2), H.mix(b.t[3], b.t[2], 0.2), 0.4); H.line(ctx, a, [a[0] + 22, a[1] + 4]);
    ctx.strokeStyle = '#7a3a2a'; ctx.lineWidth = 4; var h = H.mix(H.mix(b.t[0], b.t[1], 0.5), H.mix(b.t[3], b.t[2], 0.5), 0.6); H.line(ctx, h, [h[0] + 16, h[1] - 3]);
    oval(ctx, H.mix(H.mix(b.t[0], b.t[1], 0.35), H.mix(b.t[3], b.t[2], 0.35), 0.7), 9, 4, 'rgba(20,16,10,0.4)');   // an oil stain
  });

  // ---- offices ----
  A.furn('in_server', function (ctx, s, c, H) {           // server rack: dark cabinet, rows of units with a few lights still blinking
    var b = H.box(ctx, s, 0, s.k, c, '#22262a', '#2a2e32'), sd = front(b), i;
    for (i = 0; i < 9; i++) {
      var f0 = s.k * (0.06 + i * 0.1);
      facePanel(H, ctx, s, sd, 0.08, 0.92, f0, f0 + s.k * 0.08, c, '#16191c', 'rgba(70,80,90,0.25)');
      if (H.hash(s.x + i, s.y) < 0.4) dot(ctx, H.onFace(s, sd, 0.85, f0 + s.k * 0.04, c), 1.3, H.hash(i, s.x) < 0.5 ? 'rgba(90,170,110,0.8)' : 'rgba(190,140,60,0.8)');
    }
  });
  A.furn('in_archive', function (ctx, s, c, H) {          // archive shelving full of document boxes
    var col = '#5a5e5a', b = H.box(ctx, s, 0, s.k * 0.05, c, col), lv, i, horiz = s.w >= s.h;
    for (lv = 0; lv < 4; lv++) {
      var k0 = s.k * (0.05 + lv * 0.235), n = Math.floor((horiz ? s.w : s.h) / 30);
      if (lv) H.box(ctx, s, k0 - s.k * 0.02, k0, c, col);
      for (i = 0; i < n; i++) {
        if (H.hash(s.x + i, lv + s.y) < 0.18) continue;
        var u = (i + 0.08) / n, w = 0.86 / n;
        var r = horiz ? { x: s.x + s.w * u, y: s.y + 3, w: s.w * w, h: s.h - 6 } : { x: s.x + 3, y: s.y + s.h * u, w: s.w - 6, h: s.h * w };
        H.box(ctx, r, k0, k0 + s.k * 0.17, c, H.hash(i, lv) < 0.7 ? '#8a7a5a' : '#6a7480');
      }
    }
    H.box(ctx, s, s.k * 0.97, s.k, c, col); void b;
  });
  A.furn('in_copier', function (ctx, s, c, H) {
    var b = H.box(ctx, s, 0, s.k, c, '#8a8a84', '#6a6c68');
    H.poly(ctx, q(H, s, 0.1, 0.15, 0.6, 0.85, s.k + 0.0005, c), '#2a3034');
    H.box(ctx, { x: s.x + s.w * 0.66, y: s.y + s.h * 0.2, w: s.w * 0.28, h: s.h * 0.6 }, s.k, s.k * 1.1, c, '#9a9a94'); void b;
  });
  A.furn('in_whiteboard', function (ctx, s, c, H) {       // on the north wall, smeared marker lines (not solid)
    var r = { x: s.x, y: s.y, w: s.w, h: 2 };
    var p = [H.onFace(r, 0, 1, s.k * 0.4, c), H.onFace(r, 0, 0, s.k * 0.4, c), H.onFace(r, 0, 0, s.k, c), H.onFace(r, 0, 1, s.k, c)];
    H.poly(ctx, p, '#b0b2aa', '#4a4c48');
    ctx.strokeStyle = 'rgba(40,60,110,0.5)'; ctx.lineWidth = 1.5;
    for (var i = 0; i < 4; i++) H.line(ctx, H.mix(H.mix(p[1], p[2], 0.2 + i * 0.17), H.mix(p[0], p[3], 0.2 + i * 0.17), 0.1), H.mix(H.mix(p[1], p[2], 0.2 + i * 0.17), H.mix(p[0], p[3], 0.2 + i * 0.17), 0.3 + H.hash(i, s.x) * 0.5));
  });

  // ---- wreckage ----
  A.furn('in_beam', function (ctx, s, c, H) {             // a fallen roof beam, one end higher, splintered
    var horiz = s.w >= s.h, k = s.k;
    var pts = horiz ? [[s.x, s.y], [s.x + s.w, s.y + 4], [s.x + s.w, s.y + s.h + 4], [s.x, s.y + s.h]] : [[s.x, s.y], [s.x + s.w, s.y], [s.x + s.w + 4, s.y + s.h], [s.x + 4, s.y + s.h]];
    H.prism(ctx, pts, 0, k, c, function (i, f) { return H.tone('#5a4630', f * 0.56); }, '#6e5638');
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
    var t = pts.map(function (p) { return H.lift(p[0], p[1], k, c); });
    H.line(ctx, H.mix(t[0], t[3], 0.5), H.mix(t[1], t[2], 0.5));
  });
  A.furn('in_debris', function (ctx, s, c, H) {           // low heap of broken plaster, bricks and planks (walkable around, solid)
    var i, cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    oval(ctx, H.lift(cx, cy, 0, c), s.w * 0.55, s.h * 0.5, 'rgba(30,28,24,0.5)');
    for (i = 0; i < 16; i++) {
      var a = H.hash(s.x, i) * TAU, d = Math.sqrt(H.hash(i, s.y)) * 0.42, w = 10 + H.hash(i, i + s.x) * 22;
      var x = cx + Math.cos(a) * s.w * d - w / 2, y = cy + Math.sin(a) * s.h * d - 6;
      var col = ['#7a7468', '#6a4a3a', '#8a847a', '#5a4630'][i % 4];
      H.box(ctx, { x: x, y: y, w: w, h: 6 + (i % 3) * 4 }, 0, s.k * (0.3 + (1 - d * 2) * 0.7), c, col);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
