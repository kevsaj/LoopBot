// Backup codes: the player's progress as one line of text they can copy somewhere safe (notes,
// email to themselves) and paste back on a new phone or after a reinstall. No account, no server.
//
// Format: "LB1-" + base64url(JSON) + "-" + 4-character checksum. Only the saves that matter go in
// (tower progress, daily streak, map state, settings), not floor programs or the stats id, so the
// code stays short.

import { applySaves, collectSaves, markSavesDirty } from './persist';

const PREFIX = 'LB1-';
const KEEP = new Set(['loopbot.progress', 'loopbot.daily', 'loopbot.seenUnlocked', 'loopbot.floor', 'loopbot.muted', 'loopbot.haptics', 'loopbot.speed', 'loopbot.look', 'loopbot.rewardsSeen', 'loopbot.interludes', 'loopbot.bigText', 'loopbot.tower', 'loopbot.floor.t2', 'loopbot.seenUnlocked.t2', 'loopbot.floor.t3', 'loopbot.seenUnlocked.t3', 'loopbot.hintLedger']);

function toB64url(text: string) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(b64: string) {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** A short FNV-1a checksum so a cut-off or mistyped code is caught before it overwrites anything. */
function checksum(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36).slice(-4).padStart(4, '0');
}

export function makeBackupCode(): string {
  const body = toB64url(JSON.stringify(collectSaves((k) => KEEP.has(k))));
  return `${PREFIX}${body}-${checksum(body)}`;
}

export type RestoreResult = { ok: true; keys: number } | { ok: false; reason: string };

/** Checks a pasted code without changing anything. */
export function readBackupCode(input: string): Record<string, string> | null {
  const code = input.replace(/\s+/g, '');
  if (!code.startsWith(PREFIX)) return null;
  const rest = code.slice(PREFIX.length);
  const cut = rest.lastIndexOf('-');
  if (cut < 1) return null;
  const body = rest.slice(0, cut);
  if (checksum(body) !== rest.slice(cut + 1)) return null;
  try {
    const saves = JSON.parse(fromB64url(body)) as Record<string, string>;
    if (!saves || typeof saves !== 'object' || typeof saves['loopbot.progress'] !== 'string') return null;
    const progress = JSON.parse(saves['loopbot.progress']) as unknown;
    if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return null;
    return Object.fromEntries(Object.entries(saves).filter(([k, v]) => KEEP.has(k) && typeof v === 'string'));
  } catch {
    return null;
  }
}

/** Replaces this device's progress with the code's. The caller reloads the game afterwards. */
export function restoreBackupCode(input: string): RestoreResult {
  const saves = readBackupCode(input);
  if (!saves) return { ok: false, reason: "That code doesn't look right. Check that you copied all of it." };
  const keys = applySaves(saves, false);
  markSavesDirty();
  return { ok: true, keys };
}
