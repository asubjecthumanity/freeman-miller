// The setting from the reference photo: a bright lawn sloping down to the viewer, a brick-red path
// climbing to the right, spring-green deciduous trees (a tall leaning trunk on the right), ivy on
// the right-hand bank, shrubs against the house, a blue sky with soft clouds. Owner: exterior.
//
// Foliage is cheap: every canopy, shrub and ivy patch is made of small alpha-tested leaf-cluster
// cards merged into a few meshes, with soft sunlight baked into vertex colours (unlit material,
// no per-light cost). Trunks are tapered tubes merged into one mesh.
import * as THREE from 'three';
import { Builder, rand, makeRand } from './kit.js';
import { ground, LV, DECK, SECTION } from './layout.js';
import { skyMaterial } from './textures.js';
import { sectionize, sectionProgress } from './shell.js';

// shared rand() calls the textures and the exterior used to make before the theater was built; the
// exterior now draws from its own stream and burns this many so the later rooms' layouts stay put
const SHARED_RAND_CALLS_BEFORE_THEATER = 218632;

const SUN = new THREE.Vector3(-0.47, 0.69, 0.56).normalize(); // the outside preset's sun (rooms/outside.js)
const SPRING = ['#b9d75a', '#a6cc4e', '#c8de6e', '#94bf45', '#b2d35c', '#d2e27c'];
const DEEP = ['#76a83c', '#86b244', '#6a9a36', '#93ba4a'];
const SHRUB = ['#4c7a2c', '#5a8a33', '#45702a', '#638f36'];
const SHRUB_BRIGHT = ['#7fae3c', '#8fbb45', '#719f36'];
const IVY = ['#3f6427', '#4d7330', '#5d8435', '#7c9a3b', '#97ad45'];

// how much of the right-hand bank is ivy at x,z (0..1): the slope beyond the cantilever, toward the camera
function ivyAt(x, z) {
  return THREE.MathUtils.smoothstep(x, 10.0, 12.6) * (1 - THREE.MathUtils.smoothstep(z, 19, 25)) * (1 - THREE.MathUtils.smoothstep(x, 32, 38));
}

