// Global namespace, shared config and small pure helpers.
// Every other script adds itself to window.G (no ES modules: the game runs from file://).
(function (root) {
  'use strict';
  var G = root.G || (root.G = {});

  G.VERSION = '0.0.1';

  G.config = {
    stepMs: 1000 / 60,      // fixed simulation step
    maxFrameMs: 250,        // cap after tab switch / hitch, avoids "spiral of death"
    maxStepsPerFrame: 8,
    world: { width: 3200, height: 2000 },
    camera: { follow: 10 }, // higher = snappier camera
    player: {
      radius: 18,
      walkSpeed: 150,       // world px per second
      runMult: 1.65
    },
    colors: {
      bg: '#0b0d0e',
      ground: '#15191a',
      groundSpeck: 'rgba(120, 130, 120, 0.05)',
      groundDark: 'rgba(0, 0, 0, 0.16)',
      grid: 'rgba(160, 170, 160, 0.035)',
      border: 'rgba(150, 160, 150, 0.18)',
      playerBody: '#5f6762',
      playerBodyEdge: '#2a2e2c',
      playerHead: '#c4ab90',
      playerHair: '#4a3d33',
      infected: '#6f7a68'   // grey-green, used from stage 5
    }
  };

  G.util = {
    clamp: function (v, min, max) { return v < min ? min : (v > max ? max : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    // Deterministic PRNG (mulberry32) so procedural details look the same every load.
    rng: function (seed) {
      var s = seed >>> 0;
      return function () {
        s = (s + 0x6D2B79F5) >>> 0;
        var t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
  };

  // Fixed-timestep accumulator. Pure, so it is unit-tested in Node.
  G.timing = {
    advance: function (acc, frameMs, cfg) {
      var c = cfg || G.config;
      var a = acc + Math.min(Math.max(frameMs, 0), c.maxFrameMs);
      var steps = 0;
      while (a >= c.stepMs && steps < c.maxStepsPerFrame) {
        a -= c.stepMs;
        steps++;
      }
      if (steps === c.maxStepsPerFrame && a >= c.stepMs) a = 0; // drop backlog
      return { steps: steps, acc: a, alpha: a / c.stepMs };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
