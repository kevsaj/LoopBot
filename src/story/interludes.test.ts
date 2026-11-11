import { describe, expect, it } from 'vitest';
import { INTERLUDES, interludeAfter } from './interludes';

describe('story interludes', () => {
  it('play after each band end, once, and only after a clear', () => {
    expect(interludeAfter(10, true, new Set())?.id).toBe('t1-after-10');
    expect(interludeAfter(10, false, new Set())).toBeNull();
    expect(interludeAfter(10, true, new Set(['t1-after-10']))).toBeNull();
    expect(interludeAfter(11, true, new Set())).toBeNull();
    expect(interludeAfter(50, true, new Set())?.kind).toBe('ending');
  });

  it('keep lines short enough to read on a phone', () => {
    for (const it of Object.values(INTERLUDES)) {
      const lines = it.kind === 'radio' ? it.lines : it.panels;
      expect(lines.length).toBeGreaterThan(2);
      for (const l of lines) expect(l.text.length).toBeLessThanOrEqual(110);
    }
  });
});
