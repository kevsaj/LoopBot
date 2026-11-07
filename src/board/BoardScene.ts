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
  // Workshop: oiled-oak benches between brick walls, under warm work lamps.
  workshop: {
    floorTop: 0xd9a86f,
    floorL: 0xa8784b,
    floorR: 0x86593a,
    floorEdge: 0xf2d3a4,
    wallTop: 0x8e4a3c,
    wallL: 0x6d382e,
    wallR: 0x552b24,
    wallCap: 0xb26654,
    edge: 0x2a1712,
    void: 0x1d120f,
  },
  // Control Room: cool glass-blue panels between slate consoles, lit by screens.
  control: {
    floorTop: 0xa9c4dc,
    floorL: 0x7b97b3,
    floorR: 0x5f7a96,
    floorEdge: 0xd9e8f5,
    wallTop: 0x3a4566,
    wallL: 0x2a3350,
    wallR: 0x20283f,
    wallCap: 0x5b6a96,
    edge: 0x111626,
    void: 0x0b1020,
  },
  // Rooftop: wet concrete and helipad paint under a night sky, with dark parapet walls.
  rooftop: {
    floorTop: 0x8f96a8,
    floorL: 0x666d80,
    floorR: 0x4f5566,
    floorEdge: 0xc4cad8,
    wallTop: 0x2f3443,
    wallL: 0x22262f,
    wallR: 0x1a1d25,
    wallCap: 0xe8b04a,
    edge: 0x0c0e14,
    void: 0x070912,
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
  /** Stars earned when the floor is cleared: LoopBot celebrates more for more stars. */
  stars?: number;
  /** Milliseconds per step at the current speed. */
  stepMs: number;
}

type Grid = { rx: number; ry: number };

/** Everything drawStatic reads that can change during a run: crates, switches and doors. */
function staticKey(w: World): string {
  return `${w.boxes.map((r) => r.join('')).join('/')}|${Object.values(w.switches).join()}|${Object.values(w.doors).join()}`;
}

/** How LoopBot's eye looks right now. */
type Mood = 'idle' | 'happy' | 'crash' | 'nervous';

const FACINGS: Facing[] = ['north', 'east', 'south', 'west'];

export class BoardScene extends Phaser.Scene {
  private rot = 0;
  private world: World | null = null;
  private layer!: Phaser.GameObjects.Container;
  private bot!: Phaser.GameObjects.Container;
  private botBody!: Phaser.GameObjects.Graphics;
  private botInner!: Phaser.GameObjects.Container;
  private botShadow!: Phaser.GameObjects.Ellipse;
  /** Holds the body for hops and tilts, separate from the idle bob on botInner. */
  private botPose!: Phaser.GameObjects.Container;
  private botEye!: Phaser.GameObjects.Graphics;
  /** The antenna pivots at its base, so it can wobble and lag behind moves. */
  private antenna!: Phaser.GameObjects.Container;
  private antennaG!: Phaser.GameObjects.Graphics;
  private mood: Mood = 'idle';
  /** 0 = eye open, 1 = shut. */
  private blink = 0;
  /** Sideways glance, -1 to 1. */
  private look = 0;
  /** Facing drawn right now; differs from the world's while LoopBot twirls. */
  private shownFacing: Facing = 'north';
  private crashedNow = false;
  private reduced = false;
  /** The facing arrow on the floor, drawn under LoopBot inside its container. */
  private botArrow!: Phaser.GameObjects.Graphics;
  private ready = false;
  private pending: BoardUpdate | null = null;
  /** What the static layer was last drawn from; most steps (moves, turns) leave it unchanged. */
  private drawnKey = '';
  private drawnTiles: World['tiles'] | null = null;

  constructor() {
    super('board');
  }

