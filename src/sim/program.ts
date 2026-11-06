import { ACTIONS, FUNCTION_NAMES } from './types';
import type { Action, Block, Condition, FunctionName, PaletteCommand, Program, Routine } from './types';

let counter = 0;
/** Block ids only need to be unique within a session's program. */
export function newId(): string {
  counter = (counter + 1) % 1_000_000;
  return `b${Date.now().toString(36)}${counter.toString(36)}`;
}

export function emptyProgram(): Program {
  return { main: [], F1: [], F2: [], F3: [] };
}

/** Builds a fresh block for a palette command. */
export function makeBlock(cmd: PaletteCommand): Block {
  if ((ACTIONS as readonly string[]).includes(cmd)) return { id: newId(), kind: 'action', action: cmd as Action };
  if ((FUNCTION_NAMES as readonly string[]).includes(cmd)) return { id: newId(), kind: 'call', fn: cmd as FunctionName };
  switch (cmd) {
    case 'repeat':
      return { id: newId(), kind: 'repeat', times: 2, body: [] };
    case 'if':
      return { id: newId(), kind: 'if', cond: { sensor: 'wall_ahead' }, then: [], else: [] };
    case 'while':
      return { id: newId(), kind: 'while', cond: { sensor: 'wall_ahead', not: true }, body: [] };
  }
  throw new Error(`unknown command ${cmd}`);
}

/** CR-7: every block counts, including control blocks and calls. */
export function countBlocks(blocks: Block[]): number {
  let n = 0;
  for (const b of blocks) {
    n += 1;
    if (b.kind === 'repeat' || b.kind === 'while') n += countBlocks(b.body);
    if (b.kind === 'if') n += countBlocks(b.then) + countBlocks(b.else);
  }
  return n;
}

export function countCommands(p: Program): number {
  return (['main', ...FUNCTION_NAMES] as Routine[]).reduce((n, r) => n + countBlocks(p[r]), 0);
}

/**
 * Parses a level's `reference` string. Words are commands; loops use braces:
 * "repeat 3 { forward turn_right } pick_up", and they can nest.
 */
export function parseReference(ref: string): Program {
  const words = ref.replace(/[{}]/g, ' $& ').trim().split(/\s+/).filter(Boolean);
  let i = 0;
  const list = (): Block[] => {
    const out: Block[] = [];
    while (i < words.length && words[i] !== '}') {
      const w = words[i++];
      if (w === 'repeat') {
        const times = Number(words[i++]);
        if (!Number.isInteger(times) || words[i++] !== '{') throw new Error(`bad repeat in reference: ${ref}`);
        const body = list();
        if (words[i++] !== '}') throw new Error(`missing } in reference: ${ref}`);
        out.push({ id: newId(), kind: 'repeat', times, body });
      } else {
        out.push(makeBlock(w as PaletteCommand));
      }
    }
    return out;
  };
  const p = emptyProgram();
  p.main = list();
  if (i < words.length) throw new Error(`unexpected } in reference: ${ref}`);
  return p;
}

function condText(c: Condition): string {
  const s = c.sensor === 'tile_is' ? `tile_is("${c.colour}")` : `${c.sensor}()`;
  return c.not ? `not ${s}` : s;
}

export interface CodeLine {
  text: string;
  blockId: string | null;
}

function blocksToLines(blocks: Block[], indent: number, out: CodeLine[]) {
  const pad = '    '.repeat(indent);
  if (blocks.length === 0) {
    out.push({ text: `${pad}pass`, blockId: null });
    return;
  }
  for (const b of blocks) {
    switch (b.kind) {
      case 'action':
        out.push({ text: `${pad}${b.action}()`, blockId: b.id });
        break;
      case 'call':
        out.push({ text: `${pad}${b.fn}()`, blockId: b.id });
        break;
      case 'repeat':
        out.push({ text: `${pad}repeat ${b.times}:`, blockId: b.id });
        blocksToLines(b.body, indent + 1, out);
        break;
      case 'while':
        out.push({ text: `${pad}while ${condText(b.cond)}:`, blockId: b.id });
        blocksToLines(b.body, indent + 1, out);
        break;
      case 'if':
        out.push({ text: `${pad}if ${condText(b.cond)}:`, blockId: b.id });
        blocksToLines(b.then, indent + 1, out);
        if (b.else.length) {
          out.push({ text: `${pad}else:`, blockId: b.id });
          blocksToLines(b.else, indent + 1, out);
        }
        break;
    }
  }
}

