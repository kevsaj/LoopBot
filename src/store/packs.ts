// City packs: one tower each, bought once, separate from LoopBot Plus (growth plan: city packs
// $2.99). Heatwave is the first. Each pack is a non-consumable store product that unlocks a
// RevenueCat entitlement of the same name, so a later Skyline Pass only needs attaching to every
// pack's entitlement in RevenueCat to unlock them all.
//
// Ownership is cached on the device (loopbot.packs) so packs work offline, and it is never in
// backup codes: the store is the only thing that can say a pack was bought.

export type PackId = 'heatwave';

export interface CityPack {
  id: PackId;
  /** Store product id, the same in App Store Connect and Play Console. */
  product: string;
  /** RevenueCat entitlement the product unlocks. */
  entitlement: string;
  /** The tower number the pack unlocks. */
  tower: number;
  city: string;
}

export const PACKS: CityPack[] = [{ id: 'heatwave', product: 'loopbot_pack_heatwave', entitlement: 'heatwave', tower: 3, city: 'Heatwave' }];

export const PACK_PRODUCTS = PACKS.map((p) => p.product);

const KEY = 'loopbot.packs';

export function packById(id: PackId): CityPack | undefined {
  return PACKS.find((p) => p.id === id);
}

/** The packs this device has been told it owns. */
export function ownedPacks(): PackId[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? PACKS.filter((p) => raw.includes(p.id)).map((p) => p.id) : [];
  } catch {
    return [];
  }
}

export function ownsPack(id: PackId): boolean {
  return ownedPacks().includes(id);
}

/** Saves what the store says is owned. Returns true when that changed anything. */
export function saveOwnedPacks(ids: PackId[]): boolean {
  const before = ownedPacks();
  const next = PACKS.filter((p) => ids.includes(p.id)).map((p) => p.id);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return before.join() !== next.join();
}

/** The packs a set of active RevenueCat entitlements unlocks. */
export function packsFromEntitlements(active: Record<string, unknown>): PackId[] {
  return PACKS.filter((p) => p.entitlement in active).map((p) => p.id);
}
