// Game state: the shared state object, camera helpers, sound helpers (first of the js/game-*.js files).
// Part of the old js/game.js: all js/game-*.js files share one private object (G.gx); load order is in index.html.
(function (root) {
  'use strict';
  var G = root.G, X = G.gx = G.gx || {};
  var cfg = G.config;

  var view = { w: 0, h: 0, dpr: 1 };
  var cam = { x: 0, y: 0 };
  var fxRand = G.util.rng(99);
  var FADE = 0.38;             // seconds for each half of the travel fade
  var SLEEP_FADE = 1.0;        // and for the slower, darker fade of a night's sleep
  var FAINT_FADE = 0.9;
  var DOOR_FADE = 0.26;        // quicker fade through a door / up the stairs
  var AUTOSAVE = 30;           // seconds between automatic saves
  var ZERO = { x: 0, y: 0, run: false };
  var PROMPTS = { chest: 'E · פתיחת המחסן', workbench: 'E · שולחן עבודה', campfire: 'E · מדורה', rack: 'E · מתלה ייבוש',
    garage_moto: 'E · מוסך אופנוע וטרקטורון', garage_jeep: "E · מוסך ג'יפ", garage_heli: 'E · מוסך מסוק', garage_tank: 'E · מוסך טנק' };
  var LOW_NOTE = { hunger: 'מתחילים להיות רעבים', thirst: 'מתחילים להיות צמאים', energy: 'מתחילים להיות עייפים' };
  var pcfg = { radius: cfg.player.radius, walkSpeed: cfg.player.walkSpeed, runMult: cfg.player.runMult };

  // Exposed for debugging and JS-injection tests.
  var st = G.state = {
    scene: 'menu',           // 'menu' (main menu over the base) | 'play'
    paused: false,
    player: null, cam: cam, view: view, frames: 0, ticks: 0, time: 0,
    area: 'base', world: cfg.world, zone: null, visits: {}, trip: {},
    gather: G.area.newGather(), gathering: false, target: null, targetBlock: null,
    floaters: [], particles: [], fade: null, fullNoteAt: -10,
    vehicles: {}, ride: null,                        // owned vehicles { id: { fuel, at } } and the one being ridden (js/game-vehicles.js)
    diff: 'normal', needs: null, tank: null, playTime: 0, sinceSave: 0, low: {}, saveWarned: false,
    // fighting: the infected of this area, bullet lines, noise the player is making, hit feedback
    enemies: [], enemyKeep: {}, shots: [], burst: G.combat.newBurst(), gunCool: 0, dryAt: -10, kills: 0, guns: {}, reload: null,
    wear: {}, wearLife: {}, wearWarned: {},          // melee wear: blows landed / rolled life per weapon id (saved), warned flags (not saved)
    invuln: 0, hurt: 0, hurtGoal: 0, lastHitAt: -99,
    shake: G.feel.newShake()                         // camera shake / kick (js/feel.js)
  };
  var shakeOff = { x: 0, y: 0 }, lowOut = { edge: 0, desat: 0 };   // reused every frame: no allocation in render

  function diffLevel() { return G.data.difficulty.levels[st.diff] || G.data.difficulty.levels[G.data.difficulty.default]; }

  function cameraTarget() {
    var p = st.player, W = st.world;
    var tx = p.x - view.w / 2, ty = p.y - view.h / 2;
    tx = view.w >= W.width ? (W.width - view.w) / 2 : G.util.clamp(tx, 0, W.width - view.w);
    ty = view.h >= W.height ? (W.height - view.h) / 2 : G.util.clamp(ty, 0, W.height - view.h);
    return { x: tx, y: ty };
  }

  // ---- areas and travel -----------------------------------------------------------------------

  function place(x, y, angle) {
    var p = st.player;
    p.x = p.prevX = x; p.y = p.prevY = y;
    G.player.settle(p, angle);
    var t = cameraTarget();
    cam.x = t.x; cam.y = t.y;
  }

  // ---- sound (js/audio.js; every call is a no-op until the first key / click unlocks audio) -------------

  function snd(name, o) { if (G.audio) G.audio.play(name, o); }
  function at(x, y, o) { o = o || {}; o.x = x; o.y = y; return o; }

  // Ambience and music follow the place: the base, a destination, or a building of it (indoor), or the main menu.
  function audioScene() {
    if (!G.audio) return;
    var def = st.zone ? G.data.areas[st.zone.id] : null;
    G.audio.scene(st.area === 'base' || !def ? 'base' : (def.parent || st.area), !!(def && def.interior), st.scene !== 'play');
  }

  // What is under the feet: the ground theme of the area, decks (wood planks), the base's grass.
  function surfaceAt(x, y) {
    if (st.area === 'base' || !st.zone) return 'grass';
    var Z = st.zone, i, d;
    for (i = 0; i < Z.decks.length; i++) { d = Z.decks[i]; if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return d.metal ? 'metal' : 'wood'; }
    var th = G.data.areas[Z.id] && G.data.areas[Z.id].theme;
    var g = th && th.ground;
    if (g === 'tiles' || g === 'concrete' || g === 'gravel') return g;
    return 'grass';
  }

  // One footstep each time a leg comes down (half a stride cycle). f._sk remembers the last one per figure.
  function footsteps(f, vol, key) {
    var k = Math.floor(f.stride / Math.PI);
    if (!f.moving || f.gait < 0.3) { f._sk = k; return; }
    if (f._sk === undefined) f._sk = k;
    if (k !== f._sk) {
      f._sk = k;
      snd('step', at(f.x, f.y, { surface: surfaceAt(f.x, f.y), run: !!f.running, vol: vol, key: key }));
    }
  }

  // Hit sound for a resource being gathered: by its particle style and the tool it needs.
  function gatherMat(def) {
    if (def.fx === 'wood') return def.tool ? 'wood' : 'soft';
    if (def.fx === 'stone') return 'stone';
    if (def.fx === 'metal') return 'metal';
    if (def.fx === 'water') return 'water';
    return 'soft';
  }


  X.cfg = cfg; X.view = view; X.cam = cam; X.fxRand = fxRand; X.FADE = FADE; X.SLEEP_FADE = SLEEP_FADE; X.FAINT_FADE = FAINT_FADE; X.DOOR_FADE = DOOR_FADE; X.AUTOSAVE = AUTOSAVE; X.ZERO = ZERO; X.PROMPTS = PROMPTS; X.LOW_NOTE = LOW_NOTE; X.pcfg = pcfg; X.st = st; X.shakeOff = shakeOff; X.lowOut = lowOut;
  X.diffLevel = diffLevel; X.cameraTarget = cameraTarget; X.place = place; X.snd = snd; X.at = at; X.audioScene = audioScene; X.surfaceAt = surfaceAt; X.footsteps = footsteps; X.gatherMat = gatherMat;
})(window);
