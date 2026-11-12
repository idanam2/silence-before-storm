// Player state, movement and animation state (pure, tested in Node) and the drawn body.
// The body is a tiny 3D rig (joints in body space: forward, side, up) that is posed every frame and
// projected with the same tilted view as the world, so one rig gives every facing direction and action.
(function (root) {
  'use strict';
  var G = root.G;
  var clamp = G.util.clamp, lerp = G.util.lerp, TAU = Math.PI * 2;

  var SWING = 0.46;                                     // seconds for one melee swing
  var HELD = { hands: 1, axe: 1, pickaxe: 1, club: 1, gun: 1, crate: 1 };
  var MELEE = { axe: 1, pickaxe: 1, club: 1 };

  function angDiff(a, b) { var d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  // ---- rig ----------------------------------------------------------------------------------------

  var SC = 1.0;          // overall size of the figure
  var GY = 0.8;          // the body's own depth is foreshortened a little (camera looks down at an angle)
  var FOOT = 1.6;        // sole thickness: joints sit this much above the ground
  var SUN = { x: 0.62, y: 0.78 };                       // same light as js/baseart.js (shadows fall south-east)
  var R = { hipW: 4.4, shW: 8.2, thigh: 10.8, shin: 10.6, torso: 14.5, upper: 8.6, fore: 8.4, neck: 7.8, headR: 6.4 };
  var PAL = {
    line: '#141615',
    jacket: [[77, 85, 80], [112, 122, 112]], pants: [[45, 50, 54], [72, 78, 82]], pack: [[82, 68, 46], [122, 103, 76]],
    skin: [[160, 136, 112], [203, 177, 149]], boot: '#2b2622', hair: '#4a3d33', strap: '#3a3024'
  };

  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rotZ(v, t) { var c = Math.cos(t), s = Math.sin(t); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; }
  function tone(pair, t) {
    t = clamp(t, 0, 1);
    return 'rgb(' + Math.round(lerp(pair[0][0], pair[1][0], t)) + ',' + Math.round(lerp(pair[0][1], pair[1][1], t)) + ',' + Math.round(lerp(pair[0][2], pair[1][2], t)) + ')';
  }

  // Two-bone IK: where the elbow sits for a shoulder and a wanted hand position.
  function ik(sh, hand, pole) {
    var d = sub(hand, sh), len = Math.sqrt(dot(d, d)), max = R.upper + R.fore - 0.25;
    if (len < 1.5) { d = [1.5, 0, 0]; len = 1.5; hand = add(sh, d); }
    if (len > max) { d = mul(d, max / len); len = max; hand = add(sh, d); }
    var dir = mul(d, 1 / len), a = (R.upper * R.upper - R.fore * R.fore + len * len) / (2 * len);
    var h = Math.sqrt(Math.max(0, R.upper * R.upper - a * a));
    var pp = sub(pole, mul(dir, dot(pole, dir))), pl = Math.sqrt(dot(pp, pp)) || 1;
    return { elbow: add(add(sh, mul(dir, a)), mul(pp, h / pl)), hand: hand };
  }

  // Poses: hand targets and the tool direction are relative to the chest (forward, side: + is the right hand, up).
  var READY = { rh: [5.5, 7.6, -10.5], wd: norm([0.5, -0.12, 0.85]) };
  var WIND = { rh: [-1.5, 10.6, 7], lh: [6, -8.6, -7], wd: norm([-0.55, 0.35, 0.75]), twist: 0.55, lean: -0.06, crouch: 0 };
  var HIT = { rh: [13, 1, -7.5], lh: [-2, -10, -9], wd: norm([0.9, -0.3, -0.3]), twist: -0.5, lean: 0.28, crouch: 0.08 };
  var FOLLOW = { rh: [9.5, -4, -10.5], lh: [-3, -10, -9], wd: norm([0.6, -0.65, -0.45]), twist: -0.62, lean: 0.24, crouch: 0.08 };
  var CHOP_UP = { rh: [0, 9.5, 8], lh: [5, -8.6, -8], wd: norm([-0.45, 0.15, 0.88]), twist: 0.3, lean: -0.05, crouch: 0 };
  var CHOP_HIT = { rh: [12.5, 3, -9], lh: [3, -9.6, -10], wd: norm([0.85, -0.1, -0.52]), twist: -0.3, lean: 0.34, crouch: 0.16 };

  function lerpPose(a, b, t) {
    if (t <= 0) return a;
    if (t >= 1) return b;
    return { rh: mix3(a.rh, b.rh, t), lh: mix3(a.lh, b.lh, t), wd: norm(mix3(a.wd, b.wd, t)),
      twist: lerp(a.twist, b.twist, t), lean: lerp(a.lean, b.lean, t), crouch: lerp(a.crouch, b.crouch, t) };
  }
  // One attack: wind up over the shoulder, a fast sweep across the front, follow through, back to ready.
  function swingPose(u, ready) {
    if (u < 0.3) return lerpPose(ready, WIND, smooth(u / 0.3));
    if (u < 0.52) { var t = (u - 0.3) / 0.22; return lerpPose(WIND, HIT, t * t); }
    if (u < 0.68) { var e = (u - 0.52) / 0.16; return lerpPose(HIT, FOLLOW, 1 - (1 - e) * (1 - e)); }
    return lerpPose(FOLLOW, ready, smooth((u - 0.68) / 0.32));
  }
  // Chopping loop while gathering with a tool: the blow lands exactly when the phase wraps (that is when the area reports a hit).
  function chopPose(ph) {
    if (ph < 0.16) return CHOP_HIT;
    if (ph < 0.68) return lerpPose(CHOP_HIT, CHOP_UP, smooth((ph - 0.16) / 0.52));
    var t = (ph - 0.68) / 0.32;
    return lerpPose(CHOP_UP, CHOP_HIT, t * t);
  }
  // Gathering by hand: crouch and pick with both hands.
  function grabPose(ph) {
    var s = Math.sin(ph * TAU) * 1.8;
    return { rh: [11 + s, 3.6, -15.5 - s * 0.4], lh: [11 - s, -3.6, -15.5 + s * 0.4], wd: [0, 0, 1], twist: 0, lean: 0.6, crouch: 0.75 };
  }

  // Builds the posed skeleton in body space (x forward, y to the right hand, z up; origin on the ground between the feet).
  function build(p, face, stride, swingU, workPh, time) {
    var gait = p.gait, run = p.runK * gait, ph = stride, held = p.held;
    var idle = (1 - gait) * Math.sin(time * 1.9);
    var armAmp = gait * (0.55 + 0.45 * p.runK), reach = 16.2 - 3.8 * run, aR = -armAmp * Math.sin(ph);
    var base = {
      rh: [Math.sin(aR) * reach + run * 2.5 + 0.8, R.shW + 1.8, -Math.cos(aR) * reach + 0.3 * idle],
      lh: [Math.sin(-aR) * reach + run * 2.5 + 0.8, -(R.shW + 1.8), -Math.cos(aR) * reach + 0.3 * idle],
      wd: [0, 0, 1], twist: 0.2 * gait * Math.sin(ph), lean: 0.3 * run + 0.03 * gait, crouch: 0
    };

    var hp = base;
    if (MELEE[held]) {
      hp = { rh: [READY.rh[0] + base.rh[0] * 0.25, READY.rh[1], READY.rh[2] + 0.6 * idle], lh: base.lh, wd: READY.wd,
        twist: base.twist, lean: base.lean, crouch: 0 };
      if (swingU >= 0) hp = swingPose(swingU, hp);
    } else if (held === 'gun') {
      var d = clamp(angDiff(p.angle, face), -1.2, 1.2);            // the arms point exactly where the player aims
      var aim = { rh: [15.2, 1.2, 0.6 + 0.3 * idle], lh: [14, -0.9, -0.7 + 0.3 * idle], wd: [1, 0, 0], twist: d, lean: 0.05, crouch: 0 };
      var low = { rh: [7.5, 2.6, -8], lh: [7, -1, -8.6], wd: norm([0.75, -0.1, -0.65]), twist: base.twist, lean: base.lean, crouch: 0 };
      hp = lerpPose(aim, low, smooth(run));                        // lowered while running
    } else if (held === 'crate') {
      var bob = 0.5 * gait * Math.sin(ph * 2);
      hp = { rh: [8.6, 6, -9.6 + bob], lh: [8.6, -6, -9.6 + bob], wd: [0, 0, 1], twist: base.twist * 0.3, lean: base.lean * 0.4 - 0.07, crouch: 0 };
    }
    var pose = lerpPose(base, hp, smooth(p.heldK));
    var w = smooth(p.work);
    if (w > 0) pose = lerpPose(pose, p.workTool ? chopPose(workPh) : grabPose(workPh), w);

    // legs: thigh swings, the knee bends while that leg travels forward; the pelvis rides on the lower foot
    var amp = gait * (0.6 + 0.3 * p.runK), bend = gait * (0.85 + 0.75 * p.runK), cr = pose.crouch;
    function leg(sg) {
      var q = ph + (sg > 0 ? 0 : Math.PI);
      var th = amp * Math.sin(q) + cr * 1.1, kn = bend * Math.max(0, Math.cos(q)) + cr * 2.2, sa = th - kn;
      var knee = [Math.sin(th) * R.thigh, sg * R.hipW, -Math.cos(th) * R.thigh];
      return { knee: knee, foot: [knee[0] + Math.sin(sa) * R.shin, sg * R.hipW, knee[2] - Math.cos(sa) * R.shin], sa: sa };
    }
    var lr = leg(1), ll = leg(-1), pz = -Math.min(lr.foot[2], ll.foot[2]);
    function legPts(l, sg) {
      var hip = [0, sg * R.hipW, pz], foot = add(l.foot, [0, 0, pz]), ta = clamp(l.sa * 0.7, -1, 0.4);
      return { hip: hip, knee: add(l.knee, [0, 0, pz]), foot: foot,
        toe: [foot[0] + 4.4 * Math.cos(ta), foot[1], Math.max(0, foot[2] + 4.4 * Math.sin(ta))] };
    }
    var S = { pose: pose, legR: legPts(lr, 1), legL: legPts(ll, -1), twist: pose.twist };

    var lean = pose.lean;
    var C = S.chest = [Math.sin(lean) * R.torso, 0, pz + Math.cos(lean) * R.torso + 0.4 * idle];
    S.toBody = function (v) { return add(C, rotZ(v, pose.twist)); };
    S.dir = function (v) { return rotZ(v, pose.twist); };
    S.shR = S.toBody([0, R.shW, 0]); S.shL = S.toBody([0, -R.shW, 0]);
    S.hipR = [0, R.hipW * 1.15, pz]; S.hipL = [0, -R.hipW * 1.15, pz];
    S.armR = ik(S.shR, S.toBody(pose.rh), S.dir([-0.35, 0.6, -0.72]));
    S.armL = ik(S.shL, S.toBody(pose.lh), S.dir([-0.35, -0.6, -0.72]));
    S.head = add(C, [Math.sin(lean) * R.neck + 0.6, 0, Math.cos(lean) * R.neck]);
    return S;
  }

  // ---- drawing ------------------------------------------------------------------------------------

  var shadowCv = null, SH = { size: 132, ox: 40, oy: 40, k: 0.5 };

  function tube(ctx, pts, w, col) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineWidth = (w + 2.4) * SC; ctx.strokeStyle = PAL.line; ctx.stroke();
    ctx.lineWidth = w * SC; ctx.strokeStyle = col; ctx.stroke();
  }
  function dotAt(ctx, q, r, col) {
    ctx.beginPath(); ctx.arc(q.x, q.y, (r + 1.1) * SC, 0, TAU); ctx.fillStyle = PAL.line; ctx.fill();
    ctx.beginPath(); ctx.arc(q.x, q.y, r * SC, 0, TAU); ctx.fillStyle = col; ctx.fill();
  }
  function shape(ctx, pts, fill, lw) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = lw || 1.1; ctx.strokeStyle = PAL.line; ctx.stroke();
  }

  var player = {
    SWING: SWING,

    create: function (x, y, cfg) {
      var c = cfg || G.config.player;
      return {
        x: x, y: y, prevX: x, prevY: y,
        angle: -Math.PI / 2, prevAngle: -Math.PI / 2,   // where the player aims (mouse)
        radius: c.radius,
        moving: false, running: false,
        stride: 0, pStride: 0,                          // walk cycle phase
        face: -Math.PI / 2, pFace: -Math.PI / 2,        // where the body points: follows `angle` smoothly
        gait: 0, runK: 0,                               // 0..1 blends: standing -> walking, walking -> running
        held: 'hands', heldK: 1,                        // what is in the hands, and the blend into that pose
        swing: -1, pSwing: -1,                          // seconds into a melee swing, -1 = none
        work: 0, workTool: null, workPh: 0, pWorkPh: 0  // gathering: blend, tool id (null = bare hands), loop phase 0..1
      };
    },

    // move: {x, y, run}; aim: {x, y} in world coords or null; dt in seconds.
    update: function (p, move, aim, dt, world, cfg) {
      var c = cfg || G.config.player;
      p.prevX = p.x; p.prevY = p.y; p.prevAngle = p.angle;
      p.pStride = p.stride; p.pFace = p.face;

      var len = Math.sqrt(move.x * move.x + move.y * move.y);
      p.moving = len > 0;
      p.running = p.moving && !!move.run;

      if (p.moving) {
        var speed = c.walkSpeed * (p.running ? c.runMult : 1);
        p.x += (move.x / len) * speed * dt;
        p.y += (move.y / len) * speed * dt;
        p.stride += dt * (p.running ? 15 : 10.5);
      }
      // the legs ease in and out of the walk instead of snapping to a standing pose
      p.gait += ((p.moving ? 1 : 0) - p.gait) * (1 - Math.exp(-14 * dt));
      p.runK += ((p.running ? 1 : 0) - p.runK) * (1 - Math.exp(-9 * dt));
      if (!p.moving && p.gait < 0.004) { p.gait = 0; p.stride = p.pStride = 0; }

      p.x = clamp(p.x, p.radius, world.width - p.radius);
      p.y = clamp(p.y, p.radius, world.height - p.radius);

      if (aim) {
        var dx = aim.x - p.x, dy = aim.y - p.y;
        if (dx * dx + dy * dy > 4) p.angle = Math.atan2(dy, dx);
      } else if (p.moving) {
        p.angle = Math.atan2(move.y, move.x);
      }
      p.face += angDiff(p.angle, p.face) * (1 - Math.exp(-16 * dt));
    },

    // Animation timers. work: null, or { tool: item id or null (bare hands), phase: 0..1 } while gathering.
    animate: function (p, dt, work) {
      p.pSwing = p.swing;
      if (p.swing >= 0) {
        p.swing += dt;
        if (p.swing >= SWING || work) p.swing = p.pSwing = -1;
      }
      p.heldK = Math.min(1, p.heldK + dt * 7);
      p.work += ((work ? 1 : 0) - p.work) * (1 - Math.exp(-12 * dt));
      if (p.work < 0.004) p.work = 0;
      if (work) { p.pWorkPh = p.work < 0.02 ? work.phase : p.workPh; p.workPh = work.phase; p.workTool = work.tool || null; }
      else p.pWorkPh = p.workPh;
    },

    // Puts something in the hands (visual only for now). Returns false for an unknown id.
    setHeld: function (p, id) {
      if (!HELD[id]) return false;
      if (p.held !== id) { p.held = id; p.heldK = 0; p.swing = p.pSwing = -1; }
      return true;
    },

    // Starts a melee swing if a melee tool is held and none is running. Returns true when it started.
    swing: function (p) {
      if (!MELEE[p.held] || p.swing >= 0 || p.work > 0.05) return false;
      p.swing = p.pSwing = 0;
      return true;
    },

    // Snaps the animation to a standing pose facing `angle` (after a teleport).
    settle: function (p, angle) {
      p.angle = p.prevAngle = p.face = p.pFace = angle;
      p.moving = p.running = false;
      p.stride = p.pStride = 0; p.gait = 0; p.runK = 0;
      p.swing = p.pSwing = -1; p.work = 0;
    },

    draw: function (ctx, p, alpha, time) {
      var x = lerp(p.prevX, p.x, alpha), y = lerp(p.prevY, p.y, alpha);
      var face = p.pFace + angDiff(p.face, p.pFace) * alpha;
      var stride = lerp(p.pStride, p.stride, alpha);
      var swingU = p.swing < 0 ? -1 : clamp(lerp(Math.max(0, p.pSwing), p.swing, alpha) / SWING, 0, 1);
      var w0 = p.pWorkPh > p.workPh ? p.pWorkPh - 1 : p.pWorkPh, workPh = ((lerp(w0, p.workPh, alpha) % 1) + 1) % 1;
      var S = build(p, face, stride, swingU, workPh, time || 0);
      var ca = Math.cos(face), sa = Math.sin(face), parts = [], shade = [];

      function P(v) {                                   // body space -> screen, with a depth key (larger = nearer the camera)
        var gx = v[0] * ca - v[1] * sa, gy = v[0] * sa + v[1] * ca;
        return { x: x + gx * SC, y: y + (gy * GY - v[2] - FOOT) * SC, k: gy + v[2] * 0.5, gx: gx, gy: gy, z: v[2] };
      }
      function lit(side) {                              // 0..1: how much a part on that side faces the light (north-west)
        return 0.5 + 0.5 * side * (sa * 0.6 - ca * 0.8);
      }
      function part(key, fn) { parts.push({ k: key, fn: fn }); }

      // legs and boots
      [[S.legR, 1], [S.legL, -1]].forEach(function (e) {
        var l = e[0], a = P(l.hip), b = P(l.knee), c = P(l.foot), t = P(l.toe), col = tone(PAL.pants, lit(e[1]) * 0.8);
        shade.push({ p: [a, b, c, t], w: 5.6 });
        part((b.k + c.k) / 2, function () { tube(ctx, [a, b, c], 5.6, col); tube(ctx, [c, t], 5.2, PAL.boot); });
      });

      // backpack
      var pk0 = P(S.toBody([-5.8, 0, -12.2])), pk1 = P(S.toBody([-5.8, 0, -2.6]));
      shade.push({ p: [pk0, pk1], w: 10.5 });
      part((pk0.k + pk1.k) / 2, function () {
        tube(ctx, [pk0, pk1], 10.5, tone(PAL.pack, 0.25 + 0.5 * lit(0) + 0.25 * (-sa)));
        var f0 = P(S.toBody([-6.2, -3.4, -5.4])), f1 = P(S.toBody([-6.2, 3.4, -5.4]));
        ctx.beginPath(); ctx.moveTo(f0.x, f0.y); ctx.lineTo(f1.x, f1.y); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(20,16,10,0.55)'; ctx.stroke();
      });

      // torso
      var q = [P(S.shL), P(S.shR), P(S.hipR), P(S.hipL)], cK = P(S.chest).k - 2;
      shade.push({ p: q, w: 6.5, closed: true });
      part(cK, function () {
        var col = tone(PAL.jacket, 0.5);
        ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y); ctx.lineTo(q[1].x, q[1].y); ctx.lineTo(q[2].x, q[2].y); ctx.lineTo(q[3].x, q[3].y); ctx.closePath();
        ctx.lineWidth = 8.9 * SC; ctx.strokeStyle = PAL.line; ctx.stroke();
        ctx.fillStyle = col; ctx.fill();
        ctx.lineWidth = 6.5 * SC; ctx.strokeStyle = col; ctx.stroke();
        var front = Math.sin(face + S.twist) * 0.67 + 0.2;                    // pack straps, only seen from the front
        if (front > 0) {
          ctx.globalAlpha = clamp(front * 4, 0, 1); ctx.lineWidth = 1.7; ctx.strokeStyle = PAL.strap;
          [1, -1].forEach(function (sg) {
            var a = P(S.toBody([3.2, sg * 5, 0.8])), b = P(S.toBody([3.4, sg * 4.6, -9]));
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          });
          ctx.globalAlpha = 1;
        }
        var b0 = P([0.4, R.hipW * 1.15 + 2.4, S.hipR[2] + 0.6]), b1 = P([0.4, -R.hipW * 1.15 - 2.4, S.hipR[2] + 0.6]);   // belt
        ctx.beginPath(); ctx.moveTo(b0.x, b0.y); ctx.lineTo(b1.x, b1.y); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(28,24,20,0.7)'; ctx.stroke();
      });

      // arms and hands
      [[S.armR, S.shR, 1], [S.armL, S.shL, -1]].forEach(function (e) {
        var a = P(e[1]), b = P(e[0].elbow), c = P(e[0].hand), l = lit(e[2]);
        shade.push({ p: [a, b, c], w: 4.8 });
        part((a.k + b.k + c.k * 2) / 4 + 0.5, function () {
          tube(ctx, [a, b, c], 4.8, tone(PAL.jacket, 0.15 + l * 0.85));
          dotAt(ctx, c, 2.3, tone(PAL.skin, 0.3 + l * 0.7));
        });
      });

      // what is in the hands
      var hand = S.armR.hand, wd = S.dir(S.pose.wd), side = S.dir([0, 1, 0]), ws = smooth(p.work), hk = smooth(p.heldK);
      function item(id, a) {
        if (a <= 0.01) return;
        var mk = function (pts) { return pts.map(P); };
        if (id === 'crate') {
          var c = add(mix3(S.armR.hand, S.armL.hand, 0.5), add(mul(S.dir([1, 0, 0]), 2.4), [0, 0, 1.4]));
          var f = mul(S.dir([1, 0, 0]), 4.6), s = mul(side, 6.3), lo = [], hi = [], sg = [[-1, -1], [1, -1], [1, 1], [-1, 1]], i;
          for (i = 0; i < 4; i++) {
            var base = add(c, add(mul(f, sg[i][0]), mul(s, sg[i][1])));
            lo.push(P(add(base, [0, 0, -4.4]))); hi.push(P(add(base, [0, 0, 4.4])));
          }
          shade.push({ p: hi, w: 1, closed: true });
          part(P(c).k + 1, function () {
            ctx.globalAlpha = a; ctx.lineJoin = 'round';
            for (i = 0; i < 4; i++) {                                         // walls that face the camera
              var j = (i + 1) % 4, ny = (lo[i].gy + lo[j].gy) / 2 - P(c).gy;
              if (ny <= 0) continue;
              shape(ctx, [lo[i], lo[j], hi[j], hi[i]], (lo[i].gx + lo[j].gx) / 2 - P(c).gx > 0 ? '#3e3323' : '#54452f');
              var m0 = { x: (lo[i].x + hi[i].x) / 2, y: (lo[i].y + hi[i].y) / 2 }, m1 = { x: (lo[j].x + hi[j].x) / 2, y: (lo[j].y + hi[j].y) / 2 };
              ctx.beginPath(); ctx.moveTo(m0.x, m0.y); ctx.lineTo(m1.x, m1.y); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(15,12,8,0.5)'; ctx.stroke();
            }
            shape(ctx, hi, '#7d684a');
            ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(20,14,8,0.45)';
            [1 / 3, 2 / 3].forEach(function (u) {
              ctx.beginPath(); ctx.moveTo(lerp(hi[0].x, hi[3].x, u), lerp(hi[0].y, hi[3].y, u)); ctx.lineTo(lerp(hi[1].x, hi[2].x, u), lerp(hi[1].y, hi[2].y, u)); ctx.stroke();
            });
            ctx.globalAlpha = 1;
          });
          return;
        }
        var blade = cross(side, wd), up = cross(wd, side), butt, tip;
        if (id === 'gun') {
          var g0 = P(add(hand, add(mul(up, 1.7), mul(wd, -1.6)))), g1 = P(add(hand, add(mul(up, 1.7), mul(wd, 8.6))));
          var gr = P(add(hand, add(mul(up, -3), mul(wd, -1.9)))), gm = P(add(hand, add(mul(up, 1.2), mul(wd, -0.4))));
          shade.push({ p: [g0, g1], w: 3 });
          part((g0.k + g1.k) / 2 + 1.5, function () {
            ctx.globalAlpha = a;
            tube(ctx, [gm, gr], 2.4, '#2c2a26');
            tube(ctx, [g0, g1], 3.4, '#2b3033');
            ctx.beginPath(); ctx.moveTo(g0.x, g0.y - 0.9); ctx.lineTo(g1.x, g1.y - 0.9); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(150,160,164,0.55)'; ctx.stroke();
            dotAt(ctx, P(hand), 2.3, tone(PAL.skin, 0.3 + lit(1) * 0.7));
            ctx.globalAlpha = 1;
          });
          return;
        }
        butt = P(add(hand, mul(wd, -3.6))); tip = add(hand, mul(wd, id === 'pickaxe' ? 14 : 13.4));
        var tp = P(tip), grip = P(hand);
        shade.push({ p: [butt, tp], w: 3.4 });
        part((butt.k + tp.k) / 2 + 1.5, function () {
          ctx.globalAlpha = a;
          if (id === 'club') {
            var mid = P(add(hand, mul(wd, 5.5)));
            tube(ctx, [butt, mid], 2.4, '#7a6548');
            tube(ctx, [mid, tp], 4.6, '#6b5840');
            ctx.lineWidth = 1.2; ctx.strokeStyle = '#c3c9c5';
            [7.6, 10.2, 12.6].forEach(function (d, i) {                       // nails
              var n0 = P(add(hand, add(mul(wd, d), mul(blade, i % 2 ? 4.4 : -4.4)))), n1 = P(add(hand, add(mul(wd, d), mul(blade, i % 2 ? 1.6 : -1.6))));
              var n2 = P(add(hand, add(mul(wd, d + 0.8), mul(side, i % 2 ? -4.2 : 4.2)))), n3 = P(add(hand, add(mul(wd, d + 0.8), mul(side, i % 2 ? -1.6 : 1.6))));
              ctx.beginPath(); ctx.moveTo(n0.x, n0.y); ctx.lineTo(n1.x, n1.y); ctx.moveTo(n2.x, n2.y); ctx.lineTo(n3.x, n3.y); ctx.stroke();
            });
          } else {
            tube(ctx, [butt, tp], 2.4, '#8d7556');
            if (id === 'pickaxe') {
              var e0 = P(add(tip, add(mul(blade, 8.6), mul(wd, -2.8)))), e1 = P(add(tip, add(mul(blade, -8.6), mul(wd, -2.8)))), em = P(add(tip, mul(wd, 1.6)));
              ctx.beginPath(); ctx.moveTo(e0.x, e0.y); ctx.quadraticCurveTo(em.x, em.y, e1.x, e1.y);
              ctx.lineWidth = 5; ctx.strokeStyle = PAL.line; ctx.stroke();
              ctx.lineWidth = 2.8; ctx.strokeStyle = '#8b9491'; ctx.stroke();
            } else {
              var h = mk([add(tip, mul(wd, -4.6)), add(tip, mul(wd, 0.6)), add(tip, add(mul(blade, 6.8), mul(wd, 2.4))), add(tip, add(mul(blade, 6.8), mul(wd, -6.2)))]);
              ctx.lineJoin = 'round'; shape(ctx, h, '#8b9491', 1.3);
              ctx.beginPath(); ctx.moveTo(h[2].x, h[2].y); ctx.lineTo(h[3].x, h[3].y); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(225,232,228,0.7)'; ctx.stroke();
            }
          }
          dotAt(ctx, grip, 2.3, tone(PAL.skin, 0.3 + lit(1) * 0.7));
          ctx.globalAlpha = 1;
        });
      }
      if (ws > 0.01 && p.workTool !== p.held) {         // gathering borrows the right tool; whatever was held is put away meanwhile
        if (p.workTool) item(p.workTool, ws);
        if (p.held !== 'hands') item(p.held, hk * (1 - ws));
      } else if (p.held !== 'hands') item(p.held, hk);

      // head: hair from above, and the visible part of the face (a cap on a sphere, clipped at the horizon)
      var hc = P(S.head), hr = R.headR * SC;
      var hy = face + clamp(angDiff(p.angle, face), -1, 1) + S.twist * 0.3;
      shade.push({ p: [hc], w: R.headR * 2 });
      part(hc.k + 3, function () {
        ctx.beginPath(); ctx.arc(hc.x, hc.y, hr + 1.2, 0, TAU); ctx.fillStyle = PAL.line; ctx.fill();
        ctx.beginPath(); ctx.arc(hc.x, hc.y, hr, 0, TAU); ctx.fillStyle = PAL.hair; ctx.fill();
        var n = norm([Math.cos(hy), Math.sin(hy), -0.12]), e1 = norm(cross(n, [0, 0, 1])), e2 = cross(n, e1);
        var cT = Math.cos(1.12), sT = Math.sin(1.12), vy = 0.819, vz = 0.574, N = 20, i, ring = [], start = -1;
        for (i = 0; i < N; i++) {
          var t = i / N * TAU, c = Math.cos(t) * sT, s = Math.sin(t) * sT;
          var v = [n[0] * cT + e1[0] * c + e2[0] * s, n[1] * cT + e1[1] * c + e2[1] * s, n[2] * cT + e1[2] * c + e2[2] * s];
          ring.push({ x: v[0], y: v[1] * vz - v[2] * vy, d: v[1] * vy + v[2] * vz });
        }
        for (i = 0; i < N; i++) if (ring[i].d < 0 && ring[(i + 1) % N].d >= 0) start = i;        // where the rim rises over the horizon
        function edge(a, b) {                           // the point where a rim segment crosses the horizon, on the outline of the head
          var u = a.d / (a.d - b.d), ex = a.x + (b.x - a.x) * u, ey = a.y + (b.y - a.y) * u, l = Math.sqrt(ex * ex + ey * ey) || 1;
          return Math.atan2(ey / l, ex / l);
        }
        ctx.beginPath();
        if (start < 0) {
          if (ring[0].d >= 0) for (i = 0; i < N; i++) ctx[i ? 'lineTo' : 'moveTo'](hc.x + ring[i].x * hr, hc.y + ring[i].y * hr);
        } else {
          var a0 = edge(ring[start], ring[(start + 1) % N]), a1 = a0, j = (start + 1) % N;
          ctx.moveTo(hc.x + Math.cos(a0) * hr, hc.y + Math.sin(a0) * hr);
          for (i = 0; i < N && ring[j].d >= 0; i++, j = (j + 1) % N) ctx.lineTo(hc.x + ring[j].x * hr, hc.y + ring[j].y * hr);
          a1 = edge(ring[(j + N - 1) % N], ring[j]);
          var mid = Math.atan2(n[1] * vz - n[2] * vy, n[0]);                 // close along the outline, on the side the face is on
          ctx.arc(hc.x, hc.y, hr, a1, a0, angDiff(mid, a1) < 0);
        }
        ctx.closePath();
        ctx.fillStyle = tone(PAL.skin, 0.55 + 0.45 * lit(0)); ctx.fill();
        // face features: points on the sphere around the facing direction, shown only while turned to the camera
        var up = [-e2[0], -e2[1], -e2[2]];
        function fp(a, b) {
          var v = norm([n[0] + e1[0] * a + up[0] * b, n[1] + e1[1] * a + up[1] * b, n[2] + e1[2] * a + up[2] * b]);
          return { x: hc.x + v[0] * hr, y: hc.y + (v[1] * vz - v[2] * vy) * hr, d: v[1] * vy + v[2] * vz };
        }
        function seg(a0, b0, a1, b1, w, col) {
          var p0 = fp(a0, b0), p1 = fp(a1, b1), vis = Math.min(p0.d, p1.d);
          if (vis <= 0.05) return;
          ctx.globalAlpha = Math.min(1, (vis - 0.05) * 5);
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke();
          ctx.globalAlpha = 1;
        }
        function dot(a, b0, r, col) {
          var q2 = fp(a, b0);
          if (q2.d <= 0.05) return;
          ctx.globalAlpha = Math.min(1, (q2.d - 0.05) * 5);
          ctx.beginPath(); ctx.arc(q2.x, q2.y, r, 0, TAU); ctx.fillStyle = col; ctx.fill();
          ctx.globalAlpha = 1;
        }
        var eyeR = Math.max(0.8, hr * 0.095);
        [-1, 1].forEach(function (sd) {
          seg(sd * 0.18, 0.44, sd * 0.52, 0.4, Math.max(1, hr * 0.11), PAL.hair);                  // brows
          dot(sd * 0.34, 0.24, eyeR * 1.25, 'rgba(214,204,186,0.75)');                            // eye white
          dot(sd * 0.34, 0.24, eyeR, '#1d1712');                                                   // pupil
        });
        seg(0.02, 0.16, 0.06, -0.06, Math.max(1, hr * 0.1), tone(PAL.skin, 0.32));                  // nose
        seg(-0.18, -0.28, 0.18, -0.28, Math.max(1, hr * 0.1), 'rgba(96,52,44,0.9)');                 // mouth
        seg(-0.48, -0.2, -0.2, -0.56, Math.max(1, hr * 0.14), 'rgba(60,46,36,0.35)');              // stubble along the jaw
        seg(0.48, -0.2, 0.2, -0.56, Math.max(1, hr * 0.14), 'rgba(60,46,36,0.35)');
        ctx.beginPath(); ctx.arc(hc.x - hr * 0.3, hc.y - hr * 0.35, hr * 0.42, 0, TAU);            // soft light on the hair
        ctx.fillStyle = 'rgba(190,170,140,0.13)'; ctx.fill();
      });

      // ---- paint: shadow first, then the parts from far to near ----
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';

      if (!shadowCv && root.document) { shadowCv = root.document.createElement('canvas'); shadowCv.width = shadowCv.height = SH.size * SH.k; }
      if (shadowCv) {                                   // the whole silhouette thrown on the ground, in one soft layer
        var g = shadowCv.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, shadowCv.width, shadowCv.height);
        g.setTransform(SH.k, 0, 0, SH.k, SH.ox * SH.k, SH.oy * SH.k);
        g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = g.fillStyle = '#000';
        shade.forEach(function (s) {
          g.beginPath();
          for (var i = 0; i < s.p.length; i++) {
            var q = s.p[i], sx = (q.gx + SUN.x * q.z * 0.85) * SC, sy = (q.gy * GY + SUN.y * q.z * 0.85) * SC;
            if (s.p.length === 1) g.arc(sx, sy, s.w / 2 * SC, 0, TAU); else g[i ? 'lineTo' : 'moveTo'](sx, sy);
          }
          if (s.p.length === 1) { g.fill(); return; }
          if (s.closed) { g.closePath(); g.fill(); }
          g.lineWidth = s.w * SC; g.stroke();
        });
        ctx.globalAlpha = 0.3;
        ctx.drawImage(shadowCv, x - SH.ox, y - SH.oy, SH.size, SH.size);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';                // contact shadow under the feet
      ctx.beginPath(); ctx.ellipse(x + 1.5, y + 1, 9.5 * SC, 6 * SC, 0, 0, TAU); ctx.fill();

      parts.sort(function (a, b) { return a.k - b.k; });
      for (var i = 0; i < parts.length; i++) parts[i].fn();
      ctx.restore();
    }
  };

  G.player = player;
})(typeof window !== 'undefined' ? window : globalThis);
