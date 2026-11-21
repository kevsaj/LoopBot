// How sharp the board is drawn, tuned to what the device can keep smooth.
//
// The board canvas has more pixels than CSS pixels so it looks crisp (devicePixelRatio, see
// pixelRatio in BoardScene.ts). Every one of those pixels is redrawn 30 times a second, and a big,
// low-powered tablet (4 GB of memory, an entry-level GPU) can't keep up at full sharpness: moves and
// turns stutter while a fast phone stays smooth. So the board gets a pixel budget:
// - low-end devices start with a smaller one (fewer pixels, every animation kept),
// - and while a floor is open a watchdog counts the frames actually drawn. When the board keeps
//   falling well short of 30 a second it drops the sharpness a step (never below one canvas
//   pixel per screen pixel, the look before PR #73), and remembers that for the next floor.
// Each app launch tries one step sharper again, so a slow moment (a hot device, an update running
// in the background) doesn't make the board soft for good.

const KEY = 'loopbot.boardScale';

/** One step down multiplies the pixel ratio by this. */
export const STEP = 0.8;
/** Canvas pixels the board may use on a capable device (a big PC window at UI zoom still fits). */
const BUDGET_FULL = 4_000_000;
/** Canvas pixels the board may use on a low-end device. */
const BUDGET_LOW = 800_000;

interface NavLike {
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

/**
 * A device with little memory or few cores: 4 GB or less (Chrome reports 0.25 to 8, rounded down,
 * so a 4 GB tablet says 4 and a flagship says 8), or 4 cores or fewer. Unknown counts as capable.
 */
export function lowEndDevice(nav: NavLike | undefined = typeof navigator === 'undefined' ? undefined : (navigator as NavLike)): boolean {
  if (!nav) return false;
  const mem = nav.deviceMemory;
  const cores = nav.hardwareConcurrency;
  return (typeof mem === 'number' && mem > 0 && mem <= 4) || (typeof cores === 'number' && cores > 0 && cores <= 4);
}

function readSaved(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v >= 1 ? v : null;
  } catch {
    return null;
  }
}

function save(v: number) {
  try {
    localStorage.setItem(KEY, v.toFixed(3));
  } catch {
    /* ignore */
  }
}

/** The highest pixel ratio the watchdog allows this session (Infinity = no cap yet). */
let cap: number | null = null;
function sessionCap(): number {
  if (cap === null) {
    const saved = readSaved();
    // try one step sharper than last time; the watchdog steps back down if it's still too much
    cap = saved === null ? Infinity : saved / STEP;
  }
  return cap;
}

/** For tests: forget what this session learned. */
export function resetQuality() {
  cap = null;
}

/**
 * Canvas pixels per CSS pixel for a board area of w x h CSS pixels, when the screen could show
 * `want` (devicePixelRatio times any interface zoom). Never below 1.
 */
export function boardRatio(want: number, w: number, h: number, low = lowEndDevice()): number {
  const budget = low ? BUDGET_LOW : BUDGET_FULL;
  const byBudget = Math.sqrt(budget / Math.max(1, w * h));
  return Math.max(1, Math.min(want, low ? 2 : 3, byBudget, sessionCap()));
}

/**
 * The board drew too few frames at this ratio: cap it a step lower for the rest of the session and
 * the next launches. Returns false when it's already at 1 (nothing left to lower).
 */
export function stepDown(current: number): boolean {
  if (current <= 1.001) return false;
  cap = Math.max(1, current * STEP);
  save(cap);
  return true;
}

/** Frames per second below which a window counts as slow (the board aims for 30). */
const SLOW_FPS = 24;
/** Length of one measuring window, ms. */
const WINDOW_MS = 2000;
/** The first moments of a floor are busy (building tiles, the screen sliding in), so skip them. */
const WARMUP_MS = 2500;

/**
 * Counts frames as the board draws them. Two slow windows in a row call onSlow(). A long gap
 * between frames (the app in the background, the screen off) restarts the window instead of
 * counting as slow.
 */
export class FrameWatch {
  private start = -1;
  private last = -1;
  private frames = 0;
  private slowInRow = 0;
  private readonly born: number;

  constructor(
    now: number,
    private readonly onSlow: () => void,
  ) {
    this.born = now;
  }

  frame(now: number) {
    if (now - this.born < WARMUP_MS) return;
    if (this.start < 0 || now - this.last > 250) {
      this.start = now;
      this.last = now;
      this.frames = 0;
      return;
    }
    this.last = now;
    this.frames++;
    const span = now - this.start;
    if (span < WINDOW_MS) return;
    const fps = (this.frames * 1000) / span;
    this.slowInRow = fps < SLOW_FPS ? this.slowInRow + 1 : 0;
    this.start = now;
    this.frames = 0;
    if (this.slowInRow >= 2) {
      this.slowInRow = 0;
      this.onSlow();
    }
  }
}
