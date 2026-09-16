/**
 * Tests for 06-pagination: offset and cursor pagination.
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

// ── Offset pagination ─────────────────────────────────────────────────────────

test("offset first page returns the correct items", () => {
  const result = run("{ postsPage(offset: 0, limit: 5) { items { id title } total hasNextPage hasPrevPage } }");
  expect(result.errors).toBeUndefined();
  const page = result.data!.postsPage;
  expect(page.items).toHaveLength(5);
  expect(page.items[0].id).toBe("1");
  expect(page.total).toBe(100);
  expect(page.hasNextPage).toBe(true);
  expect(page.hasPrevPage).toBe(false);
});

test("offset second page has a previous page", () => {
  const page = run("{ postsPage(offset: 5, limit: 5) { items { id } hasPrevPage } }").data!.postsPage;
  expect(page.items[0].id).toBe("6");
  expect(page.hasPrevPage).toBe(true);
});

test("offset last page has no next page", () => {
  const page = run("{ postsPage(offset: 95, limit: 10) { items { id } hasNextPage } }").data!.postsPage;
  expect(page.items).toHaveLength(5); // only 5 left
  expect(page.hasNextPage).toBe(false);
});

test("offset default limit is ten", () => {
  expect(run("{ postsPage { items { id } } }").data!.postsPage.items).toHaveLength(10);
});

// ── Cursor pagination ─────────────────────────────────────────────────────────

test("cursor first page returns the correct items", () => {
  const conn = run(`{
    postsConnection(first: 5) {
      edges { node { id title } cursor }
      pageInfo { hasNextPage hasPrevPage startCursor endCursor }
      totalCount
    }
  }`).data!.postsConnection;
  expect(conn.edges).toHaveLength(5);
  expect(conn.edges[0].node.id).toBe("1");
  expect(conn.totalCount).toBe(100);
  expect(conn.pageInfo.hasNextPage).toBe(true);
  expect(conn.pageInfo.hasPrevPage).toBe(false);
  expect(conn.pageInfo.endCursor).not.toBeNull();
});

test("cursor second page starts after the end cursor", () => {
  const endCursor = run("{ postsConnection(first: 5) { pageInfo { endCursor } } }").data!.postsConnection.pageInfo.endCursor;
  const edges = run(`{ postsConnection(first: 5, after: "${endCursor}") { edges { node { id } } } }`).data!.postsConnection.edges;
  expect(edges).toHaveLength(5);
  expect(edges[0].node.id).toBe("6");
});

test("cursor paging reaches a last page with no next", () => {
  let page = run("{ postsConnection(first: 10) { pageInfo { hasNextPage endCursor } } }").data!.postsConnection.pageInfo;
  let cursor = page.endCursor;
  for (let i = 0; i < 20; i += 1) {
    page = run(`{ postsConnection(first: 10, after: "${cursor}") { pageInfo { hasNextPage endCursor } } }`).data!.postsConnection.pageInfo;
    if (!page.hasNextPage) break;
    cursor = page.endCursor;
  }
  expect(page.hasNextPage).toBe(false);
});

test("cursor is opaque base64 that round-trips", () => {
  const edge = run("{ postsConnection(first: 1) { edges { cursor node { id } } } }").data!.postsConnection.edges[0];
  const decoded = Buffer.from(edge.cursor, "base64").toString("utf8");
  expect(decoded).toBe(`post:${edge.node.id}`);
});

test("cursor and offset report the same total", () => {
  const total = run("{ postsPage { total } }").data!.postsPage.total;
  const totalCount = run("{ postsConnection { totalCount } }").data!.postsConnection.totalCount;
  expect(total).toBe(100);
  expect(totalCount).toBe(100);
});
