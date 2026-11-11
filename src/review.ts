// Asking for a store rating, at a happy moment: right after a band of the tower is finished
// (Floors 10, 20, 30, 40, 50) with 2 or 3 stars. Uses the native review sheet (Apple and Google
// decide whether it actually shows, and Apple caps it at 3 a year). We ask at most once every
// 120 days, and never on the web.

import { Capacitor } from '@capacitor/core';
import { InAppReview } from '@capacitor-community/in-app-review';

const KEY = 'loopbot.reviewAsked';
const GAP_DAYS = 120;
const BAND_ENDS = new Set(['t1-f10', 't1-f20', 't1-f30', 't1-f40', 't1-f50', 't2-f10', 't2-f20', 't2-f30', 't2-f40', 't2-f50']);

export function shouldAskForReview(floorId: string, stars: number, lastAsked: number | null, now: number): boolean {
  if (!BAND_ENDS.has(floorId) || stars < 2) return false;
  return lastAsked === null || now - lastAsked >= GAP_DAYS * 86_400_000;
}

/** Call after a tower floor is cleared. Waits `delayMs` so the results card has its moment first. */
export function maybeAskForReview(floorId: string, stars: number, delayMs = 4000) {
  if (!Capacitor.isNativePlatform()) return;
  let last: number | null = null;
  try {
    const v = Number(localStorage.getItem(KEY));
    last = v > 0 ? v : null;
  } catch {
    /* ignore */
  }
  if (!shouldAskForReview(floorId, stars, last, Date.now())) return;
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  window.setTimeout(() => void InAppReview.requestReview().catch(() => {}), delayMs);
}
