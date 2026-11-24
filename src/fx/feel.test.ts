import { describe, expect, it } from 'vitest';
import { arc, bumpMs, glide, landMs, moveMs } from './feel';

describe('game feel timing', () => {
  it('moves for most of a step and lands at the end of the move', () => {
    expect(moveMs(520)).toBeCloseTo(416);
    expect(landMs(260)).toBe(208);
    expect(moveMs(0)).toBe(0);
  });

  it('bumps part way through a blocked forward or jump, at once for other errors', () => {
    const b = bumpMs(520, 'forward', false);
    expect(b).toBeGreaterThan(0);
    expect(b).toBeLessThan(landMs(520));
    expect(bumpMs(520, 'jump', false)).toBe(b);
    expect(bumpMs(520, 'pick_up', false)).toBe(0);
    expect(bumpMs(520, undefined, false)).toBe(0);
  });

  it('has no lunge with Reduce motion, so the sound comes straight away', () => {
    expect(bumpMs(520, 'forward', true)).toBe(0);
  });

  it('hops from the ground to a peak of 1 and back down', () => {
    expect(arc(0)).toBe(0);
    expect(arc(1)).toBeCloseTo(0);
    expect(arc(0.42)).toBe(1);
    for (let t = 0; t <= 1; t += 0.05) {
      expect(arc(t)).toBeGreaterThanOrEqual(0);
      expect(arc(t)).toBeLessThanOrEqual(1);
    }
  });

  it('glides smoothly from start to end without overshooting', () => {
    expect(glide(0)).toBe(0);
    expect(glide(1)).toBe(1);
    expect(glide(0.5)).toBeCloseTo(0.5);
    let last = 0;
    for (let t = 0; t <= 1; t += 0.1) {
      const g = glide(t);
      expect(g).toBeGreaterThanOrEqual(last);
      last = g;
    }
  });
});
