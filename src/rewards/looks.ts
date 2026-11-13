// LoopBot's looks: paint, eye colour and antenna tip, unlocked with tower stars and achievements.
// Pure cosmetics, no gameplay effect. The chosen look is drawn everywhere LoopBot appears:
// the board (BoardScene reads boardColors()), the title screen and the tower map marker
// (both read CSS variables set by applyLookCss()).

import type { Stats } from './achievements';
import { totalStars } from './achievements';
import { PLUS_VISIBLE, plusUnlocked } from '../store/purchases';

/** How a look part unlocks: tower stars, an achievement, or LoopBot Plus. */
export type Unlock = { stars: number } | { achievement: string; label: string } | { plus: true };

export interface Paint {
  id: string;
  name: string;
  /** Top face, the lit side and the shaded side. */
  top: string;
  left: string;
  right: string;
  unlock: Unlock | null;
}

export interface EyeColor {
  id: string;
  name: string;
  color: string;
  unlock: Unlock | null;
}

export type TipShape = 'ball' | 'star' | 'heart' | 'bolt' | 'crown' | 'ring' | 'snowflake' | 'gem';

export interface Tip {
  id: TipShape;
  name: string;
  unlock: Unlock | null;
}

export const PAINTS: Paint[] = [
  { id: 'classic', name: 'Classic', top: '#f7f3ea', left: '#d9d2c4', right: '#bdb5a6', unlock: null },
  { id: 'sky', name: 'Sky', top: '#cfe6ff', left: '#a3c6ec', right: '#82a7d1', unlock: { stars: 15 } },
  { id: 'mint', name: 'Mint', top: '#d3f5e6', left: '#a6dcc4', right: '#86bfa6', unlock: { stars: 30 } },
  { id: 'sunset', name: 'Sunset', top: '#ffd9b3', left: '#f0b07a', right: '#d0905c', unlock: { stars: 50 } },
  { id: 'rose', name: 'Rose', top: '#ffd6e2', left: '#eba9be', right: '#cc8ba0', unlock: { stars: 75 } },
  { id: 'graphite', name: 'Graphite', top: '#7d7a8c', left: '#5c5a6b', right: '#474555', unlock: { stars: 100 } },
  { id: 'gold', name: 'Gold', top: '#ffe28a', left: '#e5ba4f', right: '#c49a37', unlock: { achievement: 'perfectionist', label: 'Perfectionist' } },
  // LoopBot Plus looks, from Frostline
  { id: 'frost', name: 'Frost', top: '#e6f6ff', left: '#b4daf3', right: '#8cb8d9', unlock: { plus: true } },
  { id: 'aurora', name: 'Aurora', top: '#d4f8e8', left: '#94dfbf', right: '#9b88d9', unlock: { plus: true } },
  { id: 'northstar', name: 'Northstar', top: '#46598f', left: '#33436f', right: '#263354', unlock: { plus: true } },
  { id: 'ember', name: 'Ember', top: '#ffa587', left: '#e57256', right: '#bb5039', unlock: { plus: true } },
];

export const EYES: EyeColor[] = [
  { id: 'teal', name: 'Teal', color: '#7ff2e0', unlock: null },
  { id: 'amber', name: 'Amber', color: '#ffc861', unlock: { stars: 20 } },
  { id: 'pink', name: 'Pink', color: '#ff8fc7', unlock: { stars: 40 } },
  { id: 'lime', name: 'Lime', color: '#b8f56a', unlock: { stars: 60 } },
  { id: 'violet', name: 'Violet', color: '#b9a2ff', unlock: { stars: 90 } },
  { id: 'white', name: 'Snow', color: '#f2fbff', unlock: { stars: 120 } },
  { id: 'ice', name: 'Ice', color: '#8fdcff', unlock: { plus: true } },
  { id: 'beacon', name: 'Beacon', color: '#ffd34d', unlock: { plus: true } },
];

export const TIPS: Tip[] = [
  { id: 'ball', name: 'Ball', unlock: null },
  { id: 'star', name: 'Star', unlock: { achievement: 'perfect-10', label: 'Perfect ten' } },
  { id: 'heart', name: 'Heart', unlock: { achievement: 'streak-7', label: 'On a roll' } },
  { id: 'bolt', name: 'Bolt', unlock: { achievement: 'decision-maker', label: 'Decision maker' } },
  { id: 'ring', name: 'Ring', unlock: { achievement: 'no-hints', label: 'Figured it out' } },
  { id: 'crown', name: 'Crown', unlock: { achievement: 'spire', label: 'Spire cleared' } },
  { id: 'snowflake', name: 'Snowflake', unlock: { plus: true } },
  { id: 'gem', name: 'Gem', unlock: { plus: true } },
];

/** Whether a part comes with LoopBot Plus. */
export const isPlusPart = (unlock: Unlock | null) => !!unlock && 'plus' in unlock;

/** Plus parts only show once Plus is on sale, or to players who already have it. */
export const plusPartsShown = () => PLUS_VISIBLE || plusUnlocked();

export interface Look {
  paint: string;
  eye: string;
  tip: TipShape;
}

