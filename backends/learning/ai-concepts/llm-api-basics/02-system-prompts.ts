/**
 * System prompts (steering behavior) and multi-turn conversations.
 *
 * Run: `npx tsx 02-system-prompts.ts [anthropic|openai]`
 *
 * Two lessons here:
 *   1. The SAME user question gives very different answers depending on the system
 *      prompt. That's your main lever for controlling tone, format, and persona.
 *   2. The API is STATELESS. To have a "conversation", you keep a list of messages
 *      yourself and resend the whole thing each turn. Notice how the second call
 *      includes the first exchange — that's the only reason the model "remembers".
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

const SYSTEM = "You are a grumpy senior engineer. Answer correctly but tersely, with a sigh.";
const TURN_1 = "What is a database index?";
const TURN_2 = "Could it ever slow things down?"; // 'it' only makes sense if turn 1 is remembered

async function runAnthropic(): Promise<void> {
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

  // Anthropic: system is a TOP-LEVEL parameter, not a message.
  // Anthropic and OpenAI each define their own message-parameter type, and the
  // `role` in both is a fixed union rather than a string. Annotating the array
  // with the SDK type is what catches a typo like "assistent" — a plain array
  // literal infers `role: string` and no longer matches.
  const history: Anthropic.MessageParam[] = [{ role: "user", content: TURN_1 }];
  const r1 = await client.messages.create({ model, max_tokens: 1024, system: SYSTEM, messages: history });
  const a1 = r1.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  console.log("A1:", a1);

  // Append the assistant's reply + the next user turn, then resend EVERYTHING.
  history.push({ role: "assistant", content: a1 });
  history.push({ role: "user", content: TURN_2 });
  const r2 = await client.messages.create({ model, max_tokens: 1024, system: SYSTEM, messages: history });
  console.log("A2:", r2.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
}

async function runOpenAI(): Promise<void> {
  const client = new OpenAI();
  const model = process.env.OPENAI_MODEL || "gpt-4o";

  // OpenAI: system is the FIRST message in the list (role="system").
  const history: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: TURN_1 },
  ];
  const r1 = await client.chat.completions.create({ model, messages: history });
  const a1 = r1.choices[0].message.content;
  console.log("A1:", a1);

  history.push({ role: "assistant", content: a1 });
  history.push({ role: "user", content: TURN_2 });
  const r2 = await client.chat.completions.create({ model, messages: history });
  console.log("A2:", r2.choices[0].message.content);
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

export { runAnthropic, runOpenAI };
