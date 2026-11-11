import { describe, it, expect } from "vitest";
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

  it("does not intercept public paths", async () => {
    const { response, continued } = await run("/login.html", null);
    expect(response.status).toBe(200);
    expect(continued).toBe(true);
  });
});
