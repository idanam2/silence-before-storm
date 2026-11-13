// Vehicle drawing (top-down bodies seen from above, heading = angle, 0 = east): motorcycle, quad bike, jeep, helicopter, tank.
// draw(ctx, v, time) paints one vehicle in the world; icon(g, id) paints the bag / bench icon (64x64). Data: data/vehicles.js.
// A ridden bike or quad leaves the player's body visible on top; a closed cab (covers(id)) hides the rider instead.
(function (root) {
  'use strict';
  var G = root.G, TAU = Math.PI * 2;

  function rr(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
  }
  function fillStroke(c, fill, stroke, lw) {
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1.2; c.stroke(); }
  }
  function shade(hex, k) {                                  // '#rrggbb' scaled by k (<1 darker, >1 lighter)
    var n = parseInt(hex.slice(1), 16), r = Math.min(255, (n >> 16) * k), g = Math.min(255, ((n >> 8) & 255) * k), b = Math.min(255, (n & 255) * k);
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  // A wheel / tyre seen from above: dark block with tread marks that run while the vehicle moves (phase 0..1).
  function wheel(c, cx, cy, len, wid, phase) {
    rr(c, cx - len / 2, cy - wid / 2, len, wid, Math.min(len, wid) * 0.35);
    fillStroke(c, '#1b1d1c', '#0c0d0c', 1);
    c.strokeStyle = 'rgba(120,125,118,0.45)'; c.lineWidth = 1.4;
    for (var i = 0; i < 3; i++) {
      var x = cx - len / 2 + ((i / 3 + phase) % 1) * len;
      c.beginPath(); c.moveTo(x, cy - wid / 2 + 1); c.lineTo(x, cy + wid / 2 - 1); c.stroke();
    }
  }

  var BODY = {
    motorcycle: function (c, d, o) {
      var wl = o.up.wheels || 0, en = o.up.engine || 0, tk = o.up.tank || 0;                  // fitted upgrades (garage workshop)
      wheel(c, -15 - wl, 0, 15 + wl * 3, 5 + wl * 0.9, o.ph); wheel(c, 16 + wl, 0, 15 + wl * 3, 5 + wl * 0.9, o.ph);   // bigger wheels
      rr(c, -12, -3, 28, 6, 3); fillStroke(c, '#2a2c2b', '#0d0e0d', 1);                      // frame
      if (en) {                                                                               // a stronger engine: chrome cylinders and pipes
        rr(c, -9, -6.5, 9, 13, 2); fillStroke(c, '#8a9094', '#1b1e20', 1);
        c.strokeStyle = '#b8bec2'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-8, -7.5 - en * 0.4); c.lineTo(-22 - en * 2, -7.5 - en * 0.4); c.moveTo(-8, 7.5 + en * 0.4); c.lineTo(-22 - en * 2, 7.5 + en * 0.4); c.stroke();
      }
      c.beginPath(); c.ellipse(3, 0, 8 + tk * 1.6, 5.5 + tk * 0.9, 0, 0, TAU); fillStroke(c, d.color, shade(d.color, 0.45), 1.2);   // fuel tank (bigger with the tank upgrade)
      if (tk) { c.strokeStyle = 'rgba(235,225,200,0.55)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-3, -2.6); c.lineTo(9 + tk, -2.6); c.stroke(); }
      rr(c, -6, -3.4, 12, 6.8, 3); fillStroke(c, '#25201d', '#0d0e0d', 1);                  // seat
      c.strokeStyle = '#17191a'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(13, -9); c.lineTo(13, 9); c.stroke();   // handlebar
      c.fillStyle = '#e8dca0'; c.beginPath(); c.arc(21, 0, 2.4, 0, TAU); c.fill();           // headlight
    },
    atv: function (c, d, o) {
      var wl = o.up.wheels || 0, en = o.up.engine || 0, tk = o.up.tank || 0;
      [[-17, -15], [-17, 15], [17, -15], [17, 15]].forEach(function (w) { wheel(c, w[0] + Math.sign(w[0]) * wl, w[1] + Math.sign(w[1]) * wl * 0.8, 15 + wl * 3, 10 + wl * 1.6, o.ph); });
      rr(c, -23, -11, 46, 22, 7); fillStroke(c, d.color, shade(d.color, 0.45), 1.3);        // body
      if (en) { c.strokeStyle = '#b8bec2'; c.lineWidth = 2; c.beginPath(); c.moveTo(-23, -5); c.lineTo(-30 - en * 2, -5); c.moveTo(-23, 5); c.lineTo(-30 - en * 2, 5); c.stroke(); }
      if (tk) { rr(c, -2, -5, 8 + tk * 2, 10, 3); fillStroke(c, '#8a3a2e', '#2a0f0b', 1); }
      rr(c, -4, -9, 22, 18, 5); fillStroke(c, shade(d.color, 1.15), shade(d.color, 0.5), 1);   // front cover
      rr(c, -8, -8, 16, 16, 4); fillStroke(c, '#26221f', '#0d0e0d', 1);                    // seat
      c.strokeStyle = '#16181a'; c.lineWidth = 3; c.beginPath(); c.moveTo(14, -13); c.lineTo(14, 13); c.stroke();   // handlebar
      c.fillStyle = '#e8dca0'; c.fillRect(24, -8, 2.5, 4); c.fillRect(24, 4, 2.5, 4);
    },
    jeep: function (c, d, o) {
      var wl = o.up.wheels || 0, en = o.up.engine || 0, tk = o.up.tank || 0;                  // fitted upgrades (garage workshop)
      [[-28, -26], [-28, 26], [27, -26], [27, 26]].forEach(function (w) { wheel(c, w[0], w[1] + Math.sign(w[1]) * wl * 1.2, 20 + wl * 4, 9 + wl * 1.8, o.ph); });   // bigger wheels
      if (en) { c.strokeStyle = '#b8bec2'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-45, -12); c.lineTo(-54 - en * 2, -12); c.moveTo(-45, 12); c.lineTo(-54 - en * 2, 12); c.stroke(); }   // exhausts
      rr(c, -45, -22, 90, 44, 8); fillStroke(c, d.color, shade(d.color, 0.42), 1.4);        // body
      rr(c, 12, -19, 30, 38, 6); fillStroke(c, shade(d.color, 1.12), shade(d.color, 0.5), 1);   // hood
      c.beginPath(); c.moveTo(8, -19); c.lineTo(14, -17); c.lineTo(14, 17); c.lineTo(8, 19); c.closePath(); fillStroke(c, '#6f8590', '#1c2328', 1);   // windscreen
      rr(c, -36, -18, 42, 36, 5); fillStroke(c, shade(d.color, 0.8), shade(d.color, 0.4), 1);   // canvas top
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1;
      for (var i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-36 + i * 10.5, -17); c.lineTo(-36 + i * 10.5, 17); c.stroke(); }
      if (en) { rr(c, 30, -17, 12, 5, 2); fillStroke(c, '#8a9094', '#1b1e20', 1); }           // chrome air intake on the hood
      if (tk) for (var j = 0; j < tk; j++) { rr(c, -34 + j * 11, -24, 9, 6, 2); fillStroke(c, '#8a3a2e', '#2a0f0b', 1); }   // extra fuel cans on the side
      c.beginPath(); c.arc(-48, 0, 8, 0, TAU); fillStroke(c, '#1b1d1c', '#0c0d0c', 1);        // spare wheel on the tail
      c.fillStyle = '#e8dca0'; c.fillRect(43, -16, 3, 6); c.fillRect(43, 10, 3, 6);
    },
    // A utility helicopter standing on its skids. Three heights, each drawn a little further "north" on screen whatever the
    // heading: the skids on the ground, the fuselage above them (its dark belly shows), the rotor above the roof.
    heli: function (c, d, o) {
      var a = o.a || 0, ux = -Math.sin(a), uy = -Math.cos(a), h, i;
      var hen = o.up.engine || 0, hro = o.up.rotor || 0, htk = o.up.tank || 0, RL = 62 + hro * 5;       // fitted upgrades (garage workshop)
      c.scale(1.3, 1.3);                                                                         // a helicopter is a big machine next to a person
      function fus() {
        c.beginPath(); c.moveTo(44, 0);
        c.bezierCurveTo(44, -10, 32, -16, 14, -16); c.lineTo(-6, -15.5);
        c.bezierCurveTo(-18, -14, -22, -5, -32, -3.6); c.lineTo(-86, -1.8); c.lineTo(-86, 1.8); c.lineTo(-32, 3.6);
        c.bezierCurveTo(-22, 5, -18, 14, -6, 15.5); c.lineTo(14, 16);
        c.bezierCurveTo(32, 16, 44, 10, 44, 0); c.closePath();
      }
      c.strokeStyle = '#14171a'; c.lineCap = 'round';                                            // skids and their cross tubes
      [-1, 1].forEach(function (s) { c.lineWidth = 3; c.beginPath(); c.moveTo(-16, s * 20); c.lineTo(28, s * 20); c.lineTo(32, s * 18.5); c.stroke(); });
      c.lineWidth = 2; [-4, 18].forEach(function (x) { c.beginPath(); c.moveTo(x, -20); c.lineTo(x, 20); c.stroke(); });
      for (i = 0; i < htk; i++) [-1, 1].forEach(function (s) { rr(c, -12 + i * 14, s * 22 - 3.5, 22, 7, 3.5); fillStroke(c, '#8a3a2e', '#2a0f0b', 1); });   // extra fuel pods on the skids
      for (h = 2; h <= 9; h += 2.333) { c.save(); c.translate(ux * h, uy * h); fus(); fillStroke(c, '#1a1e22'); c.restore(); }   // belly and sides
      c.save(); c.translate(ux * 10, uy * 10);
      rr(c, -80, -13, 8, 26, 2); fillStroke(c, shade(d.color, 0.9), '#0b0e10', 1.1);            // tail plane
      fus(); fillStroke(c, d.color, '#0b0e10', 1.4);
      c.save(); fus(); c.clip();
      c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(-90, -17, 140, 9);                      // light along the sunny flank
      c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(-90, 8, 140, 10);
      c.fillStyle = '#a8a28c'; c.fillRect(-62, -5, 5, 10);                                       // pale band on the boom
      c.fillStyle = '#8a3a2a'; c.fillRect(-55, -5, 2.5, 10);
      c.restore();
      c.strokeStyle = 'rgba(0,0,0,0.42)'; c.lineWidth = 1;                                       // door and panel seams
      [[-4, -15.5, -4, 15.5], [11, -16, 11, 16], [-4, 0, 11, 0]].forEach(function (l) { c.beginPath(); c.moveTo(l[0], l[1]); c.lineTo(l[2], l[3]); c.stroke(); });
      [-9.5, 9.5].forEach(function (y) { rr(c, -1, y - 2.6, 9, 5.2, 1.5); fillStroke(c, '#1e2b31', '#0b0e10', 0.9); });   // cabin windows
      c.beginPath(); c.moveTo(42, 0); c.bezierCurveTo(42, -8.5, 32, -13.5, 17, -13.5); c.lineTo(13.5, -13.5); c.lineTo(13.5, 13.5); c.lineTo(17, 13.5);
      c.bezierCurveTo(32, 13.5, 42, 8.5, 42, 0); c.closePath();                                  // canopy glass
      var gl = c.createLinearGradient(14, -14, 40, 12); gl.addColorStop(0, '#48626c'); gl.addColorStop(0.5, '#2b3d45'); gl.addColorStop(1, '#17232a');
      fillStroke(c, gl, '#0b0e10', 1.2);
      c.strokeStyle = '#11161a'; c.lineWidth = 1.4;                                              // canopy frame
      c.beginPath(); c.moveTo(13.5, 0); c.lineTo(42, 0); c.moveTo(27, -12.6); c.lineTo(27, 12.6); c.stroke();
      c.strokeStyle = 'rgba(220,235,240,0.3)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(18, -9.5); c.quadraticCurveTo(28, -10, 35, -5.5); c.stroke();
      rr(c, -22, -8.5, 22, 17, 5); fillStroke(c, shade(d.color, 0.78), '#0b0e10', 1.2);          // engine cowling
      c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1;
      for (i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-18 + i * 3.2, -5.5); c.lineTo(-18 + i * 3.2, 5.5); c.stroke(); }
      [-6, 6].forEach(function (y) { c.beginPath(); c.ellipse(-23 - hen, y, 3 + hen * 0.6, 2 + hen * 0.3, 0, 0, TAU); fillStroke(c, '#0d0f10', hen ? '#b8bec2' : '#2e3438', 1); });   // exhausts
      c.beginPath(); c.moveTo(-76, -1.8); c.lineTo(-92, -8.5); c.lineTo(-87, -8.5); c.lineTo(-70, -1.8); c.closePath(); fillStroke(c, shade(d.color, 0.85), '#0b0e10', 1.1);   // fin
      c.save(); c.translate(-89, -9.5); c.rotate(o.spin ? o.rot * 3 : 0.5); c.strokeStyle = '#1a1e21'; c.lineWidth = 2;        // tail rotor
      c.beginPath(); c.moveTo(0, -9); c.lineTo(0, 9); c.stroke(); c.restore();
      c.fillStyle = '#c9c4ae'; c.beginPath(); c.arc(43, 0, 1.4, 0, TAU); c.fill();              // nose light
      c.restore();
      c.save(); c.translate(ux * 21 - 4, uy * 21);                                               // main rotor, above the roof
      c.beginPath(); c.arc(0, 0, 5.5, 0, TAU); fillStroke(c, '#22272b', '#0b0e10', 1.2);
      if (o.spin) { c.beginPath(); c.arc(0, 0, RL, 0, TAU); fillStroke(c, 'rgba(190,200,205,0.12)'); }
      c.rotate(o.spin ? o.rot : 0.42);
      for (i = 0; i < 4; i++) {
        c.rotate(TAU / 4);
        c.beginPath(); c.moveTo(3, -1.4); c.lineTo(14, -2.6); c.lineTo(RL, -2.2); c.lineTo(RL, 2.2); c.lineTo(14, 2.6); c.lineTo(3, 1.4); c.closePath();
        fillStroke(c, '#1d2226', '#0a0c0d', 0.9);
        c.fillStyle = '#b49a3a'; c.fillRect(RL - 5, -2.2, 4, 4.4);                                   // warning paint on the tips
      }
      c.beginPath(); c.arc(0, 0, 2.4, 0, TAU); fillStroke(c, '#7c858a');
      c.restore();
    },
    // A survivor-built tank: an old hull under bolted scrap plates, slat armour on the sides, a spiked plough in front,
    // hazard paint on the tail. The hull and the turret are raised (drawn a little "north" on screen, whatever the heading),
    // so the dark side walls show like on the buildings.
    tank: function (c, d, o) {
      var a = o.a || 0, ux = -Math.sin(a), uy = -Math.cos(a), h, i;
      var ten = o.up.engine || 0, ttr = o.up.tracks || 0, ttk = o.up.tank || 0;                      // fitted upgrades (garage workshop)
      function hull() { c.beginPath(); c.moveTo(-56, -25); c.lineTo(34, -25); c.lineTo(54, -15); c.lineTo(54, 15); c.lineTo(34, 25); c.lineTo(-56, 25); c.closePath(); }
      [-1, 1].forEach(function (s) {                                                             // the two tracks, on the ground
        rr(c, -60, s * (29 + ttr * 1.5) - 10 - ttr * 1.5, 120, 20 + ttr * 3, 8); fillStroke(c, '#1b1d19', '#0a0b09', 1.2);
        c.strokeStyle = 'rgba(120,124,110,0.5)'; c.lineWidth = 1.6;
        for (var t = 0; t < 13; t++) { var x = -56 + (((t / 13) + o.ph) % 1) * 112; c.beginPath(); c.moveTo(x, s * 29 - 9); c.lineTo(x, s * 29 + 9); c.stroke(); }
      });
      c.beginPath(); c.moveTo(52, -24); c.lineTo(66, -18); c.lineTo(60, -9); c.lineTo(68, 0); c.lineTo(60, 9); c.lineTo(66, 18); c.lineTo(52, 24); c.closePath();   // spiked plough
      fillStroke(c, '#4a4d4b', '#0d0e0d', 1.3);
      for (h = 2; h <= 12; h += 2) { c.save(); c.translate(ux * h, uy * h); hull(); fillStroke(c, '#23241d'); c.restore(); }   // side walls
      c.save(); c.translate(ux * 13, uy * 13);
      hull(); fillStroke(c, d.color, '#0f100c', 1.5);
      var plates = [[-54, -23, 22, 20, 0.86], [-54, -1, 20, 24, 1.08], [-30, -23, 26, 14, 1.12], [-32, 9, 24, 14, 0.8], [-2, -23, 24, 12, 0.92], [0, 11, 26, 12, 1.14], [24, -21, 16, 18, 1.0], [26, 1, 18, 20, 0.84]];
      plates.forEach(function (p, n) {                                                           // patchwork of welded plates
        rr(c, p[0], p[1], p[2], p[3], 1.5); fillStroke(c, n % 3 === 1 ? shade('#5c4030', p[4]) : shade(d.color, p[4]), 'rgba(8,9,7,0.75)', 1);
        c.fillStyle = 'rgba(14,15,12,0.7)';
        [[1.8, 1.8], [p[2] - 1.8, 1.8], [1.8, p[3] - 1.8], [p[2] - 1.8, p[3] - 1.8]].forEach(function (b) { c.beginPath(); c.arc(p[0] + b[0], p[1] + b[1], 0.9, 0, TAU); c.fill(); });
      });
      c.save(); rr(c, -56, -12, 9, 24, 1); c.clip();                                             // hazard stripes on the tail plate
      c.fillStyle = '#9c7e26'; c.fillRect(-56, -12, 9, 24);
      c.strokeStyle = '#15150f'; c.lineWidth = 3;
      for (i = -3; i < 6; i++) { c.beginPath(); c.moveTo(-58, -12 + i * 7); c.lineTo(-45, -19 + i * 7); c.stroke(); }
      c.restore();
      rr(c, -44, -8, 12, 16, 1); fillStroke(c, '#16170f', '#0a0b08', 1);                         // engine grille
      c.strokeStyle = 'rgba(110,112,96,0.5)'; c.lineWidth = 1;
      for (i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-42, -5 + i * 3.4); c.lineTo(-34, -5 + i * 3.4); c.stroke(); }
      if (ten) { c.strokeStyle = '#b8bec2'; c.lineWidth = 2.8; c.beginPath(); c.moveTo(-56, -17); c.lineTo(-63 - ten * 2, -17); c.moveTo(-56, 17); c.lineTo(-63 - ten * 2, 17); c.stroke(); }   // stronger engine: exhaust pipes
      for (i = 0; i < ttk; i++) { c.beginPath(); c.arc(-47 + i * 0, i ? 15 : -15, 5.5, 0, TAU); fillStroke(c, '#8a3a2e', '#2a0f0b', 1); }   // extra fuel drums on the rear deck
      c.strokeStyle = '#30332c'; c.lineWidth = 2.2;                                              // slat armour along both sides
      [-27, 27].forEach(function (y) {
        c.beginPath(); c.moveTo(-50, y); c.lineTo(30, y); c.stroke();
        for (i = 0; i < 9; i++) { c.beginPath(); c.moveTo(-48 + i * 9.5, y - 2.5); c.lineTo(-48 + i * 9.5, y + 2.5); c.stroke(); }
      });
      c.restore();
      c.save(); c.translate(ux * 20, uy * 20);                                                   // turret, higher still
      for (h = 6; h >= 1; h -= 2) { c.save(); c.translate(-ux * h, -uy * h); rr(c, -22, -17, 38, 34, 5); fillStroke(c, '#1f201a'); c.restore(); }
      rr(c, 12, -3.5, 58, 7, 2); fillStroke(c, '#2a2d27', '#0a0b09', 1.2);                       // main gun
      rr(c, 62, -5, 9, 10, 2); fillStroke(c, '#20221d', '#0a0b09', 1);
      rr(c, -22, -17, 38, 34, 5); fillStroke(c, shade(d.color, 1.12), '#0f100c', 1.5);
      rr(c, -18, -13, 14, 12, 1.5); fillStroke(c, shade('#5c4030', 0.95), 'rgba(8,9,7,0.75)', 1);
      rr(c, -2, 2, 15, 11, 1.5); fillStroke(c, shade(d.color, 0.82), 'rgba(8,9,7,0.75)', 1);
      c.beginPath(); c.arc(4, -7, 6.5, 0, TAU); fillStroke(c, shade(d.color, 0.72), '#0f100c', 1.3);                         // hatch
      c.beginPath(); c.arc(4, -7, 3.2, 0, TAU); fillStroke(c, null, 'rgba(180,184,160,0.35)', 1);
      c.strokeStyle = '#191a15'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-10, 8); c.lineTo(8, 14); c.stroke();           // small gun on the roof
      c.strokeStyle = '#14150f'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-18, 12); c.lineTo(-36, 20); c.stroke();        // aerial
      c.restore();
    }
  };

  // Does a closed cab hide the rider? (bikes and quads keep the rider visible)
  function covers(id) { return id !== 'motorcycle' && id !== 'atv'; }

  // Mud splashed on the body: more spots the dirtier it is (v.dirt 0..1), always the same places for the same vehicle.
  function mud(c, d, dirt) {
    var n = Math.floor(dirt * 16), i, h = 0;
    c.fillStyle = 'rgba(82,64,40,0.5)';
    for (i = 0; i < n; i++) {
      h = (h * 9301 + 49297 + i * 233) % 233280;
      var u = h / 233280, w = ((h * 7) % 233280) / 233280;
      c.beginPath(); c.ellipse((u - 0.5) * d.len * 0.86, (w - 0.5) * d.wid * 0.8, 2 + (i % 3), 1.4 + (i % 2), u * 6, 0, TAU); c.fill();
    }
    if (dirt > 0.6) { c.fillStyle = 'rgba(70,54,34,0.22)'; c.fillRect(-d.len * 0.45, -d.wid * 0.15, d.len * 0.4, d.wid * 0.3); }
  }

  // v = { id, x, y, angle, ridden, moving, up, dirt }
  function draw(c, v, time) {
    var d = G.data.vehicles[v.id], lift = v.ridden && d.fly ? 26 : 0;
    var run = v.ridden && (v.moving || d.fly);
    var o = { ph: run ? (time * 2.4) % 1 : 0, rot: time * 26, spin: v.ridden, a: v.angle, up: v.up || {} };
    c.save();
    c.translate(v.x, v.y);
    // cast shadow (the helicopter floats above it when flying)
    c.save(); c.translate(7 + lift * 0.5, 9 + lift); c.rotate(v.angle); c.scale(1, 0.92);
    c.fillStyle = 'rgba(0,0,0,' + (d.fly ? 0.2 : 0.26) + ')';
    c.beginPath(); c.ellipse(0, 0, d.len * 0.52, d.wid * 0.56, 0, 0, TAU); c.fill(); c.restore();
    c.translate(0, -lift * 0.25);
    c.rotate(v.angle);
    c.lineJoin = 'round'; c.lineCap = 'round';
    BODY[v.id](c, d, o);
    if (v.dirt > 0.05 && !d.fly) mud(c, d, v.dirt);
    c.restore();
  }

  // The 64x64 icon: the vehicle seen from above, nose to the right.
  function icon(g, id) {
    var d = G.data.vehicles[id], s = Math.min(1, 52 / (id === 'heli' ? 172 : d.len + 14));
    g.save(); g.translate(32, 33); g.scale(s, s);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(2, 5, d.len * 0.5, d.wid * 0.55, 0, 0, TAU); g.fill();
    BODY[id](g, d, { ph: 0, rot: 0, spin: false, a: 0, up: {} });
    g.restore();
  }

  G.vehicleArt = { draw: draw, icon: icon, covers: covers };
})(typeof window !== 'undefined' ? window : globalThis);
