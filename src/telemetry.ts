// Anonymous play statistics and in-game feedback, for the Google Play closed test.
//
// What is sent: which floor, how many runs and hints, crash or clear, stars, seconds on the floor,
// the app version and platform, and a random install id made on this device (no name, email,
// account, advertising id or device id). Players can turn it off in Settings; turning it off
// also forgets the random id and drops anything not yet sent.
//
// Where it goes: a Google Apps Script web app that appends rows to Kevin's Google Sheet
// (scripts/telemetry/Code.gs). The URL comes from VITE_TELEMETRY_URL at build time; when it is
// missing (CI, the itch.io demo, a fresh clone) nothing is ever sent and feedback falls back to email.

import { Capacitor } from '@capacitor/core';
import { version } from '../package.json';
import { DEMO } from './demo';

const URL_ = (import.meta.env.VITE_TELEMETRY_URL as string | undefined)?.trim() || '';
/** True when this build has somewhere to send stats and feedback. */
export const TELEMETRY_AVAILABLE = !DEMO && /^https:\/\//.test(URL_);
export const FEEDBACK_EMAIL = 'kisstudios98@gmail.com';

const ON_KEY = 'loopbot.stats';
const ID_KEY = 'loopbot.statsId';
const QUEUE_KEY = 'loopbot.statsQueue';
const MAX_QUEUE = 400;
const FLUSH_MS = 20_000;

export type StatEvent =
  | { type: 'session' }
  | { type: 'floor_start'; floor: string }
  | { type: 'run'; floor: string; result: 'cleared' | 'crashed' | 'ended'; commands: number; steps: number; run: number }
  | { type: 'hint'; floor: string; tier: number; free: boolean }
  | { type: 'floor_clear'; floor: string; stars: number; runs: number; hints: number; seconds: number }
  | { type: 'floor_leave'; floor: string; cleared: boolean; runs: number; hints: number; seconds: number };

type Row = StatEvent & { t: number };

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage full or blocked: stats are best effort */
  }
}

/** Whether the player allows anonymous stats (on by default, a switch in Settings). */
export function statsOn() {
  return TELEMETRY_AVAILABLE && read(ON_KEY) !== '0';
}

export function setStatsOn(on: boolean) {
  write(ON_KEY, on ? '1' : '0');
  if (!on) {
    queue = [];
    write(QUEUE_KEY, null);
    write(ID_KEY, null); // a fresh, unlinked id if they turn it back on
  }
}

function installId() {
  let id = read(ID_KEY);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    write(ID_KEY, id);
  }
  return id;
}

function platform() {
  try {
    return Capacitor.getPlatform(); // 'android' | 'ios' | 'web'
  } catch {
    return 'web';
  }
}

let queue: Row[] = (() => {
  try {
    const q = JSON.parse(read(QUEUE_KEY) ?? '[]');
    return Array.isArray(q) ? (q as Row[]).slice(-MAX_QUEUE) : [];
  } catch {
    return [];
  }
})();
let timer: number | undefined;
let sending = false;

function persist() {
  write(QUEUE_KEY, queue.length ? JSON.stringify(queue) : null);
}

/** Queues one event; batches go out every 20 s and when the app goes to the background. */
export function track(e: StatEvent) {
  if (!statsOn()) return;
  queue.push({ ...e, t: Date.now() });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  persist();
  if (timer === undefined) timer = window.setTimeout(() => void flush(), FLUSH_MS);
}

// Apps Script web apps answer with a redirect and no CORS headers, so requests go as
// no-cors text/plain: no preflight, an opaque reply. A network error throws, so a batch
// stays queued while offline and goes out on a later flush.
async function post(body: object) {
  await fetch(URL_, {
    method: 'POST',
    mode: 'no-cors',
    keepalive: true,
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
}

export async function flush() {
  window.clearTimeout(timer);
  timer = undefined;
  if (!statsOn() || sending || queue.length === 0) return;
  sending = true;
  const batch = queue.slice(0, 100);
  try {
    await post({ kind: 'events', id: installId(), version, platform: platform(), events: batch });
    queue = queue.slice(batch.length);
    persist();
  } catch {
    /* offline: try again later */
  } finally {
    sending = false;
  }
  if (queue.length && timer === undefined) timer = window.setTimeout(() => void flush(), FLUSH_MS);
}

/** Starts the session: one 'session' event, and a flush whenever the app is hidden. */
let started = false;
export function startTelemetry() {
  if (!TELEMETRY_AVAILABLE || started) return;
  started = true;
  track({ type: 'session' });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
  void flush(); // anything left from last time
}

export interface FeedbackContext {
  floor?: string;
  floorTitle?: string;
}

/** Sends a feedback message. Feedback is sent even with stats off: the player chose to send it. */
export async function sendFeedback(message: string, mood: string, ctx: FeedbackContext): Promise<boolean> {
  if (!TELEMETRY_AVAILABLE) return false;
  try {
    await post({
      kind: 'feedback',
      version,
      platform: platform(),
      mood,
      floor: ctx.floor ?? '',
      floorTitle: ctx.floorTitle ?? '',
      message: message.slice(0, 2000),
    });
    return true;
  } catch {
    return false;
  }
}

/** A mailto link with the floor and version filled in, for builds without an endpoint. */
export function feedbackMailto(ctx: FeedbackContext) {
  const where = ctx.floor ? `Floor: ${ctx.floorTitle ?? ''} (${ctx.floor})\n` : '';
  const body = `\n\n---\n${where}Version: ${version} (${platform()})`;
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('LoopBot feedback')}&body=${encodeURIComponent(body)}`;
}
