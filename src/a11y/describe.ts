// The board in words, for players who can't see it (read by TalkBack, VoiceOver or NVDA).
// Everything is said from LoopBot's point of view: ahead, behind, left and right, the same way a
// program sees the world, so "the exit is 3 ahead and 2 to the right" turns straight into commands.
//
//   describeBoard(w): the whole board, read when the player focuses or taps it.
//   describeBrief(w): where LoopBot is and what's ahead, said after a run stops.

import type { Bot, Facing, Pos, World } from '../sim/types';
import { surfaceHeight, ventBlasting } from '../sim/world';
import { msg, t, tn } from '../i18n';

const DELTA: Record<Facing, Pos> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};
const RIGHT: Record<Facing, Facing> = { north: 'east', east: 'south', south: 'west', west: 'north' };
const LEFT: Record<Facing, Facing> = { north: 'west', west: 'south', south: 'east', east: 'north' };
const BACK: Record<Facing, Facing> = { north: 'south', south: 'north', east: 'west', west: 'east' };

const FACES: Record<Facing, string> = { north: msg('{name} faces north'), east: msg('{name} faces east'), south: msg('{name} faces south'), west: msg('{name} faces west') };
const COLOUR_TILE: Record<string, string> = { r: msg('a red ● tile'), g: msg('a green ▲ tile'), b: msg('a blue ■ tile'), y: msg('a yellow ✚ tile') };

/** How many places a list of things names before it stops (the nearest come first). */
const MAX_LISTED = 4;

const keyOf = (p: Pos) => `${p.x},${p.y}`;
const inBounds = (w: World, p: Pos) => p.x >= 0 && p.y >= 0 && p.x < w.w && p.y < w.h;
const step = (p: Pos, f: Facing): Pos => ({ x: p.x + DELTA[f].x, y: p.y + DELTA[f].y });

/** Where p is from a bot, in its own terms: "3 ahead and 2 to the right", "right here". */
export function relative(bot: Bot, p: Pos): string {
  const dx = p.x - bot.x;
  const dy = p.y - bot.y;
  const f = DELTA[bot.facing];
  const r = DELTA[RIGHT[bot.facing]];
  const fwd = dx * f.x + dy * f.y;
  const side = dx * r.x + dy * r.y;
  const parts: string[] = [];
  if (fwd > 0) parts.push(t('{n} ahead', { n: fwd }));
  if (fwd < 0) parts.push(t('{n} behind', { n: -fwd }));
  if (side > 0) parts.push(t('{n} to the right', { n: side }));
  if (side < 0) parts.push(t('{n} to the left', { n: -side }));
  if (!parts.length) return t('right here');
  return parts.length === 1 ? parts[0] : t('{a} and {b}', { a: parts[0], b: parts[1] });
}

/** A step up or down from the height LoopBot stands at, or nothing on level ground. */
function heightNote(diff: number): string {
  if (diff === 0) return '';
  return diff > 0 ? tn(diff, '{n} step up', '{n} steps up') : tn(-diff, '{n} step down', '{n} steps down');
}

/** Is this an ordinary floor tile, nothing to say about it beyond "floor"? */
function plain(w: World, p: Pos): boolean {
  if (!inBounds(w, p)) return false;
  const tile = w.tiles[p.y][p.x];
  if (tile.type !== 'floor' || tile.colour) return false;
  if (w.boxes[p.y][p.x] > 0) return false;
  if (w.targets.some((g) => g.x === p.x && g.y === p.y)) return false;
  if (w.twin && w.twin.x === p.x && w.twin.y === p.y) return false;
  if (w.bot.x === p.x && w.bot.y === p.y) return false;
  return true;
}

