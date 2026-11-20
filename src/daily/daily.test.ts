import { describe, expect, it } from 'vitest';
import bank from './bank.json';
import bossBank from './boss.json';
import type { DailyEntry } from './entry';
import { expandDaily } from './entry';
import { BANK_DAYS, BOSS_WEEKS, THEMES, bankIndex, bossIndex, dateKey, dayNumber, difficultyFor, isBossDay, keyFromDay, themeOf, twistFor, weekday } from './calendar';
import { archiveDates, bossHintReward, currentStreak, dailyHintReward, recordArchiveClear, recordBossClear, recordDailyClear, sanitizeDaily, themeComing } from './index';
import type { DailyState } from './index';
import { validateLevel } from '../levels/validate';
import { Runner } from '../sim/interpreter';
import { countCommands, parseReference } from '../sim/program';
import { shortestActionPath, smallestProgram } from '../sim/solver';

const entries = bank as unknown as DailyEntry[];
const bosses = bossBank as unknown as DailyEntry[];

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


describe('Plus streak freezes', () => {
  it('lets Plus bank up to PLUS_MAX_FREEZES', async () => {
    const { recordDailyClear, MAX_FREEZES, PLUS_MAX_FREEZES } = await import('./index');
    let free = { best: {}, streak: 0, longest: 0, last: null as string | null, freezes: 0 } as Parameters<typeof recordDailyClear>[0];
    let plus = free;
    const day = (n: number) => `2026-01-${String(n).padStart(2, '0')}`;
    for (let n = 1; n <= 28; n++) {
      free = recordDailyClear(free, day(n), 3);
      plus = recordDailyClear(plus, day(n), 3, PLUS_MAX_FREEZES);
    }
    expect(free.freezes).toBe(MAX_FREEZES);
    expect(plus.freezes).toBe(PLUS_MAX_FREEZES);
  });
});

describe('daily archive', () => {
  it('offers the 30 days before today, newest first', () => {
    const d = archiveDates('2026-11-13');
    expect(d.length).toBe(30);
    expect(d[0]).toBe('2026-11-12');
    expect(d[29]).toBe('2026-10-14');
  });
  it('keeps the best stars for a past day without touching the streak', () => {
    const s: DailyState = { best: { '2026-11-13': 2 }, streak: 5, longest: 9, last: '2026-11-13', freezes: 1, frozen: [] };
    const a = recordArchiveClear(s, '2026-11-01', 2);
    expect(a.best['2026-11-01']).toBe(2);
    expect([a.streak, a.longest, a.last, a.freezes]).toEqual([5, 9, '2026-11-13', 1]);
    expect(recordArchiveClear(a, '2026-11-01', 1)).toBe(a);
  });
});

describe('daily hints', () => {
  const empty: DailyState = { best: {}, streak: 0, longest: 0, last: null, freezes: 0, frozen: [] };
  it('pays one hint for the first clear of a day, and nothing for replays', () => {
    const a = recordDailyClear(empty, '2026-11-13', 2);
    expect(dailyHintReward(empty, a, '2026-11-13')).toBe(1);
    const b = recordDailyClear(a, '2026-11-13', 3);
    expect(dailyHintReward(a, b, '2026-11-13')).toBe(0);
  });
  it('adds 3 more on every 7-day streak', () => {
    let s = empty;
    const paid: number[] = [];
    for (let d = 1; d <= 7; d++) {
      const date = `2026-11-0${d}`;
      const next = recordDailyClear(s, date, 1);
      paid.push(dailyHintReward(s, next, date));
      s = next;
    }
    expect(paid).toEqual([1, 1, 1, 1, 1, 1, 4]);
  });
});

