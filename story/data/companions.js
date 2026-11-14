// Companions (the dog, Roni) and the cold: tuning numbers and story items (plain data, no logic). SPOILERS: see story/README.md.
// These are the STORY-SIDE numbers. The mechanics themselves (following, needs, cold meter, snow) are built by the world/build
// thread; when it builds them it should read the numbers from here so the story and the game agree. See story/07-expansion.md.
(function (root) {
  'use strict';
  var G = root.G = root.G || {};
  G.data = G.data || {};
  var I = G.data.storyItems = G.data.storyItems || {};
  var R = G.data.storyRecipes = G.data.storyRecipes || [];

  // ------------------------------------------------------------------ the dog: Pelpel (joins in chapter 3)
  G.data.storyDog = {
    name: `פלפל`,
    joinsFlag: 'dog_joined',                       // set by dlg_dog_arrives (chapter 3)
    // needs 0..100 (full = good). Drain per real minute while the game runs (not in menus / dialogue). Base = also at home.
    needs: {
      hunger: { label: `רעב`,   drain: 1.4, use: { dog_food: 45, canned_food: 30, cooked_food: 25, fish: 25, fish_cooked: 35 } },
      thirst: { label: `צמא`,   drain: 2.0, use: { water_clean: 40, water_dirty: 20 } },   // water bowl at the kennel refills both
      clean:  { label: `ניקיון`, drain: 0.6, washCost: { water_clean: 2 }, soapBonus: 30 }, // wash at the kennel (E), soap = cleaner + mood
      mood:   { label: `מצב רוח`, drain: 0.5, pet: 6, petCooldown: 30 }                        // pet (E, short): +6, once per 30 s
    },
    // what neglect does (checked once per real minute)
    neglect: {
      weakBelow: 20,           // any need under this: walks slowly, no sniffing, no attack, whines (quiet)
      barkBelowMood: 25,       // mood under this: barks when scared (noise 600) - a real risk on trips
      runAfterMinutes: 40,     // hunger or thirst at 0 continuously this long -> he runs away (flag dog_ran, quest sq_dog_lost)
      runOnce: false           // he can run away again later; sq_dog_lost can always bring him back
    },
    // what he does for you when well (all needs >= 50)
    abilities: {
      follow:  { gap: 70, run: 1.15 },                          // stays ~70px behind, runs a bit faster than the player
      warn:    { range: 520, growl: true },                     // growls (quiet) when an enemy that has not noticed you is within range
      sniff:   { key: 'KeyG', range: 700, show: 6, cooldown: 25 }, // highlights the nearest 6 loot spots/stashes for a few seconds
      attack:  { dmg: 9, hold: 2.5, cooldown: 6 },              // bites and holds one enemy (it cannot attack for `hold` s); on command or when you are hit
      stay:    { key: 'KeyH' }                                  // stay / follow toggle
    },
    hurt: { hp: 80, faintTo: 'base' },   // at 0 he does not die: he limps home and is at the kennel, needs refilled to 30
    kennel: {                            // new base building (see data/buildings.js style); bowls are part of it
      id: 'kennel', name: `מלונה`,
      levels: [
        { cost: { wood: 8, plank: 4 },               bowls: 1, note: `מלונה, קערת אוכל וקערת מים` },
        { cost: { plank: 8, nails: 6, cloth: 3 },    bowls: 2, note: `קערות גדולות (נמלאות פעמיים לאט יותר), מצע` },
        { cost: { plank: 10, nails: 8, cloth: 6 },   bowls: 3, warm: true, note: `מבודדת: שומרת עליו בקור (בבסיס בסערה ואחריה)` }
      ]
    }
  };

  // ------------------------------------------------------------------ Roni (joins in chapter 5)
  G.data.storyRoni = {
    name: `רוני`,
    joinsFlag: 'roni_joined',
    hp: 110,
    weapon: { prefer: ['pistol', 'm16', 'ak47', 'uzi'], ammoFromChest: true },  // uses guns the player gives her (E -> "לתת נשק")
    commands: { follow: true, stay: true, waitAtBase: true },                    // she can stay home and defend raids
    downed: { reviveHold: 3, bleedOut: 30, then: 'carried_home' },  // at 0 hp she falls; hold E 3 s within 30 s; else she wakes up at base (hurt)
    // the ONE story moment where she can be lost for good: during event peak_rescue (chapter 7), if she reaches 0 hp
    // OR the cold meter of the player hits 0 before reaching her. Then flag roni_lost (permanent).
    permanentDeath: ['peak_rescue'],
    skills: { repairVehicles: true, startGenerators: true, drive: true },
    injuredUntil: 'roni_leg_healed'   // until sq_roni_leg is done she walks slowly (x0.7) and cannot run
  };

  // ------------------------------------------------------------------ the cold (snow region "peak" and the final storm)
  G.data.storyCold = {
    meter: { label: `חום גוף`, max: 100 },
    // per second, in the snow region. warmth = sum of worn clothes' `warmth` (0..1, capped at 0.9)
    loss: { base: 1.6, wind: 1.0, blizzard: 2.2, wet: 0.8 },   // loss = (base + wind/blizzard if active) * (1 - warmth)
    gain: { fire: 6, indoorHeated: 3, indoor: 1, hotDrink: 25, handWarmer: 30 },
    effects: [
      { below: 60, text: `קר`, slow: 0.95 },
      { below: 35, text: `קופא`, slow: 0.85, noRun: true, frost: 0.4 },        // frost = screen-edge frost overlay strength
      { below: 15, text: `היפותרמיה`, slow: 0.7, noRun: true, frost: 0.8, healthPerSec: -1.2 }
    ],
    snowWalk: { normal: 0.8, deep: 0.55, snowshoes: 0.92 },     // speed multipliers on snow / deep drifts / with snow_boots
    noiseMul: { wind: 0.7, blizzard: 0.45 }                       // how much enemies hear in the snow
  };

  // warmth for the existing clothes in data/gear.js (merge into items[*].wear.warmth when wiring)
  G.data.storyWarmth = { cap: 0.10, jacket: 0.20, pants: 0.08, boots: 0.08, helmet: 0.02, vest: 0.05, hazsuit: 0.10,
                         parka: 0.40, wool_hat: 0.20, thermal_pants: 0.20, snow_boots: 0.18, aharon_coat: 0.32 };

  // ------------------------------------------------------------------ items
  I.dog_food      = { name: `אוכל לכלבים`, stack: 50, kind: 'food', color: '#7a5a3a', icon: 'can with paw',
                      desc: `שקית מנייר חום. פלפל יודע לשמוע אותה מכל מקום.` };
  I.soap          = { name: `סבון`, stack: 50, kind: 'story', color: '#d8c890', icon: 'bar of soap',
                      desc: `סבון דבש של רחל. מריח כמו קיץ.` };
  I.dog_sweater   = { name: `סוודר לכלב`, stack: 1, key: true, kind: 'story', color: '#8a3a3a', icon: 'small knitted sweater',
                      desc: `רחל סרגה. אדום. פלפל נעלב.` };
  I.aharon_coat   = { name: `המעיל של אהרון`, stack: 1, kind: 'wear', color: '#5a4a32', icon: 'thick work coat',
                      wear: { slot: 'body', armor: 0.08, warmth: 0.32 }, desc: `עבה, הרבה כיסים. ריח של טבק ישן.` };
  I.parka         = { name: `מעיל חורף`, stack: 1, kind: 'wear', color: '#3a4a5a', icon: 'padded parka',
                      wear: { slot: 'body', armor: 0.06, warmth: 0.40 }, desc: `מרופד. לא יפה. חם.` };
  I.wool_hat      = { name: `כובע סרוג`, stack: 1, kind: 'wear', color: '#6a3a4a', icon: 'knitted hat',
                      wear: { slot: 'head', armor: 0.02, warmth: 0.20 }, desc: `רחל סרגה. יש לו פונפון. אף אחד לא רואה.` };
  I.thermal_pants = { name: `מכנסיים תרמיים`, stack: 1, kind: 'wear', color: '#4a4a52', icon: 'thick trousers',
                      wear: { slot: 'legs', armor: 0.05, warmth: 0.20 }, desc: `` };
  I.snow_boots    = { name: `מגפי שלג`, stack: 1, kind: 'wear', color: '#3a3026', icon: 'boots with snowshoe frame',
                      wear: { slot: 'feet', armor: 0.04, warmth: 0.18, snowshoes: true }, desc: `עם מסגרת של רקטות שלג. הולכים כמו ברווז, אבל לא שוקעים.` };
  I.hot_tea       = { name: `תה חם`, stack: 50, kind: 'drink', color: '#8a6a3a', icon: 'steaming cup',
                      use: { thirst: 20, warmth: 25 }, desc: `מים חמים עם עלים שאני לא בטוח מה הם.` };
  I.hand_warmer   = { name: `מחמם ידיים`, stack: 50, kind: 'story', color: '#c07a3a', icon: 'small pouch',
                      use: { warmth: 30 }, desc: `שקיק כימי. לנער ולשים בכיס.` };
  I.splint        = { name: `קיבוע`, stack: 1, key: true, kind: 'story', color: '#9a9070', icon: 'wooden splint and cloth',
                      desc: `שני קרשים ותחבושות. לרגל של רוני.` };
  I.antibiotics   = { name: `אנטיביוטיקה`, stack: 1, key: true, kind: 'story', color: '#c0c8d0', icon: 'pill bottle',
                      desc: `"לפני האוכל". אין אוכל. נסתדר.` };
  I.father_watch  = { name: `שעון של קברניט`, stack: 1, key: true, kind: 'story', color: '#b09a5a', icon: 'old wristwatch',
                      desc: `שעון פלדה, זכוכית סדוקה. "ליוסף, 30 שנה בים".` };
  I.dish_motor    = { name: `מנוע צלחת`, stack: 1, key: true, kind: 'story', color: '#6a7078', icon: 'gear motor',
                      desc: `מנוע שמסובב את הצלחת על הרכס. קפוא, אבל שלם.` };
  I.station_key   = { name: `מפתח תחנת הרכס`, stack: 1, key: true, kind: 'story', color: '#8a9aa0', icon: 'key with blue tag',
                      desc: `"אפיק — תחנת שדה — רכס".` };
  I.diesel_can    = { name: `ג'ריקן סולר`, stack: 1, key: true, kind: 'story', color: '#5a6a3a', icon: 'jerrycan',
                      desc: `חצי מלא. מספיק לגנרטור של התחנה.` };

  R.push(
    { id: 'dog_food',      station: 'campfire',  level: 1, cat: 'food', out: ['dog_food', 2],      cost: { mushroom: 2, canned_food: 1 }, unlock: 'dog_joined' },
    { id: 'soap',          station: 'workbench', level: 1, cat: 'home', out: ['soap', 2],          cost: { honey: 1, water_clean: 1 }, unlock: 'rachel_soap' },
    { id: 'splint',        station: 'workbench', level: 1, cat: 'home', out: ['splint', 1],        cost: { plank: 2, bandage: 2 }, unlock: 'roni_joined' },
    { id: 'parka',         station: 'workbench', level: 2, cat: 'wear', out: ['parka', 1],         cost: { cloth: 10, rope: 1 }, unlock: 'peak_known' },
    { id: 'thermal_pants', station: 'workbench', level: 1, cat: 'wear', out: ['thermal_pants', 1], cost: { cloth: 6 }, unlock: 'peak_known' },
    { id: 'snow_boots',    station: 'workbench', level: 1, cat: 'wear', out: ['snow_boots', 1],    cost: { cloth: 3, plank: 2, rope: 1 }, unlock: 'peak_known' },
    { id: 'hot_tea',       station: 'campfire',  level: 1, cat: 'food', out: ['hot_tea', 2],       cost: { water_clean: 2, mushroom: 1 }, unlock: 'peak_known' }
  );
})(typeof window !== 'undefined' ? window : globalThis);
