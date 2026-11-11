# Secure replacement implementation notes

This directory is a development-only scaffold. It is not deployed and must not be treated as production-ready.

## Separation model

- `member`: shared member password; can access only member-area records.
- `general`: separate shared general password; can access only general-area records.
- `admin`: owner-only administration; can manage both shared passwords and settings.
- A shared password does not identify individual people. Everyone using the same password has the same permissions.

## Required server-side flow

1. Browser submits a password to a Cloudflare Pages Function.
2. Function verifies the password against a salted password hash stored as a Cloudflare secret (never in Git or browser JavaScript).
3. Function issues a short-lived, signed session cookie with HttpOnly, Secure, SameSite=Strict attributes.
4. Server-side authorization checks every data operation and area.
5. Firestore must reject unauthenticated requests and enforce role/area separation. A front-end-only password prompt is not security.

## Firebase decision

Use the newly created, separate Firebase project for the replacement. Do not connect this scaffold to the existing production project. Do not import the backup until the replacement's authentication, authorization, and restore tests pass.

The intended Tokyo Firestore location is appropriate for a Japan-based group. The Firestore database creation wizard has been completed, but no data has been imported.

## Data boundaries (proposed)

- Member-only: calendar events/settings, lottery history/settings, memos/images, plunder records, plunder guide templates.
- General-only: separate collections and documents, to be decided before implementation.
- Admin-only: password hashes, session signing material, audit/configuration records.

The exact collection names and document ownership rules must be finalized before writing permissive rules. Default deny is intentional until then.

## Release gates

- Keep `main` and the current GitHub Pages site unchanged during development.
- Never deploy the current unprotected HTML as the new private site.
- Never put passwords, hashes, service-account keys, private keys, or tokens in Git.
- Test member/general cross-access denial, admin-only password changes, session expiry, logout, and direct URL access.
- Test image restoration from the supplied JSON backup before declaring migration complete.
- Only switch users after a successful test restore and authorization review.
