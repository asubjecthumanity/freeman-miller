// The basement home theater (stop 1). Owner: theater.
// The move that arrives here (from the lawn) belongs to rooms/outside.js, so this room has no moveIn.
// Field reference: js/path.js (top comment). All u values are absolute positions on the timeline.

// the screen's aspect ratio, for the frame slide below
let aspect = 1.6;
if (typeof window !== 'undefined') {
  const measure = () => { aspect = innerWidth / Math.max(1, innerHeight); };
  measure();
  addEventListener('resize', measure);
}

export default {
  stop: 1, id: 'theater', name: 'Theater', group: 'theater',

  // seated in the middle of the back row (eye 1.57 m: a 0.45 m riser), the front row's seat backs in
  // the foreground and the TV central in the picture left of the box. fit: on landscape screens narrower
  // than 1.7:1 (tablets, 4:3 and 16:10 windows) the view widens so that all six speakers, from the
  // left surround to the right one, stay on screen and clear of the box.
  key: { u: 1, p: [-4.15, 1.57, 3.3], look: [-4.15, 1.5, -3.2], fov: 55, fit: 1.7, stop: true,
    port: { p: [-4.15, 1.62, 3.45], look: [-4.15, 1.36, -3.2], fov: 78 } },

  // the TV glow: the sun is off down here
  light: { hemi: ['#56668a', '#2a1c16', 0.42], sun: { pos: [-16, 24, 22], target: [-1, 2, 1], color: '#fff1d8', i: 0, box: 28 }, env: 0.22, exposure: 1.45 },
  // narrower than 16:10 the box takes more of the width: the picture slides a little further left
  // (0.15 at 16:10 and wider, 0.18 from 4:3 down)
  frame: { get x() { return 0.15 + 0.12 * Math.min(0.25, Math.max(0, 1.6 - aspect)); }, y: 0.24 },
  // drawn from the moment the section iris starts on it (u 0.16), and in the office move's look back at
  // the house in section (u 3.4..3.6), where it is the glowing middle of the basement
  visible: [[0.15, 1.97], [3.25, 3.9]],
  // the dwell here plus the scroll of the move that leaves (up through the floor, owned by the living room)
  length: 2.4,
};
