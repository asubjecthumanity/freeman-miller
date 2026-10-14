// The music studio (stop 3), other music. Owner: studio.
// Owns the move that arrives here: from the piano's long view the camera turns left almost all the
// way round (about 170 degrees: yaw 65 at the living-room stop, 234 here; 59 to 231 on portrait
// screens). It pans left and steps back along the living room, comes square to the partition about
// 1.3 m away while the wall opens layer by layer (paint and plasterboard, then the stud bay:
// js/world/studio-wall.js), pushes through, and keeps turning as it draws back along the partition,
// so the studio opens up into the long view down the room: synth and amp in front, the desk with its
// session view and monitors, guitars and drums along the glass, the eight-track, and the vocal booth
// with its ON AIR sign in the far corner. Explicit yaw keeps the turn going left (path.js).
// Field reference: js/path.js (top comment). All u values are absolute positions on the timeline.

// where the camera passes through the partition (the portal's axis; studio-wall.js reads it)
const HOLE = { x: -3.79, y: 5.02 };

export default {
  stop: 3, id: 'studio', name: 'Studio', group: 'studio',

  // the long view down the studio: from the left end, by the partition, diagonally across the room
  // to the booth in the far corner (the mirror of the living room's long view)
  key: { u: 3, p: [-7.0, 5.35, -0.45], yaw: 234, pitch: -14, fov: 66, stop: true,
    // portrait: a step further back and a little to the right, so the booth, the eight-track, the
    // drums, the desk and the synth fit the narrow view
    port: { p: [-7.4, 5.5, -0.55], yaw: 231, pitch: -17, fov: 82 } },

  moveIn: {
    // from the piano's long view: turn left and step back along the room, come square to the
    // partition about 1.3 m away while it opens, push through, then keep turning while the camera
    // draws back along the partition to the long view (yaw rises all the way: 65 .. 234)
    keys: [
      { u: 2.15, p: [-1.6, 5.02, -1.74], yaw: 92, pitch: -6, fov: 55, port: { p: [-4.2, 5.21, -2.0], yaw: 84, fov: 67 } },
      { u: 2.3, p: [-2.2, 5.04, -2.12], yaw: 124, pitch: -4, fov: 56, port: { p: [-4.05, 5.17, -2.55], yaw: 122, fov: 67 } },
      { u: 2.4, p: [-2.7, 5.05, -2.3], yaw: 148, pitch: -3, fov: 57, port: { p: [-3.95, 5.14, -2.65], yaw: 156, fov: 67 } },
      { u: 2.48, p: [-3.15, 5.05, -2.34], yaw: 167, pitch: -3, fov: 57, port: { p: [-3.86, 5.13, -2.56], yaw: 171, fov: 68 } },
      { u: 2.56, p: [-3.42, 5.06, -2.3], yaw: 176, pitch: -2, fov: 57, port: { p: [-3.82, 5.12, -2.36], yaw: 178, fov: 68 } },
      { u: 2.66, p: [-3.66, 5.07, -1.76], yaw: 182, pitch: -3, fov: 58, port: { p: [-3.8, 5.12, -1.76], yaw: 183, fov: 70 } },
      // through the wall (the hole is centred on x -3.79): from here on the camera drifts left of it
      { u: 2.76, p: [-3.8, 5.1, -1.0], yaw: 190, pitch: -6, fov: 60, port: { p: [-3.85, 5.15, -1.0], yaw: 190, fov: 73 } },
      { u: 2.88, p: [-5.1, 5.24, -0.52], yaw: 213, pitch: -11, fov: 64, port: { p: [-5.5, 5.35, -0.55], yaw: 211, pitch: -14, fov: 78 } },
    ],
    portals: [
      { a: [HOLE.x, HOLE.y, -1.75], b: [HOLE.x, HOLE.y, -0.3], r: 0.96, open: [2.28, 2.46], close: [2.92, 2.99] },
    ],
    lightBlend: [0.66, 0.9],
  },

  // late-afternoon sun from the lawn, low through the big front glass: long mullion shadows on the rug
  light: { hemi: ['#ffeedd', '#5a4030', 0.56], sun: { pos: [-15, 10, 17], target: [-3.6, 3.3, 1.6], color: '#ffe0b4', i: 3.6, box: 9 }, env: 0.36, exposure: 1.12 },
  frame: { x: 0.14, y: 0.2 },
  // also drawn from the lawn and through the way in, where the house opens in section (to 0.97, as the
  // camera dives into the basement), and from 2.25 on, so the wall section in world/studio-wall.js is
  // drawn before the partition opens at 2.28
  visible: [[-1, 0.97], [2.25, 3.92]],
  // the dwell here plus the scroll of the move that leaves (through the brick core, owned by the office)
  length: 2.4,
};
