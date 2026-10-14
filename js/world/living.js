// The living room (owner: living): Freeman's real living room, stylised. A long room with honey oak
// floorboards, greige walls under a darker band, a pale ceiling with small downlights, and a wall of
// glass between brick piers looking out on the playing piece's world (screens/window-view.js). A black
// grand piano stands in front of the glass at the far left by a teak wall unit; a teal L-shaped
// sectional on a pale rug with blue circles faces two teak lounge chairs and a low table; a drum-shade
// floor lamp, a red-purple-blue painting, a telescope by the glass, plants.
// The piano's 88 keys are two InstancedMeshes that press with the playing piece's real notes, tinted by
// hand, with small motes of light rising from struck keys. A floating album cover flips to the playing
// piece. A clean drawn section lines the hole the camera rises through from the theater.
import * as THREE from 'three';
import { Builder, portalize, makeRand, rand, canvasTexture, portalUniforms } from './kit.js';
import { F1, C1, C0, LV, PART_Z, WALL } from './layout.js';
import { plant, emissive } from './parts.js';
import { WindowView } from './screens/window-view.js';
import { glowTexture, loadImage } from './screens/shared.js';
import { sectionProgress } from './shell.js';
import { PORTALS } from '../path.js';
import room from '../rooms/living.js';
import { paintStandIn, releasedPiece } from '../ui/living-box.js';

const LOW = 21, HIGH = 108;
const isBlack = m => [1, 3, 6, 8, 10].includes(m % 12);
// the room's inside faces
const X0 = LV.x0 + WALL, X1 = LV.x1 - WALL, Z0 = LV.z0 + WALL, Z1 = PART_Z - 0.06;
// the glass wall between the brick piers (shell.js `oBack`)
const GX0 = -9.75, GX1 = 0.75;
// where things stand
const PIANO = { x: -7.6, z: -3.55, s: 1.15, turn: -38 }; // keyboard front centre; turn: degrees off facing the camera
const SOFA = { x0: -5.45, x1: -1.95, back: -5.6, d: 0.96, returnTo: -3.6 };
const RUG = { x: -3.3, z: -4.1, w: 3.7, d: 2.4 };
const CHAIRS = [[-3.25, -3.5, -3.55, -5.2], [-2.3, -3.52, -2.65, -5.2]]; // x, z, and the point each one faces
const TABLE = { x: -3.0, z: -4.22 };
const COVER = { p: [-8.3, F1 + 2.12, -4.35], size: 0.98 };
export const HAND = { l: '#4f8fe0', r: '#f2a62a' };

const std = o => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });

