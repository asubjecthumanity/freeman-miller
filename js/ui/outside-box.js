// Outside (owner: exterior): the greeting in the sky. The header markup (h1, intro, hint, "Go inside")
// is in index.html; this fills its text from window.PORTFOLIO. Box module contract: see OWNERSHIP.md.
import room from '../rooms/outside.js';

export const stop = room.stop;

export function render(P) {
  document.getElementById('intro').textContent = P.person.intro;
  document.getElementById('hello-title').textContent = `Hi, I'm ${P.person.name.split(' ')[0]}.`;
}