/** One tile in words: "a wall", "the exit", "a switch, off", "floor, 1 step up, with 2 crates". */
export function tileWords(w: World, p: Pos, fromHeight: number, from: Bot = w.bot): string {
  if (!inBounds(w, p)) return t('the edge of the board');
  const k = keyOf(p);
  const tile = w.tiles[p.y][p.x];
  let base: string;
  switch (tile.type) {
    case 'wall':
      return t('a wall');
    case 'gap':
      return t('a gap');
    case 'door':
      if (!w.doors[k]) return t('a closed door');
      base = t('an open door');
      break;
    case 'thin':
      if (w.cracked[k]) return t('a gap where the ice cracked');
      base = t('thin ice that cracks once you step off');
      break;
    case 'exit':
      base = t('the exit');
      break;
    case 'switch':
      base = w.switches[k] ? t('a switch, on') : t('a switch, off');
      break;
    case 'ice':
      base = t('ice that slides you along');
      break;
    case 'vent':
      base = ventBlasting(w, p, w.clock + 1) && from === w.bot ? t('a heat vent, blasting next step') : t('a heat vent');
      break;
    case 'spinner':
      base = tile.spin === -1 ? t('a turntable that turns you left') : t('a turntable that turns you right');
      break;
    case 'mosaic':
      base = w.lit[k] ? t('a lit mosaic') : t('a dark mosaic');
      break;
    default:
      base = tile.colour ? t(COLOUR_TILE[tile.colour]) : t('floor');
  }
  const extra: string[] = [];
  if (w.bot !== from && w.bot.x === p.x && w.bot.y === p.y) extra.push(t('LoopBot is there'));
  if (w.twin && w.twin !== from && w.twin.x === p.x && w.twin.y === p.y) extra.push(t('Echo is there'));
  const target = w.targets.find((g) => g.x === p.x && g.y === p.y);
  if (target) extra.push(t('a crate target'));
  const crates = w.boxes[p.y][p.x];
  if (crates > 0) extra.push(tn(crates, 'with {n} crate', 'with {n} crates'));
  const h = heightNote(surfaceHeight(w, p) - fromHeight);
  if (h) extra.push(h);
  return [base, ...extra].join(', ');
}

/** "Ahead: 3 floor tiles, then the exit." Plain floor at the same height is counted, then the first thing that isn't. */
function aheadLine(w: World, bot: Bot): string {
  const start = surfaceHeight(w, bot);
  let p = step(bot, bot.facing);
  let run = 0;
  while (plain(w, p) && surfaceHeight(w, p) === start) {
    run += 1;
    p = step(p, bot.facing);
  }
  const what = tileWords(w, p, start, bot);
  if (!run) return t('Ahead: {what}.', { what });
  return t('Ahead: {floor}, then {what}.', { floor: tn(run, '{n} floor tile', '{n} floor tiles'), what });
}

function sidesLine(w: World, bot: Bot): string {
  const h = surfaceHeight(w, bot);
  return t('Left: {left}. Right: {right}. Behind: {behind}.', {
    left: tileWords(w, step(bot, LEFT[bot.facing]), h, bot),
    right: tileWords(w, step(bot, RIGHT[bot.facing]), h, bot),
    behind: tileWords(w, step(bot, BACK[bot.facing]), h, bot),
  });
}

/** "LoopBot faces east, carrying a crate, on a switch, off." */
function whoLine(w: World, bot: Bot, name: string): string {
  const parts = [t(FACES[bot.facing], { name })];
  if (bot.carrying) parts.push(t('carrying a crate'));
  // What it stands on, unless that's plain floor.
  const here = { x: bot.x, y: bot.y };
  const tile = w.tiles[bot.y][bot.x];
  if (tile.type !== 'floor' || tile.colour || w.targets.some((g) => g.x === bot.x && g.y === bot.y)) {
    parts.push(t('on {what}', { what: tileWords(w, here, surfaceHeight(w, here), bot) }));
  }
  return `${parts.join(', ')}.`;
}

/** The nearest few of a set of places, from LoopBot: "2 ahead; 3 to the left". */
function places(bot: Bot, ps: Pos[]): string {
  const near = [...ps].sort((a, b) => Math.abs(a.x - bot.x) + Math.abs(a.y - bot.y) - (Math.abs(b.x - bot.x) + Math.abs(b.y - bot.y)));
  const shown = near.slice(0, MAX_LISTED).map((p) => relative(bot, p));
  if (near.length > MAX_LISTED) shown.push(tn(near.length - MAX_LISTED, '{n} more', '{n} more'));
  return shown.join('; ');
}

