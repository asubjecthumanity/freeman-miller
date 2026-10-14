// Music studio (stop 3, owner: studio), the front of the main floor behind the big lawn-facing glass.
// Seen from the stop (the long view from the partition's left end diagonally across the room to the
// booth corner, so the lawn-facing glass runs down the right of the picture): the vocal booth in the
// solid corner with its ON AIR sign, a fiddle-leaf fig and a felt panel on the end wall beside it,
// the eight-track in front of the booth, a small drum kit and three guitars (electric, acoustic,
// bass) in front of the glass, the walnut desk with the session-view screen, near-field monitors,
// VU and LED meters and a drum machine, then a polysynth with a metronome and an amp in the right
// foreground. Felt clouds overhead, a rug, cables, plants. The space between the desk and the info
// box is kept clear (window and trees only), because the two leader lines cross it.
// Everything moving rests when nothing plays, except two idle details: the eight-track's armed
// record lamp blinks and the headphone cable in the booth sways.
import * as THREE from 'three';
import { Builder, canvasTexture, makeRand } from './kit.js';
import { F1, C1, LV, PART_Z } from './layout.js';
import { speaker, emissive } from './parts.js';
import { DAWScreen } from './screens/daw.js';
import { FONT } from './screens/shared.js';
import { gearMaterials, guitar, amp, synth, drumKit, tapeMachine, vocalMic, musicStand, fiddleFig, snakePlant } from './studio-gear.js';
import { buildWallSection } from './studio-wall.js';
import { sectionProgress } from './shell.js';
import { flattenStatic } from './studio-merge.js';
import room from '../rooms/studio.js';

const PI = Math.PI;
const IX1 = LV.x1 - 0.2, IZ1 = LV.z1 - 0.2; // the room's inner right wall and front wall

// Where things stand (x, z on the floor; ry turns them). Camera at the stop: see rooms/studio.js.
// Each object has its own slot in the view from the stop, so nothing hides another.
export const LAYOUT = {
  desk: { x: -4.15, z: 3.0, ry: 0.1 },
  tape: { x: -2.3, z: 1.42 },
  drums: { x: -1.72, z: 2.88 },
  booth: { x0: -0.95, z0: 1.85 },          // to the room's right wall and front wall
  guitars: [{ kind: 'electric', x: -2.62, z: 3.08, ry: 0.3 }, { kind: 'acoustic', x: -2.86, z: 3.42, ry: 0.1 }, { kind: 'bass', x: -3.12, z: 3.18, ry: -0.15 }],
  amp: { x: -5.55, z: 2.75, ry: 0.35 },
  synth: { x: -5.38, z: 1.82, ry: 0.55 },
};

