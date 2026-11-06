// LV-3: breadth-first search for the shortest action sequence that clears a floor.
// Used by the level checks to confirm the step par is the true minimum.

import { ACTIONS } from './types';
import type { Action, LevelFile } from './types';
import { applyAction, cloneWorld, createWorld, goalsMet, worldKey } from './world';

export function shortestActionPath(level: LevelFile, maxStates = 200_000): Action[] | null {
  const allowed = ACTIONS.filter((a) => level.commands.includes(a));
  const start = createWorld(level);
  if (goalsMet(start)) return [];
  const seen = new Set([worldKey(start)]);
  let frontier = [{ world: start, path: [] as Action[] }];
  while (frontier.length && seen.size < maxStates) {
    const next: typeof frontier = [];
    for (const { world, path } of frontier) {
      for (const a of allowed) {
        const w = cloneWorld(world);
        if (!applyAction(w, a).ok) continue; // a crash ends the run, so it's never on a solution path
        const p = [...path, a];
        if (goalsMet(w)) return p;
        const k = worldKey(w);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ world: w, path: p });
      }
    }
    frontier = next;
  }
  return null;
}
