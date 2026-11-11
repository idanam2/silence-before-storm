// Main menu, difficulty choice, pause menu and goodbye screen (DOM only). All of it fades with opacity,
// so nothing jumps. The game itself is started and stopped through G.game (newGame, continueGame, toMenu...).
(function (root) {
  'use strict';
  var G = root.G;

  var screen = 'main';          // 'main' | 'diff' | 'pause' | 'bye' | null (hidden)
  var picked = null;            // difficulty id chosen on the difficulty screen
  var els = {};

  var WHY = {
    none: '', unavailable: 'השמירה לא זמינה בדפדפן הזה (האחסון חסום).',
    corrupt: 'קובץ השמירה פגום. אפשר להתחיל משחק חדש.', newer: 'השמירה נוצרה בגרסה חדשה יותר של המשחק.',
    old: 'השמירה ישנה מדי ואי אפשר לטעון אותה.'
  };

  function two(n) { return n < 10 ? '0' + n : '' + n; }

  function playTimeText(s) {
    var m = Math.floor(s / 60), h = Math.floor(m / 60);
    return h ? h + ':' + two(m % 60) + ' שעות' : (m < 2 ? 'דקה' : m + ' דקות');
  }

  // "in <place>": the Hebrew definite article merges into the prefix (ב + היער = ביער).
  function inPlace(name) { return 'ב' + (name.charAt(0) === 'ה' ? name.slice(1) : name); }

  // One line about the saved game for the Continue button.
  function summaryText(d) {
    var where = d.area === 'base' ? 'בבסיס' : inPlace(G.world.name(d.area));
    return G.data.difficulty.levels[d.diff].name + ' · ' + where + ' · ' + playTimeText(d.playTime);
  }

  function show(name) {
    screen = name;
    ['main', 'diff', 'pause', 'bye'].forEach(function (s) { els[s].classList.toggle('on', s === name); });
    els.layer.classList.toggle('on', !!name);
    els.layer.classList.toggle('pausing', name === 'pause');
    if (name === 'main') refreshMain();
    if (name === 'diff') refreshDiff();
    if (name === 'pause') els.pauseNote.textContent = '';
    var first = name === 'main' ? (els.cont.disabled ? els.newBtn : els.cont) : (name === 'diff' ? els.start : (name === 'pause' ? els.resume : null));
    if (first) root.setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 0);
  }

  function refreshMain() {
    var r = G.save.read();
    els.cont.disabled = !r.ok;
    els.contSub.textContent = r.ok ? summaryText(r.data) : '';
    els.mainNote.textContent = r.ok ? '' : (WHY[r.reason] || '');
    els.saved = r.ok;
  }

  function refreshDiff() {
    var r = G.save.read();
    els.diffWarn.classList.toggle('on', r.ok || r.reason === 'corrupt');
    els.diffWarn.textContent = r.ok ? 'השמירה הקיימת תוחלף במשחק החדש.' : (r.reason === 'corrupt' ? 'השמירה הפגומה תוחלף במשחק החדש.' : '');
    pick(picked || G.data.difficulty.default);
  }

  function pick(id) {
    picked = id;
    var cards = els.cards.querySelectorAll('.dcard');
    for (var i = 0; i < cards.length; i++) cards[i].classList.toggle('sel', cards[i].getAttribute('data-id') === id);
  }

  var menu = {
    init: function () {
      els.layer = document.getElementById('menu-layer');
      els.main = document.getElementById('ms-main');
      els.diff = document.getElementById('ms-diff');
      els.pause = document.getElementById('ms-pause');
      els.bye = document.getElementById('ms-bye');
      els.cont = document.getElementById('mb-continue');
      els.contSub = document.getElementById('mb-continue-sub');
      els.newBtn = document.getElementById('mb-new');
      els.mainNote = document.getElementById('mm-note');
      els.cards = document.getElementById('diff-cards');
      els.diffWarn = document.getElementById('diff-warn');
      els.start = document.getElementById('mb-start');
      els.resume = document.getElementById('mb-resume');
      els.pauseNote = document.getElementById('pause-note');

      var D = G.data.difficulty, html = '';
      D.order.forEach(function (id) {
        var d = D.levels[id];
        html += '<button class="dcard" data-id="' + id + '"><b>' + d.name + '</b><span>' + d.desc + '</span></button>';
      });
      els.cards.innerHTML = html;
      els.cards.addEventListener('click', function (e) {
        var c = e.target.closest ? e.target.closest('.dcard') : null;
        if (c) pick(c.getAttribute('data-id'));
      });
      els.cards.addEventListener('dblclick', function (e) {
        var c = e.target.closest ? e.target.closest('.dcard') : null;
        if (c) { pick(c.getAttribute('data-id')); G.game.newGame(picked); }
      });

      els.cont.addEventListener('click', function () {
        var r = G.game.continueGame();
        if (!r.ok) { els.mainNote.textContent = WHY[r.reason] || 'לא ניתן לטעון את השמירה.'; refreshMain(); }
      });
      els.newBtn.addEventListener('click', function () { show('diff'); });
      document.getElementById('mb-exit').addEventListener('click', function () { G.game.exit(); });
      els.start.addEventListener('click', function () { G.game.newGame(picked || D.default); });
      document.getElementById('mb-back').addEventListener('click', function () { show('main'); });
      els.resume.addEventListener('click', function () { G.game.setPaused(false); });
      document.getElementById('mb-save').addEventListener('click', function () {
        els.pauseNote.textContent = G.game.save('manual') ? 'נשמר.' : 'השמירה נכשלה (האחסון בדפדפן חסום).';
      });
      document.getElementById('mb-tomenu').addEventListener('click', function () { G.game.toMenu(); });
      document.getElementById('mb-bye-back').addEventListener('click', function () { show('main'); });
      root.addEventListener('keydown', function (e) {
        if (e.code === 'Escape' && screen === 'diff') show('main');
      });
    },

    showMain: function () { show('main'); },
    showBye: function () { show('bye'); },
    pause: function () { show('pause'); },
    hide: function () { show(null); },
    isOpen: function () { return !!screen; },
    screen: function () { return screen; },
    pick: pick,
    picked: function () { return picked; },
    summaryText: summaryText
  };

  G.menu = menu;
})(typeof window !== 'undefined' ? window : globalThis);
