/**
 * validation.test.ts — input validation and 422 responses
 * =========================================================
 * The route layer parses each body with Zod before the handler runs; a schema
 * violation returns 422. These tests pin the contract: required fields, length
 * bounds, and types — so an accidental schema change (e.g. dropping `.min(1)`)
 * fails loudly.
 *
 * Schema (app/schemas.js):
 *   PostCreate { title: string 1..200, body: string ≥1 }
 *   PostUpdate { title?: string 1..200, body?: string, published?: boolean }
 */

import { describe, test, expect } from "@jest/globals";
import request from "supertest";
import { app } from "../app/main.js";
import { installIsolation, makeUser, makePost } from "./helpers.js";

installIsolation();

const auth = (id: number): Record<string, string> => ({ "X-User-Id": String(id) });

describe("POST /posts validation", () => {
  test("missing title → 422", async () => {
    const user = makeUser();
    expect((await request(app).post("/posts").set(auth(user.id)).send({ body: "content" })).status).toBe(422);
  });

  test("missing body → 422", async () => {
    const user = makeUser();
    expect((await request(app).post("/posts").set(auth(user.id)).send({ title: "A title" })).status).toBe(422);
  });

  test("empty title → 422", async () => {
    const user = makeUser();
    expect((await request(app).post("/posts").set(auth(user.id)).send({ title: "", body: "content" })).status).toBe(422);
  });

  test("empty body → 422", async () => {
    const user = makeUser();
    expect((await request(app).post("/posts").set(auth(user.id)).send({ title: "A title", body: "" })).status).toBe(422);
  });

  test("title at max length (200) is accepted", async () => {
    const user = makeUser();
    expect((await request(app).post("/posts").set(auth(user.id)).send({ title: "x".repeat(200), body: "c" })).status).toBe(201);
  });

  test("title exceeding max length (201) → 422", async () => {
    const user = makeUser();
    expect((await request(app).post("/posts").set(auth(user.id)).send({ title: "x".repeat(201), body: "c" })).status).toBe(422);
  });

  test("no body at all → 422", async () => {
    const user = makeUser();
    expect((await request(app).post("/posts").set(auth(user.id))).status).toBe(422);
  });

  // Zod's .min(1) counts characters, so a single space passes (length 1).
  test.each([
    ["", 422],
    [" ", 201],
    ["\t", 201],
  ])("title %j → %i (min_length counts characters)", async (title, expected) => {
    const user = makeUser();
    const res = await request(app).post("/posts").set(auth(user.id)).send({ title, body: "content" });
    expect(res.status).toBe(expected);
  });
});

describe("PATCH /posts/:id validation", () => {
  test("empty title → 422", async () => {
    const user = makeUser();
    const post = makePost(user);
    expect((await request(app).patch(`/posts/${post.id}`).set(auth(user.id)).send({ title: "" })).status).toBe(422);
  });

  test("title exceeding max length → 422", async () => {
    const user = makeUser();
    const post = makePost(user);
    expect((await request(app).patch(`/posts/${post.id}`).set(auth(user.id)).send({ title: "x".repeat(201) })).status).toBe(422);
  });

  test("empty object {} is valid (all fields optional)", async () => {
    const user = makeUser();
    const post = makePost(user);
    expect((await request(app).patch(`/posts/${post.id}`).set(auth(user.id)).send({})).status).toBe(200);
  });

  test("explicit null for an optional field is accepted", async () => {
    const user = makeUser();
    const post = makePost(user);
    expect((await request(app).patch(`/posts/${post.id}`).set(auth(user.id)).send({ title: null })).status).toBe(200);
  });

  test("wrong type for published → 422 (Zod is strict)", async () => {
    const user = makeUser();
    const post = makePost(user);
    expect((await request(app).patch(`/posts/${post.id}`).set(auth(user.id)).send({ published: "yes" })).status).toBe(422);
  });
});
