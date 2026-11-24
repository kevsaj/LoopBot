// "Colourful mode" (Settings > General, off by default, free for everyone): swaps the whole game to a
// bright, saturated candy-shop look. The UI turns grape and bubblegum, block colours get punchier, and
// every board gets a sugary sky, two-tone pastel floor tiles and jelly-coloured walls topped with icing.
//
// It's LoopBot's own look: six "flavours" handed out to the tower's bands, nothing borrowed from any
// other game. It only changes the building and the menus, never LoopBot's paint, eyes or antenna tip,
// so the LoopBot Plus looks stay unique (see the rule in src/rewards/looks.ts).
//
// <html> gets the class "colourful" while it's on; the CSS keys off that (end of styles.css), and each
// board area carries data-flavour="0..5" so its sky matches its tiles.

import { useEffect, useState } from 'react';

const KEY = 'loopbot.colourful';
const listeners = new Set<() => void>();

export function colourfulOn(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setColourful(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
  applyColourful();
}

/** Screens that draw their own colours (the board, the confetti) listen so they can repaint at once. */
export function onColourfulChange(f: () => void): () => void {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
}

export function applyColourful() {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('colourful', colourfulOn());
  listeners.forEach((f) => f());
}

/**
 * The switch as React state that follows every change, wherever it was made. The title screen's
 * candy button and the Settings switch both use it, so they always agree.
 */
export function useColourful(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(colourfulOn);
  useEffect(() => onColourfulChange(() => setOn(colourfulOn())), []);
  return [on, setColourful];
}

/** A candy flavour: the board palette for one band. Floors alternate two pastels like a sweet-shop tray. */
export interface Flavour {
  name: string;
  floorTop: number;
  floorTop2: number;
  floorL: number;
  floorR: number;
  floorEdge: number;
  wallTop: number;
  wallL: number;
  wallR: number;
  /** Icing on top of every wall. */
  wallCap: number;
  edge: number;
  void: number;
}

export const FLAVOURS: Flavour[] = [
  {
    name: 'strawberry',
    floorTop: 0xfff1f7,
    floorTop2: 0xffd3e7,
    floorL: 0xff9cc8,
    floorR: 0xf272ac,
    floorEdge: 0xffffff,
    wallTop: 0xff3d86,
    wallL: 0xe0206a,
    wallR: 0xb81455,
    wallCap: 0xfff4fa,
    edge: 0x5a0a33,
    void: 0x6e0f42,
  },
  {
    name: 'blueberry',
    floorTop: 0xeef5ff,
    floorTop2: 0xcfe2ff,
    floorL: 0x8fb8ff,
    floorR: 0x6994f2,
    floorEdge: 0xffffff,
    wallTop: 0x3a7bff,
    wallL: 0x2260e6,
    wallR: 0x1849bb,
    wallCap: 0xf2f8ff,
    edge: 0x0c1f5c,
    void: 0x13277a,
  },
  {
    name: 'lime',
    floorTop: 0xf4ffe9,
    floorTop2: 0xd9f8c4,
    floorL: 0x9ee37a,
    floorR: 0x76c955,
    floorEdge: 0xffffff,
    wallTop: 0x2fcf4f,
    wallL: 0x1fae3c,
    wallR: 0x168a2f,
    wallCap: 0xfbfff2,
    edge: 0x0b3d17,
    void: 0x0f5220,
  },
  {
    name: 'grape',
    floorTop: 0xf7f0ff,
    floorTop2: 0xe4d2ff,
    floorL: 0xbf9cff,
    floorR: 0x9e76f2,
    floorEdge: 0xffffff,
    wallTop: 0xa645ff,
    wallL: 0x8a2ae6,
    wallR: 0x6e1dbd,
    wallCap: 0xfaf4ff,
    edge: 0x320c5c,
    void: 0x42107a,
  },
  {
    name: 'orange',
    floorTop: 0xfff6e8,
    floorTop2: 0xffe0b8,
    floorL: 0xffbb70,
    floorR: 0xf29a45,
    floorEdge: 0xffffff,
    wallTop: 0xff8a1a,
    wallL: 0xe86f0a,
    wallR: 0xbf5806,
    wallCap: 0xfff8ee,
    edge: 0x5c2604,
    void: 0x7a3305,
  },
  {
    name: 'bubblegum',
    floorTop: 0xebfffd,
    floorTop2: 0xc6f6f1,
    floorL: 0x7fe3d8,
    floorR: 0x52c9bd,
    floorEdge: 0xffffff,
    wallTop: 0x14c8bd,
    wallL: 0x0aa89f,
    wallR: 0x078780,
    wallCap: 0xf0fffe,
    edge: 0x053d3a,
    void: 0x075450,
  },
];

/** The shared "candy" lights: exits, targets, switches, crates and power cells, brighter than usual. */
export const CANDY_LIGHTS = {
  exit: 0x19e3ff,
  exitGlow: 0xb8f7ff,
  target: 0xffd21a,
  switchOff: 0xff4a6e,
  switchOn: 0x19e3ff,
  door: 0xff4a6e,
  doorL: 0xdb2d52,
  doorR: 0xb31f40,
  boxTop: 0xffb02e,
  boxL: 0xf08a12,
  boxR: 0xc96d08,
  cell: 0x8cfff0,
  crash: 0xff3b5c,
};

/** Confetti in Colourful mode: every flavour plus lemon and white sprinkles. */
export const CANDY_CONFETTI = ['#ff3d86', '#3a7bff', '#2fcf4f', '#a645ff', '#ff8a1a', '#14c8bd', '#ffd21a', '#ffffff'];

/**
 * The bands in tower order. Each band takes the next flavour round the list, so neighbouring bands
 * never share one and every tower shows off all six.
 */
export const BAND_ORDER = 'lobby maintenance workshop control rooftop frostgate glacier signal aurora summit dunegate furnace bazaar mirage crown ferry garden loom lantern pinnacle quay crane ropewalk office crest atrium skybridge batik mirror twintops tessera fernhall cloister nautilus canopy frontdesk evidence briefing cells watchtower brickyard lapisgate gardens starstair cloudtop'.split(' ');

/** Which flavour a band wears. Fixed per band, so a band always looks the same. */
export function flavourOf(band: string): number {
  const i = BAND_ORDER.indexOf(band);
  if (i >= 0) return i % FLAVOURS.length;
  let h = 0;
  for (let k = 0; k < band.length; k++) h = (h * 31 + band.charCodeAt(k)) >>> 0;
  return h % FLAVOURS.length;
}
