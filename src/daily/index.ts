// The daily challenge: one shared puzzle a day, from a bank that ships with the game, so it works
// offline with no server. Clearing it on back-to-back days builds a streak.

import type { LevelFile } from '../sim/types';
import type { Progress } from '../progress';
import { expandDaily } from './entry';
import type { DailyEntry, Difficulty } from './entry';
import { DEMO } from '../demo';
import { bankIndex, dateKey, dayNumber, difficultyFor, keyFromDay } from './calendar';
import { markSavesDirty } from '../storage/persist';

export { dateKey } from './calendar';
export type { Difficulty } from './entry';

/** The daily challenge opens once loops have been taught (Floor 11 is the first repeat floor). */
export const DAILY_UNLOCK_FLOOR = 11;
const UNLOCK_ID = 't1-f11';

export function dailyUnlocked(p: Progress): boolean {
  return (p.stars[UNLOCK_ID] ?? 0) > 0;
}

export interface DailyState {
  /** Best stars per date (YYYY-MM-DD), recent days only. */
  best: Record<string, number>;
  /** Days in a row with a clear, ending on `last`. */
  streak: number;
  longest: number;
  /** The last date cleared. */
  last: string | null;
  /**
   * Streak freezes banked (0 to MAX_FREEZES). A freeze covers one missed day, so real life
   * doesn't wipe out a long streak. Players start with one and earn one every 7 days in a row.
   */
  freezes?: number;
  /** Days a freeze covered, recent ones only (for the calendar and the results card). */
  frozen?: string[];
}

export const MAX_FREEZES = 2;
/** LoopBot Plus players can bank more. */
export const PLUS_MAX_FREEZES = 4;
export const FREEZE_EVERY = 7;

const KEY = 'loopbot.daily';
/** How many days of results to keep. */
const KEEP_DAYS = 60;

function fresh(): DailyState {
  return { best: {}, streak: 0, longest: 0, last: null, freezes: 1, frozen: [] };
}

export function loadDaily(): DailyState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitizeDaily(JSON.parse(raw)) : fresh();
  } catch {
    return fresh();
  }
}

/** Keeps only fields of the right type, so broken or hand-made saves can't crash the game. */
export function sanitizeDaily(v: unknown): DailyState {
  const d = fresh();
  if (!v || typeof v !== 'object' || Array.isArray(v)) return d;
  const o = v as Record<string, unknown>;
  const int = (x: unknown, fallback: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : fallback);
  const best: Record<string, number> = {};
  if (o.best && typeof o.best === 'object' && !Array.isArray(o.best)) {
    for (const [k, n] of Object.entries(o.best)) if (typeof n === 'number' && Number.isFinite(n)) best[k] = n;
  }
  return {
    best,
    streak: int(o.streak, 0),
    longest: int(o.longest, 0),
    last: typeof o.last === 'string' ? o.last : null,
    freezes: int(o.freezes, d.freezes!),
    frozen: Array.isArray(o.frozen) ? o.frozen.filter((x): x is string => typeof x === 'string') : [],
  };
}

export function saveDaily(s: DailyState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    markSavesDirty();
  } catch {
    /* storage blocked: the session keeps working */
  }
}

/**
 * Records a clear of `date`'s puzzle. Only today's puzzle is ever playable, so the streak just
 * counts days. Missed days are covered by banked freezes when there are enough of them.
 */
export function recordDailyClear(s: DailyState, date: string, stars: number, maxFreezes = MAX_FREEZES): DailyState {
  const best = { ...s.best, [date]: Math.max(s.best[date] ?? 0, stars) };
  const cutoff = dayNumber(date) - KEEP_DAYS;
  for (const k of Object.keys(best)) if (dayNumber(k) < cutoff) delete best[k];
  let { streak } = s;
  let freezes = s.freezes ?? 0;
  let frozen = (s.frozen ?? []).filter((d) => dayNumber(d) >= cutoff);
  if (s.last !== date) {
    const gap = s.last ? dayNumber(date) - dayNumber(s.last) : Infinity;
    if (gap === 1) streak = s.streak + 1;
    else if (gap > 1 && gap - 1 <= freezes) {
      // freezes cover the missed days, and the streak carries on
      for (let d = dayNumber(s.last!) + 1; d < dayNumber(date); d++) frozen = [...frozen, keyFromDay(d)];
      freezes -= gap - 1;
      streak = s.streak + 1;
    } else streak = 1;
    if (streak > s.streak && streak % FREEZE_EVERY === 0) freezes = Math.min(maxFreezes, freezes + 1);
  }
  return {
    best,
    streak,
    longest: Math.max(s.longest, streak),
    last: s.last && dayNumber(s.last) > dayNumber(date) ? s.last : date,
    freezes,
    frozen,
  };
}

