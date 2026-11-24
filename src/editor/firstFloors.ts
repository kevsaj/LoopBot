// The first few minutes (Floors 1 to 5 of Tower 1): less to read and less to look at, so the
// first "it moved because I told it to" moment comes quickly.
//
// Playtest stats (Nov 2026) showed most players who quit did so on Floor 1 without ever pressing
// Run, and Floor 2's misses were turns that "didn't work". So on these floors:
// - the palette only shows the commands the floor has (no greyed-out locked ones yet),
// - a command the floor brings in for the first time wears a "New" badge,
// - a dotted path on the board previews where the program will take LoopBot (Floors 1 to 3).

import type { Action, Facing, LevelFile, PaletteCommand, Program, World } from '../sim/types';
import { Runner } from '../sim/interpreter';
import { shortestActionPath } from '../sim/solver';
import { applyAction, cloneWorld, createWorld, goalsMet } from '../sim/world';
import { makeBlock } from '../sim/program';

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

/** Failed runs in one visit before the floor offers to show the next step. */
export const STEP_HELP_AFTER = 2;

export interface NextStep {
  /** The program with the player's working start kept, anything after it dropped, and one right command added. */
  program: Program;
  /** The command that was added. */
  added: Action;
  /** How many of the player's commands were kept. */
  kept: number;
}

/**
 * "Show me the next step" on the first floors: keep as much of the player's own program as is
 * still on a shortest way to the clear, drop the rest, and add the one command that comes
 * next on the shortest way from there. Only for the intro floors, whose programs are plain lists of
 * commands. Null when there's nothing to add (the program already clears) or no way on.
 */
export function nextStep(level: LevelFile, program: Program): NextStep | null {
  if (!isIntroFloor(level.id)) return null;
  const main = program.main;
  if (main.some((b) => b.kind !== 'action')) return null;
  const actions = main.map((b) => (b as Extract<typeof b, { kind: 'action' }>).action);
  const slots = level.slots.main ?? 0;
  // Worlds after each working prefix: prefix k = the player's first k commands, run without an error.
  const worlds: World[] = [createWorld(level)];
  for (const a of actions) {
    const w = cloneWorld(worlds[worlds.length - 1]);
    if (!applyAction(w, a).ok) break;
    // The run would clear here, so there is nothing to show.
    if (goalsMet(w)) return null;
    worlds.push(w);
  }
  // Keep the player's start only while it is still on a shortest way through. A start that could
  // still finish in the slots but only by undoing itself (turn left, then turn right) is not kept,
  // so the help never teaches a wasted move.
  const best = shortestActionPath(level, 20_000)?.length ?? Infinity;
  for (let k = worlds.length - 1; k >= 0; k--) {
    const rest = shortestActionPath(level, 20_000, worlds[k]);
    if (!rest || rest.length === 0 || k + rest.length > Math.min(slots, best)) continue;
    const added = rest[0];
    return { program: { ...program, main: [...main.slice(0, k), makeBlock(added)] }, added, kept: k };
  }
  return null;
}