export function buildExterior(M, T, data) {
  const rnd = makeRand(9001);
  const mobile = !!data?.mobile;
  const group = new THREE.Group();
  group.name = 'exterior';
  const c = new THREE.Color();

  /* ---------- lawn ---------- */
  const lawnGeo = new THREE.PlaneGeometry(160, 120, 160, 120);
  lawnGeo.rotateX(-Math.PI / 2);
  lawnGeo.translate(0, 0, 10);
  const pos = lawnGeo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const uv = new Float32Array(pos.count * 2);
  const lawnA = new THREE.Color('#86c32a'), lawnB = new THREE.Color('#72ae24'), lawnDeep = new THREE.Color('#58921f'), ivyC = new THREE.Color('#4a6d2b'), dry = new THREE.Color('#a7b64a');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, ground(x, z));
    const n = 0.5 + 0.5 * Math.sin(x * 0.31 + z * 0.17) * Math.cos(z * 0.23 - x * 0.07);
    const big = 0.5 + 0.5 * Math.sin(x * 0.083 + 1.1) * Math.sin(z * 0.11 - 0.6);
    c.copy(lawnA).lerp(lawnB, n * 0.6 + rnd() * 0.18).lerp(lawnDeep, big * big * 0.32);
    if (z > 14) c.lerp(lawnB, Math.min(0.5, (z - 14) / 30));
    if (z > 24) c.lerp(lawnDeep, Math.min(0.4, (z - 24) / 24));
    // soft mowing stripes across the front lawn
    if (z > 5 && x < 10) c.multiplyScalar(((Math.floor((x * 0.9 - z * 0.3 + 100) / 2.6) % 2) ? 1.07 : 0.93));
    // the ivy bank on the right, and a drier band where it meets the lawn
    const bank = ivyAt(x, z);
    c.lerp(dry, Math.max(0, bank * (1 - bank)) * 1.2);
    c.lerp(ivyC, bank * 0.9);
    if (z < -6.6) c.lerp(lawnB, 0.5);
    col.set([c.r, c.g, c.b], i * 3);
    uv[i * 2] = x / 1.6; uv[i * 2 + 1] = z / 1.6;
  }
  lawnGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  lawnGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  lawnGeo.computeVertexNormals();
  const lawn = new THREE.Mesh(lawnGeo, new THREE.MeshStandardMaterial({ vertexColors: true, map: T.grass, roughness: 1 }));
  lawn.receiveShadow = true;
  lawn.name = 'lawn';
  group.add(lawn);
  // the height of the lawn as drawn: its 1 m grid triangles (PlaneGeometry's diagonal runs from
  // (x0, z0 + 1) to (x0 + 1, z0)), which is not ground() between grid points (ground() has kinks and
  // a step at z = 7 that the grid bridges with a chord). Things laid on the lawn follow this.
  const lawnY = (x, z) => {
    const gx = THREE.MathUtils.clamp(x + 80, 0, 159.999), gz = THREE.MathUtils.clamp(z + 50, 0, 119.999);
    const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
    const h = (i, k) => pos.getY((iz + k) * 161 + ix + i);
    return fx + fz <= 1
      ? h(0, 0) + (h(1, 0) - h(0, 0)) * fx + (h(0, 1) - h(0, 0)) * fz
      : h(1, 1) + (h(0, 1) - h(1, 1)) * (1 - fx) + (h(1, 0) - h(1, 1)) * (1 - fz);
  };

  /* ---------- brick-red path from under the cantilever, climbing to the right ---------- */
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(6.2, 0, 1.9), new THREE.Vector3(8.6, 0, 4.2), new THREE.Vector3(12.2, 0, 6.4),
    new THREE.Vector3(17, 0, 7.4), new THREE.Vector3(23, 0, 6.2), new THREE.Vector3(32, 0, 2.5),
  ]);
  // the path lies on the lawn as drawn (lawnY), with vertices about 0.3 m apart each way, so no lawn
  // triangle can rise through it between them
  const N = 110, pw = 1.55, AC = 12;
  const pp = [], pu = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = curve.getPointAt(t), tg = curve.getTangentAt(t);
    const nx = -tg.z, nz = tg.x, L = Math.hypot(nx, nz);
    const w = pw * (1 + 0.25 * (1 - t));
    for (let j = 0; j <= AC; j++) {
      const s = j / AC * 2 - 1;
      const x = p.x + s * w * nx / L, z = p.z + s * w * nz / L;
      pp.push(x, lawnY(x, z) + 0.06, z);
      pu.push(s * 0.5 + 0.5, t * curve.getLength() / 2);
    }
    if (i < N) for (let j = 0; j < AC; j++) { const k = i * (AC + 1) + j, k2 = k + AC + 1; idx.push(k, k + 1, k2, k + 1, k2 + 1, k2); }
  }
  const pathGeo = new THREE.BufferGeometry();
  pathGeo.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
  pathGeo.setAttribute('uv', new THREE.Float32BufferAttribute(pu, 2));
  pathGeo.setIndex(idx);
  pathGeo.computeVertexNormals();
  const path = new THREE.Mesh(pathGeo, new THREE.MeshStandardMaterial({ color: '#b56d55', map: T.pavers, roughness: 0.95 }));
  path.receiveShadow = true;
  path.name = 'path';
  group.add(path);

  /* ---------- mulch beds along the house ---------- */
  const bed = (x0, x1, z0, z1, color, lift) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 14, 4); g.rotateX(-Math.PI / 2);
    const pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i) + (x0 + x1) / 2, z = pa.getZ(i) + (z0 + z1) / 2; pa.setXYZ(i, x, ground(x, z) + lift, z); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, map: T.grass, roughness: 1 }));
    m.receiveShadow = true; group.add(m);
  };
  bed(-11.3, -1.6, 4.0, 5.5, '#5b4232', 0.03);
  bed(-11.6, -10.5, -0.6, 4.0, '#5b4232', 0.03);
  bed(-1.6, 4.7, 2.65, 4.5, '#5b4232', 0.03);

  /* ---------- trees, shrubs and ivy ---------- */
  const trunks = new Builder();
  const barkMat = new THREE.MeshStandardMaterial({ color: '#ddd2c4', map: T.bark, roughness: 1 });
  const leaves = new Cards(), shrubs = new Cards(), ivy = new Cards();
  const q = mobile ? 0.55 : 1; // fewer cards on phones
  const tree = (o) => addTree(trunks, barkMat, leaves, rnd, { ...o, cards: Math.round(o.cards * q) });

  // left of the house, behind and beside the deck
  tree({ x: -21.5, z: -9, h: 6.6, lean: [-0.03, -0.02], r: [4.8, 3.2, 4.2], pal: SPRING, cards: 300, clumps: 24 });
  tree({ x: -26, z: -12, h: 11, lean: [0.02, 0], r: [5.4, 4.6, 5.0], pal: DEEP, cards: 235, clumps: 22 });
  tree({ x: -13.5, z: -14.5, h: 9.5, lean: [0.03, 0], r: [4.6, 4.0, 4.4], pal: SPRING, cards: 223, clumps: 20 });
  tree({ x: -34, z: 1.5, h: 9.5, lean: [-0.05, 0.02], r: [4.6, 3.8, 4.2], pal: SPRING, cards: 223, clumps: 18 });
  // behind the house
  tree({ x: -5, z: -16, h: 13.5, lean: [0.03, 0], r: [6.0, 4.6, 5.0], pal: SPRING, cards: 322, clumps: 26 });
  tree({ x: 5.5, z: -14.5, h: 12.5, lean: [-0.02, 0], r: [5.4, 4.4, 4.8], pal: DEEP, cards: 260, clumps: 22 });
  tree({ x: 15.5, z: -10.5, h: 13, lean: [0, 0], r: [5.2, 4.6, 5.0], pal: SPRING, cards: 248, clumps: 22 });
  // the right: the tall leaning trunk with a sparse, sunlit crown, and its neighbour leaning the other way.
  // It stands at the edge of the ivy on the near side of the path (its base 1 m clear of the paving) and
  // leans back over it; moved toward both lawn cameras from (12.6, 7.4), so it keeps its place in the picture.
  tree({ x: 10.9, z: 9.2, h: 19.5, lean: [-0.3, -0.22], r: [4.6, 3.0, 4.0], pal: SPRING, cards: 186, clumps: 16, trunkR: 0.42, bare: 0.72, bend: 1.1 });
  tree({ x: 17.2, z: 4.6, h: 17, lean: [0.12, -0.12], r: [4.0, 3.0, 3.6], pal: SPRING, cards: 186, clumps: 16, trunkR: 0.34, bare: 0.64, bend: -0.7 });
  tree({ x: 23.5, z: -2.5, h: 14, lean: [0.03, 0], r: [5.4, 4.6, 5.2], pal: DEEP, cards: 260, clumps: 22 });
  tree({ x: 28, z: 10, h: 12, lean: [-0.04, 0], r: [5.4, 4.4, 5.0], pal: SPRING, cards: 235, clumps: 20 });
  tree({ x: 20.5, z: 15.5, h: 11, lean: [0, 0], r: [4.8, 4.0, 4.6], pal: DEEP, cards: 198, clumps: 18 });
  // down the front lawn, well behind every lawn camera: what the studio sees through its front glass
  tree({ x: -17, z: 56, h: 15, lean: [0.03, 0], r: [6.0, 5.0, 5.6], pal: SPRING, cards: 220, clumps: 18 });
  tree({ x: -4, z: 60, h: 16, lean: [0, 0], r: [6.6, 5.4, 6.0], pal: DEEP, cards: 240, clumps: 20 });
  tree({ x: 9, z: 54, h: 14.5, lean: [-0.04, 0], r: [5.8, 4.8, 5.4], pal: SPRING, cards: 210, clumps: 18 });
  tree({ x: 21, z: 49, h: 14, lean: [0, 0], r: [5.6, 4.6, 5.2], pal: DEEP, cards: 200, clumps: 18 });
  tree({ x: -31, z: 60, h: 14, lean: [0, 0], r: [6.0, 4.8, 5.6], pal: DEEP, cards: 200, clumps: 16 });
  // far tree line all round (bigger, fewer cards)
  for (let i = 0; i < 26; i++) {
    const a = -Math.PI * 0.95 + (i / 25) * Math.PI * 0.9 + (rnd() - 0.5) * 0.08;
    const d = 46 + rnd() * 16;
    const x = Math.cos(a) * d * 1.25, z = Math.sin(a) * d * 0.9 - 6;
    const h = 9 + rnd() * 8, r = 5.5 + rnd() * 3;
    tree({ x, z, h, lean: [0, 0], r: [r, r * 0.8, r], pal: rnd() > 0.45 ? DEEP : SPRING, cards: 68, clumps: 10, size: 4.2, trunkR: 0.4 });
  }

  // shrubs against the house (cut away with the facade on the way in)
  const shrub = (x, z, rx, ry, rz, cards, pal = SHRUB) => crown(shrubs, rnd, {
    c: [x, ground(x, z) + ry * 0.92, z], r: [rx, ry, rz], clumps: Math.max(4, Math.round(cards / 26)), cards: Math.round(cards * q), size: 1.05, pal,
  });
  shrub(-8.4, 5.55, 1.75, 1.55, 1.25, 300);             // the big dark one at the corner
  shrub(-12.0, 2.2, 1.25, 1.15, 1.2, 190, SHRUB_BRIGHT); // the brighter one by the left end
  shrub(-12.4, 4.9, 0.9, 0.8, 0.9, 110, SHRUB_BRIGHT);
  shrub(-15.1, -0.2, 1.0, 0.95, 1.0, 130, SHRUB_BRIGHT);
  shrub(-4.6, 4.9, 0.8, 0.6, 0.6, 80);
  shrub(-1.2, 4.9, 1.1, 0.95, 0.85, 130);
  shrub(11.3, 3.6, 1.2, 1.0, 1.1, 130);

  // ivy over the right-hand bank
  const ivyN = Math.round(7000 * q);
  const pathPts = curve.getSpacedPoints(60);
  const nearPath = (x, z) => pathPts.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < 2.9);
  for (let i = 0; i < ivyN; i++) {
    const x = 9.8 + Math.pow(rnd(), 0.9) * 26, z = -6 + rnd() * 31;
    if (rnd() > ivyAt(x, z) || nearPath(x, z)) continue;
    const y = ground(x, z) + 0.06 + rnd() * 0.12;
    const n = new THREE.Vector3((rnd() - 0.5) * 0.9, 1, (rnd() - 0.5) * 0.9 + 0.3).normalize();
    const base = c.set(IVY[(rnd() * IVY.length) | 0]);
    const lit = 0.55 + 0.55 * Math.max(0, n.dot(SUN));
    ivy.card(x, y, z, n, 0.6 + rnd() * 0.45, rnd() * 6.3, base, () => lit * (0.85 + rnd() * 0.3));
  }

  // grass tufts and a scatter of dandelions and daisies over the front lawn (denser near the lawn view)
  const tufts = new Cards();
  const tuftN = Math.round(6400 * q);
  // dense where the two lawn views look (landscape and portrait stop cameras, rooms/outside.js), sparse elsewhere
  const spots = [[-23, 18, -0.15, 1.45], [-39, 36, -0.25, 1.1]];
  const lawnLit = new THREE.Color(), tip = new THREE.Color('#bfe063');
  for (let i = 0; i < tuftN; i++) {
    // half of them close to the stop-0 camera, the rest over the front lawn
    let x, z;
    const m = i % 10;
    if (m < 7) { const [cx, cz, a0, aw] = spots[m < 4 ? 0 : 1], a = a0 - rnd() * aw, d = 2.5 + Math.pow(rnd(), 1.6) * 26; x = cx - Math.sin(a) * d; z = cz - Math.cos(a) * d; }
    else { x = -46 + rnd() * 58; z = 5.5 + rnd() * 40; }
    if (z < 5.2 || ivyAt(x, z) > 0.3 || nearPath(x, z)) continue;
    const y = ground(x, z);
    const flower = rnd() < 0.035;
    const h = flower ? 0.22 + rnd() * 0.1 : 0.12 + rnd() * 0.12, w = h * (flower ? 1 : 1.6);
    lawnLit.copy(lawnA).lerp(lawnB, rnd()).multiplyScalar(1.55);
    const yaw = rnd() * Math.PI;
    for (let k = 0; k < 2; k++) {
      const a = yaw + k * Math.PI / 2;
      tufts.upright(x, y, z, a, w, h, flower ? [0.5, 1] : [0, 0.5], lawnLit.clone().multiplyScalar(0.7), flower ? new THREE.Color(1.35, 1.35, 1.3) : tip.clone().lerp(lawnLit, 0.65));
    }
  }

  const leafMat = new THREE.MeshBasicMaterial({ map: T.leaf, vertexColors: true, alphaTest: 0.42, side: THREE.DoubleSide, alphaToCoverage: true });
  const shrubMat = sectionize(new THREE.MeshBasicMaterial({ map: T.leaf, vertexColors: true, alphaTest: 0.42, alphaToCoverage: true }), { rim: false, portals: false });
  const tuftMat = new THREE.MeshBasicMaterial({ map: T.tuft, vertexColors: true, alphaTest: 0.4, side: THREE.DoubleSide, alphaToCoverage: true });
  for (const [cards, mat, cast] of [[leaves, leafMat, true], [shrubs, shrubMat, true], [ivy, leafMat, false], [tufts, tuftMat, false]]) {
    const mesh = new THREE.Mesh(cards.geometry(), mat);
    mesh.castShadow = cast; mesh.receiveShadow = false;
    mesh.matrixAutoUpdate = false;
    if (mat.userData.depth) mesh.customDepthMaterial = mat.userData.depth;
    group.add(mesh);
  }
  trunks.build(group);

  /* ---------- sky + clouds ---------- */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMaterial());
  sky.renderOrder = -10;
  group.add(sky);
  const cloudMat = new THREE.SpriteMaterial({ map: T.cloud, fog: false, depthWrite: false, transparent: true, opacity: 0.95 });
  for (const [x, y, z, sc] of [[-40, 52, -230, 120], [70, 64, -250, 140], [150, 40, -170, 95], [-150, 36, -150, 100], [5, 92, -280, 150], [-95, 74, -120, 80], [200, 70, -60, 110], [175, 112, -190, 150]]) {
    const sp = new THREE.Sprite(cloudMat);
    sp.position.set(x, y, z); sp.scale.set(sc, sc * 0.5, 1);
    group.add(sp);
  }

  /* ---------- light for the way in ---------- */
  // When the facade is cut away the rooms need their own glow (their lamps are faded out this far
  // from their stops). Two warm fills, dim at the lawn and full while the house is open in section.
  const lights = [];
  const fill = (color, i, d, x, y, z) => {
    const l = new THREE.PointLight(color, i, d, 1.5);
    l.position.set(x, y, z);
    group.add(l);
    lights.push({ l, i });
  };
  fill('#ffd9a8', 7, 10, -4.6, 5.7, -0.4);  // the main floor: studio and living room
  fill('#ffe4c2', 4, 7, 7.6, 5.6, 0.6);     // the office

  // keep the shared random stream where the later rooms expect it (see the constant above)
  for (let i = 0; i < SHARED_RAND_CALLS_BEFORE_THEATER; i++) rand();

  return {
    group, anchors: {}, lights,
    // the fills come up with the section; with music playing the house's warm windows breathe with it
    update(st) {
      const sp = sectionProgress();
      const k = 0.22 + 0.78 * sp + (st.playing && !st.reduced ? 0.55 * st.level * (1 - sp) : 0);
      for (const L of lights) L.l.intensity *= k;
    },
  };
}

