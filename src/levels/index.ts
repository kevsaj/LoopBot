import type { LevelFile } from '../sim/types';
import f01 from './t1-f01.json';
import f02 from './t1-f02.json';
import f03 from './t1-f03.json';
import f04 from './t1-f04.json';
import f05 from './t1-f05.json';
import f06 from './t1-f06.json';
import f07 from './t1-f07.json';
import f08 from './t1-f08.json';
import f09 from './t1-f09.json';
import f10 from './t1-f10.json';
import f11 from './t1-f11.json';

/** Floors in play order. Adding a floor is a JSON file plus one line here. */
export const LEVELS = [f01, f02, f03, f04, f05, f06, f07, f08, f09, f10, f11] as unknown as LevelFile[];
