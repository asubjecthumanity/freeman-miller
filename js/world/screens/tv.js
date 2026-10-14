// The theater TV (owner: theater): Paranoia "playing" on the big flat-screen.
// A drawn picture (a title card, then three abstract shots drawn from the cue's notes and peaks: no
// invented scenes from the film, which has no footage here yet) or, when
// filmScore.trailer = { src, poster } exists, the real trailer as a muted <video> drawn into the same
// canvas. "Turn the sound on" is drawn on the picture while the sound is off. After each draw, `avg`
// (the picture's colour) and `bright` (0..1) say how the picture lights the room.
import * as THREE from 'three';
import { rand, makeRand } from '../kit.js';
import { FONT, tex, makeCanvas, fmt } from './shared.js';

const W = 768, H = 432, BAR = 54, PY = BAR, PH = H - 2 * BAR; // 2.37:1 picture inside the 16:9 panel
const TITLE = 6.5;   // seconds of title card at the start of Cue 1
const CUT = 0.3;     // dip to black either side of a cut
const INK = '#22170f', MUSTARD = '#e8ad38', MUSTARD_HI = '#f6c45c', CREAM = '242,236,226';
const rnd = makeRand(73113); // the TV's own random stream (grain offsets)
const RING = 2.6;    // seconds a low note's ring takes to open out and fade (the red shot)
const STILL = 0.4;   // reduced motion: how far into each shot its one still is taken
const VIDEO_DEFAULT = [0.7, 0.75, 0.85, 0.35];
const ret = (o, r, g, b, br) => { o[0] = r; o[1] = g; o[2] = b; o[3] = br; return o; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// loudness 0..1 at time s from a track's 160 peaks
function levelAt(track, s) {
  const p = track?.peaks;
  if (!p?.length) return 0;
  const x = Math.max(0, Math.min(p.length - 1, (s / track.duration) * p.length));
  const i = Math.floor(x), f = x - i;
  return p[i] * (1 - f) + (p[Math.min(p.length - 1, i + 1)] ?? 0) * f;
}
// decaying sum of note onsets with pitch in [lo, hi) just before time t
function hits(notes, t, lo, hi, k = 5, span = 1.2) {
  let v = 0;
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.p < lo || n.p >= hi) continue;
    const a = t - n.t;
    if (a >= 0 && a < span) v += Math.exp(-a * k);
  }
  return Math.min(1, v);
}

