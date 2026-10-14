// Reusable props: loudspeakers with pumping cones, tapered legs, sofas, lamps, plants.
import * as THREE from 'three';

const coneGeoCache = new Map();
function coneGeo(r) {
  const k = r.toFixed(3);
  if (!coneGeoCache.has(k)) {
    const depth = r * 0.42;
    const cone = new THREE.CylinderGeometry(r * 0.9, r * 0.28, depth, 22, 1, true);
    cone.rotateX(Math.PI / 2); cone.translate(0, 0, -depth / 2);
    const cap = new THREE.SphereGeometry(r * 0.3, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.rotateX(Math.PI / 2); cap.scale(1, 1, 0.55); cap.translate(0, 0, -depth);
    const g = mergeSimple([cone, cap]);
    coneGeoCache.set(k, g);
  }
  return coneGeoCache.get(k);
}
function mergeSimple(list) {
  const geos = list.map(g => g.index ? g.toNonIndexed() : g);
  let n = 0; geos.forEach(g => n += g.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

const ringGeo = new THREE.TorusGeometry(1, 0.035, 6, 40);
const flatRingGeo = new THREE.RingGeometry(0.78, 1, 40, 1);

// A loudspeaker. drivers: [{x, y, r}] on the front baffle (local coords, front = +z).
// Options (all optional; the defaults are what the studio monitors use):
//   cabinet   material of the box               baffle   material of a front plate, slightly proud
//   coneMat   material of the cones              plinth   material of a low base plate
//   ringStyle 'torus' (default) | 'flat' (a flat additive ring facing forward, easier to see from afar)
//   ringColor colour of the onset rings          ledColor colour of the power LED when playing
// Returns {group, cab, drivers, rings, anchor (local), pump(...), drive(...)}.
//   pump(level, onset, kick, dt, reduced): the original all-speakers-together motion (studio)
//   drive(level, hit, dt, reduced): per-speaker motion; hit is 0..1 strength of a new onset this frame
export function speaker(M, { w, h, d, drivers, cabinet = M.speaker, ledColor = '#ffb347', baffle = null, coneMat = null, plinth = null, ringStyle = 'torus', ringColor = '#ffd28a' }) {
  const group = new THREE.Group();
  const cab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cabinet);
  cab.position.y = h / 2; cab.castShadow = true; cab.receiveShadow = true;
  group.add(cab);
  const front = d / 2 + (baffle ? 0.012 : 0);
  if (baffle) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w - 0.012, h - 0.012, 0.014), baffle);
    b.position.set(0, 0, d / 2 + 0.005); cab.add(b); // a child of the cabinet, so it breathes with it
  }
  if (plinth) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.025, d + 0.05), plinth);
    p.position.y = -0.0125; group.add(p);
  }
  const cMat = coneMat || M.coneMat || (M.coneMat = Object.assign(M.cone.clone(), { side: THREE.DoubleSide }));
  if (coneMat) coneMat.side = THREE.DoubleSide;
  const surround = M.surround || (M.surround = new THREE.MeshStandardMaterial({ color: '#0e0d0d', roughness: 0.6 }));
  const list = [];
  for (const dr of drivers) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(dr.r, dr.r * 0.1, 6, 24), surround);
    const depth = dr.r * 0.42;
    ring.position.set(dr.x, dr.y, front + depth + 0.002);
    group.add(ring);
    const cone = new THREE.Mesh(coneGeo(dr.r), cMat);
    cone.position.set(dr.x, dr.y, front + depth);
    group.add(cone);
    list.push({ cone, r: dr.r, base: cone.position.z, k: Math.min(1, dr.r / 0.1) });
  }
  // sound rings that bloom off the main driver on note onsets
  const flat = ringStyle === 'flat';
  const ringMat = new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: flat ? THREE.DoubleSide : THREE.FrontSide });
  const main = drivers.reduce((a, b) => (b.r > a.r ? b : a));
  const rings = [0, 1, 2].slice(0, flat ? 3 : 2).map(() => {
    const m = new THREE.Mesh(flat ? flatRingGeo : ringGeo, ringMat.clone());
    m.position.set(main.x, main.y, front + main.r * 0.42 + 0.02);
    m.visible = false; group.add(m);
    return { m, age: 9, k: 1 };
  });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: '#3a2a1a', toneMapped: false }));
  led.position.set(0, 0.05, front + 0.006);
  group.add(led);
  const ledOn = new THREE.Color(ledColor), ledOff = new THREE.Color('#3a2a1a');
  let ringIdx = 0;
  // drive() state: a sustained swell that follows loudness, plus a damped "punch" kicked by onsets
  let sus = 0, punchA = 0, age = 9, ledK = -1, resting = true;
  const ringAge = flat ? 1.1 : 0.9;
  function ringsStep(dt, level) {
    for (const r of rings) {
      if (r.age > ringAge) { if (r.m.visible) r.m.visible = false; continue; }
      r.age += dt;
      const k = r.age / ringAge, sc = main.r * (flat ? 1.0 + k * 2.4 : 1.05 + k * 2.2);
      r.m.scale.set(sc, sc, sc);
      r.m.material.opacity = (1 - k) * (1 - k) * 0.8 * r.k * Math.min(1, 0.3 + level * 1.4);
    }
  }
  return {
    group, cab, rings, drivers: list,
    anchor: new THREE.Vector3(0, h + 0.04, 0),
    // level: 0..1 loudness, onset: 0..1 decaying envelope from note starts, kick: true on a new onset
    pump(level, onset, kick, dt, reduced) {
      const e = reduced ? 0 : Math.min(1, level * (0.45 + 0.75 * onset));
      for (const dr of list) {
        const s = 1 + e * 0.3;
        dr.cone.position.z = dr.base + e * dr.r * 0.55;
        dr.cone.scale.set(s, s, 1 + e * 0.6);
      }
      cab.scale.set(1 + e * 0.012, 1 - e * 0.008, 1 + e * 0.012);
      led.material.color.copy(ledOff).lerp(ledOn, level > 0.02 ? 0.4 + 0.6 * Math.min(1, level * 1.4) : 0);
      if (!reduced && kick && level > 0.15) { const r = rings[ringIdx++ % rings.length]; r.age = 0; r.k = 1; r.m.visible = true; }
      ringsStep(dt, level);
    },
    // per-speaker motion, readable from across the room: cones swell with loudness and punch out on
    // onsets with a small rebound; nothing moves (and no work is done) once everything has settled
    drive(level, hit, dt, reduced) {
      if (reduced) { level = 0; hit = 0; }
      if (hit > 0) {
        punchA = Math.max(hit, punchA * Math.exp(-age * 7));
        age = 0;
        if (hit > 0.2) { const r = rings[ringIdx++ % rings.length]; r.age = 0; r.k = Math.min(1, 0.35 + hit); r.m.visible = true; }
      }
      age += dt;
      sus += (level - sus) * (1 - Math.exp(-dt * 14));
      const punch = age < 1.2 ? punchA * Math.exp(-age * 9) * Math.cos(age * 30) : 0;
      const e = sus * 0.45 + punch * 0.85;
      const quiet = Math.abs(e) < 0.002 && level < 0.01;
      if (!(quiet && resting)) {
        for (const dr of list) {
          const ek = e * (0.35 + 0.65 * dr.k);
          const s = 1 + ek * 0.32;
          dr.cone.position.z = dr.base + ek * dr.r * 0.7;
          dr.cone.scale.set(s, s, 1 + ek * 0.9);
        }
        const c = Math.max(0, e);
        cab.scale.set(1 + c * 0.014, 1 - c * 0.01, 1 + c * 0.014);
        resting = quiet;
      }
      const lk = level > 0.02 ? Math.round((0.4 + 0.6 * Math.min(1, level * 1.4)) * 20) / 20 : 0;
      if (lk !== ledK) { ledK = lk; led.material.color.copy(ledOff).lerp(ledOn, lk); }
      ringsStep(dt, Math.max(level, 0.35));
    },
  };
}

// tapered round leg, mid-century style
export function leg(B, mat, x, y0, z, h, r = 0.022, splay = 0) {
  B.cyl(mat, r, r * 0.55, h, x, y0 + h / 2, z, 8, { rz: splay });
}

export function plant(B, M, x, y, z, s = 1) {
  B.cyl(M.pot, 0.2 * s, 0.15 * s, 0.38 * s, x, y + 0.19 * s, z, 14);
  B.cyl(M.trunk, 0.02 * s, 0.025 * s, 0.9 * s, x, y + 0.8 * s, z, 6);
  const leaf = new THREE.IcosahedronGeometry(0.2 * s, 0);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    B.add(leaf, M.plant, { x: x + Math.cos(a) * 0.18 * s, y: y + (0.75 + (i % 4) * 0.22) * s, z: z + Math.sin(a) * 0.18 * s, sx: 1, sy: 0.5, sz: 1.6, ry: a, rx: 0.5 });
  }
}

export function emissive(color, intensity = 1) {
  return new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: intensity, roughness: 1 });
}