function cells(w: World, test: (p: Pos) => boolean): Pos[] {
  const out: Pos[] = [];
  for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) if (test({ x, y })) out.push({ x, y });
  return out;
}

const parsed = (k: string): Pos => {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
};

/** What the floor asks for, and where those things are from LoopBot. */
function goalLines(w: World): string[] {
  const bot = w.bot;
  const out: string[] = [];
  for (const goal of w.goals) {
    if (goal === 'bot_on_exit') {
      const exits = cells(w, (p) => w.tiles[p.y][p.x].type === 'exit');
      out.push(
        w.twin
          ? t('Goal: park LoopBot and Echo on the exits. Exits: {where}.', { where: places(bot, exits) })
          : tn(exits.length, 'Goal: reach the exit, {where}.', 'Goal: reach an exit. Exits: {where}.', { where: places(bot, exits) }),
      );
    } else if (goal === 'all_targets_filled') {
      const open = w.targets.filter((g) => w.boxes[g.y][g.x] < g.count);
      const loose = cells(w, (p) => w.boxes[p.y][p.x] > 0 && !w.targets.some((g) => g.x === p.x && g.y === p.y));
      out.push(
        open.length
          ? tn(open.length, 'Goal: put crates on the targets. {n} target still empty: {where}.', 'Goal: put crates on the targets. {n} targets still empty: {where}.', { where: places(bot, open) })
          : t('Goal: put crates on the targets. Every target has its crate.'),
      );
      if (loose.length) out.push(tn(loose.length, 'Crate: {where}.', 'Crates: {where}.', { where: places(bot, loose) }));
    } else if (goal === 'all_switches_on') {
      const all = Object.keys(w.switches);
      const off = all.filter((k) => !w.switches[k]).map(parsed);
      out.push(
        t('Goal: turn every switch on. {on} of {n} on.', { on: all.length - off.length, n: all.length }) +
          (off.length ? ` ${t('Off: {where}.', { where: places(bot, off) })}` : ''),
      );
    } else if (goal === 'all_lit') {
      const all = Object.keys(w.lit);
      const dark = all.filter((k) => !w.lit[k]).map(parsed);
      out.push(
        t('Goal: light every mosaic by standing on it. {lit} of {n} lit.', { lit: all.length - dark.length, n: all.length }) +
          (dark.length ? ` ${t('Dark: {where}.', { where: places(bot, dark) })}` : ''),
      );
    }
  }
  // Things that are in the way, or that change the floor, wherever they are.
  if (!w.goals.includes('all_switches_on')) {
    const switches = Object.keys(w.switches).map(parsed);
    if (switches.length) out.push(tn(switches.length, 'Switch: {where}.', 'Switches: {where}.', { where: places(bot, switches) }));
  }
  const closed = Object.keys(w.doors)
    .filter((k) => !w.doors[k])
    .map(parsed);
  if (closed.length) out.push(tn(closed.length, 'Closed door: {where}.', 'Closed doors: {where}.', { where: places(bot, closed) }));
  if (w.ventCycle) out.push(tn(w.ventCycle, 'Heat vents blast every {n} step.', 'Heat vents blast every {n} steps.'));
  return out;
}

/** Where LoopBot is and what's right in front of it: said after a run stops. */
export function describeBrief(w: World): string {
  return [whoLine(w, w.bot, 'LoopBot'), aheadLine(w, w.bot)].join(' ');
}

/** The whole board, from LoopBot's point of view. */
export function describeBoard(w: World): string {
  const lines = [whoLine(w, w.bot, 'LoopBot'), aheadLine(w, w.bot), sidesLine(w, w.bot), ...goalLines(w)];
  if (w.twin) {
    lines.push(
      t('Echo is {where}.', { where: relative(w.bot, w.twin) }),
      whoLine(w, w.twin, t('Echo')),
      t('From Echo: {ahead}', { ahead: aheadLine(w, w.twin) }),
    );
  }
  if (w.tally > 0) lines.push(t('Tally: {n}', { n: w.tally }));
  return lines.join(' ');
}
