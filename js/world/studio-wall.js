// The wall section the camera passes through on the turn from the living room into the studio
// (owner: studio). The shared portal (kit.js) cuts the two painted faces of the partition; this
// module draws what is inside the wall and cuts it with its own, later hole, so the layers part
// one after another: the paint and plasterboard first (with a white gypsum edge instead of the
// shared dark rim), then the stud bay (studs, pink insulation, plates, blocking, a cable to a
// junction box, a copper pipe) as the camera comes close, then the studio.
import * as THREE from 'three';
import { Builder, canvasTexture, makeRand, portalUniforms } from './kit.js';
import * as Shell from './shell.js';
import { PORTALS } from '../path.js';
import { F1, C1, PART_Z } from './layout.js';

// The partition's paint as the shell draws it (shell.js: partLow / partHigh below and above the
// living room's band line, partStudio on the studio side). Read from the shell when it exports them.
const PART = { low: '#e6dccb', high: '#7d6b5b', split: F1 + 2.05, studio: '#e7d6bd', ...(Shell.PARTITION || {}) };

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const HALF = 0.06;            // the partition's faces sit at PART_Z +- HALF (shell.js)
const BOARD = 0.0125;         // plasterboard thickness
const RIM = 0.065;            // the overlay covers the shared rim band (0.05) with a little to spare

// Patch a material so it is cut by a capsule (a, b, radius) of our own.
//   mode 'cut':  discard inside; back faces (the inside of a cut solid) take `cut` colour
//   mode 'ring': keep only a thin band just outside the hole (hides the shared dark rim); the
//                colour switches from `cut` to `above` over the height `split` (the two-tone wall)
//   uR: the radius uniform ({ value }) that cuts this material
function cutMaterial(mat, U, uR, mode, cut = '#ffffff', above = cut, split = 99) {
  mat.side = mode === 'ring' ? THREE.FrontSide : THREE.DoubleSide;
  const uCut = { value: new THREE.Color(cut) }, uAbove = { value: new THREE.Color(above) }, uSplit = { value: split };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uCA: U.a, uCB: U.b, uCR: uR, uCut, uAbove, uSplit });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCW;\nuniform vec3 uCA;\nuniform vec3 uCB;\nuniform float uCR;\nuniform vec3 uCut;\nuniform vec3 uAbove;\nuniform float uSplit;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
vec3 cab = uCB - uCA;
float ch = clamp(dot(vCW - uCA, cab) / max(dot(cab, cab), 1e-5), 0.0, 1.0);
float cd = length(vCW - uCA - cab * ch) - uCR;
${mode === 'ring' ? `if (uCR <= 0.0 || cd < 0.0 || cd > ${RIM.toFixed(3)}) discard;` : 'if (cd < 0.0) discard;'}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
${mode === 'ring' ? 'diffuseColor.rgb = vCW.y < uSplit ? uCut : uAbove;' : 'if (!gl_FrontFacing) diffuseColor.rgb = uCut;'}`);
  };
  mat.customProgramCacheKey = () => `studio-cut-${mode}`;
  return mat;
}

// canvas textures for the inside of the wall
function studTexture() {
  const rnd = makeRand(71);
  return canvasTexture(64, 512, (g, w, h) => {
    g.fillStyle = '#d6ac74'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(${rnd() > 0.5 ? '150,98,52' : '236,200,150'},${0.18 + rnd() * 0.25})`;
      g.lineWidth = 1 + rnd() * 2.5;
      const x = rnd() * w;
      g.beginPath(); g.moveTo(x, 0);
      for (let y = 0; y <= h; y += 32) g.lineTo(x + Math.sin(y * 0.02 + i) * 3, y);
      g.stroke();
    }
    // a knot and a carpenter's pencil line
    g.fillStyle = 'rgba(120,72,34,.75)'; g.beginPath(); g.ellipse(w * 0.6, h * 0.62, 6, 11, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(60,50,45,.55)'; g.fillRect(4, h * 0.3, w - 8, 2);
  }, { repeat: true });
}
function battTexture() {
  const rnd = makeRand(72);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#e9a493'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = rnd() * w, y = rnd() * h, l = 6 + rnd() * 22;
      g.strokeStyle = rnd() > 0.5 ? `rgba(250,206,190,${0.35 + rnd() * 0.4})` : `rgba(196,116,100,${0.25 + rnd() * 0.35})`;
      g.lineWidth = 0.8 + rnd() * 1.4;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y + (rnd() - 0.5) * 8, x + l, y + (rnd() - 0.5) * 4); g.stroke();
    }
    // soft quilting, like a batt pressed between studs
    for (let y = 0; y < h; y += 64) { const grd = g.createLinearGradient(0, y, 0, y + 64); grd.addColorStop(0, 'rgba(150,80,70,.0)'); grd.addColorStop(0.5, 'rgba(150,80,70,.12)'); grd.addColorStop(1, 'rgba(150,80,70,0)'); g.fillStyle = grd; g.fillRect(0, y, w, 64); }
  }, { repeat: true });
}
function boardTexture() {
  const rnd = makeRand(73);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#b9b0a0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '90,80,70'},${rnd() * 0.08})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    g.fillStyle = 'rgba(70,64,58,.45)';
    for (let y = 24; y < h; y += 50) for (const x of [10, w - 10]) { g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); } // screw heads along the studs
  }, { repeat: true });
}

