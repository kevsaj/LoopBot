// "Larger text" (Settings > General): bumps the reading text in the floor screen, the tower map,
// the results card, the story and the sheets. Saved on the device and kept in backup codes.
// Until the player picks, it follows the phone: a large Android Font size turns it on. (The Android
// WebView would otherwise scale every font itself, buttons and palette too; see DisplayPlugin.java.)

import { Capacitor, registerPlugin } from '@capacitor/core';

const KEY = 'loopbot.bigText';

/** Android's Font size at or above this counts as "large" (Samsung's steps run about 0.9 to 1.3, then 1.5 and up). */
export const LARGE_FONT_SCALE = 1.15;

let deviceLarge = false;

function stored(): boolean | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === '1' ? true : v === '0' ? false : null;
  } catch {
    return null;
  }
}

export function bigTextOn(): boolean {
  return stored() ?? deviceLarge;
}

export function applyTextSize(on = bigTextOn()) {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('big-text', on);
}

export function setBigText(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
  applyTextSize(on);
}

interface DisplayPlugin {
  getFontScale(): Promise<{ fontScale: number }>;
}

/** Ask the phone for its font size once at start-up (Android only), then apply. */
export async function readDeviceTextSize(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    const { fontScale } = await registerPlugin<DisplayPlugin>('LoopBotDisplay').getFontScale();
    deviceLarge = fontScale >= LARGE_FONT_SCALE;
  } catch {
    /* an older app build without the plugin: keep the default */
  }
  applyTextSize();
}
