// LoopBot's antenna tip in SVG, in the shape the player picked (src/rewards/looks.ts).
// It fills with the eye colour through the --bot-eye CSS variable unless a fill is given.

import type { TipShape } from './looks';
import { loadLook, tipPoints } from './looks';

interface Props {
  cx: number;
  cy: number;
  r: number;
  className?: string;
  shape?: TipShape;
  fill?: string;
}

export function AntennaTip({ cx, cy, r, className, shape = loadLook().tip, fill = 'var(--bot-eye, #7ff2e0)' }: Props) {
  if (shape === 'ball') return <circle className={className} cx={cx} cy={cy} r={r} style={{ fill }} />;
  if (shape === 'ring')
    return <circle className={className} cx={cx} cy={cy} r={r * 0.8} style={{ fill: 'none', stroke: fill, strokeWidth: r * 0.45 }} />;
  const pts = tipPoints(shape, cx, cy, r)
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
  return <polygon className={className} points={pts} style={{ fill }} strokeLinejoin="round" />;
}
