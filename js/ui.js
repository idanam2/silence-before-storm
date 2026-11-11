// DOM overlay: backpack panel, chest panel, interaction prompt, backpack meter, area name.
// The DOM is only rebuilt when something changes (dirty flag), so nothing flickers or jumps.
(function (root) {
  'use strict';
  var G = root.G;

  var mode = 'none';           // 'none' | 'bag' | 'chest'
  var dirty = true, promptShown = false;
  var els = {};

  function items() { return G.data.items; }

  function slotHtml(owner, inv, i) {
    var s = inv.slots[i];
    if (!s) return '<button class="slot empty" data-owner="' + owner + '" data-i="' + i + '" tabindex="-1"></button>';
    var d = items()[s.id];
    var count = s.n > 1 ? '<span class="count">' + s.n + '</span>' : '';
    return '<button class="slot" data-owner="' + owner + '" data-i="' + i + '" tabindex="-1" title="' + d.name + ' ×' + s.n + '">' +
      '<span class="tile" style="background-image:url(' + G.icons.url(s.id) + ')"></span>' +
      '<span class="name">' + d.name + '</span>' + count + '</button>';
  }

  function gridHtml(owner, inv) {
    var h = '';
    for (var i = 0; i < inv.slots.length; i++) h += slotHtml(owner, inv, i);
    return h;
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
    dirty = false;
  }

  function applyMode() {
    els.layer.classList.toggle('open', mode !== 'none');
    els.chestPanel.classList.toggle('hidden', mode !== 'chest');
    els.hint.textContent = mode === 'chest'
      ? 'לחיצה: העבר הכל · קליק ימני: העבר אחד · E / Esc: סגירה'
      : 'I / Tab / Esc: סגירה';
    dirty = true;
  }

  var ui = {
    init: function () {
      els.layer = document.getElementById('inv-layer');
      els.bagGrid = document.getElementById('bag-grid');
      els.bagCount = document.getElementById('bag-count');
      els.chestPanel = document.getElementById('chest-panel');
      els.chestGrid = document.getElementById('chest-grid');
      els.chestCount = document.getElementById('chest-count');
      els.hint = document.getElementById('inv-hint');
      els.prompt = document.getElementById('prompt');
      els.hud = document.getElementById('bag-hud');
      els.hudCount = document.getElementById('bag-hud-count');
      els.hudFill = document.getElementById('bag-hud-fill');
      els.area = document.getElementById('area-name');

      function handle(e, amount) {
        var btn = e.target.closest ? e.target.closest('.slot') : null;
        if (!btn) return;
        e.preventDefault();
        ui.transfer(btn.getAttribute('data-owner'), parseInt(btn.getAttribute('data-i'), 10), amount);
      }
      els.layer.addEventListener('click', function (e) { handle(e, Infinity); });
      els.layer.addEventListener('contextmenu', function (e) { handle(e, 1); });
      // click on the dark backdrop closes
      els.layer.addEventListener('mousedown', function (e) { if (e.target === els.layer) ui.close(); });
      applyMode();
    },

    isOpen: function () { return mode !== 'none'; },
    mode: function () { return mode; },
    openChest: function () { mode = 'chest'; applyMode(); },
    openBag: function () { mode = 'bag'; applyMode(); },
    close: function () { if (mode !== 'none') { mode = 'none'; applyMode(); } },
    toggleBag: function () { if (mode === 'bag') ui.close(); else if (mode === 'none') ui.openBag(); },
    markDirty: function () { dirty = true; },
    setArea: function (name) { if (els.area.textContent !== name) els.area.textContent = name; },

    // Moves items between backpack and chest (only while the chest is open).
    transfer: function (owner, idx, amount) {
      if (mode !== 'chest') return 0;
      var st = G.state;
      var from = owner === 'bag' ? st.bag : st.chest;
      var to = owner === 'bag' ? st.chest : st.bag;
      var moved = G.inventory.move(from, idx, to, amount);
      if (moved) dirty = true;
      return moved;
    },

    showPrompt: function (text) {   // text or null; toggles only on change
      var want = !!text;
      if (want && els.prompt.textContent !== text) els.prompt.textContent = text;
      if (want !== promptShown) { promptShown = want; els.prompt.classList.toggle('show', want); }
    },

    update: function () { if (dirty) render(); }
  };

  G.ui = ui;
})(typeof window !== 'undefined' ? window : globalThis);