/* ---------- theater TV ---------- */
export class TVScreen {
  constructor(film, person) {
    this.film = film; this.person = person;
    this.c = makeCanvas(W, H);
    this.g = this.c.getContext('2d');
    this.texture = tex(this.c);
    this.video = null; this.posterImg = null;
    this.hover = false;       // the pointer is over the TV (set by the theater box)
    this.silentT = 0;         // where the silent picture is in Cue 1 (advanced by the theater world)
    this.avg = new THREE.Color('#5a7a9a');
    this.bright = 0.2;
    this.shot = '';
    // pre-rendered grain + vignette. The grain reads the shared rand() exactly 65536 times, as it always
    // has: rooms built after the theater depend on that stream's position.
    this.grain = makeCanvas(256, 256);
    const gg = this.grain.getContext('2d'), id = gg.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = rand() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 12; }
    gg.putImageData(id, 0, 0);
    this.vig = makeCanvas(W, H);
    const vg = this.vig.getContext('2d'), rg = vg.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 460);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,.72)');
    vg.fillStyle = rg; vg.fillRect(0, 0, W, H);
    this.scheds = new Map();
    this.widths = {}; // measured label widths
    this.out = [0, 0, 0, 0]; // what a shot returns: colour and brightness (reused every frame)
    // gradients that never change, made once
    const g0 = this.g;
    const mk = (x0, y0, x1, y1, stops) => { const gr = g0.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
    this.grad = {
      blinds: mk(0, PY, W, PY + PH, [[0, '#1a2c3e'], [1, '#060a12']]),
      night: mk(0, PY, 0, PY + PH, [[0, '#120a0e'], [1, '#050306']]),
      warm: mk(0, PY, 0, PY + PH, [[0, '#120c08'], [0.55, '#21160d'], [1, '#0b0805']]),
      osd: mk(0, H - 120, 0, H, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.72)']]),
      osdTop: mk(0, 0, 0, 60, [[0, 'rgba(0,0,0,.55)'], [1, 'rgba(0,0,0,0)']]),
    };
    const ng = g0.createRadialGradient(W * 0.62, PY + PH * 0.5, 10, W * 0.62, PY + PH * 0.5, 420);
    ng.addColorStop(0, 'rgba(255,50,35,.42)'); ng.addColorStop(1, 'rgba(255,40,30,0)');
    this.grad.neonGlow = ng;
    const lg = g0.createRadialGradient(0, 0, 2, 0, 0, 120);
    lg.addColorStop(0, 'rgba(255,214,150,.75)'); lg.addColorStop(1, 'rgba(255,190,110,0)');
    this.grad.lamp = lg;
    const bl = g0.createRadialGradient(0, 0, 2, 0, 0, 160);
    bl.addColorStop(0, 'rgba(170,200,240,.32)'); bl.addColorStop(1, 'rgba(150,185,230,0)');
    this.grad.bloom = bl;
    this.sample = null; this.sampleAt = 0;
  }

  // Slot for a real trailer: a video URL (and an optional poster image) replace the drawn film.
  // The video is always muted; the cue's audio stays on the speakers.
  // Nothing is fetched until the camera heads for the theater (loadVideo); until then the drawn film runs.
  setVideo(src, poster) {
    const v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.crossOrigin = 'anonymous';
    this.video = v;
    this.videoSrc = src; this.posterSrc = poster;
    const s = makeCanvas(8, 8);
    this.sample = { c: s, g: s.getContext('2d', { willReadFrequently: true }) };
  }
  loadVideo() {
    const v = this.video;
    if (!v || v.src) return;
    if (this.posterSrc) { const im = new Image(); im.crossOrigin = 'anonymous'; im.src = this.posterSrc; this.posterImg = im; }
    v.preload = 'auto';
    v.src = this.videoSrc;
  }
  // play the trailer only while the theater is on screen (and never with reduced motion)
  wantVideo(on) {
    const v = this.video;
    if (!v) return;
    if (on) this.loadVideo();
    if (on && v.paused) v.play().catch(() => {});
    else if (!on && !v.paused) v.pause();
  }

  // the cue's shots: [start, end, name]. Cue 1 opens on the title card.
  schedule(cue) {
    let s = this.scheds.get(cue.id);
    if (s) return s;
    const idx = Math.max(0, this.film.cues.findIndex(c => c.id === cue.id)); // the player's cues are copies
    const D = cue.duration;
    const t0 = idx === 0 ? TITLE : 0;
    const order = idx % 2 === 0 ? ['bars', 'pulse', 'wave'] : ['wave', 'pulse', 'bars'];
    const len = (D - t0) / order.length;
    s = idx === 0 ? [[0, TITLE, 'title']] : [];
    order.forEach((n, i) => s.push([t0 + i * len, t0 + (i + 1) * len, n]));
    this.scheds.set(cue.id, s);
    return s;
  }

  // which of the cue's shots is on at t (an index into schedule(cue))
  shotAt(cue, t) {
    const sch = this.schedule(cue);
    for (let i = 0; i < sch.length; i++) if (t < sch[i][1]) return i;
    return sch.length - 1;
  }

  // mode: 'silent' (the picture runs with the sound off), 'playing' (the cue is on the speakers),
  // 'paused' (the cue is paused at t). time: seconds the world has run (for UI pulses).
  // reduced (reduced motion): each shot is one still, the shot as it stands STILL of the way in (the
  // title card once its words are up); only the bottom bar's time and progress follow t. The theater
  // redraws it only when that changes (world/theater.js).
  draw({ t, cue, mode, reduced, time }) {
    const g = this.g;
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    let level = levelAt(cue, t) * (mode === 'paused' ? 0.35 : 1);
    const v = this.video;
    let cr = 0.6, cg = 0.66, cb = 0.75, br = 0.25, shot = 'video';
    if (v && v.readyState >= 2 && v.videoWidth) {
      drawContain(g, v, v.videoWidth, v.videoHeight);
      const c = this.sampleVideo(v, time);
      cr = c[0]; cg = c[1]; cb = c[2]; br = c[3];
    } else if (v && this.posterImg?.complete && this.posterImg.naturalWidth) {
      drawContain(g, this.posterImg, this.posterImg.naturalWidth, this.posterImg.naturalHeight);
      br = 0.3;
    } else {
      const sch = this.schedule(cue), k = this.shotAt(cue, t);
      const [a, b, name] = sch[k];
      shot = name;
      // the moment the shot is drawn at: now, or with reduced motion the shot's one still
      const ts = !reduced ? t : name === 'title' ? Math.min(b - 0.8, a + 3.4) : a + (b - a) * STILL;
      if (reduced) level = levelAt(cue, ts);
      const lt = Math.max(0, ts - a), len = b - a, notes = cue.notes || [];
      g.save();
      g.beginPath(); g.rect(0, PY, W, PH); g.clip();
      const c = SHOTS[name].call(this, g, lt, len, ts, notes, level, reduced, cue);
      g.restore();
      cr = c[0]; cg = c[1]; cb = c[2]; br = c[3];
      // dip to black around the cuts
      const d = Math.min(t - a + (k === 0 ? 9 : 0), b - t + (k === sch.length - 1 ? 9 : 0));
      if (!reduced && d < CUT) {
        const f = Math.max(0, d / CUT);
        g.fillStyle = `rgba(0,0,0,${(1 - f).toFixed(3)})`; g.fillRect(0, PY, W, PH);
        br *= f;
      }
    }
    this.shot = shot;
    // grain, vignette, letterbox
    if (!reduced) g.drawImage(this.grain, -rnd() * 256, -rnd() * 256, W + 256, H + 256);
    g.drawImage(this.vig, 0, 0);
    if (shot !== 'video') { g.fillStyle = '#000'; g.fillRect(0, 0, W, BAR); g.fillRect(0, H - BAR, W, BAR); }
    else { g.fillStyle = this.grad.osd; g.fillRect(0, H - 120, W, 120); g.fillStyle = this.grad.osdTop; g.fillRect(0, 0, W, 60); }
    this.osd(g, { t, cue, mode, reduced, time, shot });
    this.texture.needsUpdate = true;
    this.avg.setRGB(cr, cg, cb);
    this.bright = Math.max(0, Math.min(1, br));
  }

  // on-screen display: a channel bug, the cue and its time in the bottom bar, and the sound invitation
  osd(g, { t, cue, mode, reduced, time, shot }) {
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    if (shot !== 'title') {
      g.font = `italic 500 20px ${FONT}`; g.fillStyle = `rgba(${CREAM},.5)`;
      g.fillText(this.film.film, 34, 36);
    }
    // bottom bar: cue, progress hairline, time
    const y = H - 18;
    g.font = `500 15px ${FONT}`; g.fillStyle = `rgba(${CREAM},.62)`;
    g.fillText(mode === 'silent' ? `${cue.title}, sound off` : cue.title, 34, y);
    g.textAlign = 'right';
    g.fillText(`${fmt(t)} / ${fmt(cue.duration)}`, W - 34, y);
    g.textAlign = 'left';
    const x0 = 34, x1 = W - 34, ly = H - BAR + 14, p = Math.min(1, t / cue.duration);
    g.fillStyle = `rgba(${CREAM},.18)`; g.fillRect(x0, ly, x1 - x0, 2);
    g.fillStyle = mode === 'playing' ? MUSTARD : `rgba(${CREAM},.55)`; g.fillRect(x0, ly, (x1 - x0) * p, 2);

    if (mode !== 'playing') {
      // the invitation: the same words and colour as the box's button
      const label = mode === 'paused' ? 'Turn the sound back on' : 'Turn the sound on';
      g.font = `600 22px ${FONT}`;
      // measure once the face has loaded (until then the width is the fallback font's)
      const tw = this.widths[label] ?? g.measureText(label).width;
      if (!(label in this.widths) && document.fonts?.check?.(`600 22px ${FONT}`)) this.widths[label] = tw;
      const pw = Math.round(tw + 80), ph = 50, px = Math.round((W - pw) / 2), py = H - BAR - 26 - ph;
      if (!reduced) {
        const k = (time % 2.4) / 2.4, e = 4 + k * 16;
        g.strokeStyle = `rgba(246,196,92,${(0.55 * (1 - k)).toFixed(3)})`; g.lineWidth = 2;
        g.beginPath(); g.roundRect(px - e, py - e, pw + e * 2, ph + e * 2, ph / 2 + e); g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.beginPath(); g.roundRect(px, py + 3, pw, ph, ph / 2); g.fill();
      g.fillStyle = this.hover ? MUSTARD_HI : MUSTARD;
      g.beginPath(); g.roundRect(px, py, pw, ph, ph / 2); g.fill();
      speakerIcon(g, px + 24, py + ph / 2, reduced ? 1 : 0.5 + 0.5 * Math.sin(time * 4.2));
      g.fillStyle = INK; g.textBaseline = 'middle';
      g.fillText(label, px + 60, py + ph / 2 + 1);
      g.textBaseline = 'alphabetic';
    } else if (this.hover) {
      // clicking the picture pauses; say so while the pointer is on it
      const pw = 132, ph = 46, px = (W - pw) / 2, py = H - BAR - 26 - ph;
      g.fillStyle = 'rgba(20,14,10,.72)';
      g.beginPath(); g.roundRect(px, py, pw, ph, ph / 2); g.fill();
      g.fillStyle = `rgb(${CREAM})`;
      g.fillRect(px + 26, py + 14, 6, 18); g.fillRect(px + 38, py + 14, 6, 18);
      g.font = `500 21px ${FONT}`; g.textBaseline = 'middle';
      g.fillText('Pause', px + 58, py + ph / 2 + 1);
      g.textBaseline = 'alphabetic';
    }
  }

  // the trailer's average colour, sampled a few times a second from an 8x8 copy
  sampleVideo(v, time) {
    const S = this.sample;
    if (S && time - this.sampleAt > 0.15) {
      this.sampleAt = time;
      try {
        S.g.drawImage(v, 0, 0, 8, 8);
        const d = S.g.getImageData(0, 0, 8, 8).data;
        let r = 0, gr = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; gr += d[i + 1]; b += d[i + 2]; }
        const n = 64 * 255, m = Math.max(r, gr, b) / n || 1e-3;
        S.v = [r / n / m, gr / n / m, b / n / m, Math.min(0.6, (0.3 * r + 0.59 * gr + 0.11 * b) / n * 1.4)];
      } catch { S.v = VIDEO_DEFAULT; }
    }
    return S?.v || VIDEO_DEFAULT;
  }
}

