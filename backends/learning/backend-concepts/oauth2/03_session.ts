/**
 * OAuth2 → JWT Session Bridge
 * ==============================
 * OAuth2 tells you *who* the user is; it doesn't define how your app manages its
 * own sessions. The standard pattern: verify identity via OAuth2, find/create the
 * user in YOUR database, then issue YOUR OWN JWT — identical to a password login.
 *
 * Why bridge? The GitHub token is scoped to the GitHub API; you can't authenticate
 * requests to your API with it. After you mint your own JWT, GitHub is out of the
 * picture and every request uses your token like any other auth flow.
 *
 *   GET /login/github            redirect to GitHub
 *   GET /auth/github/callback    exchange code, upsert user, return a JWT
 *   GET /me, GET /protected      JWT-only (Authorization: Bearer <token>)
 *
 * Run:  npx tsx 03_session.ts   (same GitHub OAuth app + .env as 02_github.ts)
 */

import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

import express from "express";
import type { Request, Response, NextFunction } from "express";
import session from "express-session";
import jwt from "jsonwebtoken";

const app = express();
const SECRET_KEY = process.env.SECRET_KEY || "dev-secret";
app.use(session({ secret: SECRET_KEY, resave: false, saveUninitialized: true }));

const CLIENT_ID = process.env.GITHUB_CLIENT_ID || "your_client_id";
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "your_client_secret";
const REDIRECT_URI = "http://localhost:8000/auth/github/callback";
const TOKEN_TTL_SECONDS = 8 * 3600;

// Simulated user store, keyed by "github:{id}". Production: a real DB upsert.
// What GitHub's /user endpoint returns, as far as this demo cares.
// What GitHub's token endpoint returns. A fetch().json() is `unknown`, which is
// correct: nothing guarantees a remote service sends what you expect. These
// interfaces are the claim being made, kept next to the call that makes it.
interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

// The app's own user record, independent of the provider's shape.
interface AppUser {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string;
  provider: string;
}

// currentUser() hangs the loaded user on the request. Express does not know
// about that, so it is declared locally rather than augmenting Request globally.
interface AuthedRequest extends Request {
  user?: AppUser;
}

const users = new Map<string, AppUser>();

function upsertUser(gh: GitHubUser): AppUser {
  const key = `github:${gh.id}`;
  const existing = users.get(key);
  if (existing) return existing;
  const created: AppUser = {
    id: key,
    name: gh.name || gh.login,
    email: gh.email,
    avatar_url: gh.avatar_url,
    provider: "github",
  };
  users.set(key, created);
  return created;
}

const createToken = (user: AppUser): string =>
  jwt.sign({ sub: user.id, name: user.name }, SECRET_KEY, { algorithm: "HS256", expiresIn: TOKEN_TTL_SECONDS });

// Reusable auth middleware that loads the current user from the token.
function currentUser(req: Request, res: Response, next: NextFunction): void {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ detail: "Missing bearer token" });
    return;
  }
  let payload: jwt.JwtPayload | string;
  try {
    payload = jwt.verify(token, SECRET_KEY);
  } catch (err) {
    // A caught value is `unknown`, so the error class is checked rather than
    // reading .name off it directly.
    const detail = err instanceof jwt.TokenExpiredError ? "Token expired" : "Invalid token";
    res.status(401).json({ detail });
    return;
  }
  // A bare string payload carries no claims.
  if (typeof payload === "string" || !payload.sub) {
    res.status(401).json({ detail: "Invalid token" });
    return;
  }
  const user = users.get(payload.sub);
  if (!user) {
    res.status(401).json({ detail: "User not found" });
    return;
  }
  (req as AuthedRequest).user = user;
  next();
}

app.get("/login/github", (req, res) => {
  const state = crypto.randomBytes(16).toString("base64url");
  req.session.oauthState = state;
  const params = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, scope: "read:user user:email", state });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

app.get("/auth/github/callback", async (req, res) => {
  // Express 5 types a query value as string | string[] | ParsedQs.
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  if (!state || state !== req.session.oauthState) {
    return res.status(400).json({ detail: "state mismatch" });
  }
  delete req.session.oauthState;

  const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, redirect_uri: REDIRECT_URI }),
  });
  const { access_token: accessToken, error } =
    (await tokenResp.json()) as GitHubTokenResponse;
  if (error || !accessToken) return res.status(400).json({ detail: `OAuth error: ${error || "no token"}` });

  const userResp = await fetch("https://api.github.com/user", {
    headers: { Authorization: `token ${accessToken}`, "User-Agent": "oauth-demo" },
  });
  const gh = (await userResp.json()) as GitHubUser;

  // 1. Resolve the GitHub identity to your own user record.
  const user = upsertUser(gh);
  // 2. Issue your own JWT — GitHub is now out of the picture.
  return res.json({
    access_token: createToken(user),
    token_type: "bearer",
    expires_in: TOKEN_TTL_SECONDS,
    user,
    note: "Pass this token as: Authorization: Bearer <token>",
  });
});

// Reads what the currentUser middleware stored. A route that forgot the
// middleware fails loudly here instead of reading undefined.
function loadedUser(req: Request): AppUser {
  const user = (req as AuthedRequest).user;
  if (!user) throw new Error("Route is missing the currentUser middleware");
  return user;
}

app.get("/me", currentUser, (req, res) => res.json(loadedUser(req)));
app.get("/protected", currentUser, (req, res) => {
  const user = loadedUser(req);
  res.json({ message: `Hello ${user.name}, you have access.`, user_id: user.id });
});

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(8000, () => console.log("OAuth2 → JWT bridge on http://localhost:8000"));
}

export { app, upsertUser, createToken };
