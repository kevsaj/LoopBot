import { beforeEach, describe, expect, it } from 'vitest';
import bank from './bank.json';
import type { OverflowEntry, Tier } from './entry';
import { KINDS, expandOverflow, transformEntry } from './entry';
import { TIER_KINDS } from './generate';
import {
  MAX_BRICKS,
  climbOn,
  endClimb,
  heightOf,
  markCleared,
  pickFloor,
  pruneOverflow,
  sanitizeOverflow,
  skipFloor,
  startClimb,
  terraceOf,
  tierOf,
} from './index';
import type { OverflowState } from './index';
import { validateLevel } from '../levels/validate';
import { Runner } from '../sim/interpreter';
import { countCommands, parseReference } from '../sim/program';
import { shortestActionPath, smallestProgram } from '../sim/solver';
import type { LevelFile } from '../sim/types';

class MemStorage {
  m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
(globalThis as { localStorage?: unknown }).localStorage ??= new MemStorage();

const entries = bank as unknown as OverflowEntry[];
const level = (e: OverflowEntry, i: number | string): LevelFile => expandOverflow(e, `t9-f01`, `bank ${i}`, 'brickyard');

/** Every way a floor can be turned and mirrored. */
const WAYS = [false, true].flatMap((m) => [0, 1, 2, 3].map((rot) => ({ rot, m })));

describe('Overflow bank', () => {
  it('holds every trick of every tier', () => {
    for (const tier of [1, 2, 3, 4] as Tier[]) {
      const here = entries.filter((e) => e.tier === tier);
      expect(here.length, `tier ${tier}`).toBeGreaterThanOrEqual(60);
      for (const kind of TIER_KINDS[tier]) expect(here.some((e) => e.kind === kind), `tier ${tier} ${kind}`).toBe(true);
    }
    for (const kind of KINDS) expect(entries.some((e) => e.kind === kind), kind).toBe(true);
  });

  it('LV-1, LV-2: every floor, turned and mirrored every way, is valid and its program clears it at par', () => {
    entries.forEach((e, i) => {
      for (const { rot, m } of WAYS) {
        const l = level(transformEntry(e, rot, m), i);
        expect(validateLevel(l), `floor ${i} rot ${rot} mirror ${m}`).toEqual([]);
        const program = parseReference(l.reference);
        const run = new Runner(program, l).runToEnd();
        expect(run.status, `floor ${i} rot ${rot} mirror ${m}`).toBe('cleared');
        expect(run.steps, `floor ${i}`).toBe(l.par.steps);
        expect(countCommands(program)).toBe(l.par.commands);
        expect(l.par.commands).toBeLessThanOrEqual(l.slots.main!);
      }
    });
  });

  it('LV-3: the step par is the true minimum (every floor)', () => {
    entries.forEach((e, i) => expect(shortestActionPath(level(e, i))?.length, `floor ${i}`).toBe(e.par.steps));
  });

  it('LV-4: no shorter program than the command par (every floor)', () => {
    entries.forEach((e, i) => expect(smallestProgram(level(e, i), e.par.commands - 1), `floor ${i}`).toBeNull());
  }, 300_000);

  it('turns a floor back to where it started after four quarter turns', () => {
    const e = entries.find((x) => x.twin)!;
    let t = e;
    for (let i = 0; i < 4; i++) t = transformEntry(t, 1, false);
    expect(t).toEqual(e);
    expect(transformEntry(transformEntry(e, 0, true), 0, true)).toEqual(e);
  });
});

describe('Overflow climb', () => {
  const none: OverflowState = { run: null, best: 0, climbs: 0, last: null };

  it('climbs the tiers in order and stays in the last one', () => {
    expect([1, 6, 7, 18, 19, 40, 41, 500].map(tierOf)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect([1, 11, 21, 31, 41, 51, 61, 91].map(terraceOf)).toEqual(['brickyard', 'lapisgate', 'gardens', 'starstair', 'cloudtop', 'lapisgate', 'gardens', 'lapisgate']);
  });

  it('picks the same floor for the same climb, and new floors for a new climb', () => {
    const a = pickFloor(entries, 42, 9);
    expect(pickFloor(entries, 42, 9)).toEqual(a);
    expect(a.entry.tier).toBe(2);
    const titles = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(pickFloor(entries, 1000 + i, 9).entry.tiles)));
    expect(titles.size).toBeGreaterThan(20);
  });

  it('never repeats a bank floor until its tier runs out, even far up', () => {
    for (const tier of [2, 4] as Tier[]) {
      const start = tier === 2 ? 7 : 41;
      const size = entries.filter((e) => e.tier === tier).length;
      const count = tier === 2 ? 12 : size;
      const seen = new Set<string>();
      for (let f = start; f < start + count; f++) {
        // undo the turn by comparing every way the floor can be turned
        const { entry } = pickFloor(entries, 7, f);
        const key = WAYS.map(({ rot, m }) => transformEntry(entry, rot, m).tiles.join('/')).sort()[0];
        seen.add(key);
      }
      expect(seen.size).toBe(count);
    }
    // well past the bank's size, floors keep coming
    expect(pickFloor(entries, 7, 5000).entry.tier).toBe(4);
  });

  it('counts the height, the record and the bricks', () => {
    let s = startClimb(none, 99);
    expect(s.run).toMatchObject({ floor: 1, bricks: MAX_BRICKS, done: 0 });
    expect(s.climbs).toBe(1);
    s = markCleared(s, 2);
    expect(heightOf(s.run!)).toBe(1);
    expect(s.best).toBe(1);
    s = markCleared(s, 3); // a retry for more stars stays on the floor
    expect(s.run!.floor).toBe(1);
    s = climbOn(s).state;
    expect(s.run).toMatchObject({ floor: 2, stars: 3, perfect: 1, done: 0 });
    s = skipFloor(s);
    expect(s.run).toMatchObject({ floor: 3, bricks: 2, perfect: 0 });
    expect(s.best).toBe(2);
    // three perfect clears in a row win a brick back, never more than the most
    let brick = false;
    for (let i = 0; i < 3; i++) {
      const r = climbOn(markCleared(s, 3));
      s = r.state;
      brick = r.brick;
    }
    expect(brick).toBe(true);
    expect(s.run!.bricks).toBe(3);
    for (let i = 0; i < 3; i++) s = climbOn(markCleared(s, 3)).state;
    expect(s.run!.bricks).toBe(MAX_BRICKS);
    const h = heightOf(s.run!);
    s = endClimb(s);
    expect(s.run).toBeNull();
    expect(s.last?.height).toBe(h);
    expect(s.best).toBe(h);
  });

  it('cannot skip without a brick, or skip a floor already cleared', () => {
    let s = startClimb(none, 5);
    s = skipFloor(skipFloor(skipFloor(s)));
    expect(s.run!.bricks).toBe(0);
    expect(skipFloor(s)).toBe(s);
    const cleared = markCleared(startClimb(none, 5), 1);
    expect(skipFloor(cleared)).toBe(cleared);
  });

  it('keeps only fields of the right type from a save', () => {
    expect(sanitizeOverflow('nope')).toEqual(none);
    const s = sanitizeOverflow({ best: 12.7, climbs: -3, run: { seed: 'x', floor: 0, bricks: 99, done: 7 } });
    expect(s.best).toBe(12);
    expect(s.climbs).toBe(0);
    expect(s.run).toMatchObject({ floor: 1, bricks: MAX_BRICKS, done: 3 });
  });

  describe('storage', () => {
    beforeEach(() => localStorage.clear());
    it('clears editor saves and hint counters of floors left behind', () => {
      localStorage.setItem('loopbot.editor.overflow-1-1', '{}');
      localStorage.setItem('loopbot.editor.overflow-1-2', '{}');
      localStorage.setItem('loopbot.editor.t1-f01', '{}');
      const p = pruneOverflow({ stars: {}, revealed: { 'overflow-1-1': 1, 'overflow-1-2': 2, 't1-f01': 1 }, fails: {}, hints: 0 } as never, 'overflow-1-2');
      expect(localStorage.getItem('loopbot.editor.overflow-1-1')).toBeNull();
      expect(localStorage.getItem('loopbot.editor.overflow-1-2')).not.toBeNull();
      expect(localStorage.getItem('loopbot.editor.t1-f01')).not.toBeNull();
      expect(p.revealed).toEqual({ 'overflow-1-2': 2, 't1-f01': 1 });
    });
  });
});