/** ED-9: the read-only Python-like code view. Functions are shown only when used or non-empty. */
export function toCode(p: Program, routines: Routine[] = ['main', ...FUNCTION_NAMES]): CodeLine[] {
  const out: CodeLine[] = [];
  for (const r of routines) {
    if (r !== 'main' && p[r].length === 0) continue;
    if (out.length) out.push({ text: '', blockId: null });
    out.push({ text: `def ${r}():`, blockId: null });
    blocksToLines(p[r], 1, out);
  }
  return out;
}

// --- Editing helpers (pure; the editor keeps history of whole programs) ---
// A program is a tree: repeat and while blocks hold a body (ED-5). A Spot names a place in it:
// `parent` is the id of the loop whose body it's in, or null for the routine's top level.

export interface Spot {
  parent: string | null;
  index: number;
}

/** How deep loops may nest (a loop inside a loop inside a loop). */
export const MAX_DEPTH = 3;

type WithBody = Extract<Block, { body: Block[] }>;
const hasBody = (b: Block): b is WithBody => b.kind === 'repeat' || b.kind === 'while';

/** Finds a block anywhere in the tree. */
export function findBlock(blocks: Block[], id: string): Block | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (hasBody(b)) {
      const f = findBlock(b.body, id);
      if (f) return f;
    }
  }
  return null;
}

/** Where a block sits: its parent loop (or null) and its index there. */
export function spotOf(blocks: Block[], id: string, parent: string | null = null): Spot | null {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.id === id) return { parent, index: i };
    if (hasBody(b)) {
      const f = spotOf(b.body, id, b.id);
      if (f) return f;
    }
  }
  return null;
}

/** The list a spot points into, or null if its parent loop is gone. */
export function listAt(blocks: Block[], parent: string | null): Block[] | null {
  if (parent == null) return blocks;
  const b = findBlock(blocks, parent);
  return b && hasBody(b) ? b.body : null;
}

/** How many loops a spot is inside (top level is 0). */
export function depthOf(blocks: Block[], parent: string | null): number {
  let d = 0;
  let p = parent;
  while (p != null) {
    d++;
    p = spotOf(blocks, p)?.parent ?? null;
  }
  return d;
}

/** How many loop levels a block brings with it (an action is 0, a loop of actions is 1). */
export function loopHeight(b: Block): number {
  return hasBody(b) ? 1 + Math.max(0, ...b.body.map(loopHeight)) : 0;
}

/** Copies the path down to `parent` and applies `edit` to that list. */
function editList(blocks: Block[], parent: string | null, edit: (list: Block[]) => Block[]): Block[] {
  if (parent == null) return edit(blocks);
  return blocks.map((b) => {
    if (!hasBody(b)) return b;
    if (b.id === parent) return { ...b, body: edit(b.body) };
    const body = editList(b.body, parent, edit);
    return body === b.body ? b : { ...b, body };
  });
}

/** Can `block` go at `spot`? Not inside itself, and not deeper than MAX_DEPTH. */
export function canPlace(blocks: Block[], spot: Spot, block: Block): boolean {
  if (!listAt(blocks, spot.parent)) return false;
  for (let p = spot.parent; p != null; p = spotOf(blocks, p)?.parent ?? null) if (p === block.id) return false;
  return depthOf(blocks, spot.parent) + loopHeight(block) <= MAX_DEPTH;
}

export function insertBlock(p: Program, r: Routine, spot: Spot, block: Block): Program {
  return {
    ...p,
    [r]: editList(p[r], spot.parent, (list) => {
      const next = [...list];
      next.splice(Math.max(0, Math.min(spot.index, list.length)), 0, block);
      return next;
    }),
  };
}

export function removeBlock(p: Program, r: Routine, id: string): Program {
  const spot = spotOf(p[r], id);
  if (!spot) return p;
  return { ...p, [r]: editList(p[r], spot.parent, (list) => list.filter((b) => b.id !== id)) };
}

/** Moves a block (with everything inside it) to a spot, read as positions before the move. */
export function moveBlock(p: Program, r: Routine, id: string, to: Spot): Program {
  const from = spotOf(p[r], id);
  const block = findBlock(p[r], id);
  if (!from || !block || !canPlace(p[r], to, block)) return p;
  const index = from.parent === to.parent && from.index < to.index ? to.index - 1 : to.index;
  if (from.parent === to.parent && index === from.index) return p;
  return insertBlock(removeBlock(p, r, id), r, { parent: to.parent, index }, block);
}

/** Replaces one block (for example to change a repeat count). */
export function updateBlock(p: Program, r: Routine, id: string, change: (b: Block) => Block): Program {
  const spot = spotOf(p[r], id);
  if (!spot) return p;
  return { ...p, [r]: editList(p[r], spot.parent, (list) => list.map((b) => (b.id === id ? change(b) : b))) };
}
