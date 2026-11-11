// Difficulty levels (plain data, no logic). Chosen on "New game" and stored in the save.
// hunger / thirst / energy: multiplier on how fast that need drops (and on the energy cost of travel).
// damage: multiplier on every hit the player takes (starvation now, enemies from stage 5).
// deathLoss: share of the backpack lost when the player faints / dies (1 = everything).
// loseWeapons: also lose the equipped weapon (used by combat in stage 5).
(function (root) {
  'use strict';
  var G = root.G;
  G.data = G.data || {};

  G.data.difficulty = {
    order: ['easy', 'normal', 'hard'],
    default: 'normal',
    levels: {
      easy: {
        id: 'easy', name: 'קל',
        desc: 'הרעב, הצמא והאנרגיה יורדים לאט מאוד והנזק שאתם סופגים נמוך. בנפילה תאבדו חצי מהתיק.',
        hunger: 0.4, thirst: 0.4, energy: 0.5, damage: 0.5, deathLoss: 0.5, loseWeapons: false
      },
      normal: {
        id: 'normal', name: 'בינוני',
        desc: 'הקצב הרגיל. בנפילה תאבדו את כל מה שבתיק.',
        hunger: 1, thirst: 1, energy: 1, damage: 1, deathLoss: 1, loseWeapons: false
      },
      hard: {
        id: 'hard', name: 'קשה',
        desc: 'המדדים יורדים מהר והנזק גבוה. בנפילה תאבדו את התיק וגם את הנשק שבידכם.',
        hunger: 1.6, thirst: 1.8, energy: 1.5, damage: 1.6, deathLoss: 1, loseWeapons: true
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
