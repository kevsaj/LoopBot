// Player progress, saved on the device (NF-3: everything works offline).
// One JSON blob in local storage; every read tolerates missing or broken data.

import { markSavesDirty } from './storage/persist';

export interface Progress {
  /** Best stars per floor id (1 to 3). */
  stars: Record<string, number>;
  /** Hints the player can spend (GD-12: start with 5). */
  hints: number;
  /** Hints already awarded for 3-star floors, so each 10 is only paid once. */
  hintsAwarded: number;
  /** How many hint tiers have been revealed per floor (0 to 3). */
  revealed: Record<string, number>;
  /** Failed runs per floor (crash or ended short), for the free Nudge. */
  fails: Record<string, number>;
  /** First-run tutorial overlays on Floors 1 and 2. */
  tutorial: boolean;
}

const KEY = 'loopbot.progress';
export const START_HINTS = 5;
export const FREE_NUDGE_AFTER = 3;

function fresh(): Progress {
  return { stars: {}, hints: START_HINTS, hintsAwarded: 0, revealed: {}, fails: {}, tutorial: true };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      // carry over stars saved by the editor prototype
      const p = fresh();
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith('loopbot.stars.')) p.stars[k.slice('loopbot.stars.'.length)] = Number(localStorage.getItem(k)) || 0;
      }
      return p;
    }
    return { ...fresh(), ...(JSON.parse(raw) as Partial<Progress>) };
  } catch {
    return fresh();
  }
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    markSavesDirty();
  } catch {
    /* storage blocked: the session keeps working */
  }
}

/** Records a clear. Returns the new progress (GD-12: +1 hint for every 10 floors 3-starred). */
export function recordClear(p: Progress, floorId: string, stars: number): Progress {
  const best = Math.max(p.stars[floorId] ?? 0, stars);
  const next = { ...p, stars: { ...p.stars, [floorId]: best } };
  const threeStarred = Object.values(next.stars).filter((s) => s >= 3).length;
  const earned = Math.floor(threeStarred / 10);
  if (earned > next.hintsAwarded) {
    next.hints += earned - next.hintsAwarded;
    next.hintsAwarded = earned;
  }
  return next;
}

export function recordFail(p: Progress, floorId: string): Progress {
  return { ...p, fails: { ...p.fails, [floorId]: (p.fails[floorId] ?? 0) + 1 } };
}

/** The next tier is free when it's the Nudge and the player has failed the floor 3 times. */
export function nextHintIsFree(p: Progress, floorId: string): boolean {
  return (p.revealed[floorId] ?? 0) === 0 && (p.fails[floorId] ?? 0) >= FREE_NUDGE_AFTER;
}

/** Reveals the next hint tier if the player can pay for it. Returns null when they can't. */
export function revealHint(p: Progress, floorId: string, tiers: number): Progress | null {
  const shown = p.revealed[floorId] ?? 0;
  if (shown >= tiers) return null;
  const free = nextHintIsFree(p, floorId);
  if (!free && p.hints < 1) return null;
  return { ...p, hints: free ? p.hints : p.hints - 1, revealed: { ...p.revealed, [floorId]: shown + 1 } };
}

/** A floor is open when it's the first one or the floor before it has been cleared. */
export function isUnlocked(p: Progress, floorIds: string[], index: number): boolean {
  return index === 0 || (p.stars[floorIds[index - 1]] ?? 0) > 0;
}
