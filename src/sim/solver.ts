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

// --- LV-4: the fewest commands (blocks) that clear a floor, with repeat loops and functions ---

type Call = 'F1' | 'F2';
/** A block in the search, kept tiny: an action, a function call, or a repeat of a body. */
type Atom = Action | Call;
type SBlock = Atom | { times: number; body: SBlock[] };
type Bodies = Partial<Record<Call, SBlock[]>>;

type Exec = 'ok' | 'crash' | 'clear';

function execList(w: World, list: SBlock[], steps: { n: number }, fns: Bodies): Exec {
  for (const b of list) {
    const r = execBlock(w, b, steps, fns);
    if (r !== 'ok') return r;
  }
  return 'ok';
}

function execBlock(w: World, b: SBlock, steps: { n: number }, fns: Bodies): Exec {
  if (b === 'F1' || b === 'F2') return execList(w, fns[b] ?? [], steps, fns);
  if (typeof b === 'string') {
    if (++steps.n > STEP_LIMIT) return 'crash';
    if (!applyAction(w, b).ok) return 'crash';
    return goalsMet(w) ? 'clear' : 'ok';
  }
  for (let i = 0; i < b.times; i++) {
    const r = execList(w, b.body, steps, fns);
    if (r !== 'ok') return r;
  }
  return 'ok';
}

const TURNS = new Set<Atom>(['turn_left', 'turn_right']);
const onlyTurns = (list: SBlock[]): boolean => list.every((b) => typeof b === 'string' && TURNS.has(b));

type Memo = Map<string, SBlock[][]>;

/** Thrown when a search runs past its time budget (only the daily generator sets one). */
export class SearchBudgetExceeded extends Error {}
let deadline = Infinity;
let ticks = 0;
function tick() {
  if (deadline !== Infinity && (++ticks & 1023) === 0 && Date.now() > deadline) throw new SearchBudgetExceeded('search budget exceeded');
}

/**
 * All block lists of exactly `size` blocks, loops nested at most `depth` deep.
 * Skips lists that a shorter list always matches (a loop of only turns, left right pairs),
 * which never changes the minimum.
 */
function lists(atoms: Atom[], size: number, depth: number, memo: Memo, cap = Infinity): SBlock[][] {
  const k = `${size}/${depth}/${cap}`;
  const hit = memo.get(k);
  if (hit) return hit;
  tick();
  const out: SBlock[][] = [];
  if (size === 0) out.push([]);
  else {
    for (let first = 1; first <= size; first++) {
      for (const b of blocks(atoms, first, depth, memo, cap)) {
        for (const rest of lists(atoms, size - first, depth, memo, cap)) {
          const nx = rest[0];
          if ((b === 'turn_left' && nx === 'turn_right') || (b === 'turn_right' && nx === 'turn_left')) continue;
          out.push([b, ...rest]);
        }
      }
    }
  }
  memo.set(k, out);
  return out;
}

function blocks(atoms: Atom[], size: number, depth: number, memo: Memo, cap = Infinity): SBlock[] {
  if (size === 1) return atoms;
  if (depth === 0 || size - 1 > cap) return [];
  const out: SBlock[] = [];
  for (const body of lists(atoms, size - 1, depth - 1, memo, cap)) {
    if (onlyTurns(body)) continue;
    for (let times = 2; times <= 9; times++) out.push({ times, body });
  }
  return out;
}

function toRef(list: SBlock[]): string {
  return list.map((b) => (typeof b === 'string' ? b : `repeat ${b.times} { ${toRef(b.body)} }`)).join(' ');
}

function withDefs(main: SBlock[], fns: Bodies): string {
  const defs = (['F1', 'F2'] as Call[]).filter((f) => fns[f]).map((f) => ` def ${f} { ${toRef(fns[f]!)} }`);
  return toRef(main) + defs.join('');
}

/**
 * The floor's actions that can ever succeed here. A minimal program never holds a block that
 * fails or never runs, so leaving the rest out of the search cannot change the answer.
 */
function usefulActions(level: LevelFile): Action[] {
  const w = createWorld(level);
  const hasBoxes = w.boxes.some((row) => row.some((n) => n > 0));
  const hasSwitch = w.tiles.some((row) => row.some((t) => t.type === 'switch'));
  // Boxes can be stacked, so any floor with boxes may have steps to jump.
  let steps = hasBoxes;
  for (let y = 0; y < w.h; y++)
    for (let x = 0; x < w.w; x++)
      for (const [dx, dy] of [[1, 0], [0, 1]])
        if (x + dx < w.w && y + dy < w.h && w.tiles[y][x].height !== w.tiles[y + dy][x + dx].height) steps = true;
  const can: Record<Action, boolean> = {
    forward: true,
    turn_left: true,
    turn_right: true,
    jump: steps,
    pick_up: hasBoxes,
    drop: hasBoxes,
    activate: hasSwitch,
  };
  return ACTIONS.filter((a) => level.commands.includes(a) && can[a]);
}

/**
 * The smallest program (by block count, CR-7) that clears the floor and fits its slots, up to `maxSize` blocks.
 * It uses the floor's actions, repeat loops and the F1 and F2 functions where the floor allows them.
 * Function bodies count toward the size, and each call is one block.
 * Returns it as a reference string, or null if none fits.
 *
 * Main is searched one top-level block at a time, remembering (world, blocks left) states that
 * already failed. With functions, every possible body (smallest first) gets its own main search.
 * F2's body may call F1 but not the other way round, which loses nothing: names can be swapped.
 */
