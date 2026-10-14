// One place for the house's dimensions (metres). x runs left to right as seen from the lawn,
// y is up, +z points out of the front of the house toward the lawn and the viewer. Owner: exterior
// (room interiors are fixed: ask in notes/exterior.md before changing a room's size or position).
export const F0 = 0;      // basement floor
export const C0 = 2.85;   // basement ceiling
export const F1 = 3.3;    // main floor
export const C1 = 6.1;    // main ceiling
export const LV = { x0: -10.5, x1: 1.5, z0: -6, z1: 4 };      // left volume (theater below; living + studio above)
export const CORE = { x0: 1.5, x1: 4.6, z0: -5.2, z1: 2.6, top: 6.7 };
export const RV = { x0: 4.6, x1: 10.8, z0: -5, z1: 3.9, under: 0.6 }; // right volume (office), cantilevered
export const PART_Z = -1.0;                                     // living | studio partition
export const THEATER = { x0: -7.4, x1: -0.9, z0: -3.2, z1: 3.8 };
export const WALL = 0.2;
// the deck on the left end of the house (main-floor level, behind the corner glass) and the walkout below it
export const DECK = { x0: -14.3, x1: LV.x0, z0: -6.5, z1: -0.7 };

// The way in (outside.js): an iris opens in the facade, centred on the theater, and grows until the
// whole front of the house is cut away at the section plane z = zc. Driven by the outside move's
// "section" portal (see outside.js); the shell's materials read it (shell.js sectionize).
export const SECTION = { cx: -4.15, cy: 1.45, r: 17.6, zc: 3.62, marker: -600 };

// lawn height
export function ground(x, z) {
  let y = 0;
  if (z > 4.6) y -= 0.19 * (z - 4.6) - 0.004 * Math.max(0, z - 12) ** 2 * 0.5;
  if (z < -6.6) y += Math.min(3.0, 0.7 * (-6.6 - z));
  y += 0.1 * Math.max(0, x - 1.5);
  y += 0.16 * Math.max(0, x - 10.5) * (z < 10 ? 1 : Math.max(0, 1 - (z - 10) / 12));
  y += 0.22 * Math.sin(x * 0.17 + 1.3) * Math.sin(z * 0.13 + 0.4) * (z > 7 ? 1 : 0.25);
  const inHouse = x > DECK.x0 - 0.5 && x < RV.x1 + 0.1 && z > LV.z0 - 0.6 && z < LV.z1 + 0.12;
  if (inHouse && x < CORE.x0 + 0.1) y = Math.min(y, -0.35);
  return y;
}
