// The house's architecture: every wall has an outer and an inner face (so the camera can pass
// through with a portal), plus floors, ceilings, joists, roofs with deep fascias, the brick core,
// the cantilevered right volume and the deck with its own overhang. Owner: exterior.
//
// The shell uses its own materials (not kit.js's): they open for the rooms' portals exactly like the
// kit's, and they also take the section cut of the way in (an iris in the facade that grows until the
// whole front of the house is cut away, see SECTION in layout.js and outside.js).
import * as THREE from 'three';
import { Builder, wallFace, opening, portalUniforms, MAX_PORTALS } from './kit.js';
import { F0, C0, F1, C1, LV, CORE, RV, PART_Z, THEATER, DECK, SECTION, ground } from './layout.js';

/* ---------- section cut ---------- */
const RIM = new THREE.Color('#33241a');
const f = n => n.toFixed(3);
// The outside move's "section" portal sits far below ground (a.y = SECTION.marker), so kit materials
// ignore it; here its animated radius (0..1) is read as the iris progress instead.
const SECTION_GLSL = `
float secP = 0.0;
for (int i = 0; i < ${MAX_PORTALS}; i++) if (uPA[i].y < ${f(SECTION.marker + 100)}) secP = max(secP, uPA[i].w);
float secD = 1e5;
if (secP > 0.0 && vPWorld.z > ${f(SECTION.zc)}) secD = length(vPWorld.xy - vec2(${f(SECTION.cx)}, ${f(SECTION.cy)})) - secP * ${f(SECTION.r)};
`;
const PORTAL_GLSL = `
for (int i = 0; i < ${MAX_PORTALS}; i++) {
  float r = uPA[i].w;
  if (r <= 0.0 || uPA[i].y < ${f(SECTION.marker + 100)}) continue;
  vec3 a = uPA[i].xyz; vec3 ab = uPB[i].xyz - a;
  float h = clamp(dot(vPWorld - a, ab) / max(dot(ab, ab), 1e-5), 0.0, 1.0);
  pd = min(pd, length(vPWorld - a - ab * h) - r);
}`;

// patch a material so it opens for portals (walls, floors) and for the section cut.
// rim: cut edges, the iris ring and back faces show as a dark section fill (poché)
// lower: [yTop, yLow] cuts the surface above a height that falls from yTop to yLow as the section opens
export function sectionize(mat, { rim = true, portals = true, lower = null } = {}) {
  mat.side = THREE.DoubleSide;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uPA = portalUniforms.uPA;
    sh.uniforms.uPB = portalUniforms.uPB;
    sh.uniforms.uSecRim = { value: RIM };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvPWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vPWorld;
uniform vec4 uPA[${MAX_PORTALS}];
uniform vec4 uPB[${MAX_PORTALS}];
uniform vec3 uSecRim;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
float pd = 1e5;
${portals ? PORTAL_GLSL : ''}
${SECTION_GLSL}
${lower ? `if (secP > 0.0) secD = min(secD, mix(${f(lower[0])}, ${f(lower[1])}, smoothstep(0.35, 0.9, secP)) - vPWorld.y);` : ''}
if (pd < 0.0 || secD < 0.0) discard;`);
    if (rim) sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
if (pd < 0.05 || secD < 0.16 || !gl_FrontFacing) gl_FragColor.rgb = uSecRim;`);
  };
  mat.customProgramCacheKey = () => `shell-sec-v1-${rim ? 1 : 0}${portals ? 1 : 0}${lower ? lower.join('_') : ''}`;
  // the cut also applies to shadows, so the sun reaches into the rooms once the facade is open
  const depth = new THREE.MeshDepthMaterial();
  depth.onBeforeCompile = sh => {
    sh.uniforms.uPA = portalUniforms.uPA;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvPWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vPWorld;\nuniform vec4 uPA[${MAX_PORTALS}];`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${SECTION_GLSL}\nif (secD < 0.0) discard;`);
  };
  depth.customProgramCacheKey = () => 'shell-sec-depth-v1';
  mat.userData.depth = depth;
  return mat;
}

// The living | studio partition sinks from the ceiling to this low wall while the section is open.
// Rooms that line the partition (paint, panels, the stud wall) can follow it with
// sectionize(material, { lower: PARTITION_LOWER }) and hide anything hung above it while sectionProgress() > 0.
export const PARTITION_LOWER = [C1 + 0.1, F1 + 1.0];
// the partition's paint as drawn here (studio-wall.js matches its overlays to these)
export const PARTITION = { low: '#e6dccb', high: '#7d6b5b', split: F1 + 2.05, studio: '#e7d6bd' };

// the section progress (0 closed .. 1 the whole front open), for JS that follows the cut
export function sectionProgress() {
  let p = 0;
  for (const v of portalUniforms.uPA.value) if (v.y < SECTION.marker + 100) p = Math.max(p, v.w);
  return p;
}

