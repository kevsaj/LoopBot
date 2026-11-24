// LoopBot's icon art, drawn once as simple shapes so every size and format comes from one source:
// SVG for the iOS icon, store icon and splash PNGs, and Android vector drawables (sharp at any size).
// Units: the bot is drawn around (0, 0); it spans x -190..190 and y -302..260.

/** @typedef {{ t: 'rect', x: number, y: number, w: number, h: number, r: number, fill: string, op?: number }
 *   | { t: 'ellipse', cx: number, cy: number, rx: number, ry: number, fill: string, op?: number }} Shape */

export const INK = '#1f1b33';
export const TEAL = '#7ff2e0';

/** The bot, back to front. Bolder than the first icon: thicker antenna, bigger visor and eye, darker under-lips. */
export const BOT = [
  // soft shadow on the ground
  { t: 'ellipse', cx: 0, cy: 262, rx: 168, ry: 22, fill: '#000000', op: 0.22 },
  // antenna
  { t: 'rect', x: -12, y: -258, w: 24, h: 96, r: 12, fill: '#bfb193' },
  { t: 'ellipse', cx: 0, cy: -266, rx: 36, ry: 36, fill: TEAL },
  { t: 'ellipse', cx: -11, cy: -278, rx: 12, ry: 12, fill: '#ecfffc' },
  // body
  { t: 'rect', x: -150, y: 30, w: 300, h: 228, r: 38, fill: '#c9bea6' },
  { t: 'rect', x: -150, y: 30, w: 300, h: 196, r: 38, fill: '#ece5d4' },
  { t: 'rect', x: -150, y: 46, w: 300, h: 30, r: 0, fill: '#000000', op: 0.08 },
  { t: 'ellipse', cx: -72, cy: 140, rx: 21, ry: 21, fill: '#f2a93b' },
  // head
  { t: 'rect', x: -190, y: -185, w: 380, h: 242, r: 50, fill: '#c9bea6' },
  { t: 'rect', x: -190, y: -185, w: 380, h: 210, r: 50, fill: '#f8f3e8' },
  // visor and eye
  { t: 'rect', x: -142, y: -140, w: 284, h: 126, r: 63, fill: INK },
  { t: 'ellipse', cx: 20, cy: -77, rx: 82, ry: 52, fill: TEAL, op: 0.16 },
  { t: 'ellipse', cx: 20, cy: -77, rx: 64, ry: 40, fill: TEAL },
  { t: 'ellipse', cx: 2, cy: -90, rx: 20, ry: 11, fill: '#ecfffc' },
];

/** One-colour version for Android 13+ themed icons: the launcher tints it, so only the shape counts. */
export const MONO = [
  // antenna, head and body as one solid shape, with the visor cut out and the eye left in it
  { t: 'rect', x: -12, y: -258, w: 24, h: 96, r: 12, fill: '#000000' },
  { t: 'ellipse', cx: 0, cy: -266, rx: 36, ry: 36, fill: '#000000' },
  { t: 'rect', x: -150, y: 30, w: 300, h: 228, r: 38, fill: '#000000' },
  { t: 'rect', x: -190, y: -185, w: 380, h: 242, r: 50, fill: '#000000', hole: { x: -142, y: -140, w: 284, h: 126, r: 63 } },
  { t: 'ellipse', cx: 20, cy: -77, rx: 64, ry: 40, fill: '#000000' },
];

/** The dusk sky behind the bot, as used on the title screen. */
export const SKY = [
  ['0', '#2a2445'],
  ['0.45', '#3b2e58'],
  ['0.62', '#4d3a6a'],
  ['1', '#a46a76'],
];

const n = (v) => +v.toFixed(3);

/** Path data for a rounded rect (clockwise) or an ellipse, in output units. */
export function rrPath(x, y, w, h, r, ccw = false) {
  r = Math.min(r, w / 2, h / 2);
  if (!r) return ccw ? `M${n(x)},${n(y)}v${n(h)}h${n(w)}v${n(-h)}z` : `M${n(x)},${n(y)}h${n(w)}v${n(h)}h${n(-w)}z`;
  const a = (dx, dy) => `a${n(r)},${n(r)} 0 0 ${ccw ? 0 : 1} ${n(dx)},${n(dy)}`;
  if (ccw)
    return `M${n(x + r)},${n(y)}${a(-r, r)}v${n(h - 2 * r)}${a(r, r)}h${n(w - 2 * r)}${a(r, -r)}v${n(-(h - 2 * r))}${a(-r, -r)}z`;
  return `M${n(x + r)},${n(y)}h${n(w - 2 * r)}${a(r, r)}v${n(h - 2 * r)}${a(-r, r)}h${n(-(w - 2 * r))}${a(-r, -r)}v${n(-(h - 2 * r))}${a(r, -r)}z`;
}
export function ellPath(cx, cy, rx, ry) {
  return `M${n(cx - rx)},${n(cy)}a${n(rx)},${n(ry)} 0 1 1 ${n(2 * rx)},0a${n(rx)},${n(ry)} 0 1 1 ${n(-2 * rx)},0z`;
}

/** Shapes moved to (tx, ty) and scaled by s, as path data with fill. */
export function placed(shapes, s, tx, ty) {
  return shapes.map((sh) => {
    let d;
    if (sh.t === 'rect') {
      d = rrPath(tx + sh.x * s, ty + sh.y * s, sh.w * s, sh.h * s, sh.r * s);
      if (sh.hole) {
        const h = sh.hole;
        d += rrPath(tx + h.x * s, ty + h.y * s, h.w * s, h.h * s, h.r * s, true);
      }
    } else d = ellPath(tx + sh.cx * s, ty + sh.cy * s, sh.rx * s, sh.ry * s);
    return { d, fill: sh.fill, op: sh.op ?? 1, evenOdd: !!sh.hole };
  });
}

export function svgPaths(paths) {
  return paths
    .map((p) => `<path d="${p.d}" fill="${p.fill}"${p.op < 1 ? ` fill-opacity="${p.op}"` : ''}${p.evenOdd ? ' fill-rule="evenodd"' : ''}/>`)
    .join('');
}

/** A few faint stars, fixed so every render matches. Positions are fractions of the canvas. */
export const STARS = [
  [0.14, 0.12, 1], [0.27, 0.27, 0.7], [0.82, 0.1, 0.9], [0.9, 0.3, 0.6], [0.7, 0.2, 0.5], [0.08, 0.4, 0.6], [0.6, 0.07, 0.6],
];

/** The sky square: gradient, a soft teal glow where the bot's head sits, and stars. */
export function skySvg(w, h, glowX, glowY, glowR, starSize) {
  const stops = SKY.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
  const stars = STARS.map(([x, y, a]) => `<circle cx="${n(x * w)}" cy="${n(y * h)}" r="${n(starSize)}" fill="#ffffff" fill-opacity="${a * 0.55}"/>`).join('');
  return (
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>` +
    `<radialGradient id="glow" cx="${n(glowX)}" cy="${n(glowY)}" r="${n(glowR)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${TEAL}" stop-opacity=".22"/><stop offset="1" stop-color="${TEAL}" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#sky)"/><rect width="${w}" height="${h}" fill="url(#glow)"/>${stars}`
  );
}
