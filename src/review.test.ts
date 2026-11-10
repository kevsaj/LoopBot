import { describe, expect, it } from 'vitest';
import { shouldAskForReview } from './review';

const DAY = 86_400_000;

describe('review prompt', () => {
  it('asks only after a band is finished with 2+ stars', () => {
    expect(shouldAskForReview('t1-f10', 3, null, 0)).toBe(true);
    expect(shouldAskForReview('t1-f10', 1, null, 0)).toBe(false);
    expect(shouldAskForReview('t1-f09', 3, null, 0)).toBe(false);
  });
  it('waits 120 days between asks', () => {
    expect(shouldAskForReview('t1-f20', 3, 0, 119 * DAY)).toBe(false);
    expect(shouldAskForReview('t1-f20', 3, 0, 120 * DAY)).toBe(true);
  });
});
