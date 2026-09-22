/**
 * Security Headers
 * =================
 * A handful of response headers that tell the browser to enforce rules your
 * server cannot enforce on its own. They are the cheapest security work
 * available: one middleware, no code changes, and they turn several classes of
 * bug from "exploitable" into "blocked".
 *
 * They are defence in depth, not a fix. A Content-Security-Policy does not
 * patch an XSS hole; it means the hole is harder to turn into stolen sessions.
 * Fix the hole too (see 03).
 *
 * This file starts two servers side by side — one bare, one with helmet — and
 * diffs their response headers, so you can see exactly what you get.
 *
 * Run:  npx tsx 01_security_headers.ts
 */

import http from "node:http";
import { fileURLToPath } from "node:url";

import express from "express";
import helmet from "helmet";

const BARE_PORT = 8131;
const SAFE_PORT = 8132;

// What each header actually does, and what it costs you.
const EXPLANATIONS: Record<string, string> = {
  "content-security-policy":
    "Which sources the page may load scripts/styles/images from. The big one:\n      it is what stops an injected <script> from running or phoning home.\n      Also the one most likely to break your app — see the note below.",
  "strict-transport-security":
    "Never speak plain HTTP to this host again, for max-age seconds. Kills\n      the downgrade attack where a first http:// request gets intercepted.\n      Only sent over HTTPS; browsers ignore it on http.",
  "x-content-type-options":
    "nosniff — stop guessing at content types. Without it a browser can decide\n      an uploaded .txt is really JavaScript and execute it.",
  "x-frame-options":
    "Refuse to be put in an <iframe>. Blocks clickjacking, where your page is\n      overlaid invisibly on someone else's and the user clicks your buttons.\n      (CSP frame-ancestors is the modern equivalent.)",
  "referrer-policy":
    "How much of the current URL to leak in the Referer header on the way out.\n      Matters when your URLs contain ids, tokens or search terms.",
  "cross-origin-opener-policy":
    "Break the window.opener link to other origins, so a page you open cannot\n      reach back into yours.",
  "cross-origin-resource-policy":
    "Who may embed this resource. Blunt protection against cross-origin leaks.",
  "origin-agent-cluster":
    "Ask the browser to isolate this origin in its own process where it can.",
  "x-dns-prefetch-control":
    "Stop the browser resolving hostnames it found in your page before the\n      user clicks. Privacy more than security.",
  "x-download-options":
    "Legacy IE: do not offer 'Open' on a download. Harmless to keep.",
  "x-permitted-cross-domain-policies":
    "Legacy Flash/Acrobat cross-domain policy files. Harmless to keep.",
  "x-xss-protection":
    "Set to 0 on purpose. The old browser XSS auditor it enables was itself\n      exploitable and every current browser has removed it. Helmet disables it\n      rather than leaving it to chance.",
};

function bareApp(): express.Express {
  const app = express();
  app.get("/", (_req, res) => res.json({ server: "no helmet" }));
  return app;
}

function safeApp(): express.Express {
  const app = express();

  // helmet() with no arguments is a sensible default set. Everything below is
  // the same defaults written out, so you can see what you are agreeing to.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"], // no 'unsafe-inline' — see the note in 03
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      // 180 days. Start lower while you confirm nothing on the domain needs
      // plain HTTP — this header is sticky and hard to walk back.
      strictTransportSecurity: { maxAge: 15552000, includeSubDomains: true },
      referrerPolicy: { policy: "no-referrer" },
    })
  );

  app.get("/", (_req, res) => res.json({ server: "helmet" }));
  return app;
}

function headersOf(port: number): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const req = http.get({ port, path: "/", agent: false }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.headers as Record<string, string>));
    });
    req.on("error", reject);
  });
}

async function main(): Promise<void> {
  console.log("=== Security Headers ===");

  const bare = bareApp().listen(BARE_PORT);
  const safe = safeApp().listen(SAFE_PORT);

  const [before, after] = await Promise.all([headersOf(BARE_PORT), headersOf(SAFE_PORT)]);

  console.log("\n--- What a bare Express app sends ---");
  for (const [key, value] of Object.entries(before)) {
    console.log(`  ${key}: ${value}`);
  }
  // Express advertises itself by default. Not a vulnerability on its own, but
  // it tells a scanner which CVE list to try first.
  console.log("\n  Note x-powered-by: Express. Free information for an attacker.");
  console.log("  app.disable('x-powered-by') removes it; helmet does it for you.");

  console.log("\n--- What helmet adds ---");
  const added = Object.keys(after).filter((k) => !(k in before));
  const removed = Object.keys(before).filter((k) => !(k in after));

  for (const key of added.sort()) {
    console.log(`\n  ${key}`);
    console.log(`      ${after[key]}`);
    const why = EXPLANATIONS[key];
    if (why) console.log(`      ${why}`);
  }
  if (removed.length > 0) {
    console.log(`\n  removed: ${removed.join(", ")}`);
  }

  console.log("\n--- The one that will break your app ---");
  console.log(`
  Content-Security-Policy is the header worth the most and the one that takes
  actual work. The default above forbids inline scripts, which means:

      <script>doThing()</script>        blocked
      <button onclick="doThing()">      blocked
      <script src="/app.js"></script>   allowed

  Inline handlers are exactly what an XSS payload uses, which is why blocking
  them is the point — and also why a CSP often breaks a working app on the day
  you add it.

  The way through is not 'unsafe-inline'. That re-allows precisely what you were
  trying to block and leaves you with a header that looks like security and is
  not. Instead:

    1. Deploy with Content-Security-Policy-Report-Only and a report endpoint.
       Nothing breaks; you collect a list of what would have broken.
    2. Fix those. Usually: move inline scripts to files, replace onclick with
       addEventListener.
    3. For genuinely dynamic scripts, use a per-request nonce and put the same
       nonce in the header and the tag.
    4. Then switch the header to enforcing.

  helmet takes a function for a directive value, which is how you wire a nonce:

      scriptSrc: ["'self'", (req, res) => \`'nonce-\${res.locals.nonce}'\`]
`);

  console.log("--- Checking your own deployment ---");
  console.log("  curl -sI https://your-app.example | grep -i -E 'content-security|strict-transport|x-frame'");
  console.log("  https://securityheaders.com grades a public URL against this list.");

  bare.close();
  safe.close();
  console.log("\nNext: 02_injection.ts");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main();
}

export { bareApp, safeApp };
