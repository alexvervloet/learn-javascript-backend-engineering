/**
 * LLM-as-judge: use a model to grade another model's answer.
 *
 * Run: `npx tsx 01-llm-as-judge.ts [anthropic|openai]`
 *
 * When "correct" is fuzzy, a second model call can grade the first against a rubric.
 * We give the judge a question, a candidate answer, and explicit criteria, and ask
 * for a STRUCTURED verdict (pass/fail, 1-5 score, one-line reason) using the
 * schema-enforced parsing from ../structured-outputs/. A structured verdict is what
 * makes the judge usable in an automated harness — you can branch and aggregate on
 * it.
 *
 * We grade two candidates: one good, one that's confidently wrong, so you can see the
 * judge separate them. (Judges aren't perfect — they're a scalable approximation of
 * human review, not ground truth.)
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

const Verdict = z.object({
  passed: z.boolean(),
  score: z.number().int().min(1).max(5).describe("1=terrible, 5=excellent"),
  reason: z.string(),
});

const QUESTION = "What does the SQL keyword JOIN do?";
const CANDIDATES = {
  good: "JOIN combines rows from two or more tables based on a related column between them.",
  wrong: "JOIN permanently merges two tables into one and deletes the originals.",
};

function judgePrompt(answer: string): string {
  return (
    "You are grading an answer for factual correctness and clarity.\n" +
    `Question: ${QUESTION}\n` +
    `Answer to grade: ${answer}\n\n` +
    "Pass only if the answer is factually correct. Give a 1-5 score and a brief reason."
  );
}

// The verdict shape comes from the Zod schema, so z.infer keeps the two in
// step: change the schema and every reader of a verdict stops compiling.
type VerdictResult = z.infer<typeof Verdict>;

async function judgeAnthropic(answer: string): Promise<VerdictResult | null> {
  const client = new Anthropic();
  const r = await client.messages.parse({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
    max_tokens: 512,
    messages: [{ role: "user", content: judgePrompt(answer) }],
    output_config: { format: zodOutputFormat(Verdict) },
  });
  return r.parsed_output;
}

async function judgeOpenAI(answer: string): Promise<VerdictResult | null> {
  const client = new OpenAI();
  const r = await client.chat.completions.parse({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    max_tokens: 512,
    messages: [{ role: "user", content: judgePrompt(answer) }],
    response_format: zodResponseFormat(Verdict, "verdict"),
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
  const judges = { anthropic: judgeAnthropic, openai: judgeOpenAI };
  for (const [provider, judge] of Object.entries(judges)) {
    if (which !== provider && which !== "both") continue;
    console.log(`\n=== judge: ${provider} ===`);
    try {
      for (const [label, answer] of Object.entries(CANDIDATES)) {
        // parsed_output is null when the model returns something that does not
        // match the schema — the case this module is about.
        const v = await judge(answer);
        if (!v) {
          console.log(`  [${label.padStart(5)}] no parsable verdict returned`);
          continue;
        }
        const mark = v.passed ? "PASS" : "FAIL";
        console.log(`  [${label.padStart(5)}] ${mark} score=${v.score} — ${v.reason}`);
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

export { Verdict, judgeAnthropic, judgeOpenAI };
