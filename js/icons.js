// Item icons drawn in code (no image files). Each icon is painted once on a small canvas and cached;
// the UI uses it as a data URL, the world uses the canvas directly.
(function (root) {
  'use strict';
  var G = root.G, TAU = Math.PI * 2;
  var SIZE = 64, SCALE = 2;
  var canvases = {}, urls = {};

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function shadow(g, x, y, rx, ry) {
    g.fillStyle = 'rgba(0,0,0,0.38)';
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
  }

  // A gun lying along +x from a list of parts: [x, y, w, h, fill, radius]; drawn in order with a dark outline.
  function gunParts(g, parts, extra) {
    shadow(g, 32, 54, 24, 4);
    g.save(); g.translate(0, 2); g.rotate(-0.06);
    parts.forEach(function (p) {
      g.fillStyle = p[4]; rr(g, p[0], p[1], p[2], p[3], p[5] === undefined ? 2 : p[5]); g.fill();
      g.strokeStyle = '#111314'; g.lineWidth = 1.4; g.stroke();
    });
    if (extra) extra(g);
    g.strokeStyle = 'rgba(215,222,218,0.35)'; g.lineWidth = 1.1;               // light along the top of the receiver
    g.beginPath(); g.moveTo(16, parts[1][1] + 1.6); g.lineTo(parts[1][0] + parts[1][2] - 3, parts[1][1] + 1.6); g.stroke();
    g.restore();
  }
  // A jacket (with sleeves) or a vest (without), seen from the front.
  function coat(g, c0, c1, sleeves) {
    shadow(g, 32, 55, 21, 3.5);
    if (sleeves) {
      g.fillStyle = c1;
      [[-1, 0], [1, 0]].forEach(function (s) {
        g.beginPath(); g.moveTo(32 + s[0] * 13, 14); g.lineTo(32 + s[0] * 25, 22); g.lineTo(32 + s[0] * 22, 46); g.lineTo(32 + s[0] * 15, 45); g.closePath(); g.fill();
        g.strokeStyle = '#15120c'; g.lineWidth = 1.5; g.stroke();
      });
    }
    var gr = g.createLinearGradient(16, 10, 48, 52); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.beginPath(); g.moveTo(19, 13); g.lineTo(27, 10); g.lineTo(32, 16); g.lineTo(37, 10); g.lineTo(45, 13); g.lineTo(47, 51); g.lineTo(17, 51); g.closePath(); g.fill();
    g.strokeStyle = '#15120c'; g.lineWidth = 1.6; g.stroke();
    g.strokeStyle = 'rgba(15,12,8,0.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(32, 16); g.lineTo(32, 51); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.22)'; rr(g, 20, 34, 9, 10, 1.5); g.fill(); rr(g, 35, 34, 9, 10, 1.5); g.fill();
    if (!sleeves) { g.fillStyle = 'rgba(0,0,0,0.22)'; rr(g, 20, 20, 9, 7, 1.5); g.fill(); rr(g, 35, 20, 9, 7, 1.5); g.fill(); }
  }
  // A few cartridges: case colour, tip colour, case length, case width.
  function cartridges(g, c0, c1, c2, tip, len, w) {
    shadow(g, 32, 53, 22, 4);
    [[17, 40], [26, 42], [35, 41], [44, 39], [22, 29], [31, 30], [40, 28]].forEach(function (b, i) {
      g.save(); g.translate(b[0], b[1]); g.rotate(-0.12 + (i % 3) * 0.1);
      var gr = g.createLinearGradient(-w / 2, 0, w / 2, 0);
      gr.addColorStop(0, c0); gr.addColorStop(0.45, c1); gr.addColorStop(1, c2);
      g.fillStyle = gr; rr(g, -w / 2, -2, w, len, 1.2); g.fill();
      g.strokeStyle = '#1e1a12'; g.lineWidth = 1; g.stroke();
      g.fillStyle = tip; g.beginPath(); g.moveTo(-w / 2, -2); g.quadraticCurveTo(0, -12, w / 2, -2); g.closePath(); g.fill(); g.stroke();
      g.restore();
    });
  }

  // A log lying along +x, centered on (0,0).
  function logShape(g, len, w) {
    var gr = g.createLinearGradient(0, -w / 2, 0, w / 2);
    gr.addColorStop(0, '#8a7252'); gr.addColorStop(0.45, '#6b5840'); gr.addColorStop(1, '#3d3226');
    g.fillStyle = gr; rr(g, -len / 2, -w / 2, len, w, w / 2); g.fill();
    g.strokeStyle = 'rgba(30,22,14,0.55)'; g.lineWidth = 1;
    for (var i = 0; i < 5; i++) {
      var x = -len / 2 + 8 + i * (len - 22) / 5;
      g.beginPath(); g.moveTo(x, -w / 2 + 3 + (i % 2) * 3); g.lineTo(x + 7, -w / 2 + 3 + (i % 2) * 3); g.stroke();
    }
    g.fillStyle = '#b09a74';                       // cut end
    g.beginPath(); g.ellipse(len / 2 - w * 0.3, 0, w * 0.3, w * 0.46, 0, 0, TAU); g.fill();
    g.strokeStyle = '#7a6548'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(len / 2 - w * 0.3, 0, w * 0.15, w * 0.25, 0, 0, TAU); g.stroke();
    g.strokeStyle = '#221a12'; g.lineWidth = 1.5; rr(g, -len / 2, -w / 2, len, w, w / 2); g.stroke();
  }

  // Faceted stone around (cx, cy).
  function stone(g, cx, cy, r, seed) {
    var rand = G.util.rng(seed), n = 7, pts = [], i;
    for (i = 0; i < n; i++) {
      var a = i / n * TAU + rand() * 0.5, rad = r * (0.8 + rand() * 0.3);
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.86]);
    }
    var tx = cx - r * 0.2, ty = cy - r * 0.25;
    for (i = 0; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n];
      var mx = (p[0] + q[0]) / 2 - cx, my = (p[1] + q[1]) / 2 - cy, ml = Math.sqrt(mx * mx + my * my) || 1;
      var light = (mx / ml) * -0.6 + (my / ml) * -0.8;
      g.fillStyle = 'hsl(150,5%,' + (36 + light * 14).toFixed(1) + '%)';
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.closePath(); g.fill();
    }
    g.strokeStyle = '#1a1d1b'; g.lineWidth = 1.5;
    g.beginPath();
    for (i = 0; i < n; i++) g[i ? 'lineTo' : 'moveTo'](pts[i][0], pts[i][1]);
    g.closePath(); g.stroke();
  }

  function handle(g, len) {
    var gr = g.createLinearGradient(-3, 0, 3, 0);
    gr.addColorStop(0, '#5a4936'); gr.addColorStop(0.5, '#8d7556'); gr.addColorStop(1, '#4a3b2b');
    g.fillStyle = gr; rr(g, -3, -len / 2, 6, len, 2.5); g.fill();
    g.strokeStyle = '#1e1811'; g.lineWidth = 1.2; g.stroke();
    g.strokeStyle = 'rgba(30,22,14,0.5)'; g.lineWidth = 1;   // grip wrap
    for (var y = len / 2 - 12; y < len / 2 - 2; y += 3) { g.beginPath(); g.moveTo(-3, y); g.lineTo(3, y + 1.5); g.stroke(); }
  }

  function mushroomSide(g, x, y, s, cap) {
    g.fillStyle = '#cfc4a8'; rr(g, x - 3.5 * s, y - 2 * s, 7 * s, 15 * s, 3 * s); g.fill();
    g.strokeStyle = '#2a241c'; g.lineWidth = 1.2; g.stroke();
    var gr = g.createRadialGradient(x - 4 * s, y - 9 * s, 1, x, y - 3 * s, 14 * s);
    gr.addColorStop(0, cap[0]); gr.addColorStop(1, cap[1]);
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x - 13 * s, y); g.quadraticCurveTo(x - 12 * s, y - 15 * s, x, y - 15 * s);
    g.quadraticCurveTo(x + 12 * s, y - 15 * s, x + 13 * s, y); g.quadraticCurveTo(x, y + 3 * s, x - 13 * s, y); g.fill();
    g.stroke();
    g.fillStyle = 'rgba(225,215,190,0.55)';
    g.beginPath(); g.arc(x - 5 * s, y - 8 * s, 1.6 * s, 0, TAU); g.arc(x + 4 * s, y - 10 * s, 1.2 * s, 0, TAU); g.arc(x + 6 * s, y - 4 * s, 1.4 * s, 0, TAU); g.fill();
  }

  function flask(g, water, speck) {
    shadow(g, 33, 56, 15, 4);
    g.fillStyle = '#3b3f3c'; rr(g, 26, 7, 12, 8, 2); g.fill();                       // cap
    g.fillStyle = '#59605b'; rr(g, 27.5, 14, 9, 6, 1.5); g.fill();                    // neck
    rr(g, 17, 19, 30, 36, 9); g.fillStyle = 'rgba(165,185,178,0.16)'; g.fill();
    g.save(); rr(g, 17, 19, 30, 36, 9); g.clip();
    g.fillStyle = water; g.fillRect(17, 30, 30, 26);
    g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(17, 30, 30, 2);
    if (speck) { g.fillStyle = 'rgba(40,36,24,0.55)'; for (var i = 0; i < 9; i++) g.fillRect(20 + (i * 7) % 24, 34 + (i * 11) % 18, 1.6, 1.6); }
    g.fillStyle = 'rgba(255,255,255,0.13)'; g.fillRect(21, 21, 4, 32);                 // glass shine
    g.restore();
    rr(g, 17, 19, 30, 36, 9); g.strokeStyle = '#8f9992'; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = '#1b1e1c'; g.lineWidth = 1; rr(g, 26, 7, 12, 8, 2); g.stroke();
  }

  function plankShape(g, y, rot, tone) {
    g.save(); g.translate(32, y); g.rotate(rot);
    var gr = g.createLinearGradient(0, -6, 0, 6);
    gr.addColorStop(0, tone[0]); gr.addColorStop(1, tone[1]);
    g.fillStyle = gr; rr(g, -26, -6, 52, 12, 2); g.fill();
    g.strokeStyle = 'rgba(40,28,16,0.45)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-20, -2); g.lineTo(-4, -2); g.moveTo(2, 2); g.lineTo(18, 2); g.stroke();
    g.fillStyle = '#2a2218'; g.beginPath(); g.arc(-21, 0, 1.3, 0, TAU); g.arc(21, 0, 1.3, 0, TAU); g.fill();
    g.strokeStyle = '#211a11'; g.lineWidth = 1.4; rr(g, -26, -6, 52, 12, 2); g.stroke();
    g.restore();
  }

  function bowl(g, fill, topFill, steam) {
    shadow(g, 32, 53, 22, 4);
    var gr = g.createLinearGradient(10, 0, 54, 0);
    gr.addColorStop(0, '#3e4440'); gr.addColorStop(0.4, '#6c746f'); gr.addColorStop(1, '#343a37');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(9, 33); g.quadraticCurveTo(10, 52, 32, 52); g.quadraticCurveTo(54, 52, 55, 33); g.closePath(); g.fill();
    g.strokeStyle = '#161918'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#80887f'; g.beginPath(); g.ellipse(32, 33, 23, 7, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = fill; g.beginPath(); g.ellipse(32, 33.5, 20, 5.2, 0, 0, TAU); g.fill();
    g.fillStyle = topFill;
    [[24, 32, 4], [34, 34, 4.5], [41, 32, 3.2], [29, 35, 3]].forEach(function (b) {
      g.beginPath(); g.ellipse(b[0], b[1], b[2], b[2] * 0.62, 0, 0, TAU); g.fill();
    });
    g.strokeStyle = 'rgba(225,225,215,0.22)'; g.lineWidth = 1.6;
    for (var i = 0; i < steam; i++) {
      var x = 22 + i * 10;
      g.beginPath(); g.moveTo(x, 24); g.quadraticCurveTo(x + 4, 18, x, 12); g.quadraticCurveTo(x - 4, 7, x + 1, 3); g.stroke();
    }
  }

  var draw = {
    plank: function (g) {
      shadow(g, 32, 53, 25, 5);
      plankShape(g, 44, -0.05, ['#8a7456', '#5d4c36']);
      plankShape(g, 32, 0.07, ['#9a8262', '#66533b']);
      plankShape(g, 20, -0.1, ['#8f7a5a', '#5f4e38']);
    },
    nails: function (g) {
      shadow(g, 32, 52, 21, 4);
      [[18, 0.5, 38], [27, -0.2, 40], [36, 0.15, 42], [44, -0.5, 38], [31, 0.8, 34]].forEach(function (n, i) {
        g.save(); g.translate(n[0], 30 + (i % 2) * 4); g.rotate(n[1]);
        var gr = g.createLinearGradient(-2, 0, 2, 0);
        gr.addColorStop(0, '#6a7276'); gr.addColorStop(0.5, '#b2bab8'); gr.addColorStop(1, '#565e62');
        g.fillStyle = gr; g.beginPath(); g.moveTo(-1.6, -n[2] / 2 + 4); g.lineTo(1.6, -n[2] / 2 + 4); g.lineTo(0, n[2] / 2); g.closePath(); g.fill();
        g.strokeStyle = '#1a1d1f'; g.lineWidth = 1; g.stroke();
        g.fillStyle = '#9aa3a5'; g.beginPath(); g.ellipse(0, -n[2] / 2 + 3, 4.6, 2, 0, 0, TAU); g.fill(); g.stroke();
        g.restore();
      });
    },
    club: function (g) {
      shadow(g, 32, 54, 20, 4);
      g.save(); g.translate(32, 32); g.rotate(0.75);
      var gr = g.createLinearGradient(-8, 0, 8, 0);
      gr.addColorStop(0, '#4a3b2b'); gr.addColorStop(0.45, '#8d7556'); gr.addColorStop(1, '#3d3024');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-3, 26); g.lineTo(3, 26); g.lineTo(4.5, 0); g.quadraticCurveTo(10, -10, 8, -22);
      g.quadraticCurveTo(0, -29, -8, -22); g.quadraticCurveTo(-10, -10, -4.5, 0); g.closePath(); g.fill();
      g.strokeStyle = '#1e1811'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#aab2b0'; g.strokeStyle = '#1a1d1f'; g.lineWidth = 1;
      [[-4, -20], [4, -16], [-2, -11], [5, -24], [0, -26]].forEach(function (n) { g.beginPath(); g.arc(n[0], n[1], 1.7, 0, TAU); g.fill(); g.stroke(); });
      g.strokeStyle = 'rgba(30,22,14,0.5)'; g.lineWidth = 1;
      for (var y = 14; y < 24; y += 3) { g.beginPath(); g.moveTo(-3, y); g.lineTo(3, y + 1.5); g.stroke(); }
      g.restore();
    },
    pistol: function (g) {
      shadow(g, 32, 54, 21, 4);
      g.save(); g.translate(31, 33); g.rotate(-0.12);
      var gr = g.createLinearGradient(0, -12, 0, 6);                       // slide
      gr.addColorStop(0, '#6d767a'); gr.addColorStop(1, '#2f3538');
      g.fillStyle = gr; rr(g, -22, -11, 44, 12, 2.5); g.fill();
      g.strokeStyle = '#121516'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#3a4144'; rr(g, -19, 1, 31, 6, 2); g.fill(); g.stroke();   // frame under the slide
      g.fillStyle = '#34292a'; g.beginPath(); g.moveTo(-14, 6); g.lineTo(-3, 6); g.lineTo(-6, 24); g.lineTo(-17, 24); g.closePath(); g.fill();   // grip
      g.strokeStyle = '#121516'; g.stroke();
      g.strokeStyle = 'rgba(160,150,140,0.3)'; g.lineWidth = 1;
      for (var i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-15 + i * 0.4, 10 + i * 3.4); g.lineTo(-6 + i * 0.4, 10 + i * 3.4); g.stroke(); }
      g.strokeStyle = '#1b1e20'; g.lineWidth = 1.6;                        // trigger guard
      g.beginPath(); g.moveTo(-2, 7); g.quadraticCurveTo(0, 15, 6, 11); g.lineTo(8, 7); g.stroke();
      g.strokeStyle = 'rgba(210,218,214,0.5)'; g.lineWidth = 1.2;           // light on the slide
      g.beginPath(); g.moveTo(-18, -8.5); g.lineTo(17, -8.5); g.stroke();
      g.restore();
    },
    ammo: function (g) {
      shadow(g, 32, 53, 22, 4);
      [[17, 40], [26, 42], [35, 41], [44, 39], [22, 30], [31, 31], [40, 29]].forEach(function (b, i) {
        g.save(); g.translate(b[0], b[1]); g.rotate(-0.12 + (i % 3) * 0.1);
        var gr = g.createLinearGradient(-3, 0, 3, 0);
        gr.addColorStop(0, '#8a6a34'); gr.addColorStop(0.45, '#d2ad5c'); gr.addColorStop(1, '#6e5228');
        g.fillStyle = gr; rr(g, -3.4, -2, 6.8, 15, 1.4); g.fill();         // case
        g.strokeStyle = '#2a1f10'; g.lineWidth = 1; g.stroke();
        g.fillStyle = '#9a6a3a'; g.beginPath(); g.moveTo(-3, -2); g.quadraticCurveTo(0, -11, 3, -2); g.closePath(); g.fill(); g.stroke();   // bullet
        g.restore();
      });
    },
    ammo_556: function (g) { cartridges(g, '#9a9a90', '#d6d6cc', '#6a6a62', '#b44a38', 17, 5.6); },     // slim, silver case, red-tipped bullets
    ammo_762: function (g) { cartridges(g, '#7e5f2c', '#c79a48', '#5e4720', '#2c2a28', 19, 7.2); },     // fat, long brass case, dark bullets
    uzi: function (g) {
      gunParts(g, [[34, 25, 14, 4, '#1c1e20', 1], [13, 23, 33, 13, '#33383b', 2.5], [20, 35, 8, 17, '#26292b', 1.5], [14, 34, 9, 12, '#3a2f2c', 2], [5, 25, 10, 3, '#222527', 1]],
        function (g2) { g2.strokeStyle = '#15171a'; g2.lineWidth = 1.6; g2.beginPath(); g2.moveTo(30, 36); g2.quadraticCurveTo(33, 43, 38, 38); g2.stroke(); });
    },
    m16: function (g) {
      gunParts(g, [[3, 28, 15, 9, '#25282a', 3], [17, 26, 26, 10, '#2f3336', 2], [43, 27, 13, 8, '#232628', 2], [55, 29, 7, 3, '#1b1d1f', 1],
        [21, 21, 19, 4, '#3a3f42', 2], [29, 35, 6, 14, '#202326', 1.5], [17, 35, 6, 11, '#25272a', 2]]);
    },
    ak47: function (g) {
      gunParts(g, [[3, 28, 16, 9, '#6b4a2c', 3], [18, 27, 24, 8, '#2d2f30', 2], [42, 27, 13, 8, '#7a5430', 2], [54, 29, 8, 3, '#1d1f21', 1],
        [18, 35, 6, 11, '#5a3a22', 2], [30, 35, 6, 15, '#5a3a22', 2.5], [14, 26, 7, 3, '#25272a', 1]]);
    },
    sniper: function (g) {
      gunParts(g, [[2, 29, 17, 9, '#3a3f34', 3], [18, 29, 24, 7, '#2a2d2b', 2], [42, 31, 21, 3, '#1e2123', 1], [20, 21, 25, 6, '#1a1c1e', 3],
        [26, 35, 5, 7, '#25272a', 1.5], [16, 35, 6, 9, '#2a2c2a', 2]],
        function (g2) { g2.fillStyle = 'rgba(120,170,190,0.65)'; g2.beginPath(); g2.arc(45, 24, 2.6, 0, TAU); g2.fill(); g2.strokeStyle = '#15171a'; g2.lineWidth = 1.4; g2.beginPath(); g2.moveTo(51, 34); g2.lineTo(47, 45); g2.moveTo(55, 34); g2.lineTo(59, 45); g2.stroke(); });
    },
    cooked_food: function (g) { bowl(g, '#5a3f28', '#9a6a3c', 3); },
    stew: function (g) { bowl(g, '#6e5a30', '#7d6a50', 2); },
    rope: function (g) {                                   // a coil of rope
      shadow(g, 32, 53, 22, 5);
      for (var i = 0; i < 4; i++) {
        var gr = g.createLinearGradient(0, 22 + i * 6, 0, 36 + i * 6);
        gr.addColorStop(0, '#b09a70'); gr.addColorStop(1, '#6a5a3c');
        g.strokeStyle = '#2a2218'; g.lineWidth = 9; g.beginPath(); g.ellipse(32, 34 + (i - 1.5) * 2, 20 - i * 3, 12 - i * 2, 0, 0, TAU); g.stroke();
        g.strokeStyle = gr; g.lineWidth = 6.4; g.beginPath(); g.ellipse(32, 34 + (i - 1.5) * 2, 20 - i * 3, 12 - i * 2, 0, 0, TAU); g.stroke();
      }
      g.strokeStyle = 'rgba(40,30,18,0.5)'; g.lineWidth = 1;
      for (var k = 0; k < 14; k++) { var a = k / 14 * TAU; g.beginPath(); g.moveTo(32 + Math.cos(a) * 15, 34 + Math.sin(a) * 9); g.lineTo(32 + Math.cos(a + 0.18) * 18, 34 + Math.sin(a + 0.18) * 11); g.stroke(); }
      g.strokeStyle = '#8a7a58'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(50, 36); g.quadraticCurveTo(58, 44, 54, 52); g.stroke();
    },
    crate: function (g) {                                  // a wooden crate with a slatted lid
      shadow(g, 32, 54, 24, 5);
      g.fillStyle = '#5a4a32'; rr(g, 12, 22, 40, 30, 2); g.fill(); g.strokeStyle = '#1e1810'; g.lineWidth = 1.5; g.stroke();
      var tp = g.createLinearGradient(0, 14, 0, 26); tp.addColorStop(0, '#8d7752'); tp.addColorStop(1, '#6a5638');
      g.fillStyle = tp; g.beginPath(); g.moveTo(12, 22); g.lineTo(19, 14); g.lineTo(57, 14); g.lineTo(52, 22); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(30,22,12,0.55)'; g.lineWidth = 1.2;
      [31, 40, 48].forEach(function (y) { g.beginPath(); g.moveTo(12, y); g.lineTo(52, y); g.stroke(); });
      g.fillStyle = '#4a4034'; g.fillRect(12, 22, 4, 30); g.fillRect(48, 22, 4, 30);
      g.fillStyle = '#9aa3a5'; [[14, 26], [14, 48], [50, 26], [50, 48]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 1.4, 0, TAU); g.fill(); });
    },
    firstaid: function (g) {                               // a small case with a cross
      shadow(g, 32, 54, 22, 4);
      var gr = g.createLinearGradient(0, 18, 0, 52); gr.addColorStop(0, '#9a6058'); gr.addColorStop(1, '#6a3a36');
      g.fillStyle = gr; rr(g, 11, 20, 42, 32, 5); g.fill(); g.strokeStyle = '#2a1614'; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = '#4a2a28'; rr(g, 25, 14, 14, 8, 3); g.fill(); g.stroke();                  // handle
      g.fillStyle = '#e0d8c8'; rr(g, 27, 26, 10, 20, 1.5); g.fill(); rr(g, 22, 31, 20, 10, 1.5); g.fill();
      g.strokeStyle = 'rgba(235,225,205,0.3)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(15, 23); g.lineTo(49, 23); g.stroke();
    },
    torch: function (g) {                                  // a stick wrapped in cloth with a small flame
      shadow(g, 32, 55, 14, 3);
      g.save(); g.translate(32, 36); g.rotate(0.35);
      var gr = g.createLinearGradient(-4, 0, 4, 0); gr.addColorStop(0, '#4a3b2b'); gr.addColorStop(0.5, '#8d7556'); gr.addColorStop(1, '#3d3024');
      g.fillStyle = gr; rr(g, -3.5, -6, 7, 34, 2.5); g.fill(); g.strokeStyle = '#1e1811'; g.lineWidth = 1.3; g.stroke();
      g.fillStyle = '#6e6660'; rr(g, -5.5, -12, 11, 11, 3); g.fill(); g.stroke();
      g.fillStyle = 'rgba(168,67,28,0.95)'; g.beginPath(); g.moveTo(-6, -10); g.quadraticCurveTo(-8, -24, 0, -32); g.quadraticCurveTo(8, -24, 6, -10); g.closePath(); g.fill();
      g.fillStyle = 'rgba(240,184,84,0.95)'; g.beginPath(); g.moveTo(-3, -11); g.quadraticCurveTo(-4, -20, 0, -25); g.quadraticCurveTo(4, -20, 3, -11); g.closePath(); g.fill();
      g.restore();
    },
    lantern: function (g) {                                // a metal lantern with a glowing pane
      shadow(g, 32, 55, 17, 4);
      g.strokeStyle = '#5a6266'; g.lineWidth = 2.4; g.beginPath(); g.arc(32, 14, 8, Math.PI, TAU); g.stroke();
      g.fillStyle = '#4a5256'; rr(g, 18, 14, 28, 6, 2); g.fill(); g.strokeStyle = '#14171a'; g.lineWidth = 1.4; g.stroke();
      g.fillStyle = '#3c4346'; rr(g, 18, 48, 28, 6, 2); g.fill(); g.stroke();
      var gl = g.createLinearGradient(0, 20, 0, 48); gl.addColorStop(0, '#d8a85a'); gl.addColorStop(1, '#8a5a2c');
      g.fillStyle = gl; g.fillRect(21, 20, 22, 28);
      g.fillStyle = 'rgba(255,230,160,0.7)'; g.beginPath(); g.ellipse(32, 36, 4, 7, 0, 0, TAU); g.fill();
      g.strokeStyle = '#14171a'; g.lineWidth = 1.5; g.strokeRect(21, 20, 22, 28); g.beginPath(); g.moveTo(32, 20); g.lineTo(32, 48); g.stroke();
    },
    dried_mushroom: function (g) {                         // a string of small dried caps
      shadow(g, 32, 54, 20, 3);
      g.strokeStyle = '#8a7a58'; g.lineWidth = 2; g.beginPath(); g.moveTo(8, 18); g.quadraticCurveTo(32, 30, 56, 18); g.stroke();
      [[17, 23, 0.6], [32, 27, 0.8], [47, 23, 0.65]].forEach(function (m) {
        g.fillStyle = '#6a5a40'; g.fillRect(m[0] - 1, m[1], 2, 10 * m[2] / 0.6);
        g.fillStyle = '#9a8460'; g.beginPath(); g.moveTo(m[0] - 10 * m[2] / 0.6 * 0.8, m[1] + 12 * m[2] / 0.6);
        g.quadraticCurveTo(m[0], m[1] - 2, m[0] + 10 * m[2] / 0.6 * 0.8, m[1] + 12 * m[2] / 0.6); g.closePath(); g.fill();
        g.strokeStyle = '#2a2218'; g.lineWidth = 1.1; g.stroke();
        g.fillStyle = 'rgba(210,196,160,0.35)'; g.fillRect(m[0] - 4, m[1] + 5, 3, 2);
      });
    },
    ration: function (g) {                                 // a wrapped pack of dried food
      shadow(g, 32, 54, 22, 4);
      g.fillStyle = '#6e5e3c'; rr(g, 12, 22, 40, 28, 4); g.fill(); g.strokeStyle = '#2a2014'; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = '#8a7a56'; g.beginPath(); g.moveTo(10, 24); g.lineTo(14, 18); g.lineTo(50, 18); g.lineTo(54, 24); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#c8bca0'; rr(g, 19, 28, 26, 14, 2); g.fill();
      g.fillStyle = '#5a4a30'; g.fillRect(22, 32, 14, 2); g.fillRect(22, 36, 9, 2);
      g.strokeStyle = 'rgba(40,30,18,0.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(32, 18); g.lineTo(32, 24); g.stroke();
    },
    wood: function (g) {
      shadow(g, 32, 52, 24, 5);
      g.save(); g.translate(24, 42); g.rotate(-0.12); logShape(g, 40, 14); g.restore();
      g.save(); g.translate(40, 44); g.rotate(-0.06); logShape(g, 38, 13); g.restore();
      g.save(); g.translate(32, 29); g.rotate(-0.16); logShape(g, 42, 15); g.restore();
    },
    stone: function (g) {
      shadow(g, 32, 51, 23, 5);
      stone(g, 22, 40, 13, 11); stone(g, 43, 41, 12, 23); stone(g, 32, 27, 14, 37);
    },
    mushroom: function (g) {
      shadow(g, 32, 53, 20, 4);
      mushroomSide(g, 41, 40, 0.8, ['#a8875f', '#6b4f38']);
      mushroomSide(g, 25, 36, 1.1, ['#9a6a4a', '#5e3d2c']);
    },
    water_dirty: function (g) { flask(g, '#5f6a48', true); },
    water_clean: function (g) { flask(g, '#4f7f8c', false); },
    canned_food: function (g) {
      shadow(g, 32, 54, 17, 4);
      var gr = g.createLinearGradient(17, 0, 47, 0);
      gr.addColorStop(0, '#5a605c'); gr.addColorStop(0.35, '#a2a9a3'); gr.addColorStop(1, '#4a504c');
      g.fillStyle = gr; rr(g, 17, 14, 30, 39, 4); g.fill();
      var lb = g.createLinearGradient(17, 0, 47, 0);
      lb.addColorStop(0, '#5e3d2c'); lb.addColorStop(0.35, '#9a6a48'); lb.addColorStop(1, '#4e3224');
      g.fillStyle = lb; g.fillRect(17, 24, 30, 20);
      g.fillStyle = 'rgba(225,210,170,0.6)'; g.fillRect(17, 31, 30, 3);
      g.fillStyle = '#b4bbb5'; g.beginPath(); g.ellipse(32, 15, 15, 4, 0, 0, TAU); g.fill();
      g.strokeStyle = '#6a706b'; g.lineWidth = 1; g.beginPath(); g.ellipse(32, 15, 10, 2.4, 0, 0, TAU); g.stroke();
      g.strokeStyle = '#1b1e1c'; g.lineWidth = 1.5; rr(g, 17, 12, 30, 41, 4); g.stroke();
    },
    metal: function (g) {
      shadow(g, 32, 52, 23, 5);
      g.save(); g.translate(28, 36); g.rotate(-0.35);
      g.fillStyle = '#5a6266'; rr(g, -19, -11, 38, 22, 2); g.fill(); g.strokeStyle = '#1a1d1f'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = 'rgba(128,78,48,0.55)'; g.beginPath(); g.ellipse(-8, 4, 8, 4, 0.3, 0, TAU); g.fill();
      g.restore();
      g.save(); g.translate(37, 30); g.rotate(0.3);
      var gr = g.createLinearGradient(-17, -10, 17, 10);
      gr.addColorStop(0, '#9aa3a5'); gr.addColorStop(1, '#5a6367');
      g.fillStyle = gr; rr(g, -17, -10, 34, 20, 2); g.fill(); g.strokeStyle = '#1a1d1f'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#2c3133';
      [[-13, -6], [13, -6], [-13, 6], [13, 6]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 1.6, 0, TAU); g.fill(); });
      g.restore();
    },
    cloth: function (g) {
      shadow(g, 32, 53, 22, 4);
      var cols = ['#6a6158', '#857b70', '#9a9084'];
      for (var i = 0; i < 3; i++) {
        g.fillStyle = cols[i]; rr(g, 12 + i, 37 - i * 10, 40 - i * 2, 13, 5); g.fill();
        g.strokeStyle = '#211e1a'; g.lineWidth = 1.3; g.stroke();
        g.strokeStyle = 'rgba(30,26,22,0.45)'; g.lineWidth = 1; g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(17, 46 - i * 10); g.lineTo(47, 46 - i * 10); g.stroke(); g.setLineDash([]);
      }
    },
    electronics: function (g) {
      shadow(g, 32, 53, 22, 4);
      g.fillStyle = '#35604a'; rr(g, 11, 15, 42, 34, 3); g.fill(); g.strokeStyle = '#13201a'; g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = 'rgba(170,150,90,0.6)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(15, 22); g.lineTo(24, 22); g.lineTo(24, 28); g.moveTo(48, 43); g.lineTo(40, 43); g.lineTo(40, 38);
      g.moveTo(15, 43); g.lineTo(22, 43); g.moveTo(48, 21); g.lineTo(43, 21); g.stroke();
      g.fillStyle = '#a8935a';
      for (var i = 0; i < 4; i++) { g.fillRect(25 + i * 4, 25, 2, 3); g.fillRect(25 + i * 4, 37, 2, 3); }
      g.fillStyle = '#1a1c1b'; rr(g, 23, 27, 18, 11, 1.5); g.fill();
      g.fillStyle = '#7d4a3a'; g.fillRect(44, 27, 5, 8);
      g.fillStyle = '#9aa3a5'; g.beginPath(); g.arc(17, 32, 2.4, 0, TAU); g.fill();
    },
    bandage: function (g) {
      shadow(g, 32, 52, 21, 4);
      g.fillStyle = '#bdb6a6'; rr(g, 26, 26, 28, 20, 3); g.fill(); g.strokeStyle = '#2a2722'; g.lineWidth = 1.3; g.stroke();
      var gr = g.createLinearGradient(10, 20, 38, 50);
      gr.addColorStop(0, '#dcd6c8'); gr.addColorStop(1, '#a39c8d');
      g.fillStyle = gr; g.beginPath(); g.ellipse(24, 36, 13, 15, 0, 0, TAU); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(60,54,44,0.45)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(24, 36, 8, 10, 0, 0, TAU); g.stroke(); g.beginPath(); g.ellipse(24, 36, 3.5, 5, 0, 0, TAU); g.stroke();
      g.fillStyle = '#8a4a42'; g.fillRect(41, 30, 4, 12); g.fillRect(37, 34, 12, 4);
    },
    gasmask: function (g) {
      shadow(g, 32, 54, 19, 4);
      g.fillStyle = '#3c4640'; g.beginPath(); g.ellipse(32, 30, 15, 17, 0, 0, TAU); g.fill();
      g.strokeStyle = '#161918'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = 'rgba(150,190,170,0.75)'; g.beginPath(); g.ellipse(25, 26, 5, 4, 0, 0, TAU); g.ellipse(39, 26, 5, 4, 0, 0, TAU); g.fill();
      g.fillStyle = '#566058'; g.fillRect(25, 36, 14, 10); g.strokeRect(25, 36, 14, 10);
      g.fillStyle = '#6d756f'; for (var q = 0; q < 3; q++) g.fillRect(28 + q * 4, 38, 2, 6);
      g.strokeStyle = '#252a27'; g.lineWidth = 3; g.beginPath(); g.moveTo(17, 28); g.lineTo(9, 26); g.moveTo(47, 28); g.lineTo(55, 26); g.stroke();
    },
    axe: function (g) {
      shadow(g, 32, 54, 19, 4);
      g.save(); g.translate(32, 32); g.rotate(0.7);
      handle(g, 48);
      var gr = g.createLinearGradient(-4, 0, 20, 0);
      gr.addColorStop(0, '#525a57'); gr.addColorStop(0.7, '#8b9491'); gr.addColorStop(1, '#c3cac5');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-5, -23); g.lineTo(6, -24); g.quadraticCurveTo(13, -27, 19, -29);
      g.quadraticCurveTo(23, -18, 19, -6); g.quadraticCurveTo(12, -9, 6, -11); g.lineTo(-5, -12); g.closePath(); g.fill();
      g.strokeStyle = '#161918'; g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = 'rgba(235,240,235,0.7)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(19, -28); g.quadraticCurveTo(22.5, -18, 19, -7); g.stroke();
      g.restore();
    },
    pickaxe: function (g) {
      shadow(g, 32, 54, 19, 4);
      g.save(); g.translate(32, 33); g.rotate(0.7);
      handle(g, 48);
      var gr = g.createLinearGradient(-24, 0, 24, 0);
      gr.addColorStop(0, '#c3cac5'); gr.addColorStop(0.3, '#6c7572'); gr.addColorStop(0.7, '#6c7572'); gr.addColorStop(1, '#c3cac5');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-25, -9); g.quadraticCurveTo(0, -31, 25, -9); g.quadraticCurveTo(0, -19, -25, -9); g.closePath(); g.fill();
      g.strokeStyle = '#161918'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#3d4442'; rr(g, -5, -25, 10, 9, 2); g.fill(); g.stroke();
      g.restore();
    },
    // clothes (data/gear.js)
    cap: function (g) {                                    // knit beanie with a folded cuff
      shadow(g, 32, 52, 18, 4);
      g.fillStyle = '#4a5060'; g.beginPath(); g.moveTo(14, 42); g.quadraticCurveTo(14, 12, 32, 12); g.quadraticCurveTo(50, 12, 50, 42); g.closePath(); g.fill();
      g.strokeStyle = '#15171a'; g.lineWidth = 1.6; g.stroke();
      g.strokeStyle = 'rgba(190,198,216,0.3)'; g.lineWidth = 1.2;
      [22, 27, 32, 37, 42].forEach(function (x) { g.beginPath(); g.moveTo(x, 18 + Math.abs(x - 32) * 0.5); g.lineTo(x, 38); g.stroke(); });
      g.fillStyle = '#6a7186'; rr(g, 11, 38, 42, 11, 4); g.fill(); g.strokeStyle = '#15171a'; g.lineWidth = 1.6; g.stroke();
    },
    helmet: function (g) {                                 // steel helmet with a strap
      shadow(g, 32, 52, 21, 4);
      var gr = g.createLinearGradient(12, 14, 52, 44); gr.addColorStop(0, '#8a9a6e'); gr.addColorStop(1, '#4e5a3c');
      g.fillStyle = gr; g.beginPath(); g.moveTo(10, 40); g.quadraticCurveTo(10, 12, 32, 12); g.quadraticCurveTo(54, 12, 54, 40); g.quadraticCurveTo(32, 46, 10, 40); g.closePath(); g.fill();
      g.strokeStyle = '#161a12'; g.lineWidth = 1.6; g.stroke();
      g.strokeStyle = '#2c2418'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(18, 42); g.quadraticCurveTo(32, 56, 46, 42); g.stroke();
      g.strokeStyle = 'rgba(230,240,210,0.35)'; g.lineWidth = 2; g.beginPath(); g.arc(30, 30, 14, Math.PI * 1.1, Math.PI * 1.55); g.stroke();
    },
    jacket: function (g) { coat(g, '#a07444', '#6a4a28', true); },
    vest: function (g) { coat(g, '#6c7e5a', '#46543a', false); },
    pants: function (g) {                                  // cargo trousers with a pocket on each leg
      shadow(g, 32, 55, 18, 3.5);
      g.fillStyle = '#7e7e50'; g.beginPath(); g.moveTo(18, 10); g.lineTo(46, 10); g.lineTo(49, 52); g.lineTo(36, 52); g.lineTo(32, 26); g.lineTo(28, 52); g.lineTo(15, 52); g.closePath(); g.fill();
      g.strokeStyle = '#1c1c10'; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = '#5c5c38'; rr(g, 17, 10, 30, 5, 1.5); g.fill(); g.stroke();
      g.fillStyle = '#6a6a42'; rr(g, 17.5, 30, 8, 9, 1.5); g.fill(); g.lineWidth = 1.1; g.stroke(); rr(g, 38.5, 30, 8, 9, 1.5); g.fill(); g.stroke();
    },
    boots: function (g) {                                  // a pair of laced boots
      shadow(g, 32, 54, 22, 4);
      [[10, 0], [30, 4]].forEach(function (o) {
        g.fillStyle = '#5a3e28'; g.beginPath(); g.moveTo(o[0] + 4, 14 + o[1]); g.lineTo(o[0] + 15, 14 + o[1]); g.lineTo(o[0] + 15, 34 + o[1]); g.quadraticCurveTo(o[0] + 26, 36 + o[1], o[0] + 25, 46 + o[1]); g.lineTo(o[0] + 3, 46 + o[1]); g.closePath(); g.fill();
        g.strokeStyle = '#1a120a'; g.lineWidth = 1.6; g.stroke();
        g.fillStyle = '#2a1e14'; rr(g, o[0] + 2, 45 + o[1], 24, 4, 1.5); g.fill();
        g.strokeStyle = 'rgba(226,210,180,0.6)'; g.lineWidth = 1.1;
        [20, 25, 30].forEach(function (y) { g.beginPath(); g.moveTo(o[0] + 9, y + o[1]); g.lineTo(o[0] + 15, y + 1.5 + o[1]); g.stroke(); });
      });
    },
    fuel: function (g) {                                                  // fuel can (jerrycan)
      shadow(g, 32, 55, 19, 4);
      var gr = g.createLinearGradient(16, 0, 48, 0);
      gr.addColorStop(0, '#7b2c22'); gr.addColorStop(0.45, '#b04a38'); gr.addColorStop(1, '#6a241c');
      g.fillStyle = gr; rr(g, 16, 17, 32, 36, 4); g.fill();
      g.strokeStyle = '#2a0f0b'; g.lineWidth = 1.6; g.stroke();
      g.fillStyle = '#9a3d2e'; g.beginPath(); g.moveTo(16, 21); g.lineTo(24, 12); g.lineTo(48, 12); g.lineTo(48, 17); g.lineTo(16, 17); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#2a0f0b'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(27, 12); g.quadraticCurveTo(32, 3, 42, 6); g.stroke();   // handle
      g.fillStyle = '#d4c36a'; rr(g, 40, 8, 6, 6, 1.5); g.fill(); g.strokeStyle = '#2a0f0b'; g.lineWidth = 1; g.stroke();            // cap
      g.strokeStyle = 'rgba(40,12,8,0.5)'; g.lineWidth = 1.6;                                                                          // pressed cross
      g.beginPath(); g.moveTo(20, 24); g.lineTo(44, 48); g.moveTo(44, 24); g.lineTo(20, 48); g.stroke();
      g.strokeStyle = 'rgba(255,200,180,0.2)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(19, 22); g.lineTo(19, 49); g.stroke();
    },
    veh_motorcycle: function (g) { G.vehicleArt.icon(g, 'motorcycle'); },
    veh_atv: function (g) { G.vehicleArt.icon(g, 'atv'); },
    veh_jeep: function (g) { G.vehicleArt.icon(g, 'jeep'); },
    veh_heli: function (g) { G.vehicleArt.icon(g, 'heli'); },
    veh_tank: function (g) { G.vehicleArt.icon(g, 'tank'); }
  };

  function canvasFor(id) {
    if (canvases[id]) return canvases[id];
    var c = document.createElement('canvas');
    c.width = c.height = SIZE * SCALE;
    var g = c.getContext('2d');
    g.scale(SCALE, SCALE);
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (draw[id]) draw[id](g);
    else {                                    // unknown item: plain tile in the item's color
      var d = G.data.items[id];
      g.fillStyle = d ? d.color : '#555'; rr(g, 14, 14, 36, 36, 8); g.fill();
    }
    canvases[id] = c;
    return c;
  }

  G.icons = {
    has: function (id) { return !!draw[id]; },
    canvas: canvasFor,
    url: function (id) { return urls[id] || (urls[id] = canvasFor(id).toDataURL('image/png')); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
