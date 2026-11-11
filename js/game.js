// Game loop, camera and rendering of the (still empty) world.
(function (root) {
  'use strict';
  var G = root.G;
  var cfg = G.config;

  var canvas, ctx, groundPattern, vignette;
  var view = { w: 0, h: 0, dpr: 1 };
  var cam = { x: 0, y: 0 };
  var acc = 0, last = 0, running = false;

  // Exposed for debugging and JS-injection tests.
  G.state = { player: null, cam: cam, view: view, frames: 0, ticks: 0 };

  function buildGround() {
    var size = 512, rand = G.util.rng(1407);
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    g.fillStyle = cfg.colors.ground;
    g.fillRect(0, 0, size, size);
    for (var i = 0; i < 22; i++) {         // soft dark patches, wrapped so the tile seams vanish
      var px = rand() * size, py = rand() * size, pr = 20 + rand() * 70;
      for (var ox = -size; ox <= size; ox += size) {
        for (var oy = -size; oy <= size; oy += size) {
          var grad = g.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, pr);
          grad.addColorStop(0, cfg.colors.groundDark);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grad;
          g.fillRect(px + ox - pr, py + oy - pr, pr * 2, pr * 2);
        }
      }
    }
    g.fillStyle = cfg.colors.groundSpeck;  // grit
    for (var j = 0; j < 900; j++) g.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
    g.strokeStyle = cfg.colors.grid;       // faint grid so movement reads on an empty map
    g.lineWidth = 1;
    for (var k = 0; k < size; k += 128) {
      g.beginPath(); g.moveTo(k + 0.5, 0); g.lineTo(k + 0.5, size); g.stroke();
      g.beginPath(); g.moveTo(0, k + 0.5); g.lineTo(size, k + 0.5); g.stroke();
    }
    groundPattern = ctx.createPattern(c, 'repeat');
  }

  function buildVignette() {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(view.w * view.dpr));
    c.height = Math.max(1, Math.round(view.h * view.dpr));
    var g = c.getContext('2d');
    var cx = c.width / 2, cy = c.height / 2;
    var grad = g.createRadialGradient(cx, cy, Math.min(cx, cy) * 0.35, cx, cy, Math.hypot(cx, cy));
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.35)');
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    vignette = c;
  }

  function resize() {
    view.dpr = Math.min(root.devicePixelRatio || 1, 2);
    view.w = canvas.clientWidth;
    view.h = canvas.clientHeight;
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
    buildVignette();
  }

  function cameraTarget() {
    var p = G.state.player, W = cfg.world;
    var tx = p.x - view.w / 2, ty = p.y - view.h / 2;
    tx = view.w >= W.width ? (W.width - view.w) / 2 : G.util.clamp(tx, 0, W.width - view.w);
    ty = view.h >= W.height ? (W.height - view.h) / 2 : G.util.clamp(ty, 0, W.height - view.h);
    return { x: tx, y: ty };
  }

  function tick(dt) {
    var inp = G.input, p = G.state.player;
    var aim = inp.mouse.inside ? { x: inp.mouse.x + cam.x, y: inp.mouse.y + cam.y } : null;
    G.player.update(p, inp.getMove(), aim, dt, cfg.world);

    var t = cameraTarget(), k = 1 - Math.exp(-cfg.camera.follow * dt);
    cam.x += (t.x - cam.x) * k;
    cam.y += (t.y - cam.y) * k;
    G.state.ticks++;
  }

  function render(alpha) {
    var W = cfg.world;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = cfg.colors.bg;
    ctx.fillRect(0, 0, view.w, view.h);

    var cx = Math.round(cam.x * view.dpr) / view.dpr; // pixel-snapped: no shimmer
    var cy = Math.round(cam.y * view.dpr) / view.dpr;
    ctx.translate(-cx, -cy);
    ctx.fillStyle = groundPattern;
    ctx.fillRect(0, 0, W.width, W.height);
    ctx.strokeStyle = cfg.colors.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W.width - 2, W.height - 2);

    G.player.draw(ctx, G.state.player, alpha);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(vignette, 0, 0);
  }

  function frame(now) {
    if (!running) return;
    var res = G.timing.advance(acc, now - last, cfg);
    last = now;
    acc = res.acc;
    for (var i = 0; i < res.steps; i++) {
      tick(cfg.stepMs / 1000);
      G.input.consumeFrame();
    }
    render(res.alpha);
    G.state.frames++;
    root.requestAnimationFrame(frame);
  }

  G.game = {
    init: function () {
      canvas = document.getElementById('game');
      ctx = canvas.getContext('2d', { alpha: false });
      G.input.attach(canvas);
      resize();
      root.addEventListener('resize', resize);
      buildGround();
      G.state.player = G.player.create(cfg.world.width / 2, cfg.world.height / 2);
      var t = cameraTarget();
      cam.x = t.x; cam.y = t.y;
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) { last = performance.now(); acc = 0; }
      });
    },
    start: function () {
      running = true;
      last = performance.now();
      root.requestAnimationFrame(frame);
    },
    tick: tick // exposed for JS-injection tests
  };

  root.addEventListener('DOMContentLoaded', function () {
    G.game.init();
    G.game.start();
    document.body.classList.add('ready');
  });
})(window);
