// Floor share codes: a player-made floor packed into one short line of text, like
// "LBF1-7K3QX-...". It can be pasted in a message or typed from a screenshot. No server is
// involved: the whole floor travels in the code.
//
// Bits, in order (version 1):
//   version 3 | w-1 3 | h-1 3 | band 4
//   each tile, row by row: kind 4, height 2
//   bot x 3, y 3, facing 2
//   boxes: count 4, then x 3, y 3, stack 2 each
//   targets: count 4, then x 3, y 3, need 2 each
//   links: count 3, then switch x 3, y 3, door count 3, doors x 3, y 3
//   goals 3 (bit mask), commands 12 (bit mask), sensors 5 (bit mask; wall_ahead is always on)
//   slots main 6, F1 6, F2 6 | par commands 6, steps 10
//   title: length 5, then 6 bits a letter
// then two checksum bytes. The bytes are written in Crockford base32 (no I, L, O or U, so a
// typed code can't mix up 1/l or 0/O), in dash-separated groups of five.

import type { Facing, Goal, LevelFile, PaletteCommand, Sensor } from '../sim/types';
import { validateLevel } from '../levels/validate';

export const CODE_PREFIX = 'LBF1';
const VERSION = 1;
export const TITLE_MAX = 24;

const TILES = ['.', '#', '_', 's', 'd', 'e', 'r', 'g', 'b', 'y', 'i', 't'] as const;
const FACINGS: Facing[] = ['north', 'east', 'south', 'west'];
export const BANDS = ['lobby', 'maintenance', 'workshop', 'control', 'rooftop', 'frostgate', 'glacier', 'signal', 'aurora', 'summit'] as const;
const GOALS: Goal[] = ['all_targets_filled', 'bot_on_exit', 'all_switches_on'];
const COMMANDS: PaletteCommand[] = ['forward', 'turn_left', 'turn_right', 'jump', 'pick_up', 'drop', 'activate', 'repeat', 'if', 'while', 'F1', 'F2'];
const SENSORS: Sensor[] = ['box_ahead', 'carrying', 'on_target', 'on_switch', 'tile_is'];
const TITLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -';
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Only letters, digits, spaces and dashes fit in a code; anything else becomes a space. */
export function cleanTitle(title: string): string {
  return [...title]
    .map((c) => (TITLE_CHARS.includes(c) ? c : ' '))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TITLE_MAX);
}

class BitWriter {
  bits: number[] = [];
  put(value: number, width: number) {
    if (!Number.isInteger(value) || value < 0 || value >= 2 ** width) throw new Error(`value ${value} does not fit in ${width} bits`);
    for (let i = width - 1; i >= 0; i--) this.bits.push((value >> i) & 1);
  }
  bytes(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | (this.bits[i + j] ?? 0);
      out.push(b);
    }
    return out;
  }
}

class BitReader {
  private i = 0;
  constructor(private bytes: number[]) {}
  get(width: number): number {
    let v = 0;
    for (let k = 0; k < width; k++, this.i++) {
      const byte = this.bytes[this.i >> 3];
      if (byte === undefined) throw new Error('The code is too short. Part of it may be missing.');
      v = (v << 1) | ((byte >> (7 - (this.i & 7))) & 1);
    }
    return v;
  }
}

function sum16(bytes: number[]): number {
  let h = 0x811c9dc5;
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193);
  return (h ^ (h >>> 16)) & 0xffff;
}

function toB32(bytes: number[]): string {
  let out = '';
  let acc = 0;
  let n = 0;
  for (const b of bytes) {
    acc = (acc << 8) | b;
    n += 8;
    while (n >= 5) {
      out += B32[(acc >> (n - 5)) & 31];
      n -= 5;
    }
    acc &= (1 << n) - 1;
  }
  if (n) out += B32[(acc << (5 - n)) & 31];
  return out;
}

function fromB32(text: string): number[] {
  const out: number[] = [];
  let acc = 0;
  let n = 0;
  for (const raw of text) {
    const c = raw === 'O' ? '0' : raw === 'I' || raw === 'L' ? '1' : raw;
    const v = B32.indexOf(c);
    if (v < 0) throw new Error(`"${raw}" isn't part of a floor code.`);
    acc = (acc << 5) | v;
    n += 5;
    if (n >= 8) {
      out.push((acc >> (n - 8)) & 255);
      n -= 8;
      acc &= (1 << n) - 1;
    }
  }
  return out;
}

const bitsOf = <T>(all: readonly T[], picked: readonly T[]) => all.reduce((m, v, i) => (picked.includes(v) ? m | (1 << i) : m), 0);
const pickBits = <T>(all: readonly T[], mask: number) => all.filter((_, i) => mask & (1 << i));

