// The view outside the living-room glass (owner: living). Each piano piece has a `windowScene`: an
// image path relative to shared/ (its cover's environment) or a painter id from WINDOW_SCENES
// ('blue-sky' is the default for null). The scene is painted once onto a wide panorama canvas and
// shown on a curved backdrop about 26 m beyond the glass, so it moves with real parallax as the
// camera moves. Changing scene cross-fades two textures in a tiny shader (no per-frame canvas work).
import * as THREE from 'three';
import { makeRand } from '../kit.js';
import { makeCanvas, loadImage } from './shared.js';

/* ---------- the panorama: an arc of a cylinder, in world units ---------- */
// centre (cx, cz) and radius R of the arc; yaw in degrees (0 looks toward -z, positive turns left)
// from yaw0 to yaw1; heights y0..y1. The canvas maps linearly onto it (left of the canvas = yaw1).
export const PANO = { cx: -1.3, cz: -1.5, R: 26, yaw0: -40, yaw1: 125, y0: -9, y1: 27 };
const CW = 2048, CH = 1024;
const D2R = Math.PI / 180;
const pxPerM = { x: CW / (PANO.R * (PANO.yaw1 - PANO.yaw0) * D2R), y: CH / (PANO.y1 - PANO.y0) };
const xOfYaw = yaw => (PANO.yaw1 - yaw) / (PANO.yaw1 - PANO.yaw0) * CW;
const yOfH = h => (PANO.y1 - h) / (PANO.y1 - PANO.y0) * CH;
// where a scene painting sits: centred at `yaw`, `widthDeg` wide, its horizon (a fraction of its
// height from the top) at world height `horizon` (a little below eye level in the room)
const ART = { yaw: 33, widthDeg: 40, horizon: 0.6, horizonFrac: 0.83 };
const HORIZON = 0.6;

/* ---------- swappable painted scenes (per-piece `windowScene`, default blue sky) ---------- */
export const WINDOW_SCENES = {
  // a clear spring sky over a far, hazy tree line: mostly sky, as the brief asks for now. The room sees it
  // from about 10 degrees above to 13 below eye level, through the shell's slate-tinted glass (a third of
  // its colour is the tint), so the blue is deep from just above the horizon up (the outside sky's blues,
  // textures.js skyMaterial), and only a narrow band at the horizon is pale: through the glass it still reads
  // as a blue sky, not grey haze. Stops by height: 27 m (top), 12 m, 6 m (eye level), 2.5 m, the horizon.
  'blue-sky': g => {
    const rnd = makeRand(77);
    const hy = yOfH(HORIZON);
    const s = g.createLinearGradient(0, 0, 0, hy);
    s.addColorStop(0, '#1452c0'); s.addColorStop(0.57, '#1f70dc'); s.addColorStop(0.795, '#2f88ec'); s.addColorStop(0.93, '#6db2f2'); s.addColorStop(1, '#b8daf6');
    g.fillStyle = s; g.fillRect(0, 0, CW, hy + 2);
    // a soft sun glow up and to the left of the view
    const sun = g.createRadialGradient(xOfYaw(62), yOfH(16), 0, xOfYaw(62), yOfH(16), 560);
    sun.addColorStop(0, 'rgba(255,250,235,.6)'); sun.addColorStop(1, 'rgba(255,250,235,0)');
    g.fillStyle = sun; g.fillRect(0, 0, CW, hy);
    // fair-weather clouds, flatter, smaller and thinner toward the horizon (thin enough that the blue
    // between them carries the view)
    for (let i = 0; i < 30; i++) {
      const y = yOfH(HORIZON + 1.5 + Math.pow(rnd(), 0.8) * 20);
      const k = 1 - (y / hy);
      cloud(g, rnd, rnd() * CW, y, 26 + k * 120 + rnd() * 40, 0.18 + k * 0.32);
    }
    // a far tree line in blue haze, then a soft green land falling away below
    for (let x = -20; x < CW + 20; x += 6 + rnd() * 9) {
      const r = 5 + rnd() * 9;
      g.fillStyle = ['#7f9f8a', '#748f7c', '#8aa995'][(rnd() * 3) | 0];
      g.beginPath(); g.arc(x, hy + 3 - rnd() * 6, r, 0, 7); g.fill();
    }
    const land = g.createLinearGradient(0, hy, 0, CH);
    land.addColorStop(0, '#93ad8a'); land.addColorStop(0.15, '#7fa25e'); land.addColorStop(1, '#5d8a3c');
    g.fillStyle = land; g.fillRect(0, hy + 4, CW, CH - hy);
    g.fillStyle = 'rgba(220,236,246,.35)'; g.fillRect(0, hy - 6, CW, 14);
  },
};
function cloud(g, rnd, x, y, r, a) {
  for (let i = 0; i < 10; i++) {
    const cx = x + (rnd() - 0.5) * r * 2.2, cy = y + (rnd() - 0.5) * r * 0.32, rr = r * (0.35 + rnd() * 0.4);
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
    gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  }
}

