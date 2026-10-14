// Studio gear (owner: studio): guitars on stands, a guitar amp, a polysynth on an X stand with a
// metronome, a small drum kit with cymbals that ring on the beat, the eight-track reel-to-reel,
// a condenser mic with shock mount and pop filter, headphones on a swaying cable.
// Every builder returns a Group (front = +z, standing on y = 0) plus whatever animates.
// Static parts are merged per material (Builder); only moving parts are separate meshes.
import * as THREE from 'three';
import { Builder, canvasTexture, makeRand } from './kit.js';
import { FONT } from './screens/shared.js';

const PI = Math.PI;
const cache = new WeakMap();

// studio-only materials, made once per shared material set
export function gearMaterials(M) {
  if (cache.has(M)) return cache.get(M);
  const lacquer = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, ...o });
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.7, ...o });
  const G = {
    cherry: lacquer('#8f1c22'),
    tealLac: lacquer('#2f6f6a'),
    mustardLac: lacquer('#c98a26'),
    spruce: std({ color: '#ffffff', map: spruceTexture(), roughness: 0.42 }),
    mahogany: lacquer('#5a2c17', { roughness: 0.35 }),
    maple: std({ color: '#e0b77a', roughness: 0.45 }),
    rosewood: std({ color: '#3a2216', roughness: 0.6 }),
    tort: std({ color: '#ffffff', map: tortTexture(), roughness: 0.3 }),
    pearl: std({ color: '#f1e9d8', roughness: 0.35 }),
    chrome: std({ color: '#e4e4e2', roughness: 0.18, metalness: 1 }),
    steel: std({ color: '#b9b8b4', roughness: 0.35, metalness: 0.9 }),
    brushed: std({ color: '#cfccc4', roughness: 0.42, metalness: 0.65 }),
    cymbal: std({ color: '#c9a04f', roughness: 0.3, metalness: 0.9 }),
    head: std({ color: '#efe8da', roughness: 0.75 }),
    rubber: std({ color: '#151414', roughness: 0.9 }),
    tolex: std({ color: '#d8c49b', roughness: 0.8 }),
    grille: std({ color: '#ffffff', map: grilleTexture(), roughness: 1 }),
    tape: std({ color: '#4a2a18', roughness: 0.55 }),
    darkPanel: std({ color: '#2a2725', roughness: 0.5 }),
    synthTop: std({ color: '#1f1d1c', roughness: 0.45 }),
    foam: std({ color: '#ffffff', map: foamTexture(), roughness: 1 }),
    foamRust: std({ color: '#c46a45', map: foamTexture(), roughness: 1 }),
    paper: std({ color: '#ffffff', map: lyricTexture(), roughness: 0.9 }),
    cable: std({ color: '#191716', roughness: 0.55 }),
    redCable: std({ color: '#8e2f2f', roughness: 0.55 }),
    glow: (color, i = 1) => new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: i, roughness: 1 }),
  };
  G.foam.userData.worldUV = 0.6;
  G.foamRust.userData.worldUV = 0.6;
  cache.set(M, G);
  return G;
}

/* ---------- textures ---------- */
function spruceTexture() {
  const rnd = makeRand(301);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#e3c08a'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 2 + rnd() * 4) { g.fillStyle = `rgba(170,120,60,${0.08 + rnd() * 0.16})`; g.fillRect(x, 0, 1, h); }
  });
}
function tortTexture() {
  const rnd = makeRand(302);
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#3a1a0c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${150 + rnd() * 60 | 0},${70 + rnd() * 40 | 0},20,${0.25 + rnd() * 0.4})`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 3 + rnd() * 10, 2 + rnd() * 5, rnd() * 3, 0, 7); g.fill(); }
  });
}
function grilleTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#5a2320'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(210,170,120,.35)'; g.lineWidth = 1;
    for (let i = -h; i < w; i += 5) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); }
  }, { repeat: true });
}
function foamTexture() {
  // acoustic wedge foam: soft light and shade in a checkerboard of wedge directions
  return canvasTexture(128, 128, (g, w, h) => {
    const c = 32;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const vert = (i + j) % 2;
      const grd = vert ? g.createLinearGradient(i * c, 0, i * c + c / 2, 0) : g.createLinearGradient(0, j * c, 0, j * c + c / 2);
      grd.addColorStop(0, '#5b524b'); grd.addColorStop(1, '#857a70');
      for (let k = 0; k < 2; k++) {
        g.fillStyle = grd;
        if (vert) g.fillRect(i * c + k * c / 2, j * c, c / 2, c);
        else g.fillRect(i * c, j * c + k * c / 2, c, c / 2);
      }
    }
  }, { repeat: true });
}
function lyricTexture() {
  const rnd = makeRand(303);
  return canvasTexture(128, 160, (g, w, h) => {
    g.fillStyle = '#f6f1e6'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(40,36,34,.55)';
    for (let y = 18; y < h - 10; y += 9) { if (rnd() < 0.18) { y += 6; continue; } g.fillRect(12, y, 30 + rnd() * 80, 2); }
  });
}

/* ---------- helpers ---------- */
function extrude(shape, depth, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 20 });
  g.translate(0, 0, -depth / 2);
  return g;
}
// a box tapering from width w0 (bottom) to w1 (top)
function taper(w0, w1, h, d) {
  const g = new THREE.BoxGeometry(1, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, Math.sign(p.getX(i)) * (p.getY(i) < 0 ? w0 : w1) / 2);
  g.computeVertexNormals();
  return g;
}
const cylZ = (B, mat, r, len, x, y, z, seg = 12, o = {}) => B.cyl(mat, r, r, len, x, y, z, seg, { rx: PI / 2, ...o });
// a straight rod between two points
function rod(B, mat, r, a, b, seg = 8) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
  g.applyQuaternion(q);
  return B.add(g, mat, { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, z: (a[2] + b[2]) / 2 });
}

