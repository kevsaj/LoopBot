// Reduce motion: calmer celebrations, no confetti, no idle bobbing or glowing eyes, no typing text.
// It is on when the device asks for less motion (iOS Reduce Motion, Android Remove animations,
// or the browser setting), or when the player turns it on in Settings > General.
// The <html> element gets the class "reduce-motion" whenever it is on, and the CSS keys off that.

const KEY = 'loopbot.reduceMotion';
const listeners = new Set<() => void>();

const query = () => (typeof window === 'undefined' ? null : (window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null));

/** The device (or browser) asks for less motion. */
export function deviceReducesMotion(): boolean {
  return !!query()?.matches;
}

/** The Settings switch. */
export function reduceMotionPref(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Should animations be calm right now? Read it each time: the player can change it mid-floor. */
export function reducedMotion(): boolean {
  return reduceMotionPref() || deviceReducesMotion();
}

export function setReduceMotion(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
  applyMotion();
}

/** Call it whenever reduce motion may change (screens that animate on their own, like the board). */
export function onMotionChange(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

let watching = false;
/** Tags <html> and tells listeners. Called once at start, then on every change. */
export function applyMotion() {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('reduce-motion', reducedMotion());
  if (!watching) {
    watching = true;
    query()?.addEventListener?.('change', applyMotion);
  }
  listeners.forEach((f) => f());
}
