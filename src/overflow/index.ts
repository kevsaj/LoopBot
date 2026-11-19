// Overflow: the endless climb up the tower of Babel (paid, sold on its own as `loopbot_overflow`).
//
// A climb draws its floors from a bank that ships with the game (src/overflow/bank.json, built
// offline by scripts/make-overflow.ts), so every floor is solvable and its par is the true minimum.
// The floors get harder in tiers and mix tricks from the other towers. Each climb shuffles the bank
// with its own seed and turns or mirrors every floor at random, so no two climbs look alike.
//
// A climb has 3 bricks. Skipping a floor costs one; three 3-star clears in a row earn one back.
// Skipped floors count toward the height too: the bricks are what keep that fair.
// The best height (floors climbed in one go) is the record the mode is about.

import type { LevelFile } from '../sim/types';
import type { Progress } from '../progress';
import { DEMO } from '../demo';
import { rng } from '../daily/generate';
import { expandOverflow, transformEntry, KIND_INTRO } from './entry';
import type { OverflowEntry, Tier } from './entry';
import { markSavesDirty } from '../storage/persist';
import { lang, t } from '../i18n';

export const MAX_BRICKS = 3;
/** Three 3-star clears in a row earn back a brick. */
export const PERFECT_FOR_BRICK = 3;

/** The first floor of each tier. Past the last, the climb stays in tier 4 forever. */
export const TIER_FLOORS: Record<Tier, number> = { 1: 1, 2: 7, 3: 19, 4: 41 };

export function tierOf(floor: number): Tier {
  return floor >= TIER_FLOORS[4] ? 4 : floor >= TIER_FLOORS[3] ? 3 : floor >= TIER_FLOORS[2] ? 2 : 1;
}

/** A terrace every 10 floors, each with its own look and music; past 50 they cycle above the clouds. */
export const TERRACES = ['brickyard', 'lapisgate', 'gardens', 'starstair', 'cloudtop'] as const;
export type Terrace = (typeof TERRACES)[number];
export function terraceOf(floor: number): Terrace {
  const i = Math.floor((Math.max(1, floor) - 1) / 10);
  return TERRACES[i < 5 ? i : 1 + ((i - 1) % 4)];
}

export interface OverflowRun {
  /** Shuffles the bank and turns the floors for this climb. */
  seed: number;
  /** The floor being played, from 1. */
  floor: number;
  bricks: number;
  /** 3-star clears in a row. */
  perfect: number;
  /** Stars won on the floors climbed past. */
  stars: number;
  /** Best stars on the floor being played, 0 until it is cleared. */
  done: number;
  /** The record when this climb started, so the "New record!" badge shows once. */
  startBest: number;
}

export interface OverflowState {
  run: OverflowRun | null;
  /** The record: the most floors climbed in one climb. */
  best: number;
  /** Climbs started. */
  climbs: number;
  /** How the last finished climb went, for the hub. */
  last: { height: number; stars: number } | null;
}

const KEY = 'loopbot.overflow';

function fresh(): OverflowState {
  return { run: null, best: 0, climbs: 0, last: null };
}

const int = (x: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(0, Math.floor(x))) : fallback);

/** Keeps only fields of the right type, so broken or hand-made saves can't crash the game. */
export function sanitizeOverflow(v: unknown): OverflowState {
  const s = fresh();
  if (!v || typeof v !== 'object' || Array.isArray(v)) return s;
  const o = v as Record<string, unknown>;
  const r = o.run as Record<string, unknown> | null | undefined;
  const l = o.last as Record<string, unknown> | null | undefined;
  return {
    run:
      r && typeof r === 'object' && !Array.isArray(r)
        ? { seed: int(r.seed, 1, 0xffffffff), floor: Math.max(1, int(r.floor, 1, 100_000)), bricks: int(r.bricks, MAX_BRICKS, MAX_BRICKS), perfect: int(r.perfect, 0, PERFECT_FOR_BRICK - 1), stars: int(r.stars, 0), done: int(r.done, 0, 3), startBest: int(r.startBest, 0) }
        : null,
    best: int(o.best, 0),
    climbs: int(o.climbs, 0),
    last: l && typeof l === 'object' && !Array.isArray(l) ? { height: int(l.height, 0), stars: int(l.stars, 0) } : null,
  };
}

export function loadOverflow(): OverflowState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitizeOverflow(JSON.parse(raw)) : fresh();
  } catch {
    return fresh();
  }
}

export function saveOverflow(s: OverflowState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    markSavesDirty();
  } catch {
    /* storage blocked: the climb keeps working for this session */
  }
}

/** Floors climbed so far on a climb: every floor below the one being played, and it too once cleared. */
export const heightOf = (run: OverflowRun) => run.floor - 1 + (run.done ? 1 : 0);

export function startClimb(s: OverflowState, seed: number = (Math.random() * 0xffffffff) >>> 0): OverflowState {
  return { ...s, run: { seed: seed >>> 0 || 1, floor: 1, bricks: MAX_BRICKS, perfect: 0, stars: 0, done: 0, startBest: s.best }, climbs: s.climbs + 1 };
}

/** Whether climbing on after `stars` on this floor earns a brick back. */
export function earnsBrick(run: OverflowRun, stars: number): boolean {
  return stars >= 3 && run.perfect + 1 >= PERFECT_FOR_BRICK && run.bricks < MAX_BRICKS;
}