// data: the room context from world.js ({ film, person, pianoCollection, otherMusic, projects, mediaBase, mobile })
export function buildLiving(M, T, data) {
  // the old window painter drew from the shared seeded stream; keep the stream where the studio and
  // office expect it (they are built after this room)
  for (let i = 0; i < 210; i++) rand();
  const rnd = makeRand(4411);
  const mediaBase = data.mediaBase || '';
  const group = new THREE.Group(); group.name = 'living';
  const B = new Builder();
  const y0 = F1;
  const camP = new THREE.Vector3(...room.key.p);
  // Ask the page for a frame when something changes while its loop may be asleep (a texture arrives,
  // a cross-fade, a flip or rising motes are still under way after the music stops). data.wake is the
  // app's own wake-up when it provides one; otherwise a same-size resize event, which app.js answers by
  // drawing a frame (journey.js ignores it; tested: no blank frame is composited). Deferred with a
  // timeout so it lands after the current frame has decided whether to sleep.
  const rawWake = data.wake || (() => window.dispatchEvent(new Event('resize')));
  let wakeQueued = false;
  const wake = () => { if (!wakeQueued) { wakeQueued = true; setTimeout(() => { wakeQueued = false; rawWake(); }, 0); } };

  /* ---------- materials (room-only) ---------- */
  const mat = {
    floor: portalize(std({ color: '#ffffff', map: oakTexture(rnd), roughness: 0.42, envMapIntensity: 0.3 })),
    teak: std({ color: '#ffffff', map: teakTexture(rnd), roughness: 0.5 }),
    teakDark: std({ color: '#4c2a17', roughness: 0.7 }),
    teakPlain: std({ color: '#a8673c', roughness: 0.45 }),
    darkWood: std({ color: '#2f241d', roughness: 0.4 }),
    teal: std({ color: '#1d8090', roughness: 0.95 }),
    tealDeep: std({ color: '#145c69', roughness: 0.9 }),
    cream: std({ color: '#d3c3a5', roughness: 1 }),
    // the piano's black: glossy, but reflecting the room rather than the sky outside
    piano: std({ color: '#080707', roughness: 0.2, envMap: interiorEnv(), envMapIntensity: 0.42 }),
    rug: portalize(std({ color: '#ffffff', map: rugTexture(), roughness: 1 })),
    shade: std({ color: '#f3e6cb', emissive: '#ffcf8f', emissiveIntensity: 0.62, roughness: 1, side: THREE.DoubleSide }),
    glaze: std({ color: '#2a2a31', roughness: 0.22, envMapIntensity: 1.1 }),
    curtain: std({ color: '#e7dcc6', roughness: 1, side: THREE.DoubleSide }),
    cobalt: std({ color: '#2a52b0', roughness: 0.3, metalness: 0.25 }),
    white: std({ color: '#f1ede5', roughness: 0.5 }),
    red: std({ color: '#b13b2c', roughness: 0.95 }),
    stripe: std({ color: '#ffffff', map: stripeTexture(), roughness: 1 }),
    painting: std({ color: '#ffffff', map: paintingTexture(rnd), roughness: 0.7 }),
    sheet: std({ color: '#ffffff', map: sheetTexture(rnd), roughness: 0.9, side: THREE.DoubleSide }),
    felt: std({ color: '#7d1f1c', roughness: 1 }),
  };
  mat.teak.userData.worldUV = 0.9;
  mat.floor.userData.worldUV = 2.2;

  /* ---------- the window view: a panorama far beyond the glass ---------- */
  const view = new WindowView(mediaBase, wake);
  group.add(view.mesh);
  const released = releasedPiece(data.pianoCollection);
  view.set(released.windowScene || 'blue-sky');

  /* ---------- finishes ---------- */
  // The shell (shell.js, owner: exterior) draws the room's architecture from the photo: the pale ceiling
  // with its downlights, light lower and dark upper walls, the brick piers and the glass. This room adds
  // the honey oak boards (portal-aware, so the hole up from the theater cuts them), the curtains and rail.
  B.rect(mat.floor, 'py', X0, X1, Z0, Z1, y0 + 0.005);
  curtain(B, mat.curtain, GX1 - 0.4, GX1 - 0.02, Z0 + 0.2, y0 + 0.02, C1 - 0.07, rnd);
  curtain(B, mat.curtain, GX0 + 0.02, GX0 + 0.42, Z0 + 0.2, y0 + 0.02, C1 - 0.07, rnd);
  B.aabb(M.frame, GX0, C1 - 0.08, Z0 + 0.14, GX1, C1 - 0.045, Z0 + 0.26);

  /* ---------- the end wall: teak wall unit, teak console under the painting, drum lamp ---------- */
  // The shell puts the glass on the room's long side, so the photo's two groups share this end wall, in
  // the photo's order from near to far: the wall unit (shelves over cabinets and drawers), then the low
  // teak console with the bold painting above it, then the tall drum-shade lamp, which stands clear of
  // the piano's lid seen from the stop (its base is behind the piano).
  wallUnit(B, mat, M, X0, -1.3, -2.55, y0, rnd);
  teakConsole(B, mat, M, X0, -2.7, -3.75, y0);
  // the painting above the console
  const pz = -3.22, ph = 1.28, pw = 0.98;
  B.aabb(M.black, X0 + 0.004, y0 + 1.12, pz - pw / 2, X0 + 0.05, y0 + 1.12 + ph, pz + pw / 2);
  B.rect(mat.painting, 'px', pz - pw / 2 + 0.005, pz + pw / 2 - 0.005, y0 + 1.125, y0 + 1.115 + ph, X0 + 0.052);

  /* ---------- drum-shade floor lamp ---------- */
  const lamp = { x: X0 + 0.42, z: -3.97, y: 0.08 }; // y: how much taller than the old lamp it stands
  const base = new THREE.LatheGeometry([[0, 0], [0.09, 0], [0.12, 0.08], [0.15, 0.32], [0.14, 0.62], [0.08, 0.86], [0.035, 0.93], [0.03, 1.0], [0, 1.0]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
  B.add(base, mat.glaze, { x: lamp.x, y: y0, z: lamp.z });
  B.cyl(M.brass, 0.012, 0.012, 0.42 + lamp.y, lamp.x, y0 + 1.2 + lamp.y / 2, lamp.z, 8);
  B.add(new THREE.CylinderGeometry(0.23, 0.29, 0.62, 28, 1, true), mat.shade, { x: lamp.x, y: y0 + 1.66 + lamp.y, z: lamp.z });
  B.cyl(emissive('#ffe4b5', 1.4), 0.27, 0.27, 0.005, lamp.x, y0 + 1.37 + lamp.y, lamp.z, 24);

  /* ---------- grand piano, bench, music stand ---------- */
  const piano = buildPiano(M, mat, rnd);
  const toCam = Math.atan2(camP.x - PIANO.x, camP.z - PIANO.z);
  piano.group.position.set(PIANO.x, y0, PIANO.z);
  piano.group.rotation.y = toCam + PIANO.turn * Math.PI / 180;
  piano.group.scale.setScalar(PIANO.s);
  group.add(piano.group);
  musicStand(B, M, mat, -8.85, -2.65, y0, toCam + 0.5);
  plant(B, M, X0 + 0.5, y0, Z0 + 0.5, 1.05);
  plant(B, M, X0 + 0.2, y0 + 0.64, -2.86, 0.4); // a little one on the console

  /* ---------- sectional, rug, chairs, coffee table ---------- */
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(RUG.w, RUG.d), mat.rug);
  rug.rotation.x = -Math.PI / 2; rug.position.set(RUG.x, y0 + 0.009, RUG.z); rug.receiveShadow = true;
  group.add(rug);
  sectional(B, mat, SOFA, y0);
  // two teak lounge chairs with their backs to us, facing the sofa
  for (const [x, z, fx, fz] of CHAIRS) {
    const ch = new THREE.Group();
    ch.position.set(x, y0, z);
    ch.rotation.y = Math.atan2(fx - x, fz - z);
    const cb = new Builder();
    loungeChair(cb, mat);
    cb.build(ch);
    group.add(ch);
  }
  // a low dark table with a bowl and books
  const tx = TABLE.x, tz = TABLE.z;
  B.box(mat.darkWood, 1.05, 0.04, 0.62, tx, y0 + 0.38, tz);
  B.box(mat.darkWood, 0.98, 0.02, 0.55, tx, y0 + 0.14, tz);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(mat.darkWood, 0.04, 0.38, 0.04, tx + sx * 0.48, y0 + 0.19, tz + sz * 0.27);
  B.add(new THREE.SphereGeometry(0.13, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat.white, { x: tx + 0.22, y: y0 + 0.53, z: tz - 0.05 });
  B.box(M.navy, 0.3, 0.035, 0.22, tx - 0.25, y0 + 0.418, tz + 0.06, { ry: 0.2 });
  B.box(M.mustard, 0.26, 0.03, 0.2, tx - 0.24, y0 + 0.45, tz + 0.05, { ry: 0.05 });
  plant(B, M, -0.35, y0, -5.3, 1.0);

  /* ---------- telescope by the glass, pointed at the sky ---------- */
  telescope(B, mat, M, -6.0, -5.2, y0);

  B.build(group);

  /* ---------- the floating album cover ---------- */
  const cover = makeCover(data, mediaBase, camP, wake);
  group.add(cover.group);
  cover.show(released);

  /* ---------- the clean section that lines the hole up from the theater ---------- */
  const hole = room.moveIn.portals[0];
  const holeIdx = PORTALS.indexOf(hole);
  const sleeve = makeSleeve(hole);
  group.add(sleeve);

  /* ---------- lights: the drum lamp, a ceiling fill, light on the piano ---------- */
  const lampLight = new THREE.PointLight('#ffc27a', 3.4, 7.5, 1.5);
  lampLight.position.set(lamp.x + 0.05, y0 + 1.55 + lamp.y, lamp.z);
  const fill = new THREE.PointLight('#ffe0b6', 1.9, 11, 1.4);
  fill.position.set(-4.4, C1 - 0.75, -3.4);
  const pianoLight = new THREE.PointLight('#fff1dc', 1.5, 5, 1.6);
  pianoLight.position.set(PIANO.x + 0.9, C1 - 0.35, PIANO.z + 0.5); // over the keyboard, clear of the cover
  group.add(lampLight, fill, pianoLight);

  /* ---------- listening: the camera leans in while a piece plays (rooms/living.js `listen`) ---------- */
  // The path (world.js) has already placed the camera for this frame when update() runs, and the frame is
  // drawn (and the leader lines projected) after every room's update, so the room can shift the camera
  // from its path pose toward the listening pose here, without touching the path or the journey.
  // `k` eases in over 1.3 s once a piece plays with the camera resting at the stop. The lean is an offset
  // from the stop's own pose (`rest`), so when the visitor scrolls on, the camera moves off with the path
  // at once while the offset melts away by the clock, over OUT s, or faster if the path itself goes faster
  // (a quick flight): then it is gone after PER_M m of travel, before the move reaches the studio partition
  // (or, going back, the hole in the floor). A 4 m lean is never undone within the first metre of the move
  // any more, which whipped the camera round at three or four times its usual speed. The turn back to the
  // path's heading (`kr`) is done sooner, while the path itself still turns slowly.
  const OUT = 0.9, OUT_TURN = 0.6, PER_M = 3.4;
  const listen = { k: 0, kr: 0, w: 0, t: 0, force: false, pose: room.listen };
  const stopAt = { land: new THREE.Vector3(...room.key.p), port: new THREE.Vector3(...(room.key.port?.p || room.key.p)) };
  const rest = { p: new THREE.Vector3(...room.key.p), yaw: 0, pitch: 0, fov: room.key.fov };
  const lastPath = new THREE.Vector3(); let hasLast = false;
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lean = (camera, want, reduced) => {
    if (!listen.pose) return false;
    const portrait = camera.aspect < 0.8;
    const d = camera.position.distanceTo(portrait ? stopAt.port : stopAt.land);
    // by the clock (the app's idle frames pass a short dt), at most a tenth of a second a frame
    const now = performance.now(), gap = (now - listen.t) / 1000, step = Math.min(0.1, Math.max(0, gap));
    listen.t = now;
    // how far the path moved the camera since the last frame (a jump-cut counts as a long way)
    const moved = hasLast ? camera.position.distanceTo(lastPath) : 0;
    lastPath.copy(camera.position); hasLast = true;
    // resting at the stop: lean from here (the path's pose at the stop, with the picture slid off the box)
    const atStop = d < 0.02;
    if (atStop) { rest.p.copy(camera.position); rest.yaw = camera.rotation.y; rest.pitch = camera.rotation.x; rest.fov = camera.fov; }
    const target = !reduced && (want || listen.force) && atStop ? 1 : 0;
    const k0 = listen.k;
    // a lean is never picked up again after the room was out of view for a while (no frames came here)
    if (reduced || (!target && gap > 0.3)) listen.k = listen.kr = 0;
    else if (target > k0) listen.k = listen.kr = Math.min(1, k0 + step / 1.3);
    else if (target < k0) {
      // (the piece paused with the camera still at the stop: back to the long view at an easier pace)
      listen.k = Math.max(0, k0 - Math.max(step / (atStop ? 1.1 : OUT), moved / PER_M));
      listen.kr = Math.min(listen.k, Math.max(0, listen.kr - Math.max(step / (atStop ? 1.1 : OUT_TURN), moved / PER_M)));
    }
    // (and never far from the stop, whatever happened)
    const far = 1 - smooth(2.6, 3.4, d), w = smooth(0, 1, listen.k) * far, wr = smooth(0, 1, listen.kr) * far;
    listen.w = w;
    if (w > 0.0005) {
      const L = portrait && listen.pose.port ? { ...listen.pose, ...listen.pose.port } : listen.pose;
      const dx = L.look[0] - L.p[0], dy = L.look[1] - L.p[1], dz = L.look[2] - L.p[2];
      let yaw = Math.atan2(-dx, -dz);
      const pitch = Math.atan2(dy, Math.hypot(dx, dz));
      while (yaw - rest.yaw > Math.PI) yaw -= 2 * Math.PI;
      while (yaw - rest.yaw < -Math.PI) yaw += 2 * Math.PI;
      camera.position.x += (L.p[0] - rest.p.x) * w;
      camera.position.y += (L.p[1] - rest.p.y) * w;
      camera.position.z += (L.p[2] - rest.p.z) * w;
      camera.rotation.set(camera.rotation.x + (pitch - rest.pitch) * wr, camera.rotation.y + (yaw - rest.yaw) * wr, 0);
      camera.fov += ((L.fov ?? rest.fov) - rest.fov) * w;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    }
    return listen.k !== k0 || (listen.k > 0 && listen.k < 1);
  };

  group.updateMatrixWorld(true);
  const anchors = {
    piano: piano.group.localToWorld(piano.anchor.clone()),
    keys: piano.group.localToWorld(piano.keysAnchor.clone()),
    // (live: slides along the keybed with the lean, see update())
    slip: new THREE.Vector3(),
    cover: new THREE.Vector3(...COVER.p),
  };
  const slipEnds = piano.slipAnchors.map(v => piano.group.localToWorld(v.clone()));
  anchors.slip.copy(slipEnds[0]);

  return {
    group, view, cover, anchors, backdrop: view.mesh,
    // listen.k: how far the camera leans in (0..1; listen.w is the weight applied, kr the turn's); listen.force =
    // true holds the pose without music (tests)
    listen,
    // called by app.js as the camera approaches the room: the covers and the glass's painted world
    loadMedia() { cover.loadMedia(); view.release(); },
    lights: [{ l: lampLight, i: 3.4 }, { l: fill, i: 1.9 }, { l: pianoLight, i: 1.5 }],
    // s: the frame state from app.js plus dt and time (see world.js frame).
    // pianoNotes: the playing piece's notes (null when no piece plays); pianoT: its current time
    update({ dt, time, pianoNotes, pianoT, reduced, playing, camera }) {
      const leaning = lean(camera, !!pianoNotes, reduced);
      anchors.slip.lerpVectors(slipEnds[0], slipEnds[1], listen.w);
      piano.update(pianoNotes, pianoT, dt, reduced);
      cover.update(dt, time, reduced);
      const fading = view.step(reduced);
      // seen from the lawn while the house stands open in section: no painted panorama behind the
      // house (world.js shows the backdrop with the room; nothing of this room hangs on the partition)
      if (sectionProgress() > 0) view.mesh.visible = false;
      // keep frames coming until a transition finishes, even if nothing plays any more
      if (!playing && (fading || leaning || cover.busy() || piano.busy())) wake();
      const r = holeIdx >= 0 ? portalUniforms.uPA.value[holeIdx].w : 0;
      const s = Math.max(r, 0.001);
      sleeve.scale.set(s, 1, s);
    },
    keyState: () => piano.keyState(),
  };
}

/* =====================================================================================
   The grand piano. Local frame: origin on the floor at the centre of the case's front edge, the
   keys stick out toward +z (the player), the tail runs to -z, bass on -x.
   ===================================================================================== */
function buildPiano(M, mat, rnd) {
  const g = new THREE.Group(); g.name = 'piano';
  const B = new Builder();
  const W = 1.5, L = 1.86, legH = 0.6, rimH = 0.29;
  const shape = new THREE.Shape();
  const h = -W / 2;
  shape.moveTo(h, 0);
  shape.lineTo(W / 2, 0);
  shape.lineTo(W / 2, 0.42);
  shape.bezierCurveTo(W / 2, 0.95, h + 0.82, 1.0, h + 0.72, 1.42);
  shape.bezierCurveTo(h + 0.64, 1.76, h + 0.52, L, h + 0.3, L);
  shape.bezierCurveTo(h + 0.08, L, h, L - 0.1, h, L - 0.3);
  shape.lineTo(h, 0);
  const rimGeo = new THREE.ExtrudeGeometry(shape, { depth: rimH, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 28 });
  rimGeo.rotateX(-Math.PI / 2);
  B.add(rimGeo, mat.piano, { y: legH });
  // inside the case: soundboard, golden plate, strings
  const inner = new THREE.ShapeGeometry(shape, 28); inner.rotateX(-Math.PI / 2);
  B.add(inner, mat.teak, { y: legH + rimH - 0.07, sx: 0.95, sz: 0.96, z: -0.03 });
  B.add(inner, M.brass, { y: legH + rimH - 0.045, sx: 0.84, sz: 0.86, z: -0.1 });
  for (let i = 0; i < 24; i++) {
    const u = h + 0.16 + i * 0.048, len = 1.6 - Math.pow((u - h) / W, 1.4) * 1.05;
    B.box(M.metal, 0.004, 0.004, len, u, legH + rimH - 0.035, -0.2 - len / 2);
  }
  // lid on the short stick, hinged along the straight (bass) side
  const lidGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.022, bevelEnabled: false, curveSegments: 28 });
  lidGeo.rotateX(-Math.PI / 2);
  const hinge = new THREE.Group();
  hinge.position.set(h, legH + rimH + 0.012, 0);
  hinge.rotation.z = 0.36;
  const lid = new THREE.Mesh(lidGeo, mat.piano);
  lid.position.set(-h, 0, -0.2); lid.scale.set(1, 1, 0.9);
  lid.castShadow = true; lid.receiveShadow = true;
  hinge.add(lid); g.add(hinge);
  B.box(mat.piano, 0.018, 0.5, 0.018, W / 2 - 0.3, legH + rimH + 0.24, -0.95, { rz: 0.16 });
  // legs on brass casters, pedal lyre
  for (const [lx, lz] of [[h + 0.13, -0.16], [W / 2 - 0.13, -0.16], [h + 0.42, -L + 0.3]]) {
    B.cyl(mat.piano, 0.065, 0.045, legH, lx, legH / 2, lz, 16);
    B.cyl(mat.piano, 0.08, 0.08, 0.08, lx, legH - 0.04, lz, 16);
    B.cyl(M.brass, 0.035, 0.035, 0.05, lx, 0.025, lz, 10);
  }
  B.box(mat.piano, 0.05, legH - 0.12, 0.05, -0.07, (legH - 0.12) / 2 + 0.08, -0.38);
  B.box(mat.piano, 0.05, legH - 0.12, 0.05, 0.07, (legH - 0.12) / 2 + 0.08, -0.38);
  B.box(mat.piano, 0.26, 0.06, 0.12, 0, 0.08, -0.34);
  for (const dx of [-0.065, 0, 0.065]) B.box(M.brass, 0.028, 0.014, 0.1, dx, 0.075, -0.25);
  // keybed, cheek blocks, fallboard, the red felt behind the keys, music desk
  const keyTop = 0.735, KZ0 = 0.02, KL = 0.15;
  B.aabb(mat.piano, h, keyTop - 0.1, -0.04, W / 2, keyTop - 0.03, KZ0 + KL + 0.02);
  B.aabb(mat.piano, h, keyTop - 0.1, -0.04, h + 0.13, keyTop + 0.06, KZ0 + KL + 0.02);
  B.aabb(mat.piano, W / 2 - 0.13, keyTop - 0.1, -0.04, W / 2, keyTop + 0.06, KZ0 + KL + 0.02);
  B.aabb(mat.piano, h + 0.13, keyTop, -0.07, W / 2 - 0.13, keyTop + 0.13, KZ0 - 0.005);
  B.aabb(mat.felt, h + 0.13, keyTop - 0.005, KZ0 - 0.012, W / 2 - 0.13, keyTop + 0.012, KZ0);
  const desk = new THREE.Group();
  desk.position.set(0, legH + rimH + 0.01, -0.16);
  desk.rotation.x = -0.3;
  const db = new Builder();
  db.box(mat.piano, 0.84, 0.3, 0.016, 0, 0.15, 0);
  db.box(mat.piano, 0.84, 0.025, 0.05, 0, 0.012, 0.02);
  db.rect(mat.sheet, 'pz', -0.38, 0.0, 0.03, 0.29, 0.0095);
  db.rect(mat.sheet, 'pz', 0.0, 0.38, 0.03, 0.29, 0.0095);
  db.build(desk); g.add(desk);
  // bench, pushed in a little off-centre
  const bench = new THREE.Group(); bench.position.set(0.05, 0, 0.62); bench.rotation.y = -0.06;
  const bb = new Builder();
  bb.box(mat.piano, 0.78, 0.06, 0.34, 0, 0.47, 0);
  bb.soft(M.leather, 0.74, 0.06, 0.31, 0, 0.525, 0, 0.025);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bb.box(mat.piano, 0.045, 0.45, 0.045, sx * 0.34, 0.225, sz * 0.13);
  bb.box(mat.piano, 0.68, 0.03, 0.025, 0, 0.12, 0.13); bb.box(mat.piano, 0.68, 0.03, 0.025, 0, 0.12, -0.13);
  bb.build(bench); g.add(bench);
  B.build(g);

  /* keys: two InstancedMeshes; the geometry is shaded by face (top bright, front a little darker,
     sides dark) so a key that drops shows the dark sides of its neighbours: a short shadow */
  const ka0 = h + 0.135, kaW = W - 0.27;
  const whites = []; for (let m = LOW; m <= HIGH; m++) if (!isBlack(m)) whites.push(m);
  const wk = kaW / whites.length;
  const wGeo = shadeByFace(new THREE.BoxGeometry(wk * 0.93, 0.022, KL), [1, 0.78, 0.42, 0.3, 0.4]); wGeo.translate(0, -0.011, KL / 2);
  const bGeo = shadeByFace(new THREE.BoxGeometry(wk * 0.56, 0.022, 0.095), [1, 0.7, 0.55, 0.4, 0.5]); bGeo.translate(0, 0.011, 0.0475);
  const whiteMesh = new THREE.InstancedMesh(wGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.3 }), whites.length);
  const blackMesh = new THREE.InstancedMesh(bGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.32 }), 36);
  whiteMesh.castShadow = blackMesh.castShadow = true;
  whiteMesh.receiveShadow = blackMesh.receiveShadow = true;
  const keyBy = new Array(128).fill(null), keyList = [];
  let wi = 0, bi = 0;
  for (let m = LOW; m <= HIGH; m++) {
    const black = isBlack(m);
    const k = { m, black, mesh: black ? blackMesh : whiteMesh, i: black ? bi++ : wi, x: black ? ka0 + wi * wk : ka0 + (wi + 0.5) * wk, y: keyTop, z: KZ0, press: 0, target: 0, hand: 'r' };
    if (!black) wi++;
    keyBy[m] = k; keyList.push(k);
  }
  const WHITE = new THREE.Color('#f4efe3'), BLACK = new THREE.Color('#2a2826');
  const HL = new THREE.Color(HAND.l), HR = new THREE.Color(HAND.r);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), col = new THREE.Color();
  const writeKey = k => {
    const a = k.press * (k.black ? 0.075 : 0.085);
    e.set(a, 0, 0); q.setFromEuler(e);
    m4.compose(p.set(k.x, k.y - k.press * 0.004, k.z), q, one);
    k.mesh.setMatrixAt(k.i, m4);
    const tint = k.hand === 'l' ? HL : HR;
    // a pressed key takes its hand's colour, a little brighter than lit paint so it reads from across
    // the room; its front face stays darker (vertex shading), and the neighbours' dark sides show
    if (k.black) col.copy(BLACK).lerp(tint, k.press).multiplyScalar(1 + k.press * 0.25);
    else col.copy(WHITE).lerp(tint, k.press).multiplyScalar(1 + k.press * 0.3);
    k.mesh.setColorAt(k.i, col);
  };
  for (const k of keyList) writeKey(k);
  g.add(whiteMesh, blackMesh);

  /* note motes: a small light rises from each struck key, in its hand's colour */
  const N = 48;
  const mPos = new Float32Array(N * 3), mCol = new Float32Array(N * 3);
  const motes = Array.from({ length: N }, () => ({ age: 9, life: 1, x: 0, y: 0, z: 0, vx: 0, vz: 0, r: 0, g: 0, b: 0 }));
  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3).setUsage(THREE.DynamicDrawUsage));
  mGeo.setAttribute('color', new THREE.BufferAttribute(mCol, 3).setUsage(THREE.DynamicDrawUsage));
  mGeo.setDrawRange(0, 0);
  const moteMat = new THREE.PointsMaterial({ size: 0.2, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
  const points = new THREE.Points(mGeo, moteMat);
  points.frustumCulled = false;
  g.add(points);
  let mi = 0, alive = 0, prevT = -1;
  const spawn = (k, hand) => {
    const mo = motes[mi++ % N];
    const c = hand === 'l' ? HL : HR;
    mo.age = 0; mo.life = 1.1 + rnd() * 0.5;
    mo.x = k.x + (rnd() - 0.5) * 0.01; mo.y = k.y + (k.black ? 0.04 : 0.02); mo.z = k.z + (k.black ? 0.06 : 0.1);
    mo.vx = (rnd() - 0.5) * 0.06; mo.vz = -0.05 - rnd() * 0.05;
    mo.r = c.r; mo.g = c.g; mo.b = c.b;
  };

  return {
    group: g,
    anchor: new THREE.Vector3(W / 2 - 0.25, legH + rimH + 0.2, -0.85),
    keysAnchor: new THREE.Vector3(0, keyTop, KZ0 + KL),
    // two points on the front of the keybed, under the keys, for the phones' wire (living-box.js leaders):
    // seen from the stop and from the listening pose, each sits about above the sheet's port
    slipAnchors: [new THREE.Vector3(-0.1, keyTop - 0.065, KZ0 + KL + 0.025), new THREE.Vector3(-0.45, keyTop - 0.065, KZ0 + KL + 0.025)],
    update(notes, t, dt, reduced) {
      for (let i = 0; i < keyList.length; i++) keyList[i].target = 0;
      if (notes && t != null) {
        for (let i = 0; i < notes.length; i++) {
          const n = notes[i];
          if (t >= n.t && t < n.t + n.d - 0.02) { const k = keyBy[n.p]; if (k) { k.target = 1; k.hand = n.h; } }
        }
        // onsets since the last frame (a seek or a long gap spawns nothing)
        if (!reduced && t > prevT && t - prevT < 0.4) {
          for (let i = 0; i < notes.length; i++) { const n = notes[i]; if (n.t > prevT && n.t <= t && keyBy[n.p]) spawn(keyBy[n.p], n.h); }
        }
      }
      prevT = notes ? t : -1;
      let dirtyW = false, dirtyB = false;
      for (let i = 0; i < keyList.length; i++) {
        const k = keyList[i];
        if (k.press === k.target) continue;
        if (reduced) k.press = k.target;
        else {
          k.press += (k.target - k.press) * Math.min(1, dt * (k.target > k.press ? 55 : 16));
          if (Math.abs(k.press - k.target) < 0.01) k.press = k.target;
        }
        writeKey(k);
        if (k.black) dirtyB = true; else dirtyW = true;
      }
      if (dirtyW) { whiteMesh.instanceMatrix.needsUpdate = true; whiteMesh.instanceColor.needsUpdate = true; }
      if (dirtyB) { blackMesh.instanceMatrix.needsUpdate = true; blackMesh.instanceColor.needsUpdate = true; }
      // motes
      if (alive || mi) {
        let n = 0;
        for (let i = 0; i < N; i++) {
          const mo = motes[i];
          if (mo.age >= mo.life) continue;
          mo.age += dt;
          const f = mo.age / mo.life;
          if (f >= 1) continue;
          const rise = 0.55 * f + 0.25 * f * f;
          mPos[n * 3] = mo.x + mo.vx * mo.age + Math.sin(mo.age * 5 + i) * 0.008;
          mPos[n * 3 + 1] = mo.y + rise;
          mPos[n * 3 + 2] = mo.z + mo.vz * mo.age;
          const a = Math.min(1, f * 8) * Math.pow(1 - f, 1.5) * 1.6;
          mCol[n * 3] = mo.r * a; mCol[n * 3 + 1] = mo.g * a; mCol[n * 3 + 2] = mo.b * a;
          n++;
        }
        alive = n;
        if (n === 0) mi = 0;
        mGeo.setDrawRange(0, n);
        mGeo.attributes.position.needsUpdate = true;
        mGeo.attributes.color.needsUpdate = true;
      }
    },
    keyState() { return keyList.filter(k => k.press > 0.4).map(k => ({ m: k.m, hand: k.hand })); },
    // motes still rising, or keys still settling after the music stopped
    busy: () => alive > 0 || keyList.some(k => k.press !== k.target),
  };
}

// vertex colours by face direction: [top, front, sides, bottom, back]
function shadeByFace(geo, [top, front, side, bottom, back]) {
  const n = geo.attributes.normal, c = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
    const v = ny > 0.5 ? top : ny < -0.5 ? bottom : nz > 0.5 ? front : nz < -0.5 ? back : side;
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v;
    void nx;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

/* =====================================================================================
   The floating album cover: a thin card with the artwork on both faces, bobbing gently in the
   lamplight. When another piece plays it does a physical half-turn (with a little hop) to show
   the new cover on its other face. Pieces without artwork get the designed stand-in.
   ===================================================================================== */
function makeCover(data, base, camP, wake) {
  const tracks = data.pianoCollection.tracks;
  const S = COVER.size, T = 0.018;
  const group = new THREE.Group(); group.name = 'cover';
  group.position.set(...COVER.p);
  const env = interiorEnv();
  const face = () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.62, clearcoat: 0.3, clearcoatRoughness: 0.4, envMap: env, envMapIntensity: 0.6 });
  const front = face(), back = face();
  const edge = new THREE.MeshStandardMaterial({ color: '#efe6d4', roughness: 0.7 });
  const card = new THREE.Mesh(new THREE.BoxGeometry(S, S, T), [edge, edge, edge, edge, front, back]);
  card.castShadow = true;
  const spin = new THREE.Group();
  spin.add(card);
  group.add(spin);
  // face the room's camera, turned a touch toward the piano
  const yaw0 = Math.atan2(camP.x - COVER.p[0], camP.z - COVER.p[2]) - 0.12;
  group.rotation.y = yaw0;

  const cache = new Map();
  const texFor = t => {
    if (cache.has(t.id)) return cache.get(t.id);
    const i = Math.max(0, tracks.findIndex(x => x.id === t.id));
    // every cover is drawn into a canvas of one size (a texture cannot change size once on the GPU)
    const C = 768, c = document.createElement('canvas'); c.width = c.height = C;
    const g2 = c.getContext('2d');
    if (t.artwork) { g2.fillStyle = '#5d7fae'; g2.fillRect(0, 0, C, C); } // until the artwork arrives
    else paintStandIn(g2, C, t, i);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const redraw = paint => { paint(); tex.needsUpdate = true; wake(); };
    // the artwork is fetched when the room is near (load()), or at once if this cover is asked for
    tex.userData.load = () => {
      if (!t.artwork || tex.userData.loading) return;
      tex.userData.loading = true;
      loadImage(base + t.artwork).then(img => redraw(() => g2.drawImage(img, 0, 0, C, C)), () => redraw(() => paintStandIn(g2, C, t, i)));
    };
    if (!t.artwork) document.fonts?.ready.then(() => redraw(() => paintStandIn(g2, C, t, i)));
    cache.set(t.id, tex);
    return tex;
  };
  // every cover's canvas exists from the start (so a flip never waits on a new texture or shader)
  tracks.forEach(texFor);
  let loaded = false;

  // The card's turn about its vertical axis: at rest it stands at a multiple of pi (even: the front face
  // toward the room, odd: the back). A new cover goes on the face turned away from the room at that
  // moment, and the card turns on (always the same way) to the next angle that shows that face. A change
  // in the middle of a turn carries on from the card's current angle and speed (a cubic from there to the
  // new rest), so it never jumps; the face that is showing keeps its picture until it turns away.
  let showing = null, rot = 0, turn = null;
  const PEAK = 1.5 * Math.PI / 1.1; // the top speed of a plain half-turn (rad/s)
  // angle and speed of the turn at time `now` (ms)
  const at = now => {
    if (!turn) return [rot, 0];
    const s = Math.min(1, (now - turn.t0) / 1000 / turn.d), s2 = s * s, s3 = s2 * s;
    const { r0, v0, r1, d } = turn;
    const r = (2 * s3 - 3 * s2 + 1) * r0 + (s3 - 2 * s2 + s) * d * v0 + (3 * s2 - 2 * s3) * r1;
    const v = s >= 1 ? 0 : ((6 * s2 - 6 * s) * r0 + (3 * s2 - 4 * s + 1) * d * v0 + (6 * s - 6 * s2) * r1) / d;
    return [r, v, s];
  };
  return {
    group,
    busy: () => !!turn,
    // the camera is coming: fetch every cover's picture (one request each, shared with the box's thumbnails)
    loadMedia() { if (loaded) return; loaded = true; tracks.forEach(t => texFor(t).userData.load()); },
    show(t) {
      if (!t || t.id === showing) return;
      const tex = texFor(t);
      if (loaded || showing != null) tex.userData.load();
      // both faces carry a map from the start, so a flip never recompiles a shader
      if (showing == null) { front.map = back.map = tex; front.needsUpdate = back.needsUpdate = true; showing = t.id; return; }
      const now = performance.now();
      const [r, v] = at(now);
      const away = Math.cos(r) >= 0 ? back : front;
      away.map = tex; away.needsUpdate = true;
      showing = t.id;
      // the next rest ahead where that face looks at the room (odd multiples of pi show the back)
      let k = Math.floor(r / Math.PI + 1e-6) + 1;
      if ((k % 2 === 1) !== (away === back)) k++;
      const r1 = k * Math.PI, dist = r1 - r;
      let d = 1.1 * Math.min(1.4, Math.max(0.6, dist / Math.PI));
      if (v > 0) d = Math.min(d, 3 * dist / v); // never so slow that the card swings past and back
      turn = { t0: now, d: Math.max(0.25, d), r0: r, v0: Math.max(0, v), r1 };
      wake();
    },
    update(dt, time, reduced) {
      let v = 0;
      if (turn) {
        let s;
        [rot, v, s] = at(performance.now());
        if (reduced || s >= 1) { rot = turn.r1 % (2 * Math.PI); v = 0; turn = null; }
      }
      // the card lifts while it spins and leans into the turn; both are nothing at rest
      const hop = 0.13 * Math.min(1, Math.abs(v) / PEAK), tilt = 0.07 * Math.sin(2 * rot) * Math.min(1, Math.abs(v) / PEAK * 1.6);
      const bob = reduced ? 0 : Math.sin(time * 0.85) * 0.03;
      spin.rotation.set(reduced ? 0 : Math.sin(time * 0.6) * 0.035 + tilt, rot + (reduced ? 0 : Math.sin(time * 0.43) * 0.09), reduced ? 0 : Math.sin(time * 0.7 + 1) * 0.02);
      spin.position.y = bob + hop;
    },
  };
}

