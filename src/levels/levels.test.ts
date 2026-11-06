import { describe, expect, it } from 'vitest';
import { LEVELS } from './index';
import { validateLevel } from './validate';
import { Runner } from '../sim/interpreter';
import { countBlocks, countCommands, parseReference } from '../sim/program';
import { shortestActionPath, smallestProgram } from '../sim/solver';

describe.each(LEVELS.map((l) => [l.id, l] as const))('floor %s', (_id, level) => {
  it('LV-1: matches the floor format', () => {
    expect(validateLevel(level)).toEqual([]);
  });

  it('LV-2: the reference clears the floor within both pars', () => {
    const program = parseReference(level.reference);
    const outcome = new Runner(program, level).runToEnd();
    expect(outcome.status).toBe('cleared');
    expect(countCommands(program)).toBeLessThanOrEqual(level.par.commands);
    expect(outcome.steps).toBeLessThanOrEqual(level.par.steps);
    for (const r of ['main', 'F1', 'F2', 'F3'] as const) expect(countBlocks(program[r])).toBeLessThanOrEqual(level.slots[r] ?? 0);
  });

  it('LV-3: the step par is the true minimum', () => {
    const path = shortestActionPath(level);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(level.par.steps);
  });

  // With functions the full search grows too fast to run on every test pass. Workshop floors are
  // checked against every shorter program that fits the slots using loops and F1, with loop bodies
  // up to 2 blocks and function bodies up to 3. Earlier floors get the full search. Control Room
  // floors (if and while) are searched without sensors, with loop bodies up to 3: no shorter
  // sensor-free program should reach the par.
  const sensors = level.commands.includes('if') || level.commands.includes('while');
  const bounded = sensors || level.commands.includes('F1');
  it(
    bounded ? 'LV-4: no shorter program with loops and F1 (small bodies)' : 'LV-4: the command par is the true minimum, loops included',
    () => {
      const searched = bounded ? { ...level, commands: level.commands.filter((c) => c !== 'F2') } : level;
      expect(smallestProgram(searched, level.par.commands - 1, 2, sensors ? { loopBody: 3, fnBody: 3 } : bounded ? { loopBody: 2, fnBody: 3 } : {})).toBeNull();
    },
    60_000,
  );

  it('the solution hint, if any, clears the floor', () => {
    if (level.hints.length < 3) return;
    const program = parseReference(level.hints[2].replace(/,/g, ' '));
    expect(new Runner(program, level).runToEnd().status).toBe('cleared');
  });
});
