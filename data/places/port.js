// Extra details for hand-built places (port). Mutates G.data.areas before data/interiors.js links the doors.
// Only existing structure kinds are used, so nothing here needs new drawing code.
(function (root) {
  'use strict';
  var G = root.G, A = G && G.data && G.data.areas && G.data.areas.port;
  if (!A) return;
  var S = A.structures;
  function add(o) { S.push(o); return o; }

  // lamps along the harbour road and the quay, so the main road reads as a street
  for (var x = 400; x <= 3600; x += 400) add({ kind: 'lamp', x: x, y: 1078, w: 10, h: 10, k: 0.2 });
  add({ kind: 'lamp', x: 600, y: 900, w: 10, h: 10, k: 0.2 }); add({ kind: 'lamp', x: 3500, y: 900, w: 10, h: 10, k: 0.2 });

  // a broken-down truck and a car in the southern yard, barriers across the side road
  add({ kind: 'car', x: 1180, y: 1790, w: 200, h: 84, k: 0.07, style: 'truck', color: '#5a5a4a' });
  add({ kind: 'car', x: 1520, y: 1930, w: 140, h: 70, k: 0.045, color: '#4a4f58', open: true });
  add({ kind: 'barrier', x: 1700, y: 1590, w: 190, h: 30, k: 0.028 });
  add({ kind: 'sandbags', x: 1780, y: 2130, w: 120, h: 30, k: 0.03 });

  // a fence closing off the fuel tanks, with a gap on the west side
  add({ kind: 'fence', x: 3330, y: 1830, w: 520, h: 12, k: 0.05 });
  add({ kind: 'fence', x: 3830, y: 1830, w: 12, h: 340, k: 0.05 });

  // more bollards and a couple of mooring posts on the east pier head
  for (var y = 430; y <= 850; y += 140) { add({ kind: 'bollard', x: 3436, y: y, w: 16, h: 16, k: 0.022 }); add({ kind: 'bollard', x: 3564, y: y, w: 16, h: 16, k: 0.022 }); }

  // extra salvage: stores by the office, scrap by the new truck, a crate on the west pier
  // (counts stay the same: more places to find them, not more of them)
  var MORE = { scrap: [[1180, 1860], [1520, 2000], [3500, 1800]], barrel: [[1790, 2100], [3360, 1800]], crate: [[600, 700], [610, 560]] };
  A.loot.forEach(function (l) { (MORE[l.type] || []).forEach(function (p) { l.spots.push(p); }); });
})(typeof window !== 'undefined' ? window : globalThis);