/* ---------- guitars ---------- */
function solidBody(s = 1) {
  const sh = new THREE.Shape();
  const P = (x, y) => [x * s, (y + 0.235) * s];
  sh.moveTo(...P(0, -0.235));
  sh.bezierCurveTo(...P(0.12, -0.235), ...P(0.176, -0.17), ...P(0.166, -0.09));
  sh.bezierCurveTo(...P(0.158, -0.03), ...P(0.115, -0.01), ...P(0.118, 0.04));
  sh.bezierCurveTo(...P(0.12, 0.09), ...P(0.142, 0.13), ...P(0.122, 0.17));
  sh.bezierCurveTo(...P(0.106, 0.196), ...P(0.08, 0.182), ...P(0.07, 0.15));
  sh.bezierCurveTo(...P(0.06, 0.122), ...P(0.046, 0.105), ...P(0.03, 0.105));
  sh.lineTo(...P(-0.03, 0.105));
  sh.bezierCurveTo(...P(-0.05, 0.105), ...P(-0.068, 0.14), ...P(-0.08, 0.18));
  sh.bezierCurveTo(...P(-0.09, 0.218), ...P(-0.122, 0.228), ...P(-0.134, 0.2));
  sh.bezierCurveTo(...P(-0.152, 0.16), ...P(-0.126, 0.08), ...P(-0.13, 0.03));
  sh.bezierCurveTo(...P(-0.135, -0.02), ...P(-0.182, -0.04), ...P(-0.174, -0.1));
  sh.bezierCurveTo(...P(-0.166, -0.18), ...P(-0.11, -0.235), ...P(0, -0.235));
  return sh;
}
function dreadBody() {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.bezierCurveTo(0.13, 0, 0.2, 0.05, 0.2, 0.16);
  sh.bezierCurveTo(0.2, 0.24, 0.136, 0.26, 0.136, 0.31);
  sh.bezierCurveTo(0.136, 0.36, 0.152, 0.39, 0.15, 0.44);
  sh.bezierCurveTo(0.148, 0.495, 0.09, 0.505, 0.03, 0.505);
  sh.lineTo(-0.03, 0.505);
  sh.bezierCurveTo(-0.09, 0.505, -0.148, 0.495, -0.15, 0.44);
  sh.bezierCurveTo(-0.152, 0.39, -0.136, 0.36, -0.136, 0.31);
  sh.bezierCurveTo(-0.136, 0.26, -0.2, 0.24, -0.2, 0.16);
  sh.bezierCurveTo(-0.2, 0.05, -0.13, 0, 0, 0);
  return sh;
}
const spline = pts => { const s = new THREE.Shape(); s.moveTo(...pts[0]); s.splineThru(pts.slice(1).map(p => new THREE.Vector2(...p))); return s; };

const KINDS = {
  electric: { body: 'cherry', depth: 0.045, scale: 0.648, bridge: 0.115, pocket: 0.33, strings: 6, nutW: 0.043, head: 0.19, yoke: 0.66 },
  bass: { body: 'tealLac', depth: 0.045, scale: 0.864, bridge: 0.1, pocket: 0.37, strings: 4, nutW: 0.042, head: 0.2, yoke: 0.8, s: 1.12 },
  acoustic: { body: 'mahogany', depth: 0.1, scale: 0.645, bridge: 0.14, pocket: 0.505, strings: 6, nutW: 0.044, head: 0.18, yoke: 0.72 },
};

