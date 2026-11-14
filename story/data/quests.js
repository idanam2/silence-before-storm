// Quests: main chapters and side quests (plain data, no logic). SPOILERS: see story/README.md.
// Quest:
//   title, kind ('main' | 'side'), chapter (number shown in the journal), area (where it mostly happens),
//   summary (journal text; written so it never spoils what comes next),
//   start   how the quest begins: 'auto' (when the previous main quest completes, see `next`), or started by an action
//           { do: 'quest', id } from a spot / trigger / dialogue.
//   req     { flags: [...], chapter: n } extra conditions before it can start.
//   steps   in order. A step is done when its condition is met; the journal shows the first unfinished step.
//           optional: true -> shown with "(רשות)", does not block the next step.
//   done    actions when the last required step completes (same action list as triggers.js).
//   next    main quests only: the main quest that starts next.
// Step types:
//   spot      { spot }                    the spot was used (its `on` actions ran)
//   visit     { area }                    the player arrived in the area (or any of its floors)
//   item      { item, n }                 has at least n in the backpack (counted when it changes)
//   items     { items: {id: n} }          all of them in the backpack
//   collect   { item, n }                 gathered n since the step started (from resources, not from the chest)
//   craft     { recipe }                  crafted at least once since the step started
//   build     { building, level }         building at least this level (G.state.buildings)
//   dialogue  { id }                      that dialogue reached an end node
//   flag      { flag }                    a story flag is set
//   notes     { notes: [...] }            all these notes were read
//   sleep     {}                          slept in a bed
//   event     { id, n }                   a named story event fired n times (default 1), e.g. 'pa_box'
//   vehicle   { vehicle }                 that vehicle is built (G.state.vehicles has it; ids from data/vehicles.js: tank, heli, ...)
(function (root) {
  'use strict';
  var G = root.G = root.G || {};
  G.data = G.data || {};

  G.data.storyChapters = [
    { n: 0, id: 'prologue', title: `רעש לבן`,          quest: 'mq_prologue' },
    { n: 1, id: 'ch1',      title: `קול בתוך הרעש`,    quest: 'mq_ch1' },
    { n: 2, id: 'ch2',      title: `רחוב הדקלים`,      quest: 'mq_ch2' },
    { n: 3, id: 'ch3',      title: `ערוץ שבע`,         quest: 'mq_ch3' },
    { n: 4, id: 'ch4',      title: `מחלקה שלוש`,       quest: 'mq_ch4' },
    { n: 5, id: 'ch5',      title: `הרציף`,            quest: 'mq_ch5' },
    { n: 6, id: 'ch6',      title: `מים עומדים`,       quest: 'mq_ch6' },
    { n: 7, id: 'peak',     title: `הרכס הלבן`,        quest: 'mq_peak' },     // added in the expansion
    { n: 8, id: 'ch7',      title: `מגדלור`,           quest: 'mq_ch7' },      // note: quest ids kept from before the expansion,
    { n: 9, id: 'ch8',      title: `המגדל`,            quest: 'mq_ch8' },      // so mq_ch7 is chapter 8 and mq_ch8 is chapter 9
    { n: 10, id: 'finale',  title: `הסערה`,            quest: 'mq_finale' }
  ];

  G.data.storyQuests = {
    // ============================================================ MAIN
    mq_prologue: {
      title: `רעש לבן`, kind: 'main', chapter: 0, area: 'base', start: 'new_game',
      summary: `יום 427. עוד יום. אולי היום אני אפתח את הרדיו.`,
      steps: [
        { id: 'wall',   type: 'spot', spot: 'spot_wall_tally', text: `לסמן את היום על הקיר` },
        { id: 'radio',  type: 'item', item: 'radio_broken', n: 1, text: `להוציא את מכשיר הקשר מהמחסן` },
        { id: 'forest', type: 'visit', area: 'forest', text: `לצאת ליער (השביל מצפון לשער)` },
        { id: 'wood',   type: 'collect', item: 'wood', n: 10, text: `לאסוף 10 עץ` },
        { id: 'stone',  type: 'collect', item: 'stone', n: 5, text: `לאסוף 5 אבנים` },
        { id: 'bench',  type: 'build', building: 'workbench', level: 1, text: `לבנות שולחן עבודה (B)` },
        { id: 'open',   type: 'dialogue', id_: 'dlg_radio_open', text: `לפתוח את מכשיר הקשר על השולחן` },
        { id: 'sleep',  type: 'sleep', text: `לישון` }
      ],
      done: [{ do: 'unlock', area: 'farm' }, { do: 'flag', id: 'prologue_done' }],
      next: 'mq_ch1'
    },

    mq_ch1: {
      title: `קול בתוך הרעש`, kind: 'main', chapter: 1, area: 'farm', start: 'auto',
      summary: `לרדיו חסרים סליל וגביש. בחווה ממערב אולי יש רדיו ישן.`,
      steps: [
        { id: 'farm',    type: 'visit', area: 'farm', text: `להגיע לחווה` },
        { id: 'kitchen', type: 'spot', spot: 'spot_farm_kitchen', text: `לחפש רדיו בבית החווה`, optional: true },
        { id: 'rachel',  type: 'dialogue', id_: 'dlg_rachel_meet', text: `מישהו גר באסם` },
        { id: 'chimes',  type: 'item', item: 'wind_chime', n: 5, text: `להוריד את פעמוני הרוח (5)` },
        { id: 'deal',    type: 'dialogue', id_: 'dlg_rachel_chimes', text: `לחזור לרחל` },
        { id: 'coil',    type: 'spot', spot: 'spot_tractor', text: `לפרק את הסליל מהטרקטור` },
        { id: 'fix',     type: 'craft', recipe: 'radio_fixed', text: `לתקן את הרדיו בשולחן העבודה` },
        { id: 'listen',  type: 'dialogue', id_: 'dlg_maya_first', text: `להדליק את הרדיו בבית` }
      ],
      done: [{ do: 'flag', id: 'relay_blueprint' }, { do: 'unlock', area: 'neighborhood' }],
      next: 'mq_ch2'
    },

    mq_ch2: {
      title: `רחוב הדקלים`, kind: 'main', chapter: 2, area: 'neighborhood', start: 'auto',
      summary: `הקול ביקש ממסר על הבית הגבוה בשכונה. היא לא יודעת איזו שכונה זו.`,
      steps: [
        { id: 'kit',    type: 'craft', recipe: 'relay_kit', text: `להרכיב ערכת ממסר (שולחן עבודה)` },
        { id: 'go',     type: 'visit', area: 'neighborhood', text: `להגיע לשכונה` },
        { id: 'relay',  type: 'spot', spot: 'spot_relay_neighborhood', text: `להקים ממסר על בית הפינה` },
        { id: 'home',   type: 'dialogue', id_: 'dlg_home_return', text: `בית 7` },
        { id: 'report', type: 'dialogue', id_: 'dlg_maya_ch2', text: `לדבר עם הקול ברדיו` }
      ],
      done: [{ do: 'unlock', area: 'police' }],
      next: 'mq_ch3'
    },

    mq_ch3: {
      title: `ערוץ שבע`, kind: 'main', chapter: 3, area: 'police', start: 'auto',
      summary: `תורן המשטרה הוא הגבוה בעיר. הסולם לגג נעול.`,
      steps: [
        { id: 'kit',      type: 'item', item: 'relay_kit', n: 1, text: `ערכת ממסר בתיק` },
        { id: 'go',       type: 'visit', area: 'police', text: `להגיע לתחנת המשטרה` },
        { id: 'key',      type: 'spot', spot: 'spot_commander_desk', text: `למצוא את מפתח הגג (קומה 2)` },
        { id: 'archive',  type: 'spot', spot: 'spot_archive', text: `הארכיון` },
        { id: 'relay',    type: 'spot', spot: 'spot_relay_police', text: `להקים ממסר על התורן` },
        { id: 'dog',      type: 'dialogue', id_: 'dlg_dog_arrives', text: `לחזור הביתה` },
        { id: 'report',   type: 'dialogue', id_: 'dlg_maya_ch3', text: `לדבר עם מאיה` }
      ],
      done: [{ do: 'unlock', area: 'hospital' }],
      next: 'mq_ch4'
    },

    mq_ch4: {
      title: `מחלקה שלוש`, kind: 'main', chapter: 4, area: 'hospital', start: 'auto',
      summary: `מאיה צריכה ציוד רפואי. בשביל מי?`,
      steps: [
        { id: 'ask',    type: 'dialogue', id_: 'dlg_maya_ch4_ask', text: `להדליק את הרדיו` },
        { id: 'cool',   type: 'item', item: 'coolbox', n: 1, text: `צידנית תרופות (בית החולים, קומה 3)` },
        { id: 'rotor',  type: 'item', item: 'centrifuge_rotor', n: 1, text: `רוטור צנטריפוגה (המעבדה, קומה 3)` },
        { id: 'meds',   type: 'items', items: { firstaid: 2, bandage: 5 }, text: `2 ערכות עזרה ראשונה ו-5 תחבושות` },
        { id: 'relay',  type: 'spot', spot: 'spot_relay_hospital', text: `להקים ממסר על המנחת` },
        { id: 'quarry', type: 'visit', area: 'quarry', text: `להביא את הציוד לשער המחצבה` },
        { id: 'door',   type: 'dialogue', id_: 'dlg_quarry_door', text: `הדלת בסלע` },
        { id: 'drop',   type: 'event', id_: 'dead_drop', text: `להשאיר את הציוד בארגז` }
      ],
      done: [{ do: 'unlock', area: 'port' }],
      next: 'mq_ch5'
    },

    mq_ch5: {
      title: `הרציף`, kind: 'main', chapter: 5, area: 'port', start: 'auto',
      summary: `ממסר על המנוף בנמל. לא חזרתי לשם מיום 9.`,
      steps: [
        { id: 'ask',    type: 'dialogue', id_: 'dlg_maya_ch5_ask', text: `להדליק את הרדיו` },
        { id: 'kit',    type: 'item', item: 'relay_kit', n: 1, text: `ערכת ממסר בתיק` },
        { id: 'go',     type: 'visit', area: 'port', text: `לנסוע לנמל` },
        { id: 'pa',     type: 'spot', spot: 'spot_pa_desk', text: `משרד הנמל` },
        { id: 'ship',   type: 'spot', spot: 'spot_ship_log', text: `הספינה שנשארה`, optional: true },
        { id: 'relay',  type: 'spot', spot: 'spot_relay_port', text: `להקים ממסר על המנוף` },
        { id: 'signal', type: 'dialogue', id_: 'dlg_roni_signal', text: `אור בבטן הספינה` },
        { id: 'roni',   type: 'dialogue', id_: 'dlg_roni_meet', text: `חדר המכונות של הספינה` },
        { id: 'escort', type: 'dialogue', id_: 'dlg_roni_escaped', text: `להוציא אותה מהנמל בחיים` },
        { id: 'report', type: 'dialogue', id_: 'dlg_maya_ch5', text: `לדבר עם מאיה` }
      ],
      done: [{ do: 'unlock', area: 'lake' }],
      next: 'mq_ch6'
    },

    mq_ch6: {
      title: `מים עומדים`, kind: 'main', chapter: 6, area: 'lake', start: 'auto',
      summary: `לרשת צריך חשמל. בסכר יש טורבינה.`,
      steps: [
        { id: 'ask',     type: 'dialogue', id_: 'dlg_maya_ch6_ask', text: `להדליק את הרדיו` },
        { id: 'idea',    type: 'dialogue', id_: 'dlg_roni_tank_idea', text: `לדבר עם רוני על הדרך לסכר` },
        { id: 'tank',    type: 'vehicle', vehicle: 'tank', text: `לבנות טנק (מוסך טנק: B, ואז U בפנים)` },
        { id: 'go',      type: 'visit', area: 'lake', text: `להגיע לאגם בטנק (הדרך שקועה בבוץ)` },
        { id: 'fuse',    type: 'item', item: 'main_fuse', n: 1, text: `נתיך ראשי (בית הסירות)` },
        { id: 'belt',    type: 'item', item: 'drive_belt', n: 1, text: `רצועת הנעה (בקתת הדייג)` },
        { id: 'turbine', type: 'spot', spot: 'spot_turbine', text: `לתקן את הטורבינה (+6 מתכת, 2 חבל)` },
        { id: 'relay',   type: 'spot', spot: 'spot_relay_dam', text: `להקים ממסר על הסכר` },
        { id: 'hum',     type: 'dialogue', id_: 'dlg_noa_live', text: `הרדיו` },
        { id: 'report',  type: 'dialogue', id_: 'dlg_maya_ch6', text: `לדבר עם מאיה` }
      ],
      done: [],
      next: 'mq_peak'
    },

    mq_peak: {
      title: `הרכס הלבן`, kind: 'main', chapter: 7, area: 'peaks', start: 'auto',
      summary: `הקול של מאיה לא עובר את הרכס. למעלה יש צלחת, ושלג.`,
      steps: [
        { id: 'ask',     type: 'dialogue', id_: 'dlg_maya_peak_ask', text: `להדליק את הרדיו` },
        { id: 'roni',    type: 'dialogue', id_: 'dlg_roni_peak_go', text: `לספר לרוני` },
        { id: 'heli',    type: 'vehicle', vehicle: 'heli', text: `לבנות מסוק (מוסך מסוק: B, ואז U בפנים)` },
        { id: 'fly',     type: 'dialogue', id_: 'dlg_heli_first_flight', text: `טיסה ראשונה` },
        { id: 'warm',    type: 'items', items: { parka: 1 }, text: `להתלבש חם (מעיל חורף, כובע, מגפי שלג)`, optional: true },
        { id: 'go',      type: 'visit', area: 'peaks', text: `לטוס לרכס, עם רוני (אין דרך ברגל)` },
        { id: 'key',     type: 'item', item: 'station_key', n: 1, text: `מפתח התחנה` },
        { id: 'diesel',  type: 'item', item: 'diesel_can', n: 1, text: `סולר לגנרטור (בקתת הרכבל)` },
        { id: 'station', type: 'visit', area: 'peak_station', text: `תחנת הרכס` },
        { id: 'motor',   type: 'item', item: 'dish_motor', n: 1, text: `מנוע הצלחת (במחסן התחנה)` },
        { id: 'gen',     type: 'dialogue', id_: 'dlg_peak_generator', text: `רוני והגנרטור` },
        { id: 'dish',    type: 'spot', spot: 'spot_peak_dish', text: `לכוון את הצלחת` },
        { id: 'rescue',  type: 'event', id_: 'peak_rescue_done', text: `רוני` },
        { id: 'report',  type: 'dialogue', id_: 'dlg_maya_peak', text: `הרדיו` }
      ],
      done: [{ do: 'flag', id: 'peak_link' }, { do: 'unlock', area: 'military' }],
      next: 'mq_ch7'
    },

    mq_ch7: {
      title: `מגדלור`, kind: 'main', chapter: 8, area: 'military', start: 'auto',
      summary: `מגבר מהבסיס הצבאי, כדי שהאות יגיע לים.`,
      steps: [
        { id: 'ask',    type: 'dialogue', id_: 'dlg_maya_ch7_ask', text: `להדליק את הרדיו` },
        { id: 'go',     type: 'visit', area: 'military', text: `להגיע לבסיס הצבאי (בטנק או במסוק: שדה בוץ ומוקשים)` },
        { id: 'card',   type: 'spot', spot: 'spot_officer_bunk', text: `כרטיס כניסה למפקדה (המגורים)` },
        { id: 'amp',    type: 'spot', spot: 'spot_hq_comms', text: `המגבר בחדר התקשורת` },
        { id: 'files',  type: 'spot', spot: 'spot_hq_files', text: `ארון המסמכים`, optional: true },
        { id: 'relay',  type: 'spot', spot: 'spot_relay_military', text: `להקים ממסר על מגדל השמירה` },
        { id: 'report', type: 'dialogue', id_: 'dlg_maya_ch7', text: `לדבר עם מאיה` }
      ],
      done: [{ do: 'unlock', area: 'airport' }],
      next: 'mq_ch8'
    },

    mq_ch8: {
      title: `המגדל`, kind: 'main', chapter: 9, area: 'airport', start: 'auto',
      summary: `הקול השני ביקש שאבוא. ושאביא אוכל.`,
      steps: [
        { id: 'call',    type: 'dialogue', id_: 'dlg_ori_call', text: `להדליק את הרדיו` },
        { id: 'food',    type: 'items', items: { canned_food: 3 }, text: `3 שימורים בתיק` },
        { id: 'go',      type: 'visit', area: 'airport', text: `לטוס לשדה התעופה (הכבישים חסומים)` },
        { id: 'door',    type: 'dialogue', id_: 'dlg_ori_door', text: `מגדל הפיקוח` },
        { id: 'meet',    type: 'dialogue', id_: 'dlg_ori_meet', text: `אורי` },
        { id: 'decide',  type: 'dialogue', id_: 'dlg_ori_decision', text: `להחליט` },
        { id: 'relay',   type: 'spot', spot: 'spot_relay_airport', text: `הממסר האחרון` },
        { id: 'report',  type: 'dialogue', id_: 'dlg_maya_ch8', text: `הרדיו` }
      ],
      done: [{ do: 'flag', id: 'storm' }, { do: 'unlock', area: 'quarry' }],
      next: 'mq_finale'
    },

    mq_finale: {
      title: `הסערה`, kind: 'main', chapter: 10, area: 'quarry', start: 'auto',
      summary: `הרשת חיה. הסערה מגיעה מהים.`,
      steps: [
        { id: 'go',      type: 'visit', area: 'quarry', text: `למחצבה` },
        { id: 'tunnel',  type: 'visit', area: 'lab_tunnel', text: `הדלת פתוחה` },
        { id: 'lab',     type: 'visit', area: 'lab_main', text: `המעבדה` },
        { id: 'talk',    type: 'dialogue', id_: 'dlg_finale_maya', text: `מאיה` },
        { id: 'choose',  type: 'flag', flag: 'ending_chosen', text: `קונסולת השידור` }
      ],
      done: [{ do: 'event', id: 'play_ending' }]
    },

    // ============================================================ SIDE: base
    sq_wall_days: {
      title: `ימים על הקיר`, kind: 'side', chapter: 0, area: 'base', start: 'new_game',
      summary: `קו אחד ביום. מחשבה אחת בפרק.`,
      steps: [{ id: 'all', type: 'event', id_: 'wall_read', n: 10, text: `לחזור לקיר בכל פרק` }],
      done: [{ do: 'note', id: 'note_wall_last' }]
    },
    sq_garden: {
      title: `ערוגה`, kind: 'side', chapter: 1, area: 'base', req: { flags: ['rachel_deal_done'] },
      summary: `רחל נתנה זרעים. "לא לאכול."`,
      steps: [
        { id: 'build', type: 'event', id_: 'garden_built', text: `לבנות ערוגה (B)` },
        { id: 'water', type: 'event', id_: 'garden_water', n: 3, text: `להשקות במים נקיים (3 פעמים)` }
      ],
      done: [{ do: 'give', item: 'vegetables', n: 5 }, { do: 'flag', id: 'garden_grows' }]
    },

    // ============================================================ EXPANSION: the dog, Roni, the ridge
    sq_kennel: {
      title: `בית לפלפל`, kind: 'side', chapter: 3, area: 'base',
      summary: `כלב צריך מלונה, קערות, ומישהו שיזכור לרחוץ אותו.`,
      steps: [
        { id: 'build', type: 'build', building: 'kennel', level: 1, text: `לבנות מלונה (B)` },
        { id: 'feed',  type: 'event', id_: 'dog_fed_bowl', text: `למלא את קערת האוכל` },
        { id: 'water', type: 'event', id_: 'dog_watered', text: `למלא את קערת המים` },
        { id: 'wash',  type: 'event', id_: 'dog_washed', text: `לרחוץ אותו (מים נקיים, סבון אם יש)` }
      ],
      done: [{ do: 'flag', id: 'kennel_done' }]
    },
    sq_dog_lost: {
      title: `פלפל הלך`, kind: 'side', chapter: 3, area: 'neighborhood',
      summary: `המלונה ריקה. עקבות לכיוון העיר.`,
      steps: [
        { id: 'food', type: 'item', item: 'dog_food', n: 1, text: `אוכל לכלבים בתיק` },
        { id: 'find', type: 'dialogue', id_: 'dlg_dog_return', text: `החצר ברחוב הדקלים` }
      ],
      done: []
    },
    sq_roni_leg: {
      title: `הרגל של רוני`, kind: 'side', chapter: 5, area: 'hospital',
      summary: `הרגל מזוהמת. צריך אנטיביוטיקה וקיבוע אמיתי.`,
      steps: [
        { id: 'pills',  type: 'item', item: 'antibiotics', n: 1, text: `אנטיביוטיקה (בית המרקחת בבית החולים)` },
        { id: 'splint', type: 'craft', recipe: 'splint', text: `להכין קיבוע (שולחן עבודה)` },
        { id: 'treat',  type: 'dialogue', id_: 'dlg_roni_leg', text: `לטפל בה ליד המדורה` }
      ],
      done: []
    },
    sq_roni_ship: {
      title: `הגשר הנעול`, kind: 'side', chapter: 5, area: 'port', req: { flags: ['roni_joined'] },
      summary: `אבא של רוני נעל את עצמו על גשר הספינה ביום 9.`,
      steps: [
        { id: 'watch', type: 'item', item: 'father_watch', n: 1, text: `גשר הפיקוד של הספינה` },
        { id: 'tell',  type: 'dialogue', id_: 'dlg_roni_father', text: `לספר לרוני` }
      ],
      done: []
    },
    sq_roni_rachel: {
      title: `להכיר את רחל`, kind: 'side', chapter: 5, area: 'farm', req: { flags: ['roni_leg_healed'] },
      summary: `רוני רוצה לפגוש את "היחידה שאתה מפחד ממנה".`,
      steps: [{ id: 'visit', type: 'dialogue', id_: 'dlg_roni_rachel', text: `לבקר בחווה עם רוני` }],
      done: []
    },
    sq_rachel_wool: {
      title: `צמר של גברת`, kind: 'side', chapter: 7, area: 'farm', req: { flags: ['peak_known'] },
      summary: `רחל מרגישה שאני הולך לקור.`,
      steps: [
        { id: 'hat',     type: 'dialogue', id_: 'dlg_rachel_wool', text: `לבקר את רחל` },
        { id: 'sweater', type: 'dialogue', id_: 'dlg_dog_sweater', text: `להביא לרחל 3 בד בשביל סוודר לפלפל`, optional: true }
      ],
      done: []
    },

    // ============================================================ SIDE: forest
    sq_levi_family: {
      title: `המחנה של משפחת לוי`, kind: 'side', chapter: 0, area: 'forest',
      summary: `אוהל, עגלה ומצפן של ילד בשם יואב. הם הלכו מערבה.`,
      steps: [
        { id: 'camp',  type: 'notes', notes: ['note_levi_1'], text: `המחנה ביער` },
        { id: 'lake',  type: 'notes', notes: ['note_levi_2'], text: `לאן הם הלכו? (אולי לאגם)` }
      ],
      done: [{ do: 'flag', id: 'levi_found' }, { do: 'dialogue', id: 'dlg_levi_end' }]
    },
    sq_marked_trees: {
      title: `עץ הסימנים`, kind: 'side', chapter: 1, area: 'forest',
      summary: `חץ חרוט בעץ. מישהו סימן דרך.`,
      steps: [
        { id: 't2',    type: 'spot', spot: 'spot_marked_tree_2', text: `החץ הבא` },
        { id: 't3',    type: 'spot', spot: 'spot_marked_tree_3', text: `החץ השלישי` },
        { id: 'cache', type: 'spot', spot: 'spot_hunter_cache', text: `מה מחכה בסוף` }
      ],
      done: []
    },

    // ============================================================ SIDE: farm
    sq_hives: {
      title: `הכוורות`, kind: 'side', chapter: 1, area: 'farm', req: { flags: ['rachel_deal_done'] },
      summary: `רחל צריכה מעשנה לכוורות. היא תסביר תוך כדי.`,
      steps: [
        { id: 'smoker', type: 'craft', recipe: 'smoker', text: `להכין מעשנה (שולחן עבודה)` },
        { id: 'hives',  type: 'event', id_: 'hives_smoked', text: `לעשן את הכוורות עם רחל` },
        { id: 'talk',   type: 'dialogue', id_: 'dlg_rachel_rhythm', text: `לשבת עם רחל` }
      ],
      done: [{ do: 'give', item: 'honey', n: 4 }, { do: 'flag', id: 'rachel_rhythm' }]
    },
    sq_insulin: {
      title: `אינסולין לרחל`, kind: 'side', chapter: 1, area: 'hospital', req: { flags: ['rachel_deal_done'] },
      summary: `רחל לא אמרה כלום. ראיתי את המזרקים הריקים. בבית החולים אולי נשאר משהו.`,
      steps: [
        { id: 'key',    type: 'item', item: 'pharmacy_key', n: 1, text: `מפתח המקרר (עמדת האחיות, קומה 2)` },
        { id: 'fridge', type: 'item', item: 'insulin', n: 1, text: `מקרר בית המרקחת (קומה 1)` },
        { id: 'give',   type: 'dialogue', id_: 'dlg_rachel_insulin', text: `להביא לרחל` }
      ],
      done: [{ do: 'flag', id: 'rachel_saved' }, { do: 'give', item: 'cloth', n: 8 }]
    },
    sq_rachel_letter: {
      title: `מכתב לגיל`, kind: 'side', chapter: 2, area: 'neighborhood', req: { flags: ['rachel_deal_done'], chapter: 2 },
      summary: `רחל ביקשה למסור מכתב לבן שלה, בשכונה.`,
      steps: [
        { id: 'take',  type: 'item', item: 'letter_rachel', n: 1, text: `לקחת את המכתב מרחל` },
        { id: 'house', type: 'flag', flag: 'gil_found', text: `הבית של גיל (בית עם תיבת דואר כתומה)` },
        { id: 'tell',  type: 'dialogue', id_: 'dlg_rachel_gil', text: `לחזור לרחל` }
      ],
      done: []
    },

    // ============================================================ SIDE: neighborhood
    sq_music_box: {
      title: `מתחת לקרש החורק`, kind: 'side', chapter: 2, area: 'neighborhood',
      summary: `תיבת הנגינה שבניתי לה. הקפיץ קפץ.`,
      steps: [
        { id: 'fix',  type: 'craft', recipe: 'music_box', text: `לתקן בשולחן העבודה (2 מסמרים, 1 אלקטרוניקה)` },
        { id: 'play', type: 'dialogue', id_: 'dlg_music_box_play', text: `לנגן` }
      ],
      done: [{ do: 'flag', id: 'has_music_box' }]
    },
    sq_dog: {
      title: `פלפל`, kind: 'side', chapter: 2, area: 'neighborhood',
      summary: `כלב בחצר. רזה. נובח ובורח.`,
      steps: [
        { id: 'feed', type: 'event', id_: 'dog_fed', n: 3, text: `להשאיר לו שימורים (3 ביקורים שונים)` }
      ],
      // expansion: the dog no longer comes home here; he joins in chapter 3 (dlg_dog_arrives). Feeding him now = he trusts you more then.
      done: [{ do: 'flag', id: 'dog_trust' }, { do: 'toast', text: `פלפל אכל מהיד שלי. הוא עדיין לא בא איתי.` }]
    },
    sq_house12: {
      title: `בית מספר 12`, kind: 'side', chapter: 2, area: 'neighborhood',
      summary: `קרשים על החלונות מבפנים. מישהו התבצר כאן.`,
      steps: [
        { id: 'tapes', type: 'notes', notes: ['note_house12_1', 'note_house12_2'], text: `להקשיב לטייפ` },
        { id: 'safe',  type: 'spot', spot: 'spot_house12_safe', text: `הכספת בחדר השינה` }
      ],
      done: []
    },
    sq_postman: {
      title: `שק הדואר`, kind: 'side', chapter: 2, area: 'neighborhood',
      summary: `מכתבים שאף אחד לא קיבל.`,
      steps: [{ id: 'read', type: 'notes', notes: ['note_mail_1', 'note_mail_2', 'note_mail_3', 'note_mail_4', 'note_mail_5'], text: `לקרוא את המכתבים` }],
      done: [{ do: 'give', item: 'cloth', n: 2 }]
    },

    // ============================================================ SIDE: police
    sq_cell3: {
      title: `תא 3`, kind: 'side', chapter: 3, area: 'police',
      summary: `מישהו חרט ימים על קיר התא. הסמל ליד הדלת החזיק מפתח.`,
      steps: [{ id: 'locker', type: 'spot', spot: 'spot_evidence_locker', text: `ארון הראיות (חדר ההלבשה)` }],
      done: [{ do: 'quest', id: 'sq_armory' }]
    },
    sq_armory: {
      title: `הנשקייה`, kind: 'side', chapter: 3, area: 'police',
      summary: `הפנקס של סמל אלמוג. חמש ספרות.`,
      steps: [
        { id: 'code', type: 'notes', notes: ['note_sgt_notebook', 'note_sgt_daughter'], text: `למצוא את הצירוף` },
        { id: 'open', type: 'spot', spot: 'spot_armory_door', text: `הנשקייה (קומה 2)` }
      ],
      done: []
    },
    sq_tow_lot: {
      title: `רכב 2`, kind: 'side', chapter: 3, area: 'police',
      summary: `ואן לבן עם פס כחול. "מכון אפיק".`,
      steps: [{ id: 'read', type: 'notes', notes: ['note_afik_van'], text: `לבדוק את הוואן` }],
      done: []
    },

    // ============================================================ SIDE: hospital
    sq_sigal_diary: {
      title: `היומן של סיגל`, kind: 'side', chapter: 4, area: 'hospital',
      summary: `דפים מקופלים בכתב יד של אחות.`,
      steps: [{ id: 'all', type: 'notes', notes: ['note_sigal_1', 'note_sigal_2', 'note_sigal_3', 'note_sigal_4', 'note_sigal_5'], text: `5 דפים בשלוש הקומות` }],
      done: [{ do: 'flag', id: 'knows_ward3' }]
    },
    sq_relay3: {
      title: `ממסר 3`, kind: 'side', chapter: 4, area: 'hospital',
      summary: `קסדה של טכנאי. "ממסר 3". הכרתי את המספר הזה.`,
      steps: [{ id: 'read', type: 'notes', notes: ['note_relay3_log'], text: `היומן שלו` }],
      done: [{ do: 'dialogue', id: 'dlg_relay3_thought' }]
    },

    // ============================================================ SIDE: quarry
    sq_foreman: {
      title: `מנהל העבודה`, kind: 'side', chapter: 4, area: 'quarry',
      summary: `שלמה כתב על משאיות בלי סימון שנכנסו בלילות.`,
      steps: [{ id: 'shed', type: 'spot', spot: 'spot_explosives', text: `מחסן חומרי הנפץ (מכולה)` }],
      done: []
    },

    // ============================================================ SIDE: port
    sq_pa_silence: {
      title: `לכבות את הרמקולים`, kind: 'side', chapter: 5, area: 'port', req: { flags: ['knows_pa'] },
      summary: `שלושה ארונות חשמל. אני חיברתי אותם. אני אנתק.`,
      steps: [{ id: 'boxes', type: 'event', id_: 'pa_box', n: 3, text: `לנתק 3 ארונות חשמל` }],
      done: [{ do: 'flag', id: 'pa_silenced' }, { do: 'dialogue', id: 'dlg_pa_off' }]
    },
    sq_container: {
      title: `המכולה הנעולה`, kind: 'side', chapter: 5, area: 'port',
      summary: `סימני גיר על דלת מכולה.`,
      steps: [{ id: 'read', type: 'notes', notes: ['note_container'], text: `לפתוח את המכולה` }],
      done: []
    },

    // ============================================================ SIDE: lake
    sq_dam_full: {
      title: `לחץ מלא`, kind: 'side', chapter: 6, area: 'lake', req: { flags: ['dam_power'] },
      summary: `הטורבינה מסתובבת בחצי כוח. משהו חוסם את המים.`,
      steps: [
        { id: 'logs', type: 'event', id_: 'trash_rack', n: 3, text: `לפנות 3 גושי גזעים (גרזן)` },
        { id: 'tune', type: 'dialogue', id_: 'dlg_dam_full', text: `לחזור לטורבינה` }
      ],
      done: [{ do: 'flag', id: 'dam_full_power' }]
    },
    sq_fishing: {
      title: `חכה`, kind: 'side', chapter: 6, area: 'lake',
      summary: `החכה של זאב.`,
      steps: [{ id: 'fish', type: 'collect', item: 'fish', n: 3, text: `לדוג 3 דגים (מזח הסירות)` }],
      done: []
    },

    // ============================================================ SIDE: military
    sq_tamar_tapes: {
      title: `ההקלטות של תמר`, kind: 'side', chapter: 8, area: 'military',
      summary: `"רס"ן ארד, יומן קשר." שלוש קלטות.`,
      steps: [{ id: 'all', type: 'notes', notes: ['rec_tamar_1', 'rec_tamar_2', 'rec_tamar_3'], text: `3 קלטות בבסיס` }],
      done: [{ do: 'flag', id: 'tamar_heard_all' }, { do: 'dialogue', id: 'dlg_tamar_thought' }]
    },
    sq_tower4: {
      title: `מגדל 4`, kind: 'side', chapter: 8, area: 'military',
      summary: `מפתח עם תווית "מגדל 4".`,
      steps: [{ id: 'open', type: 'spot', spot: 'spot_tower4_cache', text: `מגדל השמירה הדרום-מזרחי` }],
      done: []
    },
    sq_relay5: {
      title: `ממסר 5`, kind: 'side', chapter: 8, area: 'military',
      summary: `עוד קסדה. עוד מספר.`,
      steps: [{ id: 'read', type: 'notes', notes: ['note_relay5_log'], text: `היומן שלו` }],
      done: [{ do: 'dialogue', id: 'dlg_relay5_thought' }]
    },

    // ============================================================ SIDE: airport
    sq_luggage: {
      title: `מזוודות`, kind: 'side', chapter: 9, area: 'airport',
      summary: `אנשים שלא המריאו.`,
      steps: [{ id: 'all', type: 'notes', notes: ['note_luggage_1', 'note_luggage_2', 'note_luggage_3', 'note_luggage_4'], text: `4 מזוודות` }],
      done: []
    },
    sq_crash: {
      title: `המטוס הקטן`, kind: 'side', chapter: 9, area: 'airport',
      summary: `מישהו ניסה לנחות כאן אחרי שהמגדל אמר "אין נחיתות".`,
      steps: [{ id: 'read', type: 'notes', notes: ['note_pilot'], text: `תא הטייס` }],
      done: []
    },
    sq_ori_trust: {
      title: `לסמוך על אורי`, kind: 'side', chapter: 9, area: 'airport', start: 'new_game', hidden: true,
      summary: `(נסתרת: לא מוצגת ביומן. נספרת מתחילת המשחק, מבחירות בשיחות עם אורי ועם מאיה.)`,
      steps: [{ id: 'points', type: 'event', id_: 'ori_trust_point', n: 3, text: `` }],
      done: [{ do: 'flag', id: 'ori_trust' }]   // the decoder itself is handed over by trigger t_ori_decoder
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
