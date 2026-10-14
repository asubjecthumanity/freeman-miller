// Leader lines: thin SVG wires from projected 3D anchors to each room's info box.
//
// A room (from its box module's leaders(world)) gives:
//   anchors   [{ p, label, via?, labelSide?, port?, flow? }]
//               p          world point (Vector3) the wire starts at, with a dot and its label
//               via        world waypoints the wire runs through on its way to the junction (drawn as
//                          straight runs with rounded corners); ignored without a junction
//               labelSide  'left' | 'right'; by default the label goes right of the dot unless that
//                          would run under the box
//               port       a selector inside the panel: this wire runs to that element (its row) on
//                          its own instead of joining the loom
//               flow()     this wire carries the signal only while it returns true
//   junction  world point where the loom's wires meet (theater: the receiver); one soft trunk runs
//             from there to the box. Without it the wires meet just left of the box.
//   portAt    selector inside the panel the trunk runs to (default: the box heading)
//   flow(s)   the signal (mustard dashes) runs along the room's wires while it returns true
//
// Wide screens: wires end at the box's left edge; phones (bottom sheets): at the sheet's top edge.
// Recomputed every frame the room is on screen; the marching dashes are a CSS animation that only
// runs on a room whose wires are visible and flowing.
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent?.appendChild(e); return e; };
// an attribute written only when it changes: rewriting a wire's path with the same value still costs
// the SVG a layout, every frame that music plays at a still camera
const set = (e, k, v) => { const c = e.__a || (e.__a = {}); if (c[k] !== v) { c[k] = v; e.setAttribute(k, v); } };
const f1 = v => v.toFixed(1);
const EDGE = 16;

// a polyline through P with its corners rounded off (radius r px)
function rounded(P, r) {
  let d = `M${f1(P[0].x)} ${f1(P[0].y)}`;
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1], b = P[i], c = P[i + 1];
    const l1 = Math.hypot(b.x - a.x, b.y - a.y) || 1, l2 = Math.hypot(c.x - b.x, c.y - b.y) || 1;
    const k1 = Math.min(r, l1 / 2) / l1, k2 = Math.min(r, l2 / 2) / l2;
    d += ` L${f1(b.x - (b.x - a.x) * k1)} ${f1(b.y - (b.y - a.y) * k1)} Q${f1(b.x)} ${f1(b.y)} ${f1(b.x + (c.x - b.x) * k2)} ${f1(b.y + (c.y - b.y) * k2)}`;
  }
  const z = P[P.length - 1];
  return `${d} L${f1(z.x)} ${f1(z.y)}`;
}
// an S-curve that leaves the anchor and arrives at the port square to the box edge
const sCurve = (q, px, py, mobile) => mobile
  ? `M${f1(q.x)} ${f1(q.y)} C${f1(q.x)} ${f1(q.y + (py - q.y) * 0.55)} ${f1(px)} ${f1(py - (py - q.y) * 0.45)} ${f1(px)} ${f1(py)}`
  : `M${f1(q.x)} ${f1(q.y)} C${f1(q.x + (px - q.x) * 0.55)} ${f1(q.y)} ${f1(px - (px - q.x) * 0.45)} ${f1(py)} ${f1(px)} ${f1(py)}`;