// A guitar leaning on an A-frame stand. Returns the Group (origin on the floor under the stand).
export function guitar(M, kind) {
  const G = gearMaterials(M), K = KINDS[kind];
  const outer = new THREE.Group(), inst = new THREE.Group();
  const B = new Builder();
  const d = K.depth, front = d / 2;
  // body
  if (kind === 'acoustic') {
    const sh = dreadBody();
    B.add(extrude(sh, d), G.mahogany);
    B.add(new THREE.ShapeGeometry(sh, 20), G.pearl, { z: front + 0.0006, sx: 1.012, sy: 1.006, y: -0.0015 });
    B.add(new THREE.ShapeGeometry(sh, 20), G.spruce, { z: front + 0.0012 });
    B.add(new THREE.CircleGeometry(0.05, 28), G.rubber, { y: 0.335, z: front + 0.0018 });
    B.add(new THREE.RingGeometry(0.054, 0.066, 32), G.rosewood, { y: 0.335, z: front + 0.0018 });
    B.add(new THREE.RingGeometry(0.058, 0.061, 32), G.pearl, { y: 0.335, z: front + 0.0022 });
    B.add(new THREE.ShapeGeometry(spline([[0.03, 0.27], [0.1, 0.24], [0.13, 0.29], [0.09, 0.33], [0.055, 0.31]]), 12), G.tort, { z: front + 0.002 });
    B.box(G.rosewood, 0.15, 0.028, 0.008, 0, K.bridge, front + 0.005);
    B.box(G.pearl, 0.075, 0.003, 0.006, 0, K.bridge + 0.006, front + 0.011);
  } else {
    const s = K.s || 1;
    B.add(extrude(solidBody(s), d - 0.016, 0.008), G[K.body]);
    const pg = kind === 'bass'
      ? spline([[-0.12, 0.2], [-0.02, 0.1], [0.1, 0.09], [0.15, 0.17], [0.11, 0.3], [0.05, 0.36], [-0.02, 0.37], [-0.08, 0.42], [-0.12, 0.33]].map(([x, y]) => [x * s, y * s]))
      : spline([[-0.12, 0.215], [-0.03, 0.105], [0.06, 0.085], [0.12, 0.165], [0.09, 0.255], [0.03, 0.325], [-0.025, 0.34], [-0.08, 0.395], [-0.115, 0.335]]);
    B.add(new THREE.ShapeGeometry(pg, 16), kind === 'bass' ? G.tort : G.pearl, { z: front + 0.0015 });
    if (kind === 'bass') {
      B.soft(M.black, 0.05, 0.024, 0.012, -0.02 * s, 0.24 * s, front + 0.007, 0.005);
      B.soft(M.black, 0.05, 0.024, 0.012, 0.025 * s, 0.215 * s, front + 0.007, 0.005);
      B.box(G.chrome, 0.07, 0.05, 0.008, 0, K.bridge, front + 0.005);
      for (const [x, y] of [[0.1, 0.12], [0.12, 0.07]]) cylZ(B, G.chrome, 0.011, 0.016, x * s, y * s, front + 0.009, 12);
    } else {
      for (const [y, r] of [[0.255, 0], [0.205, 0], [0.15, -0.12]]) B.soft(G.pearl, 0.072, 0.018, 0.01, 0, y, front + 0.006, 0.005, { rz: r });
      B.box(G.chrome, 0.075, 0.042, 0.006, 0, K.bridge - 0.005, front + 0.004);
      for (const [x, y] of [[0.075, 0.175], [0.098, 0.135], [0.11, 0.09]]) cylZ(B, G.pearl, 0.011, 0.016, x, y, front + 0.009, 12);
      B.box(M.black, 0.012, 0.03, 0.004, 0.11, 0.06, front + 0.003, { rz: 0.4 }); // switch
    }
  }
  // neck, fretboard, frets
  const nut = K.bridge + K.scale;
  const n0 = K.pocket - 0.04, nLen = nut - n0;
  const neckZ = kind === 'acoustic' ? front - 0.01 : front - 0.002;
  B.add(taper(K.nutW + 0.012, K.nutW, nLen, 0.022), kind === 'acoustic' ? G.mahogany : G.maple, { y: n0 + nLen / 2, z: neckZ });
  const fbTop = neckZ + 0.011 + 0.006;
  B.add(taper(K.nutW + 0.012, K.nutW, nLen, 0.006), G.rosewood, { y: n0 + nLen / 2, z: neckZ + 0.014 });
  for (let n = 1; n <= 22; n++) {
    const y = nut - K.scale * (1 - Math.pow(2, -n / 12));
    if (y < n0 + 0.01) break;
    B.box(G.steel, K.nutW + 0.01 * (1 - (y - n0) / nLen), 0.002, 0.0025, 0, y, fbTop + 0.001);
  }
  B.box(G.pearl, K.nutW, 0.006, 0.006, 0, nut, fbTop + 0.002);
  // strings
  const sw = K.nutW * 0.8, bw = sw * 1.25, sTop = fbTop + 0.004;
  for (let i = 0; i < K.strings; i++) {
    const f = K.strings === 1 ? 0 : i / (K.strings - 1) - 0.5;
    const a = [f * bw, K.bridge, kind === 'acoustic' ? front + 0.012 : front + 0.01], b = [f * sw, nut, sTop];
    rod(B, G.steel, kind === 'bass' ? 0.0011 : 0.0006, a, b, 4);
  }
  // headstock with tuners
  const hs = new THREE.Shape();
  const hw = K.nutW / 2;
  if (kind === 'acoustic') {
    hs.moveTo(-hw, 0); hs.lineTo(hw, 0); hs.lineTo(hw + 0.012, K.head); hs.quadraticCurveTo(0, K.head + 0.012, -hw - 0.012, K.head); hs.lineTo(-hw, 0);
  } else {
    hs.moveTo(-hw, 0); hs.lineTo(hw, 0);
    hs.bezierCurveTo(hw + 0.012, 0.05, hw + 0.03, 0.08, hw + 0.02, K.head * 0.7);
    hs.bezierCurveTo(hw + 0.012, K.head, -hw, K.head + 0.01, -hw - 0.008, K.head * 0.75);
    hs.bezierCurveTo(-hw - 0.016, K.head * 0.5, -hw - 0.006, 0.04, -hw, 0);
  }
  const hz = fbTop - 0.012, tilt = kind === 'acoustic' ? -0.22 : 0;
  const head = new THREE.Group(); head.position.set(0, nut + 0.004, hz); head.rotation.x = tilt;
  const HB = new Builder();
  HB.add(extrude(hs, 0.016, 0.002), kind === 'acoustic' ? G.rosewood : G.maple);
  const pegs = K.strings;
  for (let i = 0; i < pegs; i++) {
    let x, y, side;
    if (kind === 'acoustic') { side = i < 3 ? -1 : 1; x = side * (hw + 0.004); y = 0.04 + (i % 3) * 0.05; }
    else { side = -1; x = -hw - 0.002 + (kind === 'bass' ? 0 : i * 0.0035); y = 0.025 + i * (K.head * 0.7 / pegs); }
    cylZ(HB, G.chrome, 0.0035, 0.018, x * 0.7, y, 0.014, 8);
    HB.box(G.chrome, 0.022, 0.008, 0.008, x + side * 0.018, y, 0, { rz: 0 });
    HB.box(kind === 'acoustic' ? G.pearl : G.chrome, 0.014, 0.016, 0.004, x + side * 0.034, y, 0);
  }
  HB.build(head);
  inst.add(head);
  B.build(inst);
  // lean back on the stand
  const lift = 0.2, lean = -0.27;
  inst.position.set(0, lift, 0.07);
  inst.rotation.x = lean;
  outer.add(inst);
  // the stand: two front legs, a back leg, a padded cradle and a neck yoke on a post
  const S = new Builder();
  const yk = K.yoke, yy = lift + yk * Math.cos(lean), yz = 0.07 + yk * Math.sin(lean) - d / 2 - 0.02;
  rod(S, M.black, 0.009, [-0.17, 0, 0.2], [-0.04, lift + 0.02, 0.0]);
  rod(S, M.black, 0.009, [0.17, 0, 0.2], [0.04, lift + 0.02, 0.0]);
  rod(S, M.black, 0.009, [0, 0, -0.26], [0, lift + 0.02, -0.02]);
  rod(S, M.black, 0.009, [0, lift + 0.02, -0.02], [0, yy - 0.02, yz]);
  S.box(G.rubber, 0.24, 0.025, 0.06, 0, lift - 0.005, 0.085);
  for (const s of [-1, 1]) S.box(G.rubber, 0.02, 0.06, 0.03, s * 0.11, lift + 0.025, 0.11);
  S.box(G.rubber, 0.08, 0.02, 0.03, 0, yy - 0.02, yz);
  for (const s of [-1, 1]) S.box(G.rubber, 0.012, 0.05, 0.03, s * 0.034, yy + 0.003, yz);
  for (const [x, z] of [[-0.17, 0.2], [0.17, 0.2], [0, -0.26]]) S.cyl(G.rubber, 0.014, 0.014, 0.02, x, 0.01, z, 8);
  S.build(outer);
  outer.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return outer;
}

// a small combo amp with a jewel pilot light; returns { group, pilot (material) }
export function amp(M) {
  const G = gearMaterials(M), g = new THREE.Group(), B = new Builder();
  B.soft(G.tolex, 0.5, 0.42, 0.24, 0, 0.23, 0, 0.02);
  B.box(G.grille, 0.44, 0.26, 0.004, 0, 0.2, 0.121);
  B.box(G.darkPanel, 0.46, 0.06, 0.004, 0, 0.385, 0.121);
  for (let i = 0; i < 5; i++) cylZ(B, G.pearl, 0.01, 0.016, -0.17 + i * 0.06, 0.385, 0.128, 10);
  B.box(M.leather, 0.16, 0.022, 0.03, 0, 0.455, 0);
  for (const s of [-1, 1]) B.cyl(G.rubber, 0.02, 0.02, 0.02, s * 0.2, 0.01, 0, 8);
  B.build(g);
  const pilot = G.glow('#ff3b1f', 0.4);
  const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 6), pilot);
  jewel.position.set(0.2, 0.385, 0.126); g.add(jewel);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, pilot };
}

// LEDs as one instanced mesh: positions [[x,y,z]], recoloured per frame with set(i, color)
export function ledBank(points, r = 0.006) {
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), points.length);
  const m = new THREE.Matrix4();
  points.forEach((p, i) => { m.makeTranslation(p[0], p[1], p[2]); mesh.setMatrixAt(i, m); mesh.setColorAt(i, new THREE.Color('#2a1d17')); });
  mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/* ---------- polysynth on an X stand, with a metronome ---------- */
