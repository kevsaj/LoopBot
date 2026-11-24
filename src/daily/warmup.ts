// The warm-up: a small, gentle puzzle a day for players who haven't reached the daily challenge yet
// (it opens after Floor 11). Many players clear Floor 1, maybe stall on Floor 2, and never come back.
// From their second day on, the title screen and tower map offer a quick puzzle that only uses the
// blocks they already know, and the first clear each day pays a hint for the tower.
//
// The puzzle is made on the phone from the date, so it needs no bank: a short walk is laid over
// empty sky as a corridor that never touches itself, with a few dead-end tiles beside it. A corridor
// has exactly one route, and with no loops before Floor 11 the shortest program is that route, so
// par is simply the walk. Tests check every day of the year against the real solver.

import type { Action, Facing, LevelFile } from '../sim/types';
import { dayNumber } from './calendar';
import { lang, msg, t, tn } from '../i18n';

/** What the warm-up asks for, by how far up the tower the player is. */
export type WarmupTier = 'turn' | 'turns' | 'jumps';

/** turn: one corner (Floor 2's lesson). turns: two or three corners. jumps: steps up and down too (Floor 4 on). */
export function warmupTier(cleared: (id: string) => boolean): WarmupTier {
  if (cleared('t1-f04')) return 'jumps';
  if (cleared('t1-f02')) return 'turns';
  return 'turn';
}

export const warmupId = (date: string) => `daily-warmup-${date}`;
export const isWarmupId = (id: string) => id.startsWith('daily-warmup-');

/** mulberry32 again (generate.ts has the same one, but the game doesn't ship that file). */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)), pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)] };
}

const FACINGS: Facing[] = ['north', 'east', 'south', 'west'];
const DELTA: Record<Facing, [number, number]> = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
const LEFT: Record<Facing, Facing> = { north: 'west', west: 'south', south: 'east', east: 'north' };
const RIGHT: Record<Facing, Facing> = { north: 'east', east: 'south', south: 'west', west: 'north' };

// The daily's word list (so the names translate the same way, see localFloor dailyTitle).
const NAMES_A = ['Glass', 'Copper', 'Sky', 'Amber', 'Quiet', 'Swift', 'Velvet', 'Cobalt'];
const NAMES_B = ['Walk', 'Ledge', 'Bridge', 'Catwalk', 'Terrace', 'Track', 'Steps', 'Ramp'];
const BANDS = ['lobby', 'lobby', 'maintenance', 'rooftop'];

/** Corners, tiles per straight, jumps, and the most blocks a warm-up may take (Floor 2 takes 5). */
const SHAPE: Record<WarmupTier, { turns: [number, number]; legs: [number, number]; jumps: number; max: number }> = {
  turn: { turns: [1, 1], legs: [2, 3], jumps: 0, max: 7 },
  turns: { turns: [2, 3], legs: [1, 3], jumps: 0, max: 9 },
  jumps: { turns: [1, 2], legs: [2, 3], jumps: 2, max: 10 },
};

interface Cell {
  x: number;
  y: number;
  h: number;
}

/** One try at a walk. Null when it would touch itself (then the next seed is tried). */
function tryWalk(seed: number, tier: WarmupTier) {
  const r = rng(seed);
  const s = SHAPE[tier];
  const turns = r.int(s.turns[0], s.turns[1]);
  const start: Facing = r.pick(FACINGS);
  // Sometimes the bot starts side-on, so the very first block is a turn.
  const sideOn = turns > 1 && r.next() < 0.3;
  const actions: Action[] = [];
  let f = start;
  const path: Cell[] = [{ x: 0, y: 0, h: 0 }];
  const key = (x: number, y: number) => `${x},${y}`;
  const taken = new Set([key(0, 0)]);
  const turn = () => {
    const left = r.next() < 0.5;
    actions.push(left ? 'turn_left' : 'turn_right');
    f = left ? LEFT[f] : RIGHT[f];
  };
  let jumpsLeft = s.jumps;
  const legs = turns + (sideOn ? 0 : 1);
  if (sideOn) turn();
  for (let leg = 0; leg < legs; leg++) {
    if (leg > 0) turn();
    const len = r.int(s.legs[0], s.legs[1]);
    for (let i = 0; i < len; i++) {
      const here = path[path.length - 1];
      const [dx, dy] = DELTA[f];
      const nx = here.x + dx;
      const ny = here.y + dy;
      if (taken.has(key(nx, ny))) return null;
      // A corridor: the new tile may only touch the tile it came from.
      for (const [ax, ay] of Object.values(DELTA)) {
        const k = key(nx + ax, ny + ay);
        if (k !== key(here.x, here.y) && taken.has(k)) return null;
      }
      let h = here.h;
      let a: Action = 'forward';
      if (jumpsLeft > 0 && i > 0 && r.next() < 0.45) {
        h = here.h === 0 ? 1 : here.h >= 2 ? here.h - 1 : r.next() < 0.5 ? 2 : 0;
        a = 'jump';
        jumpsLeft--;
      }
      actions.push(a);
      path.push({ x: nx, y: ny, h });
      taken.add(key(nx, ny));
    }
  }
  if (actions.length > s.max || actions.length < 4) return null;
  if (tier === 'jumps' && !actions.includes('jump')) return null;
  return { r, actions, path, start, taken };
}

