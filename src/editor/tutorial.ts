// First-run tutorial (doc: "Floor screen sketch and first-run tutorial").
// Overlays only on the first floors; they never block a tap, and Settings can turn them off.

import type { Action, Block, Program } from '../sim/types';
import type { RunStatus } from '../sim/interpreter';
import { msg, t } from '../i18n';

export type TutorialStep = 'tap' | 'run' | 'more' | 'turn' | 'spin' | 'cancel';

export const TUTORIAL_TEXT: Record<TutorialStep, string> = {
  tap: msg('Tap a command to add it to your program.'),
  run: msg('Press Run to watch LoopBot follow your program.'),
  more: msg('Not far enough. Add more commands and run again.'),
  turn: msg('↺ ↻ Turns spin LoopBot in place. Use them to go round corners.'),
  spin: msg('↻ A turn spins LoopBot in place without moving it. After it, ↑ forward goes the new way.'),
  cancel: msg('↻ then ↺ cancel out: LoopBot ends up facing the same way. Keep just one turn.'),
};

/** Turn tips (spin, cancel) show on the Lobby floors, where turning is still new. */
const TURN_TIP_FLOORS = new Set(['t1-f02', 't1-f03', 't1-f04', 't1-f05', 't1-f06', 't1-f07', 't1-f08', 't1-f09', 't1-f10']);

const isTurn = (b: Block): b is Extract<Block, { kind: 'action' }> =>
  b.kind === 'action' && (b.action === 'turn_left' || b.action === 'turn_right');

/**
 * Turns next to each other that undo each other: a left right after a right (or the other way),
 * or four turns the same way (a full circle). Returns the ids of the blocks involved, so the
 * program can mark them. Looks inside loops, ifs and every routine.
 */
export function cancellingTurns(program: Program): string[] {
  const ids = new Set<string>();
  const scan = (list: Block[]) => {
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const b = list[i + 1];
      if (b && isTurn(a) && isTurn(b) && a.action !== b.action) {
        ids.add(a.id);
        ids.add(b.id);
      }
      const four = list.slice(i, i + 4);
      if (four.length === 4 && four.every((x) => isTurn(x) && x.action === (a as { action?: string }).action)) {
        four.forEach((x) => ids.add(x.id));
      }
      if (a.kind === 'repeat' || a.kind === 'while') scan(a.body);
      if (a.kind === 'if') {
        scan(a.then);
        scan(a.else);
      }
    }
  };
  Object.values(program).forEach((list) => scan(list ?? []));
  return [...ids];
}

export function tutorialStep(s: {
  enabled: boolean;
  floorId: string;
  clearedBefore: boolean;
  program: Program;
  hasRun: boolean;
  playing: boolean;
  outcome: RunStatus | null;
}): TutorialStep | null {
  if (!s.enabled || s.clearedBefore || s.playing) return null;
  if (s.floorId === 't1-f01') {
    if (s.outcome === 'ended') return 'more';
    if (s.outcome) return null;
    if (s.program.main.length === 0) return 'tap';
    if (!s.hasRun) return 'run';
    return null;
  }
  if (!TURN_TIP_FLOORS.has(s.floorId)) return null;
  // Turns that undo each other: say so before the run, so the player never wonders why LoopBot "did not turn".
  if (cancellingTurns(s.program).length) return 'cancel';
  if (s.floorId === 't1-f02') {
    const turned = s.program.main.some(isTurn);
    if (!turned && !s.hasRun) return 'turn';
    // A run that stopped short: turning in place is the usual surprise here.
    if (s.outcome === 'ended' || s.outcome === 'crashed') return 'spin';
  }
  return null;
}

const STEP_LINE: Record<Action, string> = {
  forward: msg('> ↑ forward: one tile ahead'),
  jump: msg('> ⤴ jump'),
  turn_left: msg('> ↺ turn left: spun in place, did not move'),
  turn_right: msg('> ↻ turn right: spun in place, did not move'),
  pick_up: msg('> ▲ pick up'),
  drop: msg('> ▼ drop'),
  activate: msg('> ◉ activate'),
  wait: msg('> ‖ wait: stayed put for one step'),
};

/** The terminal line for one step of a run. */
export function stepLine(action: Action): string {
  return t(STEP_LINE[action]);
}
