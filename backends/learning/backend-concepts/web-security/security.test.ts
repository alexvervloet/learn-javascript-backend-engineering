// These assertions are the point of the module, so they run in CI rather than
// only printing to a terminal. A regression here is a security regression.

import { describe, test, expect } from "@jest/globals";
import request from "supertest";

import { findUserSafe, findUserUnsafe, seed } from "./02_injection.js";
import { escapeHtml, renderSafe } from "./03_xss.js";
import { buildApp, issueToken, tokenIsValid } from "./04_csrf.js";
import { safeApp, bareApp } from "./01_security_headers.js";

describe("security headers", () => {
  test("helmet sets the headers that matter", async () => {
    const res = await request(safeApp()).get("/");
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toContain("max-age=");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
  });

  test("the CSP does not allow inline scripts", async () => {
    // 'unsafe-inline' in script-src re-permits exactly what the CSP is for.
    const res = await request(safeApp()).get("/");
    expect(res.headers["content-security-policy"]).not.toContain("'unsafe-inline'");
  });

  test("helmet removes the x-powered-by giveaway", async () => {
    expect((await request(bareApp()).get("/")).headers["x-powered-by"]).toBe("Express");
    expect((await request(safeApp()).get("/")).headers["x-powered-by"]).toBeUndefined();
  });
});

describe("SQL injection", () => {
  const attacks = [
    "' OR '1'='1",
    "' OR is_admin = 1 --",
    "' UNION SELECT id, token, token, 0 FROM sessions --",
    "'; --",
  ];

  test.each(attacks)("the parameterised query treats %p as a plain value", (attack) => {
    const db = seed();
    try {
      expect(findUserSafe(db, attack)).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  test("the vulnerable query really is vulnerable", () => {
    // Asserted so the demo cannot quietly stop demonstrating anything.
    const db = seed();
    try {
      expect(findUserUnsafe(db, "' OR '1'='1").length).toBeGreaterThan(1);
      expect(findUserSafe(db, "alice")).toHaveLength(1);
    } finally {
      db.close();
    }
  });
});

describe("XSS escaping", () => {
  test.each([
    ["<script>alert(1)</script>", "<script>"],
    ['" onmouseover="alert(1)', '"'],
    ["<img src=x onerror=alert(1)>", "<img"],
    ["<svg onload=alert(1)>", "<svg"],
  ])("escapes %p", (payload, rawFragment) => {
    const output = renderSafe(payload);
    expect(output).not.toContain(rawFragment);
  });

  test("ampersand is escaped first, so nothing double-escapes", () => {
    // Getting the order wrong turns "&lt;" into "&amp;lt;" and shows users
    // escape sequences instead of the characters they typed.
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  test("leaves ordinary text alone", () => {
    expect(escapeHtml("O'Brien & Sons")).toBe("O&#39;Brien &amp; Sons");
    expect(escapeHtml("plain")).toBe("plain");
  });
});

describe("CSRF", () => {
  test("a freshly issued token verifies", () => {
    expect(tokenIsValid(issueToken())).toBe(true);
  });

  test.each([
    ["", "empty"],
    ["nonsense", "no signature"],
    ["abc.def", "bad signature"],
    ["abc.", "empty signature"],
  ])("rejects %p (%s)", (token) => {
    expect(tokenIsValid(token)).toBe(false);
  });

  test("a tampered payload no longer verifies", () => {
    const token = issueToken();
    const [random, signature] = token.split(".");
    expect(tokenIsValid(`${random}x.${signature}`)).toBe(false);
  });

  test("a state-changing POST with cookies but no token is refused", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await agent.get("/login").expect(200);

    // The agent holds the cookies, exactly as a browser would on a forged
    // cross-site request. What it does not do is send the header.
    await agent.post("/transfer").send({ amount: 500 }).expect(403);
  });

  test("the same request succeeds with the token echoed back", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    const login = await agent.get("/login").expect(200);

    const csrf = (login.headers["set-cookie"] as unknown as string[])
      .map((c) => c.split(";")[0] ?? "")
      .find((c) => c.startsWith("csrf="))
      ?.slice("csrf=".length);

    await agent
      .post("/transfer")
      .set("x-csrf-token", csrf ?? "")
      .send({ amount: 100 })
      .expect(200);
  });

  test("safe methods are exempt, state-changing ones are not", async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await agent.get("/login").expect(200);
    await agent.get("/balance").expect(200); // GET needs no token
    await agent.post("/transfer").send({ amount: 1 }).expect(403);
  });
});
