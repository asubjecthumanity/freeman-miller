// Glue: data -> HTML rooms, one player, the scroll journey, the 3D world and the leader lines.
import { STOPS, ROOMS, roomOf } from './path.js';
import { bindTracks } from './ui/common.js';
import * as outsideBox from './ui/outside-box.js';
import * as theaterBox from './ui/theater-box.js';
import * as livingBox from './ui/living-box.js';
import * as studioBox from './ui/studio-box.js';
import * as officeBox from './ui/office-box.js';
import { Player, levelAt, Onsets, fmt } from './player.js';
import { Journey, stopFromHash } from './journey.js';
import { createLeaders } from './overlay.js';
// (read only) whether the office's sessions app covers the whole view, so the house need not be drawn
import { office as officeState } from './ui/office-state.js';

const root = document.documentElement;
const MEDIA = 'shared/';
// Three ways to show the house:
//   full    the camera journey: flights, the auto-advance, moving rooms
//   still   reduced motion: the same boxes over still views of each stop; every move is a curtain cut
//   flat    no WebGL (or ?flat): the rooms are stacked in the page over a flat drawing of the house
let flat = root.classList.contains('no-webgl');
const still = root.classList.contains('reduced') && !flat;
// rooms draw their quiet versions (no pumping, reels, bobbing) in both
let reduced = still || flat;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const $ = id => document.getElementById(id);

/* ---------- data: each room's box module renders its box and lists its tracks (js/ui/<room>-box.js) ---------- */
const P = window.PORTFOLIO;
const BOXES = [outsideBox, theaterBox, livingBox, studioBox, officeBox]; // in stop order
const allTracks = BOXES.flatMap(b => b.tracks?.(P) || []);
const cues = allTracks.filter(t => t.kind === 'cue');

BOXES.forEach(b => b.render(P));
const player = new Player(allTracks, MEDIA);
bindTracks(player);

/* ---------- journey ---------- */
// a room's steps (the office's sessions) each get an empty section that gives them their scroll length
const main = $('rooms');
for (const r of ROOMS.filter(r => r.parent)) main.insertAdjacentHTML('beforeend', `<div class="room room--step" data-stop="${r.stop}" aria-hidden="true"></div>`);
const sections = [$('outside'), ...main.querySelectorAll(':scope > .room')];
const journey = new Journey({ sections, reduced: flat, stills: still });
const panels = [null, ...[...main.querySelectorAll(':scope > .room > .panel')]];
const mapLinks = [...document.querySelectorAll('.map a')];
const hello = document.querySelector('.hello__inner');
const veil = $('veil');

let world = null, leaders = null, warming = Promise.resolve();

/* ---------- room box bindings, now playing, announcements ---------- */
// the TV plays Cue 1 silently from page load; this is where that silent picture is (until the world has its own clock)
const silentT0 = performance.now();
const silentTime = () => ((performance.now() - silentT0) / 1000) % cues[0].duration;
const boxHooks = BOXES.map(b => b.bind?.({ P, player, journey, silentTime, world: () => world }) || {});
const nowEl = $('now'), nowBtn = $('now-btn'), nowText = $('now-text'), statusEl = $('status');
const PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9.5-5.5z" fill="currentColor"/></svg>';
const PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" fill="currentColor"/></svg>';
nowBtn.addEventListener('click', () => player.current && player.toggle(player.current.id));
function syncNow() {
  const on = player.playing;
  const c = player.current;
  nowBtn.innerHTML = on ? PAUSE : PLAY;
  if (c) nowBtn.setAttribute('aria-label', `${on ? 'Pause' : 'Play'} ${c.title}`);
  updateNow();
}
function updateNow() {
  const c = player.current;
  const show = !!c && (player.playing || player.time() > 0) && roomOf(journey.stop) !== c.stop;
  // (a phone on its side moves the box down under the chip: the wires re-measure it)
  if (nowEl.hidden === show) { nowEl.hidden = !show; leaders?.invalidate(); }
  const text = show ? `${c.title}, ${c.group}  ${fmt(player.time())}` : '';
  if (show && nowText.textContent !== text) nowText.textContent = text;
}
// the chip's clock keeps going while the frame loop sleeps (music under the office's sessions app)
player.addEventListener('time', () => { if (!running) updateNow(); });
// one polite line for screen readers: "Playing: Cue 1, Paranoia", "Paused: ...". Settles for a
// moment first, so switching tracks reads as one change.
let said = '', sayTimer = 0;
function announce() {
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => {
    const c = player.current;
    if (!c) return;
    const where = `${c.title}, ${c.group}`;
    const s = player.error === c ? `Could not load ${c.title}` : player.playing ? `Playing: ${where}` : player.audio.ended ? `Finished: ${where}` : player.time() > 0 ? `Paused: ${where}` : '';
    if (s && s !== said) { said = s; statusEl.textContent = s; }
  }, 250);
}
player.addEventListener('change', () => { syncNow(); announce(); wake(); });
// when a cue or a piece ends, the next one in that room's list plays
player.audio.addEventListener('ended', () => {
  const c = player.current;
  if (!c) return;
  const list = allTracks.filter(t => t.stop === c.stop);
  const next = list[list.indexOf(c) + 1];
  if (next) player.play(next.id, 0);
});

