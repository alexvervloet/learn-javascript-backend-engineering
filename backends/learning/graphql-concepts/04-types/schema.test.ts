/**
 * Tests for 04-types: enums, unions, interfaces, custom scalars.
 */

import { test, expect } from "@jest/globals";
import { graphqlSync } from "graphql";
import { schema } from "./schema.js";

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

test("enum field serializes to its value name", () => {
  const result = run('{ article(id: "a1") { genre status } }');
  expect(result.errors).toBeUndefined();
  expect(result.data!.article.genre).toBe("NON_FICTION");
  expect(result.data!.article.status).toBe("PUBLISHED");
});

test("enum argument filters articles by genre", () => {
  const result = run("{ articlesByGenre(genre: NON_FICTION) { title } }");
  expect(result.data!.articlesByGenre[0].title).toBe("GraphQL Basics");
});

test("invalid enum value causes a validation error", () => {
  const result = run("{ articlesByGenre(genre: ROMANCE) { title } }");
  expect(result.errors).toBeDefined();
});

test("custom Date scalar serializes to an ISO string", () => {
  const result = run('{ article(id: "a1") { publishedAt } }');
  expect(result.data!.article.publishedAt).toBe("2024-01-15");
});

test("nullable Date can be null", () => {
  const result = run('{ article(id: "a2") { publishedAt } }');
  expect(result.errors).toBeUndefined();
  expect(result.data!.article.publishedAt).toBeNull();
});

test("union search returns mixed types via inline fragments", () => {
  const result = run(`{
    search(term: "intro") {
      __typename
      ... on Article { title body }
      ... on Video { title url }
    }
  }`);
  expect(result.errors).toBeUndefined();
  const typeNames = new Set(result.data!.search.map((r: QueryData) => r.__typename));
  expect(typeNames).toContain("Video");
});

test("union search returning only articles", () => {
  const result = run(`{
    search(term: "GraphQL") {
      __typename
      ... on Article { title }
    }
  }`);
  expect(result.data!.search[0].__typename).toBe("Article");
  expect(result.data!.search[0].title).toBe("GraphQL Basics");
});

test("publishedContent filters by status", () => {
  const result = run(`{
    publishedContent {
      __typename
      ... on Article { status }
      ... on Video { status }
    }
  }`);
  for (const item of result.data!.publishedContent) expect(item.status).toBe("PUBLISHED");
});

test("interface fields are accessible without a fragment", () => {
  const result = run("{ articles { title status } }");
  expect(result.data!.articles[0].title).toBe("GraphQL Basics");
});

test("__typename present for each union member", () => {
  const result = run("{ publishedContent { __typename } }");
  const typeNames = new Set(result.data!.publishedContent.map((r: QueryData) => r.__typename));
  expect(typeNames).toContain("Article");
  expect(typeNames).toContain("Video");
});
