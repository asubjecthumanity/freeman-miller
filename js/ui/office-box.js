// The office's info box (owner: office; provisional) and the sessions app after it.
// The box: what the room is, the projects (each opens its session), and a way in. Scrolling on (or
// any of those buttons) zooms over Freeman's shoulder into the display, which hands over to the
// sessions app (office-sessions.js): one tab per project, one scroll step per tab, then a sign-off
// with contact. The steps are journey stops after the office (rooms/office.js `steps`, appended to
// the journey by path.js). Box module contract: see OWNERSHIP.md.
import room, { steps, sessions as SESSIONS } from '../rooms/office.js';
import { DISPLAY } from '../world/office-layout.js';
import { DESKTOP } from '../world/office-paint.js';
import { esc } from './common.js';
import { renderSessions, bindSessions } from './office-sessions.js';
import { office as state } from './office-state.js';

export const stop = room.stop;
const N = SESSIONS.length;
// the journey stop of session k (k = N: the sign-off)
const stopOf = k => steps[Math.max(0, Math.min(N, k))].stop;

export function render(P) {
  document.getElementById('panel-office').innerHTML = `
    <h2 id="office-h">Built with Claude</h2>
    <p class="lede"><span class="lede__3d">Freeman at his desk after dark: agents at work, Xcode running Semitone, and a</span><span class="lede__flat">A</span> Claude session open for each project.</p>
    <ul class="olist" aria-label="Projects">${SESSIONS.map((p, i) => `<li><button type="button" class="olist__go" data-k="${i}"><span class="olist__name">${esc(p.name)}</span><span class="olist__kind">${esc(p.kind)}</span></button></li>`).join('')}</ul>
    <p class="ohint"><button type="button" class="ohint__open" data-k="0">Open the sessions</button><span class="ohint__or">or keep scrolling</span></p>`;
  document.getElementById('office').insertAdjacentHTML('beforeend', renderSessions(P, stopOf));
}

export function bind({ P, player, journey, world }) {
  const html = document.documentElement, root = document.getElementById('sessions'), panel = document.getElementById('panel-office');
  // static: the app sits in the page (no WebGL); still: reduced motion, the app shows at its steps
  // without the zoom and without animation
  const isStatic = () => html.classList.contains('no-webgl');
  let reduced = isStatic();
  const still = html.classList.contains('reduced');
  let pending = null, pendingTimer = 0;

  // "Back out to the lawn": travel to the lawn and take the keyboard along, to the greeting
  const hello = document.getElementById('hello-title');
  const back = () => {
    journey.travel(0, { push: true });
    if (hello) { hello.setAttribute('tabindex', '-1'); hello.focus({ preventScroll: true }); }
  };
  const sessions = bindSessions({ root, P, player, reduced, still, go: (k, how) => go(1 + k, how === 'click' || how === 'key' ? 'jump' : 'fly'), back });
  // w: position past the office stop (0 the office, 1..N the sessions, N+1 the sign-off). The journey
  // calls this on every move and at every rest, anywhere in the house.
  function show(w) {
    if (reduced) return;
    // out of the office (a cut to another room never draws the office, so its frames cannot put the
    // app away): the app goes, so it never hides another room's box, players or focus
    if (w < -0.5) sessions.hide();
    // a flight into the sessions shows its destination at once (box buttons, keyboard or pointer focus
    // on a tab), so the tabs in between do not flicker past and focus is never pulled to them
    const f = journey.flight, to = f && f.target > room.stop ? f.target - room.stop - 1 : null;
    // a flight that leaves the sessions (a map link, Back, a box or sign-off link): the session being
    // read (or the sign-off) stays while the camera zooms out and the app fades. journey.js first drops
    // the scroll back to the first session's place, which must not swap the first session in.
    const leaving = !!f && f.target <= room.stop;
    const k = pending ?? to ?? (leaving ? (sessions.signoff ? N : sessions.cur) : Math.max(0, Math.min(N, Math.round(w) - 1)));
    // (pictures load only once the office is in reach); focus follows the session only at rest, and only
    // while the journey is in the sessions (leaving them, app.js takes the keyboard to the room it reaches)
    if (k < N) sessions.select(k, { focus: !f && w > 0.5 && root.querySelector('.stabs')?.contains(document.activeElement) && document.activeElement !== sessions.tabs[k], load: w > -1.15 });
    sessions.setSignoff(k >= N && (leaving || w > N + 0.5));
    // the session that went away held the keyboard: focus moves to the new session's tab (or the sign-off's
    // heading) once that cannot set off another move: during the flight to it, or at rest on it. Mid-scroll
    // it waits (a focused tab elsewhere would fly the journey there).
    if (sessions.refocus) {
      if (leaving || w < 0.5) sessions.refocus = false;
      else if ((f && f.target === stopOf(k)) || (!f && Math.abs(w - Math.round(w)) < 0.002)) {
        sessions.refocus = false;
        const el = k < N ? sessions.tabs[k] : document.getElementById('so-h');
        if (el && !el.matches('button, [tabindex]')) el.setAttribute('tabindex', '-1');
        el?.focus({ preventScroll: true });
      }
    }
    state.idle = pending == null && w < 0.08;
  }
  // put step w on screen: 'jump' (already the tab you clicked) or 'fly' (from the box, or by focus)
  function go(w, how = 'fly') {
    if (reduced) return;
    const k = w - 1;
    if (k >= 0 && k < N) sessions.select(k);
    state.tab = Math.max(0, Math.min(N - 1, k));
    state.idle = false;
    if (how === 'fly') { pending = k >= 0 ? Math.min(k, N) : null; clearTimeout(pendingTimer); pendingTimer = setTimeout(() => { pending = null; }, 6000); }
    // a click or tap on a tab also focused it, which may have set off a flight there: end it, or its
    // next frame would scroll the journey back to where it was
    if (how === 'jump') { journey.cancel(true); journey.jump(room.stop + w); journey.settle(); }
    else journey.flyTo(room.stop + w, { push: true });
  }
  const settled = () => { pending = null; clearTimeout(pendingTimer); };

  if (!reduced) {
    journey.addEventListener('move', () => show(journey.u - room.stop));
    journey.addEventListener('settle', () => { settled(); show(journey.u - room.stop); });
    state.onFrame = info => sessions.frame(info);
  }

  // the box: each project opens its session; "Open the sessions" opens the first
  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    const k = +b.dataset.k;
    // no WebGL: the sessions sit in the page after the box; select the session, bring the window into
    // view and put focus on its tab
    if (reduced) {
      sessions.select(k);
      root.querySelector('.swin').scrollIntoView({ block: 'start' });
      sessions.tabs[k].focus({ preventScroll: true });
      return;
    }
    go(1 + k, 'fly');
    // keyboard users land on the tab they chose
    if (e.detail === 0) setTimeout(() => sessions.tabs[k].focus({ preventScroll: true }), 50);
  });
  // keyboard: app.js travels to the [data-stop] that takes focus (the tabs, panels and sign-off carry their step's stop)
  // the 3D view failed after all: fall back to the static layout
  new MutationObserver(() => {
    if (!reduced && isStatic()) { reduced = true; sessions.toStatic(); }
  }).observe(html, { attributes: true, attributeFilter: ['class'] });

  return {
    // the world exists now: hand the office its camera, and show the session a deep link started on (a
    // start in a room jumps there while the house loads and holds the scroll, without a move or a rest)
    sync() { const w = world?.(); if (w?.camera) state.camera = w.camera; if (!reduced) show(journey.u - room.stop); },
  };
}

