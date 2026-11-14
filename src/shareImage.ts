// The "share a solved floor" picture: the board as LoopBot left it, the program as code, and the
// block count against par. Drawn on a canvas in the app, so it works offline and sends nothing to us.

import type { CodeLine } from './sim/program';
import { t, tn } from './i18n';

export interface ShareCard {
  /** "Floor 12 · Long Duct" */
  title: string;
  /** "Tower 1 · Meridian Spire" */
  subtitle: string;
  stars: number;
  band: string;
  board: HTMLImageElement | null;
  /** The program as code. Left out for the daily challenge, so the picture gives nothing away. */
  code?: CodeLine[];
  /** The daily challenge: the streak, shown where the code would be. */
  daily?: { streak: number };
  commands: number;
  steps: number;
  par: { commands: number; steps: number };
}

export const W = 1080;
export const H = 1350;
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
const TEAL = '#7ff2e0';
const GOLD = '#ffc861';

/** Each band's sky, as in the floor screen (top to bottom). */
const SKIES: Record<string, string[]> = {
  lobby: ['#2a2347', '#4b3766', '#8c5a74', '#c97f72'],
  maintenance: ['#0f1d24', '#173039', '#24413f', '#4a4632'],
  workshop: ['#24160f', '#3a2318', '#573522', '#6e4a2c'],
  control: ['#080d1c', '#111a33', '#1a2547', '#22305a'],
  rooftop: ['#04060f', '#0b1130', '#1c1f45', '#3a2b4a'],
  // Tower 2, Frostline
  frostgate: ['#5b7290', '#8aa3bf', '#bcd0e2', '#e3edf5'],
  glacier: ['#0f2a44', '#1d4a6e', '#3d7aa0', '#8ab9d6'],
  signal: ['#121827', '#1f2840', '#3a3d58', '#6c6a80'],
  aurora: ['#05101c', '#0b1a2e', '#16223f', '#2b2a52'],
  summit: ['#0b1630', '#22355e', '#5c7aa6', '#c8d8ea'],
  // Tower 3, Heatwave
  dunegate: ['#6e3320', '#b45e34', '#eaa35e', '#f9e2b8'],
  furnace: ['#1a0d0a', '#2e1510', '#4a1d14', '#7a2e1a'],
  bazaar: ['#2a1b3d', '#5a2f52', '#b0584e', '#e89a5c'],
  mirage: ['#4a3570', '#8a6aae', '#d9b0c8', '#f6dccc'],
  crown: ['#7a4210', '#c47a22', '#f2c45e', '#fff0cc'],
};

/** How many code lines fit; longer programs end with "…". */
export const MAX_CODE_LINES = 12;

export function codeForCard(code: CodeLine[]): string[] {
  const lines = code.map((l) => l.text);
  if (lines.length <= MAX_CODE_LINES) return lines;
  return [...lines.slice(0, MAX_CODE_LINES - 1), `    … ${lines.length - MAX_CODE_LINES + 1} more lines`];
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function star(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, on: boolean) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.fillStyle = on ? GOLD : '#3a3f5c';
  g.fill();
}

