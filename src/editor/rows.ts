// Flattens the program tree into the rows the editor draws (ED-5): a header row for each loop,
// its body indented under it, and a foot row that closes the loop. Every row knows the
// spot just above it and just below it, which is what taps and drops use.

import type { Block } from '../sim/types';
import type { Spot } from '../sim/program';

export type EditorRow =
  | { kind: 'line'; key: string; block: Block; depth: number; line: number; before: Spot; after: Spot }
  | { kind: 'loop'; key: string; block: Extract<Block, { body: Block[] }>; depth: number; line: number; before: Spot; after: Spot }
  | { kind: 'end'; key: string; block: Extract<Block, { body: Block[] }>; depth: number; before: Spot; after: Spot };

export function flatten(blocks: Block[]): EditorRow[] {
  const rows: EditorRow[] = [];
  let line = 0;
  const walk = (list: Block[], parent: string | null, depth: number) => {
    list.forEach((b, index) => {
      const before = { parent, index };
      const after = { parent, index: index + 1 };
      if (b.kind === 'repeat' || b.kind === 'while') {
        // Below a loop's header is the start of its body.
        rows.push({ kind: 'loop', key: b.id, block: b, depth, line: ++line, before, after: { parent: b.id, index: 0 } });
        walk(b.body, b.id, depth + 1);
        // The foot's upper half is the end of the body; its lower half is after the loop.
        rows.push({ kind: 'end', key: `end:${b.id}`, block: b, depth, before: { parent: b.id, index: b.body.length }, after });
      } else {
        rows.push({ kind: 'line', key: b.id, block: b, depth, line: ++line, before, after });
      }
    });
  };
  walk(blocks, null, 0);
  return rows;
}

export const sameSpot = (a: Spot | null | undefined, b: Spot | null | undefined) => !!a && !!b && a.parent === b.parent && a.index === b.index;

/** Ids of a block and everything inside it. */
export function subtreeIds(b: Block): string[] {
  return b.kind === 'repeat' || b.kind === 'while' ? [b.id, ...b.body.flatMap(subtreeIds)] : [b.id];
}
