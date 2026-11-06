// Flattens the program tree into the rows the editor draws (ED-5): a header row for each loop or
// if, its body indented under it, an "else" row splitting an if's two branches, and a foot row
// that closes the block. Every row knows the spot just above it and just below it, which is
// what taps and drops use.

import type { Block } from '../sim/types';
import type { Container, Spot } from '../sim/program';
import { childLists, elseKey, isContainer } from '../sim/program';

export type EditorRow =
  | { kind: 'line'; key: string; block: Block; depth: number; line: number; before: Spot; after: Spot }
  | { kind: 'loop'; key: string; block: Container; depth: number; line: number; before: Spot; after: Spot }
  | { kind: 'else'; key: string; block: Extract<Block, { kind: 'if' }>; depth: number; before: Spot; after: Spot }
  | { kind: 'end'; key: string; block: Container; depth: number; before: Spot; after: Spot };

export function flatten(blocks: Block[]): EditorRow[] {
  const rows: EditorRow[] = [];
  let line = 0;
  const walk = (list: Block[], parent: string | null, depth: number) => {
    list.forEach((b, index) => {
      const before = { parent, index };
      const after = { parent, index: index + 1 };
      if (isContainer(b)) {
        // Below a header is the start of its (first) body.
        rows.push({ kind: 'loop', key: b.id, block: b, depth, line: ++line, before, after: { parent: b.id, index: 0 } });
        const lists = childLists(b);
        lists.forEach((c, i) => {
          if (i > 0 && b.kind === 'if') {
            // The else row: its upper half ends the then branch, its lower half starts the else branch.
            const prev = lists[i - 1];
            rows.push({ kind: 'else', key: `else:${b.id}`, block: b, depth, before: { parent: prev.key, index: prev.list.length }, after: { parent: elseKey(b.id), index: 0 } });
          }
          walk(c.list, c.key, depth + 1);
        });
        // The foot's upper half is the end of the last body; its lower half is after the block.
        const last = lists[lists.length - 1];
        rows.push({ kind: 'end', key: `end:${b.id}`, block: b, depth, before: { parent: last.key, index: last.list.length }, after });
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
  return [b.id, ...childLists(b).flatMap((c) => c.list.flatMap(subtreeIds))];
}
