/**
 * Tests for 05-mutations: CRUD and mutation-payload patterns.
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

const run = (source: string): Result => graphqlSync({ schema, source }) as Result;

beforeEach(() => db.reset());
afterEach(() => db.reset());

// ── Pattern A: simple mutations ───────────────────────────────────────────────

test("createTodoSimple returns the new item", () => {
  const result = run(`mutation {
    createTodoSimple(input: { title: "New task", priority: 3 }) { id title done priority }
  }`);
  expect(result.errors).toBeUndefined();
  const todo = result.data!.createTodoSimple;
  expect(todo.id).toBe("5");
  expect(todo.title).toBe("New task");
  expect(todo.done).toBe(false);
  expect(todo.priority).toBe(3);
});

test("toggleDoneSimple flips status", () => {
  const result = run('mutation { toggleDoneSimple(id: "3") { id done } }');
  expect(result.data!.toggleDoneSimple.done).toBe(true);
});

test("toggleDoneSimple with missing id returns null", () => {
  const result = run('mutation { toggleDoneSimple(id: "999") { id } }');
  expect(result.errors).toBeUndefined();
  expect(result.data!.toggleDoneSimple).toBeNull();
});

// ── Pattern B: mutation payload ───────────────────────────────────────────────

test("createTodo success path", () => {
  const result = run(`mutation {
    createTodo(input: { title: "Practice pagination", priority: 2 }) {
      ... on CreateTodoSuccess { todo { id title priority } }
      ... on ValidationError { field message }
    }
  }`);
  expect(result.errors).toBeUndefined();
  expect(result.data!.createTodo.todo.title).toBe("Practice pagination");
});

test("createTodo with empty title returns a ValidationError", () => {
  const result = run(`mutation {
    createTodo(input: { title: "" }) {
      ... on ValidationError { field message }
      ... on CreateTodoSuccess { todo { id } }
    }
  }`);
  expect(result.data!.createTodo.field).toBe("title");
});

test("createTodo with invalid priority returns a ValidationError", () => {
  const result = run(`mutation {
    createTodo(input: { title: "Test", priority: 10 }) {
      ... on ValidationError { field message }
    }
  }`);
  expect(result.data!.createTodo.field).toBe("priority");
});

test("updateTodo partial update only changes provided fields", () => {
  const result = run(`mutation {
    updateTodo(id: "3", input: { done: true }) {
      ... on UpdateTodoSuccess { todo { title done priority } }
    }
  }`);
  const todo = result.data!.updateTodo.todo;
  expect(todo.done).toBe(true);
  expect(todo.title).toBe("Implement DataLoaders"); // unchanged
  expect(todo.priority).toBe(2); // unchanged
});

test("updateTodo with missing id returns TodoNotFound", () => {
  const result = run(`mutation {
    updateTodo(id: "999", input: { done: true }) {
      ... on TodoNotFound { id message }
      ... on UpdateTodoSuccess { todo { id } }
    }
  }`);
  expect(result.data!.updateTodo.message).toBeDefined();
  expect(result.data!.updateTodo.id).toBe("999");
});

test("deleteTodo returns the deleted item", () => {
  const result = run(`mutation {
    deleteTodo(id: "1") {
      ... on TodoItem { id title }
      ... on TodoNotFound { message }
    }
  }`);
  expect(result.data!.deleteTodo.title).toBe("Learn GraphQL schema basics");
  expect(db.state.items).toHaveLength(3);
});

test("deleteTodo with missing id returns TodoNotFound", () => {
  const result = run(`mutation {
    deleteTodo(id: "999") {
      ... on TodoNotFound { id message }
      ... on TodoItem { id }
    }
  }`);
  expect(result.data!.deleteTodo.message).toBeDefined();
});

test("two mutations run in sequence", () => {
  const result = run(`mutation {
    first:  createTodo(input: { title: "First" }) { ... on CreateTodoSuccess { todo { id } } }
    second: createTodo(input: { title: "Second" }) { ... on CreateTodoSuccess { todo { id } } }
  }`);
  expect(result.data!.first.todo.id).toBe("5");
  expect(result.data!.second.todo.id).toBe("6");
});

test("mutation and query reflect the change", () => {
  run(`mutation { updateTodo(id: "3", input: { done: true }) { ... on UpdateTodoSuccess { todo { id } } } }`);
  expect(run('{ todo(id: "3") { done } }').data!.todo.done).toBe(true);
});
