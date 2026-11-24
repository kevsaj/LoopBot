import { describe, expect, it } from 'vitest';
import { warmupLevel, warmupTier } from './warmup';
import type { WarmupTier } from './warmup';
import { keyFromDay, dayNumber } from './calendar';
import { parseReference } from '../sim/program';
import { Runner } from '../sim/interpreter';
import { shortestActionPath } from '../sim/solver';

const TIERS: WarmupTier[] = ['turn', 'turns', 'jumps'];
const start = dayNumber('2026-11-24');
const year = Array.from({ length: 366 }, (_, i) => keyFromDay(start + i));

describe('warm-up puzzles', () => {
  it('picks the tier from the floors cleared', () => {
    expect(warmupTier((id) => id === 't1-f01')).toBe('turn');
    expect(warmupTier((id) => ['t1-f01', 't1-f02'].includes(id))).toBe('turns');
    expect(warmupTier((id) => ['t1-f01', 't1-f02', 't1-f03', 't1-f04'].includes(id))).toBe('jumps');
  });

  it('is the same puzzle all day, and a new one tomorrow', () => {
    expect(warmupLevel('2026-11-25', 'turn')).toEqual(warmupLevel('2026-11-25', 'turn'));
    expect(warmupLevel('2026-11-25', 'turn').tiles).not.toEqual(warmupLevel('2026-11-26', 'turn').tiles);
  });

  for (const tier of TIERS) {
    it(`${tier}: every day for a year clears at par, and par is the true shortest route`, () => {
      for (const date of year) {
        const level = warmupLevel(date, tier);
        const run = new Runner(parseReference(level.reference), level).runToEnd();
        expect(run.status, `${tier} ${date}`).toBe('cleared');
        expect(run.steps).toBe(level.par.steps);
        expect(shortestActionPath(level)?.length, `${tier} ${date}`).toBe(level.par.commands);
        // small and gentle
        expect(level.par.commands).toBeLessThanOrEqual(tier === 'turn' ? 7 : 10);
        expect(level.par.commands).toBeGreaterThanOrEqual(4);
        expect(Math.max(level.size.w, level.size.h)).toBeLessThanOrEqual(8);
        expect(level.commands).not.toContain('repeat');
        const turns = level.reference.split(' ').filter((a) => a.startsWith('turn')).length;
        if (tier === 'turn') expect(turns).toBe(1);
        if (tier === 'jumps') expect(level.reference).toContain('jump');
        else expect(level.reference).not.toContain('jump');
      }
    });
  }
});
