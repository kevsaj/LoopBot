// Bringing back players who stopped early. Most players who leave do it on day one, after Floor 1
// or stuck on Floor 2, long before the daily challenge (and its reminder) opens at Floor 11. Two
// gentle things for them, both gone once the daily opens:
//
// - The warm-up (src/daily/warmup.ts): from their second day on, a small puzzle a day that only
//   uses the blocks they know, and pays a hint for the tower the first time each day.
// - One nudge: after the first Floor 1 clear, phones ask once (in the game, before the phone's own
//   permission prompt) whether they'd like one reminder tomorrow. If yes, a single local
//   notification waits for the next day, about the same time they played. Every launch pushes it a
//   day further, so it only ever arrives on a day they didn't open the game, and it arrives once.
//   No server, no repeats. The daily reminder (src/reminder.ts) takes over from there.

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Progress } from './progress';
import { dailyUnlocked } from './daily';
import { dateKey, dayNumber, keyFromDay } from './daily/calendar';
import { warmupTier } from './daily/warmup';
import { loadReminder } from './reminder';
import { markSavesDirty } from './storage/persist';
import { DEMO } from './demo';
import { t } from './i18n';

const KEY = 'loopbot.comeback';
export const NUDGE_ID = 1101;
/** Warm-up results kept, in days. */
const KEEP_DAYS = 14;

export interface ComebackState {
  /** The first day this player opened the game (or a day before, for players from older builds). */
  first: string | null;
  /** Best stars on each day's warm-up, recent days only. */
  warm: Record<string, number>;
  /** The player answered the one-time "nudge tomorrow?" question. */
  asked: boolean;
  /** They said yes, and it hasn't been used up yet. */
  nudge: boolean;
  /** The hour of day it arrives (about when they played). */
  hour: number;
  /** When the waiting nudge is due (ms), so the next launch knows if it already went off. */
  at: number | null;
  /** The one nudge went off (or was turned off). It never comes back. */
  done: boolean;
}

function fresh(): ComebackState {
  return { first: null, warm: {}, asked: false, nudge: false, hour: 18, at: null, done: false };
}

export function loadComeback(): ComebackState {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<ComebackState> | null;
    if (!o || typeof o !== 'object') return fresh();
    const warm: Record<string, number> = {};
    if (o.warm && typeof o.warm === 'object') for (const [k, v] of Object.entries(o.warm)) if (typeof v === 'number') warm[k] = v;
    return {
      first: typeof o.first === 'string' ? o.first : null,
      warm,
      asked: !!o.asked,
      nudge: !!o.nudge,
      hour: Number.isInteger(o.hour) ? Math.max(0, Math.min(23, o.hour!)) : 18,
      at: typeof o.at === 'number' ? o.at : null,
      done: !!o.done,
    };
  } catch {
    return fresh();
  }
}

export function saveComeback(s: ComebackState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    markSavesDirty();
  } catch {
    /* storage blocked */
  }
}

const anyClear = (p: Progress) => Object.values(p.stars).some((n) => n > 0);

/**
 * Remembers the first day. A player updating from an older build has played before, so their
 * first day counts as yesterday and the warm-up is there for them straight away.
 */
export function noteFirstDay(s: ComebackState, p: Progress, today: string = dateKey()): ComebackState {
  if (s.first) return s;
  return { ...s, first: anyClear(p) ? keyFromDay(dayNumber(today) - 1) : today };
}

/** The warm-up shows from the second day, once Floor 1 is cleared, until the daily challenge opens. */
export function warmupOpen(s: ComebackState, p: Progress, today: string = dateKey()): boolean {
  return !DEMO && !dailyUnlocked(p) && (p.stars['t1-f01'] ?? 0) > 0 && !!s.first && s.first < today;
}

export const warmupTierFor = (p: Progress) => warmupTier((id) => (p.stars[id] ?? 0) > 0);

/** Hints for the first warm-up clear of a day. */
export const WARMUP_HINT = 1;

/** Records a warm-up clear. Returns the new state and the hints it earns (1 the first time that day). */
export function recordWarmupClear(s: ComebackState, date: string, stars: number): { state: ComebackState; hints: number } {
  const before = s.warm[date] ?? 0;
  const warm: Record<string, number> = { ...s.warm, [date]: Math.max(before, stars) };
  const cutoff = dayNumber(date) - KEEP_DAYS;
  for (const k of Object.keys(warm)) if (dayNumber(k) < cutoff) delete warm[k];
  return { state: { ...s, warm }, hints: before > 0 ? 0 : WARMUP_HINT };
}

