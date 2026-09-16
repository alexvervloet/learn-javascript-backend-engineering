/**
 * Tests for 01-schema-basics.
 *
 * graphql-js schemas run without an HTTP server: `graphqlSync({ schema, source })`
 * (or async `graphql(...)`) executes a query in-process. The result has `.data`
 * and `.errors`.
 */

import { test, expect, beforeEach, afterEach } from "@jest/globals";
import { graphqlSync } from "graphql";
import { schema, reset } from "./schema.js";

// A GraphQL response is not statically typed without a codegen step: the query
// is a string, so the compiler cannot know what shape comes back. These demos
// have no codegen, so `data` is a loose map here and the assertions below are
// what pin the shape down. A production service generates result types from the
// schema plus its operations instead — that is the real answer, and the reason
// this alias is named rather than left as a bare `any` at each call site.
type QueryData = Record<string, any>;

type Result = { data?: QueryData | null; errors?: readonly { message: string }[] };
const run = (
  source: string,
  variableValues?: Record<string, unknown>
): Result =>
  graphqlSync({ schema, source, variableValues });

beforeEach(reset);
afterEach(reset);

// ── Queries ───────────────────────────────────────────────────────────────────

test("books returns all three seed books", () => {
  const result = run("{ books { id title } }");
  expect(result.errors).toBeUndefined();
  expect(result.data!.books).toHaveLength(3);
});

test("books only returns requested fields", () => {
  const result = run("{ books { title } }");
  expect(result.errors).toBeUndefined();
  expect(result.data!.books.every((b: QueryData) => !("year" in b))).toBe(true);
  expect(result.data!.books[0].title).toBe("Clean Code");
});

test("book by id returns the correct book", () => {
  const result = run('{ book(id: "2") { title author } }');
  expect(result.data!.book.title).toBe("The Pragmatic Programmer");
  expect(result.data!.book.author).toBe("Hunt & Thomas");
});

test("book by missing id returns null", () => {
  const result = run('{ book(id: "999") { title } }');
  expect(result.errors).toBeUndefined();
  expect(result.data!.book).toBeNull();
});

test("nullable description can be null", () => {
  expect(run('{ book(id: "1") { description } }').data!.book.description).toBeNull();
});

test("nullable description can have a value", () => {
  expect(run('{ book(id: "3") { description } }').data!.book.description).toBe("The seminal patterns book");
});

test("named operation with a variable", () => {
  const result = run("query GetBook($id: ID!) { book(id: $id) { title } }", { id: "1" });
  expect(result.data!.book.title).toBe("Clean Code");
});

test("alias fetches two books in one request", () => {
  const result = run(`{
    first:  book(id: "1") { title }
    second: book(id: "2") { title }
  }`);
  expect(result.data!.first.title).toBe("Clean Code");
  expect(result.data!.second.title).toBe("The Pragmatic Programmer");
});

// ── Mutations ─────────────────────────────────────────────────────────────────

test("addBook returns the new book with an id", () => {
  const result = run(`mutation {
    addBook(input: { title: "DDIA", author: "Kleppmann", year: 2017 }) {
      id title year description
    }
  }`);
  expect(result.errors).toBeUndefined();
  expect(result.data!.addBook.id).toBe("4");
  expect(result.data!.addBook.title).toBe("DDIA");
  expect(result.data!.addBook.description).toBeNull();
});

test("addBook with a description", () => {
  const result = run(`mutation {
    addBook(input: { title: "Refactoring", author: "Fowler", year: 2018, description: "Essential reading" }) { description }
  }`);
  expect(result.data!.addBook.description).toBe("Essential reading");
});

test("added book appears in the list", () => {
  run(`mutation { addBook(input: { title: "New", author: "Author", year: 2024 }) { id } }`);
  const titles = run("{ books { title } }").data!.books.map((b: QueryData) => b.title);
  expect(titles).toContain("New");
  expect(titles).toHaveLength(4);
});

test("deleteBook returns true and removes it", () => {
  expect(run('mutation { deleteBook(id: "1") }').data!.deleteBook).toBe(true);
  expect(run('{ book(id: "1") { title } }').data!.book).toBeNull();
});

test("deleting a missing book returns false", () => {
  expect(run('mutation { deleteBook(id: "999") }').data!.deleteBook).toBe(false);
});

test("mutation with a variable", () => {
  const result = run(
    "mutation AddBook($input: AddBookInput!) { addBook(input: $input) { title year } }",
    { input: { title: "The Art of Unix", author: "ESR", year: 2003 } }
  );
  expect(result.data!.addBook.title).toBe("The Art of Unix");
});

// ── Introspection ───────────────────────────────────────────────────────────

test("schema exposes the Book type and its fields", () => {
  const result = run(`{ __type(name: "Book") { name fields { name } } }`);
  const names = new Set(result.data!.__type.fields.map((f: QueryData) => f.name));
  for (const f of ["id", "title", "author", "year", "description"]) expect(names).toContain(f);
});
