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
      wheel(c, -15, 0, 15, 5, o.ph); wheel(c, 16, 0, 15, 5, o.ph);
      rr(c, -12, -3, 28, 6, 3); fillStroke(c, '#2a2c2b', '#0d0e0d', 1);                      // frame
      c.beginPath(); c.ellipse(3, 0, 8, 5.5, 0, 0, TAU); fillStroke(c, d.color, shade(d.color, 0.45), 1.2);   // fuel tank
      rr(c, -10, -3.4, 10, 6.8, 3); fillStroke(c, '#25201d', '#0d0e0d', 1);                  // seat
      c.strokeStyle = '#17191a'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(12, -9); c.lineTo(12, 9); c.stroke();   // handlebar
      c.fillStyle = '#e8dca0'; c.beginPath(); c.arc(21, 0, 2.4, 0, TAU); c.fill();           // headlight
    },
    atv: function (c, d, o) {
      [[-17, -15], [-17, 15], [17, -15], [17, 15]].forEach(function (w) { wheel(c, w[0], w[1], 15, 10, o.ph); });
      rr(c, -23, -11, 46, 22, 7); fillStroke(c, d.color, shade(d.color, 0.45), 1.3);        // body
      rr(c, -4, -9, 22, 18, 5); fillStroke(c, shade(d.color, 1.15), shade(d.color, 0.5), 1);   // front cover
      rr(c, -16, -8, 14, 16, 4); fillStroke(c, '#26221f', '#0d0e0d', 1);                    // seat
      c.strokeStyle = '#16181a'; c.lineWidth = 3; c.beginPath(); c.moveTo(6, -13); c.lineTo(6, 13); c.stroke();   // handlebar
      c.fillStyle = '#e8dca0'; c.fillRect(24, -8, 2.5, 4); c.fillRect(24, 4, 2.5, 4);
    },
    jeep: function (c, d, o) {
      [[-28, -26], [-28, 26], [27, -26], [27, 26]].forEach(function (w) { wheel(c, w[0], w[1], 20, 9, o.ph); });
      rr(c, -45, -22, 90, 44, 8); fillStroke(c, d.color, shade(d.color, 0.42), 1.4);        // body
      rr(c, 12, -19, 30, 38, 6); fillStroke(c, shade(d.color, 1.12), shade(d.color, 0.5), 1);   // hood
      c.beginPath(); c.moveTo(8, -19); c.lineTo(14, -17); c.lineTo(14, 17); c.lineTo(8, 19); c.closePath(); fillStroke(c, '#6f8590', '#1c2328', 1);   // windscreen
      rr(c, -36, -18, 42, 36, 5); fillStroke(c, shade(d.color, 0.8), shade(d.color, 0.4), 1);   // canvas top
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1;
      for (var i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-36 + i * 10.5, -17); c.lineTo(-36 + i * 10.5, 17); c.stroke(); }
      c.beginPath(); c.arc(-48, 0, 8, 0, TAU); fillStroke(c, '#1b1d1c', '#0c0d0c', 1);        // spare wheel on the tail
      c.fillStyle = '#e8dca0'; c.fillRect(43, -16, 3, 6); c.fillRect(43, 10, 3, 6);
    },
    heli: function (c, d, o) {
      rr(c, -78, -3, 60, 6, 3); fillStroke(c, shade(d.color, 0.85), '#10161b', 1);          // tail boom
      c.beginPath(); c.moveTo(-72, -3); c.lineTo(-84, -10); c.lineTo(-80, -10); c.lineTo(-66, -3); c.closePath(); fillStroke(c, shade(d.color, 0.7), '#10161b', 1);   // fin
      c.beginPath(); c.ellipse(-8, 0, 36, 18, 0, 0, TAU); fillStroke(c, d.color, '#10161b', 1.4);   // cabin
      c.beginPath(); c.ellipse(16, 0, 17, 13, 0, 0, TAU); fillStroke(c, '#5d7a8a', '#10161b', 1);   // cockpit glass
      c.beginPath(); c.ellipse(11, -4, 7, 3, -0.4, 0, TAU); fillStroke(c, 'rgba(255,255,255,0.25)');
      rr(c, -22, -9, 22, 18, 4); fillStroke(c, shade(d.color, 0.8), '#10161b', 1);          // engine hump
      c.strokeStyle = '#1c242b'; c.lineWidth = 2; c.beginPath(); c.moveTo(-2, -22); c.lineTo(-2, 22); c.stroke();   // skid struts
      c.save(); c.translate(-80, -9); c.rotate(o.rot * 3); c.strokeStyle = 'rgba(210,215,215,0.7)'; c.lineWidth = 2;   // tail rotor
      c.beginPath(); c.moveTo(0, -8); c.lineTo(0, 8); c.stroke(); c.restore();
      c.save(); c.translate(-6, 0);                                                              // main rotor
      if (o.spin) {                                                                              // blur disc + two blades when running
        c.beginPath(); c.arc(0, 0, 56, 0, TAU); fillStroke(c, 'rgba(190,200,205,0.13)');
        c.rotate(o.rot); c.strokeStyle = 'rgba(25,30,34,0.8)'; c.lineWidth = 3.4;
        c.beginPath(); c.moveTo(-56, 0); c.lineTo(56, 0); c.stroke();
        c.beginPath(); c.moveTo(0, -56); c.lineTo(0, 56); c.stroke();
      } else {                                                                                   // parked: blades hang still
        c.rotate(0.5); c.strokeStyle = 'rgba(25,30,34,0.9)'; c.lineWidth = 3.4;
        c.beginPath(); c.moveTo(-56, 0); c.lineTo(56, 0); c.stroke();
      }
      c.fillStyle = '#252d33'; c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fill();
      c.restore();
    },
    tank: function (c, d, o) {
      [-1, 1].forEach(function (s) {                                                             // the two tracks
        rr(c, -58, s * 28 - 9, 116, 18, 8); fillStroke(c, '#1d201b', '#0b0c0a', 1.2);
        c.strokeStyle = 'rgba(125,130,115,0.5)'; c.lineWidth = 1.6;
        for (var i = 0; i < 12; i++) { var x = -54 + (((i / 12) + o.ph) % 1) * 108; c.beginPath(); c.moveTo(x, s * 28 - 8); c.lineTo(x, s * 28 + 8); c.stroke(); }
        for (var j = 0; j < 5; j++) { c.beginPath(); c.arc(-42 + j * 21, s * 28, 4, 0, TAU); fillStroke(c, '#3a3f35', '#0b0c0a', 1); }
      });
      rr(c, -52, -24, 104, 48, 7); fillStroke(c, d.color, shade(d.color, 0.4), 1.5);          // hull
      c.beginPath(); c.moveTo(34, -22); c.lineTo(56, -12); c.lineTo(56, 12); c.lineTo(34, 22); c.closePath(); fillStroke(c, shade(d.color, 1.1), shade(d.color, 0.45), 1.2);   // glacis
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1;
      for (var k = 1; k < 4; k++) { c.beginPath(); c.moveTo(-52 + k * 20, -22); c.lineTo(-52 + k * 20, 22); c.stroke(); }
      rr(c, 6, -4, 66, 8, 2); fillStroke(c, '#2c3128', '#0b0c0a', 1.2);                      // gun barrel
      rr(c, 66, -5.5, 10, 11, 2); fillStroke(c, '#232720', '#0b0c0a', 1);
      c.beginPath(); c.ellipse(-4, 0, 25, 21, 0, 0, TAU); fillStroke(c, shade(d.color, 1.15), shade(d.color, 0.4), 1.5);   // turret
      c.beginPath(); c.arc(-8, -8, 6, 0, TAU); fillStroke(c, shade(d.color, 0.7), shade(d.color, 0.35), 1.2);              // hatch
      c.strokeStyle = '#1a1d17'; c.lineWidth = 2; c.beginPath(); c.moveTo(-22, 12); c.lineTo(-40, 18); c.stroke();          // aerial
    }
  };

  // Does a closed cab hide the rider? (bikes and quads keep the rider visible)
  function covers(id) { return id !== 'motorcycle' && id !== 'atv'; }

  // v = { id, x, y, angle, ridden, moving }
  function draw(c, v, time) {
    var d = G.data.vehicles[v.id], lift = v.ridden && d.fly ? 26 : 0;
    var run = v.ridden && (v.moving || d.fly);
    var o = { ph: run ? (time * 2.4) % 1 : 0, rot: time * 26, spin: v.ridden };
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
    c.restore();
  }

  // The 64x64 icon: the vehicle seen from above, nose to the right.
  function icon(g, id) {
    var d = G.data.vehicles[id], s = Math.min(1, 52 / (id === 'heli' ? 130 : d.len + 14));
    g.save(); g.translate(32, 33); g.scale(s, s);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(2, 5, d.len * 0.5, d.wid * 0.55, 0, 0, TAU); g.fill();
    BODY[id](g, d, { ph: 0, rot: 0, spin: false });
    g.restore();
  }

  G.vehicleArt = { draw: draw, icon: icon, covers: covers };
})(typeof window !== 'undefined' ? window : globalThis);
