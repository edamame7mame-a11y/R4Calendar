import { readSession } from "./_shared/session.js";

const ACCESS = {
  "/member": ["member", "admin"],
  "/general": ["member", "general", "admin"],
  "/admin": ["admin"]
};

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  const area = Object.keys(ACCESS).find(prefix => url.pathname === prefix || url.pathname.startsWith(prefix + "/"));
  if (!area) return next();

  const session = await readSession(request, env);
  if (!session || !ACCESS[area].includes(session.role)) {
    const target = new URL("/login.html", url.origin);
    return Response.redirect(target.toString(), 302);
  }
  const response = await next();
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Pragma", "no-cache");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
