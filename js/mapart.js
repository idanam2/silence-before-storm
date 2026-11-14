// The painted world map: sea and coast, the river and the lake behind its dam, forests, fields, hills, the town,
// the airport runway and the roads, all from G.data.world.geo. Painted once per size into a canvas behind the
// clickable destination markers (js/ui.js). Also the small pictograms used in the markers.
(function (root) {
  'use strict';
  var G = root.G, TAU = Math.PI * 2;
  var painted = '';

  function paint(canvas) {
    var geo = G.data.world.geo, dpr = Math.max(1, Math.min(root.devicePixelRatio || 1, 2));
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return false;
    var key = w + 'x' + h + '@' + dpr;
    if (painted === key) return true;
    painted = key;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    var g = canvas.getContext('2d'), rand = G.util.rng(5150), i, j;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineCap = 'round'; g.lineJoin = 'round';
    function X(x) { return x / 100 * w; }
    function Y(y) { return y / 100 * h; }
    function U(r) { return r / 100 * h; }
    function blob(x, y, r, col) {
      var gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    function wobble(cx, cy, rx, ry, amp, ph) {
      g.beginPath();
      for (var k = 0; k <= 40; k++) {
        var a = k / 40 * TAU, f = 1 + amp * (Math.sin(a * 3 + ph) * 0.6 + Math.sin(a * 7 + ph * 2) * 0.4);
        g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rx * f, cy + Math.sin(a) * ry * f);
      }
      g.closePath();
    }
    function path(pts) { g.beginPath(); pts.forEach(function (p, k) { g[k ? 'lineTo' : 'moveTo'](X(p[0]), Y(p[1])); }); }
    function smooth(pts) {                                // a soft curve through the points
      g.beginPath(); g.moveTo(X(pts[0][0]), Y(pts[0][1]));
      for (var k = 1; k < pts.length - 1; k++) {
        var mx = (X(pts[k][0]) + X(pts[k + 1][0])) / 2, my = (Y(pts[k][1]) + Y(pts[k + 1][1])) / 2;
        g.quadraticCurveTo(X(pts[k][0]), Y(pts[k][1]), mx, my);
      }
      var L = pts[pts.length - 1]; g.lineTo(X(L[0]), Y(L[1]));
    }

    // ---- land
    g.fillStyle = '#161c17'; g.fillRect(0, 0, w, h);
    var tones = ['rgba(52,70,44,0.22)', 'rgba(74,64,44,0.18)', 'rgba(0,0,0,0.25)', 'rgba(40,56,44,0.2)'];
    for (i = 0; i < 70; i++) blob(rand() * w, rand() * h, U(6 + rand() * 16), tones[i % 4]);
    g.fillStyle = 'rgba(150,160,130,0.05)';
    for (i = 0; i < 1400; i++) g.fillRect(rand() * w, rand() * h, 1, 1);

    // ---- fields: a patchwork of plots inside a soft oval
    var F = geo.fields;
    g.save(); wobble((X(F.x0) + X(F.x1)) / 2, (Y(F.y0) + Y(F.y1)) / 2, (X(F.x1) - X(F.x0)) / 2, (Y(F.y1) - Y(F.y0)) / 2, 0.08, 1.2); g.clip();
    var fw = U(3.2), fh = U(2.4);
    for (var fx = X(F.x0); fx < X(F.x1); fx += fw) {
      for (var fy = Y(F.y0); fy < Y(F.y1); fy += fh) {
        if (rand() < 0.12) continue;
        var hue = [44, 70, 36, 90][Math.floor(rand() * 4)];
        g.fillStyle = 'hsla(' + hue + ',22%,' + (17 + rand() * 7).toFixed(1) + '%,0.85)'; g.fillRect(fx + 1, fy + 1, fw - 2, fh - 2);
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.8;
        var horiz = rand() < 0.5;                                                         // furrows
        for (var fl = 3; fl < (horiz ? fh : fw) - 2; fl += 3) { g.beginPath(); if (horiz) { g.moveTo(fx + 2, fy + fl); g.lineTo(fx + fw - 2, fy + fl); } else { g.moveTo(fx + fl, fy + 2); g.lineTo(fx + fl, fy + fh - 2); } g.stroke(); }
      }
    }
    g.restore();

    // ---- hills: contour rings, the quarry pit cut into them
    geo.hills.forEach(function (hl, n) {
      for (var r = 0; r < hl[3]; r++) {
        var f = 1 - r / hl[3];
        wobble(X(hl[0]), Y(hl[1]), U(hl[2]) * f * 1.25, U(hl[2]) * f, 0.1, n * 2.1 + r * 0.7);
        g.fillStyle = 'rgba(96,84,60,' + (0.05 + r * 0.025).toFixed(3) + ')'; g.fill();
        g.strokeStyle = 'rgba(140,120,84,' + (0.16 + r * 0.04).toFixed(3) + ')'; g.lineWidth = 1; g.stroke();
      }
    });
    var Q = geo.quarry;
    for (i = 0; i < 4; i++) {
      wobble(X(Q.x), Y(Q.y), U(Q.r) * (1 - i * 0.22) * 1.3, U(Q.r) * (1 - i * 0.22), 0.05, i);
      g.fillStyle = 'rgba(' + (120 - i * 18) + ',' + (112 - i * 18) + ',' + (98 - i * 16) + ',0.55)'; g.fill();
      g.strokeStyle = 'rgba(20,18,14,0.5)'; g.lineWidth = 1; g.stroke();
    }

    if (geo.snow) {                                                         // snow caps on the high ground in the north-east
      for (i = 0; i < 3; i++) { wobble(X(geo.snow.x), Y(geo.snow.y), U(geo.snow.r) * (1 - i * 0.28) * 1.3, U(geo.snow.r) * (1 - i * 0.28), 0.08, i + 4); g.fillStyle = 'rgba(232,240,248,' + (0.5 + i * 0.12).toFixed(2) + ')'; g.fill(); g.strokeStyle = 'rgba(150,170,196,0.5)'; g.lineWidth = 1; g.stroke(); }
    }

    // ---- forests: soft dark ground, then hundreds of little crowns
    geo.forests.forEach(function (f) { blob(X(f[0]), Y(f[1]), U(f[2]) * 1.25, 'rgba(10,22,12,0.55)'); });
    geo.forests.forEach(function (f) {
      var n = Math.round(f[2] * f[2] * 2.2);
      for (var k = 0; k < n; k++) {
        var a = rand() * TAU, d = Math.sqrt(rand()) * U(f[2]), x = X(f[0]) + Math.cos(a) * d * 1.3, y = Y(f[1]) + Math.sin(a) * d;
        var r = 1.6 + rand() * 2.2;
        g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(x + 1, y + 1.2, r, 0, TAU); g.fill();
        g.fillStyle = 'hsl(' + (100 + rand() * 30).toFixed(0) + ',' + (18 + rand() * 10).toFixed(0) + '%,' + (14 + rand() * 9).toFixed(1) + '%)';
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
    });

    // ---- town: a street grid of blocks (some gutted), suburbs of small houses, the hospital campus
    var T = geo.town, bs = U(2.2), gap = U(0.9);
    for (var bx = X(T.x0); bx < X(T.x1); bx += bs + gap) {
      for (var by = Y(T.y0); by < Y(T.y1); by += bs + gap) {
        var cxn = (bx - X(T.x0)) / (X(T.x1) - X(T.x0)) - 0.5, cyn = (by - Y(T.y0)) / (Y(T.y1) - Y(T.y0)) - 0.5;
        if (cxn * cxn + cyn * cyn > 0.26 + rand() * 0.06) continue;                       // a round-ish town edge
        var ruin = rand() < 0.14;
        g.fillStyle = ruin ? 'rgba(40,40,36,0.7)' : 'rgba(' + (62 + rand() * 14 | 0) + ',' + (64 + rand() * 12 | 0) + ',' + (60 + rand() * 10 | 0) + ',0.9)';
        var bw = bs * (rand() < 0.2 ? 1 : 0.7 + rand() * 0.3), bh = bs * (0.7 + rand() * 0.3);
        g.fillRect(bx, by, bw, bh);
        g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(bx + 1.5, by + bh, bw, 1.5); g.fillRect(bx + bw, by + 1.5, 1.5, bh);
        if (ruin) { g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + bw, by + bh); g.stroke(); }
      }
    }
    var SB = geo.suburbs;
    for (i = 0; i < 70; i++) {
      var hx = X(SB.x0) + rand() * (X(SB.x1) - X(SB.x0)), hy = Y(SB.y0) + rand() * (Y(SB.y1) - Y(SB.y0));
      var hs = 3 + rand() * 3;
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(hx + 1, hy + 1, hs, hs * 0.8);
      g.fillStyle = rand() < 0.5 ? 'rgba(96,74,58,0.85)' : 'rgba(78,80,74,0.85)'; g.fillRect(hx, hy, hs, hs * 0.8);
    }
    var C = geo.campus, cx = X(C.x), cy = Y(C.y);                                        // H-shaped wards around a courtyard
    g.fillStyle = 'rgba(30,32,30,0.8)'; g.fillRect(cx - U(5), cy - U(3.5), U(10), U(7));
    g.fillStyle = 'rgba(112,116,108,0.9)';
    g.fillRect(cx - U(4), cy - U(2.6), U(1.6), U(5.2)); g.fillRect(cx + U(2.4), cy - U(2.6), U(1.6), U(5.2)); g.fillRect(cx - U(4), cy - U(0.6), U(8), U(1.2));

    // ---- military base: fence, barracks, helipad
    var M = geo.military;
    g.fillStyle = 'rgba(40,46,34,0.6)'; g.fillRect(X(M.x0), Y(M.y0), X(M.x1) - X(M.x0), Y(M.y1) - Y(M.y0));
    g.strokeStyle = 'rgba(160,150,110,0.55)'; g.lineWidth = 1.2; g.setLineDash([4, 3]);
    g.strokeRect(X(M.x0), Y(M.y0), X(M.x1) - X(M.x0), Y(M.y1) - Y(M.y0)); g.setLineDash([]);
    for (i = 0; i < 4; i++) for (j = 0; j < 2; j++) { g.fillStyle = 'rgba(84,90,70,0.9)'; g.fillRect(X(M.x0) + U(1.2) + i * U(2.6), Y(M.y0) + U(1.4) + j * U(4.2), U(1.8), U(3)); }
    var hp = [X(M.x1) - U(3), Y(M.y1) - U(3)];
    g.strokeStyle = 'rgba(190,180,140,0.5)'; g.beginPath(); g.arc(hp[0], hp[1], U(1.6), 0, TAU); g.stroke();
    g.font = '700 ' + Math.round(U(2)) + 'px "Segoe UI", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(190,180,140,0.55)'; g.fillText('H', hp[0], hp[1] + 0.5);

    // ---- airport runway with its taxiway and terminal
    var RW = geo.runway;
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(X(RW.x0) + 2, Y(RW.y) - U(RW.w) / 2 + 2, X(RW.x1) - X(RW.x0), U(RW.w));
    g.fillStyle = '#3a3c38'; g.fillRect(X(RW.x0), Y(RW.y) - U(RW.w) / 2, X(RW.x1) - X(RW.x0), U(RW.w));
    g.strokeStyle = 'rgba(210,210,196,0.55)'; g.lineWidth = 1; g.setLineDash([7, 6]);
    g.beginPath(); g.moveTo(X(RW.x0) + 6, Y(RW.y)); g.lineTo(X(RW.x1) - 6, Y(RW.y)); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#2f312d'; g.fillRect(X(RW.x0) + U(4), Y(RW.y) + U(RW.w) / 2, X(RW.x1) - X(RW.x0) - U(8), U(0.8));
    g.fillStyle = 'rgba(100,104,98,0.9)'; g.fillRect(X(46), Y(RW.y) + U(2.4), X(55) - X(46), U(2));

    // ---- the sea, coastline with shallows and a sandy beach, the river and the lake behind its dam
    function seaPath() { path(geo.coast); g.lineTo(-10, -10); g.closePath(); }
    g.save(); seaPath(); g.clip();
    var sg = g.createLinearGradient(0, 0, X(20), Y(50));
    sg.addColorStop(0, '#081215'); sg.addColorStop(1, '#0d1c20');
    g.fillStyle = sg; g.fillRect(0, 0, w, h);
    [[22, 0.05], [14, 0.07], [8, 0.09], [3, 0.12]].forEach(function (b) {
      g.strokeStyle = 'rgba(70,120,124,' + b[1] + ')'; g.lineWidth = b[0]; smooth(geo.coast); g.stroke();
    });
    g.strokeStyle = 'rgba(140,180,180,0.12)'; g.lineWidth = 1;                             // little wave marks
    for (i = 0; i < 60; i++) { var wx = rand() * X(26), wy = rand() * Y(66); g.beginPath(); g.arc(wx, wy, 3, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    g.restore();
    g.strokeStyle = 'rgba(120,108,78,0.55)'; g.lineWidth = 2; smooth(geo.coast); g.stroke();   // beach
    g.strokeStyle = 'rgba(14,24,26,0.9)'; g.lineWidth = 1; smooth(geo.coast); g.stroke();

    var L = geo.lake;
    wobble(X(L.x), Y(L.y), U(L.rx), U(L.ry), 0.07, 0.4);
    g.fillStyle = '#0c1a1e'; g.fill();
    g.strokeStyle = 'rgba(70,120,124,0.25)'; g.lineWidth = 4; g.stroke();
    g.strokeStyle = 'rgba(120,108,78,0.4)'; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = '#0c1a1e'; g.lineWidth = 4; smooth(geo.river); g.stroke();             // river from the lake to the sea
    g.strokeStyle = 'rgba(70,120,124,0.3)'; g.lineWidth = 1; smooth(geo.river); g.stroke();
    g.strokeStyle = 'rgba(176,176,164,0.75)'; g.lineWidth = 3; path(geo.dam); g.stroke();   // the dam wall on the lake's east side

    var port = G.data.world.destinations.port.pos;                                             // piers at the port
    g.fillStyle = 'rgba(120,110,90,0.8)';
    for (i = 0; i < 3; i++) g.fillRect(X(port.x) - U(5.2) + i * U(1.5), Y(port.y) - U(0.8) + i * U(1.6), U(3.2), U(0.7));

    // ---- roads: each stretch once, the shared trunk wider
    var used = {}, segs = [];
    Object.keys(geo.routes).forEach(function (id) {
      var r = geo.routes[id];
      for (var k = 0; k < r.length - 1; k++) {
        var key = r[k].join(',') + '>' + r[k + 1].join(',');
        if (!used[key]) { used[key] = 0; segs.push([r[k], r[k + 1], key]); }
        used[key]++;
      }
    });
    [['rgba(8,10,9,0.85)', 2.6], ['#6b6452', 0]].forEach(function (pass) {
      segs.forEach(function (s) {
        var wdt = 1.6 + Math.min(3, used[s[2]] * 0.35);
        g.strokeStyle = pass[0]; g.lineWidth = wdt + pass[1];
        g.beginPath(); g.moveTo(X(s[0][0]), Y(s[0][1])); g.lineTo(X(s[1][0]), Y(s[1][1])); g.stroke();
      });
    });

    // ---- frame: faint grid, labels, compass, scale
    g.strokeStyle = 'rgba(170,180,160,0.045)'; g.lineWidth = 1;
    for (i = 1; i < 10; i++) { g.beginPath(); g.moveTo(X(i * 10), 0); g.lineTo(X(i * 10), h); g.stroke(); g.beginPath(); g.moveTo(0, Y(i * 10)); g.lineTo(w, Y(i * 10)); g.stroke(); }
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
    geo.labels.forEach(function (lb) {
      var sea = lb[3] === 'sea', water = lb[3] === 'water';
      g.font = (sea ? 'italic 600 ' + Math.round(U(4.2)) : 'italic ' + Math.round(U(water ? 2.3 : 2.8))) + 'px "Segoe UI", Arial, sans-serif';
      g.fillStyle = sea || water ? 'rgba(110,160,160,0.45)' : 'rgba(190,190,160,0.32)';
      g.fillText(lb[0], X(lb[1]), Y(lb[2]));
    });
    var co = [X(5), Y(88)], cr = U(4.5);                                                        // compass: north is up
    g.strokeStyle = 'rgba(190,190,160,0.35)'; g.lineWidth = 1; g.beginPath(); g.arc(co[0], co[1], cr, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(200,196,160,0.6)'; g.beginPath(); g.moveTo(co[0], co[1] - cr * 0.85); g.lineTo(co[0] + cr * 0.22, co[1]); g.lineTo(co[0] - cr * 0.22, co[1]); g.closePath(); g.fill();
    g.fillStyle = 'rgba(120,120,100,0.4)'; g.beginPath(); g.moveTo(co[0], co[1] + cr * 0.85); g.lineTo(co[0] + cr * 0.22, co[1]); g.lineTo(co[0] - cr * 0.22, co[1]); g.closePath(); g.fill();
    g.font = '600 ' + Math.round(U(2.2)) + 'px "Segoe UI", Arial'; g.fillStyle = 'rgba(210,206,170,0.6)'; g.fillText('צ', co[0], co[1] - cr - U(2));
    var sx = X(10), sy = Y(93), sl = X(14) - X(10);                                             // scale bar: about 5 km
    g.fillStyle = 'rgba(200,196,160,0.45)'; g.fillRect(sx, sy, sl / 2, 3); g.fillStyle = 'rgba(200,196,160,0.2)'; g.fillRect(sx + sl / 2, sy, sl / 2, 3);
    g.font = Math.round(U(2.1)) + 'px "Segoe UI", Arial'; g.fillStyle = 'rgba(190,190,160,0.5)'; g.fillText('5 ק״מ', sx + sl / 2, sy - U(2.2));
    var vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    return true;
  }

  // 16x16 pictograms for the markers (stroke = currentColor).
  var ICONS = {
    base: '<path d="M3 8.5 8 4l5 4.5V13H3z"/><path d="M6.5 13v-3h3v3"/>',
    forest: '<path d="M8 2 3.5 9h3L4 13h8L9.5 9h3z"/><path d="M8 13v2"/>',
    farm: '<path d="M2.5 7 8 3l5.5 4v6h-11z"/><path d="M5.5 13V9h5v4M5.5 9l5 4M10.5 9l-5 4"/>',
    neighborhood: '<path d="M1.5 9 5 6l3.5 3v4h-7zM8.5 8 11.5 5.5 14.5 8v5h-6"/>',
    quarry: '<path d="M2 13 6 6l3 4 2-3 3 6z"/><path d="M9.5 3.5l3 3M11 2.5 9 6"/>',
    peaks: '<path d="M1.500 13 6 5l2.500 4 2-3 4 7z"/><path d="M4.800 7.500 6 9l1-1M10.500 8l1 1.500"/>',
    lake: '<path d="M2 6c2-1.5 4 1.5 6 0s4 1.5 6 0M2 9.5c2-1.5 4 1.5 6 0s4 1.5 6 0M2 13c2-1.5 4 1.5 6 0s4 1.5 6 0"/>',
    police: '<path d="M8 2 13 4v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z"/><path d="M8 5.5l.9 1.9 2 .3-1.5 1.4.4 2L8 10.2 6.2 11.1l.4-2-1.5-1.4 2-.3z"/>',
    hospital: '<rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M8 5v6M5 8h6"/>',
    port: '<circle cx="8" cy="3.5" r="1.5"/><path d="M8 5v9M5 7.5h6M3 10c0 2.5 2.2 4 5 4s5-1.5 5-4"/>',
    military: '<path d="M8 2l1.8 3.9 4.2.5-3.1 2.9.8 4.2L8 11.4l-3.7 2.1.8-4.2L2 6.4l4.2-.5z"/>',
    airport: '<path d="M8 2c.8 0 1 1 1 2v3l5 3v1.5l-5-1.5v2.5l1.5 1.2V15L8 14.2 5.5 15v-1.3L7 12.5V10L2 11.5V10l5-3V4c0-1 .2-2 1-2z"/>'
  };
  function icon(id) {
    return '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round">' + (ICONS[id] || ICONS.base) + '</svg>';
  }

  G.mapArt = { paint: paint, icon: icon, invalidate: function () { painted = ''; } };
})(typeof window !== 'undefined' ? window : globalThis);
