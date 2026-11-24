import { describe, expect, it } from 'vitest';
import { FROSTLINE_INTERLUDES, HEATWAVE_INTERLUDES, INTERLUDES, TWIST_INTERLUDES, DOCKYARD_INTERLUDES, TWINSPIRES_INTERLUDES, FRACTAL_INTERLUDES, PRECINCT_INTERLUDES, interludeAfter } from './interludes';

describe('story interludes', () => {
  it('play after each band end, once, and only after a clear', () => {
    expect(interludeAfter(10, true, new Set())?.id).toBe('t1-after-10');
    expect(interludeAfter(10, false, new Set())).toBeNull();
    expect(interludeAfter(10, true, new Set(['t1-after-10']))).toBeNull();
    expect(interludeAfter(11, true, new Set())).toBeNull();
    expect(interludeAfter(50, true, new Set())?.kind).toBe('ending');
  });

  it('Tower 1 calls in after Floor 5 too, and VANTA speaks in it', () => {
    const first = interludeAfter(5, true, new Set());
    expect(first?.id).toBe('t1-after-5');
    expect(first?.kind === 'radio' && first.lines.some((l) => l.who === 'VANTA')).toBe(true);
    expect(interludeAfter(5, true, new Set(), 2)).toBeNull();
  });

  it('each tower plays its own beats', () => {
    expect(interludeAfter(10, true, new Set(), 2)?.id).toBe('t2-after-10');
    expect(interludeAfter(30, true, new Set(), 3)?.id).toBe('t3-after-30');
    const end = interludeAfter(50, true, new Set(), 3);
    expect(end?.kind === 'ending' && end.next).toBe('TWIST');
  });

  it('keep lines short enough to read on a phone', () => {
    for (const it of [INTERLUDES, FROSTLINE_INTERLUDES, HEATWAVE_INTERLUDES, TWIST_INTERLUDES, DOCKYARD_INTERLUDES, TWINSPIRES_INTERLUDES, FRACTAL_INTERLUDES, PRECINCT_INTERLUDES].flatMap((t) => Object.values(t))) {
      const lines = it.kind === 'radio' ? it.lines : it.panels;
      expect(lines.length).toBeGreaterThan(2);
      for (const l of lines) expect(l.text.length).toBeLessThanOrEqual(110);
    }
  });
});
