import { describe, it, expect, vi } from "vitest";
import { createSessionCookie } from "../functions/_shared/session.js";
import { onRequest } from "../functions/_middleware.js";

const env = { SESSION_SIGNING_SECRET: "test-only-secret-with-at-least-32-characters" };

async function requestFor(path, role) {
  const headers = new Headers();
  if (role) {
    const cookie = await createSessionCookie(role, env);
    headers.set("Cookie", cookie.split(";")[0]);
  }
  return new Request("https://calendar.example" + path, { headers });
}

async function run(path, role) {
  let continued = false;
  const response = await onRequest({
    request: await requestFor(path, role),
    env,
    next: async () => {
      continued = true;
      return new Response("protected content", { status: 200 });
    }
  });
  return { response, continued };
}

describe("server-side protected route middleware", () => {
  it("redirects anonymous visitors away from every protected area", async () => {
    for (const path of ["/member/index.html", "/general/index.html", "/admin/index.html"]) {
      const { response, continued } = await run(path, null);
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("https://calendar.example/login.html");
      expect(continued).toBe(false);
    }
  });

  it("allows member sessions into member and general, but not admin", async () => {
    expect((await run("/member/index.html", "member")).response.status).toBe(200);
    expect((await run("/general/index.html", "member")).response.status).toBe(200);
    expect((await run("/admin/index.html", "member")).response.status).toBe(302);
  });

  it("allows general sessions only into general", async () => {
    expect((await run("/general/index.html", "general")).response.status).toBe(200);
    expect((await run("/member/index.html", "general")).response.status).toBe(302);
    expect((await run("/admin/index.html", "general")).response.status).toBe(302);
  });

  it("allows admin sessions into all areas", async () => {
    for (const path of ["/member/index.html", "/general/index.html", "/admin/index.html"]) {
      expect((await run(path, "admin")).response.status).toBe(200);
    }
  });

  it("marks protected responses as private and non-cacheable", async () => {
    const { response } = await run("/member/index.html", "member");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Pragma")).toBe("no-cache");
  });

  it("rejects a tampered session cookie", async () => {
    const valid = await createSessionCookie("member", env);
    const pair = valid.split(";")[0];
    const [name, value] = pair.split("=");
    const [payload, signature] = value.split(".");
    const changed = signature[0] === "A" ? "B" : "A";
    const request = new Request("https://calendar.example/member/index.html", {
      headers: { Cookie: name + "=" + payload + "." + changed + "; Path=/" }
    });
    const response = await onRequest({
      request, env,
      next: async () => new Response("protected content", { status: 200 })
    });
    expect(response.status).toBe(302);
  });

  it("rejects an expired session cookie", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-11T00:00:00Z"));
      const cookie = await createSessionCookie("member", env);
      vi.setSystemTime(new Date("2026-11-11T01:00:01Z"));
      const request = new Request("https://calendar.example/member/index.html", {
        headers: { Cookie: cookie.split(";")[0] }
      });
      const response = await onRequest({
        request, env,
        next: async () => new Response("protected content", { status: 200 })
      });
      expect(response.status).toBe(302);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sets a Secure, HttpOnly, SameSite=Strict host cookie", async () => {
    const cookie = await createSessionCookie("member", env);
    expect(cookie).toContain("__Host-r4_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=3600");
  });

  it("protects area roots and nested routes, not just index pages", async () => {
    expect((await run("/member/", null)).response.status).toBe(302);
    expect((await run("/general/settings/password.html", null)).response.status).toBe(302);
    expect((await run("/admin/config/", "general")).response.status).toBe(302);
    expect((await run("/admin/config/", "admin")).response.status).toBe(200);
  });

  it("does not intercept public paths", async () => {
    const { response, continued } = await run("/login.html", null);
    expect(response.status).toBe(200);
    expect(continued).toBe(true);
  });
});
