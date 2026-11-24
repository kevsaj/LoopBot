// Game feel timing, shared by the board (BoardScene) and the floor screen's sounds and buzzes,
// so a bump, a landing and a clear are seen, heard and felt at the same moment.
//
// A step's animation runs for MOVE_SHARE of the step time; the rest is a short rest before the
// next step. Each moment below is in milliseconds from the start of the step.

/** Share of a step spent moving; the rest is a pause, so steps read one at a time. */
export const MOVE_SHARE = 0.8;

/** How long LoopBot's move (or turn) takes at this step time. */
export function moveMs(stepMs: number): number {
  return Math.max(0, stepMs * MOVE_SHARE);
}

/**
 * When LoopBot hits something on a failed forward or jump: it leans into the blocked tile and
 * bumps at this point, then springs back. Other errors (nothing to pick up, a vent) have no lunge,
 * so they land at once.
 */
export function bumpMs(stepMs: number, action: string | undefined, reduced: boolean): number {
  if (reduced || !(action === 'forward' || action === 'jump')) return 0;
  return Math.round(moveMs(stepMs) * 0.45);
}

/** When LoopBot touches down on the tile it moved to: the clear sound and buzz wait for this. */
export function landMs(stepMs: number): number {
  return Math.round(moveMs(stepMs));
}

/**
 * The shape of a hop, 0 at take-off and landing and 1 at the top. Jumps rise a little faster than
 * they fall, so they feel springy rather than floaty.
 */
export function arc(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  // A parabola with its top moved to 42% of the way: 0 at both ends, exactly 1 at the peak.
  const peak = 0.42;
  return c <= peak ? 1 - ((c - peak) / peak) ** 2 : 1 - ((c - peak) / (1 - peak)) ** 2;
}

/** Ease in and out for a ground move: one smooth curve shared by the screen x and y, so the path stays straight. */
export function glide(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}
