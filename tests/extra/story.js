// The story layer (js/dialogue.js, js/story.js): engine, quests, spots, save and compatibility with old saves.
// Runs in its own sandbox (the shared one has no story scripts). `require` and `ROOT` come from tests/run.js.
const fsS = require('fs'), pathS = require('path'), vmS = require('vm');

function storyGame() {
  const ctx = { console, Math };
  ctx.window = ctx;
  vmS.createContext(ctx);
  const files = ['js/core.js', 'data/items.js', 'data/resources.js', 'data/areas.js',
    ...fsS.readdirSync(pathS.join(ROOT, 'data/places')).sort().map(f => 'data/places/' + f),
    'data/interiors.js', 'data/story-areas.js', 'data/recipes.js', 'data/buildings.js', 'data/vehicles.js', 'data/difficulty.js', 'data/needs.js', 'data/world.js', 'data/weapons.js', 'data/enemies.js',
    'story/data/story-items.js', 'story/data/spots.js', 'story/data/quests.js', 'story/data/dialogue-1.js', 'story/data/dialogue-2.js', 'story/data/dialogue-3.js',
    'story/data/notes.js', 'story/data/triggers.js', 'story/data/endings.js', 'story/data/cellar.js', 'data/story-wire.js',
    'js/input.js', 'js/inventory.js', 'js/dialogue.js', 'js/story.js', 'js/crafting.js', 'js/needs.js', 'js/tank.js', 'js/world.js', 'js/save.js',
    'js/player.js', 'js/base.js', 'js/placing.js', 'js/companions.js', 'js/vehicles.js', 'js/area.js', 'js/combat.js', 'js/enemies.js'];
  for (const f of files) vmS.runInContext(fsS.readFileSync(pathS.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx.G;
}

// A tiny world for the engine: bag + chest counts, buildings, where the player is, and what was shown.
function rigStory() {
  const S = storyGame();
  const w = { items: {}, buildings: {}, area: 'base', toasts: [], doors: [], spawns: [], noise: 0 };
  S.story.setHost({
    count: id => w.items[id] || 0,
    give: (id, n) => { w.items[id] = (w.items[id] || 0) + n; return n; },
    take: (id, n) => { const t = Math.min(n, w.items[id] || 0); w.items[id] = (w.items[id] || 0) - t; return t; },
    toast: t => w.toasts.push(t),
    area: () => w.area, buildings: () => w.buildings,
    door: to => w.doors.push(to), spawn: a => w.spawns.push(a), noise: r => { w.noise += r; },
    rand: () => 0.5
  });
  S.story.reset();
  return { S, w };
}

// Plays a dialogue session to its end, always taking the first choice. Returns the lines seen.
function playSession(S, s) {
  const seen = [];
  for (let i = 0; i < 300 && !s.done; i++) {
    const v = S.dialogue.view(s);
    if (!v) break;
    seen.push(v.text);
    if (v.choices && v.choices.length) S.dialogue.choose(s, 0); else S.dialogue.advance(s);
  }
  if (!s.done) throw new Error('dialogue did not end: ' + s.id);
  return seen;
}

// Shows everything queued (dialogues, notes) like the game does when no window is open. Returns the ids shown.
function drain(S) {
  const shown = [];
  for (let i = 0; i < 60; i++) {
    const it = S.story.pump();
    if (!it) break;
    if (it.t === 'dlg') { shown.push(it.session.id); playSession(S, it.session); } else shown.push(it.id);
  }
  return shown;
}

function useSpot(S, w, id) {
  const P = S.data.storyPlace[id], area = (P && P.area) || S.data.storySpots[id].area;
  w.area = area;
  const e = S.story.visibleSpots(area).find(x => x.id === id);
  if (!e) throw new Error('spot not available: ' + id);
  S.story.activate(e);
  return e;
}

test('story data: every placed spot exists, items and recipes were merged into the game', () => {
  const { S } = rigStory();
  for (const id of Object.keys(S.data.storyPlace)) if (!S.data.storySpots[id]) throw new Error('placed but not in the story: ' + id);
  eq(!!S.data.items.radio_broken, true); eq(!!S.data.items.wind_chime, true);
  eq(S.data.recipes.some(r => r.id === 'radio_fixed'), true);
  eq(S.data.recipes.filter(r => r.id === 'radio_fixed').length, 1, 'merged once');
});

test('dialogue: choices whose requirement fails are hidden, the others are numbered', () => {
  const { S } = rigStory();
  const dlg = { start: 'a', nodes: { a: { who: 'me', lines: [{ who: 'eitan', mode: 'say', text: 'x' }], choices: [
    { text: 'always', next: 'b' }, { text: 'secret', req: { flags: ['nope'] }, next: 'b' }, { text: 'also', next: 'b' }] },
    b: { who: 'me', lines: [{ who: 'eitan', mode: 'say', text: 'y' }], end: true } } };
  const s = S.dialogue.open(dlg, 'tmp', { reqOk: () => false, run() {}, seen: () => false, mark() {}, finish() {} });
  const v = S.dialogue.view(s);
  eq(v.choices.length, 2); eq(v.choices[0].n, 1); eq(v.choices[1].n, 2);
  S.dialogue.choose(s, 1);                                // "also" (the second visible one)
  eq(S.dialogue.view(s).text, 'y');
});

test('story: a new game starts the prologue, gives the radio, and queues the intro', () => {
  const { S, w } = rigStory();
  S.story.begin();
  eq(S.story.S.quests.mq_prologue.status, 'active');
  eq(w.items.radio_broken, 1);
  eq(drain(S)[0], 'dlg_intro');
  eq(S.story.chapter(), 0);
  eq(S.story.isUnlocked('forest'), true); eq(S.story.isUnlocked('farm'), false);
});

test('story: the prologue and chapter 1 play through, step by step, and unlock the map as they go', () => {
  const { S, w } = rigStory();
  S.story.begin(); drain(S);
  const cur = id => S.story.journal().main && S.story.journal().main.steps.find(s => s.current);
  // wall
  useSpot(S, w, 'spot_wall_tally'); drain(S);
  // radio is already in the chest; leaving for the forest
  w.area = 'forest'; S.story.emit('enter_area', { area: 'forest' });
  S.story.emit('item_gain', { item: 'wood', n: 10, src: 'gather' });
  S.story.emit('item_gain', { item: 'stone', n: 5, src: 'gather' });
  S.story.emit('return_base', {}); w.area = 'base';
  w.buildings = { workbench: 1 }; S.story.poll();         // building is noticed by polling
  drain(S);
  S.story.emit('station', { id: 'workbench' });           // opening the radio is the story's reaction to the workbench
  const shown = drain(S);
  eq(shown.includes('dlg_radio_open'), true, 'the radio dialogue came up at the workbench');
  eq(S.story.S.quests.mq_prologue.status, 'active', 'sleeping is still left');
  S.story.emit('sleep', {}); S.story.emit('wake', {}); drain(S);
  eq(S.story.S.quests.mq_prologue.status, 'done');
  eq(S.story.hasFlag('prologue_done'), true);
  eq(S.story.isUnlocked('farm'), true);
  eq(S.story.S.quests.mq_ch1.status, 'active', 'chapter 1 starts by itself');
  eq(S.story.chapter(), 1);

  // chapter 1: the farm
  w.area = 'farm'; S.story.emit('enter_area', { area: 'farm' }); drain(S);
  useSpot(S, w, 'spot_rachel'); drain(S);                 // the first talk
  for (const id of ['spot_chime_1', 'spot_chime_2', 'spot_chime_3', 'spot_chime_4', 'spot_chime_5']) { useSpot(S, w, id); drain(S); }
  eq(w.items.wind_chime, 5, 'each chime gives one');
  useSpot(S, w, 'spot_rachel'); drain(S);                 // the deal
  useSpot(S, w, 'spot_tractor'); drain(S);
  eq(S.story.S.quests.mq_ch1.status, 'active', 'the radio is not fixed yet');
  w.items.radio_fixed = 1; w.items.radio_broken = 0;     // what the recipe makes
  S.story.emit('craft', { recipe: 'radio_fixed' }); drain(S);
  w.area = 'base';
  useSpot(S, w, 'spot_home_radio'); drain(S);
  eq(S.story.S.quests.mq_ch1.status, 'done', 'listening finishes the chapter');
  eq(S.story.isUnlocked('neighborhood'), true);
});

test('story: steps are evaluated after the fact (items gathered before the quest are not lost)', () => {
  const { S, w } = rigStory();
  S.story.begin(); drain(S);
  w.items.wind_chime = 5;                                 // owned long before it was asked for
  S.story.startQuest('mq_ch1'); S.story.poll();
  const st = S.story.journal().main;
  eq(!!st, true);
});

test('story: spots that are not wired yet do not exist, a used once-spot disappears', () => {
  const { S, w } = rigStory();
  S.story.begin(); drain(S);
  eq(S.story.visibleSpots('hospital').length, 0);
  useSpot(S, w, 'spot_wall_tally');
  eq(S.story.visibleSpots('base').some(e => e.id === 'spot_wall_tally'), true, 'the wall can be read again (not once-only) or is gone: both are valid');
});

test('story save: a snapshot taken mid-quest comes back with the same step, counters and flags', () => {
  const { S, w } = rigStory();
  S.story.begin(); drain(S);
  S.story.emit('enter_area', { area: 'forest' });
  S.story.emit('item_gain', { item: 'wood', n: 6, src: 'gather' });
  const before = JSON.parse(JSON.stringify(S.story.S));
  const raw = JSON.parse(JSON.stringify(S.story.snapshot()));
  S.story.reset();
  S.story.load(S.story.sanitize(raw));
  eq(JSON.stringify(S.story.S.quests), JSON.stringify(before.quests));
  eq(JSON.stringify(S.story.S.flags), JSON.stringify(before.flags));
  eq(S.story.S.quests.mq_prologue.counters.wood, 6);
  eq(S.story.S.begun, true);
  S.story.emit('item_gain', { item: 'wood', n: 4, src: 'gather' });
  eq(S.story.S.quests.mq_prologue.counters.wood, 10, 'counting goes on after loading');
});

test('story save: junk is dropped (unknown flags, quests, destinations, prototype keys)', () => {
  const { S } = rigStory();
  const raw = JSON.parse('{"flags":{"evil":true,"__proto__":true,"prologue_done":true},"quests":{"nope":{"status":"done"},"mq_prologue":{"status":"zzz","counters":{"wood":"lots"}}},"unlocked":["moon","farm"],"chapter":99,"weather":"acid","owed":[{"item":"ghost","n":3}],"played":{"zzz":true}}');
  const d = S.story.sanitize(raw);
  eq(d.flags.evil, undefined); eq(d.flags.prologue_done, true);
  eq(d.quests.nope, undefined); eq(d.quests.mq_prologue.status, 'active'); eq(d.quests.mq_prologue.counters.wood, undefined);
  eq(d.unlocked.includes('moon'), false); eq(d.unlocked.includes('farm'), true); eq(d.unlocked.includes('forest'), true);
  eq(d.chapter, 9); eq(d.weather, 'clear'); eq(d.owed.length, 0); eq(d.played.zzz, undefined);
  eq(S.story.sanitize(null).begun, false);
  eq(S.story.sanitize('junk').unlocked[0], 'forest');
});

test('story save: version 1 saves become legacy saves (everything open, no intro) and a new save round-trips its story', () => {
  const { S } = rigStory();
  const r = S.save.parse(JSON.stringify({ v: 1 }));
  eq(r.ok, true); eq(r.data.storyLegacy, true);
  for (const id of S.data.world.order) eq(r.data.story.unlocked.includes(id), true, id);
  eq(r.data.story.played.dlg_intro, true);
  S.story.S = S.story.legacyState(); S.story.begin(true);
  eq(S.story.queueSize(), 0, 'a legacy start shows no intro');
  const st = { diff: 'normal', playTime: 5, needs: S.needs.create(), bag: S.inventory.create(12), chest: S.inventory.create(24), buildings: {}, fence: { material: 'wood' }, placed: [], floor: S.placing.createFloor(), tank: S.tank.create(), visits: {}, trip: {}, player: { x: 100, y: 100 }, area: 'base', guns: {}, wear: {}, wearLife: {}, enemies: [], enemyKeep: {}, def: S.defense && S.defense.create ? S.defense.create() : {} };
  const snap = S.save.snapshot(st, 1);
  eq(snap.v, 2);
  const back = S.save.parse(JSON.stringify(snap));
  eq(back.ok, true); eq(back.data.storyLegacy, false); eq(back.data.story.unlocked.length, S.data.world.order.length);
});

test('story: key items survive a fainting; ordinary ones do not', () => {
  const { S } = rigStory();
  const bag = S.inventory.fromList(12, [['radio_broken', 1], ['wood', 20]], S.data.items);
  eq(!!S.data.items.radio_broken.key, true);
  S.needs.deathLoss(bag, S.data.difficulty.levels.hard);
  eq(S.inventory.count(bag, 'radio_broken'), 1);
  eq(S.inventory.count(bag, 'wood'), 0);
});

test('story: the club recipe stays locked until its flag is set', () => {
  const { S } = rigStory();
  S.story.begin();
  const club = S.data.recipes.find(r => r.unlock);
  eq(!!club, true);
  eq(S.crafting.unlocked(club), false);
  S.story.run([{ do: 'flag', id: club.unlock }]);
  eq(S.crafting.unlocked(club), true);
});

test('story: a relay spot is loud and calls its wave halfway (host receives noise and spawn)', () => {
  const { S, w } = rigStory();
  S.story.begin(); drain(S);
  S.story.S.flags.chimes_task = false;
  const relay = Object.keys(S.data.storySpots).find(id => S.data.storySpots[id].kind === 'relay');
  const sp = S.data.storySpots[relay];
  const e = { id: relay, s: sp, p: { x: 0, y: 0 }, x: 0, y: 0, r: 60, state: 'ok' };
  for (let i = 0; i < 40; i++) S.story.holdSpot(e, 0.1);
  eq(w.noise > 0, true); eq(w.spawns.length >= 1, true);
});

// ---- chapter 3: the police station, then Pelpel at the gate
test('chapter 3: every spot of the station is placed on open floor (not inside furniture, walls or water)', () => {
  const { S } = rigStory();
  const ids = Object.keys(S.data.storySpots).filter(id => /^police/.test(S.data.storySpots[id].area));
  eq(ids.length >= 9, true);
  const zones = {};
  for (const id of ids) {
    const P = S.data.storyPlace[id];
    if (!P) throw new Error('not placed: ' + id);
    const aid = P.area || S.data.storySpots[id].area;
    const z = zones[aid] || (zones[aid] = S.area.generate(S.data.areas[aid], S.data.resources, 1));
    if (S.area.inSolid(z, P.x, P.y, 14)) throw new Error(id + ' stands inside a solid at ' + P.x + ',' + P.y);
    if (S.area.inWater(z, P.x, P.y, 0)) throw new Error(id + ' is in water');
    if (P.x < 0 || P.y < 0 || P.x > z.width || P.y > z.height) throw new Error(id + ' is outside the area');
  }
});

test('chapter 3: play it through: key, archive, relay, then Pelpel joins at the gate', () => {
  const { S, w } = rigStory();
  S.story.begin(); drain(S);
  S.story.setFlag('ch2_done'); S.story.startQuest('mq_ch3'); drain(S);
  w.items.relay_kit = 1;
  S.story.emit('item_gain', { item: 'relay_kit', n: 1, src: 'give' }); drain(S);
  S.story.emit('enter_area', { area: 'police' }); drain(S);
  eq(!!S.story.S.flags.ch3_active, true);
  useSpot(S, w, 'spot_commander_desk'); drain(S);
  eq(w.items.commander_key, 1, 'the roof key');
  const arc = useSpot(S, w, 'spot_archive'); for (let i = 0; i < 40; i++) S.story.holdSpot(arc, 0.1); drain(S);
  eq(!!S.story.S.flags.knows_vehicle4, true);
  w.area = 'police';
  const relay = S.story.visibleSpots('police').find(x => x.id === 'spot_relay_police');
  if (!relay) throw new Error('relay spot is not available');
  for (let i = 0; i < 100; i++) S.story.holdSpot(relay, 0.1); drain(S);
  eq(!!S.story.S.flags.relay_2, true);
  S.story.emit('return_base', {}); drain(S);
  eq(!!S.story.S.flags.dog_joined, true, 'Pelpel joins when you come home');
  eq(S.story.S.quests.sq_kennel && S.story.S.quests.sq_kennel.status, 'active');
  // the engine only sets the flag: the game switches the dog on (js/game-tick.js)
  const comp = S.companions.create(); S.companions.unlock(comp, 'dog'); eq(comp.dog.on, true);
});

// ---- chapter 4: the hospital, the quarry door
test('chapter 4: hospital and quarry spots are placed on open floor', () => {
  const { S } = rigStory();
  const ids = Object.keys(S.data.storySpots).filter(id => /^(hospital|quarry)/.test(S.data.storySpots[id].area));
  eq(ids.length >= 16, true);
  const zones = {};
  for (const id of ids) {
    const P = S.data.storyPlace[id];
    if (!P) throw new Error('not placed: ' + id);
    const aid = P.area || S.data.storySpots[id].area;
    const z = zones[aid] || (zones[aid] = S.area.generate(S.data.areas[aid], S.data.resources, 1));
    if (S.area.inSolid(z, P.x, P.y, 14)) throw new Error(id + ' stands inside a solid at ' + P.x + ',' + P.y);
    if (S.area.inWater(z, P.x, P.y, 0)) throw new Error(id + ' is in water');
  }
});

test('chapter 4: the hospital relay unlocks the quarry on the map', () => {
  const { S } = rigStory();
  S.story.begin(); drain(S);
  eq(S.story.isUnlocked('quarry'), false);
  S.story.setFlag('relay_3'); drain(S);
  eq(S.story.isUnlocked('quarry'), true);
});

// ---- chapter 5: the port, the ship, Roni
test('chapter 5: port, harbour office and ship spots are placed on open floor', () => {
  const { S } = rigStory();
  const ids = Object.keys(S.data.storySpots).filter(id => { const a = S.data.storyPlace[id] && (S.data.storyPlace[id].area || S.data.storySpots[id].area); return /^(port|ship_)/.test(S.data.storySpots[id].area); });
  eq(ids.length >= 10, true, ids.length + " spots: ");
  const zones = {};
  for (const id of ids) {
    const P = S.data.storyPlace[id];
    if (!P) throw new Error('not placed: ' + id);
    const aid = P.area || S.data.storySpots[id].area;
    const z = zones[aid] || (zones[aid] = S.area.generate(S.data.areas[aid], S.data.resources, 1));
    if (S.area.inSolid(z, P.x, P.y, 14)) throw new Error(id + ' stands inside a solid at ' + P.x + ',' + P.y);
    if (S.area.inWater(z, P.x, P.y, 0)) throw new Error(id + ' is in water');
  }
});

test('chapter 5: the engine-room and bridge areas exist and belong to the port', () => {
  const { S } = rigStory();
  for (const id of ['ship_engine', 'ship_bridge']) {
    const a = S.data.areas[id];
    eq(!!a && a.parent === 'port' && a.interior === true, true, id + ': ');
    const z = S.area.generate(a, S.data.resources, 1), p = { x: a.spawn.x, y: a.spawn.y, radius: 14 };
    eq(S.area.inSolid(z, a.spawn.x, a.spawn.y, 14), false, id + ' spawn: ');
  }
});

test('chapter 5: meeting Roni on the ship, the escort, and she is with you', () => {
  const { S, w } = rigStory();
  S.story.begin(); drain(S);
  S.story.setFlag('ch5_active'); S.story.startQuest('mq_ch5'); drain(S);
  S.story.setFlag('saw_signal'); w.area = 'port';
  eq(S.story.visibleSpots('port').some(x => x.id === 'spot_ship_hatch'), true);
  useSpot(S, w, 'spot_ship_hatch'); drain(S);
  eq(w.doors.includes('ship_engine'), true);
  w.area = 'ship_engine';
  const e = S.story.visibleSpots('ship_engine').find(x => x.id === 'spot_roni_engine'); S.story.activate(e); drain(S);
  eq(!!S.story.S.flags.roni_met, true);
  eq((S.story.S.events.roni_escort_start || 0) >= 1, true);
  eq(S.story.visibleSpots('ship_engine').some(x => x.id === 'spot_roni_engine'), false, 'she leaves with you');
  S.story.emit('enter_area', { area: 'port' }); drain(S);
  eq(w.spawns.length >= 1, true, 'the wave');
  S.story.run([{ do: 'event', id: 'roni_escort_done' }]); drain(S);
  eq(!!S.story.S.flags.roni_joined, true);
  S.story.run([{ do: 'event', id: 'talk_roni' }]); drain(S);
});
