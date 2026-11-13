// Vehicles (data/vehicles.js, js/vehicles.js) and their garages, recipes, fuel and saving.
if (G.vehicles) {
  console.log('vehicles');
  const VD = G.data.vehicles, VO = G.data.vehicleOrder, VB = G.data.buildings;
  const bag = (list) => G.inventory.fromList(12, list || []), chestOf = (list) => G.inventory.fromList(24, list || []);
  const mkctx = (b, c, buildings) => ({ bag: bag(b), chest: chestOf(c), buildings: Object.assign(G.crafting.startBuildings(), buildings || {}) });

  test('vehicle data: five vehicles, each with a real garage, sane speed / fuel numbers and a recipe at that garage', () => {
    eq(VO.join(), 'motorcycle,atv,jeep,heli,tank');
    for (const id of VO) {
      const d = VD[id];
      if (!d.name || !VB[d.garage] || !VB[d.garage].station || !VB[d.garage].spot) throw new Error(id + ' garage');
      if (!(d.speed > 1.5 && d.speed < 8) || !(d.fuelCap >= 10) || !(d.per1000 > 0) || !(d.perKm >= 0) || !(d.len > 20 && d.wid > 10)) throw new Error(id + ' numbers');
      const list = G.vehicles.buildList(id);                         // assembled from parts, each made at that garage's bench
      if (list.length < 3) throw new Error(id + ' build list');
      for (const x of list) { if (!G.data.items[x.part] || !(x.n >= 1) || !G.data.recipes.some(r => r.station === d.garage && r.out[0] === x.part)) throw new Error(id + ' part ' + x.part); }
      if (!G.data.items['veh_' + id]) throw new Error(id + ' item');
    }
    if (!G.data.items.fuel) throw new Error('no fuel item');
    eq(VD.heli.fly, true); if (VD.tank.ram <= VD.jeep.ram) throw new Error('the tank should hit harder than the jeep');
    if (!(VD.motorcycle.speed > VD.atv.speed && VD.atv.speed > VD.tank.speed)) throw new Error('speed order');
  });

  test('every garage can be built (free placement) and is in the build order', () => {
    for (const g of ['garage_moto', 'garage_jeep', 'garage_heli', 'garage_tank']) {
      if (G.data.buildingOrder.indexOf(g) < 0) throw new Error(g + ' not in the build order');
      if (VB[g].levels.length < 2) throw new Error(g + ' levels');
    }
    const ctx = mkctx([['wood', 40], ['plank', 40], ['stone', 40]], []);
    eq(G.crafting.place(ctx, 'garage_jeep').ok, true);
  });

  test('building a vehicle: parts are fitted one by one (bag, then box), the last one completes it, the garage level decides the tank size', () => {
    const builds = {}, list = G.vehicles.buildList('jeep'), total = list.reduce((n, x) => n + x.n, 0);
    const b = bag([['part_frame', 1], ['part_wheels', 2]]), c = chestOf([['part_wheels', 2], ['part_engine', 1], ['part_tank', 1]]);
    eq(G.vehicles.assemble(builds, 'jeep', 'nope', b, c).reason, 'unknown');
    eq(G.vehicles.assemble(builds, 'jeep', 'part_rotor', b, c).reason, 'unknown');           // not a jeep part
    let last = null, fitted = 0;
    for (const x of list) for (let i = 0; i < x.n; i++) { last = G.vehicles.assemble(builds, 'jeep', x.part, b, c); eq(last.ok, true); fitted++; eq(last.done, fitted === total); }
    eq(last.done, true); eq(G.vehicles.buildDone(builds, 'jeep'), true);
    eq(G.vehicles.assemble(builds, 'jeep', 'part_frame', b, c).reason, 'full');
    const empty = {}; eq(G.vehicles.assemble(empty, 'tank', 'part_turret', bag([]), chestOf([])).reason, 'part');
    eq(G.vehicles.builtCount(empty, 'tank', 'part_turret'), 0);                              // a failed fit changes nothing
    eq(G.vehicles.cap('jeep', { garage_jeep: 1 }), VD.jeep.fuelCap);
    eq(G.vehicles.cap('jeep', { garage_jeep: 2 }), Math.round(VD.jeep.fuelCap * 1.5));
    eq(G.vehicles.cap('jeep', { garage_jeep: 3 }), VD.jeep.fuelCap * 2); eq(G.vehicles.cap('jeep', { garage_jeep: 4 }), Math.round(VD.jeep.fuelCap * 2.5));
    for (const g of ['garage_moto', 'garage_jeep', 'garage_heli', 'garage_tank']) eq(VB[g].levels.length, 4);
  });

  test('assembly saving: work in progress survives, finished or unknown vehicles and silly counts are dropped', () => {
    const st = mkState();
    st.vehicles = { atv: { fuel: 1, at: null, up: {}, dirt: 0 } };
    st.builds = { jeep: { part_frame: 1, part_wheels: 99, ghost: 4 }, atv: { part_frame: 1 }, ghostveh: { part_frame: 1 } };
    const d = G.save.parse(JSON.stringify(G.save.snapshot(st, 1))).data;
    eq(d.builds.jeep.part_frame, 1); eq(d.builds.jeep.part_wheels, 4); eq(d.builds.jeep.ghost, undefined);
    eq(d.builds.atv, undefined); eq(d.builds.ghostveh, undefined);                           // the atv is built already
    const old = G.save.snapshot(mkState(), 1); delete old.builds;
    eq(Object.keys(G.save.parse(JSON.stringify(old)).data.builds).length, 0);
  });

  test('parked vehicles: solid hulls (turned to the heading), and the garage area decides where a left vehicle parks', () => {
    const q = { x: 500, y: 400, angle: 0 }, s = G.vehicles.solid('tank', q);
    if (!(s.w > s.h)) throw new Error('a tank heading east is wider than tall');
    const turned = G.vehicles.solid('tank', { x: 500, y: 400, angle: Math.PI / 2 }); if (!(turned.h > turned.w)) throw new Error('heading south');
    const p = { x: 500, y: 400, radius: 12 }; G.base.collide(p, [s]);
    if (Math.abs(p.x - 500) < 20 && Math.abs(p.y - 400) < 20) throw new Error('the player must be pushed off the hull');
    const placed = [{ id: 'garage_tank', x: 1760, y: 1215 }], blds = Object.assign(G.crafting.startBuildings(), { garage_tank: 1 });
    eq(G.vehicles.garageAt('tank', 1760 + 130, 1215 + 80, placed, blds), true);
    eq(G.vehicles.garageAt('tank', 1760 + 130, 1215 + 300, placed, blds), false);
    eq(G.vehicles.garageAt('tank', 1760 + 130, 1215 + 80, placed, Object.assign({}, blds, { garage_tank: 0 })), false);   // no garage built there
  });

  test('fuel: cans pour from the bag then the chest, stop when the tank is full, driving burns it, a trip is paid in fuel', () => {
    const v = G.vehicles.create(), b = bag([['fuel', 2]]), c = chestOf([['fuel', 5]]), blds = G.crafting.startBuildings();
    const r = G.vehicles.refuel(v, 'jeep', blds, b, c);              // cap 34, 10 per can: 4 cans (the last one partly)
    eq(r.cans, 4); near(v.fuel, VD.jeep.fuelCap, 1e-9);
    eq(G.inventory.count(b, 'fuel'), 0); eq(G.inventory.count(c, 'fuel'), 3);
    eq(G.vehicles.refuel(v, 'jeep', blds, b, c).cans, 0);            // full: nothing poured
    eq(G.inventory.count(c, 'fuel'), 3);
    const before = v.fuel;
    eq(G.vehicles.drain(v, 'jeep', 1000), true); near(v.fuel, before - VD.jeep.per1000, 1e-9);
    eq(G.vehicles.drain(v, 'jeep', 1e6), false); eq(v.fuel, 0);      // never below zero
    eq(G.vehicles.tripFuel('tank', 10), Math.ceil(VD.tank.perKm * 10));
    if (!(G.vehicles.tripFuel('motorcycle', 12) < G.vehicles.tripFuel('tank', 12))) throw new Error('a tank should drink more than a bike');
  });

  test('fuel balance: a full tank lasts a good while at its own speed (bike and quad at least 80 s, the others at least 60 s)', () => {
    const walk = G.config.player.walkSpeed;
    for (const id of VO) {
      if (VD[id].transport) continue;                                // the helicopter is paid by the km on the map
      const px = VD[id].fuelCap / VD[id].per1000 * 1000, secs = px / (walk * VD[id].speed);
      const need = id === 'motorcycle' || id === 'atv' ? 80 : 60;
      if (secs < need) throw new Error(id + ' runs dry after ' + Math.round(secs) + ' s');
      if (secs > 400) throw new Error(id + ' fuel is almost free: ' + Math.round(secs) + ' s');
    }
  });

  test('parked position: inside the garage at home (side by side, nose to the door), where it was left elsewhere, nowhere in another area', () => {
    const placed = [{ id: 'garage_moto', x: 900, y: 1240 }], S = VB.garage_moto.spot;
    const p1 = G.vehicles.position('motorcycle', { fuel: 3, at: null }, 'base', placed), p2 = G.vehicles.position('atv', { fuel: 3, at: null }, 'base', placed);
    for (const p of [p1, p2]) if (!(p.x > 900 && p.x < 900 + S.w && p.y > 1240 + 20 && p.y < 1240 + S.h)) throw new Error('inside the garage room');
    if (p1.x === p2.x) throw new Error('side by side');
    eq(G.vehicles.inGarage('motorcycle', { fuel: 3, at: null }, 'base', placed), true);
    eq(G.vehicles.inGarage('motorcycle', { fuel: 3, at: { area: 'base', x: 900 + 90, y: 1240 + S.h + 80, angle: 0 } }, 'base', placed), false);   // left outside the door
    eq(G.vehicles.position('jeep', { fuel: 0, at: null }, 'forest', []), null);
    const left = { fuel: 1, at: { area: 'forest', x: 300, y: 400, angle: 1 } };
    eq(G.vehicles.position('jeep', left, 'base', []), null);
    eq(G.vehicles.position('jeep', left, 'forest', []).x, 300);
    // the garage placed somewhere else: the vehicle follows it
    const q = G.vehicles.position('motorcycle', { fuel: 3, at: null }, 'base', [{ id: 'garage_moto', x: 100, y: 200 }]);
    if (!(q.x < 400 && q.y < 500)) throw new Error('parks at the moved garage');
  });

  test('saving: vehicles, their fuel, where they were left and the ridden one survive; garbage is cleaned', () => {
    const st = mkState();
    st.vehicles = { jeep: { fuel: 12.5, at: null }, tank: { fuel: 5, at: { area: 'quarry', x: 300.4, y: 500, angle: 2 } } }; st.ride = 'jeep';
    const d = G.save.parse(JSON.stringify(G.save.snapshot(st, 1))).data;
    eq(d.vehicles.jeep.fuel, 12.5); eq(d.ride, 'jeep'); eq(d.vehicles.tank.at.area, 'quarry'); eq(d.vehicles.tank.at.x, 300);
    st.vehicles.tank.at = { area: 'nowhere', x: 1, y: 1 };           // an unknown area: parks at the garage instead
    st.vehicles.ghost = { fuel: 1, at: null }; st.vehicles.jeep.fuel = 9999;
    const bad = G.save.parse(JSON.stringify(G.save.snapshot(st, 1))).data;
    eq(bad.vehicles.tank.at, null); eq(bad.vehicles.ghost, undefined);
    eq(bad.vehicles.jeep.fuel, G.vehicles.cap('jeep', bad.buildings));
    st.ride = 'heli';                                                // riding something it does not own
    eq(G.save.parse(JSON.stringify(G.save.snapshot(st, 1))).data.ride, null);
    const old = G.save.snapshot(mkState(), 1); delete old.vehicles; delete old.ride;   // a save from before vehicles
    const od = G.save.parse(JSON.stringify(old)).data;
    eq(Object.keys(od.vehicles).length, 0); eq(od.ride, null);
  });

  test('fuel drums: loot at the places where it makes sense, and they give fuel cans', () => {
    eq(G.data.resources.fueldrum.item, 'fuel');
    for (const id of ['port', 'military', 'airport']) {
      const A = G.data.areas[id];
      if (!A || !A.loot.some(l => l.type === 'fueldrum')) throw new Error(id + ' has no fuel drums');
    }
  });
}