// data: the room context from world.js ({ film, person, pianoCollection, otherMusic, projects, mediaBase, mobile })
export function buildStudio(M, T, data) {
  const G = gearMaterials(M);
  const group = new THREE.Group(); group.name = 'studio';
  const B = new Builder();
  const y0 = F1;
  const tracks = data.otherMusic || [];

  /* ---------- rug, camera hook ---------- */
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }));
  rug.userData.dynamic = true; // keeps its camera hook (below) through flattenStatic
  rug.rotation.x = -PI / 2; rug.rotation.z = LAYOUT.desk.ry; rug.position.set(LAYOUT.desk.x + 0.25, y0 + 0.006, 2.2); rug.receiveShadow = true;
  group.add(rug);
  // the wall section needs the view camera; the rug is drawn whenever the studio is
  let cam = null;
  rug.frustumCulled = false;
  rug.onBeforeRender = (r, s, c) => { if (c.isPerspectiveCamera) cam = c; };

  /* ---------- the desk ---------- */
  const D = LAYOUT.desk;
  const desk = new THREE.Group(); desk.position.set(D.x, y0, D.z); desk.rotation.y = D.ry; group.add(desk);
  const DB = new Builder();
  const dw = 1.72, dd = 0.86, top = 0.74;
  // two rack pedestals and the tabletop (engineer at -z, window at +z)
  for (const s of [-1, 1]) {
    const px = s * (dw / 2 - 0.24);  // rack bays under the wings
    DB.box(M.walnut, 0.46, top - 0.02, dd - 0.06, px, (top - 0.02) / 2, 0.02);
    DB.box(M.black, 0.4, 0.5, 0.01, px, 0.36, -dd / 2 + 0.045);
    for (let u = 0; u < 3; u++) {
      const ry = 0.18 + u * 0.165;
      DB.box(u === 1 ? G.brushed : G.darkPanel, 0.38, 0.14, 0.01, px, ry, -dd / 2 + 0.038);
      for (let k = 0; k < 5; k++) DB.cyl(u === 1 ? M.black : G.pearl, 0.012, 0.012, 0.014, px - 0.14 + k * 0.06, ry + 0.02, -dd / 2 + 0.03, 10, { rx: PI / 2 });
    }
  }
  DB.box(M.walnut, dw, 0.045, dd, 0, top, 0);
  DB.box(M.walnut, dw - 0.95, 0.03, dd - 0.1, 0, 0.12, 0.02);   // footrest shelf
  // the mixer: a sloped console in the middle of the tabletop
  const mixW = 0.86, mixD = 0.5, mixTilt = 0.2;
  const mixer = new THREE.Group(); mixer.position.set(0, top + 0.04, -0.06); mixer.rotation.x = mixTilt; desk.add(mixer);
  const MB = new Builder();
  MB.box(M.black, mixW + 0.06, 0.06, mixD + 0.04, 0, -0.01, 0);
  MB.box(G.darkPanel, mixW, 0.012, mixD, 0, 0.025, 0);
  const nCh = 10, chW = (mixW - 0.16) / nCh;
  const chX = i => -mixW / 2 + 0.04 + (i + 0.5) * chW;
  const knobCol = [M.rust, M.teal, M.mustard, M.cream, M.cream];
  for (let i = 0; i < nCh; i++) {
    const x = chX(i);
    for (let k = 0; k < 5; k++) MB.cyl(knobCol[k], 0.0085, 0.01, 0.016, x, 0.036, -mixD / 2 + 0.05 + k * 0.05, 10);
    MB.box(i % 4 === 1 ? M.mustard : M.black, 0.03, 0.01, 0.018, x, 0.034, 0.03);
    MB.box(M.black, 0.006, 0.004, 0.16, x, 0.032, 0.15);
  }
  // master section on the right of the console
  MB.box(G.brushed, 0.11, 0.012, mixD - 0.04, mixW / 2 - 0.065, 0.032, 0);
  for (let k = 0; k < 4; k++) MB.cyl(M.black, 0.014, 0.016, 0.02, mixW / 2 - 0.065, 0.045, -mixD / 2 + 0.07 + k * 0.06, 12);
  MB.build(mixer);
  // faders: one instanced mesh
  const faders = new THREE.InstancedMesh(new THREE.BoxGeometry(0.026, 0.018, 0.024), M.cream, nCh);
  const fBase = [], m4 = new THREE.Matrix4();
  for (let i = 0; i < nCh; i++) { fBase.push(0.12 + ((i * 37) % 7) / 7 * 0.08); m4.makeTranslation(chX(i), 0.044, fBase[i]); faders.setMatrixAt(i, m4); }
  faders.castShadow = true; mixer.add(faders);
  // meter bridge: LED bar meters (instanced) and two big VU meters with needles
  const bridge = new THREE.Group(); bridge.position.set(0, top + 0.06, mixD / 2 - 0.02); desk.add(bridge);
  const BB = new Builder();
  BB.box(M.walnut, mixW + 0.1, 0.2, 0.08, 0, 0.1, 0);
  BB.box(M.black, mixW, 0.15, 0.004, 0, 0.1, -0.041);
  BB.build(bridge);
  const SEG = 10, segPts = [];
  for (let i = 0; i < nCh; i++) for (let k = 0; k < SEG; k++) segPts.push([chX(i), 0.035 + k * 0.011, -0.045]);
  const segs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.022, 0.008, 0.003), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), segPts.length);
  segPts.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); segs.setMatrixAt(i, m4); });
  bridge.add(segs);
  const segOff = [new THREE.Color('#123018'), new THREE.Color('#33300f'), new THREE.Color('#3a1510')];
  const segOn = [new THREE.Color('#62e06a'), new THREE.Color('#ffd23c'), new THREE.Color('#ff5a3c')];
  const segZone = k => (k >= SEG - 1 ? 2 : k >= SEG - 3 ? 1 : 0);
  // big VUs live on a raised plinth in the middle of the bridge
  const vuTex = vuFace();
  const vuMat = new THREE.MeshStandardMaterial({ map: vuTex, emissive: '#ffcf7a', emissiveIntensity: 0.35, roughness: 0.5 });
  const bigVU = [];
  for (const s of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.1), vuMat);
    face.position.set(s * 0.09, 0.27, -0.037); face.rotation.y = PI; bridge.add(face);
    const n = new THREE.Mesh(new THREE.BoxGeometry(0.0025, 0.075, 0.0015).translate(0, 0.0375, 0), M.black);
    n.position.set(s * 0.09, 0.225, -0.041); n.rotation.y = PI; n.userData.dynamic = true; bridge.add(n);
    bigVU.push({ n, v: 0 });
  }
  const VB = new Builder();
  VB.box(M.walnut, 0.36, 0.14, 0.07, 0, 0.27, 0.0);
  VB.build(bridge);
  // computer screen on an arm behind the bridge, the session view
  const daw = new DAWScreen(tracks);
  const scrW = 0.92, scrH = scrW * 500 / 800, scrY = top + 0.42 + scrH / 2, scrZ = mixD / 2 + 0.16;
  DB.box(M.black, scrW + 0.035, scrH + 0.035, 0.03, 0, scrY, scrZ + 0.02);
  DB.box(G.brushed, 0.05, 0.42, 0.03, 0, top + 0.26, scrZ + 0.06);
  DB.box(G.brushed, 0.28, 0.012, 0.2, 0, top + 0.03, scrZ + 0.06);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(scrW, scrH), new THREE.MeshBasicMaterial({ map: daw.texture, toneMapped: false }));
  screen.position.set(0, scrY, scrZ + 0.004); screen.rotation.y = PI; desk.add(screen);
  // keyboard, mouse, the drum machine with pads, a mug and a small plant
  DB.box(M.ivory, 0.36, 0.016, 0.12, -0.64, top + 0.03, -0.28, { ry: 0.1 });
  for (let r = 0; r < 4; r++) DB.box(M.cream, 0.33, 0.006, 0.02, -0.64, top + 0.041, -0.32 + r * 0.026, { ry: 0.1 });
  DB.soft(M.ivory, 0.055, 0.024, 0.09, -0.4, top + 0.035, -0.34, 0.01);
  const dmx = 0.64, dmz = -0.24;
  DB.soft(G.brushed, 0.32, 0.05, 0.3, dmx, top + 0.045, dmz, 0.012, { ry: -0.1 });
  DB.box(G.glow('#7fe0c4', 0.7), 0.1, 0.004, 0.035, dmx - 0.07, top + 0.072, dmz + 0.1, { ry: -0.1 });
  const padPts = [];
  for (let i = 0; i < 16; i++) {
    const lx = -0.09 + (i % 4) * 0.058 + 0.04, lz = -0.11 + Math.floor(i / 4) * 0.052;
    const c = Math.cos(-0.1), s = Math.sin(-0.1);
    padPts.push([dmx + lx * c + lz * s, top + 0.073, dmz - lx * s + lz * c]);
  }
  const pads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.046, 0.012, 0.042), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), 16);
  padPts.forEach((p, i) => { m4.makeRotationY(-0.1).setPosition(p[0], p[1], p[2]); pads.setMatrixAt(i, m4); pads.setColorAt(i, new THREE.Color('#3a2c26')); });
  desk.add(pads);
  const padOn = ['#f29b3c', '#f2d23c', '#8fd14f', '#4fd1c5'].map(c => new THREE.Color(c)), padOff = new THREE.Color('#3a2c26');
  DB.cyl(M.cream, 0.04, 0.036, 0.1, -0.76, top + 0.07, -0.04, 14);
  DB.cyl(M.rust, 0.032, 0.032, 0.003, -0.76, top + 0.12, -0.04, 14);
  DB.build(desk);

  /* ---------- near-field monitors on the desk wings, white woofers, toed in toward the chair ---------- */
  const mons = [];
  const whiteCone = new THREE.MeshStandardMaterial({ color: '#efeae0', roughness: 0.85, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const mg = new THREE.Group(); mg.position.set(s * 0.66, top + 0.022, 0.2); mg.rotation.y = PI + s * 0.38; desk.add(mg);
    const SB = new Builder();
    SB.box(G.foamRust, 0.22, 0.05, 0.22, 0, 0.025, 0);
    SB.box(G.steel, 0.16, 0.012, 0.16, 0, 0.056, 0);
    for (const q of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) SB.cyl(G.steel, 0.008, 0.008, 0.07, q[0] * 0.06, 0.097, q[1] * 0.06, 6);
    SB.box(G.steel, 0.16, 0.012, 0.16, 0, 0.138, 0);
    SB.build(mg);
    const sp = speaker(M, { w: 0.22, h: 0.36, d: 0.2, cabinet: M.black, drivers: [{ x: 0, y: 0.125, r: 0.076 }, { x: 0, y: 0.28, r: 0.025 }], ledColor: '#ff7a3c' });
    sp.group.traverse(o => { if (o.isMesh && o.material === M.coneMat && o.geometry.parameters === undefined) o.material = whiteCone; });
    sp.group.position.y = 0.145; sp.group.userData.dynamic = true;
    mg.add(sp.group); mons.push(sp);
  }

  /* ---------- chair ---------- */
  const ch = new THREE.Group(); ch.position.set(D.x - 0.12, y0, D.z - 0.95); ch.rotation.y = D.ry - 0.35; group.add(ch);
  const CB = new Builder();
  const cognac = G.cognac || (G.cognac = new THREE.MeshStandardMaterial({ color: '#5e3424', roughness: 0.55 }));
  CB.soft(cognac, 0.52, 0.08, 0.5, 0, 0.5, 0, 0.035);
  CB.soft(cognac, 0.5, 0.4, 0.07, 0, 0.78, 0.25, 0.03, { rx: -0.12 });
  const alu = G.alu || (G.alu = new THREE.MeshStandardMaterial({ color: '#8d8a84', roughness: 0.38, metalness: 0.85 }));
  for (const s of [-1, 1]) { CB.box(alu, 0.03, 0.02, 0.38, s * 0.28, 0.66, 0.02); CB.box(alu, 0.02, 0.16, 0.02, s * 0.28, 0.58, -0.12); CB.box(alu, 0.02, 0.36, 0.02, s * 0.26, 0.72, 0.27, { rx: -0.12 }); }
  CB.cyl(alu, 0.025, 0.025, 0.36, 0, 0.29, 0, 10);
  for (let i = 0; i < 5; i++) { const a = i * 1.2566 + 0.3; CB.box(alu, 0.32, 0.025, 0.045, Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15, { ry: -a }); CB.cyl(G.rubber, 0.022, 0.022, 0.03, Math.cos(a) * 0.3, 0.022, Math.sin(a) * 0.3, 8, { rz: PI / 2, ry: -a }); }
  CB.build(ch);

  /* ---------- the eight-track ---------- */
  const tape = tapeMachine(M);
  const TP = LAYOUT.tape;
  tape.group.position.set(TP.x, y0, TP.z);
  // face the camera at the stop
  tape.group.rotation.y = Math.atan2(room.key.p[0] - TP.x, room.key.p[2] - TP.z) + 0.12;
  group.add(tape.group);

  /* ---------- drum kit in front of the glass ---------- */
  const kit = drumKit(M);
  kit.group.position.set(LAYOUT.drums.x, y0, LAYOUT.drums.z);
  kit.group.rotation.y = Math.atan2(room.key.p[0] - LAYOUT.drums.x, room.key.p[2] - LAYOUT.drums.z) - 0.25;
  group.add(kit.group);

  /* ---------- guitars, amp, synth ---------- */
  for (const g of LAYOUT.guitars) {
    const gt = guitar(M, g.kind);
    gt.position.set(g.x, y0, g.z);
    gt.rotation.y = Math.atan2(room.key.p[0] - g.x, room.key.p[2] - g.z) + g.ry;
    group.add(gt);
  }
  const am = amp(M);
  am.group.position.set(LAYOUT.amp.x, y0, LAYOUT.amp.z);
  am.group.rotation.y = Math.atan2(room.key.p[0] - LAYOUT.amp.x, room.key.p[2] - LAYOUT.amp.z) + LAYOUT.amp.ry;
  group.add(am.group);
  const sy = synth(M);
  sy.group.position.set(LAYOUT.synth.x, y0, LAYOUT.synth.z);
  sy.group.rotation.y = Math.atan2(room.key.p[0] - LAYOUT.synth.x, room.key.p[2] - LAYOUT.synth.z) + LAYOUT.synth.ry;
  group.add(sy.group);

  /* ---------- vocal booth in the solid corner ---------- */
  const bx0 = LAYOUT.booth.x0, bz0 = LAYOUT.booth.z0, bx1 = IX1, bz1 = IZ1, bh = 2.32, post = 0.06;
  // frame: posts on the open corner and along the two glass sides, header, sill
  for (const [x, z] of [[bx0, bz0], [bx0, bz1 - post], [bx1 - post, bz0], [bx0, (bz0 + bz1) / 2 - 0.36], [bx0, (bz0 + bz1) / 2 + 0.44]]) B.aabb(M.frame, x, y0, z, x + post, y0 + bh, z + post);
  B.aabb(M.frame, bx0, y0 + bh - 0.07, bz0, bx0 + post, y0 + bh, bz1);
  B.aabb(M.frame, bx0, y0 + bh - 0.07, bz0, bx1, y0 + bh, bz0 + post);
  B.aabb(M.walnut, bx0, y0, bz0, bx0 + post, y0 + 0.16, bz1);
  B.aabb(M.walnut, bx0, y0, bz0, bx1, y0 + 0.16, bz0 + post);
  B.aabb(M.fabric, bx0, y0 + bh, bz0, bx1, y0 + bh + 0.06, bz1);
  // door handle on the side glass, facing the desk
  B.box(M.brass, 0.02, 0.4, 0.02, bx0 - 0.03, y0 + 1.05, (bz0 + bz1) / 2 + 0.36);
  for (const dy of [-0.17, 0.17]) B.box(M.brass, 0.04, 0.015, 0.015, bx0 - 0.012, y0 + 1.05 + dy, (bz0 + bz1) / 2 + 0.36);
  const boothGlass = new THREE.MeshStandardMaterial({ color: '#d6e6ea', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4 });
  boothGlass.userData.noShadow = true;
  B.rect(boothGlass, 'nx', bz0 + post, bz1 - post, y0 + 0.16, y0 + bh - 0.07, bx0 + post / 2);
  B.rect(boothGlass, 'nz', bx0 + post, bx1 - post, y0 + 0.16, y0 + bh - 0.07, bz0 + post / 2);
  // inside: wedge foam on the two house walls and the ceiling, a rust accent panel, a little rug
  B.rect(G.foam, 'nx', bz0 + post, bz1, y0 + 0.16, y0 + bh, bx1 - 0.025);
  B.rect(G.foam, 'nz', bx0 + post, bx1 - 0.025, y0 + 0.16, y0 + bh, bz1 - 0.025);
  B.rect(G.foamRust, 'nz', bx0 + 0.6, bx0 + 1.5, y0 + 0.9, y0 + 1.9, bz1 - 0.03);
  B.rect(G.foam, 'ny', bx0 + post, bx1, bz0 + post, bz1, y0 + bh - 0.001);
  B.box(M.navy, 1.1, 0.012, 0.9, (bx0 + bx1) / 2 + 0.1, y0 + 0.006, (bz0 + bz1) / 2 + 0.05);
  // stool
  const stx = bx1 - 0.45, stz = bz1 - 0.55;
  B.cyl(M.walnut, 0.17, 0.17, 0.04, stx, y0 + 0.66, stz, 18);
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + 0.4; B.box(M.black, 0.022, 0.68, 0.022, stx + Math.cos(a) * 0.12, y0 + 0.33, stz + Math.sin(a) * 0.12, { rz: Math.cos(a) * 0.12, rx: -Math.sin(a) * 0.12 }); }
  const mic = vocalMic(M);
  const mcx = bx0 + 0.42, mcz = (bz0 + bz1) / 2 - 0.05;
  mic.group.position.set(mcx, y0, mcz); mic.group.rotation.y = PI / 2 - 0.25; group.add(mic.group);
  const ms = musicStand(M);
  ms.position.set(bx1 - 0.25, y0, mcz + 0.15); ms.rotation.y = -PI / 2; group.add(ms);
  // the ON AIR sign over the booth's corner, turned toward the room
  const onAirMat = new THREE.MeshStandardMaterial({ map: onAirTexture(), emissive: '#ff4a2a', emissiveMap: onAirTexture(true), emissiveIntensity: 0.08, roughness: 0.4 });
  const onAir = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.17, 0.07), [M.black, M.black, M.black, M.black, onAirMat, M.black]);
  onAir.position.set(bx0 + 0.04, y0 + bh + 0.2, bz0 + 1.3);
  onAir.rotation.y = Math.atan2(room.key.p[0] - onAir.position.x, room.key.p[2] - onAir.position.z);
  group.add(onAir);
  B.box(M.black, 0.02, 0.12, 0.02, bx0 + 0.04, y0 + bh + 0.08, bz0 + 1.3);

  /* ---------- acoustic clouds over the desk, pendants ---------- */
  const felt = c => new THREE.MeshStandardMaterial({ color: c, roughness: 1 });
  const cloudCols = [felt('#a98642'), felt('#3f6a64'), felt('#33405a')];
  for (let i = 0; i < 2; i++) {
    const cx = D.x + 0.75 - i * 0.95, cz = D.z - 0.15 + i * 0.2, cy = C1 - 0.12;
    B.soft(cloudCols[i], 0.56, 0.04, 0.82, cx, cy, cz, 0.02, { ry: D.ry + (i - 1) * 0.12 });
    for (const q of [[-0.24, -0.36], [0.24, -0.36], [-0.24, 0.36], [0.24, 0.36]]) B.box(G.steel, 0.003, C1 - cy - 0.02, 0.003, cx + q[0], (C1 + cy) / 2 + 0.01, cz + q[1]);
  }
  const bulbMat = emissive('#ffd59a', 1.8);
  for (const s of [-1, 1]) {
    const px = D.x + s * 0.62, pz = D.z - 0.45;
    B.box(M.black, 0.005, 0.62, 0.005, px, C1 - 0.31, pz);
    B.add(new THREE.SphereGeometry(0.11, 18, 10, 0, PI * 2, 0, PI / 2), M.brass, { x: px, y: C1 - 0.72, z: pz });
    const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.088, 18), bulbMat);
    bulb.rotation.x = PI / 2; bulb.position.set(px, C1 - 0.721, pz); group.add(bulb);
  }

  /* ---------- wall panels (partition, kept clear of the passage), plants, cables ---------- */
  // the panels hang on the partition, which sinks to a low wall while the house stands open in section
  // (the way in, the office move's look back): they step out of the picture then (update below)
  const hole = room.moveIn.portals[0].a[0];
  const panels = new THREE.Group(); panels.name = 'partition-panels'; panels.userData.dynamic = true; group.add(panels);
  const PB = new Builder();
  for (const [x, c] of [[-9.0, M.teal], [-7.7, M.mustard], [-6.4, M.rust]]) if (Math.abs(x - hole) > 1.4) PB.soft(c, 1.0, 1.3, 0.07, x, y0 + 1.55, PART_Z + 0.1, 0.03);
  PB.build(panels);
  // a felt panel on the end wall beside the booth (seen face on from the stop, in the clouds' mustard),
  // and a fig in the corner in front of it; the other fig stands by the corner glass at the far end
  B.soft(cloudCols[0], 0.07, 1.2, 0.9, IX1 - 0.04, y0 + 1.6, 0.3, 0.03);
  for (const [x, z, h, seed] of [[0.8, 1.15, 1.95, 11], [-8.2, 3.4, 1.95, 13]]) {
    const f = fiddleFig(M, h, seed); f.position.set(x, y0, z); group.add(f);
  }
  const sn = snakePlant(M); sn.position.set(-3.0, y0, 3.55); group.add(sn);
  const cables = [
    [[D.x + 0.5, 0.012, D.z + 0.25], [D.x + 1.1, 0.012, D.z - 0.4], [TP.x - 0.6, 0.012, TP.z + 0.2], [TP.x - 0.1, 0.012, TP.z + 0.1]],
    [[D.x + 0.7, 0.012, D.z + 0.3], [D.x + 1.6, 0.012, D.z + 0.1], [bx0 - 0.4, 0.012, bz0 + 0.5], [bx0 + 0.1, 0.012, bz0 + 0.62], [mcx, 0.012, mcz]],
    [[D.x - 0.9, 0.012, D.z + 0.2], [D.x - 1.25, 0.012, D.z + 0.3], [D.x - 1.3, 0.012, D.z + 0.05]],
    [[D.x + 0.9, 0.012, D.z + 0.2], [D.x + 1.25, 0.012, D.z + 0.3], [D.x + 1.3, 0.012, D.z + 0.1]],
    [[LAYOUT.amp.x + 0.1, 0.012, LAYOUT.amp.z + 0.1], [LAYOUT.amp.x + 0.4, 0.012, LAYOUT.amp.z + 0.5], [LAYOUT.guitars[0].x - 0.1, 0.012, LAYOUT.guitars[0].z - 0.2], [LAYOUT.guitars[0].x + 0.02, 0.2, LAYOUT.guitars[0].z]],
  ];
  cables.forEach((pts, i) => {
    const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], y0 + p[1], p[2])));
    B.add(new THREE.TubeGeometry(c, 40, 0.009, 5), i === 4 ? G.redCable : G.cable);
  });

  B.build(group);

  /* ---------- the wall section for the turn ---------- */
  const wall = buildWallSection(M, room);
  wall.group.userData.dynamic = true;
  group.add(wall.group);

  /* ---------- lights ---------- */
  const warm = new THREE.PointLight('#ffbf7a', 2.4, 8, 1.6);
  warm.position.set(D.x, C1 - 0.9, D.z - 1.0);
  const booth = new THREE.PointLight('#ffd8a8', 1.7, 4.2, 1.6);
  booth.position.set((bx0 + bx1) / 2, y0 + 2.0, (bz0 + bz1) / 2);
  group.add(warm, booth);
  const boothIdle = new THREE.Color('#ffd8a8'), boothLive = new THREE.Color('#ff8a5c');

  /* ---------- anchors for the leader lines (world space) ---------- */
  group.updateMatrixWorld(true);
  const W = (obj, v) => obj.localToWorld(v.clone());
  const anchors = {
    tape: W(tape.group, tape.anchor),
    monitors: W(mons[0].group, new THREE.Vector3(0, 0.42, 0)),
    // a hand's width above the screen, so its wire leaves over the window without grazing the bezel
    screen: W(desk, new THREE.Vector3(0, scrY + scrH / 2 + 0.12, scrZ)),
    booth: W(mic.group, mic.anchor),
    synth: W(sy.group, new THREE.Vector3(0, 1.02, 0)),
    guitars: new THREE.Vector3(LAYOUT.guitars[1].x, y0 + 1.25, LAYOUT.guitars[1].z),
    drums: W(kit.group, new THREE.Vector3(0.42, 1.3, 0.18)),
  };

  // one mesh per material for everything that does not move
  flattenStatic(group);

  /* ---------- per-frame ---------- */
  let current = null, dawAcc = 1, lastBeat = -1, metA = 0, metersLit = true, padsLit = true, airT = 0;
  // the ON AIR sign strikes like a neon tube: on, off, on, off, on over its first half second
  const strike = t => (t > 0.5 || (t > 0.05 && t < 0.12) || (t > 0.2 && t < 0.3) || t > 0.36 ? 1 : 0.1);
  const col = new THREE.Color();
  return {
    group, daw, anchors, lights: [{ l: warm, i: 2.4 }, { l: booth, i: 1.7 }],
    // the playing (or last played) track from any room; set by the studio box (ui/studio-box.js)
    setTrack(track) { current = track || null; daw.setTrack(current); },
    // s: the frame state from app.js plus dt and time (see world.js frame)
    update({ dt, t = 0, playing, level = 0, onset = 0, kick, reduced, time }) {
      wall.update(cam);
      panels.visible = sectionProgress() < 0.3;
      const lv = playing ? level : 0;
      const dur = current?.duration || 30;
      const beatF = playing ? t * 2 : 0, beat = Math.floor(beatF);
      const newBeat = playing && beat !== lastBeat;
      lastBeat = playing ? beat : -1;
      for (const sp of mons) sp.pump(lv, onset, kick, dt, reduced);
      tape.update(dt, { playing, progress: current ? t / dur : (t % 30) / 30, level: lv, time, reduced });
      kit.update(dt, newBeat, beat, lv, playing, reduced);
      // LED bar meters on the bridge (only touched while something plays, and once when it stops)
      if (playing || metersLit) {
        let i = 0;
        for (let c = 0; c < nCh; c++) {
          const v = playing ? Math.min(1, lv * (0.55 + 0.5 * Math.abs(Math.sin(time * (2.7 + c * 0.61) + c * 1.9)))) : 0;
          const n = Math.round((reduced ? lv * 0.7 : v) * SEG);
          for (let k = 0; k < SEG; k++, i++) segs.setColorAt(i, k < n ? segOn[segZone(k)] : segOff[segZone(k)]);
        }
        segs.instanceColor.needsUpdate = true;
        metersLit = playing;
      }
      for (const o of bigVU) {
        const target = playing ? Math.min(1.1, lv * (0.85 + 0.25 * Math.sin(time * 5.3 + o.n.position.x * 40))) : 0;
        o.v += (target - o.v) * (1 - Math.exp(-dt / 0.1));
        o.n.rotation.z = -(0.72 - (reduced ? lv * 0.9 : o.v) * 1.3);
      }
      vuMat.emissiveIntensity = playing ? 0.75 : 0.35;
      // faders ride a little while playing
      if (playing && !reduced) {
        for (let i = 0; i < nCh; i++) { m4.makeTranslation(chX(i), 0.044, fBase[i] + 0.012 * Math.sin(time * 0.7 + i * 1.3)); faders.setMatrixAt(i, m4); }
        faders.instanceMatrix.needsUpdate = true;
      }
      // drum machine pads step with the beat
      if (newBeat || (padsLit && !playing)) {
        for (let i = 0; i < 16; i++) {
          const on = playing && (i === beat % 16 || (i % 4 === 0 && beat % 4 === 0) || (i === 13 && beat % 4 === 2));
          pads.setColorAt(i, on ? padOn[i % 4] : padOff);
        }
        pads.instanceColor.needsUpdate = true;
        padsLit = playing;
      }
      // synth: arpeggiator step lights and the metronome
      if (newBeat || (!playing && sy.leds.userData.lit)) {
        for (let i = 0; i < 8; i++) sy.leds.setColorAt(i, col.set(playing && i === beat % 8 ? '#ffb347' : '#2a1d17'));
        sy.leds.instanceColor.needsUpdate = true;
        sy.leds.userData.lit = playing;
      }
      metA += ((playing && !reduced ? 1 : 0) - metA) * Math.min(1, dt * 3);
      sy.arm.rotation.z = metA * 0.42 * Math.sin(PI * beatF);
      am.pilot.emissiveIntensity = playing ? 2.4 : 1.2;
      // on air: the sign and the booth light
      airT = playing ? airT + dt : 0;
      const air = playing ? (reduced ? 1 : strike(airT) * (0.88 + 0.12 * Math.sin(time * 3))) : 0;
      onAirMat.emissiveIntensity = 0.08 + air * 2.2;
      booth.color.copy(boothIdle).lerp(boothLive, air * 0.7);
      booth.intensity *= 0.75 + air * 0.9;
      // idle detail: the headphone cable sways
      mic.cable.rotation.z = reduced ? 0 : 0.05 * Math.sin(time * 1.1) + 0.02 * Math.sin(time * 2.3 + 1);
      mic.cable.rotation.x = reduced ? 0 : 0.03 * Math.sin(time * 0.8 + 2);
      // the session view: 20 fps while playing (2 with reduced motion), only on changes otherwise
      dawAcc += dt;
      if (!playing || dawAcc > (reduced ? 0.5 : 1 / 20)) { if (playing) dawAcc = 0; daw.draw({ t, playing, level: lv, time: reduced ? 0 : time, duration: dur }); }
    },
  };
}

