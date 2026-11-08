// Daily challenge generator. It runs offline (scripts/make-daily.ts) to build the puzzle bank
// that ships with the game, so the game itself never has to search for a par on the phone.
//
// A puzzle is made program first: a random looping program is "walked" across empty sky, and every
// tile LoopBot steps on becomes floor (jumps make steps up or down, activate leaves a switch).
// The solvers then find the true pars on the finished board, and puzzles where a loop doesn't
// clearly pay off are thrown away.

import type { Action, Facing, LevelFile } from '../sim/types';
import { expandDaily } from './entry';
import type { DailyEntry, Difficulty } from './entry';
import { countCommands, parseReference } from '../sim/program';
import { Runner } from '../sim/interpreter';
import { SearchBudgetExceeded, shortestActionPath, smallestProgram } from '../sim/solver';

/** mulberry32: small, fast and the same on every device. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)];
  return { next, int, pick };
}
type Rng = ReturnType<typeof rng>;

type Shape = Array<Action | { times: number; body: Shape }>;

const FACINGS: Facing[] = ['north', 'east', 'south', 'west'];
const DELTA: Record<Facing, [number, number]> = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
const LEFT: Record<Facing, Facing> = { north: 'west', west: 'south', south: 'east', east: 'north' };
const RIGHT: Record<Facing, Facing> = { north: 'east', east: 'south', south: 'west', west: 'north' };

function atoms(r: Rng, n: number, pool: Action[]): Action[] {
  const out: Action[] = [];
  for (let i = 0; i < n; i++) out.push(r.pick(pool));
  return out;
}

const hasMove = (xs: Shape): boolean => xs.some((b) => (typeof b === 'string' ? b === 'forward' || b === 'jump' : hasMove(b.body)));

function shapeFor(r: Rng, d: Difficulty, switches: boolean): Shape {
  const walk: Action[] = ['forward', 'forward', 'forward', 'turn_left', 'turn_right'];
  const climb: Action[] = [...walk, 'jump', 'jump'];
  const body = (n: number, pool: Action[]) => {
    const b: Shape = atoms(r, n, pool);
    if (switches) b.splice(r.int(0, b.length), 0, 'activate');
    return b;
  };
  if (d === 'easy') {
    // Flat walks only (no jumps): one loop, maybe a step before or after it.
    const b = body(r.int(2, 4), walk);
    const pre: Shape = r.next() < 0.35 ? atoms(r, 1, walk) : [];
    const post: Shape = r.next() < 0.35 ? atoms(r, r.int(1, 2), walk) : [];
    return [...pre, { times: r.int(2, 5), body: b }, ...post];
  }
  if (d === 'medium') {
    const pre: Shape = atoms(r, r.int(0, 2), climb);
    const post: Shape = atoms(r, r.int(0, 2), climb);
    return [...pre, { times: r.int(2, 4), body: body(r.int(3, 4), climb) }, ...post];
  }
  // hard: a loop inside a loop, or two loops back to back
  if (r.next() < 0.6) {
    const inner: Shape = [{ times: r.int(2, 4), body: atoms(r, r.int(1, 2), climb) }];
    const outer: Shape = [...atoms(r, r.int(0, 2), climb), ...inner, ...body(r.int(1, 2), climb)];
    return [...atoms(r, r.int(0, 1), climb), { times: r.int(2, 3), body: outer }];
  }
  return [
    ...atoms(r, r.int(0, 1), climb),
    { times: r.int(2, 4), body: body(r.int(2, 3), climb) },
    ...atoms(r, r.int(0, 2), climb),
    { times: r.int(2, 4), body: atoms(r, r.int(2, 3), climb) },
  ];
}

function flatten(s: Shape, out: Action[] = []): Action[] {
  for (const b of s) {
    if (typeof b === 'string') out.push(b);
    else for (let i = 0; i < b.times; i++) flatten(b.body, out);
  }
  return out;
}

interface Cell {
  h: number;
  sw: number;
  visits: number;
}

/** Walks the actions over empty sky, laying floor under LoopBot. Null if the walk breaks a rule. */
function carve(r: Rng, actions: Action[], facing: Facing, h0: number) {
  const cells = new Map<string, Cell & { x: number; y: number }>();
  let x = 0;
  let y = 0;
  let f = facing;
  cells.set('0,0', { x: 0, y: 0, h: h0, sw: 0, visits: 1 });
  for (const a of actions) {
    const here = cells.get(`${x},${y}`)!;
    if (a === 'turn_left') f = LEFT[f];
    else if (a === 'turn_right') f = RIGHT[f];
    else if (a === 'activate') here.sw++;
    else {
      const [dx, dy] = DELTA[f];
      const nx = x + dx;
      const ny = y + dy;
      const k = `${nx},${ny}`;
      const there = cells.get(k);
      if (a === 'forward') {
        if (there && there.h !== here.h) return null;
        if (!there) cells.set(k, { x: nx, y: ny, h: here.h, sw: 0, visits: 0 });
      } else {
        if (there) {
          const diff = there.h - here.h;
          if (diff !== 1 && diff >= 0) return null;
        } else {
          const up = here.h < 3;
          const down = here.h > 0;
          const h = up && (!down || r.next() < 0.5) ? here.h + 1 : here.h - 1;
          cells.set(k, { x: nx, y: ny, h, sw: 0, visits: 0 });
        }
      }
      x = nx;
      y = ny;
      cells.get(k)!.visits++;
    }
  }
  return { cells, end: { x, y } };
}

