/**
 * auth.test.ts — authentication and ownership enforcement
 * =========================================================
 * Auth tests answer a distinct question — "does the app correctly gate access?"
 * — separate from "does the business logic work?".
 *
 *   401 Unauthorized → no identity, or an invalid one
 *   403 Forbidden    → valid identity, but you don't own this resource
 *
 * (A missing auth header here is 401, not 422 — see the note in app/main.ts.)
 */

import { describe, test, expect } from "@jest/globals";
import { api, installIsolation, makeUser, makePost } from "./helpers.js";

installIsolation();

describe("missing auth → 401", () => {
  test("create post requires auth", async () => {
    const res = await api().post("/posts").send({ title: "x", body: "y" });
    expect(res.status).toBe(401);
  });

  test("update post requires auth", async () => {
    const post = makePost(makeUser());
    const res = await api().patch(`/posts/${post.id}`).send({ title: "x" });
    expect(res.status).toBe(401);
  });

  test("delete post requires auth", async () => {
    const post = makePost(makeUser());
    const res = await api().delete(`/posts/${post.id}`);
    expect(res.status).toBe(401);
  });
});

describe("unknown user → 401", () => {
  test("create post with unknown user", async () => {
    const res = await api().post("/posts").set("X-User-Id", "99999").send({ title: "x", body: "y" });
    expect(res.status).toBe(401);
  });

  test("update post with unknown user", async () => {
    const post = makePost(makeUser());
    const res = await api().patch(`/posts/${post.id}`).set("X-User-Id", "99999").send({ title: "x" });
    expect(res.status).toBe(401);
  });
});

describe("ownership → 403", () => {
  test("update another user's post returns 403", async () => {
    const alice = makeUser({ username: "alice" });
    const bob = makeUser({ username: "bob" });
    const alicesPost = makePost(alice);
    const res = await api().patch(`/posts/${alicesPost.id}`).set("X-User-Id", String(bob.id)).send({ title: "Hijacked" });
    expect(res.status).toBe(403);
  });

  test("delete another user's post returns 403", async () => {
    const alice = makeUser({ username: "alice" });
    const bob = makeUser({ username: "bob" });
    const alicesPost = makePost(alice);
    const res = await api().delete(`/posts/${alicesPost.id}`).set("X-User-Id", String(bob.id));
    expect(res.status).toBe(403);
  });

  test("owner can update own post", async () => {
    const alice = makeUser();
    const post = makePost(alice);
    const res = await api().patch(`/posts/${post.id}`).set("X-User-Id", String(alice.id)).send({ title: "My edit" });
    expect(res.status).toBe(200);
  });

  test("owner can delete own post", async () => {
    const alice = makeUser();
    const post = makePost(alice);
    const res = await api().delete(`/posts/${post.id}`).set("X-User-Id", String(alice.id));
    expect(res.status).toBe(204);
  });
});

describe("read routes are public", () => {
  test("list posts is public", async () => {
    expect((await api().get("/posts")).status).toBe(200);
  });

  test("get post is public", async () => {
    const post = makePost(makeUser());
    expect((await api().get(`/posts/${post.id}`)).status).toBe(200);
  });
});
