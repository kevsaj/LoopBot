// The program as visible slots (LS-1): filled lines, a dashed insert cursor, and empty boxes up to the limit.
// Tap a line to move the cursor (ED-2), long-press and drag to reorder (ED-2), swipe left to delete (ED-3).

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import type { Block } from '../sim/types';
import { COMMAND_META, blockCommand } from './commands';
import { fx } from '../audio/feedback';

interface Props {
  blocks: Block[];
  limit: number;
  cursor: number | null;
  activeIds: Set<string>;
  crashId: string | null;
  onTap(index: number): void;
  onTapEnd(): void;
  onDelete(index: number): void;
  onMove(from: number, to: number): void;
}

const SWIPE_DELETE_PX = 72;

function Tile({ block, index, lifted }: { block: Block; index: number; lifted?: boolean }) {
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
    transform: CSS.Transform.toString(transform),
    transition,
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

function Cursor() {
  return <li className="cursor" aria-hidden="true" />;
}

export function ProgramList({ blocks, limit, cursor, activeIds, crashId, onTap, onTapEnd, onDelete, onMove }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const sensors = useSensors(
    // Long-press to drag on touch, so a quick swipe or scroll never starts a drag by accident.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(MouseSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );
  const cur = cursor ?? blocks.length;
  const empty = Math.max(0, limit - blocks.length);
  const dragIndex = dragId ? blocks.findIndex((b) => b.id === dragId) : -1;

  const start = (e: DragStartEvent) => {
    setDragId(String(e.active.id));
    fx.lift();
  };
  const end = (e: DragEndEvent) => {
    setDragId(null);
    if (!e.over) return;
    const from = blocks.findIndex((b) => b.id === e.active.id);
    const to = blocks.findIndex((b) => b.id === e.over!.id);
    if (from >= 0 && to >= 0 && from !== to) {
      onMove(from, to);
      fx.snap();
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragStart={start}
      onDragEnd={end}
      onDragCancel={() => setDragId(null)}
    >
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <ol className="program" aria-label="Program">
          {blocks.map((b, i) => (
            <FragmentRow key={b.id} showCursor={!dragId && cur === i}>
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
          {!dragId && cur === blocks.length && <Cursor />}
          {Array.from({ length: empty }, (_, i) => (
            <li key={`empty-${i}`} className="row empty-slot">
              <button type="button" className="row-btn" onClick={onTapEnd} aria-label="Empty slot. Tap to add commands at the end.">
                <span className="line-no">{blocks.length + i + 1}</span>
              </button>
            </li>
          ))}
        </ol>
      </SortableContext>
      <DragOverlay>{dragIndex >= 0 ? <Tile block={blocks[dragIndex]} index={dragIndex} lifted /> : null}</DragOverlay>
    </DndContext>
  );
}

function FragmentRow({ showCursor, children }: { showCursor: boolean; children: ReactNode }) {
  return (
    <>
      {showCursor && <Cursor />}
      {children}
    </>
  );
}
