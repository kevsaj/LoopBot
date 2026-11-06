// ED-5: editing helpers for programs with loops.
import { describe, expect, it } from 'vitest';
import type { Block, Program } from './types';
import { canPlace, emptyProgram, insertBlock, makeBlock, moveBlock, parseReference, removeBlock, spotOf, toCode, updateBlock } from './program';
import { reducer } from '../editor/useEditor';
import type { EditorState } from '../editor/useEditor';

const code = (p: Program) =>
  toCode(p, ['main'])
    .slice(1)
    .map((l) => l.text.trim())
    .join(' | ');

describe('parseReference with loops', () => {
  it('reads nested repeats', () => {
    const p = parseReference('repeat 2 { forward repeat 3 { turn_left } } jump');
    expect(code(p)).toBe('repeat 2: | forward() | repeat 3: | turn_left() | jump()');
  });
  it('rejects a missing brace', () => {
    expect(() => parseReference('repeat 2 { forward')).toThrow();
  });
});

describe('tree editing', () => {
  const setup = () => {
    const p = parseReference('forward repeat 2 { turn_left } jump');
    const loop = p.main[1] as Extract<Block, { kind: 'repeat' }>;
    return { p, loop };
  };

  it('inserts into a loop body', () => {
    const { p, loop } = setup();
    const next = insertBlock(p, 'main', { parent: loop.id, index: 1 }, makeBlock('forward'));
    expect(code(next)).toBe('forward() | repeat 2: | turn_left() | forward() | jump()');
    expect(code(p)).toBe('forward() | repeat 2: | turn_left() | jump()'); // untouched
  });

  it('moves a line into and out of a loop', () => {
    const { p, loop } = setup();
    const into = moveBlock(p, 'main', p.main[0].id, { parent: loop.id, index: 0 });
    expect(code(into)).toBe('repeat 2: | forward() | turn_left() | jump()');
    const out = moveBlock(into, 'main', loop.body[0].id, { parent: null, index: 2 });
    expect(code(out)).toBe('repeat 2: | forward() | jump() | turn_left()');
  });

  it('moves within one list, reading the target as positions before the move', () => {
    const p = parseReference('forward turn_left jump');
    const next = moveBlock(p, 'main', p.main[0].id, { parent: null, index: 3 });
    expect(code(next)).toBe('turn_left() | jump() | forward()');
  });

  it('never moves a loop inside itself', () => {
    const { p, loop } = setup();
    expect(canPlace(p.main, { parent: loop.id, index: 0 }, loop)).toBe(false);
    expect(moveBlock(p, 'main', loop.id, { parent: loop.id, index: 0 })).toBe(p);
  });

  it('caps nesting at 3 loops deep', () => {
    const p = parseReference('repeat 2 { repeat 2 { repeat 2 { forward } } }');
    const inner = (((p.main[0] as Extract<Block, { kind: 'repeat' }>).body[0] as Extract<Block, { kind: 'repeat' }>).body[0]) as Extract<Block, { kind: 'repeat' }>;
    expect(canPlace(p.main, { parent: inner.id, index: 0 }, makeBlock('forward'))).toBe(true);
    expect(canPlace(p.main, { parent: inner.id, index: 0 }, makeBlock('repeat'))).toBe(false);
  });

  it('removes a loop with its body, and finds blocks by id', () => {
    const { p, loop } = setup();
    expect(spotOf(p.main, loop.body[0].id)).toEqual({ parent: loop.id, index: 0 });
    expect(code(removeBlock(p, 'main', loop.id))).toBe('forward() | jump()');
  });

  it('changes a repeat count', () => {
    const { p, loop } = setup();
    expect(code(updateBlock(p, 'main', loop.id, (b) => ({ ...b, times: 5 }) as Block))).toContain('repeat 5:');
  });
});

describe('editor reducer with loops', () => {
  const fresh = (): EditorState => ({ program: emptyProgram(), past: [], future: [], cursor: {} });

  it('a new loop takes the cursor inside it, and tapping out continues after it', () => {
    let s = fresh();
    s = reducer(s, { t: 'insert', r: 'main', cmd: 'repeat' });
    s = reducer(s, { t: 'insert', r: 'main', cmd: 'forward' });
    s = reducer(s, { t: 'insert', r: 'main', cmd: 'turn_left' });
    s = reducer(s, { t: 'cursor', r: 'main', spot: null });
    s = reducer(s, { t: 'insert', r: 'main', cmd: 'jump' });
    expect(code(s.program)).toBe('repeat 2: | forward() | turn_left() | jump()');
  });

  it('deleting the loop the cursor is in sends the cursor to the end', () => {
    let s = fresh();
    s = reducer(s, { t: 'insert', r: 'main', cmd: 'repeat' });
    const id = s.program.main[0].id;
    s = reducer(s, { t: 'remove', r: 'main', id });
    expect(s.cursor.main).toBeNull();
    s = reducer(s, { t: 'insert', r: 'main', cmd: 'forward' });
    expect(code(s.program)).toBe('forward()');
    s = reducer(s, { t: 'undo' });
    s = reducer(s, { t: 'undo' });
    expect(code(s.program)).toBe('repeat 2: | pass');
  });
});
