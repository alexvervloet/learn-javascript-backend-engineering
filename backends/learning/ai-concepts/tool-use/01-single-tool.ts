/**
 * One tool, one round trip — the tool-use cycle spelled out by hand.
 *
 * Run: `npx tsx 01-single-tool.ts [anthropic|openai]`
 *
 * The model can't know live weather, so we give it a `get_weather` tool. Watch the
 * cycle: we send the question + tool definition; the model asks us to call
 * `get_weather(city=...)`; OUR code runs the (mocked) function; we send the result
 * back; the model writes the final natural-language answer.
 *
 * The model only ever *requests* the call. We execute it. That boundary is the whole
 * security story of tool use.
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

/** Pretend this hits a real weather API. Returns a string the model can read. */
function getWeather(city: string): string {
  // Keyed by a city the model chose, so Record is what allows the lookup.
  const fake: Record<string, string> = { Lisbon: "19°C, clear", Oslo: "3°C, snow" };
  return fake[city] || "unknown";
}

const QUESTION = "What's the weather in Lisbon? Reply in one sentence.";

async function runAnthropic(): Promise<void> {
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  const tools: Anthropic.Tool[] = [
    {
      name: "get_weather",
      description: "Get the current weather for a city.",
      input_schema: {
        type: "object",
        properties: { city: { type: "string", description: "City name" } },
        required: ["city"],
      },
    },
  ];
  // Anthropic and OpenAI each define their own message-parameter type, and the
  // `role` in both is a fixed union rather than a string. Annotating the array
  // with the SDK type is what catches a typo like "assistent" — a plain array
  // literal infers `role: string` and no longer matches.
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: QUESTION }];
  const r = await client.messages.create({ model, max_tokens: 512, tools, messages });
  console.log("stop_reason:", r.stop_reason); // -> "tool_use"

  // Echo the assistant's turn (including the tool_use block) back into history.
  messages.push({ role: "assistant", content: r.content });

  const results: Anthropic.ToolResultBlockParam[] = [];
  for (const block of r.content) {
    if (block.type === "tool_use") {
      console.log(`  model wants: ${block.name}(${JSON.stringify(block.input)})`);
      // block.input is `unknown`: the model produced it, so the shape the
      // tool expects is asserted here rather than assumed by the SDK.
      const { city } = block.input as { city: string };
      const output = getWeather(city);
      results.push({ type: "tool_result", tool_use_id: block.id, content: output });
    }
  }
  messages.push({ role: "user", content: results });

  const final = await client.messages.create({ model, max_tokens: 512, tools, messages });
  console.log("final:", final.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
}

async function runOpenAI(): Promise<void> {
  const client = new OpenAI();
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const tools: OpenAI.Chat.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "Get the current weather for a city.",
        parameters: {
          type: "object",
          properties: { city: { type: "string", description: "City name" } },
          required: ["city"],
        },
      },
    },
  ];
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: "user", content: QUESTION }];
  const r = await client.chat.completions.create({ model, tools, messages });
  const msg = r.choices[0]!.message;
  console.log("finish_reason:", r.choices[0]?.finish_reason); // -> "tool_calls"

  messages.push(msg); // the assistant message, carrying tool_calls
  // tool_calls is optional — the model may answer without calling anything —
  // and each entry is a union of a function call and a custom-tool call. Only
  // the function variant carries `.function`, so it is narrowed first.
  for (const tc of msg.tool_calls ?? []) {
    if (tc.type !== "function") continue;
    // Arguments arrive as a JSON string the model produced, so the parsed
    // shape is a claim rather than a guarantee.
    const args = JSON.parse(tc.function.arguments) as Record<string, string>;
    console.log(`  model wants: ${tc.function.name}(${JSON.stringify(args)})`);
    const output = getWeather(args.city ?? "");
    messages.push({ role: "tool", tool_call_id: tc.id, content: output });
  }

  const final = await client.chat.completions.create({ model, tools, messages });
  console.log("final:", final.choices[0]?.message.content);
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

export { getWeather, runAnthropic, runOpenAI };
