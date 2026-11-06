// LV-1: a floor file matches the format, and its reference only uses allowed commands.

import type { LevelFile } from '../sim/types';
import { SENSORS } from '../sim/types';

const TILE_CHARS = new Set(['.', '#', '_', 's', 'd', 'e', 'r', 'g', 'b', 'y']);
const FACINGS = ['north', 'east', 'south', 'west'];
const GOALS = ['all_targets_filled', 'bot_on_exit', 'all_switches_on'];

export function validateLevel(l: LevelFile): string[] {
  const errs: string[] = [];
  const e = (m: string) => errs.push(`${l.id ?? '?'}: ${m}`);
  if (!/^t\d+-f\d{2}$/.test(l.id)) e('id should look like t1-f03');
  const { w, h } = l.size ?? { w: 0, h: 0 };
  if (w < 1 || h < 1 || w > 8 || h > 8) e('size must be 1 to 8 in each direction (GD-1)');
  if (l.tiles.length !== h) e(`tiles has ${l.tiles.length} rows, size.h is ${h}`);
  l.tiles.forEach((row, y) => {
    if (row.length !== w) e(`tiles row ${y} has ${row.length} columns, size.w is ${w}`);
    for (const ch of row) if (!TILE_CHARS.has(ch)) e(`unknown tile '${ch}' in row ${y}`);
  });
  if (l.heights) {
    if (l.heights.length !== h) e('heights must have the same shape as tiles');
    l.heights.forEach((row, y) => {
      if (row.length !== w || !/^[0-3]*$/.test(row)) e(`heights row ${y} must be ${w} digits 0 to 3`);
    });
  }
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const walkable = (x: number, y: number) => inside(x, y) && !'#_'.includes(l.tiles[y][x]);
  if (!FACINGS.includes(l.bot.facing)) e('bot.facing must be north, east, south or west');
  if (!walkable(l.bot.x, l.bot.y)) e('bot must start on a walkable tile');
  for (const b of l.boxes) {
    if (!walkable(b.x, b.y)) e(`box at ${b.x},${b.y} is not on a walkable tile`);
    if (b.count < 1 || b.count > 3) e(`box stack at ${b.x},${b.y} must be 1 to 3`);
  }
  for (const t of l.targets) if (!walkable(t.x, t.y)) e(`target at ${t.x},${t.y} is not on a walkable tile`);
  if (!l.goals.length) e('at least one goal is needed');
  for (const g of l.goals) if (!GOALS.includes(g)) e(`unknown goal ${g}`);
  if (l.goals.includes('all_targets_filled') && !l.targets.length) e('all_targets_filled needs targets');
  if (l.goals.includes('bot_on_exit') && !l.tiles.some((r) => r.includes('e'))) e('bot_on_exit needs an exit tile');
  if (!l.slots.main || l.slots.main < 1) e('slots.main is required');
  const words = l.reference.replace(/[{}]/g, ' ').trim().split(/\s+/);
  const sensors = new Set<string>(['wall_ahead', ...(l.sensors ?? [])]);
  for (const s of l.sensors ?? []) if (!(SENSORS as readonly string[]).includes(s)) e(`unknown sensor ${s}`);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (/^\d+$/.test(word) || word === 'def' || word === 'not' || word === 'else') continue; // a count, a function body, or part of a condition
    if (word === 'if' || word === 'while') {
      if (!l.commands.includes(word)) e(`reference uses '${word}', which this floor does not allow`);
      const sensor = words[i + 1] === 'not' ? words[(i += 2)] : words[(i += 1)];
      if (!sensors.has(sensor)) e(`reference asks '${sensor}', which this floor's sensors do not include`);
      if (sensor === 'tile_is') i++; // the colour
      continue;
    }
    if (!l.commands.includes(word as never)) e(`reference uses '${word}', which this floor does not allow`);
  }
  for (const link of l.links ?? []) {
    if (l.tiles[link.switch.y]?.[link.switch.x] !== 's') e(`link switch ${link.switch.x},${link.switch.y} is not a switch tile`);
    for (const d of link.doors) if (l.tiles[d.y]?.[d.x] !== 'd') e(`link door ${d.x},${d.y} is not a door tile`);
  }
  if (l.hints.length && l.hints.length !== 3) e('hints should be Nudge, Structure, Solution (3 entries)');
  if (l.par.commands < 1 || l.par.steps < 1) e('par values must be positive');
  return errs;
}
