// LS-2: every tap, snap and step gets a sound and a small buzz.
// Sounds are synthesised with Web Audio, so the prototype ships no audio files.

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem('loopbot.muted') === '1';
  } catch {
    return false;
  }
})();

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('loopbot.muted', m ? '1' : '0');
  } catch {
    /* ignore */
  }
}

let hapticsOff = (() => {
  try {
    return localStorage.getItem('loopbot.haptics') === '0';
  } catch {
    return false;
  }
})();

export function hapticsOn() {
  return !hapticsOff;
}

export function setHapticsOn(on: boolean) {
  hapticsOff = !on;
  try {
    localStorage.setItem('loopbot.haptics', on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

// Starting the audio device can fail, most often on iOS: right after the app comes back from the
// background, during a phone call or Siri, or when another app holds the speaker. resume() then
// rejects with "Failed to start the audio device". The game must keep working silently, so every
// resume() is caught, and we try again on the player's next tap or when the app is shown again.
// After a few failures in a row the context is thrown away and a fresh one is made, because a
// WebKit context can get stuck after an interruption.
const MAX_FAILS = 3;
let resuming = false;
let fails = 0;
let resetListeners: Array<() => void> = [];
let retryHooked = false;

/** Calls `fn` when the shared AudioContext is replaced, so callers can drop nodes made on the old one. */
export function onAudioReset(fn: () => void) {
  resetListeners.push(fn);
}

function hidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

function makeContext(): AudioContext | null {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    return new AC();
  } catch {
    return null;
  }
}

function replaceContext() {
  const old = ctx;
  ctx = null;
  fails = 0;
  if (old) old.close().catch(() => {});
  for (const fn of resetListeners) {
    try {
      fn();
    } catch {
      /* a listener failing must not stop the others */
    }
  }
}

/** Asks the audio device to start, never throwing. Safe to call often: only one try runs at a time. */
export function wakeAudio() {
  const a = ctx;
  if (!a || resuming || hidden()) return;
  if (a.state === 'running') return;
  if (a.state === 'closed') {
    replaceContext();
    return;
  }
  resuming = true;
  let p: Promise<void>;
  try {
    p = a.resume();
  } catch (e) {
    p = Promise.reject(e);
  }
  p.then(
    () => {
      fails = 0;
    },
    () => {
      if (ctx !== a) return;
      fails++;
      if (fails >= MAX_FAILS) replaceContext();
    },
  ).finally(() => {
    resuming = false;
  });
}

/** Pauses the audio device (app in the background), never throwing. */
export function sleepAudio() {
  const a = ctx;
  if (!a || a.state !== 'running') return;
  try {
    a.suspend().catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Retries a failed start on the next tap or key, and when the app is shown again. */
function hookRetries() {
  if (retryHooked || typeof document === 'undefined') return;
  retryHooked = true;
  const retry = () => {
    if (!ctx) sharedAudio();
    else wakeAudio();
  };
  document.addEventListener('pointerdown', retry, true);
  document.addEventListener('keydown', retry, true);
}

/** The one AudioContext the game uses, shared by sound effects and music (src/audio/music.ts). */
export function sharedAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  hookRetries();
  if (!ctx) {
    ctx = makeContext();
    if (!ctx) return null;
  }
  if (ctx.state !== 'running') wakeAudio();
  return ctx;
}

function audio(): AudioContext | null {
  if (muted) return null;
  return sharedAudio();
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; slideTo?: number; delay?: number } = {}) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + (opts.delay ?? 0);
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = opts.type ?? 'triangle';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
  const peak = opts.gain ?? 0.15;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

type Buzz = 'light' | 'medium' | 'heavy' | 'success' | 'error';

function buzz(kind: Buzz, delayMs = 0) {
  if (hapticsOff) return;
  if (delayMs > 0) {
    // Haptics have no schedule of their own: wait, so the buzz lands with the sound and the picture.
    setTimeout(() => buzz(kind), delayMs);
    return;
  }
  if (Capacitor.isNativePlatform()) {
    if (kind === 'success') void Haptics.notification({ type: NotificationType.Success });
    else if (kind === 'error') void Haptics.notification({ type: NotificationType.Error });
    else void Haptics.impact({ style: kind === 'light' ? ImpactStyle.Light : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Heavy });
    return;
  }
  const ms = { light: 8, medium: 15, heavy: 25, success: [10, 40, 20], error: [30, 30, 30] }[kind];
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}

/** Noise buffers by length: the noise is deterministic, so each one is made once and reused. */
const noiseBuffers = new Map<number, AudioBuffer>();

function noiseBuffer(a: AudioContext, len: number): AudioBuffer {
  let buf = noiseBuffers.get(len);
  if (buf) return buf;
  buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  // Deterministic pseudo-noise, so the crackle sounds the same every time.
  let seed = 12345;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  noiseBuffers.set(len, buf);
  return buf;
}

function noise(dur: number, gain: number, freq: number, delay = 0) {
  const a = audio();
  if (!a) return;
  const buf = noiseBuffer(a, Math.floor(a.sampleRate * dur));
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 1.2;
  const g = a.createGain();
  const t0 = a.currentTime + delay;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(a.destination);
  src.start(t0);
}

export const fx = {
  /** A short radio crackle when PATCH or VANTA speaks. */
  radio() {
    noise(0.18, 0.08, 1800);
    tone(1200, 0.05, { type: 'square', gain: 0.025, delay: 0.16 });
  },
  /** One soft blip per revealed character of a story line. */
  type() {
    tone(1400 + Math.random() * 200, 0.02, { type: 'square', gain: 0.012 });
  },
  /** Tapping a palette command or a line. */
  tap() {
    tone(880, 0.05, { type: 'square', gain: 0.05 });
    buzz('light');
  },
  /** A block snapping into the program. */
  snap() {
    tone(520, 0.06, { gain: 0.12 });
    tone(1040, 0.08, { gain: 0.08, delay: 0.03 });
    buzz('light');
  },
  /** A drag starting. */
  lift() {
    tone(330, 0.08, { slideTo: 500, gain: 0.08 });
    buzz('medium');
  },
  remove() {
    tone(600, 0.12, { type: 'sawtooth', slideTo: 150, gain: 0.06 });
    buzz('medium');
  },
  undo() {
    tone(700, 0.06, { slideTo: 440, gain: 0.08 });
    buzz('light');
  },
  denied() {
    tone(160, 0.1, { type: 'square', gain: 0.05 });
    buzz('light');
  },
  /**
   * One step of a run. `landMs` is when LoopBot touches down after a move (src/fx/feel.ts): a walk
   * gets a soft footfall there and a jump a thump and a light buzz, so the sound follows the board.
   */
  step(action: string, landMs = 0) {
    const f = { forward: 440, jump: 620, turn_left: 360, turn_right: 380, pick_up: 520, drop: 300, activate: 700, wait: 330, tally_up: 880, tally_down: 660 }[action] ?? 440;
    tone(f, 0.07, { type: 'triangle', gain: 0.08 });
    if (landMs <= 0) return;
    const at = landMs / 1000;
    if (action === 'jump') {
      tone(150, 0.09, { type: 'sine', gain: 0.12, slideTo: 90, delay: at });
      buzz('light', landMs);
    } else if (action === 'forward') {
      tone(240, 0.035, { type: 'sine', gain: 0.045, delay: at });
    }
  },
  /** Run pressed: a quick power-up sweep and a firm buzz, right on the tap. */
  run() {
    tone(420, 0.09, { type: 'triangle', slideTo: 840, gain: 0.07 });
    buzz('medium');
  },
  /** A bump or an error. `delayMs` lines it up with LoopBot hitting the wall on the board. */
  crash(delayMs = 0) {
    const at = delayMs / 1000;
    noise(0.08, 0.09, 600, at);
    tone(180, 0.3, { type: 'sawtooth', slideTo: 60, gain: 0.12, delay: at });
    buzz('error', delayMs);
  },
  /** A star landing on the results card; each one rings a step higher. */
  star(n: number) {
    const base = [659, 784, 1047][Math.min(2, Math.max(0, n - 1))];
    tone(base, 0.16, { gain: 0.11 });
    tone(base * 2, 0.22, { type: 'sine', gain: 0.04, delay: 0.04 });
    buzz(n === 3 ? 'medium' : 'light');
  },
  /** An empty star slot: a soft, low tick. */
  starMiss() {
    tone(220, 0.07, { type: 'sine', gain: 0.05 });
  },
  /** The 3-star moment: a bright fanfare with a pop of noise for the confetti. */
  cheer() {
    noise(0.12, 0.06, 3000);
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, { gain: 0.09, delay: 0.05 + i * 0.07 }));
    tone(392, 0.7, { type: 'sine', gain: 0.06, delay: 0.05 });
    buzz('success');
  },
  /** The elevator arriving at a floor. */
  ding() {
    tone(1319, 0.5, { type: 'sine', gain: 0.07 });
    tone(1047, 0.7, { type: 'sine', gain: 0.06, delay: 0.18 });
  },
  /** A floor unlocking on the tower map. */
  unlock() {
    tone(500, 0.06, { type: 'square', gain: 0.04 });
    tone(760, 0.12, { gain: 0.09, delay: 0.07 });
    tone(1140, 0.18, { gain: 0.06, delay: 0.14 });
    buzz('medium');
  },
  /**
   * LoopBot's voice: short synthesised chirps, so it reacts like a character.
   * ready: two rising blips as a run starts. uhoh: a falling two-note "uh-oh".
   * yay: a quick happy trill. poke: a random little "bip-boop" when you tap LoopBot.
   */
  voice(kind: 'ready' | 'uhoh' | 'yay' | 'poke', delay = 0) {
    const v = (f: number, d: number, at: number, slideTo?: number) => tone(f, d, { type: 'sine', gain: 0.07, delay: delay + at, slideTo });
    if (kind === 'ready') {
      v(900, 0.05, 0);
      v(1350, 0.07, 0.07, 1500);
    } else if (kind === 'uhoh') {
      v(700, 0.11, 0, 760);
      v(520, 0.2, 0.15, 330);
    } else if (kind === 'yay') {
      [1050, 1320, 1180, 1570].forEach((f, i) => v(f, 0.06, i * 0.055));
    } else {
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        const f = 800 + Math.random() * 900;
        v(f, 0.06, i * 0.08, f * (Math.random() < 0.5 ? 1.25 : 0.8));
      }
    }
  },
  /** The floor is cleared. `delayMs` waits for LoopBot to land on the lift. */
  win(delayMs = 0) {
    const at = delayMs / 1000;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { gain: 0.1, delay: at + i * 0.09 }));
    // a low "lift" chord under the arpeggio
    tone(262, 0.6, { type: 'sine', gain: 0.06, delay: at + 0.3 });
    tone(392, 0.6, { type: 'sine', gain: 0.04, delay: at + 0.3 });
    buzz('success', delayMs);
  },
};
