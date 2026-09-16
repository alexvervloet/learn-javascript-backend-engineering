/**
 * 03 · DataLoaders — Concepts
 * ============================
 *
 * --- WHAT A DATALOADER DOES ---
 * Problem: N Post.author resolvers each call getAuthor(id) → N queries.
 * DataLoader:
 *   1. resolver calls loader.load("a1") — returns a Promise, does NOT query yet
 *   2. all 6 resolvers do the same in the same tick
 *   3. the loader fires batchLoadAuthors(["a1","a1","a2",...]) ONCE (deduped)
 *   4. distributes one result back to each awaiting resolver
 * Result: N individual calls → 1 batch call.
 *
 * --- BATCHING MECHANISM ---
 * DataLoader collects keys until the next event-loop tick, then calls the batch
 * function. graphql-js invokes all sibling field resolvers before awaiting, so
 * every Post.author load() lands in the same tick.
 *
 * --- PER-REQUEST LIFECYCLE (critical) ---
 *   // WRONG — singleton caches stale data across requests
 *   const authorLoader = makeAuthorLoader();
 *   // CORRECT — fresh loader per request
 *   const makeContext = () => ({ authorLoader: makeAuthorLoader() });
 *
 * --- THE ORDERING CONTRACT ---
 * The batch function MUST return values in the same order as the input keys:
 *   const index = new Map(rows.map(r => [r.id, r]));
 *   return keys.map(k => index.get(k) ?? null);   // yes — same order
 *   return rows;                                   // no — DB order ≠ key order
 *
 * --- CACHING WITHIN A REQUEST ---
 * The loader caches by key for its lifetime: two fields asking for the same
 * author hit the cache, no second batch. Disable with `new DataLoader(fn, { cache:false })`.
 *
 * --- PASSING LOADERS VIA CONTEXT ---
 *   author: (post, _args, context) => context.authorLoader.load(post.authorId)
 *   // tests:   graphql({ schema, source, contextValue: makeContext() })
 *   // server:  graphql-http / Apollo `context: () => makeContext()`
 *
 * --- EXERCISES ---
 * 1. Log inside batchLoadAuthors and confirm it fires once for the posts query.
 * 2. assert db.BatchCounter.calls === 1 (vs 6 in section 02).
 * 3. Add a posts DataLoader keyed by authorId for an Author.posts field.
 * 4. Run the same query twice in ONE context — the cache means one batch total.
 */

const BATCH_FUNCTION_CONTRACT = {
  input: "array of keys requested this tick",
  output: "Promise<array of value|null>, same length and ORDER as input",
  why: "DataLoader matches result[i] to the caller of load(keys[i])",
};

export { BATCH_FUNCTION_CONTRACT };
