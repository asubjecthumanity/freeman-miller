// The three.js world: renderer, scene, camera on the scripted path, the light rig that blends
// between rooms, portals, per-room visibility and updates, and projection of 3D anchors to the screen.
import * as THREE from 'three';
import { makeTextures } from './textures.js';
import { makeMaterials, portalUniforms, MAX_PORTALS } from './kit.js';
import { buildShell } from './shell.js';
import { buildExterior } from './exterior.js';
import { buildTheater } from './theater.js';
import { buildLiving } from './living.js';
import { buildStudio } from './studio.js';
import { buildOffice } from './office.js';
import { ROOMS, KEYS, LIGHTS, PORTALS, VISIBLE, FRAME, FIT, buildTrack, evalTrack } from '../path.js';

const D2R = Math.PI / 180;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// give the browser a turn (input, a painted frame) between the long pieces of work at start-up
const pause = () => new Promise(r => setTimeout(r, 0));

// Resolution: the device's pixel ratio, capped (1.5 on desktops, 1.6 on phones) and held to a pixel
// budget so big screens do not render 8 million pixels a frame; never below 1 CSS pixel per pixel
// unless the frame-time governor in app.js steps it down (quality < 1). The desktop budget is what a
// MacBook's Retina screen can fill with headroom (1512 x 982 at DPR 2 renders at 1.22, 2.2 MP: the
// studio with music on stayed GPU-bound at 3 MP).
const BUDGET = { desktop: 2.2e6, mobile: 1.1e6 };
function pixelRatio(w, h, mobile, quality = 1) {
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(dpr, mobile ? 1.6 : 1.5, Math.sqrt((mobile ? BUDGET.mobile : BUDGET.desktop) / Math.max(1, w * h)));
  return Math.max(Math.min(1, dpr) * (quality < 1 ? 0.75 : 1), fit * quality);
}