/**
 * The floor being played is cleared. The climb stays on it (a retry can still win more stars)
 * until the player climbs on, but the height already counts toward the record.
 */
export function markCleared(s: OverflowState, stars: number): OverflowState {
  if (!s.run) return s;
  const run = { ...s.run, done: Math.max(s.run.done, Math.max(1, Math.min(3, stars))) };
  return { ...s, run, best: Math.max(s.best, heightOf(run)) };
}

/** Up to the next floor after a clear. Every third 3-star clear in a row earns a brick back. */
export function climbOn(s: OverflowState): { state: OverflowState; brick: boolean } {
  if (!s.run || !s.run.done) return { state: s, brick: false };
  const run = s.run;
  const brick = earnsBrick(run, run.done);
  let perfect = run.done >= 3 ? run.perfect + 1 : 0;
  if (perfect >= PERFECT_FOR_BRICK) perfect = 0;
  const next = { ...run, floor: run.floor + 1, bricks: run.bricks + (brick ? 1 : 0), perfect, stars: run.stars + run.done, done: 0 };
  return { state: { ...s, run: next, best: Math.max(s.best, heightOf(next)) }, brick };
}

/** Skipping a floor costs a brick. Without one left, the floor has to be cleared. */
export function skipFloor(s: OverflowState): OverflowState {
  if (!s.run || s.run.done || s.run.bricks <= 0) return s;
  const next = { ...s.run, floor: s.run.floor + 1, bricks: s.run.bricks - 1, perfect: 0, done: 0 };
  return { ...s, run: next, best: Math.max(s.best, heightOf(next)) };
}

/** Ends the climb where it stands. Its height already counts toward the record. */
export function endClimb(s: OverflowState): OverflowState {
  if (!s.run) return s;
  return { ...s, run: null, last: { height: heightOf(s.run), stars: s.run.stars + s.run.done } };
}

let bank: Promise<OverflowEntry[]> | null = null;
/** The bank loads on demand, so it never slows down the first screen. */
export function loadBank(): Promise<OverflowEntry[]> {
  bank ??= DEMO ? Promise.resolve([]) : import('./bank.json').then((m) => m.default as unknown as OverflowEntry[]);
  return bank;
}

/** A shuffle of 0..n-1 that only depends on the seed. */
function shuffled(n: number, seed: number): number[] {
  const r = rng(seed);
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r.next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const NAMES_A = ['Lapis', 'Cedar', 'Bronze', 'Amber', 'Reed', 'Sun', 'Moon', 'Clay', 'Gold', 'Star', 'River', 'Glazed', 'Lion', 'Palm', 'Copper', 'Dusk', 'Ivory', 'Saffron'];
const NAMES_B = ['Stair', 'Terrace', 'Gate', 'Ramp', 'Court', 'Ledge', 'Arch', 'Walk', 'Landing', 'Steps', 'Balcony', 'Colonnade', 'Causeway', 'Rampart', 'Cistern', 'Garden'];

/** The bank floor a climb plays at a height: which entry, and how it is turned. Pure, for tests. */
export function pickFloor(entries: OverflowEntry[], seed: number, floor: number): { entry: OverflowEntry; title: string } {
  const tier = tierOf(floor);
  const pool = entries.map((e, i) => ({ e, i })).filter(({ e }) => e.tier === tier);
  const list = pool.length ? pool : entries.map((e, i) => ({ e, i }));
  const at = floor - TIER_FLOORS[tier];
  // a fresh shuffle every time the tier's floors run out, so a long climb keeps changing
  const cycle = Math.floor(at / list.length);
  const order = shuffled(list.length, (seed ^ Math.imul(tier * 2654435761, cycle + 1)) >>> 0);
  const base = list[order[at % list.length]].e;
  const r = rng((seed + Math.imul(floor, 0x9e3779b1)) >>> 0);
  const entry = transformEntry(base, r.int(0, 3), r.next() < 0.5);
  return { entry, title: `${r.pick(NAMES_A)} ${r.pick(NAMES_B)}` };
}

export const overflowId = (run: OverflowRun) => `overflow-${run.seed}-${run.floor}`;
export const isOverflowId = (id: string) => id.startsWith('overflow-');

/** The floor a climb is on. */
export async function overflowLevel(run: OverflowRun): Promise<LevelFile> {
  const entries = await loadBank();
  const { entry, title } = pickFloor(entries, run.seed, run.floor);
  const level = expandOverflow(entry, overflowId(run), title, terraceOf(run.floor));
  const line = t(KIND_INTRO[entry.kind]);
  return { ...level, story: { intro: lang() === 'fr' ? `PATCH : « ${line} »` : `PATCH: "${line}"`, outro: null } };
}

/**
 * Floors left behind leave editor saves and hint counters. Clear everything from Overflow floors
 * other than the one being played, so storage doesn't grow floor after floor.
 */
export function pruneOverflow(p: Progress, keepId: string | null): Progress {
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('loopbot.editor.overflow-') && k !== `loopbot.editor.${keepId}`) stale.push(k);
    }
    stale.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  const strip = (m: Record<string, number>) => {
    const out: Record<string, number> = {};
    let changed = false;
    for (const [k, v] of Object.entries(m)) {
      if (isOverflowId(k) && k !== keepId) changed = true;
      else out[k] = v;
    }
    return changed ? out : m;
  };
  const revealed = strip(p.revealed);
  const fails = strip(p.fails);
  return revealed === p.revealed && fails === p.fails ? p : { ...p, revealed, fails };
}
