// Extra details for the hospital and the military base (existing structure kinds only). Mutates G.data.areas.
// Loot: more places to find the same things (counts stay as they are).
(function (root) {
  'use strict';
  var G = root.G, AR = G && G.data && G.data.areas;
  if (!AR) return;
  function more(A, MORE) { A.loot.forEach(function (l) { (MORE[l.type] || []).forEach(function (p) { l.spots.push(p); }); }); }

  var H = AR.hospital;
  if (H) {
    var S = H.structures;
    // a morgue container behind sandbags in the south-east, a pile of medical waste, a second row of lamps and barriers
    S.push({ kind: 'container', x: 2800, y: 1700, w: 220, h: 76, k: 0.068, level: 1, color: '#4b5358', open: true });
    S.push({ kind: 'sandbags', x: 2760, y: 1800, w: 150, h: 28, k: 0.03 }, { kind: 'sandbags', x: 2980, y: 1800, w: 130, h: 28, k: 0.03 });
    S.push({ kind: 'pile', x: 2000, y: 1760, w: 120, h: 90, k: 0.05 });
    S.push({ kind: 'car', x: 1900, y: 1660, w: 150, h: 72, k: 0.045, style: 'ambulance', color: '#aab0ac' });
    S.push({ kind: 'barrier', x: 1100, y: 1960, w: 190, h: 30, k: 0.028 }, { kind: 'barrier', x: 2150, y: 1960, w: 190, h: 30, k: 0.028 });
    for (var x = 800; x <= 3000; x += 420) S.push({ kind: 'lamp', x: x, y: 1960, w: 10, h: 10, k: 0.2 });
    more(H, { medkit: [[2850, 1870], [2000, 1900]], scrap: [[2060, 1830], [3100, 1700]], tarp: [[2330, 1700]], cargo: [[2900, 1700]] });
  }

  var M = AR.military;
  if (M) {
    var T = M.structures;
    // an ammunition dump on the east side behind the vehicles, a supply container, trucks and sandbag nests by the gate road
    T.push({ kind: 'container', x: 3560, y: 1200, w: 220, h: 76, k: 0.068, level: 1, color: '#55623f', open: true });
    T.push({ kind: 'pile', x: 3560, y: 1020, w: 130, h: 90, k: 0.05 });
    T.push({ kind: 'car', x: 450, y: 1480, w: 230, h: 84, k: 0.07, style: 'truck', color: '#4a5240' });
    T.push({ kind: 'sandbags', x: 900, y: 2330, w: 180, h: 30, k: 0.03 }, { kind: 'sandbags', x: 1500, y: 2330, w: 160, h: 30, k: 0.03 });
    T.push({ kind: 'barrier', x: 1500, y: 2250, w: 190, h: 30, k: 0.028 });
    [[400, 2000], [3600, 2000], [400, 1000], [3600, 1000]].forEach(function (p) { T.push({ kind: 'lamp', x: p[0], y: p[1], w: 10, h: 10, k: 0.2 }); });
    more(M, { crate: [[3640, 1320], [3620, 1110]], cargo: [[3600, 1310]], scrap: [[520, 1580]], tarp: [[1000, 2400]] });
  }
})(typeof window !== 'undefined' ? window : globalThis);