export function smallestProgram(
  level: LevelFile,
  maxSize: number,
  maxDepth = 2,
  limits: { loopBody?: number; fnBody?: number; budgetMs?: number } = {},
): string | null {
  deadline = limits.budgetMs ? Date.now() + limits.budgetMs : Infinity;
  try {
    return smallest(level, maxSize, maxDepth, limits);
  } finally {
    deadline = Infinity;
  }
}

function smallest(level: LevelFile, maxSize: number, maxDepth: number, limits: { loopBody?: number; fnBody?: number }): string | null {
  const actions = usefulActions(level);
  const loopCap = limits.loopBody ?? Infinity;
  // Each routine has to fit its slots on the floor (LS-1), so the search respects them too.
  const mainSlots = level.slots.main ?? Infinity;
  const f1Cap = Math.min(limits.fnBody ?? Infinity, level.slots.F1 ?? Infinity);
  const f2Cap = Math.min(limits.fnBody ?? Infinity, level.slots.F2 ?? Infinity);
  const loops = level.commands.includes('repeat') ? maxDepth : 0;
  const hasF1 = level.commands.includes('F1');
  const hasF2 = hasF1 && level.commands.includes('F2');
  const start = createWorld(level);
  const memos = new Map<string, Memo>();
  const memoFor = (atoms: Atom[]) => {
    const k = atoms.join(',');
    if (!memos.has(k)) memos.set(k, new Map());
    return memos.get(k)!;
  };

  /** Main fitting in exactly `n` blocks or fewer, with these function bodies. */
  // For each set of function bodies: per world, the most blocks left with which main already failed.
  // Failing with L blocks left means failing with fewer too, and it holds across sizes n.
  const failures = new Map<string, Map<string, number>>();
  const mainFits = (total: number, fns: Bodies, atoms: Atom[]): SBlock[] | null => {
    const n = Math.min(total, mainSlots);
    if (n < 1) return null;
    const memo = memoFor(atoms);
    const fk = withDefs([], fns);
    if (!failures.has(fk)) failures.set(fk, new Map());
    const failed = failures.get(fk)!;
    const search = (w: World, left: number, steps: number, path: SBlock[]): SBlock[] | null => {
      if (left === 0) return null;
      tick();
      const key = worldKey(w);
      if ((failed.get(key) ?? 0) >= left) return null;
      for (let size = 1; size <= left; size++) {
        for (const b of blocks(atoms, size, loops, memo, loopCap)) {
          const next = cloneWorld(w);
          const s = { n: steps };
          const r = execBlock(next, b, s, fns);
          if (r === 'clear') return [...path, b];
          if (r === 'crash') continue;
          const found = search(next, left - size, s.n, [...path, b]);
          if (found) return found;
        }
      }
      failed.set(key, Math.max(left, failed.get(key) ?? 0));
      return null;
    };
    return search(cloneWorld(start), n, 0, []);
  };

  // Every state LoopBot can reach. A function body that crashes from all of them can never be
  // called in a winning program, so it is skipped.
  const reachable: World[] = [];
  if (hasF1) {
    const seen = new Set([worldKey(start)]);
    let frontier = [start];
    while (frontier.length && reachable.length < 5000) {
      const next: World[] = [];
      for (const w of frontier) {
        reachable.push(w);
        for (const a of actions) {
          const n = cloneWorld(w);
          if (!applyAction(n, a).ok) continue;
          const k = worldKey(n);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push(n);
        }
      }
      frontier = next;
    }
  }
  // A minimal program calls a function at least twice, from two different states (a call that
  // changed nothing would be wasted), so the body must run cleanly from at least two of them.
  const runsSomewhere = (body: SBlock[], fns: Bodies) => {
    let ok = 0;
    for (const w of reachable) if (execList(cloneWorld(w), body, { n: 0 }, fns) !== 'crash' && ++ok >= 2) return true;
    return false;
  };

  // A function only pays off when called at least twice, and a one-block body never beats inlining it.
  const fits = (n: number): string | null => {
    const plain = mainFits(n, {}, actions);
    if (plain) return toRef(plain);
    if (!hasF1) return null;
    const f1Atoms: Atom[] = [...actions, 'F1'];
    for (let s1 = 2; s1 <= Math.min(n - 2, f1Cap); s1++) {
      for (const b1 of lists(actions, s1, loops, memoFor(actions), loopCap)) {
        if (onlyTurns(b1) || !runsSomewhere(b1, {})) continue;
        const main = mainFits(n - s1, { F1: b1 }, f1Atoms);
        if (main) return withDefs(main, { F1: b1 });
      }
    }
    if (!hasF2) return null;
    const f2Atoms: Atom[] = [...actions, 'F1', 'F2'];
    for (let s1 = 2; s1 <= Math.min(n - 4, f1Cap); s1++) {
      for (let s2 = 2; s1 + s2 <= n - 2 && s2 <= f2Cap; s2++) {
        for (const b1 of lists(actions, s1, loops, memoFor(actions), loopCap)) {
          if (onlyTurns(b1) || !runsSomewhere(b1, {})) continue;
          for (const b2 of lists(f1Atoms, s2, loops, memoFor(f1Atoms), loopCap)) {
            if (onlyTurns(b2) || !runsSomewhere(b2, { F1: b1 })) continue;
            const main = mainFits(n - s1 - s2, { F1: b1, F2: b2 }, f2Atoms);
            if (main) return withDefs(main, { F1: b1, F2: b2 });
          }
        }
      }
    }
    return null;
  };

  for (let n = 1; n <= maxSize; n++) {
    const found = fits(n);
    if (found) return found;
  }
  return null;
}
