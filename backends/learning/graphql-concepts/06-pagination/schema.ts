/**
 * 06 · Pagination — Offset and Cursor
 * =====================================
 *
 * Two pagination styles on the same 100-post dataset:
 *   A. Offset pagination — simple (offset + limit), but pages shift if items are
 *      inserted/removed between requests.
 *   B. Cursor pagination (Relay Connection) — stable pages even under concurrent
 *      mutations, because each page is anchored to an opaque cursor, not a count.
 *
 * Cursor pagination here follows the Relay Connection spec: edges (node +
 * cursor), PageInfo, `first`/`after`. This section implements it by hand so the
 * mechanics are visible.
 */

import { makeExecutableSchema } from "@graphql-tools/schema";
import * as db from "./data.js";
import type { Post } from "./data.js";

const typeDefs = /* GraphQL */ `
  type Post {
    id: ID!
    title: String!
    body: String!
    tags: [String!]!
  }

  # Pattern A — offset
  type PostPage {
    items: [Post!]!
    total: Int!
    hasNextPage: Boolean!
    hasPrevPage: Boolean!
  }

  # Pattern B — cursor (Relay Connection)
  type PageInfo {
    hasNextPage: Boolean!
    hasPrevPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type PostEdge {
    node: Post!
    cursor: String!
  }

  type PostConnection {
    edges: [PostEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type Query {
    postsPage(offset: Int = 0, limit: Int = 10): PostPage!
    postsConnection(first: Int = 10, after: String): PostConnection!
  }
`;

const resolvers = {
  Query: {
    // Pattern A: offset pagination.
    postsPage: (
      _p: unknown,
      { offset = 0, limit = 10 }: { offset?: number; limit?: number }
    ) => {
      const total = db.posts.length;
      const items = db.posts.slice(offset, offset + limit);
      return {
        items,
        total,
        hasNextPage: offset + limit < total,
        hasPrevPage: offset > 0,
      };
    },

    // Pattern B: cursor pagination (Relay Connection).
    postsConnection: (
      _p: unknown,
      { first = 10, after = null }: { first?: number; after?: string | null }
    ) => {
      const all = db.posts;
      const total = all.length;

      let startIndex = 0;
      if (after != null) {
        const afterId = db.decodeCursor(after);
        const idx = all.findIndex((p) => p.id === afterId);
        if (idx !== -1) startIndex = idx + 1;
      }

      const pageSize = first ?? 10;
      const page = all.slice(startIndex, startIndex + pageSize);
      const edges = page.map((p) => ({ node: p, cursor: db.encodeCursor(p.id) }));

      return {
        edges,
        totalCount: total,
        pageInfo: {
          hasNextPage: startIndex + pageSize < total,
          hasPrevPage: startIndex > 0,
          startCursor: edges.length ? edges[0].cursor : null,
          endCursor: edges.length ? edges[edges.length - 1].cursor : null,
        },
      };
    },
  },
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

export { schema };
