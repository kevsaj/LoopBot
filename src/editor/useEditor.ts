// Editor state: the program, a cursor per routine, and unlimited undo/redo (ED-4).
// Every change autosaves to local storage (ED-7). Runs never touch this state (ED-15).

import { useCallback, useEffect, useReducer } from 'react';
import type { Block, Condition, PaletteCommand, Program, Routine } from '../sim/types';
import type { Spot } from '../sim/program';
import { emptyProgram, insertBlock, parseReference, isContainer, listAt, makeBlock, moveBlock, removeBlock, spotOf, updateBlock } from '../sim/program';

export interface EditorState {
  program: Program;
  past: Program[];
  future: Program[];
  /** Insert position per routine; null means "end of the program" (ED-1). It can sit inside a loop. */
  cursor: Partial<Record<Routine, Spot | null>>;
}

type Act =
  | { t: 'insert'; r: Routine; cmd: PaletteCommand }
  | { t: 'place'; r: Routine; spot: Spot; block: Block }
  | { t: 'remove'; r: Routine; id: string }
  | { t: 'move'; r: Routine; id: string; to: Spot }
  | { t: 'times'; r: Routine; id: string; times: number }
  | { t: 'cond'; r: Routine; id: string; cond: Condition }
  | { t: 'set'; program: Program }
  | { t: 'clear' }
  | { t: 'cursor'; r: Routine; spot: Spot | null }
  | { t: 'undo' }
  | { t: 'redo' };

const HISTORY_CAP = 300;

function commit(s: EditorState, program: Program, cursor = s.cursor): EditorState {
  return { program, past: [...s.past, s.program].slice(-HISTORY_CAP), future: [], cursor };
}

/** Keeps a cursor pointing at the same place after a block is added (+1) or removed (-1) at `at`. */
function shift(cur: Spot | null | undefined, at: Spot, delta: 1 | -1): Spot | null {
  if (!cur) return null;
  if (cur.parent !== at.parent) return cur;
  return cur.index > at.index || (delta > 0 && cur.index === at.index) ? { ...cur, index: cur.index + delta } : cur;
}

/** Drops a cursor whose loop no longer exists. */
function valid(p: Program, r: Routine, cur: Spot | null | undefined): Spot | null {
  if (!cur) return null;
  const list = listAt(p[r], cur.parent);
  return list ? { parent: cur.parent, index: Math.min(cur.index, list.length) } : null;
}

