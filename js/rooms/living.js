// The living room (stop 2), the piano collection. Owner: living.
// Owns the move that arrives here: up from the theater through the basement ceiling / living-room floor.
// Field reference: js/path.js (top comment). All u values are absolute positions on the timeline.
export default {
  stop: 2, id: 'living-room', name: 'Living room', group: 'living',

  // the long view: from the right-hand end of the room diagonally down to the far-left corner, where
  // the grand stands in front of the glass by the teak wall unit
  key: { u: 2, p: [-1.3, 5.0, -1.5], look: [-7.3, 4.2, -4.25], fov: 54, stop: true,
    port: { p: [-2.5, 5.25, -1.7], look: [-7.35, 4.68, -4.6], fov: 70 } },

  // Listening: while a piece of the collection plays at this stop, the camera leans in from the long view
  // to stand a few steps from the keyboard (the keys a finger wide on screen, so their presses read), with
  // the floating cover above the piano still in the picture. world/living.js eases into it over a second
  // or so and back out when the piece pauses or ends, or as the visitor scrolls away. Not with reduced
  // motion (no camera moves there). Not part of the path: path.js never reads it.
  listen: { p: [-5.45, 5.15, -1.8], look: [-7.85, 4.68, -3.95], fov: 50,
    port: { p: [-5.4, 5.7, -1.6], look: [-7.85, 4.95, -3.95], fov: 66 } },

  // up through the floor: glide forward over the seats, tilt up as a hole opens in the ceiling, rise
  // through a clean section of the floor (boards, joists, ceiling board), level out facing the piano,
  // then draw back to the long view
  moveIn: {
    keys: [
      { u: 1.2, p: [-4.3, 1.85, 0.7], look: [-4.45, 1.75, -3.2], fov: 56, port: { fov: 76 } },
      { u: 1.38, p: [-4.58, 2.0, -1.35], yaw: 0, pitch: 38, fov: 58, port: { fov: 74 } },
      { u: 1.5, p: [-4.6, 2.45, -2.1], yaw: 25, pitch: 84, fov: 58, port: { fov: 72 } },
      { u: 1.6, p: [-4.6, 3.12, -2.15], yaw: 45, pitch: 68, fov: 57, port: { fov: 70 } },
      { u: 1.7, p: [-4.55, 3.92, -2.12], yaw: 55, pitch: 22, fov: 56, port: { fov: 68 } },
      { u: 1.8, p: [-3.95, 4.55, -1.95], yaw: 60, pitch: 1, fov: 55, port: { fov: 67 } },
      { u: 1.9, p: [-2.5, 4.92, -1.6], yaw: 63, pitch: -6, fov: 54, port: { p: [-3.4, 5.1, -1.8], fov: 66 } },
    ],
    portals: [
      { a: [-4.6, 2.5, -2.15], b: [-4.6, 3.7, -2.15], r: 0.9, open: [1.3, 1.46], close: [1.8, 1.93] },
    ],
    // where in this move (0..1) the light rig cross-fades from the theater preset to this one
    lightBlend: [0.45, 0.7],
  },

  // warm lamplight inside, daylight through the back glass
  light: { hemi: ['#fff1e0', '#a2876a', 0.85], sun: { pos: [-7, 12, -17], target: [-4.6, 3.3, -3.2], color: '#fff0d6', i: 3.0, box: 8 }, env: 0.45, exposure: 1.05 },
  frame: { x: 0.14, y: 0.24 },
  // also drawn on the way in and in the office move's look back, while the house stands open in
  // section and the partition is lowered (the living room shows behind the studio)
  visible: [[0.16, 0.97], [1.2, 3.02], [3.25, 3.9]],
  // the dwell here plus the scroll of the move that leaves (the turn into the studio, owned by the studio)
  length: 2.6,
};
