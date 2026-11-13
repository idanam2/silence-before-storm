// Story windows (DOM): the dialogue box with choices, the note reader and the journal (J).
// While any of them is open the game is frozen (js/game.js checks G.storyUI.active()). Text is only written to the DOM when it
// changes and nothing animates in size or position, so nothing jumps or flickers.
(function (root) {
  'use strict';
  var G = root.G;

  var els = {}, sess = null, noteOpen = null, journalOpen = false, noteFromJournal = false;
  var lastKey = '', jDirty = false;
  var KIND = { paper: 'פתק', diary: 'יומן', document: 'מסמך', audio: 'הקלטה', wall: 'הקיר', drawing: 'ציור', letter: 'מכתב' };
  var MODE_TAG = { radio: 'רדיו', recording: 'הקלטה', slate: 'לוח גיר' };
  function snd(name, o) { if (G.audio) G.audio.play(name, o); }

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // A small grey noise tile for radio lines (generated once; its strength follows the line's `static`).
  function noiseUrl() {
    try {
      var c = document.createElement('canvas'); c.width = c.height = 96;
      var g = c.getContext('2d'), im = g.createImageData(96, 96), i, v;
      for (i = 0; i < im.data.length; i += 4) { v = 90 + Math.floor(Math.random() * 120); im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      g.putImageData(im, 0, 0);
      return 'url(' + c.toDataURL('image/png') + ')';
    } catch (e) { return 'none'; }
  }

  function build() {
    var d = document.createElement('div');
    d.id = 'story-layer';
    d.innerHTML =
      '<div id="sdlg" class="sdlg"><div id="sd-choices" class="sd-choices"></div>' +
      '<div id="sd-box" class="sd-box"><div class="sd-noise"></div><div id="sd-name" class="sd-name"></div><div id="sd-text" class="sd-text"></div>' +
      '<div id="sd-hint" class="sd-hint">E / רווח · המשך</div></div></div>' +
      '<div id="snote" class="snote"><div class="sn-card"><div id="sn-meta" class="sn-meta"></div><h2 id="sn-title"></h2><div id="sn-text" class="sn-text"></div>' +
      '<div class="sn-hint">E / Esc · סגירה</div></div></div>' +
      '<div id="sjournal" class="sjournal"><div class="sj-card"><header><h2>יומן</h2><span class="sj-hint">J / Esc · סגירה</span></header><div id="sj-body" class="sj-body"></div></div></div>';
    document.body.appendChild(d);
    els.dlg = document.getElementById('sdlg'); els.box = document.getElementById('sd-box'); els.name = document.getElementById('sd-name');
    els.text = document.getElementById('sd-text'); els.choices = document.getElementById('sd-choices'); els.hint = document.getElementById('sd-hint');
    els.note = document.getElementById('snote'); els.nMeta = document.getElementById('sn-meta'); els.nTitle = document.getElementById('sn-title'); els.nText = document.getElementById('sn-text');
    els.journal = document.getElementById('sjournal'); els.jBody = document.getElementById('sj-body');
    els.box.style.setProperty('--noise', noiseUrl());
  }

  // ---- dialogue ----------------------------------------------------------------------------------------------------
  function renderDialogue() {
    var v = G.dialogue.view(sess);
    if (!v) return;
    var key = sess.id + '|' + sess.node + '|' + sess.idx + '|' + (v.choices ? v.choices.length : 0);
    if (key === lastKey) return;
    lastKey = key;
    var cls = 'sd-box m-' + v.mode + (v.who === 'system' ? ' sys' : '');
    if (els.box.className !== cls) els.box.className = cls;
    els.box.style.setProperty('--sc', v.color);
    els.box.style.setProperty('--st', String(Math.min(1, v.static || 0)));
    var tag = MODE_TAG[v.mode] ? '<em>' + MODE_TAG[v.mode] + '</em>' : '';
    els.name.innerHTML = v.name ? '<b>' + esc(v.name) + '</b>' + tag : tag;
    els.text.textContent = v.text;
    if (v.choices) {
      els.choices.innerHTML = v.choices.map(function (c) { return '<button class="sd-choice" data-k="' + (c.n - 1) + '" tabindex="-1"><kbd>' + c.n + '</kbd>' + esc(c.text) + '</button>'; }).join('');
      els.choices.classList.add('on');
      els.hint.textContent = '1-' + v.choices.length + ' · בחירה';
    } else {
      els.choices.classList.remove('on');
      els.hint.textContent = 'E / רווח · המשך';
    }
  }

  function openDialogue(s) {
    sess = s; lastKey = '';
    els.dlg.classList.add('open');
    renderDialogue();
    snd('ui', { vol: 0.5 });
  }
  function closeDialogue() { sess = null; lastKey = ''; els.dlg.classList.remove('open'); els.choices.classList.remove('on'); }

  // ---- notes -----------------------------------------------------------------------------------------------------
  function openNote(id, note) {
    noteOpen = id;
    els.nMeta.textContent = (KIND[note.kind] || 'פתק') + (note.author ? ' · ' + note.author : '');
    els.nTitle.textContent = note.title;
    els.nText.textContent = note.text;
    els.note.className = 'snote open k-' + note.kind;
    snd('pickup', { vol: 0.6 });
  }
  function closeNote() {
    noteOpen = null; els.note.className = 'snote';
    if (noteFromJournal) { noteFromJournal = false; }
  }

  // ---- journal ---------------------------------------------------------------------------------------------------
  function stepHtml(s) {
    return '<li class="' + (s.done ? 'done' : (s.current ? 'cur' : '')) + '"><i>' + (s.done ? '✓' : (s.current ? '›' : '·')) + '</i>' + esc(s.text) + (s.optional ? ' <em>(רשות)</em>' : '') + '</li>';
  }
  function questHtml(q, full) {
    return '<div class="jq' + (q.done ? ' fin' : '') + '"><h3>' + (q.kind === 'main' ? 'פרק ' + q.chapter + ' · ' : '') + esc(q.title) + '</h3>' +
      (full && q.summary ? '<p class="sum">' + esc(q.summary) + '</p>' : '') +
      '<ul>' + (full ? q.steps : q.steps.filter(function (s) { return s.current; })).map(stepHtml).join('') + '</ul>' +
      (full && q.hint ? '<p class="hint">' + esc(q.hint) + '</p>' : '') + '</div>';
  }
  function journalHtml() {
    var j = G.story.journal(), h = '';
    h += '<section><h4>משימה ראשית</h4>' + (j.main ? questHtml(j.main, true) : '<p class="empty">אין משימה פעילה כרגע.</p>') + '</section>';
    if (j.sides.length) h += '<section><h4>משימות צד</h4>' + j.sides.map(function (q) { return questHtml(q, false); }).join('') + '</section>';
    var wall = j.series.wall || [], rest = [];
    j.seriesOrder.forEach(function (k) { if (k !== 'wall') rest = rest.concat(j.series[k]); });
    function list(arr) { return '<ul class="jn">' + arr.map(function (n) { return '<li><button class="jn-b" data-note="' + n.id + '" tabindex="-1">' + esc(n.title) + '<em>' + (KIND[n.kind] || '') + '</em></button></li>'; }).join('') + '</ul>'; }
    if (wall.length) h += '<section><h4>הקיר</h4>' + list(wall) + '</section>';
    if (rest.length) h += '<section><h4>פתקים, מסמכים והקלטות</h4>' + list(rest) + '</section>';
    if (j.doneSides.length) h += '<section><h4>הושלמו</h4>' + j.doneSides.map(function (q) { return '<div class="jq fin"><h3>' + esc(q.title) + '</h3></div>'; }).join('') + '</section>';
    return h;
  }
  function openJournal() {
    journalOpen = true; jDirty = true;
    els.journal.classList.add('open');
    renderJournal();
    snd('ui', { vol: 0.6 });
  }
  function closeJournal() { journalOpen = false; els.journal.classList.remove('open'); snd('ui', { vol: 0.5 }); }
  function renderJournal() {
    if (!jDirty) return;
    jDirty = false;
    var top = els.jBody.scrollTop;
    els.jBody.innerHTML = journalHtml();
    els.jBody.scrollTop = top;
  }

  // ---- per tick ---------------------------------------------------------------------------------------------------
  function afterDialogue() {                      // a dialogue ended: chain the next queued thing at once
    if (sess && sess.done) closeDialogue();
    if (!sess && !noteOpen) { var it = G.story.pump(); if (it) show(it); }
  }

  function show(it) {
    if (it.t === 'dlg') openDialogue(it.session);
    else if (it.t === 'note') openNote(it.id, it.note);
  }

  var ui = {
    init: function () {
      build();
      els.dlg.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('.sd-choice') : null;
        if (b && sess) { G.dialogue.choose(sess, parseInt(b.getAttribute('data-k'), 10)); snd('ui', { vol: 0.5 }); afterDialogue(); if (sess) renderDialogue(); return; }
        if (sess && e.target.closest && e.target.closest('#sd-box')) { G.dialogue.advance(sess); snd('ui', { vol: 0.4 }); afterDialogue(); if (sess) renderDialogue(); }
      });
      els.note.addEventListener('click', function () { var fromJ = noteFromJournal; closeNote(); if (!fromJ) afterDialogue(); });
      els.journal.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('.jn-b') : null;
        if (b) { var id = b.getAttribute('data-note'), n = G.story.noteView(id); if (n) { noteFromJournal = true; openNote(id, n); } return; }
        if (e.target === els.journal) closeJournal();
      });
    },
    active: function () { return !!sess || !!noteOpen || journalOpen; },
    dialogueOpen: function () { return !!sess; },
    journalOpen: function () { return journalOpen; },
    open: show,
    markJournal: function () { jDirty = true; },

    openJournal: function () { if (!ui.active()) openJournal(); },
    toggleJournal: function () { if (journalOpen && !noteOpen) closeJournal(); else if (!ui.active()) openJournal(); },

    // Keys while a story window is open (the game calls this instead of the normal tick). Returns nothing.
    step: function (inp) {
      var go = inp.wasPressed('KeyE') || inp.wasPressed('Space') || inp.wasPressed('Enter');
      if (noteOpen) {
        if (go || inp.wasPressed('Escape')) { var fromJ = noteFromJournal; closeNote(); if (!fromJ) afterDialogue(); }
        return;
      }
      if (journalOpen) {
        if (inp.wasPressed('KeyJ') || inp.wasPressed('Escape')) closeJournal();
        else { jDirty = true; renderJournal(); }
        return;
      }
      if (!sess) return;
      var v = G.dialogue.view(sess);
      if (v && v.choices) {
        for (var k = 0; k < Math.min(4, v.choices.length); k++) {
          if (inp.wasPressed('Digit' + (k + 1)) || inp.wasPressed('Numpad' + (k + 1))) { G.dialogue.choose(sess, k); snd('ui', { vol: 0.5 }); break; }
        }
        if (go && v.choices.length === 1) { G.dialogue.choose(sess, 0); snd('ui', { vol: 0.5 }); }
      } else if (go) { G.dialogue.advance(sess); snd('ui', { vol: 0.4 }); }
      afterDialogue();
      if (sess) renderDialogue();
    },

    // Closes everything (back to the menu, a new game).
    reset: function () { closeDialogue(); closeNote(); noteFromJournal = false; if (journalOpen) closeJournal(); }
  };

  G.storyUI = ui;
})(typeof window !== 'undefined' ? window : globalThis);
