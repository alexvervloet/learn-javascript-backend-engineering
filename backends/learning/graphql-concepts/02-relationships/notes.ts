/**
 * 02 · Relationships & N+1 — Concepts
 * =====================================
 *
 * --- FIELD RESOLVERS ---
 * In schema-first JS, attach a function under the type name in the resolvers map:
 *   Post: { author: (post) => db.getAuthor(post.authorId) }
 * It receives the parent object and loads related data. Runs once per parent.
 *
 * --- "PRIVATE" FIELDS ---
 * To hide a foreign key from clients, just don't declare it in the SDL —
 * `authorId` lives on the parent object for resolvers to use, but isn't in the
 * schema, so clients can't select it.
 *
 * --- THE N+1 PROBLEM ---
 *   query { posts { title author { name } } }
 * Naive flow:
 *   1. resolve posts            → 1 logical query, 6 posts
 *   2. for EACH post, resolve author:
 *        getAuthor("a1"), getAuthor("a1"), getAuthor("a2"), … → 6 calls
 *   Total: 1 + 6 = 7 (here we only count the 6 author lookups).
 * With 100 posts it's 1 + 100. The "+1" is the list; the "N" is one lookup per item.
 *
 * The fix (section 03) is a DataLoader: batch all author IDs from the whole list
 * into ONE getAuthorsByIds([...]) call. 6 → 1.
 *
 * --- MEASURING N+1 ---
 * data.ts increments QueryCounter on every getAuthor/getPostsByAuthor call:
 *   db.reset();
 *   graphqlSync({ schema, source: "{ posts { author { name } } }" });
 *   expect(db.QueryCounter.calls).toBe(6);   // N+1
 *
 * --- EXERCISES ---
 * 1. Query posts WITHOUT author → QueryCounter.calls is 0. Add author → 6.
 * 2. Single post + author → 1 call.
 * 3. { authors { name posts { title } } } → 3 calls (one per author).
 * 4. Add a circular query (authors → posts → author). GraphQL follows resolvers
 *    to their natural end; guard real schemas with depth limiting.
 */

const N_PLUS_ONE_EXAMPLE = {
  query: "{ posts { author { name } } }",
  nPosts: 6,
  naive: "6 author lookups (one per post, duplicates included)",
  withDataLoader: "1 batch lookup",
};

export { N_PLUS_ONE_EXAMPLE };
