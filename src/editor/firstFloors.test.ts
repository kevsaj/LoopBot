import { describe, expect, it } from 'vitest';
import { LEVELS } from '../levels';
import { parseReference } from '../sim/program';
import { introPalette, isIntroFloor, newCommands, pathPreview } from './firstFloors';
import { PALETTE_ORDER } from './commands';
import type { LevelFile } from '../sim/types';

const level = (id: string) => LEVELS.find((l) => l.id === id) as LevelFile;
const commandsOf = (id: string) => LEVELS.find((l) => l.id === id)?.commands;
const prog = (_id: string, ref: string) => parseReference(ref);

describe('first floors', () => {
  it('covers Floors 1 to 5 of Tower 1 only', () => {
    expect(isIntroFloor('t1-f01')).toBe(true);
    expect(isIntroFloor('t1-f05')).toBe(true);
    expect(isIntroFloor('t1-f06')).toBe(false);
  });

  it('shows only the commands an intro floor has, and every command elsewhere', () => {
    expect(introPalette(level('t1-f01'), PALETTE_ORDER)).toEqual(['forward']);
    expect(introPalette(level('t1-f02'), PALETTE_ORDER)).toEqual(['forward', 'turn_left', 'turn_right']);
    expect(introPalette(level('t1-f06'), PALETTE_ORDER)).toEqual(PALETTE_ORDER);
  });

  it('marks the commands each intro floor brings in as new', () => {
    expect([...newCommands('t1-f01', commandsOf)]).toEqual([]);
    expect([...newCommands('t1-f02', commandsOf)].sort()).toEqual(['turn_left', 'turn_right']);
    expect([...newCommands('t1-f03', commandsOf)].sort()).toEqual(['drop', 'pick_up']);
    expect([...newCommands('t1-f04', commandsOf)]).toEqual(['jump']);
    expect([...newCommands('t1-f06', commandsOf)]).toEqual([]);
  });

  it('previews the path the program will take, matching a real run', () => {
    const p = pathPreview(level('t1-f01'), prog('t1-f01', 'forward forward forward'));
    expect(p?.tiles.map((t) => t.x)).toEqual([1, 2, 3, 4]);
    expect(p?.clears).toBe(true);
    expect(p?.crashAt).toBeNull();
  });

  it('marks where a turn-less program bumps into the wall on Floor 2', () => {
    const p = pathPreview(level('t1-f02'), prog('t1-f02', 'forward forward forward'));
    expect(p?.clears).toBe(false);
    expect(p?.crashAt).toEqual({ x: 3, y: 1, facing: 'east' });
  });

  it('shows nothing for an empty program or after Floor 3', () => {
    expect(pathPreview(level('t1-f01'), { main: [] } as never)).toBeNull();
    expect(pathPreview(level('t1-f04'), prog('t1-f04', 'forward'))).toBeNull();
  });
});