/* ---------- travel: map, Back, skip link, Go inside, keyboard focus ---------- */
const mapEl = $('map'), mapToggle = $('map-toggle'), mapHere = $('map-here'), mapPre = $('map-pre');
const setMapOpen = open => { mapEl.classList.toggle('is-open', open); mapToggle.setAttribute('aria-expanded', open); };
// each stop's heading: where the keyboard lands after a map link (the h1 for outside)
const HEADINGS = ['hello-title', 'theater-h', 'living-h', 'studio-h', 'office-h'];
mapLinks.forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  journey.stopAuto?.();
  const i = +a.dataset.stop;
  journey.travel(i, { push: true });
  // the keyboard follows into the chosen room, as with the skip link: focus its heading (before the
  // phone map folds away and takes the focused link with it), so the next Tab stays in that room
  const h = $(HEADINGS[i]);
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  setMapOpen(false);
}));
// tabbing out of the open phone map folds it away
mapEl.addEventListener('focusout', e => { if (e.relatedTarget && !mapEl.contains(e.relatedTarget)) setMapOpen(false); });
mapToggle.addEventListener('click', () => setMapOpen(!mapEl.classList.contains('is-open')));
mapEl.addEventListener('keydown', e => { if (e.key === 'Escape' && mapEl.classList.contains('is-open')) { setMapOpen(false); mapToggle.focus(); } });
document.addEventListener('pointerdown', e => { if (!mapEl.contains(e.target)) setMapOpen(false); });
// Go inside (reduced motion, no WebGL): to the theater, and the keyboard follows into it (its heading;
// <main> itself is not focusable, or a click anywhere in a room would focus it and the next Tab would
// start again at the theater's first control)
$('go-inside').addEventListener('click', () => {
  journey.travel(1, { push: true });
  const h = $(HEADINGS[1]);
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
});
window.addEventListener('popstate', () => {
  const i = stopFromHash();
  if (flat && STOPS[i]?.parent) { revealStep(i); return; }
  journey.travel(i < 0 ? 0 : i);
});
// the skip link: into the theater, focus on its heading
const theaterH = $('theater-h');
theaterH?.setAttribute('tabindex', '-1');
document.querySelector('.skip').addEventListener('click', e => {
  e.preventDefault();
  journey.stopAuto?.();
  journey.travel(1, { push: true, fast: true });
  theaterH?.focus({ preventScroll: true });
});
// keyboard: focusing something in another room travels there fast (flat: the browser scrolls it into view)
let cutTo = -1;
// the area a stop belongs to, for the keyboard: its room; the office's sessions (-1) and its sign-off (-2)
// each take over the whole view, so they count apart from the office's box
const area = s => (!STOPS[s]?.parent ? roomOf(s) : s === STOPS.length - 1 ? -2 : -1);
// A click on something that takes no focus (the picture, a box's text) leaves nothing focused but moves
// the browser's starting point for the next Tab to where it landed. Remember that area: if the journey
// then comes to rest somewhere else, focusFollows() moves the keyboard there too.
let clickedIn = -1, byKey = false;
// (whether the visitor last used the keyboard: a heading focused after a click and a wheel scroll shows
// no focus ring, as the click itself would not have)
document.addEventListener('keydown', () => { byKey = true; }, { capture: true, passive: true });
for (const ev of ['pointerdown', 'wheel', 'touchstart']) document.addEventListener(ev, () => { byKey = false; }, { capture: true, passive: true });
document.addEventListener('pointerdown', e => {
  const t = e.target;
  if (t.closest?.('a[href], button, input, select, textarea, summary, label, video, audio, [tabindex], [contenteditable]')) { clickedIn = -1; return; }
  const sec = t.closest?.('main [data-stop], header.hello');
  clickedIn = sec ? area(+sec.dataset.stop) : -1;
}, { capture: true, passive: true });
document.addEventListener('focusin', e => {
  // tabbing to the skip link, the map or the chip is deliberate navigation: no auto-advance under it
  if (e.target.closest?.('.skip, .map, .now')) journey.stopAuto?.();
  const sec = e.target.closest?.('main [data-stop], header.hello');
  if (!sec) return;
  const i = +sec.dataset.stop;
  journey.stopAuto?.();
  if (flat) return;
  if (Math.abs(journey.u - i) > 0.01 && !(journey.flight && journey.flight.target === i) && cutTo !== i) journey.travel(i, { fast: true });
});
// a jump-cut: draw the curtain over the scene and the boxes, jump, open it again
journey.addEventListener('cut', e => {
  const i = e.detail;
  // the same view (a stills snap back to where it was, a step of the same room): no curtain needed
  if (still && (i === shownStill || (STOPS[i]?.parent && STOPS[shownStill]?.parent))) { journey.jump(i); uShown = shownStill = i; journey.settle(); wake(); return; }
  cutTo = i;
  root.classList.add('is-cutting');
  veil.style.opacity = '1';
  setTimeout(() => {
    journey.jump(i);
    uShown = i;
    journey.settle();
    wake();
    shownStill = i;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      veil.style.opacity = '0';
      root.classList.add('is-revealing');
      root.classList.remove('is-cutting');
      cutTo = -1;
      setTimeout(() => root.classList.remove('is-revealing'), 300);
      wake();
    }));
  }, 190);
});
// the beat before the auto-advance: a small "Heading inside" line fills while it waits
journey.addEventListener('arming', e => {
  if (e.detail > 6e4) return;
  root.style.setProperty('--beat', `${e.detail}ms`);
  // armed again (the tab came back): the line fills from the start
  if (root.classList.contains('is-arming')) { root.classList.remove('is-arming'); void root.offsetWidth; }
  root.classList.add('is-arming');
});
// a scroll while the house is still loading: "Heading inside" until it is up and the camera sets off
journey.addEventListener('held', e => { if (e.detail === 0) root.classList.add('is-entering'); });
journey.addEventListener('auto', () => { root.classList.remove('is-arming'); root.classList.add('is-entering'); });
const disarm = () => root.classList.remove('is-arming', 'is-entering');
journey.addEventListener('disarmed', disarm);
journey.addEventListener('landed', () => { if (!journey.flight) disarm(); });
journey.addEventListener('move', wake);
journey.addEventListener('settle', e => { updateMap(); focusFollows(e.detail); wake(); });
// the keyboard stays with the view: when the journey comes to rest in another room (keys that scroll,
// Home/End, Back/Forward) while focus was left in the room before, focus moves to this room's heading (a
// session: its tab; the sign-off: its heading). Otherwise the next Tab would pull the visitor back there.
function focusFollows(i) {
  // (a stale rest: another flight or cut is already on its way somewhere else)
  if (flat || i < 0 || journey.flight || (cutTo >= 0 && cutTo !== i)) return;
  const a = document.activeElement, sec = a?.closest?.('main [data-stop], header.hello');
  // nothing focused: only a click's starting point in another area moves (see clickedIn)
  const none = !a || a === document.body;
  if (none) { if (clickedIn < 0 || clickedIn === area(i)) return; }
  else if (!sec || (a.closest('#sessions .so') ? -2 : a.closest('#sessions') ? -1 : roomOf(+sec.dataset.stop)) === area(i)) return;
  clickedIn = -1;
  const el = STOPS[i]?.parent ? document.querySelector(`#sessions [role="tab"][data-stop="${i}"]`) || $('so-h') : $(HEADINGS[i]);
  if (!el) return;
  if (!el.matches('a[href], button, input, [tabindex]')) el.setAttribute('tabindex', '-1');
  if (none && !byKey) { el.dataset.quiet = ''; el.addEventListener('blur', () => delete el.dataset.quiet, { once: true }); }
  el.focus({ preventScroll: true });
}
// flat: the office's sessions are a tab list in the page; a step's hash selects its tab
function revealStep(i) {
  const tab = document.querySelector(`#sessions [role="tab"][data-stop="${i}"]`);
  if (tab) { tab.click(); tab.closest('.swin')?.scrollIntoView({ block: 'start' }); }
  else document.querySelector(`#sessions [data-stop="${i}"]`)?.scrollIntoView({ block: 'start' });
}

