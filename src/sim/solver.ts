// LV-3: breadth-first search for the shortest action sequence that clears a floor.
// Used by the level checks to confirm the step par is the true minimum.

import { ACTIONS } from './types';
import type { Action, LevelFile, World } from './types';
import { applyAction, cloneWorld, createWorld, goalsMet, worldKey } from './world';
import { STEP_LIMIT } from './interpreter';

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

// --- LV-4: the fewest commands (blocks) that clear a floor, with repeat loops ---

/** A block in the search, kept tiny: an action, or a repeat of a body. */
type SBlock = Action | { times: number; body: SBlock[] };

type Exec = 'ok' | 'crash' | 'clear';

function execList(w: World, list: SBlock[], steps: { n: number }): Exec {
  for (const b of list) {
    const r = execBlock(w, b, steps);
    if (r !== 'ok') return r;
  }
  return 'ok';
}

function execBlock(w: World, b: SBlock, steps: { n: number }): Exec {
  if (typeof b === 'string') {
    if (++steps.n > STEP_LIMIT) return 'crash';
    if (!applyAction(w, b).ok) return 'crash';
    return goalsMet(w) ? 'clear' : 'ok';
  }
  for (let i = 0; i < b.times; i++) {
    const r = execList(w, b.body, steps);
    if (r !== 'ok') return r;
  }
  return 'ok';
}

const TURNS = new Set<Action>(['turn_left', 'turn_right']);
const onlyTurns = (list: SBlock[]): boolean => list.every((b) => typeof b === 'string' && TURNS.has(b));

/**
 * All block lists of exactly `size` blocks, loops nested at most `depth` deep.
 * Skips lists that a shorter list always matches (a loop of only turns, left right pairs),
 * which never changes the minimum.
 */
function lists(actions: Action[], size: number, depth: number, memo: Map<string, SBlock[][]>): SBlock[][] {
  const k = `${size}/${depth}`;
  const hit = memo.get(k);
  if (hit) return hit;
  const out: SBlock[][] = [];
  if (size === 0) out.push([]);
  else {
    for (let first = 1; first <= size; first++) {
      for (const b of blocks(actions, first, depth, memo)) {
        for (const rest of lists(actions, size - first, depth, memo)) {
          const prev = b;
          const nx = rest[0];
          if ((prev === 'turn_left' && nx === 'turn_right') || (prev === 'turn_right' && nx === 'turn_left')) continue;
          out.push([b, ...rest]);
        }
      }
    }
  }
  memo.set(k, out);
  return out;
}

function blocks(actions: Action[], size: number, depth: number, memo: Map<string, SBlock[][]>): SBlock[] {
  if (size === 1) return actions;
  if (depth === 0) return [];
  const out: SBlock[] = [];
  for (const body of lists(actions, size - 1, depth - 1, memo)) {
    if (onlyTurns(body)) continue;
    for (let times = 2; times <= 9; times++) out.push({ times, body });
  }
  return out;
}

function toRef(list: SBlock[]): string {
  return list.map((b) => (typeof b === 'string' ? b : `repeat ${b.times} { ${toRef(b.body)} }`)).join(' ');
}

/**
 * The smallest program (by block count, CR-7) that clears the floor using only actions and
 * repeat, up to `maxSize` blocks. Returns it as a reference string, or null if none fits.
 * Searches top-level blocks one at a time and remembers (world, blocks left) states that
 * already failed, so it stays fast for the Maintenance band's pars.
 */
export function smallestProgram(level: LevelFile, maxSize: number, maxDepth = 2): string | null {
  const actions = ACTIONS.filter((a) => level.commands.includes(a));
  const loops = level.commands.includes('repeat') ? maxDepth : 0;
  const memo = new Map<string, SBlock[][]>();
  const failed = new Set<string>();
  const start = createWorld(level);

  const search = (w: World, left: number, steps: number, path: SBlock[]): SBlock[] | null => {
    if (left === 0) return null;
    const key = `${worldKey(w)}#${left}`;
    if (failed.has(key)) return null;
    for (let size = 1; size <= left; size++) {
      for (const b of blocks(actions, size, loops, memo)) {
        const next = cloneWorld(w);
        const s = { n: steps };
        const r = execBlock(next, b, s);
        if (r === 'clear') return [...path, b];
        if (r === 'crash') continue;
        const found = search(next, left - size, s.n, [...path, b]);
        if (found) return found;
      }
    }
    failed.add(key);
    return null;
  };

  for (let n = 1; n <= maxSize; n++) {
    const found = search(cloneWorld(start), n, 0, []);
    if (found) return toRef(found);
  }
  return null;
}
