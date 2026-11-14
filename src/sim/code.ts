// Rooftop pro mode (ED-11): typed code in exactly the syntax the code view shows, turned back
// into the same blocks. Errors name the line, so the terminal can say what to fix.
//
//   def main():
//       repeat 3:
//           forward()
//       while not wall_ahead():
//           F1()
//   def F1():
//       if tile_is("r"):
//           turn_left()
//       else:
//           pass

import { ACTIONS, FUNCTION_NAMES, SENSORS } from './types';
import type { Action, Block, Colour, Condition, FunctionName, LevelFile, Program, Routine, Sensor } from './types';
import { countBlocks, emptyProgram, loopHeight, MAX_DEPTH, MAX_TIMES, MIN_TIMES, newId } from './program';
import { t } from '../i18n';

export type ParseResult = { ok: true; program: Program } | { ok: false; line: number; error: string };

class CodeError extends Error {
  constructor(
    public line: number,
    message: string,
  ) {
    super(message);
  }
}

interface Line {
  no: number;
  indent: number;
  text: string;
}

const COLOURS: Record<string, Colour> = { r: 'r', g: 'g', b: 'b', y: 'y', red: 'r', green: 'g', blue: 'b', yellow: 'y' };

/** Reads typed code. With a level, it also checks the floor's commands, sensors and slots. */
export function parseCode(text: string, level?: LevelFile): ParseResult {
  try {
    return { ok: true, program: parse(text, level) };
  } catch (e) {
    if (e instanceof CodeError) return { ok: false, line: e.line, error: e.message };
    throw e;
  }
}

