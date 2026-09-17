/**
 * When structured output still goes wrong: validate, detect, retry.
 *
 * Run: `npx tsx 03-handling-failures.ts [anthropic|openai]`
 *
 * Schema enforcement removes most failures, but not all. In production you still
 * guard against:
 *   - INVALID DATA: a value that parses as JSON but fails your stricter rules
 *     (Zod's safeParse reports the error) -> retry with the error as feedback.
 *   - TRUNCATION: the model hit max_tokens mid-object -> the JSON is incomplete.
 *     Detect via the stop/finish reason, don't just let JSON.parse explode.
 *   - REFUSAL: the model declined for safety reasons -> there's no data to parse;
 *     surface it, don't retry the same prompt.
 *
 * To make the failure path visible, this example does NOT use schema-enforced
 * parsing — it asks for JSON, validates with Zod, and retries on invalid output,
 * feeding the validation error back to the model. That retry-on-invalid loop is a
 * useful pattern even when you do use enforcement.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import OpenAI from "openai";
import z from "zod";

// ESM has no __dirname. This is the equivalent.
const here = path.dirname(fileURLToPath(import.meta.url));

// dotenv has no ESM default-export config helper in this version, so the
// module is imported and its config() called explicitly. It must run before
// any client below reads an API key out of process.env.
dotenv.config({ path: path.join(here, "..", ".env"), quiet: true });

const Product = z.object({
  name: z.string(),
  price_usd: z.number().nonnegative({ message: "price_usd must be >= 0" }),
});

const BASE_PROMPT =
  'Return JSON with keys "name" (string) and "price_usd" (number) for: ' +
  "a mechanical keyboard that costs forty-nine dollars ninety-nine. Return ONLY JSON.";

/** Returns [text, stopReason]. stopReason flags refusal / truncation. */
async function call(provider: string, prompt: string) {
  if (provider === "anthropic") {
    const client = new Anthropic();
    const r = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });
    if (r.stop_reason === "refusal") return ["", "refusal"];
    const text = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return [text, r.stop_reason]; // "end_turn" normally, "max_tokens" if truncated
  }

  const client = new OpenAI();
  const r = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    max_tokens: 256,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
  const choice = r.choices[0];
  return [choice.message.content, choice.finish_reason]; // "stop" normally, "length" if truncated
}

function stripFences(text: string) {
  text = (text || "").trim();
  if (text.startsWith("```")) {
    text = text.split("```")[1].replace(/^json/, "").trim();
  }
  return text;
}

async function getProduct(provider: string, maxAttempts = 3): Promise<unknown> {
  let prompt = BASE_PROMPT;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const [text, reason] = await call(provider, prompt);

    if (reason === "refusal") throw new Error("model refused the request — not retrying");
    if (reason === "max_tokens" || reason === "length") {
      console.log(`  attempt ${attempt}: response truncated; raising max_tokens would help`);
    }

    let parsed;
    try {
      parsed = JSON.parse(stripFences(text ?? ""));
    } catch (err) {
      console.log(`  attempt ${attempt}: invalid (SyntaxError); feeding error back`);
      prompt = `${BASE_PROMPT}\n\nYour previous answer was invalid: ${err instanceof Error ? err.message : String(err)}\nFix it.`;
      continue;
    }

    const result = Product.safeParse(parsed);
    if (result.success) return result.data;

    const msg = result.error.issues.map((i) => i.message).join("; ");
    console.log(`  attempt ${attempt}: invalid (ZodError); feeding error back`);
    // Retry: tell the model exactly what was wrong with its last output.
    prompt = `${BASE_PROMPT}\n\nYour previous answer was invalid: ${msg}\nFix it.`;
  }

  throw new Error(`gave up after ${maxAttempts} attempts`);
}

function brief(err: unknown): string {
  const name = err instanceof Error ? err.constructor.name : "Error";
  const message = err instanceof Error ? err.message : String(err);
  return `${name}: ${message.split("\n")[0]?.slice(0, 110)}`;
}

async function main(): Promise<void> {
  const which = process.argv[2] || "both";
  for (const provider of ["anthropic", "openai"]) {
    if (which !== provider && which !== "both") continue;
    console.log(`\n=== ${provider} ===`);
    try {
      console.log("  got:", await getProduct(provider));
    } catch (err) {
      // Error (gave up / refusal) or API error (e.g. 429)
      console.log(`  [skipped — ${brief(err)}]`);
    }
  }
}

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { Product, getProduct };
