/**
 * Schema-enforced output: define a Zod schema, get back a validated object.
 *
 * Run: `npx tsx 02-zod-schema.ts [anthropic|openai]`
 *
 * This is the production answer to "I need data, not text." You define the shape
 * ONCE as a Zod schema and hand it to the SDK's parse helper. The provider
 * constrains generation to match the schema, and the SDK returns a validated
 * object — no fences, no preamble, no `JSON.parse`, no guessing about types.
 *
 * (Zod is a runtime schema validator for JavaScript — you declare the shape once
 * and validate against it.)
 *
 * Both SDKs accept the *same* Zod schema; only the helper, parameter, and where the
 * result lands differ:
 *   - Anthropic: messages.parse({ output_config: { format: zodOutputFormat(Schema) } })
 *                -> .parsed_output
 *   - OpenAI:    chat.completions.parse({ response_format: zodResponseFormat(Schema, name) })
 *                -> .choices[0].message.parsed
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import dotenv from "dotenv";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import z from "zod";

// ESM has no __dirname. This is the equivalent.
const here = path.dirname(fileURLToPath(import.meta.url));

// dotenv has no ESM default-export config helper in this version, so the
// module is imported and its config() called explicitly. It must run before
// any client below reads an API key out of process.env.
dotenv.config({ path: path.join(here, "..", ".env"), quiet: true });

// The exact shape we want back. Field types and the enums are enforced.
const SupportTicket = z.object({
  summary: z.string(),
  category: z.enum(["BILLING", "BUG", "FEATURE"]),
  priority: z.enum(["low", "medium", "high"]),
  needs_human: z.boolean(),
});

const TEXT =
  "Subject: URGENT - double charged!! I've been billed twice for my annual plan " +
  "and need this refunded today, I'm furious.";
const INSTRUCTION = `Extract a structured support ticket from this message.\n\n${TEXT}`;

async function parseAnthropic() {
  const client = new Anthropic();
  const r = await client.messages.parse({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
    max_tokens: 512,
    messages: [{ role: "user", content: INSTRUCTION }],
    output_config: { format: zodOutputFormat(SupportTicket) },
  });
  return r.parsed_output;
}

async function parseOpenAI() {
  const client = new OpenAI();
  const r = await client.chat.completions.parse({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    max_tokens: 512,
    messages: [{ role: "user", content: INSTRUCTION }],
    response_format: zodResponseFormat(SupportTicket, "support_ticket"),
  });
  return r.choices[0].message.parsed;
}

function brief(err: unknown): string {
  const name = err instanceof Error ? err.constructor.name : "Error";
  const message = err instanceof Error ? err.message : String(err);
  return `${name}: ${message.split("\n")[0]?.slice(0, 110)}`;
}

async function main(): Promise<void> {
  const which = process.argv[2] || "both";
  for (const [provider, fn] of Object.entries({ anthropic: parseAnthropic, openai: parseOpenAI })) {
    if (which !== provider && which !== "both") continue;
    console.log(`\n=== ${provider} ===`);
    try {
      // parsed_output is null when the model returns something the schema
      // rejects — the case this module exists to show.
      const ticket = await fn(); // already a validated object matching SupportTicket
      if (!ticket) {
        console.log("  model returned nothing matching the schema");
        continue;
      }
      console.log(ticket);
      // Because it's a real object, your code can branch on it with confidence:
      if (ticket.needs_human && ticket.priority === "high") {
        console.log("  -> routing to a human agent immediately");
      }
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

export { SupportTicket, parseAnthropic, parseOpenAI };
