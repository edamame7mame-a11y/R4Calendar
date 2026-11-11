export default {
  async fetch(request, env) {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/check") {
      return new Response("Not found", { status: 404 });
    }

    // This Worker is intended to be called only through the Pages service binding.
    const supplied = request.headers.get("X-R4-Guard-Secret") || "";
    const expected = env.GUARD_SHARED_SECRET || "";
    if (!expected || supplied.length !== expected.length) {
      return new Response("Forbidden", { status: 403 });
    }
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) {
      mismatch |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (mismatch !== 0) return new Response("Forbidden", { status: 403 });

    const ip = request.headers.get("X-R4-Client-IP") || "unknown";
    const result = await env.LOGIN_RATE_LIMITER.limit({ key: ip });
    return Response.json(
      { allowed: Boolean(result.success) },
      { status: result.success ? 200 : 429, headers: { "Cache-Control": "no-store" } }
    );
  }
};