/* ---------- materials (colours sampled from the reference photo) ---------- */
function shellMaterials(M) {
  const std = (o, worldUV) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
    if (worldUV) m.userData.worldUV = worldUV;
    return sectionize(m);
  };
  const S = {
    // exterior: khaki-tan stucco, heavy tan fascias, chocolate brick, red-brown deck
    stucco: std({ color: '#a28c6b', map: M.stucco.map }, 2.2),
    band: std({ color: '#ae9876', map: M.stucco.map }, 2.2),
    fascia: std({ color: '#b9a27e', map: M.stucco.map }, 2.2),
    soffit: std({ color: '#8d785b', map: M.stucco.map }, 2.2),
    roof: std({ color: '#7d7368', roughness: 1 }, 3),
    flashing: std({ color: '#5a4a3a', roughness: 0.6, metalness: 0.2 }),
    brick: std({ color: '#ffffff', map: M.brick.map, roughness: 0.95 }, 1.6),
    darkWall: std({ color: '#2b2420', roughness: 0.95 }, 3),
    deckWood: std({ color: '#5c271c', roughness: 0.8 }),
    deckBoards: std({ color: '#8a5a3c', map: M.deckBoards.map }, 2),
    frame: std({ color: '#26221f', roughness: 0.5, metalness: 0.3 }),
    glass: sectionize(new THREE.MeshStandardMaterial({ color: '#2a3944', roughness: 0.05, metalness: 0.25, transparent: true, opacity: 0.34, envMapIntensity: 1.7, depthWrite: false }), { rim: false }),
    concrete: std({ color: '#a39a8e' }, 3),
    ac: std({ color: '#b9bcbc', roughness: 0.6, metalness: 0.3 }),
    // interiors
    paint: std({ color: '#efe7da' }, 3),
    paintWarm: std({ color: '#e7d6bd' }, 3),
    theaterWall: std({ color: '#4a2c2c' }, 3),
    theaterCeil: std({ color: '#2a1d1d' }, 3),
    carpet: std({ color: '#3a2a2e', map: M.carpet.map }, 2),
    floorWood: std({ color: '#ffffff', map: M.floorWood.map, roughness: 0.5 }, 3),
    floorDark: std({ color: '#ffffff', map: M.floorDark.map, roughness: 0.6 }, 3),
    ceilWhite: std({ color: '#f1ece3' }, 3),
    joist: std({ color: '#a7774b' }),
    // living room (the reference living-room photo): pale ceiling, light lower walls, darker upper walls
    ceilPale: std({ color: '#f2ece2', roughness: 0.95 }, 3),
    livingLow: std({ color: PARTITION.low }, 3),
    livingHigh: std({ color: PARTITION.high }, 3),
    downlight: new THREE.MeshBasicMaterial({ color: '#fff3da' }),
  };
  // the living | studio partition sinks to a low wall while the house stands open in section, so the
  // living room shows behind the studio
  const PART_LOW = PARTITION_LOWER;
  S.partStudio = sectionize(new THREE.MeshStandardMaterial({ color: PARTITION.studio, roughness: 0.85 }), { lower: PART_LOW });
  S.partStudio.userData.worldUV = 3;
  S.partLow = sectionize(new THREE.MeshStandardMaterial({ color: PARTITION.low, roughness: 0.85 }), { lower: PART_LOW });
  S.partHigh = sectionize(new THREE.MeshStandardMaterial({ color: PARTITION.high, roughness: 0.85 }), { lower: PART_LOW });
  S.glass.userData.noShadow = true;
  // basement props (plain, behind the section plane)
  const plain = o => new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, ...o });
  S.props = {
    steel: plain({ color: '#8f9396', roughness: 0.45, metalness: 0.5 }), box: plain({ color: '#b98d5c', roughness: 0.95 }),
    tin: plain({ color: '#c9cdd0', roughness: 0.35, metalness: 0.6 }), bin: plain({ color: '#3d7f8a' }),
    enamel: plain({ color: '#efece6', roughness: 0.35 }), tire: plain({ color: '#1e1c1b', roughness: 0.9 }),
    glassDark: plain({ color: '#35424a', roughness: 0.1, metalness: 0.3 }), bike: plain({ color: '#c0392b', roughness: 0.4, metalness: 0.3 }),
  };
  return S;
}