/* =====================================================================================
   The section through the floor: a cylinder lining the hole the camera rises through, drawn like
   an architect's section: oak boards, subfloor, joist ends, the dark cavity, the ceiling board.
   ===================================================================================== */
function makeSleeve(P) {
  const yb = C0 - 0.012, yt = F1 + 0.014, hgt = yt - yb;
  const geo = new THREE.CylinderGeometry(1, 1, hgt, 72, 1, true);
  const c = s => new THREE.Color(s);
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uF1: { value: F1 }, uC0: { value: C0 }, uJ: { value: new THREE.Vector4(-3.45, -2.55, -1.65, -0.75) },
      uOak: { value: c('#c88645') }, uPly: { value: c('#dcc49a') }, uCav: { value: c('#2d221c') }, uIns: { value: c('#4a3a30') },
      uJoist: { value: c('#c9935a') }, uBoard: { value: c('#f1ede6') }, uLine: { value: c('#22170f') },
    },
    vertexShader: 'varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
    fragmentShader: `uniform float uF1; uniform float uC0; uniform vec4 uJ;
      uniform vec3 uOak; uniform vec3 uPly; uniform vec3 uCav; uniform vec3 uIns; uniform vec3 uJoist; uniform vec3 uBoard; uniform vec3 uLine;
      varying vec3 vW;
      void main(){
        float y = vW.y;
        float oakB = uF1 - 0.02, plyB = uF1 - 0.045, jT = uF1 - 0.045, jB = uC0 + 0.02, brdT = uC0 + 0.014;
        vec3 col;
        float dz = min(min(abs(vW.z - uJ.x), abs(vW.z - uJ.y)), min(abs(vW.z - uJ.z), abs(vW.z - uJ.w)));
        if (y > oakB) col = uOak * (0.92 + 0.08 * step(0.5, fract(vW.x * 9.0 + vW.z * 9.0)));
        else if (y > plyB) col = uPly;
        else if (y > brdT && y < jT && dz < 0.035) {
          // a joist cut across: end grain rings
          float r = length(vec2(dz * 1.6, y - (jT + jB) * 0.5));
          col = uJoist * (0.86 + 0.14 * sin(r * 420.0));
          if (dz > 0.03) col = uLine;
        }
        else if (y > brdT) col = mix(uCav, uIns, smoothstep(jB, jT, y) * 0.6);
        else col = uBoard;
        // crisp lines where the layers meet, like a drawn section
        float l = min(min(abs(y - oakB), abs(y - plyB)), abs(y - brdT));
        if (l < 0.0022) col = uLine;
        col *= mix(0.62, 1.0, smoothstep(uC0, uF1 + 0.01, y));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(P.a[0], (yb + yt) / 2, P.a[2]);
  mesh.scale.set(0.001, 1, 0.001);
  mesh.frustumCulled = false;
  mesh.name = 'floor-section';
  return mesh;
}

/* =====================================================================================
   Furniture
   ===================================================================================== */
// the long teak modular unit: a low run of cabinets and drawers with an open-shelf hutch and top
// cupboards over it; along the wall at x = wx, from z = za (near) to zb (far), facing +x
function wallUnit(B, mat, M, wx, za, zb, y0, rnd) {
  const d = 0.46, fx = wx + d, legH = 0.12, lowTop = y0 + 0.82;
  const zMid = Math.max(zb, za - 1.25); // the hutch spans za..zMid
  // low run
  B.aabb(mat.teak, wx, y0 + legH, zb, fx, lowTop, za);
  for (const z of [za - 0.08, zb + 0.08]) for (const x of [wx + 0.08, fx - 0.08]) B.cyl(mat.teakDark, 0.022, 0.016, legH, x, y0 + legH / 2, z, 8);
  // fronts: drawers on the far half, doors on the near half, pulls cut in as dark slots
  const n = Math.max(2, Math.round((za - zb) / 0.31)), half = Math.floor(n / 2), step = (za - zb) / n;
  for (let i = 1; i < n; i++) B.box(mat.teakDark, 0.006, lowTop - y0 - legH - 0.04, 0.008, fx + 0.002, (y0 + legH + lowTop) / 2, zb + i * step);
  for (let i = 0; i < half; i++) {
    const zc = zb + (i + 0.5) * step;
    for (let r = 1; r < 3; r++) B.box(mat.teakDark, 0.006, 0.006, step - 0.04, fx + 0.002, y0 + legH + r * (lowTop - y0 - legH) / 3, zc);
    for (let r = 0; r < 3; r++) B.box(mat.teakDark, 0.008, 0.018, 0.12, fx + 0.003, y0 + legH + (r + 0.78) * (lowTop - y0 - legH) / 3, zc);
  }
  for (let i = half; i < n; i++) B.box(mat.teakDark, 0.008, 0.12, 0.018, fx + 0.003, lowTop - 0.12, zb + (i + 0.5) * step - step * 0.38);
  // hutch: sides, shelves, top cupboards
  const hd = 0.34, hx = wx + hd, top = y0 + 2.02;
  B.aabb(mat.teak, wx, lowTop, za - 0.03, hx, top, za);
  B.aabb(mat.teak, wx, lowTop, zMid, hx, top, zMid + 0.03);
  B.aabb(mat.teak, wx, lowTop, zMid + (za - zMid) / 2 - 0.015, hx, top - 0.42, zMid + (za - zMid) / 2 + 0.015);
  for (const y of [lowTop + 0.36, lowTop + 0.76]) B.aabb(mat.teak, wx, y, zMid, hx, y + 0.025, za);
  B.aabb(mat.teak, wx, top - 0.42, zMid, hx, top, za);
  B.box(mat.teakDark, 0.006, 0.38, 0.006, hx + 0.002, top - 0.21, (za + zMid) / 2);
  B.box(mat.teakDark, 0.008, 0.1, 0.016, hx + 0.004, top - 0.36, (za + zMid) / 2 - 0.06);
  B.box(mat.teakDark, 0.008, 0.1, 0.016, hx + 0.004, top - 0.36, (za + zMid) / 2 + 0.06);
  // things on the shelves: books, a bowl, vases; on the low run under the shelves, a stack of records
  const bookMats = [M.mustard, M.navy, M.cream, M.rust, M.teal, M.olive];
  let z = za - 0.08;
  while (z > za - 0.55) { const w = 0.025 + rnd() * 0.03, hgt = 0.2 + rnd() * 0.1; B.box(bookMats[(rnd() * 6) | 0], 0.2, hgt, w, wx + 0.13, lowTop + 0.36 + 0.025 + hgt / 2, z - w / 2); z -= w + 0.003; }
  B.add(new THREE.SphereGeometry(0.11, 16, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat.white, { x: wx + 0.17, y: lowTop + 0.36 + 0.13, z: zMid + 0.32, sy: 0.6 });
  B.cyl(M.teal, 0.05, 0.065, 0.24, wx + 0.16, lowTop + 0.76 + 0.145, za - 0.3, 14);
  B.cyl(mat.white, 0.06, 0.045, 0.16, wx + 0.16, lowTop + 0.76 + 0.105, zMid + 0.25, 14);
  for (let i = 0; i < 8; i++) B.box(bookMats[i % 6], 0.31, 0.31, 0.006, wx + 0.18, lowTop + 0.16, zMid + 0.12 + i * 0.012, { rx: (i % 3 - 1) * 0.03 });
}

// the low teak console (the photo's sideboard under the painting): a lighter piece than the wall unit, on
// splayed tapered legs, three sliding doors with routed pulls; on top a record player, a framed photo
// and (placed by the room) a small plant. Along the wall at x = wx from z = za (near) to zb (far).
function teakConsole(B, mat, M, wx, za, zb, y0) {
  const d = 0.44, fx = wx + d, legH = 0.2, top = y0 + 0.64, body = top - 0.03;
  B.aabb(mat.teak, wx + 0.01, y0 + legH, zb + 0.015, fx - 0.01, body, za - 0.015);
  B.aabb(mat.teak, wx, body, zb, fx + 0.015, top, za);                       // the top, overhanging a little
  B.aabb(mat.teakDark, wx + 0.02, y0 + legH - 0.02, zb + 0.05, fx - 0.03, y0 + legH, za - 0.05); // rail
  for (const z of [za - 0.09, zb + 0.09]) for (const x of [wx + 0.07, fx - 0.07]) B.cyl(mat.teakDark, 0.02, 0.011, legH, x + (x > wx + d / 2 ? 0.015 : 0), y0 + legH / 2, z + (z > (za + zb) / 2 ? 0.015 : -0.015), 8);
  const n = 3, step = (za - zb) / n;
  for (let i = 1; i < n; i++) B.box(mat.teakDark, 0.006, body - y0 - legH - 0.03, 0.007, fx - 0.008, (y0 + legH + body) / 2, zb + i * step);
  for (let i = 0; i < n; i++) B.box(mat.teakDark, 0.008, 0.07, 0.016, fx - 0.006, body - 0.1, zb + (i + 0.5) * step + (i === 1 ? 0 : (i === 0 ? 1 : -1) * step * 0.36));
  // a record player with its lid up, and a framed photo leaning back
  B.box(mat.darkWood, 0.34, 0.075, 0.4, wx + 0.22, top + 0.038, zb + 0.32);
  B.cyl(M.black, 0.14, 0.14, 0.01, wx + 0.22, top + 0.08, zb + 0.3, 24);
  B.box(M.glass || mat.white, 0.012, 0.3, 0.4, wx + 0.05, top + 0.2, zb + 0.32, { rz: 0.25 });
  B.box(M.black, 0.025, 0.22, 0.17, wx + 0.12, top + 0.11, za - 0.42, { rz: -0.14 });
  B.box(mat.white, 0.004, 0.17, 0.12, wx + 0.137, top + 0.112, za - 0.42, { rz: -0.14 });
}

// the L-shaped sectional: a long run along the glass with its back to it and a return at the left
// end coming toward the room, both facing the chairs. Teal, tufted backs, low plinth.
function sectional(B, mat, S, y0) {
  const d = S.d, seatY = y0 + 0.44, plinth = 0.2;
  const back = S.back, front = back + d;
  // plinths
  B.aabb(mat.tealDeep, S.x0 + 0.02, y0 + 0.06, back + 0.02, S.x1 - 0.02, y0 + plinth + 0.06, front - 0.02);
  B.aabb(mat.tealDeep, S.x0 + 0.02, y0 + 0.06, front - 0.02, S.x0 + d - 0.02, y0 + plinth + 0.06, S.returnTo - 0.02);
  for (const [x, z] of [[S.x0 + 0.1, back + 0.1], [S.x1 - 0.1, back + 0.1], [S.x1 - 0.1, front - 0.1], [S.x0 + 0.1, S.returnTo - 0.1], [S.x0 + d - 0.1, S.returnTo - 0.1]]) B.cyl(mat.darkWood, 0.025, 0.018, 0.06, x, y0 + 0.03, z, 8);
  // seat cushions along the back run (left to right, starting after the corner)
  const runX0 = S.x0 + d, nRun = 3, cw = (S.x1 - 0.2 - runX0) / nRun;
  for (let i = 0; i < nRun; i++) B.soft(mat.teal, cw - 0.02, 0.2, d - 0.26, runX0 + (i + 0.5) * cw, seatY - 0.1 + 0.06, back + 0.24 + (d - 0.26) / 2, 0.06);
  B.soft(mat.teal, d - 0.26, 0.2, d - 0.26, S.x0 + 0.24 + (d - 0.26) / 2, seatY - 0.04, back + 0.24 + (d - 0.26) / 2, 0.06);
  // return cushions
  const rz0 = front, nRet = 2, rl = (S.returnTo - 0.2 - rz0) / nRet;
  for (let i = 0; i < nRet; i++) B.soft(mat.teal, d - 0.26, 0.2, rl - 0.02, S.x0 + 0.24 + (d - 0.26) / 2, seatY - 0.04, rz0 + (i + 0.5) * rl, 0.06);
  // backs (tufted): along the glass and along the left side of the return
  const backTop = y0 + 0.82;
  B.soft(mat.teal, S.x1 - S.x0 - 0.2, backTop - seatY + 0.06, 0.24, (S.x0 + S.x1 - 0.2) / 2, (seatY + backTop) / 2 - 0.02, back + 0.12, 0.08);
  B.soft(mat.teal, 0.24, backTop - seatY + 0.06, S.returnTo - 0.2 - back, S.x0 + 0.12, (seatY + backTop) / 2 - 0.02, (back + S.returnTo - 0.2) / 2, 0.08);
  // arms at the open ends
  B.soft(mat.teal, 0.2, 0.62, d, S.x1 - 0.1, y0 + 0.37, back + d / 2, 0.07);
  B.soft(mat.teal, d, 0.62, 0.2, S.x0 + d / 2, y0 + 0.37, S.returnTo - 0.1, 0.07);
  // tufting buttons
  const btn = new THREE.SphereGeometry(0.014, 6, 4);
  for (let x = S.x0 + 0.5; x < S.x1 - 0.3; x += 0.34) for (const yy of [seatY + 0.14, seatY + 0.3]) B.add(btn, mat.tealDeep, { x, y: yy, z: back + 0.245 });
  for (let z = back + 0.5; z < S.returnTo - 0.3; z += 0.34) for (const yy of [seatY + 0.14, seatY + 0.3]) B.add(btn, mat.tealDeep, { x: S.x0 + 0.245, y: yy, z });
  // pillows: one red, one striped
  B.soft(mat.red, 0.42, 0.36, 0.12, S.x1 - 0.55, seatY + 0.2, back + 0.36, 0.05, { rx: -0.25, ry: -0.15 });
  B.soft(mat.stripe, 0.44, 0.38, 0.13, S.x0 + 0.42, seatY + 0.2, back + 0.38, 0.05, { rx: -0.22, ry: 0.6 });
}

// a Danish teak lounge chair (local: front = +z): slim tapered legs, flat rounded arms, a raked back,
// cream cushions
function loungeChair(B, mat) {
  const t = mat.teakPlain;
  for (const sx of [-1, 1]) {
    const x = sx * 0.335;
    B.cyl(t, 0.022, 0.015, 0.57, x, 0.285, 0.26, 8, { rx: 0.05 });          // front leg
    B.cyl(t, 0.022, 0.015, 0.8, x, 0.37, -0.24, 8, { rx: -0.34 });          // back leg, raked to the back rail
    B.soft(t, 0.07, 0.03, 0.74, x, 0.585, 0.03, 0.012, { rx: 0.03 });       // flat armrest
    B.box(t, 0.03, 0.045, 0.56, x * 0.95, 0.27, 0.02);                        // seat rail
  }
  B.box(t, 0.66, 0.035, 0.035, 0, 0.27, 0.29);
  B.soft(t, 0.64, 0.05, 0.035, 0, 0.71, -0.36, 0.012, { rx: -0.34 });
  B.soft(mat.cream, 0.6, 0.12, 0.56, 0, 0.36, 0.04, 0.05, { rx: -0.06 });
  B.soft(mat.cream, 0.58, 0.56, 0.11, 0, 0.64, -0.26, 0.05, { rx: -0.33 });
}

function musicStand(B, M, mat, x, z, y0, ry) {
  for (let i = 0; i < 3; i++) {
    const a = ry + i * 2.094;
    B.box(M.black, 0.012, 0.012, 0.38, x + Math.sin(a) * 0.15, y0 + 0.07, z + Math.cos(a) * 0.15, { ry: a, rx: 0.36 });
  }
  B.cyl(M.black, 0.009, 0.009, 1.12, x, y0 + 0.62, z, 6);
  const dx = Math.sin(ry) * 0.06, dz = Math.cos(ry) * 0.06;
  B.box(M.black, 0.52, 0.36, 0.01, x + dx, y0 + 1.3, z + dz, { ry, rx: -0.42 });
  B.box(mat.sheet, 0.46, 0.32, 0.004, x + dx * 1.25, y0 + 1.31, z + dz * 1.25, { ry, rx: -0.42 });
  B.box(M.black, 0.52, 0.02, 0.05, x + dx * 1.5, y0 + 1.15, z + dz * 1.5, { ry });
}

function telescope(B, mat, M, x, z, y0) {
  for (let i = 0; i < 3; i++) {
    const a = i * 2.094 + 0.4;
    B.box(M.metal, 0.018, 1.0, 0.018, x + Math.sin(a) * 0.2, y0 + 0.48, z + Math.cos(a) * 0.2, { ry: a, rx: -0.38 });
  }
  B.cyl(M.black, 0.035, 0.035, 0.1, x, y0 + 0.98, z, 10);
  // the tube looks up at the sky through the glass
  const o = { rx: -1.0, ry: 0.35 };
  B.cyl(mat.cobalt, 0.06, 0.06, 0.82, x - 0.06, y0 + 1.16, z - 0.12, 20, o);
  B.cyl(M.black, 0.066, 0.066, 0.12, x - 0.18, y0 + 1.36, z - 0.42, 20, o);
  B.cyl(mat.white, 0.03, 0.03, 0.08, x + 0.06, y0 + 0.97, z + 0.18, 10, o);
  B.cyl(M.black, 0.018, 0.018, 0.22, x - 0.03, y0 + 1.25, z - 0.1, 8, { rx: -1.0, ry: 0.35, rz: 0.0 });
}

// gathered curtains: a pleated drape between xa and xb, hung at z
function curtain(B, m, xa, xb, z, ya, yb, rnd) {
  const w = xb - xa, n = Math.max(6, Math.round(w / 0.06));
  const geo = new THREE.PlaneGeometry(w, yb - ya, n * 4, 1);
  const p = geo.attributes.position;
  const ph = rnd() * 6;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / w) * n * Math.PI * 2 + ph) * 0.035);
  geo.computeVertexNormals();
  B.add(geo, m, { x: (xa + xb) / 2, y: (ya + yb) / 2, z });
}

/* =====================================================================================
   Canvas textures
   ===================================================================================== */
// what glossy things in the room reflect (the piano's black, the cover's varnish): the room itself,
// a pale ceiling with downlights, warm walls, the bright run of glass, honey boards; not the sky
let ENV = null;
function interiorEnv() {
  if (ENV) return ENV;
  ENV = canvasTexture(256, 128, (g, w, h) => {
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, '#efe6d6'); v.addColorStop(0.4, '#e2d5c0'); v.addColorStop(0.43, '#6f5d4e'); v.addColorStop(0.52, '#7a6858');
    v.addColorStop(0.53, '#d8ccb6'); v.addColorStop(0.74, '#cdbfa6'); v.addColorStop(0.76, '#a4683a'); v.addColorStop(1, '#7a4a2a');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    const glass = g.createLinearGradient(0, h * 0.44, 0, h * 0.76);
    glass.addColorStop(0, '#9fb9d6'); glass.addColorStop(0.6, '#f0e2c8'); glass.addColorStop(1, '#8aa0b4');
    g.fillStyle = glass; g.fillRect(w * 0.08, h * 0.44, w * 0.38, h * 0.32);
    g.fillStyle = '#2a2420'; for (let i = 0; i <= 6; i++) g.fillRect(w * 0.08 + i * w * 0.38 / 6 - 1, h * 0.44, 2, h * 0.32);
    g.fillStyle = '#fff6e4'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc((i + 0.5) * w / 9, h * (0.12 + (i % 2) * 0.12), 2.2, 0, 7); g.fill(); }
    const lamp = g.createRadialGradient(w * 0.7, h * 0.5, 0, w * 0.7, h * 0.5, 22);
    lamp.addColorStop(0, 'rgba(255,226,170,1)'); lamp.addColorStop(1, 'rgba(255,226,170,0)');
    g.fillStyle = lamp; g.fillRect(0, 0, w, h);
  });
  ENV.mapping = THREE.EquirectangularReflectionMapping;
  return ENV;
}
function oakTexture(rnd) {
  return canvasTexture(512, 512, (g, w, h) => {
    const rows = 16, ph = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rnd() * 300;
      while (x < w) {
        const L = 140 + rnd() * 260, l = 50 + (rnd() - 0.5) * 10, s = 54 + rnd() * 10, hue = 29 + (rnd() - 0.5) * 6;
        g.fillStyle = `hsl(${hue} ${s}% ${l}%)`;
        g.fillRect(x, r * ph, L - 1.5, ph - 1.2);
        g.globalAlpha = 0.16;
        for (let k = 0; k < 5; k++) { g.fillStyle = `hsl(${hue - 4} ${s}% ${l - 12}%)`; g.fillRect(x, r * ph + rnd() * ph, L - 2, 0.8 + rnd()); }
        g.globalAlpha = 0.1; g.fillStyle = '#fff3d8'; g.fillRect(x, r * ph + 1, L - 2, 2);
        g.globalAlpha = 1;
        x += L;
      }
      g.fillStyle = 'rgba(70,35,12,.45)'; g.fillRect(0, r * ph + ph - 1.2, w, 1.2);
    }
  }, { repeat: true });
}
function teakTexture(rnd) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#9a5a34'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(${70 + rnd() * 30},${30 + rnd() * 15},${12 + rnd() * 8},${0.12 + rnd() * 0.22})`;
      g.lineWidth = 0.5 + rnd() * 1.8;
      const y = rnd() * h;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x / 50 + i) * 2.5);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,210,160,.06)'; g.fillRect(0, 0, w, h / 2);
  }, { repeat: true });
}
// pale rug with blue-grey circles, as in the photo
function rugTexture() {
  return canvasTexture(1024, 688, (g, w, h) => {
    g.fillStyle = '#dcdcd4'; g.fillRect(0, 0, w, h);
    const sp = 128;
    for (let y = sp / 2 + 24; y < h - 20; y += sp) for (let x = sp / 2 + 24; x < w - 20; x += sp) {
      const odd = ((x / sp | 0) + (y / sp | 0)) % 2;
      g.strokeStyle = odd ? '#8ea4b4' : '#a9b9c3'; g.lineWidth = 11;
      g.beginPath(); g.arc(x, y, 38, 0, 7); g.stroke();
      g.fillStyle = odd ? '#b5c4cc' : '#8ea4b4';
      g.beginPath(); g.arc(x, y, odd ? 13 : 9, 0, 7); g.fill();
      if (!odd) { g.fillStyle = '#c6cfd2'; g.fillRect(x + sp / 2 - 14, y - 3, 28, 6); }
    }
    g.strokeStyle = '#b9c4c9'; g.lineWidth = 8; g.strokeRect(16, 16, w - 32, h - 32);
    // a little pile texture
    for (let i = 0; i < 9000; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.12)' : 'rgba(60,60,60,.05)'; g.fillRect((i * 7919) % w, (i * 104729) % h, 2, 2); }
  });
}
function stripeTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    const cols = ['#e7d2b4', '#b4472f', '#e7d2b4', '#c98a4b', '#7a2f4f'];
    for (let i = 0; i < 8; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(0, i * 8, w, 8); }
  });
}
// the bold abstract: flowing bands of red, orange, magenta-purple and deep blue
function paintingTexture(rnd) {
  return canvasTexture(320, 420, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#f05a2a'); bg.addColorStop(0.5, '#e2452c'); bg.addColorStop(1, '#c72e3a');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const bands = [['#7b2a7a', 26], ['#23307a', 18], ['#a83a8c', 12], ['#f39a3a', 8], ['#3a1f5c', 14], ['#2c4bb0', 7]];
    for (let i = 0; i < 16; i++) {
      const [c, lw] = bands[i % bands.length];
      g.strokeStyle = c; g.lineWidth = lw * (0.7 + rnd() * 0.7); g.lineCap = 'round';
      const x0 = rnd() * w;
      g.beginPath(); g.moveTo(x0, -20);
      g.bezierCurveTo(x0 + (rnd() - 0.5) * 260, h * 0.3, x0 + (rnd() - 0.5) * 260, h * 0.66, x0 + (rnd() - 0.5) * 160, h + 20);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, 0, w, h);
  });
}
function sheetTexture(rnd) {
  return canvasTexture(256, 180, (g, w, h) => {
    g.fillStyle = '#f7f2e6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6b655c'; g.lineWidth = 1;
    for (let s = 0; s < 4; s++) for (let l = 0; l < 5; l++) { const y = 22 + s * 40 + l * 5; g.beginPath(); g.moveTo(12, y); g.lineTo(244, y); g.stroke(); }
    g.fillStyle = '#2b2622';
    for (let s = 0; s < 4; s++) for (let i = 0; i < 15; i++) { g.beginPath(); g.ellipse(22 + i * 15, 24 + s * 40 + ((rnd() * 5) | 0) * 2.5, 3, 2.2, -0.4, 0, 7); g.fill(); }
  });
}
