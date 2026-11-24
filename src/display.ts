// Big screens with a mouse: Google Play Games on PC, and desktop browsers.
//
// On Google Play Games on PC the window is a big screen at a low density, so the game's CSS
// pixels come out tiny: the whole interface is scaled up to fit the window (CSS zoom on the page,
// with --z telling the vh/dvh sizes in styles.css to undo it, since Chrome zooms those too).
// The mouse extras (hover highlights, number keys on the palette) turn on where the pointer is a
// mouse, and always on the PC, whose mouse doesn't always report as a "fine pointer" to the page.

/** The layout the wide (landscape) mode is designed around, in CSS pixels. */
const DESIGN_W = 1180;
const DESIGN_H = 720;
const MAX_ZOOM = 2.5;

let pc = false;

export function isPc(): boolean {
  return pc;
}

/** How much to scale the interface for a window this size (1 = as designed). */
export function uiZoom(w: number, h: number): number {
  const z = Math.min(w / DESIGN_W, h / DESIGN_H);
  // Small steps, so text stays crisp and a tiny resize doesn't reflow everything.
  return Math.max(1, Math.min(MAX_ZOOM, Math.floor(z * 10) / 10));
}

/** Portrait tablets: the phone layout, scaled so it fills the screen instead of floating small in it. */
const PHONE_W = 620;
const PHONE_H = 920;
const MAX_TABLET_ZOOM = 1.5;

/**
 * How much to scale the interface on a touch screen this size. Phones stay at 1; a portrait tablet
 * (short side 700+ CSS px) scales up, about 1.2 on an 11" iPad; a landscape tablet uses the wide
 * layout's own sizing, as the PC does.
 */
export function tabletZoom(w: number, h: number): number {
  if (Math.min(w, h) < 700) return 1;
  if (w > h) return uiZoom(w, h);
  const z = Math.min(w / PHONE_W, h / PHONE_H, MAX_TABLET_ZOOM);
  return Math.max(1, Math.floor(z * 10) / 10);
}

function apply() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const fine = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
  root.classList.toggle('mouse', pc || fine);
  root.classList.toggle('pc', pc);
  // (CSS zoom doesn't change innerWidth/innerHeight, so these are the window's real CSS size.)
  // Touch screens only, so a desktop browser keeps the sizes it has always had.
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const z = pc ? uiZoom(window.innerWidth, window.innerHeight) : touch ? tabletZoom(window.innerWidth, window.innerHeight) : 1;
  root.style.setProperty('--z', String(z));
  root.style.zoom = z === 1 ? '' : String(z);
}

let listening = false;

/** Called at start-up, and again once the Android side has said whether this is a PC. */
export function applyDisplay(isPcNow = pc) {
  pc = isPcNow;
  apply();
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('resize', apply);
  if (typeof matchMedia === 'function') matchMedia('(hover: hover) and (pointer: fine)').addEventListener?.('change', apply);
}

/** Lets a desktop browser preview the PC look during development: add ?pc to the address. */
export function devPcPreview(): boolean {
  return import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('pc');
}
