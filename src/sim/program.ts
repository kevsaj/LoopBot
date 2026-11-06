import { ACTIONS, FUNCTION_NAMES, SENSORS } from './types';
import type { Action, Block, Colour, Condition, FunctionName, PaletteCommand, Program, Routine, Sensor } from './types';

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
 * Function bodies come after main: "F1 turn_right F1 def F1 { forward jump }".
 * Conditions: "while not wall_ahead { forward }", "if tile_is r { turn_left } else { forward }".
 */
export function parseReference(ref: string): Program {
  const words = ref.replace(/[{}]/g, ' $& ').trim().split(/\s+/).filter(Boolean);
  let i = 0;
  // "not wall_ahead {", "on_switch {", "tile_is r {"
  const condition = (): Condition => {
    const not = words[i] === 'not';
    if (not) i++;
    const sensor = words[i++] as Sensor;
    if (!(SENSORS as readonly string[]).includes(sensor)) throw new Error(`unknown sensor ${sensor} in reference: ${ref}`);
    const cond: Condition = { sensor };
    if (sensor === 'tile_is') cond.colour = words[i++] as Colour;
    if (not) cond.not = true;
    return cond;
  };
  const braced = (): Block[] => {
    if (words[i++] !== '{') throw new Error(`missing { in reference: ${ref}`);
    const body = list();
    if (words[i++] !== '}') throw new Error(`missing } in reference: ${ref}`);
    return body;
  };
  const list = (): Block[] => {
    const out: Block[] = [];
    while (i < words.length && words[i] !== '}' && words[i] !== 'def') {
      const w = words[i++];
      if (w === 'repeat') {
        const times = Number(words[i++]);
        if (!Number.isInteger(times)) throw new Error(`bad repeat in reference: ${ref}`);
        out.push({ id: newId(), kind: 'repeat', times, body: braced() });
      } else if (w === 'while') {
        const cond = condition();
        out.push({ id: newId(), kind: 'while', cond, body: braced() });
      } else if (w === 'if') {
        const cond = condition();
        const then = braced();
        let other: Block[] = [];
        if (words[i] === 'else') {
          i++;
          if (words[i++] !== '{') throw new Error(`bad else in reference: ${ref}`);
          other = list();
          if (words[i++] !== '}') throw new Error(`missing } in reference: ${ref}`);
        }
        out.push({ id: newId(), kind: 'if', cond, then, else: other });
      } else {
        out.push(makeBlock(w as PaletteCommand));
      }
    }
    return out;
  };
  const p = emptyProgram();
  p.main = list();
  // Function bodies follow main: "F1 F1 def F1 { forward jump }"
  while (words[i] === 'def') {
    const name = words[i + 1] as FunctionName;
    if (!(FUNCTION_NAMES as readonly string[]).includes(name) || words[i + 2] !== '{') throw new Error(`bad def in reference: ${ref}`);
    i += 3;
    p[name] = list();
    if (words[i++] !== '}') throw new Error(`missing } in reference: ${ref}`);
  }
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
// A program is a tree: repeat and while blocks hold a body, and an if holds a then list and an
// else list (ED-5). A Spot names a place in it: `parent` is the key of the list it's in, or null
// for the routine's top level. A list's key is its block's id, or "<id>:else" for an if's else.

export interface Spot {
  parent: string | null;
  index: number;
}

/** How deep blocks may nest (a loop inside a loop inside a loop). */
export const MAX_DEPTH = 3;

export type Container = Extract<Block, { kind: 'repeat' | 'while' | 'if' }>;
export const isContainer = (b: Block): b is Container => b.kind === 'repeat' || b.kind === 'while' || b.kind === 'if';

const ELSE = ':else';
/** The block a list key belongs to. */
export const ownerOf = (key: string) => (key.endsWith(ELSE) ? key.slice(0, -ELSE.length) : key);
export const elseKey = (id: string) => id + ELSE;

/** The lists inside a block, with their keys. */
export function childLists(b: Block): { key: string; list: Block[] }[] {
  if (b.kind === 'repeat' || b.kind === 'while') return [{ key: b.id, list: b.body }];
  if (b.kind === 'if') return [{ key: b.id, list: b.then }, { key: elseKey(b.id), list: b.else }];
  return [];
}

function withList(b: Block, key: string, list: Block[]): Block {
  if (b.kind === 'repeat' || b.kind === 'while') return { ...b, body: list };
  if (b.kind === 'if') return key === b.id ? { ...b, then: list } : { ...b, else: list };
  return b;
}

/** Finds a block anywhere in the tree. */
export function findBlock(blocks: Block[], id: string): Block | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    for (const c of childLists(b)) {
      const f = findBlock(c.list, id);
      if (f) return f;
    }
  }
  return null;
}

/** Where a block sits: the key of its list (or null) and its index there. */
export function spotOf(blocks: Block[], id: string, parent: string | null = null): Spot | null {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.id === id) return { parent, index: i };
    for (const c of childLists(b)) {
      const f = spotOf(c.list, id, c.key);
      if (f) return f;
    }
  }
  return null;
}

/** The list a spot points into, or null if its block is gone. */
export function listAt(blocks: Block[], parent: string | null): Block[] | null {
  if (parent == null) return blocks;
  const b = findBlock(blocks, ownerOf(parent));
  return b ? (childLists(b).find((c) => c.key === parent)?.list ?? null) : null;
}

/** How many blocks a spot is inside (top level is 0). */
export function depthOf(blocks: Block[], parent: string | null): number {
  let d = 0;
  let p = parent;
  while (p != null) {
    d++;
    p = spotOf(blocks, ownerOf(p))?.parent ?? null;
  }
  return d;
}

/** How many nesting levels a block brings with it (an action is 0, a loop of actions is 1). */
export function loopHeight(b: Block): number {
  return isContainer(b) ? 1 + Math.max(0, ...childLists(b).flatMap((c) => c.list.map(loopHeight))) : 0;
}

/** Copies the path down to the list `parent` and applies `edit` to it. */
function editList(blocks: Block[], parent: string | null, edit: (list: Block[]) => Block[]): Block[] {
  if (parent == null) return edit(blocks);
  return blocks.map((b) => {
    let out = b;
    for (const c of childLists(b)) {
      const list = c.key === parent ? edit(c.list) : editList(c.list, parent, edit);
      if (list !== c.list) out = withList(out, c.key, list);
    }
    return out;
  });
}

/** Can `block` go at `spot`? Not inside itself, and not deeper than MAX_DEPTH. */
export function canPlace(blocks: Block[], spot: Spot, block: Block): boolean {
  if (!listAt(blocks, spot.parent)) return false;
  for (let p = spot.parent; p != null; p = spotOf(blocks, ownerOf(p))?.parent ?? null) if (ownerOf(p) === block.id) return false;
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
