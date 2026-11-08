// A daily puzzle as stored in the bank, and how it becomes a floor the game can play.
// Kept apart from the generator so the game never ships the solver code it doesn't need.

import type { Facing, LevelFile } from '../sim/types';
import { parseReference } from '../sim/program';

export type Difficulty = 'easy' | 'medium' | 'hard';

/** A compact daily puzzle, as stored in the bank. `expandDaily` turns it into a full floor. */
export interface DailyEntry {
  /** Difficulty, by the weekday it plays on. */
  d: Difficulty;
  title: string;
  band: string;
  tiles: string[];
  heights: string[] | null;
  bot: { x: number; y: number; facing: Facing };
  goal: 'exit' | 'switches';
  par: { commands: number; steps: number };
  main: number;
  reference: string;
}

/** Floors 11-20 commands: everything the player has by the time loops arrive. */
export const DAILY_COMMANDS: LevelFile['commands'] = ['forward', 'turn_left', 'turn_right', 'jump', 'pick_up', 'drop', 'activate', 'repeat'];

/** Expands a bank entry into a floor the game can play. */
export function expandDaily(e: DailyEntry, id: string): LevelFile {
  const program = parseReference(e.reference);
  const loops = program.main.filter((b) => b.kind === 'repeat').length;
  const structure =
    e.goal === 'switches'
      ? `Par is ${e.par.commands} commands. Find the stretch of path between two switches and loop it.`
      : `Par is ${e.par.commands} commands. ${loops > 1 ? 'There is more than one pattern here.' : 'One repeat block can carry most of the walk.'}`;
  return {
    id,
    title: e.title,
    band: e.band,
    size: { w: e.tiles[0].length, h: e.tiles.length },
    tiles: e.tiles,
    heights: e.heights,
    boxes: [],
    targets: [],
    bot: e.bot,
    goals: [e.goal === 'exit' ? 'bot_on_exit' : 'all_switches_on'],
    commands: DAILY_COMMANDS,
    slots: { main: e.main },
    par: e.par,
    reference: e.reference,
    hints: [
      e.goal === 'switches'
        ? 'Every switch has to end up on. Watch how the path between them repeats.'
        : 'Trace the path to the exit with your finger. Where does it start repeating itself?',
      structure,
      e.reference,
    ],
    story: { intro: null, outro: null },
  };
}