/* ---------- leaf cards ---------- */
const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _n = new THREE.Vector3(), _a = new THREE.Vector3(), _p = new THREE.Vector3();
class Cards {
  constructor() { this.p = []; this.uv = []; this.c = []; this.i = []; }
  // a square card centred at x,y,z facing n, side s, spun by rot; shade(cornerIndex, cornerPos) -> light factor
  card(x, y, z, n, s, rot, base, shade) {
    _n.copy(n).normalize();
    _a.set(Math.abs(_n.y) < 0.9 ? 0 : 1, Math.abs(_n.y) < 0.9 ? 1 : 0, 0);
    _t1.crossVectors(_n, _a).normalize();
    _t2.crossVectors(_n, _t1);
    const cs = Math.cos(rot) * s / 2, sn = Math.sin(rot) * s / 2;
    const k = this.p.length / 3;
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const a = u * 2 - 1, b = v * 2 - 1;
      _p.set(x, y, z).addScaledVector(_t1, a * cs - b * sn).addScaledVector(_t2, a * sn + b * cs);
      this.p.push(_p.x, _p.y, _p.z);
      this.uv.push(u, v);
      const l = shade(_p);
      this.c.push(base.r * l, base.g * l, base.b * l);
    }
    this.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  // an upright card standing on the ground at x,y,z, turned by yaw; uv x-range [u0, u1]; colours bottom -> top
  upright(x, y, z, yaw, w, h, [u0, u1], cb, ct) {
    const dx = Math.cos(yaw) * w / 2, dz = Math.sin(yaw) * w / 2;
    const k = this.p.length / 3;
    this.p.push(x - dx, y, z - dz, x + dx, y, z + dz, x + dx, y + h, z + dz, x - dx, y + h, z - dz);
    this.uv.push(u0, 0, u1, 0, u1, 1, u0, 1);
    this.c.push(cb.r, cb.g, cb.b, cb.r, cb.g, cb.b, ct.r, ct.g, ct.b, ct.r, ct.g, ct.b);
    this.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}

// a crown of leaf-cluster cards: clumps inside an ellipsoid, cards near each clump's surface, sunlight
// baked per corner from a spherical normal (soft, volumetric), darker underneath and deep inside
const _base = new THREE.Color(), _warm = new THREE.Color('#e6ec8a'), _cool = new THREE.Color('#2f5a3a');
function crown(cards, rnd, { c: [cx, cy, cz], r: [rx, ry, rz], clumps, cards: n, size, pal, sparse = 0 }) {
  const cl = [];
  for (let i = 0; i < clumps; i++) {
    let x, y, z;
    do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; } while (x * x + y * y + z * z > 1);
    const out = 0.55 + 0.45 * Math.sqrt(rnd());
    const L = Math.hypot(x, y, z) || 1;
    const k = out / Math.max(L, 0.4);
    cl.push({ x: cx + x * rx * k * 0.72, y: cy + y * ry * k * 0.7, z: cz + z * rz * k * 0.72, r: (0.32 + rnd() * 0.22) * Math.min(rx, ry, rz) * (1 - sparse * 0.3), col: pal[(rnd() * pal.length) | 0] });
  }
  const R = Math.max(rx, ry, rz);
  const dir = new THREE.Vector3(), p = new THREE.Vector3(), nrm = new THREE.Vector3(), sp = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const C = cl[(rnd() * cl.length) | 0];
    dir.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
    const rr = C.r * (0.62 + 0.38 * rnd());
    p.set(C.x + dir.x * rr, C.y + dir.y * rr * 0.85, C.z + dir.z * rr);
    nrm.set((p.x - cx) / rx, (p.y - cy) / ry, (p.z - cz) / rz).normalize().addScaledVector(dir, 0.9);
    nrm.x += (rnd() - 0.5) * 0.8; nrm.y += (rnd() - 0.5) * 0.8; nrm.z += (rnd() - 0.5) * 0.8;
    _base.set(rnd() < 0.8 ? C.col : pal[(rnd() * pal.length) | 0]);
    const jit = 0.93 + rnd() * 0.14;
    cards.card(p.x, p.y, p.z, nrm, size * (0.75 + rnd() * 0.5), rnd() * 6.3, _base, q => {
      sp.set((q.x - cx) / rx, (q.y - cy) / ry, (q.z - cz) / rz);
      const depth = Math.min(1, sp.length());
      sp.normalize();
      const wrap = Math.max(0, (sp.dot(SUN) + 0.45) / 1.45);
      const ao = 0.5 + 0.5 * THREE.MathUtils.smoothstep(depth, 0.25, 1.0);
      const under = 0.74 + 0.26 * THREE.MathUtils.clamp((sp.y + 1) / 1.6, 0, 1);
      return (0.36 * under + 0.82 * wrap * wrap) * ao * jit;
    });
    // tint: sunlit tips go warm yellow-green, deep shade goes cool blue-green
    const ci = cards.c.length - 12;
    for (let v = 0; v < 4; v++) {
      const o = ci + v * 3, l = (cards.c[o] + cards.c[o + 1] + cards.c[o + 2]) / 3 / Math.max(0.05, (_base.r + _base.g + _base.b) / 3);
      const w = THREE.MathUtils.clamp((l - 0.85) * 1.2, 0, 0.35), s = THREE.MathUtils.clamp((0.55 - l) * 1.1, 0, 0.35);
      cards.c[o] += (_warm.r * l - cards.c[o]) * w + (_cool.r * 0.5 - cards.c[o]) * s;
      cards.c[o + 1] += (_warm.g * l - cards.c[o + 1]) * w + (_cool.g * 0.5 - cards.c[o + 1]) * s;
      cards.c[o + 2] += (_warm.b * l - cards.c[o + 2]) * w + (_cool.b * 0.5 - cards.c[o + 2]) * s;
    }
  }
  return R;
}

