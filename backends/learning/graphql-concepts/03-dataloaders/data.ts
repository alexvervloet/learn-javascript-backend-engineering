/**
 * Same data as section 02, with a batch-aware query function added.
 */

interface Author {
  id: string;
  name: string;
  bio: string;
}

interface Post {
  id: string;
  title: string;
  body: string;
  authorId: string;
}

const SEED_AUTHORS: Author[] = [
  { id: "a1", name: "Alice Nguyen", bio: "Distributed systems engineer" },
  { id: "a2", name: "Bob Okafor", bio: "Frontend performance specialist" },
  { id: "a3", name: "Carol Petersen", bio: "Database architect" },
];

const SEED_POSTS: Post[] = [
  { id: "p1", title: "Intro to CRDT", body: "CRDTs allow...", authorId: "a1" },
  { id: "p2", title: "Raft Consensus", body: "Raft is...", authorId: "a1" },
  { id: "p3", title: "Core Web Vitals", body: "LCP, FID...", authorId: "a2" },
  { id: "p4", title: "CSS Grid Deep Dive", body: "Grid is...", authorId: "a2" },
  { id: "p5", title: "EXPLAIN ANALYZE", body: "Postgres...", authorId: "a3" },
  { id: "p6", title: "Index Selectivity", body: "Selectivity...", authorId: "a3" },
];

let authors: Author[] = [];
let posts: Post[] = [];

// Counts BATCH load calls (not individual item lookups).
const BatchCounter = {
  calls: 0,
  reset(): void {
    this.calls = 0;
  },
};

function reset(): void {
  authors = SEED_AUTHORS.map((r) => ({ ...r }));
  posts = SEED_POSTS.map((r) => ({ ...r }));
  BatchCounter.reset();
}

// Batch load — returns one item per input id (null if not found), in input order.
function getAuthorsByIds(ids: readonly string[]): (Author | null)[] {
  BatchCounter.calls += 1;
  const index = new Map<string, Author>(authors.map((a) => [a.id, a]));
  return ids.map((id) => index.get(id) ?? null);
}

reset();

// The CommonJS version exported getters so importers always saw the current
// arrays after reset() reassigned them. ESM exports are live bindings, which
// does the same thing without the getters.
export { reset, getAuthorsByIds, BatchCounter, authors, posts };
export type { Author, Post };
