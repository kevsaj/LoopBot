// One drag-and-drop context for the editor: long-press a line to reorder it (ED-2),
// or drag a palette command straight into the program at the spot you drop it.
// Tapping a palette command still adds it at the cursor.

import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { CollisionDetection, DragEndEvent, DragMoveEvent, DragStartEvent, Modifier, UniqueIdentifier } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { getEventCoordinates } from '@dnd-kit/utilities';
import type { Block, PaletteCommand } from '../sim/types';
import { COMMAND_META } from './commands';
import { fx } from '../audio/feedback';
import { Tile } from './ProgramList';

const PALETTE = 'palette:';
export const LIST_ID = 'program-list';
export const EMPTY_PREFIX = 'empty-';

const paletteCmd = (id: UniqueIdentifier | undefined | null) =>
  typeof id === 'string' && id.startsWith(PALETTE) ? (id.slice(PALETTE.length) as PaletteCommand) : null;

// Each sensor only claims its own kind of drag: palette chips drag after a short move
// (they never scroll), program lines need a long-press so a swipe or scroll never drags.
const onChip = (e: Event) => !!(e.target as Element | null)?.closest?.('[data-palette]');
type Handler = (e: never, opts: never) => boolean;
const only = (base: { eventName: string; handler: Handler }[], want: boolean) =>
  base.map((a) => ({
    eventName: a.eventName,
    handler: (e: { nativeEvent: Event }, opts: unknown) => onChip(e.nativeEvent) === want && a.handler(e as never, opts as never),
  }));
class ChipSensor extends PointerSensor {
  static activators = only(PointerSensor.activators as never, true) as never;
}
class RowTouch extends TouchSensor {
  static activators = only(TouchSensor.activators as never, false) as never;
}
class RowMouse extends MouseSensor {
  static activators = only(MouseSensor.activators as never, false) as never;
}
class RowKeys extends KeyboardSensor {
  static activators = only(KeyboardSensor.activators as never, false) as never;
}

interface DragState {
  /** Id of the line or palette chip being dragged. */
  dragId: string | null;
  /** True while a command from the palette is being dragged. */
  fromPalette: boolean;
  /** Where a palette command would land if dropped now, or null when not over the program. */
  dropIndex: number | null;
}
const Ctx = createContext<DragState>({
  dragId: null,
  fromPalette: false,
  dropIndex: null,
});
export const useDragState = () => useContext(Ctx);

// Lines only move up and down inside the list; palette commands travel freely.
const forRows =
  (m: Modifier): Modifier =>
  (args) =>
    paletteCmd(args.active?.id) ? args.transform : m(args);

const collide: CollisionDetection = (args) => {
  if (!paletteCmd(args.active.id)) {
    // Reorder: only the program lines are targets.
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => !String(c.id).startsWith(EMPTY_PREFIX) && c.id !== LIST_ID),
    });
  }
  // Lines scrolled out of the program box can sit under the palette, so only count
  // a drop when the finger is inside the visible part of the program.
  const list = args.droppableContainers.find((c) => c.id === LIST_ID)?.node.current;
  const box = (list?.closest('.program-wrap') ?? list)?.getBoundingClientRect();
  const pt = args.pointerCoordinates;
  if (!box || !pt || pt.x < box.left || pt.x > box.right || pt.y < box.top || pt.y > box.bottom) return [];
  const hits = pointerWithin(args);
  const specific = hits.filter((h) => h.id !== LIST_ID);
  return specific.length ? specific : hits;
};

interface Props {
  blocks: Block[];
  /** Checks a dropped command; returns false (after giving feedback) when it cannot go in. */
  canAdd(cmd: PaletteCommand): boolean;
  onDrop(cmd: PaletteCommand, index: number): void;
  onMove(from: number, to: number): void;
  children: ReactNode;
}

