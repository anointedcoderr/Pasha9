// Built by Anointed Coder.
//
// Tiny Web Audio tone generator so short UI cues (for example the WinGo
// final-seconds countdown beep) need no asset file at all. A single
// shared AudioContext is created lazily and resumed on a real user
// gesture, which keeps every browser autoplay policy happy. Every call
// is best effort: if audio is unavailable or still suspended it stays
// silent and never throws.

let ctx: AudioContext | null = null;

type MaybeWindow = typeof window & { webkitAudioContext?: typeof AudioContext };

// Lazily create (and resume) the shared AudioContext. Safe to call from a
// user gesture handler to prime playback, or right before a tone to make
// sure the context is running.
export function getToneContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const w = window as MaybeWindow;
    const AC = w.AudioContext || w.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export interface ToneOptions {
  freq?: number;
  durationMs?: number;
  volume?: number;
  type?: OscillatorType;
}

// Play a single short tone. Uses a soft attack and exponential release so
// the beep reads as a chime, not a click.
export function playTone(opts?: ToneOptions): void {
  const ac = getToneContext();
  if (!ac || ac.state !== 'running') return;
  try {
    const now = ac.currentTime;
    const dur = Math.max(0.02, (opts?.durationMs ?? 120) / 1000);
    const freq = opts?.freq ?? 880;
    const volume = Math.max(0, Math.min(1, opts?.volume ?? 0.25));
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = opts?.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  } catch {
    /* audio unavailable */
  }
}