export function drawShareCard(c: ShareCard, canvas: HTMLCanvasElement = document.createElement('canvas')): HTMLCanvasElement {
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;

  // page
  g.fillStyle = '#1b1c2b';
  g.fillRect(0, 0, W, H);

  // header: LoopBot wordmark, floor title, stars
  g.textBaseline = 'alphabetic';
  g.font = `800 64px ${SANS}`;
  g.fillStyle = '#f7f3ea';
  g.fillText('Loop', 60, 112);
  g.fillStyle = TEAL;
  g.fillText('Bot', 60 + g.measureText('Loop').width, 112);
  g.font = `700 44px ${SANS}`;
  g.fillStyle = '#f7f3ea';
  g.fillText(c.title, 60, 186, W - 120 - (c.daily ? 0 : 220));
  g.font = `500 30px ${SANS}`;
  g.fillStyle = '#a7a9c4';
  g.fillText(c.subtitle, 60, 232, W - 120 - (c.daily ? 0 : 220));
  // (the daily shows its stars big, below the board)
  if (!c.daily) for (let i = 0; i < 3; i++) star(g, W - 230 + i * 80, 150, 32, i < c.stars);

  // board on its band's sky
  const bx = 40,
    by = 270,
    bw = W - 80,
    bh = 500;
  g.save();
  roundRect(g, bx, by, bw, bh, 28);
  g.clip();
  const sky = g.createLinearGradient(0, by, 0, by + bh);
  const stops = SKIES[c.band] ?? SKIES.lobby;
  stops.forEach((col, i) => sky.addColorStop(i / (stops.length - 1), col));
  g.fillStyle = sky;
  g.fillRect(bx, by, bw, bh);
  const crop = c.board && boardBounds(c.board);
  if (c.board && crop) {
    // fill the frame with the board itself, not the empty sky around it
    const pad = 70;
    const s = Math.min((bw - pad * 2) / crop.w, (bh - pad * 2) / crop.h, 4);
    const w = crop.w * s,
      h = crop.h * s;
    g.imageSmoothingQuality = 'high';
    g.drawImage(c.board, crop.x, crop.y, crop.w, crop.h, bx + (bw - w) / 2, by + (bh - h) / 2, w, h);
  }
  g.restore();

  const cy = by + bh + 30,
    ch = H - cy - 150;
  roundRect(g, bx, cy, bw, ch, 24);
  g.fillStyle = '#12131f';
  g.fill();
  if (c.code) {
    // the program as code
    const lines = codeForCard(c.code);
    const size = lines.length > 9 ? 26 : 30;
    g.font = `500 ${size}px ${MONO}`;
    const lh = Math.min(size * 1.35, (ch - 50) / Math.max(lines.length, 1));
    lines.forEach((t, i) => {
      g.fillStyle = t.startsWith('def ') ? TEAL : '#e6e4f2';
      g.fillText(t, bx + 36, cy + 30 + size + i * lh, bw - 72);
    });
  } else {
    // the daily challenge: no code, so nobody gets the answer; big stars and the streak instead
    const mid = bx + bw / 2;
    for (let i = 0; i < 3; i++) star(g, mid - 130 + i * 130, cy + 110, 52, i < c.stars);
    g.textAlign = 'center';
    g.font = `800 64px ${SANS}`;
    g.fillStyle = '#f7f3ea';
    g.fillText(tn(c.commands, '{n} command', '{n} commands'), mid, cy + 250, bw - 72);
    g.font = `500 34px ${SANS}`;
    g.fillStyle = '#a7a9c4';
    g.fillText(t('par {n}', { n: c.par.commands }), mid, cy + 300, bw - 72);
    if (c.daily && c.daily.streak > 1) {
      g.font = `700 40px ${SANS}`;
      g.fillStyle = GOLD;
      g.fillText(`🔥 ${tn(c.daily.streak, '{n}-day streak', '{n}-day streak')}`, mid, cy + ch - 40, bw - 72);
    }
    g.textAlign = 'left';
  }

  // score and invite
  g.font = `700 36px ${SANS}`;
  g.fillStyle = '#f7f3ea';
  const score = c.daily
    ? t('Same puzzle for everyone today. How did you do?')
    : `${tn(c.commands, '{n} command (par {par})', '{n} commands (par {par})', { par: c.par.commands })} · ${tn(c.steps, '{n} step (par {par})', '{n} steps (par {par})', { par: c.par.steps })}`;
  g.fillText(score, 60, H - 82, W - 120);
  g.font = `500 28px ${SANS}`;
  g.fillStyle = '#a7a9c4';
  const invite = c.daily ? t('Play the LoopBot Daily: kisstudios.net/loopbot') : t('Can you do it in fewer? Play LoopBot: kisstudios.net/loopbot');
  g.fillText(invite, 60, H - 36, W - 120);

  return canvas;
}

/** The part of the board snapshot that isn't transparent sky. */
function boardBounds(img: HTMLImageElement): { x: number; y: number; w: number; h: number } | null {
  const w = img.naturalWidth || img.width,
    h = img.naturalHeight || img.height;
  if (!w || !h) return null;
  const t = document.createElement('canvas');
  t.width = w;
  t.height = h;
  const g = t.getContext('2d', { willReadFrequently: true });
  if (!g) return { x: 0, y: 0, w, h };
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, w, h).data;
  let x0 = w,
    y0 = h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] < 24) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  return x1 < 0 ? { x: 0, y: 0, w, h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
