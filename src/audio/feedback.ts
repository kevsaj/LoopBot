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

/** The one AudioContext the game uses, shared by sound effects and music (src/audio/music.ts). */
export function sharedAudio(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
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

function buzz(kind: Buzz) {
  if (hapticsOff) return;
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

function noise(dur: number, gain: number, freq: number) {
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
  const t0 = a.currentTime;
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
  step(action: string) {
    const f = { forward: 440, jump: 620, turn_left: 360, turn_right: 380, pick_up: 520, drop: 300, activate: 700 }[action] ?? 440;
    tone(f, 0.07, { type: 'triangle', gain: 0.08 });
  },
  crash() {
    tone(180, 0.3, { type: 'sawtooth', slideTo: 60, gain: 0.12 });
    buzz('error');
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
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { gain: 0.1, delay: i * 0.09 }));
    // a low "lift" chord under the arpeggio
    tone(262, 0.6, { type: 'sine', gain: 0.06, delay: 0.3 });
    tone(392, 0.6, { type: 'sine', gain: 0.04, delay: 0.3 });
    buzz('success');
  },
};
