# Existing R4Calendar feature and data audit

Audited from the `secure-site-build` branch on 2026-11-10. This is a read-only audit; no application files or Firebase settings were changed.

## Current pages and Firestore use

| Page | Current Firestore collections/documents | Main behavior |
|---|---|---|
| `index.html` | `events`; `calendar_settings/labels_v1` | Shared calendar events, label/color settings |
| `kuji.html` | `kuji_history`; `kuji_settings/presets`; `kuji_settings/live_state` | Lottery history, presets, live/shared state |
| `memo.html` | `memos`; `memo_images` | Shared notes and image data |
| `plunder.html` | `plunders` | Shared plunder records |
| `plunder_guide.html` | `plunder_templates/main` | Shared guide/template data |

All five pages currently initialize Firebase Web SDK 10.9.0 in the browser and access Firestore directly.

## Important existing local browser state

- Calendar label/color customization also uses localStorage keys `r4_custom_labels_v11` and `r4_custom_colors_v1`.
- Plunder guide/template code has a localStorage cache.
- These browser-local values are not included in a Firestore export. They must be accounted for separately if users expect them to migrate between devices.

## Migration checklist

- [ ] Obtain and inspect the user's JSON export; validate document counts and image payloads.
- [ ] Decide whether to preserve current collection names or move to separate member/general namespaces.
- [ ] Add a trusted server-side password verifier and session mechanism.
- [ ] Issue Firebase custom auth tokens only from the trusted server after password verification.
- [ ] Add role/area claims and test Firestore rules with member, general, admin, and unauthenticated clients.
- [ ] Only after tests, change Firestore rules and import/migrate data.
- [ ] Test every page's create/read/update/delete behavior in the new deployment.
- [ ] Test that a member session cannot access general-only data and vice versa.
- [ ] Verify that old public GitHub Pages origin no longer exposes private data before announcing the new URL.

## Security notes

The current Firestore rules were observed in the Firebase console as `allow read, write: if true;`. That allows unauthenticated direct database access. A login screen or Cloudflare page gate alone does not fix this. Do not deploy a password UI as if it protects the data. The Firestore rules must be secured and tested before the new site is used for private data.

A single shared password for each area is a shared-secret access model, not individual accountability: all users sharing a password have the same permissions, and actions cannot reliably be attributed to a specific person. Use rate limiting, secure password hashing, HttpOnly/Secure/SameSite cookies, CSRF protection where needed, and server-held Firebase Admin credentials. Never put passwords, password hashes, service-account JSON, or signing secrets in browser code or Git.
