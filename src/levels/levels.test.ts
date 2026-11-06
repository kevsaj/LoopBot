import { describe, expect, it } from 'vitest';
import { LEVELS } from './index';
import { validateLevel } from './validate';
import { Runner } from '../sim/interpreter';
import { countCommands, parseReference } from '../sim/program';
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
    expect(countCommands(program)).toBeLessThanOrEqual(level.slots.main!);
  });

  it('LV-3: the step par is the true minimum', () => {
    const path = shortestActionPath(level);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(level.par.steps);
  });

  it('LV-4: the command par is the true minimum, loops included', () => {
    expect(smallestProgram(level, level.par.commands - 1)).toBeNull();
  });

  it('the solution hint, if any, clears the floor', () => {
    if (level.hints.length < 3) return;
    const program = parseReference(level.hints[2].replace(/,/g, ' '));
    expect(new Runner(program, level).runToEnd().status).toBe('cleared');
  });
});
