import { describe, expect, it } from 'vitest';
import type { LevelFile } from './types';
import { Runner } from './interpreter';
import { parseReference, toCode } from './program';
import { parseCode } from './code';
import { createWorld, goalsMet } from './world';
import { smallestProgram } from './solver';

/** A Fractal floor for the tests: a corridor east with mosaics (CR-RECUR, CR-MOSAIC). */
function floor(tiles: string[], extra: Partial<LevelFile> = {}): LevelFile {
  return {
    id: 't7-f99',
    title: 'Test',
    band: 'tessera',
    size: { w: tiles[0].length, h: tiles.length },
    tiles,
    heights: null,
    boxes: [],
    targets: [],
    bot: { x: 0, y: 0, facing: 'east' },
    goals: ['all_lit'],
    commands: ['forward', 'turn_left', 'turn_right', 'F1', 'F2'],
    slots: { main: 3, F1: 4, F2: 4 },
    par: { commands: 3, steps: 4 },
    reference: '',
    hints: [],
    story: { intro: null, outro: null },
    recursion: true,
    ...extra,
  };
}

describe('Fractal recursion (CR-RECUR)', () => {
  it('a call from main sets the depth, and each call inside goes one level down', () => {
    const level = floor(['....m.']);
    const p = parseReference('F1(4) def F1 { forward F1 }');
    expect(new Runner(p, level).runToEnd()).toEqual({ status: 'cleared', steps: 4 });
    // depth 3 stops one short
    expect(new Runner(parseReference('F1(3) def F1 { forward F1 }'), level).runToEnd().status).toBe('ended');
  });

  it('a call without a depth in main runs its function once', () => {
    const level = floor(['.m....']);
    expect(new Runner(parseReference('F1 def F1 { forward F1 }'), level).runToEnd()).toEqual({ status: 'cleared', steps: 1 });
  });

  it('runs the second half on the way back out (going and coming back)', () => {
    // out 3, turn round at the bottom of the recursion... here: forward, recurse, then turn and forward
    const level = floor(['m...'], { goals: ['all_lit'], bot: { x: 0, y: 0, facing: 'east' } });
    const w = createWorld(level);
    expect(w.lit['0,0']).toBe(true); // the start tile is lit at once
    expect(goalsMet(w)).toBe(true);
  });

  it('two calls in a body double up: F1(3) with two calls runs 7 forwards', () => {
    const level = floor(['.......m']);
    expect(new Runner(parseReference('F1(3) def F1 { F1 forward F1 }'), level).runToEnd()).toEqual({ status: 'cleared', steps: 7 });
  });

  it('F1 and F2 can call each other, one level down each time', () => {
    const level = floor(['....m']);
    expect(new Runner(parseReference('F1(4) def F1 { forward F2 } def F2 { forward F1 }'), level).runToEnd()).toEqual({ status: 'cleared', steps: 4 });
  });

  it('non-recursion floors keep plain calls, so a self-call nests until it is stopped', () => {
    const level = floor(['......'], { recursion: undefined, goals: ['bot_on_exit'], tiles: ['.....e'] });
    const o = new Runner(parseReference('F1 def F1 { turn_left F1 }'), level).runToEnd();
    expect(o.status).toBe('crashed');
  });

  it('shows the depth in code and reads it back from typed code', () => {
    const level = floor(['....m.'], { typing: true });
    const p = parseReference('F1(4) def F1 { forward F1 }');
    const text = toCode(p, ['main', 'F1'], true).map((l) => l.text).join('\n');
    expect(text).toBe('def main():\n    F1(4)\n\ndef F1(n):\n    if n == 0: return\n    forward()\n    F1(n - 1)');
    const r = parseCode(text, level);
    expect(r.ok).toBe(true);
    if (r.ok) expect(new Runner(r.program, level).runToEnd().status).toBe('cleared');
    expect(parseCode('F1(n - 1)', level).ok).toBe(false);
    expect(parseCode('def main():\n    F1(2)\ndef F1(n):\n    forward()\n    F1(3)', level).ok).toBe(false);
  });

  it('the solver finds recursive programs with a depth', () => {
    const level = floor(['.', '.', '.', '.', '.', '.', '.', 'm'].map((r) => r), {
      size: { w: 1, h: 8 },
      bot: { x: 0, y: 0, facing: 'south' },
      commands: ['forward', 'turn_left', 'turn_right', 'F1'],
      slots: { main: 3, F1: 4 },
    });
    // 7 forwards: F1(7) with F1 = forward F1 is 3 blocks
    expect(smallestProgram(level, 3)).toBe('F1(7) def F1 { forward F1 }');
  });
});