/* ---------- world ---------- */
// A server that stalls instead of refusing (a CDN that never answers) never rejects the import, and the
// page would wait on the lawn for ever. While the world's modules load, any finished download counts as
// progress; nothing finishing for STALL ms rejects, and the flat house takes over.
const STALL = 8000;
function stallGuard() {
  let timer = 0, fail, po = null;
  const p = new Promise((_, r) => { fail = r; });
  const kick = () => { clearTimeout(timer); timer = setTimeout(() => fail(new Error(`3D view: nothing arrived for ${STALL / 1000} s`)), STALL); };
  try { po = new PerformanceObserver(kick); po.observe({ type: 'resource' }); } catch { /* the plain timer still guards */ }
  kick();
  return { p, stop() { clearTimeout(timer); po?.disconnect(); } };
}
async function startWorld() {
  if (root.classList.contains('no-webgl')) return;
  try {
    // the world's modules were preloaded from the page head; the canvas screens need Jost (italic for
    // the film's title), which arrives in parallel (never wait on it for more than a few seconds)
    const font = Promise.race([document.fonts?.load('italic 500 40px Jost').catch(() => {}), new Promise(r => setTimeout(r, 4000))]);
    const guard = stallGuard();
    const [{ createWorld }] = await Promise.race([Promise.all([import('./world/world.js'), font]), guard.p]).finally(() => guard.stop());
    const canvas = $('scene');
    const w = await createWorld({ canvas, data: { film: P.filmScore, person: P.person, pianoCollection: P.pianoCollection, otherMusic: P.otherMusic, projects: P.projects, wake }, mediaBase: MEDIA, mobile: matchMedia('(pointer: coarse)').matches });
    // a lost GPU context comes back by itself (world.js relights it); one that stays lost for 5 s on
    // screen gives way to the flat house
    let lostTimer = 0;
    const lostWait = () => { clearTimeout(lostTimer); if (!document.hidden && w.renderer.getContext().isContextLost()) lostTimer = setTimeout(() => { if (w.renderer.getContext().isContextLost()) toFlat(new Error('WebGL context lost')); }, 5000); };
    canvas.addEventListener('webglcontextlost', lostWait);
    canvas.addEventListener('webglcontextrestored', () => { clearTimeout(lostTimer); wake(); });
    document.addEventListener('visibilitychange', lostWait);
    // leader lines: each room's box module says which world anchors wire to its box, and when the signal flows
    leaders = createLeaders($('leaders'), BOXES.filter(b => b.leaders).map(b => ({ stop: b.stop, panel: panels[b.stop], portAt: 'h2', ...b.leaders(w) })));
    w.resize(innerWidth, innerHeight);
    // compile what the first picture needs without blocking, then draw it (the drawing of the house
    // fades out once it is on screen: see 'world-shown' in tick), then warm the other rooms. The frame
    // loop only sees the world once it is prepared, so no input can draw (and compile) early.
    await w.prepare(uShown, 0);
    world = w;
    resize();
    root.classList.add('world-ready');
    wake();
    warming = new Promise(r => requestAnimationFrame(() => r(world.warm())));
    boxHooks.forEach(h => h.sync?.());
    syncNow();
  } catch (err) {
    toFlat(err);
  }
}
// no 3D view after all (no WebGL, a failed start, a lost GPU context that never comes back): the flat house
function toFlat(err) {
  if (flat) return;
  console.warn('3D view unavailable, showing the flat house.', err);
  const at = roomOf(journey.stop);
  world = null;
  root.classList.add('no-webgl');
  root.classList.remove('is-cutting', 'is-revealing', 'is-asleep');
  veil.style.opacity = ''; delete veil.dataset.busy; cutTo = -1;
  reduced = true; flat = true;
  panels.forEach(hydrate);
  journey.reduced = true; journey.stills = false; journey.stopAuto?.(); journey.release(); journey.measure();
  // (and forget the weights the 3D layout wrote: a box at weight 0 pauses its equalisers)
  panels.forEach(p => { if (p) { p.style.opacity = ''; delete p.dataset.w; p.classList.remove('is-on'); } });
  hello.style.opacity = ''; hello.classList.remove('is-away'); root.classList.remove('is-deep');
  new ResizeObserver(() => journey.measure()).observe(main);
  // already inside the house: the stacked page opens at that room
  if (at > 0) requestAnimationFrame(() => journey.sections[at]?.scrollIntoView({ block: 'start' }));
}