/* ---------- textures ---------- */
function rugTexture() {
  // a flat-woven mid-century rug: a deep teal field, a rust border, rows of soft cream and mustard diamonds
  const rnd = makeRand(404);
  return canvasTexture(512, 384, (g, w, h) => {
    g.fillStyle = '#28433f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8c4a2c'; g.fillRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#28433f'; g.fillRect(30, 30, w - 60, h - 60);
    g.strokeStyle = 'rgba(237,227,207,.55)'; g.lineWidth = 2; g.strokeRect(40, 40, w - 80, h - 80);
    const cols = ['rgba(237,227,207,.32)', 'rgba(211,155,42,.42)', 'rgba(160,84,50,.55)'];
    for (let i = 0; i < 9; i++) for (let j = 0; j < 6; j++) {
      const x = 74 + i * 46, y = 72 + j * 48 + (i % 2) * 24;
      if (y > h - 60) continue;
      g.save(); g.translate(x, y); g.rotate(PI / 4);
      g.fillStyle = cols[(i + j) % 3]; g.fillRect(-5, -5, 10, 10);
      g.strokeStyle = 'rgba(237,227,207,.12)'; g.lineWidth = 1; g.strokeRect(-12, -12, 24, 24);
      g.restore();
    }
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '0,0,0'},${rnd() * 0.06})`; g.fillRect(rnd() * w, rnd() * h, 2, 1); }
    g.fillStyle = '#e4d8bf'; for (let y = 6; y < h; y += 5) { g.fillRect(0, y, 9, 2); g.fillRect(w - 9, y, 9, 2); }
  });
}
function onAirTexture(glow) {
  return canvasTexture(256, 88, (g, w, h) => {
    g.fillStyle = glow ? '#000000' : '#3a0c08'; g.fillRect(0, 0, w, h);
    g.fillStyle = glow ? '#ffffff' : '#7a2a20';
    g.font = `600 50px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('ON AIR', w / 2, h / 2 + 3);
    if (!glow) { g.strokeStyle = '#1a0604'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); }
  });
}
function vuFace() {
  return canvasTexture(192, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#ffe7b0'); grd.addColorStop(1, '#f0bb66');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h + 20, R = 112;
    g.strokeStyle = '#2a1d17'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(cx, cy, R, PI * 1.25, PI * 1.62); g.stroke();
    g.strokeStyle = '#b8321e'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, R, PI * 1.62, PI * 1.75); g.stroke();
    g.strokeStyle = '#2a1d17'; g.lineWidth = 2;
    for (let i = 0; i <= 10; i++) { const a = PI * (1.25 + i * 0.05); g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8)); g.lineTo(cx + Math.cos(a) * (i % 5 ? R : R + 8), cy + Math.sin(a) * (i % 5 ? R : R + 8)); g.stroke(); }
    g.fillStyle = '#2a1d17'; g.font = `600 22px ${FONT}`; g.textAlign = 'center'; g.fillText('VU', cx, h - 22);
  });
}
