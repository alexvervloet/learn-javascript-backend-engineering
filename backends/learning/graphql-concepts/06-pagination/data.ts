/**
 * 100 posts seeded for pagination demos.
 */

interface Post {
  id: string;
  title: string;
  body: string;
  tags: string[];
}

const SEED: Post[] = Array.from({ length: 100 }, (_, i) => {
  const n = i + 1;
  return {
    id: String(n),
    title: `Post ${String(n).padStart(3, "0")}`,
    body: `Body of post ${n}`,
    tags: n % 2 === 0 ? ["javascript", "graphql"] : ["backend"],
  };
});

let posts: Post[] = SEED.map((r) => ({ ...r }));

function reset(): void {
  posts = SEED.map((r) => ({ ...r }));
}

// Cursors are opaque: clients must not parse or construct them. We base64-encode
// a stable "post:<id>" payload.
function encodeCursor(postId: string): string {
  return Buffer.from(`post:${postId}`).toString("base64");
}

function decodeCursor(cursor: string): string | undefined {
  const payload = Buffer.from(cursor, "base64").toString("utf8");
  return payload.split(":", 2)[1]; // "post:42" → "42"
}

reset();

// The CommonJS version exported a getter so importers always saw the current
// array after reset() reassigned it. ESM exports are live bindings, which does
// the same thing without the getter.
export { reset, encodeCursor, decodeCursor, posts };
export type { Post };