export const DEFAULT_LOOK: Look = { paint: 'classic', eye: 'teal', tip: 'ball' };
const KEY = 'loopbot.look';

export function isUnlocked(unlock: Unlock | null, stats: Stats, earned: Set<string>): boolean {
  if (!unlock) return true;
  if ('plus' in unlock) return plusUnlocked();
  return 'stars' in unlock ? totalStars(stats) >= unlock.stars : earned.has(unlock.achievement);
}

export function unlockLabel(unlock: Unlock | null): string {
  if (!unlock) return 'Free';
  if ('plus' in unlock) return 'Plus';
  return 'stars' in unlock ? `${unlock.stars} ★` : `🏆 ${unlock.label}`;
}

/** Every look part the player has, as "paint:sky", "eye:amber", "tip:star". */
export function unlockedParts(stats: Stats, earned: Set<string>): Set<string> {
  const out = new Set<string>();
  PAINTS.forEach((p) => isUnlocked(p.unlock, stats, earned) && out.add(`paint:${p.id}`));
  EYES.forEach((e) => isUnlocked(e.unlock, stats, earned) && out.add(`eye:${e.id}`));
  TIPS.forEach((t) => isUnlocked(t.unlock, stats, earned) && out.add(`tip:${t.id}`));
  return out;
}

export function partName(key: string): string {
  const [kind, id] = key.split(':');
  const list = kind === 'paint' ? PAINTS : kind === 'eye' ? EYES : TIPS;
  const name = list.find((x) => x.id === id)?.name ?? id;
  return kind === 'paint' ? `${name} paint` : kind === 'eye' ? `${name} eye` : `${name} antenna`;
}

export function loadLook(): Look {
  try {
    const l = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Look> | null;
    return {
      paint: PAINTS.some((p) => p.id === l?.paint) ? l!.paint! : DEFAULT_LOOK.paint,
      eye: EYES.some((e) => e.id === l?.eye) ? l!.eye! : DEFAULT_LOOK.eye,
      tip: TIPS.some((t) => t.id === l?.tip) ? l!.tip! : DEFAULT_LOOK.tip,
    };
  } catch {
    return DEFAULT_LOOK;
  }
}

export function saveLook(l: Look) {
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    /* ignore */
  }
}

const paintOf = (l: Look) => PAINTS.find((p) => p.id === l.paint) ?? PAINTS[0];
const eyeOf = (l: Look) => EYES.find((e) => e.id === l.eye) ?? EYES[0];
const hex = (c: string) => parseInt(c.slice(1), 16);

/** Colours for the Phaser board, as numbers. */
export function boardColors(l: Look = loadLook()) {
  const p = paintOf(l);
  return { bot: hex(p.top), botL: hex(p.left), botR: hex(p.right), eye: hex(eyeOf(l).color), tip: l.tip };
}

/** Sets the CSS variables the SVG bots (title screen, tower map, locker) are drawn with. */
export function applyLookCss(l: Look = loadLook()) {
  if (typeof document === 'undefined') return;
  const p = paintOf(l);
  const s = document.documentElement.style;
  s.setProperty('--bot-top', p.top);
  s.setProperty('--bot-left', p.left);
  s.setProperty('--bot-right', p.right);
  s.setProperty('--bot-eye', eyeOf(l).color);
}

/**
 * The antenna tip as polygon points around (cx, cy) with radius r, shared by the SVG bots and the
 * board. 'ball' is a circle and returns no points.
 */
export function tipPoints(shape: TipShape, cx: number, cy: number, r: number): [number, number][] {
  const pts: [number, number][] = [];
  if (shape === 'star') {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r * 1.15;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
  } else if (shape === 'heart') {
    for (let i = 0; i < 24; i++) {
      const t = (i / 24) * Math.PI * 2;
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pts.push([cx + (x / 16) * r * 1.1, cy - (y / 16) * r * 1.1]);
    }
  } else if (shape === 'bolt') {
    const b: [number, number][] = [[0.15, -1.2], [-0.6, 0.15], [-0.05, 0.15], [-0.2, 1.2], [0.6, -0.2], [0.05, -0.2]];
    b.forEach(([x, y]) => pts.push([cx + x * r, cy + y * r]));
  } else if (shape === 'crown') {
    const c: [number, number][] = [[-1, 0.7], [-1.1, -0.6], [-0.5, 0], [0, -0.9], [0.5, 0], [1.1, -0.6], [1, 0.7]];
    c.forEach(([x, y]) => pts.push([cx + x * r, cy + y * r]));
  } else if (shape === 'snowflake') {
    // six thin arms
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 6;
      const rr = i % 2 ? r * 0.32 : r * 1.25;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
  } else if (shape === 'gem') {
    const d: [number, number][] = [[0, -1.2], [0.85, -0.35], [0.55, 0.9], [-0.55, 0.9], [-0.85, -0.35]];
    d.forEach(([x, y]) => pts.push([cx + x * r, cy + y * r]));
  } else if (shape === 'ring') {
    // a ring is drawn as a thick outline, so return the circle's points
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return pts;
}
