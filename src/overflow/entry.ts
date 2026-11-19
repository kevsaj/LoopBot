// An Overflow floor as stored in the bank, and how it becomes a floor the game can play.
// Kept apart from the generator so the game never ships the solver code it doesn't need.
//
// Every bank floor can be turned a quarter turn at a time and mirrored, which keeps its pars
// exactly (a mirror only swaps left and right turns), so one bank floor plays as up to 8 boards.

import type { Facing, LevelFile, PaletteCommand, Pos } from '../sim/types';
import { msg, t, tn } from '../i18n';

/** Which tower each Overflow trick comes from. */
export type Kind = 'walk' | 'switch' | 'ice' | 'vent' | 'spin' | 'echo' | 'mosaic';
export const KINDS: readonly Kind[] = ['walk', 'switch', 'ice', 'vent', 'spin', 'echo', 'mosaic'];

/** Difficulty tiers, climbed in order (see TIER_FLOORS). */
export type Tier = 1 | 2 | 3 | 4;

/** A compact Overflow floor, as stored in the bank. `expandOverflow` turns it into a full floor. */
export interface OverflowEntry {
  tier: Tier;
  kind: Kind;
  tiles: string[];
  heights: string[] | null;
  bot: Pos & { facing: Facing };
  /** Echo floors (Twin Spires): the second bot, running the same program. */
  twin?: Pos & { facing: Facing };
  goal: 'exit' | 'switches' | 'lit';
  par: { commands: number; steps: number };
  main: number;
  reference: string;
}

/** The tower each trick was first met in, for the floor's intro line. */
export const KIND_TOWER: Record<Kind, number> = { walk: 1, switch: 1, ice: 2, vent: 3, spin: 4, echo: 6, mosaic: 7 };

/** PATCH's line as a floor opens: which tower lent this trick to the tower of Babel. */
export const KIND_INTRO: Record<Kind, string> = {
  walk: msg('Plain bricks and a long way up. Find the pattern and loop it.'),
  switch: msg('Switches from the Meridian Spire. Every one has to end up on.'),
  ice: msg('Frostline ice got in. Thin ice cracks once you step off it, and slick ice slides.'),
  vent: msg('Heatwave vents in the brickwork. Wait a step when the timing is wrong.'),
  spin: msg('Turntables from the Helix. They turn LoopBot as it steps on.'),
  echo: msg('Echo came over from the Skybridge. One program drives both bots.'),
  mosaic: msg('Fractal mosaics. Light every one of them to clear the floor.'),
};

const FACINGS: Facing[] = ['north', 'east', 'south', 'west'];
const MIRROR_FACING: Record<Facing, Facing> = { north: 'north', south: 'south', east: 'west', west: 'east' };
/** Spinners turn the other way in a mirror. */
const MIRROR_TILE: Record<string, string> = { c: 'a', a: 'c' };

/** Turns a bank floor `rot` quarter turns clockwise, mirrored left to right first when `mirror`. */
export function transformEntry(e: OverflowEntry, rot: number, mirror: boolean): OverflowEntry {
  let tiles = e.tiles.map((r) => [...r]);
  let heights = e.heights ? e.heights.map((r) => [...r]) : null;
  let bot = { ...e.bot };
  let twin = e.twin ? { ...e.twin } : undefined;
  let ref = e.reference;
  if (mirror) {
    const w = tiles[0].length;
    tiles = tiles.map((r) => r.reverse().map((c) => MIRROR_TILE[c] ?? c));
    heights = heights && heights.map((r) => r.reverse());
    const flip = (p: Pos & { facing: Facing }) => ({ x: w - 1 - p.x, y: p.y, facing: MIRROR_FACING[p.facing] });
    bot = flip(bot);
    twin = twin && flip(twin);
    ref = ref.replace(/turn_(left|right)/g, (_, s: string) => (s === 'left' ? 'turn_right' : 'turn_left'));
  }
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) {
    // a quarter turn clockwise: (x, y) on a w x h board goes to (h - 1 - y, x) on an h x w board
    const h = tiles.length;
    const w = tiles[0].length;
    const turn = <T,>(g: T[][]) => Array.from({ length: w }, (_, x) => Array.from({ length: h }, (_, y) => g[h - 1 - y][x]));
    tiles = turn(tiles);
    heights = heights && turn(heights);
    const spin = (p: Pos & { facing: Facing }) => ({ x: h - 1 - p.y, y: p.x, facing: FACINGS[(FACINGS.indexOf(p.facing) + 1) % 4] });
    bot = spin(bot);
    twin = twin && spin(twin);
  }
  return { ...e, tiles: tiles.map((r) => r.join('')), heights: heights && heights.map((r) => r.join('')), bot, ...(twin ? { twin } : {}), reference: ref };
}

/** The commands a floor needs: never a block the floor has no use for. */
export function commandsFor(e: OverflowEntry): PaletteCommand[] {
  const cmds: PaletteCommand[] = ['forward', 'turn_left', 'turn_right'];
  if (e.heights) cmds.push('jump');
  if (e.tiles.some((r) => r.includes('s'))) cmds.push('activate');
  if (e.tiles.some((r) => /[vwxz]/.test(r))) cmds.push('wait');
  cmds.push('repeat');
  return cmds;
}

/** Expands a bank floor into a floor the game can play. */
export function expandOverflow(e: OverflowEntry, id: string, title: string, band: string): LevelFile {
  const goalHint =
    e.goal === 'switches'
      ? t('Every switch has to end up on. Watch how the path between them repeats.')
      : e.goal === 'lit'
        ? t('Every mosaic has to light up. Trace a route that passes over all of them.')
        : e.twin
          ? t('Both bots have to reach an exit. Find one program that works for both.')
          : t('Trace the path to the exit with your finger. Where does it start repeating itself?');
  return {
    id,
    title,
    band,
    size: { w: e.tiles[0].length, h: e.tiles.length },
    tiles: e.tiles,
    heights: e.heights,
    boxes: [],
    targets: [],
    bot: e.bot,
    ...(e.twin ? { twin: e.twin } : {}),
    goals: [e.goal === 'exit' ? 'bot_on_exit' : e.goal === 'switches' ? 'all_switches_on' : 'all_lit'],
    commands: commandsFor(e),
    slots: { main: e.main },
    par: e.par,
    reference: e.reference,
    hints: [goalHint, tn(e.par.commands, 'Par is {n} command.', 'Par is {n} commands.'), e.reference],
    story: { intro: null, outro: null },
  };
}
