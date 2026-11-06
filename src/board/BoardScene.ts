// The isometric board, drawn as grey boxes (editor prototype phase: no art yet).
// It only reads World snapshots from the simulation; it never changes them.

import Phaser from 'phaser';
import type { Facing, World } from '../sim/types';

const TW = 64; // tile width on screen
const TH = 32; // tile height on screen
const HU = 14; // pixels per height unit
const WALL_H = 0.8; // walls stand a little above the floor, low enough not to hide the path

const C = {
  bg: 0x1b1d2a,
  floorTop: 0x8a90a6,
  floorL: 0x5d6276,
  floorR: 0x4a4e60,
  wallTop: 0x50556a,
  wallL: 0x363a4a,
  wallR: 0x2c2f3c,
  edge: 0x22252f,
  exit: 0x5ad1a4,
  target: 0xf2c14e,
  switchOff: 0x7d8297,
  switchOn: 0x5ad1a4,
  door: 0xc0624d,
  boxTop: 0xd9a066,
  boxL: 0xa8784a,
  boxR: 0x8d6440,
  bot: 0x7cc4ff,
  botDark: 0x3f7fb5,
  eye: 0x10121a,
  crash: 0xff5b5b,
};

export interface BoardUpdate {
  world: World;
  /** The action that produced this world, so the bot can animate it. */
  action?: string;
  crashed?: boolean;
  cleared?: boolean;
  /** Milliseconds per step at the current speed. */
  stepMs: number;
}

type Grid = { rx: number; ry: number };

export class BoardScene extends Phaser.Scene {
  private rot = 0;
  private world: World | null = null;
  private layer!: Phaser.GameObjects.Container;
  private bot!: Phaser.GameObjects.Container;
  private botBody!: Phaser.GameObjects.Graphics;
  private ready = false;
  private pending: BoardUpdate | null = null;

  constructor() {
    super('board');
  }

  create() {
    this.cameras.main.setBackgroundColor(C.bg);
    this.layer = this.add.container(0, 0);
    this.botBody = this.add.graphics();
    this.bot = this.add.container(0, 0, [this.botBody]);
    this.layer.add(this.bot);
    this.scale.on('resize', () => this.fit());
    this.ready = true;
    if (this.pending) this.show(this.pending);
  }

  /** Rotate the view 90 degrees (the board turns in 90-degree steps only). */
  rotate() {
    this.rot = (this.rot + 1) % 4;
    if (this.world) this.show({ world: this.world, stepMs: 0 });
  }

  show(u: BoardUpdate) {
    if (!this.ready) {
      this.pending = u;
      return;
    }
    const prev = this.world;
    this.world = u.world;
    this.drawStatic(u.world);
    this.fit();
    this.moveBot(prev, u);
  }

  // --- projection ---

  private toGrid(w: World, x: number, y: number): Grid {
    let dx = x - (w.w - 1) / 2;
    let dy = y - (w.h - 1) / 2;
    for (let i = 0; i < this.rot; i++) [dx, dy] = [-dy, dx];
    return { rx: dx, ry: dy };
  }

  private screen(g: Grid, h: number) {
    return { sx: ((g.rx - g.ry) * TW) / 2, sy: ((g.rx + g.ry) * TH) / 2 - h * HU };
  }

  private fit() {
    if (!this.world) return;
    const w = this.world;
    const cam = this.cameras.main;
    const span = Math.max(w.w, w.h);
    const worldW = span * TW + TW;
    const worldH = span * TH + 4 * HU * 2 + TH;
    const zoom = Math.min(cam.width / worldW, cam.height / worldH, 2.2);
    cam.setZoom(zoom);
    cam.centerOn(0, -HU);
  }

  // --- drawing ---

