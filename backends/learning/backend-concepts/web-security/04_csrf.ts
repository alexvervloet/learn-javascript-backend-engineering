/**
 * Cross-Site Request Forgery
 * ===========================
 * The browser attaches your cookies to a request based on where it is GOING,
 * not where it came FROM. So a form on evil.test that posts to your bank sends
 * the victim's bank session cookie with it, and the bank sees an authenticated
 * request the user never meant to make.
 *
 *   <form action="https://bank.example/transfer" method="POST">
 *     <input name="to" value="attacker"><input name="amount" value="10000">
 *   </form>
 *   <script>document.forms[0].submit()</script>
 *
 * Note what the attacker does NOT need: no access to the cookie, no XSS, no
 * ability to read the response. They only need the request to happen.
 *
 * Two defences, and you want both:
 *
 *   SameSite cookies   — the browser declines to send the cookie cross-site.
 *                        Default in every current browser, which is why CSRF is
 *                        much less common than it was. Not sufficient alone.
 *   A CSRF token       — a value the attacker cannot read or guess, required on
 *                        every state-changing request.
 *
 * Run:  npx tsx 04_csrf.ts
 */

import crypto from "node:crypto";
import http from "node:http";
import { fileURLToPath } from "node:url";

import cookieParser from "cookie-parser";
import express from "express";

const PORT = 8134;
const SECRET = crypto.randomBytes(32);

// ---------------------------------------------------------------------------
// Double-submit cookie
// ---------------------------------------------------------------------------
// The pattern: put a random token in a cookie the page's own JavaScript can
// read, and require the same token in a header or form field. An attacker on
// another origin can cause the cookie to be SENT but cannot READ it, so they
// cannot put its value in the header. The same-origin policy is doing the work.
//
// The token is signed so the server needs no per-session storage — a stateless
// check, which matters if you run more than one process (see ../node-runtime/05).
function issueToken(): string {
  const random = crypto.randomBytes(24).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(random).digest("base64url");
  return `${random}.${signature}`;
}

function tokenIsValid(token: string | undefined): boolean {
  if (!token) return false;
  const [random, signature] = token.split(".");
  if (!random || !signature) return false;
  const expected = crypto.createHmac("sha256", SECRET).update(random).digest("base64url");
  // timingSafeEqual, not ===. A byte-by-byte comparison that bails on the first
  // mismatch leaks how much of the value was right, which is enough to forge a
  // signature one byte at a time given enough attempts.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function csrfProtection(): express.RequestHandler {
  return (req, res, next) => {
    // Safe methods do not change state, so they do not need a token. This is
    // also why "GET /delete?id=1" is a bug: it puts a state change behind a
    // method every CSRF defence deliberately ignores.
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }
    const fromCookie = req.cookies?.csrf as string | undefined;
    const fromHeader = req.get("x-csrf-token");

    if (!tokenIsValid(fromCookie) || fromCookie !== fromHeader) {
      res.status(403).json({ error: "CSRF token missing or invalid" });
      return;
    }
    next();
  };
}

function buildApp(): express.Express {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());

  let balance = 1000;

  app.get("/login", (_req, res) => {
    res.cookie("session", "user-alice", {
      httpOnly: true, // JavaScript cannot read it — limits XSS damage
      sameSite: "lax", // not sent on cross-site POSTs; the first line of defence
      secure: false, // true in production; false here because this demo is http
    });
    // The CSRF token cookie is deliberately NOT httpOnly: the page's own
    // JavaScript has to read it to echo it back in the header.
    res.cookie("csrf", issueToken(), { httpOnly: false, sameSite: "lax" });
    res.json({ ok: true });
  });

  app.get("/balance", (_req, res) => res.json({ balance }));

  // Unprotected, for contrast.
  app.post("/transfer-unprotected", (req, res) => {
    const amount = Number((req.body as { amount?: number }).amount ?? 0);
    balance -= amount;
    res.json({ ok: true, balance });
  });

  // Protected.
  app.post("/transfer", csrfProtection(), (req, res) => {
    const amount = Number((req.body as { amount?: number }).amount ?? 0);
    balance -= amount;
    res.json({ ok: true, balance });
  });

  return app;
}

