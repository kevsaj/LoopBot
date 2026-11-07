# LoopBot

A puzzle game that teaches coding and logical thinking. You program a small robot with command blocks to climb the Meridian Spire, one floor at a time.

Tower 1 (Meridian Spire, Floors 1 to 50) is playable: the Lobby, Maintenance (repeat), Workshop (F1 and F2), Control Room (if and while) and the Rooftop (typed code). The free web demo plays Floors 1 to 10.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173 (also on your LAN, so you can open it on a phone)
npm test             # simulation tests + level checks
npm run build        # static build in dist/ (works on any web server or inside Capacitor)
npm run build:demo   # the itch.io demo in dist-demo/: Floors 1 to 10, no reference solutions
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

## Where things are

| Area | Where | Notes |
| --- | --- | --- |
| Simulation | `src/sim/world.ts` | Pure TypeScript, deterministic. Implements the Command rules (CR-1 to CR-10). |
| Interpreter | `src/sim/interpreter.ts` | Walks the block tree one action at a time (Step, highlight, 500-step cap, call depth 32). No `eval`. |
| Program model | `src/sim/program.ts` | Blocks, command counting (CR-7), tree edits, the read-only Python-like code view. |
| Typed code | `src/sim/code.ts` | Rooftop pro mode: parses the code view's syntax back into blocks, with line-numbered errors. |
| Solver | `src/sim/solver.ts` | Shortest action path (LV-3) and smallest program (LV-4), used by the level checks only. |
| Floors | `src/levels/*.json` | Floor files. `levels.test.ts` runs LV-1 to LV-4 on every floor. |
| Editor | `src/editor/` | Visible slots, tap or drag to add, long-press drag to reorder, swipe left to delete (with Undo), unlimited undo/redo, Clear with confirm, autosave per floor, Code tab. |
| Board | `src/board/` | Phaser isometric board inside React, loaded as its own chunk so the first screen opens fast. |
| Tower map, progress | `src/TowerMap.tsx`, `src/progress.ts` | Floor unlocking, stars, hints wallet, all saved on the device. |
| Feedback | `src/audio/feedback.ts`, `src/fx/confetti.ts` | Synthesised sounds (no audio files), haptics (Capacitor Haptics on device, vibrate on web), confetti. |

### Controls

- **Tap** a command in the palette to insert it at the cursor (the dashed line), or **drag** it into the program where you want it.
- **Tap** a line to move the cursor just after it. Tap a loop's header to add inside it, its foot to add after it, and an empty slot to go back to the end.
- **Long-press and drag** a line to move it, into or out of loops too.
- **Swipe a line left** to delete it. An Undo button shows for 4 seconds.
- **↶ / ↷** undo and redo, also Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y). Undo reaches back across runs and across Clear.
- **Run / Pause, Step, Reset, speed (1x, 2x, 4x).** The speed is remembered. Editing the program ends the current run.
- Keyboard: Tab to a line, Enter to put the cursor there, Alt+Up/Down to move it, Delete to remove it, Escape to close a sheet.
- Sound and vibration, and the tutorial tips, are in Settings (⚙).

## Adding a floor

1. Write `src/levels/t1-fNN.json` in the floor format (see Floor 3 for a simple example).
2. Add it to `src/levels/index.ts`.
3. Run `npm run check-levels`. It fails if the file is malformed, the reference solution misses par, or a shorter path or program than par exists.

## Small additions to the spec

These aren't in the requirements doc yet. Each one is easy to change:

- `jump` onto a tile at the same height fails with `ERR: nothing to jump, use forward` (the doc only defines the too-high message).
- Floor files may carry an optional `links` list that ties switches to doors. Without it, every switch toggles every door.
- A loop that runs 10,000 control checks without an action stops with the step-limit error, so `while` with an empty body can't hang the app.