export function reducer(s: EditorState, a: Act): EditorState {
  switch (a.t) {
    case 'insert': {
      const cur = valid(s.program, a.r, s.cursor[a.r]);
      const at = cur ?? { parent: null, index: s.program[a.r].length };
      const block = makeBlock(a.cmd);
      const program = insertBlock(s.program, a.r, at, block);
      // A new loop or if takes the cursor inside it, so the next commands go in its body.
      const next: Spot | null = isContainer(block) ? { parent: block.id, index: 0 } : cur ? { ...cur, index: cur.index + 1 } : null;
      return commit(s, program, { ...s.cursor, [a.r]: next });
    }
    case 'place':
      return commit(s, insertBlock(s.program, a.r, a.spot, a.block), { ...s.cursor, [a.r]: shift(s.cursor[a.r], a.spot, 1) });
    case 'remove': {
      const at = spotOf(s.program[a.r], a.id);
      if (!at) return s;
      const program = removeBlock(s.program, a.r, a.id);
      return commit(s, program, { ...s.cursor, [a.r]: valid(program, a.r, shift(s.cursor[a.r], at, -1)) });
    }
    case 'move': {
      const program = moveBlock(s.program, a.r, a.id, a.to);
      return program === s.program ? s : commit(s, program, { ...s.cursor, [a.r]: null });
    }
    case 'times':
      return commit(
        s,
        updateBlock(s.program, a.r, a.id, (b) => (b.kind === 'repeat' ? { ...b, times: a.times } : b)),
      );
    case 'cond':
      return commit(
        s,
        updateBlock(s.program, a.r, a.id, (b) => (b.kind === 'if' || b.kind === 'while' ? { ...b, cond: a.cond } : b)),
      );
    case 'set':
      return commit(s, a.program, {}); // typed code replaces the program, and undo brings the blocks back
    case 'clear':
      return commit(s, emptyProgram(), {}); // ED-6: still reachable through undo
    case 'cursor':
      return { ...s, cursor: { ...s.cursor, [a.r]: a.spot } };
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

/** A new floor starts empty, or, on a bug hunt floor, with the broken program to fix. */
function fresh(starter?: string): EditorState {
  return { program: starter ? parseReference(starter) : emptyProgram(), past: [], future: [], cursor: {} };
}

export function loadEditor(floorId: string, starter?: string): EditorState {
  try {
    const raw = localStorage.getItem(storageKey(floorId));
    if (!raw) return fresh(starter);
    const saved = JSON.parse(raw) as Partial<EditorState>;
    if (!saved.program?.main) return fresh(starter);
    return { program: { ...emptyProgram(), ...saved.program }, past: saved.past ?? [], future: saved.future ?? [], cursor: {} };
  } catch {
    return fresh(starter);
  }
}

/** Undo steps kept on the device per floor. The session itself keeps HISTORY_CAP. */
const SAVED_HISTORY = 40;

/**
 * Saves a floor's editor. Fifty floors of undo history can outgrow the browser's storage, so
 * when a save doesn't fit, other floors' history is dropped (their programs stay), and as a
 * last resort this floor is saved without its history. The program itself is never dropped.
 */
export function saveEditor(floorId: string, s: Pick<EditorState, 'program' | 'past' | 'future'>) {
  const full = JSON.stringify({ program: s.program, past: s.past.slice(-SAVED_HISTORY), future: s.future.slice(0, SAVED_HISTORY) });
  const bare = JSON.stringify({ program: s.program, past: [], future: [] });
  const write = (v: string) => {
    try {
      localStorage.setItem(storageKey(floorId), v);
      return true;
    } catch {
      return false;
    }
  };
  if (write(full)) return;
  trimOtherHistories(floorId);
  if (write(full)) return;
  write(bare);
}

function trimOtherHistories(keep: string) {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith('loopbot.editor.') || k === storageKey(keep)) continue;
      const saved = JSON.parse(localStorage.getItem(k) ?? 'null') as Partial<EditorState> | null;
      if (saved?.program) localStorage.setItem(k, JSON.stringify({ program: saved.program, past: [], future: [] }));
    }
  } catch {
    /* storage blocked: nothing to trim */
  }
}

/** Mount one editor per floor (the floor screen is keyed by floor id). */
export function useEditor(floorId: string, starter?: string) {
  const [state, dispatch] = useReducer(reducer, floorId, (id) => loadEditor(id, starter));

  // ED-7: autosave on every change.
  useEffect(() => {
    saveEditor(floorId, state);
  }, [floorId, state.program, state.past, state.future]);

  return {
    state,
    insert: useCallback((r: Routine, cmd: PaletteCommand) => dispatch({ t: 'insert', r, cmd }), []),
    place: useCallback((r: Routine, spot: Spot, block: Block) => dispatch({ t: 'place', r, spot, block }), []),
    remove: useCallback((r: Routine, id: string) => dispatch({ t: 'remove', r, id }), []),
    move: useCallback((r: Routine, id: string, to: Spot) => dispatch({ t: 'move', r, id, to }), []),
    setTimes: useCallback((r: Routine, id: string, times: number) => dispatch({ t: 'times', r, id, times }), []),
    setCond: useCallback((r: Routine, id: string, cond: Condition) => dispatch({ t: 'cond', r, id, cond }), []),
    setProgram: useCallback((program: Program) => dispatch({ t: 'set', program }), []),
    clear: useCallback(() => dispatch({ t: 'clear' }), []),
    setCursor: useCallback((r: Routine, spot: Spot | null) => dispatch({ t: 'cursor', r, spot }), []),
    undo: useCallback(() => dispatch({ t: 'undo' }), []),
    redo: useCallback(() => dispatch({ t: 'redo' }), []),
  };
}
