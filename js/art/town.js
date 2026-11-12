// Extra drawing for town (G.placeArt.register / furn / sprite / overlay). Resource sprites for the town_* finds.
(function (root) {
  'use strict';
  var G = root.G;
  if (!G || !G.placeArt || !G.placeArt.sprite) return;

  // Each draws a small object in a w x h canvas, centred: g = 2D context, r = seeded random, i = variant.
  function box(g, w, h, fill, edge) {
    g.fillStyle = fill; g.fillRect(-w / 2, -h / 2, w, h);
    g.strokeStyle = edge; g.lineWidth = 2; g.strokeRect(-w / 2, -h / 2, w, h);
  }
  function shadow(g, w, h) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(2, h / 2 - 2, w / 2, 5, 0, 0, Math.PI * 2); g.fill(); }

  G.placeArt.sprite('town_ammo', 2, 311, 56, 48, function (g, r) {
    g.translate(28, 24); shadow(g, 40, 34);
    box(g, 38, 24, '#4b5238', '#2a2f20');
    g.fillStyle = '#c8b273'; g.fillRect(-12, -3, 24, 5);
    g.fillStyle = '#2a2f20'; g.fillRect(-4, -12, 8, 4);
  });
  G.placeArt.sprite('town_toolbox', 2, 313, 52, 44, function (g, r) {
    g.translate(26, 22); shadow(g, 36, 28);
    box(g, 32, 20, '#8a3b2c', '#4a1d15');
    g.fillStyle = '#b9bcc0'; g.fillRect(-4, -14, 8, 4);
    g.fillStyle = '#d6d6d6'; g.fillRect(-14, -2, 28, 3);
  });
  G.placeArt.sprite('town_laundry', 3, 317, 64, 52, function (g, r, i) {
    g.translate(32, 26);
    g.strokeStyle = '#555'; g.lineWidth = 2; g.beginPath(); g.moveTo(-28, -14); g.lineTo(28, -14); g.stroke();
    var cols = ['#9aa7a0', '#b7a98a', '#7e8c9a'];
    for (var k = 0; k < 3; k++) { g.fillStyle = cols[(k + i) % 3]; g.fillRect(-24 + k * 18, -13, 14, 22 + (k % 2) * 6); }
  });
  G.placeArt.sprite('town_bin', 2, 319, 44, 52, function (g, r) {
    g.translate(22, 26); shadow(g, 30, 40);
    box(g, 26, 32, '#4d5a52', '#252d28');
    g.fillStyle = '#39433d'; g.fillRect(-15, -20, 30, 8);
    g.fillStyle = '#6b7a70'; g.fillRect(-9, -10, 3, 20); g.fillRect(0, -10, 3, 20);
  });
})(typeof window !== 'undefined' ? window : globalThis);
