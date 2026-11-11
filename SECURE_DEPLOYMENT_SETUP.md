# Secure authentication setup (not deployed)

Status: prototype only. This branch is not safe to deploy or use with real users yet.

## Current branch status

- Work is isolated on `secure-site-build`; the `main` branch and existing GitHub Pages site have not been changed.
- A separate Firebase project exists: `r4calendar-2c6f8`.
- The new Firestore database is empty and its current rules deny all access.
- The five HTML pages at the repository root still initialize the OLD Firebase project (`r4calendar-1cb70`). They must not be deployed from this branch as a "secure" site until they are moved/rewired to the new project and gated behind authentication.
- No secrets, passwords, hashes, or service-account private keys are stored in this repository.

## Login endpoint prototype

`secure-site/functions/api/login.js` currently:
- Requires an exact same-origin POST.
- Requires an explicitly selected role: `member`, `general`, or `admin`.
- Requires JSON content type and enforces a 2 KiB request-body limit even when `Content-Length` is absent.
- Checks a PBKDF2-HMAC-SHA256 password hash (310,000 iterations, 32-byte output) using a per-role random salt.
- Applies a Cloudflare Rate Limiting binding named `LOGIN_RATE_LIMITER`.
- Mints a Firebase custom token with `claims: { area: role }`.
- Returns no-store responses and generic credential errors.

This endpoint is not production-ready until tested in a Cloudflare Pages preview with real secrets and a working rate-limit binding. It does not yet provide session cookies, logout/session revocation, password rotation, or complete client-side login integration.

## Cloudflare Pages requirements (configure only after implementation review)

- Use a separate Pages project connected to this repository.
- Set the Pages **Root directory** to `secure-site` and the build output directory to `.` (static files in that folder). Do not use the repository root.
- The Pages Functions endpoint is located at `secure-site/functions/api/login.js`, matching that root directory.
- Do not deploy the current root pages as-is: they still point to the old Firebase project.
- Functions directory: `functions`.
- Configure the following as Cloudflare secrets (never commit them):
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY` (PEM; keep the private key only in Cloudflare Secrets)
  - `MEMBER_PASSWORD_HASH`, `MEMBER_PASSWORD_SALT`
  - `GENERAL_PASSWORD_HASH`, `GENERAL_PASSWORD_SALT`
  - `ADMIN_PASSWORD_HASH`, `ADMIN_PASSWORD_SALT`
- Configure a Cloudflare Rate Limiting binding named `LOGIN_RATE_LIMITER`. The endpoint fails closed if it is absent.
- Hashes must be generated locally with cryptographically random salts. Never send plaintext passwords or private keys in chat or store them in Git.

## Firebase requirements

- The web app public config must be copied into the secure site's client configuration. The Firebase web API key is a public client identifier, not an Admin credential.
- Create a dedicated service account only for custom-token signing. Store its email and private key only as Cloudflare secrets. Restrict its permissions and never commit/download-share the private key.
- Keep Firestore rules deny-all until custom-token sign-in and role claims are verified.
- The final rules must be tested with Firebase Emulator Suite and direct API attempts:
  - member can read/write member collections only;
  - general can read/write general collections only;
  - admin can read/write both areas and admin configuration;
  - unauthenticated users are denied everywhere.
- Firebase custom token claims are nested under `claims` in the custom-token JWT. After exchange, the `area` claim is available on the Firebase ID token and can be checked by Firestore Rules.

## Required work before deployment

- [ ] Add and test the login UI for all three roles.
- [ ] Integrate `signInWithCustomToken()` into all five pages and wait for auth state before any Firestore listener or write.
- [ ] Ensure all five pages use only the NEW Firebase project.
- [ ] Add logout and session cleanup.
- [ ] Decide and implement the owner-only password-change workflow. Cloudflare Worker secrets cannot simply be changed from browser JavaScript; any API-based rotation must use a tightly scoped Cloudflare API credential kept server-side, or be performed manually in the Cloudflare dashboard.
- [ ] Add general-area pages and define their data collections separately.
- [ ] Implement and test admin-only configuration access.
- [ ] Test cross-area reads/writes, unauthenticated access, direct REST/API access, rate limiting, token expiry, logout, and image/document validation.
- [ ] Import the 190-document backup only after rules and page integration pass.
- [ ] Verify collection counts, image rendering, and CRUD behavior against the backup.
- [ ] Confirm local-only calendar labels/colors are separately exported/imported; they are not included in the Firestore JSON backup.
- [ ] Only after all tests pass, configure the production domain and switch users.

## Existing site and data

The existing site and old Firebase project are intentionally left untouched during development. The old Firestore rules were previously found to allow unauthenticated read/write access; keeping the old site running is not the same as keeping its data private. Do not put new sensitive data in the old project. Before public cutover, plan how to close old database access without interrupting the migration.

