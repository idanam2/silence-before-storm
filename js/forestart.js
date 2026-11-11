// Forest rendering. Everything is drawn in code: sprites are painted once on offscreen canvases
// (at device pixel ratio) and then blitted every frame, so the frame cost stays low and steady.
(function (root) {
  'use strict';
  var G = root.G, TAU = Math.PI * 2;
  var S = 1;                 // sprite scale (device pixel ratio)
  var SP = null;             // sprite library
  var groundTile = null, groundPattern = null;
  var terrains = {};         // per-area prerendered terrain: macro overlay, pond sprites, decor

  function hsl(h, s, l, a) {
    return 'hsla(' + h.toFixed(0) + ',' + s.toFixed(0) + '%,' + l.toFixed(1) + '%,' + (a === undefined ? 1 : a) + ')';
  }

  function mk(w, h, fn, scale) {
    var s = scale || S, c = document.createElement('canvas');
    c.width = Math.ceil(w * s); c.height = Math.ceil(h * s);
    var g = c.getContext('2d');
    g.scale(s, s); g.translate(w / 2, h / 2);
    g.lineCap = 'round'; g.lineJoin = 'round';
    fn(g);
    return { c: c, w: w, h: h };
  }
  function blit(ctx, sp, x, y, k) {
    var w = sp.w * (k || 1), h = sp.h * (k || 1);
    ctx.drawImage(sp.c, x - w / 2, y - h / 2, w, h);
  }

  function softShadow(g, x, y, rx, ry, a) {
    g.save(); g.translate(x, y); g.scale(1, ry / rx);
    var gr = g.createRadialGradient(0, 0, rx * 0.15, 0, 0, rx);
    gr.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill();
    g.restore();
  }

  // Light from the north-west over whatever is already painted.
  function shade(g, R, strong) {
    g.globalCompositeOperation = 'source-atop';
    var gr = g.createRadialGradient(-R * 0.38, -R * 0.42, R * 0.08, 0, 0, R * 1.12);
    gr.addColorStop(0, 'rgba(220,228,190,' + (strong ? 0.2 : 0.13) + ')');
    gr.addColorStop(0.5, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = gr; g.fillRect(-R * 1.4, -R * 1.4, R * 2.8, R * 2.8);
    g.globalCompositeOperation = 'source-over';
  }

  // ---- trees ------------------------------------------------------------------------------------

  function drawPine(g, R, rand) {
    var hue = 146 + rand() * 14;
    for (var k = 0; k < 5; k++) {
      var r = R * (1 - k * 0.19), n = 14 - k + Math.floor(rand() * 3), rot = rand() * TAU, L = 12 + k * 4.4;
      var tips = [], i;
      g.fillStyle = hsl(hue, 24 - k * 1.5, L);
      g.beginPath();
      for (i = 0; i < n * 2; i++) {
        var a = rot + i / (n * 2) * TAU;
        var rr = i % 2 === 0 ? r * (0.9 + rand() * 0.12) : r * (0.6 + rand() * 0.1);
        if (i % 2 === 0) tips.push([a, rr]);
        g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath(); g.fill();
      g.strokeStyle = hsl(hue - 6, 18, L + 8, 0.55); g.lineWidth = 1.1;     // needle ridges
      g.beginPath();
      for (i = 0; i < tips.length; i++) {
        var ta = tips[i][0], tr = tips[i][1];
        g.moveTo(Math.cos(ta) * tr * 0.42, Math.sin(ta) * tr * 0.42);
        g.lineTo(Math.cos(ta) * tr * 0.9, Math.sin(ta) * tr * 0.9);
      }
      g.stroke();
    }
    shade(g, R);
  }

  function drawOak(g, R, rand, autumn) {
    var hue = autumn ? 38 + rand() * 10 : 92 + rand() * 30, sat = autumn ? 22 : 20;
    var passes = [
      { n: 12, dist: 0.55, r: 0.36, L: 11 },
      { n: 10, dist: 0.4, r: 0.33, L: 15.5 },
      { n: 7, dist: 0.24, r: 0.29, L: 20 },
      { n: 6, dist: 0.3, r: 0.15, L: 25 }
    ];
    var i, k;
    for (k = 0; k < passes.length; k++) {
      var P = passes[k], rot = rand() * TAU;
      for (i = 0; i < P.n; i++) {
        var a = rot + i / P.n * TAU + rand() * 0.4, d = R * P.dist * (0.8 + rand() * 0.4);
        var x = Math.cos(a) * d - (k === 3 ? R * 0.14 : 0), y = Math.sin(a) * d - (k === 3 ? R * 0.16 : 0);
        g.fillStyle = hsl(hue + rand() * 8, sat, P.L + rand() * 2);
        g.beginPath(); g.arc(x, y, R * P.r * (0.85 + rand() * 0.3), 0, TAU); g.fill();
      }
    }
    for (i = 0; i < 150; i++) {                                              // leaf texture
      var la = rand() * TAU, ld = Math.sqrt(rand()) * R * 0.86;
      g.fillStyle = rand() < 0.5 ? hsl(hue, sat, 30, 0.35) : 'rgba(0,0,0,0.22)';
      g.beginPath(); g.ellipse(Math.cos(la) * ld, Math.sin(la) * ld, 2.4, 1.3, rand() * 3, 0, TAU); g.fill();
    }
    shade(g, R, true);
  }

  function drawDead(g, R, rand) {
    var segs = [];
    function branch(x, y, a, len, w, depth) {
      var mx = x + Math.cos(a + 0.18) * len * 0.5, my = y + Math.sin(a + 0.18) * len * 0.5;
      var ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      segs.push([x, y, mx, my, ex, ey, w]);
      if (depth <= 0) return;
      var kids = 2 + (rand() < 0.4 ? 1 : 0);
      for (var i = 0; i < kids; i++) {
        var t = 0.45 + rand() * 0.55;
        branch(x + (ex - x) * t, y + (ey - y) * t, a + (rand() < 0.5 ? -1 : 1) * (0.35 + rand() * 0.6), len * (0.5 + rand() * 0.2), w * 0.6, depth - 1);
      }
    }
    var n = 6 + Math.floor(rand() * 2), rot = rand() * TAU, i;
    for (i = 0; i < n; i++) branch(0, 0, rot + i / n * TAU + rand() * 0.4, R * (0.42 + rand() * 0.18), 7, 2);
    function pass(color, extra, ox, oy) {
      g.strokeStyle = color;
      for (var j = 0; j < segs.length; j++) {
        var s = segs[j];
        g.lineWidth = Math.max(1, s[6] + extra);
        g.beginPath(); g.moveTo(s[0] + ox, s[1] + oy); g.quadraticCurveTo(s[2] + ox, s[3] + oy, s[4] + ox, s[5] + oy); g.stroke();
      }
    }
    pass('#1b1814', 2.4, 0, 0);
    pass('#473f35', 0, 0, 0);
    pass('rgba(150,138,112,0.4)', -3.4, -0.8, -0.8);
    g.fillStyle = '#3a332b'; g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill();
    g.strokeStyle = '#1b1814'; g.lineWidth = 1.5; g.stroke();
  }

  function drawStump(g, r, grey) {
    softShadow(g, 4, 5, r * 1.7, r * 1.5, 0.5);
    g.fillStyle = grey ? '#2b2823' : '#2c241b';                               // root flare
    for (var i = 0; i < 7; i++) {
      var a = i / 7 * TAU + 0.3;
      g.beginPath(); g.ellipse(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85, r * 0.5, r * 0.3, a, 0, TAU); g.fill();
    }
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    var gr = g.createRadialGradient(-r * 0.25, -r * 0.3, 1, 0, 0, r * 0.82);
    gr.addColorStop(0, grey ? '#8f8876' : '#a38a64'); gr.addColorStop(1, grey ? '#5c574c' : '#6a5539');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 0.8, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(52,38,24,0.55)'; g.lineWidth = 1;
    [0.22, 0.42, 0.62].forEach(function (f) { g.beginPath(); g.arc(-1, -1, r * f, 0, TAU); g.stroke(); });
    g.beginPath(); g.moveTo(-1, -1); g.lineTo(r * 0.6, r * 0.35); g.stroke();
  }

  function drawTrunk(g, r) {
    var gr = g.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
    gr.addColorStop(0, '#4a3d2e'); gr.addColorStop(1, '#1f1912');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.strokeStyle = '#120e0a'; g.lineWidth = 1.5; g.stroke();
  }

  // ---- rocks ------------------------------------------------------------------------------------

  function facetRock(g, cx, cy, r, rand, moss) {
    var n = 7 + Math.floor(rand() * 3), pts = [], i;
    for (i = 0; i < n; i++) {
      var a = i / n * TAU + rand() * 0.45, rad = r * (0.8 + rand() * 0.28);
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
    function outline() {
      g.beginPath();
      for (var j = 0; j < n; j++) g[j ? 'lineTo' : 'moveTo'](pts[j][0], pts[j][1]);
      g.closePath();
    }
    var tx = cx - r * 0.2, ty = cy - r * 0.24;
    for (i = 0; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n];
      var mx = (p[0] + q[0]) / 2 - cx, my = (p[1] + q[1]) / 2 - cy, ml = Math.sqrt(mx * mx + my * my) || 1;
      var light = (mx / ml) * -0.6 + (my / ml) * -0.8;
      g.fillStyle = hsl(155, 5, 27 + light * 11 + rand() * 3);
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1; g.stroke();
    }
    g.fillStyle = hsl(150, 5, 40);                                            // flat top catches the light
    g.beginPath();
    for (i = 0; i < n; i++) g[i ? 'lineTo' : 'moveTo'](tx + (pts[i][0] - tx) * 0.42, ty + (pts[i][1] - ty) * 0.42);
    g.closePath(); g.fill();
    if (moss) {
      g.save(); outline(); g.clip();
      for (i = 0; i < 5; i++) {
        var ma = -2.4 + rand() * 1.5, md = r * (0.55 + rand() * 0.4);
        g.fillStyle = hsl(100 + rand() * 20, 26, 17 + rand() * 5, 0.9);
        g.beginPath(); g.arc(cx + Math.cos(ma) * md, cy + Math.sin(ma) * md, r * (0.18 + rand() * 0.2), 0, TAU); g.fill();
      }
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1;                     // crack
      g.beginPath(); g.moveTo(cx + r * 0.1, cy - r * 0.1); g.lineTo(cx + r * 0.35, cy + r * 0.25); g.lineTo(cx + r * 0.3, cy + r * 0.6); g.stroke();
      g.restore();
    }
    outline(); g.strokeStyle = '#161917'; g.lineWidth = 1.6; g.stroke();
  }

  function drawBoulder(g, r, rand) {
    softShadow(g, 14, 17, r * 1.5, r * 1.2, 0.6);
    softShadow(g, 2, 4, r * 1.2, r * 1.1, 0.5);                               // contact shadow
    g.fillStyle = '#121513';                                                  // side face toward the viewer
    g.beginPath(); g.ellipse(2, 7, r * 0.98, r * 0.9, 0, 0, TAU); g.fill();
    g.fillStyle = '#1f2421';
    g.beginPath(); g.ellipse(1, 4, r * 0.98, r * 0.92, 0, 0, TAU); g.fill();
    g.translate(-1, -4);
    facetRock(g, 0, 0, r * 0.95, rand, true);
  }

  function drawStones(g, rand) {
    var n = 4 + Math.floor(rand() * 3);
    for (var i = 0; i < n; i++) {
      var a = i / n * TAU + rand(), d = i === 0 ? 0 : 7 + rand() * 7, r = 5 + rand() * 4.5;
      var x = Math.cos(a) * d, y = Math.sin(a) * d;
      softShadow(g, x + 4, y + 5, r * 1.7, r * 1.4, 0.55);
      g.fillStyle = '#141715'; g.beginPath(); g.ellipse(x + 0.5, y + 2.2, r * 0.95, r * 0.9, 0, 0, TAU); g.fill();
      facetRock(g, x, y - 1, r * 0.95, rand, false);
    }
  }

  // ---- small resources --------------------------------------------------------------------------

  function drawBranches(g, rand) {
    var n = 4 + Math.floor(rand() * 3), sticks = [], i;
    for (i = 0; i < n; i++) {
      var a = rand() * Math.PI, len = 13 + rand() * 9, ox = (rand() - 0.5) * 12, oy = (rand() - 0.5) * 12;
      sticks.push([ox - Math.cos(a) * len, oy - Math.sin(a) * len, ox + Math.cos(a) * len, oy + Math.sin(a) * len, 3.4 + rand() * 1.8, a]);
    }
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    for (i = 0; i < n; i++) { g.lineWidth = sticks[i][4] + 2; g.beginPath(); g.moveTo(sticks[i][0] + 2, sticks[i][1] + 3); g.lineTo(sticks[i][2] + 2, sticks[i][3] + 3); g.stroke(); }
    for (i = 0; i < n; i++) {
      var s = sticks[i];
      g.strokeStyle = '#201910'; g.lineWidth = s[4] + 1.6; g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); g.stroke();
      g.strokeStyle = hsl(30, 24, 26 + rand() * 6); g.lineWidth = s[4]; g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); g.stroke();
      g.strokeStyle = 'rgba(190,165,120,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(s[0], s[1] - 1); g.lineTo(s[2], s[3] - 1); g.stroke();
      var t = 0.3 + rand() * 0.4, bx = s[0] + (s[2] - s[0]) * t, by = s[1] + (s[3] - s[1]) * t, ba = s[5] + 0.8;   // twig
      g.strokeStyle = hsl(30, 22, 24); g.lineWidth = 1.6; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(ba) * 8, by + Math.sin(ba) * 8); g.stroke();
    }
  }

  var CAPS = [
    { h: 26, s: 32, l: 36, spots: false },      // brown
    { h: 40, s: 24, l: 58, spots: false },      // pale
    { h: 8,  s: 40, l: 33, spots: true },       // rust with pale spots
    { h: 32, s: 30, l: 44, spots: true }
  ];
  function drawMushrooms(g, rand, cap) {
    var n = 4 + Math.floor(rand() * 4);
    for (var i = 0; i < n; i++) {
      var a = rand() * TAU, d = i === 0 ? 0 : 5 + rand() * 9, r = i === 0 ? 7.5 : 3.5 + rand() * 4;
      var x = Math.cos(a) * d, y = Math.sin(a) * d;
      softShadow(g, x + 2, y + 3, r * 1.5, r * 1.3, 0.55);
      g.fillStyle = '#b9ae94'; g.beginPath(); g.ellipse(x + 1.5, y + 2, r * 0.45, r * 0.45, 0, 0, TAU); g.fill();   // stem peeking out
      var gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, 0.5, x, y, r);
      gr.addColorStop(0, hsl(cap.h, cap.s, cap.l + 13)); gr.addColorStop(0.7, hsl(cap.h, cap.s, cap.l)); gr.addColorStop(1, hsl(cap.h, cap.s, cap.l - 12));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(15,10,6,0.7)'; g.lineWidth = 1; g.stroke();
      g.strokeStyle = 'rgba(235,225,200,0.25)'; g.lineWidth = 1;
      g.beginPath(); g.arc(x, y, r - 1.5, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
      if (cap.spots && r > 4.5) {
        g.fillStyle = 'rgba(230,220,195,0.7)';
        for (var k = 0; k < 4; k++) { var sa = rand() * TAU, sd = rand() * r * 0.6; g.beginPath(); g.arc(x + Math.cos(sa) * sd, y + Math.sin(sa) * sd, 0.9 + rand() * 0.6, 0, TAU); g.fill(); }
      }
    }
  }

  function drawLog(g, rand, angle) {
    var len = 78 + rand() * 16, w = 19;
    g.rotate(angle);
    g.save(); g.rotate(-angle); softShadow(g, 5, 7, len * 0.62, 26, 0.5); g.restore();
    function body() {
      g.beginPath();
      g.moveTo(-len / 2 + 6, -w / 2); g.lineTo(len / 2 - 6, -w / 2 + 1);
      g.quadraticCurveTo(len / 2 + 2, 0, len / 2 - 6, w / 2 - 1);
      g.lineTo(-len / 2 + 6, w / 2); g.quadraticCurveTo(-len / 2 - 2, 0, -len / 2 + 6, -w / 2);
      g.closePath();
    }
    var gr = g.createLinearGradient(0, -w / 2, 0, w / 2);
    gr.addColorStop(0, '#2a2118'); gr.addColorStop(0.3, '#5e4c37'); gr.addColorStop(0.55, '#4a3b2a'); gr.addColorStop(1, '#1c1610');
    g.fillStyle = gr; body(); g.fill();
    g.save(); body(); g.clip();
    g.strokeStyle = 'rgba(18,13,8,0.6)'; g.lineWidth = 1;
    var i;
    for (i = 0; i < 16; i++) { var x = -len / 2 + rand() * len, y = -w / 2 + rand() * w, l = 5 + rand() * 12; g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (rand() - 0.5) * 1.5); g.stroke(); }
    for (i = 0; i < 5; i++) {                                                 // moss
      g.fillStyle = hsl(98 + rand() * 20, 28, 18 + rand() * 5, 0.9);
      g.beginPath(); g.ellipse(-len / 2 + rand() * len, -w / 2 + rand() * 5, 5 + rand() * 7, 3 + rand() * 3, 0, 0, TAU); g.fill();
    }
    g.restore();
    body(); g.strokeStyle = '#120e0a'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#93805e'; g.beginPath(); g.ellipse(len / 2 - 5, 0, 4.5, w / 2 - 2, 0, 0, TAU); g.fill();     // cut end
    g.strokeStyle = 'rgba(60,45,28,0.7)'; g.lineWidth = 1; g.beginPath(); g.ellipse(len / 2 - 5, 0, 2.2, w / 4, 0, 0, TAU); g.stroke();
    g.fillStyle = '#3a2e21'; g.beginPath(); g.arc(-len * 0.12, -w / 2 - 2, 3.5, 0, TAU); g.fill();              // broken branch
    g.strokeStyle = '#120e0a'; g.stroke();
  }

  // ---- ground decor -----------------------------------------------------------------------------

  function drawGrass(g, rand) {
    var n = 5 + Math.floor(rand() * 5);
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + (rand() - 0.5) * 2.6, len = 6 + rand() * 8, bx = (rand() - 0.5) * 7, by = (rand() - 0.5) * 4;
      g.strokeStyle = hsl(92 + rand() * 30, 20 + rand() * 8, 17 + rand() * 9); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(bx, by);
      g.quadraticCurveTo(bx + Math.cos(a) * len * 0.5, by + Math.sin(a) * len * 0.7, bx + Math.cos(a) * len + (rand() - 0.5) * 4, by + Math.sin(a) * len);
      g.stroke();
    }
  }
  function drawFern(g, rand) {
    var n = 7 + Math.floor(rand() * 3), rot = rand() * TAU, hue = 104 + rand() * 20;
    softShadow(g, 3, 4, 26, 22, 0.35);
    for (var i = 0; i < n; i++) {
      var a = rot + i / n * TAU + rand() * 0.3, len = 18 + rand() * 9, bend = (rand() - 0.5) * 0.5;
      var ex = Math.cos(a + bend) * len, ey = Math.sin(a + bend) * len;
      g.strokeStyle = hsl(hue, 24, 15 + rand() * 3); g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(ex, ey); g.stroke();
      g.strokeStyle = hsl(hue, 26, 21 + rand() * 7); g.lineWidth = 1.7;
      for (var t = 0.25; t < 1; t += 0.14) {
        var px = ex * t, py = ey * t, ll = (1 - t) * 7.5 + 1.5;
        for (var sd = -1; sd <= 1; sd += 2) {
          var la = a + bend + sd * 1.05;
          g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(la) * ll, py + Math.sin(la) * ll); g.stroke();
        }
      }
    }
  }
  function drawBush(g, R, rand) {
    softShadow(g, 5, 7, R * 1.25, R * 1.1, 0.45);
    var hue = 100 + rand() * 26, i;
    for (var k = 0; k < 3; k++) {
      var n = 9 - k * 2;
      for (i = 0; i < n; i++) {
        var a = rand() * TAU, d = R * (0.55 - k * 0.2) * (0.6 + rand() * 0.5);
        g.fillStyle = hsl(hue + rand() * 8, 22, 12 + k * 4.5 + rand() * 2);
        g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, R * (0.36 - k * 0.06), 0, TAU); g.fill();
      }
    }
    for (i = 0; i < 40; i++) {
      var la = rand() * TAU, ld = Math.sqrt(rand()) * R * 0.8;
      g.fillStyle = rand() < 0.5 ? hsl(hue, 24, 27, 0.4) : 'rgba(0,0,0,0.25)';
      g.beginPath(); g.ellipse(Math.cos(la) * ld, Math.sin(la) * ld, 2, 1.1, rand() * 3, 0, TAU); g.fill();
    }
    if (rand() < 0.6) {                                                       // a few dull berries
      g.fillStyle = '#6a3a38';
      for (i = 0; i < 6; i++) { var ba = rand() * TAU, bd = rand() * R * 0.7; g.beginPath(); g.arc(Math.cos(ba) * bd, Math.sin(ba) * bd, 1.5, 0, TAU); g.fill(); }
    }
    shade(g, R);
  }
  function drawLeaves(g, rand) {
    var n = 5 + Math.floor(rand() * 6);
    for (var i = 0; i < n; i++) {
      g.fillStyle = hsl(28 + rand() * 22, 26 + rand() * 12, 15 + rand() * 9, 0.85);
      g.beginPath(); g.ellipse((rand() - 0.5) * 30, (rand() - 0.5) * 30, 3.4 + rand() * 1.6, 1.7 + rand() * 0.6, rand() * Math.PI, 0, TAU); g.fill();
    }
  }
  function drawPebbles(g, rand) {
    var n = 3 + Math.floor(rand() * 4);
    for (var i = 0; i < n; i++) {
      var x = (rand() - 0.5) * 22, y = (rand() - 0.5) * 22, r = 1.6 + rand() * 2.4;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x + 1, y + 1.5, r, r * 0.8, 0, 0, TAU); g.fill();
      g.fillStyle = hsl(150, 4, 26 + rand() * 10); g.beginPath(); g.ellipse(x, y, r, r * 0.8, rand() * 3, 0, TAU); g.fill();
    }
  }
  function drawFlowers(g, rand) {
    var n = 3 + Math.floor(rand() * 4), col = rand() < 0.5 ? [52, 20, 56] : [262, 12, 54];
    for (var i = 0; i < n; i++) {
      var x = (rand() - 0.5) * 22, y = (rand() - 0.5) * 22;
      g.fillStyle = hsl(col[0], col[1], col[2], 0.75);
      for (var p = 0; p < 5; p++) { var a = p / 5 * TAU; g.beginPath(); g.arc(x + Math.cos(a) * 1.7, y + Math.sin(a) * 1.7, 1.1, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(120,96,50,0.9)'; g.beginPath(); g.arc(x, y, 0.9, 0, TAU); g.fill();
    }
  }

  function variants(n, seed, make) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(make(G.util.rng(seed + i * 101), i));
    return out;
  }

  // Lower crown layer (darker copy) and a soft shadow shaped like the crown itself.
  function treeExtras(list, lower) {
    list.forEach(function (sp) {
      if (lower) {
        sp.dark = mk(sp.w, sp.h, function (g) {
          g.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
          g.globalCompositeOperation = 'source-atop';
          g.fillStyle = 'rgba(4,8,6,0.5)'; g.fillRect(-sp.w / 2, -sp.h / 2, sp.w, sp.h);
        });
      }
      var pad = 40;
      sp.shadow = mk(sp.w + pad * 2, sp.h + pad * 2, function (g) {
        try { g.filter = 'blur(9px)'; } catch (e) { /* sharp silhouette */ }
        g.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
        g.filter = 'none';
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = '#000'; g.fillRect(-sp.w, -sp.h, sp.w * 2, sp.h * 2);
      }, 0.5);
    });
  }

  function buildSprites() {
    SP = {
      pine: variants(3, 11, function (r) { return mk(232, 232, function (g) { drawPine(g, 100, r); }); }),
      oak: variants(5, 23, function (r, i) { return mk(240, 240, function (g) { drawOak(g, 100, r, i === 4); }); }),
      dead_tree: variants(2, 37, function (r) { return mk(220, 220, function (g) { drawDead(g, 100, r); }); }),
      canopyShadow: mk(256, 256, function (g) { softShadow(g, 0, 0, 126, 126, 0.62); }, 0.5),
      stump: { pine: mk(64, 64, function (g) { drawStump(g, 14); }), oak: mk(72, 72, function (g) { drawStump(g, 16); }), dead_tree: mk(56, 56, function (g) { drawStump(g, 11, true); }) },
      trunk: mk(40, 40, function (g) { drawTrunk(g, 15); }),
      boulder: variants(4, 51, function (r) { return mk(124, 124, function (g) { drawBoulder(g, 34, r); }); }),
      stones: variants(3, 67, function (r) { return mk(64, 64, function (g) { drawStones(g, r); }); }),
      branches: variants(3, 79, function (r) { return mk(76, 76, function (g) { drawBranches(g, r); }); }),
      mushrooms: variants(4, 91, function (r, i) { return mk(52, 52, function (g) { drawMushrooms(g, r, CAPS[i]); }); }),
      log: variants(4, 103, function (r, i) { return mk(150, 150, function (g) { drawLog(g, r, [0.25, -0.5, 1.2, 2.1][i]); }); }),
      grass: variants(6, 127, function (r) { return mk(36, 36, function (g) { drawGrass(g, r); }); }),
      fern: variants(3, 139, function (r) { return mk(76, 76, function (g) { drawFern(g, r); }); }),
      bush: variants(3, 151, function (r) { return mk(104, 104, function (g) { drawBush(g, 34, r); }); }),
      leaves: variants(4, 163, function (r) { return mk(44, 44, function (g) { drawLeaves(g, r); }); }),
      pebbles: variants(3, 173, function (r) { return mk(34, 34, function (g) { drawPebbles(g, r); }); }),
      flowers: variants(3, 181, function (r) { return mk(34, 34, function (g) { drawFlowers(g, r); }); }),
      mist: mk(512, 512, function (g) {
        var gr = g.createRadialGradient(0, 0, 0, 0, 0, 250);
        gr.addColorStop(0, 'rgba(170,185,175,1)'); gr.addColorStop(1, 'rgba(170,185,175,0)');
        g.fillStyle = gr; g.fillRect(-256, -256, 512, 512);
      }, 0.25)
    };
    treeExtras(SP.pine, true); treeExtras(SP.oak, true); treeExtras(SP.dead_tree, false);
  }

  // ---- ground -----------------------------------------------------------------------------------

  function buildGround(ctx) {
    var size = 512, rand = G.util.rng(907), i;
    var c = document.createElement('canvas');
    c.width = c.height = size * S;
    var g = c.getContext('2d');
    g.scale(S, S);
    g.fillStyle = '#171d16'; g.fillRect(0, 0, size, size);
    var tones = ['0,0,0,0.22', '50,74,42,0.17', '76,60,38,0.15', '34,52,36,0.2'];
    for (i = 0; i < 46; i++) {                         // soft patches, wrapped so the tile seams vanish
      var px = rand() * size, py = rand() * size, pr = 30 + rand() * 80, tone = tones[Math.floor(rand() * tones.length)];
      for (var ox = -size; ox <= size; ox += size) {
        for (var oy = -size; oy <= size; oy += size) {
          var gr = g.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, pr);
          gr.addColorStop(0, 'rgba(' + tone + ')'); gr.addColorStop(1, 'rgba(' + tone.replace(/[\d.]+$/, '0') + ')');
          g.fillStyle = gr; g.fillRect(px + ox - pr, py + oy - pr, pr * 2, pr * 2);
        }
      }
    }
    var specks = ['rgba(150,160,130,0.07)', 'rgba(0,0,0,0.2)', 'rgba(112,92,60,0.11)'];
    for (i = 0; i < 2600; i++) { g.fillStyle = specks[i % 3]; g.fillRect(rand() * size, rand() * size, 1 + rand() * 1.4, 1 + rand() * 1.4); }
    g.lineCap = 'round'; g.lineWidth = 1;
    for (i = 0; i < 560; i++) {                        // fallen needles
      var x = 6 + rand() * (size - 12), y = 6 + rand() * (size - 12), a = rand() * TAU, l = 3 + rand() * 5;
      g.strokeStyle = rand() < 0.6 ? 'rgba(124,102,64,0.22)' : 'rgba(74,96,62,0.26)';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (i = 0; i < 90; i++) {                         // tiny leaves
      g.fillStyle = 'rgba(98,78,44,0.28)';
      g.beginPath(); g.ellipse(6 + rand() * (size - 12), 6 + rand() * (size - 12), 3, 1.5, rand() * 3, 0, TAU); g.fill();
    }
    g.lineWidth = 1.3;
    for (i = 0; i < 44; i++) {                         // twigs
      var tx = 12 + rand() * (size - 24), ty = 12 + rand() * (size - 24), ta = rand() * TAU, tl = 6 + rand() * 9;
      g.strokeStyle = 'rgba(52,42,30,0.55)';
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + Math.cos(ta) * tl, ty + Math.sin(ta) * tl); g.stroke();
    }
    groundTile = c;
    groundPattern = ctx.createPattern(c, 'repeat');
    try { if (S !== 1 && groundPattern.setTransform) groundPattern.setTransform(new DOMMatrix().scale(1 / S)); }
    catch (e) { /* pattern stays at tile resolution */ }
  }

  // ---- per-area terrain ---------------------------------------------------------------------------

  function wobblePath(g, b, off, ph) {
    var r = b.r + off, n = 28;
    if (r < 5) return;
    for (var i = 0; i <= n; i++) {
      var a = i / n * TAU;
      var rr = r * (1 + 0.05 * Math.sin(a * 3 + ph) + 0.035 * Math.sin(a * 5 + ph * 2.3));
      g[i ? 'lineTo' : 'moveTo'](b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr);
    }
    g.closePath();
  }

  function buildPond(pond, seed) {
    var rand = G.util.rng(seed), M = 60, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, i;
    pond.blobs.forEach(function (b) {
      x0 = Math.min(x0, b.x - b.r); y0 = Math.min(y0, b.y - b.r); x1 = Math.max(x1, b.x + b.r); y1 = Math.max(y1, b.y + b.r);
    });
    x0 -= M; y0 -= M; x1 += M; y1 += M;
    var w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    function union(g, off) {
      g.beginPath();
      for (var j = 0; j < pond.blobs.length; j++) wobblePath(g, pond.blobs[j], off, pond.phase + j * 1.7);
    }
    function inside(x, y, inset) {
      for (var j = 0; j < pond.blobs.length; j++) {
        var b = pond.blobs[j], dx = x - b.x, dy = y - b.y;
        if (dx * dx + dy * dy < (b.r - inset) * (b.r - inset)) return true;
      }
      return false;
    }
    var sprite = mk(w, h, function (g) {
      g.translate(-cx, -cy);
      var layers = [
        [34, 'rgba(10,12,9,0.22)'], [24, 'rgba(18,17,12,0.4)'], [13, '#231f17'], [6, '#322d21'], [1, '#3d3829'],
        [-4, '#1c3132'], [-15, '#172b2e'], [-30, '#122326'], [-50, '#0e1c1f'], [-74, '#0b1719']
      ];
      for (i = 0; i < layers.length; i++) { union(g, layers[i][0]); g.fillStyle = layers[i][1]; g.fill(); }
      g.save(); union(g, -4); g.clip();
      var lg = g.createLinearGradient(x0, y0, x1, y1);                        // sky reflection from the north-west
      lg.addColorStop(0, 'rgba(150,190,182,0.14)'); lg.addColorStop(0.5, 'rgba(150,190,182,0.02)'); lg.addColorStop(1, 'rgba(0,0,0,0.2)');
      g.fillStyle = lg; g.fillRect(x0, y0, w, h);
      g.fillStyle = 'rgba(170,205,198,0.05)';
      for (i = 0; i < 16; i++) { g.beginPath(); g.ellipse(x0 + rand() * w, y0 + rand() * h, 16 + rand() * 30, 1.6, 0, 0, TAU); g.fill(); }
      g.restore();
      for (i = 0; i < 26; i++) {                                               // pebbles on the bank
        var a = rand() * TAU, b = pond.blobs[Math.floor(rand() * pond.blobs.length)], d = b.r + 2 + rand() * 16;
        var px = b.x + Math.cos(a) * d, py = b.y + Math.sin(a) * d;
        if (inside(px, py, -1)) continue;
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(px + 1, py + 1.5, 3.5, 2.6, 0, 0, TAU); g.fill();
        g.fillStyle = hsl(150, 4, 24 + rand() * 12); g.beginPath(); g.ellipse(px, py, 2 + rand() * 2.5, 1.6 + rand() * 1.6, rand() * 3, 0, TAU); g.fill();
      }
      var pads = 0, tries = 80;                                                // lily pads
      while (pads < 9 && tries-- > 0) {
        var lx = x0 + M + rand() * (w - M * 2), ly = y0 + M + rand() * (h - M * 2);
        if (!inside(lx, ly, 20) || inside(lx, ly, 62)) continue;
        var lr = 6 + rand() * 5, la = rand() * TAU;
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(lx + 1.5, ly + 2, lr, 0, TAU); g.fill();
        g.fillStyle = hsl(108 + rand() * 16, 22, 19 + rand() * 5);
        g.beginPath(); g.moveTo(lx, ly); g.arc(lx, ly, lr, la, la + TAU - 0.6); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(190,210,170,0.16)'; g.lineWidth = 0.8;
        for (var v = 0; v < 4; v++) { var va = la + 0.5 + v * 1.4; g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + Math.cos(va) * lr * 0.8, ly + Math.sin(va) * lr * 0.8); g.stroke(); }
        if (rand() < 0.3) { g.fillStyle = 'rgba(205,195,170,0.85)'; g.beginPath(); g.arc(lx + 2, ly - 1, 2.2, 0, TAU); g.fill(); }
        pads++;
      }
      for (i = 0; i < 9; i++) {                                                // reed clumps on the shoreline
        var rb = pond.blobs[Math.floor(rand() * pond.blobs.length)], ra = rand() * TAU;
        var rx = rb.x + Math.cos(ra) * (rb.r - 2), ry = rb.y + Math.sin(ra) * (rb.r - 2);
        if (inside(rx, ry, 10)) continue;
        for (var k = 0; k < 7; k++) {
          var sa = ra + Math.PI + (rand() - 0.5) * 1.7, sl = 10 + rand() * 13;
          var bx = rx + (rand() - 0.5) * 12, by = ry + (rand() - 0.5) * 12;
          g.strokeStyle = hsl(78 + rand() * 20, 20, 21 + rand() * 9); g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(sa) * sl, by + Math.sin(sa) * sl); g.stroke();
          if (rand() < 0.45) { g.fillStyle = '#3d2f22'; g.beginPath(); g.ellipse(bx + Math.cos(sa) * sl, by + Math.sin(sa) * sl, 3, 1.5, sa, 0, TAU); g.fill(); }
        }
      }
    });
    var ripples = [], rt = 60;
    while (ripples.length < 5 && rt-- > 0) {
      var qx = x0 + M + rand() * (w - M * 2), qy = y0 + M + rand() * (h - M * 2);
      if (inside(qx, qy, 46)) ripples.push({ x: qx, y: qy, ph: rand() });
    }
    return { sp: sprite, x: cx, y: cy, ripples: ripples };
  }

  function buildMacro(area, seed) {
    var k = 0.25, rand = G.util.rng(seed), W = area.width, H = area.height, i;
    var c = document.createElement('canvas');
    c.width = Math.ceil(W * k); c.height = Math.ceil(H * k);
    var g = c.getContext('2d');
    g.scale(k, k);
    function blob(x, y, r, rgb, a) {
      var gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    var tones = [['44,78,42', 0.14], ['86,66,40', 0.12], ['0,0,0', 0.22], ['0,0,0', 0.16], ['36,62,44', 0.14], ['170,180,140', 0.045]];
    for (i = 0; i < 120; i++) {
      var t = tones[Math.floor(rand() * tones.length)];
      blob(rand() * W, rand() * H, 140 + rand() * 330, t[0], t[1] * (0.5 + rand() * 0.5));
    }
    blob(area.spawn.x, area.spawn.y - 40, 330, '112,92,62', 0.13);              // trodden clearing at the trailhead
    g.lineCap = 'round'; g.lineJoin = 'round';
    [[130, 0.05], [92, 0.07], [58, 0.09], [30, 0.06]].forEach(function (p) {    // worn trails, soft edges
      g.strokeStyle = 'rgba(118,98,68,' + p[1] + ')'; g.lineWidth = p[0];
      area.paths.forEach(function (path) {
        g.beginPath(); g.moveTo(path[0][0], path[0][1]);
        for (var j = 1; j < path.length - 1; j++) {
          var mx = (path[j][0] + path[j + 1][0]) / 2, my = (path[j][1] + path[j + 1][1]) / 2;
          g.quadraticCurveTo(path[j][0], path[j][1], mx, my);
        }
        g.lineTo(path[path.length - 1][0], path[path.length - 1][1]);
        g.stroke();
      });
    });
    area.ponds.forEach(function (p) { blob(p.x, p.y, p.r * 2.3, '8,14,12', 0.34); });
    var E = 420;                                                                // the forest closes in at the edges
    function edge(x0, y0, x1, y1, rx, ry, rw, rh) {
      var gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, 'rgba(0,0,0,0.62)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(rx, ry, rw, rh);
    }
    edge(0, 0, E, 0, 0, 0, E, H); edge(W, 0, W - E, 0, W - E, 0, E, H);
    edge(0, 0, 0, E, 0, 0, W, E); edge(0, H, 0, H - E, 0, H - E, W, E);
    return { c: c, k: k };
  }

  function buildDecor(area, seed) {
    var rand = G.util.rng(seed), out = [];
    function scatter(kind, count, opts) {
      var list = SP[kind], tries = count * 6, placed = 0;
      while (placed < count && tries-- > 0) {
        var x = Math.round(20 + rand() * (area.width - 40)), y = Math.round(20 + rand() * (area.height - 40));
        if (G.area.inWater(area, x, y, opts.pad)) continue;
        if (opts.offPath && G.area.pathDist(area.paths, x, y) < opts.offPath) continue;
        if (opts.clear) {
          var hit = false;
          for (var i = 0; i < area.nodes.length && !hit; i++) {
            var n = area.nodes[i];
            if (n.canopy && !n.border) continue;
            var dx = n.x - x, dy = n.y - y, need = n.r + opts.clear;
            if (dx * dx + dy * dy < need * need) hit = true;
          }
          if (hit) continue;
        }
        out.push({ sp: list[Math.floor(rand() * list.length)], x: x, y: y });
        placed++;
      }
    }
    scatter('leaves', 300, { pad: 4 });
    scatter('pebbles', 170, { pad: 4 });
    scatter('grass', 820, { pad: 6, offPath: 34 });
    scatter('flowers', 80, { pad: 10, offPath: 40 });
    scatter('fern', 170, { pad: 26, offPath: 60 });
    scatter('bush', 46, { pad: 44, offPath: 90, clear: 40 });
    return out;
  }

  function prepare(area) {
    if (terrains[area.id]) return terrains[area.id];
    var T = { macro: buildMacro(area, 4401), ponds: [], decor: buildDecor(area, 5519), spores: [] };
    area.ponds.forEach(function (p, i) { T.ponds.push(buildPond(p, 6007 + i * 53)); });
    var rand = G.util.rng(7717);
    for (var i = 0; i < 260; i++) T.spores.push({ x: rand() * area.width, y: rand() * area.height, ph: rand() * TAU, r: 0.9 + rand() * 1.3, v: 3 + rand() * 6 });
    terrains[area.id] = T;
    return T;
  }

  // ---- frame drawing ----------------------------------------------------------------------------

  function seen(vr, x, y, m) { return x > vr.x0 - m && x < vr.x1 + m && y > vr.y0 - m && y < vr.y1 + m; }

  // Trail marker: two posts with a rag, moving chevrons and a soft pulsing ring. dir: 1 south, -1 north.
  function drawExit(ctx, x, y, r, time, dir) {
    var pulse = 0.5 + 0.5 * Math.sin(time * 2.1), i;
    var gr = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    gr.addColorStop(0, 'rgba(170,185,150,0.07)'); gr.addColorStop(1, 'rgba(170,185,150,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(170,185,150,' + (0.16 + pulse * 0.16).toFixed(3) + ')'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r * 0.72, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (i = 0; i < 3; i++) {
      var ph = (time * 0.55 + i / 3) % 1, cy = y + dir * (-22 + ph * 44);
      ctx.strokeStyle = 'rgba(190,200,165,' + (Math.sin(ph * Math.PI) * 0.5).toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(x - 11, cy - dir * 6); ctx.lineTo(x, cy + dir * 5); ctx.lineTo(x + 11, cy - dir * 6); ctx.stroke();
    }
    for (i = -1; i <= 1; i += 2) {
      var px = x + i * (r * 0.72 + 8), py = y + dir * 26;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(px + 3, py + 4, 9, 8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2c241b'; ctx.beginPath(); ctx.arc(px, py, 7.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7a6548'; ctx.beginPath(); ctx.arc(px - 0.5, py - 0.5, 5, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(40,30,20,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px - 0.5, py - 0.5, 2.4, 0, TAU); ctx.stroke();
      var fl = Math.sin(time * 2.6 + i) * 2.5;                                 // rag fluttering on the post
      ctx.fillStyle = '#6a3f37';
      ctx.beginPath(); ctx.moveTo(px + 3, py - 3); ctx.lineTo(px + 17, py - 6 + fl); ctx.lineTo(px + 15, py + 1 + fl); ctx.lineTo(px + 4, py + 2); ctx.closePath(); ctx.fill();
    }
  }

  // ---- trees with height: the crown leans away from the screen center (parallax), so trunks show ----

  var TREE_K = 0.115, TREE_TILT = 260;     // crowns also sit a little north of the roots (view from the south)
  function treeLean(n, vr) {
    var k = TREE_K * (n.canopy / 100) * (n.type === 'dead_tree' ? 0.75 : 1);
    return { x: (n.x - (vr.x0 + vr.x1) / 2) * k, y: (n.y - (vr.y0 + vr.y1) / 2 - TREE_TILT) * k };
  }

  function drawTreeShadows(ctx, nodes, vr) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n.canopy || !seen(vr, n.x, n.y, n.canopy * 2 + 60)) continue;
      var a = n.dead ? Math.max(0, 1 - n.deadT / 0.5) : 1;
      if (a <= 0) continue;
      var list = SP[n.type], sp = list[n.variant % list.length], k = n.canopy / 100;
      ctx.globalAlpha = a * (n.type === 'dead_tree' ? 0.34 : 0.38);
      var w = sp.shadow.w * k * 1.12, h = sp.shadow.h * k * 1.12;
      ctx.drawImage(sp.shadow.c, n.x + n.canopy * 0.32 - w / 2, n.y + n.canopy * 0.4 - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
  }

  function drawTreeBases(ctx, nodes, vr) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n.canopy || !seen(vr, n.x, n.y, 60)) continue;
      if (n.dead) blit(ctx, SP.stump[n.type], n.x, n.y);
      else blit(ctx, SP.canopyShadow, n.x + 3, n.y + 4, n.r / 46);          // contact shadow at the roots
    }
  }

  function drawTreeTops(ctx, nodes, vr, time, gNode, shake) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n.canopy || !seen(vr, n.x, n.y, n.canopy * 1.5 + 80)) continue;
      var a = n.fade, o = treeLean(n, vr);
      var sx = Math.sin(time * 0.55 + n.phase) * 1.6, sy = Math.cos(time * 0.45 + n.phase * 1.7) * 1.1;
      if (n.dead) {                                       // felled: the crown tips over and fades
        var f = n.deadT / 0.55;
        if (f >= 1) continue;
        a *= 1 - f;
        sx += Math.cos(n.phase) * f * f * 46; sy += Math.sin(n.phase) * f * f * 46;
      } else if (gNode === n) {
        sx += Math.sin(time * 70) * shake;
      }
      var list = SP[n.type], sp = list[n.variant % list.length], k = n.canopy / 100;
      var tx = n.x + o.x, ty = n.y + o.y, len = Math.sqrt(o.x * o.x + o.y * o.y);
      ctx.globalAlpha = n.dead ? a : Math.max(a, 0.8);
      if (len > 1.5) {                                    // trunk rising from the roots to the crown
        var nx = -o.y / len, ny = o.x / len, r0 = n.r * 0.82, r1 = n.r * 0.55;
        ctx.fillStyle = '#1d1711';
        ctx.beginPath();
        ctx.moveTo(n.x + nx * r0, n.y + ny * r0); ctx.lineTo(tx + nx * r1, ty + ny * r1);
        ctx.lineTo(tx - nx * r1, ty - ny * r1); ctx.lineTo(n.x - nx * r0, n.y - ny * r0);
        ctx.closePath(); ctx.fill();
        var sgn = nx * -0.6 + ny * -0.8 > 0 ? 1 : -1;     // lit edge of the bark (light from the north-west)
        ctx.strokeStyle = 'rgba(128,106,76,0.38)'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(n.x + nx * sgn * r0 * 0.6, n.y + ny * sgn * r0 * 0.6);
        ctx.lineTo(tx + nx * sgn * r1 * 0.6, ty + ny * sgn * r1 * 0.6); ctx.stroke();
      }
      ctx.fillStyle = '#241c14';
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 0.82, 0, TAU); ctx.fill();
      ctx.globalAlpha = a;
      if (sp.dark) blit(ctx, sp.dark, n.x + o.x * 0.5 + sx * 0.5, n.y + o.y * 0.5 + sy * 0.5, k);
      blit(ctx, sp, tx + sx, ty + sy, k * (sp.dark ? 0.9 : 1));
    }
    ctx.globalAlpha = 1;
  }

  function nodeAlpha(n) { return n.dead ? Math.max(0, 1 - n.deadT / 0.3) : 1; }

  // Ground, water, decor, resources. Drawn before the player.
  function drawBelow(ctx, area, st, vr, time) {
    var T = prepare(area), i, n, a;
    ctx.fillStyle = groundPattern;
    ctx.fillRect(vr.x0, vr.y0, vr.x1 - vr.x0, vr.y1 - vr.y0);
    var k = T.macro.k;
    var sx = Math.max(0, vr.x0), sy = Math.max(0, vr.y0), ex = Math.min(area.width, vr.x1), ey = Math.min(area.height, vr.y1);
    if (ex > sx && ey > sy) ctx.drawImage(T.macro.c, sx * k, sy * k, (ex - sx) * k, (ey - sy) * k, sx, sy, ex - sx, ey - sy);

    for (i = 0; i < T.ponds.length; i++) {
      var P = T.ponds[i];
      if (!seen(vr, P.x, P.y, P.sp.w / 2 + 10)) continue;
      blit(ctx, P.sp, P.x, P.y);
      ctx.lineWidth = 1;
      for (var j = 0; j < P.ripples.length; j++) {
        var rp = P.ripples[j], ph = (time * 0.22 + rp.ph) % 1;
        ctx.strokeStyle = 'rgba(170,205,198,' + ((1 - ph) * 0.13).toFixed(3) + ')';
        ctx.beginPath(); ctx.ellipse(rp.x, rp.y, 5 + ph * 30, (5 + ph * 30) * 0.8, 0, 0, TAU); ctx.stroke();
        var gl = Math.sin(time * 1.1 + rp.ph * 20);
        if (gl > 0) { ctx.fillStyle = 'rgba(200,225,218,' + (gl * 0.11).toFixed(3) + ')'; ctx.fillRect(rp.x + 22, rp.y - 16, 16, 1.5); ctx.fillRect(rp.x - 30, rp.y + 13, 10, 1.5); }
      }
    }

    for (i = 0; i < T.decor.length; i++) {
      var d = T.decor[i];
      if (seen(vr, d.x, d.y, 60)) ctx.drawImage(d.sp.c, d.x - d.sp.w / 2, d.y - d.sp.h / 2, d.sp.w, d.sp.h);
    }

    drawExit(ctx, area.exit.x, area.exit.y, area.exit.r, time, 1);

    drawTreeShadows(ctx, area.nodes, vr);
    drawTreeBases(ctx, area.nodes, vr);

    var g = st.gather, shake = 0;
    if (g && g.node && g.t > 0) shake = Math.exp(-((g.t % G.area.HIT) / G.area.HIT) * 5) * 2.2;
    for (i = 0; i < area.nodes.length; i++) {
      n = area.nodes[i];
      if (!seen(vr, n.x, n.y, 90)) continue;
      var ox = (g && g.node === n) ? Math.sin(time * 70) * shake : 0;
      if (n.canopy) continue;
      a = nodeAlpha(n);
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      var list = SP[n.type];
      blit(ctx, list[n.variant % list.length], n.x + ox, n.y, n.type === 'boulder' ? n.scale : 1);
    }
    ctx.globalAlpha = 1;
  }

  // Tree crowns, drifting spores, mist, target ring. Drawn after the player.
  function drawAbove(ctx, area, st, vr, time) {
    var T = prepare(area), i, n;
    var g = st.gather, shake = 0;
    if (g && g.node && g.t > 0) shake = Math.exp(-((g.t % G.area.HIT) / G.area.HIT) * 5) * 3;
    drawTreeTops(ctx, area.nodes, vr, time, g ? g.node : null, shake);

    for (i = 0; i < T.spores.length; i++) {               // drifting spores / dust in the air
      var s = T.spores[i];
      var x = (s.x + time * s.v) % area.width, y = s.y + Math.sin(time * 0.4 + s.ph) * 26;
      if (!seen(vr, x, y, 4)) continue;
      ctx.globalAlpha = 0.1 + 0.09 * Math.sin(time * 0.9 + s.ph * 3);
      ctx.fillStyle = '#c8cdaa';
      ctx.beginPath(); ctx.arc(x, y, s.r, 0, TAU); ctx.fill();
    }

    var vw = vr.x1 - vr.x0, vh = vr.y1 - vr.y0;            // slow low mist, slight parallax
    ctx.globalAlpha = 0.05;
    for (i = 0; i < 6; i++) {
      var span = vw + 700, mx = ((i * 431 + time * (7 + i * 2) - vr.x0 * 0.25) % span + span) % span - 350;
      var my = ((i * 277 + Math.sin(time * 0.07 + i) * 60 - vr.y0 * 0.25) % (vh + 500) + vh + 500) % (vh + 500) - 250;
      ctx.drawImage(SP.mist.c, vr.x0 + mx - 300, vr.y0 + my - 190, 600, 380);
    }
    ctx.globalAlpha = 1;

    var t = st.target;
    if (t) {
      var blocked = st.targetBlock, rad = t.kind === 'exit' ? 0 : t.r + 9;
      if (rad) {
        var pulse = 0.5 + 0.5 * Math.sin(time * 4);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = blocked ? 'rgba(196,146,96,' + (0.4 + pulse * 0.2).toFixed(3) + ')' : 'rgba(184,198,160,' + (0.3 + pulse * 0.25).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(t.x, t.y, rad, 0, TAU); ctx.stroke();
        if (g && g.node === t.node && g.t > 0 && g.time > 0) {
          ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.arc(t.x, t.y, rad, 0, TAU); ctx.stroke();
          ctx.strokeStyle = 'rgba(214,224,190,0.95)'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(t.x, t.y, rad, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, g.t / g.time)); ctx.stroke();
        }
      }
    }
  }

  // The tool (or bare hands) in front of the player while gathering.
  function drawTool(ctx, p, alpha, g, tool) {
    if (!g || !g.node || g.t <= 0) return;
    var x = G.util.lerp(p.prevX, p.x, alpha), y = G.util.lerp(p.prevY, p.y, alpha), r = p.radius;
    var ph = (g.t % G.area.HIT) / G.area.HIT;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(p.angle);
    ctx.lineCap = 'round';
    if (tool) {
      var sw = ph < 0.7 ? -1.25 * Math.sin(ph / 0.7 * Math.PI / 2) : -1.25 * (1 - Math.pow((ph - 0.7) / 0.3, 2));
      ctx.translate(r * 0.35, r * 0.75); ctx.rotate(sw + 0.35);
      ctx.strokeStyle = '#1e1811'; ctx.lineWidth = 5.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(26, 0); ctx.stroke();
      ctx.strokeStyle = '#8d7556'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(26, 0); ctx.stroke();
      ctx.fillStyle = '#8b9491'; ctx.strokeStyle = '#161918'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (tool === 'pickaxe') { ctx.moveTo(22, -13); ctx.quadraticCurveTo(33, 0, 22, 13); ctx.quadraticCurveTo(27, 0, 22, -13); }
      else { ctx.moveTo(20, -2); ctx.lineTo(21, -8); ctx.quadraticCurveTo(28, -13, 31, -11); ctx.quadraticCurveTo(33, -4, 30, 3); ctx.quadraticCurveTo(25, 1, 27, -2); ctx.closePath(); }
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = G.config.colors.playerHead; ctx.beginPath(); ctx.arc(2, 0, 4, 0, TAU); ctx.fill();
    } else {
      var reach = r * 0.95 + Math.sin(ph * TAU) * 3;
      ctx.fillStyle = G.config.colors.playerHead; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(reach, -6, 4, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(reach - Math.sin(ph * TAU) * 2, 6, 4, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  var FX = {
    wood:  ['#9a8158', '#6b5a44', '#b09a74'],
    stone: ['#858b87', '#5c625e', '#a3a9a4'],
    spore: ['#b5a88e', '#8a6a4e', '#d0c6aa'],
    water: ['#9fc4c0', '#6f9a98', '#c8e0dc']
  };
  function spawnFx(list, kind, x, y, count, rand) {
    var cols = FX[kind] || FX.wood;
    for (var i = 0; i < count; i++) {
      var a = rand() * TAU, v = 40 + rand() * 90;
      list.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: 0, max: 0.35 + rand() * 0.3, size: 1.5 + rand() * 2.2, color: cols[i % cols.length] });
    }
  }
  function drawParticles(ctx, list) {
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  // "+4 [icon]" / short text rising above the player.
  function drawFloaters(ctx, list) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var i = 0; i < list.length; i++) {
      var f = list[i], k = f.t / f.max;
      var y = f.y - 34 - k * 30;
      ctx.globalAlpha = k < 0.12 ? k / 0.12 : Math.min(1, (1 - k) / 0.35);
      ctx.font = '600 15px "Segoe UI", Arial, sans-serif';
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(8,10,9,0.85)'; ctx.lineJoin = 'round';
      if (f.item) {
        ctx.direction = 'ltr';
        var txt = '+' + f.n;
        ctx.drawImage(G.icons.canvas(f.item), f.x - 25, y - 13, 26, 26);
        ctx.fillStyle = '#d6dcc6';
        ctx.strokeText(txt, f.x + 14, y); ctx.fillText(txt, f.x + 14, y);
      } else {
        ctx.direction = 'rtl';
        ctx.fillStyle = '#d2a878';
        ctx.strokeText(f.text, f.x, y); ctx.fillText(f.text, f.x, y);
      }
    }
    ctx.globalAlpha = 1;
  }

  G.forestArt = {
    init: function (ctx, dpr) {
      S = Math.max(1, Math.min(dpr || 1, 2));
      buildSprites();
      buildGround(ctx);
    },
    prepare: prepare,
    kit: function () {
      return { SP: SP, mk: mk, blit: blit, softShadow: softShadow, hsl: hsl, seen: seen, ground: groundPattern,
        treeShadows: drawTreeShadows, treeBases: drawTreeBases, treeTops: drawTreeTops };
    },
    drawBelow: drawBelow,
    drawAbove: drawAbove,
    drawExit: drawExit,
    drawTool: drawTool,
    spawnFx: spawnFx,
    drawParticles: drawParticles,
    drawFloaters: drawFloaters
  };
})(typeof window !== 'undefined' ? window : globalThis);
