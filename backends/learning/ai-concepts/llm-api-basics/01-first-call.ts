/**
 * The smallest possible LLM call, against both providers.
 *
 * Run: `npx tsx 01-first-call.ts [anthropic|openai]` (no arg = both).
 *
 * The point of this file: a request is just a list of role-tagged messages, and the
 * response is an object you dig the text out of. The two SDKs differ only in how
 * that object is shaped.
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
dotenv.config({ path: path.join(here, "..", ".env"), quiet: true }); // pulls API keys + model names from ../.e);

const PROMPT = "In one sentence, what is a backend engineer?";

async function callAnthropic() {
  console.log(`Using Anthropic model: ${process.env.ANTHROPIC_MODEL || "claude-opus-4-8"}`);
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  const resp = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
    max_tokens: 1024, // a hard cap on the *response* length, in tokens
    messages: [{ role: "user", content: PROMPT }],
  });
  // resp.content is a LIST of blocks (text, tool_use, ...). Grab the text ones.
  return resp.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

async function callOpenAI() {
  console.log(`Using OpenAI model: ${process.env.OPENAI_MODEL || "gpt-4o"}`);
  const client = new OpenAI(); // reads OPENAI_API_KEY from the environment
  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    messages: [{ role: "user", content: PROMPT }],
  });
  // OpenAI returns one or more "choices"; the text is on the first choice.
  return resp.choices[0].message.content;
}

// One-line summary of an error, for the `[skipped — …]` lines below.
function brief(err: unknown): string {
  const name = err instanceof Error ? err.constructor.name : "Error";
  const message = err instanceof Error ? err.message : String(err);
  return `${name}: ${message.split("\n")[0]?.slice(0, 110)}`;
}

async function main(): Promise<void> {
  const which = process.argv[2] || "both";
  const providers = { anthropic: callAnthropic, openai: callOpenAI };

  for (const [name, fn] of Object.entries(providers)) {
    if (which === name || which === "both") {
      console.log(`\n=== ${name} ===`);
      try {
        console.log(await fn());
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

export { callAnthropic, callOpenAI };
