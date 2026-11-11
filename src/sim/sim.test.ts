import { describe, expect, it } from 'vitest';
import type { Block, LevelFile, Program } from './types';
import { Runner, STEP_LIMIT } from './interpreter';
import { countCommands, emptyProgram, makeBlock, parseReference, toCode } from './program';

function level(over: Partial<LevelFile>): LevelFile {
  return {
    id: 't0-f01',
    title: 'test',
    band: 'test',
    size: { w: 6, h: 3 },
    tiles: ['######', '#...e#', '######'],
    heights: null,
    boxes: [],
    targets: [],
    bot: { x: 1, y: 1, facing: 'east' },
    goals: ['bot_on_exit'],
    commands: ['forward', 'turn_left', 'turn_right', 'jump', 'pick_up', 'drop', 'activate'],
    slots: { main: 20 },
    par: { commands: 1, steps: 1 },
    reference: 'forward',
    hints: [],
    story: { intro: null, outro: null },
    ...over,
  };
}

const run = (l: LevelFile, ref: string) => new Runner(parseReference(ref), l).runToEnd();

describe('actions (CR table)', () => {
  it('forward moves one tile and crashes into walls', () => {
    expect(run(level({}), 'forward forward forward').status).toBe('cleared');
    const o = run(level({}), 'turn_left forward');
    expect(o).toMatchObject({ status: 'crashed', steps: 2 });
    expect(o.status === 'crashed' && o.error).toBe('ERR: blocked ahead at step 2');
  });

  it('forward will not walk into a gap', () => {
    const o = run(level({ tiles: ['######', '#._.e#', '######'] }), 'forward');
    expect(o.status).toBe('crashed');
  });

  it('jump goes exactly 1 up, any amount down, never level', () => {
    const l = level({ heights: ['000000', '001300', '000000'] });
    expect(run(l, 'jump').status).toBe('ended'); // up 1 onto (2,1)
    const r = new Runner(parseReference('jump jump'), l).runToEnd();
    expect(r.status === 'crashed' && r.error).toBe('ERR: too high to jump at step 2'); // 1 -> 3
    const down = level({ heights: ['000000', '030000', '000000'] });
    expect(run(down, 'jump forward forward').status).toBe('cleared');
    expect(run(level({}), 'jump').status).toBe('crashed');
  });

  it('pick_up and drop move boxes from and to the tile ahead', () => {
    const l = level({
      tiles: ['######', '#....#', '######'],
      boxes: [{ x: 2, y: 1, count: 1 }],
      targets: [{ x: 4, y: 1, count: 1 }],
      goals: ['all_targets_filled'],
    });
    expect(run(l, 'pick_up forward forward drop')).toEqual({ status: 'cleared', steps: 4 });
    expect(run(l, 'drop').status).toBe('crashed');
    expect(run(l, 'forward').status).toBe('crashed'); // box makes the tile 1 higher
    expect(run(l, 'jump drop').status).toBe('crashed'); // standing on the box, nothing carried
    expect(run(l, 'pick_up pick_up').status).toBe('crashed');
  });

  it('boxes stack to 3 and add to height', () => {
    const l = level({
      tiles: ['######', '#....#', '######'],
      boxes: [
        { x: 2, y: 1, count: 3 },
        { x: 3, y: 1, count: 1 },
      ],
      goals: ['all_switches_on'],
    });
    // A stack of 3 is too high to jump onto from the ground
    expect(run(l, 'jump').status).toBe('crashed');
  });

  it('activate toggles switches and their doors', () => {
    const l = level({ tiles: ['######', '#s.de#', '######'] });
    expect(run(l, 'forward forward').status).toBe('crashed'); // door closed
    expect(run(l, 'activate forward forward forward').status).toBe('cleared');
    expect(run(l, 'activate activate forward forward').status).toBe('crashed');
    expect(run(l, 'forward activate').status).toBe('crashed');
  });
});

