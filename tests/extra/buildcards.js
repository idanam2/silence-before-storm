// The build board (B): every building has an emoji and a one-line text for its card.
// One-only buildings (bed, garages) and the extra storage boxes.
console.log('build cards');
test('every building in the build order has a card (emoji + short text, shorter than the long description)', () => {
  const C = G.data.buildingCards;
  for (const id of G.data.buildingOrder) {
    const c = C[id];
    if (!c || !c.icon || !c.blurb) throw new Error(id + ' has no card');
    if (c.blurb.length > 40) throw new Error(id + ' card text is too long for a card: ' + c.blurb.length);
  }
});

test('bed and the four garages: one copy only (place is refused, a save with more is trimmed), the workbench still takes many', () => {
  const B = G.data.buildings;
  for (const id of ['bed', 'garage_moto', 'garage_jeep', 'garage_heli', 'garage_tank']) eq(G.placing.max(id), 1);
  eq(G.placing.max('workbench'), G.placing.MAX_EACH);
  const levels = Object.assign(G.crafting.startBuildings(), { bed: 1, workbench: 1 });
  const placed = [{ id: 'bed', x: 1780, y: 1090 }, { id: 'bed', x: 1000, y: 1000 }, { id: 'workbench', x: 1690, y: 905 }, { id: 'workbench', x: 1500, y: 905 }];
  eq(G.placing.clean(placed, levels).filter(p => p.id === 'bed').length, 1);
  eq(G.placing.clean(placed, levels).filter(p => p.id === 'workbench').length, 2);
  const ctx = { bag: G.inventory.fromList(12, [['wood', 40], ['plank', 40], ['stone', 40]]), chest: G.inventory.fromList(24, []), buildings: levels, placed: [{ id: 'bed', x: 1780, y: 1090 }] };
  eq(G.crafting.placeStatus(ctx, 'bed'), 'max');
  ctx.placed.push({ id: 'workbench', x: 1690, y: 905 }); eq(G.crafting.placeStatus(ctx, 'workbench'), null);
});

test('extra boxes: up to 4, each adds slots to the one shared storage, upgrading makes every box bigger, saves keep the size', () => {
  const B = G.data.buildings.box;
  eq(B.max, 4); eq(B.levels.length, 4); eq(B.use, 'chest');
  const lv = (box, chest) => Object.assign(G.crafting.startBuildings(), { box: box, chest: chest || 1 });
  const at = (n) => Array.from({ length: n }, (_, i) => ({ id: 'box', x: 1868, y: 790 + i * 60 }));
  eq(G.crafting.chestSlots(lv(0), []), 24);                                  // none built: the main chest only
  eq(G.crafting.chestSlots(lv(1), at(1)), 24 + B.levels[0].boxSlots);
  eq(G.crafting.chestSlots(lv(1), at(3)), 24 + 3 * B.levels[0].boxSlots);
  eq(G.crafting.chestSlots(lv(3, 4), at(4)), 60 + 4 * B.levels[2].boxSlots);   // main chest at level 4 + 4 boxes at level 3
  eq(G.crafting.chestSlots(lv(1), at(9)), 24 + 4 * B.levels[0].boxSlots);     // never counts more than max
  eq(G.crafting.chestSlots(Object.assign(G.crafting.startBuildings(), { chest: 2 })), 36);   // the old call (no `placed`) still works
  const st = mkState(); st.buildings.box = 1; st.placed = at(2); const want = G.crafting.chestSlots(st.buildings, st.placed); st.chest = G.inventory.fromList(want, [['wood', 5]]);
  const d = G.save.parse(JSON.stringify(G.save.snapshot(st, 1))).data;
  eq(d.chest.slots.length, want); eq(want, G.crafting.chestSlots(st.buildings) + 2 * B.levels[0].boxSlots); eq(G.placing.count(d.placed, 'box'), 2);
  // a box is usable with E, like the chest
  const b = G.base.build(), placed = [{ id: 'box', x: 1868, y: 790 }];
  G.base.setBuildings(b, lv(1), placed);
  eq(G.base.nearStation(G.player.create(1868 + 26, 790 + 36 + 30), b), 'box');
});
