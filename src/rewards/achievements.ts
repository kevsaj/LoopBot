// Achievements: small goals that point players at mastery and replay. Every one is worked out
// from saves the game already keeps (tower stars, hints revealed, failed runs, the daily streak),
// so nothing new needs tracking and a restored backup code restores them too.

import type { Progress } from '../progress';
import type { DailyState } from '../daily';

export interface Stats {
  /** Tower floor ids in order (t1-f01 ...). */
  floors: string[];
  progress: Progress;
  daily: DailyState;
}

export interface Achievement {
  id: string;
  title: string;
  /** What to do, shown before and after it's earned. */
  how: string;
  /** An emoji badge. */
  icon: string;
  earned(s: Stats): boolean;
  /** For goals with a count: how far along the player is. */
  progress?(s: Stats): { have: number; need: number };
}

const stars = (s: Stats, id: string) => s.progress.stars[id] ?? 0;
const cleared = (s: Stats, n: number) => stars(s, s.floors[n - 1] ?? '') > 0;
const threeStarCount = (s: Stats) => s.floors.filter((id) => stars(s, id) >= 3).length;
const totalStars = (s: Stats) => s.floors.reduce((n, id) => n + stars(s, id), 0);
const dailyClears = (s: Stats) => Object.values(s.daily.best).filter((b) => b > 0).length;
/** Floors 11+ cleared with no failed run before the clear (crash or ended short). */
const cleanClears = (s: Stats) => s.floors.slice(10).filter((id) => stars(s, id) > 0 && !(s.progress.fails[id] ?? 0)).length;
/** A whole band of ten floors cleared without revealing a single hint. */
const bandWithoutHints = (s: Stats) =>
  [0, 10, 20, 30, 40].some((start) => {
    const band = s.floors.slice(start, start + 10);
    return band.length === 10 && band.every((id) => stars(s, id) > 0 && !(s.progress.revealed[id] ?? 0));
  });

const count = (have: (s: Stats) => number, need: number) => ({
  earned: (s: Stats) => have(s) >= need,
  progress: (s: Stats) => ({ have: Math.min(need, have(s)), need }),
});

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-steps', title: 'First steps', how: 'Clear Floor 1', icon: '👣', earned: (s) => cleared(s, 1) },
  { id: 'lobby', title: 'Lobby secured', how: 'Clear the Lobby (Floor 10)', icon: '🛎️', earned: (s) => cleared(s, 10) },
  { id: 'loop-de-loop', title: 'Loop-de-loop', how: 'Clear your first repeat floor (Floor 11)', icon: '🔁', earned: (s) => cleared(s, 11) },
  { id: 'function-junction', title: 'Function junction', how: 'Clear your first function floor (Floor 21)', icon: '🧩', earned: (s) => cleared(s, 21) },
  { id: 'decision-maker', title: 'Decision maker', how: 'Clear your first if/while floor (Floor 31)', icon: '🔀', earned: (s) => cleared(s, 31) },
  { id: 'hacker', title: 'Typed it out', how: 'Reach the Rooftop and clear Floor 41', icon: '⌨️', earned: (s) => cleared(s, 41) },
  { id: 'spire', title: 'Spire cleared', how: 'Clear Floor 50 and ground VANTA', icon: '🏙️', earned: (s) => cleared(s, 50) },
  { id: 'perfect-10', title: 'Perfect ten', how: 'Get 3 stars on 10 floors', icon: '✨', ...count(threeStarCount, 10) },
  { id: 'stars-75', title: 'Star collector', how: 'Earn 75 stars in the tower', icon: '⭐', ...count(totalStars, 75) },
  { id: 'perfectionist', title: 'Perfectionist', how: 'Get 3 stars on all 50 floors', icon: '🏆', ...count(threeStarCount, 50) },
  { id: 'nailed-it', title: 'Nailed it', how: 'Clear 10 floors from Floor 11 on with no failed runs', icon: '🎯', ...count(cleanClears, 10) },
  { id: 'no-hints', title: 'Figured it out', how: 'Clear a whole band of 10 floors without a hint', icon: '🧠', earned: bandWithoutHints },
  { id: 'daily-1', title: 'Daily driver', how: 'Clear a daily challenge', icon: '📅', ...count(dailyClears, 1) },
  { id: 'streak-7', title: 'On a roll', how: 'Reach a 7-day daily streak', icon: '🔥', ...count((s) => s.daily.longest, 7) },
  { id: 'streak-30', title: 'Unstoppable', how: 'Reach a 30-day daily streak', icon: '☄️', ...count((s) => s.daily.longest, 30) },
];

export function earnedIds(s: Stats): Set<string> {
  return new Set(ACHIEVEMENTS.filter((a) => a.earned(s)).map((a) => a.id));
}

export { totalStars, threeStarCount };
