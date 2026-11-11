// LoopBot's music: original, made entirely in code. No audio files, no licences.
//
// Each part of the game has a theme (title, each band of the Meridian Spire, the daily challenge).
// A theme is a small recipe: tempo, key and mode, a chord progression, and 16-step patterns for
// bass, arpeggio and drums. The lead melody is composed from the theme's seed when the theme
// starts, so it is the same every time you hear it, and it varies on later passes so a long
// floor doesn't feel like a short loop.
//
// Sound comes from Web Audio oscillators and filtered noise, scheduled a quarter second ahead
// (the "lookahead" pattern) so timing stays steady even when the board is busy. Everything runs
// through one music bus with a soft generated reverb, separate from the sound effects, and the
// Music switch in Settings fades it in and out.

import { sharedAudio } from './feedback';

export type Theme =
  | 'title' | 'lobby' | 'maintenance' | 'workshop' | 'control' | 'rooftop' | 'daily'
  | 'frostgate' | 'glacier' | 'signal' | 'aurora' | 'summit';

interface Recipe {
  bpm: number;
  /** MIDI note of the key's root, in the bass octave. */
  root: number;
  /** Semitones of the mode, from the root. */
  mode: number[];
  /** Scale degree (0-based) of each bar's chord. */
  chords: number[];
  /** Add the 7th to pad chords. */
  sevenths: boolean;
  pad: { wave: OscillatorType; cutoff: number; gain: number };
  /** 16 steps per bar: x = root, o = fifth, h = octave, . = rest. */
  bass: string;
  bassWave: OscillatorType;
  /** 16 steps: a digit picks a chord tone (0 root, 1 third, 2 fifth, 3 next root, 4 next third), . = rest. */
  arp: string;
  arpWave: OscillatorType;
  lead: { wave: OscillatorType; density: number; gain: number };
  kick: string;
  snare: string;
  hat: string;
  seed: number;
}

const IONIAN = [0, 2, 4, 5, 7, 9, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];

