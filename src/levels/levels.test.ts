import { describe, expect, it } from 'vitest';
import { LEVELS } from './index';
import { FROSTLINE } from './frostline';
import { HEATWAVE } from './heatwave';
import { TWIST } from './twist';
import { DOCKYARD } from './dockyard';
import { TWINSPIRES } from './twinspires';
import { FRACTAL } from './fractal';
import { validateLevel } from './validate';
import { Runner } from '../sim/interpreter';
import { countBlocks, countCommands, parseReference } from '../sim/program';
import { shortestActionPath, shortestTwinSteps, smallestProgram } from '../sim/solver';

describe.each([...LEVELS, ...FROSTLINE, ...HEATWAVE, ...TWIST, ...DOCKYARD, ...TWINSPIRES, ...FRACTAL].map((l) => [l.id, l] as const))('floor %s', (_id, level) => {
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
    // Twin Spires with if and while: each bot runs its own copy, so they can act differently in
    // one step. The par is the reference's steps, and no pair of action sequences may beat it.
    if (level.twin && (level.commands.includes('if') || level.commands.includes('while'))) {
      expect(shortestTwinSteps(level)).toBe(level.par.steps);
      return;
    }
    const path = shortestActionPath(level);
    expect(path).not.toBeNull();
    // Fractal (CR-RECUR): a recursive program walks the whole pattern, the way the floor teaches,
    // so the step par is the reference's own steps. A hand-picked path may cut corners, so it can
    // only be shorter or the same, never longer.
    if (level.recursion) {
      expect(new Runner(parseReference(level.reference), level).runToEnd().steps).toBe(level.par.steps);
      expect(path!.length).toBeLessThanOrEqual(level.par.steps);
      return;
    }
    expect(path!.length).toBe(level.par.steps);
  });

  // With functions the full search grows too fast to run on every test pass. Workshop floors are
  // checked against every shorter program that fits the slots using loops and F1, with loop bodies
  // up to 2 blocks and function bodies up to 3. Earlier floors get the full search. Control Room
  // floors (if and while) are searched without sensors, with loop bodies up to 3: no shorter
  // sensor-free program should reach the par. Dockyard floors with the tally get the full search
  // up to a par of 8; past that it takes minutes, so those few use the Control Room bounds too.
  // Fractal floors (CR-RECUR) are searched with recursive F1 bodies and every depth from main.
  const sensors = level.commands.includes('if') || level.commands.includes('while');
  const big = level.commands.includes('repeat_tally') && level.par.commands >= 9;
  const bounded = sensors || level.commands.includes('F1') || big;
  it(
    bounded ? 'LV-4: no shorter program with loops and F1 (small bodies)' : 'LV-4: the command par is the true minimum, loops included',
    () => {
      const searched = bounded ? { ...level, commands: level.commands.filter((c) => c !== 'F2') } : level;
      // Fractal floors with sensors: recursion makes every depth a choice, so those few are
      // searched up to 8 blocks with the Workshop bounds; the sensor program is far longer anyway.
      if (level.recursion && sensors) {
        expect(smallestProgram(searched, Math.min(8, level.par.commands - 1), 2, { loopBody: 2, fnBody: 3 })).toBeNull();
        return;
      }
      expect(smallestProgram(searched, level.par.commands - 1, 2, sensors || big ? { loopBody: 3, fnBody: 3 } : bounded ? { loopBody: 2, fnBody: 3 } : {})).toBeNull();
    },
    120_000,
  );

  it('a bug hunt starter program does not clear the floor yet', () => {
    if (level.starter === undefined) return;
    expect(new Runner(parseReference(level.starter), level).runToEnd().status).not.toBe('cleared');
  });

  it('the solution hint, if any, clears the floor', () => {
    if (level.hints.length < 3) return;
    const program = parseReference(level.hints[2].replace(/,/g, ' '));
    expect(new Runner(program, level).runToEnd().status).toBe('cleared');
  });
});
