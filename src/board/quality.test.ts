import { beforeEach, describe, expect, it, vi } from 'vitest';
import { boardRatio, FrameWatch, lowEndDevice, resetQuality, STEP, stepDown } from './quality';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

beforeEach(() => {
  store.clear();
  resetQuality();
});

describe('lowEndDevice', () => {
  it('flags 4 GB or less, or 4 cores or fewer', () => {
    expect(lowEndDevice({ deviceMemory: 4, hardwareConcurrency: 8 })).toBe(true); // the TCL tablet
    expect(lowEndDevice({ deviceMemory: 8, hardwareConcurrency: 4 })).toBe(true);
    expect(lowEndDevice({ deviceMemory: 8, hardwareConcurrency: 8 })).toBe(false); // a flagship phone
    expect(lowEndDevice({})).toBe(false); // Safari reports neither
  });
});

describe('boardRatio', () => {
  it('keeps a capable phone at its full sharpness', () => {
    expect(boardRatio(3, 412, 380, false)).toBe(3);
  });
  it('gives a big low-end tablet a smaller pixel budget, but never under 1', () => {
    const r = boardRatio(2, 776, 512, true);
    expect(r).toBeLessThan(2);
    expect(r).toBeGreaterThanOrEqual(1);
    expect(776 * 512 * r * r).toBeLessThanOrEqual(800_000 + 1);
    expect(boardRatio(2, 2000, 1400, true)).toBe(1);
  });
  it('steps down after a stutter, remembers it, and tries one step sharper next launch', () => {
    expect(stepDown(2)).toBe(true);
    expect(boardRatio(3, 412, 380, false)).toBeCloseTo(2 * STEP);
    resetQuality(); // a new launch
    expect(boardRatio(3, 412, 380, false)).toBeCloseTo(2);
    expect(stepDown(1)).toBe(false);
  });
});

describe('FrameWatch', () => {
  const run = (fpsList: number[]) => {
    const slow = vi.fn();
    const w = new FrameWatch(0, slow);
    let t = 3000; // past the warm-up
    for (const fps of fpsList) {
      const end = t + 2100;
      while (t < end) {
        w.frame(t);
        t += 1000 / fps;
      }
    }
    return slow.mock.calls.length;
  };
  it('leaves a steady 30 alone', () => expect(run([30, 30, 30, 30])).toBe(0));
  it('ignores a single slow patch', () => expect(run([30, 18, 30, 18, 30])).toBe(0));
  it('reacts to the board staying slow', () => expect(run([18, 18, 18, 18])).toBe(2));
  it('does not count a pause (app in the background) as slow', () => {
    const slow = vi.fn();
    const w = new FrameWatch(0, slow);
    for (let t = 3000; t < 9000; t += 33) w.frame(t);
    for (let t = 20000; t < 26000; t += 33) w.frame(t);
    expect(slow).not.toHaveBeenCalled();
  });
});
