// The daily reminder: a local notification ("Today's puzzle is ready") at a time the player
// picks. No server and no push service: the phone schedules the next 7 days itself, and we
// reschedule whenever the app opens or the daily is cleared, so a day that's already done
// gets no ping and the text can mention the streak. Off until the player says yes, and the
// question is only asked after they clear their first daily. Phones only.

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { DailyState } from './daily';
import { currentStreak, dateKey, loadDaily } from './daily';

const KEY = 'loopbot.reminder';
const IDS = [1001, 1002, 1003, 1004, 1005, 1006, 1007];
export const DEFAULT_HOUR = 18;

export interface ReminderPrefs {
  on: boolean;
  hour: number;
  /** The player has answered the one-time question. */
  asked: boolean;
}

export const remindersAvailable = () => Capacitor.isNativePlatform();

export function loadReminder(): ReminderPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<ReminderPrefs> | null;
    return { on: !!p?.on, hour: Number.isInteger(p?.hour) ? p!.hour! : DEFAULT_HOUR, asked: !!p?.asked };
  } catch {
    return { on: false, hour: DEFAULT_HOUR, asked: false };
  }
}

function saveReminder(p: ReminderPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

const LINES = [
  "Today's puzzle is ready. Same one for every bot in the city.",
  'PATCH found a new floor plan. Got a few minutes?',
  'A fresh daily puzzle is waiting on the Spire.',
  "VANTA scrambled another floor. Let's fix it.",
];

/** The reminders for the next 7 days, skipping today if it's done or the time has passed. Pure, for tests. */
export function planReminders(prefs: ReminderPrefs, daily: DailyState, now: Date) {
  const today = dateKey(now);
  const doneToday = (daily.best[today] ?? 0) > 0;
  const streak = currentStreak(daily, today);
  const out: { id: number; at: Date; title: string; body: string }[] = [];
  for (let i = 0; out.length < IDS.length && i < 8; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, prefs.hour, 0, 0, 0);
    if (i === 0 && (doneToday || at <= now)) continue;
    const first = out.length === 0;
    out.push({
      id: IDS[out.length],
      at,
      title: first && streak > 1 ? `🔥 Keep your ${streak}-day streak` : 'LoopBot daily challenge',
      body: LINES[(at.getDate() + i) % LINES.length],
    });
  }
  return out;
}

/** Cancels and re-plans the next week of reminders. Safe to call often. */
export async function refreshReminders(daily: DailyState = loadDaily()) {
  if (!remindersAvailable()) return;
  try {
    await LocalNotifications.cancel({ notifications: IDS.map((id) => ({ id })) });
    const prefs = loadReminder();
    if (!prefs.on) return;
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return;
    await LocalNotifications.schedule({
      notifications: planReminders(prefs, daily, new Date()).map((n) => ({
        ...n,
        schedule: { at: n.at, allowWhileIdle: true },
        isExactNotification: false, // a few minutes late is fine; no exact-alarm permission needed
        smallIcon: 'ic_stat_loopbot',
        iconColor: '#7cc4ff',
      })),
    });
  } catch {
    /* notifications unavailable: the game carries on */
  }
}

/** Turns the reminder on (asking the phone for permission) or off. Returns whether it's on. */
export async function setReminder(on: boolean, hour?: number, daily: DailyState = loadDaily()): Promise<boolean> {
  const prefs = { ...loadReminder(), asked: true, ...(hour !== undefined ? { hour } : {}) };
  if (on && remindersAvailable()) {
    try {
      const perm = await LocalNotifications.requestPermissions();
      on = perm.display === 'granted';
    } catch {
      on = false;
    }
  }
  saveReminder({ ...prefs, on });
  await refreshReminders(daily);
  return on;
}

/** Records "no thanks" so the question isn't asked again (Settings still has the switch). */
export function declineReminder() {
  saveReminder({ ...loadReminder(), asked: true });
}

/** "6 PM" */
export const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
