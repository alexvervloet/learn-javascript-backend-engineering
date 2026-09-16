/**
 * Tests for 02-relationships.
 *
 * Key goal: prove the naive resolver causes N+1 query calls, and verify the
 * query structure is correct before fixing it in section 03.
 */

import { test, expect, beforeEach, afterEach } from "@jest/globals";
import { graphqlSync } from "graphql";
import { schema } from "./schema.js";
import * as db from "./data.js";

// A GraphQL response is not statically typed without a codegen step: the query
// is a string, so the compiler cannot know what shape comes back. These demos
// have no codegen, so `data` is a loose map here and the assertions below are
// what pin the shape down. A production service generates result types from the
// schema plus its operations instead — that is the real answer, and the reason
// this alias is named rather than left as a bare `any` at each call site.
type QueryData = Record<string, any>;

type Result = { data?: QueryData | null; errors?: readonly { message: string }[] };
const run = (source: string): Result =>
  graphqlSync({ schema, source });

beforeEach(() => db.reset());
afterEach(() => db.reset());

// ── Basic queries ─────────────────────────────────────────────────────────────

test("posts returns all six", () => {
  const result = run("{ posts { id title } }");
  expect(result.errors).toBeUndefined();
  expect(result.data!.posts).toHaveLength(6);
});

test("post has an author name", () => {
  const result = run('{ post(id: "p1") { title author { name } } }');
  expect(result.data!.post.title).toBe("Intro to CRDT");
  expect(result.data!.post.author.name).toBe("Alice Nguyen");
});

test("author has posts", () => {
  const result = run('{ author(id: "a2") { name posts { title } } }');
  expect(result.data!.author.name).toBe("Bob Okafor");
  expect(result.data!.author.posts).toHaveLength(2);
});

test("authorId is not exposed in the schema", () => {
  const result = run("{ posts { authorId } }");
  expect(result.errors).toBeDefined();
  expect(result.errors!.some((e) => e.message.includes("authorId"))).toBe(true);
});

// ── N+1 demonstration ─────────────────────────────────────────────────────────

test("posts without author costs zero extra queries", () => {
  const result = run("{ posts { title } }");
  expect(result.errors).toBeUndefined();
  expect(db.QueryCounter.calls).toBe(0);
});

test("N+1 is visible when requesting author: 6 posts → 6 lookups", () => {
  db.QueryCounter.reset();
  const result = run("{ posts { title author { name } } }");
  expect(result.errors).toBeUndefined();
  expect(result.data!.posts).toHaveLength(6);
  expect(db.QueryCounter.calls).toBe(6);
});

test("3 distinct authors still cause 6 lookups (no dedup without DataLoader)", () => {
  db.QueryCounter.reset();
  run("{ posts { author { name } } }");
  expect(db.QueryCounter.calls).toBe(6);
});

test("authors with posts costs one query per author (3)", () => {
  db.QueryCounter.reset();
  run("{ authors { name posts { title } } }");
  expect(db.QueryCounter.calls).toBe(3);
});

test("single post costs exactly one author lookup", () => {
  db.QueryCounter.reset();
  run('{ post(id: "p1") { author { name } } }');
  expect(db.QueryCounter.calls).toBe(1);
});
