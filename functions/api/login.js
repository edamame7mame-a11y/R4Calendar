const encoder = new TextEncoder();
const AUDIENCE = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";

function jsonError(message, status) {
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store", "Pragma": "no-cache" }
  });
}
function base64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\//g, "_");
}
function utf8b64url(value) { return base64url(encoder.encode(value)); }
function hexToBytes(hex) {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error("Invalid hash configuration");
  return Uint8Array.from(hex.match(/.{2}/g), x => parseInt(x, 16));
}
async function verifyPassword(password, encoded, salt) {
  if (!encoded || !salt) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 310000
  }, key, 256);
  const actual = new Uint8Array(bits);
  const expected = hexToBytes(encoded);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
function pemToArrayBuffer(pem) {
  // Cloudflare secrets should contain the PEM with real line breaks.
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(body);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return bytes.buffer;
}
async function mintCustomToken(uid, role, env) {
  const now = Math.floor(Date.now() / 1000);
  const header = utf8b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  // Firebase's custom-token format nests extra claims under "claims".
  const payload = utf8b64url(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    sub: env.FIREBASE_CLIENT_EMAIL,
    aud: AUDIENCE,
    iat: now,
    exp: now + 3600,
    uid,
    claims: { area: role }
  }));
  const unsigned = header + "." + payload;
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToArrayBuffer(env.FIREBASE_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned));
  return unsigned + "." + base64url(new Uint8Array(signature));
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) return jsonError("Forbidden", 403);
  if (!env.LOGIN_RATE_LIMITER || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    return jsonError("Authentication service is not configured", 503);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const limit = await env.LOGIN_RATE_LIMITER.limit({ key: ip });
  if (!limit.success) return jsonError("Too many attempts. Try again later.", 429);

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 2048) return jsonError("Bad request", 400);

  let body;
  try { body = await request.json(); } catch { return jsonError("Bad request", 400); }
  if (!body || typeof body.password !== "string" || body.password.length < 1 || body.password.length > 256) {
    return jsonError("Invalid credentials", 401);
  }
  const role = body.role;
  const roleConfig = {
    member: [env.MEMBER_PASSWORD_HASH, env.MEMBER_PASSWORD_SALT, "r4-member-shared"],
    general: [env.GENERAL_PASSWORD_HASH, env.GENERAL_PASSWORD_SALT, "r4-general-shared"],
    admin: [env.ADMIN_PASSWORD_HASH, env.ADMIN_PASSWORD_SALT, "r4-owner-admin"]
  };
  if (!Object.prototype.hasOwnProperty.call(roleConfig, role)) return jsonError("Invalid credentials", 401);

  try {
    const [hash, salt, uid] = roleConfig[role];
    if (!await verifyPassword(body.password, hash, salt)) return jsonError("Invalid credentials", 401);
    const customToken = await mintCustomToken(uid, role, env);
    return Response.json({ customToken, role }, {
      headers: { "Cache-Control": "no-store", "Pragma": "no-cache" }
    });
  } catch {
    return jsonError("Authentication service error", 503);
  }
}
