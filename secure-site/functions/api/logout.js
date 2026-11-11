import { clearSessionCookie } from "../_shared/session.js";

export async function onRequestPost({ request }) {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Set-Cookie": clearSessionCookie()
    }
  });
}
