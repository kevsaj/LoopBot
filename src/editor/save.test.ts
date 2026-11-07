import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEditor, saveEditor } from './useEditor';
import { parseReference } from '../sim/program';

/** A localStorage stand-in that refuses writes past `quota` characters in total. */
function fakeStorage(quota: number) {
  const data = new Map<string, string>();
  const used = () => [...data].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      const before = data.get(k);
      data.set(k, v);
      if (used() > quota) {
        if (before === undefined) data.delete(k);
        else data.set(k, before);
        throw new DOMException('full', 'QuotaExceededError');
      }
    },
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
}

const program = parseReference('repeat 3 { forward turn_left } jump');
const history = Array.from({ length: 40 }, () => program);

afterEach(() => vi.unstubAllGlobals());

describe('editor autosave (ED-7)', () => {
  it('saves and loads a program with its undo history', () => {
    vi.stubGlobal('localStorage', fakeStorage(1_000_000));
    saveEditor('t1-f01', { program, past: history, future: [] });
    const back = loadEditor('t1-f01');
    expect(back.program).toEqual(program);
    expect(back.past).toHaveLength(40);
  });

  it('drops other floors’ history, never a program, when storage is full', () => {
    const one = JSON.stringify({ program, past: history, future: [] }).length;
    vi.stubGlobal('localStorage', fakeStorage(one * 2.5));
    saveEditor('t1-f01', { program, past: history, future: [] });
    saveEditor('t1-f02', { program, past: history, future: [] });
    saveEditor('t1-f03', { program, past: history, future: [] }); // does not fit beside the other two
    for (const id of ['t1-f01', 't1-f02', 't1-f03']) expect(loadEditor(id).program).toEqual(program);
    expect(loadEditor('t1-f03').past).toHaveLength(40);
    expect(loadEditor('t1-f01').past).toHaveLength(0);
  });

  it('keeps the program even when its history alone is too big', () => {
    const bare = JSON.stringify({ program, past: [], future: [] }).length;
    vi.stubGlobal('localStorage', fakeStorage(bare + 40));
    saveEditor('t1-f01', { program, past: history, future: [] });
    expect(loadEditor('t1-f01').program).toEqual(program);
  });
});
