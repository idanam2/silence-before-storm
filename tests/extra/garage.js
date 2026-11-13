// The garage as a room you can drive into, its bench, vehicle upgrades (parts fitted in the garage) and washing.
console.log('garage workshop');
{
  const VD = G.data.vehicles, UP = G.data.vehicleUpgrades, IT = G.data.items;
  const bag = (list) => G.inventory.fromList(12, list || []), chestOf = (list) => G.inventory.fromList(24, list || []);

  test('garage room: walls on three sides, the inside and the door are open, a bench along the back wall', () => {
    const b = G.base.build(), levels = Object.assign(G.crafting.startBuildings(), { garage_moto: 1 });
    const placed = [{ id: 'garage_moto', x: 900, y: 1240 }], S = G.data.buildings.garage_moto.spot;
    G.base.setBuildings(b, levels, placed);
    const parts = b.solids.filter(r => r.kind === 'garage_moto');
    eq(parts.filter(r => r.part === 'room').length, 1); eq(parts.filter(r => r.part === 'bench').length, 1);
    if (parts.filter(r => r.part === 'wall').length < 5) throw new Error('walls: back + side pieces');
    // a person (and so a ridden vehicle) walks in through the south side and stands in the middle without being pushed
    const p = G.player.create(900 + S.w / 2, 1240 + S.h + 30);
    for (let i = 0; i < 20; i++) { p.y -= 4; G.base.collide(p, b.solids); }
    if (!(p.y < 1240 + S.h - 30)) throw new Error('could not drive in, stopped at y ' + p.y);
    const inside = { x: 900 + S.w * 0.6, y: 1240 + S.h - 30, radius: 12 }; const y0 = inside.y;
    G.base.collide(inside, b.solids); eq(inside.y, y0);
    // the side walls and the back wall are solid
    const w = { x: 900 + 8, y: 1240 + S.h / 2, radius: 12 }; G.base.collide(w, b.solids); if (!(w.x > 900 + 10)) throw new Error('west wall is not solid');
    const n = { x: 900 + S.w / 2, y: 1240 + 8, radius: 12 }; G.base.collide(n, b.solids); if (!(n.y > 1240 + 10)) throw new Error('back wall is not solid');
    // E: only the bench opens the garage panel, not standing anywhere inside
    const bench = parts.filter(r => r.part === 'bench')[0];
    eq(G.base.nearStation(G.player.create(bench.x + bench.w / 2, bench.y + bench.h + 12), b), 'garage_moto');
    eq(G.base.nearStation(G.player.create(900 + S.w * 0.8, 1240 + S.h - 20), b), null);
  });

  test('garage room: the whole footprint is reserved when placing, and a garage can be moved onto its own place', () => {
    const b = G.base.build(), levels = Object.assign(G.crafting.startBuildings(), { garage_moto: 1 }), S = G.data.buildings.garage_moto.spot;
    G.base.setBuildings(b, levels, [{ id: 'garage_moto', x: 900, y: 1240 }]);
    const r = { x: 920, y: 1260, w: 40, h: 40 };                                          // inside the room: not free
    eq(G.placing.check(b, r, null), 'blocked');
    const own = b.solids.filter(s => s.kind === 'garage_moto' && s.ox === 900 && s.oy === 1240);
    eq(G.placing.check(b, { x: 904, y: 1240, w: S.w, h: S.h }, own), null);               // ignoring all of its own parts it fits where it stands
  });

  test('parts: every garage bench makes rubber, rods, frame, tank, engine (+ wheels, rotor, tracks, turret where they belong); engines for heli and tank need level 2', () => {
    for (const id of ['rubber', 'iron_rod', 'part_frame', 'part_wheels', 'part_engine', 'part_tank', 'part_rotor', 'part_tracks', 'part_turret']) if (!IT[id]) throw new Error('item ' + id);
    const rec = (id) => G.data.recipes.filter(r => r.id === id)[0];
    for (const id of ['g_rubber', 'g_rod', 'g_frame', 'g_wheels', 'g_tank', 'g_engine']) { eq(rec(id).station, 'garage_moto'); eq(rec(id).cat, 'parts'); }
    eq(rec('g_rotor'), undefined); eq(rec('h_rotor').station, 'garage_heli'); eq(rec('t_turret').station, 'garage_tank'); eq(rec('t_tracks').cat, 'parts'); eq(rec('h_wheels'), undefined);
    const mk = (items, lv) => ({ bag: bag(items), chest: chestOf([]), buildings: Object.assign(G.crafting.startBuildings(), { garage_moto: lv, garage_heli: lv }), vehicles: {} });
    const c = mk([['cloth', 4], ['fuel', 2], ['metal', 30], ['nails', 20], ['electronics', 8]], 1);
    eq(G.crafting.craft(c, 'g_rubber').ok, true); eq(G.crafting.craft(c, 'g_rubber').ok, true);   // 2 + 2 rubber
    eq(G.crafting.craft(c, 'g_rod').ok, true); eq(G.crafting.craft(c, 'g_rod').ok, true);
    eq(G.crafting.craft(c, 'g_wheels').ok, true); eq(G.inventory.count(c.bag, 'part_wheels'), 1);
    eq(G.crafting.craft(c, 'g_rod').ok, true); eq(G.crafting.craft(c, 'g_engine').ok, true);
    eq(G.crafting.craft(c, 'h_engine').reason, 'level');
    c.buildings.garage_heli = 2; G.crafting.craft(c, 'h_rod'); G.crafting.craft(c, 'h_rod'); eq(G.crafting.craft(c, 'h_engine').ok, true);
  });

  test('upgrades: a part is used up per level, up to the maximum; speed, fuel use and tank follow; the atv shares the bike\'s list', () => {
    const v = G.vehicles.create(), b = bag([['part_wheels', 1], ['part_engine', 5], ['part_tank', 1]]), c = chestOf([['part_wheels', 1]]);
    const walk = 1, base = G.vehicles.speedMult('motorcycle', v);
    eq(base, 1);
    eq(G.vehicles.install(v, 'motorcycle', 'engine', b, c).level, 1);
    near(G.vehicles.speedMult('motorcycle', v), 1 + UP.motorcycle[1].speed, 1e-9);
    eq(G.vehicles.install(v, 'motorcycle', 'wheels', b, c).ok, true); eq(G.vehicles.install(v, 'motorcycle', 'wheels', b, c).ok, true);   // 2nd wheels part from the box
    eq(G.vehicles.install(v, 'motorcycle', 'wheels', b, c).reason, 'max');
    if (!(G.vehicles.burnMult('motorcycle', v) < 1)) throw new Error('big wheels should save fuel');
    const cap0 = G.vehicles.cap('motorcycle', {}, G.vehicles.create());
    eq(G.vehicles.install(v, 'motorcycle', 'tank', b, c).ok, true);
    eq(G.vehicles.cap('motorcycle', {}, v), Math.round(VD.motorcycle.fuelCap * (1 + UP.motorcycle[2].cap)));
    if (!(G.vehicles.cap('motorcycle', {}, v) > cap0)) throw new Error('tank upgrade');
    eq(G.vehicles.install(v, 'motorcycle', 'tank', b, c).reason, 'part');                    // no second tank part
    eq(G.vehicles.install(v, 'motorcycle', 'nope', b, c).reason, 'unknown');
    eq(G.vehicles.upgradesFor('atv').length, 3); eq(G.vehicles.upgradesFor('jeep').length, 3); eq(G.vehicles.upgradesFor('heli').length, 3); eq(G.vehicles.upgradesFor('tank').length, 3);
  });

  test('helicopter: at home it always sits in the middle of its pad, even if an old save left it elsewhere in the base; away it shows only there', () => {
    const placed = [{ id: 'garage_heli', x: 1440, y: 1210 }], r = G.vehicles.garageRect('heli', placed), pad = G.vehicles.pad(r);
    for (const v of [{ fuel: 5, at: null }, { fuel: 5, at: { area: 'base', x: 10, y: 20, angle: 0 } }]) {
      const q = G.vehicles.position('heli', v, 'base', placed); eq(q.x, pad.x); eq(q.y, pad.y);
      eq(G.vehicles.inGarage('heli', v, 'base', placed), true);
    }
    const away = { fuel: 5, at: { area: 'port', x: 100, y: 200, angle: 1 } };
    eq(G.vehicles.position('heli', away, 'base', placed), null); eq(G.vehicles.position('heli', away, 'port', placed).x, 100);
    const J = G.data.recipes.filter(x => x.station === 'garage_jeep' && x.cat === 'parts'); eq(J.length, 6);        // the jeep bench makes the same parts
    const jq = G.vehicles.position('jeep', { fuel: 5, at: null }, 'base', [{ id: 'garage_jeep', x: 1150, y: 1230 }]);
    eq(G.vehicles.inGarage('jeep', { fuel: 5, at: null }, 'base', [{ id: 'garage_jeep', x: 1150, y: 1230 }]), true);
  });

  test('mud: grows with the distance, slows and burns more, washing needs 1 clean water and resets it', () => {
    const v = G.vehicles.create(), b = bag([['water_clean', 1]]), c = chestOf([]);
    G.vehicles.dirtAdd(v, G.data.vehicleDirt.per / 2); near(v.dirt, 0.5, 1e-9);
    if (!(G.vehicles.speedMult('motorcycle', v) < 1) || !(G.vehicles.burnMult('motorcycle', v) > 1)) throw new Error('mud costs speed and fuel');
    G.vehicles.dirtAdd(v, 1e9); eq(v.dirt, 1);
    eq(G.vehicles.wash(v, bag([]), chestOf([])).reason, 'water');
    eq(G.vehicles.wash(v, b, c).ok, true); eq(v.dirt, 0); eq(G.inventory.count(b, 'water_clean'), 0);
    eq(G.vehicles.wash(v, b, c).reason, 'clean');
  });

  test('saving: fitted upgrades and mud survive; unknown upgrades, too-high levels and silly mud are cleaned; old saves get none', () => {
    const st = mkState();
    st.vehicles = { motorcycle: { fuel: 5, at: null, up: { engine: 2, wheels: 9, ghost: 3 }, dirt: 0.4 }, jeep: { fuel: 3, at: null, up: { engine: 1 }, dirt: 7 } };
    const d = G.save.parse(JSON.stringify(G.save.snapshot(st, 1))).data;
    eq(d.vehicles.motorcycle.up.engine, 2); eq(d.vehicles.motorcycle.up.wheels, UP.motorcycle[0].max); eq(d.vehicles.motorcycle.up.ghost, undefined);
    near(d.vehicles.motorcycle.dirt, 0.4, 1e-9); eq(d.vehicles.jeep.up.engine, 1); eq(d.vehicles.jeep.dirt, 1);
    st.vehicles.heli = { fuel: 3, at: null, up: { engine: 1, wheels: 2 }, dirt: 0 };                // the heli has an engine upgrade but no wheels
    const hd = G.save.parse(JSON.stringify(G.save.snapshot(st, 1))).data.vehicles.heli.up; eq(hd.engine, 1); eq(hd.wheels, undefined);
    const old = G.save.snapshot(mkState(), 1); old.vehicles = { atv: { fuel: 2, at: null } };
    const od = G.save.parse(JSON.stringify(old)).data;
    eq(Object.keys(od.vehicles.atv.up).length, 0); eq(od.vehicles.atv.dirt, 0);
  });
}
