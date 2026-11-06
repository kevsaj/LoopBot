# LoopBot

A puzzle game that teaches coding and logical thinking. You program a small robot with command blocks to climb the Meridian Spire, one floor at a time.

This is the **editor prototype** (roadmap phase 2). Its gate: *editing feels easy on a phone, and no code is ever lost.* The board is grey boxes on purpose; art comes in the vertical slice.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (also on your LAN, so you can open it on a phone)
npm test           # simulation tests + level checks
npm run build      # static build in dist/ (works on itch.io or any web server)
```

To try it on a phone, run `npm run dev` and open the "Network" URL it prints, on the same Wi-Fi.

### Android (Capacitor)

The Capacitor config is in place (`capacitor.config.ts`). The native project isn't committed yet, because it needs the Android SDK:

```bash
npm install @capacitor/android
npx cap add android
npm run cap:sync
npx cap open android   # build and run from Android Studio
```

## What's in the prototype

| Area | Where | Notes |
| --- | --- | --- |
| Simulation | `src/sim/world.ts` | Pure TypeScript, deterministic. Implements the Command rules (CR-1 to CR-10). |
| Interpreter | `src/sim/interpreter.ts` | Walks the block tree one action at a time (Step, highlight, 500-step cap, call depth 32). No `eval`. |
| Program model | `src/sim/program.ts` | Blocks, command counting (CR-7), read-only Python-like code view. |
| Solver | `src/sim/solver.ts` | Breadth-first search for the shortest action path (LV-3). |
| Floors 1 to 3 | `src/levels/*.json` | Documented floor format. `levels.test.ts` runs LV-1 to LV-3 on every floor. |
| Editor | `src/editor/` | Visible slots, tap to add at the cursor, long-press drag to reorder, swipe left to delete (with 4-second Undo), unlimited undo/redo, Clear with confirm, autosave per floor, Code tab. |
| Board | `src/board/` | Phaser isometric board inside React, 90-degree turn button, step tweens. |
| Feedback | `src/audio/feedback.ts` | Synthesised sounds (no audio files) and haptics (Capacitor Haptics on device, vibrate on web). Mute button top right. |

### Controls

- **Tap** a command in the palette to insert it at the cursor (the dashed line). By default that's the end of the program.
- **Tap** a line to move the cursor just after it. Tap an empty slot to move the cursor back to the end.
- **Long-press and drag** a line to reorder it.
- **Swipe a line left** to delete it. An Undo button shows for 4 seconds.
- **↶ / ↷** undo and redo, also Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y). Undo reaches back across runs and across Clear.
- **Run / Pause, Step, Reset, speed (1x, 2x, 4x).** Editing the program ends the current run.
- Keyboard: Tab to a line, Space to pick it up and arrow keys to move it, Delete to remove it.

## Adding a floor

1. Write `src/levels/t1-fNN.json` in the floor format (see Floor 3 for an example).
2. Add it to `src/levels/index.ts`.
3. Run `npm run check-levels`. It fails if the file is malformed, the reference solution misses par, or a shorter path than the step par exists.

## Small additions to the spec

These aren't in the requirements doc yet. Each one is easy to change:

- `jump` onto a tile at the same height fails with `ERR: nothing to jump, use forward` (the doc only defines the too-high message).
- Floor files may carry an optional `links` list that ties switches to doors. Without it, every switch toggles every door.
- A loop that runs 10,000 control checks without an action stops with the step-limit error, so `while` with an empty body can't hang the app.
