// The first few minutes (Floors 1 to 5 of Tower 1): less to read and less to look at, so the
// first "it moved because I told it to" moment comes quickly.
//
// Playtest stats (Nov 2026) showed most players who quit did so on Floor 1 without ever pressing
// Run, and Floor 2's misses were turns that "didn't work". So on these floors:
// - the palette only shows the commands the floor has (no greyed-out locked ones yet),
// - a command the floor brings in for the first time wears a "New" badge,
// - a dotted path on the board previews where the program will take LoopBot (Floors 1 to 3).

import type { Facing, LevelFile, PaletteCommand, Program, World } from '../sim/types';
import { Runner } from '../sim/interpreter';

/** Tower 1's opening floors, in order. */
export const INTRO_FLOORS = ['t1-f01', 't1-f02', 't1-f03', 't1-f04', 't1-f05'];

/** Floors that show the dotted path preview: walking, turning and the first crate. */
const PREVIEW_FLOORS = new Set(['t1-f01', 't1-f02', 't1-f03']);

export function isIntroFloor(id: string): boolean {
  return INTRO_FLOORS.includes(id);
}

/** On the intro floors, drop the palette commands this floor doesn't have yet. */
export function introPalette(level: Pick<LevelFile, 'id' | 'commands'>, palette: PaletteCommand[]): PaletteCommand[] {
  if (!isIntroFloor(level.id)) return palette;
  return palette.filter((c) => (level.commands as string[]).includes(c));
}

/**
 * Commands this intro floor brings in for the first time (not on the floor before it), so the
 * palette can mark them "New". Floor 1 has nothing to compare with, so nothing is new there.
 */
export function newCommands(id: string, commandsOf: (id: string) => readonly string[] | undefined): Set<string> {
  const i = INTRO_FLOORS.indexOf(id);
  if (i <= 0) return new Set();
  const before = new Set(commandsOf(INTRO_FLOORS[i - 1]) ?? []);
  return new Set((commandsOf(id) ?? []).filter((c) => !before.has(c)));
}

export interface PathPreview {
  /** Tiles LoopBot stands on after each move, starting tile first. */
  tiles: { x: number; y: number }[];
  /** Where the program would stop with an error, if it would, and which way LoopBot faces there. */
  crashAt: { x: number; y: number; facing: Facing } | null;
  /** True when the program would clear the floor. */
  clears: boolean;
}

/**
 * Where the program would take LoopBot, for the dotted path on Floors 1 to 3. Runs the real
 * interpreter on a copy, so it always matches what Run will do. Null on other floors, or for an
 * empty program.
 */
export function pathPreview(level: LevelFile, program: Program, maxSteps = 60): PathPreview | null {
  if (!PREVIEW_FLOORS.has(level.id) || program.main.length === 0) return null;
  const r = new Runner(program, level);
  const start: World = r.snapshot();
  const tiles = [{ x: start.bot.x, y: start.bot.y }];
  for (let i = 0; i < maxSteps && !r.done; i++) {
    const ev = r.step();
    const w = r.snapshot();
    const last = tiles[tiles.length - 1];
    if (w.bot.x !== last.x || w.bot.y !== last.y) tiles.push({ x: w.bot.x, y: w.bot.y });
    if (!ev) break;
  }
  const o = r.outcome;
  let crashAt: PathPreview['crashAt'] = null;
  if (o?.status === 'crashed') {
    const w = r.snapshot();
    crashAt = { x: w.bot.x, y: w.bot.y, facing: w.bot.facing };
  }
  return { tiles, crashAt, clears: o?.status === 'cleared' };
}
