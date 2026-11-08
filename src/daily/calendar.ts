// Dates for the daily challenge. Everything uses the player's local calendar day, so the puzzle
// changes at their midnight, and everyone on the same date gets the same puzzle.

import type { Difficulty } from './entry';

/** The bank holds 52 weeks of puzzles, then starts over. */
export const BANK_DAYS = 364;

/** Local date as YYYY-MM-DD. */
export function dateKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Days since 1970-01-01 for a YYYY-MM-DD date (no time zones involved). */
export function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function keyFromDay(n: number): string {
  const d = new Date(n * 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** The bank entry that plays on a date. */
export function bankIndex(key: string): number {
  return ((dayNumber(key) % BANK_DAYS) + BANK_DAYS) % BANK_DAYS;
}

/** 0 = Sunday. 1970-01-01 was a Thursday. */
export function weekday(day: number): number {
  return (((day + 4) % 7) + 7) % 7;
}

/** Monday and Tuesday are easy, midweek is medium, the weekend is hard. */
const BY_WEEKDAY: Difficulty[] = ['hard', 'easy', 'easy', 'medium', 'medium', 'medium', 'hard'];

/** Difficulty of a bank entry (the same for a day number, since the bank is whole weeks). */
export function difficultyFor(day: number): Difficulty {
  return BY_WEEKDAY[weekday(day)];
}