/** The streak as it stands today: alive if the last clear was today or yesterday, or the freezes cover the gap. */
export function currentStreak(s: DailyState, today: string = dateKey()): number {
  if (!s.last) return 0;
  const gap = dayNumber(today) - dayNumber(s.last);
  return gap === 0 || gap === 1 || (gap > 1 && gap - 1 <= (s.freezes ?? 0)) ? s.streak : 0;
}

/** True when today's clear will spend freezes to keep the streak (the player missed days). */
export function streakNeedsFreeze(s: DailyState, today: string = dateKey()): boolean {
  if (!s.last) return false;
  const gap = dayNumber(today) - dayNumber(s.last);
  return gap > 1 && gap - 1 <= (s.freezes ?? 0);
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export function difficultyOn(date: string): Difficulty {
  return difficultyFor(dayNumber(date));
}

/** "Sun, Nov 8" */
export function shortDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export const isDailyId = (id: string) => id.startsWith('daily-');

let bank: Promise<DailyEntry[]> | null = null;
/** The bank loads on demand, so it never slows down the first screen. */
function loadBank(): Promise<DailyEntry[]> {
  // The itch.io demo has no daily challenge, so its build leaves the bank out.
  bank ??= DEMO ? Promise.resolve([]) : import('./bank.json').then((m) => m.default as unknown as DailyEntry[]);
  return bank;
}

/** The floor for a date. Everyone on that date gets the same one. */
export async function dailyLevel(date: string): Promise<LevelFile> {
  const entries = await loadBank();
  const level = expandDaily(entries[bankIndex(date) % entries.length], `daily-${date}`);
  return { ...level, story: { intro: `PATCH: "${INTROS[dayNumber(date) % INTROS.length]}"`, outro: null } };
}

const INTROS = [
  "Today's signal just came in. Same puzzle for every bot in the city.",
  'Fresh floor plan from the Spire archive. Loop it if you can.',
  "VANTA scrambled a service level overnight. Let's unscramble it.",
  'One puzzle, one day. Hit par and the whole city hears about it.',
  'New day, new route. Spot the pattern before you build.',
  "I found a floor that isn't on any map. Want a look?",
  "Daily drill, rookie. Keep the streak alive.",
];

/**
 * Old daily floors leave editor saves and hint counters behind. Clear everything from days
 * other than `today`, so storage doesn't grow day after day.
 */
export function pruneOldDailies(today: string, p: Progress): Progress {
  const keep = `daily-${today}`;
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('loopbot.editor.daily-') && k !== `loopbot.editor.${keep}`) stale.push(k);
    }
    stale.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  const strip = (m: Record<string, number>) => {
    const out: Record<string, number> = {};
    let changed = false;
    for (const [k, v] of Object.entries(m)) {
      if (isDailyId(k) && k !== keep) changed = true;
      else out[k] = v;
    }
    return changed ? out : m;
  };
  const revealed = strip(p.revealed);
  const fails = strip(p.fails);
  return revealed === p.revealed && fails === p.fails ? p : { ...p, revealed, fails };
}

/** The result line players can share: no spoilers, just how they did. */
export function shareText(date: string, level: LevelFile, stars: number, commands: number, streak: number): string {
  const lines = [
    `LoopBot Daily · ${shortDate(date)} · ${DIFFICULTY_LABEL[difficultyOn(date)]}`,
    `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}  ${commands} commands (par ${level.par.commands})`,
  ];
  if (streak > 1) lines.push(`🔥 ${streak}-day streak`);
  return lines.join('\n');
}

/** Yesterday's date, for tests and the streak. */
export const yesterday = (date: string) => keyFromDay(dayNumber(date) - 1);
