// Seed the articles.db with sample data. Run once before main.ts:  npx tsx seed.ts

import { db } from "./db.js";

const TITLES = [
  "Understanding Async Programming in JavaScript",
  "A Beginner's Guide to SQL Indexes",
  "How Vector Databases Work",
  "REST vs GraphQL: When to Use Each",
  "Pagination Patterns for APIs",
  "Intro to Database Normalization",
  "How to Use PostgreSQL Window Functions",
  "Building a Rate Limiter from Scratch",
  "Caching Strategies for Web APIs",
  "JWT vs Session Tokens Explained",
  "Getting Started with Docker",
  "A Practical Guide to Git Rebasing",
  "Understanding the Event Loop",
  "Type Safety in JS with TypeScript",
  "When to Denormalize Your Database",
  "Writing Testable Code in Express",
  "How Indexes Actually Speed Up Queries",
  "Intro to Message Queues with Redis",
  "Designing a Good REST API",
  "Why Connection Pools Matter",
  "How to Debug Slow SQL Queries",
  "Background Jobs in Node",
  "Choosing the Right Database for Your App",
  "Zod vs Joi for Validation",
  "An Introduction to HNSW Indexes",
  "Understanding HTTP Caching Headers",
  "Soft Delete Patterns in SQL",
  "How to Store Passwords Safely",
  "The N+1 Query Problem Explained",
  "ACID Transactions in Plain English",
  "Intro to Full-Text Search",
  "Cursor vs Offset Pagination",
  "Database Migrations Without Downtime",
  "Building a CLI Tool with Commander",
  "Understanding OAuth 2.0 Flows",
  "How to Write a Good README",
  "Node Logging Best Practices",
  "Load Testing Your API with k6",
  "Dependency Injection in Node",
  "Why You Should Use Database Constraints",
  "An Intro to Time-Series Databases",
  "How Bloom Filters Work",
  "Optimistic vs Pessimistic Locking",
  "Building a Webhook System",
  "Structured Logging in Node",
  "Foreign Keys and Referential Integrity",
  "Writing SQL Migrations You Can Roll Back",
  "What Is a Materialized View?",
  "How to Profile a Node Application",
  "Rate Limiting with Token Buckets",
];

const AUTHORS = ["alice", "bob", "carol", "dave", "eve"];
const COMMENT_BODIES = [
  "Great write-up, learned a lot!",
  "Could you go deeper on the tradeoffs?",
  "This helped me fix a bug I've had for weeks.",
  "I'd love a follow-up post on this.",
  "Bookmarked. Coming back to this one.",
  "The diagram really clarified things.",
  "Any recommendations for further reading?",
  "Ran into this exact issue yesterday.",
  "The cursor pagination section was eye-opening.",
];

// Generic over the element type, so pick(TITLES) is a string and the caller
// does not lose that by going through a helper.
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)] as T;
const sample = <T,>(arr: T[], k: number): T[] =>
  [...arr].sort(() => Math.random() - 0.5).slice(0, k);

function main(): void {
  db.exec("DELETE FROM comments; DELETE FROM articles;");
  const now = Date.now();

  const insertArticle = db.prepare(
    "INSERT INTO articles (title, body, author, published_at, view_count) VALUES (?, ?, ?, ?, ?)"
  );
  const insertComment = db.prepare("INSERT INTO comments (article_id, author, body) VALUES (?, ?, ?)");

  const seedAll = db.transaction(() => {
    let commentCount = 0;
    TITLES.forEach((title, i) => {
      const publishedAt = new Date(now - (TITLES.length - i) * 86400_000 - Math.random() * 86400_000).toISOString();
      const body = `This is the full body of the article titled '${title}'. `.repeat(3);
      const { lastInsertRowid } = insertArticle.run(title, body, pick(AUTHORS), publishedAt, Math.floor(Math.random() * 4990) + 10);
      for (const commentBody of sample(COMMENT_BODIES, Math.floor(Math.random() * 4) + 1)) {
        insertComment.run(lastInsertRowid, pick(AUTHORS), commentBody);
        commentCount += 1;
      }
    });
    return commentCount;
  });

  const commentCount = seedAll();
  console.log(`Seeded ${TITLES.length} articles and ${commentCount} comments.`);
}

main();
