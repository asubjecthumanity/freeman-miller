// The journey engine. Every room owns its own numbers in js/rooms/<room>.js; this file puts them in
// order, turns them into the arrays the rest of the engine reads, and evaluates the camera path.
//
// A room file exports one object:
//   stop, id, name   its integer position on the timeline u (0 outside, 1 theater, ...), its URL hash
//                    (#id) and its map name
//   group            the world group it draws (world.js: exterior | theater | living | studio | office)
//   key              the camera key at the stop: { u: stop, p, look | yaw+pitch, fov, stop: true, port, fit }
//                    fit (optional, an aspect ratio): on landscape screens narrower than that, the view
//                    at the stop widens to show as much across as at that aspect (world.js FIT)
//   moveIn           the move that ARRIVES here from the previous stop (stop-1 < u < stop):
//                      keys        camera keys strictly inside that range
//                      portals     capsule holes the move passes through:
//                                  { a, b, r, open: [u0, u1], close: [u0, u1] } (radius opens over
//                                  `open`, closes over `close`; absolute u)
//                      lightBlend  [f0, f1]: where in the move (0..1) the light rig cross-fades from
//                                  the previous room's preset to this one (default [0.4, 0.8])
//   moveOut          the same, for the move that LEAVES (stop < u < stop+1). Only outside has one:
//                    it owns the move into the theater, so the theater has no moveIn.
//   light            preset at the stop: { hemi: [sky, ground, i], sun: { pos, target, color, i, box },
//                    env, exposure }
//   frame            { x, y }: how far the picture slides away from the info box (fraction of the
//                    viewport; x on wide screens, y on portrait), scaled by the box's opacity
//   visible          u ranges in which the room's world group is drawn: [[u0, u1], ...]
//   length           section height in viewport heights: the dwell at this stop plus the scroll of
//                    the move that leaves it
//   parent           (steps only) the id of the room a step belongs to. A room can bring steps after
//                    its own stop (the office's sessions: rooms/office.js `steps`). A step is a stop
//                    like any other (key, moveIn, light, frame, length, its own hash) but has no box,
//                    no world group of its own (`group` names the parent's) and no map entry: the map
//                    shows its parent room (roomOf).
//
// Camera keys: p is the position; aim with look (a point) or yaw/pitch in degrees (yaw 0 looks toward
// -z, positive yaw turns left). port overrides any of p / look / yaw / pitch / fov on portrait
// screens. Tangents are zero at stops so moves ease in and out; between stops the path is a
// Hermite curve through the keys. Yaw derived from `look` is unwrapped (short way round); an
// authored yaw is used as written, which is how the studio turn goes left.
import outside from './rooms/outside.js';
import theater from './rooms/theater.js';
import living from './rooms/living.js';
import studio from './rooms/studio.js';
import office, { steps as officeSteps } from './rooms/office.js';

// the rooms in journey order, then the office's steps (one per Claude session, then the sign-off)
export const ROOMS = [outside, theater, living, studio, office, ...officeSteps];

// the move between stop i and i+1, whichever room owns it
const moveAfter = i => ROOMS[i].moveOut || ROOMS[i + 1]?.moveIn || null;

export const STOPS = ROOMS.map(r => ({ id: r.id, name: r.name, parent: r.parent || null }));
// the room a stop belongs to: a step's parent room, else the stop itself
export const roomOf = i => { const p = STOPS[i]?.parent; return p ? STOPS.findIndex(s => s.id === p) : i; };
export const KEYS = [...ROOMS.map(r => r.key), ...ROOMS.flatMap((r, i) => moveAfter(i)?.keys || [])].sort((a, b) => a.u - b.u);
export const FRAME = ROOMS.map(r => r.frame);
export const FIT = ROOMS.map(r => r.key.fit || 0);
export const LIGHTS = ROOMS.map((r, i) => {
  const blend = moveAfter(i)?.lightBlend;
  return blend ? { ...r.light, blend } : { ...r.light };
});
export const PORTALS = ROOMS.flatMap((r, i) => moveAfter(i)?.portals || []);
// a step draws its parent's group, so only rooms set visibility
export const VISIBLE = Object.fromEntries(ROOMS.filter(r => !r.parent).map(r => [r.group, r.visible]));
export const LENGTH = ROOMS.map(r => r.length);

