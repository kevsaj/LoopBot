// Tracks what the player has earned and shows a toast for anything new this session:
// an achievement, or a look unlocked by stars or an achievement. Things earned before this
// session (or before this feature existed) don't toast; the Locker button just shows a dot.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Progress } from '../progress';
import type { DailyState } from '../daily';
import { ACHIEVEMENTS, earnedIds } from './achievements';
import type { Stats } from './achievements';
import { partName, unlockedParts } from './looks';

const KEY = 'loopbot.rewardsSeen';

export interface Toast {
  id: string;
  icon: string;
  text: string;
}

function loadSeen(): Set<string> | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}
function saveSeen(s: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

/** Everything earned, as "ach:<id>" and "paint:<id>" / "eye:<id>" / "tip:<id>" keys. */
export function rewardKeys(earned: Set<string>, parts: Set<string>): Set<string> {
  return new Set([...[...earned].map((id) => `ach:${id}`), ...parts]);
}

export function useRewards(floors: string[], progress: Progress, daily: DailyState) {
  const stats: Stats = useMemo(() => ({ floors, progress, daily }), [floors, progress, daily]);
  const earned = useMemo(() => earnedIds(stats), [stats]);
  const parts = useMemo(() => unlockedParts(stats, earned), [stats, earned]);
  const all = useMemo(() => rewardKeys(earned, parts), [earned, parts]);

  const [seen, setSeen] = useState<Set<string>>(() => loadSeen() ?? new Set([...all].filter((k) => k.startsWith('ach:'))));
  // what was already earned when the app opened never toasts
  const atLaunch = useRef(all);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const fresh = [...all].filter((k) => !atLaunch.current.has(k));
    if (!fresh.length) return;
    atLaunch.current = new Set([...atLaunch.current, ...fresh]);
    const next: Toast[] = fresh.map((k) => {
      if (k.startsWith('ach:')) {
        const a = ACHIEVEMENTS.find((x) => `ach:${x.id}` === k)!;
        return { id: k, icon: a.icon, text: `Achievement: ${a.title}` };
      }
      return { id: k, icon: '🎨', text: `New look: ${partName(k)}` };
    });
    setToasts((t) => [...t, ...next]);
    // achievements count as seen once toasted; new looks stay "new" until the Locker opens
    setSeen((s) => {
      const n = new Set([...s, ...fresh.filter((k) => k.startsWith('ach:'))]);
      saveSeen(n);
      return n;
    });
  }, [all]);

  const hasNew = [...all].some((k) => !seen.has(k) && !k.endsWith(':classic') && !k.endsWith(':teal') && !k.endsWith(':ball'));
  const markAllSeen = () => {
    const n = new Set(all);
    saveSeen(n);
    setSeen(n);
  };
  const dismissToast = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  return { stats, earned, toasts, dismissToast, hasNew, markAllSeen };
}
