import { describe, expect, it } from 'vitest';
import type { LevelFile } from './types';
import { Runner } from './interpreter';
import { parseReference, toCode } from './program';
import { parseCode } from './code';
import { shortestTwinSteps } from './solver';

/**
 * A Precinct 404 floor for the tests (CR-PARTNER): LoopBot on the top row, DASH on the bottom row,
 * each with an exit at the east end. A crate sits between them for handoffs.
 */
function floor(over: Partial<LevelFile> = {}): LevelFile {
  return {
    id: 't8-f99',
    title: 'Test',
    band: 'frontdesk',
    size: { w: 5, h: 3 },
    tiles: ['....e', '#.###', '....e'],
    heights: null,
    boxes: [],
    targets: [],
    bot: { x: 0, y: 0, facing: 'east' },
    partner: { x: 0, y: 2, facing: 'east' },
    goals: ['bot_on_exit'],
    commands: ['forward', 'turn_left', 'turn_right', 'wait', 'radio', 'listen', 'pick_up', 'drop'],
    slots: { main: 8, F3: 8 },
    par: { commands: 2, steps: 4 },
    reference: '',
    hints: [],
    story: { intro: null, outro: null },
    ...over,
  };
}

const run = (ref: string, level = floor()) => new Runner(parseReference(ref), level).runToEnd();

describe('Precinct 404 partner mode (CR-PARTNER)', () => {
  it('runs each bot on its own program, both in the same steps', () => {
    const out = run('repeat 4 { forward } def DASH { repeat 4 { forward } }');
    expect(out).toEqual({ status: 'cleared', steps: 4 });
  });

  it('needs both bots parked for bot_on_exit', () => {
    expect(run('repeat 4 { forward }').status).toBe('ended');
  });

  it('lets a partner error say who it was', () => {
    const out = run('repeat 4 { forward } def DASH { turn_left forward }');
    expect(out.status).toBe('crashed');
    if (out.status === 'crashed') expect(out.error).toBe('DASH: ERR: blocked ahead at step 2');
  });

  it('treats the other bot as a wall', () => {
    // DASH walks up into the gap at x=1 and LoopBot comes down into the same tile first
    const out = run('forward turn_right forward def DASH { forward turn_left forward }');
    expect(out.status).toBe('crashed');
    if (out.status === 'crashed') expect(out.error).toMatch(/^DASH: ERR: blocked ahead/);
  });
});

describe('Precinct 404 radio calls (CR-RADIO)', () => {
  it('holds a bot at wait for radio until the call, with no lost step', () => {
    // DASH walks 2 and radios; LoopBot waits, then walks 4. LoopBot's first move is step 3.
    const program = parseReference('listen repeat 4 { forward } def DASH { forward forward radio forward forward }');
    const r = new Runner(program, floor());
    const evs = [];
    while (!r.done) {
      const ev = r.step();
      if (ev) evs.push(ev);
    }
    expect(r.outcome).toEqual({ status: 'cleared', steps: 6 });
    expect(evs[0].listening).toBe(true);
    expect(evs[1].listening).toBe(true);
    expect(evs[2].action).toBe('forward');
    expect(evs[2].instant).toEqual(['listen']);
    expect(evs[1].twin?.instant).toEqual(['radio']);
  });

  it('a call sent by LoopBot reaches the partner in the same step', () => {
    const out = run('forward radio forward forward forward def DASH { listen forward forward forward forward }');
    expect(out).toEqual({ status: 'cleared', steps: 4 });
  });

  it('a call that came in earlier is used up at once', () => {
    const out = run('radio repeat 4 { forward } def DASH { wait wait listen repeat 4 { forward } }');
    expect(out).toEqual({ status: 'cleared', steps: 6 });
  });

  it('stops when both bots wait for each other', () => {
    const out = run('listen forward def DASH { listen forward }');
    expect(out.status).toBe('crashed');
    if (out.status === 'crashed') expect(out.error).toBe('ERR: waiting for a radio call that never comes');
  });

  it('stops when the other bot has finished without calling', () => {
    const out = run('listen forward def DASH { forward }');
    expect(out.status).toBe('crashed');
  });

  it('hands a crate from one bot to the other', () => {
    // A crate at (0,1): LoopBot lifts it and sets it down at (1,1); DASH lifts it from below and
    // carries it to the target at (3,2).
    const level = floor({ tiles: ['.....', '..###', '.....'], goals: ['all_targets_filled'], boxes: [{ x: 0, y: 1, count: 1 }], targets: [{ x: 3, y: 2, count: 1 }] });
    const out = run('turn_right pick_up turn_left forward turn_right drop radio def DASH { forward listen turn_left pick_up turn_right forward drop }', level);
    expect(out).toEqual({ status: 'cleared', steps: 10 });
  });

  it('shows the partner program under its own name, with radio code', () => {
    const level = floor();
    const code = toCode(parseReference('radio forward def DASH { listen forward }'), ['main', 'F1', 'F3'], false, 'DASH').map((l) => l.text);
    expect(code).toEqual(['def main():', '    radio()', '    forward()', '', 'def dash():', '    wait_for_radio()', '    forward()']);
    const typed = parseCode(code.join('\n'), level);
    expect(typed.ok).toBe(true);
    if (typed.ok) expect(run('radio forward def DASH { listen forward }').status).toBe(new Runner(typed.program, level).runToEnd().status);
  });

  it('gives a fair step par: no pair of moves beats the reference', () => {
    const level = floor({ commands: ['forward', 'wait', 'radio', 'listen'] });
    expect(shortestTwinSteps(level)).toBe(4);
  });
});