function resize() {
  if (!world) return;
  world.resize(innerWidth, innerHeight);
  leaders?.invalidate();
  wake();
}
window.addEventListener('resize', resize);
// flat: the stacked rooms change height as pictures and fonts arrive
if (flat) new ResizeObserver(() => journey.measure()).observe(main);

/* ---------- room media: fetched as the camera approaches each room, never all at page load ---------- */
// How near (in stops) the camera must be: the theater's trailer once the way in is well under way;
// the other rooms' pictures about a room ahead, so they are in before the camera arrives. A room's
// steps (the office's sessions) count as the room. The box's thumbnails and the 3D covers share one fetch.
const AHEAD = [0, 0.7, 1.15, 1.15, 1.15];
const htmlDone = new Set(), worldDone = new Set();
function hydrate(panel) { panel?.querySelectorAll('img[data-src]').forEach(img => { img.src = img.dataset.src; img.removeAttribute('data-src'); }); }
function loadNear(u) {
  const here = roomOf(Math.round(u));
  for (let i = 1; i < AHEAD.length; i++) {
    if (here !== i && Math.abs(u - i) >= AHEAD[i]) continue;
    if (!htmlDone.has(i)) { htmlDone.add(i); hydrate(panels[i]); }
    if (world && !worldDone.has(i)) { worldDone.add(i); world.loadMedia(i); }
  }
}
// the stacked page (no WebGL): every box is in the flow, so the browser's own lazy loading decides
if (flat) panels.forEach(hydrate);

