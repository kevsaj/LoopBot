// The Skyline Pass: one lifetime purchase that unlocks everything paid, now and later (growth plan:
// "lifetime Skyline Pass"). LoopBot Plus, every city pack, Overflow, and any tower added after it.
//
// It is its own non-consumable product with its own RevenueCat entitlement, `skyline`. The app
// treats that one entitlement as owning Plus and every pack (purchases.ts and packs.ts), so a
// tower added in a later update is in the pass the day it ships, with nothing to change in
// RevenueCat.
//
// Ownership is cached on the device (loopbot.skyline) so the pass works offline, and like the
// other purchases it is never in backup codes: the store is the only thing that can say it was bought.

import type { PackId } from './packs';

export const SKYLINE_PRODUCT = 'loopbot_skyline_pass';
export const SKYLINE_ENTITLEMENT = 'skyline';
const KEY = 'loopbot.skyline';

export function ownsSkyline(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Saves what the store says. Returns true when that changed anything. */
export function saveSkyline(owned: boolean): boolean {
  const was = ownsSkyline();
  try {
    localStorage.setItem(KEY, owned ? '1' : '0');
  } catch {
    /* ignore */
  }
  return was !== owned;
}

export const skylineIn = (active: Record<string, unknown>) => SKYLINE_ENTITLEMENT in active;

/** Something the pass includes: LoopBot Plus, or a city pack / Overflow. */
export type PassItemId = 'plus' | PackId;

export interface PassItem {
  id: PassItemId;
  owned: boolean;
  /** The store's price for this one on its own, as a number in the store's currency, if known. */
  price?: number;
}

/**
 * What the pass is worth to this player, for honest wording on the store screen. Stores sell one
 * fixed price, so a player who already owns some packs pays the same as everyone else: the screen
 * says so plainly, and says when the missing pieces would cost less on their own.
 */
export type PassDeal =
  /** Owns none of it. `separately` is what it all costs one by one. */
  | { kind: 'everything'; count: number; separately?: number }
  /** Owns some; the pass costs less than the rest bought one by one (or prices are unknown). */
  | { kind: 'adds'; owned: number; missing: number; separately?: number }
  /** Owns some; the missing pieces cost less on their own than the pass. */
  | { kind: 'cheaper-alone'; owned: number; missing: number; separately: number }
  /** Owns everything there is so far: the pass would only add future towers. */
  | { kind: 'owns-all' };

const sum = (items: PassItem[]) => (items.every((i) => typeof i.price === 'number') ? Math.round(items.reduce((s, i) => s + (i.price ?? 0), 0) * 100) / 100 : undefined);

export function passDeal(items: PassItem[], passPrice?: number): PassDeal {
  const missing = items.filter((i) => !i.owned);
  const owned = items.length - missing.length;
  if (!missing.length) return { kind: 'owns-all' };
  const separately = sum(missing);
  if (!owned) return { kind: 'everything', count: items.length, separately };
  if (separately !== undefined && passPrice !== undefined && separately <= passPrice) return { kind: 'cheaper-alone', owned, missing: missing.length, separately };
  return { kind: 'adds', owned, missing: missing.length, separately };
}

/** How much less the pass costs than buying it all one by one, in whole percent (0 if unknown). */
export function savingPercent(separately: number | undefined, passPrice: number | undefined): number {
  if (!separately || passPrice === undefined || passPrice >= separately) return 0;
  return Math.floor(((separately - passPrice) / separately) * 100);
}

/** A price in the store's currency, written for the player's language, e.g. "$26.92" or "26,92 $". */
export function formatPrice(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
