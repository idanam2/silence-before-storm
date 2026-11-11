// Base rendering. Structures are drawn as extruded boxes: every point is pushed away from the screen
// center in proportion to its height (simple parallax), so walls, roofs and posts read as 3D while
// collision stays a flat rectangle. Static parts (ground overlay, shadows, decor) are painted once.
(function (root) {
  'use strict';
  var G = root.G, TAU = Math.PI * 2;
  var K = null, T = null;           // forest art kit (shared sprites), prerendered base terrain

  var H = { fence: 0.03, post: 0.048, gatePost: 0.07, chest: 0.04, pile: 0.045, wall: 0.09, ridge: 0.145, chimney: 0.18 };
  var TILT = 380;                   // the camera looks slightly from the south, so south faces always show
  var SUN = { x: 0.62, y: 0.78 };   // direction shadows fall (south-east), per unit of height

  function lift(x, y, k, c) { return [x + (x - c.x) * k, y + (y - c.y) * k]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function poly(ctx, pts, fill, stroke) {
    ctx.beginPath();
    for (var i = 0; i < pts.length; i++) ctx[i ? 'lineTo' : 'moveTo'](pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function line(ctx, a, b) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }

  // Extruded box from height k0 to k1. cols: { n, e, s, w, top }. Far walls first, then the near ones.
  // Returns { b, t, vis } (bottom corners, top corners as [nw, ne, se, sw], which sides face the viewer).
  function box(ctx, r, k0, k1, c, cols, planks) {
    var pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]], b = [], t = [], i;
    for (i = 0; i < 4; i++) { b.push(lift(pts[i][0], pts[i][1], k0, c)); t.push(lift(pts[i][0], pts[i][1], k1, c)); }
    var vis = { n: c.y < r.y, e: c.x > r.x + r.w, s: c.y > r.y + r.h, w: c.x < r.x }, sides = ['n', 'e', 's', 'w'];
    ctx.lineWidth = 1;
    for (var pass = 0; pass < 2; pass++) {
      for (i = 0; i < 4; i++) {
        if (vis[sides[i]] !== (pass === 1)) continue;
        var j = (i + 1) % 4;
        poly(ctx, [b[i], b[j], t[j], t[i]], cols[sides[i]]);
        if (planks && pass === 1) {
          ctx.strokeStyle = 'rgba(0,0,0,0.28)';
          for (var f = 1; f < planks; f++) line(ctx, mix(b[i], t[i], f / planks), mix(b[j], t[j], f / planks));
        }
      }
    }
    if (cols.top) poly(ctx, t, cols.top);
    return { b: b, t: t, vis: vis };
  }

  // ---- structures --------------------------------------------------------------------------------

  var WOOD = { n: '#3a3428', w: '#39332a', s: '#231f17', e: '#1d1a13', top: '#4b4334' };
  var POST = { n: '#443c2e', w: '#423a2e', s: '#2a251b', e: '#221e16', top: '#5e5442' };

  var WOOD2 = { n: '#474b41', w: '#444839', s: '#272a21', e: '#1f221a', top: '#575c4d' };   // reinforced fence
  var POST2 = { n: '#50554a', w: '#4d5146', s: '#2d3027', e: '#25281f', top: '#6a7064' };

  function drawFence(ctx, r, c, gate, lvl) {
    var horiz = r.w >= r.h, len = horiz ? r.w : r.h, o, up = lvl >= 2;
    var bx = box(ctx, r, 0, up ? H.fence * 1.55 : H.fence, c, up ? WOOD2 : WOOD, up ? 3 : 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1;                 // plank gaps on the top face
    for (o = 16; o < len; o += 16) {
      var u = o / len;
      if (horiz) line(ctx, mix(bx.t[0], bx.t[1], u), mix(bx.t[3], bx.t[2], u));
      else line(ctx, mix(bx.t[0], bx.t[3], u), mix(bx.t[1], bx.t[2], u));
    }
    ctx.strokeStyle = 'rgba(210,196,160,0.14)';                              // lit north / west edge
    line(ctx, bx.t[0], horiz ? bx.t[1] : bx.t[3]);
    for (o = 0; o <= len - 6; o += 64) post(o, false);
    post(len - 10, false);
    function post(off, tall) {
      var pr = horiz ? { x: r.x + off, y: r.y - 3, w: 10, h: r.h + 6 } : { x: r.x - 3, y: r.y + off, w: r.w + 6, h: 10 };
      var isGate = gate && horiz && (Math.abs(pr.x - gate.x) < 14 || Math.abs(pr.x + pr.w - gate.x - gate.w) < 14 || Math.abs(pr.x + pr.w - gate.x) < 14 || Math.abs(pr.x - gate.x - gate.w) < 14);
      var ph = isGate || tall ? H.gatePost : H.post;
      var pb = box(ctx, pr, 0, up ? ph * 1.4 : ph, c, up ? POST2 : POST);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; poly(ctx, pb.t, up ? '#737a74' : null, 'rgba(0,0,0,0.45)');   // iron cap
    }
  }

  function drawChest(ctx, r, c, near, lvl) {
    var cols = { n: '#5a4a36', w: '#52432f', s: '#2f261b', e: '#2a2218', top: '#6a573f' };
    var bx = box(ctx, r, 0, H.chest, c, cols), t = bx.t;
    poly(ctx, [mix(t[0], t[3], 0.52), mix(t[1], t[2], 0.52), t[2], t[3]], '#57472f');            // lid split
    var bands = [0.2, 0.8];
    for (var i = 0; i < 2; i++) {
      var a0 = mix(t[0], t[1], bands[i] - 0.04), a1 = mix(t[0], t[1], bands[i] + 0.04);
      var b0 = mix(t[3], t[2], bands[i] - 0.04), b1 = mix(t[3], t[2], bands[i] + 0.04);
      poly(ctx, [a0, a1, b1, b0], '#262019');
    }
    var lk = mix(mix(t[0], t[1], 0.5), mix(t[3], t[2], 0.5), 0.52);
    if (lvl >= 2) {                                                         // iron corner plates + long straps
      ctx.fillStyle = '#7c847f';
      [t[0], t[1], t[2], t[3]].forEach(function (p, i) {
        var dx = i === 0 || i === 3 ? 0 : -9, dy = i < 2 ? 0 : -9;
        ctx.fillRect(p[0] + dx, p[1] + dy, 9, 9);
      });
      ctx.fillStyle = '#4e5652';
      [0.5].forEach(function (u) {
        var a = mix(t[0], t[3], u), b2 = mix(t[1], t[2], u);
        poly(ctx, [[a[0], a[1] - 1.5], [b2[0], b2[1] - 1.5], [b2[0], b2[1] + 1.5], [a[0], a[1] + 1.5]], '#4e5652');
      });
    }
    ctx.fillStyle = '#9aa585'; ctx.fillRect(lk[0] - 3.5, lk[1] - 3.5, 7, 8);
    ctx.fillStyle = '#20231c'; ctx.fillRect(lk[0] - 1, lk[1] - 0.5, 2, 3);
    ctx.strokeStyle = 'rgba(235,220,180,0.22)'; ctx.lineWidth = 1; line(ctx, t[0], t[1]); line(ctx, t[0], t[3]);
    ctx.lineWidth = 2;
    poly(ctx, t, null, near ? 'rgba(170,185,150,0.95)' : 'rgba(18,14,10,0.9)');
  }

  function drawWoodpile(ctx, r, c) {
    var cols = { n: '#4a3c2b', w: '#43372a', s: '#33291d', e: '#2a2218', top: '#5a4934' };
    var bx = box(ctx, r, 0, H.pile, c, cols), t = bx.t, b = bx.b, i, n = 4;
    for (i = 0; i < n; i++) {                                               // logs lying north-south
      var u0 = i / n, u1 = (i + 1) / n;
      var q = [mix(t[0], t[1], u0), mix(t[0], t[1], u1), mix(t[3], t[2], u1), mix(t[3], t[2], u0)];
      poly(ctx, q, i % 2 ? '#665339' : '#5a4832', 'rgba(20,14,8,0.6)');
      ctx.strokeStyle = 'rgba(214,190,140,0.14)'; ctx.lineWidth = 1.5;
      line(ctx, mix(q[0], q[1], 0.3), mix(q[3], q[2], 0.3));
    }
    if (bx.vis.s) {                                                         // cut ends on the south face
      for (i = 0; i < n; i++) {
        var m = mix(mix(b[3], b[2], (i + 0.5) / n), mix(t[3], t[2], (i + 0.5) / n), 0.5);
        var ry = Math.max(1.5, Math.abs(t[3][1] - b[3][1]) * 0.42);
        ctx.fillStyle = '#9a855f'; ctx.beginPath(); ctx.ellipse(m[0], m[1], r.w / n * 0.42, ry, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(60,44,26,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(m[0], m[1], r.w / n * 0.2, ry * 0.5, 0, 0, TAU); ctx.stroke();
      }
    }
  }

  // ---- built by the player (stage 3) ---------------------------------------------------------------

  H.bench = 0.05; H.benchLeg = 0.034; H.bed = 0.03; H.tank = 0.06;

  function topPt(t, u, v) { return mix(mix(t[0], t[1], u), mix(t[3], t[2], u), v); }   // point on a box top: u west->east, v north->south

  function outline(ctx, pts, near) {
    ctx.lineWidth = 2;
    poly(ctx, pts, null, near ? 'rgba(170,185,150,0.95)' : 'rgba(18,14,10,0.85)');
  }

  function drawWorkbench(ctx, r, c, near, lvl) {
    var LEG = { n: '#4c4132', w: '#473d2f', s: '#2c251b', e: '#251f16', top: '#5d5240' }, i, up = lvl >= 2;
    var legs = [[0, 0], [r.w - 9, 0], [0, r.h - 9], [r.w - 9, r.h - 9]];
    for (i = 0; i < 4; i++) box(ctx, { x: r.x + legs[i][0] + 2, y: r.y + legs[i][1] + 2, w: 7, h: 7 }, 0, H.benchLeg, c, LEG);
    var top = up ? { n: '#625640', w: '#5a4f3b', s: '#3a3226', e: '#302a20', top: '#76694e' }
                 : { n: '#54483a', w: '#4d4235', s: '#322a20', e: '#292219', top: '#6a5c46' };
    var bx = box(ctx, r, H.benchLeg, H.bench, c, top, up ? 2 : 0), t = bx.t;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;                // plank joints along the length
    for (i = 1; i < 4; i++) line(ctx, topPt(t, 0, i / 4), topPt(t, 1, i / 4));
    ctx.strokeStyle = 'rgba(235,220,180,0.16)'; line(ctx, t[0], t[1]); line(ctx, t[0], t[3]);
    // tools lying on the top: a saw (west), a hammer (middle), a vise (east)
    var s0 = topPt(t, 0.1, 0.38), s1 = topPt(t, 0.42, 0.34);
    ctx.strokeStyle = '#9aa3a5'; ctx.lineWidth = 3; line(ctx, s0, s1);
    ctx.strokeStyle = '#4a3b2b'; ctx.lineWidth = 4.5; line(ctx, topPt(t, 0.42, 0.34), topPt(t, 0.5, 0.33));
    ctx.strokeStyle = 'rgba(20,24,24,0.6)'; ctx.lineWidth = 1; line(ctx, topPt(t, 0.1, 0.44), topPt(t, 0.42, 0.4));
    var h0 = topPt(t, 0.5, 0.74), h1 = topPt(t, 0.7, 0.66);
    ctx.strokeStyle = '#5a4936'; ctx.lineWidth = 3; line(ctx, h0, h1);
    ctx.strokeStyle = '#7d8683'; ctx.lineWidth = 6; line(ctx, topPt(t, 0.7, 0.63), topPt(t, 0.7, 0.72));
    var vz = box(ctx, { x: r.x + r.w - 26, y: r.y + 10, w: 16, h: 18 }, H.bench, H.bench + 0.012, c,
      { n: '#4e5652', w: '#4a524e', s: '#2c312f', e: '#262a28', top: '#6c7571' });
    poly(ctx, [mix(vz.t[0], vz.t[3], 0.3), mix(vz.t[1], vz.t[2], 0.3), mix(vz.t[1], vz.t[2], 0.5), mix(vz.t[0], vz.t[3], 0.5)], '#262a28');
    if (up) {                                                               // level 2: steel plate, back board with hanging tools
      poly(ctx, [topPt(t, 0.54, 0.12), topPt(t, 0.86, 0.12), topPt(t, 0.86, 0.5), topPt(t, 0.54, 0.5)], 'rgba(120,130,128,0.28)', 'rgba(20,24,24,0.5)');
      var bb = box(ctx, { x: r.x + 3, y: r.y - 2, w: r.w - 6, h: 5 }, H.bench, H.bench + 0.05, c,
        { n: '#4c4132', w: '#473d2f', s: '#34291d', e: '#2a2218', top: '#5d5240' }, 3);
      var f0 = lift(r.x + 20, r.y + 3, H.bench + 0.03, c), f1 = lift(r.x + 46, r.y + 3, H.bench + 0.03, c), f2 = lift(r.x + 68, r.y + 3, H.bench + 0.03, c);
      ctx.lineCap = 'round'; ctx.strokeStyle = '#9aa3a5'; ctx.lineWidth = 2.2;
      line(ctx, [f0[0], f0[1] - 6], [f0[0], f0[1] + 4]); line(ctx, [f1[0] - 4, f1[1] - 4], [f1[0] + 4, f1[1] + 4]);
      ctx.strokeStyle = '#5a4936'; ctx.lineWidth = 3; line(ctx, [f2[0], f2[1] - 6], [f2[0], f2[1] + 4]);
      ctx.fillStyle = '#9aa3a5'; ctx.fillRect(f2[0] - 4, f2[1] - 8, 8, 4);
      ctx.lineCap = 'butt';
      poly(ctx, bb.t, null, 'rgba(0,0,0,0.4)');
    }
    outline(ctx, t, near);
  }

  var STONE = { n: '#666963', w: '#5f625c', s: '#393c38', e: '#30332f', top: '#787b73' };

  function drawCampfire(ctx, r, c, time, near, lvl) {
    var cx = r.x + r.w / 2, cy = r.y + r.h / 2, up = lvl >= 2, i, n = up ? 12 : 9, R = up ? 23 : 20;
    ctx.fillStyle = 'rgba(14,10,8,0.85)';                                   // scorched ground
    ctx.beginPath(); ctx.ellipse(cx, cy, R - 1, R - 2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(70,52,38,0.4)'; ctx.beginPath(); ctx.ellipse(cx, cy, R - 7, R - 8, 0, 0, TAU); ctx.fill();
    var ring = [];
    for (i = 0; i < n; i++) {
      var a = i / n * TAU + 0.3, sz = 10 + (i * 7 % 4);
      ring.push({ x: cx + Math.cos(a) * R - sz / 2, y: cy + Math.sin(a) * R * 0.95 - sz / 2, w: sz, h: sz - 2 });
    }
    ring.sort(function (p, q) { return p.y - q.y; });
    var north = ring.filter(function (s) { return s.y + s.h / 2 < cy; }), south = ring.filter(function (s) { return s.y + s.h / 2 >= cy; });
    north.forEach(function (s) { box(ctx, s, 0, 0.018, c, STONE); });
    // logs, then flames (flicker is a few sines, no randomness: stable and smooth)
    ctx.lineCap = 'round';
    [[-1, 0.55, '#4b3a28'], [0.5, -0.8, '#54422d'], [0.9, 0.6, '#47372a']].forEach(function (l) {
      var a0 = lift(cx - 13 * l[0], cy - 7 * l[1], 0.012, c), a1 = lift(cx + 13 * l[0], cy + 7 * l[1], 0.012, c);
      ctx.strokeStyle = l[2]; ctx.lineWidth = 6; line(ctx, a0, a1);
      ctx.strokeStyle = 'rgba(255,150,60,0.35)'; ctx.lineWidth = 2; line(ctx, a0, [(a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2]);
    });
    ctx.lineCap = 'butt';
    var fb = lift(cx, cy, 0.016, c), fl = 0.5 + 0.12 * Math.sin(time * 9.1) + 0.08 * Math.sin(time * 15.3 + 1) + 0.05 * Math.sin(time * 23);
    var tones = [['rgba(168,67,28,0.9)', 1, 15], ['rgba(224,138,44,0.95)', 0.74, 11], ['rgba(250,214,122,0.95)', 0.45, 6]];
    tones.forEach(function (tn) {
      var hgt = (up ? 36 : 30) * fl * 1.6 * tn[1], w = tn[2];
      ctx.fillStyle = tn[0];
      ctx.beginPath(); ctx.moveTo(fb[0] - w, fb[1] + 3);
      ctx.quadraticCurveTo(fb[0] - w * 0.9, fb[1] - hgt * 0.5, fb[0] - w * 0.2 + Math.sin(time * 7) * 2, fb[1] - hgt);
      ctx.quadraticCurveTo(fb[0] + w * 0.1, fb[1] - hgt * 0.55, fb[0] + w * 0.55 + Math.sin(time * 6 + 2) * 2, fb[1] - hgt * 0.72);
      ctx.quadraticCurveTo(fb[0] + w * 1.05, fb[1] - hgt * 0.25, fb[0] + w, fb[1] + 3);
      ctx.closePath(); ctx.fill();
    });
    south.forEach(function (s) { box(ctx, s, 0, 0.018, c, STONE); });
    if (up) {                                                               // level 2: forked posts, spit and a hanging pot
      var pl = { x: cx - 31, y: cy - 4, w: 5, h: 5 }, pr = { x: cx + 26, y: cy - 4, w: 5, h: 5 };
      var p1 = box(ctx, pl, 0, 0.066, c, POST), p2 = box(ctx, pr, 0, 0.066, c, POST);
      var s0 = [(p1.t[0][0] + p1.t[2][0]) / 2, (p1.t[0][1] + p1.t[2][1]) / 2], s1 = [(p2.t[0][0] + p2.t[2][0]) / 2, (p2.t[0][1] + p2.t[2][1]) / 2];
      ctx.strokeStyle = '#2c2418'; ctx.lineWidth = 3; line(ctx, s0, s1);
      var pm = mix(s0, s1, 0.5), py = pm[1] + 9;
      ctx.strokeStyle = '#1a1c1b'; ctx.lineWidth = 1; line(ctx, [pm[0] - 5, pm[1]], [pm[0] - 8, py - 2]); line(ctx, [pm[0] + 5, pm[1]], [pm[0] + 8, py - 2]);
      var gr = ctx.createLinearGradient(pm[0] - 12, 0, pm[0] + 12, 0);
      gr.addColorStop(0, '#2c312f'); gr.addColorStop(0.35, '#555d59'); gr.addColorStop(1, '#222624');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(pm[0], py + 7, 12, 10, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7a827d'; ctx.beginPath(); ctx.ellipse(pm[0], py, 12, 4.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a2f1e'; ctx.beginPath(); ctx.ellipse(pm[0], py + 0.5, 9.5, 3, 0, 0, TAU); ctx.fill();
    }
    if (near) { ctx.strokeStyle = 'rgba(170,185,150,0.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, R + 8, R + 7, 0, 0, TAU); ctx.stroke(); }
    return { x: fb[0], y: fb[1] - 30 };
  }

  function drawBed(ctx, r, c, lvl, near) {
    var up = lvl >= 2, i, FR = { n: '#4a3f30', w: '#463b2d', s: '#2c251b', e: '#251f16', top: '#5a4d3a' };
    [[0, 0], [r.w - 8, 0], [0, r.h - 8], [r.w - 8, r.h - 8]].forEach(function (p) {
      box(ctx, { x: r.x + p[0], y: r.y + p[1], w: 8, h: 8 }, 0, 0.02, c, POST);
    });
    if (up) box(ctx, { x: r.x - 1, y: r.y - 4, w: r.w + 2, h: 7 }, 0.012, 0.078, c, { n: '#4a3f30', w: '#463b2d', s: '#33291d', e: '#2a2218', top: '#5d5040' }, 3);
    var frame = box(ctx, r, 0.02, 0.03, c, FR);
    var m = { x: r.x + 4, y: r.y + 5, w: r.w - 8, h: r.h - 9 };
    var mt = box(ctx, m, 0.03, 0.042, c, { n: '#736e60', w: '#6c6759', s: '#444136', e: '#3a382f', top: '#8a8474' }), t = mt.t;
    var pil = box(ctx, { x: m.x + 6, y: m.y + 4, w: m.w - 12, h: 17 }, 0.042, 0.052, c, { n: '#b0a999', w: '#a8a191', s: '#7a7467', e: '#6c675b', top: '#c4bdac' });
    ctx.strokeStyle = 'rgba(60,54,44,0.4)'; ctx.lineWidth = 1; poly(ctx, pil.t, null, 'rgba(60,54,44,0.45)');
    var q = [topPt(t, 0, 0.3), topPt(t, 1, 0.3), t[2], t[3]];                // blanket over the lower part
    poly(ctx, q, up ? '#5b4636' : '#46513f', 'rgba(15,12,9,0.5)');
    ctx.lineWidth = 1;
    for (i = 1; i < (up ? 6 : 4); i++) {
      ctx.strokeStyle = up ? (i % 2 ? 'rgba(160,120,70,0.34)' : 'rgba(20,14,10,0.3)') : 'rgba(20,28,18,0.35)';
      line(ctx, mix(q[0], q[3], i / (up ? 6 : 4)), mix(q[1], q[2], i / (up ? 6 : 4)));
    }
    if (up) for (i = 1; i < 4; i++) { ctx.strokeStyle = 'rgba(20,14,10,0.22)'; line(ctx, mix(q[0], q[1], i / 4), mix(q[3], q[2], i / 4)); }
    ctx.strokeStyle = 'rgba(235,225,190,0.2)'; ctx.lineWidth = 1.5; line(ctx, q[0], q[1]);   // folded edge catches the light
    if (near) outline(ctx, frame.t, true);
  }

  function drawTank(ctx, r, c, near, time, lvl) {
    var up = lvl >= 2, k = up ? 0.088 : H.tank, cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = r.w / 2 - 2;
    var B = [cx, cy], T = lift(cx, cy, k, c), R1 = R * (1 + k);
    var dx = T[0] - B[0], dy = T[1] - B[1], L = Math.sqrt(dx * dx + dy * dy), th = Math.atan2(dy, dx), i;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(cx, cy, R + 1.5, 0, TAU); ctx.fill();
    if (L > R1 - R + 0.5) {                                                 // side wall = hull of the bottom and top circles
      var phi = Math.acos((R - R1) / L), a1 = th + phi, a2 = th - phi;
      var g = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
      g.addColorStop(0, up ? '#58605b' : '#4a514c'); g.addColorStop(0.4, up ? '#79827c' : '#646c66'); g.addColorStop(1, '#262a28');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(B[0] + R * Math.cos(a1), B[1] + R * Math.sin(a1));
      ctx.lineTo(T[0] + R1 * Math.cos(a1), T[1] + R1 * Math.sin(a1));
      ctx.lineTo(T[0] + R1 * Math.cos(a2), T[1] + R1 * Math.sin(a2));
      ctx.lineTo(B[0] + R * Math.cos(a2), B[1] + R * Math.sin(a2));
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, R, th + Math.PI / 2, th + Math.PI * 1.5); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(15,18,17,0.8)'; ctx.lineWidth = 2;
      for (i = 1; i <= (up ? 3 : 2); i++) {                                 // metal hoops
        var f = i / ((up ? 3 : 2) + 1), hc = mix(B, T, f), hr = R + (R1 - R) * f;
        ctx.beginPath(); ctx.arc(hc[0], hc[1], hr, th - Math.PI / 2 - 0.2, th + Math.PI / 2 + 0.2); ctx.stroke();
      }
    }
    ctx.fillStyle = '#1b1f1d'; ctx.beginPath(); ctx.arc(T[0], T[1], R1, 0, TAU); ctx.fill();                 // rim
    ctx.strokeStyle = '#69716c'; ctx.lineWidth = 3; ctx.stroke();
    var wl = ctx.createRadialGradient(T[0] - R1 * 0.3, T[1] - R1 * 0.3, 2, T[0], T[1], R1);
    wl.addColorStop(0, '#3a5058'); wl.addColorStop(1, '#1d2a30');
    ctx.fillStyle = wl; ctx.beginPath(); ctx.arc(T[0], T[1], R1 - 4, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(190,215,220,0.22)'; ctx.lineWidth = 1;
    var rp = (time * 0.35) % 1;
    ctx.globalAlpha = 1 - rp; ctx.beginPath(); ctx.ellipse(T[0] + 3, T[1] + 1, 3 + rp * (R1 - 9), (3 + rp * (R1 - 9)) * 0.9, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    if (up) {                                                               // level 2: tap near the bottom
      ctx.fillStyle = '#8a928d'; ctx.fillRect(cx + R * 0.45 - 3, cy + R * 0.88 - 2, 7, 9);
      ctx.fillStyle = '#1a1c1b'; ctx.fillRect(cx + R * 0.45 - 1, cy + R * 0.88 + 5, 3, 4);
    }
    if (near) { ctx.strokeStyle = 'rgba(170,185,150,0.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(T[0], T[1], R1 + 3, 0, TAU); ctx.stroke(); }
  }

  // Empty build spots, shown while the build menu is open (flat marks on the ground).
  function drawSpots(ctx, b, time) {
    var defs = G.data.buildings, pulse = 0.5 + 0.5 * Math.sin(time * 2.2);
    ctx.save();
    ctx.setLineDash([9, 6]); ctx.lineWidth = 1.5;
    ctx.font = '12px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
    G.data.buildingOrder.forEach(function (id) {
      var d = defs[id], s = d.spot;
      if (!s || b.levels[id] > 0) return;
      ctx.fillStyle = 'rgba(143,154,126,' + (0.07 + 0.03 * pulse).toFixed(3) + ')';
      ctx.strokeStyle = 'rgba(170,185,150,' + (0.45 + 0.2 * pulse).toFixed(3) + ')';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(s.x, s.y, s.w, s.h, 8); else ctx.rect(s.x, s.y, s.w, s.h);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(205,210,200,0.85)';
      ctx.fillText(d.name, s.x + s.w / 2, s.y + s.h / 2);
    });
    ctx.restore();
  }

  function drawCabin(ctx, r, c, time) {
    var cols = { n: '#4a4334', w: '#433c2f', s: '#2b271e', e: '#25211a' };
    var bx = box(ctx, r, 0, H.wall, c, cols, 5), b = bx.b, t = bx.t;
    function onWall(side, u, f) {                                           // point on a wall: u along, f up
      var A = side === 's' ? [r.x, r.y + r.h] : [r.x + r.w, r.y], B = [r.x + r.w, r.y + r.h];
      return lift(A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, H.wall * f, c);
    }
    function pane(side, u0, u1, f0, f1, fill, frame) {
      var q = [onWall(side, u0, f0), onWall(side, u1, f0), onWall(side, u1, f1), onWall(side, u0, f1)];
      ctx.lineWidth = 1.5; poly(ctx, q, fill, frame);
      return q;
    }
    var glow = 0.5 + 0.06 * Math.sin(time * 2.3) + 0.04 * Math.sin(time * 5.1);    // lamp flicker, very mild
    if (bx.vis.s) {
      pane('s', 0.43, 0.57, 0, 0.82, '#15120e', '#0c0a08');                 // door
      var dk = onWall('s', 0.545, 0.4); ctx.fillStyle = '#8f9a7e'; ctx.fillRect(dk[0] - 1.2, dk[1] - 1.2, 2.4, 2.4);
      var w1 = pane('s', 0.14, 0.3, 0.34, 0.76, 'rgba(206,158,88,' + glow.toFixed(3) + ')', '#15120e');
      ctx.strokeStyle = '#15120e'; ctx.lineWidth = 1; line(ctx, mix(w1[0], w1[1], 0.5), mix(w1[3], w1[2], 0.5));
      pane('s', 0.72, 0.86, 0.34, 0.76, 'rgba(20,24,24,0.9)', '#15120e');   // dark, boarded window
      var w2a = onWall('s', 0.72, 0.5), w2b = onWall('s', 0.86, 0.62);
      ctx.strokeStyle = '#4a4031'; ctx.lineWidth = 2.5; line(ctx, w2a, w2b);
    }
    if (bx.vis.e) pane('e', 0.36, 0.64, 0.34, 0.76, 'rgba(20,24,24,0.9)', '#15120e');
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#100e0b';
    for (var i = 0; i < 4; i++) line(ctx, b[i], t[i]);                      // corner posts

    // gabled roof: eaves at wall height (with overhang), ridge higher along the long axis
    var ov = 13, my = r.y + r.h / 2;
    var nw = lift(r.x - ov, r.y - ov, H.wall, c), ne = lift(r.x + r.w + ov, r.y - ov, H.wall, c);
    var se = lift(r.x + r.w + ov, r.y + r.h + ov, H.wall, c), sw = lift(r.x - ov, r.y + r.h + ov, H.wall, c);
    var rw = lift(r.x - ov, my, H.ridge, c), re = lift(r.x + r.w + ov, my, H.ridge, c);
    function slope(a, bb, north) {
      poly(ctx, [a, bb, re, rw], north ? '#474d3e' : '#2d312a');
      ctx.strokeStyle = north ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.38)'; ctx.lineWidth = 1;
      var rows = 5, f, u;
      for (f = 1; f < rows; f++) line(ctx, mix(a, rw, f / rows), mix(bb, re, f / rows));
      for (f = 0; f < rows; f++) {                                           // staggered shingle joints
        for (u = (f % 2 ? 0.035 : 0.07); u < 1; u += 0.07) {
          var p0 = mix(mix(a, bb, u), mix(rw, re, u), f / rows), p1 = mix(mix(a, bb, u), mix(rw, re, u), (f + 1) / rows);
          line(ctx, p0, p1);
        }
      }
      if (north) {                                                          // moss creeping up the cold side
        ctx.fillStyle = 'rgba(58,82,48,0.5)';
        [[0.12, 0.2, 16], [0.34, 0.1, 11], [0.62, 0.24, 19], [0.86, 0.12, 13], [0.5, 0.5, 9]].forEach(function (m) {
          var q = mix(mix(a, bb, m[0]), mix(rw, re, m[0]), m[1]);
          ctx.beginPath(); ctx.ellipse(q[0], q[1], m[2], m[2] * 0.55, 0, 0, TAU); ctx.fill();
        });
      }
    }
    poly(ctx, [nw, sw, rw], '#343229'); poly(ctx, [ne, se, re], '#211f19');  // gable ends
    if (c.y > my) { slope(nw, ne, true); slope(sw, se, false); } else { slope(sw, se, false); slope(nw, ne, true); }
    ctx.strokeStyle = 'rgba(214,220,190,0.25)'; ctx.lineWidth = 2; line(ctx, rw, re);            // ridge cap
    ctx.strokeStyle = '#0f0e0b'; ctx.lineWidth = 1.5; poly(ctx, [nw, ne, se, sw], null, '#0f0e0b');

    // chimney on the north slope + thin smoke
    var ch = { x: r.x + r.w * 0.68, y: r.y + r.h * 0.2, w: 24, h: 22 };
    var stone = { n: '#5a5d57', w: '#525550', s: '#2f312e', e: '#292b28', top: '#161715' };
    var cb = box(ctx, ch, H.wall * 1.25, H.chimney, c, stone, 3);
    ctx.lineWidth = 3; poly(ctx, cb.t, null, '#4a4d48');
    return { x: (cb.t[0][0] + cb.t[2][0]) / 2, y: (cb.t[0][1] + cb.t[2][1]) / 2 };
  }

  function drawSmoke(ctx, at, time) {
    for (var i = 0; i < 7; i++) {
      var ph = (time * 0.11 + i / 7) % 1;
      var x = at.x + ph * 64 + Math.sin(time * 0.6 + i * 2.1) * 6 * ph, y = at.y - ph * 92;
      ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.11;
      ctx.drawImage(K.SP.mist.c, x - (10 + ph * 34), y - (10 + ph * 34), 20 + ph * 68, 20 + ph * 68);
    }
    ctx.globalAlpha = 1;
  }

  // ---- static terrain ------------------------------------------------------------------------------

  function buildMacro(b) {
    var k = 0.25, rand = G.util.rng(3301), W = b.width, Hh = b.height, L = b.layout, a = L.area, i;
    var c = document.createElement('canvas');
    c.width = Math.ceil(W * k); c.height = Math.ceil(Hh * k);
    var g = c.getContext('2d');
    g.scale(k, k);
    function blob(x, y, r, rgb, al) {
      var gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(' + rgb + ',' + al + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    var tones = [['44,78,42', 0.13], ['86,66,40', 0.11], ['0,0,0', 0.2], ['0,0,0', 0.14], ['36,62,44', 0.13], ['170,180,140', 0.04]];
    for (i = 0; i < 100; i++) {
      var t = tones[Math.floor(rand() * tones.length)];
      blob(rand() * W, rand() * Hh, 140 + rand() * 320, t[0], t[1] * (0.5 + rand() * 0.5));
    }
    // packed earth inside the fence: a few shrinking passes give a soft, worn edge
    for (i = 0; i < 5; i++) {
      var m = 34 - i * 16;
      g.fillStyle = 'rgba(128,108,78,0.034)';
      g.beginPath();
      if (g.roundRect) g.roundRect(a.x - m, a.y - m, a.w + m * 2, a.h + m * 2, 46); else g.rect(a.x - m, a.y - m, a.w + m * 2, a.h + m * 2);
      g.fill();
    }
    for (i = 0; i < 26; i++) blob(a.x + rand() * a.w, a.y + rand() * a.h, 50 + rand() * 110, rand() < 0.5 ? '0,0,0' : '132,110,78', 0.09);
    var gx = L.gate.x + L.gate.w / 2, door = [L.cabin.x + L.cabin.w / 2, L.cabin.y + L.cabin.h + 16];
    var paths = [
      [[gx, 330], [gx, L.trail.y], [gx, a.y + 60], [gx, a.y + 190]],
      [[gx, a.y + 150], [gx - 60, a.y + 232], [door[0] + 60, door[1] + 40], door],
      [[gx, a.y + 110], [L.chest.x - 30, L.chest.y + 74], [L.chest.x + 26, L.chest.y + 60]],
      [[gx, a.y + 190], [L.spawn.x, L.spawn.y]]
    ];
    g.lineCap = 'round'; g.lineJoin = 'round';
    [[112, 0.045], [78, 0.065], [48, 0.085], [24, 0.06]].forEach(function (p) {
      g.strokeStyle = 'rgba(134,112,80,' + p[1] + ')'; g.lineWidth = p[0];
      paths.forEach(function (path) {
        g.beginPath(); g.moveTo(path[0][0], path[0][1]);
        for (var j = 1; j < path.length - 1; j++) g.quadraticCurveTo(path[j][0], path[j][1], (path[j][0] + path[j + 1][0]) / 2, (path[j][1] + path[j + 1][1]) / 2);
        g.lineTo(path[path.length - 1][0], path[path.length - 1][1]);
        g.stroke();
      });
    });
    blob(L.cabin.x + L.cabin.w * 0.22, L.cabin.y + L.cabin.h + 60, 150, '214,160,84', 0.085);   // lamp light spilling out of the window
    var E = 420;
    function edge(x0, y0, x1, y1, rx, ry, rw, rh) {
      var gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, 'rgba(0,0,0,0.62)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(rx, ry, rw, rh);
    }
    edge(0, 0, E, 0, 0, 0, E, Hh); edge(W, 0, W - E, 0, W - E, 0, E, Hh);
    edge(0, 0, 0, E, 0, 0, W, E); edge(0, Hh, 0, Hh - E, 0, Hh - E, W, E);
    return { c: c, k: k };
  }

  // One blurred layer with the cast shadows of every structure (they never move).
  function buildShadows(b) {
    var a = b.layout.area, M = 150, x0 = a.x - M, y0 = a.y - M, w = a.w + M * 2, h = a.h + M * 2;
    var heights = { fence: 15, chest: 20, woodpile: 24, cabin: 62, workbench: 15, campfire: 8, bed: 9, tank: 26 };
    var sp = K.mk(w, h, function (g) {
      g.translate(-(x0 + w / 2), -(y0 + h / 2));
      try { g.filter = 'blur(5px)'; } catch (e) { /* sharp shadows */ }
      g.fillStyle = '#000';
      b.solids.forEach(function (r) {
        var hh = heights[r.kind], lv = (b.levels && b.levels[r.kind]) || 1;
        if (!hh) return;
        if (lv >= 2) hh *= r.kind === 'fence' || r.kind === 'tank' ? 1.45 : 1.2;
        var dx = SUN.x * hh, dy = SUN.y * hh;
        g.beginPath();                                   // rectangle swept along the light direction
        g.moveTo(r.x, r.y); g.lineTo(r.x + r.w, r.y); g.lineTo(r.x + r.w + dx, r.y + dy);
        g.lineTo(r.x + r.w + dx, r.y + r.h + dy); g.lineTo(r.x + dx, r.y + r.h + dy); g.lineTo(r.x, r.y + r.h);
        g.closePath(); g.fill();
      });
    }, 0.5);
    return { sp: sp, x: x0 + w / 2, y: y0 + h / 2 };
  }

  function buildDecor(b) {
    var rand = G.util.rng(9413), out = [], L = b.layout, a = L.area;
    function inYard(x, y, pad) { return x > a.x - pad && x < a.x + a.w + pad && y > a.y - pad && y < a.y + a.h + pad; }
    function onTrail(x, y) { return Math.abs(x - L.trail.x) < 64 && y < a.y + 10; }
    function scatter(kind, count, rule) {
      var list = K.SP[kind], tries = count * 8, placed = 0;
      while (placed < count && tries-- > 0) {
        var x = Math.round(20 + rand() * (b.width - 40)), y = Math.round(20 + rand() * (b.height - 40));
        if (!rule(x, y)) continue;
        out.push({ sp: list[Math.floor(rand() * list.length)], x: x, y: y });
        placed++;
      }
    }
    function clearOfSolids(x, y, pad) {
      for (var i = 0; i < b.solids.length; i++) {
        var r = b.solids[i];
        if (x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad) return false;
      }
      return true;
    }
    scatter('leaves', 300, function (x, y) { return clearOfSolids(x, y, 6); });
    scatter('pebbles', 200, function (x, y) { return clearOfSolids(x, y, 6); });
    scatter('grass', 760, function (x, y) { return !onTrail(x, y) && clearOfSolids(x, y, 4) && (!inYard(x, y, -30) || rand() < 0.12); });
    scatter('grass', 120, function (x, y) { return inYard(x, y, 26) && !inYard(x, y, -34) && !onTrail(x, y) && clearOfSolids(x, y, 2); });   // tufts along the fence
    scatter('flowers', 70, function (x, y) { return !inYard(x, y, 20) && !onTrail(x, y); });
    scatter('fern', 150, function (x, y) { return !inYard(x, y, 50) && !onTrail(x, y) && clearOfSolids(x, y, 20); });
    scatter('bush', 44, function (x, y) { return !inYard(x, y, 80) && !onTrail(x, y) && clearOfSolids(x, y, 44); });
    out.push({ sp: K.SP.stump.oak, x: a.x + 255, y: a.y + 262 });           // chopping block in the yard
    out.push({ sp: K.SP.branches[0], x: a.x + 300, y: a.y + 280 });
    out.push({ sp: K.SP.stones[1], x: a.x + 690, y: a.y + 420 });
    return out;
  }

  function sortedOrder(b) {
    var order = b.solids.filter(function (r) { return r.kind !== 'trunk'; });
    order.sort(function (p, q) { return (p.y + p.h) - (q.y + q.h); });
    return order;
  }

  function prepare(b) {
    if (T) return T;
    K = G.forestArt.kit();
    T = { macro: buildMacro(b), shadows: buildShadows(b), decor: buildDecor(b), order: sortedOrder(b), smokeAt: null, fireAt: null };
    return T;
  }

  // Something was built or upgraded: new draw order and new cast shadows.
  function refresh(b) {
    if (!T) return;
    T.order = sortedOrder(b);
    T.shadows = buildShadows(b);
  }

  // ---- frame drawing -------------------------------------------------------------------------------

  function drawBelow(ctx, b, vr, time, py, opts) {
    prepare(b);
    var i;
    ctx.fillStyle = K.ground;
    ctx.fillRect(vr.x0, vr.y0, vr.x1 - vr.x0, vr.y1 - vr.y0);
    var k = T.macro.k;
    var sx = Math.max(0, vr.x0), sy = Math.max(0, vr.y0), ex = Math.min(b.width, vr.x1), ey = Math.min(b.height, vr.y1);
    if (ex > sx && ey > sy) ctx.drawImage(T.macro.c, sx * k, sy * k, (ex - sx) * k, (ey - sy) * k, sx, sy, ex - sx, ey - sy);

    for (i = 0; i < T.decor.length; i++) {
      var d = T.decor[i];
      if (K.seen(vr, d.x, d.y, 60)) ctx.drawImage(d.sp.c, d.x - d.sp.w / 2, d.y - d.sp.h / 2, d.sp.w, d.sp.h);
    }

    if (opts.spots) drawSpots(ctx, b, time);

    ctx.globalAlpha = 0.5;
    K.blit(ctx, T.shadows.sp, T.shadows.x, T.shadows.y);
    ctx.globalAlpha = 1;
    K.treeShadows(ctx, b.trees, vr);
    K.treeBases(ctx, b.trees, vr);

    var cf = G.data.buildings.campfire.spot;
    if (b.levels.campfire > 0) {                                           // firelight on the ground (flickers gently)
      var fl = 0.8 + 0.1 * Math.sin(time * 9.1) + 0.06 * Math.sin(time * 15.3 + 1), cx = cf.x + cf.w / 2, cy = cf.y + cf.h / 2;
      var gr = ctx.createRadialGradient(cx, cy, 10, cx, cy, 190);
      gr.addColorStop(0, 'rgba(230,140,56,' + (0.3 * fl).toFixed(3) + ')'); gr.addColorStop(0.45, 'rgba(190,100,40,' + (0.1 * fl).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(190,100,40,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gr; ctx.fillRect(cx - 190, cy - 190, 380, 380);
      ctx.globalCompositeOperation = 'source-over';
    }

    T.smokeAt = null; T.fireAt = null;
    structures(ctx, b, vr, time, py, false, opts);
  }

  // Structures whose base is south of the player are drawn after the player (they stand in front).
  function structures(ctx, b, vr, time, py, front, opts) {
    var c = { x: (vr.x0 + vr.x1) / 2, y: (vr.y0 + vr.y1) / 2 + TILT };
    for (var i = 0; i < T.order.length; i++) {
      var r = T.order[i], lv = (b.levels && b.levels[r.kind]) || 1;
      if ((r.y + r.h > py) !== front) continue;
      if (r.kind === 'fence') drawFence(ctx, r, c, b.layout.gate, lv);
      else if (r.kind === 'cabin') T.smokeAt = drawCabin(ctx, r, c, time);
      else if (r.kind === 'chest') drawChest(ctx, r, c, opts.near === 'chest', lv);
      else if (r.kind === 'woodpile') drawWoodpile(ctx, r, c);
      else if (r.kind === 'workbench') drawWorkbench(ctx, r, c, opts.near === 'workbench', lv);
      else if (r.kind === 'campfire') T.fireAt = drawCampfire(ctx, r, c, time, opts.near === 'campfire', lv);
      else if (r.kind === 'bed') drawBed(ctx, r, c, lv, opts.near === 'bed');
      else if (r.kind === 'tank') drawTank(ctx, r, c, opts.near === 'tank', time, lv);
    }
  }

  function drawAbove(ctx, b, vr, time, py, opts) {
    structures(ctx, b, vr, time, py, true, opts);
    K.treeTops(ctx, b.trees, vr, time, null, 0);
    if (T.smokeAt) drawSmoke(ctx, T.smokeAt, time);
    if (T.fireAt) {                                                         // thin smoke from the campfire
      for (var s = 0; s < 4; s++) {
        var ph = (time * 0.18 + s / 4) % 1, sx = T.fireAt.x + Math.sin(time * 0.8 + s * 2) * 5 * ph + ph * 14, sy = T.fireAt.y - ph * 62;
        ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.09;
        ctx.drawImage(K.SP.mist.c, sx - (8 + ph * 22), sy - (8 + ph * 22), 16 + ph * 44, 16 + ph * 44);
      }
      ctx.globalAlpha = 1;
    }
    var vw = vr.x1 - vr.x0, vh = vr.y1 - vr.y0;            // the same low mist as in the forest, thinner
    ctx.globalAlpha = 0.035;
    for (var i = 0; i < 5; i++) {
      var span = vw + 700, mx = ((i * 431 + time * (6 + i * 2) - vr.x0 * 0.25) % span + span) % span - 350;
      var my = ((i * 277 + Math.sin(time * 0.07 + i) * 60 - vr.y0 * 0.25) % (vh + 500) + vh + 500) % (vh + 500) - 250;
      ctx.drawImage(K.SP.mist.c, vr.x0 + mx - 300, vr.y0 + my - 190, 600, 380);
    }
    ctx.globalAlpha = 1;
  }

  G.baseArt = { prepare: prepare, refresh: refresh, drawBelow: drawBelow, drawAbove: drawAbove };
})(typeof window !== 'undefined' ? window : globalThis);
