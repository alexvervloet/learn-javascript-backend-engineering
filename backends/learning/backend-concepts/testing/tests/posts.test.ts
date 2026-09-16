/**
 * posts.test.ts — CRUD endpoint tests
 * =====================================
 * Happy paths for every route plus route-level error cases. Two verification
 * styles, both idiomatic for DB-backed API tests:
 *   1. Response assertions — status code + JSON body (proves the HTTP layer).
 *   2. DB state assertions — query the DB directly after a write to confirm it
 *      actually persisted (catches "returned 201 but forgot to commit" bugs).
 */

import { describe, test, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../app/main.js";
import { db, installIsolation, makeUser, makePost } from "./helpers.js";
import type { PostRow } from "../app/db.js";

installIsolation();

// Nullable on purpose: one test asserts a deleted post is gone, so the
// callers below reach for fields with ?.
const getPost = (id: number): PostRow | undefined =>
  db.prepare<[number], PostRow>("SELECT * FROM posts WHERE id = ?").get(id);

describe("GET /posts", () => {
  test("empty list", async () => {
    const res = await request(app).get("/posts");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("returns only published posts", async () => {
    const user = makeUser();
    makePost(user, { title: "Published", published: true });
    makePost(user, { title: "Draft", published: false });
    const titles = (await request(app).get("/posts")).body.map((p: PostRow) => p.title);
    expect(titles).toContain("Published");
    expect(titles).not.toContain("Draft");
  });

  test("filter by author", async () => {
    const alice = makeUser({ username: "alice" });
    const bob = makeUser({ username: "bob" });
    makePost(alice, { title: "Alice's post" });
    makePost(bob, { title: "Bob's post" });
    const res = await request(app).get(`/posts?author_id=${alice.id}`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("Alice's post");
  });

  test("returns newest first", async () => {
    const user = makeUser();
    makePost(user, { title: "First" });
    makePost(user, { title: "Second" });
    makePost(user, { title: "Third" });
    const titles = (await request(app).get("/posts")).body.map((p: PostRow) => p.title);
    expect(titles).toEqual(["Third", "Second", "First"]);
  });
});

describe("GET /posts/:id", () => {
  test("returns the post", async () => {
    const post = makePost(makeUser(), { title: "Hello" });
    const res = await request(app).get(`/posts/${post.id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Hello");
    expect(res.body.id).toBe(post.id);
  });

  test("404 for a missing post", async () => {
    expect((await request(app).get("/posts/99999")).status).toBe(404);
  });
});

describe("POST /posts", () => {
  test("creates a post (response + DB state)", async () => {
    const user = makeUser();
    const res = await request(app).post("/posts").set("X-User-Id", String(user.id)).send({ title: "New Post", body: "Some content." });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("New Post");
    expect(res.body.user_id).toBe(user.id);
    expect(res.body.published).toBe(false); // default

    const post = getPost(res.body.id);
    expect(post).toBeDefined();
    expect(post?.title).toBe("New Post");
    expect(post?.user_id).toBe(user.id);
  });

  test("post belongs to the authenticated user", async () => {
    const alice = makeUser({ username: "alice" });
    const bob = makeUser({ username: "bob" });
    const res = await request(app).post("/posts").set("X-User-Id", String(alice.id)).send({ title: "Alice's", body: "..." });
    const post = getPost(res.body.id);
    expect(post?.user_id).toBe(alice.id);
    expect(post?.user_id).not.toBe(bob.id);
  });
});

describe("PATCH /posts/:id", () => {
  test("updates the title (response + DB state)", async () => {
    const user = makeUser();
    const post = makePost(user, { title: "Old title" });
    const res = await request(app).patch(`/posts/${post.id}`).set("X-User-Id", String(user.id)).send({ title: "New title" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("New title");
    expect(getPost(post.id)?.title).toBe("New title");
  });

  test("updates the published flag", async () => {
    const user = makeUser();
    const post = makePost(user, { published: false });
    await request(app).patch(`/posts/${post.id}`).set("X-User-Id", String(user.id)).send({ published: true });
    expect(Boolean(getPost(post.id)?.published)).toBe(true);
  });

  test("partial update leaves other fields intact", async () => {
    const user = makeUser();
    const post = makePost(user, { title: "Keep me", body: "Keep this too." });
    await request(app).patch(`/posts/${post.id}`).set("X-User-Id", String(user.id)).send({ published: true });
    const updated = getPost(post.id);
    expect(updated?.title).toBe("Keep me");
    expect(updated?.body).toBe("Keep this too.");
  });

  test("404 for a missing post", async () => {
    const user = makeUser();
    const res = await request(app).patch("/posts/99999").set("X-User-Id", String(user.id)).send({ title: "x" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /posts/:id", () => {
  test("deletes the post (response + DB state)", async () => {
    const user = makeUser();
    const post = makePost(user);
    const res = await request(app).delete(`/posts/${post.id}`).set("X-User-Id", String(user.id));
    expect(res.status).toBe(204);
    expect(getPost(post.id)).toBeUndefined();
  });

  test("deleted post is no longer listed", async () => {
    const user = makeUser();
    const post = makePost(user, { title: "Gone soon" });
    await request(app).delete(`/posts/${post.id}`).set("X-User-Id", String(user.id));
    const titles = (await request(app).get("/posts")).body.map((p: PostRow) => p.title);
    expect(titles).not.toContain("Gone soon");
  });

  test("404 for a missing post", async () => {
    const user = makeUser();
    expect((await request(app).delete("/posts/99999").set("X-User-Id", String(user.id))).status).toBe(404);
  });
});
