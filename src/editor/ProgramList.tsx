// The program as visible slots (LS-1): filled lines, a dashed insert cursor, and empty boxes up to the limit.
// Loops show as a header, their body indented under it, and a foot that closes them (ED-5).
// Tap a line to move the cursor (ED-2), long-press and drag to move it (ED-2), swipe left to delete (ED-3).
// The drag context itself lives in dnd.tsx, so palette commands can be dropped in here too.

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Block, Condition } from '../sim/types';
import type { Spot } from '../sim/program';
import { MAX_TIMES, MIN_TIMES, childLists, countBlocks, elseKey, findBlock, listAt } from '../sim/program';
import { COMMAND_META, blockCommand } from './commands';
import type { DropData } from './dnd';
import { EMPTY_PREFIX, LIST_ID, useDragState } from './dnd';
import type { EditorRow } from './rows';
import { flatten, sameSpot, subtreeIds } from './rows';
import { msg, t, tn } from '../i18n';

interface Props {
  blocks: Block[];
  limit: number;
  cursor: Spot | null;
  activeIds: Set<string>;
  crashId: string | null;
  /** Turns that undo each other (see cancellingTurns): marked so the player can spot them. */
  cancelIds?: Set<string>;
  /** Put the cursor somewhere; null is the end of the program. */
  onCursor(spot: Spot | null): void;
  onDelete(id: string): void;
  onMove(id: string, to: Spot): void;
  onTimes(id: string, times: number): void;
  /** The conditions an if or while can ask on this floor, in the order a tap cycles them. */
  conditions: Condition[];
  onCond(id: string, cond: Condition): void;
}

const SWIPE_DELETE_PX = 72;

