import type { LevelFile } from '../sim/types';
import { DEMO, DEMO_FLOORS } from '../demo';
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
import f12 from './t1-f12.json';
import f13 from './t1-f13.json';
import f14 from './t1-f14.json';
import f15 from './t1-f15.json';
import f16 from './t1-f16.json';
import f17 from './t1-f17.json';
import f18 from './t1-f18.json';
import f19 from './t1-f19.json';
import f20 from './t1-f20.json';
import f21 from './t1-f21.json';
import f22 from './t1-f22.json';
import f23 from './t1-f23.json';
import f24 from './t1-f24.json';
import f25 from './t1-f25.json';
import f26 from './t1-f26.json';
import f27 from './t1-f27.json';
import f28 from './t1-f28.json';
import f29 from './t1-f29.json';
import f30 from './t1-f30.json';

/** Floors in play order. Adding a floor is a JSON file plus one line here. */
const ALL = [f01, f02, f03, f04, f05, f06, f07, f08, f09, f10, f11, f12, f13, f14, f15, f16, f17, f18, f19, f20, f21, f22, f23, f24, f25, f26, f27, f28, f29, f30] as unknown as LevelFile[];

/** Floors in play: the whole tower, or just the Lobby in the web demo. */
export const LEVELS = DEMO ? ALL.slice(0, DEMO_FLOORS) : ALL;
