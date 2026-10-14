// Shared UI for every room's info box (owner: integrator): escaping, icons, the track row with its
// waveform seek slider, and bindTracks, which keeps every row in step with the single player.
// Each room's box lives in ui/<room>-box.js and builds its track list from trackRow.
import { fmt } from '../player.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const I = {
  play: '<svg class="i-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9.5-5.5z" fill="currentColor"/></svg>',
  pause: '<svg class="i-pause" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" fill="currentColor"/></svg>',
  soundOff: '<svg class="off" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9.5c1 .7 1.5 1.6 1.5 2.5s-.5 1.8-1.5 2.5M18.5 7c1.8 1.3 2.8 3 2.8 5s-1 3.7-2.8 5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  soundOn: '<svg class="on" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9.5c1 .7 1.5 1.6 1.5 2.5s-.5 1.8-1.5 2.5M18.5 7c1.8 1.3 2.8 3 2.8 5s-1 3.7-2.8 5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
};

function wave(peaks) {
  const n = 64, w = 256, h = 26, bw = w / n;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = peaks.slice(Math.floor(i * peaks.length / n), Math.floor((i + 1) * peaks.length / n));
    const v = Math.max(0.06, a.length ? Math.max(...a) : 0);
    const bh = v * (h - 2);
    d += `M${(i * bw + 0.6).toFixed(1)} ${((h - bh) / 2).toFixed(1)}h${(bw - 1.6).toFixed(1)}v${bh.toFixed(1)}h-${(bw - 1.6).toFixed(1)}z`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path class="base" d="${d}"/><path class="done" d="${d}"/></svg>`;
}

// one playable track: named play/pause button, title, optional meta (HTML) and cover, waveform seek slider
export function trackRow(t, meta = '') {
  // data-src: the picture is fetched when the camera approaches its room (app.js), not at page load
  const art = t.artwork ? `<img class="track__art" data-src="shared/${esc(t.artwork)}" alt="${esc(t.artworkAlt || `Cover art for ${t.title}`)}" width="52" height="52" loading="lazy">` : '';
  return `<li class="track${art ? ' has-art' : ''}" data-id="${esc(t.id)}">
    <button class="track__play" type="button" aria-label="Play ${esc(t.title)}">${I.play}${I.pause}</button>
    <div class="track__body">
      <div class="track__line">
        <span class="track__title">${esc(t.title)}${t.subtitle ? `<span class="track__sub">, ${esc(t.subtitle)}</span>` : ''}</span>
        <span class="track__eq" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="track__badge" data-badge></span>
      </div>
      ${meta || art ? `<div class="track__info">${art}${meta ? `<p class="track__meta">${meta}</p>` : ''}</div>` : ''}
      <div class="track__scrub">
        <div class="wave">${wave(t.peaks || [])}
          <input type="range" min="0" max="${t.duration}" step="1" value="0" aria-label="Seek ${esc(t.title)}" aria-valuetext="0:00 of ${fmt(t.duration)}">
        </div>
        <span class="track__time"><span data-cur>0:00</span> / ${fmt(t.duration)}</span>
      </div>
    </div>
  </li>`;
}

// keep every track row in step with the single player
export function bindTracks(player) {
  const rows = [...document.querySelectorAll('.track')];
  const byId = new Map(rows.map(r => [r.dataset.id, r]));
  for (const row of rows) {
    const id = row.dataset.id, t = player.tracks.get(id);
    row.querySelector('.track__play').addEventListener('click', () => player.toggle(id));
    const input = row.querySelector('input');
    input.addEventListener('input', () => { row.dragging = true; player.seek(id, +input.value); paint(row, t, +input.value); });
    input.addEventListener('change', () => { row.dragging = false; });
    // arrows step a second (the slider's step); Page Up / Page Down jump ten
    input.addEventListener('keydown', e => {
      if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
      e.preventDefault();
      const s = Math.max(0, Math.min(t.duration, Math.round(+input.value) + (e.key === 'PageUp' ? 10 : -10)));
      input.value = s;
      player.seek(id, s);
      paint(row, t, s);
    });
  }
  function paint(row, t, s) {
    const input = row.querySelector('input');
    if (!row.dragging) input.value = Math.floor(s);
    input.setAttribute('aria-valuetext', `${fmt(s)} of ${fmt(t.duration)}`);
    row.querySelector('[data-cur]').textContent = fmt(s);
    row.querySelector('.wave').style.setProperty('--p', `${(s / t.duration) * 100}%`);
  }
  let last = null;
  function sync() {
    const cur = player.current;
    for (const [id, row] of byId) {
      const isCur = cur?.id === id, playing = isCur && player.playing;
      row.classList.toggle('is-current', isCur);
      row.classList.toggle('is-playing', playing);
      const t = player.tracks.get(id);
      row.querySelector('.track__play').setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${t.title}`);
      const badge = playing ? 'Playing' : !isCur ? '' : player.error === cur ? 'Could not load. Try again' : player.audio.ended ? 'Finished' : player.time() > 0 ? 'Paused' : '';
      const b = row.querySelector('[data-badge]');
      if (b.textContent !== badge) b.textContent = badge;
      // a row that stops being the current track goes back to its start (or the point scrubbed on it)
      if (!isCur && last === id) paint(row, t, player.at(id));
    }
    last = cur?.id ?? null;
  }
  function tick() {
    const cur = player.current;
    if (cur) paint(byId.get(cur.id), cur, player.time());
  }
  player.addEventListener('change', () => { sync(); tick(); });
  player.addEventListener('time', tick);
  sync();
  return { tick };
}
