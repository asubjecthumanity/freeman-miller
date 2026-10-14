// The office (provisional), in the cantilevered right volume, after dark. Freeman sits with his back
// to the room at a walnut desk under the side window: a big display with the "Claude" sessions and a
// column of agents at work, a laptop running Xcode with Semitone in the simulator, a lamp. Around
// him: a takeout bowl, a robot mouse chasing a wedge of cheese, a pickleball paddle, a fig, the
// Liebesebbe cover on the wall, a teak credenza with records. Outside: dusk.
// Owner: office. Room shape and contract: OWNERSHIP.md.
import * as THREE from 'three';
import { Builder, makeRand, canvasTexture } from './kit.js';
import { F1 } from './layout.js';
import { leg, plant, emissive } from './parts.js';
import { DisplayScreen, AgentsScreen, XcodeScreen, paintDusk, paintBlankWindow, DESKTOP } from './screens/office-monitor.js';
import { loadImage, makeCanvas, tex } from './screens/shared.js';
import { ROOM, WINDOW, DESK, DISPLAY, SEAT, sessionOrder } from './office-layout.js';
import { office as state } from '../ui/office-state.js';
import officeRoom, { SCREEN } from '../rooms/office.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// data: the room context from world.js ({ film, person, pianoCollection, otherMusic, projects, mediaBase, mobile })
export function buildOffice(M, T, data) {
  const { mediaBase, mobile } = data;
  const rnd = makeRand(4404);
  const group = new THREE.Group(); group.name = 'office';
  const B = new Builder();
  const y0 = F1, top = DESK.top;
  const projects = sessionOrder(data.projects);

  /* ---------- room-only materials ---------- */
  const mat = {
    silhouette: silhouetteMaterial(),
    rug: new THREE.MeshStandardMaterial({ map: canvasTexture(512, 384, paintRug), roughness: 1 }),
    shade: new THREE.MeshStandardMaterial({ color: '#f3e3c3', emissive: '#ffc47a', emissiveIntensity: 0.9, roughness: 0.9, side: THREE.DoubleSide }),
    bulb: emissive('#fff0c8', 2.2),
    white: new THREE.MeshStandardMaterial({ color: '#f1ede4', roughness: 0.35 }),
    paddle: new THREE.MeshStandardMaterial({ color: '#2f8f86', roughness: 0.5 }),
    ball: new THREE.MeshStandardMaterial({ color: '#d9e34b', roughness: 0.6 }),
    cheese: new THREE.MeshStandardMaterial({ color: '#f2c14e', roughness: 0.6 }),
    eye: emissive('#ff4d3a', 2.4),
    keys: new THREE.MeshStandardMaterial({ color: '#e9e4d8', roughness: 0.6 }),
    vinyl: new THREE.MeshStandardMaterial({ color: '#141212', roughness: 0.3 }),
    sleeve: [new THREE.MeshStandardMaterial({ color: '#c75b39' }), new THREE.MeshStandardMaterial({ color: '#2f5f7a' }), new THREE.MeshStandardMaterial({ color: '#d8b04a' }), new THREE.MeshStandardMaterial({ color: '#e7dccb' })],
  };

  /* ---------- the desk: walnut top, a hanging drawer, tapered legs ---------- */
  const dx = (DESK.x0 + DESK.x1) / 2, dz = (DESK.z0 + DESK.z1) / 2, dw = DESK.x1 - DESK.x0, dl = DESK.z1 - DESK.z0;
  B.box(M.walnut, dw, 0.035, dl, dx, top - 0.0175, dz);
  B.box(M.walnut, dw - 0.06, 0.16, 0.42, dx, top - 0.115, DESK.z0 + 0.26);
  B.box(M.walnut, 0.012, 0.13, 0.4, DESK.x0 + 0.025, top - 0.115, DESK.z0 + 0.26);
  B.box(M.brass, 0.02, 0.012, 0.12, DESK.x0 + 0.02, top - 0.115, DESK.z0 + 0.26);
  B.box(M.walnut, 0.02, 0.12, dl - 0.1, DESK.x1 - 0.03, top - 0.095, dz); // modesty rail
  for (const [sx, sz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) leg(B, M.walnut, sx ? DESK.x1 - 0.06 : DESK.x0 + 0.07, y0, sz ? DESK.z1 - 0.07 : DESK.z0 + 0.07, top - y0 - 0.035, 0.024);

  /* ---------- the display, on a slim arm ---------- */
  const D = DISPLAY;
  B.box(M.black, 0.026, D.h + 0.03, D.w + 0.03, D.x + 0.017, D.y, D.z);
  B.box(M.metal, 0.03, D.y - top - 0.05, 0.05, D.x + 0.1, (top + D.y) / 2 - 0.02, D.z);
  B.box(M.metal, 0.09, 0.03, 0.05, D.x + 0.06, D.y - 0.04, D.z);
  B.box(M.metal, 0.22, 0.012, 0.26, D.x + 0.1, top + 0.006, D.z);
  const scale = mobile ? 0.75 : 1;
  const display = new DisplayScreen(projects, mediaBase, { scale });
  const agents = new AgentsScreen({ scale });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(D.w, D.h), new THREE.MeshBasicMaterial({ map: display.texture, toneMapped: false }));
  screen.position.set(D.x, D.y, D.z); screen.rotation.y = -Math.PI / 2;
  // the world's camera, caught on the first frame the screen is drawn (the box may also hand it over)
  screen.onBeforeRender = (r, sc, cam) => { if (!state.camera && cam.isPerspectiveCamera) state.camera = cam; };
  screen.frustumCulled = false;
  group.add(screen);
  // the agents column sits a few millimetres in front of its corner of the screen
  const A = DESKTOP.agents;
  const agentsMesh = new THREE.Mesh(new THREE.PlaneGeometry(A.w * D.w, A.h * D.h), new THREE.MeshBasicMaterial({ map: agents.texture, toneMapped: false, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  agentsMesh.rotation.y = -Math.PI / 2;
  group.add(agentsMesh);
  // where the column is depends on the window's size (the display paints the HTML desk's layout, and
  // every layout has the column): its rectangle as fractions of the glass. Its leader line starts at the
  // top of its first pane.
  const agentsAt = new THREE.Vector3();
  // the window with its content cleared, over the display's window: for an app with a layout of its own
  // (phones, short landscape), the display's window empties before that app fades in over it, so the
  // two layouts are never seen one through the other (opacity: update, below)
  const blankTex = tex(makeCanvas(512, 512));
  const blank = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blankTex, toneMapped: false, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  blank.rotation.y = -Math.PI / 2; blank.visible = false;
  group.add(blank);
  const placeAgents = () => {
    const r = display.agentsRect();
    agentsAt.set(D.x - 0.01, D.y + D.h / 2 - r.y * D.h - 0.03, D.z - D.w / 2 + (r.x + r.w / 2) * D.w);
    agentsMesh.scale.set(r.w / A.w, r.h / A.h, 1);
    agentsMesh.position.set(D.x - 0.003, D.y + D.h / 2 - (r.y + r.h / 2) * D.h, D.z - D.w / 2 + (r.x + r.w / 2) * D.w);
    agents.setAspect((r.h * D.h) / (r.w * D.w));
    // the cleared window: painted at its proportions into the fixed square canvas (the plane stretches it back)
    const w = display.winRect(), aspect = (w.w * D.w) / (w.h * D.h), c = blankTex.image, g = c.getContext('2d');
    blank.scale.set(w.w * D.w, w.h * D.h, 1);
    blank.position.set(D.x - 0.002, D.y + D.h / 2 - (w.y + w.h / 2) * D.h, D.z - D.w / 2 + (w.x + w.w / 2) * D.w);
    g.setTransform(1, 0, 0, aspect, 0, 0);
    paintBlankWindow(g, c.width, c.width / aspect, c.width / display.L.win.w);
    g.setTransform(1, 0, 0, 1, 0, 0);
    blankTex.needsUpdate = true;
  };
  display.setView(innerWidth, innerHeight);
  placeAgents();

  /* ---------- the laptop, turned toward him: Xcode ---------- */
  const lap = new THREE.Group();
  lap.position.set(10.02, top, -0.14);
  lap.rotation.y = Math.atan2(SEAT.x + 0.1 - 10.02, SEAT.z + 0.1 + 0.14); // turned toward him
  const LB = new Builder();
  LB.box(M.metal, 0.32, 0.012, 0.22, 0, 0.006, 0);
  LB.box(M.black, 0.27, 0.002, 0.1, 0, 0.0125, -0.03);
  const hinge = new THREE.Group(); hinge.position.set(0, 0.012, -0.108); hinge.rotation.x = -0.24;
  const lidB = new Builder();
  lidB.box(M.metal, 0.32, 0.215, 0.006, 0, 0.1075, -0.003);
  lidB.build(hinge);
  const xcode = new XcodeScreen(projects.find(p => p.id === 'semitone') || projects[0], mediaBase, { scale });
  const lapScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.296, 0.185), new THREE.MeshBasicMaterial({ map: xcode.texture, toneMapped: false }));
  lapScreen.position.set(0, 0.108, 0.0012);
  hinge.add(lapScreen);
  lap.add(hinge);
  LB.build(lap);
  group.add(lap);

  /* ---------- keyboard, trackpad ---------- */
  B.box(M.metal, 0.13, 0.012, 0.42, 9.93, top + 0.006, SEAT.z + 0.02);
  B.box(mat.keys, 0.11, 0.004, 0.39, 9.93, top + 0.014, SEAT.z + 0.02);
  B.box(M.metal, 0.12, 0.006, 0.14, 9.92, top + 0.003, SEAT.z + 0.36);

  /* ---------- the lamp: weighted base, two brass arms, a cone over the desk ---------- */
  const lb = [10.34, top, 1.3], el = [10.4, top + 0.44, 1.26], hd = [10.08, top + 0.5, 1.1];
  B.cyl(M.black, 0.075, 0.08, 0.025, lb[0], lb[1] + 0.012, lb[2], 20);
  rod(B, M.brass, [lb[0], lb[1] + 0.02, lb[2]], el, 0.008);
  rod(B, M.brass, el, hd, 0.008);
  B.add(new THREE.SphereGeometry(0.016, 10, 8), M.brass, { x: el[0], y: el[1], z: el[2] });
  // the shade hangs from the head and opens toward a spot on the desk in front of the keyboard
  const spot = new THREE.Vector3(9.94, top, 0.98), head = new THREE.Vector3(...hd);
  const axis = spot.clone().sub(head).normalize();
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.14, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#1d1a18', roughness: 0.45, metalness: 0.4, side: THREE.DoubleSide }));
  shade.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().negate());
  shade.position.copy(head).addScaledVector(axis, 0.07);
  group.add(shade);
  const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), mat.bulb);
  glowDisc.position.copy(head).addScaledVector(axis, 0.11);
  glowDisc.lookAt(spot);
  group.add(glowDisc);
  const lampAt = head.clone().addScaledVector(axis, 0.2);

  /* ---------- on the desk ---------- */
  // mustard mug
  B.cyl(M.mustard, 0.04, 0.036, 0.095, 9.98, top + 0.0475, 1.42, 16);
  B.add(new THREE.TorusGeometry(0.026, 0.008, 6, 12, Math.PI), M.mustard, { x: 9.98, y: top + 0.05, z: 1.465, ry: Math.PI / 2, rz: -Math.PI / 2 });
  // a takeout bowl with chopsticks across it (Fusabowl, late again)
  const bowl = new THREE.LatheGeometry([[0.001, 0], [0.05, 0.004], [0.072, 0.03], [0.08, 0.062], [0.077, 0.062], [0.069, 0.032], [0.048, 0.008], [0.001, 0.008]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
  B.add(bowl, mat.white, { x: 9.9, y: top, z: -0.4 });
  B.cyl(M.teak, 0.004, 0.003, 0.23, 9.88, top + 0.066, -0.4, 5, { rx: Math.PI / 2, ry: 0.35 });
  B.cyl(M.teak, 0.004, 0.003, 0.23, 9.91, top + 0.068, -0.39, 5, { rx: Math.PI / 2, ry: 0.22 });
  // a robot mouse racing a wedge of cheese (Mouse Circuit)
  const mx = 9.95, mz = 1.06;
  B.add(new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat.white, { x: mx, y: top + 0.006, z: mz, sx: 0.06, sy: 0.04, sz: 0.042 });
  for (const s of [-1, 1]) {
    B.cyl(M.black, 0.017, 0.017, 0.012, mx + 0.01, top + 0.017, mz + s * 0.044, 14, { rx: Math.PI / 2 });
    B.cyl(mat.white, 0.016, 0.016, 0.006, mx + 0.028, top + 0.05, mz + s * 0.022, 14, { rz: Math.PI / 2, ry: 0.3 * s });
  }
  B.add(new THREE.SphereGeometry(0.006, 8, 6), mat.eye, { x: mx - 0.055, y: top + 0.024, z: mz });
  rod(B, M.black, [mx + 0.058, top + 0.012, mz], [mx + 0.12, top + 0.006, mz + 0.05], 0.0025);
  B.add(new THREE.CylinderGeometry(0.05, 0.05, 0.035, 3), mat.cheese, { x: mx - 0.15, y: top + 0.0175, z: mz - 0.02, ry: 0.4 });

  /* ---------- Freeman, a silhouette with the screens' light along his edges ---------- */
  const S = mat.silhouette, sx = SEAT.x, sz = SEAT.z, sy = SEAT.y;
  const fig = new Builder();
  // chair: five-star base, column, seat, a thin aluminium-framed back
  for (let i = 0; i < 5; i++) { const a = i * 1.2566 + 0.2; fig.box(M.metal, 0.3, 0.025, 0.04, sx + Math.cos(a) * 0.15, y0 + 0.06, sz + Math.sin(a) * 0.15, { ry: -a }); fig.add(new THREE.SphereGeometry(0.022, 8, 6), M.black, { x: sx + Math.cos(a) * 0.3, y: y0 + 0.024, z: sz + Math.sin(a) * 0.3 }); }
  fig.cyl(M.metal, 0.024, 0.03, 0.34, sx, y0 + 0.24, sz, 10);
  fig.soft(M.leather, 0.46, 0.06, 0.46, sx + 0.02, sy - 0.02, sz, 0.025);
  // a low curved back on a chrome spine
  fig.add(new THREE.CylinderGeometry(0.3, 0.3, 0.27, 20, 1, true, 3.912, 1.6), M.leather, { x: sx + 0.08, y: sy + 0.31, z: sz, rz: 0.08 });
  fig.box(M.metal, 0.025, 0.3, 0.035, sx - 0.205, sy + 0.1, sz, { rz: 0.15 });
  // body
  fig.add(new THREE.CapsuleGeometry(0.14, 0.26, 6, 14), S, { x: sx + 0.02, y: sy + 0.28, z: sz, rz: -0.16, sz: 1.32 });
  rod(fig, S, [sx + 0.08, sy + 0.55, sz - 0.17], [sx + 0.08, sy + 0.55, sz + 0.17], 0.07);
  rod(fig, S, [sx + 0.06, sy + 0.1, sz - 0.1], [sx + 0.06, sy + 0.1, sz + 0.1], 0.12);
  for (const s of [-1, 1]) {
    // thighs, shins, feet
    rod(fig, S, [sx + 0.06, sy + 0.1, sz + s * 0.1], [sx + 0.46, sy + 0.12, sz + s * 0.12], 0.066);
    rod(fig, S, [sx + 0.46, sy + 0.12, sz + s * 0.12], [sx + 0.5, y0 + 0.06, sz + s * 0.13], 0.05);
    fig.box(S, 0.2, 0.06, 0.09, sx + 0.56, y0 + 0.03, sz + s * 0.13);
    // arms to the keyboard
    rod(fig, S, [sx + 0.08, sy + 0.54, sz + s * 0.19], [sx + 0.27, sy + 0.3, sz + s * 0.23], 0.05);
    rod(fig, S, [sx + 0.27, sy + 0.3, sz + s * 0.23], [sx + 0.64, sy + 0.3, sz + s * 0.11], 0.04);
    fig.add(new THREE.SphereGeometry(0.042, 10, 8), S, { x: sx + 0.68, y: sy + 0.295, z: sz + s * 0.1, sx: 1.3, sy: 0.6 });
  }
  fig.build(group, { cast: true, receive: false });
  // the head turns between the display and the laptop: its own pivot at the neck
  const neck = new THREE.Group(); neck.position.set(sx + 0.1, sy + 0.62, sz);
  const hb = new Builder();
  rod(hb, S, [0, -0.04, 0], [0.01, 0.07, 0], 0.048);
  hb.add(new THREE.SphereGeometry(0.1, 20, 16), S, { x: 0.03, y: 0.14, z: 0, sx: 1.0, sy: 1.14, sz: 0.84 });
  hb.add(new THREE.SphereGeometry(0.104, 18, 14), S, { x: 0.0, y: 0.172, z: 0, sx: 1.02, sy: 0.96, sz: 0.9 });
  // a mop of hair over the crown
  for (let i = 0; i < 6; i++) { const a = i * 1.05 + rnd() * 0.4; hb.add(new THREE.SphereGeometry(0.036 + rnd() * 0.01, 8, 6), S, { x: -0.02 + Math.cos(a) * 0.055, y: 0.232 + rnd() * 0.012, z: Math.sin(a) * 0.05 }); }
  // headphones: a band over the top, big cups proud of the ears
  hb.add(new THREE.TorusGeometry(0.118, 0.016, 8, 30, Math.PI), S, { x: 0.03, y: 0.165, z: 0, ry: Math.PI / 2 });
  for (const s of [-1, 1]) {
    hb.cyl(S, 0.056, 0.056, 0.045, 0.035, 0.15, s * 0.108, 20, { rx: Math.PI / 2 });
    hb.cyl(S, 0.03, 0.03, 0.02, 0.035, 0.15, s * 0.135, 14, { rx: Math.PI / 2 });
  }
  hb.build(neck, { cast: true, receive: false });
  group.add(neck);

  /* ---------- around the room ---------- */
  // a fig by the window, a floor lamp in the corner
  plant(B, M, 10.12, y0, -1.18, 1.45);
  const fl = [10.1, 3.05];
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.4; rod(B, M.teak, [fl[0] + Math.cos(a) * 0.22, y0, fl[1] + Math.sin(a) * 0.22], [fl[0], y0 + 0.62, fl[1]], 0.014); }
  B.cyl(M.brass, 0.01, 0.01, 0.95, fl[0], y0 + 1.1, fl[1], 8);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.34, 28, 1, true), mat.shade);
  drum.position.set(fl[0], y0 + 1.66, fl[1]); group.add(drum);
  // a pickleball paddle dropped on the rug by the desk, its ball beside it
  const PB = new Builder();
  PB.add(new THREE.CylinderGeometry(0.1, 0.1, 0.014, 28).scale(1.28, 1, 1), mat.paddle, { x: 0.255, y: 0.012 });
  PB.add(new THREE.TorusGeometry(0.1, 0.006, 6, 32).rotateX(Math.PI / 2).scale(1.28, 1, 1), M.cream, { x: 0.255, y: 0.012 });
  PB.cyl(M.black, 0.016, 0.016, 0.13, 0.065, 0.016, 0, 10, { rz: Math.PI / 2 });
  const paddle = new THREE.Group();
  PB.build(paddle);
  paddle.position.set(9.3, y0 + 0.006, DESK.z1 + 0.2); paddle.rotation.y = 2.5;
  group.add(paddle);
  B.add(new THREE.SphereGeometry(0.037, 14, 10), mat.ball, { x: 9.1, y: y0 + 0.043, z: DESK.z1 + 0.42 });
  // a lounge chair and ottoman by the core, turned toward the window (seen from the door and in section)
  const lounge = new THREE.Group();
  const LG = new Builder();
  for (let i = 0; i < 5; i++) { const a = i * 1.2566; LG.box(M.black, 0.26, 0.02, 0.035, Math.cos(a) * 0.13, 0.03, Math.sin(a) * 0.13, { ry: -a }); }
  LG.cyl(M.black, 0.03, 0.03, 0.2, 0, 0.13, 0, 10);
  LG.box(M.walnut, 0.6, 0.05, 0.62, 0.02, 0.25, 0, { rz: 0.08 });
  LG.soft(M.leather, 0.56, 0.12, 0.58, 0.02, 0.33, 0, 0.05, { rz: 0.08 });
  LG.box(M.walnut, 0.05, 0.5, 0.62, -0.31, 0.56, 0, { rz: 0.32 });
  LG.soft(M.leather, 0.12, 0.46, 0.56, -0.25, 0.58, 0, 0.05, { rz: 0.32 });
  LG.box(M.walnut, 0.05, 0.26, 0.56, -0.43, 0.93, 0, { rz: 0.4 });
  LG.soft(M.leather, 0.1, 0.24, 0.5, -0.38, 0.93, 0, 0.04, { rz: 0.4 });
  for (const s of [-1, 1]) LG.soft(M.leather, 0.42, 0.06, 0.09, 0.02, 0.47, s * 0.31, 0.03);
  // ottoman
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.78; LG.box(M.black, 0.2, 0.02, 0.03, 0.78 + Math.cos(a) * 0.1, 0.03, Math.sin(a) * 0.1, { ry: -a }); }
  LG.cyl(M.black, 0.025, 0.025, 0.14, 0.78, 0.1, 0, 10);
  LG.box(M.walnut, 0.46, 0.04, 0.46, 0.78, 0.19, 0);
  LG.soft(M.leather, 0.44, 0.1, 0.44, 0.78, 0.25, 0, 0.04);
  LG.build(lounge);
  lounge.position.set(5.75, y0, 2.15); lounge.rotation.y = 0.35;
  group.add(lounge);
  plant(B, M, 5.15, y0, 3.25, 1.15);
  // rug
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.9), mat.rug);
  rug.rotation.x = -Math.PI / 2; rug.position.set(9.0, y0 + 0.006, 0.55); rug.receiveShadow = true; group.add(rug);
  // the back wall: a teak credenza with records, shelves, the Liebesebbe cover
  const cz = ROOM.z0 + 0.24;
  B.box(M.teak, 3.2, 0.62, 0.44, 7.6, y0 + 0.17 + 0.31, cz);
  for (const x of [6.4, 7.2, 8.0, 8.8]) B.box(x < 7.5 ? M.walnut : M.cream, 0.78, 0.5, 0.012, x, y0 + 0.48, cz + 0.225);
  for (const x of [6.15, 9.05]) for (const s of [-1, 1]) leg(B, M.walnut, x, y0, cz + s * 0.15, 0.17, 0.02);
  for (let i = 0; i < 9; i++) B.box(mat.sleeve[i % 4], 0.012, 0.31, 0.31, 8.55 + i * 0.03, y0 + 0.79 + 0.155, cz, { rz: (i - 4) * 0.02 });
  B.cyl(mat.vinyl, 0.15, 0.15, 0.008, 6.6, y0 + 0.82, cz, 32);
  B.box(M.walnut, 0.42, 0.06, 0.36, 6.6, y0 + 0.81, cz);
  for (let s = 0; s < 2; s++) {
    const sy2 = y0 + 1.55 + s * 0.42;
    B.box(M.teak, 1.6, 0.03, 0.24, 8.1, sy2, ROOM.z0 + 0.12);
    let x = 7.38;
    while (x < 8.8) { const w = 0.028 + rnd() * 0.03, h = 0.2 + rnd() * 0.1; B.box([M.teal, M.mustard, M.cream, M.rust, M.navy, M.olive][Math.floor(rnd() * 6)], w, h, 0.19, x, sy2 + 0.015 + h / 2, ROOM.z0 + 0.13, { rz: rnd() < 0.08 ? 0.2 : 0 }); x += w + 0.004; }
  }
  // the Liebesebbe cover, framed, above the record player
  // (a small canvas now, the picture when the room is near: one shared fetch with the living room's cover)
  const cover = data.pianoCollection?.tracks?.find(t => t.artwork);
  let coverMat = M.cream, loadCover = () => {};
  if (cover) {
    const tx = canvasTexture(256, 256, g => { g.fillStyle = '#5d7fae'; g.fillRect(0, 0, 256, 256); });
    coverMat = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.6 });
    let asked = false;
    loadCover = () => {
      if (asked) return;
      asked = true;
      loadImage(mediaBase + cover.artwork).then(img => { tx.image.getContext('2d').drawImage(img, 0, 0, 256, 256); tx.needsUpdate = true; data.wake?.(); }, () => {});
    };
  }
  B.box(M.black, 0.62, 0.62, 0.03, 6.6, y0 + 1.75, ROOM.z0 + 0.015);
  const coverMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.52), coverMat);
  coverMesh.position.set(6.6, y0 + 1.75, ROOM.z0 + 0.032); group.add(coverMesh);

  B.build(group);

  /* ---------- the evening outside the side window ---------- */
  let seed = 11;
  const duskTex = canvasTexture(1024, 640, (g, w, h) => paintDusk(g, w, h, { horizon: 0.52, rnd: () => ((seed = (seed * 16807) % 2147483647) / 2147483647) }));
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), new THREE.MeshBasicMaterial({ map: duskTex, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false }));
  backdrop.position.set(WINDOW.x + 1.4, 5.0, 0.5); backdrop.rotation.y = -Math.PI / 2;
  backdrop.visible = false;
  group.add(backdrop);

  /* ---------- lights: the lamp, the screens' glow, the floor lamp ---------- */
  const lamp = new THREE.PointLight('#ffb466', 2.6, 3.6, 1.5);
  lamp.position.copy(lampAt);
  const glow = new THREE.PointLight('#a6dcd5', 1.5, 3.2, 1.4);
  glow.position.set(D.x - 0.45, D.y + 0.05, D.z);
  const corner = new THREE.PointLight('#ffc27e', 1.6, 6.5, 1.5);
  corner.position.set(fl[0] - 0.05, y0 + 1.6, fl[1]);
  group.add(lamp, glow, corner);

  group.updateMatrixWorld(true);
  const xcodeAnchor = lapScreen.localToWorld(new THREE.Vector3(0.04, 0.09, 0));

  /* ---------- per frame ---------- */
  const center = new THREE.Vector3(D.x, D.y, D.z);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => new THREE.Vector3(D.x, D.y + b * D.h / 2, D.z + a * D.w / 2));
  const v = new THREE.Vector3(), fwd = new THREE.Vector3();
  const rect = { x0: 0, y0: 0, x1: 0, y1: 0 };
  // the viewport's shape on the glass (the largest centred rectangle of its proportions), projected:
  // the HTML sessions app is pinned to it while it fades in (office-sessions.js frame)
  const quad = [0, 1, 2, 3].map(() => ({ x: 0, y: 0 }));
  const frameInfo = { t: 0, rect, quad, facing: 0, own: false };
  // how far the camera has come from the desk view toward the screen (0..1), from its distance
  const dist0 = p => Math.hypot(p[0] - D.x, p[1] - D.y, p[2] - D.z) - 0.25;
  let idleDraw = false, near = false, accAgents = 1, accX = 1, cycleT = 0, shownTab = -1, staticDrawn = 0, nod = 0, moving = false;
  const n = projects.length;

  // the room's pictures: the display's and the laptop's screenshots, the framed cover. app.js calls
  // this as the camera approaches the room (from the theater's seat the camera is already within 14 m
  // of the desk, so distance alone would fetch them far too early)
  // (at the first quiet moment once near: the pictures' arrival costs the main thread a few milliseconds
  // each, and the room's dozen landing together in the middle of the flight into the studio dropped frames)
  function loadMedia() {
    if (near) return;
    near = true;
    quiet().then(() => { display.loadMedia(); xcode.loadMedia().then(() => data.wake?.()); loadCover(); display.warm(quiet); });
  }
  // resolves at a quiet moment: the camera has not moved for a while (about 300 ms), no scroll, key,
  // touch or click in the last 400 ms (one may be about to move it), the page on screen; then in idle
  // time. (Reads the camera, not the frame state: the office may not be drawn.)
  const pose = new THREE.Vector3(), turn = new THREE.Quaternion();
  let lastInput = 0;
  for (const ev of ['wheel', 'touchstart', 'touchmove', 'keydown', 'pointerdown']) addEventListener(ev, () => { lastInput = performance.now(); }, { capture: true, passive: true });
  function quiet() {
    return new Promise(done => {
      const calm = c => c.position.equals(pose) && c.quaternion.equals(turn) && performance.now() - lastInput > 400;
      const check = () => {
        const c = state.camera;
        if (c && !document.hidden && calm(c)) {
          if (window.requestIdleCallback) requestIdleCallback(() => (calm(c) ? done() : check()), { timeout: 500 }); else done();
          return;
        }
        if (c) { pose.copy(c.position); turn.copy(c.quaternion); }
        setTimeout(check, 300);
      };
      check();
    });
  }
  return {
    group, display, agents, xcode, backdrop, loadMedia,
    anchors: {
      screen: new THREE.Vector3(D.x - 0.01, D.y + D.h / 2 + 0.005, D.z + D.w * 0.18),
      agents: agentsAt,
      xcode: xcodeAnchor,
    },
    lights: [{ l: lamp, i: 2.6 }, { l: glow, i: 1.5 }, { l: corner, i: 1.6 }],
    // s: the frame state from app.js plus dt and time (see world.js frame)
    update(s) {
      const cam = state.camera, dt = s.dt, time = s.time;
      const dist = cam ? cam.position.distanceTo(center) : 99;

      // which session the display shows: cycles while he works, follows the HTML once you look closer
      if (state.idle && !s.reduced) { cycleT += dt; if (cycleT > 6) { cycleT = 0; shownTab = (shownTab + 1) % n; } }
      else { shownTab = state.tab; cycleT = 0; }
      display.setTab(Math.max(0, shownTab));
      if (display.setView(innerWidth, innerHeight)) { placeAgents(); accAgents = 1; }
      if (near && display.needsWarm) display.warm(quiet);
      // the display is a 1600 x 1000 canvas: its redraw and texture upload (a new session, a picture
      // arriving, the idle cycling, a resize) wait until the camera is still, then run in idle time between
      // frames, never inside one, and ask for a frame. Only what the zoom into the sessions needs (the
      // session it lands on, once you are on your way in) goes ahead during a move. Hidden under the
      // sessions app while the camera moves between sessions, it waits for rest. (Every session was drawn
      // once at a quiet moment before, display.warm, so a redraw costs a few milliseconds.)
      moving = s.moving;
      if (display.dirty && !idleDraw && !(state.covered && s.moving) && (!s.moving || !state.idle)) {
        idleDraw = true;
        const asked = performance.now();
        const run = dl => {
          // (the camera set off meanwhile: wait for rest)
          if (moving && state.idle) { idleDraw = false; return; }
          // at rest, a slice of idle time long enough for it (for up to a second); on the way into the
          // sessions, the first chance (the hand-over needs the session there before the app fades in)
          if (state.idle && dl && !dl.didTimeout && dl.timeRemaining() < 4 && performance.now() - asked < 1000) { requestIdleCallback(run, { timeout: 300 }); return; }
          idleDraw = false;
          if (display.draw()) { data.renderer?.initTexture(display.texture); data.wake?.(); }
        };
        if (window.requestIdleCallback) requestIdleCallback(run, { timeout: state.idle ? 1000 : 100 }); else setTimeout(run, state.idle ? 100 : 16);
      }

      // the agents and Xcode: animated when you are close, otherwise a still
      if (s.reduced) {
        // (again once the laptop's screenshots are in: they arrive after the first still)
        const have = near ? 1 + xcode.imgs.filter(Boolean).length : 0;
        if (have && staticDrawn !== have) { agents.draw(12); xcode.draw(6); staticDrawn = have; }
      } else if (dist < 9) {
        accAgents += dt; accX += dt;
        const rate = dist < 2 ? 1 / 24 : 1 / 12;
        if (accAgents > rate) { accAgents = 0; agents.draw(performance.now() / 1000); }
        if (accX > 1 / 6) { accX = 0; xcode.draw(time); }
      } else if (dist < 40 && accAgents > 2) { accAgents = 0; agents.draw(performance.now() / 1000); xcode.draw(time); }
      else accAgents += dt;

      // the evening outside fades in as the camera comes up to the office's front window (from about two
      // metres out, where the facade fills the view, so the painting is only ever seen through the glass)
      // and is in place by the time it passes through and the box appears
      if (cam) {
        const p = cam.position;
        const inside = p.x > ROOM.x0 - 0.3 && p.y > F1 && p.y < ROOM.y1 ? smooth(6.2, 3.6, p.z) : 0;
        backdrop.material.opacity = inside;
        backdrop.visible = inside > 0.002;
      }

      // Freeman: glances from the display to the laptop and back, now and then, and nods along
      // under his headphones while anything in the house is playing
      if (!s.reduced) {
        const c = time % 15;
        const look = smooth(6.2, 7.2, c) * (1 - smooth(10, 11, c));
        nod += ((s.playing ? s.onset * (0.4 + s.level) : 0) - nod) * Math.min(1, dt * 18);
        neck.rotation.y = look * 0.5;
        neck.rotation.z = -0.05 - look * 0.06 + Math.sin(time * 0.7) * 0.012 - nod * 0.09;
      }

      // hand-over to the HTML sessions: zoom progress and where the display is on screen
      if (cam && state.onFrame) {
        let x0 = 1e9, y0b = 1e9, x1 = -1e9, y1 = -1e9, behind = false;
        const W = innerWidth, H = innerHeight;
        for (const c of corners) {
          v.copy(c).project(cam);
          if (v.z > 1) behind = true;
          const px = (v.x * 0.5 + 0.5) * W, py = (-v.y * 0.5 + 0.5) * H;
          x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0b = Math.min(y0b, py); y1 = Math.max(y1, py);
        }
        cam.getWorldDirection(fwd);
        v.copy(center).sub(cam.position).normalize();
        frameInfo.facing = fwd.dot(v);
        const port = W / H < 0.8, d0 = dist0(port ? officeRoom.key.port.p : officeRoom.key.p), d1 = port ? SCREEN.port : SCREEN.land;
        const t = frameInfo.t = behind || frameInfo.facing < 0.8 ? 0 : Math.min(1, Math.max(0, (d0 - dist) / (d0 - d1)));
        rect.x0 = x0; rect.y0 = y0b; rect.x1 = x1; rect.y1 = y1;
        frameInfo.own = display.L.own;
        if (t > 0) {
          // where the HTML is pinned on the glass (display.handRect, fractions of the glass from its top
          // left); screen-left on the glass is -z (it faces -x)
          const r = display.handRect(W, H);
          [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([a, b], i) => {
            v.set(D.x, D.y + D.h / 2 - (r.y + b * r.h) * D.h, D.z - D.w / 2 + (r.x + a * r.w) * D.w).project(cam);
            quad[i].x = (v.x * 0.5 + 0.5) * W; quad[i].y = (-v.y * 0.5 + 0.5) * H;
          });
        }
        // an app with a layout of its own: the display's window clears first (then the app fades in over
        // it, office-sessions.js frame)
        const clear = frameInfo.own ? smooth(0.5, 0.64, t) : 0;
        blank.material.opacity = clear;
        blank.visible = clear > 0.002;
        state.onFrame(frameInfo);
      }
    },
  };
}

