/**
 * 02_auth_flow.ts — Login and Protected Routes
 * =============================================
 * The standard JWT auth flow:
 *   1. POST /auth/login — validate credentials, mint a signed JWT, return it.
 *   2. Client stores the token and sends it as `Authorization: Bearer <token>`.
 *   3. Protected routes verify the signature + expiry and trust the claims —
 *      no DB lookup per request. That's what makes JWTs "stateless".
 *
 *   401 Unauthorized → missing / expired / invalid token
 *   403 Forbidden    → valid token but not allowed (see 03_rbac.ts)
 *
 * Authentication is an Express middleware that verifies the Bearer token and
 * attaches `req.user`.
 *
 * Run:  npx tsx 02_auth_flow.ts
 * Test: curl -sX POST localhost:8000/auth/login -H 'Content-Type: application/json' \
 *         -d '{"username":"alice","password":"secret"}'
 *       curl localhost:8000/me -H 'Authorization: Bearer <token>'
 */

import { fileURLToPath } from "node:url";

import express from "express";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

type Role = "admin" | "viewer";

// What authenticate() puts on the request after verifying the token.
interface TokenUser {
  sub: string;
  role: Role;
}

// authenticate() hangs `user` on the request. Express does not know about that,
// so the extra field is declared on a local interface rather than by augmenting
// Express's Request globally.
interface AuthedRequest extends Request {
  user?: TokenUser;
}

// Reads what authenticate() stored. A route that forgot the middleware fails
// loudly here instead of reading undefined.
function currentUser(req: Request): TokenUser {
  const user = (req as AuthedRequest).user;
  if (!user) throw new Error("Route is missing the authenticate middleware");
  return user;
}

const app = express();
app.use(express.json());

const SECRET = "dev-secret-key-minimum-32-bytes!!"; // use crypto.randomBytes in prod
const TOKEN_TTL = "1h";

// In a real app this is a DB with hashed passwords (bcrypt/argon2).
interface Account {
  password: string;
  role: Role;
}

// Record<string, Account> is what lets USERS be looked up by an arbitrary
// username from the request body. The lookup can miss, so the result is checked.
const USERS: Record<string, Account> = {
  alice: { password: "secret", role: "admin" },
  bob: { password: "hunter2", role: "viewer" },
};

const createToken = (username: string, role: Role): string =>
  jwt.sign({ sub: username, role }, SECRET, { expiresIn: TOKEN_TTL });

// Middleware: extract + verify the Bearer token, attach req.user.
function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ detail: "Missing bearer token" });
    return;
  }
  try {
    // jwt.verify returns string | JwtPayload, and a bare string payload carries
    // no claims, so the useful shape has to be asserted after the check.
    const payload = jwt.verify(token, SECRET);
    if (typeof payload === "string") {
      res.status(401).json({ detail: "Invalid token" });
      return;
    }
    (req as AuthedRequest).user = { sub: String(payload.sub), role: payload.role as Role };
    next();
  } catch (err) {
    // A caught value is `unknown`, so the error class is checked rather than
    // reading .name off it directly.
    const detail = err instanceof jwt.TokenExpiredError ? "Token expired" : "Invalid token";
    res.status(401).json({ detail });
  }
}

app.post("/auth/login", (req, res) => {
  // The body is unvalidated here, so it is read as optional fields.
  const { username, password } = req.body as { username?: string; password?: string };
  const user = username ? USERS[username] : undefined;
  if (!username || !user || user.password !== password) {
    return res.status(401).json({ detail: "Invalid credentials" });
  }
  return res.json({ access_token: createToken(username, user.role), token_type: "bearer" });
});

app.get("/me", authenticate, (req, res) => {
  const user = currentUser(req);
  res.json({ username: user.sub, role: user.role });
});

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(8000, () => console.log("auth-flow on http://localhost:8000"));
}

export { app, authenticate, createToken };
