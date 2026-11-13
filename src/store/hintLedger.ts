// Hint packs are consumables: each store transaction adds hints once, on the device that bought it.
// The ledger remembers which transactions were already paid out, so a restart, a store refresh or
// a second listener call never pays twice. Transactions from before this install first opened the
// store (a reinstall, or a new phone on the same store account) are not paid again: those hints
// were spent on the old device, and a backup code carries the ledger with the rest of the saves.

import { markSavesDirty } from '../storage/persist';

/** Hint packs for sale (growth plan, "Hints: earn them, and buy more if you want"). */
export const HINT_PACKS = [
  { id: 'loopbot_hints_10', hints: 10 },
  { id: 'loopbot_hints_40', hints: 40 },
] as const;

/** Hints LoopBot Plus adds once, the first time Plus is owned on this device. */
export const PLUS_BONUS_HINTS = 20;

export interface HintLedger {
  /** When this install started counting purchases (ISO time). */
  since: string;
  /** Store transaction ids already paid out. */
  credited: string[];
  /** Whether the Plus bonus has been paid. */
  plusBonus: boolean;
}

export interface StoreTransaction {
  transactionIdentifier: string;
  productIdentifier: string;
  purchaseDate: string;
}

export const LEDGER_KEY = 'loopbot.hintLedger';

export function freshLedger(now = new Date()): HintLedger {
  return { since: now.toISOString(), credited: [], plusBonus: false };
}

export function loadLedger(): HintLedger {
  try {
    const v = JSON.parse(localStorage.getItem(LEDGER_KEY) ?? 'null') as Partial<HintLedger> | null;
    if (v && typeof v.since === 'string' && Array.isArray(v.credited)) {
      return { since: v.since, credited: v.credited.filter((x): x is string => typeof x === 'string'), plusBonus: v.plusBonus === true };
    }
  } catch {
    /* fall through */
  }
  const l = freshLedger();
  saveLedger(l);
  return l;
}

export function saveLedger(l: HintLedger) {
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(l));
    markSavesDirty();
  } catch {
    /* ignore */
  }
}

const packHints = (productId: string) => HINT_PACKS.find((p) => p.id === productId)?.hints ?? 0;

/** The hints owed for transactions not paid yet, and the ledger with them marked as paid. */
export function payTransactions(l: HintLedger, txs: readonly StoreTransaction[]): { hints: number; ledger: HintLedger } {
  const since = Date.parse(l.since);
  let hints = 0;
  const credited = [...l.credited];
  for (const t of txs) {
    const n = packHints(t.productIdentifier);
    if (!n || credited.includes(t.transactionIdentifier)) continue;
    // a purchase made on another install, before this one existed
    if (Date.parse(t.purchaseDate) < since) continue;
    credited.push(t.transactionIdentifier);
    hints += n;
  }
  return { hints, ledger: hints ? { ...l, credited } : l };
}

/** The Plus bonus, if Plus is owned and it hasn't been paid on this device yet. */
export function payPlusBonus(l: HintLedger, ownsPlus: boolean): { hints: number; ledger: HintLedger } {
  if (!ownsPlus || l.plusBonus) return { hints: 0, ledger: l };
  return { hints: PLUS_BONUS_HINTS, ledger: { ...l, plusBonus: true } };
}