// a capsule from a to b (world points)
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _up = new THREE.Vector3(0, 1, 0), _one = new THREE.Vector3(1, 1, 1);
function rod(B, mat, a, b, r) {
  _a.fromArray(a); _b.fromArray(b); _d.subVectors(_b, _a);
  const len = _d.length();
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len), 3, r > 0.03 ? 12 : 6);
  _q.setFromUnitVectors(_up, _d.normalize());
  _m.compose(_a.add(_b).multiplyScalar(0.5), _q, _one);
  g.applyMatrix4(_m);
  B.add(g, mat);
}

// near-black with a soft rim where the screens light his outline (cool) and the lamp catches his right side (warm)
function silhouetteMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { base: { value: new THREE.Color('#0d0908') }, rim: { value: new THREE.Color('#8fd3cb') }, warm: { value: new THREE.Color('#ffb36b') } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `uniform vec3 base; uniform vec3 rim; uniform vec3 warm; varying vec3 vN; varying vec3 vV;
      void main() {
        vec3 n = normalize(vN);
        float f = 1.0 - abs(dot(n, normalize(vV)));
        float front = clamp(n.x * 0.6 + 0.55, 0.0, 1.0);
        vec3 c = base + rim * pow(f, 7.0) * (0.15 + 0.85 * front) * 0.7 + warm * pow(f, 4.0) * clamp(n.z, 0.0, 1.0) * 0.12;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

// a mid-century wool rug: deep teal, a mustard band, a cream line
function paintRug(g, w, h) {
  g.fillStyle = '#1f5557'; g.fillRect(0, 0, w, h);
  const r = makeRand(91);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + r() * 0.04})`; g.fillRect(r() * w, r() * h, 2, 2); }
  g.strokeStyle = '#d39b2a'; g.lineWidth = 14; g.strokeRect(34, 34, w - 68, h - 68);
  g.strokeStyle = '#ede3cf'; g.lineWidth = 3; g.strokeRect(58, 58, w - 116, h - 116);
  g.fillStyle = '#d39b2a';
  for (const [x, y] of [[w / 2 - 60, h / 2], [w / 2, h / 2], [w / 2 + 60, h / 2]]) { g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); }
}
