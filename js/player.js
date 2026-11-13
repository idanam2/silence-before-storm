// Player state, movement and animation state (pure, tested in Node) and the drawn body.
// The body is a tiny 3D rig (joints in body space: forward, side, up) that is posed every frame and
// projected with the same tilted view as the world, so one rig gives every facing direction and action.
(function (root) {
  'use strict';
  var G = root.G;
  var clamp = G.util.clamp, lerp = G.util.lerp, TAU = Math.PI * 2;

  var SWING = 0.46;                                     // seconds for one melee swing (the default)
  var DUR = { hands: 0.34, axe: 0.46, club: 0.5, pickaxe: 0.52 };   // per held item: a shove is quick, a club is slower
  var HELD = { hands: 1, axe: 1, pickaxe: 1, club: 1, gun: 1, uzi: 1, m16: 1, ak: 1, sniper: 1, crate: 1 };
  var MELEE = { axe: 1, pickaxe: 1, club: 1 };
  // Guns share one aiming pose (both hands out in front). ext: how far the front hand reaches along the gun, muzzle: how far
  // ahead of the feet the bullet leaves (px). parts of a long gun are [fromAlong, fromUp, toAlong, toUp, thickness, colour]
  // in body units, measured from the right hand (along = where it points, up = above the hand).
  var GUNS = { gun: { ext: 0, muzzle: 26 }, uzi: { ext: 1, muzzle: 31 }, m16: { ext: 5, muzzle: 43 }, ak: { ext: 4.5, muzzle: 41 }, sniper: { ext: 7, muzzle: 53 } };
  var LONG = {
    uzi: [[-2.4, 1.7, 7.8, 1.7, 3.8, '#2b2e31'], [7.8, 1.9, 10.6, 1.9, 1.8, '#1c1e20'], [1.6, -0.4, 1.4, -6.2, 2.2, '#26282a'], [-1.8, -0.6, -2.4, -3.4, 2.4, '#2c2a26']],
    m16: [[-10.5, 0.6, -3.2, 1.6, 3.2, '#25282a'], [-3.2, 1.7, 8.4, 1.8, 3.6, '#2a2d30'], [8.4, 1.8, 14.5, 1.8, 3.8, '#24272a'], [14.5, 1.8, 18.6, 1.9, 1.6, '#1b1d1f'],
      [-1.8, 3.8, 6.0, 3.8, 1.2, '#33373a'], [2.4, 0.2, 2.8, -5.4, 2.4, '#202326'], [-3.4, 0.4, -4, -2.8, 2.4, '#25272a']],
    ak: [[-10.5, 0.4, -3.2, 1.5, 3.2, '#6b4a2c'], [-3.2, 1.7, 7.4, 1.8, 3.4, '#2d2f30'], [7.4, 1.8, 13, 1.7, 3.8, '#7a5430'], [13, 1.9, 18, 1.9, 1.6, '#1d1f21'],
      [2.6, 0.2, 4.4, -5.2, 2.6, '#5a3a22'], [-3.4, 0.5, -4, -2.8, 2.4, '#5a3a22']],
    sniper: [[-11.5, 0.4, -3.2, 1.7, 3.4, '#3a3f34'], [-3.2, 1.8, 9.5, 1.9, 3.2, '#2a2d2b'], [9.5, 1.9, 23, 2.0, 1.7, '#1e2123'], [0.8, 3.9, 8.8, 3.9, 2.4, '#1a1c1e'],
      [2.2, 0.4, 2.2, -3.0, 2.2, '#25272a'], [-3.4, 0.6, -4, -2.6, 2.4, '#2a2c2a']]
  };

  function angDiff(a, b) { var d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  // ---- rig ----------------------------------------------------------------------------------------

  var SC = 1.0;          // overall size of the figure
  var GY = 0.8;          // the body's own depth is foreshortened a little (camera looks down at an angle)
  var FOOT = 1.6;        // sole thickness: joints sit this much above the ground
  var SUN = { x: 0.62, y: 0.78 };                       // same light as js/baseart.js (shadows fall south-east)
  var R = { hipW: 4.2, shW: 7.8, thigh: 11.8, shin: 11.6, torso: 15, upper: 9, fore: 8.8, neck: 7.3, headR: 5.4 };   // adult proportions: long legs, a small head
  var LINE = 'rgba(12,14,14,0.58)', EDGE = 1.3;         // the outline: thin and soft, not a cartoon ink line
  // Palettes. The same rig draws the player and the infected (p.look): only colors, posture and face change.
  var PALS = {
    player: {
      line: '#141615',
      jacket: [[50, 82, 96], [84, 128, 144]], pants: [[42, 52, 74], [70, 84, 114]], pack: [[96, 76, 44], [146, 120, 78]],
      skin: [[164, 132, 104], [212, 180, 148]], boot: '#3a3430', hair: '#42342a', strap: '#3a3024'
    },
    // story characters (js/storyart.js draws them standing): no backpack
    rachel: {
      line: '#141615', nopack: true,
      jacket: [[104, 86, 70], [150, 126, 100]], pants: [[58, 56, 60], [92, 90, 94]], pack: [[82, 68, 46], [122, 103, 76]],
      skin: [[166, 138, 116], [206, 178, 154]], boot: '#2b2622', hair: '#9a9590', strap: '#3a3024'
    },
    // the infected: grey-green skin, worn clothes in a few variants (chosen by p.variant), no backpack, hollow eyes
    shambler: {
      line: '#121413', dead: true,
      jackets: [[[56, 64, 74], [90, 100, 114]], [[84, 56, 50], [124, 88, 80]], [[92, 86, 60], [134, 126, 92]]],
      pants: [[44, 44, 46], [70, 70, 72]], skin: [[98, 110, 92], [148, 160, 136]], boot: '#26231f', hair: '#2a2622'
    },
    runner: {
      line: '#121413', dead: true,
      jackets: [[[128, 124, 112], [176, 172, 158]], [[104, 58, 52], [150, 90, 80]], [[58, 82, 84], [92, 124, 126]]],
      pants: [[50, 52, 58], [80, 84, 92]], skin: [[110, 120, 98], [160, 170, 142]], boot: '#2a2622', hair: '#342e28'
    },
    // brute: bloated, darker and redder flesh, heavy torn dark clothes
    brute: {
      line: '#110f0e', dead: true,
      jackets: [[[52, 46, 42], [82, 72, 64]], [[44, 50, 48], [70, 78, 74]], [[62, 44, 40], [96, 70, 62]]],
      pants: [[40, 36, 34], [66, 60, 54]], skin: [[112, 96, 110], [164, 140, 154]], boot: '#201c19', hair: '#2a2622'
    },
    // crawler: muddy, dirty rags close to the ground, sickly olive skin
    crawler: {
      line: '#121413', dead: true,
      jackets: [[[62, 58, 44], [92, 86, 66]], [[50, 56, 50], [78, 86, 76]], [[66, 54, 46], [98, 82, 70]]],
      pants: [[58, 50, 38], [88, 78, 60]], skin: [[98, 110, 78], [146, 158, 116]], boot: '#2a251f', hair: '#2f2b24'
    },
    // glower: irradiated, sickly green flesh, scorched rags
    glower: {
      line: '#0e140d', dead: true,
      jackets: [[[44, 54, 40], [74, 98, 62]], [[60, 66, 44], [96, 112, 66]], [[40, 50, 52], [66, 90, 84]]],
      pants: [[38, 44, 36], [62, 72, 56]], skin: [[96, 150, 80], [160, 230, 120]], boot: '#1c2119', hair: '#202a1c'
    },
    // screamer: pale, bleached, thin pale clothes: stands out from far away
    screamer: {
      line: '#171918', dead: true,
      jackets: [[[128, 126, 120], [176, 174, 166]], [[112, 118, 124], [160, 168, 176]], [[130, 118, 112], [180, 166, 158]]],
      pants: [[70, 72, 74], [104, 106, 108]], skin: [[150, 156, 148], [204, 210, 198]], boot: '#2c2926', hair: '#1c1a1e'
    }
  };
  // Build of each look: thickness of the torso, arms and legs, head size; bare = no shirt (skin torso), bareArms = torn
  // sleeves (true, or 'left' for one arm), blood = stains on the chest, spikes = bone growths on the back, mouth = gape,
  // mane = long hair down the back.
  var BODY = {
    player:   { torso: 1, arm: 1, leg: 1, head: 1 },
    // ribs = an open wound with the ribs showing, stump = some of them lost a forearm, drag = some drag a leg
    shambler: { torso: 1.05, arm: 1, leg: 1, head: 1, bareArms: 'left', blood: 2, ribs: true, stump: true, drag: true },
    runner:   { torso: 0.86, arm: 0.86, leg: 0.9, head: 0.96, bareArms: true, blood: 2, ribs: true },
    brute:    { torso: 1.5, arm: 1.4, leg: 1.25, head: 0.92, bare: true, bareArms: true, blood: 3, spikes: true, ribs: true },
    glower:   { torso: 1.12, arm: 1.05, leg: 1, head: 1.05, bareArms: true, blood: 1, ribs: true, drag: true },
    crawler:  { torso: 0.95, arm: 0.95, leg: 0.9, head: 1, bareArms: true, blood: 2, stump: true },
    screamer: { torso: 0.82, arm: 0.8, leg: 0.85, head: 1.1, mouth: 1.9, mane: true, blood: 1 }
  };
  // What each piece of clothing (data/gear.js) changes on the body: palette entries, or an extra drawn part.
  var OUTFIT = {
    cap:    { head: { col: [[44, 48, 58], [80, 86, 100]], r: 0.97, band: 'rgba(170,178,196,0.55)' } },
    helmet: { head: { col: [[66, 76, 52], [116, 130, 92]], r: 1.12, band: 'rgba(30,36,24,0.6)' } },
    jacket: { pal: { jacket: [[96, 66, 38], [150, 110, 66]] }, collar: 'rgba(52,36,20,0.9)' },
    vest:   { vest: [[58, 70, 50], [98, 114, 84]] },
    hazsuit: { pal: { jacket: [[190, 160, 26], [244, 214, 64]], pants: [[176, 148, 24], [226, 196, 56]], boot: '#2c2a1a' }, collar: 'rgba(120,98,10,0.95)' },
    pants:  { pal: { pants: [[76, 76, 46], [118, 118, 78]] }, cargo: true },
    boots:  { pal: { boot: '#3b2a1c' }, tall: true }
  };
  var NOWEAR = {}, outfitCache = {};
  function outfitOf(eq) {
    var key = (eq.head || '') + '|' + (eq.body || '') + '|' + (eq.legs || '') + '|' + (eq.feet || '');
    if (outfitCache[key]) return outfitCache[key];
    var o = { pal: null }, k, kk, d;
    ['head', 'body', 'legs', 'feet'].forEach(function (slot) {
      d = OUTFIT[eq[slot]];
      if (!d) return;
      for (k in d) {
        if (k === 'pal') { o.pal = o.pal || {}; for (kk in d.pal) o.pal[kk] = d.pal[kk]; } else o[k] = d[k];
      }
    });
    return (outfitCache[key] = o);
  }
  var PAL = PALS.player;
  function palFor(p) {
    var b = PALS[p.look] || PALS.player;
    if (!b.jackets) return b;
    var o = {}, k;
    for (k in b) o[k] = b[k];
    o.jacket = b.jackets[(p.variant || 0) % b.jackets.length];
    return o;
  }

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

  // Unarmed shove: both hands pulled in, then thrust straight out.
  var SHOVE_BACK = { rh: [4, 5.5, -4], lh: [4, -5.5, -4], wd: [0, 0, 1], twist: 0.18, lean: -0.05, crouch: 0 };
  var SHOVE_HIT = { rh: [15.5, 2.6, -1.8], lh: [15.5, -2.6, -1.8], wd: [0, 0, 1], twist: 0, lean: 0.3, crouch: 0.1 };
  function shovePose(u, ready) {
    if (u < 0.36) return lerpPose(ready, SHOVE_BACK, smooth(u / 0.36));
    if (u < 0.5) { var t = (u - 0.36) / 0.14; return lerpPose(SHOVE_BACK, SHOVE_HIT, t * t); }
    if (u < 0.66) return SHOVE_HIT;
    return lerpPose(SHOVE_HIT, ready, smooth((u - 0.66) / 0.34));
  }

  // The infected: arms held out in front, hunched. A runner keeps the normal arm swing but leans far forward.
  var ATK_UP = { rh: [1, 6, 7], lh: [1, -6, 7], wd: [0, 0, 1], twist: 0.2, lean: -0.14, crouch: 0 };
  var ATK_HIT = { rh: [12, 3.5, -9], lh: [12, -3.5, -9], wd: [0, 0, 1], twist: -0.1, lean: 0.44, crouch: 0.15 };
  var STAGGER = { rh: [-3, 9, 6], lh: [-3, -9, 6], wd: [0, 0, 1], twist: 0.25, lean: -0.34, crouch: 0.05 };
  function hostilePose(p, base, gait, ph, idle, time) {
    var v = (p.variant || 0) * 0.37;
    if (p.look === 'runner') return { rh: base.rh, lh: base.lh, wd: base.wd, twist: base.twist, lean: base.lean + 0.3, crouch: 0.08 };
    if (p.look === 'crawler') {                                // nearly on all fours: low, far forward, hands reaching for the ground
      var cs = Math.sin(ph) * 2.2 * gait;
      return { rh: [11 + cs, 6.5, -11.5], lh: [11 - cs, -6.5, -11.5], wd: [0, 0, 1],
        twist: 0.3 * gait * Math.sin(ph) + 0.1 * Math.sin(time * 1.4 + v) * (1 - gait), lean: 0.78 + 0.05 * Math.sin(time * 1.7 + v), crouch: 0.9 };
    }
    if (p.look === 'brute') {                                  // heavy and hunched, arms hanging wide, a slow rolling sway
      var bs = Math.sin(ph) * 1.2 * gait;
      return { rh: [6 + bs, 8.6, -6.5 + 0.5 * idle], lh: [6 - bs, -8.6, -7 + 0.5 * idle], wd: [0, 0, 1],
        twist: 0.28 * gait * Math.sin(ph) + 0.1 * Math.sin(time * 0.7 + v) * (1 - gait), lean: 0.3 + 0.04 * Math.sin(time * 0.9 + v), crouch: 0.04 };
    }
    if (p.look === 'screamer') {                               // thin, arms drawn up to the chest, head tilted back
      var ss = Math.sin(ph) * 1.4 * gait;
      return { rh: [7 + ss, 4.4, 1.5 + 0.6 * idle], lh: [7 - ss, -4.4, 1.2 + 0.6 * idle], wd: [0, 0, 1],
        twist: 0.16 * gait * Math.sin(ph) + 0.2 * Math.sin(time * 1.6 + v) * (1 - gait), lean: 0.06 + 0.05 * Math.sin(time * 1.3 + v), crouch: 0 };
    }
    var sw = Math.sin(ph) * 1.8 * gait, dead = (p.variant || 0) % 3 === 0;       // every third one has an arm that hangs dead
    return { rh: [9 + sw, 5.5, -2.5 + 0.6 * idle + 1.2 * Math.sin(time * 2.3 + v)], lh: dead ? [1.2 - sw * 0.5, -(R.shW + 2.2), -15.6] : [8 - sw, -6, -5.2 + 0.6 * idle], wd: [0, 0, 1],
      twist: 0.24 * gait * Math.sin(ph) + 0.16 * Math.sin(time * 0.9 + v) * (1 - gait) + (dead ? 0.22 : 0), lean: 0.3 + 0.07 * Math.sin(time * 1.2 + v), crouch: 0.05 };
  }
  // One attack of the infected: arms up, a heavy slam at u = hu, back to the shuffle.
  var SCREAM = { rh: [4, 8.4, 9], lh: [4, -8.4, 9], wd: [0, 0, 1], twist: 0, lean: -0.42, crouch: 0 };        // head thrown back, arms flung up
  var CRAWL_UP = { rh: [8, 6, -9], lh: [8, -6, -9], wd: [0, 0, 1], twist: 0.2, lean: 0.6, crouch: 0.85 };
  var SEATED = { rh: [12, 8.5, -11], lh: [12, -8.5, -11], wd: [0, 0, 1], twist: 0, lean: 0.2, crouch: 0 };   // riding pose (arms to the handlebars)
  var CRAWL_HIT = { rh: [17, 3, -13], lh: [17, -3, -13], wd: [0, 0, 1], twist: -0.2, lean: 0.95, crouch: 0.95 };   // a low snap at the legs
  // look 'scream' (p.screaming): the scream is not a blow but a held pose (atk runs over the scream's length).
  function atkPose(u, hu, from, look) {
    if (look === 'scream') {
      if (u < 0.2) return lerpPose(from, SCREAM, smooth(u / 0.2));
      if (u < 0.82) return SCREAM;
      return lerpPose(SCREAM, from, smooth((u - 0.82) / 0.18));
    }
    var up = ATK_UP, hit = ATK_HIT;
    if (look === 'crawler') { up = CRAWL_UP; hit = CRAWL_HIT; }
    var a = hu * 0.78;
    if (u < a) return lerpPose(from, up, smooth(u / a));
    if (u < hu) { var t = (u - a) / (hu - a); return lerpPose(up, hit, t * t); }
    return lerpPose(hit, from, smooth((u - hu) / Math.max(0.05, 1 - hu)));
  }

  // Builds the posed skeleton in body space (x forward, y to the right hand, z up; origin on the ground between the feet).
  function build(p, face, stride, swingU, workPh, time, atkU) {
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
    } else if (GUNS[held]) {
      var d = clamp(angDiff(p.angle, face), -1.2, 1.2);            // the arms point exactly where the player aims
      var kick = p.kick || 0, ext = GUNS[held].ext;                 // recoil: arms thrown back and up a little; ext: a long gun's front hand reaches further
      var aim = { rh: [15.2 - 3.4 * kick, 1.2, 0.6 + 0.3 * idle + 1.8 * kick], lh: [14 + ext - 3.2 * kick, -0.9, -0.7 + 0.3 * idle + 1.6 * kick], wd: norm([1, 0, 0.18 * kick]), twist: d, lean: 0.05 - 0.07 * kick, crouch: 0 };
      var low = { rh: [7.5, 2.6, -8], lh: [7, -1, -8.6], wd: norm([0.75, -0.1, -0.65]), twist: base.twist, lean: base.lean, crouch: 0 };
      var rl = p.reload > 0 ? Math.sin(Math.PI * Math.min(1, p.reload)) : 0;   // reloading: the gun drops to the chest and comes back up
      hp = lerpPose(aim, low, smooth(Math.max(run, rl)));          // lowered while running
    } else if (held === 'crate') {
      var bob = 0.5 * gait * Math.sin(ph * 2);
      hp = { rh: [8.6, 6, -9.6 + bob], lh: [8.6, -6, -9.6 + bob], wd: [0, 0, 1], twist: base.twist * 0.3, lean: base.lean * 0.4 - 0.07, crouch: 0 };
    }
    if (held === 'hands' && swingU >= 0) hp = shovePose(swingU, base);
    var hostile = !!p.look && p.look !== 'player';
    if (hostile) hp = hostilePose(p, base, gait, ph, idle, time);
    var pose = lerpPose(base, hp, smooth(p.heldK));
    if (hostile) {
      if (atkU >= 0) pose = atkPose(atkU, p.atkHit || 0.6, pose, p.screaming ? 'scream' : p.look);
      if (p.hurtK > 0) pose = lerpPose(pose, STAGGER, smooth(p.hurtK));
    }
    var w = smooth(p.work);
    if (w > 0) pose = lerpPose(pose, p.workTool ? chopPose(workPh) : grabPose(workPh), w);
    if (p.seat) pose = SEATED;                                              // on a bike or quad: both hands on the bars, no walking arms

    // legs: thigh swings, the knee bends while that leg travels forward; the pelvis rides on the lower foot
    var amp = gait * (0.6 + 0.3 * p.runK), bend = gait * (0.85 + 0.75 * p.runK), cr = pose.crouch;
    var dragLeg = hostile && (BODY[p.look] || BODY.player).drag && (p.variant || 0) % 2 === 0;
    function leg(sg) {
      var q = ph + (sg > 0 ? 0 : Math.PI);
      var lame = dragLeg && sg < 0 ? 0.35 : 1;                               // a dragged leg hardly swings and stays stiff
      var th = amp * lame * Math.sin(q) + cr * 1.1 - (lame < 1 ? 0.16 : 0), kn = bend * lame * Math.max(0, Math.cos(q)) + cr * 2.2, sa = th - kn;
      if (p.seat) { th = 1.12; kn = 1.3; sa = th - kn; }                    // seated: thighs forward, shins hanging down, legs still
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
    if (hostile && PALS[p.look] && PALS[p.look].dead && p.look !== 'screamer') S.head = add(S.head, S.dir([1.4, ((p.variant || 0) % 2 ? 2 : -2), -1.3]));   // the head hangs forward and to one side
    return S;
  }

  // ---- drawing ------------------------------------------------------------------------------------

  var shadowCv = null, SH = { size: 132, ox: 40, oy: 40, k: 0.5 };

  function tube(ctx, pts, w, col) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineWidth = (w + EDGE) * SC; ctx.strokeStyle = LINE; ctx.stroke();
    ctx.lineWidth = w * SC; ctx.strokeStyle = col; ctx.stroke();
    if (w >= 4) {                                       // a soft light along the north-west side gives the limb some volume
      ctx.save(); ctx.translate(-w * 0.14 * SC, -w * 0.18 * SC);
      ctx.lineWidth = w * 0.42 * SC; ctx.strokeStyle = 'rgba(255,250,235,0.085)'; ctx.stroke();
      ctx.restore();
    }
  }
  function dotAt(ctx, q, r, col) {
    ctx.beginPath(); ctx.arc(q.x, q.y, (r + 0.65) * SC, 0, TAU); ctx.fillStyle = LINE; ctx.fill();
    ctx.beginPath(); ctx.arc(q.x, q.y, r * SC, 0, TAU); ctx.fillStyle = col; ctx.fill();
  }
  function shape(ctx, pts, fill, lw) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = (lw || 1.1) * 0.7; ctx.strokeStyle = LINE; ctx.stroke();
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
        swing: -1, pSwing: -1, swingDur: SWING,         // seconds into a melee swing, -1 = none; how long that swing lasts
        work: 0, workTool: null, workPh: 0, pWorkPh: 0, // gathering: blend, tool id (null = bare hands), loop phase 0..1
        kick: 0,                                        // gun recoil 1..0
        reload: 0,                                      // reload progress 0..1 (0 = not reloading)
        // used by the infected (js/enemies.js) that reuse this body: look = palette, atk = progress of an attack
        // (-1 = none, atkHit = where in it the blow lands), hurtK = stagger 1..0, fall = collapse 0..1 (fallDir: back / forward)
        look: 'player', variant: 0, scale: 1, atk: -1, patk: -1, atkHit: 0.6, hurtK: 0, fall: 0, fallDir: 1
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
        p.stride += dt * (p.running ? 15 : 10.5) * (c.strideMult || 1);     // slower legs for slower walkers
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
        if (p.swing >= p.swingDur || work) p.swing = p.pSwing = -1;
      }
      if (p.kick > 0) p.kick = Math.max(0, p.kick - dt * 6.5);
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
      p.swing = p.pSwing = 0; p.swingDur = DUR[p.held] || SWING;
      return true;
    },

    // Unarmed shove (only with empty hands). Same timers as a swing, a shorter one.
    shove: function (p) {
      if (p.held !== 'hands' || p.swing >= 0 || p.work > 0.05) return false;
      p.swing = p.pSwing = 0; p.swingDur = DUR.hands;
      return true;
    },

    // True on the one step where the running swing / shove passes `u` (0..1) of its length: that is when the blow lands.
    swingHit: function (p, u) {
      if (p.swing < 0 || p.pSwing < 0) return false;
      var d = p.swingDur || SWING;
      return p.pSwing / d < u && p.swing / d >= u;
    },

    // A shot was fired: the arms kick back (drawn only).
    recoil: function (p) { p.kick = 1; },

    // Where the shot leaves the gun, seen from the ground plane: a point in front of the player; `height` above the ground.
    muzzle: function (p) {
      var m = GUNS[p.held] ? GUNS[p.held].muzzle : 26;
      return { x: p.x + Math.cos(p.angle) * m, y: p.y + Math.sin(p.angle) * m, height: 16 };
    },

    // Snaps the animation to a standing pose facing `angle` (after a teleport).
    settle: function (p, angle) {
      p.angle = p.prevAngle = p.face = p.pFace = angle;
      p.moving = p.running = false;
      p.stride = p.pStride = 0; p.gait = 0; p.runK = 0;
      p.swing = p.pSwing = -1; p.work = 0; p.kick = 0; p.reload = 0; p.atk = p.patk = -1; p.hurtK = 0;
    },

    draw: function (ctx, p, alpha, time) {
      var x = lerp(p.prevX, p.x, alpha), y = lerp(p.prevY, p.y, alpha);
      var face = p.pFace + angDiff(p.face, p.pFace) * alpha;
      var stride = lerp(p.pStride, p.stride, alpha);
      var swingU = p.swing < 0 ? -1 : clamp(lerp(Math.max(0, p.pSwing), p.swing, alpha) / (p.swingDur || SWING), 0, 1);
      var atkU = p.atk < 0 ? -1 : clamp(lerp(Math.max(0, p.patk), p.atk, alpha), 0, 1);
      var w0 = p.pWorkPh > p.workPh ? p.pWorkPh - 1 : p.pWorkPh, workPh = ((lerp(w0, p.workPh, alpha) % 1) + 1) % 1;
      PAL = palFor(p); SC = p.scale || 1;
      var B = BODY[p.look] || BODY.player, O = NOWEAR;
      if (p.outfit && !PAL.dead) {
        O = outfitOf(p.outfit);
        if (O.pal) { var bp = PAL, pk; PAL = {}; for (pk in bp) PAL[pk] = bp[pk]; for (pk in O.pal) PAL[pk] = O.pal[pk]; }
      }
      var S = build(p, face, stride, swingU, workPh, time || 0, atkU);
      var ca = Math.cos(face), sa = Math.sin(face), parts = [], shade = [];
      // a collapsing body is the whole rig tipped over about the feet (backward or forward), lying flat when fall = 1
      var fa = (p.fall || 0) * 1.5 * (p.fallDir || 1), fc = Math.cos(fa), fs = Math.sin(fa), lying = Math.abs(fa) > 0.01;

      function P(v) {                                   // body space -> screen, with a depth key (larger = nearer the camera)
        var vx = v[0], vz = v[2];
        if (lying) { var nx = vx * fc - vz * fs, nz = vx * fs + vz * fc; vx = nx; vz = Math.max(nz, 1.2 + 1.6 * Math.abs(fs)); }
        var gx = vx * ca - v[1] * sa, gy = vx * sa + v[1] * ca;
        return { x: x + gx * SC, y: y + (gy * GY - vz - FOOT) * SC, k: gy + vz * 0.5, gx: gx, gy: gy, z: vz };
      }
      function lit(side) {                              // 0..1: how much a part on that side faces the light (north-west)
        return 0.5 + 0.5 * side * (sa * 0.6 - ca * 0.8);
      }
      function part(key, fn) { parts.push({ k: key, fn: fn }); }

      // legs and boots
      [[S.legR, 1], [S.legL, -1]].forEach(function (e) {
        var l = e[0], a = P(l.hip), b = P(l.knee), c = P(l.foot), t = P(l.toe), col = tone(PAL.pants, lit(e[1]) * 0.8);
        var shin = O.tall ? P(mix3(l.knee, l.foot, 0.42)) : null, pocket = O.cargo ? P(mix3(l.hip, l.knee, 0.6)) : null;
        shade.push({ p: [a, b, c, t], w: 5.6 * B.leg });
        part((b.k + c.k) / 2, function () {
          tube(ctx, [a, b, c], 5.6 * B.leg, col);
          if (pocket) { ctx.beginPath(); ctx.arc(pocket.x, pocket.y, 2 * SC, 0, TAU); ctx.fillStyle = 'rgba(30,30,16,0.3)'; ctx.fill(); }
          if (shin) tube(ctx, [shin, c], 6.2, PAL.boot);                     // tall boots cover the shin
          tube(ctx, [c, t], 5.2 * B.leg, PAL.boot);
        });
      });

      // backpack
      var pk0 = P(S.toBody([-5.8, 0, -12.2])), pk1 = P(S.toBody([-5.8, 0, -2.6]));
      if (!PAL.dead && !PAL.nopack) {                   // the infected (and story characters with nopack) carry nothing
        shade.push({ p: [pk0, pk1], w: 10.5 });
        part((pk0.k + pk1.k) / 2, function () {
          tube(ctx, [pk0, pk1], 10.5, tone(PAL.pack, 0.25 + 0.5 * lit(0) + 0.25 * (-sa)));
          var f0 = P(S.toBody([-6.2, -3.4, -5.4])), f1 = P(S.toBody([-6.2, 3.4, -5.4]));
          ctx.beginPath(); ctx.moveTo(f0.x, f0.y); ctx.lineTo(f1.x, f1.y); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(20,16,10,0.55)'; ctx.stroke();
        });
        // the weapon that is not in the hands hangs across the back
        var spare = p.outfit ? (p.outfit.primary && p.outfit.primary !== p.held ? p.outfit.primary : (p.outfit.secondary && p.outfit.secondary !== p.held ? p.outfit.secondary : null)) : null;
        if (spare) {
          var s0 = P(S.toBody([-9.4, 5.6, 2.2])), s1 = P(S.toBody([-9.4, -5.2, -12.6])), wood = !!MELEE[spare];
          shade.push({ p: [s0, s1], w: 2.6 });
          part((s0.k + s1.k) / 2 - 0.5, function () {
            tube(ctx, [s0, s1], wood ? 2.4 : 3, wood ? '#7a6548' : '#2b2f32');
            if (wood) dotAt(ctx, s0, 2.2, spare === 'club' ? '#6b5840' : '#8b9491');
          });
        }
      }
      if (B.mane) {                                    // long matted hair down the back
        var m0 = P(S.head), m1 = P(S.toBody([-4.6, 0, -7.5]));
        part((m0.k + m1.k) / 2 - 3, function () { tube(ctx, [m0, m1], 6.4, PAL.hair); });
      }
      if (B.spikes) {                                  // bone growths on the shoulders and the back
        [-5.4, 0, 5.4].forEach(function (sy, i) {
          var k0 = P(S.toBody([-4.4, sy, -2.4 - (i === 1 ? 3.5 : 0)])), k1 = P(S.toBody([-9.2, sy * 1.55, 0.8 - (i === 1 ? 3 : 0)]));
          part((k0.k + k1.k) / 2, function () {
            tube(ctx, [k0, k1], 2.4, '#8e7f86');
            ctx.beginPath(); ctx.moveTo(k0.x, k0.y); ctx.lineTo(k1.x, k1.y); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(120,100,80,0.5)'; ctx.stroke();
          });
        });
      }

      // torso
      var q = [P(S.shL), P(S.shR), P(S.hipR), P(S.hipL)], cK = P(S.chest).k - 2;
      shade.push({ p: q, w: 6.5 * B.torso, closed: true });
      part(cK, function () {
        var col = tone(B.bare ? PAL.skin : PAL.jacket, 0.5);
        ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y); ctx.lineTo(q[1].x, q[1].y); ctx.lineTo(q[2].x, q[2].y); ctx.lineTo(q[3].x, q[3].y); ctx.closePath();
        ctx.lineWidth = (6.5 * B.torso + EDGE) * SC; ctx.strokeStyle = LINE; ctx.stroke();
        ctx.fillStyle = col; ctx.fill();
        ctx.lineWidth = 6.5 * B.torso * SC; ctx.strokeStyle = col; ctx.stroke();
        var mx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4, my = (q[0].y + q[1].y + q[2].y + q[3].y) / 4, vi;
        if (O.vest) {                                                         // a padded vest over the shirt
          ctx.beginPath();
          for (vi = 0; vi < 4; vi++) ctx[vi ? 'lineTo' : 'moveTo'](q[vi].x + (mx - q[vi].x) * 0.1, q[vi].y + (my - q[vi].y) * 0.1);
          ctx.closePath();
          ctx.lineWidth = 4.2 * SC; ctx.strokeStyle = tone(O.vest, 0.5); ctx.stroke(); ctx.fillStyle = tone(O.vest, 0.5); ctx.fill();
          ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(20,26,16,0.55)';
          ctx.beginPath(); ctx.moveTo((q[0].x + q[3].x) / 2, (q[0].y + q[3].y) / 2); ctx.lineTo((q[1].x + q[2].x) / 2, (q[1].y + q[2].y) / 2); ctx.stroke();
        }
        if (O.collar) {                                                       // jacket collar along the shoulders
          ctx.beginPath(); ctx.moveTo(q[0].x + (q[1].x - q[0].x) * 0.2, q[0].y + (q[1].y - q[0].y) * 0.2); ctx.lineTo(q[0].x + (q[1].x - q[0].x) * 0.8, q[0].y + (q[1].y - q[0].y) * 0.8);
          ctx.lineWidth = 3 * SC; ctx.strokeStyle = O.collar; ctx.stroke();
        }
        if (B.ribs && (p.variant || 0) % 2 === 0) {                           // torn open on one side: dark flesh and three ribs
          var rs = (p.variant || 0) % 4 === 0 ? 0.74 : 0.26;
          var r0x = q[0].x + (q[1].x - q[0].x) * rs, r0y = q[0].y + (q[1].y - q[0].y) * rs, r1x = q[3].x + (q[2].x - q[3].x) * rs, r1y = q[3].y + (q[2].y - q[3].y) * rs;
          var wx = r0x + (r1x - r0x) * 0.5, wy = r0y + (r1y - r0y) * 0.5, wa = Math.atan2(r1y - r0y, r1x - r0x);
          ctx.beginPath(); ctx.ellipse(wx, wy, 4.4 * SC * B.torso, 2.7 * SC, wa, 0, TAU); ctx.fillStyle = '#3c0e0c'; ctx.fill();
          ctx.lineWidth = 1 * SC; ctx.strokeStyle = 'rgba(214,206,184,0.9)';
          for (vi = -1; vi <= 1; vi++) {
            var ox = Math.cos(wa) * vi * 2.3 * SC, oy = Math.sin(wa) * vi * 2.3 * SC, nx2 = -Math.sin(wa) * 2 * SC, ny2 = Math.cos(wa) * 2 * SC;
            ctx.beginPath(); ctx.moveTo(wx + ox - nx2, wy + oy - ny2); ctx.lineTo(wx + ox + nx2, wy + oy + ny2); ctx.stroke();
          }
        }
        if (B.blood) {                                                        // old stains on the chest (the same ones for one body)
          var bv = (p.variant || 0) + 3;
          ctx.fillStyle = 'rgba(104,22,18,0.78)';
          for (vi = 0; vi < B.blood; vi++) {
            var bu = 0.25 + ((bv * (vi + 2) * 37) % 50) / 100, bw = 0.2 + ((bv * (vi + 5) * 53) % 55) / 100;
            var tx = q[0].x + (q[1].x - q[0].x) * bu, ty = q[0].y + (q[1].y - q[0].y) * bu, ux = q[3].x + (q[2].x - q[3].x) * bu, uy = q[3].y + (q[2].y - q[3].y) * bu;
            ctx.beginPath(); ctx.ellipse(tx + (ux - tx) * bw, ty + (uy - ty) * bw, (2 + (bv + vi) % 3 * 0.7) * SC, (1.6 + (bv + vi) % 2) * SC, bv + vi, 0, TAU); ctx.fill();
          }
        }
        var front = Math.sin(face + S.twist) * 0.67 + 0.2;                    // pack straps, only seen from the front
        if (front > 0 && !PAL.dead && !PAL.nopack) {
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
        var bareArm = B.bareArms === true || (B.bareArms === 'left' && e[2] < 0);
        var stump = !!B.stump && e[2] > 0 === ((p.variant || 0) % 2 === 0) && (p.variant || 0) % 4 === 1;
        shade.push({ p: stump ? [a, b] : [a, b, c], w: 4.8 * B.arm });
        part((a.k + b.k + c.k * 2) / 4 + 0.5, function () {
          var acol = tone(bareArm ? PAL.skin : PAL.jacket, (bareArm ? 0.05 : 0.15) + l * 0.85);
          if (stump) { tube(ctx, [a, b], 4.8 * B.arm, acol); dotAt(ctx, b, 2.2, '#5a1612'); return; }   // torn off at the elbow
          tube(ctx, [a, b, c], 4.8 * B.arm, acol);
          if (PAL.dead && bareArm) {                                          // a bite on the forearm
            ctx.beginPath(); ctx.arc((b.x + c.x) / 2, (b.y + c.y) / 2, 1.7 * SC, 0, TAU); ctx.fillStyle = 'rgba(96,20,16,0.85)'; ctx.fill();
          }
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
        if (LONG[id]) {                                                    // uzi, M16, Kalashnikov, sniper rifle: parts along the gun
          var ps = LONG[id].map(function (q) {
            return [P(add(hand, add(mul(up, q[1]), mul(wd, q[0])))), P(add(hand, add(mul(up, q[3]), mul(wd, q[2]))))];
          });
          var bar = ps[{ uzi: 1, m16: 3, ak: 3, sniper: 2 }[id]][1];       // the muzzle end
          shade.push({ p: [ps[0][0], bar], w: 3 });
          part((ps[0][0].k + bar.k) / 2 + 1.5, function () {
            ctx.globalAlpha = a;
            for (var li = 0; li < ps.length; li++) tube(ctx, [ps[li][0], ps[li][1]], LONG[id][li][4], LONG[id][li][5]);
            if (id === 'sniper') {                                         // the scope's lens
              dotAt(ctx, ps[3][1], 1.6, 'rgba(120,170,190,0.8)');
            }
            ctx.beginPath(); ctx.moveTo(ps[1][0].x, ps[1][0].y - 0.9); ctx.lineTo(ps[1][1].x, ps[1][1].y - 0.9); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(150,160,164,0.5)'; ctx.stroke();
            dotAt(ctx, P(hand), 2.3, tone(PAL.skin, 0.3 + lit(1) * 0.7));
            ctx.globalAlpha = 1;
          });
          return;
        }
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
              ctx.lineWidth = 4; ctx.strokeStyle = LINE; ctx.stroke();
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
      var hc = P(S.head), hr = R.headR * SC * B.head;
      var hy = face + clamp(angDiff(p.angle, face), -1, 1) + S.twist * 0.3;
      shade.push({ p: [hc], w: R.headR * 2 });
      part(hc.k + 3, function () {
        ctx.beginPath(); ctx.arc(hc.x, hc.y, hr + 0.7, 0, TAU); ctx.fillStyle = LINE; ctx.fill();
        ctx.beginPath(); ctx.arc(hc.x, hc.y, hr, 0, TAU); ctx.fillStyle = PAL.hair; ctx.fill();
        if (PAL.dead && !B.mane) {                                           // the hair has fallen out in patches
          var hv = (p.variant || 0) * 2.4;
          ctx.fillStyle = tone(PAL.skin, 0.4);
          ctx.beginPath(); ctx.ellipse(hc.x + Math.cos(hv) * hr * 0.3, hc.y - hr * 0.2 + Math.sin(hv) * hr * 0.25, hr * 0.5, hr * 0.36, hv, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.ellipse(hc.x - Math.cos(hv) * hr * 0.42, hc.y - hr * 0.42, hr * 0.26, hr * 0.2, -hv, 0, TAU); ctx.fill();
        }
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
          if (PAL.dead) {                                                                          // hollow eyes with a faint glint
            dot(sd * 0.34, 0.22, eyeR * 2.3, 'rgba(18,14,14,0.9)');                                 // sunken socket
            dot(sd * 0.34, 0.22, eyeR * 0.85, 'rgba(226,228,214,0.9)');                             // clouded white eye
          } else {
            dot(sd * 0.34, 0.24, eyeR * 1.25, 'rgba(214,204,186,0.75)');                           // eye white
            dot(sd * 0.34, 0.24, eyeR, '#1d1712');                                                 // pupil
          }
        });
        seg(0.02, 0.16, 0.06, -0.06, Math.max(1, hr * 0.1), tone(PAL.skin, 0.32));                  // nose
        if (PAL.dead) {                                                                             // slack jaw, a row of teeth, blood down the chin
          seg(-0.24, -0.32 - (B.mouth ? 0.1 : 0), 0.24, -0.32 - (B.mouth ? 0.1 : 0), Math.max(1.6, hr * 0.3 * (B.mouth || 1)), 'rgba(30,8,8,0.96)');
          seg(-0.17, -0.25, 0.17, -0.25, Math.max(0.8, hr * 0.08), 'rgba(222,214,190,0.85)');
          seg(0.06, -0.42, 0.1, -0.66, Math.max(1, hr * 0.14), 'rgba(110,22,18,0.8)');
        }
        else seg(-0.18, -0.28, 0.18, -0.28, Math.max(1, hr * 0.1), 'rgba(96,52,44,0.9)');           // mouth
        if (!PAL.dead) {
          seg(-0.48, -0.2, -0.2, -0.56, Math.max(1, hr * 0.14), 'rgba(60,46,36,0.35)');            // stubble along the jaw
          seg(0.48, -0.2, 0.2, -0.56, Math.max(1, hr * 0.14), 'rgba(60,46,36,0.35)');
        }
        ctx.beginPath(); ctx.arc(hc.x - hr * 0.3, hc.y - hr * 0.35, hr * 0.42, 0, TAU);            // soft light on the hair
        ctx.fillStyle = 'rgba(190,170,140,0.13)'; ctx.fill();
        if (O.head) {                                                        // beanie / helmet: sits on the back and top of the head, the face stays free
          var npx = n[0], npy = n[1] * vz - n[2] * vy, cr = hr * O.head.r;
          var kx = hc.x - npx * hr * 0.5, ky = hc.y - npy * hr * 0.5 - hr * 0.22;
          ctx.beginPath(); ctx.arc(kx, ky, cr + 0.7, 0, TAU); ctx.fillStyle = LINE; ctx.fill();
          ctx.beginPath(); ctx.arc(kx, ky, cr, 0, TAU); ctx.fillStyle = tone(O.head.col, 0.55 + 0.45 * lit(0)); ctx.fill();
          var ba = Math.atan2(npy + 0.3, npx);
          ctx.beginPath(); ctx.arc(kx, ky, cr - 1.1, ba - 1.15, ba + 1.15); ctx.lineWidth = 2; ctx.strokeStyle = O.head.band; ctx.stroke();
          ctx.beginPath(); ctx.arc(kx - cr * 0.3, ky - cr * 0.35, cr * 0.38, 0, TAU); ctx.fillStyle = 'rgba(230,236,220,0.14)'; ctx.fill();
        }
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
      PAL = PALS.player; SC = 1;
    }
  };

  G.player = player;
})(typeof window !== 'undefined' ? window : globalThis);
