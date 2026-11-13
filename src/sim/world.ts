import type { Action, Colour, Condition, Facing, LevelFile, Pos, Tile, TileType, World } from './types';

const TILE_CHARS: Record<string, { type: TileType; colour?: Colour; phase?: number }> = {
  '.': { type: 'floor' },
  '#': { type: 'wall' },
  _: { type: 'gap' },
  s: { type: 'switch' },
  d: { type: 'door' },
  e: { type: 'exit' },
  r: { type: 'floor', colour: 'r' },
  g: { type: 'floor', colour: 'g' },
  b: { type: 'floor', colour: 'b' },
  y: { type: 'floor', colour: 'y' },
  i: { type: 'ice' },
  t: { type: 'thin' },
  v: { type: 'vent', phase: 0 },
  w: { type: 'vent', phase: 1 },
  x: { type: 'vent', phase: 2 },
  z: { type: 'vent', phase: 3 },
};

/** Vent cycle when a floor doesn't set one: blast, rest, blast, rest. */
export const DEFAULT_VENT_CYCLE = 2;

export const MAX_STACK = 3;

const key = (x: number, y: number) => `${x},${y}`;

export function createWorld(level: LevelFile): World {
  const { w, h } = level.size;
  const tiles: Tile[][] = [];
  const switches: Record<string, boolean> = {};
  const doors: Record<string, boolean> = {};
  const cracked: Record<string, boolean> = {};
  let vents = false;
  for (let y = 0; y < h; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < w; x++) {
      const ch = level.tiles[y]?.[x] ?? '#';
      const def = TILE_CHARS[ch];
      if (!def) throw new Error(`${level.id}: unknown tile '${ch}' at ${x},${y}`);
      const hch = level.heights?.[y]?.[x] ?? '0';
      const height = Number(hch);
      row.push({ type: def.type, height, ...(def.colour ? { colour: def.colour } : {}), ...(def.phase !== undefined ? { phase: def.phase } : {}) });
      if (def.type === 'vent') vents = true;
      if (def.type === 'switch') switches[key(x, y)] = false;
      if (def.type === 'door') doors[key(x, y)] = false;
      if (def.type === 'thin') cracked[key(x, y)] = false;
    }
    tiles.push(row);
  }
  const boxes = Array.from({ length: h }, () => Array<number>(w).fill(0));
  for (const b of level.boxes) boxes[b.y][b.x] += b.count;

  const allDoors: Pos[] = Object.keys(doors).map((k) => {
    const [x, y] = k.split(',').map(Number);
    return { x, y };
  });
  const links =
    level.links ??
    Object.keys(switches).map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { switch: { x, y }, doors: allDoors };
    });

  return {
    w,
    h,
    tiles,
    boxes,
    targets: level.targets.map((t) => ({ ...t })),
    switches,
    doors,
    links,
    cracked,
    clock: 0,
    ventCycle: vents ? (level.ventCycle ?? DEFAULT_VENT_CYCLE) : 0,
    bot: { x: level.bot.x, y: level.bot.y, facing: level.bot.facing, carrying: false },
    goals: [...level.goals],
  };
}

export function cloneWorld(w: World): World {
  return {
    ...w,
    tiles: w.tiles, // tiles never change during a run
    boxes: w.boxes.map((r) => [...r]),
    targets: w.targets,
    switches: { ...w.switches },
    doors: { ...w.doors },
    links: w.links,
    cracked: { ...w.cracked },
    bot: { ...w.bot },
    goals: w.goals,
  };
}

const DELTA: Record<Facing, Pos> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};
const LEFT: Record<Facing, Facing> = { north: 'west', west: 'south', south: 'east', east: 'north' };
const RIGHT: Record<Facing, Facing> = { north: 'east', east: 'south', south: 'west', west: 'north' };

export function ahead(w: World): Pos {
  const d = DELTA[w.bot.facing];
  return { x: w.bot.x + d.x, y: w.bot.y + d.y };
}

function inBounds(w: World, p: Pos) {
  return p.x >= 0 && p.y >= 0 && p.x < w.w && p.y < w.h;
}

/** Can a bot stand on (or a box be placed on) this tile? Walls, gaps and closed doors: no. */
export function isWalkable(w: World, p: Pos): boolean {
  if (!inBounds(w, p)) return false;
  const t = w.tiles[p.y][p.x];
  if (t.type === 'wall' || t.type === 'gap') return false;
  if (t.type === 'door' && !w.doors[key(p.x, p.y)]) return false;
  if (t.type === 'thin' && w.cracked[key(p.x, p.y)]) return false;
  return true;
}

/** Tile height plus the boxes stacked on it (CR-2). */
export function surfaceHeight(w: World, p: Pos): number {
  return w.tiles[p.y][p.x].height + w.boxes[p.y][p.x];
}

/**
 * Ice (CR-ICE): a bot that arrives on ice keeps going the way it faces, one tile at a time, while
 * the tile ahead is walkable at the same height. It stops on the first tile that isn't ice, or on
 * the ice against whatever blocks it (a wall, a closed door, a crate, a step, or the edge of a
 * gap: LoopBot never slides off the board). The whole slide is part of the same step.
 */
function slide(w: World) {
  const bot = w.bot;
  for (let guard = 0; guard < w.w * w.h && w.tiles[bot.y][bot.x].type === 'ice'; guard++) {
    const here = { x: bot.x, y: bot.y };
    const next = ahead(w);
    if (!isWalkable(w, next) || surfaceHeight(w, next) !== surfaceHeight(w, here)) return;
    bot.x = next.x;
    bot.y = next.y;
  }
}