/* ---------- trees: a tapered, bowed trunk, a few limbs, and a leaf-card crown ---------- */
function addTree(trunks, bark, leaves, rnd, { x, z, h, lean, r, pal, cards, clumps, size = 2.3, trunkR = 0.32, bare = 0.42, bend = 0.5 }) {
  const y0 = ground(x, z) - 0.25;
  const base = new THREE.Vector3(x, y0, z);
  const top = new THREE.Vector3(x + lean[0] * h, y0 + h, z + lean[1] * h);
  const side = new THREE.Vector3(-(top.z - base.z), 0, top.x - base.x).normalize();
  if (side.lengthSq() < 0.01) side.set(1, 0, 0);
  // a gently bowed trunk up into the crown
  const pts = [0, 0.3, 0.62, 0.86, 1].map(t => base.clone().lerp(top, t).addScaledVector(side, Math.sin(t * Math.PI) * bend * 0.5 * (t < 0.5 ? 1 : 0.6)));
  tube(trunks, bark, pts, trunkR, trunkR * 0.22, 9, 12);
  // crown centre sits where the trunk ends, offset by the lean
  const cc = base.clone().lerp(top, bare + (1 - bare) * 0.5);
  const crownC = [cc.x, cc.y + r[1] * 0.1, cc.z];
  // limbs from the upper trunk out into the crown
  const limbs = 4 + ((rnd() * 3) | 0);
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * Math.PI * 2 + rnd() * 0.8;
    const t0 = bare * (0.75 + rnd() * 0.3);
    const from = base.clone().lerp(top, Math.min(0.95, t0)).addScaledVector(side, Math.sin(t0 * Math.PI) * bend * 0.5);
    const to = new THREE.Vector3(crownC[0] + Math.cos(a) * r[0] * 0.72, crownC[1] + (rnd() - 0.2) * r[1] * 0.6, crownC[2] + Math.sin(a) * r[2] * 0.72);
    const mid = from.clone().lerp(to, 0.5); mid.y += 0.6 + rnd() * 0.8;
    tube(trunks, bark, [from, mid, to], trunkR * 0.42, trunkR * 0.1, 6, 6);
  }
  crown(leaves, rnd, { c: crownC, r, clumps, cards, size, pal });
}

// a tapered tube through points (merged into the trunk Builder; bark runs along the length)
function tube(B, mat, pts, r0, r1, radial, segs) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const p = g.attributes.position, uvA = g.attributes.uv;
  const len = curve.getLength();
  const ctr = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, r = r0 + (r1 - r0) * Math.pow(t, 0.8);
    curve.getPointAt(t, ctr);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      p.setXYZ(k, ctr.x + (p.getX(k) - ctr.x) * r, ctr.y + (p.getY(k) - ctr.y) * r, ctr.z + (p.getZ(k) - ctr.z) * r);
      uvA.setXY(k, (j / radial) * Math.max(1, Math.round(r0 * 6)), t * len / 2.2);
    }
  }
  B.add(g, mat);
}
