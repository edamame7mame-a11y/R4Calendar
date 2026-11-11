import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { firebaseConfig } from "../firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// A member login is allowed into both the member and general areas.
// A general-only login stays isolated from member pages.
// Admin can enter either area; the admin console itself is admin-only.
const AREA_ROLES = {
  member: ["member", "admin"],
  general: ["member", "general", "admin"],
  admin: ["admin"]
};

/**
 * UI navigation guard only. Firestore Security Rules remain the real
 * data-security boundary and must independently enforce the same policy.
 */
export function protectArea(expectedArea) {
  const state = document.getElementById("state");
  const logout = document.getElementById("logout");
  const allowedRoles = AREA_ROLES[expectedArea] || [];

  onAuthStateChanged(auth, async user => {
    if (!user) {
      location.replace("/login.html");
      return;
    }
    try {
      const token = await user.getIdTokenResult();
      if (!allowedRoles.includes(token.claims.area)) {
        await signOut(auth);
        location.replace("/login.html");
        return;
      }
      state.textContent = "ログイン確認済み。機能を順次移行します。";
      logout.hidden = false;
    } catch {
      await signOut(auth);
      location.replace("/login.html");
    }
  });

  logout.addEventListener("click", async () => {
    logout.disabled = true;
    try {
      await fetch("/api/logout", { method: "POST", credentials: "same-origin", cache: "no-store" });
      await signOut(auth);
    } finally {
      location.replace("/login.html");
    }
  });
}