export function synth(M) {
  const G = gearMaterials(M), g = new THREE.Group(), B = new Builder();
  const W = 0.98, D = 0.4, H0 = 0.82; // case width, depth, height of its underside
  // X stand
  for (const s of [-1, 1]) {
    rod(B, M.black, 0.014, [s * 0.36, 0, -0.2], [s * 0.36, H0 - 0.01, 0.16]);
    rod(B, M.black, 0.014, [s * 0.36, 0, 0.16], [s * 0.36, H0 - 0.01, -0.2]);
    B.box(M.black, 0.03, 0.03, 0.42, s * 0.36, H0 - 0.015, -0.02);
    for (const z of [-0.2, 0.16]) B.box(G.rubber, 0.05, 0.02, 0.04, s * 0.36, 0.01, z);
  }
  B.cyl(M.metal, 0.008, 0.008, 0.72, 0, (H0) / 2, -0.02, 8, { rz: PI / 2 });
  // case: walnut cheeks, dark body, sloped panel
  const y0 = H0;
  for (const s of [-1, 1]) {
    const ch = new THREE.Shape(); ch.moveTo(-D / 2, 0); ch.lineTo(D / 2, 0); ch.lineTo(D / 2, 0.07); ch.lineTo(0.02, 0.07); ch.lineTo(-D / 2 + 0.02, 0.16); ch.lineTo(-D / 2, 0.16); ch.lineTo(-D / 2, 0);
    B.add(extrude(ch, 0.035), M.walnut, { x: s * (W / 2 - 0.0175), y: y0, ry: -PI / 2 });
  }
  B.box(G.synthTop, W - 0.07, 0.06, D, 0, y0 + 0.03, 0);
  const pan = new THREE.Group(); pan.position.set(0, y0 + 0.112, -0.09); pan.rotation.x = 0.42;
  const PB = new Builder();
  PB.box(G.synthTop, W - 0.07, 0.012, 0.22, 0, 0, 0);
  const knobCols = ['#efe6d2', '#efe6d2', '#d39b2a', '#efe6d2'];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 15; c++) {
    const x = -0.4 + c * 0.057, z = -0.07 + r * 0.06;
    PB.cyl(c % 5 === 4 ? M.mustard : M.black, 0.011, 0.012, 0.018, x, 0.015, z, 10);
    PB.box(M.ivory, 0.002, 0.003, 0.009, x, 0.025, z - 0.004);
  }
  for (let c = 0; c < 6; c++) PB.box([M.rust, M.teal, M.mustard, M.cream, M.rust, M.teal][c], 0.03, 0.01, 0.016, -0.4 + c * 0.04, 0.008, 0.095);
  PB.box(G.glow('#ffb347', 0.9), 0.12, 0.004, 0.03, 0.31, 0.009, 0.09);
  PB.build(pan);
  g.add(pan);
  // 61 keys
  const KW = 0.0222, nW = 36, kx0 = -W / 2 + 0.035 + 0.11;
  const ky = y0 + 0.062, kz = 0.105;
  for (let i = 0; i < nW; i++) B.box(M.ivory, KW - 0.0012, 0.018, 0.14, kx0 + (i + 0.5) * KW, ky, kz);
  const blackAt = [0, 1, 3, 4, 5];
  for (let o = 0; o < 5; o++) for (const b of blackAt) B.box(G.synthTop, KW * 0.58, 0.016, 0.085, kx0 + (o * 7 + b + 1) * KW, ky + 0.014, kz - 0.028);
  // pitch and mod wheels
  for (const s of [0, 1]) B.cyl(M.black, 0.026, 0.026, 0.014, -W / 2 + 0.07 + s * 0.03, ky + 0.012, kz - 0.01, 16, { rz: PI / 2 });
  B.box(G.synthTop, 0.1, 0.02, 0.14, -W / 2 + 0.085, ky - 0.005, kz);
  // metronome on the left end of the panel
  const mx = -0.36, my = y0 + 0.16, mz = -0.16;
  const tri = new THREE.CylinderGeometry(0.018, 0.05, 0.19, 4); tri.rotateY(PI / 4);
  B.add(tri, M.walnut, { x: mx, y: my + 0.095, z: mz });
  B.box(G.pearl, 0.026, 0.12, 0.002, mx, my + 0.08, mz + 0.032, { rx: -0.17 });
  B.build(g);
  const arm = new THREE.Group(); arm.position.set(mx, my + 0.03, mz + 0.04); arm.userData.dynamic = true;
  const AB = new Builder();
  AB.box(G.steel, 0.004, 0.17, 0.003, 0, 0.085, 0);
  AB.box(G.brass || M.brass, 0.018, 0.016, 0.01, 0, 0.12, 0.002);
  AB.build(arm);
  g.add(arm);
  // arpeggiator step LEDs along the panel
  const leds = ledBank(Array.from({ length: 8 }, (_, i) => [-0.12 + i * 0.03, 0, 0]), 0.0045);
  leds.position.set(0, 0.012, 0.09); pan.add(leds);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, arm, leds };
}