/* ---------- frame loop: runs while something moves, plays or animates; otherwise sleeps ---------- */
let uShown = journey.u, last = performance.now(), lastDraw = 0, running = false, shownStill = -1, worldShown = false, viewMoved = false;
// the time since the last drawn frame: at 30 fps (only screens animate) a drawn frame stands for several
// display frames, so the rooms' clocks (the cover's bob, Freeman's nod) must advance by all of them
let since = 0;
// when the first picture of the house went on screen (the beat before the way in counts from there)
let shownAt = 0, shownDone;
const shown = new Promise(r => { shownDone = r; });
// Frame-time governor: when busy frames stay slow (over 25 ms on average over 45 frames, and well over
// the display's own frame time), render fewer pixels. One way only, at most twice, so it never
// oscillates; a display (or a power saver) that runs at 30 Hz never trips it.
let govN = 0, govT = 0, govMin = 1, woke = false;
function govern(dt, busy) {
  // (the first frame after a wake-up has no real interval behind it)
  if (!busy || woke || dt <= 0.002 || dt >= 0.1 || document.hidden) return;
  govN++; govT += dt; govMin = Math.min(govMin, dt);
  if (govN < 45) return;
  if (govT / govN > Math.max(0.025, govMin * 1.45) && world.degrade()) { leaders?.invalidate(); }
  govN = 0; govT = 0;
}
const onsets = new Onsets();
// html.is-asleep while the loop sleeps: CSS animations that only belong to a live picture (the wires'
// marching signal, the equalisers) pause with it
function wake() { if (!running) { running = true; woke = true; root.classList.remove('is-asleep'); last = performance.now(); since = 0; requestAnimationFrame(tick); } }
document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
// rooms with idle life (the silent TV, the floating cover, the studio's lamp, Freeman at his desk)
// animate at 30 fps while the visitor is around, and fall asleep after a while without any input
const IDLE = { 1: 90e3, 2: 25e3, 3: 25e3, 4: 60e3 };
const lively = () => { const r = Math.round(uShown); return !reduced && !!world && !!IDLE[r] && Math.abs(uShown - r) < 0.6; };
// what music changes in the still views (reduced motion): the TV follows a cue, the piano's keys a piece,
// the studio's meters anything. The lawn and the office stay as they are.
const STILL_MUSIC = { 1: k => k === 'cue', 2: k => k === 'piano', 3: () => true };
// at the office's screen: the steps (sessions, sign-off) all share the camera of the first
const FIRST_STEP = STOPS.findIndex(s => s.parent);
const atScreen = u => FIRST_STEP > 0 && u >= FIRST_STEP - 0.0004;
let deep = root.classList.contains('is-deep');
let lastInput = performance.now();
// input wakes a room with idle life; elsewhere only input that can change the picture draws a frame (a
// press, a key; with reduced motion, the pointer crossing onto something with a hover state, such as the
// TV): moving over a still view does not. (A scroll that moves the journey wakes the loop itself.)
for (const ev of ['pointermove', 'pointerover', 'pointerdown', 'wheel', 'keydown', 'touchstart', 'scroll']) {
  const quiet = ev === 'pointermove' || ev === 'scroll' || (ev === 'pointerover' && !still);
  window.addEventListener(ev, () => { lastInput = performance.now(); if (!running && (!quiet || lively())) wake(); }, { passive: true, capture: true });
}