describe('control flow and limits', () => {
  const l = level({ tiles: ['########', '#.....e#', '########'], size: { w: 8, h: 3 } });

  it('repeat, nested repeat and function calls', () => {
    const p: Program = emptyProgram();
    const rep: Block = { id: 'r', kind: 'repeat', times: 5, body: [makeBlock('forward')] };
    p.main = [rep];
    expect(new Runner(p, l).runToEnd()).toEqual({ status: 'cleared', steps: 5 });

    const q = emptyProgram();
    q.F1 = [makeBlock('forward')];
    q.main = [{ id: 'r', kind: 'repeat', times: 5, body: [makeBlock('F1')] }];
    expect(new Runner(q, l).runToEnd()).toEqual({ status: 'cleared', steps: 5 });
    expect(countCommands(q)).toBe(3); // CR-7: repeat + call + forward
  });

  it('while and if use sensors without spending steps', () => {
    const p = emptyProgram();
    p.main = [{ id: 'w', kind: 'while', cond: { sensor: 'wall_ahead', not: true }, body: [makeBlock('forward')] }];
    expect(new Runner(p, l).runToEnd()).toEqual({ status: 'cleared', steps: 5 });
  });

  it('stops endless loops at the step limit', () => {
    const p = emptyProgram();
    p.main = [{ id: 'w', kind: 'while', cond: { sensor: 'carrying', not: true }, body: [makeBlock('turn_left')] }];
    const o = new Runner(p, l).runToEnd();
    expect(o).toMatchObject({ status: 'crashed', steps: STEP_LIMIT });
  });

  it('stops loops that never act', () => {
    const p = emptyProgram();
    p.main = [{ id: 'w', kind: 'while', cond: { sensor: 'carrying', not: true }, body: [] }];
    expect(new Runner(p, l).runToEnd().status).toBe('crashed');
  });

  it('caps call depth at 32', () => {
    const p = emptyProgram();
    p.F1 = [makeBlock('F1')];
    p.main = [makeBlock('F1')];
    const o = new Runner(p, l).runToEnd();
    expect(o.status === 'crashed' && o.error).toBe('ERR: too many nested calls');
  });

  it('clears mid-program (CR-10) and reports ended when goals are unmet', () => {
    expect(run(l, 'forward forward forward forward forward turn_left forward')).toEqual({ status: 'cleared', steps: 5 });
    expect(run(l, 'forward')).toEqual({ status: 'ended', steps: 1 });
  });

  it('is deterministic and never edits the program (ED-15)', () => {
    const p = parseReference('forward forward turn_left forward');
    const before = JSON.stringify(p);
    const a = new Runner(p, l).runToEnd();
    const b = new Runner(p, l).runToEnd();
    expect(a).toEqual(b);
    expect(JSON.stringify(p)).toBe(before);
  });

  it('reports the call stack for highlighting inside functions (ED-13)', () => {
    const p = emptyProgram();
    const call = makeBlock('F1');
    const fwd = makeBlock('forward');
    p.F1 = [fwd];
    p.main = [call];
    const r = new Runner(p, l);
    const ev = r.step()!;
    expect(ev).toMatchObject({ blockId: fwd.id, callStack: [call.id], routine: 'F1' });
  });
});

describe('code view', () => {
  it('prints Python-like text', () => {
    const p = emptyProgram();
    p.main = [{ id: 'r', kind: 'repeat', times: 3, body: [makeBlock('F1')] }, makeBlock('turn_left')];
    p.F1 = [
      { id: 'i', kind: 'if', cond: { sensor: 'box_ahead' }, then: [makeBlock('pick_up')], else: [makeBlock('forward')] },
    ];
    expect(toCode(p).map((l) => l.text)).toEqual([
      'def main():',
      '    repeat 3:',
      '        F1()',
      '    turn_left()',
      '',
      'def F1():',
      '    if box_ahead():',
      '        pick_up()',
      '    else:',
      '        forward()',
    ]);
  });
});

describe('ice (Frostline)', () => {
  const ice = (tiles: string[], over: Partial<LevelFile> = {}) => level({ size: { w: tiles[0].length, h: tiles.length }, tiles, ...over });

  it('slides across ice and stops on the first plain tile, in one step', () => {
    const o = run(ice(['########', '#.iii.e#', '########']), 'forward forward');
    expect(o).toMatchObject({ status: 'cleared', steps: 2 });
  });

  it('stops on the ice against a wall', () => {
    const o = new Runner(parseReference('forward'), ice(['######', '#.ii##', '#...e#', '######'])).runToEnd();
    expect(o.status).toBe('ended');
    const r = new Runner(parseReference('forward turn_right forward forward'), ice(['######', '#.ii##', '####e#', '######'])).runToEnd();
    expect(r.status).toBe('crashed');
  });

  it('never slides off the board into a gap', () => {
    const o = run(ice(['#######', '#.ii_e#', '#######']), 'forward');
    expect(o.status).toBe('ended');
  });

  it('can slide straight onto the exit', () => {
    expect(run(ice(['#######', '#.iiie#', '#######']), 'forward')).toMatchObject({ status: 'cleared', steps: 1 });
  });

  it('a crate on the ice stops the slide', () => {
    const o = run(ice(['########', '#.iii.e#', '########'], { boxes: [{ x: 4, y: 1, count: 1 }] }), 'forward pick_up forward forward forward');
    expect(o.status).toBe('cleared');
  });
});

describe('thin ice (Frostline)', () => {
  const thin = (tiles: string[], over: Partial<LevelFile> = {}) => level({ size: { w: tiles[0].length, h: tiles.length }, tiles, ...over });

  it('holds LoopBot once and cracks into a gap behind it', () => {
    expect(run(thin(['######', '#.t.e#', '######']), 'forward forward forward').status).toBe('cleared');
    // back across the same tile: it has cracked
    const o = run(thin(['######', '#.t.e#', '######']), 'forward forward turn_left turn_left forward');
    expect(o.status === 'crashed' && o.error).toBe('ERR: blocked ahead at step 5');
  });

  it('does not crack while LoopBot only turns on it', () => {
    expect(run(thin(['######', '#.t#.#', '##.e##', '######']), 'forward turn_right forward turn_left forward').status).toBe('cleared');
  });

  it('cracks when LoopBot jumps off it, and a slide stops on it', () => {
    const o = run(thin(['#######', '#.iite#', '#######']), 'forward forward');
    expect(o).toMatchObject({ status: 'cleared', steps: 2 });
    const w = run(thin(['######', '#tt.e#', '######'], { bot: { x: 1, y: 1, facing: 'east' } }), 'forward turn_left turn_left forward');
    expect(w.status).toBe('crashed');
  });
});
