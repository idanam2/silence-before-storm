// Base structures (plain data, no logic). Building is instant: it only costs materials.
// Each structure has 2 levels. levels[0] is the cost to build it (level 1), levels[1] the cost to upgrade.
// start: level the structure already has at the start (0 = not built). spot: fixed place in the yard
// (null = it already exists in the layout: the chest and the fence). station: opens a panel with E.
// use: another E action ('sleep' | 'tank'), handled in js/game.js.
// Per-level effects: chestSlots (chest capacity), sleep (what a night gives: energy / health restored,
// hunger / thirst lost), tank ({ cap, secs }: rain water stored, seconds to collect one unit).
// The fence strength arrives with combat in stage 5.
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  G.data.buildingOrder = ['workbench', 'campfire', 'bed', 'tank', 'chest', 'fence'];

  G.data.buildings = {
    workbench: {
      name: 'שולחן עבודה', start: 0, station: true, spot: { x: 1690, y: 905, w: 92, h: 46 },
      desc: 'יצירת כלים וחומרים. רמה 2 פותחת מתכונים נוספים.',
      levels: [{ cost: { wood: 6, stone: 4 } }, { cost: { wood: 8, stone: 8, plank: 4 } }]
    },
    campfire: {
      name: 'מדורה', start: 0, station: true, spot: { x: 1290, y: 1040, w: 56, h: 56 },
      desc: 'בישול אוכל וטיהור מים. רמה 2 מוסיפה סיר ומרק.',
      levels: [{ cost: { wood: 4, stone: 6 } }, { cost: { stone: 10, plank: 2 } }]
    },
    bed: {
      name: 'מיטה', start: 0, station: false, use: 'sleep', spot: { x: 1780, y: 1090, w: 56, h: 98 },
      desc: 'שינה (E): האנרגיה מתמלאת, אבל רעב וצמא עולים קצת. רמה 2 מרפאת יותר.',
      levels: [
        { cost: { wood: 6, plank: 4 }, sleep: { energy: 100, health: 10, hunger: 12, thirst: 16 } },
        { cost: { plank: 8, stone: 4 }, sleep: { energy: 100, health: 35, hunger: 10, thirst: 13 } }
      ]
    },
    tank: {
      name: 'מיכל מי גשם', start: 0, station: false, use: 'tank', spot: { x: 1880, y: 900, w: 56, h: 56 },
      desc: 'אוסף מי גשם נקיים לאורך זמן (E לאיסוף). רמה 2: מכיל יותר ומתמלא מהר יותר.',
      levels: [
        { cost: { wood: 6, plank: 4, stone: 3 }, tank: { cap: 3, secs: 150 } },
        { cost: { plank: 6, stone: 8 }, tank: { cap: 6, secs: 80 } }
      ]
    },
    chest: {
      name: 'מחסן', start: 1, station: true, spot: null,
      desc: 'רמה 2 מגדילה את המחסן מ-24 ל-36 משבצות.',
      levels: [{ cost: {}, chestSlots: 24 }, { cost: { wood: 10, plank: 6 }, chestSlots: 36 }]
    },
    fence: {
      name: 'גדר', start: 1, station: false, spot: null,
      desc: 'גדר גבוהה וחזקה יותר (ההגנה עצמה מגיעה עם הקרב).',
      levels: [{ cost: {} }, { cost: { plank: 10, stone: 10 } }]
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
