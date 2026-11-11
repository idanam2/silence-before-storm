// DOM overlay: backpack, chest, workbench / campfire crafting, build menu, world map, needs bars, prompt, toasts.
// The DOM is only rebuilt when something changes (dirty flag), so nothing flickers or jumps.
(function (root) {
  'use strict';
  var G = root.G;

  var mode = 'none';           // 'none' | 'bag' | 'chest' | 'craft' | 'build' | 'map'
  var station = null;          // 'workbench' | 'campfire' while mode === 'craft'
  var mapSel = null;           // selected destination on the map
  var dirty = true, promptShown = false, msgTimer = 0, toastTimer = 0, noteTimer = 0, chestChanged = false;
  var els = {}, needEls = {}, needLast = {}, statusLast = '';

  var REASON = {
    cost: 'חסרים חומרים', space: 'אין מקום בתיק ובמחסן', station: 'אין תחנה כזו בבסיס',
    level: 'דרוש שדרוג של התחנה', max: 'כבר ברמה המקסימלית', unknown: 'פעולה לא מוכרת'
  };

  function items() { return G.data.items; }
  function ctx() { var s = G.state; return { bag: s.bag, chest: s.chest, buildings: s.buildings }; }

  // "שובע +30 · בריאות -3" for an item that can be used.
  function useText(d) {
    if (!d.use) return '';
    var L = G.data.needs.labels, out = [];
    for (var k in d.use) out.push(L[k] + ' ' + (d.use[k] > 0 ? '+' : '') + d.use[k]);
    return out.join(' · ');
  }

  function slotHtml(owner, inv, i) {
    var s = inv.slots[i];
    if (!s) return '<button class="slot empty" data-owner="' + owner + '" data-i="' + i + '" tabindex="-1"></button>';
    var d = items()[s.id], tip = d.name + ' ×' + s.n + (d.use ? ' · ' + useText(d) : '');
    var count = s.n > 1 ? '<span class="count">' + s.n + '</span>' : '';
    return '<button class="slot' + (d.use ? ' usable' : '') + '" data-owner="' + owner + '" data-i="' + i + '" tabindex="-1" title="' + tip + '">' +
      '<span class="tile" style="background-image:url(' + G.icons.url(s.id) + ')"></span>' +
      '<span class="name">' + d.name + '</span>' + count + '</button>';
  }

  function gridHtml(owner, inv) {
    var h = '';
    for (var i = 0; i < inv.slots.length; i++) h += slotHtml(owner, inv, i);
    return h;
  }

  // "3/4" chips for a cost, red where the player is short.
  function costHtml(cost) {
    var h = '', c = ctx();
    for (var id in cost) {
      var have = G.crafting.have(c, id), ok = have >= cost[id];
      h += '<span class="cost ' + (ok ? 'ok' : 'lack') + '" title="' + items()[id].name + '">' +
        '<i style="background-image:url(' + G.icons.url(id) + ')"></i>' + Math.min(have, 999) + '/' + cost[id] + '</span>';
    }
    return h || '<span class="cost ok">ללא עלות</span>';
  }

  function pips(level, max, label, cls) {
    var h = '';
    for (var i = 1; i <= max; i++) h += '<u class="' + (i <= level ? 'on' : '') + '"></u>';
    return '<span class="pips ' + (cls || '') + '" title="' + (label || 'רמה') + ' ' + level + ' מתוך ' + max + '">' + h + '</span>';
  }

  function craftHtml() {
    var c = ctx(), h = '', list = G.crafting.recipesFor(station), lv = G.crafting.levelOf(c, station);
    list.forEach(function (r) {
      var d = items()[r.out[0]], why = G.crafting.recipeStatus(c, r);
      var qty = r.out[1] > 1 ? ' ×' + r.out[1] : '';
      var note = why === 'level' ? '<span class="lock">דרוש ' + G.data.buildings[station].name + ' רמה ' + r.level + '</span>' : costHtml(r.cost);
      h += '<div class="row' + (why ? ' off' : '') + '">' +
        '<span class="tile" style="background-image:url(' + G.icons.url(r.out[0]) + ')"></span>' +
        '<div class="info"><div class="rname">' + d.name + qty + '</div><div class="costs">' + note + '</div></div>' +
        '<button class="act" data-act="craft" data-id="' + r.id + '" tabindex="-1"' + (why ? ' disabled' : '') + '>' +
        (why === 'level' ? 'נעול' : 'צור') + '</button></div>';
    });
    return { html: h, level: 'רמה ' + lv };
  }

  function buildHtml() {
    var c = ctx(), h = '';
    G.data.buildingOrder.forEach(function (id) {
      var d = G.data.buildings[id], lv = G.crafting.levelOf(c, id), next = G.crafting.nextLevel(c, id);
      var why = G.crafting.buildStatus(c, id);
      var label = !next ? 'מקסימום' : (lv === 0 ? 'בנה' : 'שדרג');
      h += '<div class="row' + (why ? ' off' : '') + '">' +
        '<span class="badge">' + pips(lv, d.levels.length) + '</span>' +
        '<div class="info"><div class="rname">' + d.name + (lv ? '' : '<em>לא נבנה</em>') + '</div>' +
        '<div class="desc">' + d.desc + '</div>' +
        '<div class="costs">' + (next ? costHtml(d.levels[next - 1].cost) : '<span class="cost ok">רמה מלאה</span>') + '</div></div>' +
        '<button class="act" data-act="build" data-id="' + id + '" tabindex="-1"' + (why ? ' disabled' : '') + '>' + label + '</button></div>';
    });
    return h;
  }

  // ---- world map ----------------------------------------------------------------------------------

  function mapParts() {
    var W = G.data.world, st = G.state, diff = G.game.diff(), energy = Math.floor(st.needs.energy);
    var lines = '', nodes = '', i;
    for (i = 0; i < W.order.length; i++) {
      var id = W.order[i], d = W.destinations[id], sel = id === mapSel;
      lines += '<line class="' + (sel ? 'sel' : '') + '" x1="' + W.base.pos.x + '" y1="' + W.base.pos.y + '" x2="' + d.pos.x + '" y2="' + d.pos.y + '"/>';
      nodes += '<button class="mnode risk' + d.risk + (sel ? ' sel' : '') + '" data-dest="' + id + '" tabindex="-1" style="left:' + d.pos.x + '%;top:' + d.pos.y + '%">' +
        '<i></i><span>' + G.world.name(id) + '</span></button>';
    }
    nodes += '<div class="mhome" style="left:' + W.base.pos.x + '%;top:' + W.base.pos.y + '%"><i></i><span>' + W.base.name + '</span></div>';

    var info = '';
    if (mapSel && W.destinations[mapSel]) {
      var s = W.destinations[mapSel], cost = G.world.cost(mapSel, diff), short = energy < cost;
      info = '<div class="mi-head"><b>' + G.world.name(mapSel) + '</b>' + pips(s.risk, 5, 'סיכון', 'risk') + '<em>סיכון</em></div>' +
        '<p>' + s.blurb + '</p>' +
        '<div class="costs">' +
        '<span class="cost">מרחק ' + s.km + ' ק״מ</span>' +
        '<span class="cost ' + (short ? 'lack' : 'ok') + '">עלות ' + cost + ' אנרגיה</span>' +
        '<span class="cost">משאבים: ' + G.world.loot(mapSel).join(' · ') + '</span></div>' +
        (short ? '<div class="mi-warn">האנרגיה לא מספיקה: תגיעו מותשים (איטיים וחלשים). אפשר לישון במיטה קודם.</div>' : '<div class="mi-warn"></div>') +
        '<button class="act go' + (short ? ' warn' : '') + '" data-act="go" data-id="' + mapSel + '" tabindex="-1">צאו לדרך</button>';
    }
    return { lines: lines, nodes: nodes, info: info, energy: 'אנרגיה ' + energy + '/' + G.data.needs.max };
  }

  function fill(el, html) {      // keeps the scroll position when the list is rebuilt
    var top = el.scrollTop;
    el.innerHTML = html;
    el.scrollTop = top;
  }

  function render() {
    var st = G.state, used = G.inventory.usedSlots(st.bag), size = st.bag.slots.length;
    els.bagGrid.innerHTML = gridHtml('bag', st.bag);
    els.bagCount.textContent = used + '/' + size;
    els.chestGrid.innerHTML = gridHtml('chest', st.chest);
    els.chestCount.textContent = G.inventory.usedSlots(st.chest) + '/' + st.chest.slots.length;
    els.hudCount.textContent = used + '/' + size;
    els.hudFill.style.transform = 'scaleX(' + (used / size) + ')';
    els.hud.classList.toggle('full', used >= size);
    if (mode === 'craft') {
      var cr = craftHtml();
      fill(els.craftList, cr.html);
      els.craftLevel.textContent = cr.level;
      els.craftTitle.textContent = G.data.buildings[station].name;
    } else if (mode === 'build') {
      fill(els.buildList, buildHtml());
    } else if (mode === 'map') {
      var mp = mapParts();
      els.mapLines.innerHTML = mp.lines;
      els.mapNodes.innerHTML = mp.nodes;
      els.mapInfo.innerHTML = mp.info;
      els.mapEnergy.textContent = mp.energy;
    }
    dirty = false;
  }

  function hintFor() {
    if (mode === 'chest') return 'לחיצה: העבר הכל · קליק ימני: העבר אחד · E / Esc: סגירה';
    if (mode === 'craft') return 'חומרים נלקחים מהתיק ואז מהמחסן · לחיצה על פריט בתיק: שימוש · E / Esc: סגירה';
    if (mode === 'build') return 'מבנה חדש נבנה במקום המסומן בבסיס · B / Esc: סגירה';
    if (mode === 'map') return 'בחרו יעד ולחצו "צאו לדרך" (או Enter). החזרה מכל יעד חינם · E / Esc: סגירה';
    return 'לחיצה על פריט: שימוש (אוכל, שתייה, תחבושת) · I / Tab / Esc: סגירה';
  }

  function applyMode() {
    els.layer.classList.toggle('open', mode !== 'none');
    els.chestPanel.classList.toggle('hidden', mode !== 'chest');
    els.craftPanel.classList.toggle('hidden', mode !== 'craft');
    els.buildPanel.classList.toggle('hidden', mode !== 'build');
    els.mapPanel.classList.toggle('hidden', mode !== 'map');
    els.bagPanel.classList.toggle('hidden', mode === 'build' || mode === 'map');
    els.hint.textContent = hintFor();
    els.msg.textContent = '';
    els.msg.classList.remove('show');
    dirty = true;
  }

  function say(text) {            // short status line under the panels (fades, never moves the layout)
    els.msg.textContent = text;
    els.msg.classList.add('show');
    root.clearTimeout(msgTimer);
    msgTimer = root.setTimeout(function () { els.msg.classList.remove('show'); }, 2200);
  }

  function game(fn) { if (G.game && G.game[fn]) G.game[fn].apply(G.game, Array.prototype.slice.call(arguments, 1)); }

  var ui = {
    init: function () {
      els.layer = document.getElementById('inv-layer');
      els.bagPanel = document.getElementById('bag-panel');
      els.bagGrid = document.getElementById('bag-grid');
      els.bagCount = document.getElementById('bag-count');
      els.chestPanel = document.getElementById('chest-panel');
      els.chestGrid = document.getElementById('chest-grid');
      els.chestCount = document.getElementById('chest-count');
      els.craftPanel = document.getElementById('craft-panel');
      els.craftTitle = document.getElementById('craft-title');
      els.craftLevel = document.getElementById('craft-level');
      els.craftList = document.getElementById('craft-list');
      els.buildPanel = document.getElementById('build-panel');
      els.buildList = document.getElementById('build-list');
      els.mapPanel = document.getElementById('map-panel');
      els.mapLines = document.getElementById('map-lines');
      els.mapNodes = document.getElementById('map-nodes');
      els.mapInfo = document.getElementById('map-info');
      els.mapEnergy = document.getElementById('map-energy');
      els.hint = document.getElementById('inv-hint');
      els.msg = document.getElementById('inv-msg');
      els.prompt = document.getElementById('prompt');
      els.toast = document.getElementById('toast');
      els.note = document.getElementById('save-note');
      els.hud = document.getElementById('bag-hud');
      els.hudCount = document.getElementById('bag-hud-count');
      els.hudFill = document.getElementById('bag-hud-fill');
      els.area = document.getElementById('area-name');

      // needs bars, built from data/needs.js
      var nh = document.getElementById('needs-hud'), html = '';
      G.data.needs.order.forEach(function (k) {
        html += '<div class="need ' + k + '" data-k="' + k + '"><span class="label">' + G.data.needs.labels[k] + '</span>' +
          '<span class="meter"><i></i></span></div>';
      });
      nh.innerHTML = html + '<div class="status"></div>';
      G.data.needs.order.forEach(function (k) {
        var row = nh.querySelector('[data-k="' + k + '"]');
        needEls[k] = { row: row, bar: row.querySelector('i') };
      });
      els.status = nh.querySelector('.status');

      function handle(e, amount) {
        var act = e.target.closest ? e.target.closest('.act') : null;
        if (act) {
          e.preventDefault();
          if (amount === Infinity && !act.disabled) {
            var what = act.getAttribute('data-act'), id = act.getAttribute('data-id');
            if (what === 'craft') ui.craft(id);
            else if (what === 'build') ui.build(id);
            else if (what === 'go') ui.depart(id);
          }
          return;
        }
        var node = e.target.closest ? e.target.closest('.mnode') : null;
        if (node) {
          e.preventDefault();
          if (amount === Infinity) ui.selectDest(node.getAttribute('data-dest'));
          return;
        }
        var btn = e.target.closest ? e.target.closest('.slot') : null;
        if (!btn) return;
        e.preventDefault();
        var owner = btn.getAttribute('data-owner'), idx = parseInt(btn.getAttribute('data-i'), 10);
        if (mode === 'chest') ui.transfer(owner, idx, amount);
        else if (owner === 'bag' && amount === Infinity) ui.use(idx);
      }
      els.layer.addEventListener('click', function (e) { handle(e, Infinity); });
      els.layer.addEventListener('contextmenu', function (e) { handle(e, 1); });
      // click on the dark backdrop closes
      els.layer.addEventListener('mousedown', function (e) { if (e.target === els.layer) ui.close(); });
      root.addEventListener('keydown', function (e) {
        if (mode === 'map' && e.code === 'Enter') { e.preventDefault(); if (mapSel) ui.depart(mapSel); }
      });
      applyMode();
    },

    isOpen: function () { return mode !== 'none'; },
    mode: function () { return mode; },
    station: function () { return station; },
    openChest: function () { mode = 'chest'; station = null; chestChanged = false; applyMode(); },
    openBag: function () { mode = 'bag'; station = null; applyMode(); },
    openCraft: function (id) { mode = 'craft'; station = id; applyMode(); },
    openBuild: function () { mode = 'build'; station = null; applyMode(); },
    openMap: function () {
      mode = 'map'; station = null;
      if (!mapSel || !G.world.has(mapSel)) mapSel = G.data.world.order[0];
      applyMode();
    },
    close: function () {
      if (mode === 'none') return;
      var wasChest = mode === 'chest' && chestChanged;
      mode = 'none'; station = null; chestChanged = false; applyMode();
      if (wasChest) game('save', 'chest');
    },
    toggleBag: function () { if (mode === 'bag') ui.close(); else if (mode === 'none') ui.openBag(); },
    toggleBuild: function () { if (mode === 'build') ui.close(); else if (mode === 'none') ui.openBuild(); },
    markDirty: function () { dirty = true; },
    setArea: function (name) { if (els.area.textContent !== name) els.area.textContent = name; },
    selected: function () { return mapSel; },

    selectDest: function (id) {
      if (mode !== 'map' || !G.world.has(id)) return;
      mapSel = id; dirty = true;
    },

    depart: function (id) {
      if (mode !== 'map' || !G.world.has(id)) return false;
      return G.game.depart(id);
    },

    // Moves items between backpack and chest (only while the chest is open).
    transfer: function (owner, idx, amount) {
      if (mode !== 'chest') return 0;
      var st = G.state;
      var from = owner === 'bag' ? st.bag : st.chest;
      var to = owner === 'bag' ? st.chest : st.bag;
      var moved = G.inventory.move(from, idx, to, amount);
      if (moved) { dirty = true; chestChanged = true; }
      return moved;
    },

    // Uses one unit of a backpack item (food, drink, bandage).
    use: function (idx) {
      var st = G.state, s = st.bag.slots[idx];
      if (!s) return null;
      var d = items()[s.id], r = G.needs.use(st.needs, d);
      if (r.ok) {
        s.n--;
        if (s.n <= 0) st.bag.slots[idx] = null;
        say(d.name + ' · ' + useText(d));
        dirty = true;
        game('save', 'use');
      } else say(r.reason === 'full' ? 'אין בזה צורך כרגע' : 'אי אפשר להשתמש בזה');
      return r;
    },

    craft: function (recipeId) {
      if (mode !== 'craft') return null;
      var r = G.crafting.craft(ctx(), recipeId);
      if (r.ok) { say('נוצר: ' + items()[r.out[0]].name + (r.out[1] > 1 ? ' ×' + r.out[1] : '')); game('save', 'craft'); }
      else say(REASON[r.reason] || REASON.unknown);
      dirty = true;
      return r;
    },

    build: function (id) {
      if (mode !== 'build') return null;
      var r = G.crafting.build(ctx(), id);
      if (r.ok) {
        G.game.applyBuildings();
        say((r.level === 1 ? 'נבנה: ' : 'שודרג: ') + G.data.buildings[id].name);
        game('save', 'build');
      } else say(REASON[r.reason] || REASON.unknown);
      dirty = true;
      return r;
    },

    showPrompt: function (text) {   // text or null; toggles only on change
      var want = !!text;
      if (want && els.prompt.textContent !== text) els.prompt.textContent = text;
      if (want !== promptShown) { promptShown = want; els.prompt.classList.toggle('show', want); }
    },

    // Short message in the middle of the screen (fades in and out, never moves anything).
    toast: function (text, ms) {
      els.toast.textContent = text;
      els.toast.classList.add('show');
      root.clearTimeout(toastTimer);
      toastTimer = root.setTimeout(function () { els.toast.classList.remove('show'); }, ms || 3200);
    },

    saveNote: function () {
      els.note.classList.add('show');
      root.clearTimeout(noteTimer);
      noteTimer = root.setTimeout(function () { els.note.classList.remove('show'); }, 1400);
    },

    // Needs bars: only writes to the DOM when a value (or the status line) really changed.
    setNeeds: function (n) {
      var D = G.data.needs, k, v, low;
      for (k in needEls) {
        v = n[k] / D.max;
        if (needLast[k] === undefined || Math.abs(v - needLast[k]) > 0.002) {
          needEls[k].bar.style.transform = 'scaleX(' + v.toFixed(3) + ')';
          needLast[k] = v;
        }
        low = n[k] < D.low;
        if (needEls[k].row.classList.contains('low') !== low) needEls[k].row.classList.toggle('low', low);
      }
      var text = n.hunger <= 0 ? 'מורעבים: הבריאות יורדת' : (n.thirst <= 0 ? 'מיובשים: הבריאות יורדת'
        : (G.needs.isExhausted(n) ? 'מותשים: איטיים וחלשים' : ''));
      if (text !== statusLast) { statusLast = text; els.status.textContent = text; }
    },

    update: function () { if (dirty) render(); }
  };

  G.ui = ui;
})(typeof window !== 'undefined' ? window : globalThis);
