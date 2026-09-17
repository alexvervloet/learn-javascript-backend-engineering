/*
 * Web framework tutorial — Express (the 2026 JS way)
 * ==================================================
 * A single growing server that adds one HTTP concept at a time: routing, request
 * validation with Zod, file uploads, error handling, and a small DB layer.
 * Here we use better-sqlite3 for a zero-setup DB.
 *
 * Run:  npx tsx tutorial/server.ts   →  http://localhost:8000
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import cookieParser from "cookie-parser";
import express from "express";
import type { ErrorRequestHandler, Request, RequestHandler } from "express";
import multer from "multer";
import { z } from "zod";
import type { ZodType, infer as ZodInfer } from "zod";

// ESM has no __dirname. This is the equivalent, and it is what the SQLite
// file path below is built from.
const here = path.dirname(fileURLToPath(import.meta.url));

// The validate() middleware hangs the parsed body on the request. Express does
// not know about that, so the extra field is declared on a local interface
// rather than by augmenting Express globally.
interface TutorialRequest extends Request {
  data?: unknown;
}

// Reads back what validate() stored, typed by the schema. Pass the same schema
// to both — that link is the one thing the compiler cannot check for you.
function validated<T extends ZodType>(req: TutorialRequest, _schema: T): ZodInfer<T> {
  return req.data as ZodInfer<T>;
}

// Express 5 types a path or query param as string | string[], because a client
// can repeat a name. Every route below wants a single value.
function one(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // form bodies
app.use(cookieParser());
// CORS for a local frontend.
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "http://localhost:5173");
  res.set("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  return next();
});

const upload = multer({ storage: multer.memoryStorage() });

// ── Zod schemas (request validation) ───────────────────────────────────────
const Image = z.object({ url: z.string().url(), name: z.string() });
const Item = z.object({
  name: z.string(),
  description: z.string().nullish(),
  price: z.number(),
  tax: z.number().nullish(),
  images: z.array(Image).nullish(),
});
// Validate a body against a schema, returning 422 on failure.
const validate =
  (schema: ZodType): RequestHandler =>
  (req, res, next) => {
    const r = schema.safeParse(req.body);
    if (!r.success) {
      res.status(422).json({ detail: r.error.issues });
      return;
    }
    (req as TutorialRequest).data = r.data;
    next();
  };

const MODEL_NAMES: string[] = ["alexnet", "resnet", "lenet"];
const fakeItemsDb = [{ item_name: "Foo" }, { item_name: "Bar" }, { item_name: "Baz" }];

// ── Root: a tiny upload form (HTML response) ────────────────────────────────
app.get("/", (_req, res) => {
  res.type("html").send(`<body>
<form action="/files/uploadfile/" enctype="multipart/form-data" method="post">
  <input name="file" type="file"><input type="submit">
</form></body>`);
});

// ── Query validation (min/max length, pattern) ──────────────────────────────
//
// This has to be declared BEFORE /items/:item_id below. Express matches routes in
// declaration order and stops at the first hit, and "/items/limited/" fits the
// :item_id pattern perfectly well — item_id just comes out as the string
// "limited". With the order the other way round this handler never runs, and
// nothing warns you: the request succeeds, against the wrong route.
//
// The rule that avoids it: specific paths before parameterised ones.
app.get("/items/limited/", (req, res) => {
  const schema = z.object({
    q: z.string().min(3).max(50).regex(/^[a-zA-Z]+$/).optional(),
    "q-list": z.union([z.string(), z.array(z.string())]).optional(),
  });
  const r = schema.safeParse(req.query);
  if (!r.success) return res.status(422).json({ detail: r.error.issues });
  const results: Record<string, unknown> = {
    items: [{ item_id: "Foo" }, { item_id: "Bar" }],
  };
  if (r.data.q) results.q = r.data.q;
  const qList = r.data["q-list"];
  if (qList) results.q_list = Array.isArray(qList) ? qList : [qList];
  return res.json(results);
});

// ── Path + query parameters ─────────────────────────────────────────────────
app.get("/items/:item_id", (req, res) => {
  const itemId = one(req.params.item_id);
  const q = one(req.query.q);
  const short = one(req.query.short);
  if (q) return res.json({ item_id: itemId, q });
  return res.json({ item_id: itemId, short: short === "true" });
});

// Enum-style path param (fixed set of allowed values).
app.get("/models/:model_name", (req, res) => {
  const modelName = one(req.params.model_name);
  if (modelName === undefined || !MODEL_NAMES.includes(modelName)) {
    return res.status(422).json({ detail: `model_name must be one of ${MODEL_NAMES.join(", ")}` });
  }
  return res.json({ model_name: modelName });
});

// Query params with defaults (skip/limit pagination).
app.get("/items/", (req, res) => {
  const skip = Number(req.query.skip ?? 0);
  const limit = Number(req.query.limit ?? 10);
  res.json(fakeItemsDb.slice(skip, skip + limit));
});

// ── Request body (Zod-validated) ────────────────────────────────────────────
app.post("/items/", validate(Item), (req, res) => {
  const item = validated(req, Item);
  const out: Record<string, unknown> = { ...item };
  if (item.tax) out.total_price = item.price + item.tax;
  res.json(out);
});

app.put("/items/:item_id", validate(Item), (req, res) => {
  const result: Record<string, unknown> = {
    item_id: Number(one(req.params.item_id)),
    ...validated(req, Item),
  };
  const q = one(req.query.q);
  if (q) result.q = q;
  res.json(result);
});

// ── Path param numeric validation (ge/le) ───────────────────────────────────
app.get("/items/validated/:item_id", (req, res) => {
  const itemId = Number(one(req.params.item_id));
  if (!Number.isInteger(itemId) || itemId < 1 || itemId > 1000) {
    return res.status(422).json({ detail: "item_id must be an integer in [1, 1000]" });
  }
  const results: Record<string, unknown> = { item_id: itemId };
  const itemQuery = one(req.query["item-query"]);
  if (itemQuery) results.q = itemQuery;
  return res.json(results);
});

// ── Cookies & headers ───────────────────────────────────────────────────────
app.get("/cookies/", (req, res) => {
  // cookie-parser stores cookies as an untyped bag.
  const cookies = req.cookies as Record<string, string | undefined>;
  res.json({ ads_id: cookies.ads_id ?? null });
});
app.get("/headers/", (req, res) =>
  res.json({ "User-Agent": req.headers["user-agent"] ?? null, "x-token": req.headers["x-token"] ?? null })
);

// ── File uploads (multer) ───────────────────────────────────────────────────
app.post("/files/upload", upload.single("file"), (req, res) => res.json({ file_size: req.file?.buffer.length ?? 0 }));
app.post("/files/uploadfile/", upload.single("file"), (req, res) =>
  res.json({ filename: req.file?.originalname, content_type: req.file?.mimetype })
);
// Form field + file together.
app.post("/files/form-and-file", upload.single("fileb"), (req, res) =>
  res.json({
    token: (req.body as { token?: string }).token,
    fileb_content_type: req.file?.mimetype,
  })
);

// ── Error handling (status codes + a custom exception) ──────────────────────
app.get("/errors/not-found/:item_id", (req, res) =>
  res.status(404).json({ detail: `Item with id ${one(req.params.item_id)} not found` })
);
// Custom exception → 418, handled by the error middleware below.
class CustomException extends Error {
  value: number;

  constructor(value: number) {
    super("custom");
    this.value = value;
  }
}
app.get("/errors/bad-request", (req, _res) => {
  throw new CustomException(Number(one(req.query.value)));
});

// ── SQLite CRUD (better-sqlite3) ────────────────────────────────────────────
// A row of the hero table. better-sqlite3 cannot know what a SQL string
// returns, so the shape is declared once and passed to each prepare().
interface HeroRow {
  id: number;
  name: string;
  secret_name: string;
  age: number | null;
}

const db = new Database(path.join(here, "database.db"));
db.exec("CREATE TABLE IF NOT EXISTS hero (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, secret_name TEXT NOT NULL, age INTEGER)");
const HeroIn = z.object({ name: z.string(), secret_name: z.string(), age: z.number().int().nullish() });

app.post("/heroes/", validate(HeroIn), (req, res) => {
  const { name, secret_name: secretName, age = null } = validated(req, HeroIn);
  const info = db
    .prepare("INSERT INTO hero (name, secret_name, age) VALUES (?, ?, ?)")
    .run(name, secretName, age);
  res.json(
    db
      .prepare<[number], HeroRow>("SELECT * FROM hero WHERE id = ?")
      .get(Number(info.lastInsertRowid))
  );
});
app.get("/heroes/", (req, res) => {
  const offset = Number(req.query.offset ?? 0);
  const limit = Math.min(100, Number(req.query.limit ?? 100));
  res.json(
    db
      .prepare<[number, number], HeroRow>("SELECT * FROM hero ORDER BY id LIMIT ? OFFSET ?")
      .all(limit, offset)
  );
});
app.get("/heroes/:hero_id", (req, res) => {
  const hero = db
    .prepare<[number], HeroRow>("SELECT * FROM hero WHERE id = ?")
    .get(Number(one(req.params.hero_id)));
  if (!hero) return res.status(404).json({ detail: "Hero not found" });
  return res.json(hero);
});
app.patch("/heroes/:hero_id", (req, res) => {
  const hero = db
    .prepare<[number], HeroRow>("SELECT * FROM hero WHERE id = ?")
    .get(Number(one(req.params.hero_id)));
  if (!hero) return res.status(404).json({ detail: "Hero not found" });
  // Partial update: merge only the fields present in the request body. The body
  // is unvalidated here on purpose, so Partial<HeroRow> is a claim about it,
  // not a guarantee — which is exactly why the route above uses validate().
  const merged: HeroRow = { ...hero, ...(req.body as Partial<HeroRow>) };
  db.prepare("UPDATE hero SET name = ?, secret_name = ?, age = ? WHERE id = ?").run(
    merged.name,
    merged.secret_name,
    merged.age ?? null,
    hero.id
  );
  return res.json(
    db.prepare<[number], HeroRow>("SELECT * FROM hero WHERE id = ?").get(hero.id)
  );
});
app.delete("/heroes/:hero_id", (req, res) => {
  const info = db.prepare("DELETE FROM hero WHERE id = ?").run(Number(one(req.params.hero_id)));
  if (info.changes === 0) return res.status(404).json({ detail: "Hero not found" });
  return res.json({ ok: true });
});

// Error-handling middleware — catches the CustomException.
// eslint-disable-next-line no-unused-vars
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof CustomException) {
    res.status(418).json({
      message: `Oops! ${err.value} did something. There goes a rainbow...`,
    });
    return;
  }
  res.status(500).json({ detail: err instanceof Error ? err.message : String(err) });
};
app.use(errorHandler);

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(8000, () => console.log("tutorial app on http://localhost:8000"));
}

export { app };
