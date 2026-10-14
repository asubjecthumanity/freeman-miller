// The living room's info box (owner: living): the six piano pieces, their links and the hand key,
// the leader line from the piano, and the hooks that make the room follow the player: the floating
// cover shows the playing (or selected) piece, the glass looks out on that piece's scene.
// Box module contract: see OWNERSHIP.md.
import room from '../rooms/living.js';
import { esc, trackRow } from './common.js';

export const stop = room.stop;

// windowScene: an image path relative to shared/ or a painter id from world/screens/window-view.js
export function tracks(P) {
  return P.pianoCollection.tracks.map(t => ({ ...t, kind: 'piano', stop, group: P.pianoCollection.title, windowScene: t.windowScene || 'blue-sky' }));
}

// the piece that is out (its scene is the view when nothing of the collection is playing)
export const releasedPiece = C => C.tracks.find(t => t.status === 'out') || C.tracks[0];

/* ---------- stand-in covers for pieces whose artwork is still to come ---------- */
// One design for all of them, a colour each: the piece's name set large in the house's Jost,
// its key, and the four tall panes of the living-room glass waiting for the piece's own world.
const FIELDS = ['#2b6a6b', '#33508a', '#8a3457', '#a86a26', '#3f6a55', '#62428a'];
export function standInColor(i) { return FIELDS[i % FIELDS.length]; }
export function paintStandIn(g, S, t, i) {
  const field = standInColor(i), ink = '#f4eadb';
  g.save();
  g.fillStyle = field; g.fillRect(0, 0, S, S);
  // light falling across the paper from the top left
  const lg = g.createRadialGradient(S * 0.2, S * 0.05, 0, S * 0.2, S * 0.05, S * 1.15);
  lg.addColorStop(0, 'rgba(255,248,232,.22)'); lg.addColorStop(1, 'rgba(0,0,0,.18)');
  g.fillStyle = lg; g.fillRect(0, 0, S, S);
  // the glass wall: four tall panes, a horizon, the first light of a sky
  const x0 = S * 0.09, x1 = S * 0.91, y0 = S * 0.37, y1 = S * 0.87, pw = (x1 - x0) / 4;
  const sky = g.createLinearGradient(0, y0, 0, y1);
  sky.addColorStop(0, 'rgba(244,234,219,.05)'); sky.addColorStop(0.62, 'rgba(244,234,219,.2)'); sky.addColorStop(0.63, 'rgba(244,234,219,.08)'); sky.addColorStop(1, 'rgba(244,234,219,.03)');
  g.fillStyle = sky; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.strokeStyle = 'rgba(244,234,219,.62)'; g.lineWidth = Math.max(1, S * 0.008);
  g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x0 + pw * k, y0); g.lineTo(x0 + pw * k, y1); g.stroke(); }
  g.lineWidth = Math.max(1, S * 0.004); g.strokeStyle = 'rgba(244,234,219,.35)';
  const hz = y0 + (y1 - y0) * 0.62;
  g.beginPath(); g.moveTo(x0, hz); g.lineTo(x1, hz); g.stroke();
  // lettering: the piece's name large, its key, and the promise
  g.fillStyle = ink; g.textBaseline = 'alphabetic';
  g.font = `500 ${Math.round(S * 0.15)}px Jost, Futura, system-ui, sans-serif`;
  if ('letterSpacing' in g) g.letterSpacing = `${Math.round(S * 0.012)}px`;
  g.fillText(String(t.title), S * 0.09, S * 0.21);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.globalAlpha = 0.85;
  g.font = `italic 400 ${Math.round(S * 0.055)}px Jost, Futura, system-ui, sans-serif`;
  if (t.key && t.key !== '—') g.fillText(`in ${t.key}`, S * 0.095, S * 0.295);
  g.globalAlpha = 0.8;
  g.font = `italic 400 ${Math.round(S * 0.052)}px Jost, Futura, system-ui, sans-serif`;
  g.fillText('Cover to come', S * 0.09, S * 0.945);
  g.restore();
}

