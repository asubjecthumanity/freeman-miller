// Basement home theater (owner: theater). You sit in the middle of the back row: a staggered front row of
// red recliners in the foreground, a 2.7 m flat-screen on a slatted walnut wall, a 5.1 system around
// it, and the picture's light (colour and brightness, per shot) spilling onto the slats, ceiling, walls
// and seat tops. The house lights dim when the sound comes on.
import * as THREE from 'three';
import { Builder, canvasTexture, makeRand } from './kit.js';
import { THEATER, F0, C0 } from './layout.js';
import room from '../rooms/theater.js';
import { speaker, leg, emissive } from './parts.js';
import { TVScreen } from './screens/tv.js';
import { posterTexture } from './screens/poster.js';
import { glowTexture, makeCanvas, tex, FONT } from './screens/shared.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// data: the room context from world.js ({ film, person, pianoCollection, otherMusic, projects, mediaBase, mobile })
export function buildTheater(M, T, data) {
  const group = new THREE.Group(); group.name = 'theater';
  const B = new Builder();
  const cx = -4.15, wz = THEATER.z0, X0 = THEATER.x0, X1 = THEATER.x1;
  const rnd = makeRand(4711);

  /* room-only materials */
  const felt = new THREE.MeshStandardMaterial({ color: '#120e0d', roughness: 1 });
  const velvet = new THREE.MeshStandardMaterial({ color: '#8f2b25', roughness: 0.88 });
  const velvetDark = new THREE.MeshStandardMaterial({ color: '#5e1c18', roughness: 0.92 });
  const kevlar = new THREE.MeshStandardMaterial({ color: '#d9a43a', roughness: 0.75 });
  const armWood = new THREE.MeshStandardMaterial({ color: '#4a2b1b', roughness: 0.85 });
  const popcornMat = new THREE.MeshStandardMaterial({ map: canvasTexture(64, 64, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4ead8' : '#c8352a'; g.fillRect(i * w / 8, 0, w / 8, h); }
  }), roughness: 0.6 });
  const kernel = new THREE.MeshStandardMaterial({ color: '#f3dfa6', roughness: 0.9, flatShading: true });

  /* ---------- the feature wall: walnut slats on black felt, a valance with a warm cove light ---------- */
  B.aabb(felt, X0, F0, wz, X1, C0, wz + 0.012);
  const slatW = 0.16, pitch = 0.245, n = Math.floor((X1 - X0 - 0.3 - slatW) / pitch) + 1;
  const s0 = cx - ((n - 1) * pitch) / 2;
  for (let i = 0; i < n; i++) { const x = s0 + i * pitch; B.aabb(M.walnut, x - slatW / 2, F0, wz + 0.012, x + slatW / 2, C0 - 0.24, wz + 0.047); }
  B.aabb(M.walnut, X0, C0 - 0.24, wz, X1, C0, wz + 0.26);
  const coveMat = emissive('#ffb469', 1.3);
  const cove = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 - 0.2, 0.03), coveMat);
  cove.rotation.x = Math.PI / 2; cove.position.set(cx, C0 - 0.245, wz + 0.08); group.add(cove);
  // the cove light grazing down the slats
  const edgeTex = edgeTexture();
  const coveWashMat = new THREE.MeshBasicMaterial({ map: edgeTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ff9c4e', opacity: 0.22, toneMapped: false });
  const coveWash = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, 1.2), coveWashMat);
  coveWash.position.set(cx, C0 - 0.24 - 0.6, wz + 0.05); group.add(coveWash);
  // the valance turns into a walnut soffit down both side walls, with a warm cove light washing the
  // ceiling along its inner edge (it dims with the house lights)
  const ZB = THEATER.z1, sd = 0.4, sLen = ZB - (wz + 0.26), sMid = (wz + 0.26 + ZB) / 2;
  const stripMat = emissive('#ffad5e', 0.6);
  const coveGlowMat = new THREE.MeshBasicMaterial({ map: edgeTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ff9c4e', opacity: 0.2, toneMapped: false });
  for (const side of [-1, 1]) {
    const xw = side < 0 ? X0 : X1, xi = xw - side * sd;
    B.aabb(M.walnut, Math.min(xw, xi), C0 - 0.2, wz + 0.26, Math.max(xw, xi), C0, ZB);
    B.aabb(stripMat, Math.min(xi, xi - side * 0.01), C0 - 0.022, wz + 0.26, Math.max(xi, xi - side * 0.01), C0 - 0.008, ZB);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(sLen, 0.9).rotateZ(-side * Math.PI / 2).rotateX(Math.PI / 2), coveGlowMat);
    g.position.set(xi - side * 0.45, C0 - 0.014, sMid); group.add(g);
  }

  /* ---------- TV ---------- */
  const tv = new TVScreen(data.film, data.person);
  // slot for a real trailer: filmScore.trailer = { src, poster } (paths relative to shared/) replaces the drawn film
  const trailer = data.film.trailer;
  if (trailer?.src) tv.setVideo((data.mediaBase || '') + trailer.src, trailer.poster ? (data.mediaBase || '') + trailer.poster : null);
  const tvW = 2.7, tvH = tvW * 9 / 16, tvY = 1.64, tvZ = wz + 0.106;
  B.box(M.blackGloss, tvW + 0.04, tvH + 0.04, 0.045, cx, tvY, wz + 0.083);
  B.box(M.black, 0.5, 0.3, 0.02, cx, tvY, wz + 0.052); // the wall mount
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(tvW, tvH), new THREE.MeshBasicMaterial({ map: tv.texture, toneMapped: false }));
  screen.position.set(cx, tvY, tvZ);
  group.add(screen);
  // bias glow on the slats around the set
  const glowTex = glowTexture();
  const biasMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#6f93b8', opacity: 0.85, toneMapped: false });
  const bias = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.3), biasMat);
  bias.position.set(cx, tvY, wz + 0.05); group.add(bias);

  /* ---------- the picture's light on the ceiling and the side walls ---------- */
  const spillTex = edgeTexture();
  const spillMat = new THREE.MeshBasicMaterial({ map: spillTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#000000', opacity: 1, toneMapped: false });
  // the textures are brightest along the plane's +y edge: turn that edge to the TV wall
  const ceilGeo = new THREE.PlaneGeometry(X1 - X0 - 0.1, 3.0).rotateX(Math.PI / 2).rotateY(Math.PI); // facing down
  const ceilSpill = new THREE.Mesh(ceilGeo, spillMat);
  ceilSpill.position.set(cx, C0 - 0.012, wz + 1.5); group.add(ceilSpill);
  const wallSpillMat = spillMat.clone();
  for (const side of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(C0 - 0.05, 3.4).rotateZ(side * Math.PI / 2).rotateY(-side * Math.PI / 2); // facing into the room
    const m = new THREE.Mesh(geo, wallSpillMat);
    m.position.set(side < 0 ? X0 + 0.012 : X1 - 0.012, (C0 - 0.05) / 2, wz + 1.7);
    group.add(m);
  }
  // the camera rises through the ceiling on the way to the living room: fade the ceiling light first
  let camY = 1.4;
  ceilSpill.onBeforeRender = (r, s, cam) => { camY = cam.position.y; spillMat.opacity = 1 - smooth(1.85, 2.45, camY); };

  /* ---------- media credenza with a turntable and the receiver ---------- */
  const cy0 = 0.16, ch = 0.42, cw = 2.9, cd = 0.45, cz = wz + 0.1 + cd / 2, ctop = cy0 + ch;
  B.box(M.walnut, cw, ch, cd, cx, cy0 + ch / 2, cz);
  for (let i = 1; i < 4; i++) B.box(M.black, 0.008, ch - 0.06, 0.004, cx - cw / 2 + i * cw / 4, cy0 + ch / 2, cz + cd / 2 + 0.002);
  for (let i = 0; i < 4; i++) B.box(M.brass, 0.1, 0.012, 0.02, cx - cw / 2 + (i + 0.5) * cw / 4, cy0 + ch * 0.72, cz + cd / 2 + 0.01);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) leg(B, M.walnut, cx + sx * (cw / 2 - 0.12), 0, cz + sz * (cd / 2 - 0.08), cy0, 0.022);
  // turntable on the left end
  const ttx = cx - 1.1;
  B.box(M.walnut, 0.44, 0.08, 0.34, ttx, ctop + 0.04, cz);
  B.cyl(M.metal, 0.145, 0.145, 0.02, ttx - 0.04, ctop + 0.09, cz, 32);
  B.cyl(M.blackGloss, 0.138, 0.138, 0.006, ttx - 0.04, ctop + 0.103, cz, 32);
  B.cyl(M.rust, 0.045, 0.045, 0.008, ttx - 0.04, ctop + 0.104, cz, 20);
  B.box(M.metal, 0.012, 0.012, 0.24, ttx + 0.15, ctop + 0.12, cz - 0.01, { ry: 0.35 });
  B.cyl(M.metal, 0.018, 0.018, 0.04, ttx + 0.17, ctop + 0.1, cz - 0.11, 10);
  // receiver on the right end: the speaker wire gathers here
  const rx = cx + 1.1, ry0 = ctop, rw = 0.46, rh = 0.13, rd = 0.36;
  B.box(M.black, rw, rh, rd, rx, ry0 + rh / 2, cz);
  B.cyl(M.brass, 0.032, 0.032, 0.025, rx + 0.14, ry0 + rh / 2, cz + rd / 2 + 0.01, 20, { rx: Math.PI / 2 });
  for (let i = 0; i < 4; i++) B.cyl(M.metal, 0.009, 0.009, 0.012, rx - 0.18 + i * 0.04, ry0 + 0.03, cz + rd / 2 + 0.004, 8, { rx: Math.PI / 2 });
  const rec = receiverDisplay();
  const recScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.045), new THREE.MeshBasicMaterial({ map: rec.texture, toneMapped: false }));
  recScreen.position.set(rx - 0.07, ry0 + rh * 0.62, cz + rd / 2 + 0.002); group.add(recScreen);

  /* ---------- speakers: walnut cabinets, black baffles, mustard cones ---------- */
  const speakers = {};
  const sOpts = { cabinet: M.walnut, baffle: M.black, coneMat: kevlar, ringStyle: 'flat', ringColor: '#ffd9a0' };
  const put = (key, o, x, y, z, ry, label) => {
    const s = speaker(M, { ...sOpts, ...o });
    s.group.position.set(x, y, z); s.group.rotation.y = ry;
    group.add(s.group);
    s.label = label;
    speakers[key] = s;
  };
  const tower = { w: 0.3, h: 1.1, d: 0.34, plinth: M.black, drivers: [{ x: 0, y: 0.38, r: 0.1 }, { x: 0, y: 0.63, r: 0.1 }, { x: 0, y: 0.88, r: 0.032 }] };
  put('fl', tower, cx - 1.86, 0.025, wz + 0.78, 0.12, 'Front left');
  put('fr', tower, cx + 1.86, 0.025, wz + 0.78, -0.12, 'Front right');
  put('c', { w: 0.86, h: 0.17, d: 0.26, drivers: [{ x: -0.26, y: 0.085, r: 0.062 }, { x: 0.26, y: 0.085, r: 0.062 }, { x: 0, y: 0.085, r: 0.028 }] }, cx, ctop, cz + 0.06, 0, 'Centre');
  put('sub', { w: 0.5, h: 0.6, d: 0.5, plinth: M.black, drivers: [{ x: 0, y: 0.35, r: 0.17 }] }, cx - 2.66, 0.025, wz + 0.6, 0.3, 'Subwoofer');
  const surround = { w: 0.22, h: 0.32, d: 0.16, drivers: [{ x: 0, y: 0.115, r: 0.066 }, { x: 0, y: 0.26, r: 0.024 }] };
  const sz = wz + 0.42, sy = 1.9, aim = Math.PI / 2 - 0.62;
  put('sl', surround, X0 + 0.16, sy, sz, aim, 'Surround left');
  put('sr', surround, X1 - 0.16, sy, sz, -aim, 'Surround right');
  for (const x of [X0 + 0.04, X1 - 0.04]) B.box(M.black, 0.08, 0.05, 0.05, x, sy + 0.12, sz);
  const spk = [speakers.fl, speakers.fr, speakers.c, speakers.sub, speakers.sl, speakers.sr];
  // the sub's thump, as a ring on the carpet
  const thumpMat = new THREE.MeshBasicMaterial({ color: '#ffcf8a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const thump = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48, 1), thumpMat);
  thump.rotation.x = -Math.PI / 2; thump.position.set(cx - 2.66, 0.012, wz + 0.6); thump.visible = false; group.add(thump);
  let thumpAge = 9;

  /* ---------- seats: a staggered front row of four, the back row of three on a riser ---------- */
  // a recliner facing the screen; zb is the back's rear face, hb the back's height above the seat
  const seat = (x, zb, y0, hb = 0.6) => {
    B.box(velvetDark, 0.52, 0.2, 0.6, x, y0 + 0.1, zb - 0.4);
    B.soft(velvet, 0.58, 0.18, 0.62, x, y0 + 0.3, zb - 0.42, 0.05);
    B.soft(velvet, 0.58, hb, 0.2, x, y0 + 0.36 + hb / 2, zb - 0.11, 0.045, { rx: 0.08 });
    // channel stitching down the back, seen from the row behind
    for (const dx of [-0.13, 0, 0.13]) B.box(velvetDark, 0.012, hb - 0.16, 0.01, x + dx, y0 + 0.36 + hb / 2 - 0.02, zb - 0.002, { rx: 0.08 });
    B.soft(velvetDark, 0.48, 0.14, 0.12, x, y0 + 0.36 + hb - 0.02, zb - 0.22, 0.05, { rx: 0.08 });
  };
  const arm = (x, zb, y0, end) => {
    B.box(end ? armWood : velvetDark, 0.15, 0.44, 0.76, x, y0 + 0.3, zb - 0.4);
    B.soft(armWood, 0.17, 0.08, 0.8, x, y0 + 0.55, zb - 0.4, 0.03);
    B.cyl(M.brass, 0.04, 0.04, 0.012, x, y0 + 0.592, zb - 0.66, 18);
    B.cyl(M.black, 0.033, 0.033, 0.013, x, y0 + 0.593, zb - 0.66, 18);
  };
  const frontZ = 0.8, backZ = 3.76, riser = 0.45;
  const row = (xs, zb, y0, hb) => {
    xs.forEach(x => seat(x, zb, y0, hb));
    const arms = [xs[0] - 0.4, ...xs.map(x => x + 0.4)];
    arms.forEach((x, i) => arm(x, zb, y0, i === 0 || i === arms.length - 1));
  };
  row([cx - 1.2, cx - 0.4, cx + 0.4, cx + 1.2], frontZ, 0, 0.52);
  row([cx - 0.8, cx, cx + 0.8], backZ, riser, 0.5);
  B.aabb(M.carpet, X0, 0, 2.62, X1, riser, THEATER.z1);
  B.aabb(M.walnut, X0, riser - 0.03, 2.59, X1, riser + 0.005, 2.65);
  // a step light along the riser's nose
  B.aabb(emissive('#ffb469', 0.9), X0 + 0.1, 0.06, 2.615, X1 - 0.1, 0.075, 2.625);
  // popcorn in a cup holder of the front row
  const px = cx + 0.8, pz = frontZ - 0.2;
  B.cyl(popcornMat, 0.075, 0.055, 0.2, px, 0.69, pz, 16);
  const pop = new THREE.IcosahedronGeometry(0.026, 0);
  for (let i = 0; i < 16; i++) { const a = rnd() * 6.283, r = rnd() * 0.06; B.add(pop, kernel, { x: px + Math.cos(a) * r, y: 0.795 + rnd() * 0.05, z: pz + Math.sin(a) * r, rx: rnd() * 3, ry: rnd() * 3 }); }

  /* ---------- rug, side-wall panels, sconces, downlights, poster, plant ---------- */
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), new THREE.MeshStandardMaterial({ map: T.rugTheater, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(cx, 0.008, -1.0); rug.receiveShadow = true;
  group.add(rug);
  // fabric panels down the side walls (seen on the way in)
  const panelCols = [M.mustard, M.teal, M.rust];
  [[1.2, 1], [2.3, 2]].forEach(([z, k]) => B.box(panelCols[k], 0.05, 1.0, 0.8, X0 + 0.025, 1.5, z));
  [[1.2, 2], [2.3, 0]].forEach(([z, k]) => B.box(panelCols[k], 0.05, 1.0, 0.8, X1 - 0.025, 1.5, z));
  // a brass sconce on each side wall, its shade glowing, light washing up and down the wall
  const sconceMat = emissive('#ffa24c', 1.4);
  const washMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ff9a4a', opacity: 0.3, toneMapped: false });
  const shadeGeo = new THREE.CylinderGeometry(0.075, 0.05, 0.17, 18, 1, true);
  for (const x of [X0, X1]) {
    const inX = x < cx ? 1 : -1, z = -1.9, y = 1.72;
    B.box(M.brass, 0.02, 0.2, 0.08, x + inX * 0.01, y, z);
    B.box(M.brass, 0.1, 0.012, 0.012, x + inX * 0.06, y, z);
    const s = new THREE.Mesh(shadeGeo, sconceMat);
    s.position.set(x + inX * 0.12, y, z); group.add(s);
    const wash = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.9), washMat);
    wash.position.set(x + inX * 0.015, y, z); wash.rotation.y = inX * Math.PI / 2; group.add(wash);
  }
  const dl = emissive('#ffd9a0', 0.55);
  for (const [x, z] of [[cx - 1.7, -1.7], [cx + 1.7, -1.7], [cx - 1.7, 1.3], [cx + 1.7, 1.3]]) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.065, 16), dl);
    d.rotation.x = Math.PI / 2; d.position.set(x, C0 - 0.005, z); group.add(d);
  }
  // the one-sheet on the slats left of the TV, under a brass picture light
  const pW = 0.6, pH = 0.9, pX = cx - 2.56, pY = 1.62;
  B.box(M.black, pW + 0.05, pH + 0.05, 0.03, pX, pY, wz + 0.062);
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(pW, pH), new THREE.MeshStandardMaterial({ map: posterTexture(data.film, data.person), roughness: 0.5 }));
  poster.position.set(pX, pY, wz + 0.079); group.add(poster);
  B.box(M.brass, 0.36, 0.028, 0.05, pX, pY + pH / 2 + 0.1, wz + 0.15);
  B.box(M.brass, 0.012, 0.012, 0.1, pX, pY + pH / 2 + 0.1, wz + 0.1);
  const pLight = new THREE.Mesh(new THREE.PlaneGeometry(pW + 0.25, pH + 0.15), new THREE.MeshBasicMaterial({ map: edgeTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffbe7a', opacity: 0.34, toneMapped: false }));
  pLight.position.set(pX, pY - 0.04, wz + 0.082); group.add(pLight);
  // a snake plant in a planter on tapered legs, in the front-right corner
  {
    const qx = X1 - 0.34, qz = wz + 0.4, py0 = 0.22;
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; leg(B, M.walnut, qx + Math.cos(a) * 0.13, 0, qz + Math.sin(a) * 0.13, py0 + 0.02, 0.016, 0); }
    B.cyl(M.pot, 0.17, 0.13, 0.3, qx, py0 + 0.15, qz, 20);
    B.cyl(M.trunk, 0.155, 0.155, 0.02, qx, py0 + 0.29, qz, 20);
    const leaf = new THREE.ConeGeometry(0.04, 1, 4);
    const leafMat = new THREE.MeshStandardMaterial({ color: '#2f5a35', roughness: 0.7, flatShading: true });
    for (let i = 0; i < 11; i++) {
      const a = i * 2.4 + rnd() * 0.4, r = 0.03 + rnd() * 0.08, h = 0.5 + rnd() * 0.4;
      B.add(leaf, leafMat, { x: qx + Math.cos(a) * r, y: py0 + 0.28 + h / 2, z: qz + Math.sin(a) * r, sx: 1, sy: h, sz: 0.3, ry: a, rx: Math.sin(a) * 0.12 * (r / 0.1), rz: -Math.cos(a) * 0.12 * (r / 0.1) });
    }
  }

  B.build(group);

  /* ---------- lights: the TV (two, coloured by the picture) and the dimmable house lights ---------- */
  const tvLight = new THREE.PointLight('#8fb2d6', 9, 11, 1.25);
  tvLight.position.set(cx, tvY, wz + 1.15);
  const tvFill = new THREE.PointLight('#8fb2d6', 3, 8, 1.4);
  tvFill.position.set(cx, 1.2, -0.9); // low and forward: the seat tops and the floor, not the ceiling
  const houseLight = new THREE.PointLight('#ffc27a', 1.6, 8, 1.6);
  houseLight.position.set(cx, 2.2, 0.4);
  group.add(tvLight, tvFill, houseLight);
  // world.js applies l.intensity = i * (distance fade) every frame; update() sets i
  const L_TV = { l: tvLight, i: 9 }, L_FILL = { l: tvFill, i: 3 }, L_HOUSE = { l: houseLight, i: 1.6 };
  const lights = [L_TV, L_FILL, L_HOUSE];

  /* ---------- leader-line anchors ---------- */
  const anchors = {
    tv: new THREE.Vector3(cx, tvY + tvH / 2, tvZ),
    // where the speaker wire gathers: the receiver's front-right top corner, just right of and below
    // the picture's bottom-right corner
    receiver: new THREE.Vector3(rx + rw / 2, ry0 + rh, cz + rd / 2),
  };
  for (const [k, s] of Object.entries(speakers)) {
    s.group.updateMatrixWorld(true);
    anchors[k] = s.group.localToWorld(s.anchor.clone());
  }
  // Leader-line routing (ui/theater-box.js leaders(), overlay.js `junction` + `via`): no wire crosses the
  // picture, a speaker cabinet or a cone. Risers are placed so they run straight up or down the screen
  // from the seat the camera is in (the room's key; the portrait key on phones).
  //  wide: every wire rises to one run along the slats between the TV's top and the valance, which runs
  //        on, level, into the box (the junction is over the middle of the picture, so it stays left of
  //        the box at every width; the right-hand speakers rise straight onto the run). Surround left and
  //        the subwoofer climb the left side wall outside the surround; the centre runs left under the
  //        picture and rises between the picture and the "Front left" tag.
  //  port: (phones and portrait tablets: the box is a sheet below the seats) the wires meet at the
  //        receiver, as wire would, and the trunk drops from there to the sheet. The towers' wires come
  //        down between each tower and the picture, the left one on along the credenza front; the
  //        surrounds and the subwoofer climb the side walls as on wide screens, run along above the
  //        picture's edge and come down the same gaps.
  const eye = new THREE.Vector3(...room.key.p), eyeP = new THREE.Vector3(...room.key.port.p);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // the point at height y on the plane z that is straight above (or below) world point a, seen from E
  const plumb = (a, y, z, E) => V(E.x + (a.x - E.x) * (E.z - z) / (E.z - a.z), y, z);
  // the same on the side-wall plane x
  const plumbX = (a, y, x, E) => V(x, y, E.z - (x - E.x) * (E.z - a.z) / (a.x - E.x));
  const route = (() => {
    const yR = 2.52, zW = wz + 0.06, xL = X0 + 0.02, xR = X1 - 0.02;
    const cornerL = V(xL, yR, zW), cornerR = V(xR, yR, zW);
    // Surround left and the subwoofer up the left side wall (the sub's riser passes outside the surround)
    const upLeft = E => ({
      sl: [plumbX(anchors.sl, yR, xL, E), cornerL],
      sub: [V(xL, anchors.sub.y, anchors.sub.z), V(xL, yR, anchors.sub.z), cornerL],
    });
    const cIn = V(eye.x - 0.229 * (eye.z - anchors.c.z), anchors.c.y, anchors.c.z); // between the picture and the left tower's tag
    const wide = {
      junction: V(cx, yR, zW),
      via: {
        ...upLeft(eye),
        fl: [plumb(anchors.fl, yR, zW, eye)],
        c: [cIn, plumb(cIn, yR, zW, eye)],
        fr: [plumb(anchors.fr, yR, zW, eye)],
        sr: [plumbX(anchors.sr, yR, xR, eye)],
      },
    };
    const J = anchors.receiver, yC = cy0 + ch * 0.86, zC = cz + cd / 2 + 0.01;
    const gapL = V(cx - 1.57, anchors.fl.y, anchors.fl.z);                               // between the left tower and the picture
    const gapR = V(eyeP.x + 0.2494 * (eyeP.z - anchors.fr.z), anchors.fr.y, anchors.fr.z); // between the picture and the right tower
    const downL = [gapL, plumb(gapL, yC, zC, eyeP), V(J.x + 0.06, yC, zC)];
    const downR = [gapR, plumb(gapR, J.y, J.z, eyeP)];
    const upP = upLeft(eyeP), topL = plumb(gapL, yR, zW, eyeP), topR = plumb(gapR, yR, zW, eyeP);
    const port = {
      junction: J,
      via: {
        sl: [...upP.sl, topL, ...downL],
        sub: [...upP.sub, topL, ...downL],
        fl: downL,
        c: [V(J.x, anchors.c.y, anchors.c.z)],
        fr: downR,
        sr: [plumbX(anchors.sr, yR, xR, eyeP), cornerR, topR, ...downR],
      },
    };
    return { wide, port };
  })();
  const via = route.wide.via;

  /* ---------- the TV's click target follows the picture on screen ---------- */
  screen.updateMatrixWorld(true);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => screen.localToWorld(new THREE.Vector3(a * tvW / 2, b * tvH / 2, 0)));
  const pv = new THREE.Vector3();
  let hot = null;
  const hr = [NaN, NaN, NaN, NaN];
  screen.onBeforeRender = (r, s, cam) => {
    hot ||= document.getElementById('tv-hot');
    if (!hot) return;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < 4; i++) {
      pv.copy(corners[i]).project(cam);
      const x = (pv.x * 0.5 + 0.5) * innerWidth, y = (-pv.y * 0.5 + 0.5) * innerHeight;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    x0 = Math.round(x0); y0 = Math.round(y0);
    const w = Math.max(0, Math.round(x1) - x0), h = Math.max(0, Math.round(y1) - y0);
    if (x0 !== hr[0] || y0 !== hr[1]) { hr[0] = x0; hr[1] = y0; hot.style.transform = `translate(${x0}px, ${y0}px)`; }
    if (w !== hr[2]) { hr[2] = w; hot.style.width = `${w}px`; }
    if (h !== hr[3]) { hr[3] = h; hot.style.height = `${h}px`; }
  };

  /* ---------- per frame ---------- */
  const cue0 = data.film.cues[0];
  const tvArgs = { t: 0, cue: cue0, mode: 'silent', reduced: false, time: 0 };
  tv.draw(tvArgs); // the first draw of a canvas costs several ms (fonts, gradients): pay it while building
  const cTmp = new THREE.Color(), WHITE = new THREE.Color(1, 1, 1);
  let tvAcc = 1, tvKey = '', recAcc = 1, lastSeen = -1, prevT = 0, prevMode = 'silent', house = 1;
  // The TV's redraw rate follows its size on screen: a 768 x 432 canvas re-uploaded 30 times a second
  // is worth it only when the TV is big in the picture (from the lawn it is a few dozen pixels tall)
  const tvAt = new THREE.Vector3(), tvTop = new THREE.Vector3(), tvP = new THREE.Vector3();
  group.updateMatrixWorld(true);
  screen.getWorldPosition(tvAt);
  tvTop.copy(tvAt).y += tvH / 2;
  function tvRate(cam, viewH) {
    if (!cam) return 30;
    tvP.copy(tvAt).project(cam);
    if (tvP.z > 1 || Math.abs(tvP.x) > 1.4 || Math.abs(tvP.y) > 1.4) return 2;   // off screen: keep the room's light alive only
    const y0 = tvP.y;
    tvP.copy(tvTop).project(cam);
    const px = Math.abs(tvP.y - y0) * viewH;                                    // the picture's height, in px
    return px > 90 ? 30 : px > 40 ? 15 : 8;
  }
  // (0 while the theater is out of view: coming back, the silent picture starts again from the title card)
  const tvTime = () => (performance.now() / 1000 - lastSeen > 0.6 ? 0 : tv.silentT);
  // pause the trailer while the theater is out of view
  if (tv.video) setInterval(() => { if (performance.now() - lastSeen * 1000 > 800) tv.wantVideo(false); }, 1000);

  return {
    group, tv, speakers, anchors, via, route, lights, screen,
    // called by app.js as the camera heads for the theater: the trailer, when there is one
    loadMedia() { tv.loadVideo(); },
    // the silent picture's time in Cue 1 (a test hook: "Turn the sound on" starts Cue 1 from the top)
    silentTime: tvTime,
    // s: the frame state from app.js plus dt and time (see world.js frame)
    update(s) {
      const { dt, reduced, playing } = s;
      const now = performance.now() / 1000;
      // coming back into view: the silent picture starts again from the title card
      if (now - lastSeen > 0.6) tv.silentT = 0;
      lastSeen = now;
      tv.wantVideo(!reduced);

      /* which picture: the playing (or paused) cue, or Cue 1 running with the sound off */
      const cur = s.tv.cue;
      const cueOn = s.kind === 'cue' && (playing || (s.t > 0.05 && s.t < cur.duration - 0.08));
      const mode = cueOn ? (playing ? 'playing' : 'paused') : 'silent';
      if (mode === 'silent' && prevMode !== 'silent') tv.silentT = 0;
      prevMode = mode;
      if (mode === 'silent' && !reduced) tv.silentT = (tv.silentT + dt) % cue0.duration;
      tvArgs.cue = cueOn ? cur : cue0;
      tvArgs.t = cueOn ? s.t : (reduced ? 3.4 : tv.silentT);
      tvArgs.mode = mode; tvArgs.reduced = reduced; tvArgs.time = s.time;

      // Full motion: redraw at a rate set by the picture's size on screen. Reduced motion: each shot is a
      // still (tv.js), so redraw only when what the TV shows changes: the shot, the mode, the pointer over
      // it, or the bottom bar's clock ticking over a second. The room's light, made from the picture,
      // holds steady with it.
      let redraw;
      if (reduced) {
        const key = `${mode} ${tvArgs.cue.id} ${tv.shotAt(tvArgs.cue, tvArgs.t)} ${Math.floor(tvArgs.t)} ${tv.hover}`;
        redraw = key !== tvKey; tvKey = key;
      } else {
        tvAcc += dt;
        redraw = tvAcc >= 1 / tvRate(s.camera, s.viewH || 900);
        tvKey = '';
      }
      if (redraw) {
        tvAcc = 0;
        tv.draw(tvArgs);
        // the picture lights the room: colour from the shot, strength from its brightness
        const b = tv.bright;
        cTmp.copy(tv.avg).lerp(WHITE, 0.2);
        tvLight.color.copy(cTmp);
        tvFill.color.copy(cTmp);
        L_TV.i = 2 + 14 * b;
        L_FILL.i = 0.4 + 4 * b;
        biasMat.color.copy(cTmp).multiplyScalar(0.25 + 1.3 * b);
        spillMat.color.copy(cTmp).multiplyScalar(0.03 + 0.3 * b);
        wallSpillMat.color.copy(cTmp).multiplyScalar(0.03 + 0.18 * b);
      }
      // house lights dim while the film's sound is on
      house += ((mode === 'playing' ? 0.3 : 1) - house) * (reduced ? 1 : 1 - Math.exp(-dt * 2.5));
      L_HOUSE.i = 1.6 * house;
      sconceMat.emissiveIntensity = 0.45 + 0.95 * house;
      washMat.opacity = 0.1 + 0.2 * house;
      dl.emissiveIntensity = 0.15 + 0.4 * house;
      coveMat.emissiveIntensity = 0.35 + 0.95 * house;
      stripMat.emissiveIntensity = 0.15 + 0.45 * house;
      coveGlowMat.opacity = 0.05 + 0.15 * house;
      coveWashMat.opacity = 0.08 + 0.14 * house;

      /* speakers: onsets since the last frame, by pitch band */
      const t = s.t, level = playing ? s.level : 0;
      const notes = !playing ? null : s.kind === 'cue' ? cur.notes : s.kind === 'piano' ? s.pianoNotes : null;
      let low = 0, mid = 0, high = 0;
      if (playing && notes) {
        if (t > prevT && t - prevT < 0.5) for (let i = 0; i < notes.length; i++) {
          const nt = notes[i];
          if (nt.t > prevT && nt.t <= t) {
            const v = Math.min(1, 0.6 + level * 0.6);
            if (nt.p < 50) low = Math.max(low, v); else if (nt.p < 66) mid = Math.max(mid, v); else high = Math.max(high, v * 0.8);
          }
        }
      } else if (playing && s.kick) { low = 0.75; mid = 0.7; high = 0.5; } // tracks without notes: a steady pulse
      prevT = t;
      const front = Math.max(mid, low * 0.55, high * 0.6);
      speakers.fl.drive(level, front, dt, reduced);
      speakers.fr.drive(level, front, dt, reduced);
      speakers.c.drive(level * 0.9, Math.max(mid, high * 0.75, low * 0.35), dt, reduced);
      speakers.sub.drive(level * 0.35, low, dt, reduced);
      speakers.sl.drive(level * 0.6, Math.max(mid, high) * 0.6, dt, reduced);
      speakers.sr.drive(level * 0.6, Math.max(mid, high) * 0.6, dt, reduced);
      if (low > 0 && !reduced) { thumpAge = 0; thump.visible = true; }
      if (thump.visible) {
        thumpAge += dt;
        const k = thumpAge / 0.75;
        if (k >= 1) thump.visible = false;
        else { const r = 0.35 + k * 0.9; thump.scale.set(r, r, r); thumpMat.opacity = (1 - k) * (1 - k) * 0.55; }
      }
      // the receiver's meters (held at one steady reading with reduced motion)
      recAcc += dt;
      if (recAcc > 1 / 15) { recAcc = 0; rec.draw(reduced && playing ? 0.6 : level, playing, s.time); }
    },
  };
}

