// Editor state: the program, a cursor per routine, and unlimited undo/redo (ED-4).
// Every change autosaves to local storage (ED-7). Runs never touch this state (ED-15).

import { useCallback, useEffect, useReducer } from 'react';
import type { Block, PaletteCommand, Program, Routine } from '../sim/types';
import { emptyProgram, insertAt, makeBlock, move, removeAt } from '../sim/program';

export interface EditorState {
  program: Program;
  past: Program[];
  future: Program[];
  /** Insert position per routine; null means "end of the program" (ED-1). */
  cursor: Partial<Record<Routine, number | null>>;
}

type Act =
  | { t: 'insert'; r: Routine; cmd: PaletteCommand }
  | { t: 'restore'; r: Routine; index: number; block: Block }
  | { t: 'remove'; r: Routine; index: number }
  | { t: 'move'; r: Routine; from: number; to: number }
  | { t: 'clear' }
  | { t: 'cursor'; r: Routine; index: number | null }
  | { t: 'undo' }
  | { t: 'redo' };

const HISTORY_CAP = 300;

function commit(s: EditorState, program: Program, cursor = s.cursor): EditorState {
  return { program, past: [...s.past, s.program].slice(-HISTORY_CAP), future: [], cursor };
}

function clampCursor(s: EditorState, r: Routine, delta: number, at: number): EditorState['cursor'] {
  const c = s.cursor[r];
  if (c == null) return s.cursor;
  return { ...s.cursor, [r]: c > at || (delta > 0 && c === at) ? c + delta : c };
}

function reducer(s: EditorState, a: Act): EditorState {
  switch (a.t) {
    case 'insert': {
      const list = s.program[a.r];
      const at = s.cursor[a.r] ?? list.length;
      const next = commit(s, insertAt(s.program, a.r, at, makeBlock(a.cmd)));
      next.cursor = s.cursor[a.r] == null ? s.cursor : { ...s.cursor, [a.r]: at + 1 };
      return next;
    }
    case 'restore':
      return commit(s, insertAt(s.program, a.r, Math.min(a.index, s.program[a.r].length), a.block), clampCursor(s, a.r, 1, a.index));
    case 'remove':
      return commit(s, removeAt(s.program, a.r, a.index), clampCursor(s, a.r, -1, a.index));
    case 'move':
      if (a.from === a.to) return s;
      return commit(s, move(s.program, a.r, a.from, a.to));
    case 'clear':
      return commit(s, emptyProgram(), {}); // ED-6: still reachable through undo
    case 'cursor':
      return { ...s, cursor: { ...s.cursor, [a.r]: a.index } };
    case 'undo': {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      return { program: prev, past: s.past.slice(0, -1), future: [s.program, ...s.future], cursor: {} };
    }
    case 'redo': {
      if (!s.future.length) return s;
      const [next, ...rest] = s.future;
      return { program: next, past: [...s.past, s.program], future: rest, cursor: {} };
    }
  }
}

const storageKey = (floorId: string) => `loopbot.editor.${floorId}`;

function fresh(): EditorState {
  return { program: emptyProgram(), past: [], future: [], cursor: {} };
}

export function loadEditor(floorId: string): EditorState {
  try {
    const raw = localStorage.getItem(storageKey(floorId));
    if (!raw) return fresh();
    const saved = JSON.parse(raw) as Partial<EditorState>;
    if (!saved.program?.main) return fresh();
    return { program: { ...emptyProgram(), ...saved.program }, past: saved.past ?? [], future: saved.future ?? [], cursor: {} };
  } catch {
    return fresh();
  }
}

/** Mount one editor per floor (the floor screen is keyed by floor id). */
export function useEditor(floorId: string) {
  const [state, dispatch] = useReducer(reducer, floorId, loadEditor);

  // ED-7: autosave on every change.
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey(floorId),
        JSON.stringify({ program: state.program, past: state.past.slice(-100), future: state.future.slice(0, 100) }),
      );
    } catch {
      /* storage full or blocked: the session keeps working */
    }
  }, [floorId, state.program, state.past, state.future]);

  return {
    state,
    insert: useCallback((r: Routine, cmd: PaletteCommand) => dispatch({ t: 'insert', r, cmd }), []),
    restore: useCallback((r: Routine, index: number, block: Block) => dispatch({ t: 'restore', r, index, block }), []),
    remove: useCallback((r: Routine, index: number) => dispatch({ t: 'remove', r, index }), []),
    move: useCallback((r: Routine, from: number, to: number) => dispatch({ t: 'move', r, from, to }), []),
    clear: useCallback(() => dispatch({ t: 'clear' }), []),
    setCursor: useCallback((r: Routine, index: number | null) => dispatch({ t: 'cursor', r, index }), []),
    undo: useCallback(() => dispatch({ t: 'undo' }), []),
    redo: useCallback(() => dispatch({ t: 'redo' }), []),
  };
}
