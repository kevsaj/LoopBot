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

The Android project is in `android/` (Capacitor 8, app ID `com.kisstudios.loopbot`, min Android 7, target SDK 36). You need Android Studio for the SDK and Java.

```bash
npm run android:run      # build the game, copy it into android/, install on a plugged-in phone
npm run android:open     # open the project in Android Studio
npm run android:bundle   # signed release bundle for Google Play (needs android/keystore.properties)
```

- The version comes from `package.json` (`0.1.0` becomes versionName 0.1.0, versionCode 100). Bump it before every Play upload.
- Release signing reads `android/keystore.properties` (copy `keystore.properties.example`). The key and that file are never committed.
- App icon and splash are drawn in `assets/src/*.svg` and rendered to `assets/*.png`. To regenerate the Android sizes: `npx @capacitor/assets generate --android`, then restore the two `mipmap-anydpi-v26/*.xml` files (they use the foreground without the tool's extra inset).
- Every build (`npm run build`, demo, Android) strips the floors' reference solutions. Only the dev server and the level checks keep them.
- CI builds a debug APK on every PR (download it from the run's artifacts to sideload) and checks the release bundle builds.
- Privacy policy and terms for the store listing: https://www.kisstudios.net/loopbot/privacy and /loopbot/terms (see [PRIVACY.md](PRIVACY.md)). Settings links to both.

### iOS (Capacitor)

The iOS project is in `ios/` (Capacitor 8 with Swift Package Manager, no CocoaPods; bundle ID `com.kisstudios.loopbot`, iPhone only, portrait, iOS 15.4+, so an iPad mini 4 on iPadOS 15.8 still runs it). Building needs Xcode, which only runs on macOS, so there are two ways to ship:

- **No Mac (default):** the `iOS TestFlight` workflow in GitHub Actions archives, signs and uploads a build to App Store Connect. Run it from the Actions tab. It needs the repository secrets listed at the top of `.github/workflows/ios-testflight.yml`. The build number is the workflow run number, the version is `package.json`'s.
- **On a Mac:** `npm run ios:sync` then `npm run ios:open`, pick your team under Signing & Capabilities, and Product > Archive.

```bash
npm run ios:sync   # build the game and copy it into ios/
npm run ios:open   # open the project in Xcode (macOS only)
npm run ios:run    # run on a simulator or plugged-in iPhone (macOS only)
```

- CI builds the app for the simulator on every PR (unsigned), so a broken Xcode project shows up before you need a Mac.
- `ios/App/App/PrivacyInfo.xcprivacy` declares what the optional playtest stats and feedback collect. Keep it in step with the App Privacy answers in App Store Connect and the privacy policy.
- `ITSAppUsesNonExemptEncryption` is false in `Info.plist` (the game only uses HTTPS), so each upload skips the export compliance question.
- To regenerate the iOS icon and splash from `assets/`: `npx @capacitor/assets generate --ios --iconBackgroundColor '#2b2546' --splashBackgroundColor '#2b2546' --splashBackgroundColorDark '#2b2546'`. The icon must stay without transparency.

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