export function EditorDnd({ blocks, canAdd, onDrop, onMove, children }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const sensors = useSensors(
    useSensor(ChipSensor, { activationConstraint: { distance: 10 } }),
    useSensor(RowTouch, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(RowMouse, { activationConstraint: { delay: 160, tolerance: 6 } }),
    useSensor(RowKeys, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: {
        start: ['Space'],
        cancel: ['Escape'],
        end: ['Space', 'Enter'],
      },
    }),
  );
  const fromPalette = paletteCmd(dragId);

  const whereDrop = (e: DragMoveEvent): number | null => {
    const over = e.over;
    if (!over) return null;
    const id = String(over.id);
    if (id === LIST_ID || id.startsWith(EMPTY_PREFIX)) return blocks.length;
    const i = blocks.findIndex((b) => b.id === id);
    if (i < 0) return null;
    // Above the middle of a line goes before it, below goes after it.
    const start = getEventCoordinates(e.activatorEvent);
    const y = (start?.y ?? 0) + e.delta.y;
    return y > over.rect.top + over.rect.height / 2 ? i + 1 : i;
  };

  const start = (e: DragStartEvent) => {
    setDragId(String(e.active.id));
    setDropIndex(null);
    fx.lift();
  };
  const move = (e: DragMoveEvent) => {
    if (!paletteCmd(e.active.id)) return;
    const at = whereDrop(e);
    if (at !== dropIndex) setDropIndex(at);
  };
  const end = (e: DragEndEvent) => {
    const cmd = paletteCmd(e.active.id);
    const at = cmd ? whereDrop(e) : null;
    setDragId(null);
    setDropIndex(null);
    if (cmd) {
      if (at != null && canAdd(cmd)) onDrop(cmd, at);
      return;
    }
    if (!e.over) return;
    const from = blocks.findIndex((b) => b.id === e.active.id);
    const to = blocks.findIndex((b) => b.id === e.over!.id);
    if (from >= 0 && to >= 0 && from !== to) {
      onMove(from, to);
      fx.snap();
    }
  };
  const cancel = () => {
    setDragId(null);
    setDropIndex(null);
  };

  const dragIndex = dragId && !fromPalette ? blocks.findIndex((b) => b.id === dragId) : -1;
  return (
    <Ctx.Provider value={{ dragId, fromPalette: !!fromPalette, dropIndex }}>
      <DndContext
        sensors={sensors}
        collisionDetection={collide}
        modifiers={[forRows(restrictToVerticalAxis), forRows(restrictToParentElement)]}
        onDragStart={start}
        onDragMove={move}
        onDragEnd={end}
        onDragCancel={cancel}
      >
        {children}
        <DragOverlay dropAnimation={fromPalette ? null : undefined}>
          {fromPalette ? <PaletteGhost cmd={fromPalette} /> : dragIndex >= 0 ? <Tile block={blocks[dragIndex]} index={dragIndex} lifted /> : null}
        </DragOverlay>
      </DndContext>
    </Ctx.Provider>
  );
}

function PaletteGhost({ cmd }: { cmd: PaletteCommand }) {
  const meta = COMMAND_META[cmd];
  return (
    <span className={`line-tile tone-${meta.tone} lifted ghost`}>
      <span className="glyph" aria-hidden="true">
        {meta.glyph}
      </span>
      <span className="line-label">{meta.label}</span>
    </span>
  );
}

/** A palette command: tap to add at the cursor, or drag it into the program. */
export function PaletteChip({
  cmd,
  allowed,
  inactive,
  className,
  label,
  onClick,
  children,
}: {
  cmd: PaletteCommand;
  allowed: boolean;
  /** Locked or no room: still tappable (to explain why), shown dimmed. */
  inactive: boolean;
  className: string;
  label: string;
  onClick(): void;
  children: ReactNode;
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: PALETTE + cmd,
    disabled: !allowed,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-palette={cmd}
      className={`${className}${isDragging ? ' dragging' : ''}`}
      aria-disabled={inactive}
      aria-label={label}
      onClick={onClick}
      {...listeners}
    >
      {children}
    </button>
  );
}