/* ---------- drum kit (front = +z, the drummer sits at -z) ---------- */
function cymbalGeo(R) {
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14, r = Math.max(0.0005, t * R);
    const bell = t < 0.2 ? 0.024 * (1 - t / 0.2) ** 0.6 : 0;
    pts.push(new THREE.Vector2(r, bell + 0.012 * (1 - t) ** 1.5));
  }
  for (let i = 14; i >= 0; i--) { const t = i / 14; pts.push(new THREE.Vector2(Math.max(0.0005, t * R), pts[i].y - 0.002)); }
  return new THREE.LatheGeometry(pts, 40);
}
export function drumKit(M) {
  const G = gearMaterials(M), g = new THREE.Group(), B = new Builder();
  const drum = (r, depth, x, y, z, rx = 0, ry = 0, shellMat = G.mustardLac) => {
    // shell along local y, then tilted; heads + hoops at both ends
    const o = { x, y, z, rx, ry };
    B.add(new THREE.CylinderGeometry(r, r, depth, 32, 1, true), shellMat, o);
    const geoH = new THREE.CylinderGeometry(r * 0.995, r * 0.995, 0.004, 32);
    for (const s of [-1, 1]) {
      const hh = geoH.clone().translate(0, s * depth / 2, 0);
      B.add(hh, G.head, o);
      const hoop = new THREE.TorusGeometry(r + 0.004, 0.006, 6, 32); hoop.rotateX(PI / 2); hoop.translate(0, s * (depth / 2 - 0.004), 0);
      B.add(hoop, G.chrome, o);
    }
    // tension lugs
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; const lug = new THREE.BoxGeometry(0.012, depth * 0.36, 0.014); lug.translate(Math.cos(a) * (r + 0.007), 0, Math.sin(a) * (r + 0.007)); B.add(lug, G.chrome, o); }
  };
  // kick: axis along z, resting on its hoops at the floor
  const kr = 0.24, kd = 0.36;
  drum(kr, kd, 0, kr + 0.01, 0, PI / 2);
  for (const s of [-1, 1]) rod(B, G.chrome, 0.007, [s * 0.18, kr - 0.06, 0.08], [s * 0.3, 0.005, 0.2]);
  // front resonant head: a separate mesh that pumps on the beat, with a plum emblem
  const headTex = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#efe6d2'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#7d2b45'; c.beginPath(); c.arc(128, 128, 78, 0, 7); c.fill();
    c.fillStyle = '#d39b2a'; c.beginPath(); c.arc(128, 128, 54, 0, 7); c.fill();
    c.fillStyle = '#efe6d2'; c.beginPath(); c.arc(128, 128, 30, 0, 7); c.fill();
  });
  const kickHead = new THREE.Mesh(new THREE.CircleGeometry(kr * 0.99, 40), new THREE.MeshStandardMaterial({ map: headTex, roughness: 0.75 }));
  kickHead.position.set(0, kr + 0.01, kd / 2 + 0.003); kickHead.userData.dynamic = true; g.add(kickHead);
  // rack tom on the kick, floor tom, snare on a stand
  // (right-handed: hi-hat and snare on the drummer's left, +x; floor tom and ride on the right)
  drum(0.15, 0.17, 0.05, kr * 2 + 0.17, -0.06, -0.35);
  rod(B, G.chrome, 0.008, [0, kr * 2 + 0.01, -0.02], [0.04, kr * 2 + 0.1, -0.05]);
  drum(0.2, 0.32, -0.42, 0.36, -0.32, 0, 0);
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.4; rod(B, G.chrome, 0.007, [-0.42 + Math.cos(a) * 0.21, 0.4, -0.32 + Math.sin(a) * 0.21], [-0.42 + Math.cos(a) * 0.3, 0, -0.32 + Math.sin(a) * 0.3]); }
  drum(0.17, 0.13, 0.32, 0.64, -0.42, 0.08, 0, G.chrome);
  for (let i = 0; i < 3; i++) { const a = i * 2.1; rod(B, G.chrome, 0.007, [0.32, 0.57, -0.42], [0.32 + Math.cos(a) * 0.22, 0, -0.42 + Math.sin(a) * 0.22]); }
  // sticks resting on the snare
  rod(B, M.teak, 0.006, [0.42, 0.715, -0.5], [0.2, 0.712, -0.33]);
  rod(B, M.teak, 0.006, [0.4, 0.718, -0.32], [0.22, 0.716, -0.52]);
  // throne
  B.cyl(M.leather, 0.17, 0.17, 0.08, 0, 0.56, -0.78, 20);
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.5; rod(B, G.chrome, 0.009, [0, 0.52, -0.78], [Math.cos(a) * 0.24, 0, -0.78 + Math.sin(a) * 0.24]); }
  // cymbal stands
  const cym = [];
  const stand = (x, z, h, R, tiltX, tiltZ, boom) => {
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.3; rod(B, G.chrome, 0.007, [x, 0.3, z], [x + Math.cos(a) * 0.24, 0, z + Math.sin(a) * 0.24]); }
    const top = boom ? [x + boom[0], h, z + boom[1]] : [x, h, z];
    rod(B, G.chrome, 0.008, [x, 0, z], [x, boom ? h - 0.15 : h, z]);
    if (boom) rod(B, G.chrome, 0.006, [x, h - 0.15, z], top);
    const piv = new THREE.Group(); piv.position.set(...top); piv.rotation.set(tiltX, 0, tiltZ);
    const m = new THREE.Mesh(cymbalGeo(R), G.cymbal); m.castShadow = true;
    const wob = new THREE.Group(); wob.userData.dynamic = true; wob.add(m); piv.add(wob); g.add(piv);
    cym.push({ wob, amp: 0, ph: 0, w: 10 + R * 18 });
    return piv;
  };
  stand(0.56, -0.28, 0.93, 0.18, 0.05, -0.08);              // hi-hat (top cymbal moves)
  const hatBottom = new THREE.Mesh(cymbalGeo(0.18), G.cymbal); hatBottom.position.set(0.56, 0.905, -0.28); hatBottom.rotation.x = PI; g.add(hatBottom);
  stand(0.42, 0.18, 1.18, 0.21, 0.25, -0.18, [-0.06, -0.08]); // crash
  stand(-0.62, 0.0, 1.06, 0.27, 0.2, 0.22, [0.08, -0.12]);   // ride
  B.build(g);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  let hit = 0;
  return {
    group: g,
    // beat: integer beat counter, kick: a new beat, level: loudness 0..1
    update(dt, kick, beat, level, playing, reduced) {
      if (kick && playing && !reduced) {
        hit++;
        cym[0].amp = Math.max(cym[0].amp, 0.05 + level * 0.06);                 // hats every beat
        if (beat % 8 === 0) cym[1].amp = 0.12 + level * 0.1;                   // crash on the bar line
        else if (beat % 2) cym[2].amp = Math.max(cym[2].amp, 0.04 + level * 0.05); // ride on the off beats
        kickHead.userData.k = beat % 2 === 0 ? 1 : 0.4;
      }
      for (const c of cym) {
        if (c.amp < 0.0005) { if (c.amp) { c.amp = 0; c.wob.rotation.set(0, 0, 0); } continue; }
        c.ph += dt * c.w; c.amp *= Math.exp(-dt * 2.6);
        c.wob.rotation.x = c.amp * Math.sin(c.ph);
        c.wob.rotation.z = c.amp * 0.6 * Math.cos(c.ph * 1.31);
      }
      const k = kickHead.userData.k || 0;
      if (k > 0.001) { kickHead.userData.k = k * Math.exp(-dt * 14); kickHead.position.z = kd / 2 + 0.003 + k * 0.012; kickHead.scale.setScalar(1 + k * 0.012); }
      return hit;
    },
  };
}

