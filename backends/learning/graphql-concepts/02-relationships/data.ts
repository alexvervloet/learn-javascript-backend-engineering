/**
 * In-memory data store for section 02.
 *
 * Deliberately separate from schema.ts so the N+1 counter is easy to observe.
 * Field names are camelCase (authorId) to match the GraphQL SDL.
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

// Tracks "DB" calls so tests can assert N+1 behaviour.
const QueryCounter = {
  calls: 0,
  reset(): void {
    this.calls = 0;
  },
  // The label is passed at every call site for readability but never used. The
  // JavaScript version declared record() with no parameters and the extra
  // argument was silently dropped; TypeScript flagged the mismatch, so the
  // parameter is now declared and explicitly ignored.
  record(_label?: string): void {
    this.calls += 1;
  },
};

function reset(): void {
  authors = SEED_AUTHORS.map((r) => ({ ...r }));
  posts = SEED_POSTS.map((r) => ({ ...r }));
  QueryCounter.reset();
}

function getAuthor(authorId: string): Author | null {
  QueryCounter.record(`getAuthor(${authorId})`);
  return authors.find((a) => a.id === authorId) ?? null;
}

function getPostsByAuthor(authorId: string): Post[] {
  QueryCounter.record(`getPostsByAuthor(${authorId})`);
  return posts.filter((p) => p.authorId === authorId);
}

reset();

// The CommonJS version exported getters so importers always saw the current
// arrays after reset() reassigned them. ESM exports are live bindings, which
// does the same thing without the getters: `authors` here and `db.authors` in
// an importer refer to the same binding, so a reassignment is visible on both.
export { reset, getAuthor, getPostsByAuthor, QueryCounter, authors, posts };
export type { Author, Post };
