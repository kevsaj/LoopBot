// First-run tutorial (doc: "Floor screen sketch and first-run tutorial").
// Overlays only on Floors 1 and 2; they never block a tap, and Settings can turn them off.

import type { Program } from '../sim/types';
import type { RunStatus } from '../sim/interpreter';

export type TutorialStep = 'tap' | 'run' | 'more' | 'turn';

export const TUTORIAL_TEXT: Record<TutorialStep, string> = {
  tap: 'Tap a command to add it to your program.',
  run: 'Press Run to watch LoopBot follow your program.',
  more: 'Not far enough. Add more commands and run again.',
  turn: 'Turn left and turn right spin LoopBot in place. Use them to go round corners.',
};

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
  if (s.floorId === 't1-f02') {
    const turned = s.program.main.some((b) => b.kind === 'action' && (b.action === 'turn_left' || b.action === 'turn_right'));
    if (!turned && !s.hasRun) return 'turn';
  }
  return null;
}
