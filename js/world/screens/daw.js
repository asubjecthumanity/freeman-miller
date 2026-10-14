// The studio computer (owner: studio): a DAW in session view, drawn on a canvas (no logos, no
// product names). Tracks in columns with coloured clips, scenes that launch in time with the
// playing track (120 bpm), a flashing "next scene" cue, progress pies, mixer meters, and a detail
// view with the playing track's own waveform and a playhead. Static chrome is drawn once into a
// cached layer; each frame only paints what moves.
import { makeRand } from '../kit.js';
import { tex, makeCanvas, FONT, fmt } from './shared.js';

const W = 800, H = 500;
const COL = ['#ef8f3a', '#e8c63a', '#86c64a', '#3fbfb2', '#6a86e8', '#b46ae8', '#e8679a', '#d9d2bf'];
const TRACKS = ['Drums', 'Bass', 'Keys', 'Guitar', 'Strings', 'Vox', 'Synth', 'FX'];
const SCENES = ['Intro', 'Verse', 'Lift', 'Chorus', 'Verse 2', 'Bridge', 'Outro'];
const CLIPS = ['Beat', 'Low', 'Chords', 'Riff', 'Pad', 'Take', 'Arp', 'Rise'];
// layout
const TOP = 30, BROW = 116, X0 = BROW + 8, CW = 70, GAP = 3, HEAD = 18, ROWH = 22, MASTER = X0 + 8 * (CW + GAP) + 4;
const GRID = TOP + 8 + HEAD + 2, MIX = GRID + SCENES.length * ROWH + 26, DET = 372;

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, Math.round(v * k))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export class DAWScreen {
  // tracks: the studio's own tracks (otherMusic), for the default title and optional clip colours
  constructor(tracks = []) {
    this.c = makeCanvas(W, H);
    this.g = this.c.getContext('2d');
    this.texture = tex(this.c);
    this.studio = tracks;
    this.track = null;
    const rnd = makeRand(808);
    // which clip slots hold clips (most do), per track column and scene row
    this.grid = TRACKS.map((_, col) => SCENES.map((_, row) => (row === 0 && col > 3 ? null : rnd() > 0.2 ? true : null)));
    this.bg = makeCanvas(W, H);
    this.key = '';
    this.paintStatic();
  }
  // the playing (or last played) track, from any room; null for none
  setTrack(track) {
    if (track === this.track) return;
    this.track = track;
    this.paintStatic();
    this.key = '';
  }
  get title() { return (this.track || this.studio[0])?.title || 'Untitled'; }
  get colour() { const t = this.track || this.studio[0]; return t?.clipColor || COL[3]; }

  paintStatic() {
    const g = this.bg.getContext('2d');
    g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, W, H);
    // title bar and transport strip
    g.fillStyle = '#1f1f1f'; g.fillRect(0, 0, W, 12);
    g.fillStyle = '#9a9a9a'; g.font = `500 9px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(this.title, W / 2, 6.5);
    for (const [i, c] of ['#e2655a', '#e8b43a', '#5ec25a'].entries()) { g.fillStyle = c; g.beginPath(); g.arc(9 + i * 11, 6, 3, 0, 7); g.fill(); }
    g.fillStyle = '#2a2a2a'; g.fillRect(0, 12, W, TOP - 12);
    g.textAlign = 'left';
    box(g, 6, 15, 42, 12, '#4a4a4a'); txt(g, '120.00', 10, 21.5, '#e8e8e8', 9);
    box(g, 52, 15, 28, 12, '#4a4a4a'); txt(g, '4 / 4', 56, 21.5, '#d0d0d0', 9);
    g.fillStyle = '#6a6a6a'; g.beginPath(); g.arc(90, 21, 4, 0, 7); g.fill();
    box(g, 100, 15, 34, 12, '#4a4a4a'); txt(g, '1 Bar', 104, 21.5, '#d0d0d0', 9);
    box(g, W - 92, 15, 50, 12, '#4a4a4a'); txt(g, 'CPU 12 %', W - 88, 21.5, '#cfcfcf', 8);
    for (let i = 0; i < 2; i++) { g.fillStyle = '#5a5a5a'; g.fillRect(W - 34 + i * 12, 16, 9, 10); }
    // browser
    g.fillStyle = '#323232'; g.fillRect(0, TOP, BROW, DET - TOP - 4);
    txt(g, 'Collections', 8, TOP + 12, '#8a8a8a', 9);
    ['Favourites', 'Sounds', 'Drums', 'Instruments', 'Audio effects', 'MIDI effects', 'Samples', 'Clips'].forEach((s, i) => {
      if (i === 2) { g.fillStyle = '#4a5a6a'; g.fillRect(4, TOP + 23 + i * 15, BROW - 8, 14); }
      txt(g, s, 12, TOP + 30 + i * 15, i === 2 ? '#ffffff' : '#c8c8c8', 9.5);
    });
    txt(g, 'Places', 8, TOP + 160, '#8a8a8a', 9);
    ['Current project', 'Packs', 'Recordings', 'Stems'].forEach((s, i) => txt(g, s, 12, TOP + 178 + i * 15, '#c8c8c8', 9.5));
    for (let i = 0; i < 6; i++) { g.fillStyle = '#3c3c3c'; g.fillRect(4, TOP + 248 + i * 13, BROW - 8, 11); g.fillStyle = '#595959'; g.fillRect(10, TOP + 251 + i * 13, 50 + (i * 17) % 40, 5); }
    // track headers, empty slots, stop buttons
    TRACKS.forEach((name, col) => {
      const x = X0 + col * (CW + GAP), c = COL[col];
      g.fillStyle = c; g.fillRect(x, TOP + 8, CW, HEAD);
      txt(g, name, x + 5, TOP + 8 + HEAD / 2 + 0.5, '#1d1d1d', 9.5, 600);
      SCENES.forEach((_, row) => {
        const y = GRID + row * ROWH;
        g.fillStyle = '#2c2c2c'; g.fillRect(x, y, CW, ROWH - 2);
        if (!this.grid[col][row]) { g.fillStyle = '#474747'; g.fillRect(x + 6, y + 6, 8, 8); return; }
        g.fillStyle = shade(c, 0.62); g.fillRect(x, y, CW, ROWH - 2);
        g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.moveTo(x + 6, y + 5); g.lineTo(x + 13, y + 10); g.lineTo(x + 6, y + 15); g.fill();
        txt(g, CLIPS[(col + row * 3) % CLIPS.length], x + 17, y + 10.5, 'rgba(0,0,0,.72)', 8.5, 500);
      });
      const sy = GRID + SCENES.length * ROWH;
      g.fillStyle = '#2c2c2c'; g.fillRect(x, sy, CW, 14);
      g.fillStyle = '#5a5a5a'; g.fillRect(x + CW / 2 - 4, sy + 3, 8, 8);
      // mixer strip: meter well, volume fader, pan knob, activator, solo, arm
      g.fillStyle = '#2e2e2e'; g.fillRect(x, MIX, CW, DET - MIX - 10);
      g.fillStyle = '#1b1b1b'; g.fillRect(x + CW - 16, MIX + 6, 9, DET - MIX - 24);
      g.fillStyle = '#555'; g.fillRect(x + 12, MIX + 10, 3, DET - MIX - 32);
      g.fillStyle = '#d6d6d6'; g.fillRect(x + 6, MIX + 10 + ((col * 7) % 20) + 14, 15, 5);
      g.strokeStyle = '#8a8a8a'; g.lineWidth = 1.5; g.beginPath(); g.arc(x + 34, MIX + 18, 7, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
      g.strokeStyle = c; g.beginPath(); g.moveTo(x + 34, MIX + 18); g.lineTo(x + 34 + Math.cos(-1.4 + col * 0.35) * 7, MIX + 18 + Math.sin(-1.4 + col * 0.35) * 7); g.stroke();
      box(g, x + 26, MIX + 32, 16, 11, '#e8c63a'); txt(g, String(col + 1), x + 31, MIX + 38, '#1d1d1d', 8, 600);
      box(g, x + 26, MIX + 46, 16, 11, '#4a4a4a'); txt(g, 'S', x + 31, MIX + 52, '#cfcfcf', 8, 600);
    });
    // master column: scene names and launchers, master meter
    g.fillStyle = '#4a4a4a'; g.fillRect(MASTER, TOP + 8, W - MASTER - 6, HEAD);
    txt(g, 'Main', MASTER + 6, TOP + 8 + HEAD / 2 + 0.5, '#e8e8e8', 9.5, 600);
    SCENES.forEach((s, row) => {
      const y = GRID + row * ROWH;
      g.fillStyle = '#343434'; g.fillRect(MASTER, y, W - MASTER - 6, ROWH - 2);
      g.fillStyle = '#7a7a7a'; g.beginPath(); g.moveTo(MASTER + 6, y + 5); g.lineTo(MASTER + 13, y + 10); g.lineTo(MASTER + 6, y + 15); g.fill();
      txt(g, s, MASTER + 18, y + 10.5, '#d6d6d6', 9);
    });
    g.fillStyle = '#2e2e2e'; g.fillRect(MASTER, MIX, W - MASTER - 6, DET - MIX - 10);
    g.fillStyle = '#1b1b1b'; g.fillRect(MASTER + 8, MIX + 6, 9, DET - MIX - 24); g.fillRect(MASTER + 20, MIX + 6, 9, DET - MIX - 24);
    // detail view: the clip's waveform
    g.fillStyle = '#262626'; g.fillRect(0, DET, W, H - DET);
    g.fillStyle = this.colour; g.fillRect(6, DET + 8, 110, 16);
    txt(g, 'Clip', 10, DET + 16.5, '#1d1d1d', 9, 600);
    txt(g, this.title, 8, DET + 36, '#e0e0e0', 9.5, 500);
    ['Start  1.1.1', 'End  17.1.1', 'Loop  on', 'Warp  on'].forEach((s, i) => txt(g, s, 8, DET + 56 + i * 14, '#a8a8a8', 8.5));
    g.fillStyle = '#1c1c1c'; g.fillRect(124, DET + 8, W - 130, H - DET - 16);
    // bar ruler
    for (let b = 0; b <= 16; b++) { const x = 124 + (W - 130) * b / 16; g.fillStyle = '#4a4a4a'; g.fillRect(x, DET + 8, 1, b % 4 ? 5 : 9); if (b % 4 === 0 && b < 16) txt(g, String(b + 1), x + 3, DET + 14, '#8a8a8a', 8); }
    // waveform of the current track's peaks
    const peaks = (this.track || this.studio[0])?.peaks;
    const wx = 124, ww = W - 130, wy = DET + 24 + (H - DET - 34) / 2, wh = (H - DET - 40) / 2;
    g.fillStyle = shade(this.colour, 0.75);
    if (peaks?.length) for (let i = 0; i < ww; i += 2) { const v = peaks[Math.floor(i / ww * peaks.length)] || 0; g.fillRect(wx + i, wy - v * wh, 1.5, Math.max(1, v * wh * 2)); }
    this.waveRect = { wx, ww, y: DET + 20, h: H - DET - 30 };
  }

  // t: track time (s); playing; level 0..1; time: world clock; duration (s) of the track
  // returns true when the texture changed
  draw({ t = 0, playing, level = 0, time = 0, duration = 30 }) {
    const blink = Math.floor(time * 2) % 2;
    const key = playing ? null : `${blink}|${this.title}|${(t || 0).toFixed(1)}`;
    if (key && key === this.key) return false;
    this.key = key;
    const g = this.g;
    g.drawImage(this.bg, 0, 0);
    const beat = t * 2, bar = Math.floor(beat / 4);
    const scene = playing || t > 0 ? Math.floor(bar / 2) % SCENES.length : -1;
    const next = playing && (beat % 8) >= 7 ? (scene + 1) % SCENES.length : -1;
    // transport: play (green while playing), stop, record arm, position counter
    g.fillStyle = playing ? '#86d34a' : '#9a9a9a';
    g.beginPath(); g.moveTo(W / 2 - 34, 15); g.lineTo(W / 2 - 24, 21); g.lineTo(W / 2 - 34, 27); g.fill();
    g.fillStyle = '#9a9a9a'; g.fillRect(W / 2 - 18, 16, 10, 10);
    g.fillStyle = blink && !playing ? '#e2655a' : '#7a4a44'; g.beginPath(); g.arc(W / 2 + 4, 21, 5, 0, 7); g.fill();
    box(g, W / 2 + 16, 15, 66, 12, '#4a4a4a');
    txt(g, `${bar + 1}. ${Math.floor(beat % 4) + 1}. ${Math.floor((beat % 1) * 4) + 1}`, W / 2 + 21, 21.5, '#f0f0f0', 9);
    // metronome dot
    if (playing) { g.fillStyle = Math.floor(beat) % 4 === 0 ? '#e8c63a' : '#c8c8c8'; g.beginPath(); g.arc(90, 21, 4 * (1 - (beat % 1) * 0.6), 0, 7); g.fill(); }
    // clips: the playing scene lit with progress pies, the next scene flashing before it launches
    for (let col = 0; col < TRACKS.length; col++) {
      const x = X0 + col * (CW + GAP), c = COL[col];
      for (const row of [scene, next]) {
        if (row < 0 || !this.grid[col][row]) continue;
        const y = GRID + row * ROWH, live = row === scene;
        if (!live && Math.floor(beat * 4) % 2) continue;
        g.fillStyle = live ? c : shade(c, 0.85); g.fillRect(x, y, CW, ROWH - 2);
        g.fillStyle = live ? '#16a34a' : '#1d1d1d';
        g.beginPath(); g.moveTo(x + 6, y + 5); g.lineTo(x + 13, y + 10); g.lineTo(x + 6, y + 15); g.fill();
        txt(g, CLIPS[(col + row * 3) % CLIPS.length], x + 17, y + 10.5, 'rgba(0,0,0,.8)', 8.5, 500);
        if (live) {
          const p = (beat % 8) / 8;
          g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.moveTo(x + CW - 10, y + 10); g.arc(x + CW - 10, y + 10, 6, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); g.fill();
        }
      }
      // meters
      const lv = playing ? Math.min(1, level * (0.5 + 0.55 * Math.abs(Math.sin(time * (3.2 + col * 0.9) + col * 1.3)))) * (this.grid[col][Math.max(0, scene)] ? 1 : 0.15) : 0;
      const mh = DET - MIX - 24, my = MIX + 6;
      meter(g, x + CW - 15, my, 7, mh, lv);
      // record arm on the vocal track blinks while idle
      const arm = col === 5;
      box(g, x + 46, MIX + 46, 16, 11, arm ? (playing || blink ? '#e2655a' : '#6a3a36') : '#4a4a4a');
      g.fillStyle = arm ? '#1d1d1d' : '#9a9a9a'; g.beginPath(); g.arc(x + 54, MIX + 51.5, 2.5, 0, 7); g.fill();
    }
    // scene launcher for the playing scene, master meters
    if (scene >= 0) { const y = GRID + scene * ROWH; g.fillStyle = '#16a34a'; g.beginPath(); g.moveTo(MASTER + 6, y + 5); g.lineTo(MASTER + 13, y + 10); g.lineTo(MASTER + 6, y + 15); g.fill(); }
    const mlv = playing ? Math.min(1, level * 1.05) : 0;
    meter(g, MASTER + 9, MIX + 7, 7, DET - MIX - 26, mlv);
    meter(g, MASTER + 21, MIX + 7, 7, DET - MIX - 26, mlv * (0.92 + 0.08 * Math.sin(time * 9)));
    // detail view: loop brace and the playhead over the waveform
    const { wx, ww, y, h } = this.waveRect;
    const p = Math.min(1, Math.max(0, t / duration));
    g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(wx, y, ww * p, h);
    g.fillStyle = '#f2f2f2'; g.fillRect(wx + ww * p, y - 6, 1.5, h + 6);
    g.fillStyle = '#8a8a8a'; g.fillRect(wx, y - 4, ww, 3);
    txt(g, `${fmt(t)} / ${fmt(duration)}`, W - 64, H - 12, '#9a9a9a', 8.5);
    this.texture.needsUpdate = true;
    return true;
  }
}

function box(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function txt(g, s, x, y, c, size = 9, weight = 400) { g.fillStyle = c; g.font = `${weight} ${size}px ${FONT}`; g.textBaseline = 'middle'; g.fillText(s, x, y); }
function meter(g, x, y, w, h, v) {
  const n = 22, sh = h / n;
  const lit = Math.round(v * n);
  for (let i = 0; i < lit; i++) {
    g.fillStyle = i > n * 0.85 ? '#e2655a' : i > n * 0.65 ? '#e8c63a' : '#5ec25a';
    g.fillRect(x, y + h - (i + 1) * sh + 0.5, w, sh - 1);
  }
}
