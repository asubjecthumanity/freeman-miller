// Shared building kit: seeded random, canvas textures, materials, the portal
// (wall-iris) shader patch, and a Builder that merges static geometry per material.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Seeded random numbers (mulberry32). `rand` is one stream shared by every module, so call order
// matters: a room that adds rand() calls while it is built shifts the values of every room built
// after it. Give new randomness its own stream instead: const rnd = makeRand(1234).
export const makeRand = seed => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const rand = makeRand(20261013);

export function canvasTexture(w, h, paint, { repeat = false, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/* ---------- Portals: capsule-shaped holes that open in walls and floors as the camera passes ---------- */
export const MAX_PORTALS = 4;
export const portalUniforms = {
  uPA: { value: Array.from({ length: MAX_PORTALS }, () => new THREE.Vector4(0, -99, 0, 0)) },
  uPB: { value: Array.from({ length: MAX_PORTALS }, () => new THREE.Vector4(0, -99, 0, 0)) },
  uRim: { value: new THREE.Color('#3a2a1f') },
};

export function portalize(mat) {
  mat.side = THREE.DoubleSide;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uPA = portalUniforms.uPA;
    sh.uniforms.uPB = portalUniforms.uPB;
    sh.uniforms.uRim = portalUniforms.uRim;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvPWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vPWorld;
uniform vec4 uPA[${MAX_PORTALS}];
uniform vec4 uPB[${MAX_PORTALS}];
uniform vec3 uRim;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
float pd = 1e5;
for (int i = 0; i < ${MAX_PORTALS}; i++) {
  float r = uPA[i].w;
  if (r <= 0.0) continue;
  vec3 a = uPA[i].xyz; vec3 ab = uPB[i].xyz - a;
  float h = clamp(dot(vPWorld - a, ab) / max(dot(ab, ab), 1e-5), 0.0, 1.0);
  pd = min(pd, length(vPWorld - a - ab * h) - r);
}
if (pd < 0.0) discard;`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
if (pd < 0.05 || !gl_FrontFacing) gl_FragColor.rgb = uRim;`);
  };
  mat.customProgramCacheKey = () => 'portal-v1';
  return mat;
}

