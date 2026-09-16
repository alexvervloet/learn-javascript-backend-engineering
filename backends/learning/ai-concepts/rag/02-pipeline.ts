/**
 * End-to-end RAG: retrieve relevant context, then generate a grounded answer.
 *
 * Run: `npx tsx 02-pipeline.ts [anthropic|openai]`
 *
 * The full loop:
 *   1. INDEX  — embed each document chunk (Voyage embeddings, free tier) and keep them.
 *   2. RETRIEVE — embed the question, score every chunk by cosine similarity, take
 *      the top few.
 *   3. AUGMENT — build a prompt containing ONLY those chunks as context, with a rule:
 *      answer from the context, and say "I don't know" if it isn't there.
 *   4. GENERATE — call the model (Claude and/or GPT) to write the answer.
 *
 * The question asks about a company-specific policy the model was never trained on.
 * Without retrieval it would guess; with retrieval it answers correctly — and for a
 * question outside the context, the "I don't know" rule curbs hallucination.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import OpenAI from "openai";

// ESM has no __dirname. This is the equivalent.
const here = path.dirname(fileURLToPath(import.meta.url));

// dotenv has no ESM default-export config helper in this version, so the
// module is imported and its config() called explicitly. It must run before
// any client below reads an API key out of process.env.
dotenv.config({ path: path.join(here, "..", ".env") });

const KNOWLEDGE_BASE = [
  "Acme Cloud's free tier includes 5 GB of storage and 100 GB of monthly bandwidth.",
  "Acme Cloud paid plans start at $12/month for the Pro tier with 1 TB of storage.",
  "Support response time is under 4 hours for Pro customers and 24 hours on free.",
  "Acme Cloud stores all data encrypted at rest using AES-256.",
  "The Acme Cloud API is rate limited to 600 requests per minute per account.",
];
const QUESTION = "What's the API rate limit, and how much storage does the free tier give me?";

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

// Retrieval uses Voyage (Anthropic-recommended embeddings, generous free tier),
// so the whole pipeline runs without an OpenAI key. Swap to OpenAI's
// client.embeddings.create if you prefer — the pipeline is identical either way.
// Voyage has no official JS SDK, so its REST response is parsed by hand.
// fetch().json() is unknown — nothing guarantees a remote API's shape — so this
// interface is the claim being made about it, next to the call.
interface VoyageEmbeddingResponse {
  data: { embedding: number[] }[];
}

async function embed(texts: string[]): Promise<number[][]> {
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

// One retrieved document and its similarity score. An array of
// [number, string] would infer as (number | string)[] and lose which is which.
interface Hit {
  score: number;
  doc: string;
}

async function retrieve(question: string, k = 2): Promise<string[]> {
  const vectors = await embed([...KNOWLEDGE_BASE, question]);
  const qVec = vectors.at(-1);
  if (!qVec) throw new Error("No query vector returned");
  const docVecs = vectors.slice(0, -1);
  const ranked: Hit[] = docVecs.map((d, i) => ({
    score: cosine(qVec, d),
    doc: KNOWLEDGE_BASE[i] ?? "",
  }));
  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ doc }) => doc);
}

function buildPrompt(question: string, context: string[]): string {
  const joined = context.map((c) => `- ${c}`).join("\n");
  return (
    "Answer the question using ONLY the context below. " +
    'If the answer is not in the context, say "I don\'t know".\n\n' +
    `Context:\n${joined}\n\nQuestion: ${question}`
  );
}

async function generate(provider: string, prompt: string) {
  if (provider === "anthropic") {
    const client = new Anthropic();
    const r = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    return r.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  }

  const client = new OpenAI();
  const r = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });
  // The content of a choice is nullable — a refusal or a tool call leaves it
  // empty — so it is defaulted rather than assumed.
  return (r.choices[0]?.message.content ?? "").trim();
}

function brief(err: unknown): string {
  const name = err instanceof Error ? err.constructor.name : "Error";
  const message = err instanceof Error ? err.message : String(err);
  return `${name}: ${message.split("\n")[0]?.slice(0, 110)}`;
}

async function main(): Promise<void> {
  const which = process.argv[2] || "both";

  let context;
  try {
    context = await retrieve(QUESTION, 2); // Voyage embeddings — provider-independent
  } catch (err) {
    // e.g. missing Voyage key
    console.log(`[retrieval skipped — ${brief(err)}]`);
    return;
  }
  console.log("retrieved context:");
  for (const c of context) console.log("  -", c);
  const prompt = buildPrompt(QUESTION, context);

  for (const provider of ["anthropic", "openai"]) {
    if (which === provider || which === "both") {
      console.log(`\n=== ${provider} ===`);
      try {
        console.log(await generate(provider, prompt));
      } catch (err) {
        // e.g. unfunded key -> 429 insufficient_quota
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

export { cosine, embed, retrieve, buildPrompt, generate };
