/**
 * 04_refresh_tokens.ts — Access + Refresh Token Pattern
 * ======================================================
 * A short-lived access token limits damage if stolen, but you don't want users
 * logging in every 15 minutes. So issue two tokens at login:
 *
 *   Access token  (15 min) → every API request, stateless
 *   Refresh token (7 days) → only to mint a new access token, stored server-side
 *
 * When the access token expires, the client POSTs the refresh token to
 * /auth/refresh for a new pair. The old refresh token is invalidated immediately
 * (rotation): if it was stolen, the next use reveals the theft. Storing refresh
 * tokens server-side (here a Map keyed by `jti`) lets you revoke them on logout,
 * password change, or suspicious activity.
 *
 * Run:  npx tsx 04_refresh_tokens.ts
 */

import { fileURLToPath } from "node:url";

import crypto from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

type Role = "admin" | "viewer";

// Both token kinds carry a `type` claim. Naming it is what makes the
// "expected an access token" check below a real check rather than a string
// comparison against an any.
interface TokenClaims extends jwt.JwtPayload {
  sub: string;
  type: "access" | "refresh";
  role?: Role;
  jti?: string;
}

interface AuthedRequest extends Request {
  user?: TokenClaims;
}

function currentUser(req: Request): TokenClaims {
  const user = (req as AuthedRequest).user;
  if (!user) throw new Error("Route is missing the authenticate middleware");
  return user;
}

// jwt.verify returns string | JwtPayload. A bare string payload has no claims,
// so this rejects it rather than pretending the claims are there.
function claimsOf(token: string): TokenClaims | null {
  const payload = jwt.verify(token, SECRET);
  if (typeof payload === "string") return null;
  return payload as TokenClaims;
}

// A caught value is `unknown` — anything can be thrown, not just an Error.
const isExpired = (err: unknown): boolean => err instanceof jwt.TokenExpiredError;

const app = express();
app.use(express.json());

const SECRET = "dev-secret-key-minimum-32-bytes!!";
const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";

interface Account {
  password: string;
  role: Role;
}

const USERS: Record<string, Account> = {
  alice: { password: "secret", role: "admin" },
  bob: { password: "hunter2", role: "viewer" },
};

// Production: Redis / a DB table of (jti, username, expiresAt). A Map keeps the demo dependency-free.
const activeRefreshTokens = new Map<string, string>(); // jti → username

const createAccessToken = (username: string, role: Role): string =>
  jwt.sign({ sub: username, role, type: "access" }, SECRET, { expiresIn: ACCESS_TTL });

function createRefreshToken(username: string): string {
  const jti = crypto.randomUUID();
  activeRefreshTokens.set(jti, username);
  return jwt.sign({ sub: username, jti, type: "refresh" }, SECRET, { expiresIn: REFRESH_TTL });
}

function authenticate(req: Request, res: Response, next: NextFunction): void {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ detail: "Missing bearer token" });
    return;
  }
  let payload: TokenClaims | null;
  try {
    payload = claimsOf(token);
  } catch (err) {
    const detail = isExpired(err) ? "Access token expired" : "Invalid token";
    res.status(401).json({ detail });
    return;
  }
  if (payload === null || payload.type !== "access") {
    res.status(401).json({ detail: "Expected an access token" });
    return;
  }
  (req as AuthedRequest).user = payload;
  next();
}

app.post("/auth/login", (req, res) => {
  // The body is unvalidated here, so it is read as optional fields.
  const { username, password } = req.body as { username?: string; password?: string };
  const user = username ? USERS[username] : undefined;
  if (!username || !user || user.password !== password) {
    return res.status(401).json({ detail: "Invalid credentials" });
  }
  return res.json({
    access_token: createAccessToken(username, user.role),
    refresh_token: createRefreshToken(username),
    token_type: "bearer",
  });
});

app.post("/auth/refresh", (req, res) => {
  const { refresh_token: refreshToken } = req.body as { refresh_token?: string };
  if (!refreshToken) return res.status(401).json({ detail: "Invalid refresh token" });
  let payload: TokenClaims | null;
  try {
    payload = claimsOf(refreshToken);
  } catch (err) {
    const detail = isExpired(err)
      ? "Refresh token expired — please log in again"
      : "Invalid refresh token";
    return res.status(401).json({ detail });
  }
  if (payload === null || payload.type !== "refresh" || !payload.jti) {
    return res.status(401).json({ detail: "Expected a refresh token" });
  }

  const username = activeRefreshTokens.get(payload.jti);
  if (!username) return res.status(401).json({ detail: "Refresh token has been revoked" });

  activeRefreshTokens.delete(payload.jti); // rotate: invalidate before reissuing
  const user = USERS[username];
  if (!user) return res.status(401).json({ detail: "Refresh token has been revoked" });
  return res.json({
    access_token: createAccessToken(username, user.role),
    refresh_token: createRefreshToken(username),
    token_type: "bearer",
  });
});

app.post("/auth/logout", (req, res) => {
  try {
    const { refresh_token: refreshToken } = req.body as { refresh_token?: string };
    const payload = refreshToken ? claimsOf(refreshToken) : null;
    if (payload?.jti) activeRefreshTokens.delete(payload.jti);
  } catch {
    // already invalid — treat as a successful logout
  }
  res.json({ status: "logged out" });
});

app.get("/me", authenticate, (req, res) => {
  const user = currentUser(req);
  res.json({ username: user.sub, role: user.role });
});

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(8000, () => console.log("refresh-tokens on http://localhost:8000"));
}

export { app, activeRefreshTokens };
