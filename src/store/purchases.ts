// LoopBot Plus, a one-time purchase, through RevenueCat (one integration for the App Store and
// Google Play, with Restore built in). Nothing here runs on the web or in the itch demo.
//
// Setup (once, in Kevin's accounts):
//  - App Store Connect: non-consumable in-app purchases `loopbot_plus`, `loopbot_pack_heatwave`,
//    `loopbot_pack_twist`, `loopbot_pack_dockyard`, `loopbot_pack_twinspires`,
//    `loopbot_pack_fractal`, `loopbot_pack_precinct404`, `loopbot_overflow` and
//    `loopbot_skyline_pass`, and two consumables,
//    `loopbot_hints_10` and `loopbot_hints_40`.
//  - Play Console: one-time products with the same ten ids.
//  - RevenueCat: entitlement `plus` with `loopbot_plus` attached, entitlement `heatwave` with
//    `loopbot_pack_heatwave` attached, entitlement `twist` with `loopbot_pack_twist` attached,
//    entitlement `dockyard` with `loopbot_pack_dockyard` attached, entitlement `twinspires` with
//    `loopbot_pack_twinspires` attached, entitlement `fractal` with `loopbot_pack_fractal`
//    attached, entitlement `precinct404` with `loopbot_pack_precinct404` attached, entitlement
//    `overflow` with `loopbot_overflow` attached, entitlement `skyline` with
//    `loopbot_skyline_pass` attached (see store/skyline.ts; the app reads `skyline` as owning
//    everything, so the pass needs attaching to nothing else) (see
//    store/packs.ts), and an
//    offering whose package holds
//    Plus (the package with `loopbot_plus` is what the Plus sheet sells).
//  - Public SDK keys in .env.local: VITE_REVENUECAT_IOS_KEY and VITE_REVENUECAT_ANDROID_KEY.
//
// Ownership is cached on the device (loopbot.plus) so Plus works offline; the store's answer
// replaces the cache whenever the app can reach it.

import { Capacitor } from '@capacitor/core';
import type { PurchasesPackage, PurchasesStoreProduct } from '@revenuecat/purchases-capacitor';
import { HINT_PACKS, loadLedger, payPlusBonus, payTransactions, saveLedger } from './hintLedger';
import type { StoreTransaction } from './hintLedger';
import { PACK_PRODUCTS, ownsPack, packById, packsFromEntitlements, saveOwnedPacks } from './packs';
import type { PackId } from './packs';
import { SKYLINE_PRODUCT, ownsSkyline, saveSkyline, skylineIn } from './skyline';
import type { PassItemId } from './skyline';
import type { Tower } from '../levels/towers';

export const ENTITLEMENT = 'plus';
export const PLUS_PRODUCT = 'loopbot_plus';
const KEY = 'loopbot.plus';

const env = import.meta.env as Record<string, string | undefined>;
const API_KEY = (Capacitor.getPlatform() === 'ios' ? env.VITE_REVENUECAT_IOS_KEY : Capacitor.getPlatform() === 'android' ? env.VITE_REVENUECAT_ANDROID_KEY : '')?.trim() ?? '';

/** Whether this build can sell anything: a phone build with a RevenueCat key. */
export const STORE_AVAILABLE = Capacitor.isNativePlatform() && API_KEY !== '';

/**
 * Whether the store shows at all: the Plus screen, the city packs, hint packs and the
 * Settings purchase rows. Off until Plus goes on sale, so players never see something they can't
 * buy yet. VITE_PLUS=1 (the "Plus store" box in the build workflows) turns it on.
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

/** Whether a city pack can be played on this device right now. */
export function packUnlocked(id: PackId): boolean {
  return PLUS_PREVIEW || ownsPack(id);
}

