// The program as visible slots (LS-1): filled lines, a dashed insert cursor, and empty boxes up to the limit.
// Loops show as a header, their body indented under it, and a foot that closes them (ED-5).
// Tap a line to move the cursor (ED-2), long-press and drag to move it (ED-2), swipe left to delete (ED-3).
// The drag context itself lives in dnd.tsx, so palette commands can be dropped in here too.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Block } from '../sim/types';
import type { Spot } from '../sim/program';
import { countBlocks, findBlock } from '../sim/program';
import { COMMAND_META, blockCommand } from './commands';
import type { DropData } from './dnd';
import { EMPTY_PREFIX, LIST_ID, useDragState } from './dnd';
import type { EditorRow } from './rows';
import { flatten, sameSpot, subtreeIds } from './rows';

interface Props {
  blocks: Block[];
  limit: number;
  cursor: Spot | null;
  activeIds: Set<string>;
  crashId: string | null;
  /** Put the cursor somewhere; null is the end of the program. */
  onCursor(spot: Spot | null): void;
  onDelete(id: string): void;
  onMove(id: string, to: Spot): void;
  onTimes(id: string, times: number): void;
}

const SWIPE_DELETE_PX = 72;
export const MIN_TIMES = 2;
export const MAX_TIMES = 9;

export function Tile({ block, line, lifted }: { block: Block; line?: number; lifted?: boolean }) {
  const meta = COMMAND_META[blockCommand(block)];
  const inside = block.kind === 'repeat' || block.kind === 'while' ? countBlocks(block.body) : 0;
  return (
    <span className={`line-tile tone-${meta.tone}${lifted ? ' lifted' : ''}`}>
      {line != null && <span className="line-no">{line}</span>}
      <span className="glyph" aria-hidden="true">
        {meta.glyph}
      </span>
      <span className="line-label">{meta.label}</span>
      {lifted && block.kind === 'repeat' && (
        <span className="line-arg">
          × {block.times}
          {inside ? ` · ${inside} inside` : ''}
        </span>
      )}
    </span>
  );
}

/** A program line or a loop header: tap, swipe to delete, long-press to drag. */
function LineRow({
  row,
  active,
  crashed,
  dimmed,
  onTap,
  onDelete,
  onNudge,
  extra,
}: {
  row: Extract<EditorRow, { kind: 'line' | 'loop' }>;
  active: boolean;
  crashed: boolean;
  dimmed: boolean;
  onTap(): void;
  onDelete(): void;
  /** Alt+Up / Alt+Down: move this line one place, for keyboard users. */
  onNudge(dir: -1 | 1): void;
  extra?: ReactNode;
}) {
  const { block } = row;
  const drag = useDraggable({ id: block.id });
  const drop = useDroppable({ id: block.id, data: { before: row.before, after: row.after } satisfies DropData });
  const [dx, setDx] = useState(0);
  const self = useRef<HTMLLIElement | null>(null);
  // Keep the running (or crashing) line in view on a small screen.
  useEffect(() => {
    if (active || crashed) self.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [active, crashed]);
  const [leaving, setLeaving] = useState(false);
  const gesture = useRef<{ x: number; y: number; id: number; swiping: boolean; moved: boolean } | null>(null);
  const dragging = drag.isDragging;

  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    gesture.current = { x: e.clientX, y: e.clientY, id: e.pointerId, swiping: false, moved: false };
  };
  const moveP = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId || dragging) return;
    const ddx = e.clientX - g.x;
    const ddy = e.clientY - g.y;
    if (!g.swiping && Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy) * 1.5) {
      g.swiping = true;
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    }
    if (Math.abs(ddx) > 6 || Math.abs(ddy) > 6) g.moved = true;
    if (g.swiping) setDx(Math.min(0, ddx));
  };
  const up = (e: PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.id !== e.pointerId) return;
    if (g.swiping) {
      if (dx < -SWIPE_DELETE_PX) {
        setLeaving(true);
        setDx(-400);
        window.setTimeout(onDelete, 140);
      } else {
        setDx(0);
      }
    } else if (!g.moved && !dragging) {
      onTap();
    }
  };
  const cancel = () => {
    gesture.current = null;
    setDx(0);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onTap();
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      onNudge(e.key === 'ArrowUp' ? -1 : 1);
    }
  };

  const armed = dx < -SWIPE_DELETE_PX;
  const label = COMMAND_META[blockCommand(block)].label + (block.kind === 'repeat' ? ` ${block.times} times` : '');
  return (
    <li
      ref={(el) => {
        drop.setNodeRef(el);
        self.current = el;
      }}
      style={{ ['--depth' as string]: row.depth }}
      className={`row${row.depth ? ' nested' : ''}${row.kind === 'loop' ? ' loop-head' : ''}${dragging || dimmed ? ' placeholder' : ''}${active ? ' active' : ''}${crashed ? ' crashed' : ''}`}
      onPointerDown={down}
      onPointerMove={moveP}
      onPointerUp={up}
      onPointerCancel={cancel}
    >
      <span className={`swipe-bg${armed ? ' armed' : ''}`} aria-hidden="true">
        Delete
      </span>
      <button
        ref={drag.setNodeRef}
        type="button"
        className="row-btn"
        style={{ transform: `translateX(${dx}px)`, transition: gesture.current?.swiping ? 'none' : 'transform 160ms ease', opacity: leaving ? 0 : 1 }}
        aria-label={`Line ${row.line}: ${label}. Enter to put the cursor ${row.kind === 'loop' ? 'inside the loop' : 'after it'}, Delete to remove, Alt and arrow keys to move.`}
        {...drag.attributes}
        {...drag.listeners}
        onKeyDown={key}
      >
        <Tile block={block} line={row.line} />
      </button>
      {extra}
    </li>
  );
}

