import type { LevelFile } from '../sim/types';
import f01 from './t1-f01.json';
import f02 from './t1-f02.json';
import f03 from './t1-f03.json';

/** Floors in play order. Adding a floor is a JSON file plus one line here. */
export const LEVELS = [f01, f02, f03] as unknown as LevelFile[];
