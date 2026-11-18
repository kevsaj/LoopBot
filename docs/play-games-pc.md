# Google Play Games on PC

LoopBot runs on Google Play Games on PC from the same Android app bundle as phones. Nothing in the
build changes: the PC is just another Android device with a mouse, a keyboard and a resizable window.

## What the app does on PC

- **Window**: phones stay locked to portrait. On a PC (or a tablet or Chromebook) the app may turn
  and resize freely, and the wide layout puts the board on the left and the program on the right.
  `MainActivity` checks the `com.google.android.play.feature.HPE_EXPERIENCE` system feature
  (Play Games on PC) and the screen size.
- **Mouse**: `android.hardware.type.pc` in the manifest turns off Play Games' "input translation",
  so the game gets real mouse events: hover, the scroll wheel, and click-and-drag from the palette.
  Lines in the program are moved by press-and-hold then drag, same as on a phone.
- **Keyboard**: `R` runs or pauses, `S` steps, `1`-`9` add the palette command in that position
  (the number shows in each chip's corner when there's a mouse), `Ctrl+Z` / `Ctrl+Y` undo and redo,
  `Esc` closes sheets, `Tab` moves between buttons, and on a program line `Delete` removes it and
  `Alt` + arrows move it.
- **No touchscreen needed**: `android.hardware.touchscreen` is marked optional.
- **x86-64**: the app has no native code (only Java/Kotlin and the web game), so it runs natively
  on PC processors with no translation.

## Play Console steps

1. Upload a build with these changes to the closed test track (Android release workflow).
2. Play Console, LoopBot, **Advanced settings** (under Test and release, called Release in older menus), then the **Form factors** tab.
3. **+ Add form factor > Google Play Games on PC**. Choose **Use the same release track and
   artifacts as your mobile app** (simplest: one bundle for phones and PC).
4. Click **Manage** on Google Play Games on PC, tick **Opt in to Google Play Games on PC**, save.
5. **Publishing overview > Send changes for review**. Google reviews the game for PC, which can take
   longer than a phone review. Once approved, testers on your closed test can install it from the
   Google Play Games app on Windows.

Optional later: a PC "game card" (Store presence > Main store listing): a 16:9 background with no
text and a 600x400 transparent logo.

## Trying it on a Windows PC before Google's review

1. Install **Android Studio** (for `adb`; or just the "SDK Platform-Tools" zip).
2. Download the **Google Play Games developer emulator** from
   https://developer.android.com/games/playgames/emulator and install it.
3. Open it, sign in, and right-click its taskbar icon > **Developer options**: turn on
   **PC mode (KiwiMouse)** so the mouse behaves like the real PC version.
4. Download a debug APK from GitHub Actions (CI run on main, artifact `loopbot-debug-apk`), unzip it.
5. In a terminal: `adb devices` (the emulator should be listed), then
   `adb install -r app-debug.apk`. LoopBot appears in the emulator's library.

## Not done yet (only needed for Google's "Optimized" badge, not to be listed)

- Google's Input SDK (the keyboard shortcuts overlay players open with Shift+Tab).
- Progress that syncs between phone and PC (Play Games sign-in and cloud saves).
- Sign-in with Play Games Services.
