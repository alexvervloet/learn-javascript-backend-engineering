// Posts API — the app under test (Express + better-sqlite3 + Zod).
//
// Auth is a simplified X-User-Id header (a real app would use JWT — see jwt-rbac).
// The pattern being tested — auth middleware + ownership checks + Zod validation —
// is identical regardless of the mechanism.
//
// Status-code convention: a missing/unknown user is 401, and 422 is reserved for
// body validation failures.

import express from "express";
import type { Request, RequestHandler, Response, NextFunction } from "express";

import { db } from "./db.js";
import type { PostRow, UserRow } from "./db.js";
import { PostCreate, PostUpdate } from "./schemas.js";
import type { PostCreateInput, PostUpdateInput } from "./schemas.js";

// authenticate() and validate() hang extra state on the request. Express does
// not know about either, so they are declared on a local interface rather than
// by augmenting Express's Request globally.
interface AppRequest extends Request {
  user?: UserRow;
  validated?: unknown;
}

// Read back what the middleware stored. A route that forgot it fails loudly
// here instead of reading undefined.
function currentUser(req: Request): UserRow {
  const user = (req as AppRequest).user;
  if (!user) throw new Error("Route is missing the authenticate middleware");
  return user;
}

// The link between the schema a route validates with and the one a handler
// reads back is the thing the compiler cannot check, so it is asserted here,
// once, rather than at every handler.
function validatedBody<T>(req: Request): T {
  return (req as AppRequest).validated as T;
}

const app = express();
app.use(express.json());

const toDto = (p: PostRow) => ({
  id: p.id,
  user_id: p.user_id,
  title: p.title,
  body: p.body,
  published: Boolean(p.published),
  created_at: p.created_at,
});

// Auth middleware — resolve X-User-Id to a user, or 401.
function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers["x-user-id"];
  if (header === undefined) {
    res.status(401).json({ detail: "Missing X-User-Id header." });
    return;
  }
  const user = db
    .prepare<[number], UserRow>("SELECT * FROM users WHERE id = ?")
    .get(Number(header));
  if (!user) {
    res.status(401).json({ detail: "Unknown user." });
    return;
  }
  (req as AppRequest).user = user;
  next();
}

// Validate the body against a Zod schema, or 422.
const validate =
  (schema: typeof PostCreate | typeof PostUpdate): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      res.status(422).json({ detail: result.error.issues });
      return;
    }
    (req as AppRequest).validated = result.data;
    next();
  };

// GET /posts — published posts, optional author filter, newest first.
app.get("/posts", (req, res) => {
  // Express 5 types a query value as string | string[] | ParsedQs.
  const authorId = typeof req.query.author_id === "string" ? req.query.author_id : undefined;
  let rows: PostRow[];
  if (authorId !== undefined) {
    rows = db
      .prepare<[number], PostRow>(
        "SELECT * FROM posts WHERE published = 1 AND user_id = ? ORDER BY created_at DESC, id DESC"
      )
      .all(Number(authorId));
  } else {
    rows = db
      .prepare<[], PostRow>(
        "SELECT * FROM posts WHERE published = 1 ORDER BY created_at DESC, id DESC"
      )
      .all();
  }
  res.json(rows.map(toDto));
});

// GET /posts/:id
app.get("/posts/:id", (req, res) => {
  const post = db
    .prepare<[number], PostRow>("SELECT * FROM posts WHERE id = ?")
    .get(Number(req.params.id));
  if (!post) return res.status(404).json({ detail: "Post not found." });
  return res.json(toDto(post));
});

// POST /posts
app.post("/posts", authenticate, validate(PostCreate), (req, res) => {
  const input = validatedBody<PostCreateInput>(req);
  const { lastInsertRowid } = db
    .prepare("INSERT INTO posts (user_id, title, body, published) VALUES (?, ?, ?, 0)")
    .run(currentUser(req).id, input.title, input.body);
  const post = db
    .prepare<[number], PostRow>("SELECT * FROM posts WHERE id = ?")
    .get(Number(lastInsertRowid));
  // Inserted on this connection a line ago, so a miss is impossible.
  if (!post) throw new Error("Inserted post could not be read back");
  res.status(201).json(toDto(post));
});

// PATCH /posts/:id — owner-only partial update.
app.patch("/posts/:id", authenticate, validate(PostUpdate), (req, res) => {
  const post = db
    .prepare<[number], PostRow>("SELECT * FROM posts WHERE id = ?")
    .get(Number(req.params.id));
  if (!post) return res.status(404).json({ detail: "Post not found." });
  if (post.user_id !== currentUser(req).id) {
    return res.status(403).json({ detail: "Not your post." });
  }

  const input = validatedBody<PostUpdateInput>(req);
  // Apply only fields that were provided and non-null. Keying the bag by the
  // columns that may change means a typo is a compile error, not bad SQL.
  const fields: Partial<Record<"title" | "body" | "published", string | number>> = {};
  if (input.title != null) fields.title = input.title;
  if (input.body != null) fields.body = input.body;
  if (input.published != null) fields.published = input.published ? 1 : 0;

  const cols = Object.keys(fields) as (keyof typeof fields)[];
  if (cols.length) {
    db.prepare(`UPDATE posts SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).run(
      ...cols.map((c) => fields[c] ?? null),
      post.id
    );
  }
  const updated = db
    .prepare<[number], PostRow>("SELECT * FROM posts WHERE id = ?")
    .get(post.id);
  if (!updated) throw new Error("Post vanished mid-update");
  return res.json(toDto(updated));
});

// DELETE /posts/:id — owner-only.
app.delete("/posts/:id", authenticate, (req, res) => {
  const post = db
    .prepare<[number], PostRow>("SELECT * FROM posts WHERE id = ?")
    .get(Number(req.params.id));
  if (!post) return res.status(404).json({ detail: "Post not found." });
  if (post.user_id !== currentUser(req).id) {
    return res.status(403).json({ detail: "Not your post." });
  }
  db.prepare("DELETE FROM posts WHERE id = ?").run(post.id);
  return res.status(204).end();
});

export { app };
