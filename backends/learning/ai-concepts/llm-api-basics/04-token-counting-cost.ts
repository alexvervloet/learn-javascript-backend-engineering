/**
 * Counting tokens and estimating cost.
 *
 * Run: `npx tsx 04-token-counting-cost.ts [anthropic|openai]`
 *
 * You pay per token — both for what you send (input) and what you get back
 * (output), at different rates. Two skills matter:
 *
 *   1. Counting tokens BEFORE you send, so you can reject an over-budget request or
 *      pick a cheaper model. Anthropic has a dedicated `countTokens` endpoint.
 *      OpenAI doesn't expose one in the SDK — you'd count locally with a tokenizer
 *      library (e.g. `js-tiktoken`). NOTE: tiktoken is OpenAI's tokenizer and is
 *      WRONG for Claude — never use it to estimate Anthropic tokens; use the
 *      countTokens endpoint.
 *   2. Reading actual usage AFTER the call (`usage` on the response) and turning it
 *      into dollars.
 *
 * Prices below are illustrative and change often — always check the provider's
 * pricing page. They live here only to show the arithmetic.
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
dotenv.config({ path: path.join(here, "..", ".env"), quiet: true });

const PROMPT = "Summarize the CAP theorem for a backend engineer in 3 bullet points.";

// USD per 1,000,000 tokens (input, output). Illustrative — verify current pricing.
// Dollars per million tokens. Record keyed by provider name, so a lookup with
// an unknown provider has to be handled rather than silently undefined.
interface Price {
  input: number;
  output: number;
}

// Dollars per million tokens, matching the models this module defaults to. These
// go stale — the arithmetic below is the point, not the numbers.
const PRICES: Record<string, Price> = {
  anthropic: { input: 1.0, output: 5.0 }, // claude-haiku-4-5
  openai: { input: 0.75, output: 4.5 }, // gpt-5.4-mini
};

function dollars(provider: string, inTok: number, outTok: number): number {
  const p = PRICES[provider];
  if (!p) throw new Error(`No pricing for provider: ${provider}`);
  return (inTok * p.input + outTok * p.output) / 1_000_000;
}

async function runAnthropic(): Promise<void> {
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
  // Anthropic and OpenAI each define their own message-parameter type, and the
  // `role` in both is a fixed union rather than a string. Annotating the array
  // with the SDK type is what catches a typo like "assistent" — a plain array
  // literal infers `role: string` and no longer matches.
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: PROMPT }];

  // Pre-flight: ask the API exactly how many input tokens this will be.
  const pre = await client.messages.countTokens({ model, messages });
  console.log(`pre-flight input tokens: ${pre.input_tokens}`);

  const resp = await client.messages.create({ model, max_tokens: 1024, messages });
  const u = resp.usage; // real usage, billed
  console.log(`actual: in=${u.input_tokens} out=${u.output_tokens}`);
  console.log(`estimated cost: $${dollars("anthropic", u.input_tokens, u.output_tokens).toFixed(6)}`);
}

async function runOpenAI(): Promise<void> {
  const client = new OpenAI();
  const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";

  // OpenAI has no token-counting endpoint. For a true pre-flight count you'd use a
  // local tokenizer (js-tiktoken). Here we just read usage off the response after.
  const resp = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: PROMPT }],
  });
  // usage is optional on the response — a streamed call may omit it.
  const u = resp.usage;
  if (!u) {
    console.log("no usage reported");
    return;
  }
  console.log(`actual: in=${u.prompt_tokens} out=${u.completion_tokens}`);
  console.log(
    `estimated cost: $${dollars("openai", u.prompt_tokens, u.completion_tokens).toFixed(6)}`
  );
}

function brief(err: unknown): string {
  const name = err instanceof Error ? err.constructor.name : "Error";
  const message = err instanceof Error ? err.message : String(err);
  return `${name}: ${message.split("\n")[0]?.slice(0, 110)}`;
}

async function main(): Promise<void> {
  const which = process.argv[2] || "both";
  for (const [name, fn] of Object.entries({ anthropic: runAnthropic, openai: runOpenAI })) {
    if (which === name || which === "both") {
      console.log(`\n=== ${name} ===`);
      try {
        await fn();
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

export { dollars, runAnthropic, runOpenAI };
