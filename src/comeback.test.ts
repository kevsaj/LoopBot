import { describe, expect, it } from 'vitest';
import { noteFirstDay, nudgeHour, planNudge, recordWarmupClear, warmupOpen, warmupTierFor } from './comeback';
import type { ComebackState } from './comeback';
import type { Progress } from './progress';

const base: ComebackState = { first: null, warm: {}, asked: false, nudge: false, hour: 18, at: null, done: false };
const progress = (stars: Record<string, number>, extra: Partial<Progress> = {}): Progress => ({ stars, hints: 5, hintsAwarded: 0, revealed: {}, fails: {}, tutorial: true, underPar: {}, ...extra });
const newbie = progress({});
const floor1 = progress({ 't1-f01': 3 });

describe('first day', () => {
  it('is today for a new player, and yesterday for someone who already played', () => {
    expect(noteFirstDay(base, newbie, '2026-11-24').first).toBe('2026-11-24');
    expect(noteFirstDay(base, floor1, '2026-11-24').first).toBe('2026-11-23');
  });
  it('never moves once set', () => {
    const s = { ...base, first: '2026-11-01' };
    expect(noteFirstDay(s, floor1, '2026-11-24')).toBe(s);
  });
});

describe('warm-up', () => {
  it('opens from the second day, once Floor 1 is cleared, until the daily opens', () => {
    const s = { ...base, first: '2026-11-24' };
    expect(warmupOpen(s, floor1, '2026-11-24')).toBe(false); // day one
    expect(warmupOpen(s, floor1, '2026-11-25')).toBe(true);
    expect(warmupOpen(s, newbie, '2026-11-25')).toBe(false); // Floor 1 not cleared
    expect(warmupOpen(s, progress({ 't1-f01': 3, 't1-f11': 1 }), '2026-11-25')).toBe(false); // the daily took over
  });

  it('pays one hint for the first clear of a day only', () => {
    const one = recordWarmupClear(base, '2026-11-25', 2);
    expect(one.hints).toBe(1);
    const again = recordWarmupClear(one.state, '2026-11-25', 3);
    expect(again.hints).toBe(0);
    expect(again.state.warm['2026-11-25']).toBe(3);
    expect(recordWarmupClear(again.state, '2026-11-26', 1).hints).toBe(1);
  });

  it('forgets old days', () => {
    const s = recordWarmupClear({ ...base, warm: { '2026-10-01': 3 } }, '2026-11-25', 2).state;
    expect(Object.keys(s.warm)).toEqual(['2026-11-25']);
  });

  it('gets harder only as the tower teaches more', () => {
    expect(warmupTierFor(floor1)).toBe('turn');
    expect(warmupTierFor(progress({ 't1-f01': 1, 't1-f02': 1 }))).toBe('turns');
    expect(warmupTierFor(progress({ 't1-f01': 1, 't1-f02': 1, 't1-f03': 1, 't1-f04': 1 }))).toBe('jumps');
  });
});

describe('the one nudge', () => {
  const on = { ...base, first: '2026-11-24', asked: true, nudge: true, hour: 15 };
  const now = new Date(2026, 10, 24, 15, 30);

  it('waits for tomorrow at about the time they played', () => {
    expect(planNudge(on, floor1, false, now)?.at).toEqual(new Date(2026, 10, 25, 15, 0));
  });

  it('says where they left off, and offers help if they were stuck', () => {
    expect(planNudge(on, floor1, false, now)?.body).toContain('Floor 2 is right where you left it');
    const stuck = progress({ 't1-f01': 3 }, { fails: { 't1-f02': 4 } });
    expect(planNudge(on, stuck, false, now)?.body).toContain('Floor 2 giving you trouble');
  });

  it('is never planned unless they said yes, and never again once used', () => {
    expect(planNudge({ ...on, nudge: false }, floor1, false, now)).toBeNull();
    expect(planNudge({ ...on, done: true }, floor1, false, now)).toBeNull();
  });

  it('steps aside for the daily reminder and the daily challenge', () => {
    expect(planNudge(on, floor1, true, now)).toBeNull();
    expect(planNudge(on, progress({ 't1-f01': 3, 't1-f11': 2 }), false, now)).toBeNull();
  });

  it('keeps to friendly hours', () => {
    expect(nudgeHour(new Date(2026, 10, 24, 7))).toBe(10);
    expect(nudgeHour(new Date(2026, 10, 24, 14))).toBe(14);
    expect(nudgeHour(new Date(2026, 10, 24, 23))).toBe(20);
  });
});