function tick(now) {
  if (document.hidden) { running = false; return; }
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); // rAF time can precede the wake-up time
  last = now;
  since += dt;
  const target = journey.u;
  if (flat) uShown = target;
  else if (still) {
    // stills: the nearest stop; when it changes, draw the curtain, change the picture, open it again
    // (while a scroll is under way the still holds; at rest the journey cuts to the next stop)
    const want = journey.scrolling ? shownStill : Math.round(target);
    if (shownStill < 0) { uShown = want; shownStill = want; }
    else if (want !== shownStill && STOPS[want]?.parent && STOPS[shownStill]?.parent) uShown = shownStill = want;
    else if (want !== shownStill && cutTo < 0 && !veil.dataset.busy) {
      veil.dataset.busy = '1'; veil.style.opacity = '1'; root.classList.add('is-cutting');
      setTimeout(() => {
        uShown = shownStill = Math.round(journey.u);
        veil.style.opacity = '0';
        root.classList.add('is-revealing'); root.classList.remove('is-cutting');
        setTimeout(() => root.classList.remove('is-revealing'), 300);
        delete veil.dataset.busy;
        wake();
      }, 200);
    }
  } else if (cutTo < 0) {
    const k = journey.flight ? 1 - Math.exp(-dt * 14) : 1 - Math.exp(-dt * 7);
    uShown += (target - uShown) * k;
    if (Math.abs(target - uShown) < 0.0004) uShown = target;
  }

  /* audio-driven state */
  const cur = player.current, playing = player.playing, t = player.time();
  const moving = Math.abs(target - uShown) > 0.0004 || !!journey.flight;
  // the office's sessions app fully open over the camera at the screen (every session step has the same
  // camera, so moving between tabs too): nothing of the house can be seen, so it is not drawn, and music
  // playing elsewhere in the house no longer keeps the loop at full rate
  const covered = !!world && !world.warming && officeState.covered && atScreen(uShown) && atScreen(target) && cutTo < 0 && !veil.dataset.busy;
  const level = playing ? levelAt(cur, t) : 0;
  const kick = onsets.step(playing ? cur : null, t, dt);
  const cueOnTV = cur?.kind === 'cue' && (playing || t > 0) ? cur : null;
  const tvT = cueOnTV ? t : (reduced ? 4 : silentTime());
  const tvCue = cueOnTV || cues[0];
  const state = {
    playing, kind: cur?.kind, t, level, onset: onsets.env, kick, reduced,
    moving,
    tv: { t: tvT, cue: tvCue, level: levelAt(tvCue, tvT) * (cueOnTV && !playing ? 0.3 : 1), playing: playing && !!cueOnTV, soundOn: playing },
    pianoNotes: playing && cur.kind === 'piano' ? cur.notes : null,
    pianoT: t,
  };

  // music changes the picture: at full rate with motion; with reduced motion (still views) only where the
  // still follows it, and 10 frames a second are plenty there; otherwise the loop may sleep while it plays
  const music = playing && !covered && !!world && (!reduced || !!STILL_MUSIC[Math.round(uShown)]?.(cur.kind));
  // when only screens animate (nothing moves or plays), 30 frames a second is plenty. (viewMoved: the last
  // drawn frame moved the camera although the journey did not, e.g. the living room's lean easing out)
  const busy = moving || (music && !reduced) || viewMoved;
  if (!busy && now - lastDraw < (music ? 99 : 31)) { requestAnimationFrame(tick); return; }
  lastDraw = now;
  const frameDt = Math.min(0.1, since);
  since = 0;

  /* panels, header, leaders */
  // a box shows only near its stop: it fades out before the camera leaves the room (the way in from the
  // lawn and the way out of the studio both pass outside the house)
  const weights = STOPS.map((_, i) => reduced ? (i === Math.round(uShown) ? 1 : 0) : 1 - smooth(0.05, 0.17, Math.abs(uShown - i)));
  if (!flat) {
    // (only changed values are written: an unchanged write still costs a style pass)
    panels.forEach((p, i) => {
      if (!p) return;
      const w = weights[i].toFixed(3);
      if (p.dataset.w !== w) { p.dataset.w = w; p.style.opacity = w; p.classList.toggle('is-on', +w > 0.5); }
    });
    // the greeting stays in the document (and the accessibility tree); inside the house it is only quiet
    const hw = (1 - smooth(0.04, 0.28, uShown)).toFixed(3);
    if (hello.dataset.w !== hw) { hello.dataset.w = hw; hello.style.opacity = hw; hello.classList.toggle('is-away', +hw < 0.05); }
    // (a deep link hid the greeting from the first paint, until this frame took it over)
    if (deep) { deep = false; root.classList.remove('is-deep'); }
  }
  const panelW = Math.max(...panels.map((p, i) => (p ? weights[i] : 0)));
  if (world && !covered) {
    viewMoved = world.frame(uShown, frameDt, state, panelW) && !reduced;
    leaders.update(weights, p => world.project(p), state, flat);
    // the first real picture is on screen: let the drawing of the house fade away under it
    if (!worldShown) { worldShown = true; requestAnimationFrame(() => { root.classList.add('world-shown'); shownAt = performance.now(); shownDone(); }); }
    govern(dt, busy);
  } else viewMoved = false;
  woke = false;
  updateMap();
  updateNow();
  loadNear(uShown);

  const animating = lively() && now - lastInput < IDLE[Math.round(uShown)] && !covered;
  if (moving || music || animating || veil.dataset.busy || cutTo >= 0 || world?.warming) requestAnimationFrame(tick);
  else { running = false; root.classList.add('is-asleep'); }
}

