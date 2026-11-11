# Local-only Firestore backup restore test

This tool tests whether a R4Calendar JSON export can be restored and read back. It is deliberately restricted to a **local Firestore Emulator**. It does not deploy rules, contact a hosted Firebase project, or upload the backup to GitHub.

## Safety boundaries

- The script accepts only an export whose `projectId` is `r4calendar-1cb70`.
- The emulator target is fixed to `demo-r4calendar-restore`, never the production/new project.
- The emulator host must be `127.0.0.1` or `localhost`.
- Writes bypass Firestore Rules only inside the local emulator, using `@firebase/rules-unit-testing`'s `withSecurityRulesDisabled`.
- Do not commit the real backup JSON to GitHub or place it in this repository.
- This is a restore/read-back test, not a production import.

## Run it locally

From the `secure-site` directory, with Node.js and Java installed:

1. Install the repository's development dependencies:

   ```sh
   npm install
   ```

2. Put the backup JSON somewhere outside the repository. For example, on macOS/Linux:

   ```sh
   cp /path/to/R4Calendar_Firestore_Backup_2026-11-10T10-10-31-403Z.json "$HOME/R4Calendar-backup.json"
   ```

3. Run the restore test. Firebase CLI starts the emulator for this command and stops it afterward:

   ```sh
   npx firebase emulators:exec --only firestore --project demo-r4calendar-restore \
     "node tools/restore-backup-emulator.js \"$HOME/R4Calendar-backup.json\""
   ```

   On Windows PowerShell, use:

   ```powershell
   npx firebase emulators:exec --only firestore --project demo-r4calendar-restore "node tools/restore-backup-emulator.js \"$HOME\R4Calendar-backup.json\""
   ```

4. A successful run prints the collection count and the number of documents written and verified. It does not print document contents or image data.

## What this does not prove

- It does not test the browser UI, login flow, Cloudflare Pages middleware, or production Firestore rules.
- It does not import data into `r4calendar-2c6f8`.
- It does not include browser localStorage values (custom calendar labels/colors and plunder guide caches); those need separate export if they matter.
- A successful emulator test is not permission to deploy or cut over the live site.
