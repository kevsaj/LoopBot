import { beforeEach, describe, expect, it } from 'vitest';
import { makeBackupCode, readBackupCode, restoreBackupCode } from './backup';

class MemStorage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
});

describe('backup codes', () => {
  it('round-trips progress and the daily streak, leaving programs and stats out', () => {
    localStorage.setItem('loopbot.progress', JSON.stringify({ stars: { 't1-f01': 3 }, hints: 4 }));
    localStorage.setItem('loopbot.daily', JSON.stringify({ streak: 5 }));
    localStorage.setItem('loopbot.editor.t1-f01', '{"program":[]}');
    localStorage.setItem('loopbot.statsId', 'abc');
    const code = makeBackupCode();
    expect(code.startsWith('LB1-')).toBe(true);
    localStorage.clear();
    expect(restoreBackupCode(`  ${code}\n`)).toEqual({ ok: true, keys: 2 });
    expect(JSON.parse(localStorage.getItem('loopbot.progress')!).stars['t1-f01']).toBe(3);
    expect(localStorage.getItem('loopbot.editor.t1-f01')).toBeNull();
    expect(localStorage.getItem('loopbot.statsId')).toBeNull();
  });

  it('rejects a cut-off or edited code without touching saves', () => {
    localStorage.setItem('loopbot.progress', '{"stars":{}}');
    const code = makeBackupCode();
    expect(readBackupCode(code.slice(0, -6))).toBeNull();
    expect(readBackupCode(code.replace('LB1-e', 'LB1-f'))).toBeNull();
    expect(readBackupCode('hello')).toBeNull();
    expect(restoreBackupCode('LB1-xx-0000').ok).toBe(false);
  });
});