// Built in pieces (one room per task) so the page stays responsive while the house goes up; the
// rooms keep their build order because they share the seeded rand() in kit.js.
export async function createWorld({ canvas, data, mediaBase, mobile }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  let quality = 1;
  renderer.setPixelRatio(pixelRatio(innerWidth, innerHeight, mobile));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1512');
  scene.fog = new THREE.Fog('#d3e8f7', 80, 260);
  scene.environment = envFromSky(renderer);
  scene.environmentIntensity = 0.8;
  // A lost GPU context (a GPU reset, a phone reclaiming a background tab): three.js rebuilds its state
  // and re-uploads geometry and textures on restore, but the sky environment is a render target that
  // only exists on the GPU, so it is drawn again (without it every room is lit by black: seats, the
  // poster and walls go dark). Then a frame is asked for.
  canvas.addEventListener('webglcontextrestored', () => {
    const old = scene.environment;
    scene.environment = envFromSky(renderer);
    old?.dispose();
    data.wake?.();
  });

  const camera = new THREE.PerspectiveCamera(45, 1, 0.04, 700);
  camera.rotation.order = 'YXZ';

  const T = makeTextures();
  const M = makeMaterials(T);
  const shell = buildShell(M);
  // every room module is build(M, T, ctx) -> { group, anchors, lights, update(s) }. Build order matters:
  // they share the seeded rand() in kit.js, so it stays exterior, theater, living, studio, office.
  const ctx = { ...data, mediaBase, mobile, renderer };
  await pause();
  const exterior = buildExterior(M, T, ctx);
  await pause();
  const theater = buildTheater(M, T, ctx);
  await pause();
  const living = buildLiving(M, T, ctx);
  await pause();
  const studio = buildStudio(M, T, ctx);
  await pause();
  const office = buildOffice(M, T, ctx);
  const rooms = { exterior, theater, living, studio, office }; // keys are the group names in VISIBLE
  scene.add(shell, exterior.group, theater.group, living.group, studio.group, office.group);
  const groups = Object.fromEntries(Object.entries(rooms).map(([k, r]) => [k, r.group]));
  if (PORTALS.length > MAX_PORTALS) console.warn(`world.js: ${PORTALS.length} portals, only ${MAX_PORTALS} are drawn`);

  /* light rig */
  const hemi = new THREE.HemisphereLight('#ffffff', '#444444', 1);
  const sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
  scene.add(hemi, sun, sun.target);
  const roomLights = Object.fromEntries(Object.entries(rooms).map(([k, r]) => [k, r.lights || []]));
  // keep every room light in the scene at all times (intensity fades instead) so hiding a room
  // never changes the light count, which would force every material to recompile
  for (const list of Object.values(roomLights)) for (const { l } of list) { l.updateMatrixWorld(); const p = l.getWorldPosition(new THREE.Vector3()); l.parent.remove(l); l.position.copy(p); scene.add(l); }
  // a room's lights fade with distance from its stop; a room with steps (the office's sessions) keeps
  // them on through its steps
  const roomSpan = {};
  for (const r of ROOMS) { const s = roomSpan[r.group] || (roomSpan[r.group] = [r.stop, r.stop]); s[0] = Math.min(s[0], r.stop); s[1] = Math.max(s[1], r.stop); }

  /* camera path: Hermite curves through the keys, zero tangents at stops */
  const keySets = { land: buildTrack(KEYS, false), port: buildTrack(KEYS, true) };
  const pose = new Float32Array(6);
  const v = new THREE.Vector3();
  const cA = new THREE.Color(), cB = new THREE.Color();

  let W = 1, H = 1, portrait = false;
  function resize(w, h) {
    W = w; H = h; portrait = w / h < 0.8;
    renderer.setPixelRatio(pixelRatio(w, h, mobile, quality));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
  }
  // the governor in app.js: render fewer pixels (and a smaller sun shadow) on a device that cannot keep up
  function degrade() {
    if (quality <= 0.7) return false;
    quality = quality > 0.9 ? 0.8 : 0.7;
    if (quality <= 0.7 && sun.shadow.mapSize.x > 1024) { sun.shadow.mapSize.set(1024, 1024); sun.shadow.map?.dispose(); sun.shadow.map = null; }
    resize(W, H);
    return true;
  }

  function sampleCamera(u, panelW) {
    evalTrack(portrait ? keySets.port : keySets.land, u, pose);
    camera.position.set(pose[0], pose[1], pose[2]);
    camera.rotation.set(pose[4] * D2R, pose[3] * D2R, 0);
    camera.fov = pose[5];
    // a stop's `fit` (rooms/<room>.js key): narrower landscape screens see as much across as at that aspect,
    // eased in over the last part of the move
    const r = Math.round(u), w = 1 - smooth(0.1, 0.5, Math.abs(u - r));
    if (!portrait && FIT[r] > camera.aspect && w > 0) camera.fov = Math.min(80, 2 * Math.atan(Math.tan(pose[5] * D2R / 2) * (1 + (FIT[r] / camera.aspect - 1) * w)) / D2R);
    // slide the picture away from the info box: left on wide screens, up on phones
    const i0 = Math.floor(u), i1 = Math.min(FRAME.length - 1, i0 + 1), f = smooth(0, 1, u - i0);
    const fx = (FRAME[i0].x * (1 - f) + FRAME[i1].x * f) * panelW;
    const fy = (FRAME[i0].y * (1 - f) + FRAME[i1].y * f) * panelW;
    if (portrait) camera.setViewOffset(W, H, 0, fy * H, W, H);
    else camera.setViewOffset(W, H, fx * W, 0, W, H);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function lightRig(u) {
    const i0 = Math.max(0, Math.min(LIGHTS.length - 1, Math.floor(u)));
    const i1 = Math.min(LIGHTS.length - 1, i0 + 1);
    const b = LIGHTS[i0].blend || [0.4, 0.8];
    const f = i0 === i1 ? 0 : smooth(b[0], b[1], u - i0);
    const A = LIGHTS[i0], B = LIGHTS[i1];
    hemi.color.copy(cA.set(A.hemi[0])).lerp(cB.set(B.hemi[0]), f);
    hemi.groundColor.copy(cA.set(A.hemi[1])).lerp(cB.set(B.hemi[1]), f);
    hemi.intensity = A.hemi[2] * (1 - f) + B.hemi[2] * f;
    // move the sun's shadow frustum with the room; fade between rooms through zero-ish
    const S = f < 0.5 ? A.sun : B.sun, k = f < 0.5 ? 1 - f * 2 : f * 2 - 1;
    sun.position.set(...S.pos); sun.target.position.set(...S.target);
    sun.color.set(S.color);
    sun.intensity = S.i * (A.sun.i && B.sun.i && A.sun === B.sun ? 1 : (0.25 + 0.75 * k));
    const box = S.box, sc = sun.shadow.camera;
    if (sc.right !== box) { sc.left = -box; sc.right = box; sc.top = box; sc.bottom = -box; sc.updateProjectionMatrix(); }
    scene.environmentIntensity = A.env * (1 - f) + B.env * f;
    renderer.toneMappingExposure = A.exposure * (1 - f) + B.exposure * f;
    for (const [room, list] of Object.entries(roomLights)) {
      const [a, b] = roomSpan[room] || [-9, -9], d = u < a ? a - u : u > b ? u - b : 0;
      const w = 1 - smooth(0.45, 0.95, d);
      for (const { l, i } of list) { l.intensity = i * w; l.visible = true; }
    }
  }

  function portals(u) {
    for (let i = 0; i < MAX_PORTALS; i++) {
      const P = PORTALS[i];
      const pa = portalUniforms.uPA.value[i], pb = portalUniforms.uPB.value[i];
      if (!P) { pa.w = 0; continue; }
      const r = P.r * smooth(P.open[0], P.open[1], u) * (1 - smooth(P.close[0], P.close[1], u));
      pa.set(P.a[0], P.a[1], P.a[2], r); pb.set(P.b[0], P.b[1], P.b[2], 0);
    }
  }

  function visibility(u) {
    for (const [k, ranges] of Object.entries(VISIBLE)) groups[k].visible = ranges.some(([a, b]) => u >= a && u <= b);
    living.backdrop.visible = groups.living.visible;
  }

  let time = 0;
  // s: the frame state built in app.js (playing, kind, t, level, onset, kick, reduced, tv, pianoNotes,
  // pianoT). Each visible room's update gets it plus dt and time (seconds the world has run).
  function place(u, panelW) {
    u = Math.max(0, Math.min(FRAME.length - 1, u));
    sampleCamera(u, panelW);
    lightRig(u);
    portals(u);
    visibility(u);
    return u;
  }
  // returns whether the view moved since the last frame (the path, or a room moving the camera itself, such
  // as the living room's lean easing out after a pause): app.js then draws the next frames at full rate
  const lastView = new THREE.Matrix4(), lastProj = new THREE.Matrix4();
  function frame(u, dt, s, panelW = 1) {
    u = place(u, panelW);
    time += dt;
    const rs = { ...s, dt, time, camera, viewH: H };
    for (const [k, r] of Object.entries(rooms)) if (groups[k].visible) r.update(rs);
    if (warmQueue.length) warmStep();
    renderer.render(scene, camera);
    const moved = !lastView.equals(camera.matrixWorld) || !lastProj.equals(camera.projectionMatrix);
    if (moved) { lastView.copy(camera.matrixWorld); lastProj.copy(camera.projectionMatrix); }
    return moved;
  }

  // before the first picture: compile only what that picture needs, without blocking the page
  // (KHR_parallel_shader_compile), so the first render never stalls on a shader
  async function prepare(u, panelW = 0) {
    place(u, panelW);
    const parts = [shell, ...Object.values(groups).filter(g => g.visible)];
    try { await Promise.all(parts.map(g => renderer.compileAsync(g, camera, scene))); } catch { /* the first render compiles */ }
  }

  // After the first picture, in the background: compile every material and upload every texture, then
  // draw each room once, whole (hidden parts shown, culling off), into the real canvas at the start of a
  // frame that then clears and draws the actual picture over it. That puts every buffer on the GPU and
  // makes the GPU driver build its pipeline for every material against the real framebuffer, so a room
  // first seen mid-flight costs nothing extra (it used to cost 10 to 50 ms the first time). One room per frame.
  let warmQueue = [], warmDone = null;
  async function warm() {
    try { await renderer.compileAsync(scene, camera); } catch { renderer.compile(scene, camera); }
    scene.traverse(o => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) for (const k of ['map', 'emissiveMap']) if (m[k]) renderer.initTexture(m[k]);
    });
    await new Promise(resolve => { warmDone = resolve; warmQueue = [shell, ...Object.values(groups)]; data.wake?.(); });
  }
  function warmStep() {
    const part = warmQueue.shift(), top = [shell, ...Object.values(groups)];
    const vis = top.map(g => g.visible), hidden = [], culled = [];
    top.forEach(g => (g.visible = g === part));
    part.traverse(o => {
      if (o.isLight) return;
      if (!o.visible) { o.visible = true; hidden.push(o); }
      if (o.frustumCulled) { o.frustumCulled = false; culled.push(o); }
    });
    renderer.render(scene, camera);
    for (const o of hidden) o.visible = false;
    for (const o of culled) o.frustumCulled = true;
    top.forEach((g, i) => (g.visible = vis[i]));
    if (!warmQueue.length) warmDone?.();
  }

  // project a world point to CSS pixels; null when behind the camera
  function project(p) {
    v.copy(p).project(camera);
    if (v.z > 1 || v.z < -1) return null;
    return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, z: v.z };
  }

  return {
    renderer, scene, camera, resize, degrade, frame, prepare, project, warm, rooms, exterior, theater, living, studio, office,
    get quality() { return quality; },
    get warming() { return warmQueue.length > 0; },
    anchors: Object.fromEntries(Object.entries(rooms).map(([k, r]) => [k, r.anchors])),
    setWindowScene: id => living.view.set(id),
    // a room's pictures and video, fetched as the camera approaches it (stop -> room module)
    loadMedia(stop) { [null, theater, living, studio, office][stop]?.loadMedia?.(); },
  };
}

/* ---------- a soft sky/grass environment for reflections and ambient ---------- */
function envFromSky(renderer) {
  const s = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; void main(){ float h = vP.y;
      vec3 sky = mix(vec3(0.75,0.86,0.95), vec3(0.25,0.48,0.85), smoothstep(0.0, 0.7, h));
      vec3 gnd = mix(vec3(0.42,0.5,0.28), vec3(0.3,0.36,0.2), smoothstep(0.0, -0.6, h));
      vec3 c = h > 0.0 ? sky : gnd;
      c += vec3(1.0,0.95,0.85) * pow(max(0.0, dot(normalize(vP), normalize(vec3(-0.5,0.7,0.6)))), 24.0) * 2.0;
      gl_FragColor = vec4(c, 1.0); }`,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.02);
  pm.dispose();
  return rt.texture;
}
