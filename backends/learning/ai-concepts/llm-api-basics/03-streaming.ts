/**
 * Streaming: print tokens as they arrive instead of waiting for the whole reply.
 *
 * Run: `npx tsx 03-streaming.ts [anthropic|openai]`
 *
 * Without streaming, the user stares at a frozen screen until the entire response is
 * generated — which can be many seconds for a long answer. Streaming delivers the
 * text token-by-token, so a UI (or a CLI like this one) can render it live. This is
 * the single biggest perceived-latency win in any LLM product.
 *
 * Both SDKs expose streaming as a stream of small chunks. Anthropic's `.stream()`
 * helper emits already-accumulated text via a `text` event; OpenAI yields raw deltas
 * you iterate over with `for await`.
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

const PROMPT = "Explain how a TCP handshake works, in about 4 sentences.";

async function streamAnthropic() {
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: PROMPT }],
  });
  // The `text` event fires with each already-decoded text delta.
  stream.on("text", (delta) => process.stdout.write(delta));
  await stream.finalMessage(); // wait for the stream to finish
  process.stdout.write("\n");
}

async function streamOpenAI() {
  const client = new OpenAI();
  const stream = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    messages: [{ role: "user", content: PROMPT }],
    stream: true,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content; // may be null on the first/last chunk
    if (delta) process.stdout.write(delta);
  }
  process.stdout.write("\n");
}

function brief(err: unknown): string {
  const name = err instanceof Error ? err.constructor.name : "Error";
  const message = err instanceof Error ? err.message : String(err);
  return `${name}: ${message.split("\n")[0]?.slice(0, 110)}`;
}

async function main(): Promise<void> {
  const which = process.argv[2] || "both";
  for (const [name, fn] of Object.entries({ anthropic: streamAnthropic, openai: streamOpenAI })) {
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

export { streamAnthropic, streamOpenAI };