// M: shared materials (for the paint colours); room: the studio's room data (its moveIn portal).
export function buildWallSection(M, room) {
  const P = room.moveIn.portals[0];
  const idx = PORTALS.indexOf(P);
  const group = new THREE.Group(); group.name = 'studio-wall';
  const U = {
    a: { value: new THREE.Vector3(...P.a) }, b: { value: new THREE.Vector3(...P.b) },
    rOut: { value: 0 }, rIn: { value: -1 },
  };
  const hx = P.a[0], hy = P.a[1];
  const zL = PART_Z - HALF, zS = PART_Z + HALF;             // living face, studio face
  const c0 = zL + BOARD, c1 = zS - BOARD;                     // the cavity between the boards
  const X0 = hx - 1.35, X1 = hx + 1.35;                      // a little wider than the hole

  const wood = new THREE.MeshStandardMaterial({ color: '#ffffff', map: studTexture(), roughness: 0.8 });
  wood.userData.worldUV = 0.9;
  const batt = new THREE.MeshStandardMaterial({ color: '#ffffff', map: battTexture(), roughness: 1 });
  batt.userData.worldUV = 0.55;
  const board = new THREE.MeshStandardMaterial({ color: '#ffffff', map: boardTexture(), roughness: 0.95 });
  board.userData.worldUV = 0.6;
  const cable = new THREE.MeshStandardMaterial({ color: '#e2bf3c', roughness: 0.5 });
  const box = new THREE.MeshStandardMaterial({ color: '#2f5fa8', roughness: 0.45 });
  const copper = new THREE.MeshStandardMaterial({ color: '#c47a45', roughness: 0.3, metalness: 0.8 });
  cutMaterial(wood, U, U.rIn, 'cut', '#e2bd85');      // end grain
  cutMaterial(batt, U, U.rIn, 'cut', '#d9877a');      // the cut face of the batt
  cutMaterial(cable, U, U.rIn, 'cut', '#8a6a2a');
  cutMaterial(box, U, U.rIn, 'cut', '#1d3d70');
  cutMaterial(copper, U, U.rIn, 'cut', '#7a4a2a');
  // plasterboard is cut by the shared (outer) radius, with a white gypsum edge
  cutMaterial(board, U, U.rOut, 'cut', '#f4f1ea');

  const B = new Builder();
  // plasterboards, just inside each painted face
  B.aabb(board, X0, F1, zL + 0.0004, X1, C1, c0);
  B.aabb(board, X0, F1, c1, X1, C1, zS - 0.0004);
  // studs every 0.4 m (a bay sits on the passage), bottom plate, double top plate, staggered blocking
  const studs = [];
  for (let x = hx - 0.2 - 0.4 * 3; x <= X1 + 0.01; x += 0.4) studs.push(x);
  const SW = 0.045;
  for (const x of studs) B.aabb(wood, x - SW / 2, F1 + 0.045, c0, x + SW / 2, C1 - 0.09, c1);
  B.aabb(wood, X0, F1, c0, X1, F1 + 0.045, c1);
  B.aabb(wood, X0, C1 - 0.09, c0, X1, C1, c1);
  for (let i = 0; i < studs.length - 1; i++) {
    const y = F1 + 1.32 + (i % 2 ? 0.05 : 0);
    B.aabb(wood, studs[i] + SW / 2, y, c0, studs[i + 1] - SW / 2, y + 0.045, c1);
  }
  // insulation batts filling each bay, a little proud and soft
  for (let i = 0; i < studs.length - 1; i++) {
    const xa = studs[i] + SW / 2 + 0.002, xb = studs[i + 1] - SW / 2 - 0.002;
    const yb = F1 + 1.32 + (i % 2 ? 0.05 : 0);
    B.aabb(batt, xa, F1 + 0.05, c0 + 0.006, xb, yb - 0.004, c1 - 0.004);
    B.aabb(batt, xa, yb + 0.05, c0 + 0.006, xb, C1 - 0.094, c1 - 0.004);
  }
  // a cable run through the studs, dropping to a junction box; a copper pipe in the next bay
  const cy = hy + 0.38, cz = (c0 + c1) / 2 - 0.012;
  B.add(new THREE.CylinderGeometry(0.0075, 0.0075, X1 - X0, 8), cable, { x: (X0 + X1) / 2, y: cy, z: cz, rz: Math.PI / 2 });
  const jx = studs[3] - SW / 2 - 0.045;
  B.add(new THREE.CylinderGeometry(0.0075, 0.0075, cy - (hy - 0.2), 8), cable, { x: jx + 0.02, y: (cy + hy - 0.2) / 2, z: cz });
  B.aabb(box, jx - 0.035, hy - 0.32, c0 + 0.002, jx + 0.045, hy - 0.2, c0 + 0.065);
  const px = studs[2] + 0.12;
  B.add(new THREE.CylinderGeometry(0.0095, 0.0095, C1 - F1, 10), copper, { x: px, y: (F1 + C1) / 2, z: cz + 0.01 });
  B.build(group, { cast: false, receive: false });

  // overlays that hide the shared dark rim: the same paint, a hair in front of each face
  const paintL = cutMaterial(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), U, U.rOut, 'ring', PART.low, PART.high, PART.split);
  const paintS = cutMaterial(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), U, U.rOut, 'ring', PART.studio);
  const ringGeo = new THREE.PlaneGeometry(X1 - X0, C1 - F1);
  const ringL = new THREE.Mesh(ringGeo, paintL);
  ringL.position.set(hx, (F1 + C1) / 2, zL - 0.0006); ringL.rotation.y = Math.PI;
  const ringS = new THREE.Mesh(ringGeo, paintS);
  ringS.position.set(hx, (F1 + C1) / 2, zS + 0.0006);
  for (const r of [ringL, ringS]) { r.receiveShadow = true; group.add(r); }

  let frames = 0;
  return {
    group,
    // cam: the view camera (null until the studio has rendered once)
    update(cam) {
      const r = idx >= 0 ? portalUniforms.uPA.value[idx].w : 0;
      U.rOut.value = r;
      // drawn only while the wall is open, and for the first frames so the world's warm-up compiles it
      group.visible = r > 0 || ++frames < 12;
      if (!group.visible) return;
      // the stud bay parts as the camera comes within about a metre of the wall
      const d = cam ? Math.abs(cam.position.z - PART_Z) : 9;
      U.rIn.value = Math.min(r - 0.06, P.r * smooth(1.2, 0.5, d));
    },
  };
}
