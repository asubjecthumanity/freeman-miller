// Shared helpers for the canvas-drawn screens and printed things (owner: integrator).
// Each screen lives in its own file next to this one: tv.js, poster.js (theater), window-view.js
// (living room), daw.js (studio), office-monitor.js (office).
import * as THREE from 'three';

export const FONT = '"Jost", "Futura", "Avenir Next", system-ui, sans-serif';

export function tex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

// a one-line lit sign (the studio's on-air light uses it)
export function signTexture(text, fg = '#ff5a3c', bg = '#1a0d0a') {
  const c = makeCanvas(256, 96), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 96);
  g.fillStyle = fg; g.font = `600 52px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 50);
  return tex(c);
}
// a soft white radial blob for additive glows and light washes
export function glowTexture() {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); return t;
}

// One fetch per picture across the house: one decoded <img> per URL, shared by every screen and
// texture that needs it. No CORS mode, so the boxes' own <img> tags for the same file reuse the
// browser's image cache instead of fetching it again. Resolves once the picture is decoded, so a
// later drawImage never decodes on the main thread mid-flight; rejects on a load error.
const images = new Map();
export function loadImage(url) {
  let p = images.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(() => resolve(img));
      img.onerror = () => reject(new Error(`could not load ${url}`));
      img.src = url;
    });
    images.set(url, p);
  }
  return p;
}
