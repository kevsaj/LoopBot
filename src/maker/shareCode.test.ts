import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { FROSTLINE } from '../levels/frostline';
import { cleanTitle, decodeFloor, encodeFloor } from './shareCode';

const ALL = [...LEVELS, ...FROSTLINE];

describe('floor share codes', () => {
  it('every tower floor survives a round trip', () => {
    for (const l of ALL) {
      const code = encodeFloor(l);
      const back = decodeFloor(code);
      if (!back.ok) throw new Error(`${l.id}: ${back.error}`);
      const d = back.level;
      expect(d.size, l.id).toEqual(l.size);
      expect(d.tiles, l.id).toEqual(l.tiles);
      expect(d.heights ?? null, l.id).toEqual(l.heights && l.heights.some((r) => /[1-3]/.test(r)) ? l.heights : null);
      expect(d.bot, l.id).toEqual(l.bot);
      expect(d.boxes, l.id).toEqual(l.boxes);
      expect(d.targets, l.id).toEqual(l.targets);
      expect(d.links ?? [], l.id).toEqual(l.links ?? []);
      expect([...d.goals].sort(), l.id).toEqual([...l.goals].sort());
      expect([...d.commands].sort(), l.id).toEqual([...l.commands].sort());
      expect(new Set(d.sensors ?? ['wall_ahead']), l.id).toEqual(new Set(['wall_ahead', ...(l.sensors ?? [])]));
      expect(d.slots, l.id).toEqual(l.slots);
      expect(d.par, l.id).toEqual(l.par);
      expect(d.band, l.id).toBe(l.band);
      expect(d.title, l.id).toBe(cleanTitle(l.title));
    }
  });

  it('codes stay short enough to paste', () => {
    const longest = Math.max(...ALL.map((l) => encodeFloor(l).length));
    expect(longest).toBeLessThan(170);
  });

  it('forgives case, spaces and look-alike letters', () => {
    const code = encodeFloor(LEVELS[19]);
    expect(decodeFloor(code.toLowerCase()).ok).toBe(true);
    expect(decodeFloor(code.replace(/-/g, ' ')).ok).toBe(true);
    expect(decodeFloor(code.replace(/0/g, 'O')).ok).toBe(true);
  });

  it('rejects broken codes with a reason', () => {
    const code = encodeFloor(LEVELS[19]);
    const typo = code.slice(0, 12) + (code[12] === 'A' ? 'B' : 'A') + code.slice(13);
    for (const bad of ['', 'hello', 'LBF1-', code.slice(0, code.length - 6), typo, 'LB1-abc', code + '!']) {
      const r = decodeFloor(bad);
      expect(r.ok, bad).toBe(false);
      if (!r.ok) expect(r.error.length).toBeGreaterThan(5);
    }
  });

  it('never throws on random junk', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    for (let i = 0; i < 2000; i++) {
      const len = Math.floor(rnd() * 120);
      const body = Array.from({ length: len }, () => B32[Math.floor(rnd() * 32)]).join('');
      expect(() => decodeFloor('LBF1-' + body)).not.toThrow();
    }
  });

  it('titles keep only what fits', () => {
    expect(cleanTitle("VANTA's  Lair!!")).toBe('VANTA s Lair');
    expect(cleanTitle('x'.repeat(40))).toHaveLength(24);
  });
});