  create() {
    this.layer = this.add.container(0, 0);
    this.botBody = this.add.graphics();
    this.botShadow = this.add.ellipse(0, 0, TW * 0.42, TH * 0.42, 0x2b2440, 0.28);
    this.botArrow = this.add.graphics();
    this.botEye = this.add.graphics();
    this.antennaG = this.add.graphics();
    this.antenna = this.add.container(0, -36, [this.antennaG]);
    this.botInner = this.add.container(0, 0, [this.botBody, this.botEye, this.antenna]);
    this.botPose = this.add.container(0, 0, [this.botInner]);
    this.bot = this.add.container(0, 0, [this.botShadow, this.botArrow, this.botPose]);
    this.reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // idle bob: LoopBot hovers gently, like a toy
    if (!this.reduced) this.tweens.add({ targets: this.botInner, y: -2.5, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
    this.layer.add(this.bot);
    this.idleLife();
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
    // Rebuilding every tile is the costly part of a step, so only do it when the floor itself changed.
    const key = `${this.rot}|${staticKey(u.world)}`;
    if (key !== this.drawnKey || u.world.tiles !== this.drawnTiles) {
      this.drawStatic(u.world);
      this.drawnKey = key;
      this.drawnTiles = u.world.tiles;
    }
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

  private drawBot(w: World, crashed: boolean, facing: Facing = w.bot.facing) {
    const g = this.botBody;
    g.clear();
    this.shownFacing = facing;
    this.crashedNow = crashed;
    const body = crashed ? C.crash : C.bot;
    const { fx, fy } = this.screenFacing(facing);
    this.drawArrow(w, crashed);
    // body: a rounded little block
    this.prism(g, 0, -16, 12, body, C.botL, C.botR, 0.44);
    // a warm status light on the body: LoopBot's "heart"
    g.fillStyle(0xf2b84b, crashed ? 0.4 : 1);
    g.fillCircle(-5, -5, 1.6);
    // head
    this.prism(g, 0, -30, 10, body, C.botL, C.botR, 0.36);
    // visor on the side LoopBot faces: the facing reads at a glance
    g.fillStyle(C.visor, 1);
    g.fillEllipse(fx * 0.34, -27 + fy * 0.34, 13.5, 8.5);
    if (w.bot.carrying) this.crate(g, 0, -56, 0.5);
    this.drawEye();
    this.drawAntenna();
  }

  /** The eye carries LoopBot's mood: open and blinking, happy arcs, a dizzy cross, or wide with worry. */
  private drawEye() {
    const g = this.botEye;
    g.clear();
    const { fx, fy, sx, sy } = this.screenFacing(this.shownFacing);
    // Facing away from the camera the eye is on the far side of the head: dim it so it does not read as facing us.
    const alpha = fy < 0 ? 0.35 : 1;
    const ex = fx * 0.4 + sx * 0.12 * this.look;
    const ey = -27 + fy * 0.4 + sy * 0.12 * this.look;
    const color = this.mood === 'crash' ? C.crash : C.eye;
    if (this.mood === 'happy') {
      g.lineStyle(2, color, alpha);
      g.beginPath();
      g.moveTo(ex - 3.6, ey + 1.5);
      g.lineTo(ex, ey - 1.8);
      g.lineTo(ex + 3.6, ey + 1.5);
      g.strokePath();
    } else if (this.mood === 'crash') {
      g.lineStyle(1.8, color, alpha);
      g.lineBetween(ex - 2.6, ey - 2.2, ex + 2.6, ey + 2.2);
      g.lineBetween(ex - 2.6, ey + 2.2, ex + 2.6, ey - 2.2);
    } else {
      const wide = this.mood === 'nervous' ? 1.2 : 1;
      const h = Math.max(0.6, 4.4 * wide * (1 - this.blink));
      g.fillStyle(color, alpha);
      g.fillEllipse(ex, ey, 6.4 * wide, h);
      if (this.mood === 'nervous' && this.blink < 0.5) {
        g.fillStyle(C.visor, alpha);
        g.fillCircle(ex, ey, 1.2);
      }
    }
  }

  private drawAntenna() {
    const g = this.antennaG;
    g.clear();
    g.lineStyle(1.5, C.botR, 1);
    g.lineBetween(0, 0, 0, -8);
    const lit = this.mood === 'crash' || this.crashedNow ? C.crash : this.mood === 'happy' ? 0xf2b84b : C.eye;
    g.fillStyle(lit, 1);
    g.fillCircle(0, -9, 2.4);
  }

  /** Small things LoopBot does while you build: blinks, glances, antenna twitches. */
  private idleLife() {
    const next = () => this.time.delayedCall(1800 + Math.random() * 2600, act);
    const act = () => {
      if (this.mood === 'idle' || this.mood === 'nervous') {
        const r = Math.random();
        if (r < 0.55) this.doBlink();
        else if (r < 0.85 && this.mood === 'idle') this.glance();
        else this.wiggleAntenna(10);
      }
      next();
    };
    next();
  }

  private doBlink() {
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 70,
      yoyo: true,
      onUpdate: (tw) => {
        this.blink = tw.getValue() ?? 0;
        this.drawEye();
      },
      onComplete: () => {
        this.blink = 0;
        this.drawEye();
      },
    });
  }

  private glance() {
    if (this.reduced) return this.doBlink();
    const side = Math.random() < 0.5 ? -1 : 1;
    this.tweens.addCounter({
      from: 0,
      to: side,
      duration: 180,
      hold: 600,
      yoyo: true,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        this.look = tw.getValue() ?? 0;
        this.drawEye();
      },
      onComplete: () => {
        this.look = 0;
        this.drawEye();
      },
    });
  }

