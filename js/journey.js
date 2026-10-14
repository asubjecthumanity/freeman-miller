// Maps page scroll to the journey timeline u, with a dwell zone around each stop, gentle snapping
// to the next room when scrolling stops mid-move, scripted flights (auto-advance, map links, Back
// button, keyboard focus), jump-cuts for long trips, and URL hashes per stop.
//
// Rules a visitor feels:
// - one room per gesture: however hard the swipe, the scroll stops at the next room (the one after
//   the room you last came to rest in), and an idle snap only ever finishes that one move;
// - small scrolls add up (measured from where you arrived in the room), and a snap never pulls the
//   camera back against the input;
// - flights are in timeline space, so the camera moves the moment a flight starts (no dead scroll
//   through a dwell zone);
// - input in the direction a flight is already going never cancels it (the wheel notch or key that
//   starts the auto-advance is part of it); input the other way does;
// - Home and End travel to the lawn and to the last stop; keyboard focus travels fast (a short
//   flight to a neighbouring room, otherwise a jump-cut behind the curtain);
// - until the 3D house is up, scrolling stays at the start stop (the lawn, or a deep link's room) and
//   the direction asked for meanwhile plays once it is (holdAt, hold, autoAdvance, resume).
//
// Modes: `reduced` (no WebGL): the rooms are stacked in the page and scroll natively. `stills`
// (reduced motion): the same sections and dwell zones as the full journey, but nothing ever flies:
// app.js shows the still of the nearest stop and changes it behind a curtain, and every flight is a cut.
import { STOPS, LENGTH, roomOf } from './path.js';

// trapezoidal speed: a short start, a steady glide, a long soft arrival
const ACC = 0.16, DEC = 0.34, VMAX = 1 / (1 - ACC / 2 - DEC / 2);
const ease = t => t < ACC ? VMAX * t * t / (2 * ACC) : t <= 1 - DEC ? VMAX * (ACC / 2 + t - ACC) : 1 - VMAX * (1 - t) ** 2 / (2 * DEC);
// section lengths in viewport heights (each = dwell + the move to the next room) come from the rooms: LENGTH
const BEFORE = 0.12, AFTER = 0.2;
// how far (in viewport heights, at most NUDGE_PX) a scroll must nudge away from where it came to rest in
// a room to count as a gesture: one wheel notch (100 px) or three arrow presses on any screen
const NUDGE = 0.1, NUDGE_PX = 90;
const FORWARD = ['ArrowDown', 'PageDown', 'End'], BACKWARD = ['ArrowUp', 'PageUp', 'Home'];
// keys whose default action scrolls the page (Home and End are the journey's own: see onKey)
const SCROLL_KEYS = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' '];
// keys that belong to a control (sliders, tabs, players), never to the journey
const OWN_KEYS = 'input, textarea, select, video, audio, [role="tab"], [role="tablist"], [contenteditable=""], [contenteditable="true"]';

// the first step of a room with steps (the office's first session), or -1
const FIRST_STEP = STOPS.findIndex(s => s.parent);
// distance in rooms: a room's steps all count as one move past the room
const roomU = u => (FIRST_STEP > 0 && u > FIRST_STEP - 1 ? FIRST_STEP - 1 + Math.min(1, u - (FIRST_STEP - 1)) : u);

