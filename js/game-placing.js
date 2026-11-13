// Placing and moving structures and floor blocks in the base.
// Part of the old js/game.js: all js/game-*.js files share one private object (G.gx); load order is in index.html.
(function (root) {
  'use strict';
  var G = root.G, X = G.gx = G.gx || {};
  var cam = X.cam, st = X.st;

  // functions of the other game-*.js files
  function place() { return X.place.apply(null, arguments); }
  function snd() { return X.snd.apply(null, arguments); }
  function save() { return X.save.apply(null, arguments); }
  function applyBuildings() { return X.applyBuildings.apply(null, arguments); }
  // st.placing = null | { kind: 'struct', id, carry: {x,y} | null, ghost } | { kind: 'floor', mat, ghost, warnT }
  function placingCtx() { return { bag: st.bag, chest: st.chest, buildings: st.buildings, fence: st.fence, placed: st.placed }; }

  function startPlacing(p) {
    st.placing = p; p.ghost = null; p.warnT = 0;
    G.ui.toast(p.kind === 'move' ? 'הזזה: לחצו על מבנה, מחסן או בלוק רצפה (Shift: כל הרצפה), ואז על המקום החדש · קליק ימני או Esc: ביטול/סיום' : p.kind === 'floor' ? 'רצפה: לחיצה (או החזקה) מניחה בלוק · קליק ימני מסיר · Esc לסיום'
      : 'בחרו מקום: לחיצה מניחה · קליק ימני על מבנה מרים אותו · Esc ביטול', 3200);
  }

  // ---- "move" mode: grab a placed structure, the chest or floor blocks (Shift: the whole connected floor) and put it down again ----
  function moveTarget(w) {
    var P = G.placing, i, p, s, L = G.base.layout.chest;
    for (i = st.placed.length - 1; i >= 0; i--) {
      p = st.placed[i]; s = P.size(p.id);
      if (w.x >= p.x && w.x <= p.x + s.w && w.y >= p.y && w.y <= p.y + s.h) return { type: 'struct', id: p.id, idx: i, rect: { x: p.x, y: p.y, w: s.w, h: s.h } };
    }
    if (w.x >= L.x && w.x <= L.x + L.w && w.y >= L.y && w.y <= L.y + L.h) return { type: 'chest', id: 'chest', rect: { x: L.x, y: L.y, w: L.w, h: L.h } };
    var c = P.cellAt(w.x, w.y);
    return c && st.floor.cells[c.key] ? { type: 'floor', cell: c } : null;
  }

  function solidOf(kind, x, y) {
    for (var i = 0; i < st.base.solids.length; i++) { var r = st.base.solids[i]; if (r.kind === kind && r.x === x && r.y === y) return r; }
    return null;
  }

  function moveStep(pl, inp, w) {
    var P = G.placing, shift = inp.isDown('ShiftLeft') || inp.isDown('ShiftRight'), c = pl.carry, t, r;
    if (!c) {
      t = moveTarget(w);
      if (t && t.type === 'floor') {
        var keys = shift ? P.group(st.floor, t.cell.key) : [t.cell.key];
        pl.ghost = { cells: keys.map(function (k) { var q = k.split(','); return P.cellRect(+q[0], +q[1]); }), ok: true };
      } else if (t) pl.ghost = { rect: t.rect, ok: true };
      if (inp.mouse.rclicked) { stopPlacing(); return; }
      if (!inp.mouse.clicked || !t) return;
      snd('ui');
      if (t.type === 'floor') {                                 // lift the block(s): they leave the ground until put down again
        var ks = shift ? P.group(st.floor, t.cell.key) : [t.cell.key], ax = t.cell.cx, ay = t.cell.cy;
        pl.carry = { type: 'floor', cells: ks.map(function (k) { var q = k.split(','); return { dx: +q[0] - ax, dy: +q[1] - ay, mat: st.floor.cells[k], key: k }; }) };
        ks.forEach(function (k) { delete st.floor.cells[k]; });
      } else pl.carry = { type: t.type, id: t.id, idx: t.idx, from: { x: t.rect.x, y: t.rect.y } };
      return;
    }
    if (c.type === 'floor') {
      var a = P.cellAt(w.x, w.y);
      if (!a) return;
      var rects = c.cells.map(function (q) { return P.cellRect(a.cx + q.dx, a.cy + q.dy); }), ok = rects.every(function (q) { return !!q; });
      pl.ghost = { cells: rects.filter(function (q) { return q; }), ok: ok };
      if (inp.mouse.rclicked) { stopPlacing(); return; }
      if (inp.mouse.clicked) {
        if (!ok) { G.ui.toast('הרצפה לא נכנסת שם', 1200); snd('uiBad'); return; }
        c.cells.forEach(function (q, i) { st.floor.cells[rects[i].key] = q.mat; });
        pl.carry = null; snd('build'); save('floor');
      }
      return;
    }
    r = P.rectAt(c.id, w.x, w.y);
    var why = P.check(st.base, r, c.type === 'chest' ? solidOf('chest', G.base.layout.chest.x, G.base.layout.chest.y) : solidOf(c.id, c.from.x, c.from.y));
    pl.ghost = { rect: r, ok: !why, label: c.id === 'chest' ? 'מחסן' : G.data.buildings[c.id].name };
    if (inp.mouse.rclicked) { stopPlacing(); return; }
    if (inp.mouse.clicked) {
      if (why) { G.ui.toast(why === 'gate' ? 'השאירו את הכניסה פנויה' : 'המקום תפוס', 1200); snd('uiBad'); return; }
      if (c.type === 'chest') G.base.setChest({ x: r.x, y: r.y }); else { st.placed[c.idx].x = r.x; st.placed[c.idx].y = r.y; }
      pl.carry = null; applyBuildings(); snd('build'); save('move');
    }
  }

  function stopPlacing() {
    var pl = st.placing;
    if (!pl) return;
    if (pl.kind === 'move') {                                   // a lifted floor goes back where it was; structures never left
      if (pl.carry && pl.carry.type === 'floor') pl.carry.cells.forEach(function (q) { st.floor.cells[q.key] = q.mat; });
      st.placing = null; save('move'); return;
    }
    if (pl.kind === 'struct' && pl.carry) { st.placed.push({ id: pl.id, x: pl.carry.x, y: pl.carry.y }); applyBuildings(); }   // a picked-up copy goes back
    st.placing = null;
    if (pl.kind === 'floor') save('floor');
  }

  function placingStep(dt, inp) {
    var pl = st.placing, P = G.placing, inside = inp.mouse.inside;
    var w = inside ? { x: inp.mouse.x + cam.x, y: inp.mouse.y + cam.y } : null;
    pl.warnT = Math.max(0, pl.warnT - dt);
    pl.ghost = null;
    if (!w) return;
    if (pl.kind === 'move') { moveStep(pl, inp, w); return; }
    if (pl.kind === 'struct') {
      var r = P.rectAt(pl.id, w.x, w.y), why = P.check(st.base, r, null);
      pl.ghost = { rect: r, ok: !why, label: G.data.buildings[pl.id].name };
      if (inp.mouse.rclicked) {
        var i = pl.carry ? -1 : P.indexAt(st.placed, pl.id, w.x, w.y);
        if (i >= 0) { var q = st.placed.splice(i, 1)[0]; pl.carry = { x: q.x, y: q.y }; applyBuildings(); snd('ui'); }
        else stopPlacing();
        return;
      }
      if (inp.mouse.clicked) {
        if (why) { G.ui.toast(why === 'gate' ? 'השאירו את הכניסה פנויה' : 'המקום תפוס', 1200); snd('uiBad'); return; }
        if (!pl.carry) {
          var res = G.crafting.place(placingCtx(), pl.id);
          if (!res.ok) { G.ui.toast('חסרים חומרים', 1500); snd('uiBad'); st.placing = null; return; }
        }
        st.placed.push({ id: pl.id, x: r.x, y: r.y });
        pl.carry = null;
        applyBuildings(); snd('build'); save('place');
        G.ui.toast((pl.id === 'tank' ? 'הוצב: ' : 'הוצב: ') + G.data.buildings[pl.id].name, 1200);
        st.placing = null;
      }
      return;
    }
    // floor: hold the left button to lay blocks, the right one to take them up again
    var c = P.cellAt(w.x, w.y), M = G.data.floorMaterials;
    if (!c) return;
    pl.ghost = { cell: c, ok: true };
    var have = st.floor.cells[c.key];
    if (inp.mouse.down && have !== pl.mat) {
      if (have) G.crafting.refund(placingCtx(), M[have].cost);
      if (G.crafting.spend(placingCtx(), M[pl.mat].cost)) {
        if (have) G.crafting.spend(placingCtx(), M[have].cost);          // could not pay for the new one: keep the old block
        if (pl.warnT <= 0) { G.ui.toast('חסרים חומרים (' + Object.keys(M[pl.mat].cost).map(function (k) { return G.data.items[k].name; }).join(', ') + ')', 1400); pl.warnT = 1.5; snd('uiBad'); }
      } else { st.floor.cells[c.key] = pl.mat; snd('build', { gap: 0.12 }); G.ui.markDirty(); }
    } else if (inp.mouse.rdown && have) {
      G.crafting.refund(placingCtx(), M[have].cost);
      delete st.floor.cells[c.key]; snd('ui', { gap: 0.12 }); G.ui.markDirty();
    }
  }

  // ---- the story (js/story.js, js/storyui.js, js/storyart.js; data in story/data and data/story-wire.js) ----------


  X.placingCtx = placingCtx; X.startPlacing = startPlacing; X.moveTarget = moveTarget; X.solidOf = solidOf; X.moveStep = moveStep; X.stopPlacing = stopPlacing; X.placingStep = placingStep;
})(window);
