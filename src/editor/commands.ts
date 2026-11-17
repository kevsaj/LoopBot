import { BY_TALLY } from '../sim/types';
import type { Block, PaletteCommand } from '../sim/types';
import { msg } from '../i18n';

/** How each command looks in the palette and the program: a glyph plus a word, so colour is never the only signal (ED-16). */
export const COMMAND_META: Record<PaletteCommand, { label: string; glyph: string; tone: string }> = {
  forward: { label: msg('forward'), glyph: '↑', tone: 'move' },
  turn_left: { label: msg('turn left'), glyph: '↺', tone: 'turn' },
  turn_right: { label: msg('turn right'), glyph: '↻', tone: 'turn' },
  jump: { label: msg('jump'), glyph: '⤴', tone: 'move' },
  pick_up: { label: msg('pick up'), glyph: '▲', tone: 'hand' },
  drop: { label: msg('drop'), glyph: '▼', tone: 'hand' },
  activate: { label: msg('activate'), glyph: '◉', tone: 'act' },
  wait: { label: msg('wait'), glyph: '‖', tone: 'turn' },
  tally_up: { label: msg('tally + 1'), glyph: '+', tone: 'count' },
  tally_down: { label: msg('tally − 1'), glyph: '−', tone: 'count' },
  repeat: { label: msg('repeat'), glyph: '⟳', tone: 'flow' },
  repeat_tally: { label: msg('repeat tally'), glyph: '⟳#', tone: 'flow' },
  if: { label: msg('if'), glyph: '?', tone: 'flow' },
  while: { label: msg('while'), glyph: '∞', tone: 'flow' },
  F1: { label: 'F1', glyph: 'ƒ', tone: 'fn' },
  F2: { label: 'F2', glyph: 'ƒ', tone: 'fn' },
  F3: { label: 'F3', glyph: 'ƒ', tone: 'fn' },
};

/** The Lobby palette, always shown so locked commands appear greyed out (ED-8). */
export const PALETTE_ORDER: PaletteCommand[] = ['forward', 'turn_left', 'turn_right', 'jump', 'pick_up', 'drop', 'activate'];

/**
 * Heatwave's wait and Dockyard's tally blocks join the palette only on floors that have them, so
 * other towers never see them locked.
 */
export const EXTRA_ORDER: PaletteCommand[] = ['wait', 'tally_up', 'tally_down'];

/** Control blocks join the palette on the floors that allow them (repeat from Floor 11, repeat tally in Dockyard). */
export const CONTROL_ORDER: PaletteCommand[] = ['repeat', 'repeat_tally', 'while', 'if'];

export function blockCommand(b: Block): PaletteCommand {
  switch (b.kind) {
    case 'action':
      return b.action;
    case 'call':
      return b.fn;
    case 'repeat':
      return b.times === BY_TALLY ? 'repeat_tally' : 'repeat';
    default:
      return b.kind;
  }
}
