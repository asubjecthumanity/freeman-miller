// The office's screens (owner: office), drawn on canvases:
//  - DisplayScreen: the big display. A dusk wallpaper and the "Claude" sessions window, laid out like
//    the full-viewport HTML the camera hands over to (css/rooms/office.css), so the handover reads
//    as one picture. Redrawn only when the session changes or an image arrives.
//  - AgentsScreen: the column of agent panes on the left of the display (streaming lines, progress).
//    A small canvas of its own, so the big one is not re-uploaded every frame.
//  - XcodeScreen: the laptop. A Swift editor beside an iOS simulator showing Semitone's screens.
//  - paintDusk: the evening outside the window (also the display's wallpaper).
// Every word drawn comes from the project data; code and agent output are drawn as coloured bars.
import { FONT, tex, makeCanvas, roundRect, loadImage } from './shared.js';
import { PAL, DESKTOP, paintDusk, drawAgents, hash, deskLayout, paintBlankWindow, filmText } from '../office-paint.js';
export { PAL, DESKTOP, paintDusk, deskLayout, paintBlankWindow };

// break text into lines that fit maxW with the current font
function lines(g, text, maxW) {
  const words = String(text || '').split(/\s+/).filter(Boolean), out = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
  }
  if (line) out.push(line);
  return out;
}
// a picture is an <img> or an ImageBitmap (scaled())
const dims = img => (img.naturalWidth != null ? [img.naturalWidth, img.naturalHeight] : [img.width, img.height]);
function cover(g, img, x, y, w, h, top = false) {
  const [iw, ih] = dims(img);
  const s = Math.max(w / iw, h / ih);
  const sw = w / s, sh = h / s;
  g.drawImage(img, (iw - sw) / 2, top ? 0 : (ih - sh) / 2, sw, sh, x, y, w, h);
}
const ready = img => !!img && (img.naturalWidth != null ? img.complete && img.naturalWidth > 0 : img.width > 0);
// a picture scaled down (off the main thread) to at most `max` px on its longer side, about the size the
// screens draw it at: the first draw then rasterises a small bitmap instead of resampling the whole
// picture, and every redraw copies it. Falls back to the picture itself.
// (From the file's bytes, not the <img>: Chrome decodes and resizes an image element's bitmap on the
// main thread, 6 to 10 ms a picture at 1x CPU, and the room's eight arrived together mid-flight as a
// 30 to 40 ms frame. A Blob is decoded and resized on a worker thread; the bytes come from the cache.)
function scaled(img, max) {
  const s = max / Math.max(img.naturalWidth, img.naturalHeight);
  if (s > 0.9 || typeof createImageBitmap !== 'function') return Promise.resolve(img);
  const size = { resizeWidth: Math.round(img.naturalWidth * s), resizeHeight: Math.round(img.naturalHeight * s), resizeQuality: 'high' };
  return fetch(img.currentSrc || img.src).then(r => (r.ok ? r.blob() : Promise.reject(new Error(r.status))))
    .then(b => createImageBitmap(b, size))
    // (a bitmap that ignored the size: draw it anyway, cover() reads its own dimensions)
    .catch(() => img);
}

