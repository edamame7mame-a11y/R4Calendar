const encoder = new TextEncoder();
const AUDIENCE = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";

function base64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function utf8b64url(value) { return base64url(encoder.encode(value)); }
function hexToBytes(hex) {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error("Invalid hash configuration");
  return Uint8Array.from(hex.match(/.{2}/g), x => parseInt(x, 16));
}
async function verifyPassword(password, encoded, salt) {
  if (!encoded || !salt) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 310000 }, key, 256);
  const actual = new Uint8Array(bits);
  const expected = hexToBytes(encoded);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
function pemToArrayBuffer(pem) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(body);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return bytes.buffer;
}
async function mintCustomToken(uid, role, env) {
  const now = Math.floor(Date.now() / 1000);
  const header = utf8b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = utf8b64url(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    sub: env.FIREBASE_CLIENT_EMAIL,
    aud: AUDIENCE,
    iat: now,
    exp: now + 3600,
    uid,
    area: role
  }));
  const unsigned = header + "." + payload;
  const key = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(env.FIREBASE_PRIVATE_KEY), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned));
  return unsigned + "." + base64url(new Uint8Array(signature));
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (origin !== new URL(request.url).origin) return new Response("Forbidden", { status: 403 });
  if (!env.LOGIN_RATE_LIMITER || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    return new Response("Authentication service is not configured", { status: 503 });
  }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const limit = await env.LOGIN_RATE_LIMITER.limit({ key: ip });
  if (!limit.success) return new Response("Too many attempts. Try again later.", { status: 429 });

  let body;
  try { body = await request.json(); } catch { return new Response("Bad request", { status: 400 }); }
  if (typeof body.password !== "string" || body.password.length < 1 || body.password.length > 256) {
    return new Response("Invalid credentials", { status: 401 });
  }

  const roles = [
    ["member", env.MEMBER_PASSWORD_HASH, env.MEMBER_PASSWORD_SALT, "r4-member-shared"],
    ["general", env.GENERAL_PASSWORD_HASH, env.GENERAL_PASSWORD_SALT, "r4-general-shared"],
    ["admin", env.ADMIN_PASSWORD_HASH, env.ADMIN_PASSWORD_SALT, "r4-owner-admin"]
  ];
  for (const [role, hash, salt, uid] of roles) {
    if (await verifyPassword(body.password, hash, salt)) {
      const customToken = await mintCustomToken(uid, role, env);
      return Response.json({ customToken, role }, {
        headers: { "Cache-Control": "no-store", "Pragma": "no-cache" }
      });
    }
  }
  return new Response("Invalid credentials", { status: 401, headers: { "Cache-Control": "no-store" } });
}
