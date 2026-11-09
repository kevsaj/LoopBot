// The daily challenge: one shared puzzle a day, from a bank that ships with the game, so it works
// offline with no server. Clearing it on back-to-back days builds a streak.

import type { LevelFile } from '../sim/types';
import type { Progress } from '../progress';
import { expandDaily } from './entry';
import type { DailyEntry, Difficulty } from './entry';
import { DEMO } from '../demo';
import { bankIndex, dateKey, dayNumber, difficultyFor, keyFromDay } from './calendar';

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
}

const KEY = 'loopbot.daily';
/** How many days of results to keep. */
const KEEP_DAYS = 60;

function fresh(): DailyState {
  return { best: {}, streak: 0, longest: 0, last: null };
}

export function loadDaily(): DailyState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...fresh(), ...(JSON.parse(raw) as Partial<DailyState>) } : fresh();
  } catch {
    return fresh();
  }
}

export function saveDaily(s: DailyState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: the session keeps working */
  }
}

/** Records a clear of `date`'s puzzle. Only today's puzzle is ever playable, so the streak just counts days. */
export function recordDailyClear(s: DailyState, date: string, stars: number): DailyState {
  const best = { ...s.best, [date]: Math.max(s.best[date] ?? 0, stars) };
  const cutoff = dayNumber(date) - KEEP_DAYS;
  for (const k of Object.keys(best)) if (dayNumber(k) < cutoff) delete best[k];
  let streak = s.streak;
  if (s.last !== date) streak = s.last && dayNumber(date) - dayNumber(s.last) === 1 ? s.streak + 1 : 1;
  return { best, streak, longest: Math.max(s.longest, streak), last: s.last && dayNumber(s.last) > dayNumber(date) ? s.last : date };
}

/** The streak as it stands today: it's still alive if the last clear was today or yesterday. */
export function currentStreak(s: DailyState, today: string = dateKey()): number {
  if (!s.last) return 0;
  const gap = dayNumber(today) - dayNumber(s.last);
  return gap === 0 || gap === 1 ? s.streak : 0;
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
