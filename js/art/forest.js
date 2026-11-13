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
  // ---- radioactive floor patches, valves ----
  function radPatch(ctx, r, time, live) {
    if (!live) {                                                       // dried residue after the valve is shut: dark stains, no glow
      ctx.fillStyle = 'rgba(30,40,20,0.35)'; ctx.fillRect(r.x + 14, r.y + 14, r.w - 28, r.h - 28);
      return;
    }
    var pulse = 0.5 + 0.5 * Math.sin(time * 1.3), cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = Math.max(r.w, r.h) * 0.62;
    var gr = ctx.createRadialGradient(cx, cy, rad * 0.1, cx, cy, rad);
    gr.addColorStop(0, 'rgba(150,255,70,' + (0.5 + pulse * 0.1).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(90,200,50,0.18)');
    ctx.fillStyle = gr; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(214,185,42,0.95)'; ctx.lineWidth = 5; ctx.setLineDash([22, 18]); ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4); ctx.setLineDash([]);   // hazard tape
    ctx.strokeStyle = 'rgba(30,30,20,0.9)'; ctx.lineWidth = 5; ctx.setLineDash([18, 22]); ctx.lineDashOffset = -20; ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4); ctx.setLineDash([]); ctx.lineDashOffset = 0;
    ctx.fillStyle = 'rgba(210,255,150,0.28)';                          // bubbles drifting up, slowly
    for (var i = 0; i < 7; i++) {
      var bx = r.x + ((i * 97 + 31) % Math.max(40, r.w - 40)) + 20, by = r.y + r.h - ((time * 14 + i * 53) % Math.max(40, r.h - 20));
      ctx.beginPath(); ctx.arc(bx, by, 3 + (i % 3) * 2, 0, TAU); ctx.fill();
    }
  }
  function valve(ctx, v, time) {
    var x = v.x, y = v.y, closed = !!v.closed;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 12, 26, 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5a5e5a'; ctx.fillRect(x - 36, y - 6, 72, 12); ctx.strokeStyle = '#1c1f1c'; ctx.lineWidth = 2; ctx.strokeRect(x - 36, y - 6, 72, 12);   // the pipe stub
    ctx.fillStyle = '#74786f'; ctx.fillRect(x - 40, y - 9, 8, 18); ctx.fillRect(x + 32, y - 9, 8, 18);
    ctx.fillStyle = '#4a4f4a'; ctx.fillRect(x - 6, y - 18, 12, 14);                                                                                   // the body
    ctx.strokeStyle = closed ? '#3d8a3a' : '#c0392b'; ctx.lineWidth = 4;                                                                              // the red wheel turns green when it is shut
    ctx.beginPath(); ctx.arc(x, y - 22, 14, 0, TAU); ctx.stroke();
    var a = closed ? 0.8 : 0;
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 14, y - 22 - Math.sin(a) * 14); ctx.lineTo(x + Math.cos(a) * 14, y - 22 + Math.sin(a) * 14); ctx.stroke();
  }
  G.doorArt = {
    draw: function (ctx, area, vr, time) {
      var i;
      for (i = 0; area.rads && i < area.rads.length; i++) {
        var r = area.rads[i];
        if (r.x + r.w < vr.x0 || r.x > vr.x1 || r.y + r.h < vr.y0 - 80 || r.y > vr.y1) continue;
        radPatch(ctx, r, time, !(r.leak && G.area.valveClosed(area, r.leak)));
      }
      for (i = 0; area.valves && i < area.valves.length; i++) {
        var v = area.valves[i];
        if (v.x > vr.x0 - 80 && v.x < vr.x1 + 80 && v.y > vr.y0 - 80 && v.y < vr.y1 + 80) valve(ctx, v, time);
      }
      for (i = 0; area.doors && i < area.doors.length; i++) {
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
      if (rooms) {                                                           // ... but not the boarded wall itself: it has to be seen, that is where you strike
        cx2.globalCompositeOperation = 'destination-out'; cx2.fillStyle = '#000';
        for (i = 0; i < area.structures.length; i++) { var bw = area.structures[i]; if (bw.room && bw.breakable && !bw.smashed) cx2.fillRect((bw.x - 6 - camX) * sc, (bw.y - 56 - camY) * sc, (bw.w + 12) * sc, (bw.h + 62) * sc); }
        cx2.globalCompositeOperation = 'source-over';
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

  // ---- a pipe along a wall (solid: false); with  (an id) it drips green until that valve is closed ----
  if (G.placeArt && G.placeArt.register) G.placeArt.register('pipe', function (ctx, s, c, time, H) {
    var live = s.valve && !(G.state.zone && G.area.valveClosed(G.state.zone, s.valve));
    H.box(ctx, s, 0.05, s.k || 0.09, c, live ? '#6a6f58' : '#5e625e', live ? '#8a9070' : '#7a7e78');
    var n = Math.max(2, Math.round(Math.max(s.w, s.h) / 110)), i, horiz = s.w >= s.h;
    ctx.fillStyle = '#3a3e3a';
    for (i = 0; i <= n; i++) { var u = i / n, p0 = horiz ? H.lift(s.x + s.w * u - 5, s.y - 2, (s.k || 0.09) + 0.002, c) : H.lift(s.x - 2, s.y + s.h * u - 5, (s.k || 0.09) + 0.002, c); ctx.fillRect(p0[0], p0[1], horiz ? 10 : s.w + 4, horiz ? s.h + 4 : 10); }
    if (live) {                                                          // the leak: a slow green drip from the end of the pipe
      var e = horiz ? H.lift(s.x + s.w, s.y + s.h / 2, (s.k || 0.09), c) : H.lift(s.x + s.w / 2, s.y + s.h, (s.k || 0.09), c);
      for (i = 0; i < 4; i++) { var t = (time * 0.9 + i * 0.25) % 1; ctx.fillStyle = 'rgba(150,255,70,' + (0.75 * (1 - t)).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(e[0] + (i - 1.5) * 3, e[1] + t * 40, 2.2, 3.5, 0, 0, TAU); ctx.fill(); }
      var gr = ctx.createRadialGradient(e[0], e[1] + 14, 2, e[0], e[1] + 14, 36); gr.addColorStop(0, 'rgba(150,255,70,0.4)'); gr.addColorStop(1, 'rgba(150,255,70,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(e[0], e[1] + 14, 36, 0, TAU); ctx.fill();
    }
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
