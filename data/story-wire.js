// Where the story stands in the game (plain data). Loaded after story/data/*.js.
// storyPlace: spot id -> { area?, x, y, r?, art }. `area` only when it differs from the spot's own `area` (the inside of a
//   building has its own area id, e.g. farm_in1). r = how close the player must be (px). art = how js/storyart.js draws it
//   ('none' = the object already exists on the map). A spot with no entry here does not exist in the game yet:
//   wiring a chapter = adding its spots here (the story data itself is never changed).
// storyHints: 'questId.stepId' -> an extra line under that step in the journal (how, not what).
// Wired so far: base, forest and farm (prologue and chapter 1).
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  G.data.storyPlace = {
    // ---- base (no house any more; the yard is x 800..2400, y 480..1520, the way in from the north is x 1560..1650). The chalk board and
    // the radio table stand just inside the entrance, one on each side.
    spot_wall_tally:   { x: 1730, y: 590, r: 60, art: 'tally' },
    spot_home_radio:   { x: 1480, y: 590, r: 58, art: 'radio' },
    spot_amp_hideout:  { x: 1690, y: 1010, r: 50, art: 'hatch' },
    spot_garden:       { x: 1000, y: 1200, r: 80, art: 'garden' },

    // ---- forest (the main trail winds north from the exit at 1800, 2440)
    spot_levi_camp:    { x: 2600, y: 1330, r: 90, art: 'tent' },
    spot_marked_tree_1:{ x: 1790, y: 1960, r: 60, art: 'carving' },
    spot_marked_tree_2:{ x: 1600, y: 1760, r: 60, art: 'carving' },
    spot_marked_tree_3:{ x: 1400, y: 1330, r: 60, art: 'carving' },
    spot_hunter_cache: { x: 1130, y: 1160, r: 60, art: 'cache' },

    // ---- farm: farmhouse (520..900, 560..820), barn (1250..1870, 480..880), dirt road along y 880..990
    spot_rachel:       { x: 1465, y: 950, r: 60, art: 'npc', look: 'rachel' },
    spot_rachel_slate: { x: 1650, y: 952, r: 56, art: 'slate' },
    spot_goat:         { x: 1340, y: 1025, r: 52, art: 'goat' },
    spot_farm_kitchen: { area: 'farm_in1', x: 1120, y: 275, r: 70, art: 'none' },
    spot_chime_1:      { x: 585, y: 855, r: 52, art: 'chime' },
    spot_chime_2:      { x: 845, y: 855, r: 52, art: 'chime' },
    spot_chime_3:      { x: 1010, y: 705, r: 52, art: 'chime' },
    spot_chime_4:      { x: 1225, y: 905, r: 52, art: 'chime' },
    spot_chime_5:      { x: 2090, y: 705, r: 52, art: 'chime' },
    spot_tractor:      { x: 1155, y: 1112, r: 70, art: 'none' },

    // ---- neighborhood (3600 x 2600; entry from the south at 1800, 2440). The relay goes on the north-row corner house by the
    // avenue; "house 7" is the middle-row house neighborhood_in9 (its normal door is the way in, so spot_eitan_door is not placed);
    // house 12 is in13, the field-gear shop is in22 (the insides are placed below, from the real furniture).
    spot_relay_neighborhood: { x: 1675, y: 520, r: 60, art: 'relaymast' },
    spot_mailbag:      { x: 1800, y: 1180, r: 60, art: 'mailbag' },
    spot_dog_yard:     { x: 960, y: 2185, r: 50, art: 'dog' },
    spot_house12:      { x: 2845, y: 1410, r: 60, art: 'none' },

    // ---- forest cellar (side story, story/data/cellar.js): storage A, bunks C, radio room F, generator room D
    spot_cellar_log_1: { area: 'forest_cellar', x: 425, y: 330, r: 45, art: 'paper' },
    spot_cellar_log_2: { area: 'forest_cellar', x: 1500, y: 400, r: 50, art: 'paper' },
    spot_cellar_log_3: { area: 'forest_cellar', x: 1300, y: 1030, r: 50, art: 'paper' },
    spot_cellar_panel: { area: 'forest_cellar', x: 2380, y: 265, r: 50, art: 'safebox' },
    spot_gil_house:    { x: 1270, y: 2150, r: 40, art: 'none' },
    spot_hives:        { x: 1950, y: 1065, r: 90, art: 'hives' }
  };

  // Insides of neighborhood houses: the interiors are generated (and mirrored at random), so the spots follow the furniture.
  (function () {
    var A = G.data.areas, P = G.data.storyPlace;
    function furn(id, style, nth) { var a = A[id], n = 0, i; if (!a || !a.structures) return null; for (i = 0; i < a.structures.length; i++) if (a.structures[i].kind === 'furn' && a.structures[i].style === style && n++ === (nth || 0)) return a.structures[i]; return null; }
    var bunk = furn('neighborhood_in9', 'bunk');
    if (bunk) {
      var cx = bunk.x + bunk.w / 2;
      P.spot_noa_room = { area: 'neighborhood_in9', x: cx, y: 380, r: 170, art: 'none' };
      P.spot_noa_drawing = { area: 'neighborhood_in9', x: cx - 60, y: 410, r: 45, art: 'paper' };
      P.spot_creaky_board = { area: 'neighborhood_in9', x: cx + 60, y: 430, r: 50, art: 'plank' };
    }
    var bed = furn('neighborhood_in13', 'bunk');
    if (bed) P.spot_house12_safe = { area: 'neighborhood_in13', x: bed.x + bed.w / 2 + 40, y: 440, r: 45, art: 'safebox' };
    var ctr = furn('neighborhood_in22', 'counter');
    if (ctr) P.spot_hunting_shop = { area: 'neighborhood_in22', x: ctr.x + ctr.w / 2, y: ctr.y + ctr.h + 50, r: 60, art: 'paper' };
  })();

  G.data.storyHints = {
    'mq_ch2.kit':         'שולחן העבודה: 4 מתכת (גרוטאות), 2 אלקטרוניקה, 3 קרשים (מעץ), חבל (מבד)',
    'mq_ch2.relay':       'בית הפינה הגבוה בשורה הצפונית, ליד השדרה: להחזיק E ליד הסולם. זה רועש, ויגיעו אליך',
    'mq_ch2.home':        'בית 7 בשורה האמצעית: נכנסים ממש לחדר הקטן, בלי ללחוץ על כלום',
    'mq_ch2.report':      'הרדיו בבסיס: E ליד הנורית הירוקה',
    'mq_prologue.radio':  'המחסן: E ליד הארגז, ואז לחיצה על הפריט מעבירה אותו לתיק',
    'mq_prologue.bench':  'מקש B בבסיס פותח את חלונית הבנייה',
    'mq_prologue.open':   'עומדים ליד שולחן העבודה ולוחצים E, עם הרדיו בתיק',
    'mq_prologue.sleep':  'צריך מיטה (B), ואנרגיה מתחת ל-95: אפשר לצאת למסע קודם',
    'mq_ch1.chimes':      'הפעמונים תלויים באזור החווה; כל אחד נאסף ב-E. אם התיק מלא הם נכנסים למחסן בבסיס',
    'mq_ch1.deal':        'הפעמונים כבר אצלך: חזור לדבר עם רחל (E לידה) כדי למסור אותם. המשימה לא מתקדמת עד השיחה',
    'mq_ch1.fix':        'שולחן העבודה, עם אלקטרוניקה אחת (בחווה אפשר לפרק מכשירי קשר)',
    'mq_ch1.listen':      'הרדיו על אדן הבקתה: E ליד הנורית הירוקה'
  };

  // Random resources (trees, stones...) are kept away from story objects so nothing grows on top of them.
  G.data.storyClear = {};
  Object.keys(G.data.storyPlace).forEach(function (id) {
    var p = G.data.storyPlace[id], s = G.data.storySpots && G.data.storySpots[id], area = p.area || (s && s.area);
    if (!area || area === 'base') return;
    (G.data.storyClear[area] = G.data.storyClear[area] || []).push({ x: p.x, y: p.y, r: (p.r || 60) + 30 });
  });

  // Noise a ringing wind chime makes (the infected hear it, see js/game.js): the farm is dangerous until all five are down.
  G.data.noise = G.data.noise || {};
  G.data.noise.chime = 380;

  // The story hands out the equipment: weapons, metal, nails and the rest come from places and people (chapters 1-3).
  G.data.inventory.start = {
    bag: [['axe', 1], ['canned_food', 1], ['water_clean', 1]],
    chest: [['cloth', 10], ['bandage', 2]]
  };
})(typeof window !== 'undefined' ? window : globalThis);
