import { readSession } from "./_shared/session.js";

const ACCESS = {
  "/member": ["member", "admin"],
  "/general": ["member", "general", "admin"],
  "/admin": ["admin"]
};

function requiredRoles(pathname) {
  for (const [prefix, roles] of Object.entries(ACCESS)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return roles;
  }
  return null;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const roles = requiredRoles(url.pathname);

  if (roles) {
    const session = await readSession(request, env);
    if (!session || !roles.includes(session.role)) {
      const loginUrl = new URL("/login.html", url.origin);
      loginUrl.searchParams.set("next", url.pathname + url.search);
      return Response.redirect(loginUrl.toString(), 302);
    }
  }

  const response = await next();
  const headers = new Headers(response.headers);
  if (roles) {
    headers.set("Cache-Control", "no-store");
    headers.set("Pragma", "no-cache");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