function drawContain(g, src, sw, sh) {
  const s = Math.min(W / sw, H / sh), dw = sw * s, dh = sh * s;
  g.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function speakerIcon(g, x, y, wave) {
  g.save(); g.translate(x, y);
  g.fillStyle = INK;
  g.beginPath(); g.moveTo(-10, -5); g.lineTo(-4, -5); g.lineTo(3, -11); g.lineTo(3, 11); g.lineTo(-4, 5); g.lineTo(-10, 5); g.closePath(); g.fill();
  g.strokeStyle = INK; g.lineWidth = 2.4; g.lineCap = 'round';
  g.globalAlpha = 0.45 + 0.55 * wave;
  g.beginPath(); g.arc(4, 0, 8, -0.8, 0.8); g.stroke();
  g.globalAlpha = 0.25 + 0.75 * wave * wave;
  g.beginPath(); g.arc(4, 0, 14, -0.8, 0.8); g.stroke();
  g.restore();
}

/* ---------- the shots. Each draws into the picture area and returns [r, g, b, brightness]:
   the picture's colour (max channel ~1) and how much light it throws into the room.
   There is no footage yet, so after the title card the picture is the score itself, drawn abstractly
   from the cue's notes and peaks: nothing here stands for a scene, a character or a place in the film. ---------- */
const SHOTS = {
  // black, a striped light drifting across, the title and the credits
  title(g, lt, len, t, notes, level, reduced) {
    g.fillStyle = '#040507'; g.fillRect(0, PY, W, PH);
    const a1 = smooth(0.3, 1.6, lt) * (1 - smooth(len - 0.7, len - 0.1, lt));
    const a2 = smooth(1.5, 2.8, lt) * (1 - smooth(len - 0.7, len - 0.1, lt));
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.translate(-150 + lt * 46, PY - 40); g.rotate(-0.36);
    for (let i = 0; i < 9; i++) {
      g.fillStyle = `rgba(226,214,180,${(0.075 * (1 - i / 11) * (0.4 + a1)).toFixed(3)})`;
      g.fillRect(-80, 20 + i * 34, 900, 19);
    }
    g.restore();
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = `rgba(${CREAM},${a1.toFixed(3)})`;
    // set high enough that the credits clear the "Turn the sound on" pill drawn below them
    const ty = PY + PH * 0.45;
    g.font = `italic 500 100px ${FONT}`;
    g.fillText(this.film.film, W / 2, ty);
    g.fillStyle = `rgba(${CREAM},${(a2 * 0.82).toFixed(3)})`;
    g.font = `400 22px ${FONT}`;
    g.fillText(`A film by ${this.film.director}`, W / 2, ty + 44);
    g.fillText(`${this.film.role} by ${this.person.name}`, W / 2, ty + 72);
    g.textAlign = 'left';
    return ret(this.out, 0.85, 0.84, 0.82, 0.05 + 0.12 * a1);
  },

  // cool: bands of light drifting across a blue dark, brighter with the cue's loudness; the notes cross
  // as streaks of light past a playhead (pitch = height, left hand blue, right hand warm)
  bars(g, lt, len, t, notes, level, reduced) {
    const L = reduced ? 0.55 : 0.3 + level * 0.8 + hits(notes, t, 0, 50, 6) * 0.12;
    const push = 1 + 0.07 * (reduced ? 0.5 : lt / len);
    g.save();
    g.translate(W / 2, PY + PH / 2); g.scale(push, push); g.translate(-W / 2, -(PY + PH / 2));
    g.fillStyle = this.grad.blinds; g.fillRect(-20, PY - 20, W + 40, PH + 40);
    g.save();
    g.translate(W * 0.48, PY - 20); g.rotate(-0.42 + (reduced ? 0 : Math.sin(t * 0.25) * 0.02));
    for (let i = 0; i < 10; i++) {
      g.fillStyle = `rgba(226,214,180,${((0.26 + L * 0.5) * (1 - i / 14)).toFixed(3)})`;
      g.fillRect(-60, 10 + i * 32, 600, 18);
    }
    g.restore();
    const px = 120, now = W * 0.46;
    // a soft bloom on the playhead that swells with the loudness
    g.globalCompositeOperation = 'lighter';
    g.save(); g.translate(now, PY + PH / 2); g.scale(0.7 + level * 0.9, 1.4 + level * 0.8);
    g.fillStyle = this.grad.bloom; g.fillRect(-160, -160, 320, 320);
    g.restore();
    for (const n of notes) {
      const x = now + (n.t - t) * px;
      const w = Math.max(6, n.d * px);
      if (x > W || x + w < 0) continue;
      const y = PY + PH - 24 - ((n.p - 28) / 70) * (PH - 48);
      const on = t >= n.t && t < n.t + n.d;
      const k = on ? 1 : Math.max(0.15, 0.55 - Math.abs(n.t - t) * 0.08);
      g.fillStyle = `rgba(${n.h === 'l' ? '110,160,215' : '235,200,140'},${(0.16 * k).toFixed(3)})`;
      g.fillRect(x, y - 8, w, 16);
      g.fillStyle = `rgba(${n.h === 'l' ? '175,215,250' : '255,236,200'},${(0.85 * k).toFixed(3)})`;
      g.fillRect(x, y - 1.5, w, 3);
    }
    g.fillStyle = 'rgba(255,240,215,.14)'; g.fillRect(now, PY, 2, PH);
    g.restore();
    return ret(this.out, 0.66, 0.74, 0.9, 0.16 + 0.42 * L);
  },

  // red: a slow red bloom that flares on the low notes, a ring opening out from it on every low note,
  // the high notes as points of light
  pulse(g, lt, len, t, notes, level, reduced) {
    const low = hits(notes, t, 0, 50, 5);
    const glow = Math.min(1, 0.32 + 0.68 * low + level * 0.15);
    const cx = W * 0.62, cy = PY + PH * 0.5;
    g.fillStyle = this.grad.night; g.fillRect(0, PY, W, PH);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = glow; g.fillStyle = this.grad.neonGlow; g.fillRect(0, PY, W, PH); g.globalAlpha = 1;
    // a faint fixed scale of rings, slowly turning ticks on the outer one
    g.strokeStyle = 'rgba(255,110,90,.07)'; g.lineWidth = 1;
    for (let r = 70; r < 420; r += 70) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }
    const spin = reduced ? 0 : t * 0.12;
    g.fillStyle = 'rgba(255,130,110,.16)';
    for (let i = 0; i < 48; i++) { const a = spin + i * Math.PI / 24, r = 140; g.fillRect(cx + Math.cos(a) * r - 1, cy + Math.sin(a) * r - 1, 2, 2); }
    // rings: one per low note in the last few seconds, opening out and fading
    let drawn = 0;
    for (let i = 0; i < notes.length && drawn < 8; i++) {
      const n = notes[i];
      if (n.p >= 50) continue;
      const a = reduced ? 0.3 + drawn * 0.6 : t - n.t;
      if (a < 0 || a > RING) continue;
      drawn++;
      const k = 1 - a / RING, r = 16 + a * 150, col = n.h === 'l' ? '255,84,64' : '255,120,96';
      g.strokeStyle = `rgba(${col},${(0.16 * k * k).toFixed(3)})`; g.lineWidth = 9;
      g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
      g.strokeStyle = `rgba(${col},${(0.75 * k * k).toFixed(3)})`; g.lineWidth = 1.8;
      g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    }
    // the core
    g.fillStyle = `rgba(255,170,150,${(0.25 + 0.6 * glow).toFixed(3)})`;
    g.beginPath(); g.arc(cx, cy, 5 + 9 * low, 0, 7); g.fill();
    // high notes: points of light that flare and fade
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (n.p < 58) continue;
      const a = t - n.t;
      if (a < 0 || a > 1.6) continue;
      const k = Math.exp(-a * 2.2);
      const x = 30 + ((n.p * 97 + i * 61) % (W - 60)), y = PY + 18 + ((n.p * 53 + i * 37) % (PH - 36));
      g.fillStyle = `rgba(255,${n.h === 'l' ? 150 : 210},${n.h === 'l' ? 140 : 190},${(0.85 * k).toFixed(3)})`;
      g.beginPath(); g.arc(x, y, 2.5 + 3 * k, 0, 7); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    return ret(this.out, 1, 0.24 + 0.14 * (1 - glow), 0.22 + 0.14 * (1 - glow), 0.1 + 0.36 * glow);
  },

  // amber: the cue's loudness (its peaks) as a mirrored band of light scrolling past a playhead, lit
  // where it has played; the notes as sparks riding its edge
  wave(g, lt, len, t, notes, level, reduced, cue) {
    g.fillStyle = this.grad.warm; g.fillRect(0, PY, W, PH);
    const p = cue.peaks || [], D = cue.duration, N = p.length;
    const now = W * 0.5, cy = PY + PH * 0.54, amp = PH * 0.36, step = 14, span = (W / step) * (D / Math.max(1, N)); // seconds across the picture
    const pps = W / span; // px per second
    // the playhead's warm light, its size following the loudness
    g.globalCompositeOperation = 'lighter';
    g.save(); g.translate(now, cy); g.scale(1.2 + level * 1.6, 0.9 + level * 0.9);
    g.fillStyle = this.grad.lamp; g.fillRect(-120, -120, 240, 240);
    g.restore();
    if (N) {
      const first = Math.floor((t - now / pps) / D * N) - 1, last = Math.ceil((t + (W - now) / pps) / D * N) + 1;
      for (let i = Math.max(0, first); i <= Math.min(N - 1, last); i++) {
        const ts = (i / N) * D, x = now + (ts - t) * pps;
        const h = Math.max(1.5, p[i] * amp);
        const past = ts <= t;
        const near = Math.max(0, 1 - Math.abs(ts - t) / 2.5);
        g.fillStyle = past ? `rgba(246,196,92,${(0.38 + 0.4 * near).toFixed(3)})` : `rgba(${CREAM},${(0.1 + 0.12 * near).toFixed(3)})`;
        g.fillRect(x - step * 0.32, cy - h, step * 0.64, h * 2);
      }
    }
    // the notes, as sparks on the band's upper edge at the moment they sound
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const x = now + (n.t - t) * pps;
      if (x < -8 || x > W + 8) continue;
      const a = t - n.t, k = a >= 0 && a < 1.2 ? Math.exp(-a * 3) : 0;
      const y = cy - Math.max(6, levelAt(cue, n.t) * amp) - 8 - ((n.p - 36) / 48) * 26;
      g.fillStyle = `rgba(255,${n.h === 'l' ? 196 : 232},${n.h === 'l' ? 120 : 186},${(0.22 + 0.7 * k).toFixed(3)})`;
      g.beginPath(); g.arc(x, y, 2 + 3 * k, 0, 7); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(255,240,215,.22)'; g.fillRect(now - 1, PY, 2, PH);
    return ret(this.out, 1, 0.72, 0.42, 0.14 + 0.38 * level);
  },
};
