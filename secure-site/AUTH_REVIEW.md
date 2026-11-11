# Authentication and area-isolation review

Review status: static code review only. No live login, Firebase token exchange, Cloudflare deployment, or Firestore Rules test has been performed.

## What the current prototype does

- The login page submits a selected area and shared password to `POST /api/login`.
- The Pages Function checks the request Origin, requires JSON, limits the request body, and uses a configured rate-limiter binding.
- Password verification is server-side PBKDF2-HMAC-SHA256 with 310,000 iterations.
- On a valid password, the function signs a Firebase custom token containing an `area` custom claim.
- The browser exchanges that custom token for a Firebase Auth session.
- The placeholder area pages check the claim for navigation/display only.

## Important security boundary

The route check in `shared/auth.js` is not the data security boundary. Firestore Security Rules must independently authorize every collection read and write using `request.auth.token.area`.

The candidate rules file is not deployed and is not yet tested. The production rules file remains deny-all. This is intentional.

## Static review findings and required work

1. **Custom token integration is unverified.** Test token minting, Firebase custom-token exchange, claim visibility in ID tokens, and expiry against the new Firebase project. Never assume a correctly-shaped JWT alone proves the full flow works.
2. **Service account key handling is critical.** Store the service-account email and PEM private key only as server-side Cloudflare secrets. Never commit the downloaded JSON or expose the private key in browser code, GitHub, screenshots, or chat. The signing identity must belong to the intended Firebase project.
3. **Rate limiting is a deployment dependency.** The `LOGIN_RATE_LIMITER` binding must exist and be tested under repeated failed attempts. Confirm its actual Cloudflare Pages support and configuration before enabling the endpoint.
4. **Shared password sessions are shared identities.** Each role currently maps to one fixed Firebase UID. This is expected for shared-password access, but it does not identify individual members or provide per-person audit history.
5. **Logout is not immediate token revocation.** Browser `signOut` clears that browser's Firebase session; already-issued ID tokens may remain valid until expiry. A tested revocation/short-session design is still needed if immediate invalidation is required.
6. **Password rotation is not implemented.** Updating Cloudflare secrets requires a secure owner-controlled process. Do not claim that the admin page can change passwords until that process exists and is tested.
7. **Do not trust a role value from the browser.** The server must continue to select the hash, salt and UID from its own fixed allowlist and mint the claim itself. The browser's selected role is only a request.
8. **Firestore rules need positive and negative tests.** Test member→member and member→general allowed; general→general allowed; general→member denied; admin access to both allowed; unauthenticated access denied; unknown collections denied.
9. **Rules and client paths must agree.** Before deploying candidate rules, enumerate every collection and document path used by the migrated app and ensure no collection is accidentally omitted or over-permitted.
10. **No production deployment yet.** Do not click Save and Deploy, import the backup, loosen deny-all rules, merge to `main`, or change the old Firebase project during this review.


11. **Static page URLs are not private.** The current Pages HTML files can be requested directly by URL; `noindex` and client-side route guards do not hide static assets. This is acceptable only if every protected data operation is enforced by Firestore Rules and every server endpoint checks the authenticated role. Do not place sensitive data in static HTML or JavaScript.
12. **The login page has not yet been exercised end-to-end.** The current browser flow calls `/api/login` and then `signInWithCustomToken()`, but no preview deployment, real credential test, token-claim inspection, or negative-role test has been performed.
13. **Shared-password endpoint hardening remains incomplete.** Confirm the rate-limiter binding's deployed behavior, password-hash generation format, and request throttling across repeated attempts. Consider applying limits per role as well as per IP without exposing which role/password pair is valid.
14. **No protected feature data is connected yet.** The current area pages are placeholders. Before migrating each feature, ensure auth state and claims are resolved before starting any Firestore listener or write, and test every query path against the final rules.

## Candidate rules scope

- Member role: existing calendar, lottery, memo/image, plunder, and plunder-template collections.
- General role: may access general-area collections only. Member role may also read/write general-area collections. Proposed general collection names remain placeholders until the owner defines the general area's features.
- Admin role: intended to administer both areas, with a separate admin-only namespace for non-secret settings.
- All unlisted collections: denied.

## Completion criteria

- [ ] Confirm Firebase custom token flow end-to-end.
- [ ] Confirm the service account is the intended project identity and key remains server-only.
- [ ] Configure and test rate limiting.
- [ ] Implement owner-only password rotation and a documented recovery path.
- [ ] Decide and test session duration/revocation behavior.
- [ ] Run automated Firestore Rules tests for every allowed and denied role/path combination.
- [ ] Verify all migrated application queries and writes against the rules.
- [ ] Obtain owner approval before any production import or deployment.
