// The dog and the partner (js/companions.js), the cold (js/cold.js) and the snowy mountains (data/places/peaks.js).
if (G.companions && G.cold) {
  console.log('companions and cold');
  const bagOf = (list) => G.inventory.fromList(12, list || []);

  test('companions: both start switched off, unlock turns one on, a save keeps who is on and the dog needs', () => {
    const c = G.companions.create();
    eq(G.companions.has(c, 'dog'), false); eq(G.companions.has(c, 'partner'), false);
    G.companions.unlock(c, 'dog'); c.dog.hunger = 41.26; c.bowl.food = 2;
    const back = G.companions.clean(JSON.parse(JSON.stringify(G.companions.snapshot(c))));
    eq(back.dog.on, true); near(back.dog.hunger, 41.3, 0.06); eq(back.bowl.food, 2); eq(back.partner.on, false);
    const junk = G.companions.clean({ dog: { on: 1, hunger: 'x', thirst: 900 }, bowl: { food: 99, water: -4 } });
    eq(junk.dog.hunger, 100); eq(junk.dog.thirst, 100); eq(junk.bowl.food, 3); eq(junk.bowl.water, 0);
    eq(G.companions.clean(null).dog.on, false);
  });

  test('dog care: feed, water and wash use items from the bag and fill the right meter', () => {
    const c = G.companions.create(); G.companions.unlock(c, 'dog');
    const bag = bagOf([['canned_food', 1], ['water_clean', 2]]);
    eq(G.companions.careOption(c, bag), null);                       // not hungry, not thirsty, clean
    c.dog.hunger = 30; let o = G.companions.careOption(c, bag); eq(o.kind, 'feed');
    eq(G.companions.care(c, bag, o), true); eq(G.inventory.count(bag, 'canned_food'), 0); if (!(c.dog.hunger > 30)) throw new Error('hunger');
    c.dog.thirst = 20; o = G.companions.careOption(c, bag); eq(o.kind, 'water'); G.companions.care(c, bag, o); if (!(c.dog.thirst > 20)) throw new Error('thirst');
    c.dog.clean = 20; o = G.companions.careOption(c, bag); eq(o.kind, 'wash'); G.companions.care(c, bag, o); near(c.dog.clean, 80, 1e-9);
    eq(G.companions.care(c, bag, { kind: 'feed', item: 'canned_food' }), false);   // nothing left to give
  });

  test('bowl at home: fills with food and water up to its cap', () => {
    const c = G.companions.create(), bag = bagOf([['canned_food', 5], ['water_clean', 5]]);
    for (let i = 0; i < 12; i++) G.companions.fillBowl(c, bag);
    eq(c.bowl.food, 3); eq(c.bowl.water, 3);
    eq(G.companions.fillBowl(c, bag), null);
  });

  test('cold: warm clothes add up (capped), fires and rooms warm, snow slows walking', () => {
    const e = G.gear.create(); eq(G.cold.warmthOf(e), 0);
    e.body = 'parka'; e.head = 'wool_hat'; near(G.cold.warmthOf(e), 0.6, 1e-9);
    e.legs = 'thermal_pants'; e.feet = 'snow_boots'; near(G.cold.warmthOf(e), 0.9, 1e-9);   // capped at 0.9
    eq(G.cold.snowshoes(e), true);
    const z = G.area.generate(G.data.areas.peaks, G.data.resources, 0);
    eq(!!z.cold, true); eq(z.warm.length >= 3, true);
    const st = { area: 'peaks', zone: z, equip: G.gear.create(), needs: { health: 100, warmth: 100 }, player: { x: 1800, y: 1500 } };
    eq(G.cold.speedMult(st), 0.8);
    st.player = { x: z.cold.drifts[0].x + 10, y: z.cold.drifts[0].y + 10 }; eq(G.cold.speedMult(st), 0.55);
    st.equip = e; eq(G.cold.speedMult(st), 0.92);
    st.equip = G.gear.create(); st.player = { x: 1800, y: 1500 };
    G.cold.step(st, 1); if (!(st.needs.warmth < 100)) throw new Error('no drain'); const naked = 100 - st.needs.warmth;
    st.needs.warmth = 100; st.equip = e; G.cold.step(st, 1); if (!((100 - st.needs.warmth) < naked * 0.2)) throw new Error('clothes do not help');
    st.needs.warmth = 50; st.player = { x: z.warm[0].x, y: z.warm[0].y }; G.cold.step(st, 1); if (!(st.needs.warmth > 50)) throw new Error('fire');
    st.area = 'base'; st.zone = null; st.needs.warmth = 50; G.cold.step(st, 1); if (!(st.needs.warmth > 50)) throw new Error('home');
  });

  test('cold: body heat levels slow you, stop running and at the bottom hurt; a hot drink warms', () => {
    eq(G.cold.effect(80), null); eq(G.cold.effect(50).slow, 0.95);
    eq(G.cold.effect(30).noRun, true); eq(G.cold.effect(10).healthPerSec < 0, true);
    const n = G.needs.create(); n.warmth = 40;
    eq(G.needs.use(n, G.data.items.hot_tea).ok, true); near(n.warmth, 65, 1e-9);
    eq(G.needs.create().warmth, 100);
  });

  test('peaks: a destination on the map, cold, with fires, frozen infected and warm clothes to find', () => {
    const d = G.data.world.destinations.peaks; if (!d || !G.data.world.order.includes('peaks')) throw new Error('not on the map');
    const A = G.data.areas.peaks; eq(A.enemyPlan.frozen > 0, true);
    eq(!!G.data.enemies.types.frozen, true); eq(G.data.enemies.types.frozen.cold.touch > 0, true);
    for (const t of ['pack_parka', 'pack_hat', 'pack_pants', 'pack_boots']) if (!A.loot.some(l => l.type === t)) throw new Error(t);
  });
}
