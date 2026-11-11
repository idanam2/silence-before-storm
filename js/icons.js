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

  var draw = {
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
    }
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
