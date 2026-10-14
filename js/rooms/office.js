// The office (stop 4), Claude projects; provisional. Owner: office.
// Owns the move that arrives here: out through the studio's front glass, a swing round over the lawn to
// look back at the whole house in section (the front walls lift away, like the map's drawing), then
// a crane right and in through the office's own front window, turning to Freeman at his desk.
// Field reference: js/path.js (top comment). All u values are absolute positions on the timeline.
//
// After the office come its STEPS (exported below as `steps`): scrolling on zooms the camera over his
// shoulder into the big display, which hands over to a full-viewport HTML app of Claude sessions, one
// tab per project, one step per tab, then a contact step. Each step is a room-shaped object (stop 5,
// 6, ...) with `parent: 'office'`; path.js appends them to ROOMS, so they are stops like any other.
import { DISPLAY as D, sessionOrder } from '../world/office-layout.js';
import { SECTION } from '../world/layout.js';


// dusk: a cool, low sky light through the side window; the desk lamp and the screens do the rest
const LIGHT = { hemi: ['#8d93c4', '#3a2c2a', 0.42], sun: { pos: [24, 9, 2], target: [8, 3.6, 0.2], color: '#b9b4e6', i: 0.8, box: 8 }, env: 0.18, exposure: 1.08 };
// also drawn from the lawn and through the way in (the house opens in section, u 0.16..1.04), and
// from this room's own move on (the section again, from the lawn)
const VISIBLE = [[-1, 0.97], [3.18, 99]];

// camera distance from the display's glass once it fills the view (landscape: covers up to 2:1;
// portrait: the display spans the width)
export const SCREEN = { land: 0.56, port: 0.72 };
const screenKey = u => ({ u, stop: true, p: [D.x - SCREEN.land, D.y, D.z], look: [D.x + 1, D.y, D.z], fov: 40,
  port: { p: [D.x - SCREEN.port, D.y, D.z], look: [D.x + 1, D.y, D.z], fov: 66 } });

const office = {
  stop: 4, id: 'office', name: 'Office', group: 'office',

  // behind Freeman, a little above him: his head and shoulders against the glowing display, dusk beyond
  key: { u: 4, p: [7.45, 5.03, 0.62], look: [10.2, 4.38, 0.42], fov: 45, stop: true,
    port: { p: [6.55, 5.55, 0.5], look: [10.2, 4.35, 0.46], fov: 66 } },

  moveIn: {
    keys: [
      // over the studio desk, between the pendants and the eight-track, toward the glass
      { u: 3.08, p: [-2.42, 5.34, 1.7], yaw: 205, pitch: -8, fov: 60, port: { fov: 70 } },
      // out under the eave, already banking left
      { u: 3.16, p: [-2.3, 5.42, 4.7], yaw: 214, pitch: -3, fov: 56, port: { fov: 70 } },
      { u: 3.27, p: [0.0, 6.2, 10.8], yaw: 252, pitch: -6, fov: 54, port: { fov: 70 } },
      // looking back at the whole house, cut open: theater below, studio above, the office box on the
      // right. Nearly still for a beat, so the picture registers even in a quick flight.
      { u: 3.4, p: [0.8, 6.9, 21.5], yaw: 369, pitch: -8, fov: 54, port: { p: [2.4, 7.4, 30], yaw: 367, fov: 66 } },
      { u: 3.6, p: [2.2, 6.65, 20.2], yaw: 367.5, pitch: -8, fov: 53, port: { p: [3.2, 7.1, 28], fov: 65 } },
      // crane right and down to the office window
      { u: 3.74, p: [6.2, 5.3, 10.5], yaw: 361, pitch: -4, fov: 52, port: { p: [6.6, 5.3, 12], fov: 64 } },
      { u: 3.85, p: [6.8, 5.05, 4.8], yaw: 354, pitch: -3, fov: 52, port: { fov: 66 } },
      // through the glass (between the mullions at x 6.2 and 7.4), turning right to the desk
      { u: 3.93, p: [6.95, 5.1, 2.6], yaw: 318, pitch: -6, fov: 50, port: { fov: 68 } },
    ],
    // the section cut of the way in (shell.js): a capsule parked at SECTION.marker is read by the shell
    // as the iris progress, so the whole front of the house opens while the camera has its back to it,
    // and closes again once the camera is inside the office looking away from the front wall
    portals: [
      { a: [SECTION.cx, SECTION.marker, 0], b: [SECTION.cx, SECTION.marker, 0.01], r: 1, open: [3.17, 3.3], close: [3.9, 3.97] },
    ],
    lightBlend: [0.8, 0.97],
  },

  light: LIGHT,
  frame: { x: 0.14, y: 0.22 },
  visible: VISIBLE,
  // the dwell here plus the zoom into the screen (the move to the first step)
  length: 1.4,
};
export default office;

// the zoom: over his right shoulder, past his headphones, square onto the glass
export const ZOOM_KEYS = [
  { u: 4.3, p: [8.45, 4.98, 0.92], look: [10.2, 4.5, 0.5], fov: 45, port: { p: [8.3, 5.05, 0.82], fov: 64 } },
  { u: 4.58, p: [9.22, 4.66, 0.72], look: [10.2, 4.52, 0.47], fov: 42, port: { p: [9.05, 4.7, 0.66], fov: 64 } },
  // square on before the hand-over starts, so the HTML lands on the picture it replaces
  { u: 4.8, p: [9.48, 4.52, 0.47], look: [D.x + 1, 4.5, 0.46], fov: 40.5, port: { p: [9.38, 4.52, 0.47], fov: 66 } },
];

/* ---------- the steps: one per session tab, then contact ---------- */
const SESSIONS = sessionOrder(window.PORTFOLIO?.projects || []);
const step = (k, id, name, length) => ({
  stop: 5 + k, id, name, group: 'office', parent: 'office',
  key: screenKey(5 + k),
  ...(k === 0 ? { moveIn: { keys: ZOOM_KEYS, lightBlend: [0.4, 0.8] } } : {}),
  light: LIGHT, frame: { x: 0, y: 0 }, visible: VISIBLE, length,
});
export const steps = [
  ...SESSIONS.map((p, k) => step(k, `office/${p.id}`, p.name, 0.9)),
  // the sign-off; the last section is just its dwell
  step(SESSIONS.length, 'office/contact', 'Contact', 1),
];
export const sessions = SESSIONS;
