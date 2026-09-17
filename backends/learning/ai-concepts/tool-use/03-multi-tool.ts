/**
 * Multiple tools: the model chooses which (and how many) to call.
 *
 * Run: `npx tsx 03-multi-tool.ts [anthropic|openai]`
 *
 * Give the model a small toolbox — `get_weather`, `convert_currency` — and a
 * question that needs both. The model decides which tools are relevant and calls
 * them (often both in a single turn). Your loop doesn't change; it just dispatches
 * by name from a registry. That's how you scale from one tool to twenty: add to the
 * registry and the schema list, leave the loop alone.
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

// Each tool takes a single args object, so the loop can dispatch uniformly.
// The model fills these in, so each one describes what the tool needs and the
// dispatch below asserts the incoming object matches.
interface WeatherArgs {
  city: string;
}

interface CurrencyArgs {
  amount: number;
  from_ccy: string;
  to_ccy: string;
}

function getWeather({ city }: WeatherArgs): string {
  const fake: Record<string, string> = { Tokyo: "22°C, humid", Paris: "14°C, rain" };
  return fake[city] || "unknown";
}

function convertCurrency({ amount, from_ccy, to_ccy }: CurrencyArgs): string {
  const rates: Record<string, number> = { "USD->JPY": 157.0, "USD->EUR": 0.92 };
  const rate = rates[`${from_ccy}->${to_ccy}`];
  return rate === undefined ? "unknown" : `${(amount * rate).toFixed(2)} ${to_ccy}`;
}

// Whatever the model sent as a tool's arguments.
type ToolArgs = Record<string, unknown>;

// The dispatch table the loop looks tool names up in. The model chooses both the
// name and the argument object, so this is the trust boundary: each entry casts
// once, right here, and the tool functions above stay strictly typed.
const TOOLS: Record<string, (args: ToolArgs) => string> = {
  get_weather: (args) => getWeather(args as unknown as WeatherArgs),
  convert_currency: (args) => convertCurrency(args as unknown as CurrencyArgs),
};

function callTool(name: string, args: ToolArgs): string {
  const tool = TOOLS[name];
  if (!tool) throw new Error(`Model asked for an unknown tool: ${name}`);
  return tool(args);
}

// One schema entry per tool. Provider wrappers below reshape these.
// A provider-neutral tool description. Each SDK wants a different shape, so the
// wrappers below reshape these rather than the schemas being written twice —
// which is the point this file is making.
interface ToolSchema {
  name: string;
  description: string;
  parameters: Anthropic.Tool.InputSchema;
}

const SCHEMAS: ToolSchema[] = [
  {
    name: "get_weather",
    description: "Current weather for a city.",
    parameters: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"],
    },
  },
  {
    name: "convert_currency",
    description: "Convert an amount between two ISO currency codes.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number" },
        from_ccy: { type: "string" },
        to_ccy: { type: "string" },
      },
      required: ["amount", "from_ccy", "to_ccy"],
    },
  },
];
const QUESTION = "What's the weather in Tokyo, and how much is 50 USD in JPY?";

async function runAnthropic(): Promise<void> {
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  const tools: Anthropic.Tool[] = SCHEMAS.map((schema) => ({
    name: schema.name,
    description: schema.description,
    input_schema: schema.parameters,
  }));
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
        results.push({ type: "tool_result", tool_use_id: block.id, content: callTool(block.name, block.input as ToolArgs) });
      }
    }
    messages.push({ role: "user", content: results });
  }
}

async function runOpenAI(): Promise<void> {
  const client = new OpenAI();
  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const tools: OpenAI.Chat.ChatCompletionTool[] = SCHEMAS.map((schema) => ({
    type: "function",
    function: {
      name: schema.name,
      description: schema.description,
      parameters: schema.parameters as Record<string, unknown>,
    },
  }));
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
      messages.push({ role: "tool", tool_call_id: tc.id, content: callTool(tc.function.name, args) });
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

export { getWeather, convertCurrency, runAnthropic, runOpenAI };