/** Packs a floor into a share code. Throws if the floor can't be shared (too big, unknown tiles). */
export function encodeFloor(l: LevelFile): string {
  const w = new BitWriter();
  const { w: W, h: H } = l.size;
  w.put(VERSION, 3);
  w.put(W - 1, 3);
  w.put(H - 1, 3);
  w.put(Math.max(0, BANDS.indexOf(l.band as (typeof BANDS)[number])), 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = TILES.indexOf(l.tiles[y][x] as (typeof TILES)[number]);
      if (t < 0) throw new Error(`unknown tile '${l.tiles[y][x]}'`);
      w.put(t, 4);
      w.put(Number(l.heights?.[y]?.[x] ?? 0), 2);
    }
  w.put(l.bot.x, 3);
  w.put(l.bot.y, 3);
  w.put(FACINGS.indexOf(l.bot.facing), 2);
  w.put(l.boxes.length, 4);
  for (const b of l.boxes) (w.put(b.x, 3), w.put(b.y, 3), w.put(b.count, 2));
  w.put(l.targets.length, 4);
  for (const t of l.targets) (w.put(t.x, 3), w.put(t.y, 3), w.put(t.count, 2));
  const links = l.links ?? [];
  w.put(links.length, 3);
  for (const k of links) {
    w.put(k.switch.x, 3);
    w.put(k.switch.y, 3);
    w.put(k.doors.length, 3);
    for (const d of k.doors) (w.put(d.x, 3), w.put(d.y, 3));
  }
  w.put(bitsOf(GOALS, l.goals), 3);
  w.put(bitsOf(COMMANDS, l.commands), 12);
  w.put(bitsOf(SENSORS, l.sensors ?? []), 5);
  w.put(l.slots.main ?? 0, 6);
  w.put(l.slots.F1 ?? 0, 6);
  w.put(l.slots.F2 ?? 0, 6);
  w.put(l.par.commands, 6);
  w.put(l.par.steps, 10);
  const title = cleanTitle(l.title);
  w.put(title.length, 5);
  for (const c of title) w.put(TITLE_CHARS.indexOf(c), 6);
  const bytes = w.bytes();
  const s = sum16(bytes);
  const body = toB32([...bytes, s >> 8, s & 255]);
  return [CODE_PREFIX, ...(body.match(/.{1,5}/g) ?? [])].join('-');
}

export type DecodeResult = { ok: true; level: LevelFile } | { ok: false; error: string };

/** Reads a share code back into a playable floor. Never throws: a bad code gives a reason to show. */
export function decodeFloor(code: string): DecodeResult {
  try {
    const clean = code.toUpperCase().replace(/[\s-]/g, '');
    if (!clean.startsWith(CODE_PREFIX)) return { ok: false, error: 'Floor codes start with LBF1.' };
    const all = fromB32(clean.slice(CODE_PREFIX.length));
    if (all.length < 4) return { ok: false, error: 'The code is too short. Part of it may be missing.' };
    const bytes = all.slice(0, -2);
    const s = sum16(bytes);
    if (all[all.length - 2] !== s >> 8 || all[all.length - 1] !== (s & 255)) return { ok: false, error: "That code doesn't add up. Check for a missing or mistyped letter." };
    const r = new BitReader(bytes);
    if (r.get(3) !== VERSION) return { ok: false, error: 'That code is from a newer LoopBot. Update the app to play it.' };
    const W = r.get(3) + 1;
    const H = r.get(3) + 1;
    const band = BANDS[r.get(4)] ?? 'lobby';
    const tiles: string[] = [];
    const heights: string[] = [];
    for (let y = 0; y < H; y++) {
      let row = '';
      let hs = '';
      for (let x = 0; x < W; x++) {
        const t = TILES[r.get(4)];
        if (!t) return { ok: false, error: "That code doesn't make a floor." };
        row += t;
        hs += String(r.get(2));
      }
      tiles.push(row);
      heights.push(hs);
    }
    const bot = { x: r.get(3), y: r.get(3), facing: FACINGS[r.get(2)] };
    const boxes = Array.from({ length: r.get(4) }, () => ({ x: r.get(3), y: r.get(3), count: r.get(2) }));
    const targets = Array.from({ length: r.get(4) }, () => ({ x: r.get(3), y: r.get(3), count: r.get(2) }));
    const links = Array.from({ length: r.get(3) }, () => ({
      switch: { x: r.get(3), y: r.get(3) },
      doors: Array.from({ length: r.get(3) }, () => ({ x: r.get(3), y: r.get(3) })),
    }));
    const goals = pickBits(GOALS, r.get(3));
    const commands = pickBits(COMMANDS, r.get(12));
    const sensors = pickBits(SENSORS, r.get(5));
    const slots: LevelFile['slots'] = { main: r.get(6) };
    const f1 = r.get(6);
    const f2 = r.get(6);
    if (f1) slots.F1 = f1;
    if (f2) slots.F2 = f2;
    const par = { commands: r.get(6), steps: r.get(10) };
    const title = Array.from({ length: r.get(5) }, () => TITLE_CHARS[r.get(6)]).join('');
    const level: LevelFile = {
      id: 'custom',
      title: title || 'Custom floor',
      band,
      size: { w: W, h: H },
      tiles,
      heights: heights.every((row) => /^0*$/.test(row)) ? null : heights,
      boxes,
      targets,
      bot,
      goals,
      commands,
      slots,
      par,
      reference: '',
      hints: [],
      story: { intro: null, outro: null },
      ...(links.length ? { links } : {}),
      ...(sensors.length ? { sensors: ['wall_ahead' as Sensor, ...sensors] } : {}),
    };
    const errs = validateLevel(level, { custom: true });
    if (targets.some((t) => t.count < 1)) errs.push('target needs at least one box');
    if (!commands.length) errs.push('no commands');
    for (const fn of ['F1', 'F2'] as const) if (commands.includes(fn) && !slots[fn]) errs.push(`${fn} has no slots`);
    if (errs.length) return { ok: false, error: "That code doesn't make a playable floor." };
    return { ok: true, level };
  } catch (err) {
    return { ok: false, error: err instanceof Error && err.message.endsWith('.') ? err.message : "That code doesn't make a floor." };
  }
}
