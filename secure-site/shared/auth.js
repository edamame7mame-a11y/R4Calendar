import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { firebaseConfig } from "../firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

/**
 * Protect a placeholder area page. This is a UI guard only; Firestore Rules
 * remain the actual data-security boundary.
 */
export function protectArea(expectedArea) {
  const state = document.getElementById("state");
  const logout = document.getElementById("logout");

  onAuthStateChanged(auth, async user => {
    if (!user) {
      location.replace("/login.html");
      return;
    }
    try {
      const token = await user.getIdTokenResult();
      if (token.claims.area !== expectedArea) {
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
      await signOut(auth);
    } finally {
      location.replace("/login.html");
    }
  });
}