/** Whether a tower can be played here: free, or its Plus / city pack is unlocked. */
export function towerUnlocked(t: Pick<Tower, 'plus' | 'pack'>): boolean {
  if (t.plus) return plusUnlocked();
  if (t.pack) return packUnlocked(t.pack);
  return true;
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
/** Plus is owned on its own, or as part of the Skyline Pass. */
const ownsPlus = (info: CustomerInfoLike) => ENTITLEMENT in info.entitlements.active || skylineIn(info.entitlements.active);

type SkylineListener = (owned: boolean) => void;
const skylineListeners = new Set<SkylineListener>();

/** Called when the Skyline Pass is bought, restored or refunded. Returns a function that stops listening. */
export function onSkylineChange(l: SkylineListener): () => void {
  skylineListeners.add(l);
  return () => skylineListeners.delete(l);
}

/** Takes the store's word for the Skyline Pass, and returns it. */
function syncSkyline(info: CustomerInfoLike): boolean {
  const owned = skylineIn(info.entitlements.active);
  if (saveSkyline(owned)) skylineListeners.forEach((l) => l(owned));
  return owned;
}

type PacksListener = (owned: PackId[]) => void;
const packListeners = new Set<PacksListener>();

/** Called when the city packs owned on this device change. Returns a function that stops listening. */
export function onPacksChange(l: PacksListener): () => void {
  packListeners.add(l);
  return () => packListeners.delete(l);
}

/** Takes the store's word for which packs are owned, and returns them. */
function syncPacks(info: CustomerInfoLike): PackId[] {
  const owned = packsFromEntitlements(info.entitlements.active);
  if (saveOwnedPacks(owned)) packListeners.forEach((l) => l(owned));
  return owned;
}

/** Everything the store says about this customer: Plus, packs, and hint packs to pay out. */
function sync(info: CustomerInfoLike) {
  syncSkyline(info);
  setOwned(ownsPlus(info));
  syncPacks(info);
  payHintPacks(info);
}

let ready: Promise<typeof import('@revenuecat/purchases-capacitor')> | null = null;

/** Connects to the store once, early in the app's life, and keeps ownership up to date. */
export function initPurchases(): Promise<boolean> {
  if (!STORE_AVAILABLE) return Promise.resolve(false);
  ready ??= import('@revenuecat/purchases-capacitor').then(async (rc) => {
    await rc.Purchases.configure({ apiKey: API_KEY });
    await rc.Purchases.addCustomerInfoUpdateListener(sync);
    const { customerInfo } = await rc.Purchases.getCustomerInfo();
    sync(customerInfo);
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
    // Plus is the package holding `loopbot_plus`; hint packs and city packs may sit in the same offering.
    const pkgs = current?.availablePackages ?? [];
    const other = (id: string) => HINT_PACKS.some((h) => h.id === id) || PACK_PRODUCTS.includes(id) || id === SKYLINE_PRODUCT;
    const pkg = pkgs.find((p) => p.product.identifier === PLUS_PRODUCT) ?? pkgs.find((p) => !other(p.product.identifier));
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
    syncSkyline(customerInfo);
    const plus = ownsPlus(customerInfo);
    setOwned(plus);
    const packs = syncPacks(customerInfo);
    payHintPacks(customerInfo);
    return plus || packs.length ? 'restored' : 'nothing';
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

export interface PackOffer {
  id: PackId;
  /** The store's localized price, for example "$2.99". */
  price: string;
  product: PurchasesStoreProduct;
}

/** A city pack with its store price, or null if the store can't be reached. */
export async function getPackOffer(id: PackId): Promise<PackOffer | null> {
  const pack = packById(id);
  if (!pack || !(await initPurchases()) || !ready) return null;
  try {
    const rc = await ready;
    const { products } = await rc.Purchases.getProducts({ productIdentifiers: [pack.product], type: rc.PRODUCT_CATEGORY.NON_SUBSCRIPTION });
    const product = products.find((x) => x.identifier === pack.product);
    return product ? { id, price: product.priceString, product } : null;
  } catch {
    return null;
  }
}

/** Buys a city pack. Bought means the store now reports the pack's entitlement as active. */
export async function buyPack(offer: PackOffer): Promise<BuyResult> {
  if (!ready) return 'failed';
  try {
    const rc = await ready;
    const { customerInfo } = await rc.Purchases.purchaseStoreProduct({ product: offer.product });
    return syncPacks(customerInfo).includes(offer.id) ? 'bought' : 'failed';
  } catch (err) {
    return (err as { userCancelled?: boolean | null })?.userCancelled ? 'cancelled' : 'failed';
  }
}

export interface SkylineOffer {
  /** The store's localized price for the pass, for example "$14.99". */
  price: string;
  /** The same price as a number, and its currency, to compare with buying the pieces one by one. */
  amount: number;
  currency: string;
  product: PurchasesStoreProduct;
  /** Each piece's own store price, where the store knows it (same currency as the pass). */
  prices: Partial<Record<PassItemId, number>>;
}

const productOf = (id: PassItemId) => (id === 'plus' ? PLUS_PRODUCT : packById(id)?.product ?? '');

/**
 * The Skyline Pass with its store price, and the prices of the pieces it includes (for the
 * "bought one by one" comparison), or null if the store can't be reached.
 */
export async function getSkylineOffer(items: PassItemId[]): Promise<SkylineOffer | null> {
  if (!(await initPurchases()) || !ready) return null;
  try {
    const rc = await ready;
    const ids = [SKYLINE_PRODUCT, ...items.map(productOf)];
    const { products } = await rc.Purchases.getProducts({ productIdentifiers: ids, type: rc.PRODUCT_CATEGORY.NON_SUBSCRIPTION });
    const product = products.find((x) => x.identifier === SKYLINE_PRODUCT);
    if (!product) return null;
    const prices: Partial<Record<PassItemId, number>> = {};
    for (const id of items) {
      const p = products.find((x) => x.identifier === productOf(id));
      // Only compare like with like: a piece priced in another currency is left out.
      if (p && p.currencyCode === product.currencyCode) prices[id] = p.price;
    }
    return { price: product.priceString, amount: product.price, currency: product.currencyCode, product, prices };
  } catch {
    return null;
  }
}

/** Buys the Skyline Pass. Bought means the store now reports the `skyline` entitlement as active. */
export async function buySkyline(offer: SkylineOffer): Promise<BuyResult> {
  if (!ready) return 'failed';
  try {
    const rc = await ready;
    const { customerInfo } = await rc.Purchases.purchaseStoreProduct({ product: offer.product });
    sync(customerInfo);
    return skylineIn(customerInfo.entitlements.active) ? 'bought' : 'failed';
  } catch (err) {
    return (err as { userCancelled?: boolean | null })?.userCancelled ? 'cancelled' : 'failed';
  }
}

/** Whether to point a player at the Skyline Pass: the store is open and they don't have it yet. */
export function skylineOnSale(): boolean {
  return SHOP_OPEN && !ownsSkyline();
}
