// One drag-and-drop context for the editor: long-press a line to move it (ED-2), into or out
// of loops too, or drag a palette command straight into the program at the spot you drop it.
// Either way a glowing line shows where it will land. Tapping a palette command still adds it at the cursor.

import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { CollisionDetection, DragEndEvent, DragMoveEvent, DragStartEvent, Modifier, UniqueIdentifier } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import type { Block, PaletteCommand } from '../sim/types';
import type { Spot } from '../sim/program';
import { canPlace, findBlock, makeBlock } from '../sim/program';
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

interface DragState {
  /** Id of the line or palette chip being dragged. */
  dragId: string | null;
  /** True while a command from the palette is being dragged. */
  fromPalette: boolean;
  /** Where the dragged command would land if dropped now, or null when it can't land here. */
  dropSpot: Spot | null;
}
const Ctx = createContext<DragState>({ dragId: null, fromPalette: false, dropSpot: null });

/** What each program row tells the drag: the spot above its middle and the spot below. */
export interface DropData {
  before: Spot;
  after: Spot;
}
export const useDragState = () => useContext(Ctx);

// Lines only move up and down inside the list; palette commands travel freely.
const forRows =
  (m: Modifier): Modifier =>
  (args) =>
    paletteCmd(args.active?.id) ? args.transform : m(args);

/** The finger's last position, as collision detection saw it: it decides above or below a row's middle. */
let pointerY: number | null = null;

const collide: CollisionDetection = (args) => {
  pointerY = args.pointerCoordinates?.y ?? null;
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
  canAdd(cmd: PaletteCommand, spot: Spot): boolean;
  onDrop(cmd: PaletteCommand, spot: Spot): void;
  onMove(id: string, to: Spot): void;
  children: ReactNode;
}

export function EditorDnd({ blocks, canAdd, onDrop, onMove, children }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropSpot, setDropSpot] = useState<Spot | null>(null);
  const sensors = useSensors(
    useSensor(ChipSensor, { activationConstraint: { distance: 10 } }),
    useSensor(RowTouch, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(RowMouse, { activationConstraint: { delay: 160, tolerance: 6 } }),
  );
  const fromPalette = paletteCmd(dragId);

  const whereDrop = (e: DragMoveEvent): Spot | null => {
    const over = e.over;
    if (!over) return null;
    const id = String(over.id);
    let spot: Spot;
    if (id === LIST_ID || id.startsWith(EMPTY_PREFIX)) spot = { parent: null, index: blocks.length };
    else {
      const data = over.data.current as DropData | undefined;
      if (!data) return null;
      // Above the middle of a row goes before it, below goes after it.
      const y = pointerY ?? over.rect.top;
      spot = y > over.rect.top + over.rect.height / 2 ? data.after : data.before;
    }
    // Never into itself, and never deeper than loops may nest.
    const cmd = paletteCmd(e.active.id);
    const block = cmd ? makeBlock(cmd) : findBlock(blocks, String(e.active.id));
    return block && canPlace(blocks, spot, block) ? spot : null;
  };

  const start = (e: DragStartEvent) => {
    setDragId(String(e.active.id));
    setDropSpot(null);
    fx.lift();
  };
  const move = (e: DragMoveEvent) => {
    const at = whereDrop(e);
    if (at?.parent !== dropSpot?.parent || at?.index !== dropSpot?.index) setDropSpot(at);
  };
  const end = (e: DragEndEvent) => {
    const cmd = paletteCmd(e.active.id);
    const at = whereDrop(e);
    setDragId(null);
    setDropSpot(null);
    if (!at) return;
    if (cmd) {
      if (canAdd(cmd, at)) onDrop(cmd, at);
      return;
    }
    onMove(String(e.active.id), at);
  };
  const cancel = () => {
    setDragId(null);
    setDropSpot(null);
  };

  const dragged = dragId && !fromPalette ? findBlock(blocks, dragId) : null;
  return (
    <Ctx.Provider value={{ dragId, fromPalette: !!fromPalette, dropSpot }}>
      <DndContext
        sensors={sensors}
        collisionDetection={collide}
        modifiers={[forRows(restrictToVerticalAxis)]}
        onDragStart={start}
        onDragMove={move}
        onDragEnd={end}
        onDragCancel={cancel}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {fromPalette ? <PaletteGhost cmd={fromPalette} /> : dragged ? <Tile block={dragged} lifted /> : null}
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