export class DisplayScreen {
  constructor(projects, mediaBase, { scale = 1 } = {}) {
    this.W = Math.round(1600 * scale); this.H = Math.round(1000 * scale);
    this.c = makeCanvas(this.W, this.H);
    this.g = this.c.getContext('2d');
    this.texture = tex(this.c);
    this.projects = projects;
    this.base = mediaBase;
    this.tab = -1;
    this.imgs = new Map();
    this.wall = makeCanvas(this.W, this.H);
    this.view = '';
    this.setView(1440, 900);
  }
  // the browser window's size (CSS px): the display paints the HTML desk as it is laid out at that
  // size (deskLayout), fitted into the glass, so the hand-over lands on the same picture. Returns true
  // when the layout changed (the agents column may have moved).
  setView(vw, vh) {
    const L = deskLayout(Math.round(vw), Math.round(vh)), key = `${L.vw}x${L.vh}${L.own ? ' own' : ''}`;
    if (key === this.view) return false;
    this.view = key;
    this.L = L;
    // the viewport's shape on the glass: the largest centred rectangle of its proportions
    const W = this.W, H = this.H, r = L.vw / L.vh;
    const bw = r >= W / H ? W : H * r, bh = r >= W / H ? W / r : H;
    this.box = { x: (W - bw) / 2, y: (H - bh) / 2, w: bw, h: bh, k: bw / L.vw };
    // the wallpaper: the whole glass, then the viewport's own picture in its rectangle (the HTML desk
    // paints the same dusk at the viewport's size)
    const g = this.wall.getContext('2d'), b = this.box, dusk = (w, h) => { let seed = 7; paintDusk(g, w, h, { horizon: 0.74, rnd: () => ((seed = (seed * 16807) % 2147483647) / 2147483647) }); };
    dusk(W, H);
    if (b.w < W - 1 || b.h < H - 1) { g.save(); g.translate(b.x, b.y); g.beginPath(); g.rect(0, 0, b.w, b.h); g.clip(); dusk(b.w, b.h); g.restore(); }
    this.dirty = true;
    return true;
  }
  // a rectangle of the desk (CSS px of this.L) as fractions of the glass ({ x, y, w, h })
  frac(a) { const b = this.box; return { x: (b.x + a.x * b.k) / this.W, y: (b.y + a.y * b.k) / this.H, w: a.w * b.k / this.W, h: a.h * b.k / this.H }; }
  // the agents column, and the sessions window, as fractions of the glass
  agentsRect() { return this.frac(this.L.agents); }
  winRect() { return this.frac(this.L.win); }
  // where the HTML app (vw x vh CSS px) is pinned on the glass as it fades in: the viewport's shape on the
  // glass, which this picture paints exactly; or, for an app with a layout of its own (L.own), the largest
  // rectangle of the viewport's proportions centred in the display's window, whose content has cleared
  handRect(vw, vh) {
    if (!this.L.own) return { x: this.box.x / this.W, y: this.box.y / this.H, w: this.box.w / this.W, h: this.box.h / this.H };
    const w = this.winRect(), r = vw / vh, ga = (w.w * this.W) / (w.h * this.H);
    const fw = r >= ga ? w.w : w.w * r / ga, fh = r >= ga ? w.h * ga / r : w.h;
    return { x: w.x + (w.w - fw) / 2, y: w.y + (w.h - fh) / 2, w: fw, h: fh };
  }
  // load the first picture of every project (once, when the camera comes near), scaled to the size the
  // display draws it at. Resolves when they are in.
  loadMedia() {
    if (this.loading) return this.loading;
    const max = Math.round(this.W * 0.48);
    this.loading = Promise.all(this.projects.map(p => {
      const m = p.video ? { src: p.video.poster } : p.media?.[0];
      if (!m) return null;
      return loadImage(this.base + m.src).then(img => scaled(img, max)).then(img => { this.imgs.set(p.id, img); if (this.projects[this.tab] === p) this.dirty = true; }, () => {});
    }));
    return this.loading;
  }
  setTab(i) { if (i !== this.tab) { this.tab = i; this.dirty = true; } }
  // returns true when it redrew. Measures follow css/rooms/office.css at the window's size (this.L, in
  // CSS px; k scales them onto the glass)
  draw() {
    if (!this.dirty) return false;
    this.dirty = false;
    this.paint(this.g, this.tab);
    this.texture.needsUpdate = true;
    return true;
  }
  // Paint every session once into a scratch canvas of the same size and take a snapshot of each (which
  // makes the browser rasterise it), one session per call of `quiet`'s promise: the browser then holds
  // their pictures and lettering, so the first real redraw of each costs no more than any other (the
  // first one used to take 30 to 60 ms at 4x CPU, in the middle of a flight). quiet(): resolves at a
  // moment when the camera is still. Once per page, and again for a new desk layout (a resize).
  get needsWarm() { return !!this.loading && !this.warming && this.warmed !== this.view && typeof createImageBitmap === 'function'; }
  async warm(quiet) {
    if (!this.needsWarm) return;
    this.warming = true;
    await this.loading;
    // the other phone screens and the banner too
    await Promise.all(this.projects.flatMap(p => (p.media || []).slice(1).map(m => { this.extra(p, m); return this.asked.get(`${p.id}:${m.src}`); })));
    const c = makeCanvas(this.W, this.H), g = c.getContext('2d'), view = this.view;
    for (let k = 0; k < this.projects.length && this.view === view; k++) {
      await quiet();
      this.paint(g, k);
      try { (await createImageBitmap(c)).close(); } catch (e) { break; }
    }
    c.width = c.height = 0;
    this.warmed = view;
    this.warming = false;
  }
  paint(g, tab) {
    const W = this.W, H = this.H, D = this.L, b = this.box, k = b.k, R = D.rows;
    g.drawImage(this.wall, 0, 0);
    const x0 = b.x + D.win.x * k, y0 = b.y + D.win.y * k, ww = D.win.w * k, wh = D.win.h * k;
    // window
    g.fillStyle = 'rgba(5,10,14,.45)'; roundRect(g, x0 + 6 * k, y0 + 10 * k, ww, wh, 12 * k); g.fill();
    g.fillStyle = PAL.bg; roundRect(g, x0, y0, ww, wh, 12 * k); g.fill();
    g.save(); roundRect(g, x0, y0, ww, wh, 12 * k); g.clip();
    g.textBaseline = 'middle';
    // title bar
    const bh = R.bar * k;
    g.fillStyle = PAL.bg2; g.fillRect(x0, y0, ww, bh);
    for (let i = 0; i < 3; i++) { g.fillStyle = '#5d6f73'; g.beginPath(); g.arc(x0 + (19.5 + i * 18) * k, y0 + bh / 2, 5.5 * k, 0, 7); g.fill(); }
    g.fillStyle = PAL.ink; g.font = `500 ${15 * k}px ${FONT}`;
    g.fillText('Claude', x0 + 101 * k, y0 + bh / 2 + 0.5 * k);
    if (D.count) { g.fillStyle = PAL.ink2; g.font = `400 ${13 * k}px ${FONT}`; g.textAlign = 'right'; g.fillText(`${this.projects.length} sessions`, x0 + ww - 20 * k, y0 + bh / 2 + 0.5 * k); g.textAlign = 'left'; }
    // tabs (.stabs: flex, 2px apart, 12px in; a tab is its name plus its padding, the dot in the padding)
    const ty = y0 + bh, th = R.tabs * k, t0 = ty + (R.tabs - R.tab) * k, tabH = R.tab * k, P = D.tab;
    g.fillStyle = PAL.bg2; g.fillRect(x0, ty, ww, th);
    g.font = `500 ${14 * k}px ${FONT}`;
    const tabs = [];
    let tx = 12 * k;
    this.projects.forEach((p, i) => {
      // the gap between the featured projects and the smaller ones (.stabs__gap)
      if (i > 0 && !p.featured && this.projects[i - 1].featured) { tabs.push({ line: tx + 4 * k }); tx += 14.5 * k; }
      const w = g.measureText(p.name).width + (P.l + P.r) * k;
      tabs.push({ p, i, x: tx, w });
      tx += w + 2 * k;
    });
    // a strip too wide for the window scrolls the chosen tab into view (as select() does), behind faded edges
    const sw = ww, sel = tabs.find(t => t.i === Math.max(0, tab)), over = tx - 2 * k + 12 * k - sw;
    const scroll = over > 0 && sel ? Math.max(0, Math.min(over, sel.x + sel.w + 40 * k - sw)) : 0;
    g.save(); g.beginPath(); g.rect(x0, ty, sw, th); g.clip(); g.translate(x0 - scroll, 0);
    for (const t of tabs) {
      if (t.line != null) { g.fillStyle = PAL.line; g.fillRect(t.line, ty + th - 32 * k, 1.5 * k, 18 * k); continue; }
      const { p, x, w } = t, on = t.i === tab;
      if (on) { g.fillStyle = PAL.bg; roundRect(g, x, t0, w, tabH, [8 * k, 8 * k, 0, 0]); g.fill(); g.fillStyle = PAL.mustard; g.fillRect(x + P.line * k, t0, w - 2 * P.line * k, 2.5 * k); }
      g.strokeStyle = on ? PAL.mustard : PAL.ink2; g.fillStyle = on ? PAL.mustard : PAL.ink2; g.lineWidth = 1.6 * k;
      g.beginPath(); g.arc(x + P.dot * k, t0 + tabH / 2, 3.2 * k, 0, 7); /^live\b/i.test(p.status) ? g.fill() : g.stroke();
      g.fillStyle = on ? PAL.ink : PAL.ink2; g.fillText(p.name, x + P.l * k, t0 + tabH / 2 + 0.5 * k);
    }
    g.restore();
    if (over > 0) {
      const fade = (fx, dir) => { const gr = g.createLinearGradient(fx, 0, fx + dir * 44 * k, 0); gr.addColorStop(0.2, PAL.bg2); gr.addColorStop(1, 'rgba(11,31,37,0)'); g.fillStyle = gr; g.fillRect(Math.min(fx, fx + dir * 44 * k), ty, 44 * k, th); };
      if (scroll > 2) fade(x0, 1);
      if (scroll < over - 2) fade(x0 + sw, -1);
    }
    // the session
    const p = this.projects[Math.max(0, tab)];
    if (p) this.session(g, p, x0, ty + th, ww, wh - bh - th - R.status * k, k, D);
    // status bar
    const sh = R.status * k, sy = y0 + wh - sh, n = this.projects.length, cur = Math.max(0, tab);
    g.fillStyle = PAL.bg2; g.fillRect(x0, sy, ww, sh);
    g.fillStyle = PAL.ink2; g.font = `400 ${13 * k}px ${FONT}`;
    const pos = `Session ${cur + 1} of ${n}`;
    g.fillText(pos, x0 + 20 * k, sy + sh / 2 + 0.5 * k);
    const sx = x0 + 38 * k + g.measureText(pos).width;
    for (let i = 0; i < n; i++) { g.fillStyle = i === cur ? PAL.mustard : PAL.line; roundRect(g, sx + i * 22 * k, sy + sh / 2 - 2 * k, 16 * k, 4 * k, 2 * k); g.fill(); }
    g.textAlign = 'right'; g.fillStyle = PAL.ink2;
    g.fillText(cur < n - 1 ? 'Keep scrolling for the next session' : 'Keep scrolling to sign off', x0 + ww - 20 * k, sy + sh / 2 + 0.5 * k);
    g.textAlign = 'left';
    g.restore();
    g.textBaseline = 'alphabetic';
  }
  // one session, laid out as .sp: text column 43%, pictures 57%, both centred in the body
  // D: the desk layout (deskLayout), for the rules that follow the window's height
  session(g, p, x, y, w, h, k, D) {
    const media = !!(p.video || p.media?.length);
    const inner = w - 112 * k, tw = media ? (inner - 48 * k) * 0.43 : Math.min(660 * k, inner);
    const tx = media ? x + 56 * k : x + (w - tw) / 2, top = y + 30 * k, bh = h - 56 * k;
    // measure the text block (a project without pictures is set larger, centred: .sp--text)
    const blocks = [], big = !media;
    const add = (font, color, text, width, lh, gapBefore, extra = {}) => { g.font = font; if (extra.ls) g.letterSpacing = extra.ls; blocks.push({ font, color, rows: lines(g, text, width), lh, gapBefore, ...extra }); g.letterSpacing = '0px'; };
    const ns = (big ? 60 : 46) * k;
    add(`500 ${ns}px ${FONT}`, PAL.ink, p.name, tw, (big ? 62.4 : 47.8) * k, 0, { ls: `${(-0.012 * ns).toFixed(2)}px` });
    add(`400 ${(big ? 24 : 21) * k}px ${FONT}`, PAL.ink, p.oneLiner, tw, (big ? 33.1 : 29) * k, 12 * k);
    // (.sp__desc: max-width 62ch)
    if (p.description) { const df = `400 ${(big ? 18 : 16) * k}px ${FONT}`; g.font = df; add(df, big ? '#d3dfdb' : PAL.ink2, p.description, Math.min(tw, 62 * g.measureText('0').width), (big ? 28.4 : 25.3) * k, 16 * k); }
    (p.facts || []).forEach((f, i) => add(`400 ${15 * k}px ${FONT}`, PAL.ink, f, tw - 26 * k, 21.75 * k, i ? 7 * k : 16 * k, { indent: 26 * k, check: true }));
    const meta = [['Status', p.status], ['Kind', p.kind], ['Stack', (p.stack || []).join('   ')], ['Year', p.year ? String(p.year) : '']].filter(r => r[1]);
    meta.forEach((r, i) => blocks.push({ meta: r, lh: 19.6 * k + (r[0] === 'Stack' ? 4 * k : 0), gapBefore: i ? 6 * k : 18 * k, rows: [''] }));
    if (p.links?.length) blocks.push({ links: p.links, lh: 40 * k, gapBefore: 20 * k, rows: [''] });
    const total = blocks.reduce((a, b) => a + b.gapBefore + b.rows.length * b.lh, 0);
    let cy = top + Math.max(0, (bh - total) / 2);
    g.textBaseline = 'middle';
    for (const b of blocks) {
      cy += b.gapBefore;
      if (b.meta) {
        g.font = `400 ${14 * k}px ${FONT}`;
        g.fillStyle = PAL.ink2; g.fillText(b.meta[0], tx, cy + b.lh / 2);
        if (b.meta[0] === 'Stack') {
          let sx = tx + 80 * k;
          g.font = `400 ${13 * k}px ${FONT}`;
          for (const it of p.stack) { const iw = g.measureText(it).width + 20 * k; g.strokeStyle = PAL.line; g.lineWidth = 1 * k; roundRect(g, sx, cy + b.lh / 2 - 10.5 * k, iw, 21 * k, 10.5 * k); g.stroke(); g.fillStyle = PAL.ink; g.fillText(it, sx + 10 * k, cy + b.lh / 2); sx += iw + 5 * k; }
        } else { g.fillStyle = PAL.ink; g.fillText(b.meta[1], tx + 80 * k, cy + b.lh / 2); }
        cy += b.lh; continue;
      }
      if (b.links) {
        let lx = tx;
        g.font = `500 ${15 * k}px ${FONT}`;
        b.links.forEach((l, i) => { const lw = g.measureText(l.label).width + 35 * k; g.lineWidth = 1.5 * k; g.strokeStyle = PAL.mustard; g.fillStyle = PAL.mustard; roundRect(g, lx, cy, lw, 40 * k, 20 * k); i ? g.stroke() : g.fill(); g.fillStyle = i ? PAL.ink : '#22170f'; g.fillText(l.label, lx + 17 * k, cy + 20.5 * k); lx += lw + 8 * k; });
        cy += b.lh; continue;
      }
      g.font = b.font; g.fillStyle = b.color; if (b.ls) g.letterSpacing = b.ls;
      b.rows.forEach((r, i) => g.fillText(r, tx + (b.indent || 0), cy + i * b.lh + b.lh / 2));
      g.letterSpacing = '0px';
      if (b.check) { g.strokeStyle = PAL.mustard; g.lineWidth = 2 * k; g.beginPath(); g.moveTo(tx + 3 * k, cy + 8 * k); g.lineTo(tx + 7 * k, cy + 12.5 * k); g.lineTo(tx + 15 * k, cy + 5 * k); g.stroke(); }
      cy += b.rows.length * b.lh;
    }
    if (!media) return;
    // pictures
    const mx = tx + tw + 48 * k, mw = x + w - 56 * k - mx;
    const img = this.imgs.get(p.id), m = p.media?.[0];
    const shadowed = (ix, iy, iw, ih, im) => {
      g.fillStyle = 'rgba(0,0,0,.3)'; roundRect(g, ix + 4 * k, iy + 8 * k, iw, ih, 10 * k); g.fill();
      if (ready(im)) { g.save(); roundRect(g, ix, iy, iw, ih, 10 * k); g.clip(); cover(g, im, ix, iy, iw, ih); g.restore(); }
      else { g.fillStyle = PAL.raise; roundRect(g, ix, iy, iw, ih, 10 * k); g.fill(); }
    };
    if (p.video) {
      // (under the film: its caption, 8 px down and 19 tall, then the transcript's summary, 2 px down and
      // 32 tall, then 14 px to the banner; without a transcript the caption's 14 px margin)
      const vh = mw * 9 / 16, ban = (p.media || []).find(mm => mm.kind === 'banner'), bh2 = ban ? mw * ban.h / ban.w : 0;
      const tr = !!filmText(p.video).transcript, gap = (tr ? 75 : 41) * k;
      const tot = vh + gap + bh2;
      let iy = top + Math.max(0, (bh - tot) / 2);
      shadowed(mx, iy, mw, vh, img);
      g.fillStyle = 'rgba(16,40,47,.85)'; g.beginPath(); g.arc(mx + mw / 2, iy + vh / 2, 30 * k, 0, 7); g.fill();
      g.fillStyle = PAL.ink; g.beginPath(); g.moveTo(mx + mw / 2 - 9 * k, iy + vh / 2 - 13 * k); g.lineTo(mx + mw / 2 + 14 * k, iy + vh / 2); g.lineTo(mx + mw / 2 - 9 * k, iy + vh / 2 + 13 * k); g.fill();
      g.font = `400 ${13 * k}px ${FONT}`; g.fillStyle = PAL.ink2; g.fillText(p.video.label, mx, iy + vh + 17.5 * k);
      if (tr) {
        g.font = `500 ${14 * k}px ${FONT}`; g.fillStyle = PAL.ink;
        const sy = iy + vh + 45 * k, tw2 = g.measureText('Transcript').width;
        g.fillText('Transcript', mx, sy);
        g.fillStyle = PAL.mustard; g.fillRect(mx, sy + 8 * k, tw2, 1.2 * k);
      }
      if (ban) shadowed(mx, iy + vh + gap, mw, bh2, this.extra(p, ban));
    } else if (m.kind === 'phone') {
      // a strip of phones, as many as fit, the next one cut off at the edge
      // (.phone: min(560px, 100vh - 250px) tall, in a strip padded 4px 2px 10px)
      const ph = Math.min(560, D.vh - 250) * k, pw = ph * m.w / m.h, py = top + (bh - ph - 14 * k) / 2 + 4 * k;
      g.save(); g.beginPath(); g.rect(mx, y, mw + 2 * k, h); g.clip();
      p.media.forEach((mm, i) => {
        const px = mx + 2 * k + i * (pw + 16 * k);
        if (px > mx + mw) return;
        g.fillStyle = '#05080a'; roundRect(g, px, py, pw, ph, 28 * k); g.fill();
        const im = i === 0 ? img : this.extra(p, mm);
        const ix = px + 6 * k, iy = py + 6 * k, iw = pw - 12 * k, ih = ph - 12 * k;
        if (ready(im)) { g.save(); roundRect(g, ix, iy, iw, ih, 22 * k); g.clip(); cover(g, im, ix, iy, iw, ih, true); g.restore(); }
        else { g.fillStyle = PAL.raise; roundRect(g, ix, iy, iw, ih, 22 * k); g.fill(); }
      });
      g.restore();
    } else {
      let iw = mw, ih = iw * m.h / m.w;
      const maxH = m.kind === 'square' ? (D.vh - 240) * k : bh;
      if (ih > maxH) { ih = maxH; iw = ih * m.w / m.h; }
      shadowed(mx + (mw - iw) / 2, top + (bh - ih) / 2, iw, ih, img);
    }
  }
  // the second and third phone screens (loaded on demand, once the room's media may load)
  extra(p, m) {
    const key = `${p.id}:${m.src}`;
    if (!this.asked) this.asked = new Map();
    if (this.loading && !this.asked.has(key)) {
      this.asked.set(key, loadImage(this.base + m.src).then(img => scaled(img, Math.round(this.W * 0.48))).then(img => { this.imgs.set(key, img); if (this.projects[this.tab] === p) this.dirty = true; }, () => {}));
    }
    return this.imgs.get(key);
  }
}

