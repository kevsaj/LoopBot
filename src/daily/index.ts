// The daily challenge: one shared puzzle a day, from a bank that ships with the game, so it works
// offline with no server. Clearing it on back-to-back days builds a streak.

import type { LevelFile } from '../sim/types';
import type { Progress } from '../progress';
import { expandDaily } from './entry';
import type { DailyEntry, Difficulty, Twist } from './entry';
import { DEMO } from '../demo';
import { bankIndex, bossIndex, dateKey, dayNumber, difficultyFor, isBossDay, keyFromDay, themeOf, twistFor, weekday } from './calendar';
import { markSavesDirty } from '../storage/persist';
import { lang, msg, t, tn } from '../i18n';

export { dateKey } from './calendar';
export type { Difficulty, Twist } from './entry';

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
  /** Best stars on each Sunday boss, by its date (recent ones only). Bosses never touch the streak. */
  boss?: Record<string, number>;
}

export const MAX_FREEZES = 2;
/** LoopBot Plus players can bank more. */
export const PLUS_MAX_FREEZES = 4;
export const FREEZE_EVERY = 7;

const KEY = 'loopbot.daily';
/** How many days of results to keep. */
const KEEP_DAYS = 60;

function fresh(): DailyState {
  return { best: {}, streak: 0, longest: 0, last: null, freezes: 1, frozen: [], boss: {} };
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
  const stars = (m: unknown) => {
    const out: Record<string, number> = {};
    if (m && typeof m === 'object' && !Array.isArray(m)) {
      for (const [k, n] of Object.entries(m)) if (typeof n === 'number' && Number.isFinite(n)) out[k] = n;
    }
    return out;
  };
  const best = stars(o.best);
  return {
    best,
    streak: int(o.streak, 0),
    longest: int(o.longest, 0),
    last: typeof o.last === 'string' ? o.last : null,
    freezes: int(o.freezes, d.freezes!),
    frozen: Array.isArray(o.frozen) ? o.frozen.filter((x): x is string => typeof x === 'string') : [],
    boss: stars(o.boss),
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
    boss: s.boss,
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

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: msg('Easy'), medium: msg('Medium'), hard: msg('Hard'), boss: msg('Boss') };

/** Each theme week's name, and the rule its theme days (Wednesday to Friday) play by. */
export const THEME_NAME: Record<Twist, string> = {
  right: msg('Right Turn Week'),
  tight: msg('Tight Fit Week'),
  switch: msg('Switch Week'),
  nested: msg('Loop-in-Loop Week'),
};
export const TWIST_RULE: Record<Twist, string> = {
  right: msg('No turn left block'),
  tight: msg('No spare slots'),
  switch: msg('Light every switch'),
  nested: msg('A loop inside a loop'),
};
export const TWIST_ICON: Record<Twist, string> = { right: '↻', tight: '▣', switch: '◉', nested: '⟳' };

/** The theme day's rule on a date, or null on a classic day (Monday, Tuesday and the weekend). */
export function twistOn(date: string): Twist | null {
  return twistFor(dayNumber(date));
}
/** The theme of the week a date falls in. */
export function themeOn(date: string): Twist {
  return themeOf(dayNumber(date));
}
/** Sunday has a boss puzzle, on top of the daily. */
export function bossOn(date: string): boolean {
  return isBossDay(dayNumber(date));
}
/** Monday and Tuesday say which theme the week's Wednesday brings. */
export function themeComing(date: string): Twist | null {
  const w = weekday(dayNumber(date));
  return w === 1 || w === 2 ? themeOn(date) : null;
}

export function difficultyOn(date: string): Difficulty {
  return difficultyFor(dayNumber(date));
}

/** "Sun, Nov 8" */
export function shortDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(lang() === 'fr' ? 'fr-CA' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export const isDailyId = (id: string) => id.startsWith('daily-');
export const bossId = (date: string) => `daily-${date}-boss`;

let bank: Promise<DailyEntry[]> | null = null;
/** The bank loads on demand, so it never slows down the first screen. */
function loadBank(): Promise<DailyEntry[]> {
  // The itch.io demo has no daily challenge, so its build leaves the bank out.
  bank ??= DEMO ? Promise.resolve([]) : import('./bank.json').then((m) => m.default as unknown as DailyEntry[]);
  return bank;
}

let bosses: Promise<DailyEntry[]> | null = null;
function loadBosses(): Promise<DailyEntry[]> {
  bosses ??= DEMO ? Promise.resolve([]) : import('./boss.json').then((m) => m.default as unknown as DailyEntry[]);
  return bosses;
}

const patch = (line: string) => (lang() === 'fr' ? `PATCH : « ${line} »` : `PATCH: "${line}"`);

/** The floor for a date. Everyone on that date gets the same one. */
export async function dailyLevel(date: string): Promise<LevelFile> {
  const entries = await loadBank();
  const level = expandDaily(entries[bankIndex(date) % entries.length], `daily-${date}`);
  const tw = twistOn(date);
  const line = t(tw ? TWIST_INTROS[tw] : INTROS[dayNumber(date) % INTROS.length]);
  return { ...level, story: { intro: patch(line), outro: null } };
}

/** The Sunday boss for a date (Sundays only). Everyone that Sunday gets the same one. */
export async function bossLevel(date: string): Promise<LevelFile> {
  const entries = await loadBosses();
  const level = expandDaily(entries[bossIndex(dayNumber(date)) % entries.length], bossId(date));
  return { ...level, story: { intro: patch(t(BOSS_INTROS[bossIndex(dayNumber(date)) % BOSS_INTROS.length])), outro: null } };
}

const TWIST_INTROS: Record<Twist, string> = {
  right: msg("VANTA jammed your left turn. Right turns only today: three of them make a left."),
  tight: msg('Tight fit today: the program has exactly as many slots as par. No room for spare blocks.'),
  switch: msg('Switch Week: no exit today. Light every switch on the floor to clear it.'),
  nested: msg('Loop-in-Loop Week: par needs a repeat inside a repeat. Find the small pattern first.'),
};

const BOSS_INTROS = [
  msg("Sunday boss. VANTA built this one big. Take your time; it doesn't touch your streak."),
  msg('The biggest floor of the week. Loops inside loops, and then some.'),
  msg('Boss floor unlocked. Every bot in the city is stuck on this one. Show them how.'),
];

const INTROS = [
  msg("Today's signal just came in. Same puzzle for every bot in the city."),
  msg('Fresh floor plan from the Spire archive. Loop it if you can.'),
  msg("VANTA scrambled a service level overnight. Let's unscramble it."),
  msg('One puzzle, one day. Hit par and the whole city hears about it.'),
  msg('New day, new route. Spot the pattern before you build.'),
  msg("I found a floor that isn't on any map. Want a look?"),
  msg('Daily drill, rookie. Keep the streak alive.'),
];

/**
 * Old daily floors leave editor saves and hint counters behind. Clear everything from days
 * other than `today`, so storage doesn't grow day after day.
 */
export function pruneOldDailies(today: string, p: Progress, playing: string = today): Progress {
  const keepIds = new Set([`daily-${today}`, `daily-${playing}`, bossId(today), bossId(playing), `daily-warmup-${today}`]);
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('loopbot.editor.daily-') && !keepIds.has(k.slice('loopbot.editor.'.length))) stale.push(k);
    }
    stale.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  const strip = (m: Record<string, number>) => {
    const out: Record<string, number> = {};
    let changed = false;
    for (const [k, v] of Object.entries(m)) {
      if (isDailyId(k) && !keepIds.has(k)) changed = true;
      else out[k] = v;
    }
    return changed ? out : m;
  };
  const revealed = strip(p.revealed);
  const fails = strip(p.fails);
  return revealed === p.revealed && fails === p.fails ? p : { ...p, revealed, fails };
}

