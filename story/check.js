// Consistency check for the story layer. Run: node story/check.js
// Loads the game's data/items.js + data/world.js and every story/data/*.js file in a sandbox, then checks that every
// reference (dialogue, note, item, quest, spot, area, flag, dialogue node) points at something that exists.
// Prints counts at the end. Exit code 1 on errors (warnings do not fail).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const sandbox = { console, G: { data: {} } };
sandbox.window = sandbox;
vm.createContext(sandbox);
function load(file) { vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file }); }

for (const f of ['data/items.js', 'data/world.js']) {
  try { load(path.join(ROOT, f)); } catch (e) { console.warn('warn: could not load ' + f + ': ' + e.message); }
}
const order = ['story-items.js', 'spots.js', 'quests.js', 'dialogue-1.js', 'dialogue-2.js', 'notes.js', 'triggers.js', 'endings.js', 'cellar.js'];
for (const f of order) load(path.join(__dirname, 'data', f));

const G = sandbox.G, D = G.data;
const errors = [], warns = [];
const err = (m) => errors.push(m), warn = (m) => warns.push(m);

const items = Object.assign({}, D.items || {}, D.storyItems);
const dlg = D.storyDialogue, notes = D.storyNotes, quests = D.storyQuests, spots = D.storySpots;
const areas = new Set(['base'].concat(Object.keys((D.world && D.world.destinations) || {}),
  Object.keys(D.storyNewAreas), ['police_f1', 'police_f2', 'hospital_f1', 'hospital_f2', 'hospital_f3']));
const flagsKnown = new Set(Object.keys(D.storyFlags));
const flagsUsed = new Set(), flagsSet = new Set();
const recipes = new Set((D.storyRecipes || []).map(r => r.id));
const storyEvents = new Set();

function chkItem(id, where) { if (!items[id]) err(`${where}: unknown item "${id}"`); }
function chkArea(id, where) { if (!areas.has(id)) err(`${where}: unknown area "${id}"`); }
function chkFlagUse(id, where) { flagsUsed.add(id); if (!flagsKnown.has(id)) warn(`${where}: flag "${id}" not in storyFlags`); }
function chkReq(r, where) {
  if (!r) return;
  (r.flags || []).forEach(f => chkFlagUse(f, where));
  (r.notFlags || []).forEach(f => chkFlagUse(f, where));
  Object.keys(r.items || {}).forEach(i => chkItem(i, where));
  Object.keys(r.notItems || {}).forEach(i => chkItem(i, where));
  if (r.quest && !quests[r.quest]) err(`${where}: unknown quest "${r.quest}"`);
  if (r.questDone && !quests[r.questDone]) err(`${where}: unknown quest "${r.questDone}"`);
  if (r.area) chkArea(r.area, where);
}
function chkActions(list, where) {
  (list || []).forEach((a, i) => {
    const w = `${where} action ${i} (${a.do})`;
    switch (a.do) {
      case 'dialogue': if (!dlg[a.id]) err(`${w}: unknown dialogue "${a.id}"`); break;
      case 'note': if (!notes[a.id]) err(`${w}: unknown note "${a.id}"`); break;
      case 'give': case 'take': chkItem(a.item, w); if (!(a.n > 0)) err(`${w}: bad n`); break;
      case 'flag': flagsSet.add(a.id); if (!flagsKnown.has(a.id)) warn(`${w}: flag "${a.id}" not in storyFlags`); break;
      case 'quest': if (!quests[a.id]) err(`${w}: unknown quest "${a.id}"`); break;
      case 'unlock': chkArea(a.area, w); break;
      case 'door': chkArea(a.to, w); break;
      case 'event': storyEvents.add(a.id); break;
      case 'spawn': if (a.near !== 'player' && a.near !== 'edges' && !spots[a.near]) err(`${w}: spawn near unknown spot "${a.near}"`); break;
      case 'toast': case 'weather': case 'radio': break;
      default: err(`${w}: unknown action`);
    }
  });
}

// items / recipes
for (const r of D.storyRecipes) {
  chkItem(r.out[0], `recipe ${r.id}`);
  Object.keys(r.cost).forEach(i => chkItem(i, `recipe ${r.id}`));
  if (r.unlock) chkFlagUse(r.unlock, `recipe ${r.id}`);
}

// spots
for (const [id, s] of Object.entries(spots)) {
  chkArea(s.area, `spot ${id}`);
  chkReq(s.req, `spot ${id}`);
  chkActions(s.on, `spot ${id}`);
  if (!['use', 'hold', 'relay', 'npc', 'listen'].includes(s.kind)) err(`spot ${id}: bad kind`);
}

// quests
const STEP = ['spot', 'visit', 'item', 'items', 'collect', 'craft', 'build', 'dialogue', 'flag', 'notes', 'sleep', 'event'];
for (const [id, q] of Object.entries(quests)) {
  if (q.area) chkArea(q.area, `quest ${id}`);
  chkReq(q.req, `quest ${id}`);
  chkActions(q.done, `quest ${id} done`);
  if (q.next && !quests[q.next]) err(`quest ${id}: unknown next "${q.next}"`);
  q.steps.forEach(st => {
    const w = `quest ${id} step ${st.id}`;
    if (!STEP.includes(st.type)) err(`${w}: bad type ${st.type}`);
    if (st.type === 'spot' && !spots[st.spot]) err(`${w}: unknown spot "${st.spot}"`);
    if (st.type === 'visit') chkArea(st.area, w);
    if ((st.type === 'item' || st.type === 'collect')) chkItem(st.item, w);
    if (st.type === 'items') Object.keys(st.items).forEach(i => chkItem(i, w));
    if (st.type === 'dialogue' && !dlg[st.id_]) err(`${w}: unknown dialogue "${st.id_}"`);
    if (st.type === 'notes') st.notes.forEach(n => { if (!notes[n]) err(`${w}: unknown note "${n}"`); });
    if (st.type === 'flag') chkFlagUse(st.flag, w);
    if (st.type === 'craft' && !recipes.has(st.recipe)) warn(`${w}: recipe "${st.recipe}" is not a story recipe (ok if it is in data/recipes.js)`);
    if (st.type === 'event') storyEvents.add('need:' + st.id_);
  });
}

