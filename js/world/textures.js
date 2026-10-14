// Procedural canvas textures (no image downloads): stucco, brick, wood, carpet, pavers, grass, sky,
// and the exterior's foliage (leaf clusters), bark and clouds. Owner: exterior.
//
// Randomness here uses a private stream, not the shared rand() in kit.js, so retuning a texture never
// shifts the random layouts of the rooms built later (buildExterior keeps the shared stream aligned).
import * as THREE from 'three';
import { canvasTexture, makeRand } from './kit.js';

const rand = makeRand(5150);
const hsl = (h, s, l, a = 1) => `hsl(${h} ${s}% ${l}% / ${a})`;

function speckle(g, w, h, n, colors, rmax = 1.4) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(rand() * colors.length) | 0];
    const r = rand() * rmax + 0.3;
    g.fillRect(rand() * w, rand() * h, r, r);
  }
}

export function makeTextures() {
  const T = {};
  // stucco: near-white so the material colour sets the hue; soft trowel mottling
  T.stucco = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.07;
    for (let i = 0; i < 46; i++) { g.fillStyle = rand() > 0.5 ? '#bfae94' : '#ffffff'; g.beginPath(); g.ellipse(rand() * w, rand() * h, 20 + rand() * 46, 8 + rand() * 22, rand() * 3, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    speckle(g, w, h, 7000, ['#efe9df', '#f7f3ec', '#e4dccf', '#fffdf8'], 1.3);
  }, { repeat: true });

  // brown brick (the core in the photo is a greyish chocolate brown, not red)
  T.brick = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#8f8070'; g.fillRect(0, 0, w, h);
    const rows = 24, cols = 8, bh = h / rows, bw = w / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * bw / 2;
      for (let c = -1; c <= cols; c++) {
        const x = c * bw + off;
        const hue = 16 + rand() * 12, sat = 22 + rand() * 16, lit = 25 + rand() * 15;
        g.fillStyle = hsl(hue, sat, lit);
        g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
        g.fillStyle = hsl(hue, sat, lit + 7); g.fillRect(x + 2, r * bh + 2, bw - 4, 2);
        g.fillStyle = hsl(hue, sat, Math.max(8, lit - 8)); g.fillRect(x + 2, r * bh + bh - 4, bw - 4, 2);
      }
    }
    speckle(g, w, h, 4000, ['rgba(0,0,0,.16)', 'rgba(255,236,214,.1)'], 2);
  }, { repeat: true });

  const planks = (base, var_, n, len) => (g, w, h) => {
    const ph = h / n;
    for (let i = 0; i < n; i++) {
      let x = -rand() * len * w;
      while (x < w) {
        const L = len * w * (0.6 + rand() * 0.8);
        const l = base[2] + (rand() - 0.5) * var_;
        g.fillStyle = hsl(base[0] + (rand() - 0.5) * 6, base[1], l);
        g.fillRect(x, i * ph, L - 2, ph - 2);
        g.globalAlpha = 0.16;
        for (let k = 0; k < 7; k++) { g.fillStyle = hsl(base[0], base[1], l - 9); g.fillRect(x, i * ph + rand() * ph, L - 2, 1); }
        g.globalAlpha = 1;
        x += L;
      }
      g.fillStyle = 'rgba(40,20,5,.32)'; g.fillRect(0, i * ph + ph - 2, w, 2);
    }
  };
  // honey oak (living room and office floors)
  T.floor = canvasTexture(512, 512, planks([33, 58, 53], 12, 8, 0.6), { repeat: true });
  T.floorDark = canvasTexture(512, 512, planks([22, 30, 22], 6, 8, 0.6), { repeat: true });
  T.boards = canvasTexture(256, 256, planks([14, 34, 34], 10, 6, 1.5), { repeat: true });
  T.walnut = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#6a4127'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = `rgba(${40 + rand() * 30},${20 + rand() * 15},10,${0.25 + rand() * 0.3})`;
      g.lineWidth = 0.5 + rand() * 2;
      const y = rand() * h;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x / 40 + i) * 3);
      g.stroke();
    }
  }, { repeat: true });
  T.slats = canvasTexture(256, 256, (g, w, h) => {
    const n = 10, sw = w / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = hsl(30 + rand() * 6, 45, 52 + rand() * 8);
      g.fillRect(i * sw, 0, sw - 3, h);
      g.fillStyle = 'rgba(60,30,10,.5)'; g.fillRect(i * sw + sw - 3, 0, 3, h);
    }
  }, { repeat: true });
  T.carpet = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 12000, ['#e9e4e6', '#f7f4f5', '#dcd5d8'], 1.2);
  }, { repeat: true });
  // brick pavers for the path (salmon-red, sun-bleached)
  T.pavers = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#cdb9a8'; g.fillRect(0, 0, w, h);
    const rows = 8, bh = h / rows, bw = w / 4;
    for (let r = 0; r < rows; r++) for (let c = -1; c < 5; c++) {
      const x = c * bw + (r % 2) * bw / 2;
      g.fillStyle = hsl(10 + rand() * 9, 28 + rand() * 16, 68 + rand() * 18);
      g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
    }
    speckle(g, w, h, 1800, ['rgba(80,40,20,.12)', 'rgba(255,255,255,.12)'], 1.6);
  }, { repeat: true });
  T.grass = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 15000, ['#e8f0dc', '#ffffff', '#d9e6c8', '#f4f8ec', '#cddcb8', '#fffbe8'], 1.8);
    // short blades
    g.lineWidth = 1;
    for (let i = 0; i < 900; i++) {
      const x = rand() * w, y = rand() * h, l = 3 + rand() * 5;
      g.strokeStyle = rand() > 0.5 ? 'rgba(150,175,110,.35)' : 'rgba(255,255,235,.45)';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rand() - 0.5) * 2, y - l); g.stroke();
    }
  }, { repeat: true });

  // a leafy clump on a transparent card: a dense core with leaves breaking the silhouette; near-white
  // so the per-card vertex colour (baked sunlight) sets the green
  T.leaf = canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const leaf = (x, y, a, L, W, l) => {
      g.save(); g.translate(x, y); g.rotate(a);
      g.beginPath(); g.moveTo(0, 0);
      g.quadraticCurveTo(W, L * 0.4, 0, L);
      g.quadraticCurveTo(-W, L * 0.4, 0, 0);
      g.fillStyle = hsl(82 + rand() * 14, 18 + rand() * 14, l); g.fill();
      g.strokeStyle = 'rgba(40,60,20,.10)'; g.lineWidth = 1; g.stroke();
      g.restore();
    };
    // core: overlapping soft-edged lobes in a mid tone
    for (let i = 0; i < 9; i++) {
      const a = rand() * 7, r = rand() * 34;
      g.fillStyle = hsl(86, 16, 70 + rand() * 8);
      g.beginPath(); g.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 40 + rand() * 22, 0, 7); g.fill();
    }
    // leaves: inner ones in shade, outer ones lighter, all pointing outward
    for (let i = 0; i < 150; i++) {
      const a = rand() * Math.PI * 2, t = Math.sqrt(rand()), r = 18 + t * 86;
      const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
      leaf(x, y, a - Math.PI / 2 + (rand() - 0.5) * 1.3, 18 + rand() * 16, 8 + rand() * 5, 66 + t * 26 + rand() * 8);
    }
  });
  T.leaf.generateMipmaps = true;

  // lawn details atlas: grass tufts on the left half, little flowers (dandelions, daisies) on the right
  T.tuft = canvasTexture(256, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round';
    for (let i = 0; i < 34; i++) {
      const x0 = 14 + rand() * 100, lean = (rand() - 0.5) * 34, top = 10 + rand() * 60;
      g.strokeStyle = hsl(80 + rand() * 20, 25 + rand() * 25, 62 + rand() * 34);
      g.lineWidth = 2 + rand() * 2.4;
      g.beginPath(); g.moveTo(x0, h); g.quadraticCurveTo(x0 + lean * 0.3, h - (h - top) * 0.6, x0 + lean, top); g.stroke();
    }
    const flower = (x, y, r, petals, col, eye) => {
      g.strokeStyle = 'rgba(120,160,70,.9)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + 3, (h + y) / 2, x, y); g.stroke();
      g.fillStyle = col;
      for (let k = 0; k < petals; k++) { const a = k / petals * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.55, r * 0.22, a, 0, 7); g.fill(); }
      g.fillStyle = eye; g.beginPath(); g.arc(x, y, r * 0.32, 0, 7); g.fill();
    };
    flower(160, 46, 13, 14, '#ffd21f', '#f2a812');
    flower(196, 30, 12, 12, '#ffffff', '#f4c430');
    flower(228, 58, 11, 14, '#ffd21f', '#f2a812');
    flower(178, 80, 9, 11, '#ffffff', '#f4c430');
  });

  // bark: grey-brown with vertical fissures
  T.bark = canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#9a8c7e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = rand() * w, wd = 1 + rand() * 4;
      g.fillStyle = rand() > 0.4 ? `rgba(60,48,38,${0.2 + rand() * 0.35})` : `rgba(220,210,195,${0.15 + rand() * 0.2})`;
      let y = 0;
      while (y < h) { const l = 10 + rand() * 40; g.fillRect(x + (rand() - 0.5) * 3, y, wd, l); y += l + rand() * 10; }
    }
    speckle(g, w, h, 1500, ['rgba(0,0,0,.15)', 'rgba(255,255,255,.1)'], 1.5);
  }, { repeat: true });

  // soft cumulus: puffs shaded from bright tops to a cool grey base
  T.cloud = canvasTexture(512, 256, (g, w, h) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const q = c.getContext('2d');
    const puff = (x, y, r) => {
      const grd = q.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.55, 'rgba(255,255,255,.85)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      q.fillStyle = grd; q.beginPath(); q.arc(x, y, r, 0, 7); q.fill();
    };
    for (let i = 0; i < 22; i++) { const t = rand(); puff(w * (0.16 + t * 0.68), h * (0.62 - Math.sin(t * Math.PI) * 0.22 + rand() * 0.08), 34 + Math.sin(t * Math.PI) * 50 + rand() * 20); }
    for (let i = 0; i < 14; i++) puff(w * (0.1 + rand() * 0.8), h * (0.68 + rand() * 0.06), 24 + rand() * 18);
    q.globalCompositeOperation = 'source-atop';
    const sh = q.createLinearGradient(0, h * 0.25, 0, h * 0.85);
    sh.addColorStop(0, '#ffffff'); sh.addColorStop(0.55, '#f4f7fb'); sh.addColorStop(1, '#bccbdc');
    q.fillStyle = sh; q.fillRect(0, 0, w, h);
    g.clearRect(0, 0, w, h);
    g.drawImage(c, 0, 0);
  });

  // rugs
  T.rugLiving = canvasTexture(512, 320, (g, w, h) => {
    g.fillStyle = '#cdb994'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#7a5a38'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    const cols = ['#c98b4a', '#4f7c76', '#b9a274', '#5b6a7d'];
    for (let i = 0; i < 11; i++) for (let j = 0; j < 6; j++) {
      g.fillStyle = cols[(i * 3 + j) % 4];
      const x = 44 + i * 42, y = 46 + j * 46;
      if ((i + j) % 2) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
      else g.fillRect(x - 10, y - 3, 20, 6);
    }
  });
  T.rugTheater = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#5a2a2c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c08a4a'; g.lineWidth = 5; g.strokeRect(14, 14, w - 28, h - 28);
    g.strokeStyle = 'rgba(192,138,74,.5)'; g.lineWidth = 2; g.strokeRect(26, 26, w - 52, h - 52);
    speckle(g, w, h, 3000, ['rgba(0,0,0,.12)', 'rgba(255,220,200,.06)'], 2);
  });
  T.rugStudio = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#5a3a2c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#6b4634' : '#7c5238'; g.fillRect(0, 16 + i * 28, w, 12); }
    g.strokeStyle = '#c89a4a'; g.lineWidth = 4; g.strokeRect(10, 10, w - 20, h - 20);
  });
  return T;
}

// gradient sky dome material (unlit, no fog): deep spring blue overhead, pale at the horizon,
// with a soft warm glow toward the sun
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color('#1d64c4') }, mid: { value: new THREE.Color('#4b9be6') }, horizon: { value: new THREE.Color('#cfe7fa') },
      sunDir: { value: new THREE.Vector3(-0.47, 0.69, 0.56).normalize() },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vP;
      void main(){ float h = clamp(vP.y, -0.2, 1.0);
        vec3 c = mix(horizon, mid, smoothstep(-0.02, 0.2, h));
        c = mix(c, top, smoothstep(0.2, 0.8, h));
        float s = max(0.0, dot(normalize(vP), sunDir));
        c += vec3(1.0, 0.96, 0.86) * (pow(s, 6.0) * 0.18 + pow(s, 60.0) * 0.4);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}
