// Core types for the LoopBot simulation. Pure data, no rendering.
// See the requirements doc: Command rules (CR-n) and Level file format (LV-n).

export type Facing = 'north' | 'east' | 'south' | 'west';

/** Tile types from CR-1. Colour tiles are plain floor tiles with a colour. */
/** 'ice' (Frostline): step onto it and LoopBot slides on until something stops it. */
/** 'thin' (Frostline): thin ice holds LoopBot once, and cracks into a gap when LoopBot steps off. */
/** 'vent' (Heatwave): a heat vent that blasts on a timer; LoopBot can't be on it when it fires (CR-VENT). */
/** 'spinner' (Twist): a turntable that turns LoopBot a quarter turn as it arrives (CR-SPIN). */
export type TileType = 'floor' | 'wall' | 'gap' | 'switch' | 'door' | 'exit' | 'ice' | 'thin' | 'vent' | 'spinner';

export type Colour = 'r' | 'g' | 'b' | 'y';

export interface Tile {
  type: TileType;
  /** Base height, 0 to 3. */
  height: number;
  colour?: Colour;
  /** Vents only: the vent blasts on the steps where clock % cycle equals this. */
  phase?: number;
  /** Spinners only: 1 turns LoopBot clockwise (right), -1 anticlockwise (left). */
  spin?: 1 | -1;
}

/** 'wait' (Heatwave): LoopBot stays put for one step, to let a vent blast pass. */
export type Action = 'forward' | 'jump' | 'turn_left' | 'turn_right' | 'pick_up' | 'drop' | 'activate' | 'wait';

export const ACTIONS: readonly Action[] = [
  'forward',
  'turn_left',
  'turn_right',
  'jump',
  'pick_up',
  'drop',
  'activate',
  'wait',
];

export type FunctionName = 'F1' | 'F2' | 'F3';
export const FUNCTION_NAMES: readonly FunctionName[] = ['F1', 'F2', 'F3'];

/** heat_ahead (Heatwave): the tile ahead is a vent that will be blasting if LoopBot steps onto it now. */
/** facing_north (Twist): LoopBot faces north, the way the compass on the board points. */
export type Sensor = 'wall_ahead' | 'box_ahead' | 'carrying' | 'on_target' | 'on_switch' | 'tile_is' | 'heat_ahead' | 'facing_north';
export const SENSORS: readonly Sensor[] = ['wall_ahead', 'box_ahead', 'carrying', 'on_target', 'on_switch', 'tile_is', 'heat_ahead', 'facing_north'];

export interface Condition {
  sensor: Sensor;
  not?: boolean;
  /** Only for tile_is. */
  colour?: Colour;
}

/** A program is a tree of blocks (CR-4 to CR-7). Every block has a stable id for highlighting. */
export type Block =
  | { id: string; kind: 'action'; action: Action }
  | { id: string; kind: 'repeat'; times: number; body: Block[] }
  | { id: string; kind: 'call'; fn: FunctionName }
  | { id: string; kind: 'if'; cond: Condition; then: Block[]; else: Block[] }
  | { id: string; kind: 'while'; cond: Condition; body: Block[] };

export type Routine = 'main' | FunctionName;

export type Program = Record<Routine, Block[]>;

export type Goal = 'all_targets_filled' | 'bot_on_exit' | 'all_switches_on';

/** A command the palette can offer: an action, a control block, or a function call. */
export type PaletteCommand = Action | 'repeat' | 'if' | 'while' | FunctionName;

export interface Pos {
  x: number;
  y: number;
}

export interface LevelFile {
  id: string;
  title: string;
  band: string;
  size: { w: number; h: number };
  tiles: string[];
  heights: string[] | null;
  boxes: Array<Pos & { count: number }>;
  targets: Array<Pos & { count: number }>;
  bot: Pos & { facing: Facing };
  goals: Goal[];
  commands: PaletteCommand[];
  slots: Partial<Record<Routine, number>>;
  par: { commands: number; steps: number };
  reference: string;
  hints: string[];
  story: { intro: string | null; outro: string | null };
  /**
   * Optional switch-to-door links. Not in the doc's example yet; when absent,
   * every switch toggles every door on the floor.
   */
  links?: Array<{ switch: Pos; doors: Pos[] }>;
  /** Sensors the if and while blocks can ask about on this floor (CR-5); defaults to wall_ahead. */
  sensors?: Sensor[];
  /** Rooftop pro mode (ED-11): the code view can be edited as text on this floor. */
  typing?: boolean;
  /**
   * Bug hunt floors: the program the player starts with (reference format). It almost works;
   * finding and fixing what's wrong is the puzzle.
   */
  starter?: string;
  /**
   * Heatwave vents (CR-VENT): how many steps one vent cycle lasts, 2 to 4 (default 2). Vent tiles
   * are 'v', 'w', 'x' and 'z' for phases 0 to 3: a vent blasts after every step that leaves the
   * clock (steps taken so far) at its phase, counted modulo the cycle.
   */
  ventCycle?: number;
}

export interface World {
  w: number;
  h: number;
  tiles: Tile[][]; // [y][x]
  /** Box stack count per tile, [y][x]. */
  boxes: number[][];
  targets: Array<Pos & { count: number }>;
  /** Switch on/off, keyed "x,y". */
  switches: Record<string, boolean>;
  /** Door open/closed, keyed "x,y". */
  doors: Record<string, boolean>;
  links: Array<{ switch: Pos; doors: Pos[] }>;
  /** Thin ice that has cracked into a gap, keyed "x,y". */
  cracked: Record<string, boolean>;
  /** Steps taken so far (Heatwave vents run on it). */
  clock: number;
  /** Steps in one vent cycle; 0 on a floor with no vents. */
  ventCycle: number;
  bot: { x: number; y: number; facing: Facing; carrying: boolean };
  goals: Goal[];
}
