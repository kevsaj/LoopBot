// Safe saves: a copy of every LoopBot save, kept in the phone's own app storage.
//
// The game reads and writes localStorage, which lives inside the WebView. iOS may clear WebView
// storage when the phone runs low on space, and some Android "clean up" tools do the same. So on
// the phones we also keep a snapshot of all `loopbot.*` keys in Capacitor Preferences
// (UserDefaults on iOS, SharedPreferences on Android), which the OS never purges.
//
// - restoreSaves() runs once before the game renders. If localStorage has lost the progress save
//   but the snapshot has one, every saved key comes back.
// - The snapshot is refreshed when a save changes (markSavesDirty), on a slow timer, and whenever
//   the app goes to the background.
// On the web (itch.io, dev server) both would live in the same storage, so all of this is a no-op.

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';

const SNAPSHOT_KEY = 'loopbot.snapshot';
/** The key whose absence means localStorage was wiped (it exists once anything was played). */
const SENTINEL = 'loopbot.progress';
/** Keys not worth backing up: they are rebuilt or are only a send queue. */
const SKIP = new Set(['loopbot.statsQueue']);
const TIMER_MS = 30_000;

const native = () => Capacitor.isNativePlatform();

/** Every `loopbot.*` key in localStorage (minus SKIP), as a plain object. */
export function collectSaves(filter: (key: string) => boolean = () => true): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('loopbot.') || SKIP.has(k) || !filter(k)) continue;
      const v = localStorage.getItem(k);
      if (v !== null) out[k] = v;
    }
  } catch {
    /* storage blocked */
  }
  return out;
}

/** Writes keys back into localStorage. Returns how many were written. */
export function applySaves(saves: Record<string, string>, onlyMissing: boolean): number {
  let n = 0;
  try {
    for (const [k, v] of Object.entries(saves)) {
      if (!k.startsWith('loopbot.') || typeof v !== 'string') continue;
      if (onlyMissing && localStorage.getItem(k) !== null) continue;
      localStorage.setItem(k, v);
      n++;
    }
  } catch {
    /* storage full or blocked */
  }
  return n;
}

let lastWritten = '';
let dirty = false;

async function writeSnapshot() {
  if (!native()) return;
  dirty = false;
  const saves = collectSaves();
  if (!saves[SENTINEL]) return; // never overwrite a good snapshot with an empty one
  const json = JSON.stringify(saves);
  if (json === lastWritten) return;
  try {
    await Preferences.set({ key: SNAPSHOT_KEY, value: json });
    lastWritten = json;
  } catch {
    dirty = true; // try again on the next tick
  }
}

/** Call after a save that matters (progress, daily streak) so it is copied soon. */
export function markSavesDirty() {
  if (!native() || dirty) return;
  dirty = true;
  setTimeout(() => void writeSnapshot(), 1500);
}

/**
 * Brings saves back from the native snapshot if localStorage was wiped, then starts keeping the
 * snapshot fresh. Resolves quickly; never throws.
 */
export async function restoreSaves(): Promise<number> {
  if (!native()) return 0;
  let restored = 0;
  try {
    const { value } = await Preferences.get({ key: SNAPSHOT_KEY });
    if (value) {
      lastWritten = value;
      const lost = localStorage.getItem(SENTINEL) === null;
      if (lost) restored = applySaves(JSON.parse(value) as Record<string, string>, true);
    }
  } catch {
    /* a broken snapshot is ignored; the next write replaces it */
  }
  setInterval(() => void writeSnapshot(), TIMER_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void writeSnapshot();
  });
  void App.addListener('pause', () => void writeSnapshot());
  void writeSnapshot();
  return restored;
}
