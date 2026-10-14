// The office's sessions app (owner: office): the full-viewport HTML the camera hands over to when it
// zooms into the big display. A quiet desktop app with one "Claude" session per project: a real ARIA
// tablist (click, arrow keys, Home/End), each tab showing that project from the data, then a sign-off
// with contact details. Readable on its own: without WebGL it sits in the page after the office box;
// with reduced motion it shows at its steps without the zoom and without animation. Every word comes from window.PORTFOLIO, apart from the interface's labels
// and the promo film's captions and transcript until the data has them (filmText in office-paint.js).
import { esc } from './common.js';
import { sessionOrder } from '../world/office-layout.js';
import { paintDusk, drawAgents, filmText } from '../world/office-paint.js';
import { office as state } from './office-state.js';

const MEDIA = 'shared/';
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const live = s => /^live\b/i.test(s || '');

/* ---------- the promo film's captions and transcript (their words: filmText, office-paint.js) ---------- */
// the captions track's address: the data's file, or the film's own cues as a WebVTT blob
function captionsSrc(v) {
  if (v.captions) return `${MEDIA}${v.captions}`;
  const cues = filmText(v).cues;
  if (!cues || typeof Blob !== 'function' || !URL.createObjectURL) return '';
  return URL.createObjectURL(new Blob([`WEBVTT\n\n${cues.map(([a, b, t]) => `${a} --> ${b}\n${t}`).join('\n\n')}\n`], { type: 'text/vtt' }));
}
function transcript(p) {
  const v = p.video, t = filmText(v).transcript;
  if (!t) return '';
  const body = typeof t === 'string' ? `<p>${esc(t)}</p>` : `${t.note ? `<p>${esc(t.note)}</p>` : ''}<ol>${(t.lines || []).map(([at, text]) => `<li><span class="sp__tx-at">${esc(at)}</span> ${esc(text)}</li>`).join('')}</ol>`;
  return `<details class="sp__tx"><summary>Transcript<span class="visually-hidden"> of the ${esc(v.label)}</span></summary><div class="sp__tx-body">${body}</div></details>`;
}

/* ---------- markup ---------- */
function media(p) {
  const img = (m, cls = '') => `<img class="${cls}" data-src="${MEDIA}${esc(m.src)}" alt="${esc(m.alt)}" width="${m.w}" height="${m.h}" decoding="async">`;
  if (p.video) {
    const banner = (p.media || []).find(m => m.kind === 'banner'), cc = captionsSrc(p.video);
    return `<figure class="sp__media sp__media--video">
      <video controls playsinline preload="none" data-src="${MEDIA}${esc(p.video.src)}" data-poster="${MEDIA}${esc(p.video.poster)}" aria-label="${esc(p.video.label)}" width="1280" height="720">${cc ? `<track kind="captions" srclang="en" label="English (sounds)" src="${esc(cc)}">` : ''}</video>
      <figcaption>${esc(p.video.label)}</figcaption>
      ${transcript(p)}
      ${banner ? img(banner, 'sp__banner') : ''}
    </figure>`;
  }
  const list = p.media || [];
  if (!list.length) return '';
  if (list[0].kind === 'phone') {
    return `<div class="sp__media sp__media--phones" role="group" aria-label="${esc(p.name)} screenshots" tabindex="0">
      ${list.map(m => `<div class="phone">${img(m)}</div>`).join('')}
    </div>`;
  }
  return `<figure class="sp__media sp__media--shot sp__media--${esc(list[0].kind)}">${img(list[0])}</figure>`;
}

