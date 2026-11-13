// Side story: the cellar in the forest (plain data, no logic). Added after the main story files (load after endings.js).
// A small, self-contained quest in the rooms of data/places/forest.js: three pages of a log, then what was hidden behind
// the generator's panel. It does not touch the main plot. Rooms (forest_cellar): storage A (west, north), bunks C (middle north),
// generator D (east, north), radio room F (middle, south); the vault and the lab are boarded up (an axe opens them).
(function (root) {
  'use strict';
  var G = root.G = root.G || {};
  G.data = G.data || {};
  var D = G.data;

  function T(text) { return { who: 'eitan', mode: 'thought', text: text }; }
  function S(text) { return { who: 'system', mode: 'system', text: text }; }

  Object.assign(D.storyNewAreas = D.storyNewAreas || {}, {
    forest_cellar: { parent: 'forest', interior: true, hint: `המרתף ביער, מתחת ללוח הברזל (data/places/forest.js).` },
    forest_deep:   { parent: 'forest', interior: true, hint: `המנהרות שמתחת למרתף (data/places/forest.js).` }
  });

  D.storySpots.spot_cellar_log_1 = { area: 'forest_cellar', kind: 'use', label: `דף על המדף`, hint: `המחסן, בקצה המערבי-צפוני.`,
    on: [{ do: 'note', id: 'note_cellar_1' }] };
  D.storySpots.spot_cellar_log_2 = { area: 'forest_cellar', kind: 'use', label: `דף על הדרגש`, hint: `חדר הדרגשים.`,
    on: [{ do: 'note', id: 'note_cellar_2' }] };
  D.storySpots.spot_cellar_log_3 = { area: 'forest_cellar', kind: 'use', label: `דף ליד הרדיו`, hint: `חדר הרדיו, בדרום.`,
    on: [{ do: 'note', id: 'note_cellar_3' }] };
  D.storySpots.spot_cellar_panel = { area: 'forest_cellar', kind: 'hold', hold: 2, label: `לוח החשמל`, req: { flags: ['cellar_panel_known'] },
    deny: `סתם לוח חשמל ישן. אין לי סיבה לפתוח אותו.`, hint: `חדר הגנרטור.`,
    on: [{ do: 'give', item: 'ration', n: 3 }, { do: 'give', item: 'ammo', n: 15 }, { do: 'give', item: 'bandage', n: 2 }, { do: 'dialogue', id: 'dlg_cellar_end' }] };

  D.storyNotes.note_cellar_1 = { title: `דף קרוע, מדף ימני`, kind: 'paper', area: 'forest_cellar', author: `יורם`, series: 'cellar', text:
`יום 1.
שלוש שנים בניתי את המרתף הזה בשבתות. כולם צחקו.
השכנים לא צוחקים יותר.
המחסן והסדנה פה. הגנרטור בקצה. הכול סימנתי על הקיר בגיר, כדי שלא אצטרך לחשוב.
אם עוד לא הבנת: אל תדליק אור בלי לבדוק את הדלת.` };
  D.storyNotes.note_cellar_2 = { title: `דף מקופל, בין הדרגשים`, kind: 'paper', area: 'forest_cellar', author: `יורם`, series: 'cellar', text:
`יום 14.
ארבע מיטות. תכננתי שלוש.
בא ילד אחד, בלי הורים. ישן בדרגש העליון כי אמר שמשם רואים את הדלת.
בבוקר השארתי לו חצי מנה ופתק. הוא עזב לפני שקמתי.
לא יודע אם זה היה נכון. אני כותב כדי שמישהו ידע שניסיתי.` };
  D.storyNotes.note_cellar_3 = { title: `דף אחרון, ליד הרדיו`, kind: 'paper', area: 'forest_cellar', author: `יורם`, series: 'cellar', sets: ['cellar_panel_known'], text:
`יום 40.
הרדיו שותק. אני קורא בקול רם כדי שיהיה מישהו בחדר.
את המילואים החבאתי מאחורי לוח החשמל, בחדר הגנרטור. אף אחד לא מסתכל שם.
מי שמוצא את זה: קחו. ואת הדלת תסגרו אחריכם.
שני החדרים בדרום סגרתי בקרשים. אני לא רוצה לדעת. מי שרוצה, שיקח גרזן.` };

  D.storyDialogue.dlg_cellar_end = { start: 'a', nodes: {
    a: { lines: [
      S(`מאחורי הלוח, שקית אטומה: מנות, כדורים, תחבושות. מישהו ארז אותה בסדר מדוקדק.`),
      T(`יורם. אני לא מכיר אותו. אבל הוא השאיר את זה בשביל מישהו שלא הכיר.`),
      T(`אני סוגר את הדלת אחריי.`)
    ], end: true }
  } };

  D.storyQuests.sq_cellar = {
    title: `המרתף של יורם`, kind: 'side', chapter: 0, area: 'forest',
    summary: `מרתף מתחת ללוח ברזל ביער. מישהו חי כאן וכתב.`,
    steps: [
      { id: 'logs',  type: 'notes', notes: ['note_cellar_1', 'note_cellar_2', 'note_cellar_3'], text: `לקרוא את שלושת הדפים (מחסן, דרגשים, חדר הרדיו)` },
      { id: 'panel', type: 'spot', spot: 'spot_cellar_panel', text: `לוח החשמל בחדר הגנרטור` }
    ],
    done: [{ do: 'flag', id: 'cellar_done' }]
  };

  D.storyTriggers.push({ id: 't_cellar_enter', on: 'enter_area', when: { area: 'forest_cellar' }, do: [{ do: 'quest', id: 'sq_cellar' }] });

  Object.assign(D.storyFlags, { cellar_panel_known: `קרא איפה המילואים של יורם`, cellar_done: `פתח את המילואים של יורם` });
})(typeof window !== 'undefined' ? window : globalThis);
