import { createSessionCookie, readSession, clearSessionCookie } from "../_shared/session.js";

const encoder = new TextEncoder();

const ROLE_CONFIG = {
  member: {
    saltEnv: "MEMBER_PASSWORD_SALT",
    hashEnv: "MEMBER_PASSWORD_HASH",
    uid: "shared-member"
  },
  general: {
    saltEnv: "GENERAL_PASSWORD_SALT",
    hashEnv: "GENERAL_PASSWORD_HASH",
    uid: "shared-general"
  },
  admin: {
    saltEnv: "ADMIN_PASSWORD_SALT",
    hashEnv: "ADMIN_PASSWORD_HASH",
    uid: "shared-admin"
  }
};

function hexToBytes(hex) {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error("Invalid hex value.");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifyPassword(password, saltHex, expectedHashHex) {
  const salt = hexToBytes(saltHex.trim());
  const expected = hexToBytes(expectedHashHex.trim());
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: 100000
    },
    keyMaterial,
    expected.length * 8
  );
  return timingSafeEqual(new Uint8Array(bits), expected);
}

function base64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToArrayBuffer(pem) {
  const body = String(pem)
    .replace(/\\r|\\n/g, "")
    .replace(/-----BEGIN [^-]+-----|-----END [^-]+-----/g, "")
    .replace(/[^A-Za-z0-9+/=]/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function mintCustomToken(uid, role, env) {
  const clientEmail = (env.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKeyPem = env.FIREBASE_PRIVATE_KEY || "";
  if (!clientEmail || !privateKeyPem) {
    throw new Error("Missing Firebase credentials.");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64url(
    encoder.encode(
      JSON.stringify({
        iss: clientEmail,
        sub: clientEmail,
        aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
        iat: now,
        exp: now + 3600,
        uid,
        claims: { area: role }
      })
    )
  );
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(signingInput))
  );
  return `${signingInput}.${base64url(sig)}`;
}

export async function onRequestPost({ request, env }) {
  const headers = { "Cache-Control": "no-store", "Pragma": "no-cache" };
  try {
    const body = await request.json().catch(() => null);
    const role = body && typeof body.role === "string" ? body.role : "";
    const password = body && typeof body.password === "string" ? body.password : "";
    const cfg = ROLE_CONFIG[role];
    if (!cfg || !password || password.length > 256) {
      return Response.json({ error: "Invalid credentials" }, { status: 401, headers });
    }
    const salt = env[cfg.saltEnv];
    const hash = env[cfg.hashEnv];
    if (!salt || !hash) {
      return Response.json({ error: "Server configuration error" }, { status: 503, headers });
    }
    const ok = await verifyPassword(password, salt, hash);
    if (!ok) {
      return Response.json({ error: "Invalid credentials" }, { status: 401, headers });
    }
    const [cookie, customToken] = await Promise.all([
      createSessionCookie(role, env),
      mintCustomToken(cfg.uid, role, env)
    ]);
    return Response.json(
      { ok: true, role, customToken },
      {
        headers: {
          ...headers,
          "Set-Cookie": cookie
        }
      }
    );
  } catch {
    return Response.json({ error: "Authentication service unavailable" }, { status: 503, headers });
  }
}

export async function onRequestGet({ request, env }) {
  const headers = { "Cache-Control": "no-store", "Pragma": "no-cache" };
  try {
    const s = await readSession(request, env);
    if (!s) {
      const ck = request.headers.get("Cookie") || "";
      if (ck.includes("__Host-r4_session=")) {
        headers["Set-Cookie"] = clearSessionCookie();
      }
      return Response.json({ authenticated: false }, { headers });
    }
    const u = new URL(request.url);
    if (u.searchParams.get("token") === "1") {
      const cfg = ROLE_CONFIG[s.role];
      const customToken = await mintCustomToken(cfg.uid, s.role, env);
      return Response.json({ authenticated: true, role: s.role, customToken }, { headers });
    }
    return Response.json({ authenticated: true, role: s.role }, { headers });
  } catch {
    return Response.json({ authenticated: false }, { status: 503, headers });
  }
}