// --- The one nudge ---

const native = () => Capacitor.isNativePlatform();

/** The question shows on the results card after the first Floor 1 clear, phones only, once. */
export function shouldAskNudge(s: ComebackState, p: Progress): boolean {
  return native() && !DEMO && !s.asked && !loadReminder().on && !dailyUnlocked(p);
}

/** About when they played, kept to friendly hours. */
export const nudgeHour = (now: Date) => Math.max(10, Math.min(20, now.getHours()));

/** "Floor 2", the floor Continue would open: the first Tower 1 floor not yet cleared. */
function nextFloor(p: Progress): { n: number; id: string } {
  for (let n = 1; n <= 50; n++) {
    const id = `t1-f${String(n).padStart(2, '0')}`;
    if (!(p.stars[id] ?? 0)) return { n, id };
  }
  return { n: 50, id: 't1-f50' };
}

/**
 * The nudge to schedule now, or null. Pure, for tests. It waits for tomorrow at the chosen hour,
 * and says something about where the player left off.
 */
export function planNudge(s: ComebackState, p: Progress, reminderOn: boolean, now: Date) {
  if (!s.nudge || s.done || reminderOn || dailyUnlocked(p)) return null;
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, s.hour, 0, 0, 0);
  const next = nextFloor(p);
  const stuck = (p.fails[next.id] ?? 0) > 0 || (p.revealed[next.id] ?? 0) > 0;
  return {
    id: NUDGE_ID,
    at,
    title: t('PATCH saved you a warm-up'),
    body: stuck
      ? t('Floor {n} giving you trouble? A quick warm-up puzzle earns you a free hint.', { n: next.n })
      : t('A two-minute puzzle is waiting, and Floor {n} is right where you left it.', { n: next.n }),
  };
}

/**
 * Runs on every launch (and when progress changes): if the waiting nudge's time has passed, it went
 * off and is used up. Otherwise it moves to tomorrow, so it only arrives on a day the game stays shut.
 */
export async function refreshNudge(p: Progress) {
  if (!native()) return;
  let s = loadComeback();
  if (!s.nudge || s.done) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NUDGE_ID }] });
    if (s.at && s.at <= Date.now()) {
      saveComeback({ ...s, nudge: false, done: true, at: null });
      return;
    }
    const plan = planNudge(s, p, loadReminder().on, new Date());
    if (!plan) {
      // the daily challenge or its reminder took over
      if (dailyUnlocked(p) || loadReminder().on) saveComeback({ ...s, nudge: false, done: true, at: null });
      return;
    }
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: plan.id,
          title: plan.title,
          body: plan.body,
          schedule: { at: plan.at, allowWhileIdle: true },
          isExactNotification: false,
          smallIcon: 'ic_stat_loopbot',
          iconColor: '#7cc4ff',
          extra: { open: 'warmup' },
        },
      ],
    });
    s = { ...loadComeback(), at: plan.at.getTime() };
    saveComeback(s);
  } catch {
    /* notifications unavailable: the game carries on */
  }
}

/** The answer to the question. Yes asks the phone for permission. Returns whether the nudge is set. */
export async function answerNudge(yes: boolean, p: Progress, now: Date = new Date()): Promise<boolean> {
  const s = { ...loadComeback(), asked: true };
  if (!yes) {
    saveComeback(s);
    return false;
  }
  let on = false;
  try {
    on = (await LocalNotifications.requestPermissions()).display === 'granted';
  } catch {
    on = false;
  }
  saveComeback({ ...s, nudge: on, hour: nudgeHour(now), done: !on });
  if (on) await refreshNudge(p);
  return on;
}

/** Turns a waiting nudge off for good (Settings). */
export async function cancelNudge() {
  saveComeback({ ...loadComeback(), nudge: false, done: true, at: null });
  if (!native()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NUDGE_ID }] });
  } catch {
    /* ignore */
  }
}

/** Calls back when the player taps the nudge (to open the warm-up). Returns an unsubscribe. */
export function onNudgeTapped(cb: () => void): () => void {
  if (!native()) return () => {};
  let remove: (() => void) | null = null;
  let gone = false;
  void LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    if (e.notification.id === NUDGE_ID) cb();
  })
    .then((h) => {
      if (gone) void h.remove();
      else remove = () => void h.remove();
    })
    .catch(() => {});
  return () => {
    gone = true;
    remove?.();
  };
}
