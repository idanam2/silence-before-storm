// The world map (plain data, no logic). Leaving the base means choosing one of these destinations.
// Every destination id is also an area id in data/areas.js. km: distance from the base.
// Energy cost of a trip = (energy.base + km * energy.perKm) * the difficulty's energy multiplier,
// paid once when leaving (the way back is free). risk 1..5: informational for now, used by enemies in stage 5.
// finds: optional item ids shown on the map instead of the computed summary (for hand-built places).
// pos: place on the map panel in percent (x from the left, y from the top). The base is at the bottom.
// geo: what the painted map shows (js/mapart.js). x, y in percent of the map width / height; sizes (r, w) in
// percent of the map height, so round things stay round. routes: the road from the base to each destination.
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  // Roads branch off one another, so each route is the route it leaves from plus its own stretch.
  var R = {};
  R.trunk = [[50, 88], [50, 82]];
  R.forest = R.trunk.concat([[50, 72]]);
  R.farm = R.trunk.concat([[42, 78], [34, 73], [29, 71]]);
  R.lake = R.farm.concat([[26, 63], [23, 55], [20, 49]]);
  R.east = R.trunk.concat([[55, 76]]);
  R.neighborhood = R.east.concat([[63, 70], [71, 66]]);
  R.north = R.east.concat([[57, 64], [60, 56]]);
  R.quarry = R.north.concat([[70, 52], [79, 50], [86, 49]]);
  R.peaks = R.quarry.concat([[88, 43], [92, 37], [93, 32]]);
  R.town = R.north.concat([[62, 48]]);
  R.police = R.town.concat([[62, 41]]);
  R.hospital = R.town.concat([[55, 42], [46, 37], [38, 34]]);
  R.port = R.hospital.concat([[30, 31], [23, 28], [17, 25], [13, 22]]);
  R.military = R.police.concat([[64, 33], [70, 27], [77, 21]]);
  R.airport = R.police.concat([[60, 32], [55, 20], [50, 10]]);

  G.data.world = {
    base: { name: 'הבסיס', pos: { x: 50, y: 88 } },
    energy: { base: 2, perKm: 2.4 },
    order: ['forest', 'farm', 'neighborhood', 'quarry', 'lake', 'peaks', 'police', 'hospital', 'port', 'military', 'airport'],
    destinations: {
      forest:       { km: 1,  risk: 1, pos: { x: 50, y: 72 }, blurb: 'היער הקרוב לבסיס. שקט יחסית, עצים ומים בשפע.' },
      farm:         { km: 3,  risk: 1, pos: { x: 29, y: 71 }, finds: ['canned_food', 'plank', 'wood', 'mushroom'], blurb: 'שדות ופרדס שהתפרע. מעט עצים, הרבה פטריות ואבנים.' },
      neighborhood: { km: 4,  risk: 2, pos: { x: 71, y: 66 }, finds: ['canned_food', 'cloth', 'electronics', 'metal'], blurb: 'רחובות ריקים ובתים שקרסו, בפאתי העיר. קרוב מספיק לחזור באותו יום.' },
      quarry:       { km: 6,  risk: 2, pos: { x: 86, y: 49 }, finds: ['stone', 'metal', 'plank'], blurb: 'חציבה ישנה בין ההרים במזרח. מקום טוב לאבן.' },
      peaks:        { km: 8,  risk: 3, pos: { x: 93, y: 32 }, finds: ['cloth', 'wood', 'stone'], blurb: 'פסגות מושלגות בצפון-מזרח. קר מאוד: בלי בגדים חמים הגוף קופא. יש שם מדורות ישנות לחימום.' },
      lake:         { km: 7,  risk: 2, pos: { x: 20, y: 49 }, finds: ['canned_food', 'wood', 'mushroom', 'cloth'], blurb: 'אגם גדול מאחורי סכר, שממנו זורם נהר לים. מים, פטריות ויער צפוף.' },
      police:       { km: 9,  risk: 3, pos: { x: 62, y: 41 }, finds: ['bandage', 'electronics', 'metal', 'canned_food'],
                      blurb: 'תחנה במרכז העיר שננטשה בחופזה. ניידות בחניון, שקי חול בכניסה ומגרש גרירה מגודר.' },
      hospital:     { km: 11, risk: 3, pos: { x: 38, y: 34 }, finds: ['bandage', 'canned_food', 'water_clean', 'cloth'], blurb: 'מתחם גדול בקצה המערבי של העיר, שהטבע חוזר ובולע.' },
      port:         { km: 13, risk: 4, pos: { x: 13, y: 22 }, finds: ['metal', 'plank', 'canned_food', 'cloth'],
                      blurb: 'על חוף הים: מזחים ריקים, ספינת משא שנשארה קשורה ומגרש מכולות. מתכת, ארגזי מטען ומעט שימורים.' },
      military:     { km: 16, risk: 5, pos: { x: 77, y: 21 }, finds: ['plank', 'canned_food', 'bandage', 'electronics'], blurb: 'בסיס מגודר בצפון-מזרח, רחוק ומסוכן. לא מקום לצאת אליו מותשים.' },
      airport:      { km: 20, risk: 5, pos: { x: 50, y: 10 }, finds: ['cloth', 'canned_food', 'metal', 'electronics'], blurb: 'מסלולים אינסופיים בקצה הצפוני וקצה העולם המוכר.' }
    },

    geo: {
      routes: {
        forest: R.forest, farm: R.farm, neighborhood: R.neighborhood, quarry: R.quarry, peaks: R.peaks, lake: R.lake,
        police: R.police, hospital: R.hospital, port: R.port, military: R.military, airport: R.airport
      },
      // the sea fills everything west / north of this line
      coast: [[-2, 70], [4, 65], [7, 59], [6, 53], [9.5, 46], [8, 40], [11, 34], [9.5, 29], [9.5, 24], [12, 19], [16, 15.5],
        [21, 13], [25, 8], [30, 4.5], [34, -2]],
      lake: { x: 16.5, y: 49, rx: 7, ry: 6 },
      dam: [[19.6, 45.2], [20.4, 52.6]],
      river: [[13.6, 48.6], [12, 47.6], [10.5, 46.6], [8.5, 46]],
      forests: [[44, 76, 10], [56, 72, 8], [50, 64, 6], [61, 81, 8], [38, 85, 8], [58, 90, 6], [43, 91, 6],
        [24, 59, 8], [31, 47, 7], [13, 63, 9], [16, 38, 6], [32, 21, 7], [38, 23, 6], [64, 12, 5],
        [76, 58, 6], [92, 72, 9], [80, 80, 8], [94, 86, 7], [70, 88, 6]],
      fields: { x0: 18, y0: 64, x1: 38, y1: 84 },
      hills: [[89, 42, 15, 5], [84, 30, 10, 4], [95, 60, 11, 4], [70, 13, 7, 3], [96, 22, 9, 3]],
      quarry: { x: 86, y: 49, r: 5 },
      snow: { x: 93, y: 32, r: 5.5 },
      town: { x0: 53, y0: 33, x1: 71, y1: 50 },
      suburbs: { x0: 63, y0: 59, x1: 80, y1: 73 },
      campus: { x: 38, y: 34 },
      military: { x0: 72.5, y0: 15, x1: 83, y1: 27 },
      runway: { x0: 38, x1: 62, y: 8.5, w: 2.4 },
      labels: [
        ['הים', 10, 8, 'sea'], ['נהר', 11, 50.6, 'water'], ['העיר', 66, 53.5, 'region'], ['יער האורנים', 41, 67, 'region'],
        ['שדות', 23, 82, 'region'], ['הרי המזרח', 92, 34, 'region'], ['מבואות העיר', 74, 74.5, 'region']
      ]
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
