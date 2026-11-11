# Feature-by-feature migration checklist

## Current migration progress (2026-11-11)

- [x] Copy the existing calendar UI and behavior into `secure-site/member/index.html` on the development branch.
- [x] Replace the old Firebase project configuration with the new project's shared client config import.
- [x] Gate calendar Firestore initialization behind Firebase Auth state and the `member` / `admin` role claim.
- [x] Add a server-session logout call and Firebase sign-out action to the calendar page.
- [x] Copy the existing shared lottery UI, presets, live state, spin animation, and history into `secure-site/member/kuji.html`.
- [x] Copy shared notes and image gallery UI, CRUD, search, compression, and live listeners into `secure-site/member/memo.html` behind member/admin authentication.
- [x] Copy plunder records, search/filter/sort, offender CRUD, nested incident CRUD, image handling, and guide link into `secure-site/member/plunder.html` behind member/admin authentication.
- [x] Copy the shared plunder response guide, general/chopper templates, live sync, local cache fallback, edit/save/copy actions into `secure-site/member/plunder_guide.html` behind member/admin authentication.
- [ ] Validate JavaScript syntax and run automated tests; no successful test result has been confirmed yet.
- [ ] Configure and test new-project Firestore rules; the deployed rules remain deny-all.
- [ ] Import or copy any calendar data; no documents have been imported.
- [ ] Export/import browser-local label and color settings from browsers that need to retain them.
- [ ] Test calendar CRUD, repeat events, labels, live sync, and rendering in a preview environment.

The calendar port is a development-only integration step. It is not yet a working replacement: Firestore is intentionally deny-all in the new project, and no preview deployment or data import has occurred.

Status: analysis only. The original five HTML files and the supplied Firestore export were inspected from branch `secure-site-build`. No old production files, old Firebase settings, or production data were changed.

## 1. Shared calendar — `index.html`

**Data**
- Firestore: `events`
- Firestore document: `calendar_settings/labels_v1`
- Browser-local settings: `r4_custom_labels_v11`, `r4_custom_colors_v1`

**Observed behavior**
- FullCalendar month-style calendar display.
- Live event and label-setting updates using Firestore listeners.
- Event create, edit, and delete.
- All-day and timed events.
- Repeat-event input and event description.
- Custom label/color settings.

**Migration requirements**
- Keep the current event document fields and IDs during first import.
- Preserve all-day/time/date behavior, repeat behavior, descriptions, and custom label/color UI.
- Export/import localStorage custom labels and colors separately; Firestore backup does not contain them.
- Verify that calendar listeners and all writes are blocked for general-only sessions by Firestore rules.

## 2. Lottery — `kuji.html`

**Data**
- Firestore: `kuji_history`
- Firestore documents: `kuji_settings/presets`, `kuji_settings/live_state`

**Observed behavior**
- Live shared lottery state and preset settings.
- Date chips, title chips, and name chips.
- Shuffle and spin animation.
- Save results to history.
- Render history and delete history entries.

**Migration requirements**
- Preserve preset and live-state document IDs and shapes.
- Verify two or more members see the same live state and result.
- Verify concurrent edits/draws do not silently overwrite one another; current `setDoc`-based behavior needs explicit concurrency testing.
- Preserve result history and deletion behavior.

## 3. Shared notes and image gallery — `memo.html`

**Port status**
- Copied to `secure-site/member/memo.html` on `secure-site-build` with Firebase Auth role gate (`member` / `admin`) before Firestore setup and a logout action. This is code migration only; no runtime test or data import has been completed.

**Data**
- Firestore: `memos`
- Firestore: `memo_images`

**Observed behavior**
- Notes list with create, edit, and delete.
- Image gallery with search.
- Client-side image compression before saving.
- Live Firestore listeners for notes and images.
- Image deletion.

**Migration requirements**
- Preserve note titles, content, created/updated timestamps.
- Validate the three exported image payloads as data URLs and render them on mobile and desktop.
- Test image upload size limits and error handling. Current exported image strings are each roughly 0.4–0.5 MB.
- Confirm gallery search and delete work after migration.

## 4. Plunder records — `plunder.html`

**Port status**
- Copied to `secure-site/member/plunder.html` on `secure-site-build` with Firebase Auth role gate (`member` / `admin`) before Firestore setup and a logout action. This is code migration only; no runtime test or data import has been completed.

**Data**
- Firestore: `plunders`

**Observed behavior**
- Search, filters, and sorting for offender records.
- Offender create, edit, and delete.
- Image selection, preview, and compression.
- Incident add/edit/delete within an offender record.

**Migration requirements**
- Preserve nested incident structure and all current record fields.
- Test search/filter/sort combinations.
- Test multiple images, image compression, preview, and deletion.
- Test nested incident updates carefully so one incident edit cannot remove another.

## 5. Plunder response guide — `plunder_guide.html`

**Port status**
- Copied to `secure-site/member/plunder_guide.html` on `secure-site-build` with Firebase Auth role gate (`member` / `admin`) before Firestore setup and a logout action. This is code migration only; no runtime test or data import has been completed.

**Data**
- Firestore: `plunder_templates/main`
- Browser-local cache: `plunder_tpl_general`, `plunder_tpl_chopper`

**Observed behavior**
- Shared editable guide/template text.
- Separate general and chopper template text.
- Copy-to-clipboard actions.
- Firestore live updates and localStorage cache.

**Migration requirements**
- Preserve both shared template texts and their editing/copy behavior.
- Audit/export localStorage values separately; browser-local cache is not in the Firestore export.
- Test that a change made by one member appears for another member.

## Security and rollout gates (must all pass before cutover)

- [ ] All five feature pages require member-area authentication.
- [ ] General-area routes accept member, general, and admin roles; member and admin can use both areas, while general-only remains isolated from member pages.
- [ ] Firestore rules enforce area claims on every collection; UI route guards alone are not security.
- [ ] Automated rules tests prove member can read/write both areas, general can read/write only general collections, and admin can read/write both areas.
- [ ] Admin-only settings cannot be read or changed by member/general accounts.
- [ ] Custom-token login endpoint, role claims, rate limiter, password rotation and logout/revocation are implemented and tested.
- [ ] Restore the 190-document backup into a disposable test target and compare counts and sample fields.
- [ ] Browser-local calendar and guide settings are exported from every browser whose values matter.
- [ ] All image payloads render and all CRUD operations pass on mobile and desktop.
- [ ] Owner explicitly approves final production import and cutover.
- [ ] Keep old site available only during controlled testing; before public cutover, address the old public GitHub Pages origin and old Firebase rules.

## Important boundary

The current general-area pages and data model have not been specified by the owner. This checklist does not invent general-area features. The proposed general collection names in `firestore.rules.candidate` remain placeholders, not a finalized schema.