/* ---------- Materials ---------- */
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
export function makeMaterials(tex) {
  const M = {
    // exterior
    stucco: portalize(std({ color: '#c8a77a', map: tex.stucco })),
    fascia: std({ color: '#c09a68', map: tex.stucco }),
    soffit: std({ color: '#e6d3b3' }),
    roof: std({ color: '#8d8074', roughness: 1 }),
    brick: portalize(std({ color: '#ffffff', map: tex.brick, roughness: 0.95 })),
    darkWall: portalize(std({ color: '#3d3129' })),
    deckWood: std({ color: '#7b3423', roughness: 0.8 }),
    deckBoards: std({ color: '#8a5a3c', map: tex.boards }),
    frame: std({ color: '#2c2a28', roughness: 0.5, metalness: 0.3 }),
    frameLight: std({ color: '#efe9dd', roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: '#2b3f4c', roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.32, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide }),
    glassInner: new THREE.MeshStandardMaterial({ color: '#cfe4ee', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.08, depthWrite: false }),
    concrete: std({ color: '#a39a8e' }),
    path: std({ color: '#9b4b36', map: tex.pavers, roughness: 0.95 }),
    trunk: std({ color: '#6b5d50', roughness: 1 }),
    ac: std({ color: '#b9bcbc', roughness: 0.6, metalness: 0.3 }),
    // interior shell
    paint: portalize(std({ color: '#efe7da' })),
    paintWarm: portalize(std({ color: '#e7d6bd' })),
    theaterWall: portalize(std({ color: '#4a2c2c' })),
    theaterCeil: portalize(std({ color: '#2a1d1d' })),
    carpet: std({ color: '#3a2a2e', map: tex.carpet }),
    floorWood: portalize(std({ color: '#ffffff', map: tex.floor, roughness: 0.55 })),
    floorDark: portalize(std({ color: '#ffffff', map: tex.floorDark, roughness: 0.6 })),
    ceilWood: portalize(std({ color: '#ffffff', map: tex.slats, roughness: 0.8 })),
    ceilWhite: portalize(std({ color: '#f1ece3' })),
    joist: std({ color: '#a7774b' }),
    // furniture
    walnut: std({ color: '#ffffff', map: tex.walnut, roughness: 0.5 }),
    teak: std({ color: '#b26d3e', roughness: 0.55 }),
    black: std({ color: '#1c1a19', roughness: 0.55 }),
    blackGloss: std({ color: '#0d0c0c', roughness: 0.12, envMapIntensity: 1.4 }),
    metal: std({ color: '#c9c6c0', roughness: 0.3, metalness: 0.8 }),
    brass: std({ color: '#c9a04f', roughness: 0.35, metalness: 0.8 }),
    ivory: std({ color: '#f4efe4', roughness: 0.35 }),
    mustard: std({ color: '#d39b2a' }),
    teal: std({ color: '#2f6f6a' }),
    olive: std({ color: '#7a7a36' }),
    rust: std({ color: '#a6512e' }),
    navy: std({ color: '#25344f' }),
    cream: std({ color: '#ede3cf' }),
    leather: std({ color: '#2b211c', roughness: 0.45 }),
    plant: std({ color: '#4f7f3a', flatShading: true }),
    pot: std({ color: '#d9cfc0' }),
    screenOff: std({ color: '#0b0c0e', roughness: 0.2 }),
    speaker: std({ color: '#1d1b1a', roughness: 0.7 }),
    cone: std({ color: '#2f2c2a', roughness: 0.9 }),
    fabric: std({ color: '#3a3438', roughness: 1 }),
    silhouette: new THREE.MeshBasicMaterial({ color: '#16110e' }),
  };
  for (const k of ['stucco', 'fascia', 'brick', 'roof', 'darkWall', 'paint', 'paintWarm', 'theaterWall', 'theaterCeil', 'floorWood', 'floorDark', 'ceilWood', 'ceilWhite', 'soffit', 'concrete']) {
    M[k].userData.worldUV = { stucco: 2.2, fascia: 2.2, brick: 1.6, roof: 3, darkWall: 3, paint: 3, paintWarm: 3, theaterWall: 3, theaterCeil: 3, floorWood: 3, floorDark: 3, ceilWood: 2.4, ceilWhite: 3, soffit: 3, concrete: 3 }[k];
  }
  M.carpet.userData.worldUV = 2;
  M.deckBoards.userData.worldUV = 2;
  M.path.userData.worldUV = 2;
  M.walnut.userData.worldUV = 1.2;
  M.glass.userData.noShadow = true;
  M.glassInner.userData.noShadow = true;
  return M;
}

/* ---------- Builder: collect transformed geometry per material, merge at the end ---------- */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

export class Builder {
  constructor() { this.buckets = new Map(); }
  add(geo, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(_m);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.clearGroups();
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat).push(g);
    return g;
  }
  // box centred at x,y,z
  box(mat, w, h, d, x, y, z, o = {}) { return this.add(new THREE.BoxGeometry(w, h, d), mat, { x, y, z, ...o }); }
  // soft box for cushions and upholstery
  soft(mat, w, h, d, x, y, z, r = 0.05, o = {}) { return this.add(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), mat, { x, y, z, ...o }); }
  // box from min corner to max corner
  aabb(mat, x0, y0, z0, x1, y1, z1, o = {}) { return this.box(mat, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, o); }
  cyl(mat, rt, rb, h, x, y, z, seg = 16, o = {}) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, { x, y, z, ...o }); }
  // a single-sided rectangle; n = facing direction 'px','nx','py','ny','pz','nz'
  rect(mat, n, a0, a1, b0, b1, c) {
    const w = a1 - a0, h = b1 - b0, ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
    const g = new THREE.PlaneGeometry(w, h);
    // plane lies in XY facing +z; map (a,b) per orientation
    switch (n) {
      case 'pz': return this.add(g, mat, { x: ca, y: cb, z: c });
      case 'nz': return this.add(g, mat, { x: ca, y: cb, z: c, ry: Math.PI });
      case 'px': return this.add(g, mat, { x: c, y: cb, z: ca, ry: Math.PI / 2 }); // a along z (sign flips handled by worldUV)
      case 'nx': return this.add(g, mat, { x: c, y: cb, z: ca, ry: -Math.PI / 2 });
      case 'py': return this.add(g, mat, { x: ca, y: c, z: cb, rx: -Math.PI / 2 });
      case 'ny': return this.add(g, mat, { x: ca, y: c, z: cb, rx: Math.PI / 2 });
    }
  }
  build(parent, { cast = true, receive = true } = {}) {
    const meshes = [];
    for (const [mat, list] of this.buckets) {
      const geo = mergeFlat(list);
      const ws = mat.userData.worldUV;
      if (ws) worldUV(geo, ws);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = cast && !mat.userData.noShadow;
      mesh.receiveShadow = receive;
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.buckets.clear();
    return meshes;
  }
}

