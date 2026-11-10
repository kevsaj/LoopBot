import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, earnedIds } from './achievements';
import type { Stats } from './achievements';
import { DEFAULT_LOOK, PAINTS, TIPS, tipPoints, unlockedParts } from './looks';
import type { Progress } from '../progress';

const floors = Array.from({ length: 50 }, (_, i) => `t1-f${String(i + 1).padStart(2, '0')}`);
const progress = (stars: Record<string, number>, extra: Partial<Progress> = {}): Progress => ({
  stars, hints: 5, hintsAwarded: 0, revealed: {}, fails: {}, tutorial: false, ...extra,
});
const noDaily = { best: {}, streak: 0, longest: 0, last: null };
const stats = (p: Progress, daily = noDaily): Stats => ({ floors, progress: p, daily });
const firstN = (n: number, s = 3) => Object.fromEntries(floors.slice(0, n).map((id) => [id, s]));

describe('achievements', () => {
  it('has unique ids', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it('earns nothing for a new player', () => {
    expect(earnedIds(stats(progress({}))).size).toBe(0);
  });

  it('earns band and star milestones from tower progress', () => {
    const e = earnedIds(stats(progress(firstN(11))));
    expect([...e]).toEqual(expect.arrayContaining(['first-steps', 'lobby', 'loop-de-loop', 'perfect-10', 'no-hints']));
    expect(e.has('function-junction')).toBe(false);
  });

  it('needs a hint-free band for Figured it out', () => {
    const e = earnedIds(stats(progress(firstN(10), { revealed: { 't1-f04': 1 } })));
    expect(e.has('no-hints')).toBe(false);
  });

  it('counts the longest daily streak', () => {
    const e = earnedIds(stats(progress({}), { ...noDaily, best: { '2026-11-01': 2 }, longest: 7 }));
    expect(e.has('daily-1') && e.has('streak-7') && !e.has('streak-30')).toBe(true);
  });
});

describe('looks', () => {
  it('starts with the free look unlocked only', () => {
    const parts = unlockedParts(stats(progress({})), new Set());
    expect([...parts].sort()).toEqual(['eye:teal', 'paint:classic', 'tip:ball']);
    expect(DEFAULT_LOOK).toEqual({ paint: 'classic', eye: 'teal', tip: 'ball' });
  });

  it('unlocks paint by stars and tips by achievements', () => {
    const s = stats(progress(firstN(10))); // 30 stars
    const parts = unlockedParts(s, earnedIds(s));
    expect(parts.has('paint:sky') && parts.has('paint:mint') && !parts.has('paint:sunset')).toBe(true);
    expect(parts.has('tip:star')).toBe(true); // perfect ten
  });

  it('every reward item points at a real achievement', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    for (const x of [...PAINTS, ...TIPS]) if (x.unlock && 'achievement' in x.unlock) expect(ids.has(x.unlock.achievement)).toBe(true);
  });

  it('draws every tip shape', () => {
    for (const t of TIPS) if (t.id !== 'ball') expect(tipPoints(t.id, 0, 0, 5).length).toBeGreaterThan(4);
  });
});
