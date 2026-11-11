// The world map (plain data, no logic). Leaving the base means choosing one of these destinations.
// Every destination id is also an area id in data/areas.js. km: distance from the base.
// Energy cost of a trip = (energy.base + km * energy.perKm) * the difficulty's energy multiplier,
// paid once when leaving (the way back is free). risk 1..5: informational for now, used by enemies in stage 5.
// pos: place on the map panel in percent (x from the left, y from the top). The base is at the bottom.
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  G.data.world = {
    base: { name: 'הבסיס', pos: { x: 50, y: 88 } },
    energy: { base: 2, perKm: 2.4 },
    order: ['forest', 'farm', 'neighborhood', 'quarry', 'lake', 'police', 'hospital', 'port', 'military', 'airport'],
    destinations: {
      forest:       { km: 1,  risk: 1, pos: { x: 50, y: 72 }, blurb: 'היער הקרוב לבסיס. שקט יחסית, עצים ומים בשפע.' },
      farm:         { km: 3,  risk: 1, pos: { x: 29, y: 71 }, blurb: 'שדות ופרדס שהתפרע. מעט עצים, הרבה פטריות ואבנים.' },
      neighborhood: { km: 4,  risk: 2, pos: { x: 71, y: 66 }, blurb: 'רחובות ריקים ובתים שקרסו, קרוב מספיק לחזור באותו יום.' },
      quarry:       { km: 6,  risk: 2, pos: { x: 86, y: 49 }, blurb: 'חציבה ישנה ושדות סלעים. מקום טוב לאבן.' },
      lake:         { km: 7,  risk: 2, pos: { x: 20, y: 49 }, blurb: 'אגם גדול מאחורי סכר. מים, פטריות ויער צפוף.' },
      police:       { km: 9,  risk: 3, pos: { x: 62, y: 41 }, blurb: 'תחנה שננטשה בחופזה. הדרך אליה ארוכה.' },
      hospital:     { km: 11, risk: 3, pos: { x: 38, y: 34 }, blurb: 'מתחם גדול שהטבע חוזר ובולע.' },
      port:         { km: 13, risk: 4, pos: { x: 9,  y: 22 }, blurb: 'מזחים ריקים ומים רחבים. גזעים שהגיעו עם הגאות.' },
      military:     { km: 16, risk: 5, pos: { x: 77, y: 21 }, blurb: 'בסיס מגודר, רחוק ומסוכן. לא מקום לצאת אליו מותשים.' },
      airport:      { km: 20, risk: 5, pos: { x: 50, y: 10 }, blurb: 'מסלולים אינסופיים וקצה העולם המוכר.' }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
