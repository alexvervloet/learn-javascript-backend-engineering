/**
 * OAuth2 Authorization Code Flow — the mechanics
 * ================================================
 * OAuth2 lets users grant your app access to their account on another service
 * (GitHub, Google) without sharing their password. Your app receives a token
 * scoped to what the user approved — never their credentials.
 *
 *   Browser → Your App → (302) GitHub authorize → user approves
 *   GitHub → (redirect ?code=&state=) → Your App
 *   Your App → POST /access_token (code + client_secret, server-to-server) → token
 *   Your App → GET /user (Authorization: token …) → profile → your own session
 *
 * Why a code, not the token directly? The code is short-lived + single-use, and
 * the token exchange needs the client_secret (server-only). The browser never
 * sees the token, so it can't leak via history or referrer headers.
 *
 * The `state` parameter is CSRF protection: a random value stored in the session
 * and echoed back by GitHub; a mismatch means a forged callback.
 *
 * Run:  npx tsx 01_concepts.ts   (no credentials needed — prints URLs + explains)
 */

import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// Step 1: build the authorization URL the browser is redirected to.
function buildGithubAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user user:email",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

// Step 2: parse the callback URL and validate the state.
function parseCallback(callbackUrl: string, expectedState: string): string | null {
  const url = new URL(callbackUrl);
  const receivedState = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (receivedState !== expectedState) {
    throw new Error(`State mismatch — possible CSRF attack!\n  expected: ${expectedState}\n  received: ${receivedState}`);
  }
  return code;
}

// Step 3: what the server-to-server token exchange looks like (not executed).
const formatTokenExchange = (
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): string => `POST https://github.com/login/oauth/access_token
Content-Type: application/json
Accept: application/json

${JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }, null, 2)}

Response:
{ "access_token": "ghu_16C7e42F…", "token_type": "bearer", "scope": "read:user,user:email" }`;

function main() {
  console.log("=== OAuth2 Authorization Code Flow — mechanics ===\n");

  const CLIENT_ID = "Ov23liABCDEF123456";
  const CLIENT_SECRET = "abc123…"; // kept SECRET on the server
  const REDIRECT_URI = "http://localhost:8000/auth/github/callback";

  const state = crypto.randomBytes(16).toString("base64url");
  console.log("1. Redirect the browser to:");
  console.log(`   ${buildGithubAuthUrl(CLIENT_ID, REDIRECT_URI, state)}\n`);
  console.log(`   Store state=${JSON.stringify(state)} in the user's session.\n`);

  const fakeCallback = `${REDIRECT_URI}?code=4f2e9a71bc44de&state=${state}`;
  console.log("2. GitHub calls back to:");
  console.log(`   ${fakeCallback}`);
  const code = parseCallback(fakeCallback, state);
  console.log(`   State matched. Extracted code=${JSON.stringify(code)}\n`);

  console.log("   What happens with a tampered state:");
  try {
    parseCallback(`${REDIRECT_URI}?code=evil&state=tampered`, state);
  } catch (err) {
    console.log(`   ✗ ${err instanceof Error ? err.message : String(err)}\n`);
  }

  console.log("3. Exchange code for an access token (server-to-server):");
  // parseCallback returns null when the URL carries no code, so the demo
  // substitutes a placeholder rather than printing "null".
  console.log(formatTokenExchange(CLIENT_ID, CLIENT_SECRET, code ?? "<no code>", REDIRECT_URI));

  console.log("\n4. Fetch the profile: GET https://api.github.com/user (Authorization: token …)");
  console.log("\n5. Create your own session (see 03_session.ts): upsert user, mint a JWT.");
}

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) main();

export { buildGithubAuthUrl, parseCallback };