/* ---------- the eight-track: a reel-to-reel on a roll-around console ---------- */
function vuTexture() {
  return canvasTexture(128, 96, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#ffe3a6'); grd.addColorStop(1, '#f2c070');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2a1d17'; g.lineWidth = 2;
    g.beginPath(); g.arc(64, 96, 70, PI * 1.22, PI * 1.6); g.stroke();
    g.strokeStyle = '#b8321e'; g.lineWidth = 4;
    g.beginPath(); g.arc(64, 96, 70, PI * 1.6, PI * 1.78); g.stroke();
    g.strokeStyle = '#2a1d17'; g.lineWidth = 2;
    for (let i = 0; i <= 10; i++) { const a = PI * (1.22 + i * 0.056); g.beginPath(); g.moveTo(64 + Math.cos(a) * 64, 96 + Math.sin(a) * 64); g.lineTo(64 + Math.cos(a) * (i % 5 ? 70 : 76), 96 + Math.sin(a) * (i % 5 ? 70 : 76)); g.stroke(); }
    g.fillStyle = '#2a1d17'; g.font = `600 18px ${FONT}`; g.textAlign = 'center'; g.fillText('VU', 64, 80);
  });
}
export function tapeMachine(M) {
  const G = gearMaterials(M), g = new THREE.Group(), B = new Builder();
  const W = 0.6, D = 0.52, H = 0.64, base = 0.09;
  // casters, cabinet, kick plate
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { B.cyl(G.rubber, 0.035, 0.035, 0.03, sx * (W / 2 - 0.07), 0.035, sz * (D / 2 - 0.07), 12, { rz: PI / 2 }); B.cyl(G.chrome, 0.01, 0.01, 0.05, sx * (W / 2 - 0.07), 0.075, sz * (D / 2 - 0.07), 6); }
  B.box(M.walnut, W, H, D, 0, base + H / 2, 0);
  B.box(M.black, W - 0.04, 0.04, 0.004, 0, base + 0.03, D / 2 + 0.001);
  // front: channel cards (8 x 2 knobs + a record button each) and the VU row
  const fz = D / 2 + 0.002;
  B.box(G.darkPanel, W - 0.06, 0.34, 0.006, 0, base + H - 0.2, fz);
  for (let i = 0; i < 8; i++) {
    const x = -W / 2 + 0.07 + i * ((W - 0.14) / 7);
    for (const k of [0, 1]) cylZ(B, G.pearl, 0.009, 0.014, x, base + H - 0.26 - k * 0.05, fz + 0.008, 10);
    B.box(i === 2 ? M.rust : M.black, 0.022, 0.012, 0.01, x, base + H - 0.35, fz + 0.006);
  }
  // transport deck, sloped up toward the back
  // the deck is hinged at the cabinet's front top edge and slopes up toward the back
  const dw = W - 0.02, dd = 0.62, slope = 0.5;
  const deck = new THREE.Group(); deck.position.set(0, base + H, D / 2 - 0.01); deck.rotation.x = slope;
  const wedge = new THREE.Shape(); wedge.moveTo(0, 0); wedge.lineTo(-dd * Math.cos(slope), 0); wedge.lineTo(-dd * Math.cos(slope), dd * Math.sin(slope)); wedge.lineTo(0, 0);
  for (const s of [-1, 1]) B.add(extrude(wedge, 0.025), M.walnut, { x: s * (W / 2 - 0.0125), y: base + H, z: D / 2 - 0.01, ry: -PI / 2 });
  B.box(M.walnut, W, 0.02, 0.025, 0, base + H + dd * Math.sin(slope) - 0.01, D / 2 - 0.01 - dd * Math.cos(slope) + 0.0125);
  const DB = new Builder();
  DB.box(G.brushed, dw, 0.02, dd, 0, 0.01, -dd / 2);
  DB.box(G.darkPanel, 0.22, 0.04, 0.09, 0, 0.03, -0.12);          // head block cover
  for (let i = 0; i < 3; i++) DB.box(G.chrome, 0.018, 0.026, 0.02, -0.05 + i * 0.05, 0.04, -0.165);
  for (const s of [-1, 1]) { DB.cyl(G.chrome, 0.014, 0.014, 0.05, s * 0.13, 0.04, -0.15, 14); DB.cyl(G.chrome, 0.011, 0.011, 0.05, s * 0.23, 0.04, -0.25, 12); }
  DB.cyl(G.rubber, 0.022, 0.022, 0.04, 0.17, 0.035, -0.11, 16);      // pinch roller
  // tape path: supply reel down around the guides, across the heads, up to the take-up reel
  const ty = 0.05;
  for (const [a, b] of [[[-0.23, -0.25], [-0.13, -0.15]], [[-0.13, -0.15], [0.13, -0.15]], [[0.13, -0.15], [0.23, -0.25]], [[-0.23, -0.25], [-0.21, -0.38]], [[0.23, -0.25], [0.21, -0.38]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    DB.box(G.tape, len, 0.012, 0.0015, (a[0] + b[0]) / 2, ty, (a[1] + b[1]) / 2, { ry: -Math.atan2(b[1] - a[1], b[0] - a[0]) });
  }
  // transport buttons, record in red
  for (let i = 0; i < 5; i++) DB.box(i === 4 ? M.rust : M.black, 0.036, 0.016, 0.026, -0.13 + i * 0.054, 0.026, -0.035);
  DB.build(deck);
  g.add(deck);
  // reels (NAB metal flanges, a pack of brown tape that moves from left to right with progress)
  // a metal NAB reel: solid back flange, open front flange (rim, hub and three spokes) so the
  // brown tape pack shows and the turning is easy to see
  const flange = new THREE.MeshStandardMaterial({ color: '#cfcdc6', roughness: 0.28, metalness: 0.85 });
  const backGeo = new THREE.CylinderGeometry(0.126, 0.126, 0.003, 40);
  const rimGeo = new THREE.RingGeometry(0.108, 0.126, 40); rimGeo.rotateX(-PI / 2);
  const reels = [];
  for (const s of [-1, 1]) {
    const hub = new THREE.Group(); hub.position.set(s * 0.145, 0.035, -0.43); deck.add(hub);
    const spin = new THREE.Group(); spin.userData.dynamic = true; hub.add(spin);
    const RB = new Builder();
    RB.add(backGeo, G.darkPanel, { y: 0 });
    RB.add(rimGeo, flange, { y: 0.0295 });
    for (let k = 0; k < 3; k++) { const a = k * 2.094; RB.box(flange, 0.075, 0.003, 0.016, Math.cos(a) * 0.07, 0.029, Math.sin(a) * 0.07, { ry: -a }); }
    RB.cyl(flange, 0.036, 0.036, 0.004, 0, 0.029, 0, 20);
    RB.cyl(G.darkPanel, 0.022, 0.022, 0.036, 0, 0.016, 0, 16);
    RB.box(G.chrome, 0.044, 0.038, 0.008, 0, 0.017, 0);
    RB.build(spin);
    const pack = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.024, 40), G.tape);
    pack.position.y = 0.014; spin.add(pack);
    reels.push({ spin, pack, s });
  }
  // the record-arm lamp and a power lamp
  const recMat = G.glow('#ff2a12', 0.2);
  const rec = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 6), recMat);
  rec.position.set(0.22, 0.03, -0.04); deck.add(rec);
  // VU meters across the top of the front panel
  const vuMat = new THREE.MeshStandardMaterial({ map: vuTexture(), emissive: '#ffcf7a', emissiveMap: null, emissiveIntensity: 0.35, roughness: 0.5 });
  const needles = [];
  const ngeo = new THREE.BoxGeometry(0.0016, 0.03, 0.001); ngeo.translate(0, 0.015, 0);
  for (let i = 0; i < 8; i++) {
    const x = -W / 2 + 0.07 + i * ((W - 0.14) / 7);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.058, 0.044), vuMat);
    face.position.set(x, base + H - 0.1, fz + 0.004); g.add(face);
    B.box(M.black, 0.063, 0.05, 0.004, x, base + H - 0.1, fz + 0.001);
    const n = new THREE.Mesh(ngeo, M.black);
    n.position.set(x, base + H - 0.12, fz + 0.006); n.userData.dynamic = true; g.add(n);
    needles.push({ n, v: 0 });
  }
  B.build(g);
  g.traverse(o => { if (o.isMesh && o.material !== vuMat) o.castShadow = true; });
  let pos = 0, speed = 0;
  return {
    group: g, deck,
    anchor: new THREE.Vector3(0, base + H + 0.32, -0.1),
    // progress 0..1 through the track; playing; level; t (s) for the needles' jitter
    update(dt, { playing, progress, level, time, reduced }) {
      const p = Math.min(1, Math.max(0, progress || 0));
      const rL = 0.055 + 0.064 * Math.sqrt(1 - p), rR = 0.055 + 0.064 * Math.sqrt(p);
      reels[0].pack.scale.set(rL, 1, rL); reels[1].pack.scale.set(rR, 1, rR);
      // the transport spins up and coasts down; constant tape speed, so the smaller pack turns faster
      speed += ((playing && !reduced ? 1 : 0) - speed) * (1 - Math.exp(-dt * (playing ? 6 : 2.5)));
      if (speed > 0.002) { pos += dt * 0.38 * speed; reels[0].spin.rotation.y = -pos / rL; reels[1].spin.rotation.y = -pos / rR; }
      // record lamp: lit while rolling, a slow blink while armed and idle
      recMat.emissiveIntensity = playing ? 2.2 : (reduced ? 0.6 : (Math.sin(time * 3.1) > 0.2 ? 1.6 : 0.12));
      // VU needles with meter ballistics
      needles.forEach((o, i) => {
        const target = playing ? Math.min(1.1, level * (0.75 + 0.35 * Math.abs(Math.sin(time * (4.1 + i * 0.83) + i * 1.7)))) : 0;
        o.v += (target - o.v) * (1 - Math.exp(-dt / 0.09));
        o.n.rotation.z = 0.75 - (reduced ? (playing ? level : 0) : o.v) * 1.35;
      });
      vuMat.emissiveIntensity = playing ? 0.6 : 0.3;
    },
  };
}

