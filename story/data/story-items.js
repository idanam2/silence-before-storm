// Story items and story recipes (plain data, no logic). SPOILERS: see story/README.md.
// Same shape as data/items.js and data/recipes.js, so wiring is: merge G.data.storyItems into G.data.items and
// append G.data.storyRecipes to G.data.recipes. Extra fields used only by the story layer:
//   key: true    -> quest item: one per slot, never lost on death, cannot be used up by "use", not sanitized away on load.
//   desc         -> one-line description for the backpack tooltip.
//   icon         -> hint for js/icons.js (what to draw).
//   unlock       -> on a recipe: a story flag that must be set before the recipe shows (G.state.story.flags).
(function (root) {
  'use strict';
  var G = root.G = root.G || {};
  G.data = G.data || {};

  G.data.storyItems = {
    radio_broken:     { name: `מכשיר קשר שבור`, stack: 1, key: true, kind: 'story', color: '#4a4f52', icon: 'radio with cracked face',
                        desc: `הרדיו מהמשמרת האחרונה. חסר סליל אנטנה וגביש.` },
    radio_coil:       { name: `סליל אנטנה`, stack: 1, key: true, kind: 'story', color: '#8a6a3a', icon: 'copper coil',
                        desc: `מהטרקטור של בעלה של רחל. נחושת טובה.` },
    radio_fixed:      { name: `רדיו מתוקן`, stack: 1, key: true, kind: 'story', color: '#3e5a5c', icon: 'radio with green light',
                        desc: `עובד. כמעט. לשים בבית, ליד החלון.` },
    relay_kit:        { name: `ערכת ממסר`, stack: 5, key: true, kind: 'story', color: '#5c6a70', icon: 'folded antenna and box',
                        desc: `אנטנה מתקפלת, מגבר קטן, סוללה. מספיק לממסר אחד.` },
    wind_chime:       { name: `פעמון רוח`, stack: 5, key: true, kind: 'story', color: '#9a9a8a', icon: 'three hanging tubes',
                        desc: `שלושה צינורות פליז. רחל לא ידעה שהם מצלצלים.` },
    compass_toy:      { name: `מצפן צעצוע`, stack: 1, key: true, kind: 'story', color: '#a04a3a', icon: 'red plastic compass',
                        desc: `פלסטיק אדום. החץ עדיין מצביע צפונה. כתוב עליו "יואב".` },
    bow_parts:        { name: `חלקי קשת`, stack: 1, kind: 'story', color: '#6b5034', icon: 'bow string and arrow heads',
                        desc: `מיתר, חודים, נוצות. מישהו התכוון לחזור לכאן.` },
    seeds:            { name: `זרעים`, stack: 50, kind: 'story', color: '#8a7a4a', icon: 'paper packet',
                        desc: `מרחל. "לא לאכול" כתוב על השקית, בכתב יד גדול.` },
    vegetables:       { name: `ירקות`, stack: 50, kind: 'food', color: '#5a7a3a', icon: 'carrot and leaves',
                        use: { hunger: 22, thirst: 4 }, desc: `מהערוגה. טעם של פעם.` },
    honey:            { name: `דבש`, stack: 50, kind: 'food', color: '#c08a2a', icon: 'jar',
                        use: { hunger: 18, energy: 10 }, desc: `מהכוורות של רחל. מתוק עד כאב.` },
    smoker:           { name: `מעשנה`, stack: 1, key: true, kind: 'story', color: '#6a5a4a', icon: 'tin can with spout',
                        desc: `פחית, בד וענפים. בשביל הדבורים של רחל.` },
    letter_rachel:    { name: `מכתב לגיל`, stack: 1, key: true, kind: 'story', color: '#c8bfa8', icon: 'folded letter',
                        desc: `מקופל ארבע פעמים. לא לקרוא.` },
    insulin:          { name: `אינסולין`, stack: 1, key: true, kind: 'story', color: '#9ab0b8', icon: 'small vials in a box',
                        desc: `שש מנות. התאריך עבר, אבל זה מה שיש.` },
    pharmacy_key:     { name: `מפתח בית המרקחת`, stack: 1, key: true, kind: 'story', color: '#a89a6a', icon: 'key on a red tag',
                        desc: `תווית אדומה: "מקרר — רק אחראית משמרת".` },
    music_box_broken: { name: `תיבת נגינה שבורה`, stack: 1, key: true, kind: 'story', color: '#7a5a4a', icon: 'small wooden box, open',
                        desc: `בנית אותה לבד, בלילה, מחלקים של שעון מעורר. הקפיץ קפץ.` },
    music_box:        { name: `תיבת נגינה`, stack: 1, key: true, kind: 'story', color: '#8a6a4a', icon: 'small wooden box, closed',
                        desc: `ארבעה צלילים. עולים ויורדים, והרביעי נשאר באוויר.` },
    cabinet_key:      { name: `מפתח ארון ראיות`, stack: 1, key: true, kind: 'story', color: '#8a8a8a', icon: 'small key',
                        desc: `היה בכיס של סמל אלמוג.` },
    commander_key:    { name: `מפתח הגג`, stack: 1, key: true, kind: 'story', color: '#9a8a5a', icon: 'heavy key ring',
                        desc: `"גג / תורן" על תווית מתקלפת.` },
    afik_badge:       { name: `תג עובד אפיק`, stack: 1, key: true, kind: 'story', color: '#3a5a8a', icon: 'id card with blue stripe',
                        desc: `"מכון אפיק — גישה: מעבדה ב'". התמונה שרוטה.` },
    coolbox:          { name: `צידנית תרופות`, stack: 1, key: true, kind: 'story', color: '#d0d4d0', icon: 'white cooler',
                        desc: `עדיין קרה מבפנים. איך?` },
    centrifuge_rotor: { name: `רוטור צנטריפוגה`, stack: 1, key: true, kind: 'story', color: '#8a9098', icon: 'metal disc with slots',
                        desc: `כבד מכפי שנראה. מאיה ביקשה "בדיוק את הדגם הזה".` },
    main_fuse:        { name: `נתיך ראשי`, stack: 1, key: true, kind: 'story', color: '#a0703a', icon: 'big ceramic fuse',
                        desc: `בגודל של בקבוק. מתחנת השאיבה.` },
    drive_belt:       { name: `רצועת הנעה`, stack: 1, key: true, kind: 'story', color: '#2a2a2a', icon: 'rubber belt loop',
                        desc: `זאב השתמש בה לסירה. לא נורא.` },
    fishing_rod:      { name: `חכה`, stack: 1, kind: 'tool', color: '#6a5a3a', icon: 'fishing rod',
                        desc: `של זאב. החוט עוד שלם.` },
    fish:             { name: `דג`, stack: 50, kind: 'food', color: '#6a8a9a', icon: 'fish',
                        use: { hunger: 10, health: -2 }, desc: `עדיף צלוי.` },
    fish_cooked:      { name: `דג צלוי`, stack: 50, kind: 'food', color: '#9a7a4a', icon: 'grilled fish',
                        use: { hunger: 30 }, desc: `` },
    keycard_hq:       { name: `כרטיס מפקדה`, stack: 1, key: true, kind: 'story', color: '#3a4a3a', icon: 'green keycard',
                        desc: `"רמת סיווג 3 — אגף קשר".` },
    hangar_key:       { name: `מפתח מגדל 4`, stack: 1, key: true, kind: 'story', color: '#6a6a4a', icon: 'key on a chain',
                        desc: `היה תלוי על לוח בהאנגר, ליד לוח משמרות ריק.` },
    amplifier:        { name: `מגבר מגדלור`, stack: 1, key: true, kind: 'story', color: '#2e3a2e', icon: 'military box with handles',
                        desc: `כבד. "תוכנית מגדלור — לא להפעיל ללא אישור" מוטבע בצד.` },
    flare_gun:        { name: `אקדח זיקוקים`, stack: 1, kind: 'tool', color: '#c04a2a', icon: 'orange flare pistol',
                        desc: `זיקוק אחד. אור ורעש רחוק ממך.` },
    ori_decoder:      { name: `המפענח של אורי`, stack: 1, key: true, kind: 'story', color: '#4a3a5a', icon: 'circuit board in a lunch box',
                        desc: `בתוך קופסת אוכל של ילדים. "זה מכניס קול לתוך האות. אל תשבור."` }
  };

  // Story recipes. unlock: the flag that shows the recipe (missing = always shown).
  G.data.storyRecipes = [
    { id: 'radio_fixed', station: 'workbench', level: 1, cat: 'home', out: ['radio_fixed', 1],
      cost: { radio_broken: 1, radio_coil: 1, electronics: 1 }, unlock: 'has_coil' },
    { id: 'relay_kit',   station: 'workbench', level: 1, cat: 'home', out: ['relay_kit', 1],
      cost: { metal: 4, electronics: 2, plank: 3, rope: 1 }, unlock: 'relay_blueprint' },
    { id: 'music_box',   station: 'workbench', level: 1, cat: 'home', out: ['music_box', 1],
      cost: { music_box_broken: 1, nails: 2, electronics: 1 }, unlock: 'found_music_box' },
    { id: 'smoker',      station: 'workbench', level: 1, cat: 'home', out: ['smoker', 1],
      cost: { cloth: 3, wood: 4 }, unlock: 'sq_hives_started' },
    { id: 'fish_cooked', station: 'campfire',  level: 1, cat: 'food', out: ['fish_cooked', 1],
      cost: { fish: 1 }, unlock: 'has_rod' }
    // The bow itself is not in the game yet (see CLAUDE.md: bow in chapter 2). When it is added:
    // recipe 'bow' unlock 'unlock_bow', and if the player has bow_parts the cost drops (bow_parts replaces the string/arrow materials).
  ];
})(typeof window !== 'undefined' ? window : globalThis);
