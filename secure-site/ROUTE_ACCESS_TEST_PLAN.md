# Protected route acceptance test plan

Status: test plan only. No Cloudflare Preview deployment or live access test has been performed.

## Expected access matrix

| Session | /member/ | /general/ | /admin/ |
|---|---|---|---|
| No session | redirect to /login.html | redirect to /login.html | redirect to /login.html |
| Member shared password | allow | allow | redirect |
| General shared password | redirect | allow | redirect |
| Admin shared password | allow | allow | allow |

## Preview test sequence

1. Deploy only to a Cloudflare Pages **Preview** environment after reviewing all secrets and bindings. Do not change the production domain or old GitHub Pages project.
2. Confirm the preview root directory is `secure-site` and build output directory is `.`.
3. Confirm Pages Functions are enabled and the middleware file is deployed at `functions/_middleware.js`.
4. Set Preview-only secrets: `SESSION_SIGNING_SECRET`, Firebase service-account email and private key, and the three role hash/salt pairs. Configure the `LOGIN_RATE_LIMITER` binding for Preview.
5. Open each protected URL in a private/incognito window before login. Each must redirect to `/login.html`.
6. Log in as each role in turn and paste the direct URLs for all three areas into the address bar. Compare with the matrix above.
7. Copy the authenticated URL into a separate browser profile with no cookie. It must redirect to login.
8. Log out, then revisit the same URL and use browser Back/Refresh. It must not show protected content.
9. Tamper with or expire a test session cookie. Protected routes must redirect to login.
10. Check response headers for protected content: `Cache-Control: private, no-store` and `Pragma: no-cache`.
11. Confirm Firebase custom-token exchange succeeds and the resulting ID token contains the expected `area` claim.
12. Separately test Firestore reads and writes for every role. Passing the page-route tests does not prove data access is protected.

## Stop conditions

- If any role reaches an area outside the matrix, stop and do not invite users.
- If the middleware does not run on Preview, stop and inspect Pages Functions/root-directory configuration.
- If login succeeds but Firebase custom-token exchange fails, stop; do not treat the route cookie alone as full app authentication.
- Do not import the 190-document backup or change the old Firebase rules during these tests.

## Important limitation

The signed cookie currently provides a one-hour route session. It is not centrally revocable before expiry, and logging out of Firebase does not itself revoke an already-issued Firebase ID token. A complete session-revocation design remains required before production use.
