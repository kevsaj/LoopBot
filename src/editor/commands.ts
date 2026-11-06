import type { Block, PaletteCommand } from '../sim/types';

/** How each command looks in the palette and the program: a glyph plus a word, so colour is never the only signal (ED-16). */
export const COMMAND_META: Record<PaletteCommand, { label: string; glyph: string; tone: string }> = {
  forward: { label: 'forward', glyph: '↑', tone: 'move' },
  turn_left: { label: 'turn left', glyph: '↺', tone: 'turn' },
  turn_right: { label: 'turn right', glyph: '↻', tone: 'turn' },
  jump: { label: 'jump', glyph: '⤴', tone: 'move' },
  pick_up: { label: 'pick up', glyph: '▲', tone: 'hand' },
  drop: { label: 'drop', glyph: '▼', tone: 'hand' },
  activate: { label: 'activate', glyph: '◉', tone: 'act' },
  repeat: { label: 'repeat', glyph: '⟳', tone: 'flow' },
  if: { label: 'if', glyph: '?', tone: 'flow' },
  while: { label: 'while', glyph: '∞', tone: 'flow' },
  F1: { label: 'F1', glyph: 'ƒ', tone: 'fn' },
  F2: { label: 'F2', glyph: 'ƒ', tone: 'fn' },
  F3: { label: 'F3', glyph: 'ƒ', tone: 'fn' },
};

/** The Lobby palette, always shown so locked commands appear greyed out (ED-8). */
export const PALETTE_ORDER: PaletteCommand[] = ['forward', 'turn_left', 'turn_right', 'jump', 'pick_up', 'drop', 'activate'];

export function blockCommand(b: Block): PaletteCommand {
  switch (b.kind) {
    case 'action':
      return b.action;
    case 'call':
      return b.fn;
    default:
      return b.kind;
  }
}