/* ---------- vocal mic, pop filter, boom stand, headphones on a swaying cable ---------- */
function grilleMeshTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#9d9a92'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,38,36,.6)'; g.lineWidth = 1;
    for (let i = 0; i < w; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
  }, { repeat: true });
}
// stand at the origin; the singer stands at +z. Returns { group, cable (Group that sways), anchor }
export function vocalMic(M) {
  const G = gearMaterials(M), g = new THREE.Group(), B = new Builder();
  // tripod, pole, boom
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; rod(B, M.black, 0.009, [0, 0.32, 0], [Math.cos(a) * 0.3, 0.01, Math.sin(a) * 0.3]); }
  rod(B, M.black, 0.012, [0, 0, 0], [0, 1.32, 0]);
  B.cyl(G.chrome, 0.018, 0.018, 0.04, 0, 1.33, 0, 10);
  const tip = [0, 1.56, 0.42];
  rod(B, M.black, 0.009, [0, 1.25, -0.22], tip);
  B.cyl(M.black, 0.03, 0.03, 0.12, 0, 1.2, -0.27, 10, { rx: 0.5 }); // counterweight
  // shock mount + mic, hanging just below the boom tip
  const mx = tip[0], my = tip[1] - 0.12, mz = tip[2];
  for (const y of [0.05, -0.05]) { const ring = new THREE.TorusGeometry(0.045, 0.004, 6, 24); ring.rotateX(PI / 2); B.add(ring, M.black, { x: mx, y: my + y, z: mz }); }
  rod(B, M.black, 0.006, [mx, my + 0.06, mz], tip);
  B.cyl(G.pearl, 0.027, 0.024, 0.13, mx, my - 0.02, mz, 18);
  B.cyl(G.chrome, 0.028, 0.028, 0.008, mx, my + 0.048, mz, 18);
  const capsule = new THREE.Mesh(new THREE.SphereGeometry(0.03, 18, 12), new THREE.MeshStandardMaterial({ color: '#ffffff', map: grilleMeshTexture(), roughness: 0.4, metalness: 0.6 }));
  capsule.scale.set(1, 1.35, 1); capsule.position.set(mx, my + 0.085, mz); g.add(capsule);
  // pop filter on a gooseneck, in front of the mic
  const pf = [mx, my + 0.07, mz + 0.16];
  rod(B, M.black, 0.004, [0, 1.3, 0.02], [0, 1.42, 0.2]);
  rod(B, M.black, 0.004, [0, 1.42, 0.2], [pf[0], pf[1] - 0.08, pf[2] - 0.01]);
  const hoop = new THREE.TorusGeometry(0.075, 0.004, 6, 32);
  B.add(hoop, M.black, { x: pf[0], y: pf[1], z: pf[2] });
  const popTex = canvasTexture(64, 64, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(20,20,20,.9)'; c.lineWidth = 1;
    for (let i = 0; i <= w; i += 3) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); }
  }, { repeat: true });
  popTex.repeat.set(3, 3);
  const popMat = new THREE.MeshStandardMaterial({ color: '#2a2a2a', map: popTex, transparent: true, opacity: 0.85, roughness: 1, side: THREE.DoubleSide, depthWrite: false });
  const pop = new THREE.Mesh(new THREE.CircleGeometry(0.073, 28), popMat);
  pop.position.set(...pf); g.add(pop);
  // headphones on a hook on the pole, with the cable hanging in a gentle loop
  const hk = [0.02, 1.08, 0.015];
  rod(B, G.chrome, 0.004, [0, hk[1], 0.0], [hk[0], hk[1], hk[2] + 0.05]);
  const band = new THREE.TorusGeometry(0.085, 0.008, 6, 20, PI);
  B.add(band, M.black, { x: hk[0], y: hk[1] - 0.09, z: hk[2] + 0.06, ry: PI / 2 });
  for (const s of [-1, 1]) B.cyl(M.leather, 0.042, 0.042, 0.032, hk[0], hk[1] - 0.09, hk[2] + 0.06 + s * 0.085, 18, { rx: PI / 2 });
  B.build(g);
  const cable = new THREE.Group(); cable.position.set(hk[0], hk[1] - 0.12, hk[2] + 0.145); cable.userData.dynamic = true;
  const curve = new THREE.CatmullRomCurve3([[0, 0, 0], [0.01, -0.25, 0.02], [0.03, -0.55, 0.0], [0.0, -0.72, -0.06], [-0.05, -0.62, -0.14], [-0.04, -0.3, -0.12], [-0.02, 0.0, -0.13]].map(p => new THREE.Vector3(...p)));
  const cm = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.0035, 5), M.black);
  cable.add(cm); g.add(cable);
  g.traverse(o => { if (o.isMesh && o.material !== popMat) o.castShadow = true; });
  return { group: g, cable, anchor: new THREE.Vector3(mx, my + 0.16, mz) };
}

