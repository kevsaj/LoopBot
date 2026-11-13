// The floor maker's draft: a floor the player is building, kept on the device between visits.
// It turns into an ordinary LevelFile for test play and for share codes.

import type { Facing, Goal, LevelFile, PaletteCommand, Sensor } from '../sim/types';
import { validateLevel } from '../levels/validate';
import { cleanTitle } from './shareCode';
import { markSavesDirty } from '../storage/persist';

export const MAKER = import.meta.env.DEV || import.meta.env.VITE_MAKER === '1';

export const MAX_SIZE = 8;
const KEY = 'loopbot.maker';

/** What a tap on the grid does. */
export type Tool = '.' | '#' | '_' | 's' | 'd' | 'e' | 'r' | 'g' | 'b' | 'y' | 'i' | 't' | 'up' | 'down' | 'box' | 'target' | 'bot';

export interface Draft {
  title: string;
  band: string;
  w: number;
  h: number;
  /** [y][x] tile characters, the same letters as floor files. */
  tiles: string[][];
  heights: number[][];
  boxes: Record<string, number>;
  targets: Record<string, number>;
  bot: { x: number; y: number; facing: Facing };
  /** Goals the maker switched off (on by default whenever the floor has what they need). */
  goalsOff: Goal[];
  commands: PaletteCommand[];
  sensors: Sensor[];
  slots: { main: number; F1: number; F2: number };
  /** The maker's best clear of this exact design: it becomes par. Cleared by any edit. */
  solved: { commands: number; steps: number } | null;
}

export const DEFAULT_COMMANDS: PaletteCommand[] = ['forward', 'turn_left', 'turn_right', 'jump', 'pick_up', 'drop', 'activate', 'repeat'];
export const ALL_COMMANDS: PaletteCommand[] = [
  'forward',
  'turn_left',
  'turn_right',
  'jump',
  'pick_up',
  'drop',
  'activate',
  'repeat',
  'if',
  'while',
  'F1',
  'F2',
];
export const MAKER_SENSORS: Sensor[] = ['box_ahead', 'carrying', 'on_target', 'on_switch', 'tile_is'];
export const LOOKS = [
  { band: 'lobby', label: 'Lobby' },
  { band: 'maintenance', label: 'Maintenance' },
  { band: 'workshop', label: 'Workshop' },
  { band: 'control', label: 'Control Room' },
  { band: 'rooftop', label: 'Rooftop' },
];

const grid = <T>(w: number, h: number, v: T): T[][] => Array.from({ length: h }, () => Array.from({ length: w }, () => v));

export function newDraft(): Draft {
  const tiles = grid(5, 5, '.');
  tiles[4][4] = 'e';
  return {
    title: 'My floor',
    band: 'lobby',
    w: 5,
    h: 5,
    tiles,
    heights: grid(5, 5, 0),
    boxes: {},
    targets: {},
    bot: { x: 0, y: 0, facing: 'east' },
    goalsOff: [],
    commands: [...DEFAULT_COMMANDS],
    sensors: [],
    slots: { main: 8, F1: 0, F2: 0 },
    solved: null,
  };
}

export function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Draft;
      if (d && Array.isArray(d.tiles) && d.tiles.length === d.h) return { ...newDraft(), ...d };
    }
  } catch {
    /* start fresh */
  }
  return newDraft();
}

export function saveDraft(d: Draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* storage full: the draft lives on in memory */
  }
}

const k = (x: number, y: number) => `${x},${y}`;
const walkable = (ch: string) => ch !== '#' && ch !== '_';

/** Any change to the floor itself means the maker has to clear it again before sharing. */
function edited(d: Draft, next: Partial<Draft>): Draft {
  return { ...d, ...next, solved: null };
}

