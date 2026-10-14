// The studio's info box (owner: studio): the other-music tracks, and one leader line per track,
// each from a fitting studio object (otherMusic[].studioProp, by default the session view for the
// first, the monitors for the second, then the synth, the eight-track, ...). Box module contract: see
// OWNERSHIP.md.
import room from '../rooms/studio.js';
import { esc, trackRow } from './common.js';

export const stop = room.stop;

// studio objects a track's line can start at (world anchors in js/world/studio.js), with their labels
const PROPS = { tape: 'Eight-track', monitors: 'Monitors', screen: 'Session view', booth: 'Vocal booth', synth: 'Synth', guitars: 'Guitars', drums: 'Drum kit' };
// the default object per track, in list order. From the stop the session view sits above and left of
// the monitors, as the first row sits above the second, and both are the nearest objects to the box:
// each wire runs over the window to its own row without crossing the other wire or an instrument.
const ORDER = ['screen', 'monitors', 'synth', 'tape', 'booth', 'guitars', 'drums'];
export const propOf = (t, i) => (PROPS[t.studioProp] ? t.studioProp : ORDER[i % ORDER.length]);

export function tracks(P) {
  return P.otherMusic.map(t => ({ ...t, kind: 'other', stop, group: 'Other music' }));
}

export function render(P) {
  document.getElementById('panel-studio').innerHTML = `
    <h2 id="studio-h">Other music</h2>
    ${lede(P)}
    <ol class="tracks" aria-label="Other music">${P.otherMusic.map(t => trackRow(t, esc(t.context))).join('')}</ol>`;
}

// Only what the data says: stand-in entries carry the data's own note (otherMusicNote); the real list
// needs no lede (each row has its own context line).
function lede(P) {
  if (!P.otherMusic.some(t => t.placeholder)) return '';
  return `<p class="lede">${esc(P.otherMusicNote || 'Stand-in entries for now.')}</p>`;
}

// the studio's screen shows the title of whatever plays (or played last), anywhere in the house
let player = null;
export function bind(ctx) {
  player = ctx.player;
  const sync = () => ctx.world()?.studio?.setTrack?.(player.current);
  player.addEventListener('change', sync);
  return { sync };
}

export function leaders(world) {
  const A = world.anchors.studio;
  const P = window.PORTFOLIO;
  return {
    // per anchor: `track` and `port` (the track's row) let the overlay end each line at its own
    // track and run the signal only along the playing one (see notes/studio.md); `flow` below is
    // the room-wide fallback the overlay uses today
    anchors: P.otherMusic.map((t, i) => {
      const prop = propOf(t, i);
      return {
        p: A[prop] || A.tape, label: PROPS[prop], track: t.id,
        port: `.track[data-id="${CSS.escape(t.id)}"] .track__play`,
        flow: () => !!player && player.playing && player.current?.id === t.id,
      };
    }),
    flow: s => s.playing && s.kind === 'other',
  };
}
