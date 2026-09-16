/**
 * Chain-of-thought: make the model reason before it answers.
 *
 * Run: `npx tsx 02-chain-of-thought.ts [anthropic|openai]`
 *
 * We ask a small multi-step word problem two ways:
 *   - "answer only" — the model blurts a number and often gets it wrong.
 *   - "think step by step, then give the answer on a final line" — it works through
 *     the steps and lands the right number far more often.
 *
 * CoT trades tokens and latency for accuracy. Use it when correctness on reasoning
 * matters more than speed. (Newer "reasoning" models do this internally; CoT
 * prompting is how you get the same effect from a standard chat model.)
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

const PROBLEM =
  "A server handles 1,200 requests/minute. 35% are cache hits taking 2ms each; " +
  "the rest miss and take 50ms each. What is the average response time in ms? ";

const ANSWER_ONLY = PROBLEM + "Respond with only the number.";
const COT = PROBLEM + "Think step by step. Put the final number on its own last line prefixed with 'ANSWER: '.";

async function chat(provider: string, user: string) {
  if (provider === "anthropic") {
    const client = new Anthropic();
    const r = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
      max_tokens: 1024,
      messages: [{ role: "user", content: user }],
    });
    return r.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  }

  const client = new OpenAI();
  const r = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    max_tokens: 1024,
    messages: [{ role: "user", content: user }],
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
  // Correct answer: 0.35*2 + 0.65*50 = 0.7 + 32.5 = 33.2 ms
  const which = process.argv[2] || "both";
  for (const provider of ["anthropic", "openai"]) {
    if (which !== provider && which !== "both") continue;
    console.log(`\n=== ${provider} ===  (correct answer: 33.2)`);
    try {
      console.log("  answer-only :", await chat(provider, ANSWER_ONLY));
      const cot = await chat(provider, COT);
      // The reasoning is useful to read, but a program only wants the final line.
      const final = cot.split("\n").pop();
      console.log("  chain-of-thought final line:", final);
    } catch (err) {
      // e.g. unfunded key -> 429 insufficient_quota
      console.log(`  [skipped — ${brief(err)}]`);
    }
  }
}

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { chat };