export class Journey extends EventTarget {
  constructor({ sections, reduced, stills = false }) {
    super();
    this.sections = sections; // element per stop, in order
    this.reduced = reduced;
    this.stills = stills;
    this.tops = [];
    this.flight = null;
    this.autoDone = false;
    this.lastY = window.scrollY; this.dir = 1;
    this.idleTimer = 0;
    this.scrolling = false; // between a scroll and the moment it comes to rest
    this.origin = 0;       // the stop the visitor last came to rest at
    this.restY = 0;        // the scroll position they arrived at there (a nudge is measured from it)
    this.notch = false;    // the last wheel input came in lines or pages (a mouse notch): a gesture at any size
    this.noSnap = false;   // ?u= test hook: hold the camera anywhere, no snapping or capping
    this.holding = false;  // the 3D house is still on its way: scrolling stays at the start stop (holdAt)
    this.holdStop = 0;     // ... the lawn, or the room a deep link opened at
    this.held = 0;         // ... and the direction a scroll, swipe, key or click asked for meanwhile (+1 / -1)
    this.measure();
    window.addEventListener('scroll', () => this.onScroll(), { passive: true });
    window.addEventListener('wheel', e => { if (e.deltaMode) this.notch = true; this.userInput(e, Math.sign(e.deltaY)); }, { passive: true });
    let ty = null;
    window.addEventListener('touchstart', e => { ty = e.touches[0]?.clientY ?? null; }, { passive: true });
    window.addEventListener('touchmove', e => {
      const y = e.touches[0]?.clientY;
      if (ty != null && y != null && Math.abs(y - ty) > 4) { this.userInput(e, y < ty ? 1 : -1); ty = y; }
    }, { passive: true });
    window.addEventListener('keydown', e => this.onKey(e));
    // a click or tap on the lawn while the house is loading asks for the way in, as a scroll does
    window.addEventListener('pointerdown', e => {
      if (this.holding && this.holdStop === 0 && e.isPrimary && e.button === 0 && !e.target.closest?.('a, button, input, select, textarea, summary, label, [role="tab"], .map, .skip, .now')) this.hold(1);
    }, { passive: true });
    this.mW = innerWidth; this.mH = innerHeight;
    window.addEventListener('resize', () => this.onResize());
  }
  // the viewport changed size (a window resize, a phone turned on its side): keep the visitor where the
  // journey had them. The browser may already have moved the scroll (its scroll anchoring on rotation),
  // so the place comes from the journey's own record (lastY, read with the old geometry), not scrollY.
  // Small height changes (a phone's URL bar) are ignored to keep the path steady. True when re-measured.
  onResize() {
    if (innerWidth === this.mW && Math.abs(innerHeight - this.mH) < 140) return false;
    this.mW = innerWidth; this.mH = innerHeight;
    if (this.reduced) { this.measure(); return true; }
    const u = this.uFor(this.lastY), rest = this.uFor(this.restY);
    this.measure();
    this.restY = this.yForU(rest);
    window.scrollTo(0, this.yForU(u));
    this.lastY = window.scrollY;
    return true;
  }
  measure() {
    const H = Math.max(window.innerHeight, 400);
    this.H = H;
    if (!this.reduced) this.sections.forEach((el, i) => { el.style.height = `${Math.round(LENGTH[i] * H)}px`; });
    else this.sections.forEach(el => { el.style.height = ''; });
    let y = 0;
    this.tops = this.sections.map((el, i) => {
      // reduced: rooms are stacked in the page; a hidden section (a step) never wins
      if (this.reduced) return el.offsetParent || el === document.body ? el.getBoundingClientRect().top + window.scrollY : Infinity;
      const t = y; y += Math.round(LENGTH[i] * H); return t;
    });
  }
  // scroll position -> timeline
  uFor(y) {
    const T = this.tops, H = this.H, n = T.length;
    if (this.reduced) {
      const mid = y + H / 2;
      let best = 0;
      for (let i = 0; i < n; i++) if (mid >= T[i]) best = i;
      return best;
    }
    for (let i = 0; i < n; i++) {
      const a = i === 0 ? -Infinity : T[i] - BEFORE * H, b = i === n - 1 ? Infinity : T[i] + AFTER * H;
      if (y >= a && y <= b) return i;
      if (i < n - 1) {
        const c = T[i + 1] - BEFORE * H;
        if (y > b && y < c) return i + (y - b) / (c - b);
      }
    }
    return n - 1;
  }
  yForU(u) {
    const T = this.tops, H = this.H;
    const i = Math.floor(u), f = u - i;
    if (i >= T.length - 1) return T[T.length - 1];
    if (f === 0) return T[i];
    const b = T[i] + AFTER * H, c = T[i + 1] - BEFORE * H;
    return b + f * (c - b);
  }
  // (during a flight: where the flight has the camera. A wheel notch or key that scrolls the page between
  // two of its steps would otherwise show for a frame, and the camera would lurch ahead and spring back)
  get u() { return this.flight ? this.flight.u : this.uFor(window.scrollY); }
  get stop() { return Math.round(this.u); }
  get last() { return STOPS.length - 1; }

