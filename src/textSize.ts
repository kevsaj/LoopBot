// "Larger text" (Settings > General): bumps the reading text in the floor screen, the tower map,
// the results card, the story and the sheets. Saved on the device and kept in backup codes.

const KEY = 'loopbot.bigText';

export function bigTextOn(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
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
