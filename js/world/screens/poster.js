// The Paranoia one-sheet on the theater's slatted wall (owner: theater): striped light, a red glow from
// below, the title and the credits, and the score itself as the picture: Cue 1's loudness (its peaks)
// drawn as a band of light over rings, the same language as the TV. There are no stills from the film
// yet, so nothing here stands for a scene or a character.
import { FONT, tex, makeCanvas } from './shared.js';

export function posterTexture(film, person) {
  const W = 320, H = 480;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0e1520'); bg.addColorStop(0.7, '#0a0d14'); bg.addColorStop(1, '#170807');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // striped light across the upper half
  g.save(); g.translate(170, 70); g.rotate(-0.42);
  for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(214,206,178,${(0.2 - i * 0.017).toFixed(3)})`; g.fillRect(-60, i * 30, 320, 14); }
  g.restore();
  // the red glow from below
  const cx = W / 2, cy = H * 0.66;
  const rg = g.createRadialGradient(cx, cy, 6, cx, cy, 260);
  rg.addColorStop(0, 'rgba(255,60,40,.5)'); rg.addColorStop(1, 'rgba(255,40,30,0)');
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
  // rings opening out from the middle of the band
  for (let i = 1; i <= 5; i++) {
    g.strokeStyle = `rgba(255,96,76,${(0.5 - i * 0.08).toFixed(3)})`; g.lineWidth = 1.4;
    g.beginPath(); g.arc(cx, cy, 16 + i * 26, 0, 7); g.stroke();
  }
  // Cue 1's peaks, mirrored, as a band of light across the sheet
  const p = film.cues?.[0]?.peaks || [];
  if (p.length) {
    const x0 = 22, x1 = W - 22, bw = (x1 - x0) / p.length, amp = 64;
    for (let i = 0; i < p.length; i++) {
      const h = Math.max(1, p[i] * amp), x = x0 + i * bw;
      g.fillStyle = `rgba(246,${Math.round(150 + 60 * p[i])},${Math.round(90 + 60 * p[i])},${(0.45 + 0.5 * p[i]).toFixed(3)})`;
      g.fillRect(x, cy - h, Math.max(1, bw * 0.62), h * 2);
    }
  }
  // title and credits
  g.textAlign = 'center';
  g.fillStyle = '#f2ece2'; g.font = `italic 500 64px ${FONT}`;
  g.fillText(film.film, W / 2, 86);
  g.font = `400 16px ${FONT}`; g.fillStyle = 'rgba(242,236,226,.82)';
  g.fillText(`A film by ${film.director}`, W / 2, 116);
  g.font = `400 13px ${FONT}`; g.fillStyle = 'rgba(242,236,226,.7)';
  g.fillText(`${film.role} by ${person?.name ?? ''}`.trim(), W / 2, H - 22);
  return tex(c);
}
