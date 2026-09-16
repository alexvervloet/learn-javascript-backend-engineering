/**
 * 03 · DataLoaders — solving N+1
 * ===============================
 *
 * Same schema as section 02, but Post.author now uses a DataLoader pulled from
 * the per-request context instead of querying the DB directly.
 *
 * When graphql-js resolves a list of posts, it invokes every Post.author
 * resolver synchronously (each returns a promise from loader.load). The
 * DataLoader accumulates all the authorId keys during that tick, then fires a
 * single batch query for all of them. 6 lookups → 1 batch call.
 */

import { makeExecutableSchema } from "@graphql-tools/schema";
import * as db from "./data.js";
import type { Author, Post } from "./data.js";
import type DataLoader from "dataloader";

// What makeContext() puts on every request. Naming it is what makes
// context.authorLoader.load() checkable inside the resolver.
interface GraphQLContext {
  authorLoader: DataLoader<string, Author | null>;
}
import { makeAuthorLoader } from "./loaders.js";

const typeDefs = /* GraphQL */ `
  type Author {
    id: ID!
    name: String!
    bio: String!
  }

  type Post {
    id: ID!
    title: String!
    body: String!
    author: Author
  }

  type Query {
    posts: [Post!]!
    post(id: ID!): Post
  }
`;

const resolvers = {
  Query: {
    posts: () => db.posts,
    post: (_p: unknown, { id }: { id: string }): Post | null =>
      db.posts.find((p) => p.id === id) ?? null,
  },
  Post: {
    // load() schedules a key for batching; all load() calls in one tick batch
    // together, and identical keys are de-duplicated by the loader's cache.
    author: (
      post: Post,
      _args: unknown,
      context: GraphQLContext
    ): Promise<Author | null> => context.authorLoader.load(post.authorId),
  },
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

// Create a fresh context (with a new DataLoader) for each request.
function makeContext() {
  return { authorLoader: makeAuthorLoader() };
}

export { schema, makeContext };
