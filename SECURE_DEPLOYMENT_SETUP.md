# Secure authentication setup (not deployed)

This branch contains an initial server-side authentication implementation. It is not ready to deploy until every item below is completed and tested.

## Cloudflare Pages requirements

- Build output directory: `/` (static files at repository root).
- Production branch for the new Pages project: `secure-site-build`.
- Pages Functions directory: `functions`.
- Configure the following as Cloudflare secrets (never commit them):
  - `FIREBASE_CLIENT_EMAIL`: Firebase service-account client email.
  - `FIREBASE_PRIVATE_KEY`: service-account private key in PEM form.
  - `MEMBER_PASSWORD_SALT`, `MEMBER_PASSWORD_HASH`.
  - `GENERAL_PASSWORD_SALT`, `GENERAL_PASSWORD_HASH`.
  - `ADMIN_PASSWORD_SALT`, `ADMIN_PASSWORD_HASH`.
- Configure a Cloudflare Rate Limiting binding named `LOGIN_RATE_LIMITER` before enabling login. The function fails closed if it is absent.
- Password hashes are PBKDF2-HMAC-SHA256, 310,000 iterations, 32 bytes, stored as lowercase hex. Generate salts randomly and store salt/hash only as Cloudflare secrets.
- The Firebase service account must be scoped to the correct Firebase project and kept only in Cloudflare secrets.

## Firebase requirements

- Enable Firebase Authentication custom-token sign-in.
- Review `firestore.rules.draft`; test in Firebase Emulator Suite first.
- Do not publish these rules or replace live rules until member/general/admin/unauthenticated test cases all pass.
- The shared member credential receives the `area=member` claim; the general credential receives `area=general`; the owner credential receives `area=admin`.
- Admin can access both areas through the rules. Members and general users cannot cross-read or cross-write.
- The existing pages still need a coordinated client update to sign in with the returned custom token and wait for Firebase Auth restoration before attaching Firestore listeners. Do not switch users to this branch until that integration and CRUD tests are complete.

## Important

- No passwords, password hashes, service-account private keys, or other credentials belong in Git.
- Do not enable deployment until secrets, rate limiting, Firebase Auth, rules tests, and client integration are complete.
- The current GitHub Pages deployment and current Firebase rules/data have not been changed by this setup.