// a soft light that is brightest along one edge (v = 1) and fades across the plane
function edgeTexture() {
  return canvasTexture(64, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, 0, 0, w / 2, 0, h);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  }, { srgb: false });
}

// the receiver's amber display: two level meters
function receiverDisplay() {
  const c = makeCanvas(128, 32), g = c.getContext('2d');
  const texture = tex(c);
  let last = -1;
  const draw = (level, playing, time) => {
    const k = playing ? Math.round(level * 24) : -1;
    if (k === last) return;
    last = k;
    g.fillStyle = '#140b04'; g.fillRect(0, 0, 128, 32);
    g.fillStyle = '#ffb347';
    g.font = `500 9px ${FONT}`;
    g.fillText(playing ? 'PLAY' : 'STANDBY', 4, 12);
    for (let ch = 0; ch < 2; ch++) {
      const n = playing ? Math.round(level * (ch ? 15 : 16) + (ch ? 1 : 0)) : 0;
      for (let i = 0; i < 16; i++) { g.globalAlpha = i < n ? 1 : 0.18; g.fillRect(44 + i * 5, 6 + ch * 11, 3, 7); }
    }
    g.globalAlpha = 1;
    texture.needsUpdate = true;
  };
  draw(0, false, 0);
  return { texture, draw };
}
