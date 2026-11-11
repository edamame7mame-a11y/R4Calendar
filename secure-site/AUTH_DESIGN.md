# Authentication and authorization design

Status: design only. No credentials are present. Do not deploy until implementation and tests are complete.

## Chosen approach

Use Firebase Authentication custom tokens minted only by a Cloudflare Pages Function. The browser never receives the service-account private key or shared-password hashes.

### Sign-in flow

1. The user selects Member, General, or Admin and submits the matching shared password over HTTPS.
2. A Cloudflare Pages Function compares the submitted password with a salted password hash held in Cloudflare environment secrets. Use a constant-time comparison where applicable and rate-limit failed attempts.
3. On success, the function creates a Firebase custom JWT using the service account key stored only as a Cloudflare secret. Include a minimal custom claim: `area: "member"`, `area: "general"`, or `area: "admin"`.
4. The browser exchanges the custom token with Firebase Authentication using the Firebase client SDK's `signInWithCustomToken`.
5. Firestore Security Rules inspect `request.auth.token.area` for every read and write.

## Authorization matrix

| Area | member claim | general claim | admin claim |
|---|---:|---:|---:|
| Member collections | read/write | deny | read/write |
| General collections | deny | read/write | read/write |
| Admin configuration | deny | deny | read/write |

Do not create general-area collections until their purpose and data shape are defined. The admin claim is only issued after checking the owner-only admin password.

## Cloudflare secrets / variables (names only)

Secrets to configure later in the Cloudflare Pages project:
- `MEMBER_PASSWORD_HASH`
- `GENERAL_PASSWORD_HASH`
- `ADMIN_PASSWORD_HASH`
- `FIREBASE_SERVICE_ACCOUNT_JSON`

Non-secret configuration:
- `FIREBASE_PROJECT_ID` (the new project's ID)
- `FIREBASE_WEB_API_KEY` (Firebase web API key; public client config, not an admin credential)

Never put actual values in GitHub, this document, chat, or browser source. Do not ask the owner to send passwords here.

## Password changes

Only an authenticated admin endpoint may replace a password hash. Require the current admin session, verify the new password twice in the UI, enforce a reasonable minimum length, and invalidate relevant sessions after a change. Never return stored hashes to the browser.

## Required protections

- HTTPS only.
- Rate limit login attempts by IP and account type; add increasing delays / temporary lockout.
- Do not reveal whether a password is wrong because the account type exists.
- Short-lived Firebase ID tokens; refresh only through Firebase Auth.
- Logout must call Firebase Auth sign-out and clear app state.
- Admin operations must re-check admin claims on the server and in Firestore Rules.
- Validate all input and cap image sizes.
- Log security events without logging passwords, tokens, or image contents.

## Important limitation of shared passwords

A shared password grants the same role to everyone who knows it. It cannot identify which individual member made a change. If per-person attribution is needed later, individual accounts will be required.

## Implementation / verification gates

- [ ] Create a Firebase web app in the new Firebase project and record its public config locally in Cloudflare Pages variables (not a private key).
- [ ] Create a dedicated service account for token signing; store its JSON only as a Cloudflare secret.
- [ ] Implement and review the token-signing Function.
- [ ] Implement login, logout, session refresh, and admin password-change endpoints.
- [ ] Implement deny-by-default Firestore rules using the claims above.
- [ ] Test member cannot read/write general data.
- [ ] Test general cannot read/write member data.
- [ ] Test neither shared role can access admin configuration or change passwords.
- [ ] Test admin can manage both areas and passwords.
- [ ] Test direct REST/API access is also denied without valid claims.
- [ ] Test rate limiting, expiry, logout, and image/document validation.
- [ ] Only then import the 190-document backup and verify counts and images.
- [ ] Only after successful tests, configure the production domain and switch users.
