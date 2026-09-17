/**
 * 01_jwt_basics.ts — What a JWT Actually Is
 * ==========================================
 * A JWT is three base64url-encoded JSON blobs joined with dots:
 *
 *     HEADER.PAYLOAD.SIGNATURE
 *     Header    → {"alg":"HS256","typ":"JWT"}
 *     Payload   → {"sub":"user_42","role":"admin","exp":...}
 *     Signature → HMAC-SHA256(base64url(header) + "." + base64url(payload), secret)
 *
 * The header and payload are encoded, NOT encrypted — anyone can read them; they
 * just can't forge the signature without the secret. Never put secrets in the
 * payload. Any byte change breaks the signature (integrity).
 *
 * Standard claims: sub (subject), iat (issued at), exp (expiry), jti (token id).
 *
 * One rule this file makes a point of: always pass `algorithms` to verify. The
 * server decides what it accepts, never the token. The last demo below forges an
 * `alg: "none"` token to show what that check is for.
 *
 * In Node the library is `jsonwebtoken`. Run:  npx tsx 01_jwt_basics.ts
 */

import { fileURLToPath } from "node:url";

import jwt from "jsonwebtoken";

const SECRET = "dev-secret-key-minimum-32-bytes!!"; // HS256 wants ≥32 bytes

// Always tell the verifier which algorithms you accept. Without this, the caller
// decides — the token's own `alg` header picks the verification algorithm, which
// is the "algorithm confusion" attack: sign with `alg: "none"` and there is
// nothing to check, or, where the server verifies RS256 with a public key, sign
// an HS256 token using that public key as the HMAC secret and the server accepts
// your forgery. jsonwebtoken v9 rejects `alg: "none"` on its own, but pinning the
// list is the habit that holds up when the library or the key type changes.
const VERIFY: jwt.VerifyOptions = { algorithms: ["HS256"] };

// Decode one base64url JWT part without verifying.
// The decoded parts are arbitrary JSON, so the return type is a record of
// unknowns rather than a lie about what a caller will find in there.
const decodePart = (b64: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as Record<string, unknown>;

// A caught value is `unknown` in TypeScript — anything can be thrown, not just
// an Error. This narrows it before reaching for .message.
const messageOf = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

function main(): void {
  // jsonwebtoken adds iat automatically and takes exp via expiresIn.
  const token = jwt.sign({ sub: "user_42", name: "Alex", role: "admin" }, SECRET, {
    algorithm: "HS256",
    expiresIn: "1h",
  });

  console.log("=== Encoded token ===");
  console.log(token);

  console.log("\n=== Decode the parts manually (no secret needed) ===");
  const parts = token.split(".");
  const headerB64 = parts[0] ?? "";
  const payloadB64 = parts[1] ?? "";
  const sigB64 = parts[2] ?? "";
  console.log(`  Header  : ${JSON.stringify(decodePart(headerB64))}`);
  console.log(`  Payload : ${JSON.stringify(decodePart(payloadB64))}`);
  console.log(`  Sig     : ${sigB64.slice(0, 20)}…  (can't forge this without the secret)`);

  console.log("\n=== Verify a valid token ===");
  console.log(`  OK: ${JSON.stringify(jwt.verify(token, SECRET, VERIFY))}`);

  console.log("\n=== Tampered payload (role changed to 'superadmin') ===");
  const evil = decodePart(payloadB64);
  evil.role = "superadmin";
  const evilB64 = Buffer.from(JSON.stringify(evil)).toString("base64url");
  try {
    jwt.verify(`${headerB64}.${evilB64}.${sigB64}`, SECRET, VERIFY);
    console.log("  Verified (should never happen)");
  } catch (err) {
    console.log(`  REJECTED — ${messageOf(err)}`);
  }

  console.log("\n=== Expired token ===");
  const expired = jwt.sign({ sub: "user_42" }, SECRET, { expiresIn: -10 });
  try {
    jwt.verify(expired, SECRET, VERIFY);
    console.log("  Verified (should never happen)");
  } catch (err) {
    console.log(`  REJECTED — ${messageOf(err)}`);
  }

  console.log("\n=== Valid token verified with the wrong secret ===");
  try {
    jwt.verify(token, "wrong-secret-key-minimum-32-bytes!!", VERIFY);
    console.log("  Verified (should never happen)");
  } catch (err) {
    console.log(`  REJECTED — ${messageOf(err)}`);
  }

  // Forge a token that claims no signature is needed. A verifier that trusts the
  // token's own `alg` header has nothing left to check, which is why the
  // accepted list belongs on the server, not in the token.
  console.log("\n=== alg: none forgery ===");
  const noneHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const noneBody = Buffer.from(JSON.stringify({ sub: "user_42", role: "superadmin" })).toString("base64url");
  const noneToken = `${noneHeader}.${noneBody}.`;
  console.log(`  Forged  : ${noneToken.slice(0, 48)}…  (empty signature)`);
  try {
    jwt.verify(noneToken, SECRET, VERIFY);
    console.log("  Verified (should never happen)");
  } catch (err) {
    console.log(`  REJECTED — ${messageOf(err)}`);
  }
}

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) main();

export { decodePart, SECRET };
