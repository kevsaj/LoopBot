import type { LevelFile } from '../sim/types';
import { LEVELS } from './index';
import { FROSTLINE } from './frostline';
import { HEATWAVE } from './heatwave';
import { DEMO } from '../demo';
import { msg } from '../i18n';
import type { PackId } from '../store/packs';

export interface Tower {
  /** 1-based tower number, shown as "Tower 2". */
  n: number;
  name: string;
  city: string;
  levels: LevelFile[];
  /** Part of LoopBot Plus. */
  plus: boolean;
  /** Sold on its own as a city pack (store/packs.ts), not part of Plus. */
  pack?: PackId;
}

/**
 * Same switches as PLUS_PREVIEW and PLUS_VISIBLE in store/purchases.ts, read here so the level list
 * stays free of the store. Written out in full so Vite replaces them at build time: a release build
 * made without the "Plus store" box leaves the city pack floors out entirely.
 */
const PREVIEW = import.meta.env.DEV || import.meta.env.VITE_PLUS_PREVIEW === '1';
const STORE_ON = import.meta.env.VITE_PLUS === '1';

/** Every tower in play order. The web demo only has the Lobby of Tower 1. */
export const TOWERS: Tower[] = [
  { n: 1, name: msg('Meridian Spire'), city: 'Meridian', levels: LEVELS, plus: false },
  ...(DEMO ? [] : [{ n: 2, name: msg('Northstar Needle'), city: 'Frostline', levels: FROSTLINE, plus: true }]),
  ...(DEMO || !(PREVIEW || STORE_ON) ? [] : [{ n: 3, name: msg('The Sandglass'), city: 'Heatwave', levels: HEATWAVE, plus: false, pack: 'heatwave' as const }]),
];

export function towerOf(n: number): Tower {
  return TOWERS.find((t) => t.n === n) ?? TOWERS[0];
}
