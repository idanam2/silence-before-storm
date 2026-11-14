// On-screen HUD pieces that are drawn or updated per frame: the minimap (top right) and the target plate
// (name and health of the infected you are fighting, top center). DOM is touched only when something changed.
(function (root) {
  'use strict';
  var G = root.G, TAU = Math.PI * 2;

  var K = 0.1;                 // world px -> map px in the prepainted area map
  var RANGE = 820;             // world px from the player to the edge of the minimap
  var EVERY = 1 / 20;          // seconds between minimap repaints
  var els = null, mctx = null, size = 0, dpr = 1;
  var area = { key: '', c: null, w: 0, h: 0, at: 0 };
  var last = -1, target = { id: null, name: '', hp: -1, show: false };

  var GROUND = { concrete: '#8e9189', gravel: '#a39c88', tiles: '#2b2e2d', snow: '#dde6ef' };

  function rr(g, r, col) { g.fillStyle = col; g.fillRect(r.x * K, r.y * K, Math.max(1, r.w * K), Math.max(1, r.h * K)); }

  // The whole current area, painted once at a small scale.
  function paintZone(z) {
    var c = document.createElement('canvas'), i, n;
    c.width = Math.ceil(z.width * K); c.height = Math.ceil(z.height * K);
    var g = c.getContext('2d'), th = z.theme || {};
    g.fillStyle = z.interior ? GROUND.tiles : (GROUND[th.ground] || '#6c9a42');
    g.fillRect(0, 0, c.width, c.height);
    if (z.footprint) {
      g.fillStyle = '#b9b3a2';
      (z.footprint.length ? z.footprint : [z.footprint]).forEach(function (f) { if (f && f.w) g.fillRect(f.x * K, f.y * K, f.w * K, f.h * K); });
    }
    (z.crops || []).forEach(function (r) { rr(g, r, '#8f8f4c'); });
    (z.lots || []).forEach(function (r) { rr(g, r, '#7d807a'); });
    (z.roads || []).forEach(function (r) { rr(g, r, r.style === 'dirt' ? '#a8935f' : '#74766f'); });
    (z.paths || []).forEach(function (path) {
      if (th.trail === false || !path.length) return;
      g.strokeStyle = '#a8a064'; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); for (var j = 0; j < path.length; j++) g[j ? 'lineTo' : 'moveTo'](path[j][0] * K, path[j][1] * K); g.stroke();
    });
    (z.water || []).forEach(function (r) { rr(g, r, '#3f86a6'); });
    (z.decks || []).forEach(function (r) { rr(g, r, '#9c8862'); });
    (z.ponds || []).forEach(function (p) {
      g.fillStyle = '#3f86a6';
      p.blobs.forEach(function (b) { g.beginPath(); g.arc(b.x * K, b.y * K, b.r * K, 0, TAU); g.fill(); });
    });
    for (i = 0; i < z.nodes.length; i++) {
      n = z.nodes[i];
      if (!n.canopy) continue;
      g.fillStyle = n.type === 'dead_tree' ? '#6a6248' : '#33702e';
      g.beginPath(); g.arc(n.x * K, n.y * K, Math.max(2, n.canopy * 0.55 * K), 0, TAU); g.fill();
    }
    (z.structures || []).forEach(function (s) {
      if (!s.w || !s.h) return;
      var small = s.w * s.h < 60 * 60;
      if (z.interior) { if (s.kind === 'iwall') rr(g, s, '#1b1d1c'); else if (!small) rr(g, s, 'rgba(60,54,44,0.55)'); return; }
      if (small || s.solid === false) return;
      rr(g, s, '#4b4336');
      g.fillStyle = '#756a56'; g.fillRect(s.x * K + 1, s.y * K + 1, Math.max(1, s.w * K - 2), Math.max(1, s.h * K - 2));
    });
    (z.doors || []).forEach(function (d) { g.fillStyle = '#f2e6b0'; g.fillRect(d.x * K - 2, d.y * K - 2, 4, 4); });
    if (z.exit) {
      g.strokeStyle = '#f2e6b0'; g.lineWidth = 2;
      g.beginPath(); g.arc(z.exit.x * K, z.exit.y * K, 5, 0, TAU); g.stroke();
    }
    return c;
  }

  function paintBase(b) {
    var c = document.createElement('canvas'), L = b.layout, a = L.area, i;
    c.width = Math.ceil(b.width * K); c.height = Math.ceil(b.height * K);
    var g = c.getContext('2d');
    g.fillStyle = '#6c9a42'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#a39566'; g.fillRect(a.x * K, a.y * K, a.w * K, a.h * K);
    g.strokeStyle = '#a8a064'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(L.trail.x * K, (L.trail.y - 400) * K); g.lineTo(L.trail.x * K, (a.y + 40) * K); g.stroke();
    for (i = 0; i < b.trees.length; i++) {
      g.fillStyle = '#33702e';
      g.beginPath(); g.arc(b.trees[i].x * K, b.trees[i].y * K, Math.max(2, b.trees[i].canopy * 0.55 * K), 0, TAU); g.fill();
    }
    b.solids.forEach(function (s) {
      if (s.kind === 'trunk') return;
      rr(g, s, s.kind === 'fence' ? '#5a4c36' : '#4b4336');
      if (s.kind !== 'fence') { g.fillStyle = '#7d705a'; g.fillRect(s.x * K + 1, s.y * K + 1, Math.max(1, s.w * K - 2), Math.max(1, s.h * K - 2)); }
    });
    g.strokeStyle = '#f2e6b0'; g.lineWidth = 2;
    g.beginPath(); g.arc(L.trail.x * K, L.trail.y * K, 5, 0, TAU); g.stroke();
    return c;
  }

  function prepare(st) {
    var key = st.area === 'base' ? 'base' : st.zone.id + ':' + (st.visits[st.zone.id] || 0);
    if (key === area.key && (st.area !== 'base' || st.time - area.at < 2)) return;    // home changes as you build: repaint now and then
    area.key = key; area.at = st.time;
    area.c = st.area === 'base' ? paintBase(st.base) : paintZone(st.zone);
  }

  function drawMap(st, alpha) {
    var p = st.player, g = mctx, half = size / 2, sc = half / RANGE, i, e;
    var px = G.util.lerp(p.prevX, p.x, alpha), py = G.util.lerp(p.prevY, p.y, alpha);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#16191a'; g.fillRect(0, 0, size, size);
    g.imageSmoothingEnabled = true;
    g.save();
    g.translate(half, half); g.scale(sc / K, sc / K); g.translate(-px * K, -py * K);
    g.drawImage(area.c, 0, 0);
    g.restore();
    for (i = 0; i < st.enemies.length; i++) {                     // the infected that are close enough to notice
      e = st.enemies[i];
      if (e.state === 'dead' || e.state === 'dying') continue;
      var dx = (e.x - px) * sc, dy = (e.y - py) * sc;
      if (Math.abs(dx) > half - 4 || Math.abs(dy) > half - 4 || dx * dx + dy * dy > 560 * 560 * sc * sc) continue;
      g.fillStyle = '#16191a'; g.beginPath(); g.arc(half + dx, half + dy, 4, 0, TAU); g.fill();
      g.fillStyle = e.state === 'chase' || e.state === 'windup' ? '#f05a44' : '#e0a040';
      g.beginPath(); g.arc(half + dx, half + dy, 2.8, 0, TAU); g.fill();
    }
    g.save();                                                     // the player: an arrow pointing where they look
    g.translate(half, half); g.rotate(p.angle);
    g.beginPath(); g.moveTo(7, 0); g.lineTo(-5, -5); g.lineTo(-2.5, 0); g.lineTo(-5, 5); g.closePath();
    g.fillStyle = '#ffffff'; g.strokeStyle = '#16191a'; g.lineWidth = 1.5; g.lineJoin = 'round'; g.stroke(); g.fill();
    g.restore();
  }

  // The infected to show in the target plate: the one hit most recently, else the nearest one that is after the player.
  function pickTarget(st) {
    var best = null, score = Infinity, p = st.player, i, e, s;
    for (i = 0; i < st.enemies.length; i++) {
      e = st.enemies[i];
      if (e.state === 'dead' || e.state === 'dying') continue;
      var d = Math.hypot(e.x - p.x, e.y - p.y);
      if (e.sinceHit < 4) s = e.sinceHit * 100;
      else if ((e.state === 'chase' || e.state === 'windup') && d < 420) s = 1000 + d;
      else continue;
      if (s < score) { score = s; best = e; }
    }
    return best;
  }

  function drawTarget(st) {
    var e = pickTarget(st), show = !!e;
    if (show !== target.show) { target.show = show; els.target.classList.toggle('show', show); }
    if (!e) return;
    var d = G.data.enemies.types[e.type], name = d ? d.name : '', hp = Math.max(0, Math.ceil(e.hp));
    if (name !== target.name) { target.name = name; els.tname.textContent = name; }
    if (hp !== target.hp || e.maxHp !== target.max) {
      target.hp = hp; target.max = e.maxHp;
      els.tnum.textContent = hp;
      els.tbar.style.transform = 'scaleX(' + Math.max(0, e.hp / e.maxHp).toFixed(3) + ')';
    }
  }

  G.hud = {
    init: function () {
      els = {
        map: document.getElementById('minimap'), target: document.getElementById('target-hud'),
        tname: document.getElementById('target-name'), tnum: document.getElementById('target-num'), tbar: document.getElementById('target-bar')
      };
      if (!els.map) { els = null; return; }
      dpr = Math.min(root.devicePixelRatio || 1, 2);
      size = els.map.clientWidth || 176;
      els.map.width = els.map.height = Math.round(size * dpr);
      mctx = els.map.getContext('2d');
    },

    // Called once per rendered frame while playing.
    frame: function (st, alpha) {
      if (!els || !st.player || st.scene !== 'play') return;
      if (st.area !== 'base' && !st.zone) return;
      drawTarget(st);
      if (last >= 0 && st.time - last < EVERY && st.time >= last) return;
      last = st.time;
      prepare(st);
      drawMap(st, alpha);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