// Leader lines from the display (the sessions and the agents column) and the laptop (Xcode), routed
// around Freeman and off the picture on the display (routing hints for overlay.js, all world points):
//   wide screens: the loom's junction sits above the laptop, higher than the display and the labels;
//     each wire rises from its dot to the one level run above the display, which carries on into the box.
//   phones (the overlay's sheet layout): the wires rise above the display, run left to the edge of the
//     view, down past the laptop to a junction above the sheet, and the trunk drops to the sheet.
// The overlay reads `junction`, each anchor's `via` and `labelSide` every frame, so a change of layout
// just swaps them (as the theater does).
const SHEET = '(max-aspect-ratio: 4/5), (max-width: 760px) and (min-height: 501px)'; // as in overlay.js
export function leaders(world) {
  const a = world.anchors.office, at = (x, y, z) => a.screen.clone().set(x, y, z);
  const top = DISPLAY.y + DISPLAY.h / 2, edge = -0.42;
  const wide = { junction: at(a.xcode.x, top + 0.16, a.xcode.z + 0.035), via: [[], [], []], side: [undefined, 'left', undefined] };
  const port = {
    junction: at(10, 3.7, edge),
    // (phones always show the 1440 x 900 desk, so the agents column is where DESKTOP puts it)
    via: [[at(a.screen.x, top + 0.18, a.screen.z), at(10, top + 0.18, edge)], [at(a.screen.x, top + 0.18, DISPLAY.z - DISPLAY.w / 2 + (DESKTOP.agents.x + DESKTOP.agents.w / 2) * DISPLAY.w), at(10, top + 0.18, edge)], [at(10, a.xcode.y, edge)]],
    side: [undefined, undefined, undefined],
  };
  const junction = wide.junction.clone();
  const anchors = [{ p: a.screen, label: 'Claude sessions', via: [] }, { p: a.agents, label: 'Agents at work', via: [] }, { p: a.xcode, label: 'Xcode', via: [] }];
  const mq = matchMedia(SHEET);
  const use = () => {
    const r = mq.matches ? port : wide;
    junction.copy(r.junction);
    anchors.forEach((x, i) => { x.via.splice(0, x.via.length, ...r.via[i]); x.labelSide = r.side[i]; });
  };
  use();
  mq.addEventListener('change', use);
  return { anchors, junction, flow: s => !s.reduced };
}
