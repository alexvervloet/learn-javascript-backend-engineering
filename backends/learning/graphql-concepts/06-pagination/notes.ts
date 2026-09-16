/**
 * 06 · Pagination — Concepts
 * ===========================
 *
 * --- PATTERN A: OFFSET ---
 *   postsPage(offset: 10, limit: 10) → items[10..20), total, hasNextPage, hasPrevPage
 * Simple and lets clients jump to any page. Downside: if items are inserted or
 * removed between requests, offsets shift and you skip or repeat rows.
 *
 * --- PATTERN B: CURSOR (Relay Connection) ---
 *   postsConnection(first: 10, after: "<cursor>") {
 *     edges { node { ... } cursor }
 *     pageInfo { hasNextPage endCursor }
 *     totalCount
 *   }
 * Each edge carries an opaque cursor (here base64 of "post:<id>"). The next page
 * is `after: endCursor`. Anchoring to a stable id keeps pages correct under
 * concurrent inserts/deletes. `first`/`after` page forward; `last`/`before` back.
 *
 * --- CURSORS ARE OPAQUE ---
 * Clients must treat cursors as black boxes — never parse or build them. The
 * server owns the encoding and can change it. We base64-encode a stable id.
 *
 * --- EXERCISES ---
 * 1. Page through all 100 posts in batches of 10 using endCursor; the last page
 *    reports hasNextPage: false.
 * 2. Decode a cursor and confirm it round-trips to "post:<id>".
 * 3. Add `last`/`before` backward pagination to postsConnection.
 * 4. Compare: delete post 5, then re-page offset vs cursor — cursor stays stable.
 */

const PAGINATION_STYLES = {
  offset: { args: "offset, limit", pro: "jump to any page", con: "shifts under concurrent writes" },
  cursor: { args: "first, after", pro: "stable pages", con: "no random page access" },
};

export { PAGINATION_STYLES };