export function createLeaders(svg, rooms) {
  const built = rooms.map(r => {
    const g = el('g', { class: 'room-leaders', opacity: 0 }, svg);
    const loom = el('g', { class: 'loom' }, g);
    const lines = r.anchors.map(a => {
      const lg = el('g', { class: 'wire-g' }, a.port ? g : loom);
      return {
        a, g: lg,
        halo: el('path', { class: 'halo' }, lg), wire: el('path', { class: 'wire' }, lg), flow: el('path', { class: 'flow' }, lg),
        ring: el('circle', { class: 'ring', r: 7 }, lg), dot: el('circle', { class: 'dot', r: 3.2 }, lg),
        end: a.port ? el('circle', { class: 'dot', r: 3.2 }, lg) : null,
        tag: a.label ? Object.assign(el('text', { class: 'tag' }, lg), { textContent: a.label }) : null,
        tw: 0, shown: null, fade: '',
      };
    });
    const pooled = lines.some(l => !l.a.port);
    const trunk = pooled ? { halo: el('path', { class: 'halo' }, loom), wire: el('path', { class: 'wire' }, loom), flow: el('path', { class: 'flow' }, loom) } : null;
    const port = pooled ? el('circle', { class: 'dot', r: 3.6 }, loom) : null;
    return { ...r, g, loom, lines, trunk, port, rect: null, ends: null, on: false };
  });
  let mobile = false;
  const invalidate = () => built.forEach(b => { b.rect = null; b.ends = null; });
  const measure = () => { mobile = matchMedia('(max-aspect-ratio: 4/5), (max-width: 760px) and (min-height: 501px)').matches; invalidate(); };
  window.addEventListener('resize', measure);
  measure();
  const ro = new ResizeObserver(invalidate);
  built.forEach(b => { ro.observe(b.panel); b.panel.addEventListener('scroll', () => { b.rect = null; b.ends = null; }, { passive: true }); });

  const hide = l => { if (l.shown !== false) { l.g.style.display = 'none'; l.shown = false; } };
  const show = l => { if (l.shown !== true) { l.g.style.display = ''; l.shown = true; } };

  return {
    // weights: opacity per stop (0..1); project: world point -> {x,y} | null; state: the frame state;
    // moving: the boxes scroll with the page (reduced motion), so measure them every frame
    update(weights, project, state, moving) {
      let anyFlow = false;
      for (const b of built) {
        const w = weights[b.stop] || 0;
        if (w < 0.01) {
          if (b.on) { b.on = false; set(b.g, 'opacity', 0); b.g.classList.remove('flowing'); b.lines.forEach(l => l.g.classList.remove('flowing')); }
          continue;
        }
        b.on = true;
        set(b.g, 'opacity', w.toFixed(3));
        // measured once and on resize, scroll or a change of the box (ResizeObserver), never per frame:
        // reading layout right after the frame's style writes would force a style pass every frame
        if (!b.rect || moving) { b.rect = b.panel.getBoundingClientRect(); const h = b.portAt ? b.panel.querySelector(b.portAt) : null; b.headRect = h ? h.getBoundingClientRect() : null; }
        const R = b.rect;
        // the trunk's port: beside the box heading (or portAt), or on the sheet's top edge
        let px = 0, py = 0, jx = 0, jy = 0, J = null;
        if (b.trunk) {
          const hr = b.headRect || R;
          if (mobile) { px = R.left + Math.min(56, R.width * 0.2); py = R.top; jx = px; jy = py - 30; }
          else { px = R.left; py = Math.max(R.top + 24, Math.min(R.bottom - 24, hr.top + hr.height / 2)); jx = px - 46; jy = py; }
          if (b.junction) { const pj = project(b.junction); if (pj && pj.x > 0 && pj.y > 0 && pj.x < innerWidth && pj.y < innerHeight && (mobile ? pj.y < R.top - 12 : pj.x < R.left - 12)) J = pj; }
          if (J) {
            jx = J.x; jy = J.y;
            // wide screens: the trunk runs level from the junction toward the box and steps up or down
            // into it only if the junction is above or below it
            if (!mobile) py = Math.max(R.top + 18, Math.min(R.bottom - 18, jy));
          }
        }
        const level = !!J && !mobile;
        // the trunk's course (wide screens, with a junction): level, then a square bend into the box
        const bendX = px - 28, course = level ? (Math.abs(py - jy) < 1 ? [{ x: px, y: py }] : [{ x: bendX, y: jy }, { x: bendX, y: py }, { x: px, y: py }]) : null;
        // per-wire ports (their rows), measured with the box
        if (!b.ends || moving) b.ends = b.lines.map(l => (l.a.port ? b.panel.querySelector(l.a.port)?.getBoundingClientRect() || null : null));
        const roomFlow = b.flow ? !!b.flow(state) : false;
        let loomFlow = false, anyShown = false;
        b.lines.forEach((l, i) => {
          const q = project(l.a.p);
          // every wire starts at a dot on screen: one whose dot nears the screen's edge fades out over the
          // last EDGE px (on phones the theater's subwoofer sits just off the left edge)
          const e = q ? Math.min(q.x, innerWidth - q.x, q.y, innerHeight - q.y) : -1;
          const ok = e > 4 && (mobile ? q.y < R.top - 12 : q.x < R.left - 12);
          if (!ok) { hide(l); return; }
          show(l);
          const fade = e < 4 + EDGE ? ((e - 4) / EDGE).toFixed(2) : '';
          if (fade !== l.fade) { l.fade = fade; l.g.style.opacity = fade; }
          anyShown = true;
          const flowing = l.a.flow ? !!l.a.flow(state) : roomFlow;
          l.g.classList.toggle('flowing', flowing);
          let d;
          if (l.a.port) {
            // its own wire to its row: square onto the box edge at the row (phones: the sheet's top)
            const e = b.ends[i];
            const ex = mobile ? (e ? e.left + e.width / 2 : R.left + 40) + i * 14 : R.left;
            const ey = mobile ? R.top : (e ? Math.max(R.top + 16, Math.min(R.bottom - 16, e.top + e.height / 2)) : R.top + 40);
            d = sCurve(q, ex, ey, mobile);
            set(l.end, 'cx', f1(ex)); set(l.end, 'cy', f1(ey));
          } else {
            loomFlow ||= flowing;
            const vias = J && l.a.via ? l.a.via.map(project) : null;
            // right of the junction, over a level trunk: drop straight onto it and run with it to the box
            if (level && q.x > jx + 8) d = q.x > bendX - 14 ? rounded([q, { x: q.x, y: py }, { x: px, y: py }], 14) : rounded([q, { x: q.x, y: jy }, ...course], 14);
            else if (vias && vias.length && vias.every(Boolean)) d = rounded([q, ...vias, J], 14);
            else if (J) d = rounded([q, mobile ? { x: q.x, y: J.y } : { x: J.x, y: q.y }, J], 14);
            else {
              // a soft elbow from the anchor into the junction beside the box
              const mx = mobile ? q.x : q.x + (jx - q.x) * 0.55, my = mobile ? q.y + (jy - q.y) * 0.55 : q.y;
              d = `M${f1(q.x)} ${f1(q.y)} Q${f1(mx)} ${f1(my)} ${f1(jx)} ${f1(jy)}`;
            }
          }
          set(l.halo, 'd', d); set(l.wire, 'd', d); set(l.flow, 'd', d);
          set(l.ring, 'cx', f1(q.x)); set(l.ring, 'cy', f1(q.y));
          set(l.dot, 'cx', f1(q.x)); set(l.dot, 'cy', f1(q.y));
          if (l.tag) {
            if (!l.tw) l.tw = l.tag.getComputedTextLength?.() || l.a.label.length * 7;
            const left = l.a.labelSide ? l.a.labelSide === 'left' : (!mobile && q.x + 11 + l.tw > R.left - 14);
            set(l.tag, 'x', f1(left ? q.x - 11 : q.x + 11)); set(l.tag, 'y', f1(q.y - 9));
            set(l.tag, 'text-anchor', left ? 'end' : 'start');
          }
        });
        if (b.trunk) {
          b.loom.style.display = anyShown ? '' : 'none';
          const td = level ? rounded([{ x: jx, y: jy }, ...course], 14)
            : J ? (mobile ? `M${f1(jx)} ${f1(jy)} C${f1(jx)} ${f1((jy + py) / 2)} ${f1(px)} ${f1((jy + py) / 2)} ${f1(px)} ${f1(py)}`
                      : `M${f1(jx)} ${f1(jy)} C${f1((jx + px) / 2)} ${f1(jy)} ${f1((jx + px) / 2)} ${f1(py)} ${f1(px)} ${f1(py)}`)
            : `M${f1(jx)} ${f1(jy)} L${f1(px)} ${f1(py)}`;
          set(b.trunk.halo, 'd', td); set(b.trunk.wire, 'd', td); set(b.trunk.flow, 'd', td);
          set(b.port, 'cx', f1(px)); set(b.port, 'cy', f1(py));
          b.loom.classList.toggle('flowing', loomFlow);
        }
        anyFlow ||= w > 0.5 && (loomFlow || b.lines.some(l => l.shown && l.g.classList.contains('flowing')));
      }
      svg.classList.toggle('playing', anyFlow);
    },
    invalidate,
  };
}