describe('theme weeks', () => {
  it('runs Monday to Sunday and takes the four themes in turn', () => {
    const mon = dayNumber('2026-11-16');
    for (let d = mon; d < mon + 7; d++) expect(themeOf(d)).toBe(themeOf(mon));
    expect(themeOf(mon - 1)).not.toBe(themeOf(mon));
    const seen = [0, 1, 2, 3].map((w) => themeOf(mon + 7 * w));
    expect(new Set(seen).size).toBe(THEMES.length);
    expect(themeOf(mon + 28)).toBe(themeOf(mon));
  });

  it('puts the rule on Wednesday to Friday only, and teases it on Monday and Tuesday', () => {
    const days = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'];
    expect(days.map((d) => twistFor(dayNumber(d)) !== null)).toEqual([false, false, true, true, true, false, false]);
    expect(days.map((d) => themeComing(d) !== null)).toEqual([true, true, false, false, false, false, false]);
  });

  it('gives a bank day the same theme every year (364 days is 13 rounds of 4 weeks)', () => {
    for (let i = 0; i < BANK_DAYS; i++) expect(twistFor(i + BANK_DAYS * 57)).toBe(twistFor(i));
  });

  it('builds every theme day for its rule', () => {
    entries.forEach((e, i) => {
      const tw = twistFor(i);
      expect(e.tw ?? null, `day ${i}`).toBe(tw);
      const level = expandDaily(e, `daily-${i}`);
      if (tw === 'right') {
        expect(level.commands).not.toContain('turn_left');
        expect(e.reference).not.toContain('turn_left');
      }
      if (tw === 'tight') expect(level.slots.main).toBe(level.par.commands);
      if (tw === 'switch') expect(level.goals).toEqual(['all_switches_on']);
      if (tw === 'nested') expect(e.reference).toMatch(/repeat \d+ \{[^}]*repeat/);
    });
  });
});

describe('Sunday boss', () => {
  it('plays on Sundays, one boss a week, all 52 before one comes back', () => {
    expect(isBossDay(dayNumber('2026-11-22'))).toBe(true);
    expect(isBossDay(dayNumber('2026-11-21'))).toBe(false);
    const sun = dayNumber('2026-11-22');
    const seen = new Set<number>();
    for (let w = 0; w < BOSS_WEEKS; w++) seen.add(bossIndex(sun + 7 * w));
    expect(seen.size).toBe(BOSS_WEEKS);
    expect(bossIndex(sun + 7 * BOSS_WEEKS)).toBe(bossIndex(sun));
  });

  const levels = bosses.map((e, i) => [i, expandDaily(e, `daily-boss-${i}`)] as const);

  it('every boss is a valid floor whose reference clears it within both pars', () => {
    expect(bosses.length).toBe(BOSS_WEEKS);
    const tiles = new Set(entries.map((e) => e.tiles.join('/')));
    for (const [i, level] of levels) {
      expect(bosses[i].d).toBe('boss');
      expect(validateLevel({ ...level, id: 't9-f01' }), `boss ${i}`).toEqual([]);
      const program = parseReference(level.reference);
      const run = new Runner(program, level).runToEnd();
      expect(run.status, `boss ${i}`).toBe('cleared');
      expect(run.steps).toBe(level.par.steps);
      expect(countCommands(program)).toBe(level.par.commands);
      expect(level.reference).toMatch(/repeat \d+ \{[^}]*repeat/);
      expect(tiles.has(level.tiles.join('/')), `boss ${i} repeats a daily`).toBe(false);
      tiles.add(level.tiles.join('/'));
    }
  });

  it('every boss step par is the true minimum', () => {
    for (const [i, level] of levels) expect(shortestActionPath(level)?.length, `boss ${i}`).toBe(level.par.steps);
  });

  it('LV-4: no shorter program than the boss command par', () => {
    for (const [i, level] of levels) expect(smallestProgram(level, level.par.commands - 1), `boss ${i}`).toBeNull();
  }, 600_000);

  it('keeps its own stars, never the streak, and pays 2 hints the first time on the day', () => {
    const s: DailyState = { best: {}, streak: 4, longest: 4, last: '2026-11-21', freezes: 1, frozen: [] };
    const a = recordBossClear(s, '2026-11-22', 2);
    expect(a.boss).toEqual({ '2026-11-22': 2 });
    expect([a.streak, a.last, a.freezes]).toEqual([4, '2026-11-21', 1]);
    expect(recordBossClear(a, '2026-11-22', 1)).toBe(a);
    expect(bossHintReward(s, '2026-11-22', '2026-11-22')).toBe(2);
    expect(bossHintReward(a, '2026-11-22', '2026-11-22')).toBe(0);
    expect(bossHintReward(s, '2026-11-15', '2026-11-22')).toBe(0); // from the archive
    // the daily keeps the boss results it already had
    expect(recordDailyClear(a, '2026-11-22', 3).boss).toEqual({ '2026-11-22': 2 });
    expect(sanitizeDaily({ ...a, boss: { '2026-11-22': 2, bad: 'x' } }).boss).toEqual({ '2026-11-22': 2 });
  });
});