let mapStop = -1;
function updateMap() {
  const i = roomOf(Math.round(uShown));
  if (i === mapStop || i < 0) return;
  mapStop = i;
  mapLinks.forEach(a => { if (+a.dataset.stop === i) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
  // the phone map's toggle says where you are: "Map. You are in the Theater"
  mapPre.textContent = i === 0 ? 'Map. You are ' : 'Map. You are in the ';
  mapHere.textContent = STOPS[i].name;
}

/* ---------- start ---------- */
const startHash = stopFromHash();
const params = new URLSearchParams(location.search);
const testU = params.get('u'); // ?u=2.5 holds the camera at a point on the path (for screenshots)
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (testU != null && !flat) {
  journey.noSnap = true; journey.autoDone = true;
  requestAnimationFrame(() => { window.scrollTo(0, journey.yForU(+testU)); uShown = +testU; });
} else if (startHash > 0) {
  journey.autoDone = true;
  if (flat && STOPS[startHash].parent) requestAnimationFrame(() => revealStep(startHash));
  else if (flat) requestAnimationFrame(() => { journey.measure(); journey.jump(startHash); });
  else {
    journey.jump(startHash); uShown = startHash; shownStill = startHash;
    // until the house is up, a scroll stays in this room and is remembered (the move starts once it is)
    journey.holdAt(startHash);
  }
} else {
  window.scrollTo(0, 0);
  uShown = 0;
  // until the house is up, a scroll stays on the lawn and is remembered (the way in starts once it is)
  journey.holdAt(0);
}
updateMap();
startWorld().then(async () => {
  wake();
  if (testU != null || flat) return;
  if (startHash > 0) { await shown; journey.resume(); return; }
  if (params.has('hold')) { journey.autoAdvance(1e9); return; } // screenshots: start only on input
  // the beat: about 1.5 s from the moment the house is on screen (a hidden tab draws nothing, so it waits)
  await warming.catch(() => {});
  await shown;
  journey.autoAdvance(Math.max(300, 1500 - (performance.now() - shownAt)));
});
wake();

// handle for scripted tests and screenshots (not used by the page itself)
window.__house = { journey, player, get world() { return world; }, get u() { return uShown; } };
