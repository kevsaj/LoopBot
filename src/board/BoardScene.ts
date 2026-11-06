// The isometric board. All art is drawn in code (decided Nov 6: art is made in-house),
// as flat-shaded isometric shapes in the Monument Valley-inspired style.
// It only reads World snapshots from the simulation; it never changes them.

import Phaser from 'phaser';
import type { Facing, World } from '../sim/types';
import { ahead, isWalkable, surfaceHeight } from '../sim/world';

const TW = 64; // tile width on screen
const TH = 32; // tile height on screen
const HU = 14; // pixels per height unit
const WALL_H = 0.8; // walls stand a little above the floor, low enough not to hide the path

// Lobby palette: warm sandstone floor, dusty violet walls, teal light for anything "on".
const C = {
  floorTop: 0xeedcbc,
  floorL: 0xcfae8a,
  floorR: 0xb08e70,
  floorEdge: 0xf8ecd6,
  wallTop: 0x8b7fb0,
  wallL: 0x675c8c,
  wallR: 0x524874,
  wallCap: 0xa89bcc,
  edge: 0x3b2f4a,
  exit: 0x3fd6c1,
  exitGlow: 0x9ff5e8,
  target: 0xf2b84b,
  switchOff: 0xe0706a,
  switchOn: 0x3fd6c1,
  door: 0xe0706a,
  doorL: 0xb85550,
  doorR: 0x9a4542,
  boxTop: 0xe39a63,
  boxL: 0xbf7848,
  boxR: 0xa0633b,
  cell: 0x7ff2e0,
  bot: 0xf7f3ea,
  botL: 0xd9d2c4,
  botR: 0xbdb5a6,
  visor: 0x2b2440,
  eye: 0x7ff2e0,
  crash: 0xff6b6b,
  void: 0x2a2140,
};
const LOBBY = { ...C };

/**
 * Each band of the tower has its own look (art list: 5 band palettes). Only the building
 * changes; LoopBot, crates and the "on" teal stay the same everywhere.
 */
const BANDS: Record<string, Partial<typeof C>> = {
  lobby: {},
  // Maintenance: brushed-steel walkways between teal duct walls, in a dim service light.
  maintenance: {
    floorTop: 0xc6d1da,
    floorL: 0x97a6b4,
    floorR: 0x7a8a99,
    floorEdge: 0xe3eaf0,
    wallTop: 0x3e7174,
    wallL: 0x2c5558,
    wallR: 0x214245,
    wallCap: 0x5f9a9c,
    edge: 0x18262d,
    void: 0x10202a,
  },
};

