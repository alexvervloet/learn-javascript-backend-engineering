// Seed users and comments (no embeddings yet). Run: npx tsx seed.ts (after setup.js)

import { pool } from "./db.js";

async function main() {
  await pool.query("DELETE FROM comments");
  await pool.query("DELETE FROM users");

  // Keyed by username, so Record is what allows the lookup below.
  const ids: Record<string, number> = {};
  const people: [string, string][] = [
    ["alice", "alice@example.com"],
    ["bob", "bob@example.com"],
    ["carol", "carol@example.com"],
  ];
  for (const [username, email] of people) {
    const row = (
      await pool.query<{ id: number }>(
        "INSERT INTO users (username, email) VALUES ($1,$2) RETURNING id",
        [username, email]
      )
    ).rows[0];
    if (row) ids[username] = row.id;
  }

  const comments: [string, string][] = [
    ["alice", "I love hiking in the mountains. The fresh air and views are incredible."],
    ["alice", "Just finished reading a great sci-fi novel. Highly recommend it to everyone."],
    ["bob", "The new coffee shop downtown has amazing espresso. Worth the visit."],
    ["bob", "JavaScript's type system with TypeScript has made my code much easier to maintain."],
    ["bob", "Tried a new pasta recipe last night. Turned out better than expected."],
    ["carol", "Machine learning is transforming how we approach data analysis."],
    ["carol", "The weather this weekend was perfect for outdoor activities."],
    ["carol", "Vector databases are a fascinating tool for semantic search applications."],
    ["alice", "I spent the afternoon gardening. Planted tomatoes and basil."],
    ["carol", "Neural networks can find patterns in data that humans would never notice."],
  ];
  for (const [username, body] of comments) {
    // eslint-disable-next-line no-await-in-loop
    await pool.query("INSERT INTO comments (user_id, body) VALUES ($1,$2)", [ids[username], body]);
  }

  console.log(`Seeded 3 users and ${comments.length} comments (no embeddings yet).`);
  await pool.end();
}

main().catch((err) => {
  console.error("ERROR (is Postgres running?):", err.message);
  process.exit(1);
});
