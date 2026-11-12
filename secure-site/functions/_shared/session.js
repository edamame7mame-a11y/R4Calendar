const COOKIE_NAME = "__Host-r4_session";
const SESSION_SECONDS = 400 * 24 * 60 * 60;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64url(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getKey(secret) {
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function getRoleHash(role, env) {
  if (role === "member") return env.MEMBER_PASSWORD_HASH || "";
  if (role === "general") return env.GENERAL_PASSWORD_HASH || "";
  if (role === "admin") return env.ADMIN_PASSWORD_HASH || "";
  return "";
}

async function getPasswordVersion(role, env) {
  const hash = getRoleHash(role, env).trim().toLowerCase();
  if (!hash) return "";
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(hash));
  return base64url(new Uint8Array(digest).slice(0, 8));
}

export async function createSessionCookie(role, env) {
  const now = Math.floor(Date.now() / 1000);
  const ver = await getPasswordVersion(role, env);
  const payload = base64url(
    encoder.encode(JSON.stringify({ role, ver, iat: now, exp: now + SESSION_SECONDS }))
  );
  const key = await getKey(env.SESSION_SECRET);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return `${COOKIE_NAME}=${payload}.${base64url(sig)}; Max-Age=${SESSION_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export async function readSession(request, env) {
  try {
    const cookieHeader = request.headers.get("Cookie") || "";
    const match = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE_NAME}=`));
    if (!match) return null;
    const token = match.slice(COOKIE_NAME.length + 1);
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadB64, sigB64] = parts;
    const key = await getKey(env.SESSION_SECRET);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64url(sigB64),
      encoder.encode(payloadB64)
    );
    if (!valid) return null;
    const payload = JSON.parse(decoder.decode(fromBase64url(payloadB64)));
    const now = Math.floor(Date.now() / 1000);
    if (
      !["member", "general", "admin"].includes(payload.role) ||
      !Number.isInteger(payload.iat) ||
      !Number.isInteger(payload.exp) ||
      payload.exp <= now ||
      payload.iat > now + 60 ||
      payload.exp <= payload.iat ||
      payload.exp - payload.iat > SESSION_SECONDS
    ) {
      return null;
    }
    const expectedVer = await getPasswordVersion(payload.role, env);
    if (!expectedVer || payload.ver !== expectedVer) return null;
    return payload;
  } catch {
    return null;
  }
}
