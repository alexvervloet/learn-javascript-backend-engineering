/**
 * 03_rbac.ts — Role-Based Access Control
 * ========================================
 * Authentication = "who are you?"; authorization = "what may you do?".
 * RBAC assigns users to roles, and each route requires a minimum role. Because
 * the role is a JWT claim, the server needs no DB lookup to enforce it.
 *
 *   viewer (0) → read    editor (1) → read+write    admin (2) → read+write+delete
 *
 * The key idea is a *middleware factory*: `requireRole("admin")` returns an
 * Express middleware that rejects anyone below that level.
 *
 *   401 → no/invalid/expired token    403 → valid token, role too low
 *
 * Run:  npx tsx 03_rbac.ts
 */

import { fileURLToPath } from "node:url";

import express from "express";
import type { Request, RequestHandler, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

type Role = "viewer" | "editor" | "admin";

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

const SECRET = "dev-secret-key-minimum-32-bytes!!";

interface Account {
  password: string;
  role: Role;
}

// Record<string, Account> is what lets USERS be looked up by an arbitrary
// username from the request body. The lookup can miss, so the result is checked.
const USERS: Record<string, Account> = {
  alice: { password: "secret", role: "admin" },
  bob: { password: "hunter2", role: "editor" },
  carol: { password: "pass", role: "viewer" },
};

const ROLE_LEVEL: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };

const createToken = (username: string, role: Role): string =>
  jwt.sign({ sub: username, role }, SECRET, { expiresIn: "1h" });

function authenticate(req: Request, res: Response, next: NextFunction): void {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
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

// Middleware factory enforcing a minimum role level.
function requireRole(minimum: Role): RequestHandler {
  return (req, res, next) => {
    const user = currentUser(req);
    const userLevel = ROLE_LEVEL[user.role] ?? -1;
    if (userLevel < ROLE_LEVEL[minimum]) {
      res.status(403).json({
        detail: `Requires '${minimum}' role or above. You have '${user.role}'.`,
      });
      return;
    }
    next();
  };
}

app.post("/auth/login", (req, res) => {
  // The body is unvalidated here, so it is read as optional fields.
  const { username, password } = req.body as { username?: string; password?: string };
  const user = username ? USERS[username] : undefined;
  if (!username) return res.status(401).json({ detail: "Invalid credentials" });
  if (!user || user.password !== password) return res.status(401).json({ detail: "Invalid credentials" });
  return res.json({ access_token: createToken(username, user.role), token_type: "bearer" });
});

app.get("/articles", authenticate, requireRole("viewer"), (req, res) => {
  res.json({ articles: ["Article 1", "Article 2"], read_by: currentUser(req).sub });
});

app.post("/articles", authenticate, requireRole("editor"), (req, res) => {
  res.json({ created: true, by: currentUser(req).sub });
});

app.delete("/articles/:id", authenticate, requireRole("admin"), (req, res) => {
  res.json({ deleted: Number(req.params.id), by: currentUser(req).sub });
});

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(8000, () => console.log("rbac on http://localhost:8000"));
}

export { app, requireRole };