// A painting (the cover's environment) placed on the panorama. The glass seen from the room's stop runs
// from about yaw 62 (behind the piano and the telescope) to where the box covers it (yaw 28 to 36), and the
// picture covers yaw 13..53, so the painting carries on past its own frame with its own paint, not a smear:
//   left   the scene wraps round: the picture's right part (bright cloud, the far tree line, the water)
//          comes again past its left edge, behind the dark tree there. The right part of the original
//          sits behind the box, so the two are not seen together from the room.
//   right  the picture's right part again, mirrored.
//   beyond those, and above and below: its edge rows and columns, stretched and blurred.
// Every piece shares the picture's horizon, so the water line runs straight across the glass.
const WRAP = 0.6;   // how much of the picture (from its right edge) comes again on each side
const FEATHER = 0.07;
function paintImage(g, img) {
  const wM = PANO.R * ART.widthDeg * D2R, hM = wM * img.height / img.width;
  const w = wM * pxPerM.x, h = hM * pxPerM.y;
  const x = xOfYaw(ART.yaw) - w / 2, y = yOfH(ART.horizon + hM * ART.horizonFrac);
  const iw = img.width, ih = img.height, ww = w * WRAP, ov = w * FEATHER;
  // the far fill: the sky above and the water below (its top and bottom rows), and its edge columns
  // out to the ends of the panorama
  g.filter = 'blur(28px)';
  g.drawImage(img, 0, 0, iw, ih * 0.04, -60, -60, CW + 120, y + 70);
  g.drawImage(img, 0, ih * 0.96, iw, ih * 0.04, -60, y + h - 10, CW + 120, CH - y - h + 70);
  g.drawImage(img, iw * (1 - WRAP), 0, iw * 0.04, ih, -60, y, x - ww + ov + 140, h);
  g.drawImage(img, iw * (1 - WRAP), 0, iw * 0.04, ih, x + w - ov + ww - 80, y, CW - (x + w - ov + ww) + 140, h);
  g.filter = 'none';
  // a slice of the picture (columns sx..1 of it), optionally mirrored, faded out on one side and at
  // top and bottom
  const slice = (sx, mirror, fadeLeft) => {
    const sw = Math.ceil(w * (1 - sx)), c = makeCanvas(sw, Math.ceil(h)), cg = c.getContext('2d');
    if (mirror) { cg.translate(sw, 0); cg.scale(-1, 1); }
    cg.drawImage(img, iw * sx, 0, iw * (1 - sx), ih, 0, 0, sw, h);
    cg.setTransform(1, 0, 0, 1, 0, 0);
    feather(cg, sw, h, fadeLeft ? 0.22 : 0, fadeLeft ? 0 : 0.22);
    return c;
  };
  g.drawImage(slice(1 - WRAP, false, true), x - ww + ov, y);
  g.drawImage(slice(1 - WRAP, true, false), x + w - ov, y);
  // the picture itself, feathered into its surroundings
  const c = makeCanvas(Math.ceil(w), Math.ceil(h)), cg = c.getContext('2d');
  cg.drawImage(img, 0, 0, w, h);
  feather(cg, w, h, FEATHER, FEATHER);
  g.drawImage(c, x, y);
}
// fade a canvas to transparent over the given fractions of its width at the left and right, and a
// little at the top and bottom
function feather(cg, w, h, fl, fr) {
  cg.globalCompositeOperation = 'destination-in';
  const fx = cg.createLinearGradient(0, 0, w, 0);
  fx.addColorStop(0, fl ? 'rgba(0,0,0,0)' : '#000'); fx.addColorStop(Math.max(fl, 0.001), '#000');
  fx.addColorStop(Math.min(1 - fr, 0.999), '#000'); fx.addColorStop(1, fr ? 'rgba(0,0,0,0)' : '#000');
  cg.fillStyle = fx; cg.fillRect(0, 0, w, h);
  const fy = cg.createLinearGradient(0, 0, 0, h);
  fy.addColorStop(0, 'rgba(0,0,0,0)'); fy.addColorStop(0.06, '#000'); fy.addColorStop(0.97, '#000'); fy.addColorStop(1, 'rgba(0,0,0,0)');
  cg.fillStyle = fy; cg.fillRect(0, 0, w, h);
  cg.globalCompositeOperation = 'source-over';
}

function texture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  // the panorama is always magnified on screen (about 12 texels a degree against 15 to 20 screen
  // pixels a degree), so mipmaps would only add a third to its memory and to every upload
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  return t;
}