function panel(p, i, stop) {
  const hasMedia = !!(p.video || p.media?.length);
  const facts = p.facts?.length ? `<ul class="sp__facts">${p.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '';
  const links = p.links?.length ? `<p class="sp__links">${p.links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</p>` : '';
  return `<div class="sp${hasMedia ? '' : ' sp--text'}" role="tabpanel" id="sp-${esc(p.id)}" aria-labelledby="stab-${esc(p.id)}" tabindex="0" data-stop="${stop}" ${i ? 'hidden' : ''}>
    <div class="sp__text">
      <h4 class="sp__name">${esc(p.name)}</h4>
      <p class="sp__one">${esc(p.oneLiner)}</p>
      ${p.description ? `<p class="sp__desc">${esc(p.description)}</p>` : ''}
      ${facts}
      <dl class="sp__meta">
        <div><dt>Status</dt><dd>${esc(p.status)}</dd></div>
        <div><dt>Kind</dt><dd>${esc(p.kind)}</dd></div>
        ${p.stack?.length ? `<div><dt>Stack</dt><dd><ul class="sp__stack">${p.stack.map(s => `<li>${esc(s)}</li>`).join('')}</ul></dd></div>` : ''}
        ${p.year ? `<div><dt>Year</dt><dd>${esc(p.year)}</dd></div>` : ''}
      </dl>
      ${links}
    </div>
    ${media(p)}
  </div>`;
}

// stopOf(k): the journey stop of session k (k = list.length is the sign-off)
export function renderSessions(P, stopOf) {
  const list = sessionOrder(P.projects), person = P.person;
  const tabs = list.map((p, i) => `${i && !p.featured && list[i - 1].featured ? '<span class="stabs__gap" aria-hidden="true"></span>' : ''}<button class="stab" role="tab" type="button" id="stab-${esc(p.id)}" aria-controls="sp-${esc(p.id)}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-k="${i}" data-stop="${stopOf(i)}"><span class="stab__dot${live(p.status) ? ' is-live' : ''}" aria-hidden="true"></span>${esc(p.name)}</button>`).join('');
  const contact = [
    person.email && `<li><a class="so__link" href="mailto:${esc(person.email)}"><span class="so__k">Email</span><span class="so__v">${esc(person.email)}</span></a></li>`,
    person.github && `<li><a class="so__link" href="${esc(person.github)}" target="_blank" rel="noopener"><span class="so__k">GitHub</span><span class="so__v">${esc(person.githubHandle || person.github)}</span></a></li>`,
    person.youtube && `<li><a class="so__link" href="${esc(person.youtube)}" target="_blank" rel="noopener"><span class="so__k">YouTube</span><span class="so__v">Freeman's channel</span></a></li>`,
  ].filter(Boolean).join('');
  return `<div class="sessions" id="sessions" data-stop="${stopOf(0)}">
    <div class="desk" aria-hidden="true"><canvas class="desk__wall"></canvas><canvas class="desk__agents"></canvas></div>
    <section class="swin" aria-labelledby="sessions-h">
      <div class="swin__bar">
        <span class="swin__dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <h3 class="swin__title" id="sessions-h">Claude<span class="visually-hidden"> sessions on Freeman's desk</span></h3>
        <span class="swin__count">${list.length} sessions</span>
      </div>
      <div class="stabs-wrap"><div class="stabs" role="tablist" aria-label="Projects, one session each">${tabs}</div></div>
      <div class="swin__body">${list.map((p, i) => panel(p, i, stopOf(i))).join('')}</div>
      <div class="swin__status" aria-hidden="true">
        <span class="swin__pos">Session 1 of ${list.length}</span>
        <span class="swin__steps">${list.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</span>
        <span class="swin__hint">Keep scrolling for the next session</span>
      </div>
    </section>
    <section class="so" aria-labelledby="so-h" data-stop="${stopOf(list.length)}">
      <h3 class="so__h" id="so-h">Thanks for visiting</h3>
      <p class="so__who"><strong>${esc(person.name)}</strong>. ${esc(person.intro)}</p>
      <ul class="so__list">${contact}</ul>
      <p class="so__again"><a href="#outside" data-again>Back out to the lawn</a></p>
    </section>
  </div>`;
}

/* ---------- behaviour ---------- */
// go(k, how): ask the journey to put session k on screen (k = n is the sign-off)
// reduced: the static in-page layout (no WebGL); still: no animation (reduced motion)
export function bindSessions({ root, P, player, reduced, still = reduced, go, back }) {
  const list = sessionOrder(P.projects), n = list.length;
  const tabs = [...root.querySelectorAll('.stab')];
  const panels = [...root.querySelectorAll('.sp')];
  const strip = root.querySelector('.stabs');
  const pos = root.querySelector('.swin__pos'), steps = [...root.querySelectorAll('.swin__steps i')];
  const hint = root.querySelector('.swin__hint');
  let cur = 0, signoff = false, open = reduced, hydrated = new Set(), selected = false, refocus = false;

  // pictures load when their session is about to show, never at page load
  function hydrate(k) {
    for (const j of [k, k + 1, k - 1]) {
      if (j < 0 || j >= n || hydrated.has(j)) continue;
      hydrated.add(j);
      panels[j].querySelectorAll('[data-src]').forEach(el => {
        if (el.tagName === 'VIDEO') { el.poster = el.dataset.poster; el.src = el.dataset.src; }
        else { el.src = el.dataset.src; }
        el.removeAttribute('data-src');
      });
    }
  }
  if (reduced) panels.forEach((_, j) => { panels[j].querySelectorAll('img[data-src]').forEach(el => { el.loading = 'lazy'; }); hydrate(j); });

  function pauseVideos() { root.querySelectorAll('video').forEach(v => { if (!v.paused) v.pause(); }); }
  // one sound at a time across the house: the promo film and the house player take turns
  root.querySelectorAll('video').forEach(v => v.addEventListener('play', () => { if (player.playing) player.pause(); }));
  player.addEventListener('change', () => { if (player.playing) pauseVideos(); });

  // load: fetch this session's pictures (and its neighbours'); false while the camera is elsewhere in the house
  function select(k, { focus = false, load = true } = {}) {
    k = Math.max(0, Math.min(n - 1, k));
    // the journey calls this on every scroll step: when the session is already shown, touch nothing
    // (writing the tabs and then reading the strip's layout forced a layout pass on every frame)
    if (k === cur && selected) { if (load) hydrate(k); if (focus) tabs[k].focus({ preventScroll: true }); state.tab = k; return; }
    selected = true;
    // the session that goes away held the keyboard (a link in it, or the panel itself, and the journey
    // moved on by PageDown, Space or the wheel): hiding it would drop focus to <body>. Remember it; the
    // box puts focus on the new session's tab as soon as that cannot pull the journey back (office-box.js)
    if (!focus && k !== cur && panels[cur].contains(document.activeElement)) refocus = true;
    if (k !== cur) pauseVideos();
    cur = k;
    tabs.forEach((t, i) => { const on = i === k; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
    panels.forEach((p, i) => { p.hidden = i !== k; });
    pos.textContent = `Session ${k + 1} of ${n}`;
    steps.forEach((s, i) => s.classList.toggle('on', i === k));
    hint.textContent = k < n - 1 ? 'Keep scrolling for the next session' : 'Keep scrolling to sign off';
    if (load) hydrate(k);
    // keep the chosen tab in view in the strip (clear of its faded edges), without scrolling the page
    const t = tabs[k], sl = strip.scrollLeft, L = t.offsetLeft - 40, Rr = t.offsetLeft + t.offsetWidth + 40 - strip.clientWidth;
    if (L < sl) strip.scrollLeft = L; else if (Rr > sl) strip.scrollLeft = Rr;
    if (focus) t.focus({ preventScroll: true });
    state.tab = k;
  }
  function setSignoff(on) {
    if (on === signoff) return;
    signoff = on;
    root.classList.toggle('is-signoff', on);
    if (on) pauseVideos();
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { select(i); go(i, 'click'); });
    t.addEventListener('keydown', e => {
      let k = null;
      if (e.key === 'ArrowRight') k = (i + 1) % n;
      else if (e.key === 'ArrowLeft') k = (i - 1 + n) % n;
      else if (e.key === 'Home') k = 0;
      else if (e.key === 'End') k = n - 1;
      if (k == null) return;
      e.preventDefault();
      // move the journey first, so the focus that follows finds its session already on screen
      select(k);
      go(k, 'key');
      tabs[k].focus({ preventScroll: true });
    });
  });
  root.querySelector('[data-again]').addEventListener('click', e => { e.preventDefault(); back(); });

  // the strip scrolls sideways when the tabs do not fit (narrow windows, phones): its edges fade
  // where more tabs wait behind them
  const wrap = strip.parentElement;
  function edges() {
    const sl = strip.scrollLeft, max = strip.scrollWidth - strip.clientWidth;
    wrap.classList.toggle('is-more-l', sl > 2);
    wrap.classList.toggle('is-more-r', sl < max - 2);
  }
  strip.addEventListener('scroll', edges, { passive: true });
  const ro = new ResizeObserver(edges);
  ro.observe(strip); tabs.forEach(t => ro.observe(t));

  /* the desk around the window: the dusk wallpaper and the agents column, painted like the 3D display */
  const wall = root.querySelector('.desk__wall'), agents = root.querySelector('.desk__agents');
  let wallSize = '', agentsOn = false, raf = 0, timer = 0, lastInput = performance.now();
  // the agents stream (about 9 frames a second) while the visitor is busy and settle within a few
  // seconds of the last input: moving pictures beside text stop on their own (WCAG 2.2.2), and an idle
  // page draws nothing. Any scroll, key, touch or pointer move wakes them.
  const AWAKE = 5000;
  function paintWall() {
    const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(innerWidth * dpr / 2), h = Math.round(innerHeight * dpr / 2);
    if (wallSize === `${w}x${h}`) return;
    wallSize = `${w}x${h}`;
    wall.width = w; wall.height = h;
    let seed = 7;
    paintDusk(wall.getContext('2d'), w, h, { horizon: 0.74, rnd: () => ((seed = (seed * 16807) % 2147483647) / 2147483647) });
  }
  function sizeAgents() {
    const r = agents.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    if (!r.width) return false;
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (agents.width !== w || agents.height !== h) { agents.width = w; agents.height = h; }
    return true;
  }
  const drawNow = t => { if (sizeAgents()) drawAgents(agents.getContext('2d'), agents.width, agents.height, t); };
  function tickAgents() {
    raf = 0;
    if (!agentsOn || document.hidden) return;
    const now = performance.now();
    // (the same clock as the 3D display's agents, so the two pictures agree during the hand-over)
    drawNow(now / 1000);
    if (now - lastInput < AWAKE) timer = setTimeout(() => { timer = 0; raf = requestAnimationFrame(tickAgents); }, 110);
  }
  const wakeAgents = () => { if (agentsOn && !still && !timer && !raf && !document.hidden) raf = requestAnimationFrame(tickAgents); };
  function runAgents(on) {
    if (on === agentsOn) return;
    agentsOn = on;
    if (!on) { clearTimeout(timer); cancelAnimationFrame(raf); timer = raf = 0; return; }
    if (still) { drawNow(12); return; }
    wakeAgents();
  }
  for (const ev of ['pointermove', 'pointerdown', 'wheel', 'keydown', 'touchstart', 'scroll']) addEventListener(ev, () => { lastInput = performance.now(); if (agentsOn && !timer && !raf) wakeAgents(); }, { passive: true, capture: true });
  document.addEventListener('visibilitychange', wakeAgents);
  addEventListener('resize', () => { if (open) paintWall(); });

  /* the hand-over from the 3D display: called every frame the office is drawn.
     quad: the viewport's shape laid on the display's glass (the largest centred rectangle of the
     viewport's proportions), its corners projected to the screen: top-left, top-right, bottom-right,
     bottom-left. While the app fades in, a projective transform pins it to exactly that picture at any
     camera angle, so the HTML lands on the picture it replaces; once it is opaque it grows to the viewport. */
  let shown = '';
  function frame({ t, quad, own }) {
    if (reduced) return;
    if (t > 0.3) { hydrate(cur); paintWall(); }
    const W = innerWidth, H = innerHeight;
    // landscape: the display paints this app's own layout, so the app fades in on the glass in register
    // with it and grows only once opaque. An app with a layout of its own (phones, a phone on its side;
    // own) never lies over a different picture: the display's window clears first (office.js, t 0.5 to
    // 0.64), then the app fades in pinned to the middle of that empty window, and grows once opaque.
    const a = own ? smooth(0.64, 0.78, t) : smooth(0.66, 0.88, t);
    const grow = own ? smooth(0.8, 1, t) : smooth(0.88, 0.95, t);
    if (a <= 0 || !quad) { hide(); return; }
    let tf = '';
    if (grow < 1) {
      const V = [[0, 0], [W, 0], [W, H], [0, H]];
      tf = projective(W, H, quad.map((q, i) => [Math.round((q.x + (V[i][0] - q.x) * grow) * 100) / 100, Math.round((q.y + (V[i][1] - q.y) * grow) * 100) / 100]));
    }
    const key = `${a.toFixed(3)} ${tf}`;
    if (key === shown) return;
    shown = key;
    root.style.opacity = a.toFixed(3);
    root.style.transform = tf;
    const nowOpen = a > 0.98 && grow > 0.98;
    if (nowOpen !== open) { open = nowOpen; root.classList.toggle('is-open', open); state.covered = open; }
    runAgents(a > 0.05);
  }
  // put the app away: the camera left the office (by a flight, a cut, Back, a hash or keyboard focus)
  function hide() {
    if (reduced || shown === 'off') return;
    shown = 'off';
    root.style.opacity = '0';
    root.style.transform = '';
    if (open) { open = false; root.classList.remove('is-open'); }
    state.covered = false;
    setSignoff(false);
    runAgents(false);
    pauseVideos();
  }
  // the 3D view failed after the page started: from now on the app sits in the page (the flat layout)
  function toStatic() {
    if (reduced) return;
    runAgents(false);
    reduced = true; open = true;
    root.style.cssText = '';
    root.classList.add('is-open', 'is-static');
    panels.forEach((p, j) => { p.querySelectorAll('img[data-src]').forEach(el => { el.loading = 'lazy'; }); hydrate(j); });
  }

  // (no WebGL: the desk and its agents column are not shown, so nothing animates)
  if (reduced) root.classList.add('is-open', 'is-static');
  return {
    select, setSignoff, frame, hide, toStatic, n, tabs,
    get cur() { return cur; }, get open() { return open; }, get signoff() { return signoff; },
    get refocus() { return refocus; }, set refocus(v) { refocus = v; },
  };
}

// the CSS transform (transform-origin 0 0) that maps the box 0,0 .. W,H onto the quad P (four [x, y]
// corners: top-left, top-right, bottom-right, bottom-left): a unit square to quad homography
// (Heckbert), scaled from W x H, as a matrix3d
function projective(W, H, [[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) {
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = Math.abs(den) > 1e-9 ? (dx3 * dy2 - dx2 * dy3) / den : 0, h = Math.abs(den) > 1e-9 ? (dx1 * dy3 - dx3 * dy1) / den : 0;
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
  const m = [a / W, d / W, 0, g / W, b / H, e / H, 0, h / H, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.map(v => +v.toPrecision(10)).join(', ')})`;
}