// dialogue
let nodeCount = 0, lineCount = 0, choiceCount = 0;
for (const [id, d] of Object.entries(dlg)) {
  if (!d.nodes[d.start]) err(`dialogue ${id}: start node "${d.start}" missing`);
  for (const [nid, n] of Object.entries(d.nodes)) {
    nodeCount++;
    const w = `dialogue ${id}.${nid}`;
    (n.lines || []).forEach(l => { lineCount++; if (!D.storySpeakers[l.who]) err(`${w}: unknown speaker ${l.who}`); if (!l.text) err(`${w}: empty line`); });
    const exits = (n.next ? 1 : 0) + (n.choices ? 1 : 0) + (n.end ? 1 : 0);
    if (exits !== 1) err(`${w}: needs exactly one of next/choices/end`);
    if (n.next && !d.nodes[n.next]) err(`${w}: next "${n.next}" missing`);
    (n.choices || []).forEach(c => { choiceCount++; if (!d.nodes[c.next]) err(`${w}: choice -> "${c.next}" missing`); chkReq(c.req, w); chkActions(c.do, w); });
    chkActions(n.do, w);
  }
}

// notes
for (const [id, n] of Object.entries(notes)) {
  chkArea(n.area, `note ${id}`);
  (n.sets || []).forEach(f => { flagsSet.add(f); chkFlagUse(f, `note ${id}`); });
}

// triggers + pickers
for (const t of D.storyTriggers) { chkReq(t.when, `trigger ${t.id}`); chkActions(t.do, `trigger ${t.id}`);
  if (t.on === 'flag') chkFlagUse(t.match, `trigger ${t.id}`);
  if (t.on === 'dialogue_end' && !dlg[t.match]) err(`trigger ${t.id}: dialogue_end unknown "${t.match}"`);
  if (t.on === 'note_read' && t.match && !notes[t.match]) err(`trigger ${t.id}: unknown note "${t.match}"`);
  (t.notesAll || []).forEach(n => { if (!notes[n]) err(`trigger ${t.id}: unknown note "${n}"`); }); }
for (const p of [D.storyRadio.queue, D.storyRachel, D.storyOri, D.storyDreams]) p.forEach(e => { if (!dlg[e.dialogue]) err(`picker: unknown dialogue ${e.dialogue}`); chkReq(e.req, `picker ${e.dialogue}`); });
D.storyRadio.replay.forEach(r => { if (!dlg[r]) err(`radio replay: unknown ${r}`); });
D.storyWall.forEach(n => { if (!notes[n]) err(`wall: unknown note ${n}`); });

// endings
for (const [id, e] of Object.entries(D.storyEndings)) { chkFlagUse(id, `ending ${id}`); e.slides.concat(e.last).forEach(s => chkReq(s.req, `ending ${id}`)); }
D.storyEpilogue.forEach((s, i) => chkReq(s.req, `epilogue ${i}`));

// flags read but never set by anything
for (const f of flagsUsed) if (!flagsSet.has(f) && !/^rec_noa_/.test(f)) {
  // a few flags are set by the engine (relay_N via spots are covered; storm via dialogue) -> check by name
  warn(`flag "${f}" is read but never set by story data`);
}

// markdown docs: every id they mention must exist
const md = fs.readdirSync(__dirname).filter(f => f.endsWith('.md'));
const all = new Set([].concat(Object.keys(dlg), Object.keys(notes), Object.keys(quests), Object.keys(spots)));
for (const f of md) {
  const text = fs.readFileSync(path.join(__dirname, f), 'utf8');
  const found = text.match(/`((?:dlg|rec|note|spot|sq|mq)_[a-z0-9_]+)`/g) || [];
  for (const raw of found) {
    const id = raw.slice(1, -1);
    if (/_\d+\.\.\d+$/.test(id) || id.endsWith('_')) continue;   // ranges like note_sigal_1..5
    if (!all.has(id)) warn(`${f}: mentions "${id}" which does not exist`);
  }
}

// report
const q = Object.values(quests);
console.log(`quests: ${q.filter(x => x.kind === 'main').length} main, ${q.filter(x => x.kind === 'side').length} side, ${q.reduce((a, x) => a + x.steps.length, 0)} steps`);
console.log(`dialogues: ${Object.keys(dlg).length} (${nodeCount} nodes, ${lineCount} lines, ${choiceCount} choices)`);
console.log(`notes: ${Object.keys(notes).length} · spots: ${Object.keys(spots).length} · triggers: ${D.storyTriggers.length} · story items: ${Object.keys(D.storyItems).length} · recipes: ${D.storyRecipes.length}`);
console.log(`endings: ${Object.keys(D.storyEndings).length} + ${D.storyEpilogue.length} epilogue slides · flags: ${flagsKnown.size} · new areas: ${Object.keys(D.storyNewAreas).length}`);
warns.forEach(w => console.log('warn: ' + w));
errors.forEach(e => console.log('ERROR: ' + e));
console.log(errors.length ? `${errors.length} errors` : 'OK: no errors');
process.exit(errors.length ? 1 : 0);
