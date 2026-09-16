/**
 * 02 · Relationships & the N+1 Problem
 * =====================================
 *
 * How related types work in GraphQL, and why naive field resolvers cause the
 * N+1 query problem.
 *
 * In schema-first JS, a "field resolver" is just a function on the type in the
 * resolvers map. `Post.author` runs once per Post in the response; `Author.posts`
 * runs once per Author. The parent object is the first argument.
 *
 * Note on "private" fields: to carry a foreign key without exposing it, simply
 * *don't list* the field in the SDL. `authorId` lives on the parent object (so
 * resolvers can use it) but isn't in the schema, so clients can't request it.
 */

import { makeExecutableSchema } from "@graphql-tools/schema";
import * as db from "./data.js";
import type { Author, Post } from "./data.js";

const typeDefs = /* GraphQL */ `
  type Author {
    id: ID!
    name: String!
    bio: String!
    posts: [Post!]!
  }

  type Post {
    id: ID!
    title: String!
    body: String!
    author: Author
    # NOTE: authorId is intentionally absent — it's internal, not in the schema.
  }

  type Query {
    posts: [Post!]!
    post(id: ID!): Post
    authors: [Author!]!
    author(id: ID!): Author
  }
`;

const resolvers = {
  Query: {
    // Reading the seed arrays directly is not counted as a "DB call".
    posts: () => db.posts,
    post: (_p: unknown, { id }: { id: string }): Post | null =>
      db.posts.find((p) => p.id === id) ?? null,
    authors: () => db.authors,
    author: (_p: unknown, { id }: { id: string }): Author | null =>
      db.authors.find((a) => a.id === id) ?? null,
  },
  Author: {
    // Called once per Author when `posts` is requested — 3 authors = 3 calls.
    // The parent argument is the Author this field is being resolved on.
    posts: (author: Author): Post[] => db.getPostsByAuthor(author.id),
  },
  Post: {
    // Called once per Post when `author` is requested — 6 posts = 6 calls,
    // even though there are only 3 distinct authors. That's the N+1 problem.
    author: (post: Post): Author | null => db.getAuthor(post.authorId),
  },
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

export { schema };
