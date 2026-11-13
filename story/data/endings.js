// Endings and epilogue slides (plain data, no logic). SPOILERS: see story/README.md.
// The ending is picked by the flag dlg_final_choice sets (ending_hum / ending_broadcast / ending_song).
// Show as slow full-screen slides on black (fade 1.5s, each slide ~6s or click to continue). No flashing.
// Slide = { text, req?: { flags, notFlags }, motif?: true, hum?: true }
//   Slides with req are shown only if it matches. Order: ending.slides, then G.data.storyEpilogue (the shared mods), then ending.last.
// wall: the text of note_wall_last for this ending (the player can read it at the tally wall if the game continues after the ending).
(function (root) {
  'use strict';
  var G = root.G = root.G || {};
  G.data = G.data || {};

  G.data.storyEndings = {
    ending_hum: {
      title: `הזמזום`,
      slides: [
        { text: `הסערה נמשכה שלושה ימים. הם הלכו בתוכה, אב ובת, והרעש של הגשם הסתיר כל צעד.` },
        { text: `נועה לא דיברה בדרך. היא החזיקה לו את היד כמו בתור בנמל. הפעם הוא לא עזב.` },
        { text: `החום ירד ביום השישי. ביום התשיעי היא הסתכלה על המדורה ואמרה מילה אחת.`, },
        { text: `"אבא."` },
        { text: `מאחוריהם, בהר, לא נשמע כלום.`, req: { flags: ['amp_destroyed'] } },
        { text: `מאחוריהם, בהר, הרשת שבנה התעוררה בלילה העשירי. דופק קבוע, בכל התדרים. אחד שתיים. אחד שתיים.`, req: { flags: ['amp_left'] } },
        { text: `מאז, בלילות, הוא שומע צעדים בדרך הישנה. הרבה צעדים. כולם הולכים מזרחה. הוא לא מסתכל.`, req: { flags: ['amp_left'] } }
      ],
      last: [
        { text: `בלילה הראשון שבו ישנה במיטה משלה, היא זמזמה לו.`, hum: true },
        { text: `ארבעה צלילים. עולים ויורדים.`, motif: true },
        { text: `והרביעי נגמר.` }
      ],
      wall: `מחקתי את כל הקווים.
התחלתי מחדש. קו אחד ביום.
עכשיו אני סופר כמה ימים היא בבית.`
    },

    ending_broadcast: {
      title: `השידור`,
      slides: [
        { text: `הנוסחה שודרה ארבעים ושבע שעות ברציפות. בכל התדרים, בכל שבעת הממסרים, עד שהסוללות של הגיבוי נגמרו.` },
        { text: `ואז הטורבינה בסכר המשיכה לבד.` },
        { text: `נועה לא החלימה. אבל היא גם לא נעלמה. בכל ערב, היא מזמזמת. ובכל ערב, מישהו מזמזם איתה.`, motif: true },
        { text: `הוא לקח אותה הביתה. היא מציירת ליד המדורה. אנטנות, ועצים, ועז אחת.`, req: { flags: ['noa_home_sick'] } },
        { text: `היא נשארה בהר, עם מאיה והילדים. כל ערב, ברדיו, הוא מזמזם את שלושת הצלילים, והיא מסיימת את הרביעי.`, req: { flags: ['noa_with_maya'] } },
        { text: `ביום המאה וחמישה, ברדיו, בתדר שאף אחד לא השתמש בו:` },
        { text: `"...כאן מעבדה שתיים, באיים. קיבלנו. ייצרנו. זה עובד. חוזר: זה עובד. ממסר 7, אם אתה שומע..."` },
        { text: `אחר כך עוד קול. ועוד אחד. משפות שהוא לא מבין.` }
      ],
      last: [
        { text: `השקט נגמר כמו שסערה מתחילה. קודם טיפה. אחר כך הכול.` },
        { text: `הוא יושב ליד הרדיו כל ערב ומקשיב לעולם מדבר.` },
        { text: `ובין הקולות, ארבעה צלילים.`, motif: true }
      ],
      wall: `קו אחד לכל קול חדש ברדיו.
הקיר כבר לא מספיק.
התחלתי את הדלת.`
    },

    ending_song: {
      title: `השיר`,
      slides: [
        { text: `השיר התנגן ברשת כל הלילה. הסערה נשברה עליו ולא כיסתה אותו.`, motif: true },
        { text: `בכל האזור, בעיר, בשדות, בנמל, הדוממים עצרו. ישבו. הסתכלו לכיוון הקול הקרוב.` },
        { text: `הם לא נמשכו. הם לא תקפו. הם הקשיבו.` },
        { text: `מאיה פתחה את הדלת בסלע ונשארה לידה עד שהאחרון יצא אל הגשם. עומר החזיק לה את היד.` },
        { text: `כשהשחר עלה, הדלת הייתה פתוחה והמנהרה הייתה ריקה. על הקונסולה, המחברת שלה, פתוחה בעמוד האחרון: "הקצב מנוגד לנשא. נכון."` },
        { text: `נועה החלימה. לאט. כמו שלג שנמס.` },
        { text: `והנוסחה, עם השיר בלולאה, יצאה לים.` }
      ],
      last: [
        { text: `עכשיו, בכל ערב, בכל הרשת, ארבעה צלילים.`, motif: true },
        { text: `אנשים שעוד לא מדברים יושבים ליד רמקולים ומחכים לשיר.` },
        { text: `ונועה, ליד המיקרופון בבקתה, מסיימת את הרביעי. בשביל כולם.`, hum: true }
      ],
      wall: `לא סופר יותר.
יש שיר בשעה שמונה. זה כל הלוח שאני צריך.`
    }
  };

  // Shared epilogue slides: shown between an ending's slides and its last slides, each only if its flags match.
  G.data.storyEpilogue = [
    { text: `רחל קיבלה עוד חורף. ואחריו עוד אחד. היא כותבת על הלוח: "רזה. סוף סוף שמן."`, req: { flags: ['rachel_saved'] } },
    { text: `החווה עמדה ריקה באביב. על הקבר ליד העץ, חמישה פעמוני רוח קבורים באדמה, ולוח גיר אחד.`, req: { notFlags: ['rachel_saved'] } },
    { text: `רחל קברה את המכתב של גיל ליד אהרון. "שיהיו ביחד," כתבה. "שניהם ממהרים."`, req: { flags: ['rachel_letter_truth'] } },
    { text: `על השולחן בבית של גיל, ברחוב הדקלים, עדיין מחכה מכתב מקופל ארבע פעמים.`, req: { flags: ['rachel_letter_hope'] } },
    { text: `אורי בנה אנטנה על גג הבקתה. היא עקומה. הוא אומר שזה בכוונה.`, req: { flags: ['ori_home'] } },
    { text: `אורי נשאר במגדל. כל ערב הוא מקריא ברשת תחזית מזג אוויר. הוא אף פעם לא צודק.`, req: { flags: ['ori_on_line'] } },
    { text: `פלפל ישן ליד המדורה. הוא נובח רק פעם אחת ביום, בבוקר, כדי שידעו שהוא שם.`, req: { flags: ['dog_home'] } },
    { text: `ברציף בנמל, הרמקולים שותקים. מישהו תלה על העמוד ה-12 זר פרחים יבשים.`, req: { flags: ['pa_silenced'] } },
    { text: `על אדן החלון, מצפן אדום. החץ מצביע לים, לאן שהם הלכו ביחד.`, req: { flags: ['levi_found'] } },
    { text: `בקלטת האחרונה שלה, תמר ביקשה שמישהו יידע. הוא יודע. הוא מספר לנועה, יום אחד, כשהיא גדולה מספיק.`, req: { flags: ['tamar_heard_all'] } },
    { text: `בשתי קסדות צהובות, על המדף בבקתה: "ממסר 3", "ממסר 5". הוא מנקה אותן כל שבוע.`, req: { flags: ['knows_relay3', 'knows_relay5'] } }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
