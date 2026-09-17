/**
 * Output validation: treat the model's response as untrusted input.
 *
 * Run: `npx tsx 02-output-validation.ts [anthropic|openai]`
 *
 * Even with no attacker, model output can be wrong in ways your code must catch
 * before acting on it:
 *   - off allow-list: a label outside the set you support (hallucinated category),
 *   - too long: an unbounded blob where you expected a short value,
 *   - leaking PII/secrets: an email, card number, or key in the text.
 *
 * We run a real classification and validate the label against an allow-list (reject
 * anything else), then run the same validators over a crafted string to show the
 * PII/length checks firing. The pattern: validate -> on failure, fall back or
 * regenerate; never pass unvalidated model output to the next step.
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

const ALLOWED_LABELS = new Set(["BILLING", "BUG", "FEATURE"]);
const MAX_LEN = 200;

// Crude PII/secret patterns — illustrative, not exhaustive. Real systems use a
// dedicated scanner, but the principle (scan before trusting) is the point.
const PATTERNS = {
  email: /[\w.+-]+@[\w-]+\.[\w.-]+/,
  credit_card: /\b(?:\d[ -]?){13,16}\b/,
  api_key: /\b(sk|pa)-[A-Za-z0-9]{8,}\b/,
};

function findViolations(
  text: string,
  { allowLabels = false }: { allowLabels?: boolean } = {}
): string[] {
  const problems: string[] = [];
  if (allowLabels && !ALLOWED_LABELS.has(text.toUpperCase())) {
    problems.push(`label ${JSON.stringify(text.toUpperCase())} not in allow-list ${JSON.stringify([...ALLOWED_LABELS].sort())}`);
  }
  if (text.length > MAX_LEN) {
    problems.push(`too long (${text.length} > ${MAX_LEN} chars)`);
  }
  for (const [name, pattern] of Object.entries(PATTERNS)) {
    if (pattern.test(text)) problems.push(`contains possible ${name}`);
  }
  return problems;
}

async function classify(provider: string, text: string) {
  const system = "Classify the message as BILLING, BUG, or FEATURE. Reply with the label only.";
  if (provider === "anthropic") {
    const client = new Anthropic();
    const r = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
      max_tokens: 16,
      system,
      messages: [{ role: "user", content: text }],
    });
    return r.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  }

  const client = new OpenAI();
  const r = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    max_tokens: 16,
    messages: [
      { role: "system", content: system },
      { role: "user", content: text },
    ],
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
  const which = process.argv[2] || "both";

  for (const provider of ["anthropic", "openai"]) {
    if (which !== provider && which !== "both") continue;
    console.log(`\n=== ${provider} ===`);
    try {
      const label = await classify(provider, "I was double charged this month");
      const violations = findViolations(label, { allowLabels: true });
      const verdict = violations.length === 0 ? "ACCEPT" : `REJECT (${violations.join("; ")})`;
      console.log(`  model label: ${JSON.stringify(label)} -> ${verdict}`);
    } catch (err) {
      // e.g. unfunded key -> 429 insufficient_quota
      console.log(`  [skipped — ${brief(err)}]`);
    }
  }

  // Same validators over a deliberately bad string, so the PII/length checks fire.
  console.log("\n--- validators on a crafted bad output ---");
  const bad = "Sure! Contact the user at jane.doe@example.com or call 4111 1111 1111 1111.";
  console.log(`  input: ${JSON.stringify(bad)}`);
  console.log(`  violations: ${JSON.stringify(findViolations(bad))}`);
}

// ESM has no require.main === module. Comparing the script Node was handed
// against this module's own path is the equivalent.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { findViolations, classify };
