// DOM overlay: backpack, chest, workbench / campfire crafting, build menu, world map, needs bars, prompt, toasts.
// The DOM is only rebuilt when something changes (dirty flag), so nothing flickers or jumps.
(function (root) {
  'use strict';
  var G = root.G;

  var mode = 'none';           // 'none' | 'bag' | 'chest' | 'craft' | 'build' | 'map'
  function snd(name, o) { if (G.audio) G.audio.play(name, o); }
  var station = null;          // 'workbench' | 'campfire' while mode === 'craft'
  var craftCat = 'all';        // the open category tab of the crafting panel
  var mapSel = null;           // selected destination on the map
  var dirty = true, promptShown = false, msgTimer = 0, toastTimer = 0, noteTimer = 0, chestChanged = false;
  var els = {}, needEls = {}, needLast = {}, statusLast = '', weaponLast = {};

  var REASON = {
    cost: 'חסרים חומרים', space: 'אין מקום בתיק ובמחסן', station: 'אין תחנה כזו בבסיס',
    level: 'דרוש שדרוג של התחנה', max: 'כבר ברמה המקסימלית', unknown: 'פעולה לא מוכרת'
  };

  function items() { return G.data.items; }
  function ctx() { var s = G.state; return { bag: s.bag, chest: s.chest, buildings: s.buildings, fence: s.fence, placed: s.placed }; }

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

  // Category tabs of the crafting panel: "all" first, then only the categories this station has recipes in.
  function craftTabsHtml() {
    var all = G.crafting.recipesFor(station), h = '';
    var kinds = G.data.recipeCats.filter(function (cat) { return cat.id !== 'all' && all.some(function (r) { return r.cat === cat.id; }); });
    if (kinds.length < 2) { craftCat = 'all'; return ''; }          // one category only (the campfire): tabs would add nothing
    G.data.recipeCats.forEach(function (cat) {
      var n = cat.id === 'all' ? all.length : all.filter(function (r) { return r.cat === cat.id; }).length;
      if (!n) return;
      h += '<button class="tab' + (cat.id === craftCat ? ' on' : '') + '" data-cat="' + cat.id + '" tabindex="-1">' + cat.name + '<em>' + n + '</em></button>';
    });
    return h;
  }

  function craftHtml() {
    var c = ctx(), h = '', list = G.crafting.recipesFor(station, craftCat), lv = G.crafting.levelOf(c, station);
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

  // Material choice under the fence row: the look changes at once, the next level is priced in that material.
  function fenceMatHtml() {
    var cur = G.state.fence && G.state.fence.material, FM = G.data.fenceMaterials, h = '<div class="mats">';
    G.data.fenceMaterialOrder.forEach(function (m) {
      h += '<button class="act mat' + (m === cur ? ' sel' : '') + '" data-act="fenceMat" data-id="' + m + '" tabindex="-1">' + FM[m].name + '</button>';
    });
    return h + '</div>';
  }

  // The floor row: pick a material, then lay blocks one by one in the yard.
  function floorRowHtml() {
    var M = G.data.floorMaterials, h = '<div class="row"><span class="badge">▦</span><div class="info"><div class="rname">רצפה (בלוק אחרי בלוק)</div>' +
      '<div class="desc">בוחרים חומר ומניחים בלוקים בכל מקום בחצר. לחיצה מניחה, קליק ימני מסיר ומחזיר את החומרים.</div><div class="mats">';
    G.data.floorMaterialOrder.forEach(function (m) {
      h += '<button class="act mat" data-act="floorMat" data-id="' + m + '" tabindex="-1">' + M[m].name + ' · ' +
        Object.keys(M[m].cost).map(function (k) { return M[m].cost[k] + ' ' + G.data.items[k].name; }).join(' + ') + '</button>';
    });
    return h + '</div></div></div>';
  }

  function moveRowHtml() {
    return '<div class="row"><span class="badge">✥</span><div class="info"><div class="rname">הזזה (מקש T)</div>' +
      '<div class="desc">תופסים מבנה, מחסן או בלוק רצפה ומניחים במקום אחר, בחינם. Shift: מזיזים את כל הרצפה כיחידה אחת.</div></div>' +
      '<div class="btns"><button class="act" data-act="move" tabindex="-1">הזזה</button></div></div>';
  }

  function buildHtml() {
    var c = ctx(), h = '';
    G.data.buildingOrder.forEach(function (id) {
      var d = G.data.buildings[id], lv = G.crafting.levelOf(c, id), next = G.crafting.nextLevel(c, id);
      var why = G.crafting.buildStatus(c, id);
      var label = !next ? 'מקסימום' : (lv === 0 ? 'בנה' : 'שדרג');
      var free = !!d.spot, n = free ? G.placing.count(c.placed, id) : 0, pwhy = free ? G.crafting.placeStatus(c, id) : null;
      var btns = free && lv === 0
        ? '<button class="act" data-act="place" data-id="' + id + '" tabindex="-1"' + (pwhy ? ' disabled' : '') + '>בנה והצב</button>'
        : (free ? '<button class="act" data-act="place" data-id="' + id + '" tabindex="-1"' + (pwhy ? ' disabled' : '') + '>הצב עוד</button>' : '') +
          '<button class="act" data-act="build" data-id="' + id + '" tabindex="-1"' + (why ? ' disabled' : '') + '>' + label + '</button>';
      if (free && lv === 0) why = pwhy;
      h += '<div class="row' + (why ? ' off' : '') + '">' +
        '<span class="badge">' + pips(lv, d.levels.length) + '</span>' +
        '<div class="info"><div class="rname">' + d.name + (lv ? (n > 1 ? ' ×' + n : '') : '<em>לא נבנה</em>') + '</div>' +
        '<div class="desc">' + d.desc + '</div>' +
        (id === 'fence' ? fenceMatHtml() : '') +
        '<div class="costs">' + (free && lv === 0 ? costHtml(d.levels[0].cost) : (next ? costHtml(G.crafting.buildCost(c, id)) : '<span class="cost ok">רמה מלאה</span>')) + '</div></div>' +
        '<div class="btns">' + btns + '</div></div>';
    });
    return h + floorRowHtml() + moveRowHtml();
  }

  // ---- world map ----------------------------------------------------------------------------------

  function mapParts() {
    var W = G.data.world, st = G.state, diff = G.game.diff(), energy = Math.floor(st.needs.energy);
    var lines = '', nodes = '', i;
    var route = mapSel && W.geo && W.geo.routes[mapSel];
    if (route) {                                     // the selected road, drawn over the painted map
      var pts = route.map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
      lines = '<polyline class="glow" points="' + pts + '"/><polyline class="sel" points="' + pts + '"/>';
    }
    for (i = 0; i < W.order.length; i++) {
      var id = W.order[i], d = W.destinations[id], sel = id === mapSel;
      nodes += '<button class="mnode risk' + d.risk + (sel ? ' sel' : '') + '" data-dest="' + id + '" tabindex="-1" style="left:' + d.pos.x + '%;top:' + d.pos.y + '%">' +
        '<i>' + G.mapArt.icon(id) + '</i><span>' + G.world.name(id) + '</span></button>';
    }
    nodes += '<div class="mhome" style="left:' + W.base.pos.x + '%;top:' + W.base.pos.y + '%"><i>' + G.mapArt.icon('base') + '</i><span>' + W.base.name + '</span></div>';

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
      els.craftTabs.innerHTML = craftTabsHtml();          // first: it may fall back to the "all" tab
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
      G.mapArt.paint(els.mapArt);
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
    if (mode === 'map') G.mapArt.paint(els.mapArt);   // painted once per size, the panel is visible now
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
      els.craftTabs = document.getElementById('craft-tabs');
      els.buildPanel = document.getElementById('build-panel');
      els.buildList = document.getElementById('build-list');
      els.mapPanel = document.getElementById('map-panel');
      els.mapLines = document.getElementById('map-lines');
      els.mapNodes = document.getElementById('map-nodes');
      els.mapArt = document.getElementById('map-art');
      root.addEventListener('resize', function () { if (mode === 'map') { G.mapArt.paint(els.mapArt); } });
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
      els.weaponName = document.getElementById('weapon-name');
      els.weaponAmmo = document.getElementById('weapon-ammo');

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
        var tab = e.target.closest ? e.target.closest('.tab') : null;
        if (tab) {                                    // a category tab of the crafting panel
          e.preventDefault();
          if (amount === Infinity && mode === 'craft') { craftCat = tab.getAttribute('data-cat'); dirty = true; }
          return;
        }
        var act = e.target.closest ? e.target.closest('.act') : null;
        if (act) {
          e.preventDefault();
          if (amount === Infinity && !act.disabled) {
            var what = act.getAttribute('data-act'), id = act.getAttribute('data-id');
            if (what === 'craft') ui.craft(id);
            else if (what === 'build') ui.build(id);
            else if (what === 'fenceMat') ui.fenceMat(id);
            else if (what === 'place') ui.place(id);
            else if (what === 'move') { ui.close(); G.game.startPlacing({ kind: 'move', carry: null }); }
            else if (what === 'floorMat') ui.floorMat(id);
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
    openChest: function () { mode = 'chest'; station = null; chestChanged = false; applyMode(); snd('open'); },
    openBag: function () { mode = 'bag'; station = null; applyMode(); snd('pickup', { vol: 0.6 }); },
    openCraft: function (id) { mode = 'craft'; station = id; craftCat = 'all'; applyMode(); snd('ui'); },
    openBuild: function () { mode = 'build'; station = null; applyMode(); snd('ui'); },
    openMap: function () {
      mode = 'map'; station = null; snd('ui');
      if (!mapSel || !G.world.has(mapSel)) mapSel = G.data.world.order[0];
      applyMode();
    },
    close: function () {
      if (mode === 'none') return;
      var wasChest = mode === 'chest' && chestChanged;
      snd(mode === 'chest' ? 'close' : 'ui', { vol: 0.7 });
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
      if (mapSel !== id) snd('ui', { vol: 0.6 });
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
      if (moved) { dirty = true; chestChanged = true; snd('pickup', { gap: 0.06 }); }
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
        snd(d.kind === 'drink' ? 'drink' : (d.kind === 'food' ? 'eat' : 'bandage'));
        say(d.name + ' · ' + useText(d));
        dirty = true;
        game('save', 'use');
      } else { snd('uiBad'); say(r.reason === 'full' ? 'אין בזה צורך כרגע' : 'אי אפשר להשתמש בזה'); }
      return r;
    },

    craft: function (recipeId) {
      if (mode !== 'craft') return null;
      var r = G.crafting.craft(ctx(), recipeId);
      if (r.ok) { snd(station === 'campfire' ? 'cook' : 'craft'); say('נוצר: ' + items()[r.out[0]].name + (r.out[1] > 1 ? ' ×' + r.out[1] : '')); game('save', 'craft'); }
      else { snd('uiBad'); say(REASON[r.reason] || REASON.unknown); }
      dirty = true;
      return r;
    },

    place: function (id) {
      if (mode !== 'build') return;
      var why = G.crafting.placeStatus(ctx(), id);
      if (why) { snd('uiBad'); say(why === 'max' ? 'הגעתם למקסימום' : REASON[why] || REASON.unknown); dirty = true; return; }
      ui.close();
      G.game.startPlacing({ kind: 'struct', id: id, carry: null });
    },

    floorMat: function (id) {
      if (mode !== 'build' || !G.data.floorMaterials[id]) return;
      ui.close();
      G.game.startPlacing({ kind: 'floor', mat: id });
    },

    fenceMat: function (id) {
      if (mode !== 'build' || !G.data.fenceMaterials[id]) return;
      G.state.fence = { material: id };
      G.game.applyBuildings();
      snd('ui'); say('חומר הגדר: ' + G.data.fenceMaterials[id].name);
      game('save', 'fence');
      dirty = true;
    },

    build: function (id) {
      if (mode !== 'build') return null;
      var r = G.crafting.build(ctx(), id);
      if (r.ok) {
        G.game.applyBuildings();
        snd('build');
        say((r.level === 1 ? 'נבנה: ' : 'שודרג: ') + G.data.buildings[id].name);
        game('save', 'build');
      } else { snd('uiBad'); say(REASON[r.reason] || REASON.unknown); }
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

    // Held weapon and, for the gun, a line "magazine · spare rounds · condition". Writes to the DOM only when the text changes.
    setWeapon: function (name, text, empty) {
      var txt = text || '';
      if (weaponLast.name !== name) { weaponLast.name = name; els.weaponName.textContent = name; }
      if (weaponLast.ammo !== txt || weaponLast.empty !== !!empty) {
        weaponLast.ammo = txt; weaponLast.empty = !!empty; els.weaponAmmo.textContent = txt;
        els.weaponAmmo.classList.toggle('empty', !!empty);
      }
    },

    update: function () { if (dirty) render(); }
  };

  G.ui = ui;
})(typeof window !== 'undefined' ? window : globalThis);
