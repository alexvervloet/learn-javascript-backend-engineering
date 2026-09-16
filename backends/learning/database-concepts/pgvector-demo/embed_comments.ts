/**
 * Embed all un-embedded comments with a local Ollama model, then run a semantic
 * similarity search.
 *
 * Before running:
 *   1. Install Ollama: https://ollama.com
 *   2. ollama pull nomic-embed-text
 *   3. Ollama must be running (it starts automatically on macOS after install)
 *
 * Usage:
 *   npx tsx embed_comments.ts                          # nomic-embed-text (768-dim)
 *   npx tsx embed_comments.ts --model mxbai-embed-large
 *   npx tsx embed_comments.ts --search "something hilarious"
 */

import { Ollama } from "ollama";
import { pool, toSql } from "./db.js";

const EMBEDDING_DIM = 768;
const ollama = new Ollama();

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { model: "nomic-embed-text", search: "vector similarity search" };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--model") opts.model = args[++i];
    else if (args[i] === "--search") opts.search = args[++i];
  }
  return opts;
}

async function getEmbedding(text: string, model: string): Promise<number[]> {
  const res = await ollama.embed({ model, input: text });
  // ollama.embed returns one vector per input; we send exactly one.
  const vector = res.embeddings[0];
  if (!vector) throw new Error("Ollama returned no embedding");
  if (vector.length !== EMBEDDING_DIM) {
    throw new Error(
      `Model '${model}' returned ${vector.length}-dim vectors, but the column expects ${EMBEDDING_DIM}. ` +
        "Change the vector(N) size in setup.js and re-run setup + embed."
    );
  }
  return vector;
}

async function main() {
  const { model, search } = parseArgs();

  // 1. Embed any comments that don't have an embedding yet.
  const pending = (await pool.query("SELECT id, body FROM comments WHERE embedding IS NULL ORDER BY id")).rows;
  if (pending.length === 0) {
    console.log("All comments already have embeddings.");
  } else {
    console.log(`Embedding ${pending.length} comments with model '${model}'...`);
    for (const c of pending) {
      // eslint-disable-next-line no-await-in-loop
      const vector = await getEmbedding(c.body, model);
      // eslint-disable-next-line no-await-in-loop
      await pool.query("UPDATE comments SET embedding = $1 WHERE id = $2", [toSql(vector), c.id]);
      console.log(`  comment ${c.id}: ${JSON.stringify(c.body.slice(0, 60))}`);
    }
    console.log(`Done. ${pending.length} comments embedded.\n`);
  }

  // 2. Semantic similarity search — cosine distance via the <=> operator.
  console.log(`Top 5 comments most similar to: ${JSON.stringify(search)}\n`);
  const queryVec = await getEmbedding(search, model);
  const { rows } = await pool.query(
    `SELECT body, embedding <=> $1 AS distance FROM comments
     WHERE embedding IS NOT NULL ORDER BY distance LIMIT 5`,
    [toSql(queryVec)]
  );
  for (const r of rows) {
    console.log(`  ${Number(r.distance).toFixed(4)}  ${r.body}`);
  }
  console.log("\n  Lower cosine distance = more semantically similar (keyword overlap not required).");

  await pool.end();
}

main().catch((err) => {
  console.error(`\nFailed (is Postgres+pgvector up and Ollama running with the model pulled?):\n  ${err instanceof Error ? err.message : String(err)}`);
  console.error("  ollama pull nomic-embed-text");
  process.exit(1);
});
