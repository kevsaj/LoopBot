import { describe, expect, it } from 'vitest';
import { composeLead, themeForFloor } from './music';
import type { Theme } from './music';

const THEMES: Theme[] = ['title', 'lobby', 'maintenance', 'workshop', 'control', 'rooftop', 'daily'];

describe('music', () => {
  it('gives each band of the tower its theme', () => {
    expect([1, 10, 11, 20, 21, 30, 31, 40, 41, 50].map(themeForFloor)).toEqual([
      'lobby', 'lobby', 'maintenance', 'maintenance', 'workshop', 'workshop', 'control', 'control', 'rooftop', 'rooftop',
    ]);
  });

  it.each(THEMES)('composes the same %s melody every time, in a singable range', (t) => {
    const a = composeLead(t, 0);
    expect(composeLead(t, 0)).toEqual(a);
    expect(a.length).toBeGreaterThan(8);
    for (const n of a) {
      expect(n.step).toBeGreaterThanOrEqual(0);
      expect(n.step).toBeLessThan(128);
      expect(n.len).toBeGreaterThan(0);
    }
    const midis = a.map((n) => n.midi);
    expect(Math.max(...midis) - Math.min(...midis)).toBeLessThanOrEqual(24);
    // steps go up in order
    expect(a.map((n) => n.step)).toEqual([...a.map((n) => n.step)].sort((x, y) => x - y));
  });

  it('varies later passes but keeps the opening motif', () => {
    const first = composeLead('lobby', 0);
    const second = composeLead('lobby', 1);
    expect(second).not.toEqual(first);
    const opening = (ns: typeof first) => ns.filter((n) => n.step < 32).map((n) => n.midi);
    expect(opening(second)).toEqual(opening(first));
  });
});