const RECIPES: Record<Theme, Recipe> = {
  // Night sky over the city: slow, open, no drums.
  title: {
    bpm: 80, root: 36, mode: IONIAN, chords: [0, 5, 3, 4], sevenths: true,
    pad: { wave: 'triangle', cutoff: 1400, gain: 0.05 },
    bass: 'x.......o.......', bassWave: 'sine',
    arp: '0...2...3...2...', arpWave: 'sine',
    lead: { wave: 'sine', density: 0.35, gain: 0.05 },
    kick: '................', snare: '................', hat: '................',
    seed: 11,
  },
  // Floors 1-10: a bright, curious lobby.
  lobby: {
    bpm: 92, root: 41, mode: IONIAN, chords: [0, 2, 3, 4], sevenths: true,
    pad: { wave: 'triangle', cutoff: 1600, gain: 0.04 },
    bass: 'x.....x...o.....', bassWave: 'triangle',
    arp: '0.2.3.2.1.2.3.4.', arpWave: 'triangle',
    lead: { wave: 'sine', density: 0.4, gain: 0.05 },
    kick: 'x.......x.......', snare: '................', hat: '..x...x...x...x.',
    seed: 23,
  },
  // Floors 11-20: pipes and machines, a looping groove (it's the repeat band).
  maintenance: {
    bpm: 100, root: 38, mode: DORIAN, chords: [0, 3, 0, 6], sevenths: false,
    pad: { wave: 'sawtooth', cutoff: 900, gain: 0.025 },
    bass: 'x..x..x...x.o...', bassWave: 'square',
    arp: '0.2.0.2.0.3.0.2.', arpWave: 'square',
    lead: { wave: 'triangle', density: 0.3, gain: 0.04 },
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    seed: 37,
  },
  // Floors 21-30: a busy workshop, plucky and bouncy.
  workshop: {
    bpm: 108, root: 43, mode: MIXOLYDIAN, chords: [0, 6, 3, 0], sevenths: false,
    pad: { wave: 'triangle', cutoff: 1200, gain: 0.03 },
    bass: 'x...o...x.x.o...', bassWave: 'triangle',
    arp: '02320232.2320234', arpWave: 'sine',
    lead: { wave: 'square', density: 0.35, gain: 0.025 },
    kick: 'x.....x.x.......', snare: '....x.......x...', hat: '..x...x...x..xx.',
    seed: 41,
  },
  // Floors 31-40: the control room, minor and tense, a pulsing bass.
  control: {
    bpm: 96, root: 45, mode: AEOLIAN, chords: [0, 5, 2, 6], sevenths: true,
    pad: { wave: 'sawtooth', cutoff: 800, gain: 0.03 },
    bass: 'x.x.x.x.x.x.x.x.', bassWave: 'sawtooth',
    arp: '0..2..3..2..1...', arpWave: 'triangle',
    lead: { wave: 'triangle', density: 0.3, gain: 0.045 },
    kick: 'x.......x.......', snare: '........x.......', hat: '....x.......x...',
    seed: 53,
  },
  // Floors 41-50: the rooftop, wind and city lights, the biggest theme.
  rooftop: {
    bpm: 116, root: 39, mode: LYDIAN, chords: [0, 4, 5, 3], sevenths: true,
    pad: { wave: 'sawtooth', cutoff: 1500, gain: 0.03 },
    bass: 'x..x..x.x..x..o.', bassWave: 'triangle',
    arp: '0123432101234321', arpWave: 'triangle',
    lead: { wave: 'square', density: 0.45, gain: 0.025 },
    kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx',
    seed: 67,
  },
  // Tower 2, Frostline. Floors 1-10: the Frost Gate, glassy bells over a slow, sliding pulse.
  frostgate: {
    bpm: 88, root: 40, mode: LYDIAN, chords: [0, 1, 4, 0], sevenths: true,
    pad: { wave: 'sine', cutoff: 2200, gain: 0.045 },
    bass: 'x.......x...o...', bassWave: 'sine',
    arp: '3.4.2.3.1.2.0.2.', arpWave: 'sine',
    lead: { wave: 'sine', density: 0.35, gain: 0.05 },
    kick: 'x...........x...', snare: '................', hat: '....x.......x...',
    seed: 83,
  },
  // Floors 11-20: the Glacier, cracking ice, careful and a little uneasy.
  glacier: {
    bpm: 94, root: 37, mode: DORIAN, chords: [0, 6, 3, 4], sevenths: true,
    pad: { wave: 'triangle', cutoff: 1300, gain: 0.04 },
    bass: 'x..o..x...x..o..', bassWave: 'triangle',
    arp: '0..2..4..3..2...', arpWave: 'sine',
    lead: { wave: 'triangle', density: 0.3, gain: 0.045 },
    kick: 'x.......x..x....', snare: '........x.......', hat: '..x...x...x...x.',
    seed: 89,
  },
  // Floors 21-30: the Signal Hut, radio blips and a busy, bouncing groove.
  signal: {
    bpm: 106, root: 42, mode: MIXOLYDIAN, chords: [0, 4, 6, 3], sevenths: false,
    pad: { wave: 'triangle', cutoff: 1500, gain: 0.03 },
    bass: 'x.x...o.x.x...o.', bassWave: 'square',
    arp: '0202320202324232', arpWave: 'square',
    lead: { wave: 'sine', density: 0.4, gain: 0.04 },
    kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    seed: 97,
  },
  // Floors 31-40: the Aurora Lab, wide shimmering chords in a minor key.
  aurora: {
    bpm: 90, root: 44, mode: AEOLIAN, chords: [0, 5, 3, 6], sevenths: true,
    pad: { wave: 'sawtooth', cutoff: 1100, gain: 0.03 },
    bass: 'x.......x.o.....', bassWave: 'sawtooth',
    arp: '0.1.2.3.4.3.2.1.', arpWave: 'triangle',
    lead: { wave: 'triangle', density: 0.35, gain: 0.045 },
    kick: 'x.......x.......', snare: '........x.......', hat: '..x.x...x...x.x.',
    seed: 101,
  },
  // Floors 41-50: the Summit, wind and the beacon, the biggest theme of the tower.
  summit: {
    bpm: 120, root: 38, mode: IONIAN, chords: [0, 4, 5, 3], sevenths: true,
    pad: { wave: 'sawtooth', cutoff: 1700, gain: 0.03 },
    bass: 'x..x..x.x..x..o.', bassWave: 'triangle',
    arp: '0123432101234321', arpWave: 'sine',
    lead: { wave: 'square', density: 0.45, gain: 0.025 },
    kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx',
    seed: 109,
  },
  // The daily challenge: cheerful and a little different every bar.
  daily: {
    bpm: 104, root: 46, mode: IONIAN, chords: [0, 3, 5, 4], sevenths: false,
    pad: { wave: 'triangle', cutoff: 1500, gain: 0.035 },
    bass: 'x...x...o...x...', bassWave: 'triangle',
    arp: '0.2.4.2.0.2.4.2.', arpWave: 'sine',
    lead: { wave: 'triangle', density: 0.45, gain: 0.045 },
    kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.',
    seed: 79,
  },
};

