// Base structures (plain data, no logic). Building is instant: it only costs materials.
// Each structure has 2 levels. levels[0] is the cost to build it (level 1), levels[1] the cost to upgrade.
// start: level the structure already has at the start (0 = not built). spot: fixed place in the yard
// (null = it already exists in the layout: the chest and the fence). station: opens a panel with E.
// use: another E action ('sleep' | 'tank' | 'chest'), handled in js/game.js. max: most copies in the yard (default G.placing.MAX_EACH). room: a garage is a roofless room you can drive into (js/base.js roomParts).
// Per-level effects: chestSlots (chest capacity), sleep (what a night gives: energy / health restored,
// hunger / thirst lost), tank ({ cap, secs }: rain water stored, seconds to collect one unit).
// The fence strength arrives with combat in stage 5.
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  G.data.buildingOrder = ['workbench', 'campfire', 'rack', 'garage_moto', 'garage_jeep', 'garage_heli', 'garage_tank', 'bed', 'tank', 'bag', 'kennel', 'chest', 'box'];                      // the fence is not a card of its own any more: pieces are laid one by one (see fencePiece)

  // Fence materials the player chooses between (state: G.state.fence.material). `swap` replaces cost items: the fence
  // levels are priced in planks and stone; stone fences use stone instead of planks, metal fences metal (half as much, rounded up).
  // `hp` is the strength factor for the defense (js/defense.js). Colours and look: js/baseart.js (drawFence).
  G.data.fenceMaterials = {
    wood:  { name: 'עץ',   swap: {}, hp: 1 },
    stone: { name: 'אבן',  swap: { plank: 'stone' }, hp: 1.5 },
    metal: { name: 'מתכת', swap: { plank: 'metal', stone: 'metal' }, half: true, hp: 2.2 }
  };
  G.data.fenceMaterialOrder = ['wood', 'stone', 'metal'];
  // One fence piece (one floor block long) costs this, priced in the chosen material (see G.crafting.fenceCost). How many pieces stand
  // sets the fence level that the raid chance reads (G.placing.fenceLevel); the level is derived, never bought.
  G.data.fencePiece = { cost: { plank: 2 } };

  // Floor blocks the player lays one by one (B menu, "רצפה"): the material and what one big block (G.placing.CELL px, about a room tile) costs.
  G.data.floorMaterials = {
    wood:  { name: 'קרשים',        cost: { plank: 3 } },
    stone: { name: 'אבן',          cost: { stone: 5 } },
    tile:  { name: 'אריחים',       cost: { stone: 4, plank: 2 } }
  };
  G.data.floorMaterialOrder = ['wood', 'stone', 'tile'];

  G.data.buildings = {
    // The backpack: not a place in the yard, only a size. levels[].bagSlots = slots in the bag (see G.crafting.bagSlots).
    // Levels may be more than 2 (cost: cloth + planks + nails: cloth and metal come from the places beyond the forest).
    bag: {
      name: 'תיק', start: 1, station: false, spot: null,
      desc: 'תיק גדול יותר: 12 משבצות, ואז 18, 24 ו-32. כל משבצת מחזיקה עד 50 מאותו סוג.',
      levels: [
        { cost: {}, bagSlots: 12 },
        { cost: { cloth: 4, wood: 6 }, bagSlots: 18 },
        { cost: { cloth: 8, plank: 6, nails: 6 }, bagSlots: 24 },
        { cost: { cloth: 12, plank: 10, nails: 10 }, bagSlots: 32 }
      ]
    },
    // Pelpel's kennel (chapter 3): not placed in the yard (js/base.js puts the kennel and its bowl where they are once the dog is on); only the
    // level counts (story/data/companions.js: storyDog.kennel). Hidden from the build panel until the dog has joined (js/ui.js).
    kennel: {
      name: 'מלונה', start: 0, station: false, spot: null,
      desc: 'מלונה וקערות לפלפל. רמה 2: קערות גדולות ומצע. רמה 3: מבודדת מקור.',
      levels: [
        { cost: { wood: 8, plank: 4 }, bowls: 1 },
        { cost: { plank: 8, nails: 6, cloth: 3 }, bowls: 2 },
        { cost: { plank: 10, nails: 8, cloth: 6 }, bowls: 3, warm: true }
      ]
    },
    workbench: {
      name: 'שולחן עבודה', start: 0, station: true, spot: { x: 1690, y: 905, w: 92, h: 46 },
      desc: 'יצירת כלים וחומרים. רמה 2: נשקים, תחמושת, ערכת עזרה ראשונה ולפיד. רמה 3: מסור וקידוח משופרים (קרשים ומסמרים בכמות), פנס וארגז.',
      levels: [{ cost: { wood: 6, stone: 4 } }, { cost: { wood: 8, stone: 8, plank: 4 } }, { cost: { wood: 14, stone: 12, plank: 10 } },
        { cost: { plank: 14, stone: 10, nails: 12, metal: 6 } }]
    },
    // The drying rack (levels may be more than 2). Recipes with station 'rack' are in data/recipes.js.
    rack: {
      name: 'מתלה ייבוש', start: 0, station: true, spot: { x: 1390, y: 1150, w: 112, h: 30 },
      desc: 'מייבשים פטריות ואוכל כדי שיחזיקו יותר ויהיו בטוחים לאכילה. רמה 2: מנות שדה מזינות.',
      levels: [{ cost: { wood: 5, stone: 2 } }, { cost: { wood: 6, plank: 4, stone: 4 } }, { cost: { plank: 8, stone: 8 } }, { cost: { plank: 10, nails: 10, cloth: 4 } }]
    },
    // Garages: stations where a vehicle is built (recipes with `vehicle` in data/recipes.js) and parked. Level 2: the vehicle's tank holds 50% more.
    // Costs are forest items (the vehicle itself needs metal and electronics from the places beyond).
    garage_moto: {
      name: 'מוסך אופנוע וטרקטורון', start: 0, station: true, max: 1, room: true, spot: { x: 900, y: 1240, w: 190, h: 120 },
      desc: 'כאן בונים אופנוע וטרקטורון וחונים אותם. כל רמה מגדילה את מיכל הדלק של שניהם (רמה 2: +50%, רמה 3: ×2, רמה 4: ×2.5).',
      levels: [{ cost: { wood: 10, plank: 8, stone: 6 } }, { cost: { plank: 10, stone: 10, wood: 8 } }, { cost: { plank: 12, stone: 14, wood: 10 } }, { cost: { plank: 14, stone: 16, nails: 14, metal: 8 } }]
    },
    garage_jeep: {
      name: "מוסך ג'יפ", start: 0, station: true, max: 1, room: true, spot: { x: 1150, y: 1230, w: 220, h: 130 },
      desc: "כאן בונים ג'יפ וחונים אותו. כל רמה מגדילה את מיכל הדלק (רמה 2: +50%, רמה 3: ×2, רמה 4: ×2.5).",
      levels: [{ cost: { wood: 12, plank: 10, stone: 8 } }, { cost: { plank: 12, stone: 12, wood: 8 } }, { cost: { plank: 14, stone: 16, wood: 12 } }, { cost: { plank: 16, stone: 18, nails: 16, metal: 10 } }]
    },
    garage_heli: {
      name: 'מוסך מסוק', start: 0, station: true, max: 1, room: true, spot: { x: 1440, y: 1210, w: 250, h: 170 },
      desc: 'האנגר ומנחת: כאן בונים מסוק וחונים אותו. כל רמה מגדילה את מיכל הדלק (רמה 2: +50%, רמה 3: ×2, רמה 4: ×2.5).',
      levels: [{ cost: { wood: 14, plank: 12, stone: 12 } }, { cost: { plank: 14, stone: 14, wood: 10 } }, { cost: { plank: 16, stone: 18, wood: 14 } }, { cost: { plank: 18, stone: 20, nails: 18, metal: 12 } }]
    },
    garage_tank: {
      name: 'מוסך טנק', start: 0, station: true, max: 1, room: true, spot: { x: 1760, y: 1215, w: 270, h: 160 },
      desc: 'בונקר חזק במיוחד: כאן בונים טנק וחונים אותו. כל רמה מגדילה את מיכל הדלק (רמה 2: +50%, רמה 3: ×2, רמה 4: ×2.5).',
      levels: [{ cost: { stone: 24, plank: 12, wood: 10 } }, { cost: { stone: 24, plank: 14, wood: 10 } }, { cost: { stone: 28, plank: 16, wood: 16 } }, { cost: { stone: 32, plank: 18, nails: 20, metal: 14 } }]
    },
    campfire: {
      name: 'מדורה', start: 0, station: true, spot: { x: 1290, y: 1040, w: 56, h: 56 },
      desc: 'בישול אוכל וטיהור מים. רמה 2 מוסיפה סיר ומרק.',
      levels: [{ cost: { wood: 4, stone: 6 } }, { cost: { stone: 10, plank: 2 } }, { cost: { stone: 14, plank: 6 } }, { cost: { stone: 16, plank: 8, metal: 4 } }]
    },
    bed: {
      name: 'מיטה', start: 0, station: false, max: 1, use: 'sleep', spot: { x: 1780, y: 1090, w: 56, h: 98 },
      desc: 'שינה (E): האנרגיה מתמלאת, אבל רעב וצמא עולים קצת. כל רמה מרפאת יותר.',
      levels: [
        { cost: { wood: 6, plank: 4 }, sleep: { energy: 100, health: 10, hunger: 12, thirst: 16 } },
        { cost: { plank: 8, stone: 4 }, sleep: { energy: 100, health: 35, hunger: 10, thirst: 13 } },
        { cost: { plank: 10, stone: 6, }, sleep: { energy: 100, health: 60, hunger: 9, thirst: 11 } },
        { cost: { plank: 12, cloth: 8, nails: 8 }, sleep: { energy: 100, health: 100, hunger: 8, thirst: 10 } }
      ]
    },
    tank: {
      name: 'מיכל מי גשם', start: 0, station: false, use: 'tank', spot: { x: 1880, y: 900, w: 56, h: 56 },
      desc: 'אוסף מי גשם נקיים לאורך זמן (E לאיסוף). כל רמה מכילה יותר ומתמלאת מהר יותר.',
      levels: [
        { cost: { wood: 6, plank: 4, stone: 3 }, tank: { cap: 3, secs: 150 } },
        { cost: { plank: 6, stone: 8 }, tank: { cap: 6, secs: 80 } },
        { cost: { plank: 8, stone: 12 }, tank: { cap: 10, secs: 55 } },
        { cost: { plank: 10, stone: 14, metal: 6, nails: 6 }, tank: { cap: 16, secs: 35 } }
      ]
    },
    chest: {
      name: 'תיבה ראשית', start: 1, station: true, spot: null,
      desc: 'התיבה שליד הבית. שדרוג מגדיל אותה: 24, 36, 48 ובסוף 60 משבצות.',
      levels: [{ cost: {}, chestSlots: 24 }, { cost: { wood: 10, plank: 6 }, chestSlots: 36 }, { cost: { wood: 14, plank: 10 }, chestSlots: 48 }, { cost: { plank: 14, nails: 10, metal: 4 }, chestSlots: 60 }]
    },
    // Extra boxes: up to `max` of them anywhere in the yard. All boxes open the same storage; every box adds boxSlots[level] slots to it
    // (G.crafting.chestSlots). Upgrading makes every box bigger.
    box: {
      name: 'תיבה נוספת', start: 0, station: false, use: 'chest', max: 4, spot: { x: 1868, y: 790, w: 52, h: 36 },
      desc: 'עוד תיבה בחצר, עד 4. כל התיבות פותחות את אותו מחסן, וכל תיבה מוסיפה לו משבצות (8, 10, 12 ובסוף 14 לכל תיבה).',
      levels: [{ cost: { wood: 8, plank: 4 }, boxSlots: 8 }, { cost: { plank: 8, stone: 4 }, boxSlots: 10 }, { cost: { plank: 10, stone: 8 }, boxSlots: 12 }, { cost: { plank: 12, nails: 8, metal: 4 }, boxSlots: 14 }]
    },
    fence: {
      name: 'גדר', start: 0, station: false, spot: null,
      desc: 'גדר נבנית חתיכה אחרי חתיכה, רק על רצפה. הרמה נקבעת לפי מספר החתיכות.',
      levels: [{ cost: {} }, { cost: {} }, { cost: {} }, { cost: {} }]
    }
  };

  // How each building looks on its card in the build panel (B): an emoji and a one-line "what it does".
  // The long text stays in buildings[id].desc and shows as the card's tooltip.
  G.data.buildingCards = {
    kennel:       { icon: '🐕', blurb: 'בית לפלפל: קערות אוכל ומים, מצע ומקום חם' },
    bag:          { icon: '🎒', blurb: 'יותר מקום בתיק: עד 32 משבצות' },
    workbench:    { icon: '🛠️', blurb: 'יצירת כלים, נשקים ותחמושת' },
    rack:         { icon: '🍄', blurb: 'ייבוש פטריות ואוכל, מנות שדה' },
    garage_moto:  { icon: '🏍️', blurb: 'חדר פתוח: חונים, מרכיבים חלקים, שוטפים' },
    garage_jeep:  { icon: '🚙', blurb: "בונים וחונים ג'יפ" },
    garage_heli:  { icon: '🚁', blurb: 'האנגר: בונים וחונים מסוק' },
    garage_tank:  { icon: '🪖', blurb: 'בונקר: בונים וחונים טנק' },
    campfire:     { icon: '🔥', blurb: 'בישול אוכל וטיהור מים' },
    bed:          { icon: '🛏️', blurb: 'שינה: ממלאת אנרגיה ומרפאת' },
    tank:         { icon: '💧', blurb: 'אוסף מי גשם נקיים לשתייה' },
    chest:        { icon: '📦', blurb: 'התיבה הראשית: עד 60 משבצות' },
    box:          { icon: '🧰', blurb: 'עוד תיבה בחצר, עד 4. מוסיפה משבצות' },
    fence:        { icon: '🧱', blurb: 'גדר חתיכה אחרי חתיכה: עץ, אבן או מתכת' }
  };
})(typeof window !== 'undefined' ? window : globalThis);