// concatenate non-indexed geometries that share position/normal/uv (what Builder.add produces)
function mergeFlat(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const [k, size] of [['position', 3], ['normal', 3], ['uv', 2]]) {
    const arr = new Float32Array(n * size);
    let o = 0;
    for (const g of list) { const a = g.attributes[k]; if (a) arr.set(a.array, o); o += g.attributes.position.count * size; }
    out.setAttribute(k, new THREE.BufferAttribute(arr, size));
  }
  return out;
}

// box-projected UVs from world position, so tiling textures keep a real-world scale
function worldUV(geo, scale) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / scale; uv[i * 2 + 1] = v / scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

/* ---------- Walls with openings ---------- */
// A wall runs along `axis` ('x' = along x at fixed z = at; 'z' = along z at fixed x = at) from `from` to `to`,
// between heights y0..y1. `face` is the direction the visible side looks ('pz','nz','px','nx').
// openings: [{a, b, y0, y1}] in wall coordinates. Pieces are cut by horizontal bands so any
// arrangement of rectangular openings works.
export function wallFace(B, mat, { axis, at, from, to, y0, y1, face, openings = [] }) {
  const ys = new Set([y0, y1]);
  for (const o of openings) { if (o.y0 > y0 && o.y0 < y1) ys.add(o.y0); if (o.y1 > y0 && o.y1 < y1) ys.add(o.y1); }
  const bands = [...ys].sort((a, b) => a - b);
  for (let i = 0; i < bands.length - 1; i++) {
    const ya = bands[i], yb = bands[i + 1];
    const cuts = openings.filter(o => o.y0 <= ya + 1e-6 && o.y1 >= yb - 1e-6)
      .map(o => [Math.max(from, o.a), Math.min(to, o.b)]).filter(c => c[1] > c[0]).sort((p, q) => p[0] - q[0]);
    let s = from;
    for (const [a, b] of cuts) { if (a > s) B.rect(mat, face, s, a, ya, yb, at); s = Math.max(s, b); }
    if (s < to) B.rect(mat, face, s, to, ya, yb, at);
  }
}

// frame + optional glass for an opening in a wall of thickness t whose outer face is at `at`
// and whose inside lies toward `inward` (+1/-1 along the wall normal axis)
export function opening(B, { axis, at, t = 0.2, inward = -1, a, b, y0, y1, frameMat, glassMat, mullions = 1, transoms = 0, fw = 0.06, glassFace }) {
  const mid = at + inward * t / 2;
  const put = (a0, a1, b0, b1, depth) => {
    if (axis === 'x') B.aabb(frameMat, a0, b0, mid - depth / 2, a1, b1, mid + depth / 2);
    else B.aabb(frameMat, mid - depth / 2, b0, a0, mid + depth / 2, b1, a1);
  };
  put(a, b, y0, y0 + fw, t); put(a, b, y1 - fw, y1, t);
  put(a, a + fw, y0, y1, t); put(b - fw, b, y0, y1, t);
  for (let i = 1; i < mullions; i++) { const m = a + (b - a) * i / mullions; put(m - fw / 2, m + fw / 2, y0, y1, 0.1); }
  for (let i = 1; i <= transoms; i++) { const m = y0 + (y1 - y0) * i / (transoms + 1); put(a, b, m - fw / 2, m + fw / 2, 0.1); }
  if (glassMat) B.rect(glassMat, glassFace, a, b, y0, y1, mid);
}