/** Switches the board to a band's palette. Call before the board draws a floor. */
export function setBand(band: string) {
  Object.assign(C, LOBBY, BANDS[band] ?? {});
}

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
  private botInner!: Phaser.GameObjects.Container;
  private botShadow!: Phaser.GameObjects.Ellipse;
  /** The facing arrow on the floor, drawn under LoopBot inside its container. */
  private botArrow!: Phaser.GameObjects.Graphics;
  private ready = false;
  private pending: BoardUpdate | null = null;

  constructor() {
    super('board');
  }

  create() {
    this.layer = this.add.container(0, 0);
    this.botBody = this.add.graphics();
    this.botShadow = this.add.ellipse(0, 0, TW * 0.42, TH * 0.42, 0x2b2440, 0.28);
    this.botArrow = this.add.graphics();
    this.botInner = this.add.container(0, 0, [this.botBody]);
    this.bot = this.add.container(0, 0, [this.botShadow, this.botArrow, this.botInner]);
    // idle bob: LoopBot hovers gently, like a toy
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) this.tweens.add({ targets: this.botInner, y: -2.5, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
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
    g.lineStyle(1, C.edge, 0.18);
    g.strokePoints(pts, true);
  }

  /** A thin light line along the two front top edges, which gives tiles a crisp bevel. */
  private rim(g: Phaser.GameObjects.Graphics, sx: number, sy: number, color: number, scale = 1) {
    const hw = (TW / 2) * scale;
    const hh = (TH / 2) * scale;
    g.lineStyle(1.5, color, 0.9);
    g.beginPath();
    g.moveTo(sx - hw, sy);
    g.lineTo(sx, sy + hh);
    g.lineTo(sx + hw, sy);
    g.strokePath();
  }

  /** A crate carrying a power cell: warm box, glowing cyan band on the two visible faces. */
  private crate(g: Phaser.GameObjects.Graphics, sx: number, sy: number, scale: number) {
    const hPx = (HU - 2) * (scale / 0.72);
    this.prism(g, sx, sy, hPx, C.boxTop, C.boxL, C.boxR, scale);
    const hw = (TW / 2) * scale;
    const hh = (TH / 2) * scale;
    const mid = hPx * 0.5;
    g.lineStyle(2, C.cell, 0.95);
    g.beginPath();
    g.moveTo(sx - hw, sy + mid);
    g.lineTo(sx, sy + hh + mid);
    g.lineTo(sx + hw, sy + mid);
    g.strokePath();
    this.rim(g, sx, sy, 0xf6c49a, scale);
  }

  private drawStatic(w: World) {
    for (const child of [...this.layer.list]) {
      if (child === this.bot) continue;
      this.tweens.killTweensOf(child);
      child.destroy();
    }
    const key = (x: number, y: number) => `${x},${y}`;
    for (let y = 0; y < w.h; y++) {
      for (let x = 0; x < w.w; x++) {
        const t = w.tiles[y][x];
        const grid = this.toGrid(w, x, y);
        const g = this.add.graphics();
        g.setDepth((grid.rx + grid.ry) * 10);
        const base = HU * 0.6; // every tile has a little thickness so the board reads as a diorama
        if (t.type === 'gap') {
          // a dark shaft with a sliver of the drop visible
          const { sx, sy } = this.screen(grid, 0);
          this.diamond(g, sx, sy + 6, C.void, 0.92, 0.9);
          this.diamond(g, sx, sy + 12, 0x1a1430, 0.6, 0.9);
        } else if (t.type === 'wall') {
          const { sx, sy } = this.screen(grid, t.height + WALL_H);
          this.prism(g, sx, sy, (t.height + WALL_H) * HU + base, C.wallTop, C.wallL, C.wallR);
          this.diamond(g, sx, sy, C.wallCap, 0.7, 0.55);
          this.rim(g, sx, sy, C.wallCap);
        } else {
          const { sx, sy } = this.screen(grid, t.height);
          this.prism(g, sx, sy, t.height * HU + base, C.floorTop, C.floorL, C.floorR);
          this.rim(g, sx, sy, C.floorEdge);
          // faint inset so the floor reads as laid stone
          g.lineStyle(1, C.floorL, 0.35);
          g.strokePoints(
            [
              new Phaser.Math.Vector2(sx, sy - TH * 0.36),
              new Phaser.Math.Vector2(sx + TW * 0.36, sy),
              new Phaser.Math.Vector2(sx, sy + TH * 0.36),
              new Phaser.Math.Vector2(sx - TW * 0.36, sy),
            ],
            true,
          );
          if (t.type === 'exit') {
            // the service lift: a glowing pad with a soft beam that pulses
            this.diamond(g, sx, sy, C.exit, 0.8);
            this.diamond(g, sx, sy, C.exitGlow, 0.5);
            this.diamond(g, sx, sy, C.exit, 0.25);
            const beam = this.add.graphics();
            beam.setDepth((grid.rx + grid.ry) * 10 + 1);
            beam.fillStyle(C.exitGlow, 0.22);
            beam.fillPoints(
              [
                new Phaser.Math.Vector2(sx - TW * 0.3, sy),
                new Phaser.Math.Vector2(sx - TW * 0.18, sy - 52),
                new Phaser.Math.Vector2(sx + TW * 0.18, sy - 52),
                new Phaser.Math.Vector2(sx + TW * 0.3, sy),
              ],
              true,
            );
            this.layer.add(beam);
            this.tweens.add({ targets: beam, alpha: 0.35, yoyo: true, repeat: -1, duration: 1100, ease: 'Sine.easeInOut' });
          } else if (t.type === 'switch') {
            const on = w.switches[key(x, y)];
            g.fillStyle(C.edge, 0.25);
            g.fillEllipse(sx, sy + 2, TW * 0.4, TH * 0.4);
            g.fillStyle(on ? C.switchOn : C.switchOff, 1);
            g.fillEllipse(sx, sy - (on ? 0 : 2), TW * 0.34, TH * 0.34);
            g.fillStyle(0xffffff, 0.35);
            g.fillEllipse(sx - 3, sy - (on ? 2 : 4), TW * 0.12, TH * 0.1);
          } else if (t.type === 'door') {
            if (!w.doors[key(x, y)]) {
              const dh = WALL_H * HU + 4;
              this.prism(g, sx, sy - dh, dh, C.door, C.doorL, C.doorR, 0.86);
              // warning stripes on the visible faces
              g.lineStyle(2, 0xf8e3c0, 0.6);
              for (const f of [0.3, 0.65]) {
                g.beginPath();
                g.moveTo(sx - (TW / 2) * 0.86, sy - dh + dh * f);
                g.lineTo(sx, sy - dh + (TH / 2) * 0.86 + dh * f);
                g.lineTo(sx + (TW / 2) * 0.86, sy - dh + dh * f);
                g.strokePath();
              }
            } else {
              this.diamond(g, sx, sy, C.void, 0.8, 0.55);
              this.rim(g, sx, sy, C.door, 0.86);
            }
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
          g.fillStyle(filled ? C.exit : C.target, 0.18);
          g.fillPoints(
            [
              new Phaser.Math.Vector2(sx, sy - (TH / 2) * 0.62),
              new Phaser.Math.Vector2(sx + (TW / 2) * 0.62, sy),
              new Phaser.Math.Vector2(sx, sy + (TH / 2) * 0.62),
              new Phaser.Math.Vector2(sx - (TW / 2) * 0.62, sy),
            ],
            true,
          );
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
          this.crate(bg, sx, sy + 2, 0.72);
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

  /** Screen offset from a tile's centre to the middle of its edge on the side the bot faces, plus the sideways vector along that edge. */
  private screenFacing(f: Facing) {
    const d = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] }[f];
    let [dx, dy] = d;
    for (let i = 0; i < this.rot; i++) [dx, dy] = [-dy, dx];
    const iso = (x: number, y: number) => ({ x: ((x - y) * TW) / 4, y: ((x + y) * TH) / 4 });
    const fwd = iso(dx, dy);
    const side = iso(-dy, dx);
    return { fx: fwd.x, fy: fwd.y, sx: side.x, sy: side.y };
  }

  /**
   * A small glowing chevron on the floor in front of LoopBot. It lies flat, so it points the
   * right way from all four views. It stays on LoopBot's own tile, so it never paints over a
   * wall, crate or step. The one exception: facing away from the camera, the body would hide
   * it, so it sits just across the edge on the next tile, but only when that tile is clear floor.
   */
  private drawArrow(w: World, crashed: boolean) {
    const g = this.botArrow;
    g.clear();
    const { fx, fy, sx, sy } = this.screenFacing(w.bot.facing);
    const at = (along: number, across: number) => ({ x: fx * along + sx * across, y: fy * along + sy * across });
    const next = ahead(w);
    const clear =
      isWalkable(w, next) && w.boxes[next.y][next.x] === 0 && surfaceHeight(w, next) === surfaceHeight(w, { x: w.bot.x, y: w.bot.y });
    // Front-facing it fills the front half of LoopBot's tile (the next tile is drawn over
    // anything past the edge); back-facing it sits on the next tile, clear of the body.
    const [from, to] = fy > 0 ? [0.46, 0.98] : clear ? [1.0, 1.52] : [0.46, 0.98];
    const tip = at(to, 0);
    const l = at(from, -0.42);
    const r = at(from, 0.42);
    const notch = at(from + 0.16, 0);
    g.fillStyle(crashed ? C.crash : C.eye, 0.95);
    g.fillPoints([tip, r, notch, l], true);
    g.lineStyle(1, 0x2b2440, 0.5);
    g.strokePoints([tip, r, notch, l], true);
  }

  private drawBot(w: World, crashed: boolean) {
    const g = this.botBody;
    g.clear();
    const body = crashed ? C.crash : C.bot;
    const { fx, fy } = this.screenFacing(w.bot.facing);
    this.drawArrow(w, crashed);
    // body: a rounded little block on short legs
    this.prism(g, 0, -16, 12, body, C.botL, C.botR, 0.44);
    // head
    this.prism(g, 0, -30, 10, body, C.botL, C.botR, 0.36);
    // visor on the side LoopBot faces, with a glowing eye: the facing reads at a glance
    g.fillStyle(C.visor, 1);
    g.fillEllipse(fx * 0.34, -27 + fy * 0.34, 12, 7);
    // Facing away from the camera, the eye is on the far side of the head: dim it so it does not read as facing us.
    g.fillStyle(crashed ? C.crash : C.eye, fy < 0 ? 0.35 : 1);
    g.fillEllipse(fx * 0.4, -27 + fy * 0.4, 5, 3.4);
    // antenna
    g.lineStyle(1.5, C.botR, 1);
    g.lineBetween(0, -36, 0, -44);
    g.fillStyle(crashed ? C.crash : C.eye, 1);
    g.fillCircle(0, -45, 2.4);
    if (w.bot.carrying) this.crate(g, 0, -56, 0.5);
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
      this.lightUp(w, dur);
    } else if (u.action === 'turn_left' || u.action === 'turn_right' || u.action === 'pick_up' || u.action === 'drop' || u.action === 'activate') {
      this.tweens.add({ targets: this.bot, scaleY: 0.88, yoyo: true, duration: Math.min(90, dur / 2 || 90) });
    }
  }

  /** Clearing a floor transforms it: a wave of light runs out from the bot across every walkable tile. */
  private lightUp(w: World, delay: number) {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    for (let y = 0; y < w.h; y++) {
      for (let x = 0; x < w.w; x++) {
        const t = w.tiles[y][x];
        if (t.type === 'wall' || t.type === 'gap') continue;
        const grid = this.toGrid(w, x, y);
        const { sx, sy } = this.screen(grid, t.height + w.boxes[y][x]);
        const g = this.add.graphics();
        g.setDepth((grid.rx + grid.ry) * 10 + 5);
        this.diamond(g, sx, sy, C.exit, 0.95, 1);
        g.setAlpha(0);
        this.layer.add(g);
        const dist = Math.abs(x - w.bot.x) + Math.abs(y - w.bot.y);
        this.tweens.add({
          targets: g,
          alpha: { from: 0, to: 0.55 },
          yoyo: true,
          hold: reduced ? 400 : 120,
          duration: reduced ? 1 : 220,
          delay: delay + (reduced ? 0 : dist * 70),
          onComplete: () => g.destroy(),
        });
      }
    }
    this.layer.sort('depth');
  }
}

export function createBoard(parent: HTMLElement, onReady: (scene: BoardScene) => void): Phaser.Game {
  const scene = new BoardScene();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    transparent: true, // the sky gradient is CSS behind the canvas
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth || 360, height: parent.clientHeight || 300 },
    scene,
    banner: false,
    render: { antialias: true },
    input: { mouse: false, touch: false },
  });
  game.events.once(Phaser.Core.Events.READY, () => onReady(scene));
  return game;
}
