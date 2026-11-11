const encoder = new TextEncoder();
const COOKIE_NAME = "__Host-r4_session";
const SESSION_SECONDS = 60 * 60;

function base64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function decodeBase64url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function getKey(secret) {
  if (!secret || secret.length < 32) throw new Error("Session signing secret must be at least 32 characters");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function createSessionCookie(role, env) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(encoder.encode(JSON.stringify({ role, iat: now, exp: now + SESSION_SECONDS })));
  const key = await getKey(env.SESSION_SIGNING_SECRET);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  const value = payload + "." + base64url(signature);
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}
export async function readSession(request, env) {
  const raw = request.headers.get("Cookie") || "";
  const pair = raw.split(";").map(x => x.trim()).find(x => x.startsWith(COOKIE_NAME + "="));
  if (!pair || !env.SESSION_SIGNING_SECRET) return null;
  const value = pair.slice(COOKIE_NAME.length + 1);
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  try {
    const key = await getKey(env.SESSION_SIGNING_SECRET);
    const signature = decodeBase64url(parts[1]);
    if (!await crypto.subtle.verify("HMAC", key, signature, encoder.encode(parts[0]))) return null;
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64url(parts[0])));
    const now = Math.floor(Date.now() / 1000);
    if (!["member", "general", "admin"].includes(payload.role) || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.exp <= now || payload.iat > now + 60 || payload.exp <= payload.iat || payload.exp - payload.iat > SESSION_SECONDS) return null;
    return payload;
  } catch { return null; }
}
export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