export function buildShell(M) {
  const group = new THREE.Group();
  group.name = 'shell';
  const S = shellMaterials(M);
  const B = new Builder();
  const T = 0.2;
  const IX0 = LV.x0 + T, IX1 = LV.x1 - T, IZ0 = LV.z0 + T, IZ1 = LV.z1 - T;
  const SILL = F1 + 0.75; // the main floor's glass sits on a heavy tan band, as in the photo

  /* ---------- left volume: openings ---------- */
  const BRICK_X = -1.6; // the front wall is brick from here to the core (both floors)
  const oDoor = { a: -9.9, b: -7.9, y0: 0, y1: 2.3 };
  const oFront = { a: LV.x0, b: BRICK_X, y0: SILL, y1: 6.0 };
  const oCorner = { a: DECK.z1 + 0.25, b: LV.z1, y0: SILL, y1: 6.0 };
  const oLeftLow = { a: 0.9, b: 3.1, y0: 0.9, y1: 2.2 };
  // the living room's far wall: floor-to-ceiling glass panels between brick piers
  const PIER = 0.55;
  const oBack = { a: LV.x0 + T + PIER, b: LV.x1 - T - PIER, y0: F1 + 0.02, y1: C1 - 0.02 };

  // outer faces
  wallFace(B, S.stucco, { axis: 'x', at: LV.z1, from: LV.x0, to: BRICK_X, y0: -0.6, y1: C1, face: 'pz', openings: [oDoor, oFront] });
  wallFace(B, S.brick, { axis: 'x', at: LV.z1, from: BRICK_X, to: LV.x1, y0: -0.6, y1: C1, face: 'pz' });
  wallFace(B, S.stucco, { axis: 'z', at: LV.x0, from: LV.z0, to: LV.z1, y0: -0.6, y1: C1, face: 'nx', openings: [oCorner, oLeftLow] });
  wallFace(B, S.stucco, { axis: 'x', at: LV.z0, from: LV.x0, to: LV.x1, y0: -0.6, y1: C1, face: 'nz', openings: [oBack] });
  wallFace(B, S.stucco, { axis: 'z', at: LV.x1, from: CORE.z1, to: LV.z1, y0: -0.6, y1: C1, face: 'px' });
  wallFace(B, S.stucco, { axis: 'z', at: LV.x1, from: LV.z0, to: CORE.z0, y0: -0.6, y1: C1, face: 'px' });
  // the brick wall's return at the corner by the core
  B.aabb(S.brick, LV.x1 - 0.01, -0.6, CORE.z1, LV.x1 + 0.02, C1, LV.z1);

  // the heavy band under the main-floor glass: wraps the front and the left end, projecting 0.3 m
  const BAND = { y0: F1 - 0.55, y1: SILL, d: 0.3 };
  B.aabb(S.band, LV.x0 - BAND.d, BAND.y0, LV.z1, BRICK_X, BAND.y1, LV.z1 + BAND.d);
  B.aabb(S.band, LV.x0 - BAND.d, BAND.y0, DECK.z1 + 0.15, LV.x0, BAND.y1, LV.z1 + BAND.d);
  // a slim sill cap on the band (catches the light)
  B.aabb(S.fascia, LV.x0 - BAND.d - 0.02, BAND.y1 - 0.04, LV.z1 + BAND.d - 0.02, BRICK_X, BAND.y1 + 0.02, LV.z1 + BAND.d + 0.02);
  B.aabb(S.fascia, LV.x0 - BAND.d - 0.02, BAND.y1 - 0.04, DECK.z1 + 0.15, LV.x0 - BAND.d + 0.02, BAND.y1 + 0.02, LV.z1 + BAND.d + 0.02);

  // frames + glass
  const fr = { t: T, frameMat: S.frame, glassMat: S.glass };
  opening(B, { ...fr, axis: 'x', at: LV.z1, inward: -1, ...oDoor, mullions: 2, glassFace: 'pz' });
  opening(B, { ...fr, axis: 'x', at: LV.z1, inward: -1, ...oFront, mullions: 5, glassFace: 'pz' });
  opening(B, { ...fr, axis: 'z', at: LV.x0, inward: 1, ...oCorner, mullions: 3, glassFace: 'nx' });
  opening(B, { ...fr, axis: 'z', at: LV.x0, inward: 1, ...oLeftLow, mullions: 2, glassFace: 'nx' });
  opening(B, { ...fr, axis: 'x', at: LV.z0, inward: 1, ...oBack, mullions: 6, transoms: 0, fw: 0.05, glassFace: 'nz' });
  // brick piers at both ends of the living room's glass wall (inside and out)
  for (const [x0, x1] of [[LV.x0, oBack.a], [oBack.b, LV.x1]]) {
    B.aabb(S.brick, x0, F1, LV.z0 - 0.04, x1, C1, LV.z0 + T + 0.1);
  }

  /* ---------- inner faces ---------- */
  // front (z = IZ1, looking -z into the rooms)
  wallFace(B, S.theaterWall, { axis: 'x', at: IZ1, from: THEATER.x0, to: THEATER.x1, y0: F0, y1: C0, face: 'nz' });
  wallFace(B, S.paintWarm, { axis: 'x', at: IZ1, from: IX0, to: THEATER.x0, y0: F0, y1: C0, face: 'nz', openings: [oDoor] });
  wallFace(B, S.paint, { axis: 'x', at: IZ1, from: THEATER.x1, to: IX1, y0: F0, y1: C0, face: 'nz' });
  wallFace(B, S.paint, { axis: 'x', at: IZ1, from: IX0, to: IX1, y0: F1, y1: C1, face: 'nz', openings: [oFront] });
  // left
  wallFace(B, S.paintWarm, { axis: 'z', at: IX0, from: IZ0, to: IZ1, y0: F0, y1: C0, face: 'px', openings: [oLeftLow] });
  wallFace(B, S.paint, { axis: 'z', at: IX0, from: PART_Z + 0.06, to: IZ1, y0: F1, y1: C1, face: 'px', openings: [oCorner] });
  // back
  wallFace(B, S.paintWarm, { axis: 'x', at: IZ0, from: IX0, to: IX1, y0: F0, y1: C0, face: 'pz' });
  // right
  wallFace(B, S.paint, { axis: 'z', at: IX1, from: PART_Z + 0.06, to: IZ1, y0: F1, y1: C1, face: 'nx' });
  wallFace(B, S.paint, { axis: 'z', at: IX1, from: IZ0, to: IZ1, y0: F0, y1: C0, face: 'nx' });
  // living | studio partition (two faces)
  wallFace(B, S.partStudio, { axis: 'x', at: PART_Z + 0.06, from: IX0, to: IX1, y0: F1, y1: C1, face: 'pz' });
  // theater box (inner and outer faces)
  wallFace(B, S.theaterWall, { axis: 'x', at: THEATER.z0, from: THEATER.x0, to: THEATER.x1, y0: F0, y1: C0, face: 'pz' });
  wallFace(B, S.paintWarm, { axis: 'x', at: THEATER.z0 - 0.12, from: THEATER.x0, to: THEATER.x1, y0: F0, y1: C0, face: 'nz' });
  wallFace(B, S.theaterWall, { axis: 'z', at: THEATER.x0, from: THEATER.z0, to: IZ1, y0: F0, y1: C0, face: 'px' });
  wallFace(B, S.paintWarm, { axis: 'z', at: THEATER.x0 - 0.12, from: THEATER.z0, to: IZ1, y0: F0, y1: C0, face: 'nx' });
  wallFace(B, S.theaterWall, { axis: 'z', at: THEATER.x1, from: THEATER.z0, to: IZ1, y0: F0, y1: C0, face: 'nx' });
  wallFace(B, S.paint, { axis: 'z', at: THEATER.x1 + 0.12, from: THEATER.z0, to: IZ1, y0: F0, y1: C0, face: 'px' });

  /* ---------- the living room (reference: living-room.jpg) ---------- */
  // honey oak floor, a pale ceiling with small recessed downlights, light lower walls with darker
  // upper walls, and the far wall all glass between the brick piers (above). Furniture: living.js.
  const LZ1 = PART_Z - 0.06, SPLIT = PARTITION.split;
  for (const [mat, part, y0, y1] of [[S.livingLow, S.partLow, F1, SPLIT], [S.livingHigh, S.partHigh, SPLIT, C1]]) {
    wallFace(B, mat, { axis: 'z', at: IX0, from: IZ0, to: LZ1, y0, y1, face: 'px' });
    wallFace(B, mat, { axis: 'z', at: IX1, from: IZ0, to: LZ1, y0, y1, face: 'nx' });
    wallFace(B, part, { axis: 'x', at: LZ1, from: IX0, to: IX1, y0, y1, face: 'nz' });
  }
  // the inside of the glass wall between the piers: just the window head and the floor edge
  B.rect(S.livingHigh, 'pz', oBack.a, oBack.b, C1 - 0.02, C1, IZ0);
  B.rect(S.floorWood, 'py', IX0, IX1, IZ0, LZ1, F1);
  B.rect(S.ceilPale, 'ny', IX0, IX1, IZ0, LZ1, C1);
  const dl = new THREE.CircleGeometry(0.07, 16);
  for (const z of [-4.6, -2.4]) for (let x = -9.2; x <= 0.4; x += 1.6) {
    B.add(dl, S.downlight, { x, y: C1 - 0.004, z, rx: Math.PI / 2 });
    B.add(new THREE.RingGeometry(0.07, 0.095, 16), S.frame, { x, y: C1 - 0.003, z, rx: Math.PI / 2 });
  }

  /* ---------- floors, ceilings, joists ---------- */
  B.rect(S.carpet, 'py', THEATER.x0, THEATER.x1, THEATER.z0, IZ1, F0 + 0.002);
  B.rect(S.concrete, 'py', IX0, THEATER.x0, IZ0, IZ1, F0);
  B.rect(S.concrete, 'py', THEATER.x1, IX1, IZ0, IZ1, F0);
  B.rect(S.concrete, 'py', THEATER.x0, THEATER.x1, IZ0, THEATER.z0, F0);
  B.rect(S.theaterCeil, 'ny', THEATER.x0, THEATER.x1, THEATER.z0, IZ1, C0);
  B.rect(S.ceilWhite, 'ny', IX0, THEATER.x0, IZ0, IZ1, C0);
  B.rect(S.ceilWhite, 'ny', THEATER.x1, IX1, IZ0, IZ1, C0);
  B.rect(S.ceilWhite, 'ny', THEATER.x0, THEATER.x1, IZ0, THEATER.z0, C0);
  B.rect(S.floorDark, 'py', IX0, IX1, PART_Z, IZ1, F1);
  B.rect(S.ceilWhite, 'ny', IX0, IX1, PART_Z, IZ1, C1);
  for (const z of [-3.45, -2.55, -1.65, -0.75, 0.15, 1.05]) B.aabb(S.joist, THEATER.x0, C0 + 0.02, z - 0.035, THEATER.x1, F1 - 0.03, z + 0.035);

  /* ---------- left volume roof: wide eaves, a deep fascia ---------- */
  const eave = { x0: LV.x0 - 1.05, x1: LV.x1 + 1.0, z0: LV.z0 - 1.0, z1: LV.z1 + 1.05 };
  fasciaRing(B, S, eave, 5.96, 7.05);
  B.rect(S.soffit, 'ny', eave.x0, eave.x1, eave.z0, eave.z1, C1 + 0.02);
  B.aabb(S.roof, eave.x0 + 0.1, 6.9, eave.z0 + 0.1, eave.x1 - 0.1, 6.98, eave.z1 - 0.1);

  /* ---------- deck on the left end, with its own lower overhang, and the walkout below it ---------- */
  const W = { x0: DECK.x0 + 0.6, x1: LV.x0, z0: DECK.z0 + 0.3, z1: DECK.z1 - 0.3, top: F1 - 0.22 };
  const oW1 = { a: -13.0, b: -11.2, y0: 0.8, y1: 2.25 }, oW2 = { a: -5.4, b: -3.0, y0: 0.8, y1: 2.25 };
  wallFace(B, S.stucco, { axis: 'x', at: W.z1, from: W.x0, to: W.x1, y0: -0.6, y1: W.top, face: 'pz', openings: [oW1] });
  wallFace(B, S.stucco, { axis: 'z', at: W.x0, from: W.z0, to: W.z1, y0: -0.6, y1: W.top, face: 'nx', openings: [oW2] });
  wallFace(B, S.stucco, { axis: 'x', at: W.z0, from: W.x0, to: W.x1, y0: -0.6, y1: W.top, face: 'nz' });
  opening(B, { ...fr, axis: 'x', at: W.z1, inward: -1, ...oW1, mullions: 2, glassFace: 'pz' });
  opening(B, { ...fr, axis: 'z', at: W.x0, inward: 1, ...oW2, mullions: 2, glassFace: 'nx' });
  // dim rooms behind those windows
  B.rect(S.paintWarm, 'pz', W.x0, W.x1, 0, W.top, W.z0 + 0.3);
  B.rect(S.paintWarm, 'px', W.z0, W.z1, 0, W.top, W.x0 + 2.2);
  B.rect(S.concrete, 'py', W.x0, W.x1, W.z0, W.z1, 0.01);
  B.rect(S.ceilWhite, 'ny', W.x0, W.x1, W.z0, W.z1, 2.85);

  const D = { ...DECK, y: F1 };
  B.aabb(S.deckWood, D.x0, D.y - 0.24, D.z0, D.x1, D.y - 0.02, D.z1);
  B.rect(S.deckBoards, 'py', D.x0, D.x1, D.z0, D.z1, D.y);
  railing(B, S.deckWood, [[D.x0 + 0.06, D.z1 - 0.06], [D.x0 + 0.06, D.z0 + 0.1]], D.y);
  railing(B, S.deckWood, [[D.x0 + 0.06, D.z1 - 0.06], [D.x1 - 0.1, D.z1 - 0.06]], D.y);
  railing(B, S.deckWood, [[D.x0 + 0.06, D.z0 + 0.1], [D.x1 - 0.1, D.z0 + 0.1]], D.y);
  // the overhang's back edge stops on the line of the house's back wall (LV.z0): any further and its end
  // hangs in the air past the house's corner, in plain view through the living room's glass wall
  const deave = { x0: D.x0 - 0.55, x1: LV.x0, z0: LV.z0, z1: D.z1 + 0.5 };
  // the deck's posts (footings at its corners; the back roof post stands under the overhang's back edge)
  for (const [x, z, zt] of [[D.x0 + 0.1, D.z1 - 0.1], [D.x0 + 0.1, D.z0 + 0.1, deave.z0 + 0.1], [D.x0 + 0.1, (D.z0 + D.z1) / 2]]) {
    B.aabb(S.deckWood, x - 0.08, ground(x, z) - 0.2, z - 0.08, x + 0.08, D.y - 0.22, z + 0.08);
    B.aabb(S.deckWood, x - 0.06, D.y, (zt ?? z) - 0.06, x + 0.06, 5.25, (zt ?? z) + 0.06);
  }
  B.aabb(S.fascia, deave.x0, 5.2, deave.z1 - 0.12, deave.x1, 5.78, deave.z1);
  B.aabb(S.fascia, deave.x0, 5.2, deave.z0, deave.x0 + 0.12, 5.78, deave.z1);
  B.aabb(S.fascia, deave.x0, 5.2, deave.z0, deave.x1, 5.78, deave.z0 + 0.12);
  B.rect(S.soffit, 'ny', deave.x0, deave.x1, deave.z0, deave.z1, 5.27);
  B.aabb(S.roof, deave.x0 + 0.1, 5.6, deave.z0 + 0.1, deave.x1, 5.68, deave.z1 - 0.1);

  /* ---------- brick core ---------- */
  B.aabb(S.brick, CORE.x0, -0.6, CORE.z0, CORE.x1, CORE.top, CORE.z1);
  B.aabb(S.fascia, CORE.x0 - 0.05, CORE.top, CORE.z0 - 0.05, CORE.x1 + 0.05, CORE.top + 0.08, CORE.z1 + 0.05);

  /* ---------- right volume (office), cantilevered over a dark recessed wall ---------- */
  // the big glass corners of house.jpg: one band of glass from the brick core round the front-left
  // corner, the whole width of the front, and round the front-right corner into the side window Freeman
  // faces (z -1.6 on). The walls are cut to the corners; glassBand() frames the runs and puts a slim post
  // at each corner where two panes meet.
  const GY0 = 3.6, GY1 = 5.9;
  const oRV = { a: RV.x0, b: RV.x1, y0: GY0, y1: GY1 };
  const oRVret = { a: CORE.z1 + 0.15, b: RV.z1, y0: GY0, y1: GY1 };
  const oRVside = { a: -1.6, b: RV.z1, y0: GY0, y1: GY1 };
  const RB = 3.0; // underside of the box
  wallFace(B, S.stucco, { axis: 'x', at: RV.z1, from: RV.x0, to: RV.x1, y0: RB, y1: C1, face: 'pz', openings: [oRV] });
  wallFace(B, S.stucco, { axis: 'z', at: RV.x0, from: CORE.z1, to: RV.z1, y0: RB, y1: C1, face: 'nx', openings: [oRVret] });
  wallFace(B, S.stucco, { axis: 'z', at: RV.x1, from: RV.z0, to: RV.z1, y0: RB, y1: C1, face: 'px', openings: [oRVside] });
  wallFace(B, S.stucco, { axis: 'x', at: RV.z0, from: RV.x0, to: RV.x1, y0: RB, y1: C1, face: 'nz' });
  B.rect(S.soffit, 'ny', RV.x0, RV.x1, RV.under, RV.z1, RB);
  B.aabb(S.band, RV.x0, RB - 0.04, RV.z1 - 0.01, RV.x1 + 0.02, RB + 0.32, RV.z1 + 0.04);
  B.aabb(S.band, RV.x1 - 0.01, RB - 0.04, RV.under, RV.x1 + 0.04, RB + 0.32, RV.z1 + 0.04);
  // the glass line runs mid-wall. Four panes on the front and the side: the office move cranes in through
  // the front at x 6.86 (mullions at 6.2 and 7.7), and the side's mullions at z -0.25 and 1.1 frame the display
  const gx0 = RV.x0 + T / 2, gx1 = RV.x1 - T / 2, gz = RV.z1 - T / 2;
  glassBand(B, S, { pts: [[gx0, oRVret.a], [gx0, gz], [gx1, gz], [gx1, oRVside.a]], panes: [1, 4, 4], t: T, y0: GY0, y1: GY1 });
  wallFace(B, S.darkWall, { axis: 'x', at: RV.under, from: RV.x0, to: RV.x1 - 0.4, y0: -0.6, y1: RB, face: 'pz' });
  wallFace(B, S.darkWall, { axis: 'z', at: RV.x1 - 0.4, from: RV.z0, to: RV.under, y0: -0.6, y1: RB, face: 'px' });
  B.rect(S.soffit, 'ny', RV.x0, RV.x1 - 0.4, RV.z0, RV.under, RB);
  // office inner faces
  const OX0 = RV.x0 + T, OX1 = RV.x1 - T, OZ0 = RV.z0 + T, OZ1 = RV.z1 - T;
  wallFace(B, S.paint, { axis: 'x', at: OZ1, from: OX0, to: OX1, y0: F1, y1: C1, face: 'nz', openings: [oRV] });
  wallFace(B, S.paint, { axis: 'z', at: OX1, from: OZ0, to: OZ1, y0: F1, y1: C1, face: 'nx', openings: [oRVside] });
  wallFace(B, S.paintWarm, { axis: 'z', at: OX0, from: OZ0, to: OZ1, y0: F1, y1: C1, face: 'px', openings: [oRVret] });
  wallFace(B, S.paint, { axis: 'x', at: OZ0, from: OX0, to: OX1, y0: F1, y1: C1, face: 'pz' });
  B.rect(S.floorWood, 'py', OX0, OX1, OZ0, OZ1, F1);
  B.rect(S.ceilWhite, 'ny', OX0, OX1, OZ0, OZ1, C1);
  const reave = { x0: RV.x0 - 0.7, x1: RV.x1 + 0.95, z0: RV.z0 - 0.9, z1: RV.z1 + 0.95 };
  fasciaRing(B, S, reave, 5.96, 7.05);
  B.rect(S.soffit, 'ny', reave.x0, reave.x1, reave.z0, reave.z1, C1 + 0.02);
  B.aabb(S.roof, reave.x0 + 0.1, 6.9, reave.z0 + 0.1, reave.x1 - 0.1, 6.98, reave.z1 - 0.1);

  /* ---------- the basement rooms either side of the theater (seen when the house opens in section) ---------- */
  basementProps(B, S, IX0, IX1);

  // AC unit at the foot of the core
  const acx = 5.3, acz = 1.5, acy = ground(acx, acz);
  B.aabb(S.ac, acx - 0.4, acy, acz - 0.4, acx + 0.4, acy + 0.78, acz + 0.4);
  B.cyl(S.frame, 0.3, 0.3, 0.02, acx, acy + 0.79, acz, 20);
  for (let i = 0; i < 9; i++) B.aabb(S.frame, acx - 0.41, acy + 0.08 + i * 0.075, acz - 0.36, acx - 0.39, acy + 0.11 + i * 0.075, acz + 0.36);

  const meshes = B.build(group);
  for (const m of meshes) if (m.material.userData.depth) m.customDepthMaterial = m.material.userData.depth;
  sectionCaps(group, RB);
  return group;
}

