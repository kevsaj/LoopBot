// The first gift: clearing Tower 1's Floor 3 unlocks PATCH's spare parts (Lilac paint and the Gear
// antenna), so a new player earns something of their own within the first few minutes. The parts
// unlock in looks.ts ({ floor: 3 }); this file decides when the gift card plays (once, the first
// time the player leaves Floor 3 after clearing it) and what the early goal lines say.

import type { Look } from './looks';
import { msg } from '../i18n';

/** The Tower 1 floor whose first clear opens the gift. */
export const GIFT_FLOOR = 3;
/** What's in the gift, as Locker keys (these don't get the usual "New look" toast: the card says it). */
export const GIFT_PARTS = ['paint:lilac', 'tip:gear'];

const KEY = 'loopbot.gift.opened';

export function giftOpened(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markGiftOpened() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Whether leaving this floor should open the gift card. */
export function giftDue(tower: number, floorNumber: number, cleared: boolean, opened = giftOpened()): boolean {
  return tower === 1 && floorNumber === GIFT_FLOOR && cleared && !opened;
}

/** The look with the gift on, keeping the player's eye colour. */
export function wearGift(l: Look): Look {
  return { ...l, paint: 'lilac', tip: 'gear' };
}

export interface Goal {
  /** Which small picture goes with it. */
  icon: 'gift' | 'radio' | 'lock';
  text: string;
  vars?: Record<string, string | number>;
}

/**
 * The next thing to aim for, shown on the results card after a first clear in Tower 1's Lobby:
 * the gift on Floor 3, PATCH's call after Floor 5, then Maintenance (loops) at Floor 10. Only on
 * a first clear, so progress is known to be linear: nothing past this floor is cleared yet.
 */
export function earlyGoal(tower: number, floorNumber: number, firstClear: boolean, demo = false, opened = giftOpened()): Goal | null {
  if (tower !== 1 || !firstClear) return null;
  if (floorNumber < GIFT_FLOOR && !opened) return { icon: 'gift', text: msg('Clear Floor 3 to unlock a gift from PATCH.') };
  if (floorNumber === GIFT_FLOOR && !opened) return { icon: 'gift', text: msg('PATCH left you a gift! Tap Next floor to open it.') };
  if (floorNumber === 4) return { icon: 'radio', text: msg('Clear Floor 5. PATCH is picking up a strange signal.') };
  if (floorNumber === 9 && !demo) return { icon: 'lock', text: msg('One more floor to Maintenance, where LoopBot learns loops.') };
  if (floorNumber >= 5 && floorNumber < 9 && !demo) return { icon: 'lock', text: msg('{n} floors to Maintenance, where LoopBot learns loops.'), vars: { n: 10 - floorNumber } };
  return null;
}