const NAMES_A = ['Neon', 'Glass', 'Copper', 'Night', 'Signal', 'Static', 'Sky', 'Iron', 'Velvet', 'Echo', 'Amber', 'Cobalt', 'Hollow', 'Swift', 'Quiet', 'Spiral'];
const NAMES_B = ['Stair', 'Bridge', 'Relay', 'Ledge', 'Loop', 'Gantry', 'Circuit', 'Catwalk', 'Shaft', 'Terrace', 'Switchback', 'Beacon', 'Ramp', 'Walk', 'Track', 'Steps'];
const BANDS = ['lobby', 'maintenance', 'workshop', 'control', 'rooftop'];

function toRef(s: Shape): string {
  return s.map((b) => (typeof b === 'string' ? b : `repeat ${b.times} { ${toRef(b.body)} }`)).join(' ');
}

export interface Tuning {
  /** Largest board side. */
  maxSide: number;
  minSteps: number;
  maxSteps: number;
  /** Smallest command par allowed for each difficulty. */
  minPar: Record<Difficulty, number>;
  /** Largest command par allowed (keeps the solver and the level checks fast). */
  maxPar: Record<Difficulty, number>;
}

export const TUNING: Tuning = {
  maxSide: 7,
  minSteps: 8,
  maxSteps: 32,
  minPar: { easy: 4, medium: 4, hard: 5 },
  maxPar: { easy: 5, medium: 6, hard: 7 },
};

/**
 * One candidate puzzle from a seed, or null if this seed doesn't make a good one.
 * Deterministic: the same seed and difficulty always give the same answer.
 */
