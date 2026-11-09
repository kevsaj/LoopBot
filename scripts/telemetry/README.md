# Playtest stats and feedback (Google Sheet)

LoopBot can send anonymous play stats ("where do players get stuck?") and in-game feedback to a
Google Sheet you own. No third-party analytics SDK, no accounts, free. The game code is in
`src/telemetry.ts`; this folder holds the receiving end.

Builds without `VITE_TELEMETRY_URL` (CI, the itch.io demo, a fresh clone) send nothing: the
Settings switch is hidden and "Send feedback" opens an email instead.

## One-time setup (about 5 minutes)

1. In Google Drive, create a new Google Sheet named **LoopBot playtest**.
2. In the sheet: **Extensions > Apps Script**. Delete what's there, paste all of `Code.gs`, save.
3. In the function dropdown pick **setup**, press **Run**, and allow the permissions it asks for
   (it edits this sheet and emails you new feedback). This makes the **Floors**, **Events** and
   **Feedback** tabs.
4. **Deploy > New deployment**, type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone** (the game has no Google sign-in, so it must be open)
   - Deploy, and copy the **Web app URL** (ends in `/exec`).
5. Open that URL in a browser: it should say "LoopBot stats endpoint is running."
6. In your LoopBot folder, create a file named `.env.local` with one line:

   ```
   VITE_TELEMETRY_URL=https://script.google.com/macros/s/XXXX/exec
   ```

   `.env.local` is git-ignored, so the URL stays out of the repo. Every `npm run build` /
   `npm run android:bundle` / `npm run android:apk` on your machine now includes it.

If you change `Code.gs` later, use **Deploy > Manage deployments > Edit > New version** so the URL
stays the same.

## Reading the results

- **Floors**: one row per floor. *players tried* and *players cleared* count distinct installs;
  *players stuck* is tried minus cleared, and *stuck %* is shaded red as it rises. Sort by it to
  find the floors to fix. Also: average runs and minutes to clear, hints used, crashed runs, and
  visits that ended without a clear.
- **Events**: raw rows (session, floor_start, run, hint, floor_clear, floor_leave).
- **Feedback**: every message, with mood (stuck / bug / idea / love it), floor and app version.
  You also get each one by email at kisstudios98@gmail.com.

## What is collected (keep the privacy policy in step)

A random install id made on the device, app version, platform (android/web), and per floor:
starts, run results (cleared / crashed / ended short, command and step counts), hints revealed,
stars, and seconds on the floor. Feedback messages carry mood, floor, version and platform.
No name, email, account, advertising id, device id or location. Players can turn stats off in
Settings; that also deletes the install id and anything not yet sent. Google receives requests to
the script (and with them the device's IP address) as the hosting provider; the script does not
store IP addresses.