/** Which theme plays on a tower floor, by its 1-based number. */
export function themeForFloor(n: number, tower = 1): Theme {
  if (tower === 2) return (['frostgate', 'glacier', 'signal', 'aurora', 'summit'] as const)[Math.min(4, Math.floor((n - 1) / 10))];
  if (n <= 10) return 'lobby';
  if (n <= 20) return 'maintenance';
  if (n <= 30) return 'workshop';
  if (n <= 40) return 'control';
  return 'rooftop';
}

// --- composition (pure, so it can be tested) ---

/** Small seeded random numbers (mulberry32): the same seed always gives the same tune. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** MIDI note of scale degree `d` (any integer, wraps into octaves). */
export function degreeNote(r: Recipe, d: number) {
  const len = r.mode.length;
  const oct = Math.floor(d / len);
  return r.root + 12 * oct + r.mode[((d % len) + len) % len];
}

export interface Note {
  /** Step from the start of the phrase (16 per bar). */
  step: number;
  midi: number;
  /** Length in steps. */
  len: number;
}

/**
 * An 8-bar melody over the theme's chords. Strong beats land on chord tones, the line moves
 * mostly by step, and bar 8 comes home to the root. `pass` > 0 gives a variation of the same idea.
 */
export function composeLead(theme: Theme, pass: number): Note[] {
  const r = RECIPES[theme];
  const rand = rng(r.seed * 1000 + (pass % 4));
  const base = rng(r.seed * 1000); // shared by every pass, so variations keep the opening motif
  const len = r.mode.length;
  const notes: Note[] = [];
  let deg = 2 * len; // two octaves above the bass root
  for (let bar = 0; bar < 8; bar++) {
    const chord = r.chords[bar % r.chords.length];
    const tones = [chord, chord + 2, chord + 4].map((d) => d + 2 * len);
    const pick = bar < 2 ? base : rand;
    for (let s = 0; s < 16; s += 2) {
      const strong = s % 8 === 0;
      const last = bar === 7;
      if (last && s >= 8) break;
      if (!strong && pick() > r.lead.density) continue;
      if (strong) {
        // nearest chord tone to where the line is
        deg = tones.reduce((best, t) => (Math.abs(t - deg) < Math.abs(best - deg) ? t : best), tones[0]);
        if (pick() < 0.3) deg = tones[Math.floor(pick() * 3)];
      } else {
        deg += pick() < 0.5 ? -1 : 1;
        if (pick() < 0.15) deg += pick() < 0.5 ? -2 : 2;
      }
      deg = Math.max(len + 4, Math.min(3 * len + 2, deg));
      notes.push({ step: bar * 16 + s, midi: degreeNote(r, deg), len: 2 });
    }
    if (bar === 7) notes.push({ step: bar * 16 + 8, midi: degreeNote(r, chord + 2 * len), len: 8 });
  }
  // each note holds until the next one, up to a beat
  for (let i = 0; i < notes.length - 1; i++) notes[i].len = Math.max(1, Math.min(4, notes[i + 1].step - notes[i].step));
  return notes;
}