// ---------------------------------------------------------------------------
// Driving it
// ---------------------------------------------------------------------------
interface Response {
  status: number;
  body: unknown;
  cookies: string[];
}

function request(
  method: string,
  path: string,
  options: { cookie?: string; headers?: Record<string, string>; body?: unknown } = {}
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
    const req = http.request(
      {
        port: PORT,
        path,
        method,
        agent: false,
        headers: {
          ...(options.cookie ? { cookie: options.cookie } : {}),
          ...(payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {}),
          ...options.headers,
        },
      },
      (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            body: text ? JSON.parse(text) : null,
            cookies: (res.headers["set-cookie"] as string[] | undefined) ?? [],
          })
        );
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main(): Promise<void> {
  console.log("=== Cross-Site Request Forgery ===");
  const server = buildApp().listen(PORT);

  // Log in and keep the cookies, as a browser would.
  const login = await request("GET", "/login");
  const jar = login.cookies.map((c) => c.split(";")[0]).join("; ");
  const csrfToken = login.cookies
    .map((c) => c.split(";")[0] ?? "")
    .find((c) => c.startsWith("csrf="))
    ?.slice("csrf=".length);

  console.log(`\n  logged in; cookies held by the "browser": ${jar.split("; ").map((c) => c.split("=")[0]).join(", ")}`);
  console.log(`  starting balance: ${JSON.stringify((await request("GET", "/balance")).body)}`);

  console.log("\n--- The forged request, against an unprotected endpoint ---");
  // The attacker's page cannot read the cookies, but the browser sends them.
  // That is modelled here by passing the jar without the CSRF header.
  const forged = await request("POST", "/transfer-unprotected", { cookie: jar, body: { amount: 500 } });
  console.log(`  POST /transfer-unprotected with cookies, no CSRF header`);
  console.log(`  → ${forged.status} ${JSON.stringify(forged.body)}`);
  console.log(`  The session cookie was enough. 500 is gone.`);

  console.log("\n--- The same forged request, against the protected endpoint ---");
  const blocked = await request("POST", "/transfer", { cookie: jar, body: { amount: 500 } });
  console.log(`  POST /transfer with cookies, no CSRF header`);
  console.log(`  → ${blocked.status} ${JSON.stringify(blocked.body)}`);

  console.log("\n--- A guessed token ---");
  const guessed = await request("POST", "/transfer", {
    cookie: jar,
    headers: { "x-csrf-token": "made.up" },
    body: { amount: 500 },
  });
  console.log(`  → ${guessed.status} ${JSON.stringify(guessed.body)}  (signature does not verify)`);

  console.log("\n--- The real page, which can read its own cookie ---");
  const legit = await request("POST", "/transfer", {
    cookie: jar,
    headers: { "x-csrf-token": csrfToken ?? "" },
    body: { amount: 100 },
  });
  console.log(`  → ${legit.status} ${JSON.stringify(legit.body)}`);
  console.log(`  Same cookies as the forgery. The difference is the header, and`);
  console.log(`  only same-origin JavaScript could have filled it in.`);

  console.log("\n--- Notes ---");
  console.log(`
  SameSite is the first line, not the only one
      sameSite: "lax" already blocks the classic cross-site form POST, and it
      is the default in current browsers. Still add tokens: "lax" permits
      top-level GET navigations (so a state-changing GET is still exposed),
      older clients and non-browser agents do not honour it, and "none" is
      required for legitimate cross-site flows — at which point you are back to
      relying on the token alone.

  Token auth in a header is not vulnerable to this
      If your API takes Authorization: Bearer <jwt> and never reads a cookie,
      CSRF does not apply: the browser does not attach that header on its own.
      The moment you also accept a session cookie, it does apply again. The
      vulnerability is cookie-based auth, not sessions as such.

  Do not roll this yourself in production
      The pattern here is small enough to read in one sitting, which is why it
      is written out. In a real service use a maintained library — the old
      csurf package is deprecated and unmaintained; csrf-csrf implements this
      same double-submit approach. Either way, keep timingSafeEqual.

  Check the method table
      Any endpoint that changes state behind GET bypasses every defence on this
      page, because every one of them exempts safe methods. That is not a flaw
      in the defences; it is the REST contract being taken at its word.`);

  server.close();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main();
}

export { buildApp, issueToken, tokenIsValid, csrfProtection };
