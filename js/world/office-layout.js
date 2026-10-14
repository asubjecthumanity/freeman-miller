// Where things stand in the office (owner: office). Shared by the room's camera keys
// (js/rooms/office.js), its world module (js/world/office.js) and its box (js/ui/office-*.js).
// The office is the cantilevered right volume: inside x 4.8..10.6, z -4.8..3.7, floor F1, ceiling C1.
// Freeman sits facing +x, toward the side window (x = RV.x1). The shell's glass band runs from z -1.6 on
// that side round the front corner (z 3.8) and across the front to the brick core (shell.js glassBand);
// WINDOW is the part in front of the desk, which places the dusk backdrop (world/office.js).
import { F1, C1, RV } from './layout.js';

export const ROOM = { x0: RV.x0 + 0.2, x1: RV.x1 - 0.2, z0: RV.z0 + 0.2, z1: RV.z1 - 0.2, y0: F1, y1: C1 };
export const WINDOW = { x: RV.x1, z0: -1.6, z1: 2.6, y0: 3.6, y1: 5.9 };
export const DESK = { x0: 9.74, x1: 10.52, z0: -0.52, z1: 1.52, top: F1 + 0.74 };
// the big display: its glass faces -x; x is the front of the glass, w along z, h along y (16:10)
export const DISPLAY = { x: 10.2, y: F1 + 1.2, z: 0.46, w: 0.8, h: 0.5 };
export const SEAT = { x: 9.2, z: 0.48, y: F1 + 0.47 };

// the sessions, one tab each: featured projects first, then the smaller ones (data order within each)
export const sessionOrder = projects => [...projects.filter(p => p.featured), ...projects.filter(p => !p.featured)];
