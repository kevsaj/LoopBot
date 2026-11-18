import { describe, expect, it, afterEach } from 'vitest';
import { createWorld, applyAction } from '../sim/world';
import { LEVELS } from '../levels';
import { FROSTLINE } from '../levels/frostline';
import { HEATWAVE } from '../levels/heatwave';
import { TWIST } from '../levels/twist';
import { DOCKYARD } from '../levels/dockyard';
import { TWINSPIRES } from '../levels/twinspires';
import { FRACTAL } from '../levels/fractal';
import { describeBoard, describeBrief, relative } from './describe';
import { setLangForTest } from '../i18n';

afterEach(() => setLangForTest('en'));
const floor = (id: string) => [...LEVELS, ...TWINSPIRES].find((l) => l.id === id)!;

describe('board description', () => {
  it('says Floor 1 from LoopBot\'s point of view', () => {
    const w = createWorld(floor('t1-f01'));
    expect(describeBrief(w)).toBe('LoopBot faces east. Ahead: 2 floor tiles, then the exit.');
    const all = describeBoard(w);
    expect(all).toContain('Left: a wall. Right: a wall. Behind: a wall.');
    expect(all).toContain('Goal: reach the exit, 3 ahead.');
  });

  it('follows LoopBot as it moves and turns', () => {
    const w = createWorld(floor('t1-f01'));
    applyAction(w, 'forward');
    applyAction(w, 'turn_left');
    expect(describeBrief(w)).toBe('LoopBot faces north. Ahead: a wall.');
    expect(describeBoard(w)).toContain('Goal: reach the exit, 2 to the right.');
  });

  it('puts places in program terms', () => {
    const bot = { x: 2, y: 2, facing: 'south' as const, carrying: false };
    expect(relative(bot, { x: 2, y: 5 })).toBe('3 ahead');
    expect(relative(bot, { x: 0, y: 1 })).toBe('1 behind and 2 to the right');
    expect(relative(bot, { x: 3, y: 2 })).toBe('1 to the left');
    expect(relative(bot, { x: 2, y: 2 })).toBe('right here');
  });

  it('names Echo on a Twin Spires floor', () => {
    const w = createWorld(TWINSPIRES[0]);
    const all = describeBoard(w);
    expect(all).toContain('Echo is');
    expect(all).toContain('From Echo: Ahead:');
  });

  it('describes every floor in every tower without a gap, in English and French', () => {
    for (const lang of ['en', 'fr'] as const) {
      setLangForTest(lang);
      for (const level of [...LEVELS, ...FROSTLINE, ...HEATWAVE, ...TWIST, ...DOCKYARD, ...TWINSPIRES, ...FRACTAL]) {
        const text = describeBoard(createWorld(level));
        expect(text, level.id).not.toMatch(/\{|\}|undefined|NaN/);
        expect(text.length, level.id).toBeGreaterThan(40);
      }
    }
  });

  it('speaks French', () => {
    setLangForTest('fr');
    const w = createWorld(floor('t1-f01'));
    expect(describeBrief(w)).toBe("LoopBot regarde vers l'est. Devant\u00a0: 2 cases de sol, puis la sortie.");
  });
});