  private prism(g: Phaser.GameObjects.Graphics, sx: number, sy: number, hPx: number, top: number, l: number, r: number, scale = 1) {
    const hw = (TW / 2) * scale;
    const hh = (TH / 2) * scale;
    // left face
    g.fillStyle(l, 1);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(sx - hw, sy),
        new Phaser.Math.Vector2(sx, sy + hh),
        new Phaser.Math.Vector2(sx, sy + hh + hPx),
        new Phaser.Math.Vector2(sx - hw, sy + hPx),
      ],
      true,
    );
    // right face
    g.fillStyle(r, 1);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(sx + hw, sy),
        new Phaser.Math.Vector2(sx, sy + hh),
        new Phaser.Math.Vector2(sx, sy + hh + hPx),
        new Phaser.Math.Vector2(sx + hw, sy + hPx),
      ],
      true,
    );
    // top face
    this.diamond(g, sx, sy, top, scale);
  }

  private diamond(g: Phaser.GameObjects.Graphics, sx: number, sy: number, color: number, scale = 1, alpha = 1) {
    const hw = (TW / 2) * scale;
    const hh = (TH / 2) * scale;
    const pts = [
      new Phaser.Math.Vector2(sx, sy - hh),
      new Phaser.Math.Vector2(sx + hw, sy),
      new Phaser.Math.Vector2(sx, sy + hh),
      new Phaser.Math.Vector2(sx - hw, sy),
    ];
    g.fillStyle(color, alpha);
    g.fillPoints(pts, true);
    g.lineStyle(1, C.edge, 0.6);
    g.strokePoints(pts, true);
  }

  private drawStatic(w: World) {
    for (const child of [...this.layer.list]) if (child !== this.bot) child.destroy();
    const key = (x: number, y: number) => `${x},${y}`;
    for (let y = 0; y < w.h; y++) {
      for (let x = 0; x < w.w; x++) {
        const t = w.tiles[y][x];
        const grid = this.toGrid(w, x, y);
        const g = this.add.graphics();
        g.setDepth((grid.rx + grid.ry) * 10);
        const base = HU * 0.6; // every tile has a little thickness so the board reads as a diorama
        if (t.type === 'gap') {
          const { sx, sy } = this.screen(grid, 0);
          this.diamond(g, sx, sy + 4, 0x0e0f16, 0.9);
        } else if (t.type === 'wall') {
          const { sx, sy } = this.screen(grid, t.height + WALL_H);
          this.prism(g, sx, sy, (t.height + WALL_H) * HU + base, C.wallTop, C.wallL, C.wallR);
        } else {
          const { sx, sy } = this.screen(grid, t.height);
          this.prism(g, sx, sy, t.height * HU + base, C.floorTop, C.floorL, C.floorR);
          if (t.type === 'exit') {
            // exit: concentric rings plus a soft beacon, so it reads at a glance
            this.diamond(g, sx, sy, C.exit, 0.85);
            this.diamond(g, sx, sy, C.floorTop, 0.55);
            this.diamond(g, sx, sy, C.exit, 0.3);
            g.fillStyle(C.exit, 0.18);
            g.fillRect(sx - TW * 0.12, sy - 46, TW * 0.24, 46);
          } else if (t.type === 'switch') {
            const on = w.switches[key(x, y)];
            g.fillStyle(on ? C.switchOn : C.switchOff, 1);
            g.fillEllipse(sx, sy, TW * 0.36, TH * 0.36);
            g.lineStyle(2, C.edge, 1);
            g.strokeEllipse(sx, sy, TW * 0.36, TH * 0.36);
          } else if (t.type === 'door') {
            if (!w.doors[key(x, y)]) this.prism(g, sx, sy - WALL_H * HU, WALL_H * HU, C.door, 0x9a4b3a, 0x7f3e30, 0.85);
            else this.diamond(g, sx, sy, 0x3a3e50, 0.85);
          }
          if (t.colour) {
            const col = { r: 0xe0605a, g: 0x6cc56c, b: 0x5b8ee6, y: 0xf2d24e }[t.colour];
            this.diamond(g, sx, sy, col, 0.55, 0.85);
          }
        }
        // targets: a yellow square-in-diamond outline (shape as well as colour, ED-16)
        const target = w.targets.find((tt) => tt.x === x && tt.y === y);
        if (target) {
          const { sx, sy } = this.screen(grid, t.height);
          const filled = w.boxes[y][x] >= target.count;
          g.lineStyle(3, filled ? C.exit : C.target, 1);
          const s = 0.62;
          g.strokePoints(
            [
              new Phaser.Math.Vector2(sx, sy - (TH / 2) * s),
              new Phaser.Math.Vector2(sx + (TW / 2) * s, sy),
              new Phaser.Math.Vector2(sx, sy + (TH / 2) * s),
              new Phaser.Math.Vector2(sx - (TW / 2) * s, sy),
            ],
            true,
          );
        }
        // box stacks
        for (let i = 0; i < w.boxes[y][x]; i++) {
          const bg = this.add.graphics();
          bg.setDepth((grid.rx + grid.ry) * 10 + 2 + i);
          const { sx, sy } = this.screen(grid, t.height + i + 1);
          this.prism(bg, sx, sy + 2, HU - 2, C.boxTop, C.boxL, C.boxR, 0.72);
          this.layer.add(bg);
        }
        this.layer.add(g);
      }
    }
    this.layer.sort('depth');
  }

  private botPos(w: World) {
    const grid = this.toGrid(w, w.bot.x, w.bot.y);
    const h = w.tiles[w.bot.y][w.bot.x].height + w.boxes[w.bot.y][w.bot.x];
    return { ...this.screen(grid, h), depth: (grid.rx + grid.ry) * 10 + 6 };
  }

  private screenFacing(f: Facing) {
    const d = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] }[f];
    let [dx, dy] = d;
    for (let i = 0; i < this.rot; i++) [dx, dy] = [-dy, dx];
    return { fx: ((dx - dy) * TW) / 4, fy: ((dx + dy) * TH) / 4 };
  }

  private drawBot(w: World, crashed: boolean) {
    const g = this.botBody;
    g.clear();
    const body = crashed ? C.crash : C.bot;
    // body: a small cube standing on the tile
    this.prism(g, 0, -22, 20, body, C.botDark, 0x2f6390, 0.5);
    // eye shows facing
    const { fx, fy } = this.screenFacing(w.bot.facing);
    g.fillStyle(C.eye, 1);
    g.fillCircle(fx * 0.45, -22 + fy * 0.45, 3.5);
    if (w.bot.carrying) this.prism(g, 0, -40, HU - 2, C.boxTop, C.boxL, C.boxR, 0.5);
  }

  private moveBot(prev: World | null, u: BoardUpdate) {
    const w = u.world;
    const to = this.botPos(w);
    this.drawBot(w, !!u.crashed);
    this.tweens.killTweensOf(this.bot);
    const dur = Math.max(0, u.stepMs * 0.8);
    const moved = prev && (prev.bot.x !== w.bot.x || prev.bot.y !== w.bot.y);
    if (!prev || dur === 0 || !moved) {
      this.bot.setPosition(to.sx, to.sy);
    } else {
      const from = this.botPos(prev);
      this.bot.setPosition(from.sx, from.sy);
      const lift = u.action === 'jump' ? 22 : 4;
      this.tweens.add({ targets: this.bot, x: to.sx, duration: dur, ease: 'Sine.easeInOut' });
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: dur,
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          this.bot.y = from.sy + (to.sy - from.sy) * t - Math.sin(Math.PI * t) * lift;
        },
      });
    }
    // Bot is drawn over the tile it is on and the one it came from.
    this.bot.setDepth(Math.max(to.depth, prev ? this.botPos(prev).depth : 0));
    this.layer.sort('depth');

    if (u.crashed) {
      this.cameras.main.shake(180, 0.006);
      this.tweens.add({ targets: this.bot, x: to.sx + 3, yoyo: true, repeat: 3, duration: 40, delay: dur });
    } else if (u.cleared) {
      this.tweens.add({ targets: this.bot, scale: 1.25, yoyo: true, duration: 180, delay: dur, ease: 'Back.easeOut' });
    } else if (u.action === 'turn_left' || u.action === 'turn_right' || u.action === 'pick_up' || u.action === 'drop' || u.action === 'activate') {
      this.tweens.add({ targets: this.bot, scaleY: 0.88, yoyo: true, duration: Math.min(90, dur / 2 || 90) });
    }
  }
}

export function createBoard(parent: HTMLElement, onReady: (scene: BoardScene) => void): Phaser.Game {
  const scene = new BoardScene();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: C.bg,
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth || 360, height: parent.clientHeight || 300 },
    scene,
    banner: false,
    render: { antialias: true },
    input: { mouse: false, touch: false },
  });
  game.events.once(Phaser.Core.Events.READY, () => onReady(scene));
  return game;
}