/** − 3 + on a repeat header. Kept outside the line button so it never starts a drag or a swipe. */
function Times({ times, onChange }: { times: number; onChange(n: number): void }) {
  const stop = (e: PointerEvent) => e.stopPropagation();
  return (
    <span className="times" onPointerDown={stop} onPointerUp={stop}>
      <button type="button" aria-label="Fewer times" disabled={times <= MIN_TIMES} onClick={() => onChange(times - 1)}>
        −
      </button>
      <span className="times-n" aria-live="polite">
        ×{times}
      </span>
      <button type="button" aria-label="More times" disabled={times >= MAX_TIMES} onClick={() => onChange(times + 1)}>
        +
      </button>
    </span>
  );
}

/** The foot of a loop. Tapping it moves the cursor out of the loop (or into it, while it's empty). */
function EndRow({ row, dimmed, onTap }: { row: Extract<EditorRow, { kind: 'end' }>; dimmed: boolean; onTap(): void }) {
  const drop = useDroppable({ id: row.key, data: { before: row.before, after: row.after } satisfies DropData });
  const empty = row.block.body.length === 0;
  return (
    <li
      ref={drop.setNodeRef}
      style={{ ['--depth' as string]: row.depth }}
      className={`row loop-foot${empty || row.depth ? ' nested' : ''}${empty ? ' empty' : ''}${dimmed ? ' placeholder' : ''}`}
    >
      <button
        type="button"
        className="row-btn"
        onClick={onTap}
        aria-label={empty ? 'Empty loop. Tap to add commands inside it.' : 'End of loop. Tap to add commands after the loop.'}
      >
        {empty ? 'Drop or tap commands into the loop' : ''}
      </button>
    </li>
  );
}

function Cursor({ drop, depth }: { drop?: boolean; depth: number }) {
  return <li className={`cursor${drop ? ' drop' : ''}`} style={{ ['--depth' as string]: depth }} aria-hidden="true" />;
}

function EmptySlot({ n, onTap }: { n: number; onTap(): void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${EMPTY_PREFIX}${n}` });
  return (
    <li ref={setNodeRef} className={`row empty-slot${isOver ? ' over' : ''}`}>
      <button type="button" className="row-btn" onClick={onTap} aria-label="Empty slot. Tap to add commands at the end.">
        <span className="line-no">{n}</span>
      </button>
    </li>
  );
}

export function ProgramList({ blocks, limit, cursor, activeIds, crashId, onCursor, onDelete, onMove, onTimes }: Props) {
  const { dragId, fromPalette, dropSpot } = useDragState();
  const { setNodeRef } = useDroppable({ id: LIST_ID });
  const rows = useMemo(() => flatten(blocks), [blocks]);
  const used = countBlocks(blocks);
  const empty = Math.max(0, limit - used);
  const room = used < limit;
  // While dragging, the line follows your finger; otherwise it marks the tap cursor.
  const lineAt: Spot | null = dragId ? (fromPalette && !room ? null : dropSpot) : (cursor ?? { parent: null, index: blocks.length });
  // A loop being dragged takes its body with it, so dim all of it.
  const dimmed = useMemo(() => {
    const b = dragId && !fromPalette ? findBlock(blocks, dragId) : null;
    return new Set(b ? subtreeIds(b) : []);
  }, [blocks, dragId, fromPalette]);

  const nudge = (row: Extract<EditorRow, { kind: 'line' | 'loop' }>, dir: -1 | 1) => {
    const to = { parent: row.before.parent, index: row.before.index + (dir < 0 ? -1 : 2) };
    if (to.index >= 0) onMove(row.block.id, to);
  };

  return (
    <ol ref={setNodeRef} className={`program${fromPalette ? (room ? ' receiving' : ' no-room') : ''}`} aria-label="Program">
      {rows.map((row) => {
        const here = sameSpot(lineAt, row.before) ? (
          <Cursor key={`c-${row.key}`} drop={!!dragId} depth={row.kind === 'end' ? row.depth + 1 : row.depth} />
        ) : null;
        if (row.kind === 'end') {
          const inside = row.block.body.length === 0;
          return (
            <Fragment key={row.key}>
              {here}
              <EndRow
                row={row}
                dimmed={dimmed.has(row.block.id)}
                onTap={() => onCursor(inside ? row.before : row.after.parent == null && row.after.index === blocks.length ? null : row.after)}
              />
            </Fragment>
          );
        }
        const { block } = row;
        return (
          <Fragment key={row.key}>
            {here}
            <LineRow
              row={row}
              active={activeIds.has(block.id)}
              crashed={crashId === block.id}
              dimmed={dimmed.has(block.id)}
              // A line puts the cursor after it; a loop header puts it at the end of the loop's body.
              onTap={() =>
                onCursor(
                  row.kind === 'loop'
                    ? { parent: block.id, index: row.block.body.length }
                    : row.after.parent == null && row.after.index === blocks.length
                      ? null
                      : row.after,
                )
              }
              onDelete={() => onDelete(block.id)}
              onNudge={(dir) => nudge(row, dir)}
              extra={block.kind === 'repeat' ? <Times times={block.times} onChange={(n) => onTimes(block.id, n)} /> : undefined}
            />
          </Fragment>
        );
      })}
      {sameSpot(lineAt, { parent: null, index: blocks.length }) && <Cursor drop={!!dragId} depth={0} />}
      {Array.from({ length: empty }, (_, i) => (
        <EmptySlot key={`empty-${i}`} n={used + i + 1} onTap={() => onCursor(null)} />
      ))}
    </ol>
  );
}

function Fragment({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
