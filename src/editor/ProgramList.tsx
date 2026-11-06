// The program as visible slots (LS-1): filled lines, a dashed insert cursor, and empty boxes up to the limit.
// Tap a line to move the cursor (ED-2), long-press and drag to reorder (ED-2), swipe left to delete (ED-3).
// The drag context itself lives in dnd.tsx, so palette commands can be dropped in here too.

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block } from '../sim/types';
import { COMMAND_META, blockCommand } from './commands';
import { EMPTY_PREFIX, LIST_ID, useDragState } from './dnd';

interface Props {
  blocks: Block[];
  limit: number;
  cursor: number | null;
  activeIds: Set<string>;
  crashId: string | null;
  onTap(index: number): void;
  onTapEnd(): void;
  onDelete(index: number): void;
}

const SWIPE_DELETE_PX = 72;

export function Tile({ block, index, lifted }: { block: Block; index: number; lifted?: boolean }) {
  const meta = COMMAND_META[blockCommand(block)];
  return (
    <span className={`line-tile tone-${meta.tone}${lifted ? ' lifted' : ''}`}>
      <span className="line-no">{index + 1}</span>
      <span className="glyph" aria-hidden="true">
        {meta.glyph}
      </span>
      <span className="line-label">{meta.label}</span>
      {block.kind === 'repeat' && <span className="line-arg">× {block.times}</span>}
    </span>
  );
}

function Row({
  block,
  index,
  active,
  crashed,
  onTap,
  onDelete,
}: {
  block: Block;
  index: number;
  active: boolean;
  crashed: boolean;
  onTap(): void;
  onDelete(): void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  // A command dragged in from the palette shows a drop line instead of shuffling the rows.
  const { fromPalette } = useDragState();
  const [dx, setDx] = useState(0);
  const self = useRef<HTMLLIElement | null>(null);
  // Keep the running (or crashing) line in view on a small screen.
  useEffect(() => {
    if (active || crashed) self.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [active, crashed]);
  const [leaving, setLeaving] = useState(false);
  const gesture = useRef<{ x: number; y: number; id: number; swiping: boolean; moved: boolean } | null>(null);

  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    gesture.current = { x: e.clientX, y: e.clientY, id: e.pointerId, swiping: false, moved: false };
  };
  const moveP = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId || isDragging) return;
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
    } else if (!g.moved && !isDragging) {
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
    } else {
      listeners?.onKeyDown?.(e);
    }
  };

  const style = {
    transform: fromPalette ? undefined : CSS.Transform.toString(transform),
    transition: fromPalette ? undefined : transition,
  };
  const armed = dx < -SWIPE_DELETE_PX;
  return (
    <li
      ref={(el) => {
        setNodeRef(el);
        self.current = el;
      }}
      style={style}
      className={`row${isDragging ? ' placeholder' : ''}${active ? ' active' : ''}${crashed ? ' crashed' : ''}`}
      onPointerDown={down}
      onPointerMove={moveP}
      onPointerUp={up}
      onPointerCancel={cancel}
    >
      <span className={`swipe-bg${armed ? ' armed' : ''}`} aria-hidden="true">
        Delete
      </span>
      <button
        type="button"
        className="row-btn"
        style={{ transform: `translateX(${dx}px)`, transition: gesture.current?.swiping ? 'none' : 'transform 160ms ease', opacity: leaving ? 0 : 1 }}
        aria-label={`Line ${index + 1}: ${COMMAND_META[blockCommand(block)].label}. Enter to put the cursor after it, Delete to remove, Space to pick up and move.`}
        {...attributes}
        {...listeners}
        onKeyDown={key}
      >
        <Tile block={block} index={index} />
      </button>
    </li>
  );
}

function Cursor({ drop }: { drop?: boolean }) {
  return <li className={`cursor${drop ? ' drop' : ''}`} aria-hidden="true" />;
}

function EmptySlot({ n, onTap }: { n: number; onTap(): void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${EMPTY_PREFIX}${n}` });
  return (
    <li ref={setNodeRef} className={`row empty-slot${isOver ? ' over' : ''}`}>
      <button type="button" className="row-btn" onClick={onTap} aria-label="Empty slot. Tap to add commands at the end.">
        <span className="line-no">{n + 1}</span>
      </button>
    </li>
  );
}

export function ProgramList({ blocks, limit, cursor, activeIds, crashId, onTap, onTapEnd, onDelete }: Props) {
  const { dragId, fromPalette, dropIndex } = useDragState();
  const { setNodeRef } = useDroppable({ id: LIST_ID });
  const cur = cursor ?? blocks.length;
  const empty = Math.max(0, limit - blocks.length);
  const room = blocks.length < limit;
  // While dragging from the palette the dashed line follows your finger; otherwise it marks the tap cursor.
  const lineAt = fromPalette ? (room ? dropIndex : null) : dragId ? null : cur;

  return (
    <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
      <ol ref={setNodeRef} className={`program${fromPalette ? (room ? ' receiving' : ' no-room') : ''}`} aria-label="Program">
        {blocks.map((b, i) => (
          <FragmentRow key={b.id} cursor={lineAt === i} drop={fromPalette}>
            <Row
              block={b}
              index={i}
              active={activeIds.has(b.id)}
              crashed={crashId === b.id}
              onTap={() => onTap(i)}
              onDelete={() => onDelete(i)}
            />
          </FragmentRow>
        ))}
        {lineAt === blocks.length && <Cursor drop={fromPalette} />}
        {Array.from({ length: empty }, (_, i) => (
          <EmptySlot key={`empty-${i}`} n={blocks.length + i} onTap={onTapEnd} />
        ))}
      </ol>
    </SortableContext>
  );
}

function FragmentRow({ cursor, drop, children }: { cursor: boolean; drop: boolean; children: ReactNode }) {
  return (
    <>
      {cursor && <Cursor drop={drop} />}
      {children}
    </>
  );
}
