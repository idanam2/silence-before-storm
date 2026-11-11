// Keyboard + mouse state. Uses e.code (physical key) so WASD works on a Hebrew layout too.
(function (root) {
  'use strict';
  var G = root.G;

  var input = {
    keys: {},
    mouse: { x: 0, y: 0, inside: false, down: false, clicked: false },
    pressed: {},          // keys pressed since last consumeFrame()

    keyDown: function (code) {
      if (!input.keys[code]) input.pressed[code] = true;
      input.keys[code] = true;
    },
    keyUp: function (code) { input.keys[code] = false; },
    clear: function () {   // on window blur, so keys never get "stuck"
      input.keys = {};
      input.pressed = {};
      input.mouse.down = false;
    },
    isDown: function (code) { return !!input.keys[code]; },
    wasPressed: function (code) { return !!input.pressed[code]; },
    consumeFrame: function () { input.pressed = {}; input.mouse.clicked = false; },

    // Movement intent in screen axes: x right, y down. Not normalized here.
    getMove: function () {
      var k = input.keys;
      var x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
      var y = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
      return { x: x, y: y, run: !!(k.ShiftLeft || k.ShiftRight) };
    },

    attach: function (canvas) {
      var gameKeys = { KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1, KeyE: 1, KeyI: 1, KeyB: 1, Tab: 1, Escape: 1, Space: 1,
        ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1 };
      root.addEventListener('keydown', function (e) {
        if (gameKeys[e.code]) e.preventDefault(); // no page scroll
        input.keyDown(e.code);
      });
      root.addEventListener('keyup', function (e) { input.keyUp(e.code); });
      root.addEventListener('blur', input.clear);
      canvas.addEventListener('mousemove', function (e) {
        var r = canvas.getBoundingClientRect();
        input.mouse.x = e.clientX - r.left;
        input.mouse.y = e.clientY - r.top;
        input.mouse.inside = true;
      });
      canvas.addEventListener('mouseleave', function () { input.mouse.inside = false; });
      canvas.addEventListener('mousedown', function (e) {
        if (e.button === 0) { input.mouse.down = true; input.mouse.clicked = true; }
      });
      root.addEventListener('mouseup', function (e) { if (e.button === 0) input.mouse.down = false; });
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }
  };

  G.input = input;
})(typeof window !== 'undefined' ? window : globalThis);
