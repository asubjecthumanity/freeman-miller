// Canvas painters shared by the office's 3D screens (js/world/screens/office-monitor.js) and its
// full-viewport HTML desktop (js/ui/office-sessions.js), so both show the same picture. No imports:
// the HTML side must not pull in three.js. Owner: office.
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

// the sessions app palette (kept in step with the --s-* tokens in css/rooms/office.css)
export const PAL = {
  bg: '#10282f', bg2: '#0b1f25', raise: '#163640', line: '#2c5560',
  ink: '#eef3ef', ink2: '#a9c2c0', mustard: '#e8ad38', teal: '#5fb3ad', rose: '#e29a8a',
};

// deterministic noise for drawn "text"
const hash = n => { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; };

export { hash };

/* ---------- the promo film's captions and transcript (office-sessions.js renders them; the 3D display paints the transcript's summary) ---------- */
// A film gets a captions track and a transcript (WCAG 1.2.2, 1.2.3, 1.2.5) from its data:
// `video.captions` (a .vtt file, relative to shared/) and `video.transcript` ({ note, lines: [[time, text]] }
// or plain text). Until the data has them, the Better Docs film's come from its own shooting script and
// cue sheet (better-docs/promo/script.json, cues.json: every super and fine print as it appears, the sound
// as described there). The film has no speech: its captions describe the music and sound effects.
const FILMS = {
  'better-docs-promo.mp4': {
    cues: [
      ['00:00.000', '00:03.900', '[A tense, ticking beat. Keys clack, mouse clicks, tabs whoosh past.]'],
      ['00:04.000', '00:06.000', '[A bright chord: the music turns cheerful.]'],
      ['00:06.000', '00:09.500', '[Upbeat music. A click and a pop as each helper is planted.]'],
      ['00:09.500', '00:12.000', '[A right-click, a whoosh, and a "nom" as the text lands.]'],
      ['00:12.000', '00:16.000', '[Keys clack; each copy lands with a higher "nom". A snare fill.]'],
      ['00:16.000', '00:20.000', '[The music drops to a soft pad. Typing, a pause, then two chimes as the fixes land.]'],
      ['00:20.000', '00:24.000', '[The beat returns. A cascade of pops, then quick flips.]'],
      ['00:24.000', '00:26.000', '[A padlock clicks. A drum roll builds.]'],
      ['00:26.000', '00:29.800', '[A final chord and crash, three "nom"s, and a gentle melody fades out.]'],
    ],
    transcript: {
      note: 'No speech: music and sound effects. Everything the film says is on screen.',
      lines: [
        ['0:00', '"Copy. Switch tabs. Find your spot. Paste. Repeat." Text from a web page about octopuses is copied into a Google Doc of ocean research notes, by hand, faster and faster, until the tabs pile up.'],
        ['0:04', 'The mess collapses into the Better Docs icon. "Better Docs. Copy from anywhere. Land it in your doc."'],
        ['0:06', '"Plant helpers in your doc." From the Better Docs panel, helpers A, B and C are planted under Facts, Quotes and Questions.'],
        ['0:10', '"Highlight. Right-click. Send." Text highlighted on a web page is sent from the right-click menu and lands just before helper A.'],
        ['0:12', '"Or just copy." Send on copy is turned on, and two plain copies land at helpers B and C. "Copies take turns: A, B, C", then back to A. Small print: "Send on copy is opt-in and asks for access to all sites. Sequences shortened."'],
        ['0:16', '"Plus: Autogramulate." With Fix grammar as I type on, a sloppy sentence is typed. "Pause. Spelling and grammar, fixed." A lowercase i becomes I and a doubled "the" goes, listed under Recent fixes with Undo.'],
        ['0:20', '"As many helpers as you like." A grid of helper creatures. "Too cute for work? Go Simple." The look switches from Fun to Simple and back.'],
        ['0:24', '"Private. Talks only to Google." A diagram joins Your browser to Google Docs.'],
        ['0:26', 'End card: "Better Docs for Google Docs. Copy from anywhere. Land it in your doc." An Add to Chrome button. Small print: "Chrome extension. Not affiliated with Google."'],
      ],
    },
  },
};
// a film's captions cues and transcript: the data's transcript first, else the film's own (FILMS)
export const filmText = v => { const f = FILMS[String(v?.src || '').split('/').pop()] || {}; return { cues: f.cues, transcript: v?.transcript ?? f.transcript }; };
/* ---------- the evening outside (and the wallpaper) ---------- */
// horizon: where the sky meets the hills, as a fraction of the height. Things are drawn small, as if
// far off across the valley, because the painting hangs just outside the glass.
export function paintDusk(g, w, h, { horizon = 0.52, stars = true, rnd = Math.random } = {}) {
  const H0 = h * horizon;
  const sky = g.createLinearGradient(0, 0, 0, H0);
  sky.addColorStop(0, '#141938'); sky.addColorStop(0.45, '#283063'); sky.addColorStop(0.72, '#5d4f86');
  sky.addColorStop(0.9, '#b9839a'); sky.addColorStop(1, '#eeaf8c');
  g.fillStyle = sky; g.fillRect(0, 0, w, H0 + 2);
  if (stars) {
    for (let i = 0; i < 90; i++) {
      const x = rnd() * w, y = rnd() * H0 * 0.7, r = (rnd() < 0.1 ? 1.4 : 0.7) * w / 1024;
      g.fillStyle = `rgba(255,248,230,${0.3 + rnd() * 0.55})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    // a young moon, low in the west-ish sky
    const mx = w * 0.7, my = H0 * 0.42, mr = w * 0.009;
    g.fillStyle = '#fff3d6'; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill();
    g.fillStyle = '#2a3164'; g.beginPath(); g.arc(mx + mr * 0.45, my - mr * 0.18, mr * 0.9, 0, 7); g.fill();
  }
  // far hills, a tree line across the valley, the near slope in shadow
  const ridge = (base, amp, f, ph, col) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += w / 96) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x / w * f + ph)) - amp * 0.3 * Math.sin(x / w * f * 3.1 + ph * 2));
    g.lineTo(w, h); g.closePath(); g.fill();
  };
  ridge(H0 + h * 0.004, h * 0.022, 6, 1.2, '#4d4774');
  ridge(H0 + h * 0.016, h * 0.016, 13, 0.3, '#363660');
  g.fillStyle = '#23254a';
  for (let i = 0; i < 240; i++) {
    const x = rnd() * w, r = (0.003 + rnd() * 0.006) * w, y = H0 + h * 0.028 - r * (0.4 + rnd() * 0.9);
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  g.fillRect(0, H0 + h * 0.026, w, h);
  // a few lit windows across the valley
  for (const [fx, fy] of [[0.16, 0.03], [0.43, 0.034], [0.62, 0.029], [0.81, 0.036]]) { g.fillStyle = 'rgba(255,200,130,.95)'; g.fillRect(fx * w, H0 + fy * h, w * 0.0018, w * 0.0013); }
  const lawn = g.createLinearGradient(0, H0 + h * 0.05, 0, h);
  lawn.addColorStop(0, '#1b2333'); lawn.addColorStop(1, '#10141c');
  g.fillStyle = lawn; g.fillRect(0, H0 + h * 0.05, w, h);
}

/* ---------- the window with its content cleared: what the display shows while an app with a layout of
   its own (phones, short landscape) fades in over it (office.js, the `blank` plane over the window) ---------- */
export function paintBlankWindow(g, w, h, k) {
  g.clearRect(0, 0, w, h);
  g.save(); rr(g, 0, 0, w, h, 12 * k); g.clip();
  g.fillStyle = PAL.bg; g.fillRect(0, 0, w, h);
  g.fillStyle = PAL.bg2; g.fillRect(0, 0, w, 86 * k); g.fillRect(0, h - 34 * k, w, 34 * k);
  g.fillStyle = '#5d6f73';
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc((19.5 + i * 18) * k, 20 * k, 5.5 * k, 0, 7); g.fill(); }
  g.restore();
}

/* ---------- layout of the sessions window, in units of the display (shared with the HTML) ---------- */
// fractions of the display width/height at the 16:10 design size (1440 x 900 CSS px)
export const DESKTOP = {
  agents: { x: 24 / 1440, y: 20 / 900, w: 232 / 1440, h: 690 / 900 },
  win: { x: 280 / 1440, y: 20 / 900, w: 1140 / 1440, h: 860 / 900 },
};

// Screens whose sessions app has a layout of its own (css/rooms/office.css): phones (one column, the
// window is the whole screen) and short landscape screens such as a phone on its side (the window takes
// the screen). The query is the house's phone query plus its short-landscape one.
export const ownLayout = (vw, vh) => vw / vh <= 0.8 || (vw <= 760 && vh >= 501) || vh <= 500;

// The HTML desk at a viewport of vw x vh CSS px, in CSS px, as css/rooms/office.css lays it out: the
// window, the agents column beside it, the title bar / tab strip / status bar rows and the tab padding.
// The 3D display paints this layout, fitted into the glass, so that during the hand-over the real HTML
// (pinned onto the glass) lands on the same picture at any window size. Screens with a layout of their
// own (ownLayout) still get a whole desk on the 3D display, agents and all: phones the 1440 x 900 one, a
// short landscape screen the desk of its own proportions at 900 tall. Their app grows out of the
// display's window instead, after its content has cleared (`own`, office.js and office-sessions.js).
export function deskLayout(vw, vh) {
  const own = ownLayout(vw, vh);
  if (vw / vh <= 0.8 || (vw <= 760 && vh >= 501)) { vw = 1440; vh = 900; }
  else if (vh <= 500) { vw = Math.round(vw * 900 / vh); vh = 900; }
  const wx = Math.max(270, 0.19444 * vw), wy = 0.022222 * vh;
  const win = { x: wx, y: wy, w: vw - wx - 0.013889 * vw, h: vh - 2 * wy };
  const tight = vw <= 1366;
  return {
    vw, vh, win, own,
    agents: { x: 0.016667 * vw, y: 0.022222 * vh, w: 0.16111 * vw, h: 0.76667 * vh },
    rows: { bar: 40, tabs: 46, tab: 40, status: 34 },
    tab: tight ? { l: 25, r: 11, dot: 14, line: 9 } : { l: 29, r: 15, dot: 17, line: 12 },
    count: true,
  };
}

/* ---------- agents at work: three panes of streaming lines with progress ---------- */
const PANES = [{ rate: 1.7, ph: 0.2, period: 23, hue: PAL.teal }, { rate: 1.1, ph: 3.1, period: 37, hue: PAL.mustard }, { rate: 2.3, ph: 5.7, period: 17, hue: PAL.rose }];
// draws the column into a canvas of any size (designed at 256 x 762); t in seconds
export function drawAgents(g, W, H, t) {
  const k = W / 256;
  g.clearRect(0, 0, W, H);
  const ph = (H - 2 * 14 * k) / 3;
  PANES.forEach((P, i) => {
    const y0 = i * (ph + 14 * k);
    g.fillStyle = 'rgba(11,31,37,.94)'; rr(g, 0, y0, W, ph, 10 * k); g.fill();
    g.strokeStyle = PAL.line; g.lineWidth = 1.2 * k; rr(g, 0.5, y0 + 0.5, W - 1, ph - 1, 10 * k); g.stroke();
    // header: a spinner and a title bar
    const a = t * 5 + i;
    g.strokeStyle = P.hue; g.lineWidth = 2.4 * k; g.beginPath(); g.arc(18 * k, y0 + 18 * k, 6 * k, a, a + 4.4); g.stroke();
    g.fillStyle = PAL.ink2; rr(g, 32 * k, y0 + 14 * k, (70 + i * 22) * k, 8 * k, 3 * k); g.fill();
    g.fillStyle = PAL.line; g.fillRect(10 * k, y0 + 34 * k, W - 20 * k, 1 * k);
    // streaming lines: the newest at the bottom, scrolling up as each one lands
    const n = t * P.rate + P.ph, top = Math.floor(n), f = n - top, e = f < 0.25 ? 1 - (1 - f / 0.25) ** 3 : 1;
    const lh = 15 * k, rows = Math.floor((ph - 78 * k) / lh);
    g.save(); g.beginPath(); g.rect(0, y0 + 38 * k, W, ph - 76 * k); g.clip();
    for (let r = 0; r <= rows; r++) {
      const id = top - rows + r, ly = y0 + 44 * k + (r + 1 - e) * lh;
      let x = 12 * k + (hash(id * 7 + i) < 0.3 ? 14 * k : 0);
      const segs = 1 + Math.floor(hash(id * 13 + i) * 4);
      for (let s = 0; s < segs && x < W - 20 * k; s++) {
        const w = (12 + hash(id * 31 + s * 7 + i) * 52) * k, c = hash(id * 17 + s) < 0.2 ? P.hue : hash(id * 5 + s) < 0.35 ? PAL.ink : PAL.ink2;
        g.globalAlpha = r === rows ? Math.min(1, f * 4) : 0.9;
        g.fillStyle = c; rr(g, x, ly, Math.min(w, W - 14 * k - x), 6 * k, 2 * k); g.fill();
        x += w + 6 * k;
      }
    }
    g.globalAlpha = 1; g.restore();
    // progress
    const pr = ((t + P.ph * 7) / P.period) % 1;
    g.fillStyle = '#1f4650'; rr(g, 12 * k, y0 + ph - 22 * k, W - 24 * k, 6 * k, 3 * k); g.fill();
    g.fillStyle = P.hue; rr(g, 12 * k, y0 + ph - 22 * k, Math.max(6 * k, (W - 24 * k) * pr), 6 * k, 3 * k); g.fill();
  });
}
