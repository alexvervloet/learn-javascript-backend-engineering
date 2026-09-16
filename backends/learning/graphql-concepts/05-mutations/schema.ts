/**
 * 05 · Mutations — CRUD & Error Handling
 * =======================================
 *
 * Two mutation patterns side by side:
 *   A. Simple return (object or nullable) — easy, but no structured error info.
 *   B. Mutation-payload union — return a union of success/error types so clients
 *      handle each case explicitly with inline fragments. The recommended pattern
 *      for any mutation that can fail (errors become part of the typed schema,
 *      not a generic top-level `errors` array).
 *
 * As in section 04, each returned object carries a `__typename` so the union's
 * `__resolveType` can pick the concrete type.
 */

import { makeExecutableSchema } from "@graphql-tools/schema";
import { state } from "./data.js";
import type { TodoItem } from "./data.js";

const typeDefs = /* GraphQL */ `
  type TodoItem {
    id: ID!
    title: String!
    done: Boolean!
    priority: Int!
  }

  input CreateTodoInput {
    title: String!
    priority: Int = 1
  }

  input UpdateTodoInput {
    title: String
    done: Boolean
    priority: Int
  }

  type ValidationError {
    field: String!
    message: String!
  }

  type TodoNotFound {
    id: ID!
    message: String!
  }

  type CreateTodoSuccess {
    todo: TodoItem!
  }

  type UpdateTodoSuccess {
    todo: TodoItem!
  }

  union CreateTodoResult = CreateTodoSuccess | ValidationError
  union UpdateTodoResult = UpdateTodoSuccess | TodoNotFound | ValidationError
  union DeleteTodoResult = TodoItem | TodoNotFound

  type Query {
    todos: [TodoItem!]!
    todo(id: ID!): TodoItem
  }

  type Mutation {
    # Pattern A — simple returns
    createTodoSimple(input: CreateTodoInput!): TodoItem!
    toggleDoneSimple(id: ID!): TodoItem

    # Pattern B — typed-error payloads
    createTodo(input: CreateTodoInput!): CreateTodoResult!
    updateTodo(id: ID!, input: UpdateTodoInput!): UpdateTodoResult!
    deleteTodo(id: ID!): DeleteTodoResult!
  }
`;

// Pattern B returns a union, and each member is tagged with __typename so the
// __resolveType functions below can discriminate. Naming the members means a
// resolver cannot return a shape the union does not cover.
interface SuccessPayload {
  __typename: string;
  todo: TodoItem;
}

interface ValidationErrorPayload {
  __typename: "ValidationError";
  field: string;
  message: string;
}

interface NotFoundPayload {
  __typename: "TodoNotFound";
  id: string;
  message: string;
}

// DeleteTodoResult in the SDL is TodoItem | TodoNotFound, so a deleted item
// comes back flattened with __typename on it rather than wrapped in a
// success payload. That fourth shape belongs in the union too.
type DeletedPayload = TodoItem & { __typename: string };

type MutationResult =
  | SuccessPayload
  | ValidationErrorPayload
  | NotFoundPayload
  | DeletedPayload;

const ok = (todo: TodoItem): DeletedPayload => ({ ...todo, __typename: "TodoItem" });
const success = (typename: string, todo: TodoItem): SuccessPayload => ({
  __typename: typename,
  todo,
});
const validationError = (field: string, message: string): ValidationErrorPayload => ({
  __typename: "ValidationError",
  field,
  message,
});
const notFound = (id: string): NotFoundPayload => ({
  __typename: "TodoNotFound",
  id,
  message: "Todo item not found",
});

interface CreateTodoInput {
  title: string;
  priority?: number | null;
}

interface UpdateTodoInput {
  title?: string | null;
  done?: boolean | null;
  priority?: number | null;
}

const resolvers = {
  // Discriminate each union by the __typename we tag onto returned objects.
  CreateTodoResult: { __resolveType: (o: MutationResult): string => o.__typename },
  UpdateTodoResult: { __resolveType: (o: MutationResult): string => o.__typename },
  DeleteTodoResult: { __resolveType: (o: MutationResult): string => o.__typename },

  Query: {
    todos: () => state.items,
    todo: (_p: unknown, { id }: { id: string }): TodoItem | null =>
      state.items.find((t) => t.id === id) ?? null,
  },

  Mutation: {
    // ── Pattern A ─────────────────────────────────────────────────────────
    createTodoSimple: (_p: unknown, { input }: { input: CreateTodoInput }): TodoItem => {
      const row: TodoItem = {
        id: String(state.nextId),
        title: input.title,
        done: false,
        priority: input.priority ?? 1,
      };
      state.items.push(row);
      state.nextId += 1;
      return row;
    },
    toggleDoneSimple: (_p: unknown, { id }: { id: string }): TodoItem | null => {
      const item = state.items.find((t) => t.id === id);
      if (!item) return null; // client must check for null
      item.done = !item.done;
      return item;
    },

    // ── Pattern B ─────────────────────────────────────────────────────────
    createTodo: (_p: unknown, { input }: { input: CreateTodoInput }): MutationResult => {
      if (!input.title.trim()) return validationError("title", "Title cannot be empty");
      if (input.priority != null && !(input.priority >= 1 && input.priority <= 5)) {
        return validationError("priority", "Priority must be 1–5");
      }
      const row: TodoItem = {
        id: String(state.nextId),
        title: input.title.trim(),
        done: false,
        priority: input.priority ?? 1,
      };
      state.items.push(row);
      state.nextId += 1;
      return success("CreateTodoSuccess", row);
    },

    updateTodo: (
      _p: unknown,
      { id, input }: { id: string; input: UpdateTodoInput }
    ): MutationResult => {
      const row = state.items.find((t) => t.id === id);
      if (!row) return notFound(id);

      if (input.title != null) {
        if (!input.title.trim()) return validationError("title", "Title cannot be empty");
        row.title = input.title.trim();
      }
      if (input.done != null) row.done = input.done;
      if (input.priority != null) {
        if (!(input.priority >= 1 && input.priority <= 5)) {
          return validationError("priority", "Priority must be 1–5");
        }
        row.priority = input.priority;
      }
      return success("UpdateTodoSuccess", row);
    },

    deleteTodo: (_p: unknown, { id }: { id: string }): MutationResult => {
      const i = state.items.findIndex((t) => t.id === id);
      if (i === -1) return notFound(id);
      // splice returns an array; the findIndex above guarantees one element,
      // but the type does not say so.
      const [row] = state.items.splice(i, 1);
      if (!row) return notFound(id);
      return ok(row);
    },
  },
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

export { schema };
