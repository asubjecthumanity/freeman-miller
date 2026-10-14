// The theater's info box (owner: theater): Paranoia, the sound control and the score's cues, the TV
// picture as a click target, and the leader lines from the speakers. Box module contract: see OWNERSHIP.md.
import room from '../rooms/theater.js';
import { esc, I, trackRow } from './common.js';

export const stop = room.stop;

const MUTE = '<svg class="on" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 9.5l5 5m0-5l-5 5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>';

export function tracks(P) {
  return P.filmScore.cues.map(c => ({ ...c, kind: 'cue', stop, group: P.filmScore.film }));
}

export function render(P) {
  const F = P.filmScore;
  document.getElementById('panel-theater').innerHTML = `
    <h2 id="theater-h"><em>${esc(F.film)}</em></h2>
    <p class="lede">${esc(F.role)} for ${esc(F.director)}’s film.</p>
    <p class="visually-hidden" id="tv-says"></p>
    <button class="sound-on" id="sound-on" type="button" data-state="off">${I.soundOff}${MUTE}<span data-label>Turn the sound on</span></button>
    <ol class="tracks" aria-label="${esc(F.film)} score">${F.cues.map(c => trackRow(c)).join('')}</ol>
    ${F.watchUrl ? `<p class="small"><a href="${esc(F.watchUrl)}">Watch ${esc(F.film)}</a></p>` : ''}`;
  // The TV picture is a click target as well: a pointer shortcut for the button above, so it stays out
  // of the tab order and the accessibility tree. world/theater.js keeps it over the picture.
  if (!document.getElementById('tv-hot')) {
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'tv-hot'; b.className = 'tv-hot'; b.tabIndex = -1;
    b.setAttribute('aria-hidden', 'true');
    document.getElementById('theater').appendChild(b);
  }
}

// The TV plays Cue 1 silently whenever the theater is in view. "Turn the sound on" plays Cue 1 from the
// start (or from where its row's slider was set), and the TV starts again from the title card with it:
// picking the sound up where the silent loop happens to be would give a visitor who arrives late in the
// loop a couple of seconds of Cue 1 and then Cue 2. Then the control steps aside: focus moves to the
// playing cue's Pause button (the row's button, which pauses it). Paused, the control comes back as
// "Turn the sound back on". The TV picture is a pointer shortcut for the same control (and pauses while
// a cue plays). Without the 3D world (no WebGL, ?flat, or before it is ready) there is no TV, and the
// TV's words are dropped.
export function bind({ P, player, world }) {
  const btn = document.getElementById('sound-on'), hot = document.getElementById('tv-hot');
  const label = btn.querySelector('[data-label]'), says = document.getElementById('tv-says');
  const first = P.filmScore.cues[0].id;
  const root = document.documentElement;
  const reducedNow = () => root.classList.contains('reduced');
  const flatNow = () => root.classList.contains('no-webgl');
  const rowButton = id => document.querySelector(`#panel-theater .track[data-id="${CSS.escape(id)}"] .track__play`);
  const state = () => {
    const c = player.current;
    if (c?.kind !== 'cue') return 'off';
    if (player.playing) return 'on';
    const t = player.time();
    return t > 0.1 && t < c.duration - 0.1 ? 'paused' : 'off';
  };
  const act = fromButton => {
    const st = state();
    if (st === 'on') { player.pause(); return; }
    const id = st === 'paused' ? player.current.id : first;
    // off: Cue 1 from the top, unless the visitor set its row's start point (Cue 1 itself, stopped at its
    // start or its end, starts again from 0)
    if (st === 'paused') player.play(id); else player.play(first, player.current?.id === first ? 0 : player.at(first));
    // the control steps aside; the keyboard lands on the cue's own Pause button
    if (fromButton) {
      const b = rowButton(id), t = player.tracks.get(id);
      if (b) { b.setAttribute('aria-label', `Pause ${t.title}`); b.focus(); }
    }
  };
  btn.addEventListener('click', () => act(true));
  hot.addEventListener('click', () => act(false));
  hot.addEventListener('mousedown', e => e.preventDefault()); // a click on the picture leaves focus where it was
  const hover = on => { const tv = world()?.theater?.tv; if (tv) tv.hover = on; };
  hot.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hover(true); });
  hot.addEventListener('pointerleave', () => hover(false));
  let look = '';
  const sync = () => {
    const st = state();
    btn.dataset.state = st;
    btn.hidden = st === 'on';
    label.textContent = st === 'paused' ? 'Turn the sound back on' : 'Turn the sound on';
    // the TV in words, for anyone who cannot see it (no TV on the flat page: no words either)
    const flat = flatNow(), c = player.current?.kind === 'cue' ? player.current : null;
    look = `${flat}${reducedNow()}`;
    says.hidden = flat;
    says.textContent = flat ? ''
      : st === 'on' ? `The TV is playing ${c.title} with the sound on.`
      : st === 'paused' ? `The TV is paused on ${c.title}.`
      : reducedNow() ? `The TV shows ${P.filmScore.film}, ${P.filmScore.cues[0].title}, with the sound off.`
      : `The TV is playing ${P.filmScore.cues[0].title} with the sound off.`;
  };
  player.addEventListener('change', sync);
  // the page falls back to the flat house if the 3D view fails to start: say so as soon as it does
  new MutationObserver(() => { if (`${flatNow()}${reducedNow()}` !== look) sync(); }).observe(root, { attributes: true, attributeFilter: ['class'] });
  sync();
  return { sync };
}

// Wires from each speaker to the box; the signal runs along them while anything plays.
// `via` and `junction` are routing hints for overlay.js; the routes themselves are world points made in
// world/theater.js (`route`), so that no wire crosses the picture, a cabinet or a cone:
//   wide screens: each wire rises to one run along the slats above the picture, which runs on, level,
//     into the box.
//   phones (the overlay's sheet layout): the wires meet at the receiver and the trunk drops to the sheet.
// The overlay reads `junction` and each anchor's `via` every frame, so a change of layout just swaps them.
const SHEET = '(max-aspect-ratio: 4/5), (max-width: 760px) and (min-height: 501px)'; // as in overlay.js
export function leaders(world) {
  const A = world.anchors.theater, T = world.theater, R = T.route;
  const mq = matchMedia(SHEET);
  let r = mq.matches ? R.port : R.wide;
  const junction = r.junction.clone();
  mq.addEventListener('change', () => { r = mq.matches ? R.port : R.wide; junction.copy(r.junction); });
  return {
    anchors: ['sl', 'fl', 'sub', 'c', 'fr', 'sr'].map(k => ({
      // Front right's tag goes left only when the box leaves no room on its right (the overlay decides)
      p: A[k], label: T.speakers[k].label, labelSide: k === 'sr' ? 'left' : k === 'fr' ? null : 'right',
      get via() { return r.via[k] || null; },
    })),
    junction,
    portAt: '.tracks',
    // the signal runs while a cue of the score plays
    flow: s => s.playing && s.kind === 'cue',
  };
}