/** The warm-up floor for a date and tier. Everyone on the same step gets the same one that day. */
export function warmupLevel(date: string, tier: WarmupTier): LevelFile {
  const day = dayNumber(date);
  const tierSeed = { turn: 11, turns: 23, jumps: 37 }[tier];
  let walk: NonNullable<ReturnType<typeof tryWalk>> | null = null;
  for (let i = 0; !walk; i++) walk = tryWalk(day * 997 + tierSeed * 7919 + i * 104729, tier);
  const { r, actions, path, start, taken } = walk;

  // A couple of dead ends beside the path, so the route isn't simply "every tile". Each one touches
  // a single path tile and nothing else, so it can never make a shortcut.
  const cells: Cell[] = [...path];
  const decoys = r.int(1, 2);
  for (let tries = 0, made = 0; made < decoys && tries < 20; tries++) {
    const c = path[r.int(0, path.length - 2)];
    const [dx, dy] = DELTA[r.pick(FACINGS)];
    const nx = c.x + dx;
    const ny = c.y + dy;
    const k = `${nx},${ny}`;
    if (taken.has(k)) continue;
    const touches = Object.values(DELTA).filter(([ax, ay]) => taken.has(`${nx + ax},${ny + ay}`)).length;
    if (touches !== 1) continue;
    // A dead end sits a level above or below, or on the same level for the flat tiers.
    cells.push({ x: nx, y: ny, h: tier === 'jumps' ? Math.min(3, c.h + 1) : 0 });
    taken.add(k);
    made++;
  }

  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const w = Math.max(...cells.map((c) => c.x)) - minX + 1;
  const h = Math.max(...cells.map((c) => c.y)) - minY + 1;
  const tiles = Array.from({ length: h }, () => Array<string>(w).fill('_'));
  const heights = Array.from({ length: h }, () => Array<string>(w).fill('0'));
  for (const c of cells) {
    tiles[c.y - minY][c.x - minX] = '.';
    heights[c.y - minY][c.x - minX] = String(c.h);
  }
  const end = path[path.length - 1];
  tiles[end.y - minY][end.x - minX] = 'e';
  const flat = heights.every((row) => row.every((v) => v === '0'));
  const commands: LevelFile['commands'] = tier === 'jumps' ? ['forward', 'turn_left', 'turn_right', 'jump'] : ['forward', 'turn_left', 'turn_right'];
  const n = actions.length;
  const corners = actions.filter((a) => a === 'turn_left' || a === 'turn_right').length;
  const jumps = actions.filter((a) => a === 'jump').length;
  const first =
    tier === 'jumps'
      ? t('Forward walks on level ground. Where the floor steps up or down, use jump.')
      : t('Turns spin LoopBot on the spot. Walk to the corner, turn, then keep walking.');
  const structure =
    jumps > 0
      ? `${tn(n, 'Par is {n} command.', 'Par is {n} commands.')} ${tn(corners, 'There is {n} turn.', 'There are {n} turns.')} ${tn(jumps, 'Watch for {n} jump.', 'Watch for {n} jumps.')}`
      : `${tn(n, 'Par is {n} command.', 'Par is {n} commands.')} ${tn(corners, 'There is {n} turn.', 'There are {n} turns.')}`;
  return {
    id: warmupId(date),
    title: `${r.pick(NAMES_A)} ${r.pick(NAMES_B)}`,
    band: r.pick(BANDS),
    size: { w, h },
    tiles: tiles.map((row) => row.join('')),
    heights: flat ? null : heights.map((row) => row.join('')),
    boxes: [],
    targets: [],
    bot: { x: -minX, y: -minY, facing: start },
    goals: ['bot_on_exit'],
    commands,
    slots: { main: n + 3 },
    par: { commands: n, steps: n },
    reference: actions.join(' '),
    hints: [first, structure, actions.join(' ')],
    story: { intro: lang() === 'fr' ? `PATCH : « ${t(INTRO)} »` : `PATCH: "${t(INTRO)}"`, outro: null },
  };
}

const INTRO = msg("Quick warm-up before the climb. Clear it and I'll send you a hint for the tower.");
