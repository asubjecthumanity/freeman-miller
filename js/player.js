// One audio element for the whole house: one track at a time, never starts on its own.
// Visuals read loudness from each track's `peaks` and note timing from `notes` (no AnalyserNode).
export const fmt = s => { s = Math.max(0, s || 0); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };

export class Player extends EventTarget {
  constructor(tracks, base) {
    super();
    this.tracks = new Map(tracks.map(t => [t.id, t]));
    this.base = base;
    this.audio = new Audio();
    this.audio.preload = 'none';
    this.current = null;
    this.error = null;
    // start points scrubbed on rows that are not the current track: a seek there never stops or loads
    // anything; that row's Play starts from it
    this.starts = new Map();
    // a seek on the current track before its metadata has arrived: { t, s }, applied when it does,
    // and only if that track is still the current one
    this.pending = null;
    const emit = () => this.dispatchEvent(new Event('change'));
    for (const ev of ['play', 'pause', 'ended', 'seeked']) this.audio.addEventListener(ev, emit);
    this.audio.addEventListener('loadedmetadata', () => {
      const p = this.pending;
      this.pending = null;
      if (p && p.t === this.current) this.setTime(p.s);
      emit();
    });
    this.audio.addEventListener('error', () => this.fail(this.current));
    this.audio.addEventListener('timeupdate', () => this.dispatchEvent(new Event('time')));
  }
  // a failed track is not playing (the element keeps paused false after a load error)
  get playing() { return !!this.current && !this.audio.paused && !this.audio.ended && this.error !== this.current; }
  time(id) { return this.current && (!id || this.current.id === id) ? this.audio.currentTime : 0; }
  // where a row stands: the current track's time, or the start point scrubbed on another row
  at(id) { return this.current?.id === id ? this.audio.currentTime : this.starts.get(id) || 0; }
  load(id) {
    const t = this.tracks.get(id);
    if (!t) return null;
    // a new track, or another try at one that could not load
    if (this.current !== t || this.error === t) {
      this.current = t; this.error = null; this.pending = null;
      this.audio.src = this.base + t.audio;
      this.dispatchEvent(new Event('change'));
    }
    return t;
  }
  async play(id, from) {
    const t = this.load(id);
    if (!t) return;
    const s = from ?? this.starts.get(id);
    this.starts.delete(id);
    if (s != null) this.setTime(s);
    try { await this.audio.play(); } catch (e) {
      if (e.name === 'NotSupportedError') this.fail(t);
      else if (e.name !== 'AbortError') this.dispatchEvent(new Event('change'));
    }
  }
  pause() { this.audio.pause(); }
  toggle(id) { if (this.current?.id === id && this.playing) this.pause(); else this.play(id); }
  // the current track jumps there; any other row only keeps it as its start point
  seek(id, s) {
    const t = this.tracks.get(id);
    if (!t) return;
    if (this.current === t && this.error !== t) this.setTime(s);
    else this.starts.set(id, Math.max(0, Math.min(s, t.duration)));
    this.dispatchEvent(new Event('time'));
  }
  // move the current track to s seconds (before its metadata: as soon as it arrives)
  setTime(s) {
    const t = this.current;
    if (!t) return;
    s = Math.max(0, Math.min(s, (this.audio.duration || t.duration) - 0.05));
    this.pending = this.audio.readyState >= 1 ? null : { t, s };
    try { this.audio.currentTime = s; } catch { /* not seekable yet: the pending seek applies it */ }
  }
  // a track that could not load (missing, offline, blocked): stop it and say so on its row
  fail(t) {
    if (!t || t !== this.current) return;
    this.error = t; this.pending = null;
    if (!this.audio.paused) this.audio.pause();
    this.dispatchEvent(new Event('change'));
  }
}

// loudness 0..1 at time s from 160 peaks (linear interpolation)
export function levelAt(track, s) {
  const p = track?.peaks;
  if (!p?.length) return 0;
  const x = Math.max(0, Math.min(p.length - 1, (s / track.duration) * p.length));
  const i = Math.floor(x), f = x - i;
  return p[i] * (1 - f) + (p[Math.min(p.length - 1, i + 1)] ?? 0) * f;
}

// tracks note onsets between frames to drive speaker "kicks"
export class Onsets {
  constructor() { this.prev = -1; this.env = 0; this.track = null; }
  step(track, s, dt) {
    let kick = false;
    if (track !== this.track) { this.track = track; this.prev = s; }
    if (track && s > this.prev && s - this.prev < 0.5) {
      if (track.notes) { for (const n of track.notes) if (n.t > this.prev && n.t <= s) { kick = true; break; } }
      else if (Math.floor(s * 2) !== Math.floor(this.prev * 2)) kick = true; // a steady pulse when there are no notes
    }
    this.prev = s;
    this.env = kick ? 1 : this.env * Math.exp(-dt * 7);
    return kick;
  }
}