export function Tile({ block, line, lifted }: { block: Block; line?: number; lifted?: boolean }) {
  const meta = COMMAND_META[blockCommand(block)];
  const inside = childLists(block).reduce((n, c) => n + countBlocks(c.list), 0);
  return (
    <span className={`line-tile tone-${meta.tone}${lifted ? ' lifted' : ''}`} data-cancel={t('↻↺ cancel out')}>
      {line != null && <span className="line-no">{line}</span>}
      <span className="glyph" aria-hidden="true">
        {meta.glyph}
      </span>
      <span className="line-label">{t(meta.label)}</span>
      {lifted && block.kind === 'repeat' && (
        <span className="line-arg">
          × {block.times}
          {inside ? ` · ${t('{n} inside', { n: inside })}` : ''}
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
  cancels,
  dimmed,
  onTap,
  onDelete,
  onNudge,
  extra,
}: {
  row: Extract<EditorRow, { kind: 'line' | 'loop' }>;
  active: boolean;
  crashed: boolean;
  cancels?: boolean;
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
  const label =
    t(COMMAND_META[blockCommand(block)].label) +
    (block.kind === 'repeat' ? ` ${tn(block.times, '{n} time', '{n} times')}` : block.kind === 'if' || block.kind === 'while' ? ` ${condLabel(block.cond)}` : '');
  return (
    <li
      ref={(el) => {
        drop.setNodeRef(el);
        self.current = el;
      }}
      style={{ ['--depth' as string]: row.depth }}
      className={`row${row.depth ? ' nested' : ''}${row.kind === 'loop' ? ' loop-head' : ''}${dragging || dimmed ? ' placeholder' : ''}${active ? ' active' : ''}${crashed ? ' crashed' : ''}${cancels ? ' cancels' : ''}`}
      onPointerDown={down}
      onPointerMove={moveP}
      onPointerUp={up}
      onPointerCancel={cancel}
    >
      <span className={`swipe-bg${armed ? ' armed' : ''}`} aria-hidden="true">
        {t('Delete')}
      </span>
      <button
        ref={drag.setNodeRef}
        type="button"
        className="row-btn"
        style={{ transform: `translateX(${dx}px)`, transition: gesture.current?.swiping ? 'none' : 'transform 160ms ease', opacity: leaving ? 0 : 1 }}
        aria-label={
          row.kind === 'loop'
            ? t('Line {n}: {label}. Enter to put the cursor inside the loop, Delete to remove, Alt and arrow keys to move.', { n: row.line, label })
            : t('Line {n}: {label}. Enter to put the cursor after it, Delete to remove, Alt and arrow keys to move.', { n: row.line, label })
        }
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
      <button type="button" aria-label={t('Fewer times')} disabled={times <= MIN_TIMES} onClick={() => onChange(times - 1)}>
        −
      </button>
      <span className="times-n" aria-live="polite">
        ×{times}
      </span>
      <button type="button" aria-label={t('More times')} disabled={times >= MAX_TIMES} onClick={() => onChange(times + 1)}>
        +
      </button>
    </span>
  );
}

const COLOUR_NAMES: Record<string, string> = { r: msg('red'), g: msg('green'), b: msg('blue'), y: msg('yellow') };
/** The shape drawn on each coloured tile, shown with the colour name (colour is never the only signal). */
export const COLOUR_GLYPH: Record<string, string> = { r: '●', g: '▲', b: '■', y: '✚' };
const SENSOR_LABEL: Record<string, string> = {
  wall_ahead: msg('wall ahead'),
  box_ahead: msg('crate ahead'),
  carrying: msg('carrying'),
  on_target: msg('on target'),
  on_switch: msg('on switch'),
  heat_ahead: msg('heat ahead'),
  facing_north: msg('facing north'),
};
/** A condition in words: "wall ahead", "not on red". */
export function condLabel(c: Condition): string {
  const colour = COLOUR_NAMES[c.colour ?? ''];
  const s =
    c.sensor === 'tile_is'
      ? t('on {glyph} {colour}', { glyph: COLOUR_GLYPH[c.colour ?? ''] ?? '', colour: colour ? t(colour) : (c.colour ?? '') })
      : t(SENSOR_LABEL[c.sensor]);
  return c.not ? t('not {condition}', { condition: s }) : s;
}
const sameCond = (a: Condition, b: Condition) => a.sensor === b.sensor && (a.colour ?? '') === (b.colour ?? '');

/** The question on an if or while header: tap "not" to flip it, tap the sensor to try the next one. */
function CondPicker({ cond, options, onChange }: { cond: Condition; options: Condition[]; onChange(c: Condition): void }) {
  const stop = (e: PointerEvent) => e.stopPropagation();
  const next = () => {
    const i = options.findIndex((o) => sameCond(o, cond));
    const o = options[(i + 1) % options.length] ?? cond;
    onChange({ ...o, not: cond.not || undefined });
  };
  const base = condLabel({ ...cond, not: false });
  return (
    <span className="cond" onPointerDown={stop} onPointerUp={stop}>
      <button type="button" className={`cond-not${cond.not ? ' on' : ''}`} aria-pressed={!!cond.not} onClick={() => onChange({ ...cond, not: !cond.not || undefined })}>
        {t('not')}
      </button>
      <button type="button" className="cond-sensor" disabled={options.length < 2} aria-label={t('Condition: {condition}. Tap for the next sensor.', { condition: condLabel(cond) })} onClick={next}>
        {base}?
      </button>
    </span>
  );
}

/** The "else" row of an if: its upper half ends the then branch, its lower half starts the else branch. */
function ElseRow({ row, dimmed, onTap }: { row: Extract<EditorRow, { kind: 'else' }>; dimmed: boolean; onTap(): void }) {
  const drop = useDroppable({ id: row.key, data: { before: row.before, after: row.after } satisfies DropData });
  return (
    <li ref={drop.setNodeRef} style={{ ['--depth' as string]: row.depth }} className={`row else-row${row.depth ? ' nested' : ''}${dimmed ? ' placeholder' : ''}`}>
      <button type="button" className="row-btn" onClick={onTap} aria-label={t('Else: what happens when the condition is false. Tap to add commands here.')}>
        {t('else')}
      </button>
    </li>
  );
}

/** The foot of a loop. Tapping it moves the cursor out of the loop (or into it, while it's empty). */
function EndRow({ row, dimmed, onTap }: { row: Extract<EditorRow, { kind: 'end' }>; dimmed: boolean; onTap(): void }) {
  const drop = useDroppable({ id: row.key, data: { before: row.before, after: row.after } satisfies DropData });
  const empty = childLists(row.block).every((c) => c.list.length === 0);
  const isIf = row.block.kind === 'if';
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
        aria-label={
          empty
            ? isIf
              ? t('Empty if. Tap to add commands inside it.')
              : t('Empty loop. Tap to add commands inside it.')
            : isIf
              ? t('End of if. Tap to add commands after it.')
              : t('End of loop. Tap to add commands after it.')
        }
      >
        {empty ? (isIf ? t('Drop or tap commands into the if') : t('Drop or tap commands into the loop')) : ''}
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
      <button type="button" className="row-btn" onClick={onTap} aria-label={t('Empty slot. Tap to add commands at the end.')}>
        <span className="line-no">{n}</span>
      </button>
    </li>
  );
}

export function ProgramList({ blocks, limit, cursor, activeIds, crashId, cancelIds, onCursor, onDelete, onMove, onTimes, conditions, onCond }: Props) {
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
    // Already first or last in its list: nothing to do.
    if (to.index >= 0 && to.index <= (listAt(blocks, to.parent)?.length ?? 0)) onMove(row.block.id, to);
  };

  return (
    <ol ref={setNodeRef} className={`program${fromPalette ? (room ? ' receiving' : ' no-room') : ''}`} aria-label={t('Program')}>
      {rows.map((row) => {
        const here = sameSpot(lineAt, row.before) ? (
          <Cursor key={`c-${row.key}`} drop={!!dragId} depth={row.kind === 'end' ? row.depth + 1 : row.depth} />
        ) : null;
        if (row.kind === 'else') {
          return (
            <Fragment key={row.key}>
              {here}
              <ElseRow row={row} dimmed={dimmed.has(row.block.id)} onTap={() => onCursor({ parent: elseKey(row.block.id), index: row.block.else.length })} />
            </Fragment>
          );
        }
        if (row.kind === 'end') {
          const inside = childLists(row.block).every((c) => c.list.length === 0);
          return (
            <Fragment key={row.key}>
              {here}
              <EndRow
                row={row}
                dimmed={dimmed.has(row.block.id)}
                onTap={() =>
                  onCursor(inside ? { parent: row.block.id, index: 0 } : row.after.parent == null && row.after.index === blocks.length ? null : row.after)
                }
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
              cancels={cancelIds?.has(block.id)}
              dimmed={dimmed.has(block.id)}
              // A line puts the cursor after it; a header puts it at the end of the first body.
              onTap={() =>
                onCursor(
                  row.kind === 'loop'
                    ? { parent: block.id, index: childLists(row.block)[0].list.length }
                    : row.after.parent == null && row.after.index === blocks.length
                      ? null
                      : row.after,
                )
              }
              onDelete={() => onDelete(block.id)}
              onNudge={(dir) => nudge(row, dir)}
              extra={
                block.kind === 'repeat' ? (
                  <Times times={block.times} onChange={(n) => onTimes(block.id, n)} />
                ) : block.kind === 'if' || block.kind === 'while' ? (
                  <CondPicker cond={block.cond} options={conditions} onChange={(c) => onCond(block.id, c)} />
                ) : undefined
              }
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