// --- playback ---

const MUSIC_KEY = 'loopbot.music';
const VOLUME = 0.9;
const LOOKAHEAD_S = 0.25;
const TICK_MS = 50;

let enabled = (() => {
  try {
    return localStorage.getItem(MUSIC_KEY) !== '0';
  } catch {
    return true;
  }
})();

export function musicOn() {
  return enabled;
}

interface Playing {
  theme: Theme;
  bus: GainNode;
  step: number;
  next: number;
  lead: Note[];
  pass: number;
}

let wanted: Theme = 'title';
let master: GainNode | null = null;
let playing: Playing | null = null;
let timer: number | undefined;
let unlocked = false;

const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function impulse(a: AudioContext, seconds: number) {
  const len = Math.floor(a.sampleRate * seconds);
  const buf = a.createBuffer(2, len, a.sampleRate);
  const rand = rng(99);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (rand() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

function setup(a: AudioContext) {
  if (master) return master;
  master = a.createGain();
  master.gain.value = 0;
  const verb = a.createConvolver();
  verb.buffer = impulse(a, 2.2);
  const wet = a.createGain();
  wet.gain.value = 0.35;
  master.connect(a.destination);
  master.connect(verb).connect(wet).connect(a.destination);
  return master;
}

function voice(a: AudioContext, out: AudioNode, t: number, midi: number, dur: number, wave: OscillatorType, gain: number, opts: { attack?: number; cutoff?: number; detune?: number } = {}) {
  const osc = a.createOscillator();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq(midi), t);
  if (opts.detune) osc.detune.setValueAtTime(opts.detune, t);
  const g = a.createGain();
  const attack = opts.attack ?? 0.01;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.02, dur));
  let node: AudioNode = osc;
  if (opts.cutoff) {
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = opts.cutoff;
    node.connect(f);
    node = f;
  }
  node.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

let noiseBuf: AudioBuffer | null = null;
function noiseHit(a: AudioContext, out: AudioNode, t: number, dur: number, gain: number, type: BiquadFilterType, f: number) {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    const rand = rng(7);
    for (let i = 0; i < d.length; i++) d[i] = rand() * 2 - 1;
  }
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const filter = a.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = f;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

function kick(a: AudioContext, out: AudioNode, t: number) {
  const osc = a.createOscillator();
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.16);
  const g = a.createGain();
  g.gain.setValueAtTime(0.22, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.22);
}

/** Plays one 16th-note step of the current theme at time `t`. */
function playStep(a: AudioContext, p: Playing, t: number) {
  const r = RECIPES[p.theme];
  const s = p.step % 16;
  const bar = Math.floor(p.step / 16);
  const chord = r.chords[bar % r.chords.length];
  const stepS = 60 / r.bpm / 4;
  const out = p.bus;
  const len = r.mode.length;

  if (s === 0) {
    const tones = [0, 2, 4, ...(r.sevenths ? [6] : [])].map((i) => degreeNote(r, chord + i + len));
    tones.forEach((m, i) =>
      voice(a, out, t, m, stepS * 16 + 0.3, r.pad.wave, r.pad.gain, { attack: 0.5, cutoff: r.pad.cutoff, detune: i % 2 ? 6 : -6 }),
    );
  }

  const b = r.bass[s];
  if (b !== '.') {
    const d = chord + (b === 'o' ? 4 : b === 'h' ? len : 0);
    voice(a, out, t, degreeNote(r, d), stepS * 1.8, r.bassWave, 0.09, { cutoff: 700 });
  }

  const arp = r.arp[s];
  if (arp !== '.' && bar >= 1) {
    const offs = [0, 2, 4, len, len + 2][Number(arp)] ?? 0;
    voice(a, out, t, degreeNote(r, chord + offs + 2 * len), stepS * 3, r.arpWave, 0.035, { cutoff: 3000 });
  }

  // the lead comes in on the second pass round the progression, then plays 8 bars, rests 4
  const leadBar = bar - 4;
  if (leadBar >= 0 && leadBar % 12 < 8) {
    const phraseStep = (leadBar % 12) * 16 + s;
    if (phraseStep === 0 && leadBar > 0) {
      p.pass++;
      p.lead = composeLead(p.theme, p.pass);
    }
    for (const n of p.lead) if (n.step === phraseStep) voice(a, out, t, n.midi, n.len * stepS * 0.95, r.lead.wave, r.lead.gain, { attack: 0.02, cutoff: 2600 });
  }

  if (bar >= 2) {
    if (r.kick[s] === 'x') kick(a, out, t);
    if (r.snare[s] === 'x') noiseHit(a, out, t, 0.12, 0.06, 'bandpass', 1800);
    if (r.hat[s] === 'x') noiseHit(a, out, t, 0.035, 0.03, 'highpass', 7000);
  }
}

