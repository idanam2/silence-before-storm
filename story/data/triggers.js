// Story triggers, conversation pickers and the flag list (plain data, no logic). SPOILERS: see story/README.md.
//
// Trigger = { id, on, when?, once?, do: [actions] }
//   on:   the engine event name (list below)
//   when: { area, flags: [all set], notFlags: [none set], items: {id: n in bag}, chapter: n (current chapter >= n),
//           notItems: {id: n} (fewer than n in bag), chapterIs: n (exactly), quest: id (active), questDone: id, chance: 0..1 }
//   match: for events that carry an id (story_event, dialogue_end, note_read, quest_start, quest_done, flag, station): must match.
//   once: default true (fires once per save). false = every time. oncePerVisit: true = at most once per trip to the area.
//   Extra matchers used by a few triggers: recipe (craft), notesAll: [...] (fires when the last of these notes is read),
//   eventCount: n (story_event fired n times in total). spawn's tag names the spawned group for later checks.
//
// Engine events (emit these from game code; extra fields in parentheses):
//   new_game · enter_area (area) · leave_area (area) · return_base · sleep · wake · station (id: workbench | campfire | rack, E at a station)
//   spot (spot) · story_event (id) — every { do: 'event', id } from spots/dialogue lands here
//   dialogue_end (id) · note_read (id) · quest_start (id) · quest_done (id) · flag (id)
//   item_gain (item, n) · craft (recipe) · build (building, level) · relay_built (spot) · vehicle_built (match: vehicle id)
//
// Actions (shared by spots, dialogue nodes, quests and triggers):
//   { do: 'dialogue', id }                 open a dialogue (queue it if one is open)
//   { do: 'note', id }                     show a note and mark it read
//   { do: 'give', item, n } / { do: 'take', item, n }   bag first, then chest (take); bag then chest (give)
//   { do: 'flag', id, value? }             set a story flag (value default true)
//   { do: 'quest', id }                    start a quest (no-op if started or done)
//   { do: 'unlock', area }                 show a destination on the world map (all start hidden except forest)
//   { do: 'event', id }                    fire story_event id
//   { do: 'door', to }                     move the player to another area (like a building door)
//   { do: 'toast', text }                  small message in the middle of the screen
//   { do: 'spawn', kind, near, count, calm? }  spawn enemies (near: 'player' | spot id | 'edges'); calm = do not aggro
//   { do: 'weather', id }                  'storm' | 'clear'
//   { do: 'radio', on: true|false }        the little green "message waiting" light on spot_home_radio
(function (root) {
  'use strict';
  var G = root.G = root.G || {};
  G.data = G.data || {};

  // ------------------------------------------------------------------ pickers
  // When the player uses the home radio: the first entry whose req matches and that was not played yet plays.
  // If nothing matches, an idle line (random) plays. While something is pending, the radio light is on.
  G.data.storyRadio = {
    queue: [
      { dialogue: 'dlg_maya_first',   req: { items: { radio_fixed: 1 } } },
      { dialogue: 'dlg_maya_ch2',     req: { flags: ['relay_1', 'home_visited'] } },
      { dialogue: 'dlg_maya_ch3',     req: { flags: ['relay_2'] } },
      { dialogue: 'dlg_maya_ch4_ask', req: { questDone: 'mq_ch3' } },
      { dialogue: 'dlg_maya_ch5_ask', req: { questDone: 'mq_ch4' } },
      { dialogue: 'dlg_maya_ch5',     req: { flags: ['relay_4'] } },
      { dialogue: 'dlg_maya_ch6_ask', req: { questDone: 'mq_ch5' } },
      { dialogue: 'dlg_maya_ch6',     req: { flags: ['noa_answered'] } },
      { dialogue: 'dlg_maya_peak_ask', req: { questDone: 'mq_ch6' } },
      { dialogue: 'dlg_maya_peak',    req: { flags: ['peak_dish_done'] } },
      { dialogue: 'dlg_maya_ch7_ask', req: { questDone: 'mq_peak' } },
      { dialogue: 'dlg_maya_ch7',     req: { flags: ['relay_6'] } },
      { dialogue: 'dlg_ori_call',     req: { questDone: 'mq_ch7' } },
      { dialogue: 'dlg_maya_ch8',     req: { flags: ['relay_7'] } }
    ],
    // recordings the player can replay from the radio after they were heard (a small "tapes" list)
    replay: ['rec_noa_1', 'rec_noa_2', 'rec_noa_door', 'rec_noa_3', 'rec_noa_4', 'rec_noa_5', 'rec_noa_6', 'rec_noa_7'],
    idle: [
      `רעש לבן. היא לא עונה הערב.`,
      `תדר ריק. אני מקשיב בכל זאת.`,
      `"...שמיים בהירים, רוח מערבית קלה..." מישהו קורא תחזית בלולאה. בחוץ יורד גשם.`,
      `אני משאיר את הרדיו דולק על השולחן. רק בשביל האור הירוק.`
    ]
  };

  // When the player talks to Rachel (spot_rachel): first match plays; repeatable ones have repeat: true.
  G.data.storyRachel = [
    { dialogue: 'dlg_rachel_meet',        req: { notFlags: ['rachel_met'] } },
    { dialogue: 'dlg_rachel_chimes',      req: { items: { wind_chime: 5 } } },
    { dialogue: 'dlg_rachel_insulin',     req: { items: { insulin: 1 } } },
    { dialogue: 'dlg_rachel_gil',         req: { flags: ['gil_found'] } },
    { dialogue: 'dlg_rachel_hives_start', req: { quest: 'sq_hives', notFlags: ['sq_hives_started'] } },
    { dialogue: 'dlg_rachel_rhythm',      req: { flags: ['hives_smoked'] } },
    { dialogue: 'dlg_rachel_letter_give', req: { flags: ['rachel_deal_done'], chapter: 2 } },
    { dialogue: 'dlg_rachel_wool',        req: { flags: ['peak_known'] } },
    { dialogue: 'dlg_dog_sweater',        req: { flags: ['rachel_knits', 'dog_joined'], items: { cloth: 3 } }, take: { cloth: 3 } },
    { dialogue: 'dlg_rachel_soap',        req: { flags: ['dog_joined'] } },
    { dialogue: 'dlg_roni_rachel',        req: { flags: ['roni_joined', 'roni_leg_healed'], notFlags: ['roni_lost'], companion: 'roni' } }, // companion: Roni must be following you here
    { dialogue: 'dlg_rachel_idle',        req: { flags: ['rachel_deal_done'] }, repeat: true }
  ];

  // When the player talks to Roni (spot_roni). The relationship grows slowly: at most one campfire talk per chapter.
  G.data.storyRoni = [
    { dialogue: 'dlg_roni_leg',      req: { items: { antibiotics: 1, splint: 1 } }, take: { antibiotics: 1, splint: 1 } },
    { dialogue: 'dlg_roni_father',   req: { items: { father_watch: 1 }, notFlags: ['roni_lost'] } },
    { dialogue: 'dlg_roni_peak_go',  req: { flags: ['ch_peak_active'] } },
    { dialogue: 'dlg_roni_storm',    req: { flags: ['storm'] } },
    { dialogue: 'dlg_roni_base_4',   req: { questDone: 'mq_ch7' } },
    { dialogue: 'dlg_roni_base_3',   req: { flags: ['roni_saved_peak'] } },
    { dialogue: 'dlg_roni_base_2',   req: { questDone: 'mq_ch6' } },
    { dialogue: 'dlg_roni_base_1',   req: { questDone: 'mq_ch5' } }
  ];
  // idle lines when nothing is pending (random, no dialogue box needed: show as a small speech toast)
  G.data.storyRoniIdle = [
    `"המדורה הזאת עושה עשן כמו ספינת פחם. אני אתקן לך ארובה."`,
    `"פלפל אכל? אל תשקר לי, אני רואה את הקערה."`,
    `"אני שומרת. לך לישון."`,
    `"תביא לי פעם מנוע. כל מנוע. אני משתגעת בלי משהו לפרק."`
  ];

  // When the player talks to Ori in the tower (spot_ori).
  G.data.storyOri = [
    { dialogue: 'dlg_ori_meet',     req: { notFlags: ['ori_met'] } },
    { dialogue: 'dlg_ori_decision', req: { flags: ['ori_met'], notFlags: ['ch8_relay_ok'] } },
    { dialogue: 'dlg_ori_idle',     req: {}, repeat: true }
  ];

  // The tally wall: which note the wall shows, by current chapter (sq_wall_days counts each first read).
  G.data.storyWall = ['note_wall_0', 'note_wall_1', 'note_wall_2', 'note_wall_3', 'note_wall_4',
                      'note_wall_5', 'note_wall_6', 'note_wall_peak', 'note_wall_7', 'note_wall_8'];   // index = chapter

  // First sleep after each of these flags plays a dream (in order, each once).
  G.data.storyDreams = [
    { dialogue: 'dlg_dream_1', req: { flags: ['radio_inspected'] } },
    { dialogue: 'dlg_dream_2', req: { flags: ['home_visited'] } },
    { dialogue: 'dlg_dream_3', req: { flags: ['knows_pa'] } },
    { dialogue: 'dlg_dream_4', req: { flags: ['knows_noa_alive'] } },
    { dialogue: 'dlg_dream_5', req: { flags: ['storm'] } }
  ];

  // ------------------------------------------------------------------ triggers
  G.data.storyTriggers = [
    // ---- start
    { id: 't_new_game', on: 'new_game', do: [
      { do: 'quest', id: 'mq_prologue' }, { do: 'quest', id: 'sq_wall_days' }, { do: 'quest', id: 'sq_ori_trust' },
      { do: 'give', item: 'radio_broken', n: 1, to: 'chest' }, { do: 'dialogue', id: 'dlg_intro' } ] },

    // ---- the radio on the workbench (prologue)
    { id: 't_radio_inspect', on: 'build', when: { items: { radio_broken: 1 } }, do: [{ do: 'toast', text: `E ליד שולחן העבודה: לפתוח את מכשיר הקשר` }] },
    { id: 't_radio_open', on: 'station', match: 'workbench', when: { items: { radio_broken: 1 }, notFlags: ['radio_inspected'] },
      do: [{ do: 'dialogue', id: 'dlg_radio_open' }] },
    // the fixed radio goes on the windowsill the first time the player comes home with it
    { id: 't_radio_place', on: 'craft', recipe: 'radio_fixed', do: [{ do: 'flag', id: 'radio_placed' }, { do: 'radio', on: true },
      { do: 'toast', text: `הרדיו על אדן החלון. E כדי להאזין.` }] },

    // ---- the farm
    { id: 't_farm_first', on: 'enter_area', when: { area: 'farm' }, do: [{ do: 'toast', text: `כביסה על החבל. מישהו גר כאן.` }] },
    { id: 't_chimes_ring', on: 'enter_area', when: { area: 'farm', flags: ['chimes_task'], notFlags: ['rachel_deal_done'] }, once: false,
      do: [{ do: 'event', id: 'chimes_active' }] },   // game: chimes make noise every few seconds until all 5 are taken
    { id: 't_hives_smoke', on: 'story_event', match: 'hives_use', when: { items: { smoker: 1 }, flags: ['sq_hives_started'] },
      do: [{ do: 'take', item: 'smoker', n: 1 }, { do: 'flag', id: 'hives_smoked' }, { do: 'event', id: 'hives_smoked' }] },

    { id: 't_garden_start', on: 'quest_start', match: 'sq_garden', do: [{ do: 'flag', id: 'sq_garden_started' }] },
    { id: 't_garden_build', on: 'story_event', match: 'garden_use', when: { notFlags: ['garden_built'] }, do: [{ do: 'flag', id: 'garden_built' }, { do: 'event', id: 'garden_built' }] },
    { id: 't_garden_water', on: 'story_event', match: 'garden_use', once: false, oncePerVisit: true, when: { flags: ['garden_built'], items: { water_clean: 1 } },
      do: [{ do: 'take', item: 'water_clean', n: 1 }, { do: 'event', id: 'garden_water' }] },

    // ---- the neighborhood
    { id: 't_street', on: 'enter_area', when: { area: 'neighborhood', quest: 'mq_ch2' }, do: [{ do: 'dialogue', id: 'dlg_street_recognize' }, { do: 'flag', id: 'ch2_active' }] },
    { id: 't_dog_first', on: 'story_event', match: 'dog_use', do: [{ do: 'dialogue', id: 'dlg_dog_bark' }, { do: 'quest', id: 'sq_dog' }] },
    { id: 't_dog_feed', on: 'story_event', match: 'dog_use', once: false, when: { items: { canned_food: 1 }, quest: 'sq_dog' },
      do: [{ do: 'take', item: 'canned_food', n: 1 }, { do: 'event', id: 'dog_fed' }, { do: 'toast', text: `השארתי פחית ליד הקערה.` }],
      oncePerVisit: true },
    { id: 't_house12', on: 'story_event', match: 'house12_use', do: [{ do: 'quest', id: 'sq_house12' }, { do: 'note', id: 'note_house12_1' }, { do: 'note', id: 'note_house12_2' }] },
    { id: 't_mail', on: 'note_read', match: 'note_mail_1', do: [{ do: 'note', id: 'note_mail_2' }, { do: 'note', id: 'note_mail_3' }, { do: 'note', id: 'note_mail_4' }, { do: 'note', id: 'note_mail_5' }] },
    { id: 't_rachel_letter', on: 'dialogue_end', match: 'dlg_rachel_letter_give', do: [{ do: 'quest', id: 'sq_rachel_letter' }] },

    // ---- the police
    { id: 't_police_ch3', on: 'enter_area', when: { area: 'police', quest: 'mq_ch3' }, do: [{ do: 'flag', id: 'ch3_active' }] },
    { id: 't_armory_code', on: 'note_read', notesAll: ['note_sgt_notebook', 'note_sgt_daughter'],
      do: [{ do: 'flag', id: 'armory_code' }, { do: 'toast', text: `14.3, ניידת 6. 1-4-0-3-6.` }] },
    { id: 't_insulin_hint', on: 'enter_area', when: { area: 'hospital', flags: ['rachel_deal_done'] }, do: [{ do: 'quest', id: 'sq_insulin' }, { do: 'flag', id: 'sq_insulin_started' }] },

    // ---- relays: what plays right after each one goes up (the radio queue handles the evening talk)
    { id: 't_relay_any', on: 'relay_built', once: false, do: [{ do: 'radio', on: true }] },
    { id: 't_relay_3', on: 'flag', match: 'relay_3', do: [{ do: 'dialogue', id: 'rec_noa_3' }] },
    { id: 't_relay_5', on: 'flag', match: 'relay_5', do: [{ do: 'dialogue', id: 'dlg_noa_live' }] },
    { id: 't_relay_7', on: 'flag', match: 'relay_7', do: [{ do: 'dialogue', id: 'rec_noa_7' }] },

    // ---- the quarry door
    { id: 't_lab_door_early', on: 'story_event', match: 'lab_door_use', once: false, when: { notFlags: ['ch4_drop', 'storm'] },
      do: [{ do: 'toast', text: `דלת פלדה. אינטרקום מת. מנורה אדומה.` }] },
    { id: 't_lab_door_ch4', on: 'story_event', match: 'lab_door_use', when: { flags: ['ch4_active'], items: { coolbox: 1, centrifuge_rotor: 1 } },
      do: [{ do: 'dialogue', id: 'dlg_quarry_door' }] },
    { id: 't_dead_drop', on: 'story_event', match: 'dead_drop', when: { items: { coolbox: 1, centrifuge_rotor: 1, firstaid: 2, bandage: 5 } },
      do: [{ do: 'take', item: 'coolbox', n: 1 }, { do: 'take', item: 'centrifuge_rotor', n: 1 }, { do: 'take', item: 'firstaid', n: 2 },
           { do: 'take', item: 'bandage', n: 5 }, { do: 'toast', text: `המכסה נסגר. מבפנים, צליל של מנוע חשמלי.` }] },
    { id: 't_lab_door_storm', on: 'story_event', match: 'lab_door_use', once: false, when: { flags: ['storm'] },
      do: [{ do: 'door', to: 'lab_tunnel' }] },
    { id: 't_foreman_start', on: 'quest_start', match: 'sq_foreman', do: [{ do: 'flag', id: 'sq_foreman_started' }] },
    { id: 't_foreman_found', on: 'enter_area', when: { area: 'quarry', chapter: 4 }, do: [{ do: 'toast', text: `דלת פלדה בתוך קיר הסלע. זה לא היה פה כשהמחצבה עבדה.` }] },

    // ---- the port
    { id: 't_port_ch5', on: 'enter_area', when: { area: 'port', quest: 'mq_ch5' }, do: [
      { do: 'spawn', kind: 'shambler', near: 'spot_pa_box_2', count: 1, calm: true, tag: 'still_one' } ] },
    { id: 't_still_one', on: 'story_event', match: 'near_still_one', do: [{ do: 'dialogue', id: 'dlg_still_one' }] }, // game fires near_still_one within 200px
    { id: 't_pa_box', on: 'story_event', match: 'pa_box', once: false, do: [{ do: 'quest', id: 'sq_pa_silence' }] },

    // ---- the lake
    { id: 't_fisher_cabin', on: 'story_event', match: 'fisher_cabin', do: [
      { do: 'note', id: 'note_fisher_1' }, { do: 'note', id: 'note_fisher_2' },
      { do: 'give', item: 'drive_belt', n: 1 }, { do: 'give', item: 'fishing_rod', n: 1 }, { do: 'flag', id: 'has_rod' }, { do: 'quest', id: 'sq_fishing' } ] },
    { id: 't_levi_lake', on: 'story_event', match: 'fisher_cabin', when: { flags: ['levi_started'] }, do: [{ do: 'note', id: 'note_levi_2' }] },
    { id: 't_levi_start', on: 'note_read', match: 'note_levi_1', do: [{ do: 'flag', id: 'levi_started' }] },
    { id: 't_dam_full', on: 'flag', match: 'dam_power', do: [{ do: 'quest', id: 'sq_dam_full' }, { do: 'flag', id: 'sq_dam_full_started' }] },
    { id: 't_dam_full_end', on: 'story_event', match: 'trash_rack', eventCount: 3, do: [{ do: 'dialogue', id: 'dlg_dam_full' }] },

    // ---- the military base / Ori
    { id: 't_amp_home', on: 'return_base', when: { flags: ['has_amplifier'] }, do: [{ do: 'toast', text: `להחביא את המגבר (קרש רופף ברצפת הבקתה).` }] },
    { id: 't_ori_decoder', on: 'dialogue_end', match: 'dlg_ori_decision', when: { flags: ['ori_trust'] },
      do: [{ do: 'dialogue', id: 'dlg_ori_decoder' }, { do: 'give', item: 'ori_decoder', n: 1 }, { do: 'flag', id: 'ori_decoder' }] },
    { id: 't_ori_decoder_late', on: 'flag', match: 'ori_trust', when: { flags: ['ch8_relay_ok'] },
      do: [{ do: 'dialogue', id: 'dlg_ori_decoder' }, { do: 'give', item: 'ori_decoder', n: 1 }, { do: 'flag', id: 'ori_decoder' }] },
    { id: 't_tower_door', on: 'story_event', match: 'tower_door', once: false, when: { notFlags: ['tower_open'] }, do: [{ do: 'dialogue', id: 'dlg_ori_door' }] },
    { id: 't_tower_door_open', on: 'story_event', match: 'tower_door', once: false, when: { flags: ['tower_open'] }, do: [{ do: 'door', to: 'tower_top' }] },

    // ---- expansion: Pelpel
    { id: 't_dog_arrives', on: 'return_base', when: { flags: ['relay_2'], notFlags: ['dog_joined'] }, do: [{ do: 'dialogue', id: 'dlg_dog_arrives' }] },
    { id: 't_kennel', on: 'build', match: 'kennel', do: [{ do: 'dialogue', id: 'dlg_kennel_built' }] },
    { id: 't_dog_wash', on: 'story_event', match: 'dog_washed', do: [{ do: 'dialogue', id: 'dlg_dog_wash' }] },
    { id: 't_dog_sniff', on: 'story_event', match: 'dog_sniff', do: [{ do: 'dialogue', id: 'dlg_dog_sniff' }] },
    { id: 't_dog_weak', on: 'story_event', match: 'dog_weak', do: [{ do: 'dialogue', id: 'dlg_dog_weak' }] },        // engine fires when a need < weakBelow
    { id: 't_dog_ran', on: 'story_event', match: 'dog_ran', once: false, do: [{ do: 'flag', id: 'dog_ran' }, { do: 'dialogue', id: 'dlg_dog_ran' }] },
    { id: 't_dog_back', on: 'story_event', match: 'dog_use', once: false, when: { flags: ['dog_ran'], items: { dog_food: 1 } },
      do: [{ do: 'take', item: 'dog_food', n: 1 }, { do: 'dialogue', id: 'dlg_dog_return' }] },

    // ---- expansion: Roni
    { id: 't_roni_signal', on: 'flag', match: 'relay_4', do: [{ do: 'dialogue', id: 'dlg_roni_signal' }] },
    { id: 't_roni_escaped', on: 'story_event', match: 'roni_escort_done', do: [{ do: 'dialogue', id: 'dlg_roni_escaped' }] }, // engine: both reached the port exit
    { id: 't_roni_home', on: 'return_base', when: { flags: ['roni_joined'] }, do: [{ do: 'dialogue', id: 'dlg_roni_home' }] },
    { id: 't_roni_grief', on: 'return_base', when: { flags: ['roni_lost'] }, do: [{ do: 'dialogue', id: 'dlg_roni_grief' }] },
    { id: 't_roni_tunnel', on: 'enter_area', when: { area: 'lab_tunnel', flags: ['roni_comes_finale'], notFlags: ['roni_lost'] },
      do: [{ do: 'dialogue', id: 'dlg_roni_tunnel' }] },

    // ---- expansion: the ridge
    { id: 't_peak_enter', on: 'enter_area', when: { area: 'peaks' }, do: [{ do: 'dialogue', id: 'dlg_peak_arrive' }] },
    { id: 't_peak_station', on: 'enter_area', when: { area: 'peak_station' }, do: [{ do: 'dialogue', id: 'dlg_peak_station' }] },
    { id: 't_peak_split', on: 'dialogue_end', match: 'dlg_peak_generator', do: [{ do: 'flag', id: 'peak_split' }] },
    { id: 't_peak_won', on: 'story_event', match: 'peak_rescue_won', do: [{ do: 'dialogue', id: 'dlg_peak_saved' }, { do: 'flag', id: 'peak_dish_done' }] },
    { id: 't_peak_lost', on: 'story_event', match: 'peak_rescue_lost', do: [{ do: 'dialogue', id: 'dlg_peak_lost' }, { do: 'flag', id: 'peak_dish_done' }] },

    // ---- expansion: vehicles (tank chapter 6, helicopter chapter 7)
    // Roni always joins in chapter 5 (main quest), so she is there for the tank idea
    { id: 't_tank_idea', on: 'dialogue_end', match: 'dlg_maya_ch6_ask', do: [{ do: 'dialogue', id: 'dlg_roni_tank_idea' }] },
    { id: 't_tank_built', on: 'vehicle_built', match: 'tank', do: [{ do: 'dialogue', id: 'dlg_tank_built' }] },
    { id: 't_lake_mud', on: 'enter_area', when: { area: 'lake' }, do: [{ do: 'dialogue', id: 'dlg_lake_mud' }] },
    { id: 't_heli_idea', on: 'dialogue_end', match: 'dlg_maya_peak_ask', do: [{ do: 'dialogue', id: 'dlg_roni_heli_idea' }] },
    { id: 't_heli_built', on: 'vehicle_built', match: 'heli', do: [{ do: 'dialogue', id: 'dlg_heli_first_flight' }] },
    { id: 't_military_tank', on: 'enter_area', when: { area: 'military' }, do: [{ do: 'dialogue', id: 'dlg_military_tank' }] },
    { id: 't_ori_heli', on: 'enter_area', when: { area: 'airport', quest: 'mq_ch8' }, do: [{ do: 'dialogue', id: 'dlg_ori_heli' }] },
    { id: 't_storm_grounded', on: 'story_event', match: 'heli_denied_storm', do: [{ do: 'dialogue', id: 'dlg_storm_grounded' }] }, // engine: the player tries to fly while flag storm

    // ---- the storm and the finale
    { id: 't_storm', on: 'flag', match: 'storm', do: [{ do: 'weather', id: 'storm' }, { do: 'unlock', area: 'quarry' }] },
    { id: 't_storm_leave', on: 'leave_area', when: { area: 'base', flags: ['storm'] }, do: [{ do: 'dialogue', id: 'dlg_storm_start' }] },
    { id: 't_tunnel', on: 'enter_area', when: { area: 'lab_tunnel' }, do: [{ do: 'dialogue', id: 'dlg_tunnel' },
      { do: 'spawn', kind: 'shambler', near: 'edges', count: 10, calm: true, tag: 'chained' }] },
    { id: 't_shortcut', on: 'story_event', match: 'tunnel_shortcut', do: [{ do: 'toast', text: `הפיר של שלמה. חצי מהדרך.` }] },
    { id: 't_inner_badge', on: 'story_event', match: 'lab_inner_door', when: { items: { afik_badge: 1 } }, do: [{ do: 'door', to: 'lab_main' }] },
    { id: 't_inner_intercom', on: 'story_event', match: 'lab_inner_door', when: { notItems: { afik_badge: 1 } }, do: [{ do: 'dialogue', id: 'dlg_lab_intercom' }, { do: 'door', to: 'lab_main' }] },
    { id: 't_lab_enter', on: 'enter_area', when: { area: 'lab_main' }, do: [{ do: 'dialogue', id: 'dlg_glass_room' }] },
    { id: 't_lab_maya', on: 'dialogue_end', match: 'dlg_glass_room', do: [{ do: 'dialogue', id: 'dlg_finale_maya' }] },
    { id: 't_console', on: 'story_event', match: 'finale_choice', once: false, when: { flags: ['finale_heard'], notFlags: ['ending_chosen'] },
      do: [{ do: 'dialogue', id: 'dlg_final_choice' }] },
    { id: 't_ending', on: 'flag', match: 'ending_chosen', do: [{ do: 'event', id: 'play_ending' }] }   // game: show G.data.storyEndings
  ];

  // ------------------------------------------------------------------ access: places you cannot reach on foot (expansion)
  // The world map / travel code checks this before a trip. by: the vehicles that get you in (data/vehicles.js ids).
  // 'heli' means flying there (the helicopter is a transport, see CLAUDE.md); a ground vehicle means driving it on the trip.
  // deny: shown on the map card when the player has none of them. Places not listed are open to everyone.
  // stormNoFly: while flag `storm` is set the helicopter cannot take off (story: dlg_storm_grounded) - the finale is on foot or by tank.
  G.data.storyAccess = {
    lake:     { by: ['tank', 'heli'], deny: `העמק לפני הסכר מוצף בבוץ. צריך טנק (או מסוק).` },
    military: { by: ['tank', 'heli'], deny: `שדות בוץ ומוקשים סביב הבסיס. צריך טנק (או מסוק).` },
    peaks:    { by: ['heli'],         deny: `מפולת קברה את הכביש לרכס. מגיעים רק במסוק.` },
    airport:  { by: ['heli'],         deny: `הכבישים לשדה התעופה חסומים בשברי מטוסים. מגיעים רק במסוק.` },
    stormNoFly: true
  };
  // Roni helps in the garage once she has joined: the tank's and helicopter's part recipes cost this much less (0.25 = 25%).
  G.data.storyGarageHelp = { flag: 'roni_joined', discount: 0.25, vehicles: ['tank', 'heli'] };

  // ------------------------------------------------------------------ flags
  // Every story flag, what sets it and what reads it. Keep in sync; story/check.js warns on unknown flags.
  G.data.storyFlags = {
    // chapter state
    prologue_done: `סוף הפרולוג`, ch2_active: `בשכונה בפרק 2`, ch3_active: `במשטרה בפרק 3`, ch4_active: `פרק 4 התחיל`,
    ch5_active: `פרק 5 התחיל`, ch6_active: `פרק 6 התחיל`, ch7_active: `פרק 7 התחיל`, ch8_active: `פרק 8 התחיל`,
    ch4_drop: `אפשר להשאיר ציוד בארגז`, storm: `הסערה (פרק 9)`, ending_chosen: `נבחר סוף`,
    // radio and relays
    radio_inspected: `נפתח הרדיו השבור`, has_coil: `יש סליל`, radio_placed: `הרדיו בבית`, maya_contact: `שיחה ראשונה`,
    relay_blueprint: `תרשים ממסר`, relay_1: `ממסר שכונה`, relay_2: `ממסר משטרה`, relay_3: `ממסר בית חולים`,
    relay_4: `ממסר נמל`, relay_5: `ממסר סכר`, relay_6: `ממסר בסיס`, relay_7: `ממסר מגדל`,
    rec_noa_1: `הקלטה 1`, rec_noa_2: `הקלטה 2`, rec_noa_door: `זמזום בדלת`, rec_noa_3: `הקלטה 3`, rec_noa_4: `הקלטה 4`,
    rec_noa_5: `זמזום חי בסכר`, rec_noa_6: `הקלטה 6`, rec_noa_7: `הקלטה 7`, rec_noa_8: `נועה בחדר הזכוכית`,
    // knowledge
    farm_lived_in: `ראה שמישהו גר בחווה`, home_visited: `היה בבית 7`, knows_vehicle4: `ראה "הועברה. רכב 4"`, manifest_page: `תלש את הדף`,
    knows_maya_afik: `ראה את החתימה של מאיה`, confronted_afik: `עימת אותה בדלת`, quarry_door_talked: `דיבר בדלת`, heard_door_hum: `שמע זמזום בדלת`,
    knows_pa: `קרא את יומן הכריזה`, knows_omer: `קרא את שם עומר`, knows_no_ships_log: `קרא את יומן הקברניט`, doubts_ships: `שאל את מאיה על הספינות`,
    knows_noa_alive: `מאיה הודתה`, noa_listens: `נועה שומעת אותו ברדיו`, noa_answered: `נועה סיימה את הצליל`, knows_carrier: `קרא את תיקי מגדלור`,
    knows_ward3: `יומן סיגל שלם`, knows_relay3: `מצא את ממסר 3`, knows_relay5: `מצא את ממסר 5`, knows_tunnel: `מפת המנהרה`,
    knows_no_ships: `אורי אישר שאין ספינות`, tamar_heard_all: `שמע את כל הקלטות תמר`,
    // Ori
    ori_contact: `אורי נכנס לתדר`, tell_maya_ori: `סיפר למאיה על אורי`, ori_met: `פגש את אורי`, tower_open: `אורי פתח`,
    ori_trust: `3 נקודות אמון`, ori_decoder: `יש מפענח`, ori_home: `אורי יבוא לבסיס`, ori_on_line: `אורי נשאר על הקו`, ch8_relay_ok: `הוחלט להשלים את הרשת`,
    // Rachel & side
    rachel_met: `פגש את רחל`, chimes_task: `משימת הפעמונים`, rachel_deal_done: `העסקה עם רחל`, unlock_club: `מתכון אלה (קיים כבר)`,
    sq_hives_started: `הכוורות התחילו`, hives_smoked: `עישן כוורות`, rachel_rhythm: `התובנה על קצב`, sq_insulin_started: `משימת אינסולין`,
    rachel_saved: `רחל קיבלה אינסולין`, gil_found: `הבית של גיל`, rachel_letter_truth: `אמר לרחל אמת`, rachel_letter_hope: `נתן לרחל תקווה`,
    found_music_box: `מצא תיבת נגינה`, has_music_box: `תיקן ושמע אותה`, dog_home: `פלפל בבית`, house12_code: `קוד הכספת`, armory_code: `קוד הנשקייה`,
    unlock_bow: `תרשים קשת`, levi_started: `מצא את המחנה`, levi_found: `גורל משפחת לוי`, has_rod: `יש חכה`,
    sq_marked_trees_started: `עץ הסימנים`, sq_garden_started: `ערוגה`, garden_built: `ערוגה נבנתה`, garden_grows: `הערוגה מניבה`, sq_foreman_started: `מנהל העבודה`,
    pa_silenced: `ניתק את רמקולי הנמל`, dam_power: `טורבינה עובדת`, sq_dam_full_started: `לחץ מלא התחיל`, dam_full_power: `חשמל מלא`,
    has_amplifier: `המגבר אצלו`,
    // finale
    saw_noa: `ראה אותה`, finale_heard: `שמע את מאיה עד הסוף`, finale_pa_talk: `דיבר על הנמל בסיום`, finale_relays_talk: `דיבר על הטכנאים`,
    ending_hum: `סוף א`, ending_broadcast: `סוף ב`, ending_song: `סוף ג`, amp_destroyed: `השמיד מגבר`, amp_left: `השאיר מגבר`,
    noa_home_sick: `לקח אותה הביתה חולה`, noa_with_maya: `השאיר אותה אצל מאיה`,
    // expansion: Pelpel
    dog_trust: `האכיל את פלפל בשכונה`, dog_joined: `פלפל איתו`, kennel_done: `מלונה, קערות, רחצה`, dog_ran: `פלפל ברח (זמני)`,
    rachel_soap: `מתכון סבון`, rachel_knits: `רחל סורגת`,
    // expansion: Roni
    saw_signal: `ראה את האיתות מהספינה`, roni_met: `פגש את רוני`, roni_joined: `רוני איתו`, roni_leg_healed: `הרגל טופלה`,
    roni_father_known: `קראה את היומן של אבא`, roni_met_rachel: `רוני פגשה את רחל`, roni_knows_noa: `רוני יודעת על נועה`,
    roni_close_1: `יד ביד`, roni_close_2: `אחרי הרכס`, roni_together: `ביחד`, roni_waits: `מחכה בבסיס בסיום`,
    roni_comes_finale: `באה להר`, roni_in_finale: `הייתה במנהרה`, roni_peak: `באה לרכס`, roni_saved_peak: `ניצלה בסופה`, roni_lost: `אבדה בסופה (סופי)`,
    // expansion: the ridge
    peak_known: `שמע על הרכס`, ch_peak_active: `פרק הרכס`, peak_split: `רוני ליד הגנרטור`, peak_dish_done: `הצלחת מכוונת`,
    peak_link: `הקישור מההר פעיל`, read_peak_test: `קרא את הלוח בתחנה`,
    // expansion: vehicles
    tank_idea: `רוני הציעה טנק`, heli_idea: `רוני הציעה מסוק`, heli_flown: `טיסה ראשונה`
  };
})(typeof window !== 'undefined' ? window : globalThis);
