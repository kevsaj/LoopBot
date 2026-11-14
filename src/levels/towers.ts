import type { LevelFile } from '../sim/types';
import { LEVELS } from './index';
import { FROSTLINE } from './frostline';
import { HEATWAVE } from './heatwave';
import { DEMO } from '../demo';
import { msg } from '../i18n';

export interface Tower {
  /** 1-based tower number, shown as "Tower 2". */
  n: number;
  name: string;
  city: string;
  levels: LevelFile[];
  /** Part of LoopBot Plus. */
  plus: boolean;
  /**
   * Not on sale yet: only dev builds and preview builds (VITE_PLUS_PREVIEW=1, the CI debug APK)
   * have it, so release builds never show it. It becomes its own city pack later.
   */
  preview?: boolean;
}

/**
 * Same switch as PLUS_PREVIEW in store/purchases.ts, read here so the level list stays free of the
 * store. Written out in full so Vite replaces it at build time and release builds leave the floors out.
 */
const PREVIEW = import.meta.env.DEV || import.meta.env.VITE_PLUS_PREVIEW === '1';

/** Every tower in play order. The web demo only has the Lobby of Tower 1. */
export const TOWERS: Tower[] = [
  { n: 1, name: msg('Meridian Spire'), city: 'Meridian', levels: LEVELS, plus: false },
  ...(DEMO ? [] : [{ n: 2, name: msg('Northstar Needle'), city: 'Frostline', levels: FROSTLINE, plus: true }]),
  ...(DEMO || !PREVIEW ? [] : [{ n: 3, name: msg('The Sandglass'), city: 'Heatwave', levels: HEATWAVE, plus: false, preview: true }]),
];

export function towerOf(n: number): Tower {
  return TOWERS.find((t) => t.n === n) ?? TOWERS[0];
}
