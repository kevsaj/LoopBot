import { describe, expect, it, vi } from 'vitest';
import { GIFT_PARTS, earlyGoal, giftDue, wearGift } from './gift';
import { PAINTS, TIPS, isPlusPart, tipPoints, unlockedParts } from './looks';
import type { Progress } from '../progress';

vi.mock('../store/purchases', () => ({ PLUS_VISIBLE: false, plusUnlocked: () => false }));

const floors = Array.from({ length: 50 }, (_, i) => `t1-f${String(i + 1).padStart(2, '0')}`);
const progress = (n: number): Progress => ({
  stars: Object.fromEntries(floors.slice(0, n).map((id) => [id, 1])), hints: 5, hintsAwarded: 0, revealed: {}, fails: {}, tutorial: false,
});
const stats = (n: number) => ({ floors, progress: progress(n), daily: { best: {}, streak: 0, longest: 0, last: null } });

describe('the Floor 3 gift', () => {
  it('unlocks Lilac paint and the Gear antenna on clearing Floor 3, and not before', () => {
    expect(GIFT_PARTS.some((k) => unlockedParts(stats(2), new Set()).has(k))).toBe(false);
    const parts = unlockedParts(stats(3), new Set());
    for (const k of GIFT_PARTS) expect(parts.has(k)).toBe(true);
  });

  it('is free, and draws a gear', () => {
    expect(isPlusPart(PAINTS.find((p) => p.id === 'lilac')!.unlock)).toBe(false);
    expect(isPlusPart(TIPS.find((t) => t.id === 'gear')!.unlock)).toBe(false);
    expect(tipPoints('gear', 0, 0, 5).length).toBe(32);
  });

  it('opens once, leaving Tower 1 Floor 3 after a clear', () => {
    expect(giftDue(1, 3, true, false)).toBe(true);
    expect(giftDue(1, 3, false, false)).toBe(false);
    expect(giftDue(1, 3, true, true)).toBe(false);
    expect(giftDue(2, 3, true, false)).toBe(false);
    expect(giftDue(1, 4, true, false)).toBe(false);
  });

  it('keeps the eye colour when worn', () => {
    expect(wearGift({ paint: 'sky', eye: 'pink', tip: 'star' })).toEqual({ paint: 'lilac', eye: 'pink', tip: 'gear' });
  });
});

describe('early goals', () => {
  it('point at the gift, then PATCH, then Maintenance, on first clears in Tower 1', () => {
    expect(earlyGoal(1, 1, true, false, false)?.icon).toBe('gift');
    expect(earlyGoal(1, 3, true, false, false)?.text).toMatch(/Next floor/);
    expect(earlyGoal(1, 4, true, false, true)?.icon).toBe('radio');
    expect(earlyGoal(1, 6, true, false, true)).toMatchObject({ icon: 'lock', vars: { n: 4 } });
    expect(earlyGoal(1, 9, true, false, true)?.text).toMatch(/^One more floor/);
    expect(earlyGoal(1, 10, true, false, true)).toBeNull();
  });

  it('stay quiet on replays, in other towers, and past Floor 5 in the demo', () => {
    expect(earlyGoal(1, 1, false, false, false)).toBeNull();
    expect(earlyGoal(2, 1, true, false, false)).toBeNull();
    expect(earlyGoal(1, 7, true, true, true)).toBeNull();
    expect(earlyGoal(1, 2, true, false, true)).toBeNull();
  });
});
