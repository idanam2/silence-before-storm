// Where the story stands in the game (plain data). Loaded after story/data/*.js.
// storyPlace: spot id -> { area?, x, y, r?, art }. `area` only when it differs from the spot's own `area` (the inside of a
//   building has its own area id, e.g. farm_in1). r = how close the player must be (px). art = how js/storyart.js draws it
//   ('none' = the object already exists on the map). A spot with no entry here does not exist in the game yet:
//   wiring a chapter = adding its spots here (the story data itself is never changed).
// storyHints: 'questId.stepId' -> an extra line under that step in the journal (how, not what).
// Wired so far: base, forest, farm, neighborhood (prologue, chapters 1-2), the police station (chapter 3) the hospital + quarry door (chapter 4) and the port (chapter 5).
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
    spot_hives:        { x: 1950, y: 1065, r: 90, art: 'hives' },

    // ---- police (chapter 3): the station is 'police' (outside), police_f1 / police_f2 (floors, 2400 x 1440). Spots sit in open floor next to the furniture.
    spot_relay_police: { x: 1800, y: 505, r: 60, art: 'relaymast' },
    spot_afik_van:     { x: 3290, y: 960, r: 70, art: 'van' },
    spot_evidence_locker: { area: 'police_f1', x: 1850, y: 215, r: 55, art: 'safebox' },
    spot_cell3:        { area: 'police_f1', x: 1760, y: 1235, r: 60, art: 'paper' },
    spot_commander_desk: { area: 'police_f2', x: 1680, y: 460, r: 60, art: 'paper' },
    spot_archive:      { area: 'police_f2', x: 1255, y: 440, r: 55, art: 'paper' },
    spot_armory_door:  { area: 'police_f2', x: 380, y: 740, r: 60, art: 'none' },
    spot_radio_room:   { area: 'police_f2', x: 1900, y: 1215, r: 60, art: 'paper' },
    spot_sgt_card:     { area: 'police_f2', x: 480, y: 1175, r: 55, art: 'paper' },

    // ---- hospital (chapter 4): the yard 'hospital' (helipad pad at 2900,1900), floors hospital_f1..f3 (2600 x 1440), and the quarry door
    spot_relay_hospital: { x: 2740, y: 1900, r: 60, art: 'relaymast' },
    spot_storage_f3:   { area: 'hospital_f3', x: 1115, y: 1150, r: 55, art: 'safebox' },
    spot_lab_f3:       { area: 'hospital_f3', x: 450, y: 1155, r: 60, art: 'paper' },
    spot_sigal_1:      { area: 'hospital_f2', x: 1600, y: 1170, r: 50, art: 'paper' },
    spot_sigal_2:      { area: 'hospital_f1', x: 300, y: 1230, r: 50, art: 'paper' },
    spot_sigal_3:      { area: 'hospital_f3', x: 2060, y: 1050, r: 50, art: 'paper' },
    spot_sigal_4:      { area: 'hospital_f3', x: 1700, y: 490, r: 50, art: 'paper' },
    spot_sigal_5:      { area: 'hospital_f1', x: 2080, y: 1030, r: 50, art: 'paper' },
    spot_nurse_keys:   { area: 'hospital_f2', x: 1650, y: 975, r: 55, art: 'none' },
    spot_pharmacy_fridge: { area: 'hospital_f1', x: 1480, y: 670, r: 55, art: 'safebox' },
    spot_antibiotics:  { area: 'hospital_f1', x: 1450, y: 760, r: 55, art: 'none' },
    spot_relay3_helmet:{ area: 'hospital_f2', x: 2160, y: 1290, r: 55, art: 'helmet' },

    // ---- quarry: the steel door in the rock wall north of the pit, the metal box beside it, the foreman's desk, the explosives container
    spot_lab_door:     { x: 1300, y: 300, r: 80, art: 'steeldoor' },
    spot_lab_door_listen: { x: 1300, y: 330, r: 120, art: 'none' },
    spot_dead_drop:    { x: 1430, y: 290, r: 55, art: 'safebox' },
    spot_foreman_office: { x: 1960, y: 2065, r: 60, art: 'paper' },
    spot_explosives:   { x: 2360, y: 2070, r: 60, art: 'none' },

    // ---- port (chapter 5): the quay (ship hull at y 560..830, quay from y 880), the harbour office is port_in3, the ship's rooms are data/story-areas.js
    spot_pa_desk:      { area: 'port_in3', x: 570, y: 340, r: 60, art: 'paper' },
    spot_queue_line:   { x: 1960, y: 2080, r: 180, art: 'none' },
    spot_relay_port:   { x: 2330, y: 1125, r: 65, art: 'relaymast' },
    spot_ship_hatch:   { x: 2560, y: 915, r: 60, art: 'hatch' },
    spot_ship_door:    { x: 2050, y: 915, r: 60, art: 'steeldoor' },
    spot_roni_engine:  { area: 'ship_engine', x: 1000, y: 560, r: 70, art: 'npc', look: 'partner' },
    spot_ship_log:     { area: 'ship_bridge', x: 700, y: 420, r: 60, art: 'paper' },
    spot_ship_watch:   { area: 'ship_bridge', x: 1190, y: 300, r: 60, art: 'paper' },
    spot_pa_box_1:     { x: 2080, y: 2100, r: 55, art: 'safebox' },
    spot_pa_box_2:     { x: 760, y: 950, r: 55, art: 'safebox' },
    spot_pa_box_3:     { x: 2500, y: 1456, r: 55, art: 'safebox' },
    spot_locked_container: { x: 2230, y: 1456, r: 60, art: 'none' }
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
    'mq_ch3.kit':         'שולחן העבודה (רמה 2): ערכת ממסר מהחלקים של פרק 2, אם עוד אין לך',
    'mq_ch3.key':         'קומה 2 של התחנה (המדרגות בפינה הצפון-מזרחית): משרד המפקד, E ליד השולחן',
    'mq_ch3.archive':     'קומה 2, חדר הארכיון: להחזיק E ליד הארון האחרון בשורה',
    'mq_ch3.relay':       'צפון הבניין (בחצר שמאחורי התחנה), סולם התורן: להחזיק E. זה רועש, ויגיעו אליך',
    'mq_ch3.dog':         'לחזור הביתה דרך שביל הבסיס; משהו מחכה ליד השער',
    'mq_ch3.report':      'הרדיו בבסיס: E ליד הנורית הירוקה',
    'mq_ch4.ask':         'הרדיו בבסיס: E ליד הנורית הירוקה',
    'mq_ch4.cool':        'בית החולים, קומה 3 (מדרגות בפינה הצפון-מזרחית): מחסן הציוד, להחזיק E',
    'mq_ch4.rotor':       'קומה 3: המעבדה בדרום-מערב, E ליד השולחן',
    'mq_ch4.meds':        'ערכות עזרה ראשונה: שולחן עבודה רמה 2. תחבושות: מהמדורה/המחסן או שלל',
    'mq_ch4.relay':       'חצר בית החולים, פינת המנחת בדרום-מזרח: להחזיק E. זה רועש',
    'mq_ch4.quarry':      'המחצבה במפה; הדלת בקיר הסלע בצפון הבור המדורג',
    'mq_ch4.door':        'E ליד הדלת, עם הצידנית והרוטור בתיק',
    'mq_ch4.drop':        'הארגז לצד הדלת: E, עם כל הציוד בתיק',
    'mq_ch5.ask':         'הרדיו בבסיס: E ליד הנורית הירוקה',
    'mq_ch5.pa':          'משרד הנמל (הבניין ליד השער): להחזיק E ליד השולחן הפנימי',
    'mq_ch5.ship':        'הספינה: גרם המדרגות בצד הרציף, E (אופציונלי)',
    'mq_ch5.relay':       'רגלי המנוף הגבוה, כל מה שרועש מושך אליך. להחזיק E',
    'mq_ch5.signal':      'ממשיכים עם הממסר; האות יופיע מעצמו',
    'mq_ch5.roni':        'פתח בצד הספינה, קרוב לקו המים: E. הוא מוביל לחדר המכונות',
    'mq_ch5.escort':      'ללכת עם רוני לשער הנמל (דרום). היא הולכת אחריך. יהיו דוממים בדרך',
    'mq_ch5.report':      'הרדיו בבסיס: E ליד הנורית הירוקה',
    'mq_ch1.chimes':      'הפעמונים תלויים באזור החווה; כל אחד נאסף ב-E. אם התיק מלא הם נכנסים למחסן בבסיס',
    'mq_ch1.deal':        'הפעמונים כבר אצלך: חזור לדבר עם רחל (E לידה) כדי למסור אותם. המשימה לא מתקדמת עד השיחה',
    'mq_ch1.fix':        'שולחן העבודה, עם אלקטרוניקה אחת (בחווה אפשר לפרק מכשירי קשר)',
    'mq_ch1.listen':      'הרדיו על אדן הבקתה: E ליד הנורית הירוקה'
  };

  // Chapter 4 sends the player to the quarry once the hospital relay stands, but only the storm (chapter 9) unlocked it: open the map entry now.
  G.data.storyTriggers.push({ id: 't_unlock_quarry_ch4', on: 'flag', match: 'relay_3', do: [{ do: 'unlock', area: 'quarry' }] });

  // Chapter 5: leaving the ship with Roni, the infected come to the quay (because of the relay and her key). Reaching the gate ends it (js/game-tick.js).
  G.data.storyTriggers.push({ id: 't_roni_escort_wave', on: 'enter_area', when: { area: 'port', flags: ['roni_met'], notFlags: ['roni_joined'] }, once: false, oncePerVisit: true,
    do: [{ do: 'spawn', wave: { count: 6, kinds: ['shambler', 'runner', 'shambler', 'runner', 'screamer', 'shambler'] }, near: 'player' }, { do: 'toast', text: 'דוממים מסביב לספינה. לשער הנמל, בדרום.' }] });

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
