// DOM overlay: backpack, chest, workbench / campfire crafting, build menu, world map, needs bars, prompt, toasts.
// The DOM is only rebuilt when something changes (dirty flag), so nothing flickers or jumps.
(function (root) {
  'use strict';
  var G = root.G;

  var mode = 'none';           // 'none' | 'bag' | 'chest' | 'craft' | 'build' | 'veh' | 'map'
  var vehId = null;            // the vehicle in the workshop panel (mode 'veh')
  var vehGarage = null;        // the garage whose panel is open (its vehicles are the tabs)
  function snd(name, o) { if (G.audio) G.audio.play(name, o); }
  var station = null;          // 'workbench' | 'campfire' while mode === 'craft'
  var craftCat = 'all';        // the open category tab of the crafting panel
  var mapSel = null;           // selected destination on the map
  var flight = null;           // the helicopter's id while the map is open from its cockpit (flying, not walking)
  var dirty = true, promptShown = false, msgTimer = 0, toastTimer = 0, noteTimer = 0, chestChanged = false;
  var els = {}, needEls = {}, needLast = {}, statusLast = '', weaponLast = {}, hotLast = '', doll = null;

  // Small original icons for the needs bars (inline SVG, drawn in the bar's colour).
  var NEED_ICON = {
    health: '<svg viewBox="0 0 20 20"><path d="M10 17.2 3.4 10.6a4.1 4.1 0 0 1 5.8-5.8l.8.8.8-.8a4.1 4.1 0 0 1 5.8 5.8z" fill="currentColor"/><path d="M4.2 10h3l1.3-2.6 2 5 1.4-2.4h3.6" fill="none" stroke="#1c2124" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    hunger: '<svg viewBox="0 0 20 20"><path d="M3 9.5h14a7 7 0 0 1-14 0z" fill="currentColor"/><path d="M7 7.2c-.9-1.2.9-1.8 0-3.2M10.2 7.2c-.9-1.2.9-1.8 0-3.2M13.4 7.2c-.9-1.2.9-1.8 0-3.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    thirst: '<svg viewBox="0 0 20 20"><path d="M10 2.5c3 3.9 5 6.500 5 9a5 5 0 0 1-10 0c0-2.500 2-5.100 5-9z" fill="currentColor"/></svg>',
    energy: '<svg viewBox="0 0 20 20"><path d="M11.500 2 4.500 11.200h4.300L7.600 18l7.900-10h-4.700z" fill="currentColor"/></svg>'
  };

  var REASON = {
    cost: 'חסרים חומרים', space: 'אין מקום בתיק ובתיבה', station: 'אין תחנה כזו בבסיס',
    level: 'דרוש שדרוג של התחנה', locked: 'עוד לא ידוע איך', owned: 'כבר בנית כלי רכב כזה', max: 'כבר ברמה המקסימלית', unknown: 'פעולה לא מוכרת'
  };

  function items() { return G.data.items; }
  function ctx() { var s = G.state; return { bag: s.bag, chest: s.chest, buildings: s.buildings, fence: s.fence, placed: s.placed, vehicles: s.vehicles }; }

  // "שובע +30 · בריאות -3" for an item that can be used.
  function useText(d) {
    if (!d.use) return '';
    var L = G.data.needs.labels, out = [];
    for (var k in d.use) out.push(L[k] + ' ' + (d.use[k] > 0 ? '+' : '') + d.use[k]);
    return out.join(' · ');
  }

  // The weapon (data/weapons.js) an item is, or null.
  function weaponOf(itemId) {
    var W = G.data.weapons;
    for (var k in W) if (W[k].item === itemId) return W[k];
    return null;
  }
  function armorText(d) { return d.wear ? 'שריון +' + Math.round(d.wear.armor * 100) + '%' : ''; }

  function slotHtml(owner, inv, i) {
    var s = inv.slots[i];
    if (!s) return '<button class="slot empty" data-owner="' + owner + '" data-i="' + i + '" tabindex="-1"></button>';
    var d = items()[s.id], eq = G.state.equip, w = owner === 'bag' ? weaponOf(s.id) : null;
    var extra = d.use ? useText(d) : (d.wear ? armorText(d) + ' · לחיצה: ללבוש' : (w ? 'לחיצה: נשק ראשי · קליק ימני: משני' : ''));
    var tip = d.name + (s.n > 1 ? ' ×' + s.n : '') + (extra ? ' · ' + extra : '');
    var count = s.n > 1 ? '<span class="count">' + s.n + '</span>' : '';
    var mark = w && eq ? (eq.primary === w.id ? '<span class="mark">1</span>' : (eq.secondary === w.id ? '<span class="mark">2</span>' : '')) : '';
    return '<button class="slot' + (d.use ? ' usable' : '') + (d.wear || w ? ' gearable' : '') + '" data-owner="' + owner + '" data-i="' + i + '" tabindex="-1" title="' + tip + '">' +
      '<span class="tile" style="background-image:url(' + G.icons.url(s.id) + ')"></span>' +
      '<span class="name">' + d.name + '</span>' + count + mark + '</button>';
  }

  // One equipment slot: a worn piece of clothing, or one of the two weapons.
  function gearSlotHtml(slot) {
    var eq = G.state.equip, L = G.data.gear.labels, id = eq[slot], isW = slot === 'primary' || slot === 'secondary';
    var key = slot === 'primary' ? '<span class="mark">1</span>' : (slot === 'secondary' ? '<span class="mark">2</span>' : '');
    if (!id) return '<button class="slot gslot empty" data-owner="gear" data-slot="' + slot + '" tabindex="-1" title="' + L[slot] + '"><span class="ph">' + L[slot] + '</span>' + key + '</button>';
    var itemId = isW ? G.data.weapons[id].item : id, d = items()[itemId];
    var tip = d.name + (isW ? ' · נזק ' + G.data.weapons[id].dmg + ' · לחיצה: לפנות את המשבצת' : ' · ' + armorText(d) + ' · לחיצה: להוריד');
    return '<button class="slot gslot" data-owner="gear" data-slot="' + slot + '" tabindex="-1" title="' + tip + '">' +
      '<span class="tile" style="background-image:url(' + G.icons.url(itemId) + ')"></span><span class="name">' + d.name + '</span>' + key + '</button>';
  }

  function gearStatsHtml() {
    var st = G.state, eq = st.equip, W = G.data.weapons, w1 = eq.primary && W[eq.primary], w2 = eq.secondary && W[eq.secondary];
    function chip(label, val) { return '<span class="gstat"><em>' + label + '</em><b>' + val + '</b></span>'; }
    return chip('נזק ראשי', w1 ? w1.dmg : W.hands.dmg) + chip('נזק משני', w2 ? w2.dmg : '–') +
      chip('שריון', Math.round(G.gear.armor(eq) * 100) + '%') + chip('בריאות', Math.ceil(st.needs.health));
  }

  function gridHtml(owner, inv) {
    var h = '';
    for (var i = 0; i < inv.slots.length; i++) h += slotHtml(owner, inv, i);
    return h;
  }

  // "3/4" chips for a cost, red where the player is short.
  function costHtml(cost) {
    var h = '', c = ctx();
    if (G.crafting.free) return '<span class="cost ok">חינם (מצב יצירתי)</span>';
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
      var note = why === 'level' ? '<span class="lock">דרוש ' + G.data.buildings[station].name + ' רמה ' + r.level + '</span>' : costHtml(G.crafting.recipeCost(r));
      h += '<div class="row' + (why ? ' off' : '') + '">' +
        '<span class="tile" style="background-image:url(' + G.icons.url(r.out[0]) + ')"></span>' +
        '<div class="info"><div class="rname">' + d.name + qty + '</div><div class="costs">' + note + '</div></div>' +
        '<button class="act" data-act="craft" data-id="' + r.id + '" tabindex="-1"' + (why ? ' disabled' : '') + '>' +
        (why === 'level' ? 'נעול' : why === 'owned' ? 'נבנה' : 'צור') + '</button></div>';
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

  // ---- the build board (B): a grid of equal cards, each with an emoji, name, short text, price and its buttons ----

  // One card. `mid` sits between the text and the price (the fence's material buttons).
  function cardHtml(o) {
    return '<div class="bcard' + (o.cls ? ' ' + o.cls : '') + (o.off ? ' off' : '') + '" title="' + (o.tip || '').replace(/"/g, '&quot;') + '">' +
      '<div class="bhead"><span class="bico">' + o.icon + '</span>' +
      '<div class="btitle"><div class="bname">' + o.name + (o.tag ? '<em>' + o.tag + '</em>' : '') + '</div>' + (o.pips || '') + '</div></div>' +
      '<div class="bblurb">' + o.blurb + '</div>' + (o.mid || '') +
      (o.costs ? '<div class="costs">' + o.costs + '</div>' : '') +
      '<div class="bbtns">' + o.btns + '</div></div>';
  }

  // The floor card: pick a material, then lay blocks one by one in the yard.
  function floorCardHtml() {
    var M = G.data.floorMaterials, mats = '<div class="mats">';
    G.data.floorMaterialOrder.forEach(function (m) {
      mats += '<button class="act mat" data-act="floorMat" data-id="' + m + '" tabindex="-1"><b>' + M[m].name + '</b><span>' +
        Object.keys(M[m].cost).map(function (k) { return M[m].cost[k] + ' ' + G.data.items[k].name; }).join(' + ') + '</span></button>';
    });
    return cardHtml({ cls: 'wide2', icon: '🟫', name: 'רצפה', tag: 'בלוק אחרי בלוק', blurb: 'בוחרים חומר ומניחים בכל מקום בחצר. קליק ימני מסיר ומחזיר את החומרים.', btns: mats + '</div>',
      tip: 'בוחרים חומר ומניחים בלוקים בכל מקום בחצר. לחיצה מניחה, קליק ימני מסיר ומחזיר את החומרים.' });
  }

  // The fence card: pick a material, then put pieces down one by one on the edges of floor blocks (R turns the piece).
  function fenceCardHtml() {
    var FM = G.data.fenceMaterials, mats = '<div class="mats">', st = G.state, n = (st.fences || []).length;
    G.data.fenceMaterialOrder.forEach(function (m) {
      var cost = G.crafting.fenceCost(m);
      mats += '<button class="act mat" data-act="fenceMat" data-id="' + m + '" tabindex="-1"><b>' + FM[m].name + '</b><span>' +
        Object.keys(cost).map(function (k) { return cost[k] + ' ' + G.data.items[k].name; }).join(' + ') + '</span></button>';
    });
    return cardHtml({ cls: 'wide2', icon: '🧱', name: 'גדר', tag: n ? n + ' חתיכות · רמה ' + (st.buildings.fence || 0) : 'חתיכה אחרי חתיכה',
      blurb: 'בוחרים חומר ומניחים חתיכה על קצה של בלוק רצפה (רק על רצפה). R מסובב, קליק ימני מסיר ומחזיר את החומרים. ככל שיש יותר גדר, הבסיס מוגן יותר.', btns: mats + '</div>',
      tip: 'גדר נבנית חתיכה אחרי חתיכה, רק על רצפה שכבר הנחתם. R מסובב לאורך או לרוחב.' });
  }

  function buildHtml() {
    var c = ctx(), h = '', CARDS = G.data.buildingCards || {};
    G.data.buildingOrder.forEach(function (id) {
      if (id === 'kennel' && !(G.state.comp && G.state.comp.dog.on)) return;     // the kennel is for the dog: no card before he joins
      var d = G.data.buildings[id], lv = G.crafting.levelOf(c, id), next = G.crafting.nextLevel(c, id), card = CARDS[id] || {};
      var why = G.crafting.buildStatus(c, id);
      var label = !next ? 'מקסימום' : (lv === 0 ? 'בנה' : 'שדרג');
      var free = !!d.spot, n = free ? G.placing.count(c.placed, id) : 0, pwhy = free ? G.crafting.placeStatus(c, id) : null;
      var one = free && G.placing.max(id) === 1;                  // the bed and the garages: one copy only, so "place more" never shows
      var more = free && lv > 0 && !(one && n >= 1);
      var btns = free && lv === 0
        ? '<button class="act" data-act="place" data-id="' + id + '" tabindex="-1"' + (pwhy ? ' disabled' : '') + '>בנה והצב</button>'
        : (more ? '<button class="act" data-act="place" data-id="' + id + '" tabindex="-1"' + (pwhy ? ' disabled' : '') + '>' + (n ? 'הצב עוד' : 'הצב') + '</button>' : '') +
          '<button class="act" data-act="build" data-id="' + id + '" tabindex="-1"' + (why ? ' disabled' : '') + '>' + label + '</button>';
      if (free && lv === 0) why = pwhy;
      h += cardHtml({
        off: !!why, icon: card.icon || '🏠', name: d.name, tag: !lv ? 'לא נבנה' : (free && G.placing.max(id) > 1 && G.placing.max(id) < G.placing.MAX_EACH ? n + '/' + G.placing.max(id) : (n > 1 ? '×' + n : '')),
        pips: pips(lv, d.levels.length), blurb: card.blurb || d.desc, tip: d.desc,
        mid: '',
        costs: free && lv === 0 ? costHtml(d.levels[0].cost) : (next ? costHtml(G.crafting.buildCost(c, id)) : '<span class="cost ok">רמה מלאה</span>'),
        btns: btns
      });
    });
    return h + floorCardHtml() + fenceCardHtml();                                  // moving things is the T key (no card for it here)
  }

  // ---- the garage workshop panel (U next to a vehicle inside its garage): fitted upgrades, parts, washing ----

  // The vehicles of the open garage as tabs (none when the garage has just one).
  function vehTabsHtml() {
    var ids = G.data.vehicleOrder.filter(function (id) { return G.data.vehicles[id].garage === vehGarage; });
    if (ids.length < 2) return '';
    return ids.map(function (id) {
      return '<button class="tab' + (id === vehId ? ' on' : '') + '" data-veh="' + id + '" tabindex="-1">' + G.data.vehicles[id].name + '<em>' + (G.state.vehicles[id] ? '✓' : '…') + '</em></button>';
    }).join('');
  }

  // A vehicle that is not built yet: its parts one by one. Each press fits one part from the bag or the box; the last one completes the vehicle.
  function assemblyHtml() {
    var c = ctx(), V = G.vehicles, d = G.data.vehicles[vehId], list = V.buildList(vehId), builds = G.state.builds, total = 0, got = 0, h = '';
    list.forEach(function (x) { total += x.n; got += Math.min(x.n, V.builtCount(builds, vehId, x.part)); });
    h += '<div class="bcard wide3 vstat"><div class="bhead"><span class="bico" style="background-image:url(' + G.icons.url('veh_' + vehId) + ')"></span>' +
      '<div class="btitle"><div class="bname">' + d.name + '<em>בבנייה · ' + got + '/' + total + ' חלקים</em></div></div></div>' +
      '<div class="bblurb">את החלקים מייצרים בשולחן העבודה של המוסך (E ליד השולחן, לשונית "חלקים"): גומי ומוטות ברזל הופכים לגלגלים, שלד, מנוע ועוד. כאן מרכיבים אותם אחד אחד עד שהכלי מוכן.</div></div>';
    list.forEach(function (x) {
      var fitted = V.builtCount(builds, vehId, x.part), full = fitted >= x.n, have = G.crafting.have(c, x.part), cost = {}, it = items()[x.part];
      cost[x.part] = 1;
      h += cardHtml({
        off: full || (have < 1 && !G.crafting.free), icon: '<i class="pico" style="background-image:url(' + G.icons.url(x.part) + ')"></i>', name: it.name, tag: fitted + '/' + x.n, pips: pips(fitted, x.n, 'הותקנו'),
        blurb: full ? 'הותקן במלואו' : 'מתקינים חלק אחד בכל לחיצה', costs: full ? '<span class="cost ok">הותקן</span>' : costHtml(cost),
        btns: '<button class="act" data-act="vassemble" data-id="' + x.part + '" tabindex="-1"' + (full || (have < 1 && !G.crafting.free) ? ' disabled' : '') + '>' + (full ? 'הותקן' : 'התקן') + '</button>'
      });
    });
    return h;
  }

  function vehHtml() {
    var c = ctx(), v = G.state.vehicles[vehId], d = G.data.vehicles[vehId], V = G.vehicles, h = '';
    if (!v) return assemblyHtml();
    var cap = V.cap(vehId, G.state.buildings, v), dirtPct = Math.round((v.dirt || 0) * 100);
    var sp = Math.round((V.speedMult(vehId, v) - 1) * 100), bn = Math.round((V.burnMult(vehId, v) - 1) * 100);
    h += '<div class="bcard wide3 vstat"><div class="bhead"><span class="bico" style="background-image:url(' + G.icons.url('veh_' + vehId) + ')"></span>' +
      '<div class="btitle"><div class="bname">' + d.name + '</div></div></div>' +
      '<div class="costs"><span class="cost">דלק ' + Math.round(v.fuel) + '/' + cap + '</span><span class="cost ' + (dirtPct > 50 ? 'lack' : 'ok') + '">לכלוך ' + dirtPct + '%</span>' +
      '<span class="cost">מהירות ' + (sp >= 0 ? '+' : '') + sp + '%</span><span class="cost">צריכת דלק ' + (bn >= 0 ? '+' : '') + bn + '%</span></div>' +
      '<div class="bblurb">החלקים מיוצרים בשולחן העבודה של המוסך (E ליד השולחן): גומי ומוטות ברזל הופכים לגלגלים, מנוע ומיכל.</div></div>';
    V.upgradesFor(vehId).forEach(function (u) {
      var lv = V.upLevel(v, u.id), have = G.crafting.free ? 1 : G.crafting.have(c, u.part), full = lv >= u.max, cost = {};
      cost[u.part] = 1;
      h += cardHtml({
        off: full || have < 1, icon: u.icon, name: u.name, tag: lv ? 'רמה ' + lv : 'לא הותקן', pips: pips(lv, u.max, 'רמה'), blurb: u.blurb, tip: u.blurb,
        costs: full ? '<span class="cost ok">רמה מלאה</span>' : costHtml(cost),
        btns: '<button class="act" data-act="vinstall" data-id="' + u.id + '" tabindex="-1"' + (full || have < 1 ? ' disabled' : '') + '>' + (full ? 'מקסימום' : (lv ? 'שדרג' : 'התקן')) + '</button>'
      });
    });
    var dirty = (v.dirt || 0) > 0.02, water = G.crafting.have(c, 'water_clean');
    h += cardHtml({
      off: !dirty || water < 1, icon: '🧽', name: 'שטיפה', tag: dirty ? 'לכלוך ' + dirtPct + '%' : 'נקי', blurb: 'מים נקיים שוטפים את הבוץ, והכלי חוזר לרוץ מהר וחסכוני.',
      costs: costHtml({ water_clean: 1 }),
      btns: '<button class="act" data-act="vwash" tabindex="-1"' + (!dirty || water < 1 ? ' disabled' : '') + '>' + (dirty ? 'שטוף' : 'נקי') + '</button>'
    });
    return h;
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
    var at = flight ? G.game.flight.here() : 'base';
    for (i = 0; i < W.order.length; i++) {
      var id = W.order[i], d = W.destinations[id], sel = id === mapSel;
      if (!G.story.isUnlocked(id)) continue;          // the story opens the map one place at a time
      nodes += '<button class="mnode risk' + d.risk + (sel ? ' sel' : '') + (flight && id === at ? ' here' : '') + '" data-dest="' + id + '" tabindex="-1" style="left:' + d.pos.x + '%;top:' + d.pos.y + '%">' +
        '<i>' + G.mapArt.icon(id) + '</i><span>' + G.world.name(id) + (flight && id === at ? ' · אתם כאן' : '') + (!flight && !G.world.access(id, 'ground', st.ride).ok ? ' 🔒' : '') + '</span></button>';
    }
    if (flight && at !== 'base') nodes += '<button class="mnode mhome' + (mapSel === 'base' ? ' sel' : '') + '" data-dest="base" tabindex="-1" style="left:' + W.base.pos.x + '%;top:' + W.base.pos.y + '%"><i>' + G.mapArt.icon('base') + '</i><span>' + W.base.name + '</span></button>';
    else nodes += '<div class="mhome" style="left:' + W.base.pos.x + '%;top:' + W.base.pos.y + '%"><i>' + G.mapArt.icon('base') + '</i><span>' + W.base.name + (flight ? ' · אתם כאן' : '') + '</span></div>';

    var info = '';
    if (flight && mapSel && G.game.flight.can(mapSel)) {            // from the helicopter: fuel only, to any open place or home
      var hv = st.vehicles[flight], need = G.game.flight.fuel(flight, mapSel), lack = !hv || hv.fuel < need, fs = W.destinations[mapSel];
      info = '<div class="mi-head"><b>' + (fs ? G.world.name(mapSel) : W.base.name) + '</b>' + (fs ? pips(fs.risk, 5, 'סיכון', 'risk') + '<em>סיכון</em>' : '') + '</div>' +
        '<p>' + (fs ? fs.blurb : 'חזרה הביתה. המסוק נוחת ליד ההאנגר.') + '</p>' +
        '<div class="costs"><span class="cost ' + (lack ? 'lack' : 'ok') + '">טיסה: ' + need + ' דלק · במיכל ' + Math.floor(hv ? hv.fuel : 0) + '</span>' +
        (fs ? '<span class="cost">משאבים: ' + G.world.loot(mapSel).join(' · ') + '</span>' : '') + '</div>' +
        (G.world.stormGrounded() ? '<div class="mi-warn">סערה: המסוק לא ממריא.</div>' : lack ? '<div class="mi-warn">אין מספיק דלק במסוק. סגרו את המפה ותדלקו לידו (F).</div>' : '<div class="mi-warn"></div>') +
        '<button class="act go' + (lack ? ' warn' : '') + '" data-act="go" data-id="' + mapSel + '" tabindex="-1">המראה</button>';
    } else if (!flight && mapSel && W.destinations[mapSel]) {
      var s = W.destinations[mapSel], cost = G.world.cost(mapSel, diff), short = energy < cost;
      var rv = st.ride && st.vehicles && st.vehicles[st.ride], fuel = rv ? G.vehicles.tripFuel(st.ride, s.km) : 0, noFuel = !!rv && rv.fuel < fuel;
      var acc = G.world.access(mapSel, 'ground', st.ride);                // the story's hard places: only by a tank or a helicopter
      if (rv) short = noFuel;                         // on a vehicle the trip costs fuel and no energy
      info = '<div class="mi-head"><b>' + G.world.name(mapSel) + '</b>' + pips(s.risk, 5, 'סיכון', 'risk') + '<em>סיכון</em></div>' +
        '<p>' + s.blurb + '</p>' +
        '<div class="costs">' +
        '<span class="cost">מרחק ' + s.km + ' ק״מ</span>' +
        (rv ? '<span class="cost ' + (noFuel ? 'lack' : 'ok') + '">עלות ' + fuel + ' דלק (' + G.data.vehicles[st.ride].name + ' · יש ' + Math.floor(rv.fuel) + ') · 0 אנרגיה</span>'
          : '<span class="cost ' + (short ? 'lack' : 'ok') + '">עלות ' + cost + ' אנרגיה</span>') +
        '<span class="cost">משאבים: ' + G.world.loot(mapSel).join(' · ') + '</span></div>' +
        (!acc.ok ? '<div class="mi-warn">' + acc.deny + ' עולים על הכלי (V) ופותחים את המפה ממנו.</div>' : rv ? (noFuel ? '<div class="mi-warn">אין מספיק דלק בכלי הרכב. תדלקו (F) או רדו (V) ולכו ברגל.</div>' : '<div class="mi-warn"></div>')
          : short ? '<div class="mi-warn">האנרגיה לא מספיקה: תגיעו מותשים (איטיים וחלשים). אפשר לישון במיטה קודם.</div>' : '<div class="mi-warn"></div>') +
        '<button class="act go' + (short ? ' warn' : '') + '" data-act="go" data-id="' + mapSel + '" tabindex="-1"' + (acc.ok ? '' : ' disabled') + '>' + (acc.ok ? 'צאו לדרך' : 'אין דרך') + '</button>';
    }
    return { lines: flight ? '' : lines, nodes: nodes, info: info, energy: flight ? 'טיסה במסוק · בחרו יעד' : 'אנרגיה ' + energy + '/' + G.data.needs.max };
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
    if (mode === 'bag' && st.equip) {
      els.gearClothes.innerHTML = G.data.gear.slots.map(gearSlotHtml).join('');
      els.gearWeapons.innerHTML = G.data.gear.weaponSlots.map(gearSlotHtml).join('');
      els.gearStats.innerHTML = gearStatsHtml();
    }
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
    } else if (mode === 'veh') {
      if (!vehGarage || !vehId) { ui.close(); return; }
      els.vehTabs.innerHTML = vehTabsHtml();
      fill(els.vehList, vehHtml());
      els.vehTitle.textContent = G.data.buildings[vehGarage].name;
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
    if (mode === 'craft') return 'חומרים נלקחים מהתיק ואז מהתיבה · לחיצה על פריט בתיק: שימוש · E / Esc: סגירה';
    if (mode === 'veh') return 'חלקים לוקחים מהתיק ומהתיבה · U / Esc: סגירה';
    if (mode === 'build') return 'מבנה חדש נבנה במקום המסומן בבסיס · B / Esc: סגירה';
    if (mode === 'map' && flight) return 'בחרו יעד ולחצו "המראה" (או Enter). הטיסה עולה דלק בלבד · Esc: סגירה';
    if (mode === 'map') return 'בחרו יעד ולחצו "צאו לדרך" (או Enter). החזרה מכל יעד חינם · E / Esc: סגירה';
    return 'לחיצה: שימוש / לבישה / נשק ראשי · קליק ימני על נשק: משני · גרירה: סידור התיק והציוד · I / Esc: סגירה';
  }

  function applyMode() {
    els.layer.classList.toggle('open', mode !== 'none');
    els.chestPanel.classList.toggle('hidden', mode !== 'chest');
    els.craftPanel.classList.toggle('hidden', mode !== 'craft');
    els.buildPanel.classList.toggle('hidden', mode !== 'build');
    els.vehPanel.classList.toggle('hidden', mode !== 'veh');
    els.mapPanel.classList.toggle('hidden', mode !== 'map');
    els.bagPanel.classList.toggle('hidden', mode === 'build' || mode === 'map' || mode === 'veh');
    els.gearPanel.classList.toggle('hidden', mode !== 'bag');
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
      els.vehPanel = document.getElementById('veh-panel'); els.vehList = document.getElementById('veh-list'); els.vehTitle = document.getElementById('veh-title'); els.vehTabs = document.getElementById('veh-tabs');
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
      els.gearPanel = document.getElementById('gear-panel');
      els.gearClothes = document.getElementById('gear-clothes');
      els.gearWeapons = document.getElementById('gear-weapons');
      els.gearStats = document.getElementById('gear-stats');
      els.doll = document.getElementById('gear-doll');
      els.ghost = document.getElementById('drag-ghost');
      els.hot = {};
      [].forEach.call(document.querySelectorAll('#hotbar .hslot'), function (h) { els.hot[h.getAttribute('data-k')] = { el: h, ico: h.querySelector('i') }; });
      var dd = Math.min(root.devicePixelRatio || 1, 2);
      els.doll.width = Math.round(200 * dd); els.doll.height = Math.round(264 * dd); els.dollK = dd;
      els.weaponName = document.getElementById('weapon-name');
      els.weaponAmmo = document.getElementById('weapon-ammo');

      // needs bars, built from data/needs.js
      var nh = document.getElementById('needs-hud'), html = '';
      G.data.needs.order.forEach(function (k) {
        html += '<div class="need ' + k + '" data-k="' + k + '" title="' + G.data.needs.labels[k] + '"><span class="ico">' + (NEED_ICON[k] || '') + '</span>' +
          '<span class="meter"><i></i></span>' + (k === 'health' ? '<b class="val"></b>' : '') + '</div>';
      });
      nh.innerHTML = html + '<div class="status"></div>';
      G.data.needs.order.forEach(function (k) {
        var row = nh.querySelector('[data-k="' + k + '"]');
        needEls[k] = { row: row, bar: row.querySelector('i'), val: row.querySelector('.val') };
      });
      els.status = nh.querySelector('.status');

      function handle(e, amount) {
        var tab = e.target.closest ? e.target.closest('.tab') : null;
        if (tab) {                                    // a category tab of the crafting panel
          e.preventDefault();
          if (amount === Infinity && mode === 'craft') { craftCat = tab.getAttribute('data-cat'); dirty = true; }
          if (amount === Infinity && mode === 'veh' && tab.getAttribute('data-veh')) { vehId = tab.getAttribute('data-veh'); dirty = true; }
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
            else if (what === 'vinstall') ui.vehInstall(id);
            else if (what === 'vwash') ui.vehWash();
            else if (what === 'vassemble') ui.vehAssemble(id);
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
        if (dropped) return;                          // the click that ends a drag is not a click on the slot
        var owner = btn.getAttribute('data-owner'), idx = parseInt(btn.getAttribute('data-i'), 10);
        if (owner === 'gear') { if (amount === Infinity) ui.gearClick(btn.getAttribute('data-slot')); }
        else if (mode === 'chest') ui.transfer(owner, idx, amount);
        else if (owner === 'bag') ui.bagClick(idx, amount !== Infinity);
      }

      // Drag and drop between slots: backpack, chest and equipment. A small ghost follows the mouse (transform only).
      var drag = null, dropped = false;
      function desc(el) { return { owner: el.getAttribute('data-owner'), i: parseInt(el.getAttribute('data-i'), 10), slot: el.getAttribute('data-slot') }; }
      els.layer.addEventListener('mousedown', function (e) {
        var b = e.button === 0 && e.target.closest ? e.target.closest('.slot') : null;
        if (!b || b.classList.contains('empty') || mode === 'none') return;
        drag = { el: b, x: e.clientX, y: e.clientY, on: false };
      });
      root.addEventListener('mousemove', function (e) {
        if (!drag) return;
        if (!drag.on) {
          if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 8) return;
          drag.on = true;
          var tile = drag.el.querySelector('.tile');
          els.ghost.style.backgroundImage = tile ? tile.style.backgroundImage : 'none';
          els.ghost.classList.add('on'); drag.el.classList.add('dragging');
        }
        els.ghost.style.transform = 'translate(' + (e.clientX - 30) + 'px,' + (e.clientY - 30) + 'px)';
      });
      root.addEventListener('mouseup', function (e) {
        var d = drag; drag = null;
        if (!d || !d.on) return;
        els.ghost.classList.remove('on'); d.el.classList.remove('dragging');
        dropped = true; root.setTimeout(function () { dropped = false; }, 0);
        var t = document.elementFromPoint(e.clientX, e.clientY);
        t = t && t.closest ? t.closest('.slot') : null;
        if (t && t !== d.el) ui.drop(desc(d.el), desc(t));
      });
      els.layer.addEventListener('click', function (e) { handle(e, Infinity); });
      els.layer.addEventListener('contextmenu', function (e) { handle(e, 1); });
      // click on the dark backdrop closes
      els.layer.addEventListener('mousedown', function (e) { if (e.target === els.layer) ui.close(); });
      root.addEventListener('keydown', function (e) {
        if (mode === 'map' && e.code === 'Enter') { e.preventDefault(); if (mapSel) ui.depart(mapSel); }
      });
      root.addEventListener('keydown', function (e) {       // H: show / hide the list of keys
        if (e.code === 'KeyH' && !e.repeat && !document.body.classList.contains('menu')) document.body.classList.toggle('keys');
      });
      if (G.hud) G.hud.init();
      applyMode();
    },

    isOpen: function () { return mode !== 'none'; },
    mode: function () { return mode; },
    station: function () { return station; },
    openChest: function () { mode = 'chest'; station = null; chestChanged = false; applyMode(); snd('open'); },
    openBag: function () { mode = 'bag'; station = null; applyMode(); snd('pickup', { vol: 0.6 }); },
    openCraft: function (id) { mode = 'craft'; station = id; craftCat = 'all'; applyMode(); snd('ui'); },
    openVehicle: function (garage, id) { mode = 'veh'; vehGarage = garage; vehId = id; station = null; applyMode(); snd('open'); },
    vehAssemble: function (part) {
      if (mode !== 'veh') return null;
      var r = G.game.vehicleAssemble(vehId, part), it = items()[part];
      say(r.ok ? (r.done ? 'הושלם: ' + G.data.vehicles[vehId].name : 'הותקן: ' + it.name + ' (' + r.fitted + '/' + r.need + ')') : (r.reason === 'part' ? 'חסר חלק: ' + it.name : r.reason === 'full' ? 'החלק כבר הותקן' : 'אי אפשר להרכיב כאן'));
      dirty = true; return r;
    },
    vehInstall: function (upId) {
      if (mode !== 'veh') return null;
      var r = G.game.vehicleInstall(vehId, upId), up = G.vehicles.upgradesFor(vehId).filter(function (u) { return u.id === upId; })[0];
      say(r.ok ? 'הותקן: ' + up.name + ' (רמה ' + r.level + ')' : (r.reason === 'part' ? 'חסר חלק: ' + items()[up.part].name : r.reason === 'max' ? 'הגעתם למקסימום' : 'אי אפשר להתקין כאן'));
      dirty = true; return r;
    },
    vehWash: function () {
      if (mode !== 'veh') return null;
      var r = G.game.vehicleWash(vehId);
      say(r.ok ? 'נשטף: ' + G.data.vehicles[vehId].name + ' נקי' : (r.reason === 'water' ? 'חסרים מים נקיים' : r.reason === 'clean' ? 'כבר נקי' : 'אי אפשר לשטוף כאן'));
      dirty = true; return r;
    },
    openBuild: function () { mode = 'build'; station = null; applyMode(); snd('ui'); },
    // flightId: the helicopter the player just boarded (then every open place and home can be reached, for fuel).
    openMap: function (flightId) {
      mode = 'map'; station = null; snd('ui');
      flight = flightId || null;
      if (flight) { if (!mapSel || !G.game.flight.can(mapSel)) mapSel = G.game.flight.here() !== 'base' ? 'base' : (G.data.world.order.filter(G.story.isUnlocked)[0] || null); }
      else if (!mapSel || !G.world.has(mapSel) || !G.story.isUnlocked(mapSel)) mapSel = G.data.world.order.filter(G.story.isUnlocked)[0] || G.data.world.order[0];
      applyMode();
    },
    close: function () {
      if (mode === 'none') return;
      var wasChest = mode === 'chest' && chestChanged;
      snd(mode === 'chest' ? 'close' : 'ui', { vol: 0.7 });
      mode = 'none'; station = null; chestChanged = false; flight = null; applyMode();
      if (wasChest) game('save', 'chest');
    },
    toggleBag: function () { if (mode === 'bag') ui.close(); else if (mode === 'none') ui.openBag(); },
    toggleBuild: function () { if (mode === 'build') ui.close(); else if (mode === 'none') ui.openBuild(); },
    markDirty: function () { dirty = true; },
    setArea: function (name) { if (els.area.textContent !== name) els.area.textContent = name; },
    selected: function () { return mapSel; },

    selectDest: function (id) {
      if (mode !== 'map') return;
      if (flight ? !G.game.flight.can(id) : (!G.world.has(id) || !G.story.isUnlocked(id))) return;
      if (mapSel !== id) snd('ui', { vol: 0.6 });
      mapSel = id; dirty = true;
    },

    depart: function (id) {
      if (mode !== 'map') return false;
      if (flight) return G.game.fly(flight, id);
      if (!G.world.has(id) || !G.story.isUnlocked(id)) return false;
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

    // Click on a backpack item: clothes are put on, a weapon becomes the primary one (right click: the secondary), the rest is used.
    bagClick: function (idx, alt) {
      var st = G.state, s = st.bag.slots[idx];
      if (!s) return;
      var d = items()[s.id], w = weaponOf(s.id);
      if (d.wear) { if (!alt) ui.wear(idx); }
      else if (w) {
        if (alt) G.gear.setWeapon(st.equip, 'secondary', w.id); else if (!G.gear.promote(st.equip, w.id)) G.gear.setWeapon(st.equip, 'secondary', w.id);
        snd('pickup', { vol: 0.6 }); say(w.name + ': ' + (st.equip.primary === w.id ? 'נשק ראשי (מקש 1)' : 'נשק משני (מקש 2)'));
        dirty = true; game('save', 'gear');
      } else if (!alt) ui.use(idx);
    },

    wear: function (idx) {
      var st = G.state, r = G.gear.wear(st.equip, st.bag, idx);
      if (r.ok) { snd('pickup'); say('לבשתם: ' + items()[st.equip[r.slot]].name + ' · ' + armorText(items()[st.equip[r.slot]])); dirty = true; game('save', 'gear'); }
      return r;
    },

    // Click on an equipment slot: clothes come off into the backpack, a weapon slot is cleared.
    gearClick: function (slot) {
      var st = G.state, id = st.equip[slot];
      if (!id) return;
      if (slot === 'primary' || slot === 'secondary') { G.gear.setWeapon(st.equip, slot, null); snd('ui'); }
      else {
        var r = G.gear.takeOff(st.equip, st.bag, slot, -1);
        if (!r.ok) { snd('uiBad'); say('אין מקום בתיק'); return; }
        snd('pickup', { vol: 0.6 }); say('הורדתם: ' + items()[id].name);
      }
      dirty = true; game('save', 'gear');
    },

    // The end of a drag: from one slot onto another (backpack, chest, equipment).
    drop: function (a, b) {
      var st = G.state, eq = st.equip, ok = false, isW = function (s) { return s === 'primary' || s === 'secondary'; };
      function inv(o) { return o === 'bag' ? st.bag : (o === 'chest' && mode === 'chest' ? st.chest : null); }
      if (a.owner !== 'gear' && b.owner !== 'gear') {
        var A = inv(a.owner), B = inv(b.owner);
        ok = !!A && !!B && G.inventory.swap(A, a.i, B, b.i);
        if (ok && A !== B) chestChanged = true;
      } else if (a.owner === 'bag' && b.owner === 'gear') {
        var s = st.bag.slots[a.i], w = s && weaponOf(s.id);
        if (isW(b.slot)) { if (w) ok = G.gear.setWeapon(eq, b.slot, w.id); }
        else if (s && G.gear.slotOf(s.id) === b.slot) ok = G.gear.wear(eq, st.bag, a.i).ok;
        if (!ok) { snd('uiBad'); say('זה לא מתאים למשבצת הזאת'); return; }
      } else if (a.owner === 'gear' && b.owner === 'bag') {
        if (isW(a.slot)) { G.gear.setWeapon(eq, a.slot, null); ok = true; }
        else {
          var t = st.bag.slots[b.i];
          if (t && G.gear.slotOf(t.id) === a.slot) ok = G.gear.wear(eq, st.bag, b.i).ok;            // onto another piece of the same kind: they trade
          else ok = G.gear.takeOff(eq, st.bag, a.slot, b.i).ok;
          if (!ok) { snd('uiBad'); say('אין מקום בתיק'); return; }
        }
      } else if (a.owner === 'gear' && b.owner === 'gear' && isW(a.slot) && isW(b.slot)) {
        ok = G.gear.setWeapon(eq, b.slot, eq[a.slot]);
      }
      if (ok) { snd('pickup', { gap: 0.06, vol: 0.7 }); dirty = true; if (mode !== 'chest') game('save', 'gear'); }
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
      if (r.ok) { G.story.emit('craft', { recipe: recipeId }); snd(station === 'campfire' ? 'cook' : 'craft'); say(r.vehicle ? 'נבנה: ' + G.data.vehicles[r.vehicle].name + ' · עומד מול המוסך. הביאו ג׳ריקן דלק, F לתדלוק, V לעלייה' : 'נוצר: ' + items()[r.out[0]].name + (r.out[1] > 1 ? ' ×' + r.out[1] : '')); game('save', 'craft'); }
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
      ui.close();
      G.game.startPlacing({ kind: 'fence', o: 'h' });
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
        if (needEls[k].val && needLast[k + 'N'] !== Math.ceil(n[k])) { needLast[k + 'N'] = Math.ceil(n[k]); needEls[k].val.textContent = Math.ceil(n[k]); }
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

    // The two weapon slots at the bottom of the screen (keys 1 and 2) and the hands (3); the one in the hands is lit.
    setHotbar: function (eq, held) {
      if (!eq || !els.hot) return;
      var key = (eq.primary || '') + '|' + (eq.secondary || '') + '|' + held;
      if (hotLast === key) return;
      hotLast = key;
      ['primary', 'secondary'].forEach(function (k) {
        var h = els.hot[k], id = eq[k];
        h.ico.style.backgroundImage = id ? 'url(' + G.icons.url(G.data.weapons[id].item) + ')' : 'none';
        h.el.classList.toggle('empty', !id);
        h.el.classList.toggle('on', !!id && held === id);
      });
      els.hot.hands.el.classList.toggle('on', held === 'hands');
    },

    // The figure in the equipment panel: the player's own body, drawn large, wearing what is worn.
    drawDoll: function () {
      var st = G.state, g = els.doll.getContext('2d'), k = els.dollK;
      if (!doll) doll = G.player.create(0, 0);
      doll.outfit = st.equip; doll.held = st.player.held; doll.heldK = 1;
      doll.angle = doll.prevAngle = doll.face = doll.pFace = Math.PI / 2 - 0.3;
      g.setTransform(k, 0, 0, k, 0, 0);
      g.clearRect(0, 0, 200, 264);
      g.translate(100, 226); g.scale(3.9, 3.9);
      G.player.draw(g, doll, 1, (root.performance ? root.performance.now() : 0) / 1000);
    },

    update: function () { if (dirty) render(); if (mode === 'bag' && G.state.equip) ui.drawDoll(); }
  };

  G.ui = ui;
})(typeof window !== 'undefined' ? window : globalThis);