export function generate(seed: number, d: Difficulty, t: Tuning = TUNING): DailyEntry | null {
  const r = rng(seed);
  const switches = d !== 'easy' && r.next() < 0.35;
  const shape = shapeFor(r, d, switches);
  if (!hasMove(shape)) return null;
  const actions = flatten(shape);
  const moves = actions.filter((a) => a === 'forward' || a === 'jump').length;
  if (actions.length < t.minSteps || actions.length > t.maxSteps || moves < 4) return null;
  const facing = r.pick(FACINGS);
  const carved = carve(r, actions, facing, r.int(0, 1));
  if (!carved) return null;
  const { cells, end } = carved;
  const list = [...cells.values()];
  if (switches) {
    if (list.filter((c) => c.sw > 0).length < 2 || list.some((c) => c.sw > 1)) return null;
  } else {
    const last = cells.get(`${end.x},${end.y}`)!;
    // The exit has to be somewhere new, or the run would end the first time it passed by.
    if (last.visits !== 1 || (end.x === 0 && end.y === 0)) return null;
  }

  // Decoys: a few loose tiles beside the path, so the route isn't simply "every tile".
  {
    const decoys = d === 'easy' ? r.int(0, 2) : r.int(1, 3);
    for (let i = 0; i < decoys; i++) {
      const c = r.pick(list);
      const [dx, dy] = DELTA[r.pick(FACINGS)];
      const k = `${c.x + dx},${c.y + dy}`;
      if (!cells.has(k)) cells.set(k, { x: c.x + dx, y: c.y + dy, h: Math.max(0, Math.min(3, c.h + r.int(-1, 1))), sw: 0, visits: 0 });
    }
  }

  const all = [...cells.values()];
  const minX = Math.min(...all.map((c) => c.x));
  const minY = Math.min(...all.map((c) => c.y));
  const w = Math.max(...all.map((c) => c.x)) - minX + 1;
  const h = Math.max(...all.map((c) => c.y)) - minY + 1;
  if (w > t.maxSide || h > t.maxSide || (w < 3 && h < 3)) return null;
  const tiles: string[][] = Array.from({ length: h }, () => Array<string>(w).fill('_'));
  const heights: string[][] = Array.from({ length: h }, () => Array<string>(w).fill('0'));
  for (const c of all) {
    tiles[c.y - minY][c.x - minX] = c.sw ? 's' : '.';
    heights[c.y - minY][c.x - minX] = String(c.h);
  }
  if (!switches) tiles[end.y - minY][end.x - minX] = 'e';
  const flat = heights.every((row) => row.every((v) => v === '0'));

  const level: LevelFile = expandDaily(
    {
      d,
      title: `${r.pick(NAMES_A)} ${r.pick(NAMES_B)}`,
      band: r.pick(BANDS),
      tiles: tiles.map((row) => row.join('')),
      heights: flat ? null : heights.map((row) => row.join('')),
      bot: { x: -minX, y: -minY, facing },
      goal: switches ? 'switches' : 'exit',
      par: { commands: 99, steps: 999 },
      main: 99,
      reference: toRef(shape),
    },
    'daily',
  );

  // The walk itself must clear the board (it can't, if the goal is met early in a bad way).
  if (new Runner(parseReference(level.reference), level).runToEnd().status !== 'cleared') return null;
  const path = shortestActionPath(level);
  if (!path) return null;
  const steps = path.length;
  // Switch floors use one more action (activate), which makes the search much bigger: one block less.
  const maxPar = t.maxPar[d] - (switches ? 1 : 0);
  let best: string | null;
  try {
    // A board that takes the solver this long isn't worth the wait: try the next seed.
    best = smallestProgram(level, Math.min(countCommands(parseReference(level.reference)), maxPar), 2, { budgetMs: 4000 });
  } catch (err) {
    if (err instanceof SearchBudgetExceeded) return null;
    throw err;
  }
  if (!best) return null;
  const program = parseReference(best);
  const commands = countCommands(program);
  // A loop has to pay off clearly, and the smallest program must also be the fastest one, so all
  // three stars can be earned together.
  if (commands < t.minPar[d] || commands > steps - 3) return null;
  const run = new Runner(program, level).runToEnd();
  if (run.status !== 'cleared' || run.steps !== steps) return null;
  if (!best.includes('repeat')) return null;
  if (d === 'hard' && !/repeat \d+ \{[^}]*repeat/.test(best) && (best.match(/repeat/g) ?? []).length < 2) return null;

  return {
    d,
    title: level.title,
    band: level.band,
    tiles: level.tiles,
    heights: level.heights,
    bot: level.bot,
    goal: switches ? 'switches' : 'exit',
    par: { commands, steps },
    main: commands + (d === 'hard' ? 3 : 2),
    reference: best,
  };
}
