// LoopBot Plus, a one-time purchase, through RevenueCat (one integration for the App Store and
// Google Play, with Restore built in). Nothing here runs on the web or in the itch demo.
//
// Setup (once, in Kevin's accounts):
//  - App Store Connect: a non-consumable in-app purchase, product id `loopbot_plus`.
//  - Play Console: a one-time product, product id `loopbot_plus`.
//  - RevenueCat: entitlement `plus` with both products attached, and an offering whose package
//    holds them (the current offering's first package is what the Plus sheet sells).
//  - Public SDK keys in .env.local: VITE_REVENUECAT_IOS_KEY and VITE_REVENUECAT_ANDROID_KEY.
//
// Ownership is cached on the device (loopbot.plus) so Plus works offline; the store's answer
// replaces the cache whenever the app can reach it.

import { Capacitor } from '@capacitor/core';
import type { PurchasesPackage } from '@revenuecat/purchases-capacitor';

export const ENTITLEMENT = 'plus';
const KEY = 'loopbot.plus';

const env = import.meta.env as Record<string, string | undefined>;
const API_KEY = (Capacitor.getPlatform() === 'ios' ? env.VITE_REVENUECAT_IOS_KEY : Capacitor.getPlatform() === 'android' ? env.VITE_REVENUECAT_ANDROID_KEY : '')?.trim() ?? '';

/** Whether this build can sell anything: a phone build with a RevenueCat key. */
export const STORE_AVAILABLE = Capacitor.isNativePlatform() && API_KEY !== '';

/**
 * Whether the Plus screen and the Settings rows show at all. Off until Frostline ships, so players
 * never see something they can't use yet. VITE_PLUS=1 turns it on for sandbox testing.
 */
export const PLUS_VISIBLE = env.VITE_PLUS === '1';

/**
 * Plays Plus content without buying it: dev builds, and builds made with VITE_PLUS_PREVIEW=1 (the
 * CI debug APK), so Frostline can be tested on a phone before the store is set up.
 */
export const PLUS_PREVIEW = import.meta.env.DEV || env.VITE_PLUS_PREVIEW === '1';

/** Whether Plus content can be played on this device right now. */
export function plusUnlocked(): boolean {
  return PLUS_PREVIEW || hasPlus();
}

type Listener = (owned: boolean) => void;
const listeners = new Set<Listener>();

export function hasPlus(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function setOwned(owned: boolean) {
  const was = hasPlus();
  try {
    localStorage.setItem(KEY, owned ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (was !== owned) listeners.forEach((l) => l(owned));
}

export function onPlusChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

type CustomerInfoLike = { entitlements: { active: Record<string, unknown> } };
const ownsPlus = (info: CustomerInfoLike) => ENTITLEMENT in info.entitlements.active;

let ready: Promise<typeof import('@revenuecat/purchases-capacitor')> | null = null;

/** Connects to the store once, early in the app's life, and keeps ownership up to date. */
export function initPurchases(): Promise<boolean> {
  if (!STORE_AVAILABLE) return Promise.resolve(false);
  ready ??= import('@revenuecat/purchases-capacitor').then(async (rc) => {
    await rc.Purchases.configure({ apiKey: API_KEY });
    await rc.Purchases.addCustomerInfoUpdateListener((info) => setOwned(ownsPlus(info)));
    const { customerInfo } = await rc.Purchases.getCustomerInfo();
    setOwned(ownsPlus(customerInfo));
    return rc;
  });
  return ready.then(
    () => true,
    () => {
      ready = null;
      return false;
    },
  );
}

export interface PlusOffer {
  /** The store's localized price, for example "$4.99" or "4,99 €". */
  price: string;
  pkg: PurchasesPackage;
}

export async function getPlusOffer(): Promise<PlusOffer | null> {
  if (!(await initPurchases()) || !ready) return null;
  try {
    const rc = await ready;
    const { current } = await rc.Purchases.getOfferings();
    const pkg = current?.availablePackages[0];
    return pkg ? { price: pkg.product.priceString, pkg } : null;
  } catch {
    return null;
  }
}

export type BuyResult = 'bought' | 'cancelled' | 'failed';

export async function buyPlus(offer: PlusOffer): Promise<BuyResult> {
  if (!ready) return 'failed';
  try {
    const rc = await ready;
    const { customerInfo } = await rc.Purchases.purchasePackage({ aPackage: offer.pkg });
    const owned = ownsPlus(customerInfo);
    setOwned(owned);
    return owned ? 'bought' : 'failed';
  } catch (err) {
    return (err as { userCancelled?: boolean | null })?.userCancelled ? 'cancelled' : 'failed';
  }
}

export type RestoreResult = 'restored' | 'nothing' | 'failed' | 'unavailable';

export async function restorePurchases(): Promise<RestoreResult> {
  if (!(await initPurchases()) || !ready) return 'unavailable';
  try {
    const rc = await ready;
    const { customerInfo } = await rc.Purchases.restorePurchases();
    const owned = ownsPlus(customerInfo);
    setOwned(owned);
    return owned ? 'restored' : 'nothing';
  } catch {
    return 'failed';
  }
}
