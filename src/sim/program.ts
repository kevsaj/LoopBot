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

/** Parses a level's flat `reference` string, e.g. "pick_up forward forward drop". */
export function parseReference(ref: string): Program {
  const p = emptyProgram();
  p.main = ref
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => makeBlock(w as PaletteCommand));
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

export function insertAt(p: Program, r: Routine, index: number, block: Block): Program {
  const list = [...p[r]];
  list.splice(index, 0, block);
  return { ...p, [r]: list };
}

export function removeAt(p: Program, r: Routine, index: number): Program {
  const list = [...p[r]];
  list.splice(index, 1);
  return { ...p, [r]: list };
}

export function move(p: Program, r: Routine, from: number, to: number): Program {
  const list = [...p[r]];
  const [b] = list.splice(from, 1);
  list.splice(to, 0, b);
  return { ...p, [r]: list };
}
