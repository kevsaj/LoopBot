import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BAND_ORDER, CANDY_CONFETTI, FLAVOURS, flavourOf } from './colourful';

/** WCAG relative luminance of a #rrggbb colour. */
function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const css = readFileSync(new URL('./colourful.css', import.meta.url), 'utf8');
const token = (name: string) => css.match(new RegExp(`--${name}: (#[0-9a-f]{6});`))![1];

describe('Colourful mode', () => {
  it('gives neighbouring bands different flavours, the same one every time', () => {
    for (let i = 1; i < BAND_ORDER.length; i++) expect(flavourOf(BAND_ORDER[i])).not.toBe(flavourOf(BAND_ORDER[i - 1]));
    expect(flavourOf('lobby')).toBe(flavourOf('lobby'));
    expect(flavourOf('some-new-band')).toBeGreaterThanOrEqual(0);
    expect(flavourOf('some-new-band')).toBeLessThan(FLAVOURS.length);
  });

  it('covers every band the board knows', () => {
    const board = readFileSync(new URL('./board/BoardScene.ts', import.meta.url), 'utf8');
    const bands = board.slice(board.indexOf('const BANDS'), board.indexOf('export function setBand')).match(/^ {2}([a-z0-9]+): \{/gm)!.map((l) => l.trim().split(':')[0]);
    for (const b of bands) expect(BAND_ORDER, b).toContain(b);
  });

  it('has a sky in the CSS for every flavour', () => {
    FLAVOURS.forEach((_, i) => expect(css).toContain(`.board-wrap[data-flavour='${i}']`));
  });

  it('keeps text readable (at least 4.5:1)', () => {
    const ink = token('ink');
    for (const bg of ['bg', 'panel', 'panel-2']) expect(contrast(ink, token(bg)), bg).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('quiet'), token('panel-2'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('accent-ink'), token('accent'))).toBeGreaterThanOrEqual(4.5);
    // dark ink on every candy block and on the lemon "running" button
    for (const tone of ['move', 'turn', 'hand', 'act', 'flow', 'fn', 'warn']) expect(contrast(token('candy-ink'), token(tone)), tone).toBeGreaterThanOrEqual(4.5);
  });

  it('only recolours the building, never LoopBot, so Plus looks stay unique', () => {
    const tileKeys = Object.keys(FLAVOURS[0]);
    for (const k of ['bot', 'botL', 'botR', 'eye', 'visor']) expect(tileKeys).not.toContain(k);
    expect(CANDY_CONFETTI.length).toBeGreaterThan(5);
  });

  it('swaps every surface colour token, so no plain navy panel shows through', () => {
    const base = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
    const root = base.slice(0, base.indexOf('}'));
    // Every see-through surface outside :root goes through a token, not the raw navy.
    expect(base.slice(root.length)).not.toMatch(/rgba\(35, 38, 58|rgba\(27, 29, 42|#121320/);
    for (const name of ['bg', 'panel', 'panel-2', 'line', 'glass', 'glass-strong', 'glass-soft', 'bg-glass', 'ground']) {
      expect(root, `--${name} in styles.css :root`).toContain(`--${name}:`);
      expect(css, `--${name} in colourful.css`).toContain(`--${name}:`);
    }
  });

  it('leaves paid looks alone: pack buy buttons and Overflow keep their own colours', () => {
    expect(css).toMatch(/:root\.colourful \.pack-sheet \.pill\.plus-buy \{[^}]*var\(--pack-buy/);
    expect(css).toContain(':root.colourful .ovf-hub {');
    for (const pack of ['heatwave', 'twist', 'dockyard', 'twinspires', 'fractal', 'precinct']) {
      const packCss = readFileSync(new URL(`./${pack}.css`, import.meta.url), 'utf8');
      expect(packCss, pack).toContain('--pack-buy:');
      expect(packCss, pack).not.toMatch(/\.pill\.plus-buy \{/);
    }
  });
});
