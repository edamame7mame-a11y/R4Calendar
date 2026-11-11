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
  return next();
}
