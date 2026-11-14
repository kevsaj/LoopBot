import { beforeEach, describe, expect, it } from 'vitest';
import { PACKS, ownedPacks, ownsPack, packsFromEntitlements, saveOwnedPacks } from './packs';
import { TOWERS } from '../levels/towers';

class MemStorage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

describe('city packs', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
  });

  it('owns nothing until the store says so', () => {
    expect(ownedPacks()).toEqual([]);
    expect(ownsPack('heatwave')).toBe(false);
  });

  it('reads packs from the active RevenueCat entitlements, ignoring Plus', () => {
    expect(packsFromEntitlements({ plus: {} })).toEqual([]);
    expect(packsFromEntitlements({ plus: {}, heatwave: {} })).toEqual(['heatwave']);
  });

  it('caches ownership and reports changes', () => {
    expect(saveOwnedPacks(['heatwave'])).toBe(true);
    expect(ownsPack('heatwave')).toBe(true);
    expect(saveOwnedPacks(['heatwave'])).toBe(false);
    expect(saveOwnedPacks([])).toBe(true);
    expect(ownsPack('heatwave')).toBe(false);
  });

  it('ignores a damaged or unknown cache', () => {
    localStorage.setItem('loopbot.packs', 'not json');
    expect(ownedPacks()).toEqual([]);
    localStorage.setItem('loopbot.packs', '["heatwave","overflow"]');
    expect(ownedPacks()).toEqual(['heatwave']);
  });

  it('points every pack at a tower that is sold as that pack', () => {
    for (const p of PACKS) {
      const tower = TOWERS.find((t) => t.n === p.tower);
      // Tests run as a dev build, so preview towers are present.
      expect(tower?.pack, p.id).toBe(p.id);
      expect(tower?.plus, p.id).toBe(false);
      expect(tower?.city).toBe(p.city);
    }
  });

  it('keeps pack ownership out of backup codes', async () => {
    const { makeBackupCode, readBackupCode } = await import('../storage/backup');
    localStorage.setItem('loopbot.progress', JSON.stringify({ stars: { 't1-f01': 3 } }));
    localStorage.setItem('loopbot.packs', '["heatwave"]');
    const saves = readBackupCode(makeBackupCode());
    expect(saves).not.toBeNull();
    expect(Object.keys(saves ?? {})).not.toContain('loopbot.packs');
  });
});
