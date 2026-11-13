// Story engine: quests, flags, events, triggers, actions, pickers (radio / Rachel / dreams), story objects ("spots") and the
// story part of the save. Pure logic (no DOM): everything the game does for it goes through `G.story.host` (set in js/game.js,
// replaced in tests). The story text and data live in story/data/*.js and data/story-wire.js (where things stand).
//
// How it is driven: the game calls G.story.emit(name, data) for engine events (see story/data/triggers.js for the list),
// G.story.poll() a few times a second (bag / building checks), and G.story.pump() when no story window is open (it returns the
// next thing to show: a dialogue session, a note, or runs a queued door). Anything the story wants shown is queued, never shown at once.
// Adding a chapter = adding data (spots placed in data/story-wire.js); this file knows no chapter.
(function (root) {
  'use strict';
  var G = root.G;

  var S = null;                       // the saved story state (see create())
  var evq = [], busy = false;         // event queue (events fired while handling events wait their turn)
  var queue = [];                     // things to show, in order: { t: 'dlg' | 'note' | 'door' }
  var holdProg = {}, listenProg = {}, holdNoise = {}, waved = {};     // spot progress (not saved)
  var lastBuild = null, quiet = false, suppressDlg = false, tripNo = 0, visitFired = {}, spotCache = {};
  var MAX_ID = 60;

  var host = {                        // replaced by the game; these defaults keep the engine usable in tests
    count: function () { return 0; }, give: function (id, n) { return n; }, take: function (id, n) { return n; },
    toast: function () {}, area: function () { return 'base'; }, buildings: function () { return {}; },
    door: function () {}, spawn: function () {}, weather: function () {}, noise: function () {}, rand: Math.random
  };

  function D() { return G.data; }
  function create() {
    return { flags: {}, quests: {}, played: {}, read: {}, spotsUsed: {}, fired: {}, events: {}, visited: {},
      unlocked: ['forest'], chapter: 0, weather: 'clear', owed: [], begun: false };
  }
  function parentOf(area) { var a = D().areas && D().areas[area]; return a && a.parent ? a.parent : null; }
  function areaMatch(want, cur) { return cur === want || parentOf(cur) === want; }
  function now() { return host.area(); }

  // ---- requirements ------------------------------------------------------------------------------------------------
  // req / when: { flags, notFlags, items, notItems, chapter (>=), chapterIs, quest (active), questDone, area, chance }
  function reqOk(r, x) {
    if (!r) return true;
    var i, k, q;
    for (i = 0; r.flags && i < r.flags.length; i++) if (!S.flags[r.flags[i]]) return false;
    for (i = 0; r.notFlags && i < r.notFlags.length; i++) if (S.flags[r.notFlags[i]]) return false;
    for (k in r.items || {}) if (host.count(k) < r.items[k]) return false;
    for (k in r.notItems || {}) if (host.count(k) >= r.notItems[k]) return false;
    if (r.chapter !== undefined && S.chapter < r.chapter) return false;
    if (r.chapterIs !== undefined && S.chapter !== r.chapterIs) return false;
    if (r.quest) { q = S.quests[r.quest]; if (!q || q.status !== 'active') return false; }
    if (r.questDone) { q = S.quests[r.questDone]; if (!q || q.status !== 'done') return false; }
    if (r.area && !areaMatch(r.area, (x && x.area) || now())) return false;
    if (r.chance !== undefined && host.rand() >= r.chance) return false;
    return true;
  }

  function setFlag(id, v) {
    if (v === undefined) v = true;
    var old = S.flags[id];
    if (v === false || v === 0 || v === null) delete S.flags[id]; else S.flags[id] = v;
    if (!old && v) emit('flag', { id: id, value: v });
  }

  // ---- quests --------------------------------------------------------------------------------------------------------
  function questDef(id) { return D().storyQuests[id]; }
  function eventCount(id) {
    if (id === 'wall_read') return (D().storyWall || []).filter(function (n) { return S.read[n]; }).length;   // each wall note counts once
    return S.events[id] || 0;
  }

  function stepDone(qs, st) {
    var i, k;
    switch (st.type) {
      case 'spot': return !!S.spotsUsed[st.spot];
      case 'visit': return !!S.visited[st.area];
      case 'item': return host.count(st.item) >= (st.n || 1);
      case 'items': for (k in st.items) if (host.count(k) < st.items[k]) return false; return true;
      case 'collect': return (qs.counters[st.id] || 0) >= st.n;
      case 'craft': case 'sleep': return (qs.counters[st.id] || 0) >= 1;
      case 'build': return ((host.buildings() || {})[st.building] || 0) >= (st.level || 1);
      case 'dialogue': return !!S.played[st.id_];
      case 'flag': return !!S.flags[st.flag];
      case 'notes': for (i = 0; i < st.notes.length; i++) if (!S.read[st.notes[i]]) return false; return true;
      case 'event': return eventCount(st.id_) >= (st.n || 1);
    }
    return false;
  }

  // Index of the first unfinished required step, or -1 when none is left.
  function currentStep(q, qs) {
    for (var i = 0; i < q.steps.length; i++) if (!qs.done[q.steps[i].id] && !q.steps[i].optional) return i;
    return -1;
  }

  function startQuest(id, silent) {
    var q = questDef(id);
    if (!q || S.quests[id]) return false;
    if (q.req && !reqOk(q.req)) return false;
    S.quests[id] = { status: 'active', counters: {}, done: {} };
    if (q.kind === 'main') S.chapter = q.chapter;
    emit('quest_start', { id: id });
    if (!quiet && !silent && !q.hidden) host.toast(q.kind === 'main' ? 'פרק ' + q.chapter + ' · ' + q.title + ' (J)' : 'משימה חדשה: ' + q.title + ' (J)', 3200);
    return true;
  }

  function completeQuest(id) {
    var q = questDef(id), qs = S.quests[id];
    qs.status = 'done';
    run(q.done || []);
    emit('quest_done', { id: id });
    if (q.next) startQuest(q.next);
    if (!quiet && !q.next && !q.hidden) host.toast('הושלם: ' + q.title, 2600);
  }

  // Marks every step that is now true; completes quests whose required steps are all done. Returns true if anything changed.
  function checkQuests() {
    var changed = false, id, q, qs, i, st, ids = Object.keys(S.quests);
    for (var n = 0; n < ids.length; n++) {
      id = ids[n]; qs = S.quests[id];
      if (qs.status !== 'active') continue;
      q = questDef(id);
      if (!q) continue;
      for (i = 0; i < q.steps.length; i++) {
        st = q.steps[i];
        if (qs.done[st.id] || !stepDone(qs, st)) continue;
        qs.done[st.id] = true; changed = true;
        if (!quiet && q.kind === 'main' && st.text) {
          var nx = currentStep(q, qs);
          host.toast('✓ ' + st.text + (nx >= 0 && q.steps[nx].text ? '  ·  הבא: ' + q.steps[nx].text : ''), 3200);
        }
      }
      if (currentStep(q, qs) < 0) { completeQuest(id); changed = true; }
    }
    return changed;
  }

  // ---- events and triggers -----------------------------------------------------------------------------------------
  function emit(name, data) {
    if (!S || !S.begun) return;
    evq.push({ name: name, data: data || {} });
    if (busy) return;
    busy = true;
    try {
      var guard = 0;
      do {
        while (evq.length && guard++ < 3000) onEvent(evq.shift());
        checkQuests();
      } while (evq.length && guard < 3000);
    } finally { busy = false; }
  }

  function wallNote() { var w = D().storyWall; return w[Math.min(S.chapter, w.length - 1)]; }

  function onEvent(e) {
    var d = e.data, i, id, q, qs, st;
    if (e.name === 'enter_area') {
      S.visited[d.area] = true;
      var par = parentOf(d.area); if (par) S.visited[par] = true;
    }
    if (e.name === 'item_gain' && d.src === 'gather') bump('collect', function (s) { return s.item === d.item; }, d.n);
    if (e.name === 'craft') bump('craft', function (s) { return s.recipe === d.recipe; }, 1);
    if (e.name === 'wake') {
      for (id in S.quests) {                          // sleeping counts only when it is the step the quest is waiting for
        qs = S.quests[id]; q = questDef(id);
        if (qs.status !== 'active' || !q) continue;
        i = currentStep(q, qs);
        if (i >= 0 && q.steps[i].type === 'sleep') qs.counters[q.steps[i].id] = 1;
      }
      var dream = pick(D().storyDreams); if (dream) queueDialogue(dream.dialogue);
    }
    fireTriggers(e);
    if (e.name === 'story_event') builtin(d.id);
  }

  function bump(type, match, n) {
    for (var id in S.quests) {
      var qs = S.quests[id], q = questDef(id);
      if (qs.status !== 'active' || !q) continue;
      for (var i = 0; i < q.steps.length; i++) {
        var st = q.steps[i];
        if (st.type === type && !qs.done[st.id] && match(st)) qs.counters[st.id] = (qs.counters[st.id] || 0) + n;
      }
    }
  }

  // Story events that have a built-in effect (the data says "what happened", this says what the game shows).
  function builtin(id) {
    if (id === 'wall_read') { var n = wallNote(); if (n) queueNote(n); }
    else if (id === 'radio_use') useRadio();
    else if (id === 'talk_rachel') talk(D().storyRachel);
    else if (id === 'talk_ori') talk(D().storyOri);
  }

  function trigOk(t, e) {
    var d = e.data;
    if (t.match !== undefined && t.match !== d.id) return false;
    if (t.recipe && t.recipe !== d.recipe) return false;
    if (t.notesAll) for (var i = 0; i < t.notesAll.length; i++) if (!S.read[t.notesAll[i]]) return false;
    if (t.eventCount && eventCount(t.match) < t.eventCount) return false;
    if (t.once !== false && S.fired[t.id]) return false;
    if (t.oncePerVisit && visitFired[t.id] === tripNo) return false;
    return reqOk(t.when, d);
  }

  function fireTriggers(e) {
    var list = D().storyTriggers || [];
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (t.on !== e.name || !trigOk(t, e)) continue;
      if (t.once !== false) S.fired[t.id] = true;
      if (t.oncePerVisit) visitFired[t.id] = tripNo;
      run(t.do, t.id);
    }
  }

  // ---- actions ---------------------------------------------------------------------------------------------------
  function run(list) {
    for (var i = 0; list && i < list.length; i++) {
      var a = list[i];
      switch (a.do) {
        case 'dialogue': if (!suppressDlg) queueDialogue(a.id); break;
        case 'note': queueNote(a.id); break;
        case 'give': give(a.item, a.n, a.to); break;
        case 'take': host.take(a.item, a.n); break;
        case 'flag': setFlag(a.id, a.value); break;
        case 'quest': startQuest(a.id); break;
        case 'unlock': unlock(a.area); break;
        case 'event': S.events[a.id] = (S.events[a.id] || 0) + 1; emit('story_event', { id: a.id }); break;
        case 'door': queue.push({ t: 'door', to: a.to }); break;
        case 'toast': if (!quiet) host.toast(a.text, 3600); break;
        case 'spawn': host.spawn(a); break;
        case 'weather': S.weather = a.id; host.weather(a.id); break;
        case 'radio': break;                         // the green light is computed from the radio queue (radioPending)
      }
    }
  }

  function give(item, n, to) {
    var added = host.give(item, n, to);
    if (added < n) S.owed.push({ item: item, n: n - added });          // bag and chest full: kept until there is room
    if (added > 0) emit('item_gain', { item: item, n: added, src: 'give' });
  }

  function unlock(area) {
    if (!area || S.unlocked.indexOf(area) >= 0) return;
    S.unlocked.push(area);
    if (!quiet) host.toast('יעד חדש במפה: ' + ((D().areas[area] && D().areas[area].name) || area), 3400);
  }

  function queueDialogue(id) { if (D().storyDialogue[id]) queue.push({ t: 'dlg', id: id }); }
  function queueNote(id) { if (D().storyNotes[id]) queue.push({ t: 'note', id: id }); }
  function queueThought(text) {
    queue.push({ t: 'dlg', id: null, ad: { start: 'a', nodes: { a: { lines: [{ who: 'eitan', mode: 'thought', text: text }], end: true } } } });
  }

  // ---- pickers -------------------------------------------------------------------------------------------------------
  function pick(list) {
    for (var i = 0; list && i < list.length; i++) {
      var e = list[i];
      if (S.played[e.dialogue] && !e.repeat) continue;
      if (reqOk(e.req)) return e;
    }
    return null;
  }
  function talk(list) { var e = pick(list); if (e) queueDialogue(e.dialogue); }
  function radioPending() { return !!pick(D().storyRadio.queue); }
  function useRadio() {
    var e = pick(D().storyRadio.queue);
    if (e) { queueDialogue(e.dialogue); return; }
    var idle = D().storyRadio.idle;
    queueThought(idle[Math.floor(host.rand() * idle.length)]);
  }

  // ---- what to show next -----------------------------------------------------------------------------------------
  var env = {
    reqOk: function (r) { return reqOk(r); }, run: function (l) { run(l); },
    seen: function (k) { return !!S.played[k]; }, mark: function (k) { S.played[k] = true; },
    finish: function (id) { if (id) { S.played[id] = true; emit('dialogue_end', { id: id }); } }
  };

  function markRead(id) {
    var n = D().storyNotes[id];
    S.read[id] = true;
    (n.sets || []).forEach(function (f) { setFlag(f); });
    emit('note_read', { id: id });
  }

  // Called when no story window is open and no fade runs. Returns { t: 'dlg', session } | { t: 'note', id, note } | null.
  function pump() {
    while (queue.length) {
      var q = queue.shift();
      if (q.t === 'door') { host.door(q.to); return null; }
      if (q.t === 'dlg') {
        var d = q.ad || D().storyDialogue[q.id];
        if (!d) continue;
        var s = G.dialogue.open(d, q.id, env);
        if (s.done) continue;
        return { t: 'dlg', session: s };
      }
      if (q.t === 'note') {
        var note = D().storyNotes[q.id];
        if (!note) continue;
        markRead(q.id);
        return { t: 'note', id: q.id, note: note };
      }
    }
    return null;
  }

  // ---- story objects (spots) -------------------------------------------------------------------------------------
  // data/story-wire.js says where each one stands: { area?, x, y, r?, art }. A spot with no placement does not exist yet.
  function onceOf(s) { return s.once === undefined ? s.kind !== 'npc' : s.once; }

  function spotsIn(area) {
    if (spotCache[area]) return spotCache[area];
    var out = [], P = D().storyPlace || {}, id, s;
    for (id in P) {
      s = D().storySpots[id];
      if (!s || (P[id].area || s.area) !== area) continue;
      out.push({ id: id, s: s, p: P[id], x: P[id].x, y: P[id].y, r: P[id].r || (s.kind === 'listen' ? s.r || 160 : 64) });
    }
    return (spotCache[area] = out);
  }

  // 'ok' | 'deny' | null (not there right now)
  function spotState(e) {
    if (S.spotsUsed[e.id] && onceOf(e.s)) return null;
    if (reqOk(e.s.req)) return 'ok';
    return e.s.deny ? 'deny' : null;
  }

  function dist(ax, ay, bx, by) { return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by)); }

  // Spots drawn / usable in this area right now: [{ id, s, p, x, y, r, state }].
  function visibleSpots(area) {
    var out = [], l = spotsIn(area), i, st;
    for (i = 0; i < l.length; i++) { st = spotState(l[i]); if (st) { l[i].state = st; out.push(l[i]); } }
    return out;
  }

  // The nearest spot the player can press E at (not the "listen" ones, which have no key).
  function nearSpot(area, p) {
    var l = visibleSpots(area), best = null, bd = Infinity, i, d;
    for (i = 0; i < l.length; i++) {
      if (l[i].s.kind === 'listen') continue;
      d = dist(p.x, p.y, l[i].x, l[i].y);
      if (d <= l[i].r + (p.radius || 0) && d < bd) { best = l[i]; bd = d; }
    }
    return best;
  }

  function spotPrompt(e) {
    var s = e.s, label = s.label || '';
    if (e.state === 'deny') return 'E · ' + label;
    if (s.kind === 'hold' || s.kind === 'relay') return 'E (החזקה) · ' + label;
    return 'E · ' + label;
  }

  // The player used the spot (pressed E / finished holding / stood still long enough).
  function activate(e) {
    if (e.state === 'deny') { host.toast(e.s.deny, 2600); return; }
    S.spotsUsed[e.id] = true;
    run(e.s.on || []);
    emit('spot', { id: e.id });
    if (e.s.kind === 'relay') emit('relay_built', { id: e.id });
    host.used && host.used(e);
  }

  // Held E on a hold / relay spot: progress is kept between holds. Returns 0..1 (1 = just finished). A relay is loud and
  // calls a wave once half way through (host.spawn / host.noise do the work).
  function holdSpot(e, dt) {
    if (e.state === 'deny') return 0;
    var need = e.s.hold || 2, t = (holdProg[e.id] || 0) + dt;
    holdProg[e.id] = t;
    if (e.s.kind === 'relay') {
      holdNoise[e.id] = (holdNoise[e.id] || 0) + dt;
      if (holdNoise[e.id] >= 0.5) { holdNoise[e.id] = 0; host.noise(e.s.noise || 800, e); }
      if (t >= need * 0.5 && !waved[e.id] && e.s.wave) { waved[e.id] = true; host.spawn({ wave: e.s.wave, near: e.id, x: e.x, y: e.y }); }
    }
    if (t >= need) { holdProg[e.id] = 0; activate(e); return 1; }
    return t / need;
  }

  // "Listen" spots: stand still inside the circle for `hold` seconds, no key.
  function listenStep(area, p, dt) {
    var l = visibleSpots(area), i, e, d;
    for (i = 0; i < l.length; i++) {
      e = l[i];
      if (e.s.kind !== 'listen') continue;
      d = dist(p.x, p.y, e.x, e.y);
      if (d > e.r || p.moving) { listenProg[e.id] = 0; continue; }
      listenProg[e.id] = (listenProg[e.id] || 0) + dt;
      if (listenProg[e.id] >= (e.s.hold || 2)) { listenProg[e.id] = 0; activate(e); }
    }
  }

  // ---- poll: things only the state can tell (bag, buildings, items owed) --------------------------------------------
  function poll() {
    if (!S) return;
    var b = host.buildings() || {}, k;
    if (lastBuild) for (k in b) if ((b[k] || 0) > (lastBuild[k] || 0)) emit('build', { building: k, level: b[k] });
    lastBuild = {}; for (k in b) lastBuild[k] = b[k];
    if (S.owed.length) {
      var rest = [];
      S.owed.forEach(function (o) {
        var added = host.give(o.item, o.n, null);
        if (added < o.n) rest.push({ item: o.item, n: o.n - added }); else emit('item_gain', { item: o.item, n: o.n, src: 'give' });
      });
      S.owed = rest;
    }
    if (!busy) { busy = true; try { while (checkQuests()) { while (evq.length) onEvent(evq.shift()); } } finally { busy = false; } }
  }

  // ---- journal -----------------------------------------------------------------------------------------------------
  function stepView(q, qs, upTo) {
    var out = [], i, st;
    for (i = 0; i <= upTo && i < q.steps.length; i++) {
      st = q.steps[i];
      out.push({ id: st.id, text: st.text || '', done: !!qs.done[st.id], optional: !!st.optional, current: i === upTo && !qs.done[st.id] });
    }
    return out;
  }

  function questView(id) {
    var q = questDef(id), qs = S.quests[id], cur = currentStep(q, qs);
    return { id: id, title: q.title, kind: q.kind, chapter: q.chapter, summary: q.summary, done: qs.status === 'done',
      steps: stepView(q, qs, cur < 0 ? q.steps.length - 1 : cur), hint: cur >= 0 ? (D().storyHints || {})[id + '.' + q.steps[cur].id] || '' : '' };
  }

  function journal() {
    var main = null, sides = [], doneSides = [], id, q, qs;
    for (id in S.quests) {
      q = questDef(id); qs = S.quests[id];
      if (!q || q.hidden) continue;
      if (q.kind === 'main') { if (qs.status === 'active') main = questView(id); }
      else (qs.status === 'active' ? sides : doneSides).push(questView(id));
    }
    var series = {}, order = [], notes = D().storyNotes;
    Object.keys(S.read).forEach(function (nid) {
      var n = notes[nid]; if (!n) return;
      var key = n.series || (n.kind === 'audio' ? 'tapes' : 'misc');
      if (!series[key]) { series[key] = []; order.push(key); }
      series[key].push({ id: nid, title: n.title, kind: n.kind });
    });
    return { main: main, sides: sides, doneSides: doneSides, series: series, seriesOrder: order };
  }

  // ---- state, save ---------------------------------------------------------------------------------------------------
  function okKey(k) { return typeof k === 'string' && k.length > 0 && k.length <= MAX_ID && k !== '__proto__' && /^[A-Za-z0-9_.|:-]+$/.test(k); }

  // Raw saved story state -> a safe, complete one. Unknown flags / quests / notes / spots / areas are dropped.
  function sanitize(raw) {
    var d = create(), r = raw && typeof raw === 'object' ? raw : {}, k, i, v;
    var flagsOk = D().storyFlags || {};
    function flagOk(f) { return okKey(f) && flagsOk[f] !== undefined; }
    for (k in r.flags || {}) {
      if (!Object.prototype.hasOwnProperty.call(r.flags, k) || !flagOk(k)) continue;
      v = r.flags[k];
      d.flags[k] = typeof v === 'number' && isFinite(v) ? v : (typeof v === 'string' ? v.slice(0, 40) : true);
    }
    for (k in r.quests || {}) {
      var q = D().storyQuests[k], rq = r.quests[k];
      if (!q || !Object.prototype.hasOwnProperty.call(r.quests, k) || !rq || typeof rq !== 'object') continue;
      var qs = { status: rq.status === 'done' ? 'done' : 'active', counters: {}, done: {} };
      q.steps.forEach(function (st) {
        if (rq.done && rq.done[st.id]) qs.done[st.id] = true;
        var c = rq.counters && rq.counters[st.id];
        if (typeof c === 'number' && isFinite(c) && c > 0) qs.counters[st.id] = Math.min(Math.floor(c), 1e6);
      });
      d.quests[k] = qs;
    }
    function keep(dst, src, known) {
      for (var key in src || {}) if (Object.prototype.hasOwnProperty.call(src, key) && src[key] && (known ? known[key] !== undefined : okKey(key))) dst[key] = true;
    }
    var dl = D().storyDialogue;
    for (k in r.played || {}) {            // a dialogue id, or "dialogue|node|choice" for a once-only choice
      if (Object.prototype.hasOwnProperty.call(r.played, k) && r.played[k] && (dl[k] || (okKey(k) && dl[k.split('|')[0]]))) d.played[k] = true;
    }
    keep(d.read, r.read, D().storyNotes); keep(d.spotsUsed, r.spotsUsed, D().storySpots);
    for (k in r.fired || {}) if (Object.prototype.hasOwnProperty.call(r.fired, k) && r.fired[k] && (D().storyTriggers || []).some(function (t) { return t.id === k; })) d.fired[k] = true;
    for (k in r.events || {}) if (Object.prototype.hasOwnProperty.call(r.events, k) && okKey(k) && typeof r.events[k] === 'number' && isFinite(r.events[k])) d.events[k] = Math.max(0, Math.min(Math.floor(r.events[k]), 1e6));
    for (k in r.visited || {}) if (Object.prototype.hasOwnProperty.call(r.visited, k) && r.visited[k] && D().areas[k]) d.visited[k] = true;
    d.unlocked = [];
    (Array.isArray(r.unlocked) ? r.unlocked : ['forest']).forEach(function (a) { if (D().world.destinations[a] && d.unlocked.indexOf(a) < 0) d.unlocked.push(a); });
    if (d.unlocked.indexOf('forest') < 0) d.unlocked.unshift('forest');
    d.chapter = typeof r.chapter === 'number' && isFinite(r.chapter) ? Math.max(0, Math.min(Math.floor(r.chapter), 9)) : 0;
    d.weather = r.weather === 'storm' ? 'storm' : 'clear';
    for (i = 0; Array.isArray(r.owed) && i < r.owed.length && i < 40; i++) {
      var o = r.owed[i];
      if (o && D().items[o.item] && typeof o.n === 'number' && o.n >= 1) d.owed.push({ item: o.item, n: Math.min(Math.floor(o.n), 999) });
    }
    d.begun = !!r.begun;
    return d;
  }

  // A save from before the story existed: nothing is locked, and the story starts quietly (no intro).
  function legacyState() {
    var d = create();
    d.unlocked = (D().world.order || []).slice();
    d.played.dlg_intro = true;
    return d;
  }

  function reset() {
    S = create(); evq = []; queue = []; holdProg = {}; listenProg = {}; holdNoise = {}; waved = {};
    lastBuild = null; quiet = false; suppressDlg = false; tripNo = 0; visitFired = {};
  }

  // Starts the story of a (new or old) save: fires the new_game triggers once. legacy: no dialogue pops up, quiet toasts.
  function begin(legacy) {
    if (!S) reset();
    if (S.begun) return;
    S.begun = true;
    quiet = true; suppressDlg = !!legacy;
    try { emit('new_game'); } finally { quiet = false; suppressDlg = false; }
    if (!legacy) queueDialogue('dlg_intro');
    lastBuild = null;
  }

  function install() {          // story items / recipes join the game's (idempotent)
    var d = D(), k;
    if (d.storyItems) for (k in d.storyItems) if (!d.items[k]) d.items[k] = d.storyItems[k];
    if (d.storyRecipes) d.storyRecipes.forEach(function (r) { if (!d.recipes.some(function (x) { return x.id === r.id; })) d.recipes.push(r); });
  }

  G.story = {
    install: install, create: create, reset: reset, begin: begin, sanitize: sanitize, legacyState: legacyState,
    setHost: function (h) { for (var k in h) host[k] = h[k]; },
    get S() { return S; }, set S(v) { S = v; },
    snapshot: function () { return S ? JSON.parse(JSON.stringify(S)) : null; },
    load: function (raw) { reset(); S = raw; S.begun = true; },
    emit: emit, poll: poll, pump: pump, run: run, reqOk: reqOk, setFlag: setFlag, startQuest: startQuest,
    hasFlag: function (f) { return !!(S && S.flags[f]); },
    hasPending: function () { return queue.length > 0; },
    newTrip: function () { tripNo++; holdProg = {}; listenProg = {}; holdNoise = {}; waved = {}; },
    isUnlocked: function (id) { return !S || S.unlocked.indexOf(id) >= 0; },
    unlock: unlock,
    chapter: function () { return S ? S.chapter : 0; },
    weather: function () { return S ? S.weather : 'clear'; },
    // spots
    visibleSpots: visibleSpots, nearSpot: nearSpot, spotPrompt: spotPrompt, activate: activate, holdSpot: holdSpot, listenStep: listenStep,
    holdProgress: function (id) { return holdProg[id] || 0; },
    radioPending: radioPending,
    journal: journal,
    noteView: function (id) { return D().storyNotes[id]; },
    readNote: function (id) { if (D().storyNotes[id]) queueNote(id); },
    // testing / debugging helpers
    queueDialogue: queueDialogue, queueSize: function () { return queue.length; }, resetSpotCache: function () { spotCache = {}; },
    currentStep: function (id) { var q = questDef(id), qs = S.quests[id]; return q && qs ? currentStep(q, qs) : -1; }
  };

  install();
})(typeof window !== 'undefined' ? window : globalThis);