/* ---------- agents at work (painted by office-paint.js) ---------- */
export class AgentsScreen {
  constructor({ scale = 1 } = {}) {
    this.W = Math.round(256 * scale); this.H = Math.round(762 * scale);
    this.c = makeCanvas(this.W, this.H);
    this.g = this.c.getContext('2d');
    this.texture = tex(this.c);
    this.h = this.H; // the height it is painted at: the column's proportions on the glass (setAspect)
  }
  // aspect: the column's height over its width, as the HTML desk lays it out at the window's size; the
  // canvas keeps its size and the picture is painted squeezed to match, so the plane can stretch it back
  setAspect(aspect) { this.h = this.W * aspect; }
  draw(t) {
    const g = this.g;
    g.setTransform(1, 0, 0, this.H / this.h, 0, 0);
    drawAgents(g, this.W, this.h, t);
    g.setTransform(1, 0, 0, 1, 0, 0);
    this.texture.needsUpdate = true;
  }
}

/* ---------- the laptop: Xcode, a Swift editor beside the simulator running Semitone ---------- */
const SWIFT = ['#fc5fa3', '#5dd8ff', '#d0a8ff', '#fc6a5d', '#a167e6', '#dfdfe0', '#dfdfe0', '#dfdfe0', '#6c7986'];
export class XcodeScreen {
  constructor(semitone, mediaBase, { scale = 1 } = {}) {
    this.W = Math.round(768 * scale); this.H = Math.round(480 * scale);
    this.c = makeCanvas(this.W, this.H);
    this.g = this.c.getContext('2d');
    this.texture = tex(this.c);
    this.app = semitone;
    this.base = mediaBase;
    this.shots = (semitone?.media || []).filter(m => m.kind === 'phone').slice(0, 3);
    this.imgs = [];
  }
  // resolves when the screenshots are in (or failed)
  loadMedia() {
    if (this.imgs.length) return this.loading;
    this.imgs = this.shots.map(() => null);
    // (the simulator shows them about 200 x 420 px)
    this.loading = Promise.all(this.shots.map((m, i) => loadImage(this.base + m.src).then(img => scaled(img, Math.round(this.H * 0.9))).then(img => { this.imgs[i] = img; }, () => {})));
    return this.loading;
  }
  draw(t) {
    const g = this.g, W = this.W, H = this.H, k = W / 768;
    g.fillStyle = '#1e1f22'; g.fillRect(0, 0, W, H);
    // toolbar
    g.fillStyle = '#2b2c30'; g.fillRect(0, 0, W, 34 * k);
    ['#6a6b70', '#6a6b70', '#6a6b70'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc((14 + i * 15) * k, 17 * k, 4.5 * k, 0, 7); g.fill(); });
    g.fillStyle = '#c9c9cc'; g.beginPath(); g.moveTo(74 * k, 11 * k); g.lineTo(84 * k, 17 * k); g.lineTo(74 * k, 23 * k); g.fill();
    g.fillRect(96 * k, 12 * k, 10 * k, 10 * k);
    g.fillStyle = '#3a3b40'; roundRect(g, 250 * k, 8 * k, 268 * k, 18 * k, 5 * k); g.fill();
    g.fillStyle = '#d6d6d9'; g.font = `500 ${11 * k}px ${FONT}`; g.textBaseline = 'middle';
    g.fillText(this.app?.name || '', 262 * k, 17.5 * k);
    // building / running bar
    const pr = (t / 9) % 1;
    g.fillStyle = '#4a8cff'; g.fillRect(250 * k, 25 * k, 268 * k * Math.min(1, pr * 1.4), 1.5 * k);
    g.textBaseline = 'alphabetic';
    // navigator
    g.fillStyle = '#252629'; g.fillRect(0, 34 * k, 150 * k, H);
    for (let i = 0; i < 17; i++) {
      const sel = i === 5, ind = (i === 0 ? 0 : i < 4 || (i > 8 && i < 12) ? 12 : 22) * k;
      if (sel) { g.fillStyle = '#3d5a99'; g.fillRect(4 * k, 44 * k + i * 22 * k - 4 * k, 142 * k, 18 * k); }
      g.fillStyle = i === 0 || i === 4 || i === 8 ? '#6aa6f8' : '#8b8c91';
      g.fillRect(10 * k + ind, 44 * k + i * 22 * k, 8 * k, 9 * k);
      g.fillStyle = sel ? '#e8e8ea' : '#9b9ca0'; g.fillRect(24 * k + ind, 46 * k + i * 22 * k, (34 + hash(i * 3) * 50) * k, 5 * k);
    }
    // editor: lines typing in
    const ex = 150 * k, ew = 370 * k, lh = 17 * k, rows = 24;
    g.fillStyle = '#1e1f22'; g.fillRect(ex, 34 * k, ew, H);
    const cur = Math.floor(t * 0.55) % 40, typed = (t * 0.55) % 1;
    for (let r = 0; r < rows; r++) {
      const line = (r + Math.max(0, cur - rows + 4) + 40) % 40, y = 48 * k + r * lh;
      g.fillStyle = '#5b5c61'; g.fillRect(ex + 12 * k, y, 10 * k, 5 * k);
      if (hash(line * 11) < 0.13) continue; // blank line
      let x = ex + 40 * k + Math.floor(hash(line * 5) * 3) * 16 * k;
      const segs = 2 + Math.floor(hash(line * 7) * 4);
      const isCur = line === cur, maxX = isCur ? ex + 40 * k + typed * 260 * k : Infinity;
      for (let s = 0; s < segs; s++) {
        const w = (14 + hash(line * 23 + s * 3) * 58) * k;
        if (x > maxX) break;
        g.fillStyle = hash(line * 3) < 0.12 ? SWIFT[8] : SWIFT[Math.floor(hash(line * 19 + s) * 8)];
        g.fillRect(x, y, Math.min(w, maxX - x), 6 * k);
        x += w + 7 * k;
      }
      if (isCur) {
        g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(ex, y - 5 * k, ew, lh);
        if (Math.floor(t * 2) % 2) { g.fillStyle = '#e8e8ea'; g.fillRect(Math.min(x, maxX) + 2 * k, y - 3 * k, 1.5 * k, 12 * k); }
      }
    }
    // simulator
    const sx = 548 * k, sw = 196 * k, sh = sw * 2.06, sy = 34 * k + (H - 34 * k - sh) / 2;
    g.fillStyle = '#2a2b2f'; g.fillRect(520 * k, 34 * k, W - 520 * k, H);
    g.fillStyle = '#060607'; roundRect(g, sx - 7 * k, sy - 7 * k, sw + 14 * k, sh + 14 * k, 30 * k); g.fill();
    const n = this.imgs.length, cyc = t / 4.5, i0 = Math.floor(cyc) % Math.max(1, n), fade = Math.min(1, (cyc % 1) / 0.12);
    g.save(); roundRect(g, sx, sy, sw, sh, 24 * k); g.clip();
    g.fillStyle = '#121418'; g.fillRect(sx, sy, sw, sh);
    if (n) {
      const prev = this.imgs[(i0 + n - 1) % n], img = this.imgs[i0];
      if (ready(prev)) cover(g, prev, sx, sy, sw, sh, true);
      if (ready(img)) { g.globalAlpha = fade; cover(g, img, sx, sy, sw, sh, true); g.globalAlpha = 1; }
    }
    g.restore();
    g.fillStyle = '#060607'; roundRect(g, sx + sw / 2 - 26 * k, sy + 8 * k, 52 * k, 15 * k, 8 * k); g.fill();
    this.texture.needsUpdate = true;
  }
}
