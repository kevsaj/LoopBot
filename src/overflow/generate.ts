// Overflow floor generator. Like the daily one, it runs offline (scripts/make-overflow.ts) to build
// the bank that ships with the game, so a phone never has to search for a par.
//
// A floor starts the daily way: a random looping program is walked across empty sky and every tile
// LoopBot steps on becomes floor. Then one trick from another tower goes in: thin ice and slick ice
// (Frostline), heat vents (Heatwave), turntables (Twist), Echo (Twin Spires) or mosaics (Fractal).
// Finally the solvers find the true pars on the finished board. A floor the solvers can't clear
// within its block budget is thrown away, so every floor in the bank is solvable and its par is
// the real minimum.

import type { Action, Facing, LevelFile } from '../sim/types';
import { carve, flatten, hasMove, rng, shapeFor, toRef } from '../daily/generate';
import type { Rng, Shape } from '../daily/generate';
import type { Difficulty } from '../daily/entry';
import { countCommands, parseReference } from '../sim/program';
import { Runner } from '../sim/interpreter';
import { SearchBudgetExceeded, shortestActionPath, smallestProgram } from '../sim/solver';
import { expandOverflow } from './entry';
import type { Kind, OverflowEntry, Tier } from './entry';

const FACINGS: Facing[] = ['north', 'east', 'south', 'west'];
const DELTA: Record<Facing, [number, number]> = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };

/** Which tricks each tier mixes in, and how hard its walks are. */
export const TIER_KINDS: Record<Tier, Kind[]> = {
  1: ['walk'],
  2: ['walk', 'switch', 'ice', 'vent'],
  3: ['switch', 'ice', 'vent', 'spin', 'echo', 'mosaic'],
  4: ['walk', 'switch', 'ice', 'vent', 'spin', 'echo', 'mosaic'],
};
const TIER_DIFFICULTY: Record<Tier, Difficulty[]> = { 1: ['easy'], 2: ['easy', 'medium'], 3: ['medium'], 4: ['medium', 'hard'] };
/** Smallest and largest command par per tier. */
const TIER_PAR: Record<Tier, [number, number]> = { 1: [3, 5], 2: [4, 6], 3: [4, 6], 4: [5, 7] };
const MAX_SIDE = 7;

type Cell = { x: number; y: number; h: number; sw: number; visits: number; tile?: string };

/** Puts `wait` blocks into a shape, so vent floors sometimes need one to let a blast pass. */
function addWaits(r: Rng, s: Shape): Shape {
  return s.map((b) => (typeof b === 'string' ? b : { times: b.times, body: r.next() < 0.6 ? [...b.body.slice(0, 1), 'wait' as Action, ...b.body.slice(1)] : b.body }));
}

/** Board text from cells: tiles, heights (null when flat) and the offset to board coordinates. */
function toBoard(cells: Cell[]) {
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const w = Math.max(...cells.map((c) => c.x)) - minX + 1;
  const h = Math.max(...cells.map((c) => c.y)) - minY + 1;
  const tiles = Array.from({ length: h }, () => Array<string>(w).fill('_'));
  const heights = Array.from({ length: h }, () => Array<string>(w).fill('0'));
  for (const c of cells) {
    tiles[c.y - minY][c.x - minX] = c.tile ?? (c.sw ? 's' : '.');
    heights[c.y - minY][c.x - minX] = String(c.h);
  }
  const flat = heights.every((row) => row.every((v) => v === '0'));
  return { w, h, minX, minY, tiles: tiles.map((r) => r.join('')), heights: flat ? null : heights.map((r) => r.join('')) };
}

function addDecoys(r: Rng, cells: Map<string, Cell>, n: number) {
  const list = [...cells.values()];
  for (let i = 0; i < n; i++) {
    const c = r.pick(list);
    const [dx, dy] = DELTA[r.pick(FACINGS)];
    const k = `${c.x + dx},${c.y + dy}`;
    if (!cells.has(k)) cells.set(k, { x: c.x + dx, y: c.y + dy, h: Math.max(0, Math.min(3, c.h + r.int(-1, 1))), sw: 0, visits: 0 });
  }
}

function asLevel(e: OverflowEntry): LevelFile {
  return expandOverflow(e, 'overflow-gen', 'gen', 'brickyard');
}

const clears = (ref: string, e: OverflowEntry) => new Runner(parseReference(ref), asLevel(e)).runToEnd().status === 'cleared';

/**
 * One candidate floor from a seed, or null if this seed doesn't make a good one.
 * Deterministic: the same seed, tier and trick always give the same answer.
 */
