/**
 * In-memory todo store for section 05.
 */

interface TodoItem {
  id: string;
  title: string;
  done: boolean;
  priority: number;
}

const SEED: TodoItem[] = [
  { id: "1", title: "Learn GraphQL schema basics", done: true, priority: 1 },
  { id: "2", title: "Understand relationships", done: true, priority: 1 },
  { id: "3", title: "Implement DataLoaders", done: false, priority: 2 },
  { id: "4", title: "Practice mutations", done: false, priority: 1 },
];

// The element type has to be stated: an empty [] infers as never[], and
// nothing can be pushed into that.
const state: { items: TodoItem[]; nextId: number } = { items: [], nextId: 5 };

function reset(): void {
  state.items = SEED.map((r) => ({ ...r }));
  state.nextId = 5;
}

reset();

export { state, reset };
export type { TodoItem };
