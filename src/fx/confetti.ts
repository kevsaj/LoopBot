// A small, dependency-free confetti burst on a temporary full-screen canvas.
// Used by the results card: a big burst for 3 stars, a few sparkles for 2.

const COLORS = ['#f2c14e', '#7cc4ff', '#5ad1a4', '#e07a9a', '#8a6fe0', '#ffffff'];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  wobble: number;
  shape: 'rect' | 'star';
}

export interface BurstOptions {
  /** How many pieces. */
  count: number;
  /** Where it fires from, as fractions of the screen (0 to 1). */
  x: number;
  y: number;
  /** Initial speed in px per frame. */
  power: number;
  /** Cone half-angle in degrees around straight up. */
  spread?: number;
  /** Little stars instead of paper strips. */
  sparkle?: boolean;
}

export function reducedMotion() {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

let canvas: HTMLCanvasElement | null = null;
let pieces: Piece[] = [];
let raf = 0;

function ensureCanvas() {
  if (canvas) return canvas;
  canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  return canvas;
}

function star(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function frame() {
  const c = canvas;
  if (!c) return;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, c.width / dpr, c.height / dpr);
  const h = c.height / dpr;
  pieces = pieces.filter((p) => p.y < h + 30);
  for (const p of pieces) {
    p.vy += 0.22; // gravity
    p.vx *= 0.985; // air
    p.vy *= 0.985;
    p.wobble += 0.12;
    p.x += p.vx + Math.sin(p.wobble) * 0.6;
    p.y += p.vy;
    p.rot += p.vr;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.shape === 'star') star(ctx, p.w);
    else {
      // flip as it tumbles, like paper
      ctx.scale(1, Math.cos(p.wobble * 1.7));
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    ctx.restore();
  }
  if (pieces.length) raf = requestAnimationFrame(frame);
  else stop();
}

export function stop() {
  cancelAnimationFrame(raf);
  pieces = [];
  canvas?.remove();
  canvas = null;
}

export function burst(o: BurstOptions) {
  if (reducedMotion()) return;
  const c = ensureCanvas();
  const dpr = window.devicePixelRatio || 1;
  c.width = window.innerWidth * dpr;
  c.height = window.innerHeight * dpr;
  const spread = ((o.spread ?? 55) * Math.PI) / 180;
  for (let i = 0; i < o.count; i++) {
    const a = -Math.PI / 2 + (Math.random() * 2 - 1) * spread;
    const v = o.power * (0.55 + Math.random() * 0.6);
    pieces.push({
      x: o.x * window.innerWidth,
      y: o.y * window.innerHeight,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      w: o.sparkle ? 4 + Math.random() * 3 : 6 + Math.random() * 5,
      h: 4 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      wobble: Math.random() * 6,
      shape: o.sparkle ? 'star' : Math.random() < 0.2 ? 'star' : 'rect',
    });
  }
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}