/** The result line players can share: no spoilers, just how they did. */
export function shareText(date: string, level: LevelFile, stars: number, commands: number, streak: number, boss = false): string {
  const tw = twistOn(date);
  const lines = [
    boss
      ? `${t('LoopBot Sunday boss')} · ${shortDate(date)}`
      : `${t('LoopBot Daily')} · ${shortDate(date)} · ${t(DIFFICULTY_LABEL[difficultyOn(date)])}${tw ? ` · ${TWIST_ICON[tw]} ${t(TWIST_RULE[tw])}` : ''}`,
    `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}  ${tn(commands, '{n} command (par {par})', '{n} commands (par {par})', { par: level.par.commands })}`,
  ];
  if (streak > 1 && !boss) lines.push(`🔥 ${tn(streak, '{n}-day streak', '{n}-day streak')}`);
  return lines.join('\n');
}

/** Yesterday's date, for tests and the streak. */
export const yesterday = (date: string) => keyFromDay(dayNumber(date) - 1);

// --- The daily archive (LoopBot Plus): replay the puzzles of the last few weeks ---

/** How many past days the archive offers. */
export const ARCHIVE_DAYS = 30;

/** The archive's dates, newest first: the days before `today`. */
export function archiveDates(today: string = dateKey(), days = ARCHIVE_DAYS): string[] {
  return Array.from({ length: days }, (_, i) => keyFromDay(dayNumber(today) - 1 - i));
}

/**
 * Records a clear of a past day's puzzle from the archive. It keeps the best stars for that day
 * but never touches the streak, freezes or hints: those belong to playing on the day.
 */
export function recordArchiveClear(s: DailyState, date: string, stars: number): DailyState {
  if ((s.best[date] ?? 0) >= stars) return s;
  return { ...s, best: { ...s.best, [date]: stars } };
}

/**
 * Records a clear of a Sunday boss: its best stars only. Bosses are a bonus, so they never move the
 * streak or the freezes. Old results are dropped with the same 60-day window as the daily.
 */
export function recordBossClear(s: DailyState, date: string, stars: number): DailyState {
  const prev = s.boss ?? {};
  if ((prev[date] ?? 0) >= stars) return s;
  const boss = { ...prev, [date]: stars };
  const cutoff = dayNumber(date) - KEEP_DAYS;
  for (const k of Object.keys(boss)) if (dayNumber(k) < cutoff) delete boss[k];
  return { ...s, boss };
}

/** Hints for beating the Sunday boss on the day, the first time. */
export const BOSS_HINTS = 2;
export function bossHintReward(before: DailyState, date: string, today: string = dateKey()): number {
  return date === today && !(before.boss?.[date] ?? 0) ? BOSS_HINTS : 0;
}

/** Hints earned by a daily clear: 1 for the first clear of the day, 3 more for every 7-day streak. */
export const DAILY_HINT = 1;
export const STREAK_HINTS = 3;
export function dailyHintReward(before: DailyState, after: DailyState, date: string): number {
  if ((before.best[date] ?? 0) > 0) return 0;
  return DAILY_HINT + (after.streak > before.streak && after.streak % FREEZE_EVERY === 0 ? STREAK_HINTS : 0);
}