// catch a room's numbers straying outside the part of the timeline it owns (silent when all is well)
(function check() {
  const bad = [];
  ROOMS.forEach((r, i) => {
    if (r.stop !== i) bad.push(`${r.id}: stop is ${r.stop}, listed at ${i}`);
    if (r.key?.u !== i || !r.key.stop) bad.push(`${r.id}: key must have u: ${i} and stop: true`);
    if (r.moveIn && i === 0) bad.push(`${r.id}: the first stop has no moveIn`);
    if (r.moveIn && ROOMS[i - 1]?.moveOut) bad.push(`${r.id}: moveIn clashes with ${ROOMS[i - 1].id}.moveOut`);
    for (const [m, a] of [[r.moveIn, i - 1], [r.moveOut, i]]) for (const k of m?.keys || []) if (!(k.u > a && k.u < a + 1)) bad.push(`${r.id}: move key u=${k.u} is outside ${a}..${a + 1}`);
  });
  if (bad.length) console.warn(`path.js: room data problems:\n${bad.join('\n')}`);
})();

/* ---------- camera path evaluation ---------- */
const D2R = Math.PI / 180;
function aim(p, t) {
  const dx = t[0] - p[0], dy = t[1] - p[1], dz = t[2] - p[2];
  return [Math.atan2(-dx, -dz) / D2R, Math.atan2(dy, Math.hypot(dx, dz)) / D2R];
}
// rows of [x, y, z, yaw, pitch, fov] with Hermite tangents; port: use the portrait overrides
export function buildTrack(keys, port) {
  const rows = keys.map(k => {
    const o = (port && k.port) || {};
    const p = o.p || k.p;
    let yaw, pitch;
    if (o.yaw != null) [yaw, pitch] = [o.yaw, o.pitch ?? k.pitch ?? 0];
    else if (o.look) [yaw, pitch] = aim(p, o.look);
    else if (k.yaw != null) [yaw, pitch] = [k.yaw, k.pitch ?? 0];
    else [yaw, pitch] = aim(p, k.look);
    return { u: k.u, stop: !!k.stop, v: [p[0], p[1], p[2], yaw, pitch, o.fov ?? k.fov ?? 45] };
  });
  // unwrap yaw so each step takes the short way round unless authored explicitly
  for (let i = 1; i < rows.length; i++) {
    let y = rows[i].v[3];
    const prev = rows[i - 1].v[3];
    if (keys[i].yaw == null && !(port && keys[i].port?.yaw != null)) { while (y - prev > 180) y -= 360; while (y - prev < -180) y += 360; }
    rows[i].v[3] = y;
  }
  // tangents
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.stop || i === 0 || i === rows.length - 1) { r.m = [0, 0, 0, 0, 0, 0]; continue; }
    const a = rows[i - 1], b = rows[i + 1];
    r.m = r.v.map((_, j) => (b.v[j] - a.v[j]) / (b.u - a.u));
  }
  return rows;
}
export function evalTrack(rows, u, out) {
  if (u <= rows[0].u) { out.set(rows[0].v); return; }
  const last = rows[rows.length - 1];
  if (u >= last.u) { out.set(last.v); return; }
  let i = 0;
  while (i < rows.length - 2 && u > rows[i + 1].u) i++;
  const A = rows[i], B = rows[i + 1], du = B.u - A.u, t = (u - A.u) / du;
  const t2 = t * t, t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
  for (let j = 0; j < 6; j++) out[j] = h00 * A.v[j] + h10 * du * A.m[j] + h01 * B.v[j] + h11 * du * B.m[j];
}
