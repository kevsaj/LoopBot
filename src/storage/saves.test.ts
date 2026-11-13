import { describe, expect, it } from 'vitest';
import { sanitizeProgress } from '../progress';
import { sanitizeDaily } from '../daily';

describe('broken or hand-made saves', () => {
  it('progress keeps only fields of the right type', () => {
    const p = sanitizeProgress({ stars: { 't1-f01': 3, 't1-f02': 'x' }, hints: 'lots', revealed: [1], fails: null, tutorial: 'no', extra: 1 });
    expect(p).toEqual({ stars: { 't1-f01': 3 }, hints: 5, hintsAwarded: 0, revealed: {}, fails: {}, tutorial: true });
    expect(sanitizeProgress('nope').stars).toEqual({});
    expect(sanitizeProgress(null).hints).toBe(5);
  });

  it('daily keeps only fields of the right type', () => {
    const d = sanitizeDaily({ best: { '2026-11-12': 2, bad: {} }, streak: 4, longest: -3, last: 7, frozen: ['2026-11-10', 3] });
    expect(d).toEqual({ best: { '2026-11-12': 2 }, streak: 4, longest: 0, last: null, freezes: 1, frozen: ['2026-11-10'] });
    expect(sanitizeDaily([]).streak).toBe(0);
  });
});
