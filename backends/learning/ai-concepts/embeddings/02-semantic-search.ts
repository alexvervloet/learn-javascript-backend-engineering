/**
 * Semantic search: rank a corpus by meaning, not keyword overlap.
 *
 * Run: `npx tsx 02-semantic-search.ts [openai|voyage]`
 *
 * We embed a small "knowledge base" once, embed a query, and rank documents by
 * cosine similarity to the query. Note the winning document for "my card was
 * declined" shares almost no words with the query — keyword search would miss it;
 * semantic search finds it because the *meaning* matches.
 *
 * This is the retrieval step of RAG, in miniature. At scale you'd store the document
 * vectors in a vector database (see ../../database-concepts/pgvector-demo/) instead
 * of a JavaScript array, but the ranking idea is identical.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import OpenAI from "openai";

// ESM has no __dirname. This is the equivalent.
const here = path.dirname(fileURLToPath(import.meta.url));

// dotenv has no ESM default-export config helper in this version, so the
// module is imported and its config() called explicitly. It must run before
// any client below reads an API key out of process.env.
dotenv.config({ path: path.join(here, "..", ".env") });

const CORPUS = [
  "To return an item, visit your orders page and click 'Start a return'.",
  "Payment failures are usually caused by an expired or blocked card.",
  "Our office is open Monday to Friday, 9am to 5pm.",
  "You can change your notification settings under Account > Preferences.",
];
const QUERY = "my card was declined at checkout";

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Voyage has no official JS SDK, so its REST response is parsed by hand.
// fetch().json() is unknown — nothing guarantees a remote API's shape — so this
// interface is the claim being made about it, next to the call.
interface VoyageEmbeddingResponse {
  data: { embedding: number[] }[];
}

async function embed(provider: string, texts: string[]): Promise<number[][]> {
  if (provider === "openai") {
    const client = new OpenAI();
    const resp = await client.embeddings.create({
      model: process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small",
      input: texts,
    });
    return resp.data.map((d) => d.embedding);
  }

  // Voyage has no official JS SDK; call the REST endpoint directly.
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY is not set");
  const resp = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: texts,
      model: process.env.VOYAGE_EMBED_MODEL || "voyage-3",
      input_type: "document",
    }),
  });
  if (!resp.ok) throw new Error(`Voyage API ${resp.status}: ${(await resp.text()).slice(0, 110)}`);
  const json = (await resp.json()) as VoyageEmbeddingResponse;
  return json.data.map((d) => d.embedding);
}

// One scored document. A plain [number, string] array would have inferred as
// (number | string)[], which is why score.toFixed() below stopped compiling —
// the tuple had lost which element was which.
interface Hit {
  score: number;
  doc: string;
}

async function search(provider: string): Promise<void> {
  // Embed corpus + query together, then score each doc against the query.
  const vectors = await embed(provider, [...CORPUS, QUERY]);
  const queryVec = vectors.at(-1);
  if (!queryVec) throw new Error("No query vector returned");
  const docVecs = vectors.slice(0, -1);

  const ranked: Hit[] = docVecs
    .map((dv, i) => ({ score: cosine(queryVec, dv), doc: CORPUS[i] ?? "" }))
    .sort((a, b) => b.score - a.score);

  console.log(`  query: "${QUERY}"`);
  for (const { score, doc } of ranked) {
    console.log(`    ${score.toFixed(3)}  ${doc}`);
  }
}

function brief(err: unknown): string {
  const name = err instanceof Error ? err.constructor.name : "Error";
  const message = err instanceof Error ? err.message : String(err);
  return `${name}: ${message.split("\n")[0]?.slice(0, 110)}`;
}

async function main(): Promise<void> {
  // Voyage is free; pass "both"/"openai" to include OpenAI.
  const which = process.argv[2] || "voyage";
  for (const provider of ["openai", "voyage"]) {
    if (which === provider || which === "both") {
      console.log(`\n=== ${provider} ===`);
      try {
        await search(provider);
      } catch (err) {
        // e.g. missing/unfunded key
        console.log(`  [skipped — ${brief(err)}]`);
      }
    }
  }
}

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { cosine, embed, search };
