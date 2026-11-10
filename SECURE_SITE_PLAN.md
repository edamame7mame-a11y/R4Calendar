# Secure R4Calendar rebuild plan

## Safety boundary
- Keep the existing `main` branch and current GitHub Pages deployment unchanged.
- Do not change the current Firebase project data or Firestore rules during development.
- Build and test the replacement on `secure-site-build` and a separate Cloudflare Pages project.
- The existing JSON export is the migration source; verify its contents and counts before importing.

## Intended access model
- Member area: one shared member password; authorized members can edit member-area data.
- General area: a separate shared general password; authorized users can edit general-area data.
- Administrator: owner-only management of both passwords and access settings.
- Member and general data must be isolated in Firestore rules and in the application data model.

## Existing features to preserve
- Calendar events and label/color settings
- Lottery history, presets, and live state
- Shared memos and memo images
- Plunder records
- Plunder guide/templates

## Security architecture (to implement before migration)
- Serve the replacement through Cloudflare Pages with Pages Functions or a Worker handling authentication.
- Verify shared passwords on the server; never embed passwords or password hashes in browser code.
- Issue Firebase custom authentication tokens from a trusted server endpoint, with separate custom claims/UID roles for member and general access.
- Store server credentials only as Cloudflare secrets; never commit service-account keys or secrets.
- Replace permissive Firestore rules with rules that require authenticated users and enforce the appropriate area claim.
- Keep public/static information separate from either authenticated data area.
- Do not enable deployment or alter Firebase rules until the auth flow and rules are reviewed and tested.

## Deployment
- Cloudflare Pages production branch must be `secure-site-build` for the new project, or use a preview deployment until validated.
- Do not connect this new project to the existing production site.
- Verify that the old GitHub Pages origin cannot expose private pages/data before switching users.
