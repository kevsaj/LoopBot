import type { LevelFile } from '../sim/types';
import { LEVELS } from './index';
import { FROSTLINE } from './frostline';
import { DEMO } from '../demo';

export interface Tower {
  /** 1-based tower number, shown as "Tower 2". */
  n: number;
  name: string;
  city: string;
  levels: LevelFile[];
  /** Part of LoopBot Plus. */
  plus: boolean;
}

/** Every tower in play order. The web demo only has the Lobby of Tower 1. */
export const TOWERS: Tower[] = [
  { n: 1, name: 'Meridian Spire', city: 'Meridian', levels: LEVELS, plus: false },
  ...(DEMO ? [] : [{ n: 2, name: 'Northstar Needle', city: 'Frostline', levels: FROSTLINE, plus: true }]),
];

export function towerOf(n: number): Tower {
  return TOWERS.find((t) => t.n === n) ?? TOWERS[0];
}