function tick() {
  const a = sharedAudio();
  if (!a || !playing) return;
  const p = playing;
  const stepS = 60 / RECIPES[p.theme].bpm / 4;
  if (p.next < a.currentTime) p.next = a.currentTime + 0.05; // after a stall, don't rush to catch up
  while (p.next < a.currentTime + LOOKAHEAD_S) {
    playStep(a, p, p.next);
    p.step++;
    p.next += stepS;
  }
}

function startTheme(theme: Theme) {
  const a = sharedAudio();
  if (!a) return;
  const out = setup(a);
  if (playing?.theme === theme) return;
  const now = a.currentTime;
  if (playing) {
    const old = playing.bus;
    old.gain.cancelScheduledValues(now);
    old.gain.setValueAtTime(old.gain.value, now);
    old.gain.linearRampToValueAtTime(0, now + 1.2);
    window.setTimeout(() => old.disconnect(), 2500);
  }
  const bus = a.createGain();
  bus.gain.setValueAtTime(0, now);
  bus.gain.linearRampToValueAtTime(1, now + 1.5);
  bus.connect(out);
  playing = { theme, bus, step: 0, next: now + 0.1, lead: composeLead(theme, 0), pass: 0 };
  if (timer === undefined) timer = window.setInterval(tick, TICK_MS);
}

function stopAll() {
  window.clearInterval(timer);
  timer = undefined;
  if (playing) {
    const bus = playing.bus;
    window.setTimeout(() => bus.disconnect(), 1500);
  }
  playing = null;
}

function fadeMaster(to: number) {
  const a = sharedAudio();
  if (!a || !master) return;
  const now = a.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(to, now + 1);
}

/** Asks for a theme. It starts once the player has touched the screen (browsers need a tap first). */
export function setMusicTheme(theme: Theme) {
  wanted = theme;
  if (enabled && unlocked) startTheme(theme);
}

export function setMusicOn(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(MUSIC_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (on && unlocked) {
    startTheme(wanted);
    fadeMaster(VOLUME);
  } else if (!on) {
    fadeMaster(0);
    window.setTimeout(() => !enabled && stopAll(), 1100);
  }
}

/** Starts music on the first tap, and pauses it while the app is in the background. */
export function initMusic() {
  if (typeof document === 'undefined') return;
  const unlock = () => {
    unlocked = true;
    document.removeEventListener('pointerdown', unlock, true);
    document.removeEventListener('keydown', unlock, true);
    if (!enabled) return;
    startTheme(wanted);
    fadeMaster(VOLUME);
  };
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
  document.addEventListener('visibilitychange', () => {
    if (!unlocked) return;
    const a = sharedAudio();
    if (!a) return;
    if (document.visibilityState === 'hidden') void a.suspend();
    else void a.resume();
  });
}
