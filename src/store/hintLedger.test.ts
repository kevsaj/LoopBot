import { describe, expect, it } from 'vitest';
import { PLUS_BONUS_HINTS, freshLedger, payPlusBonus, payTransactions } from './hintLedger';

const since = new Date('2026-11-13T10:00:00Z');
const tx = (id: string, product: string, date = '2026-11-13T12:00:00Z') => ({ transactionIdentifier: id, productIdentifier: product, purchaseDate: date });

describe('hint ledger', () => {
  it('pays each hint pack transaction once', () => {
    const a = payTransactions(freshLedger(since), [tx('t1', 'loopbot_hints_10'), tx('t2', 'loopbot_hints_40')]);
    expect(a.hints).toBe(50);
    const b = payTransactions(a.ledger, [tx('t1', 'loopbot_hints_10'), tx('t2', 'loopbot_hints_40'), tx('t3', 'loopbot_hints_10')]);
    expect(b.hints).toBe(10);
    expect(b.ledger.credited).toEqual(['t1', 't2', 't3']);
  });

  it('ignores Plus and unknown products', () => {
    expect(payTransactions(freshLedger(since), [tx('p', 'loopbot_plus'), tx('x', 'something_else')]).hints).toBe(0);
  });

  it('does not pay again for purchases made before this install', () => {
    expect(payTransactions(freshLedger(since), [tx('old', 'loopbot_hints_40', '2026-11-01T00:00:00Z')]).hints).toBe(0);
  });

  it('pays the Plus bonus once, only when Plus is owned', () => {
    const l = freshLedger(since);
    expect(payPlusBonus(l, false).hints).toBe(0);
    const a = payPlusBonus(l, true);
    expect(a.hints).toBe(PLUS_BONUS_HINTS);
    expect(payPlusBonus(a.ledger, true).hints).toBe(0);
  });
});