export function render(P) {
  const C = P.pianoCollection;
  const pieceMeta = t => {
    const bits = [];
    if (t.status === 'out') {
      const url = t.spotifyUrl || C.spotifyUrl;
      bits.push(url ? `Out now. <a href="${esc(url)}">Listen to ${esc(t.title)} on ${esc(C.platform)}</a>` : `Out now. ${esc(C.platform)} link coming soon.`);
    } else bits.push(t.releaseDate ? `Coming ${esc(t.releaseDate)}. Preview.` : 'Coming soon. Preview.');
    if (t.key && t.key !== '—') bits.push(`${esc(t.key)}${t.meter ? `, ${esc(t.meter)}` : ''}.`);
    if (t.youtubeUrl) bits.push(`<a href="${esc(t.youtubeUrl)}">Watch ${esc(t.title)} on YouTube</a>`);
    return bits.join(' ');
  };
  const panel = document.getElementById('panel-living');
  panel.innerHTML = `
    <h2 id="living-h">${esc(C.title)}</h2>
    <p class="lede">${esc(C.summary)}</p>
    <p class="hands" aria-hidden="true"><span class="l"><b></b>Left hand</span><span class="r"><b></b>Right hand</span></p>
    <ol class="tracks" aria-label="${esc(C.title)}">${C.tracks.map(t => trackRow(t, pieceMeta(t))).join('')}</ol>`;
  // the stand-in cover, small, in the rows of pieces without artwork (decoration: the title is the row's)
  const thumbs = [];
  C.tracks.forEach((t, i) => {
    if (t.artwork) return;
    const row = panel.querySelector(`.track[data-id="${CSS.escape(t.id)}"]`);
    const info = row?.querySelector('.track__info');
    if (!info) return;
    const c = document.createElement('canvas');
    c.width = c.height = 104;
    c.className = 'track__art track__art--standin';
    c.setAttribute('aria-hidden', 'true');
    info.prepend(c);
    row.classList.add('has-art');
    thumbs.push([c, t, i]);
  });
  const paint = () => thumbs.forEach(([c, t, i]) => paintStandIn(c.getContext('2d'), 104, t, i));
  paint();
  document.fonts?.ready.then(paint);
}

// The room follows the player (BRIEF: the cover shows the piece "that is playing (or selected)"; the
// view is "the playing piece's windowScene ... With nothing playing it shows the released piece's"):
// the cover stays on the current piece, playing or paused; the glass looks out on the playing piece's
// scene and goes back to the released piece's (Liebesebbe's) world when it pauses or ends.
export function bind({ P, player, world }) {
  const C = P.pianoCollection, released = releasedPiece(C);
  const sync = () => {
    const w = world()?.living;
    if (!w) return;
    const c = player.current;
    const piece = c?.kind === 'piano' ? c : null;
    const playing = piece && player.playing ? piece : null;
    w.cover?.show(piece || released);
    w.view.set((playing || released).windowScene || 'blue-sky');
  };
  player.addEventListener('change', sync);
  return { sync };
}

export function leaders(world) {
  const a = world.anchors.living;
  // Phones (the box is a sheet along the bottom and the wire comes down to its top edge): the wire leaves
  // from the front of the keybed, under the keys, so it never runs down across the keyboard, which fills the
  // view while a piece plays (the camera leans in to the keys). Elsewhere: the tip of the open lid.
  // (overlay.js reads `p` every frame; the query is the one it lays the wires out by)
  const sheet = matchMedia('(max-aspect-ratio: 4/5), (max-width: 760px) and (min-height: 501px)');
  return {
    anchors: [{ get p() { return sheet.matches && a.slip ? a.slip : a.piano; }, label: 'Grand piano' }],
    flow: s => s.playing && s.kind === 'piano',
  };
}
