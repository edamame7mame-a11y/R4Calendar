# Secure site shell

This folder is the isolated front-end staging area. It is not deployable yet.

- `login.html`: shared-password role selection and Firebase custom-token exchange.
- `firebase-config.js`: public Firebase web config placeholders. Fill only from the new project's registered Web app.
- `member/index.html`, `general/index.html`, `admin/index.html`: role-checked staging destinations only; existing application features are not integrated yet.

Do not deploy this folder until:
1. Firebase public config placeholders are replaced.
2. Login endpoint is tested with configured secrets and rate limiting.
3. All five existing application pages are ported to this folder and use the new Firebase project.
4. Every Firestore listener/write waits for authentication.
5. Firestore rules and direct API authorization tests pass.
6. Logout, session expiry, and owner-only password rotation are implemented and tested.
