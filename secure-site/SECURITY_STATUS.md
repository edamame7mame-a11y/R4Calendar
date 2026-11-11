# Security implementation status

This branch is a development branch only. It is not approved for production deployment.

## Implemented scaffolding
- New Firebase project: `r4calendar-2c6f8`
- Login page sends the selected role and password to the server endpoint.
- Server-side password verification uses PBKDF2-HMAC-SHA256 (310,000 iterations).
- Server endpoint mints a Firebase custom token with an `area` claim.
- Placeholder member/general/admin pages check the Firebase claim for client-side display routing; Cloudflare middleware separately gates the page requests using the signed HttpOnly session cookie.
- Firestore rules are deny-all by default.

## New server-side route gate (prototype; not deployed or tested)
- Cloudflare Pages middleware gates requests under `/member/*`, `/general/*`, and `/admin/*`.
- Successful shared-password login issues a signed, HttpOnly, Secure, SameSite=Strict session cookie with a one-hour expiry.
- Role access: member/admin for member; member/general/admin for general; admin only for admin.
- Logout calls a same-origin endpoint that clears the server session cookie.
- Configure `SESSION_SIGNING_SECRET` as a Cloudflare secret. It must be randomly generated and at least 32 characters. Never put it in Git or chat.
- Automated middleware tests now cover anonymous access, each role's allowed/denied areas, nested paths, tampered cookies, secure cookie attributes, and cache headers. These tests are committed but have not yet been confirmed as passing in GitHub Actions or a Cloudflare preview.
- Firestore Security Rules remain a separate mandatory data-security boundary.

## Mandatory blockers before any deployment
1. **Do not deploy the current branch yet.** The login endpoint is a prototype and has not been integration-tested against Firebase.
2. Deploy and test the separate private `rate-limit-worker`, configure the Pages `LOGIN_GUARD` service binding and matching `LOGIN_GUARD_SHARED_SECRET`, and configure `SESSION_SIGNING_SECRET` (random, at least 32 characters). The rate-limit Worker owns `LOGIN_RATE_LIMITER`; Pages does not.
3. Add server-only secrets: `SESSION_SIGNING_SECRET`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, and PBKDF2 hash/salt pairs for each role:
   - `MEMBER_PASSWORD_HASH`, `MEMBER_PASSWORD_SALT`
   - `GENERAL_PASSWORD_HASH`, `GENERAL_PASSWORD_SALT`
   - `ADMIN_PASSWORD_HASH`, `ADMIN_PASSWORD_SALT`
4. Confirm the service account has only the minimum permissions needed to mint Firebase custom tokens. Never download or commit a service-account JSON key. Never paste the private key into chat.
5. Add server-side session/token revocation and a tested logout strategy. Current browser logout calls Firebase `signOut`; already-issued ID tokens can remain valid until expiry.
6. Implement owner-only password rotation. Cloudflare environment secrets cannot be changed by ordinary browser JavaScript. A secure management backend and persistent secret store (e.g. a narrowly scoped KV binding) must be implemented and tested before claiming password changes are available in the admin UI.
7. Replace the placeholder Firestore rules only after the token claims, collection ownership, and all read/write paths have been tested. Current `secure-site/firestore.rules` denies all access.
8. Migrate and validate all five existing page features and all 190 backup documents into the new project. Migrate browser-local settings separately. Do not import until rules and app behavior are verified.
9. Confirm direct access to every route, API, static asset, and Firestore document is denied without the correct role.
10. The old GitHub Pages site and old Firebase project remain separate. The old Firestore rules were previously observed to allow unauthenticated read/write. This has not been changed; old data therefore remains exposed until the owner explicitly secures that project.

## Preview acceptance test
- Follow `ROUTE_ACCESS_TEST_PLAN.md` to test direct URLs for all roles in a Cloudflare Preview environment. Do not use production deployment for initial verification.

## Safe operating procedure
- Keep the old site running during development, but do not treat it as private.
- Work only on `secure-site-build`; do not merge to `main` or change the old Firebase project without explicit approval.
- Never click Cloudflare "Save and Deploy" for the current prototype.
- Do not place passwords, hashes, service-account keys, or other secrets in GitHub files, browser JavaScript, screenshots, or chat.
- Only announce cutover after end-to-end tests pass and the owner approves it.

## Login rate-limit architecture (not yet deployed)
- `rate-limit-worker/` is a separate private Worker, with `workers_dev = false`; it exposes only an internal `/check` endpoint intended for the Pages service binding.
- The Pages login Function calls it through `env.LOGIN_GUARD` and fails closed if the binding, shared secret, or guard response is unavailable.
- The Worker checks the shared secret and then applies a per-IP Cloudflare rate limit (currently 5 requests per 60 seconds per Cloudflare location). Cloudflare documents these limits as approximate, not globally strict.
- Required Preview setup: deploy the guard Worker, set `GUARD_SHARED_SECRET` on that Worker, bind it in Pages as `LOGIN_GUARD`, and set the same random value as Pages secret `LOGIN_GUARD_SHARED_SECRET`. Never reuse the session-signing secret.
