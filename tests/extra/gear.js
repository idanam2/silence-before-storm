// Equipment (data/gear.js, js/gear.js): clothes, the two weapon slots, drag-and-drop swap, saving.
if (G.gear) {
  console.log('gear');
  const IT = G.data.items, bagOf = (list) => G.inventory.fromList(12, list || []);
  const idx = (bag, id) => bag.slots.findIndex(s => s && s.id === id);

  test('clothes data: every piece has a slot, armor, a recipe and never stacks', () => {
    for (const id of ['cap', 'helmet', 'jacket', 'vest', 'pants', 'boots']) {
      const d = IT[id];
      if (!d || !d.wear || G.data.gear.slots.indexOf(d.wear.slot) < 0 || !(d.wear.armor > 0) || d.stack !== 1) throw new Error(id);
      eq(G.data.recipes.filter(r => r.out[0] === id).length, 1, id + ' recipe');
    }
    if (!G.data.recipeCats.some(c => c.id === 'wear')) throw new Error('no clothes tab');
  });

  test('wear moves the piece out of the backpack; a second piece of the same slot trades places', () => {
    const e = G.gear.create(), bag = bagOf([['cap', 1], ['helmet', 1], ['wood', 3]]);
    eq(G.gear.wear(e, bag, idx(bag, 'wood')).ok, false);
    eq(G.gear.wear(e, bag, idx(bag, 'cap')).ok, true);
    eq(e.head, 'cap'); eq(G.inventory.count(bag, 'cap'), 0);
    const hi = idx(bag, 'helmet');
    eq(G.gear.wear(e, bag, hi).ok, true);
    eq(e.head, 'helmet'); eq(bag.slots[hi].id, 'cap');
  });

  test('takeOff needs room in the backpack and can aim at a free slot', () => {
    const e = G.gear.create(), full = G.inventory.fromList(1, [['wood', 1]]);
    e.body = 'jacket';
    eq(G.gear.takeOff(e, full, 'body', -1).reason, 'space'); eq(e.body, 'jacket');
    const bag = bagOf([['wood', 1]]);
    eq(G.gear.takeOff(e, bag, 'body', 5).ok, true);
    eq(e.body, null); eq(bag.slots[5].id, 'jacket');
    eq(G.gear.takeOff(e, bag, 'body', -1).reason, 'empty');
  });

  test('armor adds up and is capped', () => {
    const e = G.gear.create();
    eq(G.gear.armor(e), 0);
    e.head = 'helmet'; e.body = 'vest'; e.legs = 'pants'; e.feet = 'boots';
    near(G.gear.armor(e), 0.10 + 0.20 + 0.06 + 0.04, 1e-9);
    eq(G.gear.armor(e, { helmet: { wear: { slot: 'head', armor: 5 } } }), G.data.gear.cap);
  });

  test('weapon slots: a weapon is never in both, promote shifts the old primary down', () => {
    const e = G.gear.create();
    G.gear.setWeapon(e, 'primary', 'axe'); G.gear.setWeapon(e, 'secondary', 'gun');
    G.gear.setWeapon(e, 'primary', 'gun');
    eq(e.primary, 'gun'); eq(e.secondary, 'axe');
    eq(G.gear.promote(e, 'club'), true);
    eq(e.primary, 'club'); eq(e.secondary, 'axe');          // the second slot was taken: it stays
    eq(G.gear.promote(e, 'club'), false);
    eq(G.gear.promote(e, 'axe'), true); eq(e.primary, 'axe'); eq(e.secondary, 'club');
  });

  test('refresh drops weapons that left the backpack and fills empty slots', () => {
    const e = G.gear.create(), bag = bagOf([['axe', 1], ['pistol', 1]]);
    const can = (id) => G.combat.canHold(bag, id);
    eq(G.gear.refresh(e, G.data.weaponOrder, can), true);
    eq(e.primary, 'axe'); eq(e.secondary, 'gun');
    eq(G.gear.refresh(e, G.data.weaponOrder, can), false);
    G.inventory.remove(bag, 'axe', 1);
    eq(G.gear.refresh(e, G.data.weaponOrder, can), true);
    eq(e.primary, 'gun'); eq(e.secondary, null);
  });

  test('inventory.swap: trades places, merges the same item, moves into an empty slot', () => {
    const bag = G.inventory.create(12), chest = G.inventory.create(4);
    bag.slots[0] = { id: 'wood', n: 40 }; bag.slots[1] = { id: 'stone', n: 5 }; bag.slots[2] = { id: 'wood', n: 30 };
    eq(G.inventory.swap(bag, 0, bag, 1), true); eq(bag.slots[0].id, 'stone'); eq(bag.slots[1].n, 40);
    eq(G.inventory.swap(bag, 2, bag, 1), true); eq(bag.slots[1].n, 50); eq(bag.slots[2].n, 20);   // 50 is a full stack
    eq(G.inventory.swap(bag, 0, chest, 3), true); eq(bag.slots[0], null); eq(chest.slots[3].id, 'stone');
    eq(G.inventory.swap(bag, 0, bag, 4), false); eq(G.inventory.swap(bag, 1, bag, 1), false);
    eq(G.inventory.count(bag, 'wood'), 70);
  });

  test('a save keeps the equipment and cleans what it does not know', () => {
    const c = G.gear.clean({ head: 'cap', body: 'cap', legs: 'nope', feet: 'boots', primary: 'gun', secondary: 'gun', x: 1 });
    eq(c.head, 'cap'); eq(c.body, null); eq(c.legs, null); eq(c.feet, 'boots'); eq(c.primary, 'gun'); eq(c.secondary, null);
    const z = G.gear.clean(null);
    eq(z.head, null); eq(z.primary, null);
    eq(G.gear.clean({ primary: 'hands' }).primary, null);
  });
}

// Creative mode: G.crafting.free makes every cost pass and nothing is taken.
if (G.crafting) {
  console.log('creative mode');
  test('free crafting: builds, places and crafts with an empty backpack, and pays nothing', () => {
    const ctx = { bag: G.inventory.create(12), chest: G.inventory.create(24), buildings: G.crafting.startBuildings(), placed: [], vehicles: {} };
    eq(G.crafting.placeStatus(ctx, 'workbench'), 'cost');
    G.crafting.free = true;
    try {
      eq(G.crafting.placeStatus(ctx, 'workbench'), null);
      eq(G.crafting.place(ctx, 'workbench').ok, true);
      eq(G.crafting.build(ctx, 'workbench').ok, true);
      const r = G.crafting.craft(ctx, 'plank');
      eq(r.ok, true); eq(G.inventory.count(ctx.bag, 'plank'), 2); eq(G.inventory.count(ctx.bag, 'wood'), 0);
      eq(G.crafting.spend(ctx, { stone: 99 }), null);
    } finally { G.crafting.free = false; }
    eq(G.crafting.buildStatus(ctx, 'fence'), 'cost');
  });
  test('the creative kit holds only real items and fits the largest backpack', () => {
    const kit = G.data.creativeKit, top = G.data.buildings.bag.levels;
    for (const k of kit) if (!G.data.items[k[0]] || !(k[1] > 0)) throw new Error('kit item ' + k[0]);
    if (kit.length > top[top.length - 1].bagSlots) throw new Error('kit does not fit');
  });
}
