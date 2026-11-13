// LoopBot Plus, a one-time purchase, through RevenueCat (one integration for the App Store and
// Google Play, with Restore built in). Nothing here runs on the web or in the itch demo.
//
// Setup (once, in Kevin's accounts):
//  - App Store Connect: a non-consumable in-app purchase, product id `loopbot_plus`, and two
//    consumables, `loopbot_hints_10` and `loopbot_hints_40`.
//  - Play Console: one-time products with the same three ids.
//  - RevenueCat: entitlement `plus` with both products attached, and an offering whose package
//    holds them (the current offering's first package is what the Plus sheet sells).
//  - Public SDK keys in .env.local: VITE_REVENUECAT_IOS_KEY and VITE_REVENUECAT_ANDROID_KEY.
//
// Ownership is cached on the device (loopbot.plus) so Plus works offline; the store's answer
// replaces the cache whenever the app can reach it.

import { Capacitor } from '@capacitor/core';
import type { PurchasesPackage, PurchasesStoreProduct } from '@revenuecat/purchases-capacitor';
import { HINT_PACKS, loadLedger, payPlusBonus, payTransactions, saveLedger } from './hintLedger';
import type { StoreTransaction } from './hintLedger';

export const ENTITLEMENT = 'plus';
export const PLUS_PRODUCT = 'loopbot_plus';
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

/** Whether anything can be bought in this build: Plus is on sale and the store is reachable. */
export const SHOP_OPEN = PLUS_VISIBLE && STORE_AVAILABLE;

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
  if (owned) grant(payPlusBonus(loadLedger(), true));
}

// --- Hints bought, or the Plus bonus: the app adds them to the player's wallet ---

type HintListener = (hints: number) => void;
const hintListeners = new Set<HintListener>();
/** Hints owed before the app was listening (the store answers very early at launch). */
let owedHints = 0;

/** Called with every batch of hints the store pays out. Returns a function that stops listening. */
export function onHintsGranted(l: HintListener): () => void {
  hintListeners.add(l);
  if (owedHints) {
    const n = owedHints;
    owedHints = 0;
    l(n);
  }
  return () => hintListeners.delete(l);
}

function grant({ hints, ledger }: { hints: number; ledger: ReturnType<typeof loadLedger> }) {
  if (!hints) return;
  saveLedger(ledger);
  if (hintListeners.size) hintListeners.forEach((l) => l(hints));
  else owedHints += hints;
}

/** Pays out any hint pack the store knows about that this device hasn't paid yet. */
function payHintPacks(info: { nonSubscriptionTransactions?: readonly StoreTransaction[] }) {
  grant(payTransactions(loadLedger(), info.nonSubscriptionTransactions ?? []));
}

export function onPlusChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

type CustomerInfoLike = { entitlements: { active: Record<string, unknown> }; nonSubscriptionTransactions?: readonly StoreTransaction[] };
const ownsPlus = (info: CustomerInfoLike) => ENTITLEMENT in info.entitlements.active;

let ready: Promise<typeof import('@revenuecat/purchases-capacitor')> | null = null;

/** Connects to the store once, early in the app's life, and keeps ownership up to date. */
export function initPurchases(): Promise<boolean> {
  if (!STORE_AVAILABLE) return Promise.resolve(false);
  ready ??= import('@revenuecat/purchases-capacitor').then(async (rc) => {
    await rc.Purchases.configure({ apiKey: API_KEY });
    await rc.Purchases.addCustomerInfoUpdateListener((info) => {
      setOwned(ownsPlus(info));
      payHintPacks(info);
    });
    const { customerInfo } = await rc.Purchases.getCustomerInfo();
    setOwned(ownsPlus(customerInfo));
    payHintPacks(customerInfo);
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
    // Plus is the package holding `loopbot_plus`; hint packs may sit in the same offering.
    const pkgs = current?.availablePackages ?? [];
    const pkg = pkgs.find((p) => p.product.identifier === PLUS_PRODUCT) ?? pkgs.find((p) => !HINT_PACKS.some((h) => h.id === p.product.identifier));
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

export interface HintOffer {
  hints: number;
  /** The store's localized price. */
  price: string;
  product: PurchasesStoreProduct;
}

/** The hint packs with their store prices, smallest first, or [] if the store can't be reached. */
export async function getHintOffers(): Promise<HintOffer[]> {
  if (!(await initPurchases()) || !ready) return [];
  try {
    const rc = await ready;
    const { products } = await rc.Purchases.getProducts({ productIdentifiers: HINT_PACKS.map((p) => p.id), type: rc.PRODUCT_CATEGORY.NON_SUBSCRIPTION });
    return HINT_PACKS.flatMap((p) => {
      const product = products.find((x) => x.identifier === p.id);
      return product ? [{ hints: p.hints, price: product.priceString, product }] : [];
    });
  } catch {
    return [];
  }
}

/** Buys a hint pack. The hints arrive through onHintsGranted, once per purchase. */
export async function buyHints(offer: HintOffer): Promise<BuyResult> {
  if (!ready) return 'failed';
  try {
    const rc = await ready;
    const { customerInfo, transaction } = await rc.Purchases.purchaseStoreProduct({ product: offer.product });
    const before = loadLedger().credited.length;
    payHintPacks({ nonSubscriptionTransactions: [...(customerInfo.nonSubscriptionTransactions ?? []), ...(transaction ? [transaction] : [])] });
    return loadLedger().credited.length > before ? 'bought' : 'failed';
  } catch (err) {
    return (err as { userCancelled?: boolean | null })?.userCancelled ? 'cancelled' : 'failed';
  }
}
