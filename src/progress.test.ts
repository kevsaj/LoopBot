import { describe, expect, it } from 'vitest';
import type { Progress } from './progress';
import { isUnlocked, nextHintIsFree, recordClear, recordFail, revealHint, START_HINTS } from './progress';
import { tutorialStep } from './editor/tutorial';
import { emptyProgram, parseReference } from './sim/program';

const fresh = (): Progress => ({ stars: {}, hints: START_HINTS, hintsAwarded: 0, revealed: {}, fails: {}, tutorial: true });

describe('progress', () => {
  it('keeps the best stars', () => {
    let p = recordClear(fresh(), 'a', 3);
    p = recordClear(p, 'a', 1);
    expect(p.stars.a).toBe(3);
  });

  it('awards a hint for every 10 floors 3-starred, once (GD-12)', () => {
    let p = fresh();
    for (let i = 0; i < 10; i++) p = recordClear(p, `f${i}`, 3);
    expect(p.hints).toBe(START_HINTS + 1);
    p = recordClear(p, 'f0', 3);
    expect(p.hints).toBe(START_HINTS + 1);
  });

  it('charges one hint per tier, and the Nudge is free after 3 fails', () => {
    let p = revealHint(fresh(), 'x', 3)!;
    expect(p.hints).toBe(START_HINTS - 1);
    expect(p.revealed.x).toBe(1);
    let q = fresh();
    for (let i = 0; i < 3; i++) q = recordFail(q, 'y');
    expect(nextHintIsFree(q, 'y')).toBe(true);
    q = revealHint(q, 'y', 3)!;
    expect(q.hints).toBe(START_HINTS);
    expect(revealHint({ ...fresh(), hints: 0 }, 'z', 3)).toBeNull();
    p = revealHint(revealHint(p, 'x', 3)!, 'x', 3)!;
    expect(revealHint(p, 'x', 3)).toBeNull(); // all tiers shown
  });

  it('unlocks a floor once the one before it is cleared', () => {
    const ids = ['a', 'b'];
    expect(isUnlocked(fresh(), ids, 0)).toBe(true);
    expect(isUnlocked(fresh(), ids, 1)).toBe(false);
    expect(isUnlocked(recordClear(fresh(), 'a', 1), ids, 1)).toBe(true);
  });
});

describe('first-run tutorial', () => {
  const base = { enabled: true, floorId: 't1-f01', clearedBefore: false, program: emptyProgram(), hasRun: false, playing: false, outcome: null };
  it('walks Floor 1 through tap, run, and more', () => {
    expect(tutorialStep(base)).toBe('tap');
    expect(tutorialStep({ ...base, program: parseReference('forward') })).toBe('run');
    expect(tutorialStep({ ...base, program: parseReference('forward'), hasRun: true, outcome: 'ended' })).toBe('more');
    expect(tutorialStep({ ...base, program: parseReference('forward'), hasRun: true, playing: true })).toBeNull();
  });
  it('shows one overlay on Floor 2 and none after', () => {
    expect(tutorialStep({ ...base, floorId: 't1-f02' })).toBe('turn');
    expect(tutorialStep({ ...base, floorId: 't1-f02', program: parseReference('turn_left') })).toBeNull();
    expect(tutorialStep({ ...base, floorId: 't1-f03' })).toBeNull();
  });
  it('can be turned off, and stays off on cleared floors', () => {
    expect(tutorialStep({ ...base, enabled: false })).toBeNull();
    expect(tutorialStep({ ...base, clearedBefore: true })).toBeNull();
  });
});
