// Player state, movement (pure, tested in Node) and drawing.
(function (root) {
  'use strict';
  var G = root.G;
  var clamp = G.util.clamp;

  var player = {
    create: function (x, y, cfg) {
      var c = cfg || G.config.player;
      return {
        x: x, y: y, prevX: x, prevY: y,
        angle: -Math.PI / 2, prevAngle: -Math.PI / 2,
        radius: c.radius,
        moving: false, running: false,
        stride: 0             // walk cycle phase, drives the shoulder sway
      };
    },

    // move: {x, y, run}; aim: {x, y} in world coords or null; dt in seconds.
    update: function (p, move, aim, dt, world, cfg) {
      var c = cfg || G.config.player;
      p.prevX = p.x; p.prevY = p.y; p.prevAngle = p.angle;

      var len = Math.sqrt(move.x * move.x + move.y * move.y);
      p.moving = len > 0;
      p.running = p.moving && !!move.run;

      if (p.moving) {
        var speed = c.walkSpeed * (p.running ? c.runMult : 1);
        p.x += (move.x / len) * speed * dt;
        p.y += (move.y / len) * speed * dt;
        p.stride += dt * (p.running ? 13 : 8.5);
      } else {
        p.stride = 0;
      }

      p.x = clamp(p.x, p.radius, world.width - p.radius);
      p.y = clamp(p.y, p.radius, world.height - p.radius);

      if (aim) {
        var dx = aim.x - p.x, dy = aim.y - p.y;
        if (dx * dx + dy * dy > 4) p.angle = Math.atan2(dy, dx);
      } else if (p.moving) {
        p.angle = Math.atan2(move.y, move.x);
      }
    },

    // Top-down: shoulders as a wide rounded body, head on top. Facing = +x after rotate.
    draw: function (ctx, p, alpha) {
      var col = G.config.colors;
      var x = G.util.lerp(p.prevX, p.x, alpha);
      var y = G.util.lerp(p.prevY, p.y, alpha);
      var da = p.angle - p.prevAngle;
      if (da > Math.PI) da -= Math.PI * 2;
      if (da < -Math.PI) da += Math.PI * 2;
      var a = p.prevAngle + da * alpha;
      var r = p.radius;
      var sway = Math.sin(p.stride) * (p.running ? 0.12 : 0.07);

      ctx.save();
      ctx.translate(x, y);

      // soft shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(2, 3, r * 1.05, r * 1.05, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(a + sway);

      // shoulders
      ctx.fillStyle = col.playerBody;
      ctx.strokeStyle = col.playerBodyEdge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.55, r * 1.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.rotate(-sway * 0.6); // head turns a little less than the shoulders

      // head (hair from above) with a face hint toward the front
      ctx.fillStyle = col.playerHair;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col.playerHead;
      ctx.beginPath();
      ctx.arc(r * 0.18, 0, r * 0.4, -Math.PI / 2, Math.PI / 2);
      ctx.fill();

      ctx.restore();
    }
  };

  G.player = player;
})(typeof window !== 'undefined' ? window : globalThis);