/* ---------- the floor slabs in section ---------- */
// While the house stands open in section, the cut through each floor slab (the main floor over the
// basement, the office floor) is drawn like the living room's floor sleeve: the floor finish, the
// subfloor, the joist cavity with its insulation, the ceiling board. Without it the open slab showed
// its hollow inside on the dive into the theater (the floor's underside, the joists, a cable and pot
// bases from the studio above). The caps stand just behind the cut plane and only draw while the
// section is open, so they never show inside the rooms.
function sectionCaps(group, RB) {
  const c = s => new THREE.Color(s);
  const mat = (finish, bottom) => new THREE.ShaderMaterial({
    uniforms: {
      uPA: portalUniforms.uPA, uTop: { value: F1 }, uBot: { value: bottom },
      uFin: { value: c(finish) }, uPly: { value: c('#dcc49a') }, uCav: { value: c('#2d221c') }, uIns: { value: c('#4a3a30') },
      uBatt: { value: c('#5a4636') }, uBoard: { value: c('#f1ede6') }, uLine: { value: c('#22170f') },
    },
    vertexShader: 'varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
    fragmentShader: `uniform vec4 uPA[${MAX_PORTALS}]; uniform float uTop; uniform float uBot;
      uniform vec3 uFin; uniform vec3 uPly; uniform vec3 uCav; uniform vec3 uIns; uniform vec3 uBatt; uniform vec3 uBoard; uniform vec3 uLine;
      varying vec3 vW;
      void main(){
        float secP = 0.0;
        for (int i = 0; i < ${MAX_PORTALS}; i++) if (uPA[i].y < ${f(SECTION.marker + 100)}) secP = max(secP, uPA[i].w);
        if (secP <= 0.0) discard;
        float y = vW.y, px = fwidth(y);
        float finB = uTop - 0.02, plyB = uTop - 0.045, brdT = uBot + 0.014;
        vec3 col;
        if (y > finB) col = uFin * (0.9 + 0.1 * step(0.5, fract(vW.x * 0.55)));
        else if (y > plyB) col = uPly;
        else if (y > brdT) {
          float k = (y - brdT) / (plyB - brdT);
          col = mix(uCav, uIns, 0.25 + 0.45 * k);
          // the insulation batt, drawn as an architect's looping line (faded out once it is too fine to draw)
          float amp = 0.3 * (plyB - brdT), per = 0.22, ph = vW.x * 6.2832 / per;
          float d = abs(y - (brdT + plyB) * 0.5 - amp * sin(ph)) / sqrt(1.0 + pow(amp * 6.2832 / per * cos(ph), 2.0));
          float batt = (1.0 - smoothstep(0.002, 0.002 + px, d)) * (1.0 - smoothstep(0.003, 0.008, px));
          col = mix(col, uBatt, batt);
        }
        else col = uBoard;
        // crisp lines where the layers meet and along both faces of the slab
        float l = min(min(abs(y - finB), abs(y - plyB)), min(abs(y - brdT), min(abs(y - uTop), abs(y - uBot))));
        col = mix(uLine, col, smoothstep(0.0022, 0.0022 + px, l));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const z = SECTION.zc - 0.004;
  for (const [x0, x1, bottom, finish] of [[LV.x0, LV.x1, C0, '#4f3a2c'], [RV.x0, RV.x1, RB, '#c88645']]) {
    const g = new THREE.PlaneGeometry(x1 - x0, F1 - bottom);
    const m = new THREE.Mesh(g, mat(finish, bottom));
    m.position.set((x0 + x1) / 2, (F1 + bottom) / 2, z);
    m.name = 'section-cap';
    m.updateMatrix(); m.matrixAutoUpdate = false;
    group.add(m);
  }
}

// the walkout room (left of the theater): a bike, a shelf of boxes; the laundry (right of it): washer and dryer
function basementProps(B, S, IX0, IX1) {
  const P = S.props;
  // steel shelving against the left wall, loaded with boxes and paint tins
  const sx = IX0 + 0.25, z0 = -3.9, z1 = -1.8;
  for (const [x, z] of [[sx - 0.2, z0], [sx + 0.2, z0], [sx - 0.2, z1], [sx + 0.2, z1]]) B.box(P.steel, 0.04, 2.0, 0.04, x, 1.0, z);
  for (const y of [0.12, 0.62, 1.12, 1.62, 1.98]) B.box(P.steel, 0.46, 0.03, z1 - z0 + 0.04, sx, y, (z0 + z1) / 2);
  const rnd = (i => () => ((i = (i * 16807) % 2147483647) / 2147483647))(77);
  for (const y of [0.135, 0.635, 1.135, 1.635]) {
    let z = z0 + 0.06;
    while (z < z1 - 0.3) {
      const d = 0.3 + rnd() * 0.25, h = 0.22 + rnd() * 0.22;
      const m = rnd() < 0.72 ? P.box : rnd() < 0.5 ? P.tin : P.bin;
      B.box(m, 0.36, h, d - 0.04, sx, y + h / 2, z + d / 2);
      z += d;
    }
  }
  // a bicycle parked across the room near the door, side-on to the lawn
  bike(B, P, -9.05, 2.75);
  // a chest freezer at the back
  B.box(P.enamel, 1.2, 0.85, 0.7, -8.6, 0.425, -4.9);
  B.box(P.steel, 1.2, 0.04, 0.7, -8.6, 0.87, -4.9);
  // laundry: washer and dryer facing the lawn, a basket, a water heater behind
  for (const [x, dark] of [[-0.25, false], [0.5, true]]) {
    B.box(P.enamel, 0.68, 0.85, 0.62, x, 0.425, 2.35);
    B.cyl(dark ? P.tire : P.glassDark, 0.2, 0.2, 0.03, x, 0.42, 2.67, 24, { rx: Math.PI / 2 });
    B.cyl(P.steel, 0.23, 0.23, 0.02, x, 0.42, 2.665, 24, { rx: Math.PI / 2 });
    B.box(P.steel, 0.6, 0.06, 0.02, x, 0.78, 2.665);
  }
  B.cyl(P.bin, 0.24, 0.2, 0.36, 0.95 - 0.1, 0.18, 3.05, 16);
  B.cyl(P.enamel, 0.3, 0.3, 1.5, 0.75, 0.75, -2.0, 20);
}

function bike(B, P, x, z) {
  const wheel = (cx) => {
    B.add(new THREE.TorusGeometry(0.33, 0.03, 8, 28), P.tire, { x: cx, y: 0.36, z });
    B.add(new THREE.TorusGeometry(0.3, 0.008, 4, 28), P.steel, { x: cx, y: 0.36, z });
    B.cyl(P.steel, 0.03, 0.03, 0.05, cx, 0.36, z, 8, { rx: Math.PI / 2 });
  };
  wheel(x - 0.52); wheel(x + 0.52);
  const tube = (ax, ay, bx, by, r = 0.022) => {
    const len = Math.hypot(bx - ax, by - ay);
    B.cyl(P.bike, r, r, len, (ax + bx) / 2, (ay + by) / 2, z, 8, { rz: Math.atan2(bx - ax, by - ay) * -1 });
  };
  const bb = [x - 0.05, 0.36], seat = [x - 0.18, 0.86], head = [x + 0.36, 0.84];
  tube(bb[0], bb[1], seat[0], seat[1]);          // seat tube
  tube(seat[0], seat[1] - 0.04, head[0], head[1] - 0.02); // top tube
  tube(bb[0], bb[1], head[0], head[1] - 0.06);    // down tube
  tube(bb[0], bb[1], x - 0.52, 0.36, 0.016);      // chain stay
  tube(seat[0], seat[1] - 0.06, x - 0.52, 0.36, 0.016); // seat stay
  tube(head[0], head[1], x + 0.52, 0.36, 0.018);  // fork
  B.box(P.tire, 0.24, 0.05, 0.09, seat[0] - 0.02, seat[1] + 0.04, z); // saddle
  tube(head[0], head[1], head[0] - 0.04, head[1] + 0.14, 0.016);   // stem
  B.box(P.tire, 0.04, 0.03, 0.46, head[0] - 0.04, head[1] + 0.15, z); // bars
}

// a band of glass that turns corners: pts are the glass line's points (mid-wall in a wall of depth t),
// in order, each run axis-aligned and split into panes[i]. Head and sill run the full wall depth and
// reach round each corner, a jamb closes each open end, mullions split the runs, and a slim post stands
// at each corner where two panes meet.
function glassBand(B, S, { pts, panes, t, y0, y1, fw = 0.06 }) {
  const h = t / 2, n = pts.length - 1;
  const frame = (x0, ya, z0, x1, yb, z1) => B.aabb(S.frame, Math.min(x0, x1), ya, Math.min(z0, z1), Math.max(x0, x1), yb, Math.max(z0, z1));
  for (let i = 0; i < n; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], alongX = az === bz;
    const a = alongX ? ax : az, b = alongX ? bx : bz, d = Math.sign(b - a);
    // the run's head and sill: from the previous run's edge (h past a corner) to h past the next corner
    const s0 = a + (i > 0 ? d * h : 0), s1 = b + (i < n - 1 ? d * h : 0);
    for (const [ya, yb] of [[y0, y0 + fw], [y1 - fw, y1]]) {
      if (alongX) frame(s0, ya, az - h, s1, yb, az + h); else frame(ax - h, ya, s0, ax + h, yb, s1);
    }
    for (let k = 1; k < panes[i]; k++) {
      const m = a + (b - a) * k / panes[i];
      if (alongX) frame(m - fw / 2, y0, az - 0.05, m + fw / 2, y1, az + 0.05); else frame(ax - 0.05, y0, m - fw / 2, ax + 0.05, y1, m + fw / 2);
    }
    if (alongX) B.rect(S.glass, 'pz', Math.min(a, b), Math.max(a, b), y0, y1, az);
    else B.rect(S.glass, 'px', Math.min(a, b), Math.max(a, b), y0, y1, ax);
  }
  for (const [i, j] of [[0, 1], [n, n - 1]]) {
    const [px, pz] = pts[i], [qx, qz] = pts[j], alongX = pz === qz, d = alongX ? Math.sign(qx - px) : Math.sign(qz - pz);
    if (alongX) frame(px, y0, pz - h, px + d * fw, y1, pz + h); else frame(px - h, y0, pz, px + h, y1, pz + d * fw);
  }
  for (let i = 1; i < n; i++) frame(pts[i][0] - 0.045, y0, pts[i][1] - 0.045, pts[i][0] + 0.045, y1, pts[i][1] + 0.045);
}

function fasciaRing(B, S, e, y0, y1, t = 0.16) {
  B.aabb(S.fascia, e.x0, y0, e.z1 - t, e.x1, y1, e.z1);
  B.aabb(S.fascia, e.x0, y0, e.z0, e.x1, y1, e.z0 + t);
  B.aabb(S.fascia, e.x0, y0, e.z0, e.x0 + t, y1, e.z1);
  B.aabb(S.fascia, e.x1 - t, y0, e.z0, e.x1, y1, e.z1);
  // a thin shadow line where the fascia meets the soffit, and the dark metal flashing along the top
  B.aabb(S.frame, e.x0 + t, y0 - 0.01, e.z1 - t - 0.03, e.x1 - t, y0 + 0.04, e.z1 - t);
  const f = 0.02, y2 = y1 + 0.05;
  B.aabb(S.flashing, e.x0 - f, y1, e.z1 - t - f, e.x1 + f, y2, e.z1 + f);
  B.aabb(S.flashing, e.x0 - f, y1, e.z0 - f, e.x1 + f, y2, e.z0 + t + f);
  B.aabb(S.flashing, e.x0 - f, y1, e.z0 - f, e.x0 + t + f, y2, e.z1 + f);
  B.aabb(S.flashing, e.x1 - t - f, y1, e.z0 - f, e.x1 + f, y2, e.z1 + f);
}

function railing(B, mat, [[ax, az], [bx, bz]], y) {
  const len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
  const ry = Math.atan2(-dz, dx);
  const H = 1.0;
  const mid = (u, yy, w, h, d) => B.box(mat, w, h, d, ax + dx * u, yy, az + dz * u, { ry });
  mid(len / 2, y + H, len + 0.1, 0.07, 0.15);
  mid(len / 2, y + 0.12, len, 0.05, 0.06);
  for (let u = 0; u <= len + 0.01; u += len / Math.max(1, Math.round(len / 1.3))) mid(u, y + H / 2, 0.09, H, 0.09);
  for (let u = 0.12; u < len - 0.05; u += 0.12) mid(u, y + H / 2 + 0.06, 0.04, H - 0.1, 0.04);
}
