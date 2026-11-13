// Drawing of story objects ("spots", data/story-wire.js `art`) and standing characters. Simple shapes in the game's muted
// colours, shadows fall south-east like everywhere else. Drawn once per frame below the figures (js/game.js render).
(function (root) {
  'use strict';
  var G = root.G;

  var npcs = {};                     // spot id -> a body (G.player.create) that turns to face the player

  function shadow(c, x, y, rx, ry) {
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(x + rx * 0.35, y + ry * 0.4, rx, ry, 0, 0, 6.283); c.fill();
  }
  function box(c, x, y, w, h, fill, edge) {
    c.fillStyle = fill; c.fillRect(x, y, w, h);
    if (edge) { c.strokeStyle = edge; c.lineWidth = 1.2; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
  }
  function line(c, x1, y1, x2, y2, col, w) { c.strokeStyle = col; c.lineWidth = w || 1; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }

  var ART = {
    tally: function (c, x, y) {                                   // a chalk board on a post, by the entrance of the yard
      shadow(c, x, y + 6, 20, 5);
      box(c, x - 3, y - 4, 6, 12, '#3e3226');
      box(c, x - 17, y - 42, 34, 40, '#6a5640', '#2c2218');
      box(c, x - 14, y - 39, 28, 34, '#3a3a36');
      c.strokeStyle = 'rgba(224,224,210,0.75)'; c.lineWidth = 1.1;
      for (var r = 0; r < 4; r++) for (var k = 0; k < 4; k++) {
        var tx = x - 11 + k * 6, ty = y - 35 + r * 8;
        line(c, tx, ty, tx, ty + 5, 'rgba(224,224,210,0.7)', 1);
        if (k === 3) line(c, x - 12, ty + 4, x + 11, ty, 'rgba(224,224,210,0.7)', 1);
      }
    },
    radio: function (c, x, y, t, st) {                            // a small table under the window with the old radio
      shadow(c, x, y + 4, 22, 5);
      box(c, x - 16, y - 8, 3, 12, '#4a3c2c'); box(c, x + 13, y - 8, 3, 12, '#4a3c2c');
      box(c, x - 19, y - 12, 38, 6, '#6a5640', '#2c2218');
      var on = G.story.hasFlag('radio_placed');
      if (on) {
        box(c, x - 11, y - 25, 22, 14, '#3e4a4a', '#1c2424');
        box(c, x - 8, y - 22, 9, 8, '#2a3434');
        line(c, x + 7, y - 25, x + 13, y - 40, '#8a9490', 1);
        c.fillStyle = G.story.radioPending() ? '#7fd08a' : '#2f4a36';
        c.beginPath(); c.arc(x + 6, y - 18, 2.2, 0, 6.283); c.fill();
        if (G.story.radioPending()) { c.fillStyle = 'rgba(127,208,138,0.16)'; c.beginPath(); c.arc(x + 6, y - 18, 9, 0, 6.283); c.fill(); }
      }
    },
    hatch: function (c, x, y) { box(c, x - 18, y - 8, 36, 16, '#2c2620', '#6a5a44'); line(c, x - 18, y, x + 18, y, '#4a3e30', 1); },
    garden: function (c, x, y) {
      box(c, x - 60, y - 26, 120, 52, '#2c2218', '#4a3a28');
      for (var i = 0; i < 4; i++) line(c, x - 54, y - 16 + i * 11, x + 54, y - 16 + i * 11, '#3a2d20', 3);
      if (G.story.hasFlag('garden_built')) { c.fillStyle = '#5f8a48'; for (var j = 0; j < 12; j++) { c.beginPath(); c.arc(x - 50 + j * 9, y - 16 + (j % 4) * 11, 2.6, 0, 6.283); c.fill(); } }
    },
    tent: function (c, x, y) {                                    // torn tent, cold fire ring, overturned stroller
      shadow(c, x - 30, y + 14, 46, 12);
      c.fillStyle = '#4a5240'; c.beginPath(); c.moveTo(x - 66, y + 18); c.lineTo(x - 30, y - 30); c.lineTo(x + 6, y + 18); c.closePath(); c.fill();
      c.strokeStyle = '#262b22'; c.lineWidth = 1.3; c.stroke();
      c.fillStyle = '#1a1d18'; c.beginPath(); c.moveTo(x - 36, y + 18); c.lineTo(x - 26, y - 2); c.lineTo(x - 18, y + 18); c.closePath(); c.fill();
      c.fillStyle = '#6a6e68'; for (var i = 0; i < 8; i++) { c.beginPath(); c.arc(x + 34 + Math.cos(i * 0.785) * 14, y + 8 + Math.sin(i * 0.785) * 8, 3.4, 0, 6.283); c.fill(); }
      box(c, x + 52, y + 12, 26, 14, '#5a3e3a', '#2a1c1a'); c.strokeStyle = '#1c1c1c'; c.lineWidth = 2; c.beginPath(); c.arc(x + 56, y + 28, 4, 0, 6.283); c.arc(x + 74, y + 28, 4, 0, 6.283); c.stroke();
    },
    carving: function (c, x, y) {                                 // a dead trunk with a pale arrow cut into it
      shadow(c, x, y + 4, 14, 5);
      box(c, x - 7, y - 46, 14, 50, '#4a4038', '#241e18');
      c.strokeStyle = '#cfc4a8'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - 3, y - 20); c.lineTo(x + 3, y - 30); c.moveTo(x - 3, y - 30); c.lineTo(x + 3, y - 30); c.moveTo(x + 3, y - 30); c.lineTo(x + 3, y - 24); c.stroke();
    },
    cache: function (c, x, y) {
      shadow(c, x, y + 8, 22, 7);
      box(c, x - 18, y - 12, 36, 22, '#4a3c2a', '#241c12');
      c.strokeStyle = '#3f4a30'; c.lineWidth = 2; for (var i = 0; i < 6; i++) { c.beginPath(); c.moveTo(x - 20 + i * 8, y - 16); c.lineTo(x - 10 + i * 8, y + 6); c.stroke(); }
      c.fillStyle = '#62665f'; c.beginPath(); c.arc(x - 24, y + 8, 6, 0, 6.283); c.arc(x + 26, y + 6, 7, 0, 6.283); c.fill();
    },
    chime: function (c, x, y, t, st, e) {                         // a post with brass tubes: sways slowly while it is still up
      var sway = Math.sin(t * 1.4 + x * 0.013) * 1.6;
      shadow(c, x, y + 3, 10, 4);
      line(c, x, y + 2, x, y - 46, '#4a3e30', 3);
      line(c, x - 12, y - 44, x + 12, y - 44, '#4a3e30', 2);
      for (var i = -1; i <= 1; i++) {
        var tx = x + i * 8 + sway * 0.4, len = 16 - Math.abs(i) * 4;
        line(c, x + i * 8, y - 44, tx, y - 44 + len, '#b59a5a', 3);
      }
    },
    hives: function (c, x, y) {
      for (var i = 0; i < 4; i++) {
        var hx = x - 66 + i * 36;
        shadow(c, hx, y + 10, 14, 4);
        box(c, hx - 11, y - 12, 22, 22, '#b7b4a8', '#58554c'); box(c, hx - 13, y - 17, 26, 6, '#8a8678', '#4a4840');
        box(c, hx - 4, y + 2, 8, 3, '#2a2822');
      }
    },
    slate: function (c, x, y) {
      shadow(c, x, y + 4, 14, 4);
      box(c, x - 2, y - 6, 4, 12, '#4a3e30');
      box(c, x - 15, y - 28, 30, 22, '#34393a', '#5a4a38');
      c.strokeStyle = 'rgba(220,222,210,0.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 10, y - 21); c.lineTo(x + 8, y - 22); c.moveTo(x - 10, y - 15); c.lineTo(x + 3, y - 14); c.stroke();
    },
    goat: function (c, x, y) {
      shadow(c, x, y + 6, 20, 5);
      c.fillStyle = '#c9c6bb'; c.beginPath(); c.ellipse(x, y - 8, 15, 8, 0, 0, 6.283); c.fill();
      c.beginPath(); c.arc(x + 15, y - 14, 5, 0, 6.283); c.fill();
      line(c, x - 8, y - 2, x - 8, y + 6, '#8a877c', 2); line(c, x + 8, y - 2, x + 8, y + 6, '#8a877c', 2);
      line(c, x + 16, y - 19, x + 14, y - 25, '#8a877c', 1.5);
      line(c, x - 15, y - 8, x - 30, y + 4, '#6a5a44', 1);
    },
    relaymast: function (c, x, y) {                               // a ladder against the wall and a folded mast at its foot
      shadow(c, x, y + 6, 22, 5);
      line(c, x - 9, y - 46, x - 9, y + 4, '#6a5a44', 2.2); line(c, x + 9, y - 46, x + 9, y + 4, '#6a5a44', 2.2);
      for (var r = 0; r < 6; r++) line(c, x - 9, y - 40 + r * 8, x + 9, y - 40 + r * 8, '#7a6a52', 1.4);
      box(c, x + 16, y - 4, 22, 8, '#3c4448', '#5c6a70');
    },
    mailbag: function (c, x, y) {                                 // a canvas post bag, tipped over, letters spilling
      shadow(c, x, y + 6, 22, 5);
      box(c, x - 18, y - 12, 36, 20, '#4a5258', '#2c3236');
      box(c, x - 18, y - 12, 36, 6, '#5a636a');
      box(c, x + 14, y + 6, 12, 8, '#d6d2c0'); box(c, x + 22, y + 10, 12, 8, '#c9c4b0');
    },
    paper: function (c, x, y) {                                   // a sheet or booklet left lying about
      box(c, x - 9, y - 7, 18, 14, '#c9c4b0', '#8a8472');
      line(c, x - 5, y - 2, x + 5, y - 2, '#7a7466', 1); line(c, x - 5, y + 2, x + 3, y + 2, '#7a7466', 1);
    },
    plank: function (c, x, y) {                                   // one floorboard that sits a little proud
      box(c, x - 22, y - 3, 44, 6, '#5a4a38', '#3a2e22');
    },
    safebox: function (c, x, y) {
      shadow(c, x, y + 6, 16, 4);
      box(c, x - 14, y - 16, 28, 22, '#3a4044', '#1e2224');
      c.fillStyle = '#8a8472'; c.beginPath(); c.arc(x + 3, y - 5, 3, 0, 6.283); c.fill();
    },
    dog: function (c, x, y) {                                     // a thin dog sitting by an empty bowl
      shadow(c, x, y + 6, 16, 4);
      c.fillStyle = '#7a6a54'; c.beginPath(); c.ellipse(x, y - 6, 11, 7, 0, 0, 6.283); c.fill();
      c.beginPath(); c.arc(x + 11, y - 13, 5, 0, 6.283); c.fill();
      line(c, x - 8, y - 1, x - 8, y + 6, '#5a4a38', 2); line(c, x + 6, y - 1, x + 6, y + 6, '#5a4a38', 2);
      box(c, x - 26, y + 2, 10, 4, '#5c6a70');
    },
    npc: function (c, x, y, t, st, e) {                           // a standing character: its own body
      var n = npcs[e.id];
      if (n) G.player.draw(c, n, 1, t);
    }
  };

  var art = {
    // Per tick: the standing characters turn their heads to the player.
    tick: function (dt, area, p, world) {
      var l = G.story.visibleSpots(area), i, e, n, cfg = G.config.player;
      for (i = 0; i < l.length; i++) {
        e = l[i];
        if (e.p.art !== 'npc') continue;
        n = npcs[e.id];
        if (!n) { n = npcs[e.id] = G.player.create(e.x, e.y, { radius: 14, walkSpeed: 0, runMult: 1 }); n.look = e.p.look || 'rachel'; G.player.settle(n, Math.PI / 2); }
        var near = Math.hypot(p.x - e.x, p.y - e.y) < 420;
        G.player.update(n, { x: 0, y: 0, run: false }, near ? { x: p.x, y: p.y } : null, dt, world, { radius: 14, walkSpeed: 0, runMult: 1 });
        G.player.animate(n, dt, null);
      }
    },

    // Everything of the story visible in view `vr` ({x0,y0,x1,y1}), plus a quiet marker when the player is close.
    draw: function (c, area, vr, time, p) {
      var l = G.story.visibleSpots(area), i, e, f, d, prog;
      for (i = 0; i < l.length; i++) {
        e = l[i];
        if (e.x < vr.x0 - 160 || e.x > vr.x1 + 160 || e.y < vr.y0 - 160 || e.y > vr.y1 + 160) continue;
        if (ART[e.p.art]) ART[e.p.art](c, e.x, e.y, time, null, e);
        if (e.s.kind === 'listen' || e.p.art === 'npc') continue;
        d = Math.hypot(p.x - e.x, p.y - e.y);
        f = Math.max(0, Math.min(1, (e.r + 170 - d) / 170));
        if (f <= 0) continue;
        c.strokeStyle = 'rgba(205,214,184,' + (0.42 * f).toFixed(3) + ')'; c.lineWidth = 1.4;
        c.beginPath(); c.arc(e.x, e.y + 12, 9, 0, 6.283); c.stroke();
        prog = G.story.holdProgress(e.id) / (e.s.hold || 2);
        if (prog > 0) { c.strokeStyle = 'rgba(220,230,196,0.85)'; c.lineWidth = 3; c.beginPath(); c.arc(e.x, e.y + 12, 13, -1.5708, -1.5708 + prog * 6.283); c.stroke(); }
      }
    },

    forget: function () { npcs = {}; }
  };

  G.storyArt = art;
})(typeof window !== 'undefined' ? window : globalThis);
