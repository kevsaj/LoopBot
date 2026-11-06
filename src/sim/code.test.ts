import { describe, expect, it } from 'vitest';
import { parseCode } from './code';
import { parseReference, toCode } from './program';
import { LEVELS } from '../levels';
import type { Block, Program } from './types';

/** A program without ids, to compare shapes. */
const shape = (p: Program) => JSON.parse(JSON.stringify(p, (k, v) => (k === 'id' ? undefined : v))) as unknown;
const text = (p: Program) => toCode(p).map((l) => l.text).join('\n');

describe('typed code', () => {
  it.each(LEVELS.map((l) => [l.id, l] as const))('reads back the code view of %s', (_id, level) => {
    const p = parseReference(level.reference);
    const r = parseCode(text(p), level);
    expect(r.ok && shape(r.program)).toEqual(shape(p));
  });

  it('reads loose code without def main', () => {
    const r = parseCode('repeat 2:\n  forward\n  turn_left()\nif not wall_ahead():\n  jump\nelse:\n  pass\n# done');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.program.main.map((b: Block) => b.kind)).toEqual(['repeat', 'if']);
  });

  it('reads tile colours with or without quotes', () => {
    for (const c of ['tile_is("r")', "tile_is('red')", 'tile_is(r)']) {
      const r = parseCode(`while ${c}:\n    forward()`);
      expect(r.ok && r.program.main[0].kind === 'while' && r.program.main[0].cond).toEqual({ sensor: 'tile_is', colour: 'r' });
    }
  });

  it('names the line of a mistake', () => {
    expect(parseCode('forward()\nfoward()')).toEqual({ ok: false, line: 2, error: '"foward" isn\'t a command' });
    expect(parseCode('repeat 3:\nforward()')).toMatchObject({ ok: false, line: 1 });
    expect(parseCode('forward()\n    jump()')).toMatchObject({ ok: false, line: 2, error: 'unexpected indent' });
    expect(parseCode('else:\n  jump()')).toMatchObject({ ok: false, line: 1 });
    expect(parseCode('repeat 12:\n  jump()')).toMatchObject({ ok: false, line: 1 });
    expect(parseCode('while sees_cat():\n  jump()')).toMatchObject({ ok: false, line: 1 });
  });

  it("keeps to the floor's commands, sensors and slots", () => {
    const f1 = LEVELS[0];
    expect(parseCode('repeat 2:\n  forward()', f1)).toMatchObject({ ok: false, error: "repeat isn't unlocked on this floor" });
    const tooMany = Array(20).fill('forward()').join('\n');
    expect(parseCode(tooMany, f1)).toMatchObject({ ok: false, error: expect.stringContaining('slots') });
    const f31 = LEVELS.find((l) => l.id === 't1-f31')!;
    expect(parseCode('while on_switch():\n  forward()', f31)).toMatchObject({ ok: false, error: "the on_switch sensor isn't on this floor" });
  });
});
