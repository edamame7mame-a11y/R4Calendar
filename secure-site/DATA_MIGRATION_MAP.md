# Data migration map (candidate; no data imported)

This document maps the existing application collections to the proposed new site's access areas. It does not authorize a production import.

## Member area

| Existing collection/document | Count in 2026-11-10 export | Destination | Notes |
|---|---:|---|---|
| `events` | 167 | `events` | Keep document IDs and fields initially |
| `calendar_settings/labels_v1` | 1 | `calendar_settings/labels_v1` | Calendar label settings |
| `kuji_history` | 2 | `kuji_history` | Lottery history |
| `kuji_settings/presets` | 1 | `kuji_settings/presets` | Lottery presets |
| `kuji_settings/live_state` | 1 | `kuji_settings/live_state` | Shared live lottery state |
| `memos` | 5 | `memos` | Shared notes |
| `memo_images` | 3 | `memo_images` | Image data is large; validate size, MIME type, and rendering |
| `plunders` | 9 | `plunders` | Plunder records |
| `plunder_templates/main` | 1 | `plunder_templates/main` | Shared plunder guide/template |

The counts above total 190 documents across 8 collections. The export is a client-side JSON export and has not been restored into a test database.

## General area

No existing general-area data collection was identified in the current five pages or the inspected backup. Proposed names in `firestore.rules.candidate` are reserved placeholders only:
- `general_polls`
- `general_memos`
- `general_calendar`

Do not create these collections until their exact purpose and fields are defined with the owner.

## Admin area

Use a dedicated `admin_config` namespace only for non-secret application settings that truly need database persistence. Do not store passwords, password hashes, private keys, or service-account JSON in Firestore.

## Browser-local settings not present in Firestore export

- `r4_custom_labels_v11`
- `r4_custom_colors_v1`
- Plunder guide/template local cache (exact key and current contents must be audited separately)

These values are per-browser and are not included in the 190-document JSON export. Ask the owner to export them from any browser whose customizations must be retained before retiring the old site.

## Safe import order

1. Keep the new Firestore rules deny-all.
2. Build a local/emulator import script that preserves collection names, document IDs, field types, timestamps, and image data.
3. Import the JSON into a disposable test project or emulator first.
4. Compare exact document counts and sample field values with the source export.
5. Validate all three image data URLs and test rendering in the new memo UI.
6. Test member/general/admin access boundaries with authenticated test users.
7. Only after owner approval, import into the new production Firebase project.

## Backup integrity check (2026-11-11)

A read-only validation was run against the owner-provided 2026-11-10 JSON export in the working environment. No data was uploaded or imported.

- Top-level project ID matches the old project: `r4calendar-1cb70`.
- Export declares 190 documents across the eight collections listed above.
- All embedded image data URLs were Base64-decoded and opened with an image decoder: 34 images passed, 0 failed.
- Decoded image payload total: 2,321,364 bytes (about 2.21 MiB).
- This verifies that the embedded image bytes are readable image files. It does not prove that every image is displayed correctly in the migrated UI or that Firestore can accept every document under production limits.
- A full emulator restore and read-back comparison is still pending. No production import is authorized by this check.

