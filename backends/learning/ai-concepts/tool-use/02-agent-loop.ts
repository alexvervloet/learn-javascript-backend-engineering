/**
 * The agent loop: keep calling tools until the model is done.
 *
 * Run: `npx tsx 02-agent-loop.ts [anthropic|openai]`
 *
 * 01 did a single round trip. Real tasks need several: the model calls a tool, sees
 * the result, decides it needs another, and so on. The `while` loop here keeps going
 * until the model stops asking for tools and produces a final answer.
 *
 * The question ("How many more people live in Japan than Canada?") forces at least
 * two `get_population` calls, so you can watch the loop iterate. This loop, with a
 * richer tool set, is exactly what a coding agent or a research agent runs.
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

// --- The tools, as plain functions. Shared by both providers. ----------------
// Keyed by a country the model chose, so Record is what allows the lookup.
const POP: Record<string, number> = {
  Japan: 124_000_000,
  Canada: 39_000_000,
  Brazil: 203_000_000,
};

function getPopulation(country: string): string {
  return String(POP[country] ?? "unknown");
}

// The dispatch table the agent loop looks tool names up in. The model chooses
// the name, so a miss has to be handled.
const TOOLS: Record<string, (arg: string) => string> = { get_population: getPopulation };

// JSON Schema for the arguments — identical content, wrapped differently per SDK.
const SCHEMA: Anthropic.Tool.InputSchema = {
  type: "object",
  properties: { country: { type: "string" } },
  required: ["country"],
};
const QUESTION = "How many more people live in Japan than Canada? Show the final number.";

async function runAnthropic(): Promise<void> {
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  const tools: Anthropic.Tool[] = [{ name: "get_population", description: "Population of a country.", input_schema: SCHEMA }];
  // Anthropic and OpenAI each define their own message-parameter type, and the
  // `role` in both is a fixed union rather than a string. Annotating the array
  // with the SDK type is what catches a typo like "assistent" — a plain array
  // literal infers `role: string` and no longer matches.
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: QUESTION }];

  for (;;) {
    const r = await client.messages.create({ model, max_tokens: 1024, tools, messages });
    if (r.stop_reason !== "tool_use") {
      console.log("final:", r.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
      return;
    }

    messages.push({ role: "assistant", content: r.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of r.content) {
      if (block.type === "tool_use") {
        console.log(`  call: ${block.name}(${JSON.stringify(block.input)})`);
        // block.input is `unknown`: the model produced it, so the shape the
        // tool expects is asserted here rather than assumed by the SDK.
        const { country } = block.input as { country: string };
        const tool = TOOLS[block.name];
        if (!tool) throw new Error(`Model asked for an unknown tool: ${block.name}`);
        const output = tool(country);
        results.push({ type: "tool_result", tool_use_id: block.id, content: output });
      }
    }
    messages.push({ role: "user", content: results });
  }
}

async function runOpenAI(): Promise<void> {
  const client = new OpenAI();
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const tools: OpenAI.Chat.ChatCompletionTool[] = [
    {
      type: "function",
      function: { name: "get_population", description: "Population of a country.", parameters: SCHEMA },
    },
  ];
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: "user", content: QUESTION }];

  for (;;) {
    const r = await client.chat.completions.create({ model, tools, messages });
    const msg = r.choices[0]!.message;
    if (!msg.tool_calls) {
      console.log("final:", msg.content);
      return;
    }

    messages.push(msg);
    // tool_calls is optional — the model may answer without calling anything —
  // and each entry is a union of a function call and a custom-tool call. Only
  // the function variant carries `.function`, so it is narrowed first.
  for (const tc of msg.tool_calls ?? []) {
    if (tc.type !== "function") continue;
      // Arguments arrive as a JSON string the model produced, so the parsed
    // shape is a claim rather than a guarantee.
    const args = JSON.parse(tc.function.arguments) as Record<string, string>;
      console.log(`  call: ${tc.function.name}(${JSON.stringify(args)})`);
      const output = TOOLS[tc.function.name](args.country);
      messages.push({ role: "tool", tool_call_id: tc.id, content: output });
    }
  }
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

export { getPopulation, runAnthropic, runOpenAI };
