// Extra details for the airport (existing structure kinds only). Mutates G.data.areas.airport before the interiors are linked.
(function (root) {
  'use strict';
  var G = root.G, A = G && G.data && G.data.areas && G.data.areas.airport;
  if (!A) return;
  var S = A.structures;
  // west side: a freight container and a pile of crates by the hangar road; east side: trucks and a sandbag post
  S.push({ kind: 'container', x: 500, y: 1600, w: 220, h: 76, k: 0.068, level: 1, color: '#3c4f72', open: true });
  S.push({ kind: 'pile', x: 900, y: 1700, w: 130, h: 90, k: 0.05 });
  S.push({ kind: 'car', x: 3700, y: 1700, w: 230, h: 84, k: 0.07, style: 'truck', color: '#55503f' });
  S.push({ kind: 'sandbags', x: 3300, y: 1900, w: 170, h: 30, k: 0.03 }, { kind: 'barrier', x: 3560, y: 1900, w: 190, h: 30, k: 0.028 });
  // runway edge lights along the apron road
  for (var x = 700; x <= 3700; x += 400) S.push({ kind: 'lamp', x: x, y: 640, w: 10, h: 10, k: 0.2 });
  var MORE = { scrap: [[610, 1730]], cargo: [[610, 1732], [3760, 1800]], tarp: [[950, 1810]], crate: [[3500, 1640]] };
  A.loot.forEach(function (l) { (MORE[l.type] || []).forEach(function (p) { l.spots.push(p); }); });
})(typeof window !== 'undefined' ? window : globalThis);
