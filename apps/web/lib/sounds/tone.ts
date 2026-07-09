// Built by Anointed Coder.
//
// Tiny Web Audio tone generator so short UI cues (for example the WinGo
// final-seconds countdown beep) need no asset file at all. A single
// shared AudioContext is created lazily and resumed on a real user
// gesture, which keeps every browser autoplay policy happy. Every call
// is best effort: if audio is unavailable or still suspended it stays
// silent and never throws.

let ctx: AudioContext | null = null;
let unlocked = false;

type MaybeWindow = typeof window & { webkitAudioContext?: typeof AudioContext };

// One-time iOS Safari unlock. Safari only truly frees Web Audio after a
// buffer source has been started from inside a real user gesture, so on
// the priming gesture we play a single silent sample. Best effort: it
// never throws and runs at most once.
//
// Note: this cannot beat the iPhone hardware ring/silent switch. When
// that switch is set to silent the OS mutes Web Audio entirely, and no
// amount of JavaScript can override it. That is expected OS behaviour.
function unlockAudio(ac: AudioContext): void {
  if (unlocked) return;
  unlocked = true;
  try {
    const buffer = ac.createBuffer(1, 1, 22050);
    const source = ac.createBufferSource();
    source.buffer = buffer;
    source.connect(ac.destination);
    source.start(0);
  } catch {
    /* best effort */
  }
}

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
    // Best-effort iOS unlock on the priming gesture (no-op after first).
    unlockAudio(ctx);
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

// Re-arm the tone context after interruptions. iOS suspends the shared
// AudioContext whenever the tab is backgrounded, the Control Center opens,
// or a call comes in, and it will not resume on its own. This installs
// PERSISTENT (not once) listeners so that the next visibility-restore or
// user gesture after any such interruption resumes + re-unlocks the
// context, instead of leaving every later beep silently dropped. Idempotent
// and best effort: it never throws and installs its listeners at most once.
let armed = false;
export function armToneUnlock(): void {
  if (typeof window === 'undefined' || armed) return;
  armed = true;
  try {
    const resumeIfNeeded = () => {
      // Only reach for the context when it exists and is not running, so a
      // healthy running context is never disturbed.
      if (ctx && ctx.state !== 'running') getToneContext();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') resumeIfNeeded();
    };
    document.addEventListener('visibilitychange', onVisible);
    // Persistent (not once): every gesture is a fresh chance to resume a
    // context that iOS suspended while we were away.
    window.addEventListener('pointerdown', resumeIfNeeded);
    window.addEventListener('keydown', resumeIfNeeded);
  } catch {
    /* best effort */
  }
}

// Play a single short tone. Uses a soft attack and exponential release so
// the beep reads as a chime, not a click.
export function playTone(opts?: ToneOptions): void {
  const ac = getToneContext();
  if (!ac) return;
  // If the context is suspended (for example iOS just returned from the
  // background), kick a resume and STILL schedule the oscillator. Web Audio
  // permits scheduling on a suspended context; the note fires the instant
  // the context resumes, so we do not silently drop the first post-resume
  // beep. getToneContext already called resume() above; this is belt and
  // braces and best effort.
  if (ac.state !== 'running') {
    try { void ac.resume(); } catch { /* best effort */ }
  }
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