function arcGeometry() {
  const { cx, cz, R, yaw0, yaw1, y0, y1 } = PANO;
  const n = 64, pos = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, yaw = (yaw1 + (yaw0 - yaw1) * f) * D2R; // left (yaw1) to right (yaw0)
    const x = cx - Math.sin(yaw) * R, z = cz - Math.cos(yaw) * R;
    pos.push(x, y0, z, x, y1, z);
    uv.push(f, 0, f, 1);
    if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// The layer outside the living-room glass: `mesh` (add it to the room), `set(id)` to change scene.
export class WindowView {
  // onChange: called when the picture changes without a frame being asked for (a texture finished
  // loading, a cross-fade started), so the page can draw again
  constructor(base = '', onChange = () => {}) {
    this.base = base;
    this.onChange = onChange;
    this.cache = new Map();   // id -> Promise<Texture>
    this.wanted = null; this.shown = null; this.first = true; // the first scene is shown without a fade
    // painted scenes are free; image scenes (a cover's world) wait until the room is near (release())
    this.held = true; this.pending = null;
    this.t0 = 0; this.dur = 1.25; this.fading = false;
    this.toInit = [];
    this.material = new THREE.ShaderMaterial({
      uniforms: { tA: { value: null }, tB: { value: null }, k: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tA; uniform sampler2D tB; uniform float k; varying vec2 vUv;
        void main(){ vec3 a = texture2D(tA, vUv).rgb, b = texture2D(tB, vUv).rgb;
          gl_FragColor = vec4(mix(a, b, k), 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.DoubleSide, fog: false,
    });
    this.mesh = new THREE.Mesh(arcGeometry(), this.material);
    this.mesh.name = 'window-view';
    this.mesh.frustumCulled = false;
    // upload freshly painted scenes before they are first needed (no hitch at the cross-fade)
    this.mesh.onBeforeRender = renderer => { while (this.toInit.length) renderer.initTexture(this.toInit.pop()); };
    const sky = this.texture('blue-sky');
    sky.then(t => { if (!this.material.uniforms.tA.value) { this.material.uniforms.tA.value = this.material.uniforms.tB.value = t; this.shown ??= 'blue-sky'; } });
  }
  isImage(id) { return typeof id === 'string' && /\.(jpe?g|png|webp)$/i.test(id); }
  // the panorama texture for a scene id (cached)
  texture(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    const p = new Promise(res => {
      const c = makeCanvas(CW, CH), g = c.getContext('2d');
      const done = () => { const t = texture(c); this.toInit.push(t); res(t); };
      if (this.isImage(id)) {
        loadImage(this.base + id).then(img => { paintImage(g, img); done(); }, () => { (WINDOW_SCENES['blue-sky'])(g); done(); });
      } else { (WINDOW_SCENES[id] || WINDOW_SCENES['blue-sky'])(g); done(); }
    });
    this.cache.set(id, p);
    return p;
  }
  preload(id) { if (id && (!this.held || !this.isImage(id))) this.texture(id); }
  // the camera is coming: fetch the wanted image scene now. It cross-fades in by the clock, so if the
  // room is out of view when it arrives, it is simply there when the room comes into view.
  release() {
    if (!this.held) return;
    this.held = false;
    if (this.pending) { const id = this.pending; this.pending = null; this.set(id); }
  }
  async set(id) {
    id = id || 'blue-sky';
    if (this.held && this.isImage(id)) { this.pending = id; id = 'blue-sky'; }
    else if (this.held) this.pending = null;
    if (id === this.wanted) return;
    this.wanted = id;
    const t = await this.texture(id);
    if (this.wanted !== id) return;
    const u = this.material.uniforms;
    if (!u.tA.value || this.shown == null || this.first) { u.tA.value = u.tB.value = t; u.k.value = 0; this.shown = id; this.first = false; this.onChange(); return; }
    if (id === this.shown && !this.fading) return;
    // start from whatever is on screen now
    if (this.fading) { u.tA.value = u.k.value > 0.5 ? u.tB.value : u.tA.value; }
    u.tB.value = t; u.k.value = 0;
    this.shown = id; this.fading = true; this.t0 = performance.now();
    this.onChange();
  }
  // advance the cross-fade by the clock (so a fade never sticks half-way if frames pause)
  step(reduced) {
    if (!this.fading) return false;
    const u = this.material.uniforms;
    const f = Math.min(1, (performance.now() - this.t0) / 1000 / (reduced ? 0.35 : this.dur));
    u.k.value = f * f * (3 - 2 * f);
    if (f >= 1) { u.tA.value = u.tB.value; u.k.value = 0; this.fading = false; }
    return true;
  }
}
