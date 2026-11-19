import { beforeEach, describe, expect, it } from 'vitest';
import { formatPrice, ownsSkyline, passDeal, saveSkyline, savingPercent } from './skyline';
import type { PassItem } from './skyline';
import { PACKS, packsFromEntitlements } from './packs';

class MemStorage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

const items = (owned: string[], prices = true): PassItem[] =>
  (['plus', 'heatwave', 'twist', 'overflow'] as const).map((id) => ({ id, owned: owned.includes(id), price: prices ? (id === 'plus' ? 4.99 : id === 'overflow' ? 3.99 : 2.99) : undefined }));

describe('Skyline Pass', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
  });

  it('unlocks every pack, including ones added later, from its one entitlement', () => {
    expect(packsFromEntitlements({ skyline: {} })).toEqual(PACKS.map((p) => p.id));
    expect(packsFromEntitlements({ heatwave: {} })).toEqual(['heatwave']);
  });

  it('caches ownership and reports changes', () => {
    expect(ownsSkyline()).toBe(false);
    expect(saveSkyline(true)).toBe(true);
    expect(saveSkyline(true)).toBe(false);
    expect(ownsSkyline()).toBe(true);
  });

  it('compares with buying everything one by one for a new player', () => {
    expect(passDeal(items([]), 9.99)).toEqual({ kind: 'everything', count: 4, separately: 14.96 });
    expect(savingPercent(14.96, 9.99)).toBe(33);
    expect(savingPercent(14.96, 19.99)).toBe(0);
  });

  it('counts only what is missing for a player who owns some', () => {
    expect(passDeal(items(['plus']), 7.99)).toEqual({ kind: 'adds', owned: 1, missing: 3, separately: 9.97 });
  });

  it('says so when the missing pieces cost less on their own', () => {
    expect(passDeal(items(['plus', 'heatwave', 'overflow']), 7.99)).toEqual({ kind: 'cheaper-alone', owned: 3, missing: 1, separately: 2.99 });
  });

  it('knows when there is nothing left to add but future towers', () => {
    expect(passDeal(items(['plus', 'heatwave', 'twist', 'overflow']), 7.99)).toEqual({ kind: 'owns-all' });
  });

  it('leaves the total out when a price is unknown', () => {
    expect(passDeal(items(['plus'], false), 7.99)).toEqual({ kind: 'adds', owned: 1, missing: 3, separately: undefined });
  });

  it('writes prices in the player language', () => {
    expect(formatPrice(26.92, 'USD', 'en')).toBe('$26.92');
    expect(formatPrice(26.92, 'CAD', 'fr-CA').replace(/\s/g, ' ')).toBe('26,92 $');
    expect(formatPrice(1, 'NOPE', 'en')).toMatch(/1/);
  });
});