function parse(text: string, level?: LevelFile): Program {
  const lines: Line[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const noComment = raw.replace(/#.*$/, '');
    if (!noComment.trim()) return;
    const lead = noComment.match(/^\s*/)![0].replace(/\t/g, '    ');
    lines.push({ no: i + 1, indent: lead.length, text: noComment.trim() });
  });

  const allowed = new Set<string>(level ? level.commands : [...ACTIONS, 'repeat', 'if', 'while', ...FUNCTION_NAMES]);
  const sensors = new Set<string>(level ? ['wall_ahead', ...(level.sensors ?? [])] : SENSORS);
  const slots = (r: Routine) => (level ? (level.slots[r] ?? 0) : Infinity);
  let i = 0;

  const condition = (src: string, no: number): Condition => {
    const m = src.match(/^(not\s+)?([a-z_]+)\s*(?:\(\s*(?:["']?([a-z]+)["']?)?\s*\))?$/);
    if (!m) throw new CodeError(no, t('can\'t read the condition "{code}"', { code: src }));
    const [, not, sensor, arg] = m;
    if (!(SENSORS as readonly string[]).includes(sensor)) throw new CodeError(no, t('"{name}" isn\'t a sensor', { name: sensor }));
    if (!sensors.has(sensor)) throw new CodeError(no, t('the {name} sensor isn\'t on this floor', { name: sensor }));
    const cond: Condition = { sensor: sensor as Sensor };
    if (sensor === 'tile_is') {
      const colour = arg ? COLOURS[arg] : undefined;
      if (!colour) throw new CodeError(no, t('tile_is needs a colour: tile_is("r")'));
      cond.colour = colour;
    } else if (arg) throw new CodeError(no, t('{name}() takes nothing in its brackets', { name: sensor }));
    if (not) cond.not = true;
    return cond;
  };

  const need = (cmd: string, no: number) => {
    if (!allowed.has(cmd)) throw new CodeError(no, t('{name} isn\'t unlocked on this floor', { name: cmd }));
  };

  /** The lines under a header: one level deeper than `indent`. */
  const body = (indent: number, header: Line): Block[] => {
    const next = lines[i];
    if (!next || next.indent <= indent) throw new CodeError(header.no, t('"{code}" needs an indented line under it (use pass for nothing)', { code: header.text }));
    return list(next.indent);
  };

  const list = (indent: number): Block[] => {
    const out: Block[] = [];
    while (i < lines.length && lines[i].indent >= indent) {
      const l = lines[i];
      if (l.indent > indent) throw new CodeError(l.no, t('unexpected indent'));
      if (/^def\b/.test(l.text)) {
        if (indent === 0) break;
        throw new CodeError(l.no, t('def goes at the left edge'));
      }
      i++;
      let m: RegExpMatchArray | null;
      if (l.text === 'pass') continue;
      if ((m = l.text.match(/^repeat\s*\(?\s*(\d+)\s*\)?\s*:$/))) {
        need('repeat', l.no);
        const times = Number(m[1]);
        if (times < MIN_TIMES || times > MAX_TIMES) throw new CodeError(l.no, t('repeat counts go from {min} to {max}', { min: MIN_TIMES, max: MAX_TIMES }));
        out.push({ id: newId(), kind: 'repeat', times, body: body(indent, l) });
      } else if ((m = l.text.match(/^while\s+(.+):$/))) {
        need('while', l.no);
        const cond = condition(m[1].trim(), l.no);
        out.push({ id: newId(), kind: 'while', cond, body: body(indent, l) });
      } else if ((m = l.text.match(/^if\s+(.+):$/))) {
        need('if', l.no);
        const cond = condition(m[1].trim(), l.no);
        const then = body(indent, l);
        let other: Block[] = [];
        const e = lines[i];
        if (e && e.indent === indent && /^else\s*:$/.test(e.text)) {
          i++;
          other = body(indent, e);
        }
        out.push({ id: newId(), kind: 'if', cond, then, else: other });
      } else if (/^else\b/.test(l.text)) {
        throw new CodeError(l.no, t('else needs an if just above it'));
      } else if ((m = l.text.match(/^([A-Za-z_]\w*)\s*(\(\s*\))?$/))) {
        const name = m[1];
        if ((ACTIONS as readonly string[]).includes(name)) {
          need(name, l.no);
          out.push({ id: newId(), kind: 'action', action: name as Action });
        } else if ((FUNCTION_NAMES as readonly string[]).includes(name)) {
          if (!allowed.has(name) || slots(name as Routine) === 0) throw new CodeError(l.no, t('{name} isn\'t unlocked on this floor', { name }));
          out.push({ id: newId(), kind: 'call', fn: name as FunctionName });
        } else throw new CodeError(l.no, t('"{name}" isn\'t a command', { name }));
      } else {
        throw new CodeError(l.no, t('can\'t read "{code}"', { code: l.text }));
      }
    }
    return out;
  };

  const p = emptyProgram();
  const seen = new Set<Routine>();
  // Code with no def at the top is all main.
  if (lines.length && !/^def\b/.test(lines[0].text)) {
    p.main = list(lines[0].indent);
    seen.add('main');
  }
  while (i < lines.length) {
    const l = lines[i++];
    const m = l.text.match(/^def\s+(\w+)\s*\(\s*\)\s*:$/);
    if (!m) throw new CodeError(l.no, t('can\'t read "{code}"', { code: l.text }));
    const name = m[1] as Routine;
    if (name !== 'main' && !(FUNCTION_NAMES as readonly string[]).includes(name)) throw new CodeError(l.no, t('routines are main, F1, F2 and F3, not {name}', { name }));
    if (slots(name) === 0) throw new CodeError(l.no, t('{name} isn\'t unlocked on this floor', { name }));
    if (seen.has(name)) throw new CodeError(l.no, t('{name} is defined twice', { name }));
    seen.add(name);
    p[name] = body(0, l);
  }

  // The same limits the block editor keeps.
  for (const r of ['main', ...FUNCTION_NAMES] as Routine[]) {
    const n = countBlocks(p[r]);
    if (n > slots(r)) throw new CodeError(lineOf(lines, r), t('{name} has {n} commands but only {slots} slots', { name: r, n, slots: slots(r) }));
    if (p[r].some((b) => loopHeight(b) > MAX_DEPTH)) throw new CodeError(lineOf(lines, r), t('blocks nest at most {n} deep', { n: MAX_DEPTH }));
  }
  return p;
}

function lineOf(lines: Line[], r: Routine): number {
  return lines.find((l) => l.text.startsWith(`def ${r}`))?.no ?? lines[0]?.no ?? 1;
}
