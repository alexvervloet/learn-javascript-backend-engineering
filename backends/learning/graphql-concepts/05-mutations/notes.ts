/**
 * 05 · Mutations — Concepts
 * ==========================
 *
 * --- PATTERN A: simple returns ---
 *   createTodoSimple(input): TodoItem!     → returns the created object
 *   toggleDoneSimple(id): TodoItem         → null if not found
 * Easy, but a failure is just `data: null` plus a generic top-level error — the
 * client gets no structured, typed information about what went wrong.
 *
 * --- PATTERN B: mutation-payload unions (recommended) ---
 *   union CreateTodoResult = CreateTodoSuccess | ValidationError
 *   createTodo(input): CreateTodoResult!
 * Errors become first-class schema types. Clients branch with inline fragments:
 *   mutation {
 *     createTodo(input: { title: "" }) {
 *       ... on CreateTodoSuccess { todo { id } }
 *       ... on ValidationError  { field message }
 *     }
 *   }
 * Each returned object is tagged with `__typename` so the union's __resolveType
 * can pick the concrete type.
 *
 * --- PARTIAL UPDATES ---
 * Make every UpdateTodoInput field nullable and only apply the ones provided
 * (`if (input.done != null) ...`). Distinguish "field omitted" from "set to null".
 *
 * --- EXECUTION ORDER ---
 * Top-level mutation fields run SERIALLY, in document order (unlike query fields,
 * which may resolve in parallel). So `first` then `second` is guaranteed.
 *
 * --- EXERCISES ---
 * 1. Add a `priority` ValidationError branch to createTodo and trigger it.
 * 2. updateTodo with only { title } — confirm done/priority are unchanged.
 * 3. deleteTodo a missing id and read the TodoNotFound branch.
 * 4. Run two createTodo aliases in one mutation and check ids 5, 6.
 */

const MUTATION_PAYLOAD_PATTERN = {
  why: "typed, per-case errors instead of a generic top-level errors array",
  shape: "union Result = Success | ErrorA | ErrorB",
  client: "inline fragments: ... on Success {} ... on ErrorA {}",
};

export { MUTATION_PAYLOAD_PATTERN };