/** One tap on the grid with the given tool. */
export function paint(d: Draft, x: number, y: number, tool: Tool): Draft {
  const key = k(x, y);
  if (tool === 'bot') {
    if (d.bot.x === x && d.bot.y === y) {
      const order: Facing[] = ['north', 'east', 'south', 'west'];
      return edited(d, {
        bot: { x, y, facing: order[(order.indexOf(d.bot.facing) + 1) % 4] },
      });
    }
    return edited(d, { bot: { ...d.bot, x, y } });
  }
  if (tool === 'up' || tool === 'down') {
    const heights = d.heights.map((r) => [...r]);
    heights[y][x] = Math.max(0, Math.min(3, heights[y][x] + (tool === 'up' ? 1 : -1)));
    return edited(d, { heights });
  }
  if (tool === 'box' || tool === 'target') {
    const field = tool === 'box' ? 'boxes' : 'targets';
    const map = { ...d[field] };
    const n = ((map[key] ?? 0) + 1) % 4; // 1, 2, 3 then off
    if (n) map[key] = n;
    else delete map[key];
    return edited(d, { [field]: map });
  }
  const tiles = d.tiles.map((r) => [...r]);
  tiles[y][x] = tool;
  const next: Partial<Draft> = { tiles };
  // Boxes and targets can't sit on a wall or in a gap.
  if (!walkable(tool)) {
    const boxes = { ...d.boxes };
    const targets = { ...d.targets };
    delete boxes[key];
    delete targets[key];
    Object.assign(next, { boxes, targets });
  }
  return edited(d, next);
}

/** Grow or shrink the floor from the right and bottom edges, keeping what still fits. */
export function resize(d: Draft, w: number, h: number): Draft {
  w = Math.max(1, Math.min(MAX_SIZE, w));
  h = Math.max(1, Math.min(MAX_SIZE, h));
  const tiles = grid(w, h, '.').map((r, y) => r.map((v, x) => d.tiles[y]?.[x] ?? v));
  const heights = grid(w, h, 0).map((r, y) => r.map((v, x) => d.heights[y]?.[x] ?? v));
  const keep = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).filter(([p]) => Number(p.split(',')[0]) < w && Number(p.split(',')[1]) < h));
  const bot = {
    ...d.bot,
    x: Math.min(d.bot.x, w - 1),
    y: Math.min(d.bot.y, h - 1),
  };
  return edited(d, {
    w,
    h,
    tiles,
    heights,
    boxes: keep(d.boxes),
    targets: keep(d.targets),
    bot,
  });
}

/** The goals this floor can have, from what's on it. */
export function possibleGoals(d: Draft): Goal[] {
  const flat = d.tiles.flat();
  const out: Goal[] = [];
  if (Object.keys(d.targets).length) out.push('all_targets_filled');
  if (flat.includes('e')) out.push('bot_on_exit');
  if (flat.includes('s')) out.push('all_switches_on');
  return out;
}

export const goalsOf = (d: Draft) => possibleGoals(d).filter((g) => !d.goalsOff.includes(g));

export function toLevel(d: Draft, id = 'maker'): LevelFile {
  const pos = (m: Record<string, number>) =>
    Object.entries(m)
      .map(([p, count]) => {
        const [x, y] = p.split(',').map(Number);
        return { x, y, count };
      })
      .sort((a, b) => a.y - b.y || a.x - b.x);
  const hasIfs = d.commands.includes('if') || d.commands.includes('while');
  const slots: LevelFile['slots'] = { main: d.slots.main };
  if (d.commands.includes('F1')) slots.F1 = Math.max(1, d.slots.F1);
  if (d.commands.includes('F2')) slots.F2 = Math.max(1, d.slots.F2);
  const heights = d.heights.map((r) => r.join(''));
  return {
    id,
    title: cleanTitle(d.title) || 'My floor',
    band: d.band,
    size: { w: d.w, h: d.h },
    tiles: d.tiles.map((r) => r.join('')),
    heights: heights.some((r) => /[1-3]/.test(r)) ? heights : null,
    boxes: pos(d.boxes),
    targets: pos(d.targets),
    bot: { ...d.bot },
    goals: goalsOf(d),
    // F2 only makes sense next to F1, and the palette shows commands in this order.
    commands: ALL_COMMANDS.filter((c) => d.commands.includes(c)),
    slots,
    par: d.solved ?? { commands: d.slots.main, steps: 999 },
    reference: '',
    hints: [],
    story: { intro: null, outro: null },
    ...(hasIfs && d.sensors.length ? { sensors: ['wall_ahead' as Sensor, ...d.sensors] } : {}),
  };
}