export function generateOverflow(seed: number, tier: Tier, kind: Kind, budgetMs = 4000): OverflowEntry | null {
  const r = rng(seed);
  const d = kind === 'echo' ? r.pick<Difficulty>(['easy', 'medium']) : r.pick(TIER_DIFFICULTY[tier]);
  const switches = kind === 'switch';
  let shape = shapeFor(r, kind === 'switch' && d === 'easy' ? 'medium' : d, switches);
  if (kind === 'vent') shape = addWaits(r, shape);
  if (!hasMove(shape)) return null;
  const actions = flatten(shape);
  const walk = actions.filter((a) => a !== 'wait');
  const moves = walk.filter((a) => a === 'forward' || a === 'jump').length;
  if (actions.length < 8 || actions.length > 34 || moves < 4) return null;
  const facing = r.pick(FACINGS);
  // ice slides and Echo's copy both read better on flat ground
  const flatOnly = kind === 'ice' || kind === 'echo' || kind === 'spin';
  if (flatOnly && walk.includes('jump')) return null;
  const carved = carve(r, walk, facing, flatOnly ? 0 : r.int(0, 1));
  if (!carved) return null;
  const { cells, end } = carved as { cells: Map<string, Cell>; end: { x: number; y: number } };
  const path = [...cells.values()];
  if (switches) {
    if (path.filter((c) => c.sw > 0).length < 2 || path.some((c) => c.sw > 1)) return null;
  } else if (kind !== 'mosaic') {
    const last = cells.get(`${end.x},${end.y}`)!;
    if (last.visits !== 1 || (end.x === 0 && end.y === 0)) return null;
  }
  addDecoys(r, cells, tier === 1 ? r.int(0, 2) : r.int(1, 3));

  const goal: OverflowEntry['goal'] = switches ? 'switches' : kind === 'mosaic' ? 'lit' : 'exit';
  if (goal === 'exit') cells.get(`${end.x},${end.y}`)!.tile = 'e';
  // tiles on the walk other than the start and the exit, where a trick can go
  const inner = path.filter((c) => (c.x !== 0 || c.y !== 0) && !(c.x === end.x && c.y === end.y));
  const decoys = [...cells.values()].filter((c) => c.visits === 0 && !(c.x === 0 && c.y === 0));

  if (kind === 'mosaic') {
    const n = Math.min(inner.length, r.int(3, 5));
    if (n < 3) return null;
    const picks = [...inner].sort(() => r.next() - 0.5).slice(0, n - 1);
    for (const c of picks) c.tile = 'm';
    cells.get(`${end.x},${end.y}`)!.tile = 'm';
  }
  if (kind === 'ice') {
    // thin ice on tiles the walk crosses once, slick ice on a loose tile or two
    const once = inner.filter((c) => c.visits === 1);
    if (!once.length) return null;
    for (const c of [...once].sort(() => r.next() - 0.5).slice(0, r.int(1, Math.min(3, once.length)))) c.tile = 't';
    for (const c of decoys.slice(0, r.int(0, 2))) c.tile = 'i';
    if (r.next() < 0.5 && inner.length) r.pick(inner).tile = 'i';
  }
  if (kind === 'spin') {
    // a turntable where the walk arrives and then turns; the solver works out the new route
    const turnsAt = new Map<string, Action>();
    {
      let x = 0;
      let y = 0;
      let f = facing;
      let moved = false;
      for (const a of walk) {
        if (a === 'turn_left' || a === 'turn_right') {
          if (moved && !(x === 0 && y === 0)) turnsAt.set(`${x},${y}`, a);
          f = a === 'turn_left' ? FACINGS[(FACINGS.indexOf(f) + 3) % 4] : FACINGS[(FACINGS.indexOf(f) + 1) % 4];
          moved = false;
        } else if (a === 'forward' || a === 'jump') {
          x += DELTA[f][0];
          y += DELTA[f][1];
          moved = true;
        }
      }
    }
    const spots = [...turnsAt.entries()].filter(([k]) => cells.get(k)!.tile === undefined);
    if (!spots.length) return null;
    for (const [k, a] of spots.sort(() => r.next() - 0.5).slice(0, r.int(1, Math.min(2, spots.length)))) cells.get(k)!.tile = a === 'turn_right' ? 'c' : 'a';
  }

  let board = toBoard([...cells.values()]);
  let twin: OverflowEntry['twin'];
  if (kind === 'echo') {
    // Echo's half: the same walk one gap row below (or beside), but it stops partway, at Echo's
    // own exit. Echo parks there (CR-TWIN) while LoopBot walks on, so the program has to carry
    // both bots past the right tiles at the right time.
    if (board.h > 3 && board.w > 3) return null;
    const below = board.w >= board.h;
    const order = walkOrder(walk, facing);
    const cuts = order.map((p, i) => ({ p, i })).filter(({ p, i }) => i >= 3 && i < order.length - 1 && cells.get(`${p.x},${p.y}`)!.visits === 1);
    if (!cuts.length) return null;
    const cut = r.pick(cuts).i;
    const keep = new Set(order.slice(0, cut + 1).map((p) => `${p.x},${p.y}`));
    const copy = new Map<string, Cell>();
    const shift = (c: { x: number; y: number }) => (below ? { x: c.x, y: c.y + board.h + 1 } : { x: c.x + board.w + 1, y: c.y });
    for (const c of path) {
      if (!keep.has(`${c.x},${c.y}`)) continue;
      const at = shift(c);
      copy.set(`${at.x},${at.y}`, { ...c, ...at, visits: 0, tile: undefined });
    }
    const exitAt = shift(order[cut]);
    copy.get(`${exitAt.x},${exitAt.y}`)!.tile = 'e';
    addDecoys(r, copy, r.int(1, 2));
    // a decoy must not join the two halves
    const bottom = board.minY + board.h;
    const right = board.minX + board.w;
    if ([...copy.values()].some((c) => (below ? c.y <= bottom : c.x <= right))) return null;
    const all = new Map([...cells, ...copy]);
    if (copy.size + cells.size !== all.size) return null;
    const start = shift({ x: 0, y: 0 });
    board = toBoard([...all.values()]);
    twin = { x: start.x - board.minX, y: start.y - board.minY, facing };
  }
  if (board.w > MAX_SIDE + (kind === 'echo' ? 2 : 0) || board.h > MAX_SIDE + (kind === 'echo' ? 2 : 0) || (board.w < 3 && board.h < 3)) return null;

  const [minPar, maxParTier] = TIER_PAR[tier];
  const maxPar = maxParTier - (switches || kind === 'vent' ? 1 : 0);
  let entry: OverflowEntry = {
    tier,
    kind,
    tiles: board.tiles,
    heights: board.heights,
    bot: { x: -board.minX, y: -board.minY, facing },
    ...(twin ? { twin } : {}),
    goal,
    par: { commands: 99, steps: 999 },
    main: 99,
    reference: toRef(shape),
  };

  if (kind === 'vent') {
    // Vents go on walk tiles where the reference never stands as they blast, so it still clears.
    const cycle = 2;
    const tileRows = entry.tiles.map((row) => [...row]);
    const candidates = inner.map((c) => ({ x: c.x - board.minX, y: c.y - board.minY })).sort(() => r.next() - 0.5);
    let placed = 0;
    for (const p of candidates) {
      if (placed >= 3) break;
      const was = tileRows[p.y][p.x];
      if (was !== '.') continue;
      const phase = r.int(0, cycle - 1);
      tileRows[p.y][p.x] = 'vw'[phase];
      const trial = { ...entry, tiles: tileRows.map((row) => row.join('')) };
      if (clears(entry.reference, trial)) placed++;
      else tileRows[p.y][p.x] = was;
    }
    if (placed < 2) return null;
    entry = { ...entry, tiles: tileRows.map((row) => row.join('')) };
  }

  const level = asLevel(entry);
  const refOk = clears(entry.reference, entry);
  if (!refOk && kind !== 'spin' && kind !== 'ice') return null;
  const shortest = shortestActionPath(level);
  if (!shortest) return null;
  const steps = shortest.length;
  let best: string | null;
  try {
    const cap = refOk ? Math.min(countCommands(parseReference(entry.reference)), maxPar) : maxPar;
    best = smallestProgram(level, cap, 2, { budgetMs });
  } catch (err) {
    if (err instanceof SearchBudgetExceeded) return null;
    throw err;
  }
  if (!best || !best.includes('repeat')) return null;
  const program = parseReference(best);
  const commands = countCommands(program);
  if (commands < minPar || commands > steps - 3) return null;
  // the smallest program must also be the fastest, so all three stars can be earned together
  const run = new Runner(program, level).runToEnd();
  if (run.status !== 'cleared' || run.steps !== steps) return null;
  if (tier === 4 && d === 'hard' && !/repeat \d+ \{[^}]*repeat/.test(best) && (best.match(/repeat/g) ?? []).length < 2) return null;
  // a trick that isn't used isn't a trick: vent floors must time a vent, ice floors must touch ice
  if (kind === 'ice' && !touches(level, best, 'ti')) return null;
  if (kind === 'spin' && !touches(level, best, 'ca')) return null;

  return { ...entry, par: { commands, steps }, main: commands + (tier >= 3 ? 3 : 2), reference: best };
}

/** Where LoopBot stands after each move of a walk, starting at (0, 0). */
function walkOrder(walk: Action[], facing: Facing) {
  const out = [{ x: 0, y: 0 }];
  let f = facing;
  for (const a of walk) {
    if (a === 'turn_left') f = FACINGS[(FACINGS.indexOf(f) + 3) % 4];
    else if (a === 'turn_right') f = FACINGS[(FACINGS.indexOf(f) + 1) % 4];
    else if (a === 'forward' || a === 'jump') {
      const p = out[out.length - 1];
      out.push({ x: p.x + DELTA[f][0], y: p.y + DELTA[f][1] });
    }
  }
  return out;
}

/** Whether running `ref` ever puts LoopBot on one of these tile letters. */
function touches(level: LevelFile, ref: string, letters: string): boolean {
  const runner = new Runner(parseReference(ref), level);
  for (let i = 0; i < 600 && !runner.done; i++) {
    runner.step();
    const b = runner.snapshot().bot;
    if (letters.includes(level.tiles[b.y][b.x])) return true;
  }
  return false;
}
