# Upload Android builds to Google Play from GitHub

The **Android release** workflow can send the signed `.aab` straight to a Play testing track,
like the iOS TestFlight button. It needs one extra repository secret, `PLAY_SERVICE_ACCOUNT_JSON`:
a key for a Google "service account" (a robot user) that Play Console allows to release test builds.

One-time setup, about 15 minutes, all in a web browser.

## 1. Create the robot account in Google Cloud

1. Go to https://console.cloud.google.com and sign in with the Google account that owns the
   LoopBot Play Console developer account.
2. At the top left, click the project picker, then **New project**. Name it `LoopBot Play upload`
   and click **Create**. Make sure the new project is selected in the picker afterwards.
3. Open https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com
   (the **Google Play Android Developer API**) and click **Enable**.
4. Open **IAM & Admin > Service accounts** (https://console.cloud.google.com/iam-admin/serviceaccounts)
   and click **Create service account**.
   - Name: `github-play-upload`. Click **Create and continue**.
   - Skip "Grant this service account access to project" and "Grant users access". Click **Done**.
5. Copy the service account's email from the list. It looks like
   `github-play-upload@loopbot-play-upload-123456.iam.gserviceaccount.com`. You need it in step 2.
6. Click the service account, open the **Keys** tab, then **Add key > Create new key > JSON > Create**.
   A `.json` file downloads to your Downloads folder. Treat it like a password: don't email it or
   commit it. (If Google says key creation is blocked by an organisation policy, tell Claude.)

## 2. Let it release test builds in Play Console

1. Go to https://play.google.com/console and open **Users and permissions** (left menu, account level,
   not inside the app).
2. Click **Invite new users** and paste the service account email from step 1.5.
3. Under **App permissions**, click **Add app**, pick **LoopBot**, and tick:
   - **Release apps to testing tracks**
   - **View app information and download bulk reports (read-only)**

   Leave everything else off. It never needs production or money permissions.
4. Click **Invite user**, then confirm. There is no email to accept; it is active right away.

Google can take up to a day to apply new permissions. If the first upload says "The caller does not
have permission", wait a few hours and run it again.

## 3. Add the secret on GitHub

1. Open the `.json` file from step 1.6 in Notepad (right-click > Open with > Notepad).
2. Press **Ctrl+A**, then **Ctrl+C** to copy all of it.
3. Go to https://github.com/kevsaj/LoopBot/settings/secrets/actions and click **New repository secret**.
4. Name: `PLAY_SERVICE_ACCOUNT_JSON`. Secret: paste with **Ctrl+V**. Click **Add secret**.
5. Delete the `.json` file from Downloads (and empty the Recycle Bin). GitHub keeps the only copy
   you need; if you ever lose it, make a new key in step 1.6 and delete the old one there.

## 4. Upload a build

1. GitHub > **Actions** > **Android release** > **Run workflow**.
2. **Upload to Google Play?**
   - **Closed testing**: your testers' track (the one with the "Join on the web" link).
   - **Internal testing**: only for the internal testers list, if you set one up.
   - **Don't upload (just build)**: same as before, the `.aab` and `.apk` only appear under Artifacts.
3. **Roll out to testers now** stays on `completed`. Pick `draft` to look it over in Play Console
   first and press "Roll out" there yourself.
4. **What's new** is optional and shows to testers on the Play page.
5. Leave the Plus boxes unticked for tester builds, as before.

The run summary says which version code went up. Testers get it after Google's check, usually
a few hours; Play Console > **Publishing overview** shows the status.

### Version codes

Every run gets a higher version code automatically: version 1.0.0 on run 6 is `10000006`, run 7 is
`10000007`, and so on. Bump `version` in `package.json` (for example to 1.0.1) only when you want a
new version name for players; the code keeps climbing either way.

### If an upload fails

- **"Package not found: com.kisstudios.loopbot"** or **"The caller does not have permission"**:
  the Play Console invite in step 2 is missing LoopBot or the permissions are still applying.
- **"Only releases with status draft may be created on draft app"**: run again with `draft`.
- **"Version code ... has already been used"**: someone uploaded a higher code by hand. Run the
  workflow again; each run's code is higher than the last.
- The `.aab` is still saved under the run's Artifacts, so you can always upload it by hand.
