// Outside (stop 0): the lawn view of the house. Owner: exterior.
// Exception to "a room owns the move that arrives at it": outside also owns the move from the lawn
// into the theater (moveOut, 0 < u < 1): the camera swings round to face the house, an iris opens
// in the facade and keeps growing until the whole house stands open in section (every room lit),
// then the camera dives into the middle of the basement and sits down in the theater.
// Field reference: js/path.js (top comment). All u values are absolute positions on the timeline.
import { SECTION } from '../world/layout.js';

export default {
  stop: 0, id: 'outside', name: 'Outside', group: 'exterior',

  // a low three-quarter view of the front-left corner from down the lawn, looking up (the photo)
  key: { u: 0, p: [-23, -0.9, 18], look: [-1.5, 5.4, -1], fov: 50, stop: true,
    // phones: further down the slope and steeper, so the whole house fits the width; looking up keeps the lawn to a band
    port: { p: [-39, -3.4, 36], look: [-2.2, 14, -1.5], fov: 62 } },

  moveOut: {
    keys: [
      // rise and swing round to face the house
      { u: 0.18, p: [-15.5, 2.6, 28], look: [-2.6, 3.6, -0.5], fov: 42, port: { p: [-20, 1.0, 44], look: [-2.2, 5.6, 0], fov: 62 } },
      // the house square on, in section (the iris opens over 0.16..0.42), then a slow push while it reads
      { u: 0.42, p: [-2.4, 5.6, 31.5], look: [-2.4, 3.2, 0], fov: 36, port: { p: [0.1, 0.9, 45], look: [0.1, 8.6, 0], fov: 64 } },
      { u: 0.62, p: [-3.0, 5.0, 26.5], look: [-3.1, 2.9, 0], fov: 36, port: { p: [-2.4, 1.4, 33], look: [-2.6, 7.4, 0], fov: 64 } },
      // the dive into the middle of the basement and down into the back row
      { u: 0.8, p: [-4.0, 2.4, 12.5], look: [-4.12, 1.55, -1], fov: 44, port: { p: [-4.05, 2.4, 15.5], fov: 64 } },
      { u: 0.91, p: [-4.15, 1.8, 6.2], look: [-4.15, 1.45, -3.2], fov: 50, port: { fov: 72 } },
    ],
    // the section cut: SECTION.marker parks this capsule far underground (kit materials ignore it);
    // the shell reads its radius (0..1) as the iris progress. It closes again just past the theater
    // stop, behind the camera, before the studio looks out through the front glass.
    portals: [
      { a: [SECTION.cx, SECTION.marker, 0], b: [SECTION.cx, SECTION.marker, 0.01], r: 1, open: [0.16, 0.42], close: [1.0, 1.04] },
    ],
    // where in this move (0..1) the light rig cross-fades from the outside preset to the theater's
    lightBlend: [0.8, 0.95],
  },

  // daylight on the lawn
  light: { hemi: ['#d5ebff', '#5e8236', 0.8], sun: { pos: [-16, 24, 22], target: [-1, 2, 4], color: '#fff1d8', i: 3.6, box: 34 }, env: 0.55, exposure: 1.0 },
  // how far the picture slides away from the info box (fraction of the viewport): none outside
  frame: { x: 0, y: 0 },
  // u ranges in which the exterior group is drawn (it is seen again through the studio and office glass)
  visible: [[-1, 0.97], [2.55, 5]],
  // section height in viewport heights: the dwell here plus the scroll of the move that leaves (into the theater)
  length: 2.3,
};
