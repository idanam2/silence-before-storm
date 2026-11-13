// Dialogue state machine (pure: no DOM, no game state). A session walks one dialogue (story/data/dialogue-*.js):
// lines one at a time, then the node's `do` actions, then a choice / the next node / the end.
// env (supplied by js/story.js): { reqOk(req), run(actions), seen(key), mark(key), finish(id) }.
// Choices whose req is not met are hidden (not greyed). `auto: true` on a node picks the first choice whose req holds.
(function (root) {
  'use strict';
  var G = root.G;

  function nodeOf(s) { return s.dlg.nodes[s.node]; }
  function linesOf(n) { return (n && n.lines) || []; }

  function visibleChoices(s) {
    var n = nodeOf(s), out = [], i, c;
    for (i = 0; i < (n.choices || []).length; i++) {
      c = n.choices[i];
      if (c.req && !s.env.reqOk(c.req)) continue;
      if (c.once && s.env.seen(s.id + '|' + s.node + '|' + i)) continue;
      out.push({ i: i, text: c.text });
    }
    return out;
  }

  function finish(s) {
    if (s.done) return;
    s.done = true;
    s.env.finish(s.id);
  }

  function runDo(s) {
    var n = nodeOf(s);
    if (s.did) return;
    s.did = true;
    if (n.do) s.env.run(n.do);
  }

  // The node's last line is on screen. Choices appear together with it (and the node's actions run then).
  function arrive(s) {
    var n = nodeOf(s);
    if (s.idx < linesOf(n).length - 1 || !n.choices || n.auto) return;
    runDo(s);
    s.picks = visibleChoices(s);
    if (!s.picks.length) finish(s);
  }

  // All lines of the node are done: run its actions, then end / go on / choose. Returns the next node id to enter, or null
  // when the session ended or is waiting for a choice.
  function resolve(s) {
    var n = nodeOf(s), v, c;
    runDo(s);
    if (n.end) { finish(s); return null; }
    if (n.next) return n.next;
    if (n.choices) {
      v = visibleChoices(s);
      if (!v.length) { finish(s); return null; }
      if (n.auto) {
        c = n.choices[v[0].i];
        if (c.once) s.env.mark(s.id + '|' + s.node + '|' + v[0].i);
        if (c.do) s.env.run(c.do);
        return c.next;
      }
      s.picks = v;
      return null;
    }
    finish(s);
    return null;
  }

  // Enters a node: shows its first line, or (no lines) resolves it straight away.
  function goNode(s, id) {
    for (var guard = 0; guard < 60 && !s.done; guard++) {
      s.node = id; s.idx = 0; s.did = false; s.picks = null;
      if (!nodeOf(s)) { finish(s); return; }
      if (linesOf(nodeOf(s)).length) { arrive(s); return; }
      id = resolve(s);
      if (id === null) return;
    }
    finish(s);
  }

  var dialogue = {
    // dlg: the dialogue object, id: its id (for played / once bookkeeping).
    open: function (dlg, id, env) {
      var s = { id: id, dlg: dlg, env: env, node: null, idx: 0, did: false, picks: null, done: false };
      goNode(s, dlg.start);
      return s;
    },

    // What to show right now, or null when the session has ended.
    view: function (s) {
      if (!s || s.done) return null;
      var ls = linesOf(nodeOf(s)), l = ls[Math.min(s.idx, ls.length - 1)] || {};
      var sp = G.data.storySpeakers && G.data.storySpeakers[l.who];
      return {
        who: l.who, name: sp ? sp.name : '', color: sp ? sp.color : '#9a9a9a', mode: l.mode || 'say', text: l.text || '',
        static: l.static || 0, motif: !!l.motif, hum: !!l.hum,
        choices: s.picks && s.picks.length ? s.picks.map(function (c, k) { return { n: k + 1, i: c.i, text: c.text }; }) : null
      };
    },

    // Next line (or the end). Ignored while choices are shown.
    advance: function (s) {
      if (!s || s.done || s.picks) return;
      if (s.idx < linesOf(nodeOf(s)).length - 1) { s.idx++; arrive(s); return; }
      var next = resolve(s);
      if (next !== null) goNode(s, next);
    },

    // Picks the k-th shown choice (0-based, as listed by view().choices).
    choose: function (s, k) {
      if (!s || s.done || !s.picks || !s.picks[k]) return;
      var ci = s.picks[k].i, n = nodeOf(s), c = n.choices[ci];
      s.picks = null;
      if (c.once) s.env.mark(s.id + '|' + s.node + '|' + ci);
      if (c.do) s.env.run(c.do);
      goNode(s, c.next);
    },

    // Ends the session at once; the end bookkeeping still runs.
    abort: function (s) { if (s) finish(s); }
  };

  G.dialogue = dialogue;
})(typeof window !== 'undefined' ? window : globalThis);