  onScroll() {
    // a scroll the browser made for a new viewport size before its resize event: place it from the record
    if (!this.reduced && this.onResize()) return;
    let y = window.scrollY;
    if (this.holding && !this.flight) {
      // the house is not up yet: stay at the start stop and remember which way the visitor wants to go
      const at = this.tops[this.holdStop];
      if (Math.abs(y - at) > 1) { this.hold(Math.sign(y - at)); window.scrollTo(0, at); }
      this.lastY = at;
      return;
    }
    if (!this.reduced && !this.flight && !this.noSnap) {
      // one room per gesture: hold the scroll at the far edge of the next room's dwell zone
      const T = this.tops, H = this.H, o = this.origin;
      const hi = o + 1 < T.length - 1 ? T[o + 1] + AFTER * H : Infinity;
      const lo = o - 1 > 0 ? T[o - 1] - BEFORE * H : -Infinity;
      if (y > hi + 1 || y < lo - 1) { y = Math.round(y > hi ? hi : lo); window.scrollTo(0, y); }
    }
    if (y !== this.lastY) this.dir = y > this.lastY ? 1 : -1;
    this.lastY = y;
    this.dispatchEvent(new Event('move'));
    if (this.flight) return;
    this.scrolling = true;
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => { this.scrolling = false; if (this.reduced) this.settle(true); else this.snap(); }, this.reduced ? 160 : 220);
  }
  // wheel, touch or key input: a flight carries on when the input goes its way, stops otherwise
  userInput(e, dir) {
    if (this.holding) this.hold(dir);
    const f = this.flight;
    if (!f || f.keep || e === f.trigger || (dir && dir === f.dir)) return;
    this.cancel();
  }
  onKey(e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.target?.closest?.(OWN_KEYS)) return;
    if (e.key === ' ' && e.target?.closest?.('button, a, summary')) return; // Space presses a button
    let dir = FORWARD.includes(e.key) ? 1 : BACKWARD.includes(e.key) ? -1 : e.key === ' ' ? (e.shiftKey ? -1 : 1) : 0;
    if (!dir) return;
    this.userInput(e, dir);
    // Home and End are explicit: to the lawn, to the last stop
    if (!this.reduced && (e.key === 'Home' || e.key === 'End')) {
      e.preventDefault();
      this.stopAuto?.();
      this.travel(e.key === 'Home' ? 0 : this.last, { push: true });
    }
  }
  // after scrolling stops between rooms, finish the move in the direction of travel (one room at most)
  // (stills: the same decision, made with a cut)
  snap() {
    if (this.flight || this.reduced || this.noSnap) return;
    const u = this.u, f = u - Math.floor(u), o = this.origin;
    // a nudge away from where the scroll came to rest (one wheel notch, three arrow presses: a tenth of the
    // screen, at most NUDGE_PX) is a gesture too; it used to be swallowed by the dwell zone or snapped back,
    // so scrolling one notch at a time never left a room. Measured from where the visitor arrived in this
    // room (restY, see settle), not the room's top: a hard flick arrives at the far edge of the dwell zone,
    // and a brush from there is still a brush. Small scrolls add up: three arrow presses or two short
    // trackpad nudges a moment apart count as one gesture.
    const d = window.scrollY - this.restY;
    const nudged = Math.abs(d) >= (this.notch ? 4 : Math.min(NUDGE * this.H, NUDGE_PX)) && Math.sign(d) === this.dir;
    this.notch = false;
    const onward = Math.max(0, Math.min(this.last, o + this.dir));
    if (f < 0.002 || f > 0.998) {
      if (nudged && onward !== o && Math.round(u) === o) { this.go(onward, u); return; }
      this.settle(false, true); return;
    }
    // any deliberate move out of a room carries on to the next room in that direction
    let target = this.dir > 0 ? (f > 0.03 ? Math.ceil(u) : Math.floor(u)) : (f < 0.97 ? Math.floor(u) : Math.ceil(u));
    target = Math.max(o - 1, Math.min(o + 1, target));
    if (target === o && nudged) target = onward;
    // never pull the camera back against the input: a brush just past the dwell zone stays where it is
    // (a hair into the move) and the next small scroll adds to it
    if (target === o && (o - u) * this.dir < 0) return;
    this.go(target, u);
  }
  go(target, u) {
    if (this.stills) this.cut(target, { push: false });
    else this.flyTo(target, { duration: 500 + 1100 * Math.abs(target - u) });
  }
  // (already there, e.g. Home or the map's Outside on the lawn: no entry, so Back never does nothing)
  pushHash(i) {
    const want = i === 0 ? '' : `#${STOPS[i].id}`;
    if (location.hash !== want) history.pushState({ stop: i }, '', want || location.pathname + location.search);
  }
  // a scripted flight along the path. auto: the auto-advance; trigger: the input event that started it
  flyTo(i, { duration, push = false, keep = false, auto = false, trigger = null } = {}) {
    i = Math.max(0, Math.min(this.last, i));
    if (push) this.pushHash(i);
    if (this.reduced) {
      this.sections[roomOf(i)].scrollIntoView({ block: 'start' });
      this.settle();
      return;
    }
    if (this.stills) { this.cut(i); return; }
    this.holding = false; this.held = 0;
    this.cancel(true);
    // leaving a room's steps for somewhere else: drop back to its first step (the camera is the same)
    const s = FIRST_STEP;
    if (s > 0 && this.u > s + 0.001 && i < s) window.scrollTo(0, this.yForU(s));
    // fly in timeline space so the camera starts and stops moving with the flight (dwell zones skipped)
    const u0 = this.u, du = i - u0;
    const dur = duration ?? Math.min(4200, 900 + 1100 * Math.abs(roomU(i) - roomU(u0)));
    if (Math.abs(du) < 0.001) { window.scrollTo(0, this.tops[i]); this.lastY = window.scrollY; this.settle(); return; }
    // the flight keeps its own clock, a frame counting at most 50 ms: in a hidden tab (no frames) it
    // waits where it was and carries on from there, instead of whipping through the rest of the move
    const f = { keep, auto, trigger, raf: 0, target: i, dir: Math.sign(du), el: 0, at: performance.now(), u: u0 };
    this.flight = f;
    const step = now => {
      if (this.flight !== f) return;
      f.el += Math.max(0, Math.min(50, now - f.at)); f.at = now;
      const k = Math.min(1, f.el / dur);
      f.u = k < 1 ? u0 + du * ease(k) : i;
      // (the stop's place is read at the end: a resize mid-flight moves it)
      window.scrollTo(0, k < 1 ? this.yForU(f.u) : this.tops[i]);
      this.lastY = window.scrollY;
      if (k < 1) f.raf = requestAnimationFrame(step);
      else { this.flight = null; this.settle(); this.dispatchEvent(new Event('landed')); }
    };
    f.raf = requestAnimationFrame(step);
    this.dispatchEvent(new Event('flight'));
  }
  // travel to stop i the way that suits the distance. fast (keyboard focus, the skip link): a short
  // flight (under a second) to a neighbouring room, else a jump-cut; otherwise flights up to two rooms
  travel(i, { push = false, fast = false } = {}) {
    i = Math.max(0, Math.min(this.last, i));
    if (this.reduced) { this.flyTo(i, { push }); return; }
    if (this.stills) { if (Math.abs(i - this.u) < 0.001) { if (push) this.pushHash(i); this.settle(); } else this.cut(i, { push }); return; }
    const d = Math.abs(roomU(i) - roomU(this.u));
    if (d < 0.001 && Math.abs(i - this.u) < 0.001) { if (push) this.pushHash(i); this.settle(); return; }
    if (d > (fast ? 1.02 : 2.02)) { this.cut(i, { push }); return; }
    this.flyTo(i, { push, duration: fast ? Math.min(1000, 450 + 550 * Math.max(d, 0.3)) : undefined });
  }
  // a jump-cut: app.js draws the curtain, calls jump() behind it and opens it again
  cut(i, { push = false } = {}) {
    this.holding = false; this.held = 0;
    this.cancel(true);
    if (push) this.pushHash(i);
    this.dispatchEvent(new CustomEvent('cut', { detail: i }));
  }
  cancel(quiet = false) {
    if (!this.flight) return;
    cancelAnimationFrame(this.flight.raf);
    this.flight = null;
    this.dispatchEvent(new Event('landed'));
    if (quiet) return;
    // an interrupted flight: the room you are nearest is where the next gesture counts from
    this.origin = Math.round(this.u);
    this.restY = this.tops[this.origin];
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.snap(), 220);
  }
  // at rest on a stop: remember it, put its hash in the address (still: the nearest stop counts).
  // keep: an idle snap in the dwell zone of the room the visitor is already in, which keeps where they
  // arrived there (restY), so small scrolls add up instead of each one starting again from zero
  settle(still = false, keep = false) {
    const u = this.u;
    if (!still && Math.abs(u - Math.round(u)) > 0.002) return;
    const i = Math.round(u);
    if (!keep || i !== this.origin) this.restY = window.scrollY;
    this.origin = i;
    this.notch = false;
    // (stacked page: a step's hash, e.g. a session of the office, stands while its room is in view)
    const now = STOPS.findIndex(s => `#${s.id}` === location.hash);
    if (this.reduced && now > 0 && STOPS[now].parent && roomOf(now) === i) { this.dispatchEvent(new CustomEvent('settle', { detail: i })); return; }
    const want = i === 0 ? '' : `#${STOPS[i].id}`;
    if (location.hash !== want) {
      // a room reached by scrolling gets its own entry, so Back returns to the room before; moving
      // between the office's sessions, and the stacked page (an ordinary document), only replace it
      const url = want || location.pathname + location.search;
      if (!this.reduced && roomOf(i) !== roomOf(Math.max(0, now))) history.pushState({ stop: i }, '', url);
      else history.replaceState({ stop: i }, '', url);
    }
    this.dispatchEvent(new CustomEvent('settle', { detail: i }));
  }
  // start into the house after a beat, or right away on the first scroll, tap, click or key.
  // Dispatches 'arming' (detail: the beat in ms) while it waits and 'auto' when it goes.
  // The beat only runs while the page is on screen: hidden, it waits, and back it starts again in full.
  // A forward scroll that came in while the house was loading (see hold()) sets off at once.
  autoAdvance(delay = 1500) {
    const held = this.held > 0;
    this.holding = false; this.held = 0;
    if (this.u > 0.05) this.autoDone = true; // the visitor already set off on their own
    if (this.reduced || this.stills || this.autoDone) { if (held) this.dispatchEvent(new Event('disarmed')); return; }
    let timer = 0;
    const go = e => {
      if (this.autoDone) return;
      this.autoDone = true;
      clearTimeout(timer);
      off();
      if (this.u < 0.98) { this.flyTo(1, { duration: 5000, auto: true, trigger: e || null }); this.dispatchEvent(new Event('auto')); }
      else this.dispatchEvent(new Event('disarmed'));
    };
    const evs = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
    const handler = e => {
      if (e.type === 'keydown' && (e.key === 'Tab' || e.key === 'Shift' || e.altKey || e.ctrlKey || e.metaKey)) return;
      if (e.target?.closest?.('.map, .skip, .now')) { this.stopAuto(); return; }
      // a key that would scroll the page starts the flight instead: its own smooth scroll would fight
      // the flight's first frames (the camera lurched ahead and sprang back)
      if (e.type === 'keydown' && SCROLL_KEYS.includes(e.key) && !e.target?.closest?.(OWN_KEYS) && !(e.key === ' ' && e.target?.closest?.('button, a, summary'))) e.preventDefault();
      go(e);
    };
    const arm = ms => { clearTimeout(timer); timer = setTimeout(() => go(null), ms); this.dispatchEvent(new CustomEvent('arming', { detail: ms })); };
    const onVis = () => { clearTimeout(timer); if (!document.hidden) arm(Math.max(delay, 1500)); };
    const off = () => { evs.forEach(ev => window.removeEventListener(ev, handler, true)); document.removeEventListener('visibilitychange', onVis); };
    this.stopAuto = () => { if (this.autoDone) return; this.autoDone = true; clearTimeout(timer); off(); this.dispatchEvent(new Event('disarmed')); };
    if (held) { go(null); return; }
    // (keydown is not passive: see SCROLL_KEYS above)
    evs.forEach(ev => window.addEventListener(ev, handler, { capture: true, passive: ev !== 'keydown' }));
    document.addEventListener('visibilitychange', onVis);
    if (!document.hidden) arm(delay);
  }
  // app.js, at start: until the 3D house is up, scrolling stays at stop i, the lawn or a deep link's room
  // (no other room's box over the drawing of the house, and no move skipped). The direction a scroll,
  // swipe, key (or, on the lawn, a click) asked for meanwhile is remembered ('held'); once the house is
  // on screen, autoAdvance() (the lawn) or resume() (a room) sets off that way at once.
  holdAt(i = 0) { if (!this.reduced && !this.stills) { this.holding = true; this.holdStop = i; this.held = 0; } }
  hold(dir) {
    const to = this.holdStop + dir;
    if (!this.holding || !dir || to < 0 || to > this.last || this.held === dir) return;
    this.held = dir;
    this.dispatchEvent(new CustomEvent('held', { detail: this.holdStop }));
  }
  // the house will not come (no WebGL, a failed or stalled start): scroll freely
  release() { const held = this.held; this.holding = false; this.held = 0; if (held) this.dispatchEvent(new Event('disarmed')); }
  // the house is up after a start in a room: make the move asked for meanwhile (one room, as a gesture would)
  resume() {
    const dir = this.held, i = this.holdStop, was = this.holding;
    this.holding = false; this.held = 0;
    if (was && dir && !this.reduced && !this.stills && !this.flight) this.go(i + dir, i);
  }
  jump(i) {
    this.holding = false; this.held = 0;
    window.scrollTo(0, this.tops[i]);
    this.lastY = this.restY = window.scrollY;
    this.origin = i;
  }
}

export function stopFromHash(hash = location.hash) {
  const id = decodeURIComponent(hash.replace('#', ''));
  return STOPS.findIndex(s => s.id === id);
}
