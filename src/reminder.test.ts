import { describe, expect, it } from 'vitest';
import { hourLabel, planReminders } from './reminder';
import type { DailyState } from './daily';

const prefs = { on: true, hour: 18, asked: true };
const empty: DailyState = { best: {}, streak: 0, longest: 0, last: null, freezes: 1, frozen: [] };

describe('daily reminder plan', () => {
  it('starts today when the time is still ahead and today is not done', () => {
    const plan = planReminders(prefs, empty, new Date(2026, 10, 10, 9, 0));
    expect(plan).toHaveLength(7);
    expect(plan[0].at).toEqual(new Date(2026, 10, 10, 18, 0));
    expect(plan[6].at).toEqual(new Date(2026, 10, 16, 18, 0));
  });

  it('skips today once it is cleared or the time has passed', () => {
    const done: DailyState = { ...empty, best: { '2026-11-10': 2 }, last: '2026-11-10', streak: 3 };
    expect(planReminders(prefs, done, new Date(2026, 10, 10, 9, 0))[0].at).toEqual(new Date(2026, 10, 11, 18, 0));
    expect(planReminders(prefs, empty, new Date(2026, 10, 10, 19, 0))[0].at).toEqual(new Date(2026, 10, 11, 18, 0));
  });

  it('mentions a live streak in the first reminder', () => {
    const alive: DailyState = { ...empty, best: { '2026-11-09': 3 }, last: '2026-11-09', streak: 4 };
    expect(planReminders(prefs, alive, new Date(2026, 10, 10, 9, 0))[0].title).toContain('4-day streak');
  });

  it('labels hours', () => {
    expect([0, 9, 12, 18].map(hourLabel)).toEqual(['12 AM', '9 AM', '12 PM', '6 PM']);
  });
});
