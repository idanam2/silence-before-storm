// Drawing for the forest cellar, the irradiated zone and sealed rooms:
//   G.doorArt.draw   hatches and gates standing in the open (doors of non-interior areas with `art`: 'hatch' | 'rad')
//   G.darkArt        darkness over a dark area (only light near the player and the area's `lights`) + the glow under glowers
//   'bwall' kind     a wall boarded up with planks (area.structures { kind: 'bwall', breakable: true, hp })
(function (root) {
  'use strict';
  var G = root.G, TAU = Math.PI * 2;
  if (!G) return;

  // ---- hatches and gates in the open ----
  function hatch(ctx, d, time) {
    var x = d.x, y = d.y, w = 92, h = 64;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - w / 2 - 6, y - h / 2 - 4, w + 12, h + 14);          // dirt shadow
    ctx.fillStyle = '#4a3f33'; ctx.fillRect(x - w / 2 - 8, y - h / 2 - 8, w + 16, h + 16);                  // stone frame
    ctx.fillStyle = '#2a2f33'; ctx.fillRect(x - w / 2, y - h / 2, w, h);                                    // steel doors
    ctx.strokeStyle = '#14181a'; ctx.lineWidth = 2; ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    ctx.beginPath(); ctx.moveTo(x, y - h / 2); ctx.lineTo(x, y + h / 2); ctx.stroke();
    ctx.fillStyle = '#4e575c'; for (var i = 0; i < 4; i++) { ctx.fillRect(x - w / 2 + 6, y - h / 2 + 8 + i * 14, w / 2 - 12, 3); ctx.fillRect(x + 6, y - h / 2 + 8 + i * 14, w / 2 - 12, 3); }
    ctx.fillStyle = '#8a7a50'; ctx.fillRect(x - 10, y - 4, 7, 8); ctx.fillRect(x + 3, y - 4, 7, 8);        // handles
    ctx.fillStyle = 'rgba(70,110,50,0.4)'; ctx.fillRect(x - w / 2 - 8, y + h / 2 + 2, w + 16, 5);           // moss
  }
  function radGate(ctx, d, time) {
    var x = d.x, y = d.y, pulse = 0.5 + 0.5 * Math.sin(time * 2.6);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 110, y - 8, 220, 22);
    ctx.fillStyle = '#4b4f4a'; ctx.fillRect(x - 110, y - 16, 18, 26); ctx.fillRect(x + 92, y - 16, 18, 26);   // posts
    ctx.strokeStyle = '#7a7d76'; ctx.lineWidth = 3;                                                          // mesh gate
    ctx.beginPath(); ctx.moveTo(x - 92, y - 6); ctx.lineTo(x + 92, y - 6); ctx.moveTo(x - 92, y + 6); ctx.lineTo(x + 92, y + 6); ctx.stroke();
    ctx.lineWidth = 1; for (var i = -88; i <= 88; i += 12) { ctx.beginPath(); ctx.moveTo(x + i, y - 6); ctx.lineTo(x + i + 8, y + 6); ctx.stroke(); }
    ctx.fillStyle = '#d6b92a'; ctx.beginPath(); ctx.moveTo(x, y - 62); ctx.lineTo(x + 26, y - 18); ctx.lineTo(x - 26, y - 18); ctx.closePath(); ctx.fill();   // warning sign
    ctx.strokeStyle = '#1c1c14'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#1c1c14'; ctx.beginPath(); ctx.arc(x, y - 33, 3.5, 0, TAU); ctx.fill();
    for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x, y - 33); ctx.arc(x, y - 33, 13, k * TAU / 3 + 0.5, k * TAU / 3 + 1.55); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = 'rgba(130,255,90,' + (0.15 + pulse * 0.2).toFixed(3) + ')'; ctx.lineWidth = 2;      // a faint green pulse on the ground
    ctx.beginPath(); ctx.arc(x, y + 30, 70, 0, TAU); ctx.stroke();
  }
  G.doorArt = {
    draw: function (ctx, area, vr, time) {
      for (var i = 0; i < area.doors.length; i++) {
        var d = area.doors[i];
        if (!d.art || d.x < vr.x0 - 160 || d.x > vr.x1 + 160 || d.y < vr.y0 - 160 || d.y > vr.y1 + 160) continue;
        if (d.art === 'hatch') hatch(ctx, d, time); else if (d.art === 'rad') radGate(ctx, d, time);
      }
    }
  };

  // ---- darkness: one overlay at half resolution (soft light does not need more). In a dark area: black everywhere except a
  // small glow around the player, a flashlight beam in the direction he faces, and static pools of light at area.lights.
  // A sealed room (a boarded 'bwall' with a  rectangle) is pitch black until its wall is broken: nothing of it shows. ----
  var cv = null, cx2 = null, beamA = null, lampSpr = {}, glowSpr = null;
  function lampSprite(r) {                                                   // a pre-drawn pool of light, one per radius
    var k = Math.round(r / 10) * 10;
    if (!lampSpr[k]) {
      var c = document.createElement('canvas'), n = Math.max(8, Math.ceil(k)); c.width = c.height = n * 2;
      var g = c.getContext('2d'), gr = g.createRadialGradient(n, n, n * 0.1, n, n, n);
      gr.addColorStop(0, 'rgba(0,0,0,0.9)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, n * 2, n * 2); lampSpr[k] = { c: c, n: n };
    }
    return lampSpr[k];
  }
  function sealedRooms(area) {
    var out = null;
    for (var i = 0; i < area.structures.length; i++) { var s = area.structures[i]; if (s.room && s.breakable && !s.smashed) (out = out || []).push(s.room); }
    return out;
  }
  function angDiff(a, b) { var d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
  G.darkArt = {
    // area.dark = { level: 0..1 how black it is (default 0.95), torch: reach of the beam in world px (default 260) }
    needed: function (area) { return !!area.dark || !!sealedRooms(area); },
    draw: function (ctx, area, canvas, camX, camY, dpr, p, py, time) {
      var D = area.dark, sc = dpr * 0.5, w = Math.max(2, Math.ceil(canvas.width / 2)), h = Math.max(2, Math.ceil(canvas.height / 2));
      if (!cv) { cv = document.createElement('canvas'); cx2 = cv.getContext('2d'); }
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      cx2.globalCompositeOperation = 'source-over';
      cx2.clearRect(0, 0, w, h);
      var i;
      if (D) {
        cx2.fillStyle = 'rgba(2,3,4,' + (D.level === undefined ? 0.95 : D.level) + ')'; cx2.fillRect(0, 0, w, h);
        cx2.globalCompositeOperation = 'destination-out';
        var L = area.lights || [];
        for (i = 0; i < L.length; i++) {                                     // static lamps: no flicker, no movement
          var sp = lampSprite(L[i][2]), x = (L[i][0] - camX) * sc, y = (L[i][1] - camY) * sc, r = L[i][2] * sc;
          if (x < -r || y < -r || x > w + r || y > h + r) continue;
          cx2.drawImage(sp.c, x - r, y - r, r * 2, r * 2);
        }
        var px = (p.x - camX) * sc, pyy = (py - 26 - camY) * sc, reach = (D.torch || 340) * sc, ar = 62 * sc;
        if (beamA === null) beamA = p.angle;
        beamA += angDiff(p.angle, beamA) * 0.16;                             // the beam turns smoothly after where you look
        var g = cx2.createRadialGradient(px, pyy, ar * 0.2, px, pyy, ar);   // a small glow right around you
        g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        cx2.fillStyle = g; cx2.beginPath(); cx2.arc(px, pyy, ar, 0, TAU); cx2.fill();
        var spreads = [0.5, 0.36, 0.22], alph = [0.55, 0.65, 0.8];           // three nested cones: a soft edge
        for (i = 0; i < 3; i++) {
          var bg = cx2.createRadialGradient(px, pyy, reach * 0.05, px, pyy, reach);
          bg.addColorStop(0, 'rgba(0,0,0,' + alph[i] + ')'); bg.addColorStop(0.6, 'rgba(0,0,0,' + (alph[i] * 0.6) + ')'); bg.addColorStop(1, 'rgba(0,0,0,0)');
          cx2.fillStyle = bg; cx2.beginPath(); cx2.moveTo(px, pyy); cx2.arc(px, pyy, reach, beamA - spreads[i], beamA + spreads[i]); cx2.closePath(); cx2.fill();
        }
      }
      var rooms = sealedRooms(area);
      if (rooms) {                                                           // sealed rooms: solid black, taller than the room so tall things in it are hidden too
        cx2.globalCompositeOperation = 'source-over'; cx2.fillStyle = '#020304';
        for (i = 0; i < rooms.length; i++) { var q = rooms[i]; cx2.fillRect((q.x - camX) * sc, (q.y - 70 - camY) * sc, q.w * sc, (q.h + 70) * sc); }
      }
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(cv, 0, 0, canvas.width, canvas.height);
    },
    // the irradiated glow: a soft green disc under the feet, pulsing slowly
    halo: function (ctx, e, time) {
      if (e.state === 'dead') return;
      var def = G.data.enemies.types[e.type];
      if (!def || !def.glow) return;
      var r = 58 + 6 * Math.sin(time * 3 + (e.uid || 0)), gr = ctx.createRadialGradient(e.x, e.y - 14, 4, e.x, e.y - 14, r);
      gr.addColorStop(0, 'rgba(' + def.glow + ',0.4)'); gr.addColorStop(1, 'rgba(' + def.glow + ',0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(e.x, e.y - 14, r, 0, TAU); ctx.fill();
    }
  };

  // ---- the stash in a sealed room: a small chest with a band of colour for what is inside ----
  if (G.placeArt && G.placeArt.sprite) [['stash_food', '#7a6a3a'], ['stash_med', '#8a3a34'], ['stash_parts', '#3a5a52'], ['stash_ammo', '#8a8a6a'], ['stash_arms', '#2a2e30']].forEach(function (d, n) {
    G.placeArt.sprite(d[0], 2, 700 + n * 7, 56, 48, function (g) {
      g.translate(28, 26);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(2, 12, 26, 8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4a3a28'; g.fillRect(-20, -12, 40, 24); g.strokeStyle = '#1e160e'; g.lineWidth = 2; g.strokeRect(-20, -12, 40, 24);
      g.fillStyle = '#5e4a34'; g.fillRect(-20, -12, 40, 9);
      g.fillStyle = d[1]; g.fillRect(-20, -2, 40, 5);
      g.fillStyle = '#b9a35a'; g.fillRect(-3, -4, 6, 8);
    });
  });

  // ---- a wall boarded up with planks and bolted straps: looks like it wants an axe ----
  if (G.placeArt && G.placeArt.register) G.placeArt.register('bwall', function (ctx, s, c, time, H) {
    var k = s.k || 0.07, horiz = s.w >= s.h, bx = H.box(ctx, s, 0, k, c, '#5a4a38', '#6a573f'), side = horiz ? 2 : 1;
    if (bx.vis && !bx.vis[side]) return;
    var n = 5, i, u0, u1, hh = (s.hp !== undefined && s.hp < 3) ? 0.9 : 1;
    for (i = 0; i < n; i++) {                                                  // horizontal planks across the face
      var f0 = k * (0.08 + i * 0.17), f1 = f0 + k * 0.13;
      H.poly(ctx, [H.onFace(s, side, 0.02, f0, c), H.onFace(s, side, 0.98, f0 + (i % 2 ? 0.002 : 0), c), H.onFace(s, side, 0.98, f1, c), H.onFace(s, side, 0.02, f1, c)], i % 2 ? '#7a6446' : '#6a5538');
    }
    ctx.strokeStyle = 'rgba(20,14,8,0.45)'; ctx.lineWidth = 2;
    H.line(ctx, H.onFace(s, side, 0.5, k * 0.05, c), H.onFace(s, side, 0.5, k * 0.95, c));
    if (s.hp !== undefined && s.hp < 4) { ctx.strokeStyle = 'rgba(15,10,6,0.7)'; H.line(ctx, H.onFace(s, side, 0.3, k * 0.9, c), H.onFace(s, side, 0.55, k * 0.15, c)); }   // cracks after a blow
  });
})(typeof window !== 'undefined' ? window : globalThis);
