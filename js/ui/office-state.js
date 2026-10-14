// State shared by the office's world module and its box (owner: office). Both import this one
// module, so the 3D monitor shows the session the HTML is on, and the HTML knows how far the camera
// has come into the screen.
export const office = {
  tab: 0,          // the session (tab index) the HTML shows, or will show when the camera arrives
  idle: true,      // true while the visitor is at the office stop and not in the sessions (the monitor cycles)
  camera: null,    // the world camera (set by the box once the world exists)
  // called by the world every frame the office is drawn: ({ t, rect, camera }) where t (0..1) is how
  // far the camera has come from the desk view to the screen and rect the display's projected box
  onFrame: null,
  covered: false,  // the HTML sessions app is fully open over the picture (the 3D display cannot be seen)
};
