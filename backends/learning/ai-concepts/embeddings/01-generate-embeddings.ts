/**
 * Turn text into vectors and measure meaning-similarity.
 *
 * Run: `npx tsx 01-generate-embeddings.ts [openai|voyage]`
 *
 * We embed three sentences. Two mean the same thing in different words; the third is
 * unrelated. The cosine similarity between the two paraphrases should be clearly
 * higher than either's similarity to the unrelated one — meaning, not wording,
 * drives the score.
 *
 * Remember: there's no Anthropic embeddings endpoint, so the two providers here are
 * OpenAI and Voyage AI (the embedder Anthropic recommends). Voyage ships no official
 * JS SDK, so we call its REST endpoint directly with `fetch`.
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

const SENTENCES = [
  "How do I reset my password?", //          0
  "I forgot my login credentials.", //       1  (same meaning as 0)
  "The restaurant served great pasta.", //   2  (unrelated)
];

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
// fetch().json() is unknown — nothing guarantees a remote API's shape — so
// this interface is the claim being made about it, next to the call.
interface VoyageEmbeddingResponse {
  data: { embedding: number[] }[];
}

async function embedOpenAI(texts: string[]): Promise<number[][]> {
  const client = new OpenAI();
  const resp = await client.embeddings.create({
    model: process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small",
    input: texts,
  });
  return resp.data.map((d) => d.embedding);
}

// Voyage has no official JS SDK; call the REST endpoint directly.
async function embedVoyage(texts: string[]): Promise<number[][]> {
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

function brief(err: unknown): string {
  const name = err instanceof Error ? err.constructor.name : "Error";
  const message = err instanceof Error ? err.message : String(err);
  return `${name}: ${message.split("\n")[0]?.slice(0, 110)}`;
}

async function main(): Promise<void> {
  // Voyage is free; pass "both"/"openai" to include OpenAI.
  const which = process.argv[2] || "voyage";
  for (const [name, fn] of Object.entries({ openai: embedOpenAI, voyage: embedVoyage })) {
    if (which !== name && which !== "both") continue;
    console.log(`\n=== ${name} ===`);
    try {
      const vecs = await fn(SENTENCES);
      console.log(`  vector dimensions: ${vecs[0].length}`);
      console.log(`  sim(0,1) paraphrase : ${cosine(vecs[0], vecs[1]).toFixed(3)}`);
      console.log(`  sim(0,2) unrelated  : ${cosine(vecs[0], vecs[2]).toFixed(3)}`);
    } catch (err) {
      // e.g. missing/unfunded key
      console.log(`  [skipped — ${brief(err)}]`);
    }
  }
}

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { cosine, embedOpenAI, embedVoyage };