// a music stand with a lyric sheet; front = +z (the singer reads from -z... it faces the singer at +z)
export function musicStand(M) {
  const G = gearMaterials(M), g = new THREE.Group(), B = new Builder();
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.2; rod(B, M.black, 0.006, [0, 0.25, 0], [Math.cos(a) * 0.22, 0.005, Math.sin(a) * 0.22]); }
  rod(B, M.black, 0.008, [0, 0, 0], [0, 1.08, 0]);
  B.box(M.black, 0.46, 0.3, 0.006, 0, 1.18, 0.02, { rx: -0.32 });
  B.box(M.black, 0.46, 0.03, 0.03, 0, 1.04, 0.07, { rx: -0.32 });
  B.box(G.paper, 0.2, 0.27, 0.002, -0.1, 1.2, 0.029, { rx: -0.32 });
  B.box(G.paper, 0.2, 0.27, 0.002, 0.11, 1.2, 0.03, { rx: -0.32, rz: -0.03 });
  B.build(g);
  return g;
}

/* ---------- plants: a fiddle-leaf fig and a snake plant in a planter on legs ---------- */
function leafShape(L, W) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(W * 0.5, L * 0.08, W * 0.42, L * 0.45, W * 0.5, L * 0.7);
  s.bezierCurveTo(W * 0.56, L * 0.95, W * 0.1, L * 1.02, 0, L);
  s.bezierCurveTo(-W * 0.1, L * 1.02, -W * 0.56, L * 0.95, -W * 0.5, L * 0.7);
  s.bezierCurveTo(-W * 0.42, L * 0.45, -W * 0.5, L * 0.08, 0, 0);
  return s;
}
export function fiddleFig(M, h = 1.7, seed = 11) {
  const G = gearMaterials(M), g = new THREE.Group(), B = new Builder();
  const rnd = makeRand(seed);
  const leaf = G.leaf || (G.leaf = new THREE.MeshStandardMaterial({ color: '#3d6a33', roughness: 0.55, side: THREE.DoubleSide }));
  const leafD = G.leafDark || (G.leafDark = new THREE.MeshStandardMaterial({ color: '#2c5428', roughness: 0.6, side: THREE.DoubleSide }));
  // pot: a tapered cream planter on a walnut ring
  B.cyl(M.cream, 0.2, 0.15, 0.36, 0, 0.18, 0, 20);
  B.cyl(M.walnut, 0.16, 0.16, 0.03, 0, 0.015, 0, 20);
  B.cyl(G.tape, 0.18, 0.18, 0.02, 0, 0.34, 0, 20);
  const trunk = [[0, 0.34, 0], [0.03, 0.8, 0.02], [-0.02, 1.2, -0.02], [0.02, h * 0.9, 0.01]];
  for (let i = 0; i < trunk.length - 1; i++) rod(B, M.trunk, 0.022 - i * 0.004, trunk[i], trunk[i + 1], 6);
  const geo = new THREE.ShapeGeometry(leafShape(0.3, 0.22), 6);
  for (let i = 0; i < 26; i++) {
    const t = i / 26, y = 0.75 + t * (h - 0.8), a = i * 2.4 + rnd() * 0.5, r = 0.05 + (1 - Math.abs(t - 0.55)) * 0.12;
    const sc = 0.7 + rnd() * 0.5;
    B.add(geo, i % 3 ? leaf : leafD, { x: Math.cos(a) * r, y, z: Math.sin(a) * r, ry: -a + PI / 2, rx: -0.5 - rnd() * 0.7, sx: sc, sy: sc, sz: sc });
  }
  B.build(g);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function snakePlant(M, seed = 12) {
  const G = gearMaterials(M), g = new THREE.Group(), B = new Builder();
  const rnd = makeRand(seed);
  const tex = canvasTexture(32, 128, (c, w, h) => {
    c.fillStyle = '#2f5a2c'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 7) { c.fillStyle = `rgba(150,190,120,${0.25 + rnd() * 0.2})`; c.fillRect(0, y, w, 2); }
    c.fillStyle = '#c9c46a'; c.fillRect(0, 0, 3, h); c.fillRect(w - 3, 0, 3, h);
  });
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, side: THREE.DoubleSide });
  // planter on three tapered legs
  B.cyl(M.mustard, 0.15, 0.13, 0.26, 0, 0.42, 0, 20);
  for (let i = 0; i < 3; i++) { const a = i * 2.094; rod(B, M.walnut, 0.012, [Math.cos(a) * 0.12, 0.32, Math.sin(a) * 0.12], [Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17], 6); }
  const blade = new THREE.Shape(); blade.moveTo(-0.035, 0); blade.quadraticCurveTo(-0.05, 0.4, 0, 0.75); blade.quadraticCurveTo(0.05, 0.4, 0.035, 0);
  const bgeo = new THREE.ShapeGeometry(blade, 6);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.3 + rnd(), r = 0.03 + rnd() * 0.06, s = 0.65 + rnd() * 0.5;
    B.add(bgeo, mat, { x: Math.cos(a) * r, y: 0.52, z: Math.sin(a) * r, ry: a, rx: (rnd() - 0.5) * 0.35, rz: (rnd() - 0.5) * 0.3, sx: 1, sy: s, sz: 1 });
  }
  B.build(g);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