  private wiggleAntenna(deg: number) {
    if (this.reduced) return;
    this.tweens.killTweensOf(this.antenna);
    this.antenna.angle = 0;
    this.tweens.add({ targets: this.antenna, angle: { from: deg, to: 0 }, duration: 520, ease: 'Elastic.easeOut', easeParams: [1.4, 0.35] });
  }

  private setMood(m: Mood) {
    this.mood = m;
    this.drawEye();
    this.drawAntenna();
  }

  /** True when the floor right in front of LoopBot drops away or is a gap. */
  private atLedge(w: World) {
    const n = ahead(w);
    if (n.x < 0 || n.y < 0 || n.x >= w.w || n.y >= w.h) return true;
    const t = w.tiles[n.y][n.x];
    return t.type === 'gap' || (isWalkable(w, n) && surfaceHeight(w, n) < surfaceHeight(w, { x: w.bot.x, y: w.bot.y }));
  }

  /** Tap LoopBot on the board and it answers. Coordinates are relative to the canvas. Returns true on a hit. */
  poke(x: number, y: number): boolean {
    if (!this.ready || !this.world) return false;
    const p = this.cameras.main.getWorldPoint(x, y);
    const dx = p.x - this.bot.x;
    const dy = p.y - (this.bot.y - 24);
    if (dx * dx + dy * dy > 26 * 26) return false;
    if (this.mood === 'crash') return true;
    const before = this.mood;
    this.setMood('happy');
    this.wiggleAntenna(18);
    this.hop(8, 1);
    this.time.delayedCall(700, () => this.mood === 'happy' && this.setMood(before === 'happy' ? 'happy' : 'idle'));
    return true;
  }

  private hop(height: number, times: number, delay = 0) {
    if (this.reduced) return;
    this.tweens.killTweensOf(this.botPose);
    this.botPose.y = 0;
    this.tweens.add({ targets: this.botPose, y: -height, duration: 150, yoyo: true, repeat: times - 1, delay, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: this.botShadow, scale: 0.7, duration: 150, yoyo: true, repeat: times - 1, delay, ease: 'Quad.easeOut' });
  }

  /** A full spin on the spot: LoopBot shows each side in turn, then faces the way it really faces. */
  private twirl(w: World, delay: number) {
    if (this.reduced) return;
    const from = FACINGS.indexOf(w.bot.facing);
    for (let i = 1; i <= 4; i++) {
      this.time.delayedCall(delay + i * 90, () => {
        if (this.world !== w) return;
        this.drawBot(w, false, FACINGS[(from + i) % 4]);
      });
    }
  }

  private moveBot(prev: World | null, u: BoardUpdate) {
    const w = u.world;
    const to = this.botPos(w);
    const fresh = !prev || u.stepMs === 0;
    this.mood = u.crashed ? 'crash' : u.cleared ? 'happy' : this.atLedge(w) ? 'nervous' : 'idle';
    this.tweens.killTweensOf(this.botPose);
    this.botPose.setPosition(0, 0).setAngle(0);
    this.botShadow.setScale(1);
    if (fresh) this.look = 0;
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
      // The antenna lags behind the move, then springs back.
      this.wiggleAntenna(to.sx > from.sx ? -16 : to.sx < from.sx ? 16 : u.action === 'jump' ? 20 : 8);
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
      // a dizzy wobble after the bump
      if (!this.reduced) {
        this.tweens.chain({
          targets: this.botPose,
          tweens: [
            { angle: -12, duration: 90, delay: dur + 120 },
            { angle: 9, duration: 120 },
            { angle: -5, duration: 120 },
            { angle: 0, duration: 140 },
          ],
        });
        this.time.delayedCall(dur + 120, () => this.wiggleAntenna(24));
      }
    } else if (u.cleared) {
      const n = u.stars ?? 1;
      this.tweens.add({ targets: this.bot, scale: 1.18, yoyo: true, duration: 180, delay: dur, ease: 'Back.easeOut' });
      // More stars, bigger joy: 1 star is a nod, 2 a hop, 3 a double hop and a spin.
      if (n >= 2) this.time.delayedCall(dur + 200, () => this.hop(n >= 3 ? 14 : 10, n >= 3 ? 2 : 1));
      if (n >= 3) this.twirl(w, dur + 260);
      this.time.delayedCall(dur + 200, () => this.wiggleAntenna(22));
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
