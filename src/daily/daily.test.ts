import { describe, expect, it } from 'vitest';
import bank from './bank.json';
import type { DailyEntry } from './entry';
import { expandDaily } from './entry';
import { BANK_DAYS, bankIndex, dateKey, dayNumber, difficultyFor, keyFromDay, weekday } from './calendar';
import { currentStreak, recordDailyClear } from './index';
import type { DailyState } from './index';
import { validateLevel } from '../levels/validate';
import { Runner } from '../sim/interpreter';
import { countCommands, parseReference } from '../sim/program';
import { shortestActionPath, smallestProgram } from '../sim/solver';

const entries = bank as unknown as DailyEntry[];

describe('daily calendar', () => {
  it('reads dates in local time and counts days without time zones', () => {
    expect(dateKey(new Date(2026, 10, 8, 23, 59))).toBe('2026-11-08');
    expect(dayNumber('1970-01-02')).toBe(1);
    expect(keyFromDay(dayNumber('2026-11-08'))).toBe('2026-11-08');
    expect(weekday(dayNumber('2026-11-08'))).toBe(0); // a Sunday
  });

  it('gives every day of the year its own puzzle, then starts over', () => {
    const start = dayNumber('2026-11-08');
    const seen = new Set<number>();
    for (let d = start; d < start + BANK_DAYS; d++) seen.add(bankIndex(keyFromDay(d)));
    expect(seen.size).toBe(BANK_DAYS);
    expect(bankIndex(keyFromDay(start + BANK_DAYS))).toBe(bankIndex(keyFromDay(start)));
  });

  it('matches each puzzle to its weekday difficulty', () => {
    expect(entries.length).toBe(BANK_DAYS);
    entries.forEach((e, i) => expect(e.d).toBe(difficultyFor(i)));
    expect(difficultyFor(dayNumber('2026-11-09'))).toBe('easy'); // Monday
    expect(difficultyFor(dayNumber('2026-11-14'))).toBe('hard'); // Saturday
  });
});

describe('daily streak', () => {
  const none: DailyState = { best: {}, streak: 0, longest: 0, last: null };

  it('counts days in a row and resets after a missed day', () => {
    let s = recordDailyClear(none, '2026-11-08', 2);
    s = recordDailyClear(s, '2026-11-09', 3);
    expect(s.streak).toBe(2);
    s = recordDailyClear(s, '2026-11-09', 1); // replaying the same day changes nothing
    expect(s.streak).toBe(2);
    expect(s.best['2026-11-09']).toBe(3);
    expect(currentStreak(s, '2026-11-10')).toBe(2); // still alive the next day
    expect(currentStreak(s, '2026-11-11')).toBe(0); // gone after a missed day
    s = recordDailyClear(s, '2026-11-11', 1);
    expect(s.streak).toBe(1);
    expect(s.longest).toBe(2);
  });

  it('crosses month and year ends', () => {
    let s = recordDailyClear(none, '2026-12-31', 1);
    s = recordDailyClear(s, '2027-01-01', 1);
    expect(s.streak).toBe(2);
  });

  it('forgets results older than 60 days', () => {
    let s = recordDailyClear(none, '2026-01-01', 3);
    s = recordDailyClear(s, '2026-06-01', 3);
    expect(Object.keys(s.best)).toEqual(['2026-06-01']);
  });
});

// The same checks as the tower floors (LV-1 to LV-4). The bank was built by the solver, so these
// confirm the shipped file wasn't edited by hand into something unsolvable or mis-scored.
describe('daily bank', () => {
  const levels = entries.map((e, i) => [i, expandDaily(e, `daily-${i}`)] as const);

  it('every puzzle is a valid floor whose reference clears it within both pars', () => {
    const tiles = new Set<string>();
    for (const [i, level] of levels) {
      expect(validateLevel({ ...level, id: 't9-f01' }), `day ${i}`).toEqual([]);
      const program = parseReference(level.reference);
      const run = new Runner(program, level).runToEnd();
      expect(run.status, `day ${i}`).toBe('cleared');
      expect(run.steps).toBe(level.par.steps);
      expect(countCommands(program)).toBe(level.par.commands);
      expect(level.par.commands).toBeLessThanOrEqual(level.slots.main!);
      tiles.add(level.tiles.join('/'));
    }
    expect(tiles.size).toBe(levels.length); // no repeats within the year
  });

  it('every step par is the true minimum', () => {
    for (const [i, level] of levels) expect(shortestActionPath(level)?.length, `day ${i}`).toBe(level.par.steps);
  });

  // Daily boards are small and loop-only, so the full search over all 364 takes a few seconds.
  it('LV-4: no shorter program than the command par (every day)', () => {
    for (const [i, level] of levels) {
      expect(smallestProgram(level, level.par.commands - 1), `day ${i}`).toBeNull();
    }
  }, 120_000);
});

describe('streak freezes', () => {
  const start: DailyState = { best: {}, streak: 0, longest: 0, last: null, freezes: 1, frozen: [] };

  it('covers one missed day and keeps the streak going', () => {
    let s = recordDailyClear(start, '2026-11-08', 3);
    s = recordDailyClear(s, '2026-11-09', 3);
    expect(currentStreak(s, '2026-11-11')).toBe(2); // missed the 10th, a freeze holds it
    s = recordDailyClear(s, '2026-11-11', 2);
    expect(s.streak).toBe(3);
    expect(s.freezes).toBe(0);
    expect(s.frozen).toEqual(['2026-11-10']);
    expect(currentStreak(s, '2026-11-13')).toBe(0); // no freeze left for the next miss
  });

  it('does not stretch one freeze over two missed days', () => {
    let s = recordDailyClear(start, '2026-11-08', 3);
    expect(currentStreak(s, '2026-11-11')).toBe(0);
    s = recordDailyClear(s, '2026-11-11', 3);
    expect(s.streak).toBe(1);
    expect(s.freezes).toBe(1);
  });

  it('earns a freeze every 7 days in a row, up to 2', () => {
    let s: DailyState = { ...start, freezes: 0 };
    for (let d = 1; d <= 21; d++) s = recordDailyClear(s, `2026-11-${String(d).padStart(2, '0')}`, 2);
    expect(s.streak).toBe(21);
    expect(s.freezes).toBe(2);
  });
});