/** What's stopping this floor from being played, in words for the player. Empty means ready. */
export function problems(d: Draft): string[] {
  const out: string[] = [];
  const flat = d.tiles.flat();
  if (!walkable(d.tiles[d.bot.y]?.[d.bot.x] ?? '#')) out.push('LoopBot needs to start on a floor tile, not a wall or a gap.');
  if (!goalsOf(d).length) out.push('Give the floor a goal: an exit tile, a target or a switch.');
  const boxes = Object.values(d.boxes).reduce((a, b) => a + b, 0);
  const need = Object.values(d.targets).reduce((a, b) => a + b, 0);
  if (goalsOf(d).includes('all_targets_filled') && boxes < need)
    out.push(`The targets need ${need} ${need === 1 ? 'box' : 'boxes'}, but the floor has ${boxes ? `only ${boxes}` : 'none'}.`);
  if (flat.includes('d') && !flat.includes('s')) out.push('Doors open with a switch. Add a switch, or take the door away.');
  if (!d.commands.some((c) => c === 'forward' || c === 'jump')) out.push('Allow forward or jump, or LoopBot can never move.');
  if (!out.length) {
    const errs = validateLevel(toLevel(d), { custom: true });
    if (errs.length) out.push(...errs.map((e) => e.replace(/^[^:]*: /, '')));
  }
  return out;
}

/** Turns a floor (from a share code) back into a draft the maker can edit. Its par carries over. */
export function fromLevel(l: LevelFile): Draft {
  const { w, h } = l.size;
  const toMap = (list: Array<{ x: number; y: number; count: number }>) => Object.fromEntries(list.map((p) => [`${p.x},${p.y}`, p.count]));
  const d: Draft = {
    title: l.title,
    band: LOOKS.some((x) => x.band === l.band) ? l.band : 'lobby',
    w,
    h,
    tiles: l.tiles.map((r) => [...r]),
    heights: Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => Number(l.heights?.[y]?.[x] ?? 0))),
    boxes: toMap(l.boxes),
    targets: toMap(l.targets),
    bot: { ...l.bot },
    goalsOff: [],
    commands: ALL_COMMANDS.filter((c) => l.commands.includes(c)),
    sensors: (l.sensors ?? []).filter((s) => s !== 'wall_ahead'),
    slots: {
      main: l.slots.main ?? 8,
      F1: l.slots.F1 ?? 0,
      F2: l.slots.F2 ?? 0,
    },
    solved: { ...l.par },
  };
  d.goalsOff = possibleGoals(d).filter((g) => !l.goals.includes(g));
  return d;
}

// --- My floors: floors this player shared, kept so they can be edited, played or shared again ---

const LIST_KEY = 'loopbot.maker.floors';
export const MAX_SAVED = 30;

export interface SavedFloor {
  code: string;
  title: string;
  par: { commands: number; steps: number };
  /** When it was saved (ms). Newest first in the list. */
  at: number;
}

export function loadMyFloors(): SavedFloor[] {
  try {
    const list = JSON.parse(localStorage.getItem(LIST_KEY) ?? '[]') as SavedFloor[];
    return Array.isArray(list) ? list.filter((f) => typeof f?.code === 'string') : [];
  } catch {
    return [];
  }
}

function storeMyFloors(list: SavedFloor[]) {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(list));
    markSavesDirty();
  } catch {
    /* storage full */
  }
}

/** Adds a floor to the top of the list (the same code moves up rather than repeating). */
export function saveMyFloor(f: Omit<SavedFloor, 'at'>, now = Date.now()): SavedFloor[] {
  const list = [{ ...f, at: now }, ...loadMyFloors().filter((x) => x.code !== f.code)].slice(0, MAX_SAVED);
  storeMyFloors(list);
  return list;
}

export function removeMyFloor(code: string): SavedFloor[] {
  const list = loadMyFloors().filter((x) => x.code !== code);
  storeMyFloors(list);
  return list;
}