/** Thin ice (CR-THIN) cracks into a gap once LoopBot steps off it. */
function leave(w: World, p: Pos) {
  if (w.tiles[p.y][p.x].type === 'thin') w.cracked[key(p.x, p.y)] = true;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Heat vents (CR-VENT): is the vent at p blasting at this clock? A vent with a crate on it is
 * plugged and never blasts. Anything that isn't a vent never does either.
 */
export function ventBlasting(w: World, p: Pos, clock = w.clock): boolean {
  const t = w.tiles[p.y]?.[p.x];
  if (!t || t.type !== 'vent' || !w.ventCycle || w.boxes[p.y][p.x] > 0) return false;
  return clock % w.ventCycle === t.phase;
}

/**
 * Applies one action in place (CR table). Every action costs 1 step, success or not.
 * After the step the clock ticks; if LoopBot ends it on a blasting vent, the step fails.
 */
export function applyAction(w: World, action: Action): ActionResult {
  const res = act(w, action);
  if (!res.ok) return res;
  w.clock++;
  if (ventBlasting(w, w.bot)) return { ok: false, error: 'ERR: scorched by a vent' };
  return res;
}

function act(w: World, action: Action): ActionResult {
  const bot = w.bot;
  const here = { x: bot.x, y: bot.y };
  const next = ahead(w);
  switch (action) {
    case 'turn_left':
      bot.facing = LEFT[bot.facing];
      return { ok: true };
    case 'turn_right':
      bot.facing = RIGHT[bot.facing];
      return { ok: true };
    case 'wait':
      return { ok: true };
    case 'forward': {
      if (!isWalkable(w, next) || surfaceHeight(w, next) !== surfaceHeight(w, here)) {
        return { ok: false, error: 'ERR: blocked ahead' };
      }
      leave(w, here);
      bot.x = next.x;
      bot.y = next.y;
      slide(w);
      return { ok: true };
    }
    case 'jump': {
      if (!isWalkable(w, next)) return { ok: false, error: 'ERR: blocked ahead' };
      const diff = surfaceHeight(w, next) - surfaceHeight(w, here);
      if (diff > 1) return { ok: false, error: 'ERR: too high to jump' };
      // CR table: a jump needs a step exactly 1 up, or any drop down. Level ground is for forward.
      if (diff === 0) return { ok: false, error: 'ERR: nothing to jump, use forward' };
      leave(w, here);
      bot.x = next.x;
      bot.y = next.y;
      slide(w);
      return { ok: true };
    }
    case 'pick_up': {
      if (bot.carrying || !inBounds(w, next) || w.boxes[next.y][next.x] === 0) {
        return { ok: false, error: 'ERR: nothing to pick up' };
      }
      w.boxes[next.y][next.x] -= 1;
      bot.carrying = true;
      return { ok: true };
    }
    case 'drop': {
      if (!bot.carrying || !isWalkable(w, next) || w.boxes[next.y][next.x] >= MAX_STACK) {
        return { ok: false, error: "ERR: can't drop here" };
      }
      w.boxes[next.y][next.x] += 1;
      bot.carrying = false;
      return { ok: true };
    }
    case 'activate': {
      const k = key(bot.x, bot.y);
      if (w.tiles[bot.y][bot.x].type !== 'switch') return { ok: false, error: 'ERR: no switch here' };
      w.switches[k] = !w.switches[k];
      for (const link of w.links) {
        if (link.switch.x === bot.x && link.switch.y === bot.y) {
          for (const d of link.doors) {
            const dk = key(d.x, d.y);
            w.doors[dk] = !w.doors[dk];
          }
        }
      }
      return { ok: true };
    }
  }
}

/** Sensors for if / while (CR-5). They cost no steps. */
export function sense(w: World, cond: Condition): boolean {
  const next = ahead(w);
  let v: boolean;
  switch (cond.sensor) {
    case 'wall_ahead':
      v = !isWalkable(w, next);
      break;
    case 'box_ahead':
      v = inBounds(w, next) && w.boxes[next.y][next.x] > 0;
      break;
    case 'carrying':
      v = w.bot.carrying;
      break;
    case 'on_target':
      v = w.targets.some((t) => t.x === w.bot.x && t.y === w.bot.y);
      break;
    case 'on_switch':
      v = w.tiles[w.bot.y][w.bot.x].type === 'switch';
      break;
    case 'tile_is':
      v = cond.colour !== undefined && w.tiles[w.bot.y][w.bot.x].colour === cond.colour;
      break;
    case 'heat_ahead':
      // stepping onto it now would land as it blasts
      v = inBounds(w, next) && ventBlasting(w, next, w.clock + 1);
      break;
  }
  return cond.not ? !v : v;
}

/** CR-10: a floor is cleared the moment every goal holds. */
export function goalsMet(w: World): boolean {
  return w.goals.every((g) => {
    switch (g) {
      case 'all_targets_filled':
        return w.targets.every((t) => w.boxes[t.y][t.x] >= t.count);
      case 'bot_on_exit':
        return w.tiles[w.bot.y][w.bot.x].type === 'exit';
      case 'all_switches_on':
        return Object.values(w.switches).every(Boolean);
    }
  });
}

/** A compact, stable string for a world state (used by the solver). */
export function worldKey(w: World): string {
  const b = w.bot;
  return `${b.x},${b.y},${b.facing},${b.carrying ? 1 : 0}|${w.boxes.map((r) => r.join('')).join('/')}|${Object.values(w.switches)
    .map((s) => (s ? 1 : 0))
    .join('')}|${Object.values(w.doors)
    .map((s) => (s ? 1 : 0))
    .join('')}|${Object.values(w.cracked)
    .map((s) => (s ? 1 : 0))
    .join('')}${w.ventCycle ? `|${w.clock % w.ventCycle}` : ''}`;
}
