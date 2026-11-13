import { describe, expect, it } from 'vitest';
import { newDraft, paint, problems, resize, toLevel } from './draft';
import { decodeFloor, encodeFloor } from './shareCode';
import { validateLevel } from '../levels/validate';

describe('floor maker draft', () => {
  it('a new draft is a valid floor', () => {
    const d = newDraft();
    expect(problems(d)).toEqual([]);
    expect(validateLevel(toLevel(d), { custom: true })).toEqual([]);
  });

  it('any edit means it has to be cleared again', () => {
    const d = { ...newDraft(), solved: { commands: 3, steps: 8 } };
    expect(paint(d, 1, 1, '#').solved).toBeNull();
    expect(resize(d, 6, 5).solved).toBeNull();
  });

  it('boxes and targets cycle 1, 2, 3, off, and walls clear them', () => {
    let d = newDraft();
    for (const n of [1, 2, 3]) {
      d = paint(d, 2, 2, 'box');
      expect(d.boxes['2,2']).toBe(n);
    }
    d = paint(d, 2, 2, 'box');
    expect(d.boxes['2,2']).toBeUndefined();
    d = paint(paint(d, 1, 1, 'target'), 1, 1, '_');
    expect(d.targets['1,1']).toBeUndefined();
  });

  it('tapping LoopBot turns it', () => {
    const d = paint(newDraft(), 0, 0, 'bot');
    expect(d.bot.facing).toBe('south');
  });

  it('heights stay 0 to 3', () => {
    let d = newDraft();
    for (let i = 0; i < 5; i++) d = paint(d, 1, 0, 'up');
    expect(d.heights[0][1]).toBe(3);
    for (let i = 0; i < 5; i++) d = paint(d, 1, 0, 'down');
    expect(d.heights[0][1]).toBe(0);
  });

  it('explains what is missing', () => {
    let d = paint(newDraft(), 4, 4, '.'); // no exit left
    expect(problems(d)[0]).toMatch(/goal/);
    d = paint(paint(newDraft(), 0, 0, '#'), 4, 4, 'e');
    expect(problems(d).join(' ')).toMatch(/LoopBot needs/);
    d = paint(newDraft(), 2, 2, 'target');
    expect(problems(d).join(' ')).toMatch(/need 1 box, but the floor has none/);
  });

  it('resize keeps what fits', () => {
    const d = resize(paint(newDraft(), 1, 1, '#'), 3, 2);
    expect(d.tiles.map((r) => r.join(''))).toEqual(['...', '.#.']);
  });

  it('a solved draft survives a share code', () => {
    let d = paint(paint(newDraft(), 2, 2, 'box'), 3, 3, 'target');
    d = { ...d, title: 'Box drop!', solved: { commands: 7, steps: 15 } };
    const r = decodeFloor(encodeFloor(toLevel(d)));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.level.par).toEqual({ commands: 7, steps: 15 });
      expect(r.level.title).toBe('Box drop');
      expect(r.level.goals.sort()).toEqual(['all_targets_filled', 'bot_on_exit']);
    }
  });
});
